# Agent log

## 2026-11-20 — Zonal user default TP overwrite

- Saving a zonal employee no longer stamps a leftover/default town panchayat (that TP’s district/zone was replacing the selected zone).
- Live geo loads districts/TPs by the assigned zone id/name only; empty zone no longer returns every district.
- Mobile Add Work only selects a district/TP that exists in the live scoped lists.

## 2026-11-20 — Role-scoped live districts / TPs

- Inspection role catalog (`role_single_tp`, `role_multi_tp`, `role_zonal`, field worker) now wins over a stale HOD/all `scopeType`.
- `isHodLikeUser` no longer treats Assistant Director / Zonal Inspector as statewide (the old `role.includes('director')` match).
- Single-TP and field users load only their assigned TP (id or name). They no longer inherit every TP in the district or zone.
- Mobile Add Work picker uses live `scopeKind` from `/api/geo/me`.

## 2026-11-20 — Live-only geo (no fallback names)

- Mobile work details and Add Work dropdowns now use live Mongo names only (`/api/geo/me`, `/api/masters/scope`, saved work document).
- Removed placeholder geo labels (`All Districts`, `All Town Panchayats`, dummy wards 1–18, `General Inspection` / `Field Check`, fabricated `Street N`).
- Refresh no longer paints `cached_portal_state` when live bootstrap fails; last in-memory live portal is kept.
- Street stamp always reads `inspectionUsers`, never `user_scope_cache`.
- App version remains **2.0.11 / 111**. Deploy API/web first, then rebuild the APK.
