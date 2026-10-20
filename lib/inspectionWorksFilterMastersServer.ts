import { getCollectionData } from '@/lib/storage';
import { fetchRemotePortalJson } from '@/lib/remotePortalApi';
import type { InspectionWorksFilterMasters } from '@/lib/inspectionWorksQueryFilters';

let mastersCache: { data: InspectionWorksFilterMasters; ts: number } | null = null;
const MASTERS_CACHE_TTL_MS = 5 * 60 * 1000;

export async function resolveInspectionFilterMasters(requestOrigin?: string): Promise<InspectionWorksFilterMasters> {
  const now = Date.now();
  if (mastersCache && now - mastersCache.ts < MASTERS_CACHE_TTL_MS) {
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
    !Array.isArray(districts) ||
    districts.length === 0 ||
    !Array.isArray(townPanchayats) ||
    townPanchayats.length === 0;

  if (needRemote) {
    const remoteState = await fetchRemotePortalJson('/api/portal-state', requestOrigin);
    if (remoteState && typeof remoteState === 'object') {
      districts = districts?.length ? districts : remoteState.districts || remoteState.state?.districts || [];
      zones = zones?.length ? zones : remoteState.zones || remoteState.state?.zones || [];
      townPanchayats = townPanchayats?.length
        ? townPanchayats
        : remoteState.townPanchayats || remoteState.state?.townPanchayats || [];
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
  mastersCache = { data, ts: now };
  return data;
}
