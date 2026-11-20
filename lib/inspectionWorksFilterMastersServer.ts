import { getCollectionData } from '@/lib/storage';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { getDb } from '@/lib/repositories/mastersRepository';
import { isLiveDataOnly, isSlimCoreMasters } from '@/lib/productionFlags';
import type { InspectionWorksFilterMasters } from '@/lib/inspectionWorksQueryFilters';

let mastersCache: { data: InspectionWorksFilterMasters; ts: number; remote: boolean } | null = null;
const MASTERS_CACHE_TTL_MS = 15 * 60 * 1000;

export function invalidateInspectionFilterMastersCache() {
  mastersCache = null;
}
const PROJ = { projection: { _id: 0 }, maxTimeMS: 8000 };
const SLIM_GEO_PROJ = {
  projection: { _id: 0, id: 1, districtId: 1, zoneId: 1, nameEn: 1, nameTa: 1, code: 1 },
  maxTimeMS: 8000,
};

async function loadMastersFromMongo(): Promise<InspectionWorksFilterMasters | null> {
  const db = await getDb();
  if (!db) return null;
  const tpProj = isSlimCoreMasters() ? SLIM_GEO_PROJ : PROJ;
  const [districts, zones, townPanchayats, inspectionSubjects, inspectionCategories, inspectionFields] =
    await Promise.all([
      db.collection('districts').find({}, PROJ).toArray(),
      db.collection('zones').find({}, PROJ).toArray(),
      db.collection('townPanchayats').find({}, tpProj).toArray(),
      db.collection('inspectionSubjects').find({}, PROJ).toArray(),
      db.collection('inspectionCategories').find({}, PROJ).toArray(),
      db.collection('inspectionFields').find({}, PROJ).toArray(),
    ]);
  return {
    districts: districts || [],
    zones: zones || [],
    townPanchayats: townPanchayats || [],
    inspectionSubjects: inspectionSubjects || [],
    inspectionCategories: inspectionCategories || [],
    inspectionFields: inspectionFields || [],
  };
}

export async function resolveInspectionFilterMasters(requestOrigin?: string): Promise<InspectionWorksFilterMasters> {
  const now = Date.now();
  const useRemoteGeo = shouldUseRemotePortalApi(requestOrigin);
  const liveOnly = isLiveDataOnly();
  if (
    !liveOnly &&
    mastersCache &&
    now - mastersCache.ts < MASTERS_CACHE_TTL_MS &&
    mastersCache.remote === useRemoteGeo
  ) {
    return mastersCache.data;
  }

  const mongoMasters = await loadMastersFromMongo();
  let districts = mongoMasters?.districts;
  let zones = mongoMasters?.zones;
  let townPanchayats = mongoMasters?.townPanchayats;
  let inspectionSubjects = mongoMasters?.inspectionSubjects;
  let inspectionCategories = mongoMasters?.inspectionCategories;
  let inspectionFields = mongoMasters?.inspectionFields;

  if (!liveOnly && (!mongoMasters || !districts?.length || !townPanchayats?.length)) {
    const [d, z, tp, subj, cat, fld] = await Promise.all([
      getCollectionData('districts'),
      getCollectionData('zones'),
      getCollectionData('townPanchayats'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('inspectionFields'),
    ]);
    districts = d || districts;
    zones = z || zones;
    townPanchayats = tp || townPanchayats;
    inspectionSubjects = subj || inspectionSubjects;
    inspectionCategories = cat || inspectionCategories;
    inspectionFields = fld || inspectionFields;
  }

  const needRemote =
    useRemoteGeo ||
    !Array.isArray(districts) ||
    districts.length === 0 ||
    !Array.isArray(townPanchayats) ||
    townPanchayats.length === 0;

  if (needRemote && useRemoteGeo) {
    const remote = await fetchRemotePortalJson('/api/masters/core', requestOrigin, { timeoutMs: 60_000 });
    const payload = remote?.data || remote;
    if (payload && typeof payload === 'object') {
      districts = payload.districts?.length ? payload.districts : districts;
      zones = payload.zones?.length ? payload.zones : zones;
      townPanchayats = payload.townPanchayats?.length ? payload.townPanchayats : townPanchayats;
      inspectionSubjects = payload.inspectionSubjects?.length ? payload.inspectionSubjects : inspectionSubjects;
      inspectionCategories = payload.inspectionCategories?.length ? payload.inspectionCategories : inspectionCategories;
      inspectionFields = payload.inspectionFields?.length ? payload.inspectionFields : inspectionFields;
    }
  }

  const data: InspectionWorksFilterMasters = {
    districts: districts || [],
    zones: zones || [],
    townPanchayats: townPanchayats || [],
    inspectionSubjects: inspectionSubjects || [],
    inspectionCategories: inspectionCategories || [],
    inspectionFields: inspectionFields || [],
  };
  if (!liveOnly) mastersCache = { data, ts: now, remote: useRemoteGeo };
  return data;
}