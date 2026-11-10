import { extractCalendarDateYMD, extractInspectionDateMs } from '@/lib/inspectionDate';
import { geoNameKeys, geoNamesEqual, setHasGeoName } from '@/lib/geoNameMatch';

export type InspectionWorksFilterQuery = {
  fromDate?: string | null;
  toDate?: string | null;
  dateParam?: string | null;
  zoneId?: string | null;
  districtId?: string | null;
  tpId?: string | null;
  ward?: string | null;
  username?: string | null;
  subjectId?: string | null;
  categoryId?: string | null;
  street?: string | null;
  search?: string | null;
  adminFieldId?: string | null;
  adminFieldValue?: string | null;
  scopeTpId?: string | null;
  scopeZoneId?: string | null;
  scopeDistrictId?: string | null;
};

export type InspectionWorksFilterMasters = {
  districts?: any[];
  zones?: any[];
  townPanchayats?: any[];
  inspectionSubjects?: any[];
  inspectionCategories?: any[];
  inspectionFields?: any[];
};

export type InspectionWorksViewResult = {
  works: any[];
  categoryCounts: Record<string, number>;
  totalWithoutCategoryFilter: number;
};

function padCode(code: string | undefined | null): string {
  const s = String(code ?? '').replace(/\D/g, '');
  if (!s) return '';
  return s.padStart(2, '0');
}

function workSubmittedYmd(w: any): string | null {
  if (w?.submittedDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(String(w.submittedDateYmd))) {
    return String(w.submittedDateYmd);
  }
  return extractCalendarDateYMD(
    w.submittedAt ||
      w.createdAt ||
      w.date ||
      w.inspectionDate ||
      (w.fieldsData && (w.fieldsData['if_7'] || w.fieldsData['Inspection Date']))
  );
}

export function workMatchesDistrict(w: any, districtId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sDist = String(districtId).toLowerCase();
  if (!(ctx.districts || []).length) {
    const wDistId = String(w.districtId || '').toLowerCase();
    const wDistCode = padCode(w.districtCode).toLowerCase();
    const wDistName = String(w.districtNameEn || w.districtNameTa || '').trim();
    return wDistId === sDist || wDistCode === sDist || geoNamesEqual(wDistName, districtId);
  }
  const dist = (ctx.districts || []).find(
    (d: any) =>
      String(d.id || '').toLowerCase() === sDist ||
      geoNamesEqual(d.nameEn, districtId) ||
      geoNamesEqual(d.nameTa, districtId)
  );
  const distName = String(dist?.nameEn || '').trim();
  const distNameTa = String(dist?.nameTa || '').trim();
  const distCode = padCode(dist?.code).toLowerCase();

  const wDistId = String(w.districtId || '').toLowerCase();
  const wDistCode = padCode(w.districtCode).toLowerCase();
  const wDistName = String(w.districtNameEn || '').trim();
  const wDistNameTa = String(w.districtNameTa || '').trim();

  if (wDistName || wDistNameTa) {
    if (distName && (geoNamesEqual(wDistName, distName) || geoNamesEqual(wDistNameTa, distName))) return true;
    if (distNameTa && (geoNamesEqual(wDistName, distNameTa) || geoNamesEqual(wDistNameTa, distNameTa))) return true;
    if (geoNamesEqual(wDistName, districtId) || geoNamesEqual(wDistNameTa, districtId)) return true;
    return false;
  }
  if (wDistId && (wDistId === sDist || wDistId === String(dist?.id || '').toLowerCase())) return true;
  if (distCode && wDistCode && wDistCode === distCode) return true;
  if (wDistCode && wDistCode === sDist) return true;
  return false;
}

function geoTokenSet(...values: Array<string | undefined | null>): Set<string> {
  return geoNameKeys(...values);
}

function setHasGeo(set: Set<string>, ...values: Array<string | undefined | null>): boolean {
  return setHasGeoName(set, ...values);
}

