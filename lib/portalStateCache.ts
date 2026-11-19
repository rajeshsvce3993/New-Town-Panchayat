type PortalCacheEntry = { ts: number; body: Record<string, unknown> };

const PORTAL_STATE_CACHE_MS = 120_000;
const PORTAL_STATE_STALE_MS = 600_000;
const PORTAL_STATE_MAX_CONCURRENT = 6;

const portalStateCache = new Map<string, PortalCacheEntry>();
const portalInflight = new Map<string, Promise<Record<string, unknown>>>();
let activePortalStateBuilds = 0;

export function portalStateCacheKey(username: string, todayOnly: boolean): string {
  return `${String(username || '').toLowerCase()}|${todayOnly ? '1' : '0'}`;
}

export function getCachedPortalState(key: string, allowStale = false): Record<string, unknown> | null {
  const row = portalStateCache.get(key);
  if (!row) return null;
  const age = Date.now() - row.ts;
  if (age <= PORTAL_STATE_CACHE_MS) return row.body;
  if (allowStale && age <= PORTAL_STATE_STALE_MS) return row.body;
  if (age > PORTAL_STATE_STALE_MS) portalStateCache.delete(key);
  return null;
}

export function setCachedPortalState(key: string, body: Record<string, unknown>) {
  portalStateCache.set(key, { ts: Date.now(), body });
  if (portalStateCache.size > 500) {
    const oldest = [...portalStateCache.entries()].sort((a, b) => a[1].ts - b[1].ts).slice(0, 120);
    for (const [k] of oldest) portalStateCache.delete(k);
  }
}

export type PortalStateCacheTag = 'HIT' | 'MISS' | 'JOIN' | 'STALE';

/** One build per user at a time; serve stale when the server is saturated (protects web login). */
export async function runExclusivePortalBuild<T extends Record<string, unknown>>(
  key: string,
  build: () => Promise<T>,
): Promise<{ payload: T; tag: PortalStateCacheTag }> {
  const fresh = getCachedPortalState(key, false);
  if (fresh) return { payload: fresh as T, tag: 'HIT' };

  const stale = getCachedPortalState(key, true);
  if (activePortalStateBuilds >= PORTAL_STATE_MAX_CONCURRENT && stale) {
    return { payload: stale as T, tag: 'STALE' };
  }

  const joined = portalInflight.get(key);
  if (joined) {
    const payload = (await joined) as T;
    return { payload, tag: 'JOIN' };
  }

  activePortalStateBuilds += 1;
  const job = build()
    .then((payload) => {
      setCachedPortalState(key, payload);
      return payload as Record<string, unknown>;
    })
    .finally(() => {
      activePortalStateBuilds = Math.max(0, activePortalStateBuilds - 1);
      portalInflight.delete(key);
    });
  portalInflight.set(key, job);
  const payload = (await job) as T;
  return { payload, tag: 'MISS' };
}