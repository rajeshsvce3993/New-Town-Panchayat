'use client';

/** Production reads — use masters/list instead of GET /api/state (full blob). */

import { fetchGeoMasters } from '@/lib/geoMastersClient';

const listInflight = new Map<string, Promise<any>>();

export async function fetchMastersListTotal(collection: string, opts?: { lean?: boolean }): Promise<number> {
  const lean = opts?.lean === true;
  const qs = new URLSearchParams({ collection, page: '1', limit: '1' });
  if (lean) qs.set('lean', '1');
  const res = await fetch(`/api/masters/list?${qs.toString()}`, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!json?.success) return 0;
  return typeof json.total === 'number' ? json.total : Array.isArray(json.items) ? json.items.length : 0;
}

export async function fetchMastersList(
  collection: string,
  opts?: { page?: number; limit?: number; lean?: boolean; tpId?: string; tpNameEn?: string }
): Promise<any[]> {
  const page = opts?.page && opts.page > 0 ? opts.page : 1;
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : 500;
  const lean = opts?.lean === true;
  const key = `${collection}|${page}|${limit}|${lean ? '1' : '0'}|${opts?.tpId || ''}|${opts?.tpNameEn || ''}`;
  const pending = listInflight.get(key);
  if (pending) {
    const json = await pending;
    return json?.success && Array.isArray(json.items) ? json.items : [];
  }
  const qs = new URLSearchParams({
    collection,
    page: String(page),
    limit: String(limit),
  });
  if (lean) qs.set('lean', '1');
  if (opts?.tpId) qs.set('tpId', opts.tpId);
  if (opts?.tpNameEn) qs.set('tpNameEn', opts.tpNameEn);
  const load = fetch(`/api/masters/list?${qs.toString()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .catch(() => ({}))
    .finally(() => listInflight.delete(key));
  listInflight.set(key, load);
  const json = await load;
  return json?.success && Array.isArray(json.items) ? json.items : [];
}

/** Full inspection user directory for saves (avoids partial save wiping Mongo). */
export async function loadAllInspectionUsers(opts?: { lean?: boolean }): Promise<any[]> {
  return fetchAllMastersList('inspectionUsers', {
    pageSize: 1000,
    lean: opts?.lean !== false,
    maxPages: 50,
  });
}

export async function fetchAllMastersList(
  collection: string,
  opts?: { pageSize?: number; lean?: boolean; maxPages?: number },
): Promise<any[]> {
  const pageSize = opts?.pageSize && opts.pageSize > 0 ? opts.pageSize : 1000;
  const maxPages = opts?.maxPages && opts.maxPages > 0 ? opts.maxPages : 20;
  const out: any[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchMastersList(collection, { page, limit: pageSize, lean: opts?.lean });
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

/** Slim bootstrap omits geo — load zones → districts → TPs for admin trees. */
export async function loadPortalGeoMasters(): Promise<{
  zones: any[];
  districts: any[];
  townPanchayats: any[];
}> {
  const zonesRes = await fetchGeoMasters({ level: 'zones' });
  const zones = zonesRes.success ? zonesRes.items || [] : [];
  const districtRes = await Promise.all(
    zones.map((z) => fetchGeoMasters({ level: 'districts', zoneId: String(z.id || '') })),
  );
  const districts = districtRes.flatMap((r) => (r.success ? r.items || [] : []));
  const tpRes = await Promise.all(
    districts.map((d) => fetchGeoMasters({ level: 'townPanchayats', districtId: String(d.id || '') })),
  );
  const townPanchayats = tpRes.flatMap((r) => (r.success ? r.items || [] : []));
  return { zones, districts, townPanchayats };
}

export async function loadPortalZonesOnly(): Promise<any[]> {
  const zonesRes = await fetchGeoMasters({ level: 'zones' });
  return zonesRes.success ? zonesRes.items || [] : [];
}

export async function fetchInspectionUsersForTp(
  tpId: string,
  opts?: { tpNameEn?: string; pageSize?: number; maxPages?: number },
): Promise<any[]> {
  if (!tpId) return [];
  const pageSize = opts?.pageSize && opts.pageSize > 0 ? opts.pageSize : 500;
  const maxPages = opts?.maxPages && opts.maxPages > 0 ? opts.maxPages : 5;
  const out: any[] = [];
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchMastersList('inspectionUsers', {
      page,
      limit: pageSize,
      lean: true,
      tpId,
    });
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < pageSize) break;
  }
  return out;
}

export async function loadPortalEmployeePostMasters(): Promise<Record<string, any[]>> {
  const res = await fetch('/api/masters/employee', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!json?.success || !json.data) return {};
  return json.data;
}

export async function fetchPortalSettings(): Promise<Record<string, unknown> | null> {
  const res = await fetch('/api/state?key=settings', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (json?.success && json.data && typeof json.data === 'object') {
    return json.data as Record<string, unknown>;
  }
  return null;
}