# Phase 1 production deploy (server only — no new APK)

## 1. Deploy code

```bash
cd ~/tpms/New-Town-Panchayat
git pull
npm run build          # runs next build + scope prewarm for missing users
pm2 delete townpan 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
```

Ensure `.env` on server includes:

- `MONGODB_URI=...`
- `S3_BUCKET_NAME=townpanchayat`
- `APP_ENV=prod`
- Do **not** set `SCOPE_ALLOW_FULL_FALLBACK=1` on production (loads full DB on scope miss).

## 2. Prewarm scope (after deploy or morning peak)

```bash
npm run prewarm-scope
```

Or HTTP (admin): `GET /api/state?rebuildCache=true`

## 3. Health checks

```bash
# Sidecar (always fast under load):
curl -s -o /dev/null -w 'health5001:%{http_code} %{time_total}s\n' --max-time 3 http://127.0.0.1:5001/api/health
# Main app (may queue when mobiles spike):
curl -s -o /dev/null -w 'health5000:%{http_code} %{time_total}s\n' --max-time 5 http://127.0.0.1:5000/api/health
curl -s -o /dev/null -w 'portal:%{http_code} %{time_total}s\n' --max-time 15 \
  'http://127.0.0.1:5000/api/portal-state?username=TESTUSER'
```

Expect: health **200** in **<1s**; repeat portal-state should show header **X-Portal-Cache: HIT** or **JOIN**.

## 4. Optional nginx rate limit (protect web login)

**Step A — zones** (only in `/etc/nginx/nginx.conf`, inside `http { }`, before `include /etc/nginx/conf.d/*.conf;`):

```nginx
limit_req_zone $binary_remote_addr zone=portal_state:10m rate=25r/s;
limit_req_zone $binary_remote_addr zone=api_general:10m rate=80r/s;
```

Do **not** put `limit_req_zone` in `conf.d/townpan.conf` (nginx will error: directive not allowed here).

**Step B — site** — add inside your `server { }` for `townpanchayat.com` (`/etc/nginx/conf.d/townpan.conf`). Full example: `ops/nginx-townpanchayat-phase1.conf`.

```nginx
location /api/portal-state {
    limit_req zone=portal_state burst=60 nodelay;
    proxy_pass http://127.0.0.1:5000;
    proxy_read_timeout 120s;
}

location = /api/health {
    proxy_pass http://127.0.0.1:5001/api/health;
    proxy_read_timeout 3s;
}
```

Then `sudo nginx -t && sudo systemctl reload nginx`.

## 5. Mobile “Network error / fetch failed / cancelled”

**Why:** The APK calls `POST https://townpanchayat.com/api/auth/login` on **port 5000**. When many devices poll **`/api/portal-state`**, the single Node process accept queue fills (`curl :5000` → `000`, while **`:5001/api/health`** stays **200**). The phone then aborts the request (55s timeout or reset) → user sees a network error, not “wrong password”.

**Permanent fix (server, no new APK):**

1. Deploy latest `main`, `npm run build`, `npm run prewarm-scope` (every inspection user should have a `user_scope_cache` row).
2. PM2 **cluster × 2**: `pm2 start ecosystem.config.cjs` (after pull).
3. Nginx: health → **5001**, rate-limit **portal-state**, dedicated **`location ^~ /api/auth/`** (see `ops/nginx-townpanchayat-phase1.conf`).
4. Cron: `0 5 * * * cd ~/tpms/New-Town-Panchayat && npm run prewarm-scope` (IST morning before field login).
5. If still saturated: larger EC2 or **4** PM2 instances.

**Verify on EC2:**

```bash
curl -s -o /dev/null -w 'login:%{http_code} %{time_total}s\n' --max-time 20 \
  -X POST http://127.0.0.1:5000/api/auth/login \
  -H 'Content-Type: application/json' -H 'X-Client: mobile' \
  -d '{"username":"YOUR_USER","password":"YOUR_PASS","client":"mobile"}'
```

Expect **200** or **401/403** in **&lt;3s** — not **000**. If **000**, capacity is still the bottleneck (cluster + limits + prewarm).

## 6. What Phase 1 changed (summary)

- Login: scope from **cache only**; background prewarm on master edits (no Mongo **drop**).
- `portal-state`: shared masters cache, per-user cache/coalesce, targeted user lookup.
- `server.js`: fast `/api/health`, 503 when too many heavy API calls in flight.
- Media: `/api/media` with dual S3 bucket fallback.