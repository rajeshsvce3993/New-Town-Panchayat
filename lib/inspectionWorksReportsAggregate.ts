import type {
  InspectionWorkReportDimensionRollup,
  InspectionWorksFilterMasters,
  InspectionWorksFilterQuery,
} from '@/lib/inspectionWorksQueryFilters';
import {
  adminFieldValueNeedles,
  collapseDimensionRollupsToSubjectCategory,
  sumSubjectCategoryRollupsForFilter,
} from '@/lib/inspectionWorksQueryFilters';
import {
  appendLooseUtcDatePrefilter,
  buildInspectionWorksMongoMatch,
} from '@/lib/inspectionWorksMongoRepository';
import {
  getActiveMongoDb,
  getCollectionWithAliases,
  getMongoClient,
  LITE_INSPECTION_WORKS_PROJECTION,
} from '@/lib/storage';
import {
  ensureInspectionWorkReportIndexes,
  queryInspectionWorkReportRollupCounts,
} from '@/lib/inspectionWorkReportRollups';

export const REPORTS_PAGE_SIZE_DEFAULT = 50;
export const REPORTS_PAGE_SIZE_MAX = 200;

const AGG_CACHE_TTL_MS = 120_000;
const aggCache = new Map<string, { ts: number; data: unknown }>();

function aggCacheKey(kind: string, filter: InspectionWorksFilterQuery, extra = ''): string {
  return `named-street-live-geo-2|${kind}|${JSON.stringify(filter)}|${extra}`;
}

function readAggCache<T>(key: string): T | null {
  const hit = aggCache.get(key);
  if (!hit || Date.now() - hit.ts > AGG_CACHE_TTL_MS) return null;
  return hit.data as T;
}

function writeAggCache(key: string, data: unknown) {
  aggCache.set(key, { ts: Date.now(), data });
  if (aggCache.size > 200) {
    const first = aggCache.keys().next().value;
    if (first) aggCache.delete(first);
  }
}

export function invalidateInspectionWorksAggregateCache() {
  aggCache.clear();
}

/** Street/search/admin field cannot use pre-aggregated rollups; they still stay in Mongo (never a Node full scan). */
export function reportsFiltersNeedFullDocumentScan(filter: InspectionWorksFilterQuery): boolean {
  return !!(filter.street?.trim() || filter.search?.trim() || filter.adminFieldId);
}

/**
 * Location-wise / Abstract counts for a date window come from live inspectionWorks
 * via indexed $match + $group. That is not a Node collection scan.
 * All-time (no from/to) still uses rollups.
 */
export function reportsFiltersNeedLiveGeoCounts(filter?: InspectionWorksFilterQuery): boolean {
  return !!(filter?.fromDate || filter?.toDate);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendFallbackWorkExclusion(and: Record<string, unknown>[]): void {
  and.push({
    $nor: [
      { subjectId: { $in: ['subj_general', 'general_inspection'] } },
      { categoryId: { $in: ['cat_field_check', 'cat_general', 'field_check'] } },
    ],
  });
}

function adminFieldMongoPaths(filter: InspectionWorksFilterQuery, masters: InspectionWorksFilterMasters): string[] {
  const id = String(filter.adminFieldId || '').trim();
  if (!id) return [];
  const keys = new Set<string>([id]);
  const field = (masters.inspectionFields || []).find(
    (f: any) =>
      String(f.id || '') === id ||
      String(f.fieldKey || '') === id ||
      String(f.code || '') === id
  );
  if (field) {
    for (const k of [field.id, field.fieldKey, field.fieldName, field.nameEn, field.nameTa, field.code]) {
      if (k) keys.add(String(k));
    }
  }
  return [...keys];
}

function appendReportsSecondaryMongoMatch(
  and: Record<string, unknown>[],
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): void {
  const street = filter.street?.trim();
  if (street) {
    const rx = new RegExp(escapeRegex(street), 'i');
    and.push({
      $or: [
        { streetName: street },
        { streetName: rx },
        { street: rx },
        { streetNameEn: rx },
        { streetNameTa: rx },
      ],
    });
  }

  const search = filter.search?.trim();
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    const or: Record<string, unknown>[] = [
      { workId: rx },
      { streetName: rx },
      { submittedByUserName: rx },
      { username: rx },
      { subjectNameEn: rx },
      { subjectNameTa: rx },
      { imageCaption: rx },
    ];
    and.push({ $or: or });
  }

  if (filter.adminFieldId) {
    const paths = adminFieldMongoPaths(filter, masters);
    const value = filter.adminFieldValue?.trim();
    const needles = value ? adminFieldValueNeedles(value) : [];
    const fieldOr: Record<string, unknown>[] = [];
    for (const p of paths) {
      const dotted = `fieldsData.${p}`;
      if (needles.length) {
        for (const n of needles) {
          fieldOr.push({ [dotted]: new RegExp(escapeRegex(n), 'i') });
        }
      } else {
        fieldOr.push({ [dotted]: { $exists: true, $nin: [null, ''] } });
      }
    }
    if (fieldOr.length) and.push({ $or: fieldOr });
  }
}

