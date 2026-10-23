import type { InspectionWorksFilterMasters, InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import { computeCategoryCounts } from '@/lib/inspectionWorksQueryFilters';
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

export const REPORTS_PAGE_SIZE_DEFAULT = 50;
export const REPORTS_PAGE_SIZE_MAX = 200;

const AGG_CACHE_TTL_MS = 120_000;
const aggCache = new Map<string, { ts: number; data: unknown }>();

function aggCacheKey(kind: string, filter: InspectionWorksFilterQuery, extra = ''): string {
  return `${kind}|${JSON.stringify(filter)}|${extra}`;
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

export function reportsFiltersNeedFullDocumentScan(filter: InspectionWorksFilterQuery): boolean {
  return !!(filter.street?.trim() || filter.search?.trim() || filter.adminFieldId);
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
  opts?: { omitCategory?: boolean; useReportDate?: boolean }
): Record<string, unknown> {
  const f = opts?.omitCategory ? stripCategoryFromFilter(filter) : filter;
  if (!opts?.useReportDate) {
    return buildInspectionWorksMongoMatch(f, masters);
  }

  const and: Record<string, unknown>[] = [];
  const geoMatch = buildInspectionWorksMongoMatch(f, masters, { skipDatePrefilter: true });
  if (geoMatch.$and && Array.isArray(geoMatch.$and)) {
    and.push(...(geoMatch.$and as Record<string, unknown>[]));
  } else if (Object.keys(geoMatch).length > 0) {
    and.push(geoMatch);
  }
  appendReportDateMongoMatch(and, filter);
  if (!and.length) return {};
  return and.length === 1 ? and[0] : { $and: and };
}

export type ReportAggregateCountsResult = {
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
  subjectCategoryRollups: Array<{ subjectId: string; categoryId: string; count: number }>;
  source: 'mongo-aggregate';
};

function normalizeAggregateCategoryCounts(
  groups: Array<{ _id: string | null; count: number }>,
  masters: InspectionWorksFilterMasters
): Record<string, number> {
  const pseudoWorks = groups.map((g) => ({
    categoryId: g._id || '_unknown',
    categoryNameEn: g._id || '',
  }));
  return computeCategoryCounts(pseudoWorks, masters.inspectionCategories || []);
}

export async function aggregateInspectionWorksReportCounts(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Promise<ReportAggregateCountsResult | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const cacheKey = aggCacheKey('counts', filter);
    const cached = readAggCache<ReportAggregateCountsResult>(cacheKey);
    if (cached) return cached;

    const match = buildReportsMongoMatch(filter, masters, { omitCategory: true, useReportDate: true });

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push({
      $facet: {
        byCategory: [{ $group: { _id: { $ifNull: ['$categoryId', '_unknown'] }, count: { $sum: 1 } } }],
        bySubjectCategory: [
          {
            $group: {
              _id: {
                subjectId: { $ifNull: ['$subjectId', 'unknown'] },
                categoryId: { $ifNull: ['$categoryId', '_unknown'] },
              },
              count: { $sum: 1 },
            },
          },
        ],
        total: [{ $count: 'n' }],
      },
    });

    const [facetResult] = await col.aggregate(pipeline).toArray();
    if (!facetResult) return null;

    const byCategory = (facetResult.byCategory || []) as Array<{ _id: string | null; count: number }>;
    const totalN = facetResult.total?.[0]?.n ?? 0;
    const categoryCounts = normalizeAggregateCategoryCounts(byCategory, masters);
    const subjectCategoryRollups = ((facetResult.bySubjectCategory || []) as Array<{
      _id: { subjectId: string; categoryId: string };
      count: number;
    }>).map((r) => ({
      subjectId: String(r._id?.subjectId || 'unknown'),
      categoryId: String(r._id?.categoryId || '_unknown'),
      count: r.count,
    }));

    const result = {
      categoryCounts,
      totalWithoutCategoryFilter: totalN,
      subjectCategoryRollups,
      source: 'mongo-aggregate' as const,
    };
    if (totalN > 0 || subjectCategoryRollups.length > 0) {
      writeAggCache(cacheKey, result);
      return result;
    }
    return null;
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
  source: 'mongo-aggregate';
};

export async function aggregateInspectionWorksReportPage(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  page: number,
  pageSize: number
): Promise<ReportAggregatePageResult | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const safePage = Math.max(1, page);
    const cap = Math.min(Math.max(1, pageSize), REPORTS_PAGE_SIZE_MAX);
    const cacheKey = aggCacheKey('page', filter, `${safePage}|${cap}`);
    const cached = readAggCache<ReportAggregatePageResult>(cacheKey);
    if (cached) return cached;

    const match = buildReportsMongoMatch(filter, masters, { omitCategory: false, useReportDate: true });
    const skip = (safePage - 1) * cap;

    const projection = filter.adminFieldId
      ? LITE_INSPECTION_WORKS_PROJECTION
      : { ...LITE_INSPECTION_WORKS_PROJECTION, fieldsData: 0 as const };

    const pipeline: Record<string, unknown>[] = [];
    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push({
      $facet: {
        meta: [{ $count: 'total' }],
        rows: [
          { $sort: { submittedAt: -1, createdAt: -1, workId: -1 } },
          { $skip: skip },
          { $limit: cap },
          { $project: projection },
        ],
      },
    });

    const [facetResult] = await col.aggregate(pipeline).toArray();
    if (!facetResult) return null;

    const total = facetResult.meta?.[0]?.total ?? 0;
    const items = (facetResult.rows || []) as any[];
    const rows = items.map((item) => ({
      ...item,
      id: item.id || item.workId || '',
    }));

    const result = {
      rows,
      total,
      page: safePage,
      pageSize: cap,
      source: 'mongo-aggregate' as const,
    };
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

/** One Mongo round-trip: counts + page rows (reports Apply). */
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

    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const matchCounts = buildReportsMongoMatch(filter, masters, { omitCategory: true, useReportDate: true });
    const matchRows = buildReportsMongoMatch(filter, masters, { omitCategory: false, useReportDate: true });
    const skip = (safePage - 1) * cap;
    const projection = filter.adminFieldId
      ? LITE_INSPECTION_WORKS_PROJECTION
      : { ...LITE_INSPECTION_WORKS_PROJECTION, fieldsData: 0 as const };

    const matchCountsStages: Record<string, unknown>[] = Object.keys(matchCounts).length
      ? [{ $match: matchCounts }]
      : [];
    const matchRowsStages: Record<string, unknown>[] = Object.keys(matchRows).length
      ? [{ $match: matchRows }]
      : [];

    const pipeline: Record<string, unknown>[] = [
      {
        $facet: {
          subjectCategoryRollups: [
            ...matchCountsStages,
            {
              $group: {
                _id: {
                  subjectId: { $ifNull: ['$subjectId', 'unknown'] },
                  categoryId: { $ifNull: ['$categoryId', '_unknown'] },
                },
                count: { $sum: 1 },
              },
            },
          ],
          countsTotal: [...matchCountsStages, { $count: 'n' }],
          rowTotal: [...matchRowsStages, { $count: 'total' }],
          rows: [
            ...matchRowsStages,
            { $sort: { submittedAt: -1, createdAt: -1, workId: -1 } },
            { $skip: skip },
            { $limit: cap },
            { $project: projection },
          ],
        },
      },
    ];

    const [root] = await col.aggregate(pipeline).toArray();
    if (!root) return null;

    const subjectCategoryRollups = ((root.subjectCategoryRollups || []) as Array<{
      _id: { subjectId: string; categoryId: string };
      count: number;
    }>).map((r) => ({
      subjectId: String(r._id?.subjectId || 'unknown'),
      categoryId: String(r._id?.categoryId || '_unknown'),
      count: r.count,
    }));

    const totalN = root.countsTotal?.[0]?.n ?? 0;
    const byCategoryMap = new Map<string, number>();
    for (const row of subjectCategoryRollups) {
      const k = row.categoryId || '_unknown';
      byCategoryMap.set(k, (byCategoryMap.get(k) || 0) + row.count);
    }
    const byCategory = [...byCategoryMap.entries()].map(([id, count]) => ({ _id: id, count }));
    const categoryCounts = normalizeAggregateCategoryCounts(byCategory, masters);

    const totalRows = root.rowTotal?.[0]?.total ?? 0;
    const items = (root.rows || []) as any[];
    const rows = items.map((item) => ({ ...item, id: item.id || item.workId || '' }));

    const result: ReportAggregateBundleResult = {
      categoryCounts,
      totalWithoutCategoryFilter: totalN,
      subjectCategoryRollups,
      source: 'mongo-aggregate',
      rows,
      page: safePage,
      pageSize: cap,
      total: totalRows,
    };

    if (totalN > 0 || subjectCategoryRollups.length > 0 || totalRows > 0 || rows.length > 0) {
      writeAggCache(cacheKey, result);
      return result;
    }
    return null;
  } catch (err) {
    console.warn('[inspectionWorksReportsAggregate] bundle aggregate failed:', err);
    return null;
  }
}
