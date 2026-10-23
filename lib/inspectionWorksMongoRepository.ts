import type { InspectionWorksFilterMasters, InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import {
  getActiveMongoDb,
  getCollectionWithAliases,
  getMongoClient,
  LITE_INSPECTION_WORKS_PROJECTION,
} from '@/lib/storage';

/** Hard cap per reports API call (production safety). */
export const INSPECTION_WORKS_LITE_MAX_ROWS = 50_000;

function normId(v?: string | null) {
  return String(v || '').trim();
}

function idVariants(id: string): string[] {
  const s = normId(id);
  if (!s) return [];
  const lower = s.toLowerCase();
  const upper = s.toUpperCase();
  return [...new Set([s, lower, upper])];
}

function tpIdsForDistrict(districtId: string, masters: InspectionWorksFilterMasters): string[] {
  const variants = new Set(idVariants(districtId));
  const ids: string[] = [];
  for (const tp of masters.townPanchayats || []) {
    const d = normId(tp.districtId).toLowerCase();
    if (variants.has(d) || variants.has(normId(tp.districtId))) {
      ids.push(normId(tp.id));
    }
  }
  return ids.filter(Boolean);
}

function tpIdsForZone(zoneId: string, masters: InspectionWorksFilterMasters): string[] {
  const needle = normId(zoneId).toLowerCase();
  const zone = (masters.zones || []).find(
    (z) =>
      normId(z.id).toLowerCase() === needle ||
      normId(z.nameEn).toLowerCase() === needle ||
      normId(z.code).toLowerCase() === needle
  );
  const zoneKeys = new Set<string>([needle]);
  if (zone?.id) zoneKeys.add(normId(zone.id).toLowerCase());
  if (zone?.nameEn) zoneKeys.add(normId(zone.nameEn).toLowerCase());

  const districtIds: string[] = [];
  for (const d of masters.districts || []) {
    const dZone = normId(d.zoneId).toLowerCase();
    if (zoneKeys.has(dZone) || zoneKeys.has(needle)) {
      districtIds.push(normId(d.id));
    }
  }
  const tpIds: string[] = [];
  for (const did of districtIds) {
    tpIds.push(...tpIdsForDistrict(did, masters));
  }
  return [...new Set(tpIds.filter(Boolean))];
}

export function applyDefaultReportsDateWindow(filter: InspectionWorksFilterQuery): InspectionWorksFilterQuery {
  if (filter.fromDate || filter.toDate || filter.dateParam) return filter;
  const to = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const d = new Date();
  d.setDate(d.getDate() - 31);
  const from = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
  return { ...filter, fromDate: from, toDate: to };
}

export function buildInspectionWorksMongoMatch(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  const scopeTp = filter.scopeTpId || filter.tpId;
  const scopeDistrict = filter.scopeDistrictId || filter.districtId;
  const scopeZone = filter.scopeZoneId || filter.zoneId;

  if (scopeTp) {
    const variants = idVariants(scopeTp);
    const tp = (masters.townPanchayats || []).find(
      (t) => variants.includes(normId(t.id).toLowerCase()) || variants.includes(normId(t.nameEn).toLowerCase())
    );
    const or: Record<string, unknown>[] = [];
    for (const v of variants) {
      or.push({ tpId: v }, { townPanchayatId: v }, { tpCode: v });
    }
    if (tp?.id) or.push({ tpId: tp.id }, { townPanchayatId: tp.id });
    if (tp?.code) or.push({ tpCode: tp.code });
    if (tp?.nameEn) or.push({ tpNameEn: tp.nameEn });
    and.push({ $or: or });
  } else if (scopeDistrict) {
    const variants = idVariants(scopeDistrict);
    const tpIds = tpIdsForDistrict(scopeDistrict, masters);
    const or: Record<string, unknown>[] = [];
    for (const v of variants) or.push({ districtId: v });
    if (tpIds.length) or.push({ tpId: { $in: tpIds } }, { townPanchayatId: { $in: tpIds } });
    and.push({ $or: or });
  } else if (scopeZone) {
    const tpIds = tpIdsForZone(scopeZone, masters);
    const or: Record<string, unknown>[] = [{ zoneId: { $in: idVariants(scopeZone) } }];
    if (tpIds.length) or.push({ tpId: { $in: tpIds } }, { townPanchayatId: { $in: tpIds } });
    and.push({ $or: or });
  }

  if (filter.ward) {
    const w = normId(filter.ward);
    and.push({
      $or: [{ wardNumber: w }, { wardNo: w }, { ward: w }, { wardNumber: String(Number(w)) }],
    });
  }

  if (filter.username) {
    const u = normId(filter.username);
    const lower = u.toLowerCase();
    and.push({
      $or: [
        { submittedByUserName: u },
        { submittedByUserName: lower },
        { username: u },
        { username: lower },
        { submittedByUserId: u },
        { submittedByUserName: { $regex: new RegExp(`^${u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
      ],
    });
  }

  if (filter.subjectId) {
    const s = normId(filter.subjectId).toLowerCase();
    const subj = (masters.inspectionSubjects || []).find(
      (x) =>
        normId(x.id).toLowerCase() === s ||
        normId(x.code).toLowerCase() === s ||
        normId(x.nameEn).toLowerCase() === s
    );
    const or: Record<string, unknown>[] = [{ subjectId: { $in: idVariants(filter.subjectId) } }];
    if (subj?.id) or.push({ subjectId: subj.id });
    if (subj?.code) or.push({ subjectId: subj.code });
    if (subj?.nameEn) or.push({ subjectNameEn: subj.nameEn });
    and.push({ $or: or });
  }

  if (filter.categoryId) {
    const c = normId(filter.categoryId).toLowerCase();
    const cat = (masters.inspectionCategories || []).find(
      (x) =>
        normId(x.id).toLowerCase() === c ||
        normId(x.code).toLowerCase() === c ||
        normId(x.nameEn).toLowerCase() === c
    );
    const or: Record<string, unknown>[] = [{ categoryId: { $in: idVariants(filter.categoryId) } }];
    if (cat?.id) or.push({ categoryId: cat.id });
    if (cat?.code) or.push({ categoryId: cat.code });
    if (cat?.nameEn) or.push({ categoryNameEn: cat.nameEn });
    and.push({ $or: or });
  }

  // Calendar dates (Asia/Kolkata) are applied in memory after fetch — Mongo UTC/string
  // date fields often miss valid rows when matched here.

  if (!and.length) return {};
  return and.length === 1 ? (and[0] as Record<string, unknown>) : { $and: and };
}

export async function fetchLiteInspectionWorksFromMongoScoped(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  limit = INSPECTION_WORKS_LITE_MAX_ROWS
): Promise<{ rows: any[]; truncated: boolean } | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const match = buildInspectionWorksMongoMatch(filter, masters);
    const cap = limit > 0 ? Math.min(limit, INSPECTION_WORKS_LITE_MAX_ROWS) : INSPECTION_WORKS_LITE_MAX_ROWS;
    const cursor = col
      .find(match, { projection: LITE_INSPECTION_WORKS_PROJECTION })
      .sort({ submittedAt: -1, createdAt: -1 })
      .limit(cap + 1);
    const items = await cursor.toArray();
    const truncated = items.length > cap;
    const slice = truncated ? items.slice(0, cap) : items;
    const rows = slice.map((item: any) => {
      const { _id, ...rest } = item;
      return { id: item.id || item.workId || (_id ? _id.toString() : ''), ...rest };
    });
    return { rows, truncated };
  } catch (err) {
    console.warn('[inspectionWorksMongoRepository] scoped fetch failed:', err);
    return null;
  }
}
