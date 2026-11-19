import { getAppSettings, getCollectionData } from '@/lib/storage';

export type PortalMastersBundle = {
  districts: any[];
  townPanchayats: any[];
  zones: any[];
  subjects: any[];
  categories: any[];
  fields: any[];
  wardsAndStreets: any[];
  inspectionRoles: any[];
  inspectionDesignations: any[];
  settings: Record<string, unknown>;
};

const MASTERS_CACHE_MS = 120_000;
let mastersCache: { ts: number; data: PortalMastersBundle } | null = null;
let mastersInFlight: Promise<PortalMastersBundle> | null = null;

export function invalidatePortalMastersCache() {
  mastersCache = null;
  mastersInFlight = null;
}

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