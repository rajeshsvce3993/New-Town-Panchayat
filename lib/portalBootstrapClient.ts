'use client';

let inflight: Promise<any> | null = null;
let cached: { json: any; at: number } | null = null;
const freshListeners = new Set<(json: any) => void>();

function notifyFresh(json: any) {
  if (!json?.success) return;
  freshListeners.forEach((cb) => {
    try {
      cb(json);
    } catch {
      /* ignore listener errors */
    }
  });
}

/** Called when a background bootstrap fetch completes (e.g. after F5 cache restore). */
export function onPortalBootstrapFresh(cb: (json: any) => void): () => void {
  freshListeners.add(cb);
  return () => freshListeners.delete(cb);
}
const CACHE_MS = 120000;
const SESSION_KEY = 'portal_bootstrap_v1';
const SESSION_TTL_MS = 20 * 60 * 1000;

function readSessionBootstrap(): any | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.json || Date.now() - parsed.at > SESSION_TTL_MS) return null;
    return parsed.json;
  } catch {
    return null;
  }
}

function writeSessionBootstrap(json: any) {
  if (typeof sessionStorage === 'undefined' || !json?.success) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), json }));
  } catch {
    /* quota — keep in-memory cache only */
  }
}

function fetchAndStoreBootstrap(force = false): Promise<any> {
  if (!inflight) {
    inflight = fetch(`/api/state?mode=bootstrap${force ? '&fresh=true' : ''}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.success) {
          cached = { json, at: Date.now() };
          writeSessionBootstrap(json);
          notifyFresh(json);
        } else {
          cached = null;
        }
        return json;
      })
      .catch((err) => {
        console.warn('Portal bootstrap failed:', err);
        cached = null;
        const fallback = readSessionBootstrap();
        if (fallback?.success) return fallback;
        return { success: false };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Sync read for instant UI after browser refresh (same tab session). */
export function peekPortalBootstrapCache(): any | null {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.json;
  return readSessionBootstrap();
}

/** Returns cached data immediately when available; refreshes from API in the background. */
export function loadPortalBootstrap(force = false): Promise<any> {
  if (!force) {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Promise.resolve(cached.json);
    }
    const session = readSessionBootstrap();
    if (session?.success) {
      cached = { json: session, at: Date.now() };
      void fetchAndStoreBootstrap(false);
      return Promise.resolve(session);
    }
  }
  return fetchAndStoreBootstrap(force);
}
