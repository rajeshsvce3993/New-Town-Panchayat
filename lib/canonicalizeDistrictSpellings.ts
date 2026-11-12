import { getActiveMongoDb, getMongoClient } from '@/lib/storage';

const {
  canonicalizeTiruvallurSpellings,
  CANONICAL_DISTRICT_EN,
  CANONICAL_DISTRICT_TA,
  CANONICAL_ZONE_EN,
} = require('./canonicalizeTiruvallurMongo.js');

export {
  applyCanonicalDistrictNames,
  CANONICAL_THIRUVALLUR_EN,
  CANONICAL_THIRUVALLUR_TA,
  CANONICAL_TIRUVALLUR_ZONE_EN,
  CANONICAL_TIRUVALLUR_ZONE_TA,
  THIRUVALLUR_NAME_REGEX,
} from '@/lib/geoNameMatch';

let canonicalizeInFlight: Promise<{
  canonicalEn: string;
  canonicalTa: string;
  canonicalZoneEn: string;
  districtId: string;
  zoneId: string;
  collections: Record<string, number>;
  matched: number;
  modified: number;
  dbName: string;
}> | null = null;

export async function canonicalizeThiruvallurDistrictSpellings(): Promise<{
  canonicalEn: string;
  canonicalTa: string;
  canonicalZoneEn: string;
  districtId: string;
  zoneId: string;
  collections: Record<string, number>;
  matched: number;
  modified: number;
  dbName: string;
}> {
  if (canonicalizeInFlight) return canonicalizeInFlight;
  canonicalizeInFlight = (async () => {
    const client = await getMongoClient();
    if (!client) {
      console.warn('[canonicalize-district] Mongo client is not available; spelling rewrite skipped.');
      return {
        canonicalEn: CANONICAL_DISTRICT_EN,
        canonicalTa: CANONICAL_DISTRICT_TA,
        canonicalZoneEn: CANONICAL_ZONE_EN,
        districtId: '',
        zoneId: '',
        collections: {},
        matched: 0,
        modified: 0,
        dbName: '',
      };
    }
    const db = await getActiveMongoDb(client);
    const result = await canonicalizeTiruvallurSpellings(db);
    try {
      const { invalidateInspectionWorksLiteCache } = await import('@/lib/inspectionWorksLiteLoader');
      invalidateInspectionWorksLiteCache();
    } catch (_) {}
    try {
      const { invalidateInspectionWorksAggregateCache } = await import('@/lib/inspectionWorksReportsAggregate');
      invalidateInspectionWorksAggregateCache();
    } catch (_) {}
    return {
      canonicalEn: result.canonicalEn,
      canonicalTa: result.canonicalTa,
      canonicalZoneEn: result.canonicalZoneEn,
      districtId: '',
      zoneId: '',
      collections: result.collections || {},
      matched: result.matched || 0,
      modified: result.modified || 0,
      dbName: result.dbName || db.databaseName,
    };
  })().catch((err) => {
    canonicalizeInFlight = null;
    throw err;
  });
  return canonicalizeInFlight;
}

/** Run after Mongo connects. Safe to call more than once; only one run proceeds per process. */
export function canonicalizeThiruvallurDistrictSpellingsInBackground(): void {
  if (canonicalizeInFlight) return;
  console.log('[canonicalize-district] Queued after Mongo connect.');
  void canonicalizeThiruvallurDistrictSpellings()
    .then((result) => result.collections || {})
    .catch((err) => {
      console.warn('[canonicalize-district] background run failed:', err?.message || err);
      return {};
    });
}
