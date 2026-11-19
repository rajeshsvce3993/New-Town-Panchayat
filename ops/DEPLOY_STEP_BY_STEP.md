# Step-by-step production deploy (complete — web + server + mobile)

Follow **Part A → Part B → Part C** in order. Times are IST where cron is mentioned.

**Server:** `t2.medium` (2 vCPU, 4 GB) — keep PM2 **`instances: 2`** in `ecosystem.config.cjs`.

**Data:** Production uses **MongoDB + `.env`**. Do **not** rely on or commit `data/db.json`.

**Your typical paths (adjust if your server differs):**

| Item | Path |
|------|------|
| App on EC2 | `~/tpms/New-Town-Panchayat` |
| Nginx site config | `/etc/nginx/conf.d/townpan.conf` |
| Nginx main (rate limits, cache zone) | `/etc/nginx/nginx.conf` inside `http { }` |
| Example nginx snippets in repo | `ops/nginx-townpanchayat-phase1.conf`, `ops/nginx/townpanchayat-cache.conf.example` |
| PM2 app name | `townpan` (port **5000**, health sidecar **5001** in `server.js`) |
| Public URL | `https://townpanchayat.com` |

---

## Part A — Your PC (before SSH)

### A1. Stop local dev

```powershell
# In the terminal running npm run dev — Ctrl+C
```

### A2. Commit and push (required — server uses `git pull`)

Do **not** commit `.env`, `mobile/.env`, or local `data/db.json`.

```powershell
cd "c:\Users\rajes\Documents\projects\New_TP\town-panchayat-management-system-v.15"
git status
git add -A
git restore --staged .env
git restore --staged mobile/.env
git restore --staged data/db.json
git commit -m "Production release: slim APIs, mobile geo, deploy ops"
git push origin main
```

### A3. Copy production `.env` values

Prepare (on paper or local file) what the server `.env` must contain — same keys as `.env.example`, with **real** Mongo, S3, and `PRODUCTION_JOB_SECRET`. You will paste/edit on EC2 in Part B.

---

## Part B — EC2 server (web application)

### First-time server only

```bash
# Node 20 via nvm (example)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
npm i -g pm2

# Clone (once)
mkdir -p ~/tpms && cd ~/tpms
git clone https://github.com/rajeshsvce3993/New-Town-Panchayat.git New-Town-Panchayat
cd New-Town-Panchayat
cp .env.example .env
nano .env   # fill all prod values
```

TLS: point domain `townpanchayat.com` to EC2; use certbot/Let’s Encrypt. Nginx listens **443** → Node **127.0.0.1:5000**.

---

## Phase 0 — Before you start (each deploy / verify)

1. SSH to EC2: `ssh ubuntu@<your-ec2-ip>` (or your user/host).
2. Confirm tools: `node -v` (20+), `npm -v`, `pm2 -v`, `nginx -v`, `git -v`.
3. Confirm app folder exists:
   ```bash
   cd ~/tpms/New-Town-Panchayat && pwd && git status
   ```
4. Confirm root `.env` exists on server (never commit). Minimum for production:

   ```env
   APP_ENV=prod
   NODE_ENV=production
   PORT=5000
   LIVE_DATA_ONLY=1
   DISABLE_BOOTSTRAP_CACHE=1
   SLIM_CORE_MASTERS=1
   MONGO_RESPONSE_CACHE=1
   DISABLE_PORTAL_STATE=0
   MONGODB_URI=...
   MONGODB_DB_NAME=dtp_enterprise
   S3_REGION=ap-south-1
   S3_BUCKET_NAME=townpanchayat
   S3_ACCESS_KEY_ID=...
   S3_SECRET_ACCESS_KEY=...
   PRODUCTION_JOB_SECRET=<long-random-secret>
   ```

   - Use `DISABLE_PORTAL_STATE=0` while **old APKs** might still call `/api/portal-state`.
   - After **most users** have the new APK, set `DISABLE_PORTAL_STATE=1` and redeploy (410 stops legacy storms).

5. **Nginx Phase 1 (mobile login protection)** — required if you see “network error” on login:
   - Copy structure from `ops/nginx-townpanchayat-phase1.conf` into `/etc/nginx/conf.d/townpan.conf`.
   - In `/etc/nginx/nginx.conf` → `http { }`, add once:
     ```nginx
     limit_req_zone $binary_remote_addr zone=portal_state:10m rate=25r/s;
     limit_req_zone $binary_remote_addr zone=api_general:10m rate=80r/s;
     ```
   - Must include: `location ^~ /api/auth/`, `location = /api/health` → `127.0.0.1:5001`, rate limit on `/api/portal-state`.
   - Test: `sudo nginx -t && sudo systemctl reload nginx`

