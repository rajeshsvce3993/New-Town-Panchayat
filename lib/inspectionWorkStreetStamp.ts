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

export function normalizeWardNumber(work: any): string {
  const raw = work?.wardNumber ?? work?.wardNo ?? work?.ward ?? work?.fieldsData?.wardNumber ?? '';
  return String(raw).trim().replace(/[^0-9]/g, '').replace(/^0+/, '') || '';
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

function applyStreetRow(work: any, row: any, ward: string): any {
  const en = String(row.streetNameEn || row.streetName || row.nameEn || '').trim();
  const ta = String(row.streetNameTa || row.nameTa || '').trim();
  const display = en || ta;
  const wardNorm = ward || normalizeWardNumber(row);
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
export async function stampInspectionWorkStreet(db: Db, work: any): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  const tpId = String(work.tpId || work.townPanchayatId || '').trim();
  if (!tpId) return work;

  const ward = normalizeWardNumber(work);
  let needle = String(work.streetName || work.street || work.streetNameEn || '').trim();
  if (isPlaceholderStreet(needle)) {
    const fromFields = extractStreetFromFieldsData(work.fieldsData);
    if (fromFields) needle = fromFields;
  }

  const tpFilter = { $or: [{ tpId }, { townPanchayatId: tpId }] };
  const wardFilter = ward
    ? { $or: [{ wardNo: ward }, { wardNumber: ward }, { ward: ward }, { wardNo: String(ward).padStart(2, '0') }] }
    : {};
  const filter = ward ? { $and: [tpFilter, wardFilter] } : tpFilter;

  const rows = await db
    .collection('wardsAndStreets')
    .find(filter, {
      projection: { _id: 0, id: 1, tpId: 1, wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1, streetName: 1 },
      maxTimeMS: 8000,
    })
    .limit(200)
    .toArray();

  if (!rows.length) return work;

  let match = needle && !isPlaceholderStreet(needle) ? rows.find((r) => streetNamesMatch(r, needle)) : undefined;
  if (!match && rows.length === 1) match = rows[0];
  if (!match && needle && !isPlaceholderStreet(needle)) {
    match = rows.find((r) => streetNamesMatch(r, needle));
  }

  if (match) return applyStreetRow(work, match, ward);
  return work;
}