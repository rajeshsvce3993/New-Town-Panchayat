/** Place-name matching for reports filters. Spelling variants of the same place must match; different places must not. */

export function normalizeGeoName(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+(zone|district|town panchayat|panchayat)$/i, '')
    .trim();
}

function foldLatinPlace(value?: string | null): string {
  return normalizeGeoName(value)
    .replace(/^(thiru)(?=[a-z])/i, 'tiru')
    .replace(/[^a-z0-9]/g, '');
}

/** Known English spellings of the same Tamil Nadu places. Tiruchirappalli is intentionally not in the Thiruvallur group. */
const PLACE_ALIAS_GROUPS: string[][] = [
  [
    'thiruvallur',
    'tiruvallur',
    'thiruvalur',
    'tiruvalur',
    'tiruvallue',
    'thiruvallue',
    'tiruvallor',
    'thiruvallor',
    'thiruvallurdistrict',
    'tiruvallurdistrict',
  ],
];

const ALIAS_CANONICAL = new Map<string, string>();
for (const group of PLACE_ALIAS_GROUPS) {
  const keys = group.map((g) => foldLatinPlace(g)).filter(Boolean);
  const canon = keys[0];
  if (!canon) continue;
  for (const key of keys) ALIAS_CANONICAL.set(key, canon);
}

function canonicalFolded(value?: string | null): string {
  const folded = foldLatinPlace(value);
  if (!folded) return '';
  return ALIAS_CANONICAL.get(folded) || folded;
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

/** One-L / extra-vowel misspellings of Thiruvallur. Does not match Tiruchirappalli. */
export const THIRUVALLUR_NAME_REGEX =
  /^(thiru|tiru)\s*(vallur|valur|vallue|vallor)(?:\s+district)?$/i;

export function isThiruvallurDistrictSpelling(value?: string | null): boolean {
  const s = String(value || '').trim();
  if (!s) return false;
  if (THIRUVALLUR_NAME_REGEX.test(s)) return true;
  return geoNamesEqual(s, 'Thiruvallur') || geoNamesEqual(s, 'Tiruvallur');
}

export function findThiruvallurDistrict(districts: any[] = []): any | null {
  return (
    (districts || []).find(
      (d: any) =>
        geoNamesEqual(d?.nameEn, 'Thiruvallur') ||
        geoNamesEqual(d?.nameEn, 'Tiruvallur') ||
        String(d?.id || '').toLowerCase().includes('thiruvallur') ||
        String(d?.id || '').toLowerCase().includes('tiruvallur')
    ) || null
  );
}

/** Force stored work/user geo fields onto the master district spelling. */
export function applyCanonicalDistrictNames(work: any, districts: any[] = []): any {
  if (!work || typeof work !== 'object') return work;
  const current = String(work.districtNameEn || work.district || work.districtName || '').trim();
  if (!current || !isThiruvallurDistrictSpelling(current)) return work;
  const master = findThiruvallurDistrict(districts);
  const canonicalEn = String(master?.nameEn || 'Thiruvallur').trim() || 'Thiruvallur';
  const canonicalTa = String(master?.nameTa || 'திருவள்ளூர்').trim() || 'திருவள்ளூர்';
  return {
    ...work,
    districtId: master?.id || work.districtId,
    districtNameEn: canonicalEn,
    districtNameTa: canonicalTa,
    ...(work.district != null ? { district: canonicalEn } : {}),
    ...(work.districtName != null ? { districtName: canonicalEn } : {}),
  };
}

