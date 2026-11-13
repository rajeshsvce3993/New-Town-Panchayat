/** Place-name matching for reports filters. Spelling variants of the same place must match; different places must not. */

export function normalizeGeoName(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+(zone|district|town panchayat|panchayat|மண்டலம்|மாவட்டம்)$/i, '')
    .trim();
}

function foldLatinPlace(value?: string | null): string {
  return normalizeGeoName(value)
    .replace(/^(thiru)(?=[a-z])/i, 'tiru')
    .replace(/[^a-z0-9]/g, '');
}

function canonicalFolded(value?: string | null): string {
  return foldLatinPlace(value);
}

export function geoNamesEqual(a?: string | null, b?: string | null): boolean {
  const na = normalizeGeoName(a);
  const nb = normalizeGeoName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.replace(/\s+/g, '') === nb.replace(/\s+/g, '')) return true;
  const fa = canonicalFolded(na);
  const fb = canonicalFolded(nb);
  return !!fa && !!fb && fa === fb;
}

export function geoNameKeys(...values: Array<string | undefined | null>): Set<string> {
  const set = new Set<string>();
  for (const value of values) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw) set.add(raw);
    const normalized = normalizeGeoName(value);
    if (normalized) {
      set.add(normalized);
      set.add(normalized.replace(/\s+/g, ''));
    }
    const folded = canonicalFolded(value);
    if (folded) set.add(folded);
  }
  return set;
}

export function setHasGeoName(set: Set<string>, ...values: Array<string | undefined | null>): boolean {
  for (const value of values) {
    for (const key of geoNameKeys(value)) {
      if (set.has(key)) return true;
    }
  }
  return false;
}

/** Single English/Tamil spelling used in DB, filters, and UI: Tiruvallur. Does not match Tiruchirappalli. */
export const CANONICAL_THIRUVALLUR_EN = 'Tiruvallur';
export const CANONICAL_THIRUVALLUR_TA = 'திருவள்ளூர்';
export const CANONICAL_TIRUVALLUR_ZONE_EN = 'Tiruvallur';
export const CANONICAL_TIRUVALLUR_ZONE_TA = 'திருவள்ளூர்';

export const THIRUVALLUR_NAME_REGEX =
  /^(?:the\s+)?(thiru|tiru)\s*(vallur|valur|vallue|vallor|valloer)(?:\s*(district|dt\.?|zone|மண்டலம்))?$/i;

export function looksLikeGeoId(value?: string | null): boolean {
  return /^(z|d|tp|iu)_/i.test(String(value || '').trim());
}

export function isThiruvallurDistrictSpelling(value?: string | null): boolean {
  const s = String(value || '').trim();
  if (!s || looksLikeGeoId(s)) return false;
  if (THIRUVALLUR_NAME_REGEX.test(s)) return true;
  return /^திருவள்ளூர்/.test(s);
}

function looksLikeZoneName(value?: string | null): boolean {
  const s = String(value || '').trim();
  return /\bzone\b/i.test(s) || /மண்டலம்/.test(s);
}

export function findThiruvallurDistrict(districts: any[] = []): any | null {
  return (
    (districts || []).find(
      (d: any) =>
        isThiruvallurDistrictSpelling(d?.nameEn) ||
        isThiruvallurDistrictSpelling(d?.nameTa) ||
        String(d?.id || '').toLowerCase().includes('thiruvallur') ||
        String(d?.id || '').toLowerCase().includes('tiruvallur')
    ) || null
  );
}

export function findTiruvallurZone(zones: any[] = []): any | null {
  return (
    (zones || []).find(
      (z: any) =>
        isThiruvallurDistrictSpelling(z?.nameEn) ||
        isThiruvallurDistrictSpelling(z?.nameTa) ||
        String(z?.id || '').toLowerCase().includes('thiruvallur') ||
        String(z?.id || '').toLowerCase().includes('tiruvallur')
    ) || null
  );
}

