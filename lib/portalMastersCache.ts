import { getAppSettings, getCollectionData, getEmployees } from '@/lib/storage';

export type PortalMastersBundle = {
  districts: any[];
  townPanchayats: any[];
  zones: any[];
  subjects: any[];
  categories: any[];
  fields: any[];
  wardsAndStreets: any[];
  inspectionUsers: any[];
  employees: any[];
  inspectionRoles: any[];
  inspectionDesignations: any[];
  settings: Record<string, unknown>;
};

const MASTERS_CACHE_MS = 120_000;
let mastersCache: { ts: number; data: PortalMastersBundle } | null = null;
let mastersInFlight: Promise<PortalMastersBundle> | null = null;

export async function loadPortalMastersBundle(): Promise<PortalMastersBundle> {
  const now = Date.now();
  if (mastersCache && now - mastersCache.ts < MASTERS_CACHE_MS) {
    return mastersCache.data;
  }
  if (mastersInFlight) return mastersInFlight;

  mastersInFlight = (async () => {
    const [
      districts,
      townPanchayats,
      zones,
      subjects,
      categories,
      fields,
      wardsAndStreets,
      inspectionUsers,
      employees,
      inspectionRoles,
      inspectionDesignations,
      settings,
    ] = await Promise.all([
      getCollectionData('districts'),
      getCollectionData('townPanchayats'),
      getCollectionData('zones'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('inspectionFields'),
      getCollectionData('wardsAndStreets'),
      getCollectionData('inspectionUsers'),
      getEmployees(),
      getCollectionData('inspectionRoles'),
      getCollectionData('inspectionDesignations'),
      getAppSettings(),
    ]);

    const data: PortalMastersBundle = {
      districts: districts || [],
      townPanchayats: townPanchayats || [],
      zones: zones || [],
      subjects: subjects || [],
      categories: categories || [],
      fields: fields || [],
      wardsAndStreets: wardsAndStreets || [],
      inspectionUsers: inspectionUsers || [],
      employees: employees || [],
      inspectionRoles: inspectionRoles || [],
      inspectionDesignations: inspectionDesignations || [],
      settings: (settings || {}) as Record<string, unknown>,
    };
    mastersCache = { ts: Date.now(), data };
    return data;
  })()
    .catch((err) => {
      mastersInFlight = null;
      throw err;
    })
    .finally(() => {
      mastersInFlight = null;
    });

  return mastersInFlight;
}