export function workMatchesZone(w: any, zoneId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sZone = String(zoneId).toLowerCase();
  const zone = (ctx.zones || []).find(
    (z: any) =>
      String(z.id || '').toLowerCase() === sZone ||
      String(z.nameEn || '').trim().toLowerCase() === sZone ||
      String(z.nameTa || '').trim().toLowerCase() === sZone ||
      String(z.code || '').toLowerCase() === sZone
  );
  const selectedIds = geoTokenSet(zoneId, zone?.id, zone?.code);
  const selectedNames = geoTokenSet(zone?.nameEn, zone?.nameTa);
  const selected = geoTokenSet(zoneId, zone?.id, zone?.nameEn, zone?.nameTa, zone?.code);

  const wZoneId = String(w.zoneId || '').trim();
  const wZoneName = String(w.zoneNameEn || w.zone || '').trim();
  const wZoneNameTa = String(w.zoneNameTa || '').trim();
  if (wZoneName || wZoneNameTa) {
    if (selectedNames.size && setHasGeo(selectedNames, wZoneName, wZoneNameTa)) return true;
    if (!selectedNames.size && setHasGeo(selectedIds, wZoneId)) return true;
    // A stored zone name is the source of truth. Do not pull Thiruvallur into Tiruchirappalli via a wrong zoneId.
    if (selectedNames.size) return false;
    return setHasGeo(selectedIds, wZoneName, wZoneNameTa, wZoneId);
  }
  if (wZoneId) {
    return setHasGeo(selectedIds, wZoneId) || setHasGeo(selectedNames, wZoneId);
  }

  const wDistId = String(w.districtId || '').trim();
  const wDistName = String(w.districtNameEn || '').trim();
  if (wDistName) {
    const distByName = (ctx.districts || []).find(
      (d: any) => geoNamesEqual(d.nameEn, wDistName) || geoNamesEqual(d.nameTa, wDistName)
    );
    if (!distByName) return false;
    return setHasGeo(selected, distByName.zoneId, distByName.zoneNameEn, distByName.zoneNameTa);
  }
  if (wDistId) {
    const dist = (ctx.districts || []).find(
      (d: any) => String(d.id || '').toLowerCase() === wDistId.toLowerCase()
    );
    if (!dist) return false;
    return setHasGeo(selected, dist.zoneId, dist.zoneNameEn, dist.zoneNameTa);
  }

  const tp = findWorkTownPanchayat(w, ctx);
  if (tp) {
    if (setHasGeo(selected, tp.zoneId, tp.zoneNameEn, tp.zoneNameTa)) return true;
    const dist = (ctx.districts || []).find(
      (d: any) =>
        (!!tp.districtId && String(d.id || '').toLowerCase() === String(tp.districtId).toLowerCase()) ||
        (!!tp.districtNameEn && geoNamesEqual(d.nameEn, tp.districtNameEn))
    );
    if (dist) return setHasGeo(selected, dist.zoneId, dist.zoneNameEn, dist.zoneNameTa);
  }
  return false;
}

export function findWorkTownPanchayat(w: any, ctx: InspectionWorksFilterMasters): any | undefined {
  const tps = ctx.townPanchayats || [];
  const wTp = String(w.tpId || w.townPanchayatId || '').toLowerCase();
  const wCode = padCode(w.tpCode).toLowerCase();
  const wName = String(w.tpNameEn || w.townPanchayat || '').trim().toLowerCase();

  if (wTp) {
    const byId = tps.find((t: any) => String(t.id || '').toLowerCase() === wTp);
    if (byId) return byId;
  }
  if (wCode) {
    const byCode = tps.find((t: any) => padCode(t.code).toLowerCase() === wCode);
    if (byCode) return byCode;
  }
  if (wName) {
    return tps.find(
      (t: any) =>
        geoNamesEqual(t.nameEn, wName) ||
        geoNamesEqual(t.nameTa, wName)
    );
  }
  return undefined;
}

export function workMatchesTp(w: any, tpId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sTp = String(tpId || '').trim();
  if (!sTp || sTp === 'all') return true;
  const sLower = sTp.toLowerCase();
  const tp = (ctx.townPanchayats || []).find(
    (t: any) =>
      String(t.id || '').toLowerCase() === sLower ||
      String(t.nameEn || '').trim().toLowerCase() === sLower ||
      String(t.nameTa || '').trim().toLowerCase() === sLower
  );
  const tokens = geoTokenSet(sTp, tp?.id, tp?.nameEn, tp?.nameTa);
  const wTp = String(w.tpId || w.townPanchayatId || '').trim();
  const wName = String(w.tpNameEn || w.townPanchayat || '').trim();
  const wNameTa = String(w.tpNameTa || '').trim();

  if (wName || wNameTa) return setHasGeo(tokens, wName, wNameTa);
  if (wTp) return setHasGeo(tokens, wTp);
  return false;
}

