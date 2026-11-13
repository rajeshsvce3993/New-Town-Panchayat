import {
  collapseDimensionRollupsToSubjectCategory,
  isFallbackInspectionWork,
  sumSubjectCategoryRollupsForFilter,
  type InspectionWorkReportDimensionRollup,
  type InspectionWorksFilterMasters,
  type InspectionWorksFilterQuery,
} from '@/lib/inspectionWorksQueryFilters';
import { deriveSubmittedDateYmd } from '@/lib/inspectionWorkReportIndex';
import {
  districtIdsForZone,
  tpIdsForDistrict,
  tpIdsForZone,
  wardFilterVariants,
} from '@/lib/inspectionWorksMongoRepository';
import os from 'node:os';

export const INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION = 'inspectionWorkReportRollups';

export type InspectionWorkReportRollupDims = {
  submittedDateYmd: string;
  zoneId: string;
  districtId: string;
  tpId: string;
  wardNumber: string;
  submittedByUserName: string;
  subjectId: string;
  categoryId: string;
};

export type InspectionWorkReportRollupCounts = {
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
  subjectCategoryRollups: Array<{ subjectId: string; categoryId: string; count: number }>;
  dimensionRollups: InspectionWorkReportDimensionRollup[];
  source: 'mongo-rollup';
};

type InspectionWorkReportRollupDoc = InspectionWorkReportRollupDims & {
  _id: string;
  count: number;
};

const SEP = '\x1f';
const LIVE_COLLECTION = INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION;
const BUILD_COLLECTION = `${INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION}_build`;
const PREV_COLLECTION = `${INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION}_prev`;
const META_ID = 'inspection_work_report_rollups';
const WORKS_GEO_REPAIR_META_ID = 'geo_hierarchy_repair_v5';
const ROLLUP_SCHEMA_VERSION = 3;
const MONTH_AGG_MAX_MS = 180_000;
const STALE_BUILD_MS = 10 * 60_000;
const CATCHUP_DAYS = 3;
const CATCHUP_MIN_INTERVAL_MS = 15 * 60 * 1000;
const WORKER_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BUILD_HINT_TTL_MS = 2_000;
const QUERY_MAX_MS = 8_000;

let indexesReady = false;
let workerStarted = false;
let workerInFlight: Promise<void> | null = null;
let buildHint: { status: string; completedThroughYmd: string; schemaVersion: number } | null = null;
let buildHintAt = 0;

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function idVariants(id: string): string[] {
  const s = norm(id);
  if (!s) return [];
  return [...new Set([s, s.toLowerCase(), s.toUpperCase()])];
}

function firstNonEmpty(...values: unknown[]): string {
  for (const value of values) {
    const s = norm(value);
    if (s) return s;
  }
  return '';
}

type RollupMetaDoc = {
  _id: string;
  schemaVersion: number;
  status: 'ready' | 'building' | 'queued';
  forceRebuild?: boolean;
  lastCatchupAt?: Date;
  build?: {
    owner?: string;
    heartbeatAt?: Date;
    cursorMonth?: string;
    minYmd?: string;
    maxYmd?: string;
    completedThroughYmd?: string;
    startedAt?: Date;
  };
};

export function inspectionWorkReportRollupDims(work: any): InspectionWorkReportRollupDims | null {
  const submittedDateYmd = deriveSubmittedDateYmd(work);
  if (!submittedDateYmd) return null;
  const zoneId = norm(work.zoneId);
  const districtId = norm(work.districtId);
  const tpId = firstNonEmpty(work.tpId, work.townPanchayatId);
  if (!zoneId && !districtId && !tpId) return null;
  return {
    submittedDateYmd,
    zoneId,
    districtId,
    tpId,
    wardNumber: norm(work.wardNumber ?? work.wardNo ?? work.ward),
    submittedByUserName: norm(work.submittedByUserName || work.username),
    subjectId: norm(work.subjectId) || 'unknown',
    categoryId: norm(work.categoryId) || '_unknown',
  };
}

export function inspectionWorkReportRollupId(dims: InspectionWorkReportRollupDims): string {
  return [
    dims.submittedDateYmd,
    dims.zoneId,
    dims.districtId,
    dims.tpId,
    dims.wardNumber,
    dims.submittedByUserName,
    dims.subjectId,
    dims.categoryId,
  ].join(SEP);
}

async function mongo() {
  const { getMongoClient, getActiveMongoDb } = await import('@/lib/storage');
  const client = await getMongoClient();
  if (!client) return null;
  const db = await getActiveMongoDb(client);
  return {
    db,
    rollups: db.collection<InspectionWorkReportRollupDoc>(LIVE_COLLECTION),
    build: db.collection<InspectionWorkReportRollupDoc>(BUILD_COLLECTION),
    meta: db.collection<RollupMetaDoc>('appMeta'),
    works: db.collection('inspectionWorks'),
  };
}

type MongoCtx = NonNullable<Awaited<ReturnType<typeof mongo>>>;

async function ensureRollupCollectionIndexes(col: { createIndex: Function }) {
  await Promise.allSettled([
    col.createIndex({ submittedDateYmd: 1, tpId: 1, subjectId: 1, categoryId: 1 }, { background: true }),
    col.createIndex({ submittedDateYmd: 1, districtId: 1, subjectId: 1 }, { background: true }),
    col.createIndex({ submittedDateYmd: 1, zoneId: 1 }, { background: true }),
    col.createIndex({ submittedDateYmd: 1, wardNumber: 1 }, { background: true }),
    col.createIndex({ submittedDateYmd: 1, submittedByUserName: 1 }, { background: true }),
  ]);
}