---

## Phase 1 — Web deploy

**Goal:** New code running under PM2 on port 5000.

1. On EC2:
   ```bash
   cd ~/tpms/New-Town-Panchayat
   git pull
   ```
2. Install and build (**not** `npm run dev`):
   ```bash
   npm ci
   npm run build
   ```
   Build runs Next production build + scope prewarm script.
3. Restart PM2 (2 cluster workers):
   ```bash
   pm2 delete townpan 2>/dev/null || true
   pm2 start ecosystem.config.cjs
   pm2 save
   ```
4. Check logs (no crash loop):
   ```bash
   pm2 status
   pm2 logs townpan --lines 80
   ```
5. Quick local health:
   ```bash
   curl -sS http://127.0.0.1:5000/api/health
   curl -sS http://127.0.0.1:5001/api/health
   ```
   Both should return JSON with `status` / `ok`.

6. **Login path check (mobile network error prevention):**
   ```bash
   curl -s -o /dev/null -w 'login:%{http_code} %{time_total}s\n' --max-time 20 \
     -X POST http://127.0.0.1:5000/api/auth/login \
     -H 'Content-Type: application/json' -H 'X-Client: mobile' \
     -d '{"username":"TEST_USER","password":"TEST_PASS","client":"mobile"}'
   ```
   Expect **200**, **401**, or **403** in **&lt; 5s** — **never `000`**.

7. Optional scope prewarm (recommended before morning field login):
   ```bash
   cd ~/tpms/New-Town-Panchayat
   npm run prewarm-scope
   ```

8. Smoke-test in browser: `https://townpanchayat.com` — admin login, dashboard, one reports tab.

---

## Phase 2 — production-refresh (warm rollups / caches)

**Goal:** Report counts and dashboard stats are fast after deploy.

1. Load secret from `.env` (on server):
   ```bash
   cd ~/tpms/New-Town-Panchayat
   export $(grep -E '^PRODUCTION_JOB_SECRET=' .env | xargs)
   ```
2. Run job:
   ```bash
   curl -sS -X POST "http://127.0.0.1:5000/api/jobs/production-refresh?forceLifetime=1" \
     -H "x-admin-key: $PRODUCTION_JOB_SECRET"
   ```
   Response should indicate success (check JSON body).
3. Verify health flags:
   ```bash
   curl -sS http://127.0.0.1:5000/api/health | head -c 500
   ```

### Cron — nightly production-refresh (optional, off-peak)

Edit crontab on EC2: `crontab -e`

**Nightly 2:30 AM IST** (adjust timezone on server if needed):

```cron
30 2 * * * cd /home/ubuntu/tpms/New-Town-Panchayat && /usr/bin/curl -sS -X POST "http://127.0.0.1:5000/api/jobs/production-refresh?forceLifetime=1" -H "x-admin-key: $(grep PRODUCTION_JOB_SECRET .env | cut -d= -f2-)" >> /home/ubuntu/tpms/production-refresh.log 2>&1
```

Replace `/home/ubuntu/` with your real home path if different.

**Morning scope prewarm (recommended with mobile login):**

```cron
0 5 * * * cd /home/ubuntu/tpms/New-Town-Panchayat && /usr/bin/npm run prewarm-scope >> /home/ubuntu/tpms/prewarm-scope.log 2>&1
```

---

## Phase 3 — Smoke tests

**Goal:** Confirm APIs respond before you ship APK or enable cache.

On EC2 (localhost):

```bash
cd ~/tpms/New-Town-Panchayat
npm run load-smoke -- http://127.0.0.1:5000 25
```

Through nginx (public):

```bash
npm run load-smoke -- https://townpanchayat.com 15
```

Manual curls (from `ops/WEB_GO_LIVE.md`):

```bash
curl -s -o /dev/null -w 'masters:%{http_code} %{time_total}s\n' https://townpanchayat.com/api/masters/core
curl -s -o /dev/null -w 'counts:%{http_code} %{time_total}s\n' \
  "https://townpanchayat.com/api/inspection-works?lite=1&countsOnly=1&compactCounts=1&fromDate=$(date +%F)&toDate=$(date +%F)"
curl -s -o /dev/null -w 'dash:%{http_code} %{time_total}s\n' \
  'https://townpanchayat.com/api/dashboard/stats?module=inspection&allTime=1'
```

**Pass criteria (warm):** mostly **200**; repeat counts/dashboard calls should get faster (under ~1s after first hit).

---

## Phase 4 — Build and ship new APK

**Goal:** Field apps use slim APIs (`bootstrapProductionPortal`), not fat `portal-state`.

