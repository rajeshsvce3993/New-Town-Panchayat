/** Shared dashboard stats fetch — dedupe across DashboardView effects. */

let inflight: Promise<any> | null = null;
let inflightKey = '';
let cache: { key: string; at: number; json: any } | null = null;
const TTL_MS = 90_000;

export function invalidateDashboardStatsClientCache(): void {
  cache = null;
  inflight = null;
  inflightKey = '';
}

export async function fetchDashboardStatsJson(search: string): Promise<any> {
  const key = search || 'default';
  if (cache && cache.key === key && Date.now() - cache.at < TTL_MS) {
    return cache.json;
  }
  if (inflight && inflightKey === key) return inflight;

  inflightKey = key;
  inflight = fetch(`/api/dashboard/stats?${search}`, { cache: 'no-store' })
    .then((res) => res.json().catch(() => ({})))
    .then((json) => {
      if (json && json.success !== false) {
        cache = { key, at: Date.now(), json };
      }
      return json;
    })
    .finally(() => {
      inflight = null;
      inflightKey = '';
    });

  return inflight;
}