export async function ensureInspectionWorkReportIndexes(): Promise<void> {
  if (indexesReady) return;
  const ctx = await mongo();
  if (!ctx) return;
  await Promise.allSettled([
    ctx.works.createIndex({ submittedDateYmd: -1, submittedAt: -1, workId: -1 }, { background: true }),
    ctx.works.createIndex({ submittedDateYmd: -1, tpId: 1, submittedAt: -1, workId: -1 }, { background: true }),
    ctx.works.createIndex({ submittedDateYmd: 1 }, { background: true }),
    ctx.works.createIndex({ streetName: 1, submittedDateYmd: -1 }, { background: true }),
    ctx.works.createIndex({ workId: 1 }, { background: true }),
    ensureRollupCollectionIndexes(ctx.rollups),
  ]);
  indexesReady = true;
}

function buildRollupMatch(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { omitCategory?: boolean }
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  if (filter.fromDate || filter.toDate) {
    const fromDate = filter.fromDate || filter.toDate!;
    const toDate = filter.toDate || filter.fromDate!;
    and.push({ submittedDateYmd: { $gte: fromDate, $lte: toDate } });
  } else if (filter.dateParam) {
    and.push({ submittedDateYmd: filter.dateParam });
  }

  const scopeTp = filter.tpId || filter.scopeTpId;
  const scopeDistrict = filter.tpId ? null : filter.districtId || filter.scopeDistrictId;
  const scopeZone = filter.tpId || filter.districtId ? null : filter.zoneId || filter.scopeZoneId;

  if (scopeTp) {
    const variants = idVariants(scopeTp);
    const tp = (masters.townPanchayats || []).find((t) => variants.includes(norm(t.id).toLowerCase()));
    const ids = [...variants];
    if (tp?.id) ids.push(norm(tp.id));
    and.push({ tpId: { $in: [...new Set(ids.filter(Boolean))] } });
  } else if (scopeDistrict) {
    const variants = idVariants(scopeDistrict);
    const tpIds = tpIdsForDistrict(scopeDistrict, masters);
    const dist = (masters.districts || []).find((d) => variants.includes(norm(d.id).toLowerCase()));
    const or: Record<string, unknown>[] = [{ districtId: { $in: variants } }];
    if (dist?.id) or.push({ districtId: dist.id });
    if (tpIds.length) or.push({ tpId: { $in: tpIds } });
    and.push({ $or: or });
  } else if (scopeZone) {
    const districtIds = districtIdsForZone(scopeZone, masters);
    const tpIds = tpIdsForZone(scopeZone, masters);
    const zone = (masters.zones || []).find((z) => idVariants(scopeZone).includes(norm(z.id).toLowerCase()));
    const zoneIds = [...idVariants(scopeZone)];
    if (zone?.id) zoneIds.push(norm(zone.id));
    const or: Record<string, unknown>[] = [{ zoneId: { $in: [...new Set(zoneIds.filter(Boolean))] } }];
    if (districtIds.length) or.push({ districtId: { $in: districtIds } });
    if (tpIds.length) or.push({ tpId: { $in: tpIds } });
    and.push({ $or: or });
  }

  if (filter.ward) {
    and.push({
      wardNumber: { $in: wardFilterVariants(filter.ward).map((v) => String(v)) },
    });
  }
  if (filter.username) {
    const u = norm(filter.username);
    and.push({
      submittedByUserName: { $in: [...new Set([u, u.toLowerCase(), u.toUpperCase()])] },
    });
  }
  if (filter.subjectId) {
    const s = norm(filter.subjectId);
    const subj = (masters.inspectionSubjects || []).find(
      (x) =>
        norm(x.id).toLowerCase() === s.toLowerCase() ||
        norm(x.code).toLowerCase() === s.toLowerCase() ||
        norm(x.nameEn).toLowerCase() === s.toLowerCase()
    );
    const ids = idVariants(filter.subjectId);
    if (subj?.id) ids.push(norm(subj.id));
    if (subj?.code) ids.push(norm(subj.code));
    if (subj?.nameEn) ids.push(norm(subj.nameEn));
    and.push({ subjectId: { $in: [...new Set(ids.filter(Boolean))] } });
  }
  if (!opts?.omitCategory && filter.categoryId) {
    const c = norm(filter.categoryId);
    const cat = (masters.inspectionCategories || []).find(
      (x) =>
        norm(x.id).toLowerCase() === c.toLowerCase() ||
        norm(x.code).toLowerCase() === c.toLowerCase() ||
        norm(x.nameEn).toLowerCase() === c.toLowerCase()
    );
    const ids = idVariants(filter.categoryId);
    if (cat?.id) ids.push(norm(cat.id));
    if (cat?.code) ids.push(norm(cat.code));
    if (cat?.nameEn) ids.push(norm(cat.nameEn));
    and.push({ categoryId: { $in: [...new Set(ids.filter(Boolean))] } });
  }

  and.push({
    subjectId: { $nin: ['subj_general', 'general_inspection'] },
  });
  and.push({
    categoryId: { $nin: ['cat_field_check', 'cat_general', 'field_check'] },
  });

  if (!and.length) return {};
  return and.length === 1 ? and[0] : { $and: and };
}

function fallbackNorMatch(): Record<string, unknown> {
  return {
    $nor: [
      { subjectId: { $in: ['subj_general', 'general_inspection'] } },
      { categoryId: { $in: ['cat_field_check', 'cat_general', 'field_check'] } },
      { subjectNameEn: { $regex: /^(general inspection|general)$/i } },
      { categoryNameEn: { $regex: /^(field check|general category|general inspection)$/i } },
    ],
  };
}

function bumpCount(counts: Record<string, number>, key: string, n: number) {
  const k = String(key || '').trim();
  if (!k || !n) return;
  counts[k] = (counts[k] || 0) + n;
}

