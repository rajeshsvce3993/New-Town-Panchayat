import { extractCalendarDateYMD } from '@/lib/inspectionDate';

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
    const wDistName = String(w.districtNameEn || '').trim().toLowerCase();
    return wDistId === sDist || wDistCode === sDist || wDistName === sDist;
  }
  const dist = (ctx.districts || []).find((d: any) => String(d.id || '').toLowerCase() === sDist);
  const distName = String(dist?.nameEn || '').trim().toLowerCase();
  const distCode = padCode(dist?.code).toLowerCase();

  const wDistId = String(w.districtId || '').toLowerCase();
  const wDistCode = padCode(w.districtCode).toLowerCase();
  const wDistName = String(w.districtNameEn || '').trim().toLowerCase();

  if (wDistId && wDistId === sDist) return true;
  if (distCode && wDistCode && wDistCode === distCode) return true;
  if (distName && wDistName && wDistName === distName) return true;
  if (wDistCode && wDistCode === sDist) return true;
  if (wDistName && wDistName === sDist) return true;
  return false;
}

export function workMatchesZone(w: any, zoneId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sZone = String(zoneId).toLowerCase();
  if (!(ctx.zones || []).length && !(ctx.districts || []).length && !(ctx.townPanchayats || []).length) {
    const wZoneId = String(w.zoneId || '').toLowerCase();
    const wZoneName = String(w.zoneNameEn || w.zone || '').trim().toLowerCase();
    return wZoneId === sZone || wZoneName === sZone;
  }
  const zone = (ctx.zones || []).find((z: any) => String(z.id || '').toLowerCase() === sZone);
  const zoneName = String(zone?.nameEn || '').trim().toLowerCase();

  let wZoneId = String(w.zoneId || '').toLowerCase();
  let wZoneName = String(w.zoneNameEn || w.zone || '').trim().toLowerCase();

  if (!wZoneId && (ctx.townPanchayats?.length || ctx.districts?.length)) {
    const tp = findWorkTownPanchayat(w, ctx);
    if (tp?.districtId) {
      const dist = (ctx.districts || []).find(
        (d: any) => String(d.id || '').toLowerCase() === String(tp.districtId).toLowerCase()
      );
      if (dist?.zoneId) wZoneId = String(dist.zoneId).toLowerCase();
      else if (dist?.zoneNameEn) wZoneName = String(dist.zoneNameEn).toLowerCase();
    }
  }

  if (wZoneId && wZoneId === sZone) return true;
  if (zoneName && wZoneName && wZoneName === zoneName) return true;
  if (wZoneName && wZoneName === sZone) return true;
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
    return tps.find((t: any) => String(t.nameEn || '').trim().toLowerCase() === wName);
  }
  return undefined;
}

export function workMatchesTp(w: any, tpId: string, ctx: InspectionWorksFilterMasters): boolean {
  const sTp = String(tpId).toLowerCase();
  if (!(ctx.townPanchayats || []).length) {
    const wTp = String(w.tpId || w.townPanchayatId || '').toLowerCase();
    const wCode = padCode(w.tpCode).toLowerCase();
    const wName = String(w.tpNameEn || w.townPanchayat || '').trim().toLowerCase();
    return wTp === sTp || wCode === sTp || wName === sTp;
  }
  const tp = (ctx.townPanchayats || []).find((t: any) => String(t.id || '').toLowerCase() === sTp);
  const tpName = String(tp?.nameEn || '').trim().toLowerCase();
  const tpCode = padCode(tp?.code).toLowerCase();

  const wTp = String(w.tpId || w.townPanchayatId || '').toLowerCase();
  const wCode = padCode(w.tpCode).toLowerCase();
  const wName = String(w.tpNameEn || w.townPanchayat || '').trim().toLowerCase();

  if (wTp && wTp === sTp) return true;
  if (tpCode && wCode && wCode === tpCode) return true;
  if (tpName && wName && wName === tpName) return true;
  if (wCode && wCode === sTp) return true;
  if (wName && (wName === sTp || (tpName && (wName.includes(tpName) || tpName.includes(wName))))) return true;
  return false;
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

function workMatchesAdminField(
  w: any,
  adminFieldId: string,
  adminFieldValue: string | null | undefined,
  ctx: InspectionWorksFilterMasters
): boolean {
  const matchedField = (ctx.inspectionFields || []).find((f: any) => f.id === adminFieldId);
  const fieldName = matchedField?.fieldName || matchedField?.nameEn || '';
  const val = w.fieldsData?.[adminFieldId] ?? w.fieldsData?.[fieldName] ?? '';
  if (adminFieldValue) {
    const q = adminFieldValue.toLowerCase().trim();
    const vStr = String(val).toLowerCase().trim();
    if (q === 'yes' || q === 'ஆம்') return vStr === 'yes' || vStr === 'ஆம்';
    if (q === 'no' || q === 'இல்லை') return vStr === 'no' || vStr === 'இல்லை';
    return vStr.includes(q);
  }
  return !!val;
}

export function workMatchesUserScope(w: any, query: InspectionWorksFilterQuery, ctx: InspectionWorksFilterMasters): boolean {
  const { scopeTpId, scopeZoneId, scopeDistrictId } = query;
  if (scopeTpId) {
    if ((ctx.townPanchayats || []).length > 0 && !workMatchesTp(w, scopeTpId, ctx)) return false;
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

export function computeCategoryCounts(works: any[], categories: any[] = []): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const w of works) {
    let key = String(w.categoryId || '').trim();
    if (!key) {
      const wName = String(w.categoryNameEn || '').trim().toLowerCase();
      const cat = categories.find((c: any) => String(c.nameEn || '').trim().toLowerCase() === wName);
      key = cat?.id ? String(cat.id) : wName || '_unknown';
    }
    counts[key] = (counts[key] || 0) + 1;
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

export function buildInspectionWorksViewResponse(
  rawWorks: any[],
  query: InspectionWorksFilterQuery,
  ctx: InspectionWorksFilterMasters,
  options?: { limit?: number; lite?: boolean }
): InspectionWorksViewResult {
  const baseList = (Array.isArray(rawWorks) ? rawWorks : []).filter((w) => !isFallbackInspectionWork(w));
  const queryWithoutCategory: InspectionWorksFilterQuery = { ...query, categoryId: null };
  const withoutCategory = filterInspectionWorksByQuery(baseList, queryWithoutCategory, ctx);
  const categoryCounts = computeCategoryCounts(withoutCategory, ctx.inspectionCategories || []);

  let works = query.categoryId
    ? filterInspectionWorksByQuery(baseList, query, ctx)
    : withoutCategory;

  works = sortInspectionWorksNewestFirst(works);

  const limit = options?.limit && options.limit > 0 ? options.limit : 0;
  if (limit > 0 && works.length > limit) {
    works = works.slice(0, limit);
  }

  if (options?.lite) {
    works = works.map(stripInspectionWorkForLite);
  }

  return {
    works,
    categoryCounts,
    totalWithoutCategoryFilter: withoutCategory.length,
  };
}

export function sortInspectionWorksNewestFirst(works: any[]): any[] {
  return [...works].sort((a, b) => {
    const ta = workSubmittedYmd(a) || '';
    const tb = workSubmittedYmd(b) || '';
    if (ta !== tb) return tb.localeCompare(ta);
    return String(b.workId || b.id || '').localeCompare(String(a.workId || a.id || ''));
  });
}

export function stripInspectionWorkForLite(w: any): any {
  const {
    fieldsData,
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
