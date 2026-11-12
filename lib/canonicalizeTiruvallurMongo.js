'use strict';

const CANONICAL_DISTRICT_EN = 'Tiruvallur';
const CANONICAL_DISTRICT_TA = 'திருவள்ளூர்';
const CANONICAL_ZONE_EN = 'Tiruvallur';
const CANONICAL_ZONE_TA = 'திருவள்ளூர்';
/** Anchored name only — never match ids such as d_thiruvallur / z_thiruvallur. */
const NAME_RE = '^(the\\s+)?(thiru|tiru)[\\s-]*(vallur|valur|vallue|vallor|valloer)(\\s+(district|dt\\.?|zone))?$';
const TA_NAME_RE = '^திருவள்ளூர்';
const ID_RE = 'thiruvallur|tiruvallur';

function spellingFilter(fields) {
  const or = [];
  for (const field of fields) {
    or.push({ [field]: { $regex: NAME_RE, $options: 'i' } });
    or.push({ [field]: { $regex: TA_NAME_RE } });
  }
  return { $or: or };
}

function normKey(value) {
  return String(value || '').trim().toLowerCase();
}

function sameText(a, b) {
  return String(a || '').trim() === String(b || '').trim();
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

function indexById(docs) {
  const map = new Map();
  for (const doc of docs || []) {
    const id = normKey(doc && doc.id);
    if (id) map.set(id, doc);
  }
  return map;
}

function indexByUniqueName(docs) {
  const counts = new Map();
  const map = new Map();
  for (const doc of docs || []) {
    const name = normKey(doc && doc.nameEn);
    if (!name) continue;
    counts.set(name, (counts.get(name) || 0) + 1);
    map.set(name, doc);
  }
  for (const [name, count] of counts) {
    if (count > 1) map.delete(name);
  }
  return map;
}

function resolveParents(tp, districtById, zoneById) {
  const dist = tp && tp.districtId ? districtById.get(normKey(tp.districtId)) : null;
  const zoneFromTp = tp && tp.zoneId ? zoneById.get(normKey(tp.zoneId)) : null;
  const zoneFromDist = dist && dist.zoneId ? zoneById.get(normKey(dist.zoneId)) : null;
  const zone = zoneFromDist || zoneFromTp || null;
  return { dist: dist || null, zone };
}

function geoSetFromParents(tp, dist, zone) {
  const set = {};
  if (tp) {
    if (tp.id) set.tpId = tp.id;
    if (tp.nameEn) set.tpNameEn = tp.nameEn;
    if (tp.nameTa) set.tpNameTa = tp.nameTa;
  }
  if (dist) {
    if (dist.id) set.districtId = dist.id;
    if (dist.nameEn) set.districtNameEn = dist.nameEn;
    if (dist.nameTa) set.districtNameTa = dist.nameTa;
  }
  if (zone) {
    if (zone.id) set.zoneId = zone.id;
    if (zone.nameEn) set.zoneNameEn = zone.nameEn;
    if (zone.nameTa) set.zoneNameTa = zone.nameTa;
  }
  return set;
}

function needsGeoSet(doc, set) {
  for (const [key, value] of Object.entries(set)) {
    if (!sameText(doc[key], value)) return true;
  }
  return false;
}

async function bulkSetById(col, docsOrCursor, buildSet, label, stats) {
  const ops = [];
  let modified = 0;
  const flush = async () => {
    if (!ops.length) return;
    try {
      const res = await col.bulkWrite(ops.splice(0, ops.length), { ordered: false });
      modified += res.modifiedCount || 0;
    } catch (err) {
      console.warn(`[canonicalize-district] ${label} bulkWrite failed:`, err && err.message ? err.message : err);
    }
  };
  const consume = async (doc) => {
    const set = buildSet(doc);
    if (!set || !Object.keys(set).length || !needsGeoSet(doc, set)) return;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: set },
      },
    });
    if (ops.length >= 500) await flush();
  };
  if (docsOrCursor && typeof docsOrCursor[Symbol.asyncIterator] === 'function') {
    for await (const doc of docsOrCursor) {
      await consume(doc);
    }
  } else {
    for (const doc of docsOrCursor || []) {
      await consume(doc);
    }
  }
  await flush();
  stats[label] = (stats[label] || 0) + modified;
  return modified;
}

