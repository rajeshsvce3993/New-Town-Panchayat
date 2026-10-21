import { getAppEnv, getPortalApiUrl, isLocalDevHost } from '@/lib/appEnvironment';

export function getRemotePortalApiBase(): string {
  return getPortalApiUrl();
}

/** Prod on your laptop → call live API. Prod on server → use local Mongo on that server. */
export function shouldUseRemotePortalApi(requestOrigin?: string): boolean {
  if (getAppEnv() === 'local') return false;
  return isLocalDevHost(requestOrigin);
}

export async function fetchRemotePortalJson(
  pathWithQuery: string,
  requestOrigin?: string,
  init?: { method?: string; body?: string; headers?: Record<string, string> }
): Promise<any | null> {
  if (!shouldUseRemotePortalApi(requestOrigin)) return null;
  const base = getRemotePortalApiBase();
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${base}${path}`;
  const method = (init?.method || 'GET').toUpperCase();
  try {
    const res = await fetch(url, {
      method,
      headers: { Accept: 'application/json', ...(init?.headers || {}) },
      body: method === 'GET' || method === 'HEAD' ? undefined : init?.body,
      cache: 'no-store',
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      console.warn(`[RemotePortal] ${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err: any) {
    console.warn('[RemotePortal] fetch failed:', err?.message || err);
    return null;
  }
}

export async function postRemotePortalJson(
  pathWithQuery: string,
  requestOrigin: string | undefined,
  body: unknown,
  timeoutMs = 60000
): Promise<{ status: number; data: any }> {
  if (!shouldUseRemotePortalApi(requestOrigin)) {
    return {
      status: 503,
      data: { success: false, message: 'Remote portal API is not enabled for this host.' },
    };
  }
  const base = getRemotePortalApiBase();
  const path = pathWithQuery.startsWith('/') ? pathWithQuery : `/${pathWithQuery}`;
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: `Remote portal returned HTTP ${res.status}` };
    }
    return { status: res.status, data };
  } catch (err: any) {
    console.warn('[RemotePortal] POST failed:', err?.message || err);
    return {
      status: 502,
      data: {
        success: false,
        message: `Unable to reach portal server (${getRemotePortalApiBase()}). ${err?.message || 'Network error'}`,
      },
    };
  }
}