function geoEq(a?: string | null, b?: string | null): boolean {
  const x = String(a || '').trim();
  const y = String(b || '').trim();
  if (!x || !y) return false;
  if (x.toLowerCase() === y.toLowerCase()) return true;
  return geoNamesEqual(x, y);
}

/** Exact id/name match only — never infer another town panchayat, district, or zone. */
export function rowMatchesRemoteGeoSelection(
  row: any,
  sel: {
    zoneId?: string | null;
    zoneNameEn?: string | null;
    districtId?: string | null;
    districtNameEn?: string | null;
    tpId?: string | null;
    tpNameEn?: string | null;
  }
): boolean {
  if (sel.tpId || sel.tpNameEn) {
    const id = row?.tpId || row?.townPanchayatId || '';
    const name = row?.tpNameEn || row?.townPanchayat || '';
    if (!(geoEq(id, sel.tpId) || geoEq(name, sel.tpNameEn) || geoEq(name, sel.tpId))) return false;
  }
  if (sel.districtId || sel.districtNameEn) {
    const id = row?.districtId || '';
    const name = row?.districtNameEn || '';
    if (!(geoEq(id, sel.districtId) || geoEq(name, sel.districtNameEn) || geoEq(name, sel.districtId))) return false;
  }
  if (sel.zoneId || sel.zoneNameEn) {
    const id = row?.zoneId || '';
    const name = row?.zoneNameEn || row?.zone || '';
    if (!(geoEq(id, sel.zoneId) || geoEq(name, sel.zoneNameEn) || geoEq(name, sel.zoneId))) return false;
  }
  return true;
}

function workMatchesWard(w: any, ward: string): boolean {
  const normSel = String(ward || '').trim().replace(/^0+/, '') || '0';
  const normWork = String(w.wardNumber || w.wardNo || w.ward || '')
    .trim()
    .replace(/^0+/, '') || '0';
  return normWork === normSel;
}

function workMatchesUsername(w: any, username: string): boolean {
  const uLower = String(username).toLowerCase();
  const u = String(w.submittedByUserName || w.username || w.submittedByUserId || '').toLowerCase();
  const wid = String(w.workId || '').toLowerCase();
  return u === uLower || u.includes(uLower) || wid.includes(`-${uLower}-`);
}

export function isFallbackInspectionWork(w: any): boolean {
  const sName = String(w.subjectNameEn || '').trim().toLowerCase();
  const cName = String(w.categoryNameEn || '').trim().toLowerCase();
  const sNameTa = String(w.subjectNameTa || '').trim();
  const cNameTa = String(w.categoryNameTa || '').trim();
  const sId = String(w.subjectId || '').trim().toLowerCase();
  const cId = String(w.categoryId || '').trim().toLowerCase();
  return (
    sName === 'general inspection' ||
    sName === 'general' ||
    sName.includes('fallback') ||
    cName === 'field check' ||
    cName === 'general category' ||
    cName === 'general inspection' ||
    cName.includes('fallback') ||
    sNameTa === 'பொது ஆய்வு' ||
    cNameTa === 'கள ஆய்வு' ||
    cNameTa === 'பொது வகை' ||
    sId === 'subj_general' ||
    sId === 'general_inspection' ||
    cId === 'cat_field_check' ||
    cId === 'cat_general' ||
    cId === 'field_check'
  );
}

export type DashboardStatsScope = {
  unrestricted?: boolean;
  tpId?: string | null;
  districtId?: string | null;
  zoneId?: string | null;
};

/** Bootstrap dashboard stats rows → user scope (same rules as dashboard abstract). */
export function filterDashboardStatsForScope(
  stats: any[],
  masters: InspectionWorksFilterMasters,
  scope: DashboardStatsScope
): any[] {
  const rowMatches = (row: any) => {
    if (scope.unrestricted) return true;
    if (scope.tpId) return workMatchesTp(row, scope.tpId, masters);
    if (scope.districtId) return workMatchesDistrict(row, scope.districtId, masters);
    if (scope.zoneId) return workMatchesZone(row, scope.zoneId, masters);
    return true;
  };
  return (stats || []).filter((row) => !isFallbackInspectionWork(row) && rowMatches(row));
}