function stripCategoryFromFilter(filter: InspectionWorksFilterQuery): InspectionWorksFilterQuery {
  return { ...filter, categoryId: null };
}

/** IST date on submittedDateYmd, with legacy rows fallback via loose UTC on submittedAt. */
export function appendReportDateMongoMatch(
  and: Record<string, unknown>[],
  filter: InspectionWorksFilterQuery
): void {
  if (filter.fromDate || filter.toDate) {
    const fromDate = filter.fromDate || filter.toDate!;
    const toDate = filter.toDate || filter.fromDate!;
    const legacy: Record<string, unknown>[] = [];
    appendLooseUtcDatePrefilter(legacy, filter);
    const legacyClause = legacy.length === 1 ? legacy[0] : legacy.length > 1 ? { $and: legacy } : null;
    const branches: Record<string, unknown>[] = [{ submittedDateYmd: { $gte: fromDate, $lte: toDate } }];
    if (legacyClause) {
      branches.push({ $and: [{ submittedDateYmd: { $exists: false } }, legacyClause] });
      branches.push({ $and: [{ submittedDateYmd: null }, legacyClause] });
      branches.push({ $and: [{ submittedDateYmd: '' }, legacyClause] });
    }
    and.push(branches.length === 1 ? branches[0] : { $or: branches });
    return;
  }
  if (filter.dateParam) {
    const ymd = filter.dateParam;
    const legacy: Record<string, unknown>[] = [];
    appendLooseUtcDatePrefilter(legacy, filter);
    const legacyClause = legacy.length ? legacy[0] : null;
    const branches: Record<string, unknown>[] = [{ submittedDateYmd: ymd }];
    if (legacyClause) {
      branches.push({ $and: [{ submittedDateYmd: { $exists: false } }, legacyClause] });
    }
    and.push(branches.length === 1 ? branches[0] : { $or: branches });
  }
}

export function buildReportsMongoMatch(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { omitCategory?: boolean; useReportDate?: boolean; includeSecondary?: boolean }
): Record<string, unknown> {
  const f = opts?.omitCategory ? stripCategoryFromFilter(filter) : filter;
  const and: Record<string, unknown>[] = [];
  if (!opts?.useReportDate) {
    const geoAndDate = buildInspectionWorksMongoMatch(f, masters);
    if (geoAndDate.$and && Array.isArray(geoAndDate.$and)) {
      and.push(...(geoAndDate.$and as Record<string, unknown>[]));
    } else if (Object.keys(geoAndDate).length > 0) {
      and.push(geoAndDate);
    }
  } else {
    const geoMatch = buildInspectionWorksMongoMatch(f, masters, { skipDatePrefilter: true });
    if (geoMatch.$and && Array.isArray(geoMatch.$and)) {
      and.push(...(geoMatch.$and as Record<string, unknown>[]));
    } else if (Object.keys(geoMatch).length > 0) {
      and.push(geoMatch);
    }
    appendReportDateMongoMatch(and, filter);
  }
  if (opts?.includeSecondary !== false) {
    appendReportsSecondaryMongoMatch(and, filter, masters);
  }
  appendFallbackWorkExclusion(and);
  if (!and.length) return {};
  return and.length === 1 ? and[0] : { $and: and };
}

