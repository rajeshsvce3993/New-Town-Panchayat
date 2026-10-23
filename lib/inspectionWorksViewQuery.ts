import type { NextRequest } from 'next/server';
import type { InspectionWorksFilterQuery } from '@/lib/inspectionWorksQueryFilters';

/** Parse GET query params for inspection works list / reports view. */
export function parseInspectionWorksViewQuery(searchParams: URLSearchParams) {
  const pick = (key: string) => {
    const v = searchParams.get(key);
    return v && v !== 'all' ? v : null;
  };
  return {
    dateParam: searchParams.get('date'),
    fromDate: searchParams.get('fromDate'),
    toDate: searchParams.get('toDate'),
    zoneId: pick('zoneId'),
    districtId: pick('districtId'),
    tpId: pick('tpId'),
    ward: pick('ward'),
    username: pick('username'),
    subjectId: pick('subjectId'),
    categoryId: pick('categoryId'),
    street: pick('street') || pick('streetName'),
    search: pick('q') || pick('search'),
    adminFieldId: pick('adminFieldId'),
    adminFieldValue: searchParams.get('adminFieldValue'),
    scopeTpId: pick('scopeTpId'),
    scopeZoneId: pick('scopeZoneId'),
    scopeDistrictId: pick('scopeDistrictId'),
    lite: searchParams.get('lite') === '1',
    countsOnly: searchParams.get('countsOnly') === '1',
    rowsOnly: searchParams.get('rowsOnly') === '1',
    limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 0,
    page: searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1,
    pageSize: searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!, 10) : 50,
    allTime: searchParams.get('allTime') === '1',
    reportsBundle: searchParams.get('reportsBundle') === '1',
  };
}

export function buildInspectionWorksCacheKey(searchParams: URLSearchParams): string {
  const q = parseInspectionWorksViewQuery(searchParams);
  return [
    q.dateParam || '',
    q.fromDate || '',
    q.toDate || '',
    q.zoneId || '',
    q.districtId || '',
    q.tpId || '',
    q.ward || '',
    q.username || '',
    q.subjectId || '',
    q.categoryId || '',
    q.street || '',
    q.search || '',
    q.adminFieldId || '',
    q.adminFieldValue || '',
    q.scopeTpId || '',
    q.scopeZoneId || '',
    q.scopeDistrictId || '',
    q.lite ? 'lite' : 'full',
    q.countsOnly ? 'counts' : q.rowsOnly ? 'rows-only' : 'rows',
    q.limit || '',
    q.page || '',
    q.pageSize || '',
    q.allTime ? 'all' : '',
    q.reportsBundle ? 'bundle' : '',
  ].join('|');
}

/** Remote production API ignores most filters — fetch with a stable minimal query. */
export function remoteInspectionWorksFetchQuery(_req: NextRequest): string {
  return 'lite=1';
}

export function toInspectionWorksFilterQuery(
  v: ReturnType<typeof parseInspectionWorksViewQuery>
): InspectionWorksFilterQuery {
  return {
    dateParam: v.dateParam,
    fromDate: v.fromDate,
    toDate: v.toDate,
    zoneId: v.zoneId,
    districtId: v.districtId,
    tpId: v.tpId,
    ward: v.ward,
    username: v.username,
    subjectId: v.subjectId,
    categoryId: v.categoryId,
    street: v.street,
    search: v.search,
    adminFieldId: v.adminFieldId,
    adminFieldValue: v.adminFieldValue,
    scopeTpId: v.scopeTpId,
    scopeZoneId: v.scopeZoneId,
    scopeDistrictId: v.scopeDistrictId,
  };
}