### On your Windows dev PC

1. Pull same commit as server:
   ```bash
   cd c:\Users\rajes\Documents\projects\New_TP\town-panchayat-management-system-v.15
   git pull
   ```
2. Bump version in `mobile/src/constants/config.ts`:
   - `APP_VERSION_NAME` (e.g. `2.0.10`)
   - `APP_VERSION_CODE` (integer, must increase, e.g. `110`)
3. Set `mobile/.env`:
   ```env
   EXPO_PUBLIC_APP_ENV=prod
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=...
   ```
4. Build (EAS):
   ```bash
   cd mobile
   npm ci
   npx eas login
   npx eas build --platform android --profile production-apk
   ```
5. Download APK from EAS dashboard when build completes.
6. Distribute to field staff (MDM / WhatsApp / manual install).
7. **Register version on server** (in-app update):
   - Admin portal APK release upload, **or**
   - S3 + `apkVersions` document (see `uploadApkReleaseToS3` in `lib/storage.ts`).

8. Test one device: install APK → login → create/sync one work → confirm no “network error”.

9. After uptake is high, on server set `DISABLE_PORTAL_STATE=1` in `.env`, rebuild/restart PM2 (Phase 1 steps 2–4 only).

---

## Phase 5 — Nginx GET cache (optional)

**Goal:** Edge cache for safe read-only GETs (masters, dashboard stats, rollup counts).

**Only do this after Phase 3 smoke tests pass.**

1. On EC2, edit `/etc/nginx/nginx.conf` inside `http { }` — add **once**:

   ```nginx
   proxy_cache_path /var/cache/nginx/tpms levels=1:2 keys_zone=tpms_api:64m
       inactive=10m max_size=512m use_temp_path=off;

   map $args $tpms_iw_counts_cache {
       default 1;
       ~*(?:^|&)countsOnly=1.*compactCounts=1 0;
       ~*compactCounts=1.*countsOnly=1 0;
   }
   ```

2. Merge snippets from `ops/nginx/townpanchayat-cache.conf.example` into `/etc/nginx/conf.d/townpan.conf` **above** the catch-all `location /` or `location /api/`.

3. Create cache dir:
   ```bash
   sudo mkdir -p /var/cache/nginx/tpms
   sudo chown www-data:www-data /var/cache/nginx/tpms
   ```
4. Test and reload:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
5. Verify cache header:
   ```bash
   curl -sI "https://townpanchayat.com/api/masters/core" | grep -i x-cache
   ```
   Second request may show `X-Cache-Status: HIT`.

**Do not cache:** `/api/auth/`, `/api/state`, `/api/portal-state`, POST bodies, personalized portal routes.

---

## Phase 6 — Load test (quiet window)

**Goal:** Validate capacity before peak hours (e.g. after 10 PM or weekend).

On EC2 or laptop (not during 8–11 AM field login peak):

```bash
cd ~/tpms/New-Town-Panchayat
npm run load-test -- https://townpanchayat.com 50 60
```

Watch during test:

```bash
pm2 monit
# or
pm2 logs townpan --lines 20
```

**Pass:** script prints `PASS` with error rate &lt; 5%.  
**Fail:** errors or `login` curls return `000` → increase PM2 instances in `ecosystem.config.cjs`, upgrade EC2, confirm nginx auth location, run `prewarm-scope`.

---

## Quick reference — recommended order (checklist)

- [ ] **0** Nginx Phase 1 + `.env` on server
- [ ] **1** `git pull` → `npm ci` → `npm run build` → `pm2 start ecosystem.config.cjs`
- [ ] **2** `production-refresh` + optional `prewarm-scope`
- [ ] **3** `load-smoke` (localhost + public URL)
- [ ] **4** EAS `production-apk` → distribute → test login on device
- [ ] **5** (Optional) Nginx GET cache
- [ ] **6** `load-test` in quiet window
- [ ] **7** Set `DISABLE_PORTAL_STATE=1` after APK rollout
- [ ] **8** Add cron: nightly `production-refresh` + 5 AM `prewarm-scope`

---

## Related docs

| File | Topic |
|------|--------|
| `ops/DEPLOY_WEB_MOBILE.md` | Full web + mobile reference |
| `ops/PHASE1_DEPLOY.md` | Mobile “network error” root cause + nginx |
| `ops/WEB_GO_LIVE.md` | Latency targets |
| `ops/PRODUCTION_CUTOVER.md` | Flags and jobs |
| `ops/nginx-townpanchayat-phase1.conf` | Auth + health + rate limits |
| `ops/nginx/townpanchayat-cache.conf.example` | Optional GET cache |