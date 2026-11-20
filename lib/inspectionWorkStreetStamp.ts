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

/** Mobile default caption: "Field verification confirmed at Ward 15 Selvaraj Street." */
export function parseWardStreetFromCaption(caption: unknown): { ward: string; street: string } {
  const s = String(caption || '').trim();
  if (!s) return { ward: '', street: '' };
  const en = s.match(/(?:at\s+)?ward\s*(\d+)\s+(.+?)\s*\.?\s*$/i);
  if (en) {
    return { ward: normalizeWardNumber(en[1]), street: String(en[2] || '').trim() };
  }
  const ta = s.match(/வார்டு\s*(\d+)\s+(.+?)\s*\.?\s*$/);
  if (ta) {
    return { ward: normalizeWardNumber(ta[1]), street: String(ta[2] || '').trim() };
  }
  return { ward: '', street: '' };
}

function streetRowsForName(rows: any[], needle: string): any[] {
  if (!needle || isPlaceholderStreet(needle)) return [];
  return rows.filter((r) => streetNamesMatch(r, needle));
}

function pickStreetRow(candidates: any[], preferredWard: string): any | undefined {
  if (!candidates.length) return undefined;
  if (candidates.length === 1) return candidates[0];
  if (preferredWard) {
    const inWard = candidates.filter((r) => wardOnRow(r) === preferredWard);
    if (inWard.length === 1) return inWard[0];
    if (inWard.length > 1) return inWard[0];
    return undefined;
  }
  return undefined;
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
async function enrichInspectorForStreet(db: Db, inspector: any | null | undefined): Promise<any | null | undefined> {
  if (!inspector) return inspector;
  if (assignedWardSet(inspector).size > 0) return inspector;
  try {
    const keys = [inspector.username, inspector.mobile, inspector.id].map((v) => String(v || '').trim()).filter(Boolean);
    if (!keys.length) return inspector;
    const scope = await db.collection('user_scope_cache').findOne(
      {
        $or: [
          { username: { $in: keys.map((k) => k.toLowerCase()) } },
          { userId: { $in: keys } },
          ...keys.map((k) => ({ 'user.mobile': k })),
        ],
      },
      { projection: { assignedWards: 1, selectedWards: 1 }, maxTimeMS: 3000 },
    );
    if (!scope) return inspector;
    const aw = [...(scope.assignedWards || []), ...(scope.selectedWards || [])];
    if (!aw.length) return inspector;
    return { ...inspector, assignedWards: scope.assignedWards || inspector.assignedWards, selectedWards: scope.selectedWards || inspector.selectedWards };
  } catch {
    return inspector;
  }
}

export async function stampInspectionWorkStreet(
  db: Db,
  work: any,
  inspector?: any | null,
): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  inspector = await enrichInspectorForStreet(db, inspector);

  const tpId = String(work.tpId || work.townPanchayatId || inspector?.tpId || inspector?.townPanchayatId || '').trim();
  if (!tpId) return work;

  if (inspector && assignedWardSet(inspector).size === 0) {
    const wardSeed = await db
      .collection('wardsAndStreets')
      .distinct('wardNo', { $or: [{ tpId }, { townPanchayatId: tpId }] });
    const wards = wardSeed.map((w) => normalizeWardNumber(w)).filter(Boolean);
    if (wards.length) {
      inspector = { ...inspector, assignedWards: wards, selectedWards: inspector?.selectedWards || wards };
    }
  }

  const masterStreetId = String(work.streetId || work.streetMasterId || '').trim();
  if (masterStreetId) {
    const byId = await db.collection('wardsAndStreets').findOne(
      { id: masterStreetId },
      { projection: { _id: 0, id: 1, wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1, streetName: 1 } },
    );
    if (byId) {
      const w = wardOnRow(byId);
      return applyStreetRow({ ...work, tpId, townPanchayatId: work.townPanchayatId || tpId }, byId, w);
    }
  }

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

  const fromCaption = parseWardStreetFromCaption(work.imageCaption);

  let needle = String(
    work.streetName || work.street || work.streetNameEn || work.streetNameTa || '',
  ).trim();
  const needleIsPlaceholder = isPlaceholderStreet(needle);
  if (needleIsPlaceholder) {
    const fromFields = extractStreetFromFieldsData(work.fieldsData);
    if (fromFields) needle = fromFields;
    else if (fromCaption.street && !isPlaceholderStreet(fromCaption.street)) needle = fromCaption.street;
  }

  const masterWards = new Set(allRows.map((r) => wardOnRow(r)).filter(Boolean));
  let ward = workWardNumber(work);
  if ((!ward || (ward === '1' && needleIsPlaceholder)) && fromCaption.ward) {
    ward = fromCaption.ward;
  }

  if (needle && !isPlaceholderStreet(needle)) {
    const globalHits = streetRowsForName(allRows, needle);
    if (globalHits.length === 1) {
      return applyStreetRow(work, globalHits[0], wardOnRow(globalHits[0]));
    }
    if (ward) {
      const inWardHits = streetRowsForName(
        allRows.filter((r) => wardOnRow(r) === ward),
        needle,
      );
      if (inWardHits.length === 1) {
        return applyStreetRow(work, inWardHits[0], ward);
      }
    }
  }

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
    const named = streetRowsForName(ward ? wardRows : allRows, needle);
    const globalNamed = ward ? streetRowsForName(allRows, needle) : named;
    const pool = named.length ? named : globalNamed;
    if (pool.length) {
      match = pickStreetRow(pool, ward) || (pool.length === 1 ? pool[0] : undefined);
      matchInWard = !!(ward && match && wardOnRow(match) === ward);
    }
  }

  const wardOkForInspector = !assigned.size || !ward || assigned.has(ward);
  const defaultWardOne = ward === '1';
  if (
    !match &&
    isPlaceholderStreet(needle) &&
    ward &&
    !defaultWardOne &&
    wardRows.length === 1 &&
    wardOkForInspector
  ) {
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