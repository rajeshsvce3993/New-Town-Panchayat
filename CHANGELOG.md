# Changelog

## [Unreleased]

### Changed
- Inspection geo (district, town panchayat, ward, street) is live Mongo data only. Placeholder names and seed/cache fallbacks are not shown on mobile or written onto new works.

### Fixed
- Mobile dashboard and reports now load the signed-in user’s old and new works (all-time identity query). Today-only API window, WRK-only list filter, and default Today date chips no longer hide older TP-prefixed rows. Login fetch stays a short indexed query (80 rows, no fields dump).
- Saving a work stamps zone, district, and town panchayat from the selected master id. Leftover inspector TP is not copied when the work already has a place id.
- Creating a field-worker inspection user now shows ward selection for the chosen town panchayat (live wards from Mongo, not the empty portal street dump).
- Web portal inspection reports and work details now follow the user’s role place (zone / district / assigned TP). A leftover login snapshot TP no longer hides or remaps another area’s works.
- Existing inspection works with leftover wrong zone/district/TP can be repaired from Mongo (`scripts/repair-inspection-works-geo.mjs`, dry-run by default). Zonal/multi-TP works are not forced onto a leftover default TP.
- Add Work now requires a live GPS fix: the app asks for location permission and will not save a work with placeholder coordinates.
- Reports and work details show the zone, district, town panchayat, ward, and street stored on that work. Leftover portal TP rows are not used to fill a different place.
- Inspection works are attributed and listed by login username / user id only. Display-name matching no longer maps a Theni officer’s list to another district’s works.
- Saved works keep the District / TP / ward / street the user selected. Leftover inspector town panchayat is not copied onto zonal or multi-TP submissions.
- Mobile login no longer waits for the full street/subject/field scope (or a second profile-photo request) before opening the home screen.
- Work details no longer display dummy district/TP/ward/street values from portal cache or seed templates.
- Add Work no longer invents admin wards 1–18 or default subject/category names.
- Mobile district and town panchayat lists now follow the user’s inspection role (single TP, multi TP, zonal, field worker) instead of a statewide HOD dump.
- Add Work and Profile now follow role place rules: zonal users pick District and TP; multi-TP users have a locked assigned district and a TP dropdown; single-TP / field workers have both locked to the assigned town panchayat. Profile shows live zone/district/TP labels instead of a leftover default TP.