export function dashboardStatsIncludeCategories(stats: any[]): boolean {
  return (stats || []).some((row) => {
    const c = String(row.categoryId || '').trim();
    return c && c !== '_unknown';
  });
}

export function buildSubjectCategoryRollupsFromDashboardStats(
  stats: any[]
): Array<{ subjectId: string; categoryId: string; count: number }> {
  const merged = new Map<string, { subjectId: string; categoryId: string; count: number }>();
  for (const row of stats || []) {
    if (isFallbackInspectionWork(row)) continue;
    const subjectId = String(row.subjectId || 'unknown').trim();
    const categoryId = String(row.categoryId || '_unknown').trim();
    const key = `${subjectId}|${categoryId}`;
    const add = Number(row.count ?? 1);
    const cur = merged.get(key) || { subjectId, categoryId, count: 0 };
    cur.count += add;
    merged.set(key, cur);
  }
  return [...merged.values()];
}

export function categoryCountsFromSubjectRollups(
  rollups: Array<{ subjectId: string; categoryId: string; count: number }>,
  categories: any[] = []
): Record<string, number> {
  const pseudo = rollups.map((r) => ({ categoryId: r.categoryId, categoryNameEn: '' }));
  return computeCategoryCounts(pseudo, categories);
}

export function workMatchesSubject(w: any, subjectId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sSubj = String(subjectId).toLowerCase();
  const matchedSubject = (ctx.inspectionSubjects || []).find(
    (s: any) =>
      String(s.id || '').toLowerCase() === sSubj ||
      String(s.code || '').toLowerCase() === sSubj ||
      String(s.nameEn || '').toLowerCase() === sSubj
  );
  const subjId = matchedSubject ? String(matchedSubject.id).toLowerCase() : sSubj;
  const subjCode = matchedSubject?.code ? String(matchedSubject.code).toLowerCase() : '';
  const subjName = matchedSubject ? String(matchedSubject.nameEn || '').toLowerCase() : sSubj;
  const subjNameTa = matchedSubject ? String(matchedSubject.nameTa || '').toLowerCase() : '';

  const wSubj = String(w.subjectId || '').toLowerCase();
  const wSubjName = String(w.subjectNameEn || '').toLowerCase();
  const wSubjNameTa = String(w.subjectNameTa || '').toLowerCase();

  return (
    wSubj === subjId ||
    (subjCode && wSubj === subjCode) ||
    wSubjName === subjName ||
    (subjNameTa && wSubjNameTa === subjNameTa) ||
    wSubj === sSubj ||
    wSubjName === sSubj
  );
}

export type InspectionWorkReportDimensionRollup = {
  zoneId: string;
  districtId: string;
  tpId: string;
  zoneNameEn?: string;
  districtNameEn?: string;
  tpNameEn?: string;
  streetName?: string;
  wardNumber: string;
  submittedByUserName: string;
  subjectId: string;
  categoryId: string;
  count: number;
};

export function filterSubjectCategoryRollupsForQuery<
  T extends { subjectId?: string; categoryId?: string; count?: number },
>(rows: T[], filter: InspectionWorksFilterQuery, masters: InspectionWorksFilterMasters): T[] {
  let list = rows || [];
  if (filter.subjectId) {
    list = list.filter((r) => workMatchesSubject({ subjectId: r.subjectId }, String(filter.subjectId), masters));
  }
  if (filter.categoryId) {
    list = list.filter((r) => workMatchesCategory({ categoryId: r.categoryId }, String(filter.categoryId), masters));
  }
  return list;
}

/** Same total Abstract uses: rollup rows after subject/category matching. */
export function sumSubjectCategoryRollupsForFilter(
  rows: Array<{ subjectId?: string; categoryId?: string; count?: number }>,
  filter: InspectionWorksFilterQuery,
  masters: InspectionWorksFilterMasters
): number {
  return filterSubjectCategoryRollupsForQuery(rows, filter, masters).reduce(
    (sum, row) => sum + (Number(row.count) || 0),
    0
  );
}