function categoryCountsFromRollupRows(
  rows: Array<{ categoryId: string; count: number }>,
  categories: any[] = []
): Record<string, number> {
  const counts: Record<string, number> = {};
  const byId = new Map<string, any>();
  const byCode = new Map<string, any>();
  const byNameEn = new Map<string, any>();
  for (const c of categories) {
    const cId = norm(c.id);
    const cCode = norm(c.code).toLowerCase();
    const cName = norm(c.nameEn).toLowerCase();
    if (cId) byId.set(cId, c);
    if (cCode) byCode.set(cCode, c);
    if (cName) byNameEn.set(cName, c);
  }
  for (const row of rows) {
    const n = Number(row.count) || 0;
    if (!n) continue;
    let catId = norm(row.categoryId);
    const cat =
      (catId && (byId.get(catId) || byCode.get(catId.toLowerCase()))) ||
      (catId && byNameEn.get(catId.toLowerCase())) ||
      undefined;
    if (cat) {
      catId = norm(cat.id || catId);
      bumpCount(counts, catId, n);
      if (cat.code) bumpCount(counts, String(cat.code), n);
      if (cat.nameEn) bumpCount(counts, norm(cat.nameEn).toLowerCase(), n);
    } else if (catId) {
      bumpCount(counts, catId, n);
    } else {
      bumpCount(counts, '_unknown', n);
    }
  }
  return counts;
}

function emptyRollupCounts(): InspectionWorkReportRollupCounts {
  return {
    categoryCounts: {},
    totalWithoutCategoryFilter: 0,
    subjectCategoryRollups: [],
    dimensionRollups: [],
    source: 'mongo-rollup',
  };
}

function isMissingNamespace(err: unknown): boolean {
  const e = err as { code?: number; message?: string };
  return e?.code === 26 || /ns not found|namespace.*not found/i.test(String(e?.message || ''));
}

function workerOwner(): string {
  return `${os.hostname()}:${process.pid}`;
}

