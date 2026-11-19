type PortalCacheEntry = { ts: number; body: Record<string, unknown> };

const PORTAL_STATE_CACHE_MS = 45_000;
const portalStateCache = new Map<string, PortalCacheEntry>();

export function portalStateCacheKey(username: string, todayOnly: boolean): string {
  return `${String(username || '').toLowerCase()}|${todayOnly ? '1' : '0'}`;
}

export function getCachedPortalState(key: string): Record<string, unknown> | null {
  const row = portalStateCache.get(key);
  if (!row) return null;
  if (Date.now() - row.ts > PORTAL_STATE_CACHE_MS) {
    portalStateCache.delete(key);
    return null;
  }
  return row.body;
}

export function setCachedPortalState(key: string, body: Record<string, unknown>) {
  portalStateCache.set(key, { ts: Date.now(), body });
  if (portalStateCache.size > 400) {
    const oldest = [...portalStateCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 100);
    for (const [k] of oldest) portalStateCache.delete(k);
  }
}