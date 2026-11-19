# Production cutover checklist

## Env (production server)

```env
LIVE_DATA_ONLY=1
DISABLE_PORTAL_STATE=1
DISABLE_BOOTSTRAP_CACHE=1
SLIM_CORE_MASTERS=1
MONGO_RESPONSE_CACHE=1
MONGODB_POOL_SIZE=100
```

## Verify after deploy

```bash
curl -s http://127.0.0.1:5000/api/health | jq .
# rollups.ok should be true; portalStateDisabled true

curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:5000/api/portal-state?username=test"
# 410

curl -s "http://127.0.0.1:5000/api/masters/core" | jq '.data | keys'
# slim: no heavy townPanchayats payload (empty arrays; use /api/masters/geo)

curl -w "\n%{time_total}s\n" -s "http://127.0.0.1:5000/api/dashboard/stats?module=inspection&allTime=1"
```

## Mobile

- APK must use `bootstrapProductionPortal` (geo/me + masters/scope + works).
- No timer calling `portal-state`.
- Pull-to-refresh / after submit only.

## Rollups

- `GET /api/health` → `rollups.liveBuckets` > 0, `lifetimeBuckets` > 0.
- If `lifetimeBuckets` = 0, run (once after deploy):

```bash
curl -X POST "http://127.0.0.1:5000/api/jobs/production-refresh?forceLifetime=1" \
  -H "x-admin-key: YOUR_PRODUCTION_JOB_SECRET"
```

Set `PRODUCTION_JOB_SECRET` in `.env` on the server.

## SWM dashboard

- Collection `dashboard_swm_totals` refreshed by rollup worker.
- First `module=swm` may still scan; repeat uses Mongo doc.

## Load smoke (optional)

```bash
node scripts/load-smoke.mjs http://127.0.0.1:5000 20
```

## Web go-live (latency + dashboard API storm)

See **`ops/WEB_GO_LIVE.md`** — deploy, warm rollups, smoke test, sub-1s targets for counts/dashboard.

## Still incremental

- `lib/storage.ts` shrink (see `SOLUTION_FIRST_ARCHITECTURE.md`)
- Full `storage.ts` module split
- Nginx rate limits on legacy routes
- Formal load test at 10k users / lakh works