export type ReportAggregateCountsResult = {
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
  subjectCategoryRollups: Array<{ subjectId: string; categoryId: string; count: number }>;
  dimensionRollups: InspectionWorkReportDimensionRollup[];
  source: 'mongo-aggregate' | 'mongo-rollup';
};

function normalizeAggregateCategoryCounts(
  groups: Array<{ _id: string | null; count: number }>,
  masters: InspectionWorksFilterMasters
): Record<string, number> {
  const counts: Record<string, number> = {};
  const categories = masters.inspectionCategories || [];
  const byId = new Map<string, any>();
  const byCode = new Map<string, any>();
  const byName = new Map<string, any>();
  for (const c of categories) {
    if (c.id) byId.set(String(c.id), c);
    if (c.code) byCode.set(String(c.code).toLowerCase(), c);
    if (c.nameEn) byName.set(String(c.nameEn).trim().toLowerCase(), c);
  }
  for (const g of groups) {
    const n = Number(g.count) || 0;
    if (!n) continue;
    const raw = String(g._id || '_unknown').trim();
    const cat = byId.get(raw) || byCode.get(raw.toLowerCase()) || byName.get(raw.toLowerCase());
    if (cat) {
      counts[String(cat.id)] = (counts[String(cat.id)] || 0) + n;
      if (cat.code) counts[String(cat.code)] = (counts[String(cat.code)] || 0) + n;
      if (cat.nameEn) {
        const name = String(cat.nameEn).trim().toLowerCase();
        counts[name] = (counts[name] || 0) + n;
      }
    } else {
      counts[raw] = (counts[raw] || 0) + n;
    }
  }
  return counts;
}

function emptyCountsResult(source: ReportAggregateCountsResult['source']): ReportAggregateCountsResult {
  return {
    categoryCounts: {},
    totalWithoutCategoryFilter: 0,
    subjectCategoryRollups: [],
    dimensionRollups: [],
    source,
  };
}

function filteredReportTotal(
  counts: ReportAggregateCountsResult,
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): number {
  return sumSubjectCategoryRollupsForFilter(counts.subjectCategoryRollups, filter, masters);
}

