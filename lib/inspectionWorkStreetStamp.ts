import type { Db } from 'mongodb';
import { geoNamesEqual } from '@/lib/geoNameMatch';

const PLACEHOLDER_STREETS = new Set(
  [
    'Anna Street',
    'Gandhi Street',
    'Bazaar Street',
    'Kamarajar Salai',
    'Bharathiyar Street',
    'Hospital Road',
    'Periyar Nagar',
    'அண்ணா தெரு',
    'காந்தி தெரு',
    'பஜார் தெரு',
    'காமராஜர் சாலை',
    'பாரதியார் தெரு',
    'மருத்துவமனை சாலை',
    'பெரியார் நகர்',
    'Main Road',
    'மெயின் ரோடு',
  ].map((s) => s.trim().toLowerCase()),
);

export function normalizeWardNumber(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');
}

export function workWardNumber(work: any): string {
  const raw = work?.wardNumber ?? work?.wardNo ?? work?.ward ?? extractWardFromFieldsData(work?.fieldsData) ?? '';
  return normalizeWardNumber(raw);
}

export function extractWardFromFieldsData(fields: unknown): string {
  if (!fields || typeof fields !== 'object') return '';
  const obj = fields as Record<string, unknown>;
  for (const key of ['wardNumber', 'wardNo', 'ward', 'if_ward', 'ward_number', 'selectedWard']) {
    const v = obj[key];
    if (v != null && String(v).trim()) return normalizeWardNumber(v);
  }
  return '';
}

function wardOnRow(row: any): string {
  return normalizeWardNumber(row?.wardNo ?? row?.wardNumber ?? row?.ward);
}

function isPlaceholderStreet(name: string): boolean {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return true;
  return PLACEHOLDER_STREETS.has(n);
}

function streetNamesMatch(row: any, needle: string): boolean {
  if (!needle) return false;
  const names = [row?.streetNameEn, row?.streetNameTa, row?.streetName, row?.nameEn, row?.nameTa, row?.street]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  return names.some((n) => geoNamesEqual(n, needle));
}

export function extractStreetFromFieldsData(fields: unknown): string {
  if (!fields || typeof fields !== 'object') return '';
  const obj = fields as Record<string, unknown>;
  const keys = [
    'street',
    'streetName',
    'street_name',
    'if_street',
    'streetNameEn',
    'street_name_en',
    'selectedStreet',
    'street_id',
  ];
  for (const key of keys) {
    const v = obj[key];
    if (typeof v === 'string' && v.trim() && !isPlaceholderStreet(v)) return v.trim();
    if (v && typeof v === 'object' && v !== null) {
      const o = v as Record<string, unknown>;
      const label = String(o.label || o.nameEn || o.name || o.value || '').trim();
      if (label && !isPlaceholderStreet(label)) return label;
    }
  }
  for (const val of Object.values(obj)) {
    if (typeof val !== 'string') continue;
    const s = val.trim();
    if (s.length > 2 && s.length < 120 && !isPlaceholderStreet(s) && !/^https?:/i.test(s) && !s.startsWith('data:')) {
      if (/street|road|salai|தெரு|சாலை/i.test(s)) return s;
    }
  }
  return '';
}

function assignedWardSet(inspector: any): Set<string> {
  const raw = [
    ...(Array.isArray(inspector?.assignedWards) ? inspector.assignedWards : []),
    ...(Array.isArray(inspector?.selectedWards) ? inspector.selectedWards : []),
  ];
  return new Set(raw.map((w) => normalizeWardNumber(w)).filter(Boolean));
}

function applyStreetRow(work: any, row: any, ward: string): any {
  const en = String(row.streetNameEn || row.streetName || row.nameEn || '').trim();
  const ta = String(row.streetNameTa || row.nameTa || '').trim();
  const display = en || ta;
  const wardNorm = ward || wardOnRow(row);
  return {
    ...work,
    streetName: display,
    streetNameEn: en || display,
    streetNameTa: ta || en || display,
    street: display,
    streetId: row.id || work.streetId,
    wardNumber: wardNorm || work.wardNumber,
    wardNo: wardNorm || work.wardNo,
    ward: wardNorm || work.ward,
  };
}

/** Resolve street from wardsAndStreets master using TP + ward + name (fixes mobile Anna Street fallback). */
export async function stampInspectionWorkStreet(
  db: Db,
  work: any,
  inspector?: any | null,
): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  const tpId = String(work.tpId || work.townPanchayatId || '').trim();
  if (!tpId) return work;

  const tpFilter = { $or: [{ tpId }, { townPanchayatId: tpId }] };
  const allRows = await db
    .collection('wardsAndStreets')
    .find(tpFilter, {
      projection: { _id: 0, id: 1, tpId: 1, wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1, streetName: 1 },
      maxTimeMS: 8000,
    })
    .limit(500)
    .toArray();

  if (!allRows.length) return work;

  let needle = String(work.streetName || work.street || work.streetNameEn || '').trim();
  const needleIsPlaceholder = isPlaceholderStreet(needle);
  if (needleIsPlaceholder) {
    const fromFields = extractStreetFromFieldsData(work.fieldsData);
    if (fromFields) needle = fromFields;
  }

  const masterWards = new Set(allRows.map((r) => wardOnRow(r)).filter(Boolean));
  let ward = workWardNumber(work);

  if (ward && !masterWards.has(ward)) {
    const byStreet = needle && !isPlaceholderStreet(needle)
      ? allRows.find((r) => streetNamesMatch(r, needle))
      : undefined;
    if (byStreet) ward = wardOnRow(byStreet);
    else ward = '';
  }

  const assigned = assignedWardSet(inspector);
  if (ward && assigned.size > 0 && !assigned.has(ward)) {
    const byStreet = needle && !isPlaceholderStreet(needle)
      ? allRows.find((r) => streetNamesMatch(r, needle) && assigned.has(wardOnRow(r)))
      : undefined;
    if (byStreet) ward = wardOnRow(byStreet);
    else if (assigned.size === 1) ward = [...assigned][0];
    else if (isPlaceholderStreet(needle)) ward = '';
  }

  const wardRows = ward ? allRows.filter((r) => wardOnRow(r) === ward) : allRows;

  let match: any = undefined;
  let matchInWard = false;
  if (needle && !isPlaceholderStreet(needle)) {
    match = ward ? wardRows.find((r) => streetNamesMatch(r, needle)) : undefined;
    if (match) matchInWard = true;
    else {
      match = allRows.find((r) => streetNamesMatch(r, needle));
    }
  }

  const wardOkForInspector =
    !assigned.size || !ward || assigned.has(ward);
  if (!match && isPlaceholderStreet(needle) && ward && wardRows.length === 1 && wardOkForInspector) {
    match = wardRows[0];
    matchInWard = true;
  }

  if (match) {
    const resolvedWard =
      matchInWard && ward && wardOnRow(match) === ward
        ? ward
        : wardOnRow(match) || ward;
    return applyStreetRow(work, match, resolvedWard);
  }
  return work;
}