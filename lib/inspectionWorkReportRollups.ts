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
import { geoNamesEqual } from '@/lib/geoNameMatch';

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
let indexesReady = false;
let rollupsReady = false;
let backfillInFlight: Promise<boolean> | null = null;

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

const ROLLUP_GEO_VERSION = 'rollups_geo_from_tp_v2';
const ROLLUP_GEO_META_COLLECTION = 'appMeta';

export function inspectionWorkReportRollupDims(work: any): InspectionWorkReportRollupDims | null {
  const submittedDateYmd = deriveSubmittedDateYmd(work);
  if (!submittedDateYmd) return null;
  return {
    submittedDateYmd,
    zoneId: norm(work.zoneId),
    districtId: norm(work.districtId),
    tpId: firstNonEmpty(work.tpId, work.townPanchayatId),
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
    rollups: db.collection<InspectionWorkReportRollupDoc>(INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION),
  };
}

export async function ensureInspectionWorkReportIndexes(): Promise<void> {
  if (indexesReady) return;
  const ctx = await mongo();
  if (!ctx) return;
  const works = ctx.db.collection('inspectionWorks');
  await Promise.allSettled([
    works.createIndex({ submittedDateYmd: -1, submittedAt: -1, workId: -1 }, { background: true }),
    works.createIndex({ submittedDateYmd: -1, tpId: 1, submittedAt: -1, workId: -1 }, { background: true }),
    works.createIndex({ streetName: 1, submittedDateYmd: -1 }, { background: true }),
    works.createIndex({ workId: 1 }, { background: true }),
    works.createIndex({ tpNameEn: 1, submittedDateYmd: -1 }, { background: true }),
    works.createIndex({ districtNameEn: 1, submittedDateYmd: -1 }, { background: true }),
    works.createIndex({ zoneNameEn: 1, submittedDateYmd: -1 }, { background: true }),
    ctx.rollups.createIndex(
      { submittedDateYmd: 1, tpId: 1, subjectId: 1, categoryId: 1 },
      { background: true }
    ),
    ctx.rollups.createIndex({ submittedDateYmd: 1, districtId: 1, subjectId: 1 }, { background: true }),
    ctx.rollups.createIndex({ submittedDateYmd: 1, zoneId: 1 }, { background: true }),
    ctx.rollups.createIndex({ submittedDateYmd: 1, wardNumber: 1 }, { background: true }),
    ctx.rollups.createIndex({ submittedDateYmd: 1, submittedByUserName: 1 }, { background: true }),
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
    const tp = (masters.townPanchayats || []).find(
      (t) =>
        variants.includes(norm(t.id).toLowerCase()) || variants.includes(norm(t.nameEn).toLowerCase())
    );
    const ids = [...variants];
    if (tp?.id) ids.push(norm(tp.id));
    if (tp?.nameEn) ids.push(norm(tp.nameEn));
    const names = [tp?.nameEn, tp?.nameTa].filter(Boolean).map((v) => norm(v));
    const or: Record<string, unknown>[] = [{ tpId: { $in: [...new Set(ids.filter(Boolean))] } }];
    if (names.length) or.push({ tpNameEn: { $in: [...new Set(names)] } });
    and.push(or.length === 1 ? or[0] : { $or: or });
  } else if (scopeDistrict) {
    const variants = idVariants(scopeDistrict);
    const tpIds = tpIdsForDistrict(scopeDistrict, masters);
    const dist = (masters.districts || []).find(
      (d) =>
        variants.includes(norm(d.id).toLowerCase()) ||
        geoNamesEqual(d.nameEn, scopeDistrict) ||
        geoNamesEqual(d.nameTa, scopeDistrict)
    );
    const or: Record<string, unknown>[] = [{ districtId: { $in: variants } }];
    if (dist?.nameEn) or.push({ districtNameEn: dist.nameEn });
    if (tpIds.length) or.push({ tpId: { $in: tpIds } });
    and.push({ $or: or });
  } else if (scopeZone) {
    const districtIds = districtIdsForZone(scopeZone, masters);
    const tpIds = tpIdsForZone(scopeZone, masters);
    const zone = (masters.zones || []).find(
      (z) =>
        idVariants(scopeZone).includes(norm(z.id).toLowerCase()) ||
        geoNamesEqual(z.nameEn, scopeZone) ||
        geoNamesEqual(z.nameTa, scopeZone)
    );
    const or: Record<string, unknown>[] = [{ zoneId: { $in: idVariants(scopeZone) } }];
    if (zone?.nameEn) or.push({ zoneNameEn: zone.nameEn });
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

export async function backfillInspectionWorkReportRollups(): Promise<{ buckets: number }> {
  const ctx = await mongo();
  if (!ctx) return { buckets: 0 };
  await ensureInspectionWorkReportIndexes();

  const works = ctx.db.collection('inspectionWorks');
  const pipeline: Record<string, unknown>[] = [
    { $match: fallbackNorMatch() },
    {
      $addFields: {
        submittedDateYmd: {
          $let: {
            vars: {
              ymd: { $ifNull: ['$submittedDateYmd', ''] },
            },
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
      },
    },
    { $match: { submittedDateYmd: { $type: 'string', $ne: '' } } },
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
        into: INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION,
        on: '_id',
        whenMatched: 'replace',
        whenNotMatched: 'insert',
      },
    },
  ];

  await works.aggregate(pipeline, { allowDiskUse: true }).toArray();
  await works.aggregate(pipeline, { allowDiskUse: true }).toArray();
  const buckets = await ctx.rollups.estimatedDocumentCount();
  return { buckets };
}

export async function rebuildInspectionWorkReportRollups(): Promise<{ buckets: number }> {
  const ctx = await mongo();
  if (!ctx) return { buckets: 0 };
  await ctx.rollups.deleteMany({});
  rollupsReady = false;
  const result = await backfillInspectionWorkReportRollups();
  rollupsReady = result.buckets >= 0;
  return result;
}

export async function ensureInspectionWorkReportRollupsReady(): Promise<{
  ready: boolean;
  ranBackfill: boolean;
}> {
  if (rollupsReady) return { ready: true, ranBackfill: false };
  if (backfillInFlight) {
    const ran = await backfillInFlight;
    return { ready: rollupsReady, ranBackfill: ran };
  }
  backfillInFlight = (async () => {
    try {
      const { canonicalizeThiruvallurDistrictSpellings } = await import('@/lib/canonicalizeDistrictSpellings');
      await canonicalizeThiruvallurDistrictSpellings();
    } catch (err) {
      console.warn('[inspectionWorkReportRollups] canonicalize before rebuild failed:', err);
    }
    await ensureInspectionWorkReportIndexes();
    const ctx = await mongo();
    if (!ctx) return false;
    const meta = ctx.db.collection(ROLLUP_GEO_META_COLLECTION);
    const versionDoc = await meta.findOne({ _id: ROLLUP_GEO_VERSION as any });
    const n = await ctx.rollups.estimatedDocumentCount();
    if (n > 0 && versionDoc) {
      rollupsReady = true;
      return false;
    }
    if (n > 0) {
      console.log(`[inspectionWorkReportRollups] Rebuilding rollups for ${ROLLUP_GEO_VERSION}`);
      await ctx.rollups.deleteMany({});
    }
    await backfillInspectionWorkReportRollups();
    await meta.updateOne(
      { _id: ROLLUP_GEO_VERSION as any },
      { $set: { _id: ROLLUP_GEO_VERSION, at: new Date() } },
      { upsert: true }
    );
    rollupsReady = true;
    return true;
  })();
  try {
    const ran = await backfillInFlight;
    return { ready: rollupsReady, ranBackfill: ran };
  } catch (err) {
    rollupsReady = false;
    console.warn('[inspectionWorkReportRollups] backfill failed:', err);
    return { ready: false, ranBackfill: false };
  } finally {
    backfillInFlight = null;
  }
}

async function applyRollupDelta(work: any, delta: number): Promise<void> {
  if (!work || typeof work !== 'object' || delta === 0) return;
  if (isFallbackInspectionWork(work)) return;
  const dims = inspectionWorkReportRollupDims(work);
  if (!dims) return;
  const ctx = await mongo();
  if (!ctx) return;
  const _id = inspectionWorkReportRollupId(dims);
  await ctx.rollups.updateOne(
    { _id },
    {
      $inc: { count: delta },
      $setOnInsert: { ...dims, _id },
    },
    { upsert: true }
  );
  if (delta < 0) {
    await ctx.rollups.deleteMany({ _id, count: { $lte: 0 } });
  }
}

export async function incrementInspectionWorkReportRollup(work: any, delta = 1): Promise<void> {
  const { ranBackfill } = await ensureInspectionWorkReportRollupsReady();
  if (ranBackfill && delta > 0) return;
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
  const { ranBackfill } = await ensureInspectionWorkReportRollupsReady();
  if (ranBackfill) return;
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
    (dist?.zoneId ? findMasterById(masters.zones, String(dist.zoneId)) : undefined) ||
    (tp?.zoneId ? findMasterById(masters.zones, String(tp.zoneId)) : undefined) ||
    findMasterById(masters.zones, row.zoneId);
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

export async function queryInspectionWorkReportRollupCounts(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { omitCategory?: boolean }
): Promise<InspectionWorkReportRollupCounts | null> {
  try {
    const { ready } = await ensureInspectionWorkReportRollupsReady();
    if (!ready) return null;
    const ctx = await mongo();
    if (!ctx) return null;
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
    const grouped = (await ctx.rollups.aggregate(pipeline).toArray()) as Array<{
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
    return null;
  }
}

/** Dashboard KPI rows from pre-aggregated rollups — not a scan of inspectionWorks. */
export async function fetchDashboardStatsFromRollups(): Promise<any[] | null> {
  try {
    const ctx = await mongo();
    if (!ctx) return null;
    const n = await ctx.rollups.estimatedDocumentCount();
    if (!n) return null;
    const rows = await ctx.rollups
      .aggregate(
        [
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
        ],
        { maxTimeMS: 4000 }
      )
      .toArray();
    return rows.length ? rows : null;
  } catch (err) {
    console.warn('[inspectionWorkReportRollups] dashboard stats failed:', err);
    return null;
  }
}

export async function queryInspectionWorkReportRollupTotal(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Promise<number | null> {
  try {
    const counts = await queryInspectionWorkReportRollupCounts(filter, masters, { omitCategory: true });
    if (!counts) return null;
    return sumSubjectCategoryRollupsForFilter(counts.subjectCategoryRollups, filter, masters);
  } catch (err) {
    console.warn('[inspectionWorkReportRollups] total query failed:', err);
    return null;
  }
}
