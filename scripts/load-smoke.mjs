#!/usr/bin/env node
/**
 * Quick concurrency smoke — NOT a full load test.
 * Usage: node scripts/load-smoke.mjs http://127.0.0.1:3000 25
 */
const base = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '');
const n = Math.min(Number(process.argv[3]) || 10, 100);

const paths = [
  '/api/health',
  '/api/dashboard/stats?module=inspection&allTime=1',
  '/api/inspection-works?lite=1&countsOnly=1&compactCounts=1&fromDate=2026-11-19&toDate=2026-11-19',
  '/api/masters/geo?level=zones',
];

async function one(path) {
  const t0 = performance.now();
  const res = await fetch(`${base}${path}`);
  const ms = Math.round(performance.now() - t0);
  return { path, status: res.status, ms };
}

async function main() {
  const jobs = [];
  for (let i = 0; i < n; i++) {
    for (const p of paths) jobs.push(one(p));
  }
  const results = await Promise.all(jobs);
  const byPath = {};
  for (const r of results) {
    byPath[r.path] = byPath[r.path] || [];
    byPath[r.path].push(r);
  }
  for (const [path, rows] of Object.entries(byPath)) {
    const times = rows.map((r) => r.ms).sort((a, b) => a - b);
    const p50 = times[Math.floor(times.length / 2)];
    const p95 = times[Math.floor(times.length * 0.95)] || times[times.length - 1];
  const bad = rows.filter((r) => r.status >= 500).length;
    console.log(`${path} n=${rows.length} p50=${p50}ms p95=${p95}ms errors=${bad}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});