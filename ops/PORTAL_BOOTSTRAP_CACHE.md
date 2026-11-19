# Portal bootstrap cache (Mongo)

## What it does

`GET /api/portal-state?username=` tries **Mongo `portal_bootstrap_cache`** first (sub-second). On miss it builds once, stores the full JSON, and still uses in-memory coalesce (`X-Portal-Cache`).

## Collections

- **`portal_bootstrap_cache`** — one doc per `username|todayOnly` with `scopeVersion`, `mastersVersion`, `payload`.
- **`masters_meta`** — `{ _id: 'global', version }` bumped when portal masters change.

## Versioning

Serves cached payload only when `doc.scopeVersion` and `doc.mastersVersion` are **≥ current**. Older docs force a rebuild (accuracy).

## Prewarm (production)

```bash
# scope + portal bootstrap (admin)
curl -s "https://townpanchayat.com/api/state?rebuildCache=true"

# portal bootstrap only
curl -s "https://townpanchayat.com/api/state?rebuildPortalCache=true"
```

After `npm run build` on EC2: run rebuild once before morning peak.

## Headers

- `X-Portal-Cache`: `HIT-MONGO` | `STALE-MONGO` | `MISS-BUILD` | `HIT-MEM` …
- `X-Scope-Version`: current scope version

## Env

Optional: `PORTAL_PUBLIC_ORIGIN=https://townpanchayat.com` for media URLs during background rebuild.