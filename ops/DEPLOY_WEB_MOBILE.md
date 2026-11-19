# Deploy guide — Web + Mobile (production server)

**Start here for a numbered checklist:** [`ops/DEPLOY_STEP_BY_STEP.md`](DEPLOY_STEP_BY_STEP.md)

Use this checklist when you ship **web** to EC2 and a **new Android APK** for field users.

---

## Part A — Web (EC2 / `townpanchayat.com`)

### A1. Server prerequisites

- Node 20+ LTS, `npm`, `pm2`, `nginx`, TLS cert for your domain
- MongoDB Atlas (or reachable `MONGODB_URI`) with database `dtp_enterprise`
- S3 bucket `townpanchayat` (or your bucket) with IAM keys on the instance
- Open ports: 443 (public), 5000 (localhost only behind nginx)

### A2. Clone or pull code on the server

```bash
cd ~/tpms/New-Town-Panchayat   # or your deploy path
git pull
```

### A3. Production `.env` (project root, never commit)

```env
APP_ENV=prod
NODE_ENV=production
PORT=5000

LIVE_DATA_ONLY=1
DISABLE_PORTAL_STATE=0
DISABLE_BOOTSTRAP_CACHE=1
SLIM_CORE_MASTERS=1
MONGO_RESPONSE_CACHE=1

MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=dtp_enterprise

S3_REGION=ap-south-1
S3_BUCKET_NAME=townpanchayat
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...

PRODUCTION_JOB_SECRET=<long-random-secret>
```

Do **not** run `npm run dev` on the server.

### A4. Build and start

```bash
npm ci
npm run build
pm2 delete townpan 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
pm2 logs townpan --lines 50
```

`ecosystem.config.cjs` runs **2 cluster workers** on port 5000.

### A5. Nginx

1. Proxy `https://townpanchayat.com` → `http://127.0.0.1:5000`
2. Rate limits + auth paths: see `ops/PHASE1_DEPLOY.md` and `ops/nginx-townpanchayat-phase1.conf` if present
3. Optional GET cache (masters, dashboard stats, counts rollups): `ops/nginx/townpanchayat-cache.conf.example`

```bash
sudo nginx -t && sudo systemctl reload nginx
```

### A6. Warm caches after every deploy

```bash
export PRODUCTION_JOB_SECRET='...'   # from .env

curl -sS -X POST "http://127.0.0.1:5000/api/jobs/production-refresh?forceLifetime=1" \
  -H "x-admin-key: $PRODUCTION_JOB_SECRET"

curl -sS http://127.0.0.1:5000/api/health
```

Optional scope prewarm (inspection users):

```bash
npm run prewarm-scope
```

### A7. Smoke and load tests (from server or laptop against prod URL)

```bash
# Quick smoke (10 concurrent × 4 routes)
npm run load-smoke -- http://127.0.0.1:5000 25

# Fuller load (50 virtual users, 60s)
npm run load-test -- https://townpanchayat.com 50 60
```

Targets (warm): see `ops/WEB_GO_LIVE.md`.

### A8. Publish APK metadata (after mobile build)

Admin can upload APK to S3 via existing release flow, or you upload manually:

- S3 key pattern used by the app (see `uploadApkReleaseToS3` in `lib/storage.ts`)
- Ensure `apkVersions` collection has the new version row so in-app “Update” works

### A9. PDF/PPT exports on server

- Exports hydrate work rows via `lookupId` (batched) and images via `/api/media` + presigned S3
- If slides show blank photos: verify S3 IAM `s3:GetObject` on `townpanchayat` and bucket CORS if needed
- Large exports: run from a machine with stable network; server must have same S3 env as above

---

## Part B — Mobile (new APK)

Mobile talks to **`https://townpanchayat.com`** when `EXPO_PUBLIC_APP_ENV=prod` (`mobile/src/constants/config.ts`).

### B1. Bump version (required for Play Store / in-app update)

In `mobile/src/constants/config.ts`:

- `APP_VERSION_NAME` (e.g. `2.0.10`)
- `APP_VERSION_CODE` (integer, must increase, e.g. `110`)

Match `mobile/package.json` `"version"` if you use store metadata.

### B2. `mobile/.env` for production build

```env
EXPO_PUBLIC_APP_ENV=prod
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
```

(`eas.json` profiles `preview`, `production`, and `production-apk` already set `EXPO_PUBLIC_APP_ENV=prod`.)

### B3. Build APK (local or EAS cloud)

**Option 1 — EAS (recommended)**

```bash
cd mobile
npm ci
npx eas login
npx eas build --platform android --profile production-apk
```

Download the `.apk` from the EAS dashboard when the build finishes.

**Option 2 — Local debug APK** (internal testing only)

```bash
cd mobile
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease
```

### B4. Distribute

1. Upload APK to your distribution channel (WhatsApp link, MDM, Play internal track, or S3 + `apkVersions` record).
2. Field users must **install the new APK** once; afterward the app uses `bootstrapProductionPortal` (slim APIs, not monolithic state).
3. Confirm login against production: `POST https://townpanchayat.com/api/auth/login`

### B5. Order of operations (recommended)

1. Deploy **web** (A4–A6) and confirm health + smoke tests
2. Build and ship **mobile APK** (B3–B4) pointing at the same API
3. Enable nginx cache (optional) only after smoke passes
4. Run `load-test` during a maintenance window; watch `pm2 monit` and Mongo metrics

---

## What changed in “professional” phase (code)

| Item | Status |
|------|--------|
| `storage.ts` split | Entrypoints `@/lib/db`, `@/lib/s3` — see `ops/STORAGE_MIGRATION.md` |
| Admin reads off full `/api/state` | User + employee admin use `lib/portalMastersClient.ts` + `/api/masters/list` |
| Admin writes | Still `POST /api/state` (collection saves) |
| Nginx safe GET cache | Example config in `ops/nginx/townpanchayat-cache.conf.example` |
| Load test | `scripts/load-test.mjs` + `npm run load-test` |
| PDF/PPT | Full batched `lookupId` hydrate (not 40-row cap) |
| Mobile | Rebuild APK with `EXPO_PUBLIC_APP_ENV=prod` after web deploy |

---

## Quick reference

| Doc | Purpose |
|-----|---------|
| `ops/DEPLOY_WEB_MOBILE.md` | This file |
| `ops/WEB_GO_LIVE.md` | Latency targets + prod flags |
| `ops/PRODUCTION_CUTOVER.md` | Cutover flags and jobs |
| `ops/PERFORMANCE_APIS.md` | API shapes (`countsOnly`, `rowsOnly`, etc.) |
| `ops/PHASE1_DEPLOY.md` | Nginx rate limit, mobile spike notes |

---

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Mobile “network error” on login | PM2 cluster up, nginx `location ^~ /api/auth/`, `curl` login from server |
| Slow reports first load | Run `production-refresh`; confirm `compactCounts=1` in browser network tab |
| Blank export images | S3 credentials on server; open presigned URL in browser |
| 502 from nginx | `pm2 status`, port 5000 listening, `pm2 logs` |