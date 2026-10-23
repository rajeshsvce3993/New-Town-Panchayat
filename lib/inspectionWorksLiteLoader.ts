import type {
  InspectionWorksFilterMasters,
  InspectionWorksFilterQuery,
} from '@/lib/inspectionWorksQueryFilters';
import { getTargetedInspectionWorks, normalizeAndEnrichWorks } from '@/lib/storage';
import { filterInspectionWorksPostMongo } from '@/lib/inspectionWorksQueryFilters';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import {
  applyDefaultReportsDateWindow,
  fetchLiteInspectionWorksByDateLooseOnly,
  fetchLiteInspectionWorksFromMongoScoped,
  fetchRecentLiteInspectionWorksCap,
} from '@/lib/inspectionWorksMongoRepository';
import { fetchRemoteInspectionWorksRaw, invalidateRemoteInspectionWorksCache } from '@/lib/remoteInspectionWorksCache';
import { shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

export type LiteWorksLoadResult = {
  enriched: any[];
  masters: InspectionWorksFilterMasters;
  source:
    | 'mongo-scoped'
    | 'mongo-date-loose'
    | 'mongo-recent-cap'
    | 'local-cache'
    | 'remote-full'
    | 'empty';
  truncated: boolean;
  appliedDateWindow: boolean;
};

export function invalidateInspectionWorksLiteCache() {
  invalidateRemoteInspectionWorksCache();
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

/**
 * Production reports path: Mongo $match + lite projection (indexed), then enrich.
 * Remote full download is dev-only fallback when local Mongo has no rows.
 */
export async function loadEnrichedLiteWorksForReports(
  requestOrigin: string | undefined,
  filter: InspectionWorksFilterQuery,
  limit = 0
): Promise<LiteWorksLoadResult> {
  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const withDates = applyDefaultReportsDateWindow(filter);
  const appliedDateWindow = !filter.fromDate && !filter.toDate && !filter.dateParam;

  const scoped = await fetchLiteInspectionWorksFromMongoScoped(withDates, masters, limit);
  if (scoped?.rows.length) {
    return {
      enriched: enrichReportsCandidateRows(scoped.rows, withDates, masters),
      masters,
      source: 'mongo-scoped',
      truncated: scoped.truncated,
      appliedDateWindow,
    };
  }

  const dateLoose = await fetchLiteInspectionWorksByDateLooseOnly(withDates, limit);
  if (dateLoose?.rows.length) {
    return {
      enriched: enrichReportsCandidateRows(dateLoose.rows, withDates, masters),
      masters,
      source: 'mongo-date-loose',
      truncated: dateLoose.truncated,
      appliedDateWindow,
    };
  }

  const recentCap = await fetchRecentLiteInspectionWorksCap(limit);
  if (recentCap?.rows.length) {
    return {
      enriched: enrichReportsCandidateRows(recentCap.rows, withDates, masters),
      masters,
      source: 'mongo-recent-cap',
      truncated: recentCap.truncated,
      appliedDateWindow,
    };
  }

  const cachedWorks = await getTargetedInspectionWorks({ limit: 100_000 });
  if (cachedWorks?.length) {
    return {
      enriched: enrichReportsCandidateRows(cachedWorks, withDates, masters),
      masters,
      source: 'local-cache',
      truncated: false,
      appliedDateWindow,
    };
  }

  if (shouldUseRemotePortalApi(requestOrigin)) {
    const raw = await fetchRemoteInspectionWorksRaw(requestOrigin);
    if (raw?.length) {
      return {
        enriched: normalizeAndEnrichWorks(raw, masters),
        masters,
        source: 'remote-full',
        truncated: raw.length >= 100_000,
        appliedDateWindow,
      };
    }
  }

  return { enriched: [], masters, source: 'empty', truncated: false, appliedDateWindow };
}
