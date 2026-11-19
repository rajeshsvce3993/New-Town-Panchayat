/**
 * Browser-side dedupe for inspection-works GETs (dashboard embed + reports tab).
 * Prevents API storms when multiple components/effects request the same counts.
 */

type CacheEntry = { at: number; json: any };

const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<any>>();

function ttlForQuery(queryKey: string): number {
  if (queryKey.includes('countsOnly=1')) return 20_000;
  if (queryKey.includes('rowsOnly=1')) return 8_000;
  return 5_000;
}

export function invalidateInspectionWorksClientCache(): void {
  mem.clear();
  inflight.clear();
}

export async function fetchInspectionWorksJson(queryKey: string, url: string): Promise<any> {
  const ttl = ttlForQuery(queryKey);
  const hit = mem.get(queryKey);
  if (hit && Date.now() - hit.at < ttl) return hit.json;

  const pending = inflight.get(queryKey);
  if (pending) return pending;

  const load = fetch(url, { cache: 'no-store' })
    .then((res) => res.json().catch(() => ({})))
    .then((json) => {
      if (json && json.success !== false) {
        mem.set(queryKey, { at: Date.now(), json });
      }
      return json;
    })
    .finally(() => {
      inflight.delete(queryKey);
    });

  inflight.set(queryKey, load);
  return load;
}