export function collapseDimensionRollupsToSubjectCategory(
  rows: InspectionWorkReportDimensionRollup[]
): Array<{ subjectId: string; categoryId: string; count: number }> {
  const map = new Map<string, { subjectId: string; categoryId: string; count: number }>();
  for (const row of rows || []) {
    const subjectId = String(row.subjectId || 'unknown');
    const categoryId = String(row.categoryId || '_unknown');
    const key = `${subjectId}\0${categoryId}`;
    const prev = map.get(key);
    const n = Number(row.count) || 0;
    if (prev) prev.count += n;
    else map.set(key, { subjectId, categoryId, count: n });
  }
  return [...map.values()];
}

export function workMatchesCategory(w: any, categoryId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sCat = String(categoryId).trim().toLowerCase();
  const matchedCategory = (ctx.inspectionCategories || []).find(
    (c: any) =>
      String(c.id || '').trim().toLowerCase() === sCat ||
      String(c.nameEn || '').trim().toLowerCase() === sCat ||
      String(c.code || '').trim().toLowerCase() === sCat ||
      String(c.nameTa || '').trim().toLowerCase() === sCat
  );
  const catId = matchedCategory ? String(matchedCategory.id).trim().toLowerCase() : sCat;
  const catName = matchedCategory ? String(matchedCategory.nameEn || '').trim().toLowerCase() : sCat;
  const catCode = matchedCategory?.code ? String(matchedCategory.code).trim().toLowerCase() : '';
  const catNameTa = matchedCategory ? String(matchedCategory.nameTa || '').trim().toLowerCase() : '';

  const wCat = String(w.categoryId || '').trim().toLowerCase();
  const wCatName = String(w.categoryNameEn || '').trim().toLowerCase();
  const wCatNameTa = String(w.categoryNameTa || '').trim().toLowerCase();

  return (
    wCat === catId ||
    (catCode && wCat === catCode) ||
    wCatName === catName ||
    (catNameTa && wCatNameTa === catNameTa) ||
    wCat === sCat ||
    wCatName === sCat
  );
}

function workMatchesStreet(w: any, street: string): boolean {
  const sStreet = String(street).trim().toLowerCase();
  const wStreet = String(w.streetName || '').trim().toLowerCase();
  return wStreet === sStreet || wStreet.includes(sStreet) || sStreet.includes(wStreet);
}

function workMatchesSearch(w: any, search: string): boolean {
  const q = search.toLowerCase().trim();
  if (!q) return true;
  const matchId = (w.workId || '').toLowerCase().includes(q);
  const matchStreet = (w.streetName || '').toLowerCase().includes(q);
  const matchInspector = (w.submittedByUserName || '').toLowerCase().includes(q);
  const matchCaption = (w.imageCaption || '').toLowerCase().includes(q);
  const matchSubj =
    (w.subjectNameEn || '').toLowerCase().includes(q) || (w.subjectNameTa || '').toLowerCase().includes(q);
  return matchId || matchStreet || matchInspector || matchCaption || matchSubj;
}

export function getWorkDynamicFieldValue(
  work: any,
  fieldOrId: string | any,
  fields: any[] = []
): string {
  const fd = work?.fieldsData;
  if (!fd || typeof fd !== 'object') return '';

  const field =
    typeof fieldOrId === 'string'
      ? fields.find(
          (f: any) =>
            String(f.id || '') === fieldOrId ||
            String(f.fieldKey || '') === fieldOrId ||
            String(f.code || '') === fieldOrId
        )
      : fieldOrId;

  const keys = new Set<string>();
  const addKey = (k: string | undefined | null) => {
    const s = String(k || '').trim();
    if (s) keys.add(s);
  };

  if (typeof fieldOrId === 'string') addKey(fieldOrId);
  if (field) {
    addKey(field.id);
    addKey(field.fieldKey);
    addKey(field.fieldName);
    addKey(field.nameEn);
    addKey(field.nameTa);
    addKey(field.code);
  }

  for (const k of keys) {
    const v = fd[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      return String(v);
    }
  }

  const keysLower = new Map<string, string>();
  for (const [k, v] of Object.entries(fd)) {
    if (v === undefined || v === null) continue;
    keysLower.set(String(k).toLowerCase(), String(v));
  }
  for (const k of keys) {
    const hit = keysLower.get(k.toLowerCase());
    if (hit !== undefined && hit.trim() !== '') return hit;
  }
  return '';
}

