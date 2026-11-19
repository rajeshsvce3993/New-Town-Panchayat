#!/usr/bin/env node
/**
 * Full-volume concurrency load test (safe GET endpoints only).
 *
 * Usage:
 *   node scripts/load-test.mjs [baseUrl] [concurrentUsers] [durationSec]
 *
 * Examples:
 *   node scripts/load-test.mjs http://127.0.0.1:5000 50 60
 *   node scripts/load-test.mjs https://townpanchayat.com 100 120
 */
const base = (process.argv[2] || 'http://127.0.0.1:5000').replace(/\/$/, '');
const users = Math.min(Math.max(Number(process.argv[3]) || 25, 1), 200);
const durationSec = Math.min(Math.max(Number(process.argv[4]) || 45, 10), 600);

const today = new Date().toISOString().slice(0, 10);

const paths = [
  '/api/health',
  '/api/masters/core',
  '/api/dashboard/stats?module=inspection&allTime=1',
  `/api/inspection-works?lite=1&countsOnly=1&compactCounts=1&fromDate=${today}&toDate=${today}`,
  '/api/masters/geo?level=zones',
  '/api/masters/list?collection=users&page=1&limit=100&lean=1',
];

const stats = {};
for (const p of paths) {
  stats[p] = { times: [], errors: 0, ok: 0 };
}

let stop = false;
process.on('SIGINT', () => {
  stop = true;
});

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
  return sorted[idx];
}

async function worker(id) {
  let n = 0;
  while (!stop) {
    const path = paths[n % paths.length];
    n += 1;
    const t0 = performance.now();
    try {
      const res = await fetch(`${base}${path}`, { headers: { 'x-load-test': '1' } });
      const ms = Math.round(performance.now() - t0);
      const bucket = stats[path];
      bucket.times.push(ms);
      if (res.status >= 500) bucket.errors += 1;
      else bucket.ok += 1;
    } catch {
      const bucket = stats[path];
      bucket.errors += 1;
    }
    if (durationSec > 0 && performance.now() - startMs > durationSec * 1000) break;
  }
}

const startMs = performance.now();
console.log(`Load test base=${base} users=${users} duration=${durationSec}s paths=${paths.length}`);

await Promise.all(Array.from({ length: users }, (_, i) => worker(i)));
stop = true;

const elapsed = ((performance.now() - startMs) / 1000).toFixed(1);
console.log(`\nElapsed ${elapsed}s\n`);

for (const path of paths) {
  const b = stats[path];
  const times = b.times.sort((a, b) => a - b);
  const total = times.length;
  const rps = total ? (total / Number(elapsed)).toFixed(1) : '0';
  console.log(
    `${path}\n  requests=${total} rps~${rps} ok=${b.ok} errors=${b.errors} ` +
      `p50=${percentile(times, 0.5)}ms p95=${percentile(times, 0.95)}ms max=${times[times.length - 1] || 0}ms`
  );
}

const totalErrors = Object.values(stats).reduce((a, b) => a + b.errors, 0);
const totalReq = Object.values(stats).reduce((a, b) => a + b.times.length, 0);
const errorRate = totalReq ? totalErrors / totalReq : 0;
if (errorRate > 0.05) {
  console.error(`\nFAIL error rate ${(errorRate * 100).toFixed(1)}% (threshold 5%)`);
  process.exit(1);
}
console.log(`\nPASS error rate ${(errorRate * 100).toFixed(2)}%`);