function withCanonicalGeoFields(
  obj: any,
  opts?: { districtId?: string; zoneId?: string; nameKind?: 'zone' | 'district' }
): any {
  const next = { ...obj };
  const districtHit =
    isThiruvallurDistrictSpelling(obj.districtNameEn) ||
    isThiruvallurDistrictSpelling(obj.district) ||
    isThiruvallurDistrictSpelling(obj.districtName) ||
    isThiruvallurDistrictSpelling(obj.districtNameTa);
  const zoneHit =
    isThiruvallurDistrictSpelling(obj.zoneNameEn) ||
    isThiruvallurDistrictSpelling(obj.zoneNameTa) ||
    isThiruvallurDistrictSpelling(obj.zone);
  const nameHit = isThiruvallurDistrictSpelling(obj.nameEn) || isThiruvallurDistrictSpelling(obj.nameTa);
  const nameKind =
    opts?.nameKind ||
    (looksLikeZoneName(obj.nameEn) || looksLikeZoneName(obj.nameTa) ? 'zone' : 'district');

  if (districtHit) {
    next.districtNameEn = CANONICAL_THIRUVALLUR_EN;
    next.districtNameTa = CANONICAL_THIRUVALLUR_TA;
    if (obj.district != null && isThiruvallurDistrictSpelling(obj.district)) {
      next.district = CANONICAL_THIRUVALLUR_EN;
    }
    if (obj.districtName != null) next.districtName = CANONICAL_THIRUVALLUR_EN;
  }
  if (zoneHit) {
    next.zoneNameEn = CANONICAL_TIRUVALLUR_ZONE_EN;
    next.zoneNameTa = CANONICAL_TIRUVALLUR_ZONE_TA;
    if (obj.zone != null && isThiruvallurDistrictSpelling(obj.zone)) {
      next.zone = CANONICAL_TIRUVALLUR_ZONE_EN;
    }
  }
  if (nameHit) {
    if (nameKind === 'zone') {
      next.nameEn = CANONICAL_TIRUVALLUR_ZONE_EN;
      next.nameTa = CANONICAL_TIRUVALLUR_ZONE_TA;
    } else {
      next.nameEn = CANONICAL_THIRUVALLUR_EN;
      next.nameTa = CANONICAL_THIRUVALLUR_TA;
    }
  }
  return next;
}

/** Write-path spelling only. Never overwrite districtId/zoneId from the Tiruvallur master. */
export function applyCanonicalDistrictNames(work: any, _districts: any[] = []): any {
  if (!work || typeof work !== 'object') return work;
  const districtCurrent = String(work.districtNameEn || work.districtName || work.districtNameTa || '').trim();
  const zoneCurrent = String(work.zoneNameEn || work.zoneNameTa || '').trim();
  const districtHit = districtCurrent && isThiruvallurDistrictSpelling(districtCurrent);
  const zoneHit = zoneCurrent && isThiruvallurDistrictSpelling(zoneCurrent);
  if (!districtHit && !zoneHit) return work;
  return withCanonicalGeoFields(work);
}

const stampWorkGeo = require('./stampWorkGeo.js') as {
  stampWorkGeoFromMasters: (
    work: any,
    masters?: {
      townPanchayats?: any[];
      districts?: any[];
      zones?: any[];
      inspector?: any;
    }
  ) => any;
  workHasMasterTpId: (work: any) => boolean;
  listTpNameCandidates: (work: any, masters?: { townPanchayats?: any[]; zones?: any[] }) => any[];
};

export type GeoStampMasters = {
  townPanchayats?: any[];
  districts?: any[];
  zones?: any[];
  inspector?: any;
};

/** Copy zone/district/TP ids from masters. Names are used only when unique in the resolved zone. */
export function stampWorkGeoFromMasters(work: any, masters: GeoStampMasters = {}): any {
  return stampWorkGeo.stampWorkGeoFromMasters(work, masters);
}

export function workHasMasterTpId(work: any): boolean {
  return stampWorkGeo.workHasMasterTpId(work);
}

export function listTpNameCandidates(work: any, masters: GeoStampMasters = {}): any[] {
  return stampWorkGeo.listTpNameCandidates(work, masters);
}

