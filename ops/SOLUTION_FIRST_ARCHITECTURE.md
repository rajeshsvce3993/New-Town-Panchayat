# Solution-first architecture (replace `storage.ts` patterns — no more bootstrap/cache)

This is the **target production design**. Implementation follows this document; we do **not** add more “phase 1 cache” or “lite bootstrap” logic inside `lib/storage.ts`.

---

## Why `storage.ts` still exists today

`lib/storage.ts` (~4.7k lines) is a **legacy monolith** that combines:

- Mongo client + indexes
- Local JSON “fake DB” fallback (`INITIAL_DATA`, `readLocalDb`)
- **Entire portal JSON** assembly (`getFullDatabaseState`, `getPortalBootstrapState`, `assemblePortalState`)
- User geo enrichment (`enrichUserForApp`) on **every** user row
- Scope cache rebuild hooks, dashboard stats, inspection work CRUD, S3 uploads, employees, settings

**Twenty+ API routes** import from it with one line: `from '@/lib/storage'`.

That design made sense for an offline-first demo; it is **the root cause** of slow web + mobile:

| Anti-pattern in `storage.ts` | Symptom |
|------------------------------|---------|
| Load many collections → one JSON | Multi-second `/api/state`, `/api/portal-state` |
| `enrichUserForApp` on all inspection users per request | CPU spikes |
| `user_scope_cache` / `portal_bootstrap_cache` rebuild | Wrong geo, morning CPU melt |
| `INITIAL_DATA` / hardcoded districts when lookup fails | Kanchipuram defaults |

**Recent “web-lite bootstrap” splits are still inside this monolith** — they reduce pain but are **not** the solution. The solution is to **stop calling those functions** and **delete** the bootstrap/cache path.

---

## Principle: solution first

1. **One API = one Mongo concern** (indexed query, bounded payload).
2. **No server-side per-user JSON documents** (`user_scope_cache`, `portal_bootstrap_cache`, in-memory portal blobs as hot path).
3. **No full-state GET** for clients (`/api/state` without `?key=`, `/api/portal-state`).
4. **Geo from masters only** — if master row missing, return **error**, not `INITIAL_DATA` defaults.
5. **Split `storage.ts`** into small modules; **do not grow** `storage.ts` further.

---

## Target module layout (replace `storage.ts` over time)

```
lib/db/
  mongo.ts              # getMongoClient, getActiveMongoDb, ensureDatabaseIndexes (from storage)
  collections.ts        # getCollectionData → rename to repo getters per collection

lib/domain/
  geoResolver.ts        # user.tpId → TP → district → zone (single function, used everywhere)
  userEnrichment.ts     # enrich ONE user for login response only (not bulk)

lib/repositories/
  mastersRepository.ts  # districts, zones, townPanchayats, subjects, categories, fields, wards by tpId
  usersRepository.ts    # portal users, inspection users (indexed by username / tpId)
  worksRepository.ts    # move from inspectionWorksMongoRepository + storage work helpers

lib/services/
  inspectionWorkService.ts  # save, id generation, S3 side effects
  uploadService.ts          # S3 from storage upload* functions
  settingsService.ts        # app settings document only
```

**End state:** `storage.ts` **deleted** or a thin **re-export shim** during migration (max one release).

---

## Target HTTP surface (authoritative)

### Mobile (replaces `portal-state`)

| API | Data |
|-----|------|
| `POST /api/auth/login` | `user`, `tpId`, `districtId`, `zoneId`, `scopeVersion`, optional minimal `scope` |
| `GET /api/geo/me?username=` | Resolved names + ids |
| `GET /api/masters/scope?username=` or `?tpId=` | Subjects, categories, fields, wards **for that TP** |
| `GET /api/inspection-works?username&limit&since=` | List only |
| `GET /api/scope/version` | Unchanged — cheap version check |
| Existing: upload, queue, notifications, media | Unchanged |

**Remove from mobile hot path:** `GET /api/portal-state`, bulk `GET /api/scope/user` if it rebuilds scope from full DB.

### Web admin (replaces `/api/state?mode=bootstrap|web|full`)

| Screen need | API |
|-------------|-----|
| Login | `POST /api/auth/login` (already) |
| Dashboard KPIs | `GET /api/dashboard/stats` (already) |
| Masters editor | `GET/POST /api/state?key=<collection>` **per collection** (keep narrow `key=` only) |
| Inspection reports grid | `GET /api/inspection-works?…` + filter masters from `GET /api/masters/filters` (scoped) |
| User management | `GET /api/state?key=inspectionUsers` when tab opens — not on every page load |

