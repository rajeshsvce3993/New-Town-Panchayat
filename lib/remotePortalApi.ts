const DEFAULT_REMOTE_PORTAL = 'https://townpanchayat.com';

export function getRemotePortalApiBase(): string {
  const raw = process.env.PORTAL_API_BASE || process.env.NEXT_PUBLIC_PORTAL_API_BASE || DEFAULT_REMOTE_PORTAL;
  return String(raw).trim().replace(/\/$/, '');
}

export function shouldUseRemotePortalApi(requestOrigin?: string): boolean {
  const flag = String(process.env.USE_REMOTE_PORTAL_API || '').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'off') return false;

  const base = getRemotePortalApiBase();
  if (requestOrigin) {
    try {
      const remoteHost = new URL(base).host.replace(/^www\./, '');
      const localHost = new URL(requestOrigin).host.replace(/^www\./, '');
      if (remoteHost && localHost && remoteHost === localHost) {
        return false;
      }
    } catch {
      /* ignore */
    }
  }

  if (flag === '1' || flag === 'true' || flag === 'on') return true;
  return process.env.NODE_ENV !== 'production';
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

/** POST/PUT to live portal; preserves HTTP status and JSON body (for login, etc.). */
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
