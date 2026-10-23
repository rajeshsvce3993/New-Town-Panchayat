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

/** Forward multipart upload to live portal (uses production S3 on server). */
export async function postRemotePortalUpload(
  requestOrigin: string | undefined,
  fields: {
    fileBuffer: Buffer;
    fileName: string;
    contentType: string;
    purpose?: string;
    userId?: string;
    username?: string;
  },
  timeoutMs = 300_000
): Promise<{ status: number; data: any }> {
  if (!shouldUseRemotePortalApi(requestOrigin)) {
    return {
      status: 503,
      data: { success: false, message: 'Remote portal upload is only used when APP_ENV=prod on localhost.' },
    };
  }
  const base = getRemotePortalApiBase();
  const url = `${base}/api/upload`;
  try {
    const form = new FormData();
    const blob = new Blob([fields.fileBuffer], {
      type: fields.contentType || 'application/octet-stream',
    });
    form.append('file', blob, fields.fileName);
    if (fields.purpose) form.append('purpose', fields.purpose);
    if (fields.userId) form.append('userId', fields.userId);
    if (fields.username) form.append('username', fields.username);

    const res = await fetch(url, {
      method: 'POST',
      body: form,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: `Remote upload returned HTTP ${res.status}` };
    }
    if (!res.ok) {
      if (res.status === 413) {
        data = {
          success: false,
          message:
            'Production server rejected file size (HTTP 413). Increase nginx client_max_body_size (e.g. 128m) on townpanchayat.com, or upload APK on the live site after deploy.',
          ...(data && typeof data === 'object' ? data : {}),
        };
      }
      console.warn(`[RemotePortal] upload ${url} -> HTTP ${res.status}`, data?.message || '');
    } else {
      console.info(`[RemotePortal] upload proxied to ${base} (${fields.fileName})`);
    }
    return { status: res.status, data };
  } catch (err: any) {
    console.warn('[RemotePortal] upload proxy failed:', err?.message || err);
    return {
      status: 502,
      data: {
        success: false,
        message: `Could not upload via ${base}. ${err?.message || 'Network error'}`,
      },
    };
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
