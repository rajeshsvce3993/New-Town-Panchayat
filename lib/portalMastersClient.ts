'use client';

/** Production reads — use masters/list instead of GET /api/state (full blob). */

const listInflight = new Map<string, Promise<any>>();

export async function fetchMastersList(
  collection: string,
  opts?: { page?: number; limit?: number; lean?: boolean }
): Promise<any[]> {
  const page = opts?.page && opts.page > 0 ? opts.page : 1;
  const limit = opts?.limit && opts.limit > 0 ? opts.limit : 500;
  const lean = opts?.lean === true;
  const key = `${collection}|${page}|${limit}|${lean ? '1' : '0'}`;
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
  const load = fetch(`/api/masters/list?${qs.toString()}`, { cache: 'no-store' })
    .then((r) => r.json())
    .catch(() => ({}))
    .finally(() => listInflight.delete(key));
  listInflight.set(key, load);
  const json = await load;
  return json?.success && Array.isArray(json.items) ? json.items : [];
}

export async function fetchPortalSettings(): Promise<Record<string, unknown> | null> {
  const res = await fetch('/api/state?key=settings', { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (json?.success && json.data && typeof json.data === 'object') {
    return json.data as Record<string, unknown>;
  }
  return null;
}