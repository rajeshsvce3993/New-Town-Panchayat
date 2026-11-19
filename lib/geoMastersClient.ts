export type GeoLevel = 'zones' | 'districts' | 'townPanchayats' | 'wards';

export type GeoFetchResult = {
  success: boolean;
  level?: GeoLevel;
  items?: any[];
  total?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  message?: string;
};

export async function fetchGeoMasters(opts: {
  level: GeoLevel;
  zoneId?: string;
  districtId?: string;
  tpId?: string;
  page?: number;
  limit?: number;
}): Promise<GeoFetchResult> {
  const params = new URLSearchParams();
  params.set('level', opts.level);
  if (opts.zoneId) params.set('zoneId', opts.zoneId);
  if (opts.districtId) params.set('districtId', opts.districtId);
  if (opts.tpId) params.set('tpId', opts.tpId);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));

  const res = await fetch(`/api/masters/geo?${params.toString()}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    return { success: false, message: json.message || res.statusText, items: [] };
  }
  return {
    success: true,
    level: json.level,
    items: json.items || [],
    total: json.total,
    page: json.page,
    limit: json.limit,
    hasMore: json.hasMore,
  };
}