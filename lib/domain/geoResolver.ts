import type { Db } from 'mongodb';
import { geoNamesEqual } from '@/lib/geoNameMatch';

export type ResolvedGeo = {
  tpId: string;
  tpNameEn: string;
  tpNameTa: string;
  tpCode: string;
  districtId: string;
  districtNameEn: string;
  districtNameTa: string;
  districtCode: string;
  zoneId: string;
  zoneNameEn: string;
  zoneNameTa: string;
  zoneCode: string;
  missing: string[];
};

function normId(v: unknown): string {
  return String(v ?? '').trim();
}

async function findTownPanchayat(db: Db, user: any) {
  const tpId = normId(user.tpId || user.townPanchayatId);
  const tpName = normId(user.townPanchayat || user.tpName);
  const col = db.collection('townPanchayats');
  if (tpId) {
    const byId = await col.findOne(
      { $or: [{ id: tpId }, { _id: tpId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, districtId: 1, zoneId: 1 } },
    );
    if (byId) return byId;
  }
  if (tpName) {
    const rows = await col
      .find({}, { maxTimeMS: 4000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, districtId: 1, zoneId: 1 } })
      .limit(800)
      .toArray();
    return (
      rows.find(
        (t: any) =>
          geoNamesEqual(t.nameEn, tpName) ||
          geoNamesEqual(t.nameTa, tpName) ||
          String(t.id || '').toLowerCase() === tpName.toLowerCase(),
      ) || null
    );
  }
  return null;
}

async function findDistrict(db: Db, districtId: string, fallbackName: string) {
  const col = db.collection('districts');
  if (districtId) {
    const row = await col.findOne(
      { $or: [{ id: districtId }, { _id: districtId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } },
    );
    if (row) return row;
  }
  if (fallbackName) {
    const rows = await col
      .find({}, { maxTimeMS: 4000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } })
      .limit(200)
      .toArray();
    return rows.find((d: any) => geoNamesEqual(d.nameEn, fallbackName) || geoNamesEqual(d.nameTa, fallbackName)) || null;
  }
  return null;
}

async function findZone(db: Db, zoneId: string, fallbackName: string) {
  const col = db.collection('zones');
  if (zoneId) {
    const row = await col.findOne(
      { $or: [{ id: zoneId }, { _id: zoneId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1 } },
    );
    if (row) return row;
  }
  if (fallbackName) {
    const rows = await col.find({}, { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1 } }).limit(100).toArray();
    return rows.find((z: any) => geoNamesEqual(z.nameEn, fallbackName) || geoNamesEqual(z.nameTa, fallbackName)) || null;
  }
  return null;
}

/** Authoritative geo chain: TP master → district → zone (no hardcoded district defaults). */
export async function resolveGeoForUser(db: Db, user: any): Promise<ResolvedGeo> {
  const missing: string[] = [];
  const tp = await findTownPanchayat(db, user);
  if (!tp) missing.push('townPanchayat');

  const districtIdFromTp = normId(tp?.districtId);
  const district = await findDistrict(db, districtIdFromTp, normId(user.district || user.districtName));
  if (!district) missing.push('district');

  const zoneIdCandidates = [normId(tp?.zoneId), normId(district?.zoneId), normId(user.zoneId)].filter(Boolean);
  let zone: any = null;
  for (const zid of zoneIdCandidates) {
    zone = await findZone(db, zid, '');
    if (zone) break;
  }
  if (!zone) {
    zone = await findZone(db, '', normId(user.zone || user.zoneName));
  }
  if (!zone) missing.push('zone');

  return {
    tpId: normId(tp?.id) || normId(user.tpId),
    tpNameEn: normId(tp?.nameEn),
    tpNameTa: normId(tp?.nameTa),
    tpCode: normId(tp?.code),
    districtId: normId(district?.id) || districtIdFromTp,
    districtNameEn: normId(district?.nameEn),
    districtNameTa: normId(district?.nameTa),
    districtCode: normId(district?.code),
    zoneId: normId(zone?.id) || normId(zoneIdCandidates[0]),
    zoneNameEn: normId(zone?.nameEn),
    zoneNameTa: normId(zone?.nameTa),
    zoneCode: normId(zone?.code),
    missing,
  };
}