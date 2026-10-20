import { extractWorksFromInspectionApiPayload } from '@/lib/inspectionWorksQueryFilters';
import { getRemotePortalApiBase, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

/** Live portal returns full works list (~tens of MB). Fetch once, filter locally many times. */
const RAW_LIST_TTL_MS = 15 * 60 * 1000;
const REMOTE_BULK_TIMEOUT_MS = 300_000;

let rawListCache: { works: any[]; at: number } | null = null;
let inflightRawFetch: Promise<any[] | null> | null = null;

async function downloadRemoteWorksList(): Promise<any[] | null> {
  const base = getRemotePortalApiBase();
  const url = `${base}/api/inspection-works?lite=1&limit=100000`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    cache: 'no-store',
    signal: AbortSignal.timeout(REMOTE_BULK_TIMEOUT_MS),
  });
  if (!res.ok) {
    console.warn(`[RemoteInspectionWorks] ${url} -> HTTP ${res.status}`);
    return null;
  }
  const json = await res.json();
  const works = extractWorksFromInspectionApiPayload(json);
  if (!works.length) {
    console.warn('[RemoteInspectionWorks] remote payload had zero works');
  }
  rawListCache = { works, at: Date.now() };
  return works;
}

/**
 * Shared raw works list from production (deduped in-flight, 15 min memory cache, stale fallback on error).
 */
export async function fetchRemoteInspectionWorksRaw(requestOrigin?: string): Promise<any[] | null> {
  if (!shouldUseRemotePortalApi(requestOrigin)) return null;

  const now = Date.now();
  if (rawListCache && now - rawListCache.at < RAW_LIST_TTL_MS) {
    return rawListCache.works;
  }

  if (!inflightRawFetch) {
    inflightRawFetch = (async () => {
      try {
        return await downloadRemoteWorksList();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[RemoteInspectionWorks] fetch failed:', msg);
        if (rawListCache?.works?.length) {
          console.warn('[RemoteInspectionWorks] serving stale cached works list');
          return rawListCache.works;
        }
        return null;
      } finally {
        inflightRawFetch = null;
      }
    })();
  }

  return inflightRawFetch;
}

/** Dev/admin: force next request to re-download from production. */
export function invalidateRemoteInspectionWorksCache() {
  rawListCache = null;
}
