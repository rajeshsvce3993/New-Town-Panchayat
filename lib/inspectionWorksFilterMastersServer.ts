import { getCollectionData } from '@/lib/storage';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import type { InspectionWorksFilterMasters } from '@/lib/inspectionWorksQueryFilters';

let mastersCache: { data: InspectionWorksFilterMasters; ts: number; remote: boolean } | null = null;
const MASTERS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveInspectionFilterMasters(requestOrigin?: string): Promise<InspectionWorksFilterMasters> {
  const now = Date.now();
  const useRemoteGeo = shouldUseRemotePortalApi(requestOrigin);
  if (
    mastersCache &&
    now - mastersCache.ts < MASTERS_CACHE_TTL_MS &&
    mastersCache.remote === useRemoteGeo
  ) {
    return mastersCache.data;
  }

  let [districts, zones, townPanchayats, inspectionSubjects, inspectionCategories, inspectionFields] =
    await Promise.all([
      getCollectionData('districts'),
      getCollectionData('zones'),
      getCollectionData('townPanchayats'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('inspectionFields'),
    ]);

  const needRemote =
    useRemoteGeo ||
    !Array.isArray(districts) ||
    districts.length === 0 ||
    !Array.isArray(townPanchayats) ||
    townPanchayats.length === 0;

  if (needRemote) {
    const remoteState =
      (await fetchRemotePortalJson('/api/portal-state', requestOrigin)) ||
      (await fetchRemotePortalJson('/api/state?mode=bootstrap', requestOrigin));
    if (remoteState && typeof remoteState === 'object') {
      const remoteDistricts = remoteState.districts || remoteState.state?.districts || [];
      const remoteZones = remoteState.zones || remoteState.state?.zones || [];
      const remoteTps = remoteState.townPanchayats || remoteState.state?.townPanchayats || [];
      districts = useRemoteGeo && remoteDistricts.length ? remoteDistricts : districts?.length ? districts : remoteDistricts;
      zones = useRemoteGeo && remoteZones.length ? remoteZones : zones?.length ? zones : remoteZones;
      townPanchayats = useRemoteGeo && remoteTps.length ? remoteTps : townPanchayats?.length ? townPanchayats : remoteTps;
      inspectionSubjects = inspectionSubjects?.length
        ? inspectionSubjects
        : remoteState.inspectionSubjects || remoteState.state?.inspectionSubjects || [];
      inspectionCategories = inspectionCategories?.length
        ? inspectionCategories
        : remoteState.inspectionCategories || remoteState.state?.inspectionCategories || [];
      inspectionFields = inspectionFields?.length
        ? inspectionFields
        : remoteState.inspectionFields || remoteState.state?.inspectionFields || [];
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
  mastersCache = { data, ts: now, remote: useRemoteGeo };
  return data;
}
