/**
 * Authoritative zone / district / town panchayat for inspection users (form, CSV, API save).
 */
import { geoNamesEqual } from '@/lib/geoNameMatch';
import { geoEntityId } from '@/lib/geoEntityId';
import { fetchGeoMasters } from '@/lib/geoMastersClient';
import type { ResolvedGeo } from '@/lib/domain/geoResolver';

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function pickByName<T extends { id?: string; nameEn?: string; nameTa?: string; code?: string }>(
  rows: T[],
  name: string,
): T | null {
  const needle = norm(name);
  if (!needle) return null;
  return (
    rows.find(
      (r) =>
        geoNamesEqual(r.nameEn, needle) ||
        geoNamesEqual(r.nameTa, needle) ||
        norm(r.id).toLowerCase() === needle.toLowerCase() ||
        norm(r.code).toLowerCase() === needle.toLowerCase(),
    ) || null
  );
}

export type InspectionUserGeoStamp = {
  zoneId: string;
  districtId: string;
  tpId: string;
  townPanchayatIds: string[];
  selectedTpIds: string[];
  zone: string;
  zoneTa: string;
  district: string;
  districtTa: string;
  townPanchayat: string;
  townPanchayatTa: string;
  scopeId: string;
};

export function applyResolvedGeoToInspectionUser(user: any, geo: ResolvedGeo): any {
  const existingTpIds = [
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
    geo.tpId,
    user.tpId,
    user.townPanchayatId,
  ]
    .map(norm)
    .filter(Boolean);
  const tpIds = [...new Set(existingTpIds)];
  const primaryTp = geo.tpId || tpIds[0] || '';

  return {
    ...user,
    tpId: primaryTp,
    townPanchayatId: primaryTp,
    scopeId: primaryTp || norm(user.scopeId),
    districtId: geo.districtId || norm(user.districtId),
    zoneId: geo.zoneId || norm(user.zoneId),
    townPanchayat: geo.tpNameEn || norm(user.townPanchayat),
    townPanchayatTa: geo.tpNameTa || norm(user.townPanchayatTa),
    district: geo.districtNameEn || norm(user.district),
    districtTa: geo.districtNameTa || norm(user.districtTa),
    zone: geo.zoneNameEn || norm(user.zone),
    zoneTa: geo.zoneNameTa || norm(user.zoneTa),
    tpCode: geo.tpCode || user.tpCode,
    districtCode: geo.districtCode || user.districtCode,
    selectedTpIds: user.selectedTpIds?.length ? user.selectedTpIds : tpIds,
    townPanchayatIds: user.townPanchayatIds?.length ? user.townPanchayatIds : tpIds,
  };
}

