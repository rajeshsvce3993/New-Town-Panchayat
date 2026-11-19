import { tpIdsForDistrict, tpIdsForZone } from '@/lib/inspectionWorksMongoRepository';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import { queryInspectionWorkReportRollupGrandTotal } from '@/lib/inspectionWorkReportRollups';
import { aggregateSwmTotals } from '@/lib/swmReportsAggregate';
import { getActiveMongoDb, getCollectionWithAliases, getMongoClient } from '@/lib/storage';
import type { InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import { readMongoSharedCache, writeMongoSharedCache } from '@/lib/cache/mongoSharedCache';
import { readSwmDashboardTotals, refreshSwmDashboardTotals } from '@/lib/jobs/swmDashboardTotals';

export type DashboardInspectionStats = {
  totalInspections: number;
  subjects: number;
  categories: number;
  townPanchayats: number;
  wards: number;
  streets: number;
  inspectors: number;
};

export type DashboardSwmStats = {
  totalWards: number;
  totalStreets: number;
  householdsSurveyed: number;
  segregating: number;
  notSegregating: number;
  doorLocked: number;
  homeComposting: number;
};

export type DashboardStatsPayload = {
  inspection: DashboardInspectionStats;
  swm: DashboardSwmStats;
  source: string;
};

const CACHE_TTL_MS = 180_000;
const cache = new Map<string, { ts: number; data: DashboardStatsPayload }>();

export function invalidateDashboardStatsCache() {
  cache.clear();
  void import('@/lib/cache/mongoSharedCache').then((m) => m.invalidateMongoSharedCachePrefix('dashboard-stats|'));
}

function cacheKey(origin: string, filter: InspectionWorksFilterQuery) {
  return JSON.stringify({ origin, filter });
}

function scopedTpIds(filter: InspectionWorksFilterQuery, masters: Awaited<ReturnType<typeof resolveInspectionFilterMasters>>) {
  const tpId = String(filter.tpId || filter.scopeTpId || '').trim();
  if (tpId) return [tpId];
  const districtId = String(filter.districtId || filter.scopeDistrictId || '').trim();
  if (districtId) return tpIdsForDistrict(districtId, masters);
  const zoneId = String(filter.zoneId || filter.scopeZoneId || '').trim();
  if (zoneId) return tpIdsForZone(zoneId, masters);
  return [];
}

function liveList(items: any[] | undefined, kind: 'subject' | 'category') {
  return (items || []).filter((item) => {
    const id = String(item?.id || '').toLowerCase();
    const name = String(item?.nameEn || item?.name || '').toLowerCase();
    if (!id && !name) return false;
    if (name.includes('fallback')) return false;
    if (kind === 'subject' && (id === 'subj_general' || name === 'general inspection')) return false;
    if (
      kind === 'category' &&
      (id === 'cat_field_check' || id === 'cat_general' || id === 'field_check' || name === 'field check' || name === 'general category' || name === 'general inspection')
    ) {
      return false;
    }
    return true;
  });
}

function swmDefaultFilter(filter: InspectionWorksFilterQuery, masters: Awaited<ReturnType<typeof resolveInspectionFilterMasters>>): InspectionWorksFilterQuery {
  if (filter.subjectId || filter.categoryId) return filter;
  const cats = (masters.inspectionCategories || []).filter((c: any) => {
    const name = String(c?.nameEn || c?.name || '').toLowerCase();
    const id = String(c?.id || '').toLowerCase();
    return (name.includes('door') && (name.includes('segregat') || name.includes('source') || name.includes('survey')))
      || id.includes('door_to_door_source');
  });
  const subjectId = String(
    cats.find((c: any) => c?.subjectId)?.subjectId
    || (masters.inspectionSubjects || []).find((s: any) => String(s.nameEn || '').toLowerCase().includes('swm monitoring'))?.id
    || 'subj_swm_monitoring_i5a3'
  );
  const ranked = [...cats].sort((a: any, b: any) => {
    const an = String(a.nameEn || '').toLowerCase();
    const bn = String(b.nameEn || '').toLowerCase();
    const as = (an.includes('source') ? 2 : 0) + (an.includes('segregat') ? 2 : 0);
    const bs = (bn.includes('source') ? 2 : 0) + (bn.includes('segregat') ? 2 : 0);
    return bs - as;
  });
  return {
    ...filter,
    subjectId,
    categoryId: String(ranked[0]?.id || 'cat_door_to_door_source_segregation_gb8o'),
  };
}

/** Ward/street totals — live indexed Mongo only (no in-memory geo cache). */
async function countMasterGeo(masters: Awaited<ReturnType<typeof resolveInspectionFilterMasters>>, tpIds: string[]) {
  const client = await getMongoClient();
  if (!client) return { wards: 0, streets: 0 };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'wardsAndStreets');

  let streets = 0;
  let wards = 0;
  if (tpIds.length > 0) {
    const [byTp, byLegacyTp, wardRowsA, wardRowsB] = await Promise.all([
      col.countDocuments({ tpId: { $in: tpIds } }, { maxTimeMS: 6000 }),
      col.countDocuments({ townPanchayatId: { $in: tpIds } }, { maxTimeMS: 6000 }),
      col
        .aggregate(
          [
            { $match: { tpId: { $in: tpIds } } },
            {
              $group: {
                _id: {
                  tp: '$tpId',
                  ward: { $ifNull: ['$wardNo', { $ifNull: ['$wardNumber', '$ward'] }] },
                },
              },
            },
            { $count: 'wards' },
          ],
          { maxTimeMS: 8000 },
        )
        .toArray(),
      col
        .aggregate(
          [
            { $match: { townPanchayatId: { $in: tpIds } } },
            {
              $group: {
                _id: {
                  tp: '$townPanchayatId',
                  ward: { $ifNull: ['$wardNo', { $ifNull: ['$wardNumber', '$ward'] }] },
                },
              },
            },
            { $count: 'wards' },
          ],
          { maxTimeMS: 8000 },
        )
        .toArray(),
    ]);
    streets = (Number(byTp) || 0) + (Number(byLegacyTp) || 0);
    wards = (Number(wardRowsA[0]?.wards) || 0) + (Number(wardRowsB[0]?.wards) || 0);
  } else {
    const [streetTotal, wardRows] = await Promise.all([
      col.estimatedDocumentCount(),
      col
        .aggregate(
          [
            {
              $group: {
                _id: {
                  tp: { $ifNull: ['$tpId', '$townPanchayatId'] },
                  ward: { $ifNull: ['$wardNo', { $ifNull: ['$wardNumber', '$ward'] }] },
                },
              },
            },
            { $count: 'wards' },
          ],
          { maxTimeMS: 12000 },
        )
        .toArray(),
    ]);
    streets = Number(streetTotal) || 0;
    wards = Number(wardRows[0]?.wards) || 0;
  }

  return { wards, streets };
}

