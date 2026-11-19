# API performance — dashboard & inspection counts

## What each endpoint should use (after latest optimizations)

| Endpoint | Fast path | Target (warm prod) |
|----------|-----------|-------------------|
| `GET /api/dashboard/stats?module=inspection` | Rollup **`$sum` only** + cached masters + cached response 120s | **&lt; 1s** |
| `GET /api/dashboard/stats?module=swm` | Indexed `inspectionWorks` agg on **SWM category only** + cache 120s | **2–5s** first hit; **&lt; 200ms** repeat |
| `GET /api/inspection-works?countsOnly&allTime=1` (abstract) | **Lifetime rollups** + dimension `$group` (not per-day scan) | **&lt; 1–3s** warm |
| `GET /api/inspection-works?countsOnly&fromDate&toDate` | Rollup **compact** (subject+category), not live works scan | **&lt; 1–2s** |
| `GET /api/inspection-works?reportsBundle` (detailed page) | Indexed page sort `submittedDateYmd` + **totalOnly** rollup | **&lt; 1–2s** |

## Dev vs production

- **`○ Compiling /api/inspection-works` ~3–4s** happens only in `npm run dev` (Next on-demand compile).
- Production: `npm run build` + `node server.js` / PM2 — **no route compile** on first request.

## Mongo prerequisites

1. Collection **`inspectionWorkReportRollups`** must exist and be **caught up** (worker runs every 6h; catchup on query).
2. On server start, indexes are created on rollups + **`inspectionWorkReportRollupsLifetime`** + `inspectionWorks`.
3. First boot after upgrade: rollup worker builds **lifetime** collection once (background); abstract all-time queries speed up after that.
3. Ensure **`LIVE_DATA_ONLY=1`** on prod (no scope rebuild storm on master save).

### One-time rollup health (on server)

```bash
curl -s "http://127.0.0.1:5000/api/health"
# Optional: trigger catchup (admin, off-peak only)
curl -s "http://127.0.0.1:5000/api/inspection-works/backfill-report-index" 
```

If rollups are empty, first dashboard query may be slow until worker fills them.

## Why SWM is still heavier than inspection

SWM KPIs need **household field values** (`fieldsData`) — not stored in rollups. That requires an aggregation on `inspectionWorks` for the SWM subject/category only. Mitigations already in code:

- Dashboard loads **inspection first**; SWM loads on **idle** (does not block first paint).
- **120s server cache** on SWM totals.

Further improvement (future): nightly `dashboard_swm_totals` document updated by a job.

## Infrastructure

| Setting | Recommendation |
|---------|----------------|
| EC2 | 4 vCPU / 8 GB |
| PM2 | `instances: 4` |
| Mongo | Same AZ as app; `MONGODB_POOL_SIZE=100` |
| Nginx | Health on :5001; rate-limit legacy `portal-state` |

## How to verify after deploy

```bash
# Inspection dashboard (should drop on 2nd call)
curl -w "\n%{time_total}s\n" -s "http://127.0.0.1:5000/api/dashboard/stats?allTime=1&module=inspection"

# Today counts only
curl -w "\n%{time_total}s\n" -s "http://127.0.0.1:5000/api/inspection-works?fromDate=$(date +%F)&toDate=$(date +%F)&lite=1&countsOnly=1"
```

Second request should be much faster (caches).