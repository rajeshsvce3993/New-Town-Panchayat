'use strict';

const CANONICAL_DISTRICT_EN = 'Tiruvallur';
const CANONICAL_DISTRICT_TA = 'திருவள்ளூர்';
const CANONICAL_ZONE_EN = 'Tiruvallur';
const CANONICAL_ZONE_TA = 'திருவள்ளூர்';
const NAME_RE = '(thiru|tiru)[\\s-]*(vallur|valur|vallue|vallor|valloer)';
const ID_RE = 'thiruvallur|tiruvallur';

function spellingFilter(fields) {
  const or = [];
  for (const field of fields) {
    or.push({ [field]: { $regex: NAME_RE, $options: 'i' } });
    or.push({ [field]: { $regex: 'திருவள்ளூர்' } });
  }
  return { $or: or };
}

async function collectionFor(db, names, nameCache) {
  let existing = nameCache.names;
  if (!existing) {
    const listed = await db.listCollections().toArray();
    existing = listed.map((c) => c.name);
    nameCache.names = existing;
  }
  for (const name of names) {
    if (existing.includes(name)) return db.collection(name);
    const ci = existing.find((n) => String(n).toLowerCase() === String(name).toLowerCase());
    if (ci) return db.collection(ci);
  }
  return db.collection(names[0]);
}

async function updateManySafe(col, filter, set, label, stats) {
  try {
    const res = await col.updateMany(filter, { $set: set });
    const matched = res.matchedCount || 0;
    const modified = res.modifiedCount || 0;
    stats[label] = (stats[label] || 0) + modified;
    stats[`${label}Matched`] = (stats[`${label}Matched`] || 0) + matched;
  } catch (err) {
    console.warn(`[canonicalize-district] ${label} failed:`, err && err.message ? err.message : err);
    stats[label] = stats[label] || 0;
  }
}

async function canonicalizeTiruvallurSpellings(db) {
  const dbName = db && db.databaseName ? db.databaseName : 'unknown';
  console.log(`[canonicalize-district] Starting Tiruvallur spelling rewrite on DB "${dbName}" ...`);
  const stats = {};
  const nameCache = {};
  const districtSet = {
    districtNameEn: CANONICAL_DISTRICT_EN,
    districtNameTa: CANONICAL_DISTRICT_TA,
  };
  const zoneSet = {
    zoneNameEn: CANONICAL_ZONE_EN,
    zoneNameTa: CANONICAL_ZONE_TA,
  };
  const workKeys = [
    ['inspectionWorks', 'inspection_works', 'inspectionworks'],
    ['inspectionUsers', 'inspection_users', 'inspectionusers'],
    ['users'],
    ['employees'],
    ['townPanchayats', 'town_panchayats', 'townpanchayats'],
    ['districts', 'districts_master'],
    ['wardsAndStreets', 'wards_and_streets', 'wardsandstreets'],
    ['inspectionWorkReportRollups', 'inspection_work_report_rollups'],
  ];

  for (const names of workKeys) {
    const col = await collectionFor(db, names, nameCache);
    const label = names[0];
    await updateManySafe(
      col,
      spellingFilter(['districtNameEn', 'district', 'districtName', 'districtNameTa']),
      districtSet,
      `${label}.district`,
      stats
    );
    await updateManySafe(
      col,
      spellingFilter(['zoneNameEn', 'zone', 'zoneName', 'zoneNameTa']),
      zoneSet,
      `${label}.zone`,
      stats
    );
  }

  await canonicalizeTiruvallurMasters(db, stats, nameCache);

  const modified = Object.keys(stats)
    .filter((k) => !k.endsWith('Matched'))
    .reduce((sum, k) => sum + (stats[k] || 0), 0);
  const matched = Object.keys(stats)
    .filter((k) => k.endsWith('Matched'))
    .reduce((sum, k) => sum + (stats[k] || 0), 0);

  console.log(
    `[canonicalize-district] Done on "${dbName}": matched=${matched} modified=${modified} → district="${CANONICAL_DISTRICT_EN}" zone="${CANONICAL_ZONE_EN}"`
  );
  if (modified === 0) {
    console.log(
      '[canonicalize-district] No documents were rewritten. Names are already Tiruvallur, or this database has no matching rows.'
    );
  }
  return {
    canonicalEn: CANONICAL_DISTRICT_EN,
    canonicalTa: CANONICAL_DISTRICT_TA,
    canonicalZoneEn: CANONICAL_ZONE_EN,
    collections: stats,
    matched,
    modified,
    dbName,
  };
}

async function canonicalizeTiruvallurMasters(db, stats, nameCache) {
  const dbName = db && db.databaseName ? db.databaseName : 'unknown';
  const standalone = !stats;
  if (standalone) {
    console.log(`[canonicalize-district] Updating zone and district names on DB "${dbName}" ...`);
  }
  const nextStats = stats || {};
  const nextCache = nameCache || {};
  const distCol = await collectionFor(db, ['districts', 'districts_master'], nextCache);
  await updateManySafe(
    distCol,
    {
      $or: [
        { nameEn: { $regex: NAME_RE, $options: 'i' } },
        { name: { $regex: NAME_RE, $options: 'i' } },
        { nameTa: { $regex: 'திருவள்ளூர்' } },
        { id: { $regex: ID_RE, $options: 'i' } },
      ],
    },
    { nameEn: CANONICAL_DISTRICT_EN, nameTa: CANONICAL_DISTRICT_TA },
    'districts.name',
    nextStats
  );

  const zoneCol = await collectionFor(db, ['zones', 'zones_master', 'zones_list'], nextCache);
  await updateManySafe(
    zoneCol,
    {
      $or: [
        { nameEn: { $regex: NAME_RE, $options: 'i' } },
        { name: { $regex: NAME_RE, $options: 'i' } },
        { nameTa: { $regex: 'திருவள்ளூர்' } },
        { id: { $regex: ID_RE, $options: 'i' } },
      ],
    },
    { nameEn: CANONICAL_ZONE_EN, nameTa: CANONICAL_ZONE_TA },
    'zones.name',
    nextStats
  );
  if (standalone) {
    console.log(
      `[canonicalize-district] Master names done on "${dbName}": districts modified=${nextStats['districts.name'] || 0} matched=${nextStats['districts.nameMatched'] || 0}; zones modified=${nextStats['zones.name'] || 0} matched=${nextStats['zones.nameMatched'] || 0}`
    );
  }
  return nextStats;
}

module.exports = {
  canonicalizeTiruvallurSpellings,
  canonicalizeTiruvallurMasters,
  CANONICAL_DISTRICT_EN,
  CANONICAL_DISTRICT_TA,
  CANONICAL_ZONE_EN,
  CANONICAL_ZONE_TA,
};