const SWM_DOC_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function loadSwmTotalsForDashboard(
  requestOrigin: string,
  filter: InspectionWorksFilterQuery,
  masters: Awaited<ReturnType<typeof resolveInspectionFilterMasters>>,
) {
  const stored = await readSwmDashboardTotals();
  if (stored?.totals) {
    const age = stored.builtAt ? Date.now() - new Date(stored.builtAt).getTime() : 0;
    if (age < SWM_DOC_MAX_AGE_MS) return stored.totals;
    // Serve last good snapshot; refresh off the request hot path (avoids 20s+ agg on dashboard open).
    void refreshSwmDashboardTotals(requestOrigin).catch(() => undefined);
    return stored.totals;
  }
  void refreshSwmDashboardTotals(requestOrigin).catch(() => undefined);
  try {
    return await aggregateSwmTotals(swmDefaultFilter(filter, masters), masters);
  } catch {
    return {
      householdsSurveyed: 0,
      segregating: 0,
      notSegregating: 0,
      doorLocked: 0,
      homeComposting: 0,
      source: 'swm-pending',
    };
  }
}

async function countInspectors() {
  const client = await getMongoClient();
  if (!client) return 0;
  const db = await getActiveMongoDb(client);
  try {
    const col = await getCollectionWithAliases(db, 'inspectionUsers');
    const active = await col.countDocuments({ status: { $ne: 'inactive' } }, { maxTimeMS: 6000 });
    if (active > 0) return active;
    return await col.estimatedDocumentCount();
  } catch {
    return 0;
  }
}

export async function loadDashboardStats(
  requestOrigin: string,
  filter: InspectionWorksFilterQuery,
  module: 'inspection' | 'swm' | 'all' = 'all'
): Promise<DashboardStatsPayload> {
  const allTime: InspectionWorksFilterQuery = {
    ...filter,
    fromDate: null,
    toDate: null,
    dateParam: null,
  };
  const key = cacheKey(requestOrigin, { ...allTime, module } as any);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const shared = await readMongoSharedCache<DashboardStatsPayload>(`dashboard-stats|${key}`);
  if (shared) {
    cache.set(key, { ts: Date.now(), data: shared });
    return shared;
  }

  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const tpIds = scopedTpIds(allTime, masters);
  const tps = tpIds.length
    ? (masters.townPanchayats || []).filter((tp: any) => tpIds.includes(String(tp.id || '')))
    : masters.townPanchayats || [];
  const subjects = liveList(masters.inspectionSubjects, 'subject');
  const categories = liveList(masters.inspectionCategories, 'category');
  const needInspection = module === 'inspection' || module === 'all';
  /** SWM scans works — never bundle with `all`; client loads `module=swm` when needed. */
  const needSwm = module === 'swm';

  const [geo, inspectionTotal, swm, inspectors] = await Promise.all([
    countMasterGeo(masters, tpIds),
    needInspection ? queryInspectionWorkReportRollupGrandTotal(allTime, masters) : Promise.resolve(0),
    needSwm ? loadSwmTotalsForDashboard(requestOrigin, allTime, masters) : Promise.resolve(null),
    module !== 'swm' ? countInspectors() : Promise.resolve(0),
  ]);

  const countsSource = 'mongo-rollup';

  const data: DashboardStatsPayload = {
    inspection: {
      totalInspections: Number(inspectionTotal) || 0,
      subjects: subjects.length,
      categories: categories.length,
      townPanchayats: tps.length || (masters.townPanchayats || []).length,
      wards: geo.wards,
      streets: geo.streets,
      inspectors: inspectors || 0,
    },
    swm: {
      totalWards: geo.wards,
      totalStreets: geo.streets,
      householdsSurveyed: Number(swm?.householdsSurveyed) || 0,
      segregating: Number(swm?.segregating) || 0,
      notSegregating: Number(swm?.notSegregating) || 0,
      doorLocked: Number(swm?.doorLocked) || 0,
      homeComposting: Number(swm?.homeComposting) || 0,
    },
    source: `${countsSource}|${swm?.source || 'skipped'}`,
  };
  cache.set(key, { ts: Date.now(), data });
  void writeMongoSharedCache(`dashboard-stats|${key}`, data, CACHE_TTL_MS);
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return data;
}