/** Search tokens for a dynamic-field filter (Yes/No options, typed phone numbers, dropdown labels). */
export function adminFieldValueNeedles(value: string | null | undefined): string[] {
  const q = String(value || '').trim();
  if (!q) return [];
  const out = new Set<string>([q]);
  const compact = q.toLowerCase().replace(/[()[\],]/g, ' ').replace(/\s+/g, ' ').trim();
  const tokens = compact.split(' ');
  const hasYes = tokens.includes('yes') || compact.includes('ஆம்');
  const hasNo = tokens.includes('no') || compact.includes('இல்லை');
  if (hasYes && !hasNo) {
    out.add('yes');
    out.add('ஆம்');
  } else if (hasNo && !hasYes) {
    out.add('no');
    out.add('இல்லை');
  }
  const digits = q.replace(/\D/g, '');
  if (digits.length >= 8) out.add(digits);
  return [...out];
}

export function storedValueMatchesAdminFilter(stored: string, queryValue: string): boolean {
  const vStr = String(stored || '').toLowerCase().trim();
  if (!vStr) return false;
  const vDigits = vStr.replace(/\D/g, '');
  for (const n of adminFieldValueNeedles(queryValue)) {
    const nl = n.toLowerCase();
    if (vStr.includes(nl)) return true;
    if (/^\d{8,}$/.test(n) && vDigits.includes(n)) return true;
  }
  return false;
}

function workMatchesAdminField(
  w: any,
  adminFieldId: string,
  adminFieldValue: string | null | undefined,
  ctx: InspectionWorksFilterMasters
): boolean {
  const val = getWorkDynamicFieldValue(w, adminFieldId, ctx.inspectionFields || []);
  if (adminFieldValue) {
    return storedValueMatchesAdminFilter(val, adminFieldValue);
  }
  return !!val && val.trim() !== '';
}

export function workMatchesUserScope(w: any, query: InspectionWorksFilterQuery, ctx: InspectionWorksFilterMasters): boolean {
  const { scopeTpId, scopeZoneId, scopeDistrictId } = query;
  if (scopeTpId) {
    if ((ctx.townPanchayats || []).length > 0) {
      if (workMatchesTp(w, scopeTpId, ctx)) return true;
      const scopedTp = (ctx.townPanchayats || []).find(
        (t: any) =>
          String(t.id || '').toLowerCase() === String(scopeTpId).toLowerCase() ||
          String(t.nameEn || '').trim().toLowerCase() === String(scopeTpId).toLowerCase()
      );
      if (scopedTp?.nameEn && workMatchesTp(w, scopedTp.nameEn, ctx)) return true;
      return false;
    }
  } else if (scopeZoneId) {
    const uZone = String(scopeZoneId).toLowerCase();
    const zones = ctx.zones || [];
    if (zones.length === 0) {
      const wZoneName = String(w.zoneNameEn || w.zone || '').toLowerCase();
      if (wZoneName && wZoneName !== uZone && !wZoneName.includes(uZone) && !uZone.includes(wZoneName)) {
        return false;
      }
    } else if (!workMatchesZone(w, scopeZoneId, ctx)) {
      return false;
    }
  } else if (scopeDistrictId) {
    if (!workMatchesDistrict(w, scopeDistrictId, ctx)) return false;
  }
  return true;
}

function bumpCount(counts: Record<string, number>, key: string, n = 1) {
  const k = String(key || '').trim();
  if (!k) return;
  counts[k] = (counts[k] || 0) + n;
}

