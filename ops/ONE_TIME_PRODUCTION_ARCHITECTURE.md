# One-time production architecture (no server cache, no portal-state, no polling storms)

**Audience:** EC2 + Mongo + current mobile APK (must ship **one** coordinated mobile update for full cutover).

**You are willing to scale CPU** — use that for **concurrent indexed Mongo reads**, not for **rebuilding the same JSON thousands of times**.

---

## What to stop permanently

| Stop | Why |
|------|-----|
| `GET /api/portal-state` as mobile bootstrap | Fat aggregation; causes 4–9s + server meltdown |
| Runtime reads from `user_scope_cache` | Stale scope / wrong district risk; hides master bugs |
| Runtime reads from `portal_bootstrap_cache` | Same |
| `GET /api/state` full bootstrap on mobile | Loads entire masters into memory |
| `rebuildCache` / prewarm at morning peak | CPU spike; not needed with live slim APIs |
| `npm run build` scope prewarm as production dependency | One-time data fix instead |
| Hardcoded Kanchipuram / Chengalpattu / Thiruporur in APIs & mobile UI | Masks Erode / real TP |
| Mobile **timer** calling full portal refresh (`OFFLINE_SYNC_MS` → portal-state) | “Every 15s / 5m” server hammer |

---

## One-time truth model (Mongo only on server)

```
inspectionUsers.tpId  →  townPanchayats  →  districts  →  zones
inspectionWorks.*     →  stamped on write from masters (zoneId, districtId, tpId)
```

Every API **recomputes display from this chain** (no cached JSON documents on server).

---

## Replace portal-state with four APIs (each &lt; 1s target on 4 vCPU)

| # | Method | Purpose | When called |
|---|--------|---------|-------------|
| 1 | `POST /api/auth/login` | Auth + `user` + **ids only** (`tpId`, `districtId`, `zoneId`) | Sign in |
| 2 | `GET /api/geo/me` | Zone/district/TP **names** from masters | Once after login (+ after master edit if admin notifies) |
| 3 | `GET /api/masters/scope` | Subjects, categories, fields, **wards for tpId only** | Once after login |
| 4 | `GET /api/inspection-works?username&limit=80&since=` | Reports list | Login + after submit / pull-to-refresh |

**Web:** keep `GET /api/state?key=...` per admin screen — never load all collections in one response.

**No fifth “portal-state” bundle.**

---

## Mobile: one-time behaviour (requires APK/OTA)

| Today (remove) | Target |
|----------------|--------|
| After login: `getPortalState()` | Parallel: `geo/me` + `masters/scope` + `inspection-works` **once** |
| `refreshPortal()` on interval (15s sync path) | **Only** after work submit success or user “Refresh” |
| Scope background sync every 15 min | **Remove** or only `GET /api/scope/version` → refetch scope **if version changed** |
| Save result in **device** `AsyncStorage` (`prefs.setPortal`) | **OK** — that is **on-phone** cache until logout, not server cache |

Server does **not** store per-user portal JSON. Phone may store **its last download** until logout (normal offline UX).

---

## Server: one-time cleanup (before cutover)

1. **Mongo audit script** (run once): every `townPanchayats` row has correct `districtId` / `zoneId`; fix Pethanaikanpalayam → Erode.
2. **Users:** set `tpId`; clear misleading `district` / `zone` text fields used for display.
3. **Disable** runtime flags: `DISABLE_SCOPE_CACHE=1`, `DISABLE_PORTAL_STATE=1` (to be added at implement time).
4. **Optional:** rename old collections to `*_archive` — do not drop (audit trail).

---

## Infrastructure (one-time sizing)

| Load | Recommendation |
|------|----------------|
| ~200–400 field users peak | **4 vCPU, 8 GB RAM**, PM2 **4** workers |
| ~1000+ | **8 vCPU, 16 GB** |

Nginx (keep):

- `/api/health` → 5001
- Rate limit legacy `portal-state` until APK uptake = 0, then **410 Gone**
- `/api/auth/` high burst

---

## Cutover window (single maintenance, ~2 hours)

1. Deploy server: new APIs + portal-state returns **410** or thin adapter (toggle).
2. Publish mobile build that **never** calls `portal-state`.
3. Run Mongo geo audit fix.
4. `pm2 restart` on resized instance.
5. Smoke: 10 users login → verify district/TP on screen.
6. Remove adapter / prewarm scripts from `package.json` when traffic clean.

---

## Success metrics

- Zero `GET /api/portal-state` in access logs (after cutover).
- p95 &lt; 1s for login, geo/me, masters/scope, inspection-works.
- No `user_scope_cache` / `portal_bootstrap_cache` reads in application logs.
- District/TP on device matches Mongo masters for sample users (Erode case included).

---

## What **not** to do again

- “Phase 1 cache” as primary performance strategy.
- Prewarm 1000+ users during office hours.
- Default geo strings when master lookup fails (show error or “Master data missing” instead).

This is the **one-time** target architecture; implementation is phased but **product direction** does not return to portal-state + server-side user cache.