**Remove from web hot path:**

- `GET /api/state` **without** `key` and **without** `mode=extended`
- `loadPortalBootstrap()` / `portalBootstrapClient` session mega-cache as **required** boot step
- Dashboard timer reloading full state

### Explicitly retired (return 410 after cutover)

- `GET /api/portal-state`
- `GET /api/state?mode=bootstrap|web|full|extended`
- `GET /api/state?rebuildCache=true` / `rebuildPortalCache=true` as operator habit

---

## Data rules (no hardcoded geo)

1. `inspectionUsers.tpId` required for field staff.
2. `townPanchayats.districtId` / `zoneId` authoritative — **ignore** free-text `user.district` for display.
3. `geoResolver` is the **only** place that maps ids → names.
4. Delete or stop using `portalStructuralDefaults()` and `INITIAL_DATA` districts/zones on **server responses** (keep only for dev seed if needed).

---

## Infrastructure (you approved CPU increase)

- EC2 **4 vCPU / 8 GB** (or 8/16 at scale)
- PM2 `instances: 4`, `exec_mode: cluster`
- Nginx: health on 5001; rate-limit `portal-state` until gone
- Mongo: indexes on `inspectionUsers.username`, `inspectionUsers.mobile`, `inspectionWorks.username` + `createdAt`, `townPanchayats.id`

**Redis:** later, optional for rate limits only — **not** for portal JSON.

---

## Implementation order (solution-only — no parallel cache track)

### Step 0 — Freeze the monolith

- **No new** functions in `storage.ts` except moves to `lib/db` / `lib/repositories`.
- Revert or ignore “lite bootstrap” as strategy; treat as disposable once Step 3 lands.

### Step 1 — Core primitives (server)

1. Extract `lib/db/mongo.ts` + `lib/domain/geoResolver.ts` from `storage.ts`.
2. Implement `GET /api/geo/me`.
3. Implement `GET /api/masters/scope` (tp-scoped queries only).
4. Slim `POST /api/auth/login` to use `geoResolver` (no `buildPortalStatePayload`).

### Step 2 — Web portal client

1. `PortalApp`: on session start, **parallel** `settings` + `dashboard/stats` + masters needed for active tab only.
2. Remove dependency on `loadPortalBootstrap()` for first paint.
3. Each admin view fetches its `?key=` when opened (pattern already in `InspectionEmployeeManagementView`).

### Step 3 — Mobile client (one OTA/APK)

1. Replace `getPortalState()` with login + geo + scope + works (parallel).
2. Remove `refreshPortal` on 15s interval; refresh on submit / manual only.
3. Device `AsyncStorage` = offline UX only.

### Step 4 — Decommission

1. `portal-state/route.ts` → 410
2. Delete: `portalBootstrapCache.ts`, `buildPortalStatePayload.ts`, `userScopeCache.ts` hot path, `portalMastersCache.ts` hot path
3. Remove `getPortalBootstrapState`, `getFullDatabaseState`, `getPortalExtendedState`, `assemblePortalState` from codebase
4. Split remaining `storage.ts` into repos/services; delete file

### Step 5 — Mongo one-time data fix

- Audit TPs/users (Erode / Pethanaikanpalayam case)
- Archive `user_scope_cache`, `portal_bootstrap_cache` collections

---

## How to know you’re done

| Check | Pass |
|-------|------|
| `storage.ts` line count | 0 (or shim only) |
| Access logs | No `portal-state`, no `state?mode=` |
| Login p95 | < 1s |
| Web first meaningful paint | Settings + stats without 16-collection fetch |
| Wrong district reports | None in sample audit |

---

## What to do **now** (decision)

Choose **one** cutover path:

**A. Solution-only (recommended)** — Pause band-aids; implement Step 1 + Step 2 in next dev sprint; ship mobile Step 3 same release as Step 4 on server.

**B. Keep current prod running** — Deploy nginx/CPU only; accept `storage.ts` until Step 1 ships (documented debt, not “fixed”).

Do **not** invest further in `portal_bootstrap_cache`, `mode=web` bootstrap, or scope prewarm — they conflict with this document.

See also: [`ONE_TIME_PRODUCTION_ARCHITECTURE.md`](./ONE_TIME_PRODUCTION_ARCHITECTURE.md).