export function computeCategoryCounts(works: any[], categories: any[] = []): Record<string, number> {
  const counts: Record<string, number> = {};
  const byId = new Map<string, any>();
  const byCode = new Map<string, any>();
  const byNameEn = new Map<string, any>();
  for (const c of categories) {
    const cId = String(c.id || '').trim();
    const cCode = String(c.code || '').trim().toLowerCase();
    const cName = String(c.nameEn || '').trim().toLowerCase();
    if (cId) byId.set(cId, c);
    if (cCode) byCode.set(cCode, c);
    if (cName) byNameEn.set(cName, c);
  }

  for (const w of works) {
    let catId = String(w.categoryId || '').trim();
    const wName = String(w.categoryNameEn || '').trim().toLowerCase();
    const cat =
      (catId && (byId.get(catId) || byCode.get(catId.toLowerCase()))) ||
      (wName && byNameEn.get(wName)) ||
      undefined;
    if (cat) {
      catId = String(cat.id || catId).trim();
      bumpCount(counts, catId);
      if (cat.code) bumpCount(counts, String(cat.code));
      if (cat.nameEn) bumpCount(counts, String(cat.nameEn).trim().toLowerCase());
    } else if (catId) {
      bumpCount(counts, catId);
    } else if (wName) {
      bumpCount(counts, wName);
    } else {
      bumpCount(counts, '_unknown');
    }
  }
  return counts;
}

export function filterInspectionWorksByQuery(
  works: any[],
  query: InspectionWorksFilterQuery,
  ctx: InspectionWorksFilterMasters = {}
): any[] {
  let list = Array.isArray(works) ? works : [];
  const {
    fromDate,
    toDate,
    dateParam,
    zoneId,
    districtId,
    tpId,
    ward,
    username,
    subjectId,
    categoryId,
    street,
    search,
    adminFieldId,
    adminFieldValue,
  } = query;

  list = list.filter((w) => !isFallbackInspectionWork(w));
  list = list.filter((w) => workMatchesUserScope(w, query, ctx));

  if (fromDate || toDate) {
    list = list.filter((w) => {
      const itemYmd = workSubmittedYmd(w);
      if (!itemYmd) return true;
      if (fromDate && itemYmd < fromDate) return false;
      if (toDate && itemYmd > toDate) return false;
      return true;
    });
  } else if (dateParam) {
    const targetYmd = extractCalendarDateYMD(dateParam) || dateParam;
    list = list.filter((w) => {
      const itemYmd = workSubmittedYmd(w);
      if (itemYmd) return itemYmd === targetYmd;
      const itemDate = String(w.submittedAt || w.createdAt || w.date || '');
      return itemDate.includes(targetYmd) || itemDate.includes(dateParam);
    });
  }

  if (districtId) {
    list = list.filter((w) => workMatchesDistrict(w, districtId, ctx));
  }
  if (zoneId) {
    list = list.filter((w) => workMatchesZone(w, zoneId, ctx));
  }
  if (tpId) {
    list = list.filter((w) => workMatchesTp(w, tpId, ctx));
  }
  if (ward) {
    list = list.filter((w) => workMatchesWard(w, ward));
  }
  if (username) {
    list = list.filter((w) => workMatchesUsername(w, username));
  }
  if (subjectId) {
    list = list.filter((w) => workMatchesSubject(w, subjectId, ctx));
  }
  if (categoryId) {
    list = list.filter((w) => workMatchesCategory(w, categoryId, ctx));
  }
  if (street) {
    list = list.filter((w) => workMatchesStreet(w, street));
  }
  if (search) {
    list = list.filter((w) => workMatchesSearch(w, search));
  }
  if (adminFieldId) {
    list = list.filter((w) => workMatchesAdminField(w, adminFieldId, adminFieldValue, ctx));
  }

  return list;
}

/** After Mongo $match: only filters Mongo cannot apply reliably (IST dates, text search, admin fields). */
export function filterInspectionWorksPostMongo(
  works: any[],
  query: InspectionWorksFilterQuery,
  ctx: InspectionWorksFilterMasters = {}
): any[] {
  let list = (Array.isArray(works) ? works : []).filter((w) => !isFallbackInspectionWork(w));
  const { fromDate, toDate, dateParam, street, search, adminFieldId, adminFieldValue, categoryId } = query;

  if (fromDate || toDate) {
    list = list.filter((w) => {
      const itemYmd = workSubmittedYmd(w);
      if (!itemYmd) return false;
      if (fromDate && itemYmd < fromDate) return false;
      if (toDate && itemYmd > toDate) return false;
      return true;
    });
  } else if (dateParam) {
    const targetYmd = extractCalendarDateYMD(dateParam) || dateParam;
    list = list.filter((w) => {
      const itemYmd = workSubmittedYmd(w);
      if (itemYmd) return itemYmd === targetYmd;
      const itemDate = String(w.submittedAt || w.createdAt || w.date || '');
      return itemDate.includes(targetYmd) || itemDate.includes(dateParam);
    });
  }

  if (categoryId) {
    list = list.filter((w) => workMatchesCategory(w, categoryId, ctx));
  }
  if (street) {
    list = list.filter((w) => workMatchesStreet(w, street));
  }
  if (search) {
    list = list.filter((w) => workMatchesSearch(w, search));
  }
  if (adminFieldId) {
    list = list.filter((w) => workMatchesAdminField(w, adminFieldId, adminFieldValue, ctx));
  }
  return list;
}

