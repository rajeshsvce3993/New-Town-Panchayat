# Agent log

## 2026-11-20 — Live-only geo (no fallback names)

- Mobile work details and Add Work dropdowns now use live Mongo names only (`/api/geo/me`, `/api/masters/scope`, saved work document).
- Removed placeholder geo labels (`All Districts`, `All Town Panchayats`, dummy wards 1–18, `General Inspection` / `Field Check`, fabricated `Street N`).
- Refresh no longer paints `cached_portal_state` when live bootstrap fails; last in-memory live portal is kept.
- Street stamp always reads `inspectionUsers`, never `user_scope_cache`.
- App version remains **2.0.11 / 111**. Deploy API/web first, then rebuild the APK.