async function aggregateLiveReportCounts(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Promise<ReportAggregateCountsResult | null> {
  const client = await getMongoClient();
  if (!client) return null;
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const match = buildReportsMongoMatch(filter, masters, { omitCategory: true, useReportDate: true });
  const pipeline: Record<string, unknown>[] = [];
  if (Object.keys(match).length) pipeline.push({ $match: match });
  pipeline.push({
    $group: {
      _id: {
        zoneId: { $ifNull: ['$zoneId', ''] },
        districtId: { $ifNull: ['$districtId', ''] },
        tpId: { $ifNull: [{ $ifNull: ['$tpId', '$townPanchayatId'] }, ''] },
        zoneNameEn: { $ifNull: ['$zoneNameEn', ''] },
        districtNameEn: { $ifNull: ['$districtNameEn', ''] },
        tpNameEn: { $ifNull: ['$tpNameEn', ''] },
        streetName: { $ifNull: [{ $ifNull: ['$streetName', '$street'] }, ''] },
        wardNumber: {
          $convert: {
            input: { $ifNull: [{ $ifNull: ['$wardNumber', '$wardNo'] }, { $ifNull: ['$ward', ''] }] },
            to: 'string',
            onError: '',
            onNull: '',
          },
        },
        submittedByUserName: { $ifNull: [{ $ifNull: ['$submittedByUserName', '$username'] }, ''] },
        subjectId: { $ifNull: ['$subjectId', 'unknown'] },
        categoryId: { $ifNull: ['$categoryId', '_unknown'] },
      },
      count: { $sum: 1 },
    },
  });
  const grouped = (await col.aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 8000 }).toArray()) as Array<{
    _id: InspectionWorkReportDimensionRollup;
    count: number;
  }>;
  const dimensionRollups: InspectionWorkReportDimensionRollup[] = grouped.map((r) => ({
    zoneId: String(r._id?.zoneId || ''),
    districtId: String(r._id?.districtId || ''),
    tpId: String(r._id?.tpId || ''),
    zoneNameEn: String(r._id?.zoneNameEn || ''),
    districtNameEn: String(r._id?.districtNameEn || ''),
    tpNameEn: String(r._id?.tpNameEn || ''),
    streetName: String(r._id?.streetName || ''),
    wardNumber: String(r._id?.wardNumber || ''),
    submittedByUserName: String(r._id?.submittedByUserName || ''),
    subjectId: String(r._id?.subjectId || 'unknown'),
    categoryId: String(r._id?.categoryId || '_unknown'),
    count: Number(r.count) || 0,
  }));
  const subjectCategoryRollups = collapseDimensionRollupsToSubjectCategory(dimensionRollups);
  const byCategoryMap = new Map<string, number>();
  for (const row of subjectCategoryRollups) {
    const k = row.categoryId || '_unknown';
    byCategoryMap.set(k, (byCategoryMap.get(k) || 0) + row.count);
  }
  const byCategory = [...byCategoryMap.entries()].map(([id, count]) => ({ _id: id, count }));
  return {
    categoryCounts: normalizeAggregateCategoryCounts(byCategory, masters),
    totalWithoutCategoryFilter: subjectCategoryRollups.reduce((s, r) => s + r.count, 0),
    subjectCategoryRollups,
    dimensionRollups,
    source: 'mongo-aggregate',
  };
}

export async function aggregateInspectionWorksReportCounts(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Promise<ReportAggregateCountsResult | null> {
  try {
    const cacheKey = aggCacheKey('counts', filter);
    const cached = readAggCache<ReportAggregateCountsResult>(cacheKey);
    if (cached) return cached;

    await ensureInspectionWorkReportIndexes();
    const preferLive =
      reportsFiltersNeedFullDocumentScan(filter) || reportsFiltersNeedLiveGeoCounts(filter);

    if (!preferLive) {
      const rollup = await queryInspectionWorkReportRollupCounts(filter, masters, { omitCategory: true });
      if (rollup) {
        const hasRows =
          (rollup.dimensionRollups?.length || 0) > 0 ||
          (rollup.subjectCategoryRollups?.length || 0) > 0 ||
          (rollup.totalWithoutCategoryFilter || 0) > 0;
        if (hasRows) writeAggCache(cacheKey, rollup);
        return rollup;
      }
    }

    try {
      const result = await aggregateLiveReportCounts(filter, masters);
      if (result) {
        writeAggCache(cacheKey, result);
        return result;
      }
    } catch (liveErr) {
      console.warn('[inspectionWorksReportsAggregate] live counts failed; using rollups:', liveErr);
    }

    const rollup = await queryInspectionWorkReportRollupCounts(filter, masters, { omitCategory: true });
    if (rollup) {
      const hasRows =
        (rollup.dimensionRollups?.length || 0) > 0 ||
        (rollup.subjectCategoryRollups?.length || 0) > 0 ||
        (rollup.totalWithoutCategoryFilter || 0) > 0;
      if (hasRows) writeAggCache(cacheKey, rollup);
      return rollup;
    }
    return emptyCountsResult('mongo-aggregate');
  } catch (err) {
    console.warn('[inspectionWorksReportsAggregate] counts aggregate failed:', err);
    return null;
  }
}

export type ReportAggregatePageResult = {
  rows: any[];
  total: number;
  page: number;
  pageSize: number;
  source: 'mongo-aggregate' | 'mongo-indexed';
};

async function fetchIndexedReportPage(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  page: number,
  pageSize: number
): Promise<ReportAggregatePageResult | null> {
  const client = await getMongoClient();
  if (!client) return null;
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'inspectionWorks');
  const safePage = Math.max(1, page);
  const cap = Math.min(Math.max(1, pageSize), REPORTS_PAGE_SIZE_MAX);
  const skip = (safePage - 1) * cap;
  const match = buildReportsMongoMatch(filter, masters, { omitCategory: false, useReportDate: true });
  const projection = LITE_INSPECTION_WORKS_PROJECTION;

  const findCursor = col
    .find(match, { projection })
    .sort({ _id: -1 })
    .skip(skip)
    .limit(cap);

  const liveScan =
    reportsFiltersNeedFullDocumentScan(filter) || reportsFiltersNeedLiveGeoCounts(filter);
  const [items, counts] = await Promise.all([
    findCursor.toArray(),
    liveScan
      ? Promise.resolve(null)
      : queryInspectionWorkReportRollupCounts(filter, masters, { omitCategory: true }),
  ]);

  let total: number;
  if (counts) {
    total = filteredReportTotal(counts, filter, masters);
  } else {
    total = await col.countDocuments(match);
  }
  if (items.length > 0 && total < skip + items.length) {
    total = skip + items.length;
  }

  const rows = items.map((item) => ({
    ...item,
    id: item.id || item.workId || '',
  }));

  return {
    rows,
    total,
    page: safePage,
    pageSize: cap,
    source: 'mongo-indexed',
  };
}

