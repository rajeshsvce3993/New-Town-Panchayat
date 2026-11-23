import type { InspectionWork, PortalState } from '../types/models';
import { normalizeWard } from './wards';

type GeoWork = InspectionWork & {
  tpId?: string | null;
  townPanchayatId?: string | null;
  districtId?: string | null;
  zoneId?: string | null;
};

function key(value?: string | null): string {
  return String(value || '').trim().toLowerCase();
}

export function isPlaceholderGeoName(value?: string | null): boolean {
  const t = key(value);
  if (!t) return true;
  if (t === 'all districts' || t === 'all town panchayats' || t === 'anna street') return true;
  if (t.startsWith('all districts in') || t.includes('all town panchayats')) return true;
  if (t.includes('அனைத்து பேரூராட்சி') || t.includes('அனைத்து மாவட்ட')) return true;
  return false;
}

function liveName(isTamil: boolean, nameTa?: string | null, nameEn?: string | null): string {
  const ta = String(nameTa || '').trim();
  const en = String(nameEn || '').trim();
  const raw = isTamil ? ta || en : en || ta;
  return isPlaceholderGeoName(raw) ? '' : raw;
}

function findById<T extends { id?: string }>(list: T[] | undefined, id?: string | null): T | undefined {
  const k = key(id);
  if (!k || !list?.length) return undefined;
  return list.find((row) => key(row.id) === k);
}

function preferLive(found?: string | null, prev?: string | null): string {
  const next = String(found || '').trim();
  const cur = String(prev || '').trim();
  if (next && !isPlaceholderGeoName(next)) return next;
  if (cur && !isPlaceholderGeoName(cur)) return cur;
  return '';
}

export function mergeLookedUpWorkPlace(prev: InspectionWork, found: InspectionWork): InspectionWork {
  const a = prev as GeoWork;
  const b = found as GeoWork;
  const foundTpId = key(b.tpId || b.townPanchayatId);
  const samePlace = !!foundTpId && foundTpId === key(a.tpId || a.townPanchayatId);
  return {
    ...prev,
    ...found,
    fieldsData: { ...(prev.fieldsData || {}), ...(found.fieldsData || {}) },
    imageUrl: found.imageUrl || prev.imageUrl,
    tpId: b.tpId || a.tpId,
    townPanchayatId: b.townPanchayatId || a.townPanchayatId,
    districtId: b.districtId || a.districtId,
    zoneId: b.zoneId || a.zoneId,
    wardNumber: preferLive(found.wardNumber, samePlace ? prev.wardNumber : ''),
    streetName: preferLive(found.streetName, samePlace ? prev.streetName : ''),
    tpNameEn: preferLive(found.tpNameEn, samePlace ? prev.tpNameEn : ''),
    tpNameTa: preferLive(found.tpNameTa, samePlace ? prev.tpNameTa : ''),
    districtNameEn: preferLive(found.districtNameEn, samePlace ? prev.districtNameEn : ''),
    districtNameTa: preferLive(found.districtNameTa, samePlace ? prev.districtNameTa : ''),
    zoneNameEn: preferLive(found.zoneNameEn, samePlace ? prev.zoneNameEn : ''),
    zoneNameTa: preferLive(found.zoneNameTa, samePlace ? prev.zoneNameTa : ''),
  };
}

export function resolveWorkPlace(
  work: InspectionWork,
  portal: PortalState,
  isTamil: boolean,
  streetHint?: string,
): { tpName: string; districtName: string; zoneName: string; ward: string; street: string } {
  const row = work as GeoWork;
  const workTp = liveName(isTamil, work.tpNameTa, work.tpNameEn);
  const workDistrict = liveName(isTamil, work.districtNameTa, work.districtNameEn);
  const workZone = liveName(isTamil, work.zoneNameTa, work.zoneNameEn);
  const tp = findById(portal.townPanchayats, row.tpId) || findById(portal.townPanchayats, row.townPanchayatId);
  const district = findById(portal.districts, row.districtId);
  const zone = findById(portal.zones, row.zoneId);

  const tpName = workTp || liveName(isTamil, tp?.nameTa, tp?.nameEn);
  const districtName = workDistrict || liveName(isTamil, district?.nameTa, district?.nameEn);
  const zoneName = workZone || liveName(isTamil, zone?.nameTa, zone?.nameEn);

  const ward = String(work.wardNumber || '').trim();
  const rawStreet = String(streetHint || work.streetName || '').trim();
  const tpId = String(tp?.id || row.tpId || row.townPanchayatId || '').trim();
  const streets = (portal.wardsAndStreets || []) as Array<{
    tpId?: string | null;
    townPanchayatId?: string | null;
    wardNo: string;
    streetNameEn: string;
    streetNameTa?: string | null;
  }>;
  const sameTp = (s: { tpId?: string | null; townPanchayatId?: string | null }) =>
    !!tpId && (key(s.tpId) === key(tpId) || key(s.townPanchayatId) === key(tpId));
  const streetRow = streets.find(
    (s) =>
      sameTp(s) &&
      normalizeWard(s.wardNo) === normalizeWard(ward) &&
      (key(s.streetNameEn) === key(rawStreet) || key(s.streetNameTa) === key(rawStreet)),
  );
  const street = isPlaceholderGeoName(rawStreet)
    ? ''
    : isTamil && streetRow?.streetNameTa
      ? streetRow.streetNameTa
      : rawStreet;

  return { tpName, districtName, zoneName, ward, street };
}
