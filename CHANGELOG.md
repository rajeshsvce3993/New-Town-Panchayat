# Changelog

## [Unreleased]

### Changed
- Inspection geo (district, town panchayat, ward, street) is live Mongo data only. Placeholder names and seed/cache fallbacks are not shown on mobile or written onto new works.

### Fixed
- Work details no longer display dummy district/TP/ward/street values from portal cache or seed templates.
- Add Work no longer invents admin wards 1–18 or default subject/category names.
- Mobile district and town panchayat lists now follow the user’s inspection role (single TP, multi TP, zonal, field worker) instead of a statewide HOD dump.
- Add Work and Profile now follow role place rules: zonal users pick District and TP; multi-TP users have a locked assigned district and a TP dropdown; single-TP / field workers have both locked to the assigned town panchayat. Profile shows live zone/district/TP labels instead of a leftover default TP.