function isYmd(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

function addMonths(monthStartYmd: string, n: number): string {
  const y = Number(monthStartYmd.slice(0, 4));
  const m = Number(monthStartYmd.slice(5, 7));
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

function lastYmdOfMonth(monthStartYmd: string): string {
  const y = Number(monthStartYmd.slice(0, 4));
  const m = Number(monthStartYmd.slice(5, 7));
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function addDays(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function istYmd(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function recentCatchupRange(days = CATCHUP_DAYS): { from: string; toExclusive: string } {
  const today = istYmd();
  const from = addDays(today, -(days - 1));
  return { from, toExclusive: addDays(today, 1) };
}

function submittedDateYmdAddFields(): Record<string, unknown> {
  return {
    submittedDateYmd: {
      $let: {
        vars: { ymd: { $ifNull: ['$submittedDateYmd', ''] } },
        in: {
          $cond: [
            { $eq: [{ $strLenCP: '$$ymd' }, 10] },
            '$$ymd',
            {
              $let: {
                vars: {
                  dt: {
                    $convert: {
                      input: { $ifNull: ['$submittedAt', { $ifNull: ['$createdAt', '$date'] }] },
                      to: 'date',
                      onError: null,
                      onNull: null,
                    },
                  },
                },
                in: {
                  $cond: [
                    { $eq: ['$$dt', null] },
                    '',
                    {
                      $dateToString: {
                        format: '%Y-%m-%d',
                        timezone: 'Asia/Kolkata',
                        date: '$$dt',
                      },
                    },
                  ],
                },
              },
            },
          ],
        },
      },
    },
    tpId: { $ifNull: [{ $ifNull: ['$tpId', '$townPanchayatId'] }, ''] },
    wardNumber: {
      $convert: {
        input: { $ifNull: [{ $ifNull: ['$wardNumber', '$wardNo'] }, { $ifNull: ['$ward', ''] }] },
        to: 'string',
        onError: '',
        onNull: '',
      },
    },
    submittedByUserName: { $ifNull: [{ $ifNull: ['$submittedByUserName', '$username'] }, ''] },
    zoneId: { $ifNull: ['$zoneId', ''] },
    districtId: { $ifNull: ['$districtId', ''] },
    subjectId: { $ifNull: ['$subjectId', 'unknown'] },
    categoryId: { $ifNull: ['$categoryId', '_unknown'] },
  };
}

function monthMergePipeline(fromYmd: string, toYmdExclusive: string, into: string): Record<string, unknown>[] {
  const start = new Date(`${fromYmd}T00:00:00+05:30`);
  const end = new Date(`${toYmdExclusive}T00:00:00+05:30`);
  return [
    {
      $match: {
        $and: [
          fallbackNorMatch(),
          {
            $or: [
              { submittedDateYmd: { $gte: fromYmd, $lt: toYmdExclusive } },
              {
                $and: [
                  { $or: [{ submittedDateYmd: { $exists: false } }, { submittedDateYmd: null }, { submittedDateYmd: '' }] },
                  {
                    $or: [
                      { submittedAt: { $gte: start, $lt: end } },
                      { createdAt: { $gte: start, $lt: end } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    { $addFields: submittedDateYmdAddFields() },
    {
      $match: {
        submittedDateYmd: { $gte: fromYmd, $lt: toYmdExclusive },
        $or: [
          { tpId: { $nin: [null, ''] } },
          { districtId: { $nin: [null, ''] } },
          { zoneId: { $nin: [null, ''] } },
        ],
      },
    },
    {
      $group: {
        _id: {
          submittedDateYmd: '$submittedDateYmd',
          zoneId: '$zoneId',
          districtId: '$districtId',
          tpId: '$tpId',
          wardNumber: '$wardNumber',
          submittedByUserName: '$submittedByUserName',
          subjectId: '$subjectId',
          categoryId: '$categoryId',
        },
        count: { $sum: 1 },
      },
    },
    {
      $project: {
        _id: {
          $concat: [
            { $ifNull: ['$_id.submittedDateYmd', ''] },
            SEP,
            { $ifNull: ['$_id.zoneId', ''] },
            SEP,
            { $ifNull: ['$_id.districtId', ''] },
            SEP,
            { $ifNull: ['$_id.tpId', ''] },
            SEP,
            { $ifNull: ['$_id.wardNumber', ''] },
            SEP,
            { $ifNull: ['$_id.submittedByUserName', ''] },
            SEP,
            { $ifNull: ['$_id.subjectId', ''] },
            SEP,
            { $ifNull: ['$_id.categoryId', ''] },
          ],
        },
        submittedDateYmd: '$_id.submittedDateYmd',
        zoneId: '$_id.zoneId',
        districtId: '$_id.districtId',
        tpId: '$_id.tpId',
        wardNumber: '$_id.wardNumber',
        submittedByUserName: '$_id.submittedByUserName',
        subjectId: '$_id.subjectId',
        categoryId: '$_id.categoryId',
        count: 1,
      },
    },
    {
      $merge: {
        into,
        on: '_id',
        whenMatched: 'replace',
        whenNotMatched: 'insert',
      },
    },
  ];
}

async function collectionExists(ctx: MongoCtx, name: string): Promise<boolean> {
  const found = await ctx.db.listCollections({ name }, { nameOnly: true }).toArray();
  return found.length > 0;
}

async function mergeDateRange(ctx: MongoCtx, into: string, fromYmd: string, toYmdExclusive: string): Promise<void> {
  await ctx.works
    .aggregate(monthMergePipeline(fromYmd, toYmdExclusive, into), {
      allowDiskUse: true,
      maxTimeMS: MONTH_AGG_MAX_MS,
    })
    .toArray();
}

async function worksYmdBounds(ctx: MongoCtx): Promise<{ minYmd: string; maxYmd: string } | null> {
  const ymdFilter = { submittedDateYmd: { $type: 'string', $regex: /^\d{4}-\d{2}-\d{2}$/ } };
  const [minYmdDoc] = await ctx.works
    .find(ymdFilter)
    .sort({ submittedDateYmd: 1 })
    .limit(1)
    .project({ submittedDateYmd: 1 })
    .toArray();
  const [maxYmdDoc] = await ctx.works
    .find(ymdFilter)
    .sort({ submittedDateYmd: -1 })
    .limit(1)
    .project({ submittedDateYmd: 1 })
    .toArray();
  let minYmd = isYmd(minYmdDoc?.submittedDateYmd) ? minYmdDoc.submittedDateYmd : '';
  let maxYmd = isYmd(maxYmdDoc?.submittedDateYmd) ? maxYmdDoc.submittedDateYmd : '';
  if (!minYmd || !maxYmd) {
    const [minAt] = await ctx.works
      .find({ submittedAt: { $type: 'date' } })
      .sort({ submittedAt: 1 })
      .limit(1)
      .project({ submittedAt: 1 })
      .toArray();
    const [maxAt] = await ctx.works
      .find({ submittedAt: { $type: 'date' } })
      .sort({ submittedAt: -1 })
      .limit(1)
      .project({ submittedAt: 1 })
      .toArray();
    if (minAt?.submittedAt) minYmd = minYmd || istYmd(new Date(minAt.submittedAt));
    if (maxAt?.submittedAt) maxYmd = maxYmd || istYmd(new Date(maxAt.submittedAt));
  }
  if (!minYmd || !maxYmd) return null;
  return { minYmd, maxYmd };
}

function invalidateBuildHint() {
  buildHint = null;
  buildHintAt = 0;
}

async function refreshBuildHint(ctx: MongoCtx): Promise<typeof buildHint> {
  if (buildHint && Date.now() - buildHintAt < BUILD_HINT_TTL_MS) return buildHint;
  const meta = (await ctx.meta.findOne({ _id: META_ID })) as RollupMetaDoc | null;
  buildHint = {
    status: meta?.status || 'ready',
    completedThroughYmd: meta?.build?.completedThroughYmd || '',
    schemaVersion: Number(meta?.schemaVersion) || 0,
  };
  buildHintAt = Date.now();
  return buildHint;
}

async function heartbeatBuild(ctx: MongoCtx, owner: string, cursorMonth: string): Promise<boolean> {
  const res = await ctx.meta.updateOne(
    { _id: META_ID, status: 'building', 'build.owner': owner },
    { $set: { 'build.heartbeatAt': new Date(), 'build.cursorMonth': cursorMonth } }
  );
  return res.matchedCount > 0;
}

async function markRollupsReady(ctx: MongoCtx): Promise<void> {
  await ctx.meta.updateOne(
    { _id: META_ID },
    {
      $set: {
        schemaVersion: ROLLUP_SCHEMA_VERSION,
        status: 'ready',
        forceRebuild: false,
        lastCatchupAt: new Date(),
      },
      $unset: { build: '' },
    },
    { upsert: true }
  );
  invalidateBuildHint();
}

async function promoteBuildToLive(ctx: MongoCtx): Promise<void> {
  if (!(await collectionExists(ctx, BUILD_COLLECTION))) {
    throw new Error('BUILD collection missing; abort swap');
  }
  if (await collectionExists(ctx, PREV_COLLECTION)) {
    await ctx.db.collection(PREV_COLLECTION).drop();
  }
  if (await collectionExists(ctx, LIVE_COLLECTION)) {
    await ctx.db.renameCollection(LIVE_COLLECTION, PREV_COLLECTION);
  }
  await ctx.db.renameCollection(BUILD_COLLECTION, LIVE_COLLECTION);
  if (await collectionExists(ctx, PREV_COLLECTION)) {
    await ctx.db.collection(PREV_COLLECTION).drop().catch(() => undefined);
  }
  indexesReady = false;
  await ensureRollupCollectionIndexes(ctx.db.collection(LIVE_COLLECTION));
  indexesReady = true;
  try {
    const { invalidateInspectionWorksAggregateCache } = await import('@/lib/inspectionWorksReportsAggregate');
    invalidateInspectionWorksAggregateCache();
  } catch (_) {}
  try {
    const { invalidateInspectionDashboardStatsCache } = await import('@/lib/storage');
    invalidateInspectionDashboardStatsCache();
  } catch (_) {}
}

async function catchupRecentDays(ctx: MongoCtx, into: string): Promise<void> {
  const { from, toExclusive } = recentCatchupRange();
  if (into === BUILD_COLLECTION) {
    await ctx.build.deleteMany({ submittedDateYmd: { $gte: from, $lt: toExclusive } });
  }
  await mergeDateRange(ctx, into, from, toExclusive);
  console.log(`[inspectionWorkReportRollups] catchup ${from}..${addDays(toExclusive, -1)} → ${into}`);
}

async function claimBuildLock(ctx: MongoCtx, owner: string, force: boolean): Promise<RollupMetaDoc | null> {
  const staleBefore = new Date(Date.now() - STALE_BUILD_MS);
  await ctx.meta.updateOne(
    { _id: META_ID },
    { $setOnInsert: { schemaVersion: ROLLUP_SCHEMA_VERSION, status: 'ready' } },
    { upsert: true }
  );
  const current = (await ctx.meta.findOne({ _id: META_ID })) as RollupMetaDoc | null;
  const resume =
    !force &&
    current?.status === 'building' &&
    current.schemaVersion === ROLLUP_SCHEMA_VERSION &&
    !!current.build?.cursorMonth;

  const claimed = await ctx.meta.findOneAndUpdate(
    {
      _id: META_ID,
      $or: [
        { status: { $ne: 'building' } },
        { 'build.owner': owner },
        { 'build.heartbeatAt': { $lte: staleBefore } },
        { 'build.heartbeatAt': { $exists: false } },
      ],
    },
    {
      $set: {
        schemaVersion: ROLLUP_SCHEMA_VERSION,
        status: 'building',
        forceRebuild: false,
        'build.owner': owner,
        'build.heartbeatAt': new Date(),
        'build.startedAt': resume ? current?.build?.startedAt || new Date() : new Date(),
        'build.cursorMonth': resume ? current?.build?.cursorMonth || '' : '',
        'build.completedThroughYmd': resume ? current?.build?.completedThroughYmd || '' : '',
      },
    },
    { returnDocument: 'after' }
  );
  const doc = (claimed && typeof claimed === 'object' && 'value' in claimed ? (claimed as any).value : claimed) as
    | RollupMetaDoc
    | null;
  if (!doc) return null;
  if (force || !resume) {
    if (await collectionExists(ctx, BUILD_COLLECTION)) {
      await ctx.db.collection(BUILD_COLLECTION).drop().catch(() => undefined);
    }
  }
  invalidateBuildHint();
  return doc;
}

async function runFullBuild(ctx: MongoCtx, force: boolean): Promise<void> {
  const owner = workerOwner();
  const claimed = await claimBuildLock(ctx, owner, force);
  if (!claimed) {
    console.log('[inspectionWorkReportRollups] another process holds the build lock');
    return;
  }
  await ensureRollupCollectionIndexes(ctx.build);
  const bounds = await worksYmdBounds(ctx);
  if (!bounds) {
    await markRollupsReady(ctx);
    console.log('[inspectionWorkReportRollups] no inspection works with dates; LIVE left unchanged');
    return;
  }
  await ctx.meta.updateOne(
    { _id: META_ID, 'build.owner': owner },
    { $set: { 'build.minYmd': bounds.minYmd, 'build.maxYmd': bounds.maxYmd, 'build.heartbeatAt': new Date() } }
  );

  let month = claimed.build?.cursorMonth && isYmd(claimed.build.cursorMonth)
    ? monthStart(claimed.build.cursorMonth)
    : monthStart(bounds.minYmd);
  if (month < monthStart(bounds.minYmd)) month = monthStart(bounds.minYmd);

  while (month <= bounds.maxYmd) {
    if (!(await heartbeatBuild(ctx, owner, month))) {
      console.log('[inspectionWorkReportRollups] lost build lock; stopping');
      return;
    }
    const next = addMonths(month, 1);
    await ctx.build.deleteMany({ submittedDateYmd: { $gte: month, $lt: next } });
    await mergeDateRange(ctx, BUILD_COLLECTION, month, next);
    await ctx.meta.updateOne(
      { _id: META_ID, 'build.owner': owner },
      {
        $set: {
          'build.completedThroughYmd': lastYmdOfMonth(month),
          'build.cursorMonth': next,
          'build.heartbeatAt': new Date(),
        },
      }
    );
    invalidateBuildHint();
    console.log(`[inspectionWorkReportRollups] merged ${month} .. ${lastYmdOfMonth(month)} into BUILD`);
    month = next;
  }

  await catchupRecentDays(ctx, BUILD_COLLECTION);
  await promoteBuildToLive(ctx);
  await markRollupsReady(ctx);
  const buckets = await ctx.db.collection(LIVE_COLLECTION).estimatedDocumentCount();
  console.log(`[inspectionWorkReportRollups] BUILD promoted to LIVE (${buckets} buckets)`);
}

type GeoRemap = {
  districtId: string;
  fromZoneId?: string;
  zoneId: string;
  zoneNameEn?: string;
  zoneNameTa?: string;
  tpIds?: string[];
};

async function remapRollupZoneIds(ctx: MongoCtx, remaps: GeoRemap[]): Promise<number> {
  const changed = remaps.filter(
    (r) => r.districtId && r.zoneId && norm(r.fromZoneId).toLowerCase() !== norm(r.zoneId).toLowerCase()
  );
  if (!changed.length) return 0;
  const cols = [LIVE_COLLECTION, BUILD_COLLECTION, PREV_COLLECTION];
  let moved = 0;
  for (const colName of cols) {
    if (!(await collectionExists(ctx, colName))) continue;
    const col = ctx.db.collection<InspectionWorkReportRollupDoc>(colName);
    for (const remap of changed) {
      const cursor = col.find({ districtId: remap.districtId, zoneId: { $ne: remap.zoneId } });
      for await (const doc of cursor) {
        const nextDims: InspectionWorkReportRollupDims = {
          submittedDateYmd: doc.submittedDateYmd,
          zoneId: remap.zoneId,
          districtId: doc.districtId,
          tpId: doc.tpId,
          wardNumber: doc.wardNumber,
          submittedByUserName: doc.submittedByUserName,
          subjectId: doc.subjectId,
          categoryId: doc.categoryId,
        };
        const newId = inspectionWorkReportRollupId(nextDims);
        const count = Number(doc.count) || 0;
        if (newId === String(doc._id)) {
          await col.updateOne({ _id: doc._id }, { $set: { zoneId: remap.zoneId } });
          moved += 1;
          continue;
        }
        await col.updateOne(
          { _id: newId as any },
          {
            $set: { zoneId: remap.zoneId },
            $setOnInsert: {
              submittedDateYmd: nextDims.submittedDateYmd,
              districtId: nextDims.districtId,
              tpId: nextDims.tpId,
              wardNumber: nextDims.wardNumber,
              submittedByUserName: nextDims.submittedByUserName,
              subjectId: nextDims.subjectId,
              categoryId: nextDims.categoryId,
            },
            $inc: { count },
          },
          { upsert: true }
        );
        await col.deleteOne({ _id: doc._id });
        moved += 1;
      }
    }
  }
  if (moved) {
    console.log(`[geo-hierarchy] Remapped ${moved} report rollup buckets onto corrected zone ids`);
  }
  return moved;
}

async function maybeRepairWorksGeoOnce(ctx: MongoCtx): Promise<void> {
  const metaCol = ctx.db.collection('appMeta');
  const existing = await metaCol.findOne({ _id: WORKS_GEO_REPAIR_META_ID });
  if (existing?.done) return;
  const claimed = await metaCol.findOneAndUpdate(
    { _id: WORKS_GEO_REPAIR_META_ID, done: { $ne: true }, startedAt: { $exists: false } },
    { $set: { startedAt: new Date(), owner: workerOwner() } },
    { upsert: true, returnDocument: 'after' }
  );
  const doc = claimed && typeof claimed === 'object' && 'value' in claimed ? (claimed as any).value : claimed;
  if (!doc || doc.done) return;
  if (doc.owner && doc.owner !== workerOwner() && doc.startedAt) return;
  try {
    const { canonicalizeTiruvallurSpellings } = require('./canonicalizeTiruvallurMongo.js');
    const result = await canonicalizeTiruvallurSpellings(ctx.db);
    const remapped = await remapRollupZoneIds(ctx, result?.remaps || []);
    try {
      const { invalidateInspectionWorksLiteCache } = await import('@/lib/inspectionWorksLiteLoader');
      invalidateInspectionWorksLiteCache();
    } catch (_) {}
    try {
      const { invalidateInspectionWorksAggregateCache } = await import('@/lib/inspectionWorksReportsAggregate');
      invalidateInspectionWorksAggregateCache();
    } catch (_) {}
    await metaCol.updateOne(
      { _id: WORKS_GEO_REPAIR_META_ID },
      {
        $set: {
          done: true,
          finishedAt: new Date(),
          remaps: (result?.remaps || []).length,
          remappedRollups: remapped,
          modified: result?.modified || 0,
        },
      }
    );
    console.log(
      `[geo-hierarchy] One-time collection repair finished on "${result?.dbName || ctx.db.databaseName}" modified=${result?.modified || 0} remaps=${(result?.remaps || []).length} rollups=${remapped} emptyFilled=${result?.emptyGeo?.filled || 0} emptyUnresolved=${result?.emptyGeo?.unresolved || 0} emptyByZoneDistrict=${JSON.stringify(result?.emptyGeo?.byZone || {})}`
    );
  } catch (err) {
    console.warn('[geo-hierarchy] one-time geo repair failed:', err);
    await metaCol.updateOne(
      { _id: WORKS_GEO_REPAIR_META_ID },
      { $unset: { startedAt: 1, owner: 1 } }
    );
  }
}

function catchupIsFresh(meta: RollupMetaDoc | null): boolean {
  if (!meta?.lastCatchupAt) return false;
  const at = new Date(meta.lastCatchupAt).getTime();
  return Number.isFinite(at) && Date.now() - at < CATCHUP_MIN_INTERVAL_MS;
}

async function runRollupWorker(): Promise<void> {
  const ctx = await mongo();
  if (!ctx) return;
  await ensureInspectionWorkReportIndexes();
  await maybeRepairWorksGeoOnce(ctx);
  const meta = (await ctx.meta.findOne({ _id: META_ID })) as RollupMetaDoc | null;
  const liveCount = (await collectionExists(ctx, LIVE_COLLECTION))
    ? await ctx.rollups.estimatedDocumentCount()
    : 0;
  const force = !!(meta?.forceRebuild || meta?.status === 'queued');
  if (force) {
    await runFullBuild(ctx, true);
  } else if (liveCount === 0) {
    if (meta?.status === 'building') {
      console.log('[inspectionWorkReportRollups] LIVE empty during build; reports keep serving PREV/LIVE');
    } else if (meta?.status === 'ready' || (await collectionExists(ctx, PREV_COLLECTION))) {
      console.warn('[inspectionWorkReportRollups] LIVE empty while marked ready; skip auto rebuild (swap/restart window)');
    } else {
      await runFullBuild(ctx, true);
    }
  } else if (!catchupIsFresh(meta)) {
    if (!meta || meta.schemaVersion !== ROLLUP_SCHEMA_VERSION || meta.status !== 'ready') {
      await ctx.meta.updateOne(
        { _id: META_ID },
        { $set: { schemaVersion: ROLLUP_SCHEMA_VERSION, status: 'ready', forceRebuild: false } },
        { upsert: true }
      );
    }
    await catchupRecentDays(ctx, LIVE_COLLECTION);
    await ctx.meta.updateOne({ _id: META_ID }, { $set: { lastCatchupAt: new Date() } }, { upsert: true });
  }
}

function tickRollupWorker(): Promise<void> {
  if (workerInFlight) return workerInFlight;
  workerInFlight = runRollupWorker()
    .catch((err) => {
      console.warn('[inspectionWorkReportRollups] worker failed:', err);
    })
    .finally(() => {
      workerInFlight = null;
    });
  return workerInFlight;
}

export function startInspectionReportRollupWorker(): void {
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.BUILDING === 'true'
  ) {
    return;
  }
  if (workerStarted) return;
  workerStarted = true;
  void tickRollupWorker();
  const timer = setInterval(() => {
    void tickRollupWorker();
  }, WORKER_INTERVAL_MS);
  timer.unref?.();
}

export async function enqueueInspectionWorkReportRollupRebuild(): Promise<{ queued: true }> {
  const ctx = await mongo();
  if (ctx) {
    await ctx.meta.updateOne(
      { _id: META_ID },
      { $set: { status: 'queued', forceRebuild: true } },
      { upsert: true }
    );
    invalidateBuildHint();
  }
  startInspectionReportRollupWorker();
  const pending = workerInFlight || Promise.resolve();
  void pending.then(() => tickRollupWorker());
  return { queued: true };
}

/** Compatibility: never deletes LIVE; enqueues a background BUILD→LIVE swap. */
export async function backfillInspectionWorkReportRollups(): Promise<{ buckets: number; queued: true }> {
  await enqueueInspectionWorkReportRollupRebuild();
  const ctx = await mongo();
  const buckets = ctx && (await collectionExists(ctx, LIVE_COLLECTION))
    ? await ctx.rollups.estimatedDocumentCount()
    : 0;
  return { buckets, queued: true };
}

export async function rebuildInspectionWorkReportRollups(): Promise<{ buckets: number; queued: true }> {
  return backfillInspectionWorkReportRollups();
}

export async function ensureInspectionWorkReportRollupsReady(): Promise<{
  ready: boolean;
  ranBackfill: boolean;
}> {
  startInspectionReportRollupWorker();
  return { ready: true, ranBackfill: false };
}

async function applyDeltaToCollection(
  col: MongoCtx['rollups'],
  dims: InspectionWorkReportRollupDims,
  delta: number
): Promise<void> {
  const _id = inspectionWorkReportRollupId(dims);
  try {
    await col.updateOne(
      { _id },
      {
        $inc: { count: delta },
        $setOnInsert: { ...dims, _id },
      },
      { upsert: true }
    );
    if (delta < 0) {
      await col.deleteMany({ _id, count: { $lte: 0 } });
    }
  } catch (err) {
    if (!isMissingNamespace(err)) throw err;
  }
}

async function applyRollupDelta(work: any, delta: number): Promise<void> {
  if (!work || typeof work !== 'object' || delta === 0) return;
  if (isFallbackInspectionWork(work)) return;
  const dims = inspectionWorkReportRollupDims(work);
  if (!dims) return;
  const ctx = await mongo();
  if (!ctx) return;
  await applyDeltaToCollection(ctx.rollups, dims, delta);
  const hint = await refreshBuildHint(ctx);
  if (
    hint &&
    hint.status === 'building' &&
    hint.completedThroughYmd &&
    dims.submittedDateYmd <= hint.completedThroughYmd
  ) {
    await applyDeltaToCollection(ctx.build, dims, delta);
  }
}

export async function incrementInspectionWorkReportRollup(work: any, delta = 1): Promise<void> {
  startInspectionReportRollupWorker();
  await applyRollupDelta(work, delta);
}

export async function syncInspectionWorkReportRollupOnSave(previous: any | null, next: any): Promise<void> {
  if (!next) return;
  if (!previous) {
    await incrementInspectionWorkReportRollup(next, 1);
    return;
  }
  const prevDims = inspectionWorkReportRollupDims(previous);
  const nextDims = inspectionWorkReportRollupDims(next);
  const prevId = prevDims ? inspectionWorkReportRollupId(prevDims) : '';
  const nextId = nextDims ? inspectionWorkReportRollupId(nextDims) : '';
  if (prevId === nextId) return;
  if (prevDims) await applyRollupDelta(previous, -1);
  if (nextDims) await applyRollupDelta(next, 1);
}

export async function decrementInspectionWorkReportRollup(work: any): Promise<void> {
  await incrementInspectionWorkReportRollup(work, -1);
}

function findMasterById(list: any[] | undefined, id: string) {
  const needle = String(id || '').trim().toLowerCase();
  if (!needle) return undefined;
  return (list || []).find((item: any) => String(item?.id || '').trim().toLowerCase() === needle);
}

function attachMasterGeoNames(
  row: InspectionWorkReportDimensionRollup,
  masters: InspectionWorksFilterMasters
): InspectionWorkReportDimensionRollup {
  const tp = findMasterById(masters.townPanchayats, row.tpId);
  const dist =
    (tp?.districtId ? findMasterById(masters.districts, String(tp.districtId)) : undefined) ||
    findMasterById(masters.districts, row.districtId);
  const zone =
    findMasterById(masters.zones, row.zoneId) ||
    (tp?.zoneId ? findMasterById(masters.zones, String(tp.zoneId)) : undefined) ||
    (dist?.zoneId ? findMasterById(masters.zones, String(dist.zoneId)) : undefined);
  return {
    ...row,
    zoneId: zone?.id || row.zoneId || '',
    districtId: dist?.id || row.districtId || '',
    tpId: tp?.id || row.tpId || '',
    zoneNameEn: zone?.nameEn || row.zoneNameEn || '',
    districtNameEn: dist?.nameEn || row.districtNameEn || '',
    tpNameEn: tp?.nameEn || row.tpNameEn || '',
  };
}

async function aggregateLiveRollups(
  ctx: MongoCtx,
  pipeline: Record<string, unknown>[]
): Promise<any[]> {
  const run = async (col: MongoCtx['rollups']) =>
    col.aggregate(pipeline, { maxTimeMS: QUERY_MAX_MS }).toArray();
  try {
    const rows = await run(ctx.rollups);
    if (rows.length) return rows;
    if (await collectionExists(ctx, PREV_COLLECTION)) {
      const prev = await run(ctx.db.collection(PREV_COLLECTION));
      if (prev.length) return prev;
    }
    return rows;
  } catch (err) {
    if (!isMissingNamespace(err)) throw err;
    if (await collectionExists(ctx, PREV_COLLECTION)) {
      return await run(ctx.db.collection(PREV_COLLECTION));
    }
    return [];
  }
}

export async function queryInspectionWorkReportRollupCounts(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { omitCategory?: boolean }
): Promise<InspectionWorkReportRollupCounts> {
  startInspectionReportRollupWorker();
  try {
    const ctx = await mongo();
    if (!ctx) return emptyRollupCounts();
    const match = buildRollupMatch(filter, masters, { omitCategory: opts?.omitCategory !== false });
    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push({
      $group: {
        _id: {
          zoneId: { $ifNull: ['$zoneId', ''] },
          districtId: { $ifNull: ['$districtId', ''] },
          tpId: { $ifNull: ['$tpId', ''] },
          wardNumber: { $ifNull: ['$wardNumber', ''] },
          submittedByUserName: { $ifNull: ['$submittedByUserName', ''] },
          subjectId: { $ifNull: ['$subjectId', 'unknown'] },
          categoryId: { $ifNull: ['$categoryId', '_unknown'] },
        },
        count: { $sum: '$count' },
      },
    });
    const grouped = (await aggregateLiveRollups(ctx, pipeline)) as Array<{
      _id: {
        zoneId: string;
        districtId: string;
        tpId: string;
        wardNumber: string;
        submittedByUserName: string;
        subjectId: string;
        categoryId: string;
      };
      count: number;
    }>;
    const dimensionRollups: InspectionWorkReportDimensionRollup[] = grouped.map((r) =>
      attachMasterGeoNames(
        {
          zoneId: String(r._id?.zoneId || ''),
          districtId: String(r._id?.districtId || ''),
          tpId: String(r._id?.tpId || ''),
          wardNumber: String(r._id?.wardNumber || ''),
          submittedByUserName: String(r._id?.submittedByUserName || ''),
          subjectId: String(r._id?.subjectId || 'unknown'),
          categoryId: String(r._id?.categoryId || '_unknown'),
          count: Number(r.count) || 0,
        },
        masters
      )
    );
    const subjectCategoryRollups = collapseDimensionRollupsToSubjectCategory(dimensionRollups);
    const totalWithoutCategoryFilter = subjectCategoryRollups.reduce((s, r) => s + r.count, 0);
    const categoryCounts = categoryCountsFromRollupRows(
      subjectCategoryRollups,
      masters.inspectionCategories || []
    );
    return {
      categoryCounts,
      totalWithoutCategoryFilter,
      subjectCategoryRollups,
      dimensionRollups,
      source: 'mongo-rollup',
    };
  } catch (err) {
    console.warn('[inspectionWorkReportRollups] query failed:', err);
    return emptyRollupCounts();
  }
}

/** Dashboard KPI rows from pre-aggregated rollups — never a scan of inspectionWorks. */
export async function fetchDashboardStatsFromRollups(): Promise<any[] | null> {
  startInspectionReportRollupWorker();
  try {
    const ctx = await mongo();
    if (!ctx) return null;
    const rows = await aggregateLiveRollups(ctx, [
      {
        $group: {
          _id: {
            subjectId: '$subjectId',
            categoryId: '$categoryId',
            zoneId: '$zoneId',
            districtId: '$districtId',
            tpId: '$tpId',
          },
          count: { $sum: '$count' },
        },
      },
      {
        $project: {
          _id: 0,
          subjectId: '$_id.subjectId',
          categoryId: '$_id.categoryId',
          zoneId: '$_id.zoneId',
          districtId: '$_id.districtId',
          tpId: '$_id.tpId',
          count: 1,
        },
      },
    ]);
    return rows;
  } catch (err) {
    console.warn('[inspectionWorkReportRollups] dashboard stats failed:', err);
    return [];
  }
}

export async function queryInspectionWorkReportRollupTotal(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Promise<number> {
  const counts = await queryInspectionWorkReportRollupCounts(filter, masters, { omitCategory: true });
  return sumSubjectCategoryRollupsForFilter(counts.subjectCategoryRollups, filter, masters);
}
