import { tpIdsForDistrict, tpIdsForZone } from '@/lib/inspectionWorksMongoRepository';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import { loadInspectionWorksReportCounts } from '@/lib/inspectionWorksLiteLoader';
import { aggregateSwmTotals } from '@/lib/swmReportsAggregate';
import { getActiveMongoDb, getCollectionWithAliases, getMongoClient } from '@/lib/storage';
import type { InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';

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

const CACHE_TTL_MS = 45_000;
const cache = new Map<string, { ts: number; data: DashboardStatsPayload }>();

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

async function countMasterGeo(masters: Awaited<ReturnType<typeof resolveInspectionFilterMasters>>, tpIds: string[]) {
  const client = await getMongoClient();
  if (!client) return { wards: 0, streets: 0 };
  const db = await getActiveMongoDb(client);
  const col = await getCollectionWithAliases(db, 'wardsAndStreets');
  const tps = tpIds.length
    ? (masters.townPanchayats || []).filter((tp: any) =>
        tpIds.includes(String(tp.id || '')) || tpIds.includes(String(tp.code || ''))
      )
    : [];
  const needles = [
    ...new Set(
      [...tpIds, ...tps.flatMap((tp: any) => [tp.id, tp.code, tp.nameEn, tp.nameTa])]
        .map((v) => String(v || '').trim().toLowerCase())
        .filter(Boolean)
    ),
  ];
  const pipeline: Record<string, unknown>[] = [
    {
      $addFields: {
        _tpId: { $toLower: { $trim: { input: { $toString: { $ifNull: ['$tpId', { $ifNull: ['$townPanchayatId', ''] }] } } } } },
        _tpNameEn: { $toLower: { $trim: { input: { $toString: { $ifNull: ['$tpNameEn', { $ifNull: ['$tpName', ''] }] } } } } },
        _tpNameTa: { $toLower: { $trim: { input: { $toString: { $ifNull: ['$tpNameTa', ''] } } } } },
      },
    },
  ];
  if (needles.length) {
    pipeline.push({
      $match: {
        $or: [
          { _tpId: { $in: needles } },
          { _tpNameEn: { $in: needles } },
          { _tpNameTa: { $in: needles } },
        ],
      },
    });
  }
  pipeline.push({
    $group: {
      _id: null,
      streets: { $sum: 1 },
      wards: {
        $addToSet: {
          $concat: [
            '$_tpId',
            '|',
            { $toString: { $ifNull: ['$wardNo', { $ifNull: ['$wardNumber', '$ward'] }] } },
          ],
        },
      },
    },
  });
  const [row] = await col.aggregate(pipeline, { allowDiskUse: true, maxTimeMS: 20000 }).toArray();
  return {
    wards: Array.isArray(row?.wards) ? row.wards.filter(Boolean).length : 0,
    streets: Number(row?.streets) || 0,
  };
}

async function countInspectors() {
  const client = await getMongoClient();
  if (!client) return 0;
  const db = await getActiveMongoDb(client);
  try {
    const col = await getCollectionWithAliases(db, 'inspectionUsers');
    return await col.countDocuments({});
  } catch {
    return 0;
  }
}

export async function loadDashboardStats(
  requestOrigin: string,
  filter: InspectionWorksFilterQuery
): Promise<DashboardStatsPayload> {
  const allTime: InspectionWorksFilterQuery = {
    ...filter,
    fromDate: null,
    toDate: null,
    dateParam: null,
  };
  const key = cacheKey(requestOrigin, allTime);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.data;

  const masters = await resolveInspectionFilterMasters(requestOrigin);
  const tpIds = scopedTpIds(allTime, masters);
  const tps = tpIds.length
    ? (masters.townPanchayats || []).filter((tp: any) => tpIds.includes(String(tp.id || '')) || tpIds.includes(String(tp.code || '')))
    : masters.townPanchayats || [];
  const subjects = liveList(masters.inspectionSubjects, 'subject');
  const categories = liveList(masters.inspectionCategories, 'category');

  const [geo, counts, swm, inspectors] = await Promise.all([
    countMasterGeo(masters, tpIds),
    loadInspectionWorksReportCounts(requestOrigin, allTime),
    aggregateSwmTotals(swmDefaultFilter(allTime, masters), masters),
    countInspectors(),
  ]);

  const data: DashboardStatsPayload = {
    inspection: {
      totalInspections: Number(counts.totalWithoutCategoryFilter) || 0,
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
      householdsSurveyed: swm.householdsSurveyed,
      segregating: swm.segregating,
      notSegregating: swm.notSegregating,
      doorLocked: swm.doorLocked,
      homeComposting: swm.homeComposting,
    },
    source: `${counts.source}|${swm.source}`,
  };
  cache.set(key, { ts: Date.now(), data });
  if (cache.size > 80) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  return data;
}
