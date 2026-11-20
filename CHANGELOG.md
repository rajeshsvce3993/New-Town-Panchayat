# Changelog

## [Unreleased]

### Changed
- Inspection geo (district, town panchayat, ward, street) is live Mongo data only. Placeholder names and seed/cache fallbacks are not shown on mobile or written onto new works.

### Fixed
- Work details no longer display dummy district/TP/ward/street values from portal cache or seed templates.
- Add Work no longer invents admin wards 1–18 or default subject/category names.
- Mobile district and town panchayat lists now follow the user’s inspection role (single TP, multi TP, zonal, field worker) instead of a statewide HOD dump.
