import { getActiveMongoDb, getCollectionData, getCollectionWithAliases, getMongoClient } from '@/lib/storage';
import {
  THIRUVALLUR_NAME_REGEX,
  findThiruvallurDistrict,
} from '@/lib/geoNameMatch';

export { applyCanonicalDistrictNames, THIRUVALLUR_NAME_REGEX } from '@/lib/geoNameMatch';

const NAME_FIELDS = ['districtNameEn', 'district', 'districtName'] as const;

async function updateNameFields(
  col: any,
  canonicalEn: string,
  canonicalTa: string,
  districtId?: string
): Promise<number> {
  const or: Record<string, unknown>[] = NAME_FIELDS.map((field) => ({ [field]: THIRUVALLUR_NAME_REGEX }));
  or.push({ districtNameTa: /திருவள்ளூர்/ });
  const set: Record<string, unknown> = {
    districtNameEn: canonicalEn,
    districtNameTa: canonicalTa,
  };
  if (districtId) set.districtId = districtId;
  const res = await col.updateMany({ $or: or }, { $set: set });
  return res.modifiedCount || 0;
}

export async function canonicalizeThiruvallurDistrictSpellings(): Promise<{
  canonicalEn: string;
  canonicalTa: string;
  districtId: string;
  collections: Record<string, number>;
}> {
  const districts = await getCollectionData('districts');
  const master = findThiruvallurDistrict(districts);
  const canonicalEn = String(master?.nameEn || 'Thiruvallur').trim() || 'Thiruvallur';
  const canonicalTa = String(master?.nameTa || 'திருவள்ளூர்').trim() || 'திருவள்ளூர்';
  const districtId = String(master?.id || '').trim();

  const collections: Record<string, number> = {};
  const client = await getMongoClient();
  if (!client) {
    return { canonicalEn, canonicalTa, districtId, collections };
  }
  const db = await getActiveMongoDb(client);
  const keys = [
    'inspectionWorks',
    'inspectionUsers',
    'users',
    'employees',
    'townPanchayats',
    'districts',
  ];
  for (const key of keys) {
    try {
      const col = await getCollectionWithAliases(db, key);
      collections[key] = await updateNameFields(
        col,
        canonicalEn,
        canonicalTa,
        key === 'districts' ? undefined : districtId
      );
    } catch (err: any) {
      collections[key] = 0;
      console.warn(`[canonicalize-district] ${key}:`, err?.message || err);
    }
  }

  try {
    const distCol = await getCollectionWithAliases(db, 'districts');
    const distName = await distCol.updateMany(
      { nameEn: THIRUVALLUR_NAME_REGEX },
      { $set: { nameEn: canonicalEn, nameTa: canonicalTa } }
    );
    collections.districts = (collections.districts || 0) + (distName.modifiedCount || 0);
    if (districtId) {
      await distCol.updateOne(
        { id: districtId },
        { $set: { nameEn: canonicalEn, nameTa: canonicalTa } }
      );
    }
  } catch (_) {}

  try {
    const tpCol = await getCollectionWithAliases(db, 'townPanchayats');
    const tpRes = await tpCol.updateMany(
      { $or: [{ districtNameEn: THIRUVALLUR_NAME_REGEX }, { district: THIRUVALLUR_NAME_REGEX }] },
      {
        $set: {
          districtNameEn: canonicalEn,
          districtNameTa: canonicalTa,
          ...(districtId ? { districtId } : {}),
        },
      }
    );
    collections.townPanchayats = (collections.townPanchayats || 0) + (tpRes.modifiedCount || 0);
  } catch (_) {}

  try {
    const { invalidateInspectionWorksLiteCache } = await import('@/lib/inspectionWorksLiteLoader');
    invalidateInspectionWorksLiteCache();
  } catch (_) {}
  return { canonicalEn, canonicalTa, districtId, collections };
}
