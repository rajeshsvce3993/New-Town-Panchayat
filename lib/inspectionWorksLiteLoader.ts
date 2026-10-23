import type {
  InspectionWorksFilterMasters,
  InspectionWorksFilterQuery,
} from '@/lib/inspectionWorksQueryFilters';
import {
  fetchAllLiteInspectionWorksFromMongo,
  getTargetedInspectionWorks,
  normalizeAndEnrichWorks,
} from '@/lib/storage';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import {
  applyDefaultReportsDateWindow,
  fetchLiteInspectionWorksFromMongoScoped,
} from '@/lib/inspectionWorksMongoRepository';
import { fetchRemoteInspectionWorksRaw, invalidateRemoteInspectionWorksCache } from '@/lib/remoteInspectionWorksCache';
import { shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

export type LiteWorksLoadResult = {
  enriched: any[];
  masters: InspectionWorksFilterMasters;
  source: 'mongo-scoped' | 'mongo-full' | 'local-cache' | 'remote-full' | 'empty';
  truncated: boolean;
  appliedDateWindow: boolean;
};

export function invalidateInspectionWorksLiteCache() {
  invalidateRemoteInspectionWorksCache();
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
      enriched: normalizeAndEnrichWorks(scoped.rows, masters),
      masters,
      source: 'mongo-scoped',
      truncated: scoped.truncated,
      appliedDateWindow,
    };
  }

  // Scoped query can miss rows (UTC vs IST dates) or Mongo may be empty while db.json cache has works.
  const fullLite = await fetchAllLiteInspectionWorksFromMongo();
  if (fullLite?.length) {
    return {
      enriched: normalizeAndEnrichWorks(fullLite, masters),
      masters,
      source: 'mongo-full',
      truncated: fullLite.length >= 50_000,
      appliedDateWindow,
    };
  }

  const cachedWorks = await getTargetedInspectionWorks({ limit: 100_000 });
  if (cachedWorks?.length) {
    return {
      enriched: normalizeAndEnrichWorks(cachedWorks, masters),
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