async function loadMasterMaps(db, nameCache) {
  const distCol = await collectionFor(db, ['districts', 'districts_master'], nameCache);
  const zoneCol = await collectionFor(db, ['zones', 'zones_master', 'zones_list'], nameCache);
  const tpCol = await collectionFor(db, ['townPanchayats', 'town_panchayats', 'townpanchayats'], nameCache);
  const [districts, zones, townPanchayats] = await Promise.all([
    distCol.find({}, { projection: { id: 1, nameEn: 1, nameTa: 1, zoneId: 1, zoneNameEn: 1, zoneNameTa: 1 } }).toArray(),
    zoneCol.find({}, { projection: { id: 1, nameEn: 1, nameTa: 1 } }).toArray(),
    tpCol
      .find(
        {},
        {
          projection: {
            id: 1,
            nameEn: 1,
            nameTa: 1,
            districtId: 1,
            districtNameEn: 1,
            zoneId: 1,
            zoneNameEn: 1,
            townPanchayatId: 1,
          },
        }
      )
      .toArray(),
  ]);
  return {
    distCol,
    zoneCol,
    tpCol,
    districts,
    zones,
    townPanchayats,
    districtById: indexById(districts),
    zoneById: indexById(zones),
    tpById: indexById(townPanchayats),
    tpByName: indexByUniqueName(townPanchayats),
  };
}

function findTp(doc, tpById, tpByName) {
  return (
    tpById.get(normKey(doc.tpId)) ||
    tpById.get(normKey(doc.townPanchayatId)) ||
    tpByName.get(normKey(doc.tpNameEn || doc.townPanchayat)) ||
    null
  );
}

/**
 * Restore zone / district / TP from town panchayat masters.
 * Spelling rewrite must not collapse every work onto Tiruvallur.
 */
