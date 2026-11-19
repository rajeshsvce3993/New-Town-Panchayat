# Web application — production go-live

## 1. Environment (EC2 `.env`)

```env
APP_ENV=prod
NODE_ENV=production
PORT=5000
LIVE_DATA_ONLY=1
DISABLE_PORTAL_STATE=1
DISABLE_BOOTSTRAP_CACHE=1
SLIM_CORE_MASTERS=1
MONGO_RESPONSE_CACHE=1
MONGODB_URI=...
PRODUCTION_JOB_SECRET=...
```

Never run `next dev` on the server.

## 2. Deploy

```bash
npm ci
npm run build
pm2 delete townpan 2>/dev/null; pm2 start ecosystem.config.cjs
pm2 save
```

## 3. Warm data (once per deploy)

```bash
curl -X POST "http://127.0.0.1:5000/api/jobs/production-refresh?forceLifetime=1" \
  -H "x-admin-key: $PRODUCTION_JOB_SECRET"
curl -s http://127.0.0.1:5000/api/health
```

## 4. API latency targets (production, warm)

| Endpoint | Target |
|----------|--------|
| `GET /api/health` | &lt; 200ms |
| `GET /api/masters/core` | &lt; 500ms |
| `GET /api/inspection-works?countsOnly&compactCounts` | &lt; 1s (repeat &lt; 200ms) |
| `GET /api/dashboard/stats?module=inspection` | &lt; 1s (repeat &lt; 200ms) |
| `GET /api/inspection-works?rowsOnly&page=1` | &lt; 2s |

```bash
node scripts/load-smoke.mjs http://127.0.0.1:5000 10
```

## 5. What the web app does in production mode

- Login: `masters/core` + `users` (inspection users lazy, lean list).
- Dashboard: embedded reports use `countsOnly` + `compactCounts` (rollup totals, no dimension explode storm).
- Browser: shared dedupe (`lib/inspectionWorksApiClient.ts`, `lib/dashboardStatsClient.ts`).
- Server: counts cache in memory + Mongo `app_response_cache`, rollups when `production-refresh` is healthy.
- Reports tab: `countsOnly` / `rowsOnly` / `reportsBundle` split; no duplicate hidden Reports instance.

## 6. Professional phase (done in repo; enable on server)

- **Storage entrypoints:** `@/lib/db`, `@/lib/s3` — `ops/STORAGE_MIGRATION.md`
- **Admin reads:** `lib/portalMastersClient.ts` (writes still `POST /api/state`)
- **Nginx GET cache:** `ops/nginx/townpanchayat-cache.conf.example`
- **Load test:** `npm run load-test -- https://townpanchayat.com 50 60`
- **PDF/PPT:** batched work hydrate in `InspectionReportsView`
- **Mobile:** new APK after web deploy — `ops/DEPLOY_WEB_MOBILE.md`

See also `ops/PRODUCTION_CUTOVER.md`, `ops/DEPLOY_WEB_MOBILE.md`, and `ops/SOLUTION_FIRST_ARCHITECTURE.md`.