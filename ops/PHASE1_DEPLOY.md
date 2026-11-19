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

Add inside your `server { }` for `townpanchayat.com`:

```nginx
limit_req_zone $binary_remote_addr zone=portal_state:10m rate=30r/s;

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

## 5. What Phase 1 changed (summary)

- Login: scope from **cache only**; background prewarm on master edits (no Mongo **drop**).
- `portal-state`: shared masters cache, per-user cache/coalesce, targeted user lookup.
- `server.js`: fast `/api/health`, 503 when too many heavy API calls in flight.
- Media: `/api/media` with dual S3 bucket fallback.