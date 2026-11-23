# Agent log

## 2026-11-23 — DB repair for mismatched work geo

- Replaced the unsafe geo repair (it stamped `selectedTpIds[0]` onto every work, including zonal leftover TPs).
- New `scripts/repair-inspection-works-geo.mjs` is role-aware and identity-only: single-TP/field worker leftover TP → assigned TP; multi-TP / zonal keep a TP that is in their assigned list/zone and restamp district/zone/street from masters. Dry-run by default; `--apply` writes.
- Tests: `node --test scripts/test-repair-work-geo.mjs`. Run dry-run on the server with `MONGODB_URI`, then `--apply` if the sample rows look correct.

## 2026-11-23 — Mandatory GPS and work-document place

- Add Work now prompts for location (OS Allow dialog + settings) and blocks continue/submit until a live GPS fix is captured. Placeholder Chengalpattu coords are no longer used. Offline queue/sync files were not changed.
- Reports/details show zone, district, TP, ward, and street from the saved work document. Portal is not used to infer district/zone from a leftover TP id.
- POST `/api/inspection-works` validates against live Mongo `buildLiveUserScope`, not `user_scope_cache`.
- Tests: `node --test scripts/test-work-place-gps.mjs scripts/test-work-identity.mjs scripts/test-role-place.mjs`. Deploy API, reload the app, log out/in, allow location on Add Work.

## 2026-11-23 — Work identity and place mapping

- Root cause: works were matched by officer display name, and save-path geo overwrote the selected TP with leftover inspector district/TP (Theni user seeing Tiruvannamalai works).
- Login identity (`username` / `id` / mobile) is now the only list key. Display names are ignored.
- Add Work now sends `tpId` / `districtId` / `zoneId`; stamp uses those ids and fills inspector TP only for true single-TP users with no selected TP.
- Tests: `node --test scripts/test-work-identity.mjs scripts/test-role-place.mjs`. Deploy API, then rebuild/reload the app and log out/in.

## 2026-11-20 — Faster mobile login

- Login now returns a slim live place payload (zone/district/TP + profile) instead of loading every street, subject, and field before the spinner ends.
- Duplicate geo/profile lookups and a blocking profile-photo fetch were removed from the sign-in path. Full masters still load after login via `/api/masters/scope`.
- Tests: `node --test scripts/test-role-place.mjs`. Deploy API, then log out/in.

## 2026-11-20 — Role District/TP pickers and profile

- Add Work: zonal = two unlocked live dropdowns; multi-TP = district locked, TP changeable; single-TP / field worker = both locked to assigned place.
- Profile (home + settings) reads live `/api/geo/me` lists: zone + counts for zonal, assigned district + TPs for multi-TP, assigned district + TP for single-TP.
- Login/scope no longer copies every zone TP onto `selectedTpIds` or a leftover default TP name for zonal users.
- Tests: `node --test scripts/test-role-place.mjs`. App version remains **2.0.11 / 111**. Deploy API then log out/in on the app.

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