async function repairGeoFromMasters(db, stats, nameCache) {
  console.log('[canonicalize-district] Repairing zone/district/TP from town panchayat masters ...');
  const masters = await loadMasterMaps(db, nameCache);

  const tpModified = await bulkSetById(
    masters.tpCol,
    masters.townPanchayats,
    (tp) => {
      const { dist, zone } = resolveParents(tp, masters.districtById, masters.zoneById);
      const set = {};
      if (dist) {
        if (dist.nameEn) set.districtNameEn = dist.nameEn;
        if (dist.nameTa) set.districtNameTa = dist.nameTa;
      }
      if (zone) {
        if (zone.id && !String(tp.zoneId || '').trim()) set.zoneId = zone.id;
        if (zone.nameEn) set.zoneNameEn = zone.nameEn;
        if (zone.nameTa) set.zoneNameTa = zone.nameTa;
      }
      return set;
    },
    'townPanchayats.geoRepair',
    stats
  );

  const workKeys = [
    ['inspectionWorks', 'inspection_works', 'inspectionworks'],
    ['wardsAndStreets', 'wards_and_streets', 'wardsandstreets'],
    ['inspectionUsers', 'inspection_users', 'inspectionusers'],
    ['users'],
    ['employees'],
  ];

  let worksRepaired = 0;
  for (const names of workKeys) {
    const col = await collectionFor(db, names, nameCache);
    const cursor = col.find(
      {},
      {
        projection: {
          tpId: 1,
          townPanchayatId: 1,
          tpNameEn: 1,
          tpNameTa: 1,
          townPanchayat: 1,
          districtId: 1,
          districtNameEn: 1,
          districtNameTa: 1,
          zoneId: 1,
          zoneNameEn: 1,
          zoneNameTa: 1,
        },
      }
    );
    const modified = await bulkSetById(
      col,
      cursor,
      (doc) => {
        const tp = findTp(doc, masters.tpById, masters.tpByName);
        if (tp) {
          const { dist, zone } = resolveParents(tp, masters.districtById, masters.zoneById);
          return geoSetFromParents(tp, dist, zone);
        }
        const dist = masters.districtById.get(normKey(doc.districtId));
        const zone =
          (dist && dist.zoneId ? masters.zoneById.get(normKey(dist.zoneId)) : null) ||
          masters.zoneById.get(normKey(doc.zoneId)) ||
          null;
        const set = {};
        if (dist) {
          if (dist.nameEn) set.districtNameEn = dist.nameEn;
          if (dist.nameTa) set.districtNameTa = dist.nameTa;
          if (zone) {
            if (zone.id) set.zoneId = zone.id;
            if (zone.nameEn) set.zoneNameEn = zone.nameEn;
            if (zone.nameTa) set.zoneNameTa = zone.nameTa;
          }
        } else if (zone) {
          if (zone.nameEn) set.zoneNameEn = zone.nameEn;
          if (zone.nameTa) set.zoneNameTa = zone.nameTa;
        }
        return set;
      },
      `${names[0]}.geoRepair`,
      stats
    );
    if (names[0] === 'inspectionWorks') worksRepaired += modified;
  }

  const distModified = await bulkSetById(
    masters.distCol,
    masters.districts,
    (dist) => {
      const zone = dist.zoneId ? masters.zoneById.get(normKey(dist.zoneId)) : null;
      if (!zone) return {};
      const set = {};
      if (zone.nameEn) set.zoneNameEn = zone.nameEn;
      if (zone.nameTa) set.zoneNameTa = zone.nameTa;
      return set;
    },
    'districts.geoRepair',
    stats
  );

  console.log(
    `[canonicalize-district] Geo repair done: townPanchayats=${tpModified} inspectionWorks=${worksRepaired} districts=${distModified}`
  );
  return worksRepaired;
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
    ['wardsAndStreets', 'wards_and_streets', 'wardsandstreets'],
  ];

  for (const names of workKeys) {
    const col = await collectionFor(db, names, nameCache);
    const label = names[0];
    await updateManySafe(
      col,
      spellingFilter(['districtNameEn', 'districtName', 'districtNameTa']),
      districtSet,
      `${label}.district`,
      stats
    );
    await updateManySafe(
      col,
      spellingFilter(['zoneNameEn', 'zoneName', 'zoneNameTa']),
      zoneSet,
      `${label}.zone`,
      stats
    );
  }

  await canonicalizeTiruvallurMasters(db, stats, nameCache);
  const repairedWorks = await repairGeoFromMasters(db, stats, nameCache);

  const modified = Object.keys(stats)
    .filter((k) => !k.endsWith('Matched'))
    .reduce((sum, k) => k === 'rollupsCleared' ? sum : sum + (stats[k] || 0), 0);
  const matched = Object.keys(stats)
    .filter((k) => k.endsWith('Matched'))
    .reduce((sum, k) => sum + (stats[k] || 0), 0);

  console.log(
    `[canonicalize-district] Done on "${dbName}": matched=${matched} modified=${modified} repairedWorks=${repairedWorks} → district="${CANONICAL_DISTRICT_EN}" zone="${CANONICAL_ZONE_EN}"`
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
    repairedWorks,
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
        { nameTa: { $regex: TA_NAME_RE } },
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
        { nameTa: { $regex: TA_NAME_RE } },
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
  repairGeoFromMasters,
  CANONICAL_DISTRICT_EN,
  CANONICAL_DISTRICT_TA,
  CANONICAL_ZONE_EN,
  CANONICAL_ZONE_TA,
};
