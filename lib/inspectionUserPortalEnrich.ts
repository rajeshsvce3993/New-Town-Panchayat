/** Client-safe geo fields for field-staff tree/table (no Mongo / storage imports). */

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function eq(a: unknown, b: unknown): boolean {
  return norm(a).toLowerCase() === norm(b).toLowerCase();
}

export type InspectionUserGeoMasters = {
  townPanchayats?: any[];
  districts?: any[];
  zones?: any[];
};

export function enrichInspectionUserRow(user: any, masters: InspectionUserGeoMasters): any {
  if (!user) return user;
  const tps = masters.townPanchayats || [];
  const districts = masters.districts || [];
  const zones = masters.zones || [];

  const tpKeys = [
    user.tpId,
    user.townPanchayatId,
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
  ]
    .map(norm)
    .filter(Boolean);

  const matchedTp =
    tps.find((t) => tpKeys.some((k) => eq(t.id, k) || eq(t.code, k) || eq(t.nameEn, k))) || null;

  const districtId = norm(matchedTp?.districtId || user.districtId);
  const matchedDist =
    districts.find((d) => eq(d.id, districtId) || eq(d.code, districtId) || eq(d.nameEn, user.district)) ||
    null;

  const zoneId = norm(matchedZoneId(matchedTp, matchedDist, user, zones));

  const townPanchayatIds = [
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
    matchedTp?.id,
    user.tpId,
    user.townPanchayatId,
  ]
    .map(norm)
    .filter(Boolean);

  return {
    ...user,
    tpId: norm(matchedTp?.id || user.tpId || user.townPanchayatId),
    districtId: norm(matchedDist?.id || districtId),
    zoneId,
    townPanchayat: user.townPanchayat || matchedTp?.nameEn || user.townPanchayat,
    townPanchayatTa: user.townPanchayatTa || matchedTp?.nameTa || user.townPanchayatTa,
    district: user.district || matchedDist?.nameEn || user.district,
    zone: user.zone || zones.find((z) => eq(z.id, zoneId))?.nameEn || user.zone,
    townPanchayatIds: [...new Set(townPanchayatIds)],
    selectedTpIds: user.selectedTpIds?.length ? user.selectedTpIds : matchedTp?.id ? [matchedTp.id] : [],
  };
}

function matchedZoneId(tp: any | null, dist: any | null, user: any, zones: any[]): string {
  const candidates = [user.zoneId, user.zone, tp?.zoneId, dist?.zoneId].map(norm).filter(Boolean);
  for (const cand of candidates) {
    const z = zones.find((row) => eq(row.id, cand) || eq(row.nameEn, cand) || eq(row.code, cand));
    if (z?.id) return norm(z.id);
    if (cand) return cand;
  }
  return norm(user.zoneId);
}

export function enrichInspectionUsersForPortal(
  users: any[],
  masters: InspectionUserGeoMasters,
): any[] {
  return (users || []).map((u) => enrichInspectionUserRow(u, masters));
}

export function userBelongsToZone(user: any, zoneId: string, masters: InspectionUserGeoMasters): boolean {
  const u = enrichInspectionUserRow(user, masters);
  if (eq(u.zoneId, zoneId)) return true;
  const tpIds: string[] = u.townPanchayatIds || [];
  return tpIds.some((tid) => {
    const tp = (masters.townPanchayats || []).find((t) => eq(t.id, tid));
    const dist = (masters.districts || []).find((d) => eq(d.id, tp?.districtId));
    return eq(tp?.zoneId, zoneId) || eq(dist?.zoneId, zoneId);
  });
}

export function userBelongsToDistrict(user: any, districtId: string, masters: InspectionUserGeoMasters): boolean {
  const u = enrichInspectionUserRow(user, masters);
  if (eq(u.districtId, districtId)) return true;
  const tpIds: string[] = u.townPanchayatIds || [];
  return tpIds.some((tid) => {
    const tp = (masters.townPanchayats || []).find((t) => eq(t.id, tid));
    return eq(tp?.districtId, districtId);
  });
}

export function userBelongsToTp(user: any, tpId: string): boolean {
  const ids = [
    user.tpId,
    user.townPanchayatId,
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
  ]
    .map(norm)
    .filter(Boolean);
  return ids.some((id) => eq(id, tpId));
}