export async function aggregateInspectionWorksReportPage(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  page: number,
  pageSize: number
): Promise<ReportAggregatePageResult | null> {
  try {
    const safePage = Math.max(1, page);
    const cap = Math.min(Math.max(1, pageSize), REPORTS_PAGE_SIZE_MAX);
    const cacheKey = aggCacheKey('page', filter, `${safePage}|${cap}`);
    const cached = readAggCache<ReportAggregatePageResult>(cacheKey);
    if (cached) return cached;

    await ensureInspectionWorkReportIndexes();
    const result = await fetchIndexedReportPage(filter, masters, safePage, cap);
    if (!result) return null;
    writeAggCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[inspectionWorksReportsAggregate] page aggregate failed:', err);
    return null;
  }
}

export type ReportAggregateBundleResult = ReportAggregateCountsResult & {
  rows: any[];
  page: number;
  pageSize: number;
  total: number;
};

/** Parallel rollup Abstract + indexed Detailed page. Never loads the collection into Node. */
export async function aggregateInspectionWorksReportsBundle(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  page: number,
  pageSize: number
): Promise<ReportAggregateBundleResult | null> {
  try {
    const safePage = Math.max(1, page);
    const cap = Math.min(Math.max(1, pageSize), REPORTS_PAGE_SIZE_MAX);
    const cacheKey = aggCacheKey('bundle', filter, `${safePage}|${cap}`);
    const cached = readAggCache<ReportAggregateBundleResult>(cacheKey);
    if (cached) return cached;

    await ensureInspectionWorkReportIndexes();
    const [counts, pageResult] = await Promise.all([
      aggregateInspectionWorksReportCounts(filter, masters),
      fetchIndexedReportPage(filter, masters, safePage, cap),
    ]);
    if (!counts && !pageResult) return null;

    const resolvedCounts = counts || emptyCountsResult('mongo-rollup');
    const rows = pageResult?.rows || [];
    const totalFromCounts = filteredReportTotal(resolvedCounts, filter, masters);
    const result: ReportAggregateBundleResult = {
      ...resolvedCounts,
      rows,
      page: pageResult?.page ?? safePage,
      pageSize: pageResult?.pageSize ?? cap,
      total: counts ? totalFromCounts : pageResult?.total ?? rows.length,
    };

    const hasRows =
      (resolvedCounts.dimensionRollups?.length || 0) > 0 ||
      (resolvedCounts.subjectCategoryRollups?.length || 0) > 0 ||
      (resolvedCounts.totalWithoutCategoryFilter || 0) > 0 ||
      rows.length > 0;
    if (hasRows) writeAggCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[inspectionWorksReportsAggregate] bundle aggregate failed:', err);
    return null;
  }
}
