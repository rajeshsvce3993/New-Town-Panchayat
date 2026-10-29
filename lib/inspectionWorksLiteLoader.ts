import type {
  InspectionWorksFilterMasters,
  InspectionWorksFilterQuery,
} from '@/lib/inspectionWorksQueryFilters';
import {
  filterInspectionWorksPostMongo,
  isFallbackInspectionWork,
  stripInspectionWorkForLite,
} from '@/lib/inspectionWorksQueryFilters';
import { getTargetedInspectionWorks, LITE_INSPECTION_WORKS_PROJECTION, normalizeAndEnrichWorks } from '@/lib/storage';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import {
  fetchLiteInspectionWorksByDateLooseOnly,
  fetchLiteInspectionWorksFromMongoScoped,
  fetchRecentLiteInspectionWorksCap,
} from '@/lib/inspectionWorksMongoRepository';
import {
  aggregateInspectionWorksReportCounts,
  aggregateInspectionWorksReportPage,
  aggregateInspectionWorksReportsBundle,
  invalidateInspectionWorksAggregateCache,
  REPORTS_PAGE_SIZE_DEFAULT,
} from '@/lib/inspectionWorksReportsAggregate';
import { fetchRemoteInspectionWorksRaw, invalidateRemoteInspectionWorksCache } from '@/lib/remoteInspectionWorksCache';
import { shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { rewriteWorkMediaFields } from '@/lib/s3MediaKey';

export type LiteWorksLoadResult = {
  enriched: any[];
  masters: InspectionWorksFilterMasters;
  source:
    | 'mongo-scoped'
    | 'mongo-date-loose'
    | 'mongo-recent-cap'
    | 'mongo-aggregate'
    | 'mongo-rollup'
    | 'mongo-indexed'
    | 'local-cache'
    | 'remote-full'
    | 'empty';
  truncated: boolean;
  appliedDateWindow: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
};

export type ReportCountsLoadResult = {
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
  subjectCategoryRollups: Array<{ subjectId: string; categoryId: string; count: number }>;
  dimensionRollups?: Array<{
    zoneId: string;
    districtId: string;
    tpId: string;
    wardNumber: string;
    submittedByUserName: string;
    subjectId: string;
    categoryId: string;
    count: number;
  }>;
  masters: InspectionWorksFilterMasters;
  source: LiteWorksLoadResult['source'];
  truncated: boolean;
  appliedDateWindow: boolean;
};

const ENRICHED_REPORTS_CACHE_TTL_MS = 120_000;
let enrichedReportsCache: { key: string; ts: number; data: LiteWorksLoadResult } | null = null;
const enrichedReportsInFlight = new Map<string, Promise<LiteWorksLoadResult>>();
let reportsDataGeneration = 4;

export function getInspectionWorksReportsDataGeneration(): number {
  return reportsDataGeneration;
}

export function invalidateInspectionWorksLiteCache() {
  invalidateRemoteInspectionWorksCache();
  invalidateInspectionWorksAggregateCache();
  enrichedReportsCache = null;
  enrichedReportsInFlight.clear();
  reportsDataGeneration += 1;
}

function reportsDataCacheKey(filter: InspectionWorksFilterQuery, limit: number, page: number, pageSize: number): string {
  return JSON.stringify({
    fromDate: filter.fromDate ?? '',
    toDate: filter.toDate ?? '',
    dateParam: filter.dateParam ?? '',
    zoneId: filter.zoneId ?? '',
    districtId: filter.districtId ?? '',
    tpId: filter.tpId ?? '',
    ward: filter.ward ?? '',
    username: filter.username ?? '',
    subjectId: filter.subjectId ?? '',
    categoryId: filter.categoryId ?? '',
    street: filter.street ?? '',
    search: filter.search ?? '',
    adminFieldId: filter.adminFieldId ?? '',
    adminFieldValue: filter.adminFieldValue ?? '',
    scopeTpId: filter.scopeTpId ?? '',
    scopeZoneId: filter.scopeZoneId ?? '',
    scopeDistrictId: filter.scopeDistrictId ?? '',
    limit,
    page,
    pageSize,
  });
}

function reportsMongoProjection(filter: InspectionWorksFilterQuery) {
  if (filter.adminFieldId) return LITE_INSPECTION_WORKS_PROJECTION;
  return { ...LITE_INSPECTION_WORKS_PROJECTION, fieldsData: 0 as const };
}

function enrichReportsCandidateRows(
  rows: any[],
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): any[] {
  const dateAndTextQuery: InspectionWorksFilterQuery = {
    ...filter,
    categoryId: null,
    street: null,
    search: null,
    adminFieldId: null,
    adminFieldValue: null,
  };
  const narrowed = filterInspectionWorksPostMongo(rows, dateAndTextQuery, masters);
  return normalizeAndEnrichWorks(narrowed, masters);
}

/** Paginated Mongo rows are already matched — do not re-filter or rows disappear from that page. */
function enrichReportsPageRows(rows: any[], masters: InspectionWorksFilterMasters): any[] {
  const withoutFallback = (rows || []).filter((w) => !isFallbackInspectionWork(w));
  return normalizeAndEnrichWorks(withoutFallback, masters)
    .map(stripInspectionWorkForLite)
    .map(rewriteWorkMediaFields);
}

type RawLiteLoadResult = Omit<LiteWorksLoadResult, 'enriched'> & { rows: any[] };

async function loadRawLiteWorksForReports(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  limit: number
): Promise<RawLiteLoadResult> {
  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const projection = reportsMongoProjection(filter);

  const scoped = await fetchLiteInspectionWorksFromMongoScoped(filter, masters, limit, projection);
  if (scoped?.rows.length) {
    return {
      rows: scoped.rows,
      masters,
      source: 'mongo-scoped',
      truncated: scoped.truncated,
      appliedDateWindow: false,
    };
  }

  const dateLoose = await fetchLiteInspectionWorksByDateLooseOnly(filter, limit, projection);
  if (dateLoose?.rows.length) {
    return {
      rows: dateLoose.rows,
      masters,
      source: 'mongo-date-loose',
      truncated: dateLoose.truncated,
      appliedDateWindow: false,
    };
  }

  const recentCap = await fetchRecentLiteInspectionWorksCap(limit, projection);
  if (recentCap?.rows.length) {
    return {
      rows: recentCap.rows,
      masters,
      source: 'mongo-recent-cap',
      truncated: recentCap.truncated,
      appliedDateWindow: false,
    };
  }

  const cachedWorks = await getTargetedInspectionWorks({ limit: 100_000 });
  if (cachedWorks?.length) {
    return {
      rows: cachedWorks,
      masters,
      source: 'local-cache',
      truncated: false,
      appliedDateWindow: false,
    };
  }

  if (shouldUseRemotePortalApi(requestOrigin)) {
    const raw = await fetchRemoteInspectionWorksRaw(requestOrigin);
    if (raw?.length) {
      return {
        rows: raw,
        masters,
        source: 'remote-full',
        truncated: raw.length >= 100_000,
        appliedDateWindow: false,
      };
    }
  }

  return { rows: [], masters, source: 'empty', truncated: false, appliedDateWindow: false };
}

async function loadEnrichedLiteWorksForReportsUncached(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  limit: number
): Promise<LiteWorksLoadResult> {
  const raw = await loadRawLiteWorksForReports(requestOrigin, filter, limit);
  return {
    enriched: raw.rows.length ? enrichReportsCandidateRows(raw.rows, filter, raw.masters) : [],
    masters: raw.masters,
    source: raw.source,
    truncated: raw.truncated,
    appliedDateWindow: raw.appliedDateWindow,
  };
}

async function getOrLoadEnrichedReportsData(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  limit = 0
): Promise<LiteWorksLoadResult> {
  const key = reportsDataCacheKey(filter, limit, 0, 0);
  const now = Date.now();
  if (enrichedReportsCache?.key === key && now - enrichedReportsCache.ts < ENRICHED_REPORTS_CACHE_TTL_MS) {
    return enrichedReportsCache.data;
  }

  const pending = enrichedReportsInFlight.get(key);
  if (pending) return pending;

  const loadPromise = loadEnrichedLiteWorksForReportsUncached(requestOrigin, filter, limit)
    .then((data) => {
      enrichedReportsCache = { key, ts: Date.now(), data };
      return data;
    })
    .finally(() => {
      enrichedReportsInFlight.delete(key);
    });
  enrichedReportsInFlight.set(key, loadPromise);
  return loadPromise;
}

/** Paginated report rows — Mongo $match + $sort + $skip/$limit, enrich one page only. */
export async function loadPaginatedEnrichedWorksForReports(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  page: number,
  pageSize: number
): Promise<LiteWorksLoadResult> {
  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const safePageSize = Math.min(Math.max(1, pageSize || REPORTS_PAGE_SIZE_DEFAULT), 200);
  const pageResult = await aggregateInspectionWorksReportPage(filter, masters, page, safePageSize);
  if (pageResult) {
    return {
      enriched: pageResult.rows.length ? enrichReportsPageRows(pageResult.rows, masters) : [],
      masters,
      source: pageResult.source === 'mongo-indexed' ? 'mongo-indexed' : 'mongo-aggregate',
      truncated: false,
      appliedDateWindow: false,
      total: pageResult.total,
      page: pageResult.page,
      pageSize: pageResult.pageSize,
    };
  }
  return {
    enriched: [],
    masters,
    source: 'empty',
    truncated: false,
    appliedDateWindow: false,
    total: 0,
    page: Math.max(1, page),
    pageSize: safePageSize,
  };
}

export async function loadEnrichedLiteWorksForReports(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  limit = 0
): Promise<LiteWorksLoadResult> {
  return getOrLoadEnrichedReportsData(requestOrigin, filter, limit);
}

export async function loadInspectionWorksReportsBundle(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  page: number,
  pageSize: number
): Promise<{
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
  subjectCategoryRollups: Array<{ subjectId: string; categoryId: string; count: number }>;
  dimensionRollups: ReportCountsLoadResult['dimensionRollups'];
  works: any[];
  total: number;
  page: number;
  pageSize: number;
  source: LiteWorksLoadResult['source'];
} | null> {
  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const bundle = await aggregateInspectionWorksReportsBundle(filter, masters, page, pageSize);
  if (!bundle) return null;
  return {
    categoryCounts: bundle.categoryCounts,
    totalWithoutCategoryFilter: bundle.totalWithoutCategoryFilter,
    subjectCategoryRollups: bundle.subjectCategoryRollups,
    dimensionRollups: bundle.dimensionRollups || [],
    works: bundle.rows.length ? enrichReportsPageRows(bundle.rows, masters) : [],
    total: bundle.total,
    page: bundle.page,
    pageSize: bundle.pageSize,
    source: bundle.source === 'mongo-rollup' ? 'mongo-rollup' : 'mongo-aggregate',
  };
}

export async function loadInspectionWorksReportCounts(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  _limit = 0
): Promise<ReportCountsLoadResult> {
  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const agg = await aggregateInspectionWorksReportCounts(filter, masters);
  if (agg) {
    return {
      categoryCounts: agg.categoryCounts,
      totalWithoutCategoryFilter: agg.totalWithoutCategoryFilter,
      subjectCategoryRollups: agg.subjectCategoryRollups,
      dimensionRollups: agg.dimensionRollups || [],
      masters,
      source: agg.source === 'mongo-rollup' ? 'mongo-rollup' : 'mongo-aggregate',
      truncated: false,
      appliedDateWindow: false,
    };
  }
  return {
    categoryCounts: {},
    totalWithoutCategoryFilter: 0,
    subjectCategoryRollups: [],
    dimensionRollups: [],
    masters,
    source: 'empty',
    truncated: false,
    appliedDateWindow: false,
  };
}
