import { getActiveMongoDb, getCollectionData, getCollectionWithAliases, getMongoClient } from '@/lib/storage';
import {
  CANONICAL_THIRUVALLUR_EN,
  CANONICAL_THIRUVALLUR_TA,
  CANONICAL_TIRUVALLUR_ZONE_EN,
  CANONICAL_TIRUVALLUR_ZONE_TA,
  THIRUVALLUR_NAME_REGEX,
  findThiruvallurDistrict,
  findTiruvallurZone,
} from '@/lib/geoNameMatch';

export {
  applyCanonicalDistrictNames,
  CANONICAL_THIRUVALLUR_EN,
  CANONICAL_THIRUVALLUR_TA,
  CANONICAL_TIRUVALLUR_ZONE_EN,
  CANONICAL_TIRUVALLUR_ZONE_TA,
  THIRUVALLUR_NAME_REGEX,
} from '@/lib/geoNameMatch';

function spellingOr(fields: string[]): Record<string, unknown>[] {
  return fields.map((field) => ({ [field]: THIRUVALLUR_NAME_REGEX }));
}

let canonicalizeInFlight: Promise<Record<string, number>> | null = null;

export async function canonicalizeThiruvallurDistrictSpellings(): Promise<{
  canonicalEn: string;
  canonicalTa: string;
  canonicalZoneEn: string;
  districtId: string;
  zoneId: string;
  collections: Record<string, number>;
}> {
  const [districts, zones] = await Promise.all([getCollectionData('districts'), getCollectionData('zones')]);
  const master = findThiruvallurDistrict(districts);
  const zoneMaster = findTiruvallurZone(zones);
  const districtId = String(master?.id || '').trim();
  const zoneId = String(zoneMaster?.id || '').trim();
  const collections: Record<string, number> = {};
  const client = await getMongoClient();
  if (!client) {
    return {
      canonicalEn: CANONICAL_THIRUVALLUR_EN,
      canonicalTa: CANONICAL_THIRUVALLUR_TA,
      canonicalZoneEn: CANONICAL_TIRUVALLUR_ZONE_EN,
      districtId,
      zoneId,
      collections,
    };
  }
  const db = await getActiveMongoDb(client);

  const districtFields = ['districtNameEn', 'district', 'districtName'];
  const zoneFields = ['zoneNameEn', 'zone', 'zoneName'];
  const workKeys = [
    'inspectionWorks',
    'inspectionUsers',
    'users',
    'employees',
    'townPanchayats',
    'districts',
    'wardsAndStreets',
    'inspectionWorkReportRollups',
  ];

  for (const key of workKeys) {
    try {
      const col = await getCollectionWithAliases(db, key);
      const districtSet: Record<string, unknown> = {
        districtNameEn: CANONICAL_THIRUVALLUR_EN,
        districtNameTa: CANONICAL_THIRUVALLUR_TA,
      };
      if (districtId && key !== 'districts') districtSet.districtId = districtId;
      const dRes = await col.updateMany(
        { $or: [...spellingOr(districtFields), { districtNameTa: /திருவள்ளூர்/ }] },
        { $set: districtSet }
      );
      const zoneSet: Record<string, unknown> = {
        zoneNameEn: CANONICAL_TIRUVALLUR_ZONE_EN,
        zoneNameTa: CANONICAL_TIRUVALLUR_ZONE_TA,
      };
      if (zoneId) zoneSet.zoneId = zoneId;
      const zRes = await col.updateMany(
        { $or: [...spellingOr(zoneFields), { zoneNameTa: /திருவள்ளூர்/ }] },
        { $set: zoneSet }
      );
      collections[key] = (dRes.modifiedCount || 0) + (zRes.modifiedCount || 0);
    } catch (err: any) {
      collections[key] = 0;
      console.warn(`[canonicalize-district] ${key}:`, err?.message || err);
    }
  }

  try {
    const distCol = await getCollectionWithAliases(db, 'districts');
    const distName = await distCol.updateMany(
      { $or: [{ nameEn: THIRUVALLUR_NAME_REGEX }, { nameTa: /திருவள்ளூர்/ }] },
      { $set: { nameEn: CANONICAL_THIRUVALLUR_EN, nameTa: CANONICAL_THIRUVALLUR_TA } }
    );
    collections.districts = (collections.districts || 0) + (distName.modifiedCount || 0);
    if (districtId) {
      await distCol.updateOne(
        { id: districtId },
        { $set: { nameEn: CANONICAL_THIRUVALLUR_EN, nameTa: CANONICAL_THIRUVALLUR_TA } }
      );
    }
  } catch (_) {}

  try {
    const zoneCol = await getCollectionWithAliases(db, 'zones');
    const zoneName = await zoneCol.updateMany(
      { $or: [{ nameEn: THIRUVALLUR_NAME_REGEX }, { nameTa: /திருவள்ளூர்/ }] },
      { $set: { nameEn: CANONICAL_TIRUVALLUR_ZONE_EN, nameTa: CANONICAL_TIRUVALLUR_ZONE_TA } }
    );
    collections.zones = (collections.zones || 0) + (zoneName.modifiedCount || 0);
    if (zoneId) {
      await zoneCol.updateOne(
        { id: zoneId },
        { $set: { nameEn: CANONICAL_TIRUVALLUR_ZONE_EN, nameTa: CANONICAL_TIRUVALLUR_ZONE_TA } }
      );
    }
  } catch (_) {}

  try {
    const tpCol = await getCollectionWithAliases(db, 'townPanchayats');
    const tpRes = await tpCol.updateMany(
      { $or: spellingOr(['districtNameEn', 'district', 'districtNameTa']) },
      {
        $set: {
          districtNameEn: CANONICAL_THIRUVALLUR_EN,
          districtNameTa: CANONICAL_THIRUVALLUR_TA,
          ...(districtId ? { districtId } : {}),
        },
      }
    );
    const tpZone = await tpCol.updateMany(
      { $or: spellingOr(['zoneNameEn', 'zone', 'zoneNameTa']) },
      {
        $set: {
          zoneNameEn: CANONICAL_TIRUVALLUR_ZONE_EN,
          zoneNameTa: CANONICAL_TIRUVALLUR_ZONE_TA,
          ...(zoneId ? { zoneId } : {}),
        },
      }
    );
    collections.townPanchayats =
      (collections.townPanchayats || 0) + (tpRes.modifiedCount || 0) + (tpZone.modifiedCount || 0);
  } catch (_) {}

  try {
    const { invalidateInspectionWorksLiteCache } = await import('@/lib/inspectionWorksLiteLoader');
    invalidateInspectionWorksLiteCache();
  } catch (_) {}
  try {
    const { invalidateInspectionWorksAggregateCache } = await import('@/lib/inspectionWorksReportsAggregate');
    invalidateInspectionWorksAggregateCache();
  } catch (_) {}

  return {
    canonicalEn: CANONICAL_THIRUVALLUR_EN,
    canonicalTa: CANONICAL_THIRUVALLUR_TA,
    canonicalZoneEn: CANONICAL_TIRUVALLUR_ZONE_EN,
    districtId,
    zoneId,
    collections,
  };
}

/** Run once per process after Mongo is up so filters and DB use the same spelling. */
export function canonicalizeThiruvallurDistrictSpellingsInBackground(): void {
  if (canonicalizeInFlight) return;
  canonicalizeInFlight = canonicalizeThiruvallurDistrictSpellings()
    .then((result) => {
      const changed = Object.values(result.collections).reduce((s, n) => s + n, 0);
      if (changed) {
        console.log(
          `[canonicalize-district] Unified spelling to ${result.canonicalEn} / ${result.canonicalZoneEn} (${changed} documents)`
        );
      }
      return result.collections;
    })
    .catch((err) => {
      console.warn('[canonicalize-district] background run failed:', err?.message || err);
      canonicalizeInFlight = null;
      return {};
    });
}