/** Stamp from in-memory masters (form save). TP row is authoritative for district / zone except zonal/HOD. */
export function stampInspectionUserFromMasters(
  user: any,
  masters: { zones?: any[]; districts?: any[]; townPanchayats?: any[] },
): any {
  const zones = masters.zones || [];
  const districts = masters.districts || [];
  const tps = masters.townPanchayats || [];
  const st = String(user.scopeType || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');

  if (st === 'zonal' || st === 'zone' || st === 'hod') {
    const zoneKey = norm(user.zoneId);
    const zone =
      zones.find((z) => geoEntityId(z) === zoneKey) ||
      pickByName(zones, user.zone || zoneKey);
    const zid = geoEntityId(zone) || zoneKey;
    return {
      ...user,
      zoneId: zid,
      districtId: '',
      tpId: '',
      townPanchayatId: '',
      scopeId: zid,
      selectedTpIds: [],
      townPanchayatIds: [],
      townPanchayat: '',
      townPanchayatTa: '',
      district: '',
      districtTa: '',
      zone: norm(zone?.nameEn || user.zone),
      zoneTa: norm(zone?.nameTa || user.zoneTa),
    };
  }

  const tpKey = norm(
    user.tpId ||
      user.townPanchayatId ||
      user.scopeId ||
      (Array.isArray(user.selectedTpIds) ? user.selectedTpIds[0] : ''),
  );
  let tp =
    tps.find((t) => geoEntityId(t) === tpKey) ||
    tps.find((t) => geoNamesEqual(t.nameEn, user.townPanchayat) || geoNamesEqual(t.nameTa, user.townPanchayat));

  if (!tp && tpKey) {
    tp = {
      id: tpKey,
      districtId: user.districtId,
      zoneId: user.zoneId,
      nameEn: user.townPanchayat,
      nameTa: user.townPanchayatTa,
    };
  }

  const districtId = norm(tp?.districtId || user.districtId);
  const dist =
    districts.find((d) => geoEntityId(d) === districtId) ||
    pickByName(districts, user.district);

  const zoneId = norm(dist?.zoneId || tp?.zoneId || user.zoneId);
  const zone =
    zones.find((z) => geoEntityId(z) === zoneId) || pickByName(zones, user.zone);

  const tpIds = [
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
    tp?.id,
  ]
    .map((id) => (typeof id === 'string' ? norm(id) : geoEntityId(id)))
    .filter(Boolean);
  const uniqueTpIds = [...new Set(tpIds)];
  const primaryTp = norm(tp?.id) || uniqueTpIds[0] || '';

  return applyResolvedGeoToInspectionUser(user, {
    tpId: primaryTp,
    tpNameEn: norm(tp?.nameEn || user.townPanchayat),
    tpNameTa: norm(tp?.nameTa || user.townPanchayatTa),
    tpCode: norm(tp?.code),
    districtId: norm(dist?.id || districtId),
    districtNameEn: norm(dist?.nameEn || user.district),
    districtNameTa: norm(dist?.nameTa || user.districtTa),
    districtCode: norm(dist?.code),
    zoneId: norm(zone?.id || zoneId),
    zoneNameEn: norm(zone?.nameEn || user.zone),
    zoneNameTa: norm(zone?.nameTa || user.zoneTa),
    zoneCode: norm(zone?.code),
    missing: [],
  });
}

export type CsvGeoInput = {
  zoneNameEn?: string;
  districtNameEn?: string;
  townPanchayatNames?: string;
};

/** CSV / Excel: hierarchical geo API lookup (no zones[0] fallback). */
export async function resolveInspectionUserGeoFromCsv(input: CsvGeoInput): Promise<InspectionUserGeoStamp | null> {
  const zoneName = norm(input.zoneNameEn);
  const distName = norm(input.districtNameEn);
  const tpRaw = norm(input.townPanchayatNames);
  if (!zoneName && !distName && !tpRaw) return null;

  const zonesRes = await fetchGeoMasters({ level: 'zones', limit: 100 });
  const zones = zonesRes.success ? zonesRes.items || [] : [];
  const zone = zoneName ? pickByName(zones, zoneName) : null;
  if (zoneName && !zone) return null;

  if (zone && !distName && !tpRaw) {
    return {
      zoneId: geoEntityId(zone),
      districtId: '',
      tpId: '',
      townPanchayatIds: [],
      selectedTpIds: [],
      zone: norm(zone.nameEn),
      zoneTa: norm(zone.nameTa),
      district: '',
      districtTa: '',
      townPanchayat: '',
      townPanchayatTa: '',
      scopeId: geoEntityId(zone),
    };
  }

  let district: any = null;
  if (zone) {
    const distRes = await fetchGeoMasters({ level: 'districts', zoneId: geoEntityId(zone), limit: 200 });
    const districts = distRes.success ? distRes.items || [] : [];
    if (distName) {
      district = pickByName(districts, distName);
      if (!district) return null;
    }
  }

  const districtId = district ? geoEntityId(district) : '';
  let matchedTpIds: string[] = [];
  let primaryTp: any = null;

  if (tpRaw && districtId) {
    const tpRes = await fetchGeoMasters({ level: 'townPanchayats', districtId, limit: 500 });
    const tps = tpRes.success ? tpRes.items || [] : [];
    const names = tpRaw.split(',').map((n) => n.trim()).filter(Boolean);
    for (const name of names) {
      const hit = pickByName(tps, name);
      if (hit) {
        matchedTpIds.push(geoEntityId(hit));
        if (!primaryTp) primaryTp = hit;
      }
    }
    matchedTpIds = [...new Set(matchedTpIds)];
  }

  if (!primaryTp && !zone && !district) return null;

  if (!district && primaryTp?.districtId) {
    const distRes = await fetchGeoMasters({ level: 'districts', zoneId: geoEntityId(zone), limit: 200 });
    district = (distRes.items || []).find((d: any) => geoEntityId(d) === norm(primaryTp.districtId));
  }

  const zoneId = norm(zone?.id || district?.zoneId || primaryTp?.zoneId);
  const zoneRow = zone || zones.find((z) => geoEntityId(z) === zoneId);

  return {
    zoneId,
    districtId: norm(district?.id || primaryTp?.districtId),
    tpId: geoEntityId(primaryTp),
    townPanchayatIds: matchedTpIds,
    selectedTpIds: matchedTpIds,
    zone: norm(zoneRow?.nameEn),
    zoneTa: norm(zoneRow?.nameTa),
    district: norm(district?.nameEn),
    districtTa: norm(district?.nameTa),
    townPanchayat: norm(primaryTp?.nameEn),
    townPanchayatTa: norm(primaryTp?.nameTa),
    scopeId: geoEntityId(primaryTp) || zoneId,
  };
}

export function mergeCsvGeoOntoUser(user: any, geo: InspectionUserGeoStamp | null): any {
  if (!geo) return user;
  return applyResolvedGeoToInspectionUser(user, {
    tpId: geo.tpId,
    tpNameEn: geo.townPanchayat,
    tpNameTa: geo.townPanchayatTa,
    tpCode: '',
    districtId: geo.districtId,
    districtNameEn: geo.district,
    districtNameTa: geo.districtTa,
    districtCode: '',
    zoneId: geo.zoneId,
    zoneNameEn: geo.zone,
    zoneNameTa: geo.zoneTa,
    zoneCode: '',
    missing: [],
  });
}