export function buildInspectionWorksViewResponse(
  rawWorks: any[],
  query: InspectionWorksFilterQuery,
  ctx: InspectionWorksFilterMasters,
  options?: {
    limit?: number;
    lite?: boolean;
    mongoPrefiltered?: boolean;
    countsOnly?: boolean;
    rowsOnly?: boolean;
  }
): InspectionWorksViewResult {
  const baseList = (Array.isArray(rawWorks) ? rawWorks : []).filter((w) => !isFallbackInspectionWork(w));

  let withoutCategory: any[];
  let works: any[] = [];

  if (options?.countsOnly) {
    const queryWithoutCategory: InspectionWorksFilterQuery = { ...query, categoryId: null };
    withoutCategory = options.mongoPrefiltered
      ? filterInspectionWorksPostMongo(baseList, queryWithoutCategory, ctx)
      : filterInspectionWorksByQuery(baseList, queryWithoutCategory, ctx);
  } else if (options?.mongoPrefiltered) {
    const queryWithoutCategory: InspectionWorksFilterQuery = { ...query, categoryId: null };
    withoutCategory = filterInspectionWorksPostMongo(baseList, queryWithoutCategory, ctx);
    works = query.categoryId
      ? filterInspectionWorksPostMongo(baseList, query, ctx)
      : withoutCategory;
  } else {
    const queryWithoutCategory: InspectionWorksFilterQuery = { ...query, categoryId: null };
    withoutCategory = filterInspectionWorksByQuery(baseList, queryWithoutCategory, ctx);
    works = query.categoryId
      ? filterInspectionWorksByQuery(baseList, query, ctx)
      : withoutCategory;
    works = sortInspectionWorksNewestFirst(works);
  }

  const categoryCounts = options?.rowsOnly
    ? {}
    : computeCategoryCounts(withoutCategory, ctx.inspectionCategories || []);

  if (!options?.countsOnly) {
    const limit = options?.limit && options.limit > 0 ? options.limit : 0;
    if (limit > 0 && works.length > limit) {
      works = works.slice(0, limit);
    }
    if (options?.lite) {
      works = works.map(stripInspectionWorkForLite);
    }
  }

  return {
    works: options?.countsOnly ? [] : works,
    categoryCounts,
    totalWithoutCategoryFilter: withoutCategory.length,
  };
}

export function sortInspectionWorksNewestFirst(works: any[]): any[] {
  return [...works].sort((a, b) => {
    const idA = String(a._id || '');
    const idB = String(b._id || '');
    if (idA && idB && idA !== idB) return idB.localeCompare(idA);
    const ta = extractInspectionDateMs(a.submittedAt || a.createdAt || a.date || a.inspectionDate);
    const tb = extractInspectionDateMs(b.submittedAt || b.createdAt || b.date || b.inspectionDate);
    if (ta !== tb) return tb - ta;
    return String(b.workId || b.id || '').localeCompare(String(a.workId || a.id || ''));
  });
}

export function stripInspectionWorkForLite(w: any): any {
  const {
    photos,
    documents,
    photoBase64,
    locationImage,
    staticMapUrl,
    mapImage,
    _id,
    ...rest
  } = w;
  return rest;
}

export function extractWorksFromInspectionApiPayload(json: any): any[] {
  if (!json || typeof json !== 'object') return [];
  if (Array.isArray(json.works)) return json.works;
  if (Array.isArray(json.data)) return json.data;
  if (json.data && Array.isArray(json.data.works)) return json.data.works;
  return [];
}
