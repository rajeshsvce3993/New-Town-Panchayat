import type { InspectionWorksFilterMasters, InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';
import {
  getActiveMongoDb,
  getCollectionWithAliases,
  getMongoClient,
  LITE_INSPECTION_WORKS_PROJECTION,
} from '@/lib/storage';

/** Smaller Mongo payload for counts-only reports API (no fieldsData / media). */
export const REPORT_COUNTS_INSPECTION_WORKS_PROJECTION = {
  photos: 0,
  documents: 0,
  photoBase64: 0,
  locationImage: 0,
  staticMapUrl: 0,
  mapImage: 0,
  fieldsData: 0,
};

type MongoProjection =
  | typeof LITE_INSPECTION_WORKS_PROJECTION
  | typeof REPORT_COUNTS_INSPECTION_WORKS_PROJECTION
  | (typeof LITE_INSPECTION_WORKS_PROJECTION & { fieldsData: 0 });

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

export function wardFilterVariants(ward: string): Array<string | number> {
  const w = normId(ward);
  if (!w) return [];
  const stripped = w.replace(/^0+/, '') || '0';
  const padded2 = stripped.padStart(2, '0');
  const padded3 = stripped.padStart(3, '0');
  const n = Number(stripped);
  const out: Array<string | number> = [w, stripped, padded2, padded3];
  if (!Number.isNaN(n)) {
    out.push(n, String(n));
  }
  return [...new Set(out)];
}

export function districtIdsForZone(zoneId: string, masters: InspectionWorksFilterMasters): string[] {
  const needle = normId(zoneId).toLowerCase();
  const zone = (masters.zones || []).find(
    (z) =>
      normId(z.id).toLowerCase() === needle ||
      normId(z.nameEn).toLowerCase() === needle ||
      normId(z.nameTa).toLowerCase() === needle ||
      normId(z.code).toLowerCase() === needle
  );
  const zoneKeys = new Set<string>([needle]);
  if (zone?.id) zoneKeys.add(normId(zone.id).toLowerCase());
  if (zone?.nameEn) zoneKeys.add(normId(zone.nameEn).toLowerCase());
  if (zone?.nameTa) zoneKeys.add(normId(zone.nameTa).toLowerCase());
  if (zone?.code) zoneKeys.add(normId(zone.code).toLowerCase());

  const ids: string[] = [];
  for (const d of masters.districts || []) {
    const dZone = normId(d.zoneId).toLowerCase();
    const dZoneName = normId(d.zoneNameEn).toLowerCase();
    if ((dZone && zoneKeys.has(dZone)) || (dZoneName && zoneKeys.has(dZoneName))) {
      ids.push(normId(d.id));
      if (d.code) ids.push(normId(d.code));
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

export function tpIdsForDistrict(districtId: string, masters: InspectionWorksFilterMasters): string[] {
  const needle = normId(districtId).toLowerCase();
  const dist = (masters.districts || []).find(
    (d) =>
      normId(d.id).toLowerCase() === needle ||
      normId(d.nameEn).toLowerCase() === needle ||
      normId(d.nameTa).toLowerCase() === needle ||
      normId(d.code).toLowerCase() === needle
  );
  const keys = new Set<string>(idVariants(districtId).map((v) => v.toLowerCase()));
  if (dist?.id) keys.add(normId(dist.id).toLowerCase());
  if (dist?.code) keys.add(normId(dist.code).toLowerCase());
  if (dist?.nameEn) keys.add(normId(dist.nameEn).toLowerCase());
  if (dist?.nameTa) keys.add(normId(dist.nameTa).toLowerCase());

  const ids: string[] = [];
  for (const tp of masters.townPanchayats || []) {
    const d = normId(tp.districtId).toLowerCase();
    const dName = normId(tp.districtNameEn).toLowerCase();
    if (keys.has(d) || keys.has(dName) || keys.has(normId(tp.districtId))) {
      ids.push(normId(tp.id));
      if (tp.code) ids.push(normId(tp.code));
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

export function tpIdsForZone(zoneId: string, masters: InspectionWorksFilterMasters): string[] {
  const needle = normId(zoneId).toLowerCase();
  const zone = (masters.zones || []).find(
    (z) =>
      normId(z.id).toLowerCase() === needle ||
      normId(z.nameEn).toLowerCase() === needle ||
      normId(z.nameTa).toLowerCase() === needle ||
      normId(z.code).toLowerCase() === needle
  );
  const zoneKeys = new Set<string>([needle]);
  if (zone?.id) zoneKeys.add(normId(zone.id).toLowerCase());
  if (zone?.nameEn) zoneKeys.add(normId(zone.nameEn).toLowerCase());
  if (zone?.code) zoneKeys.add(normId(zone.code).toLowerCase());

  const tpIds: string[] = [];
  for (const did of districtIdsForZone(zoneId, masters)) {
    tpIds.push(...tpIdsForDistrict(did, masters));
  }
  for (const tp of masters.townPanchayats || []) {
    const z = normId(tp.zoneId).toLowerCase();
    if (z && zoneKeys.has(z)) {
      tpIds.push(normId(tp.id));
      if (tp.code) tpIds.push(normId(tp.code));
    }
  }
  return [...new Set(tpIds.filter(Boolean))];
}

export function applyDefaultReportsDateWindow(filter: InspectionWorksFilterQuery): InspectionWorksFilterQuery {
  if (filter.fromDate || filter.toDate || filter.dateParam) return filter;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return { ...filter, fromDate: today, toDate: today };
}

/** Works often store submittedAt as DD-MM-YYYY h:mm AM/PM, not ISO. */
function indianDatePrefixRegex(fromDate: string, toDate: string): string | null {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
  const alts: string[] = [];
  const cur = new Date(start);
  let n = 0;
  while (cur <= end && n < 400) {
    const ymd = cur.toISOString().slice(0, 10);
    const [year, month, day] = ymd.split('-');
    alts.push(`${day}-${month}-${year}`, `${day}/${month}/${year}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
    n += 1;
  }
  if (!alts.length) return null;
  return `^(?:${alts.join('|')})`;
}

function dateMatchOrClauses(fromDate: string, toDate: string, isoFrom: string, isoTo: string): Record<string, unknown>[] {
  const or: Record<string, unknown>[] = [
    { submittedAt: { $gte: isoFrom, $lte: isoTo } },
    { createdAt: { $gte: isoFrom, $lte: isoTo } },
    { date: { $gte: fromDate, $lte: toDate } },
    { submittedDateYmd: { $gte: fromDate, $lte: toDate } },
  ];
  const indianRe = indianDatePrefixRegex(fromDate, toDate);
  if (indianRe) {
    or.push({ submittedAt: { $regex: indianRe } }, { createdAt: { $regex: indianRe } });
  }
  return or;
}

/** Narrow Mongo reads; final IST calendar filter stays in memory. */
export function appendLooseUtcDatePrefilter(
  and: Record<string, unknown>[],
  filter: InspectionWorksFilterQuery
): void {
  if (filter.fromDate || filter.toDate) {
    const fromDate = filter.fromDate || filter.toDate!;
    const toDate = filter.toDate || filter.fromDate!;
    const fromD = new Date(`${fromDate}T00:00:00.000Z`);
    fromD.setUTCDate(fromD.getUTCDate() - 1);
    const toD = new Date(`${toDate}T23:59:59.999Z`);
    toD.setUTCDate(toD.getUTCDate() + 1);
    and.push({ $or: dateMatchOrClauses(fromDate, toDate, fromD.toISOString(), toD.toISOString()) });
  } else if (filter.dateParam) {
    const ymd = filter.dateParam;
    const fromD = new Date(`${ymd}T00:00:00.000Z`);
    fromD.setUTCDate(fromD.getUTCDate() - 1);
    const toD = new Date(`${ymd}T23:59:59.999Z`);
    toD.setUTCDate(toD.getUTCDate() + 1);
    and.push({ $or: dateMatchOrClauses(ymd, ymd, fromD.toISOString(), toD.toISOString()) });
  }
}

export function buildInspectionWorksMongoMatch(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  opts?: { skipDatePrefilter?: boolean }
): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  const scopeTp = filter.tpId || filter.scopeTpId;
  const scopeDistrict = filter.tpId ? null : filter.districtId || filter.scopeDistrictId;
  const scopeZone = filter.tpId || filter.districtId ? null : filter.zoneId || filter.scopeZoneId;

  if (scopeTp) {
    const variants = idVariants(scopeTp);
    const tp = (masters.townPanchayats || []).find(
      (t) => variants.includes(normId(t.id).toLowerCase()) || variants.includes(normId(t.nameEn).toLowerCase())
    );
    const or: Record<string, unknown>[] = [];
    for (const v of variants) {
      or.push({ tpId: v }, { townPanchayatId: v });
    }
    if (tp?.id) or.push({ tpId: tp.id }, { townPanchayatId: tp.id });
    if (tp?.nameEn) {
      const escaped = String(tp.nameEn).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      or.push({ tpNameEn: tp.nameEn });
      or.push({ tpNameEn: { $regex: `^${escaped}$`, $options: 'i' } });
    }
    and.push({ $or: or });
  } else if (scopeDistrict) {
    const variants = idVariants(scopeDistrict);
    const dist = (masters.districts || []).find(
      (d) =>
        variants.includes(normId(d.id).toLowerCase()) ||
        variants.includes(normId(d.nameEn).toLowerCase()) ||
        variants.includes(normId(d.code).toLowerCase())
    );
    const tpIds = tpIdsForDistrict(scopeDistrict, masters);
    const or: Record<string, unknown>[] = [];
    for (const v of variants) or.push({ districtId: v });
    if (dist?.id) or.push({ districtId: dist.id });
    if (dist?.nameEn) or.push({ districtNameEn: dist.nameEn });
    if (tpIds.length) or.push({ tpId: { $in: tpIds } }, { townPanchayatId: { $in: tpIds } });
    and.push({ $or: or });
  } else if (scopeZone) {
    const zoneVariants = idVariants(scopeZone);
    const zone = (masters.zones || []).find(
      (z) =>
        zoneVariants.includes(normId(z.id).toLowerCase()) ||
        zoneVariants.includes(normId(z.nameEn).toLowerCase()) ||
        zoneVariants.includes(normId(z.code).toLowerCase())
    );
    const districtIds = districtIdsForZone(scopeZone, masters);
    const tpIds = tpIdsForZone(scopeZone, masters);
    const nameOr: Record<string, unknown>[] = [];
    if (zone?.nameEn) {
      const escaped = zone.nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      nameOr.push({ zoneNameEn: zone.nameEn });
      nameOr.push({ zoneNameEn: { $regex: `^${escaped}$`, $options: 'i' } });
    }
    if (zone?.nameTa) nameOr.push({ zoneNameTa: zone.nameTa });
    const idOr: Record<string, unknown>[] = [{ zoneId: { $in: zoneVariants } }];
    if (zone?.id) idOr.push({ zoneId: zone.id });
    const emptyNameOr: Record<string, unknown>[] = [
      { zoneNameEn: { $exists: false } },
      { zoneNameEn: null },
      { zoneNameEn: '' },
      ...nameOr,
    ];
    const identityOr: Record<string, unknown>[] = [
      ...nameOr,
      { $and: [{ $or: idOr }, { $or: emptyNameOr }] },
    ];
    const childOr: Record<string, unknown>[] = [];
    if (districtIds.length) childOr.push({ districtId: { $in: districtIds } });
    if (tpIds.length) childOr.push({ tpId: { $in: tpIds } }, { townPanchayatId: { $in: tpIds } });
    const zoneOr = [...identityOr];
    if (childOr.length) {
      zoneOr.push({
        $and: [
          { $or: [{ zoneId: { $exists: false } }, { zoneId: null }, { zoneId: '' }] },
          { $or: [{ zoneNameEn: { $exists: false } }, { zoneNameEn: null }, { zoneNameEn: '' }] },
          { $or: childOr },
        ],
      });
    }
    and.push({ $or: zoneOr });
  }

  if (filter.ward) {
    const variants = wardFilterVariants(filter.ward);
    and.push({
      $or: [
        { wardNumber: { $in: variants } },
        { wardNo: { $in: variants } },
        { ward: { $in: variants } },
      ],
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
    if (subj?.nameEn) or.push({ subjectId: subj.nameEn }, { subjectNameEn: subj.nameEn });
    if (subj?.nameTa) or.push({ subjectNameTa: subj.nameTa });
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
    if (cat?.nameEn) or.push({ categoryId: cat.nameEn }, { categoryNameEn: cat.nameEn });
    if (cat?.nameTa) or.push({ categoryNameTa: cat.nameTa });
    and.push({ $or: or });
  }

  if (!opts?.skipDatePrefilter) {
    appendLooseUtcDatePrefilter(and, filter);
  }

  if (!and.length) return {};
  return and.length === 1 ? (and[0] as Record<string, unknown>) : { $and: and };
}

/** Dashboard KPI groups — no full collection scan in Node. */
export async function fetchInspectionWorksDashboardStatsFromMongo(): Promise<any[] | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const rows = await col
      .aggregate([
        {
          $project: {
            subjectId: { $ifNull: ['$subjectId', 'unknown'] },
            categoryId: { $ifNull: ['$categoryId', '_unknown'] },
            subjectNameEn: 1,
            subjectNameTa: 1,
            categoryNameEn: 1,
            categoryNameTa: 1,
            zoneId: { $ifNull: ['$zoneId', ''] },
            districtId: { $ifNull: ['$districtId', ''] },
            tpId: { $ifNull: [{ $ifNull: ['$tpId', '$townPanchayatId'] }, ''] },
            workId: 1,
            id: 1,
          },
        },
        {
          $group: {
            _id: {
              subjectId: '$subjectId',
              categoryId: '$categoryId',
              zoneId: '$zoneId',
              districtId: '$districtId',
              tpId: '$tpId',
            },
            count: { $sum: 1 },
            subjectNameEn: { $first: '$subjectNameEn' },
            subjectNameTa: { $first: '$subjectNameTa' },
            categoryNameEn: { $first: '$categoryNameEn' },
            categoryNameTa: { $first: '$categoryNameTa' },
          },
        },
        {
          $project: {
            _id: 0,
            subjectId: '$_id.subjectId',
            categoryId: '$_id.categoryId',
            zoneId: '$_id.zoneId',
            districtId: '$_id.districtId',
            tpId: '$_id.tpId',
            count: 1,
            subjectNameEn: 1,
            subjectNameTa: 1,
            categoryNameEn: 1,
            categoryNameTa: 1,
          },
        },
      ], { maxTimeMS: 6000, allowDiskUse: true })
      .toArray();
    return rows;
  } catch (err) {
    console.warn('[inspectionWorksMongoRepository] dashboard stats aggregate failed:', err);
    return null;
  }
}

/** When scoped geo+date returns nothing, try date window only (still capped). */
export async function fetchLiteInspectionWorksByDateLooseOnly(
  filter: InspectionWorksFilterQuery,
  limit = INSPECTION_WORKS_LITE_MAX_ROWS,
  projection: MongoProjection = LITE_INSPECTION_WORKS_PROJECTION
): Promise<{ rows: any[]; truncated: boolean } | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const and: Record<string, unknown>[] = [];
    appendLooseUtcDatePrefilter(and, filter);
    const match =
      and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
    const cap = limit > 0 ? Math.min(limit, INSPECTION_WORKS_LITE_MAX_ROWS) : INSPECTION_WORKS_LITE_MAX_ROWS;
    const items = await col
      .find(match, { projection })
      .sort({ _id: -1 })
      .limit(cap + 1)
      .toArray();
    const truncated = items.length > cap;
    const slice = truncated ? items.slice(0, cap) : items;
    const rows = slice.map((item: any) => {
      const { _id, ...rest } = item;
      return { id: item.id || item.workId || (_id ? _id.toString() : ''), ...rest };
    });
    return { rows, truncated };
  } catch (err) {
    console.warn('[inspectionWorksMongoRepository] date-loose fetch failed:', err);
    return null;
  }
}

/** Newest rows only — used when strict $match misses (mixed date field formats). */
export async function fetchRecentLiteInspectionWorksCap(
  limit = INSPECTION_WORKS_LITE_MAX_ROWS,
  projection: MongoProjection = LITE_INSPECTION_WORKS_PROJECTION
): Promise<{ rows: any[]; truncated: boolean } | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const cap = limit > 0 ? Math.min(limit, INSPECTION_WORKS_LITE_MAX_ROWS) : INSPECTION_WORKS_LITE_MAX_ROWS;
    const items = await col
      .find({}, { projection })
      .sort({ _id: -1 })
      .limit(cap + 1)
      .toArray();
    const truncated = items.length > cap;
    const slice = truncated ? items.slice(0, cap) : items;
    const rows = slice.map((item: any) => {
      const { _id, ...rest } = item;
      return { id: item.id || item.workId || (_id ? _id.toString() : ''), ...rest };
    });
    return { rows, truncated };
  } catch (err) {
    console.warn('[inspectionWorksMongoRepository] recent cap fetch failed:', err);
    return null;
  }
}

export async function fetchLiteInspectionWorksFromMongoScoped(
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters,
  limit = INSPECTION_WORKS_LITE_MAX_ROWS,
  projection: MongoProjection = LITE_INSPECTION_WORKS_PROJECTION
): Promise<{ rows: any[]; truncated: boolean } | null> {
  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const col = await getCollectionWithAliases(db, 'inspectionWorks');
    const match = buildInspectionWorksMongoMatch(filter, masters);
    const cap = limit > 0 ? Math.min(limit, INSPECTION_WORKS_LITE_MAX_ROWS) : INSPECTION_WORKS_LITE_MAX_ROWS;
    const cursor = col
      .find(match, { projection })
      .sort({ _id: -1 })
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
