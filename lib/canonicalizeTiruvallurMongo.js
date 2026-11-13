'use strict';

const { stampWorkGeoFromMasters } = require('./stampWorkGeo.js');

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

function indexByUniquePlace(docs) {
  const owners = new Map();
  const byId = new Map();
  for (const doc of docs || []) {
    const id = String((doc && doc.id) || '').trim();
    if (id) byId.set(id, doc);
    const keys = new Set(
      [placeKey(doc && doc.nameEn), placeKey(doc && doc.nameTa), idPlace(doc && doc.id), normKey(doc && doc.nameEn)].filter(Boolean)
    );
    for (const key of keys) {
      if (!owners.has(key)) owners.set(key, new Set());
      owners.get(key).add(id || key);
    }
  }
  const map = new Map();
  for (const [key, ids] of owners) {
    if (ids.size !== 1) continue;
    const id = [...ids][0];
    map.set(key, byId.get(id) || null);
  }
  return map;
}

function idPlace(id) {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/^(z|d|tp)_/, '')
    .replace(/^thiru/, 'tiru');
}

function placeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^(the\s+)/, '')
    .replace(/\s+(zone|district|dt\.?|மண்டலம்|மாவட்டம்)$/i, '')
    .replace(/^(thiru)/, 'tiru')
    .replace(/[\s-]+/g, '');
}

function findUniqueZoneForDistrict(district, zones) {
  const dPlace = idPlace(district && district.id);
  if (dPlace) {
    const idHits = (zones || []).filter((z) => idPlace(z && z.id) === dPlace);
    if (idHits.length === 1) return idHits[0];
  }
  const dKey = placeKey(district && district.nameEn) || placeKey(district && district.nameTa);
  if (!dKey) return null;
  const nameHits = (zones || []).filter((z) => {
    const zKey = placeKey(z && z.nameEn) || placeKey(z && z.nameTa);
    return zKey && zKey === dKey;
  });
  return nameHits.length === 1 ? nameHits[0] : null;
}

function resolveDistrictZone(district, townPanchayats, zones, zoneById) {
  const named = findUniqueZoneForDistrict(district, zones);
  if (named) return named;
  const distKey = normKey(district && district.id);
  const votes = new Map();
  for (const tp of townPanchayats || []) {
    if (normKey(tp && tp.districtId) !== distKey) continue;
    const zid = normKey(tp && tp.zoneId);
    if (!zid || !zoneById.get(zid)) continue;
    votes.set(zid, (votes.get(zid) || 0) + 1);
  }
  if (votes.size) {
    let best = '';
    let bestN = 0;
    let total = 0;
    for (const [zid, n] of votes) {
      total += n;
      if (n > bestN) {
        best = zid;
        bestN = n;
      }
    }
    if (best && bestN * 2 >= total) return zoneById.get(best) || null;
  }
  const existing = district && district.zoneId ? zoneById.get(normKey(district.zoneId)) : null;
  return existing || null;
}

function resolveParents(tp, districtById, zoneById) {
  const dist = tp && tp.districtId ? districtById.get(normKey(tp.districtId)) : null;
  const zoneFromTp = tp && tp.zoneId ? zoneById.get(normKey(tp.zoneId)) : null;
  const zoneFromDist = dist && dist.zoneId ? zoneById.get(normKey(dist.zoneId)) : null;
  const zone = zoneFromTp || zoneFromDist || null;
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
            code: 1,
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
    districtByPlace: indexByUniquePlace(districts),
    zoneByPlace: indexByUniquePlace(zones),
    tpByPlace: indexByUniquePlace(townPanchayats),
  };
}

function findTp(doc, tpById) {
  return tpById.get(normKey(doc.tpId)) || tpById.get(normKey(doc.townPanchayatId)) || null;
}

const ROLLUP_SEP = '\x1f';
const ROLLUP_LIVE = 'inspectionWorkReportRollups';
const ROLLUP_BUILD = 'inspectionWorkReportRollups_build';
const ROLLUP_PREV = 'inspectionWorkReportRollups_prev';

function masterFromValue(value, byId, byPlace) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return byId.get(normKey(raw)) || byPlace.get(placeKey(raw)) || byPlace.get(normKey(raw)) || null;
}

function uniqueTpInScope(name, townPanchayats, matchesScope) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const key = placeKey(raw) || normKey(raw);
  const hits = (townPanchayats || []).filter((tp) => {
    if (!matchesScope(tp)) return false;
    return placeKey(tp && tp.nameEn) === key || placeKey(tp && tp.nameTa) === key || normKey(tp && tp.nameEn) === normKey(raw);
  });
  return hits.length === 1 ? hits[0] : null;
}

function emptyGeoFilter() {
  return {
    $or: [
      {
        $and: [
          { $or: [{ zoneId: { $in: [null, ''] } }, { zoneId: { $exists: false } }] },
          { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
          { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
          { $or: [{ townPanchayatId: { $in: [null, ''] } }, { townPanchayatId: { $exists: false } }] },
        ],
      },
      {
        $and: [
          { zoneId: { $type: 'string', $ne: '' } },
          { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
          { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
        ],
      },
      { $and: [{ zoneId: { $type: 'string', $ne: '' } }, { zoneId: { $not: /^z_/i } }] },
      { $and: [{ districtId: { $type: 'string', $ne: '' } }, { districtId: { $not: /^d_/i } }] },
      { $and: [{ tpId: { $type: 'string', $ne: '' } }, { tpId: { $not: /^tp_/i } }] },
    ],
  };
}

function inspectorFromDoc(doc, userByName) {
  if (!userByName) return null;
  return (
    userByName.get(normKey(doc && doc.submittedByUserId)) ||
    userByName.get(normKey(doc && doc.submittedByUserName)) ||
    userByName.get(normKey(doc && doc.username)) ||
    null
  );
}

function resolveMissingGeo(doc, masters) {
  const stamped = stampWorkGeoFromMasters(doc, {
    townPanchayats: masters.townPanchayats,
    districts: masters.districts,
    zones: masters.zones,
    inspector: inspectorFromDoc(doc, masters.userByName),
  });
  const tp = stamped.tpId ? masters.tpById.get(normKey(stamped.tpId)) : null;
  const dist = stamped.districtId ? masters.districtById.get(normKey(stamped.districtId)) : null;
  const zone = stamped.zoneId ? masters.zoneById.get(normKey(stamped.zoneId)) : null;
  const set = geoSetFromParents(tp, dist, zone);
  return Object.keys(set).length ? set : null;
}

function rollupDocId(dims) {
  return [
    dims.submittedDateYmd || '',
    dims.zoneId || '',
    dims.districtId || '',
    dims.tpId || '',
    dims.wardNumber || '',
    dims.submittedByUserName || '',
    dims.subjectId || 'unknown',
    dims.categoryId || '_unknown',
  ].join(ROLLUP_SEP);
}

async function loadUserNameMap(db, nameCache) {
  const map = new Map();
  for (const names of [
    ['inspectionUsers', 'inspection_users', 'inspectionusers'],
    ['users'],
  ]) {
    const col = await collectionFor(db, names, nameCache);
    const docs = await col
      .find(
        {},
        {
          projection: {
            username: 1,
            userName: 1,
            mobile: 1,
            id: 1,
            tpId: 1,
            townPanchayatId: 1,
            districtId: 1,
            zoneId: 1,
          },
        }
      )
      .toArray();
    for (const u of docs || []) {
      for (const key of [u.username, u.userName, u.mobile, u.id]) {
        const n = normKey(key);
        if (n && !map.has(n)) map.set(n, u);
      }
    }
  }
  return map;
}

async function moveRollupCounts(db, moves) {
  if (!moves.length) return 0;
  const names = [ROLLUP_LIVE, ROLLUP_BUILD, ROLLUP_PREV];
  let applied = 0;
  for (const name of names) {
    const col = db.collection(name);
    const ops = [];
    const flush = async () => {
      if (!ops.length) return;
      try {
        await col.bulkWrite(ops.splice(0, ops.length), { ordered: false });
      } catch (err) {
        if (!(err && (err.code === 26 || String(err.message || '').includes('ns not found')))) {
          console.warn(`[geo-hierarchy] ${name} rollup move failed:`, err && err.message ? err.message : err);
        }
      }
    };
    for (const move of moves) {
      if (move.oldId && move.oldId !== move.newId) {
        ops.push({
          updateOne: {
            filter: { _id: move.oldId },
            update: { $inc: { count: -1 } },
          },
        });
        ops.push({
          deleteOne: { filter: { _id: move.oldId, count: { $lte: 0 } } },
        });
      }
      ops.push({
        updateOne: {
          filter: { _id: move.newId },
          update: {
            $inc: { count: 1 },
            $set: {
              zoneId: move.zoneId,
              districtId: move.districtId,
              tpId: move.tpId,
            },
            $setOnInsert: {
              submittedDateYmd: move.submittedDateYmd,
              wardNumber: move.wardNumber || '',
              submittedByUserName: move.submittedByUserName || '',
              subjectId: move.subjectId || 'unknown',
              categoryId: move.categoryId || '_unknown',
            },
          },
          upsert: true,
        },
      });
      applied += 1;
      if (ops.length >= 400) await flush();
    }
    await flush();
  }
  return applied;
}

/**
 * Blank Location-wise rows (- - - N) are inspections with no zone/district/TP id.
 * Fill ids from stored names or the inspector's master row, then move report buckets.
 */
async function stampMissingWorkGeo(db, masters, stats, nameCache) {
  masters.userByName = await loadUserNameMap(db, nameCache);
  const col = await collectionFor(db, ['inspectionWorks', 'inspection_works', 'inspectionworks'], nameCache);
  const cursor = col.find(emptyGeoFilter(), {
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
      submittedDateYmd: 1,
      wardNumber: 1,
      wardNo: 1,
      ward: 1,
      submittedByUserName: 1,
      username: 1,
      submittedByUserId: 1,
      tpCode: 1,
      districtCode: 1,
      subjectId: 1,
      categoryId: 1,
    },
  });
  const ops = [];
  const moves = [];
  const byZone = {};
  let filled = 0;
  let unresolved = 0;
  const flush = async () => {
    if (!ops.length) return;
    try {
      const res = await col.bulkWrite(ops.splice(0, ops.length), { ordered: false });
      stats['inspectionWorks.emptyGeo'] = (stats['inspectionWorks.emptyGeo'] || 0) + (res.modifiedCount || 0);
    } catch (err) {
      console.warn('[geo-hierarchy] empty-geo bulkWrite failed:', err && err.message ? err.message : err);
    }
  };
  for await (const doc of cursor) {
    const set = resolveMissingGeo(doc, masters);
    if (!set) {
      unresolved += 1;
      continue;
    }
    if (!needsGeoSet(doc, set)) continue;
    filled += 1;
    const zoneLabel = set.zoneNameEn || set.zoneId || 'unknown';
    const distLabel = set.districtNameEn || set.districtId || 'unknown';
    const key = `${zoneLabel} / ${distLabel}`;
    byZone[key] = (byZone[key] || 0) + 1;
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: set },
      },
    });
    const ymd = String(doc.submittedDateYmd || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
      const ward = String(doc.wardNumber ?? doc.wardNo ?? doc.ward ?? '').trim();
      const user = String(doc.submittedByUserName || doc.username || '').trim();
      const oldDims = {
        submittedDateYmd: ymd,
        zoneId: String(doc.zoneId || '').trim(),
        districtId: String(doc.districtId || '').trim(),
        tpId: String(doc.tpId || doc.townPanchayatId || '').trim(),
        wardNumber: ward,
        submittedByUserName: user,
        subjectId: String(doc.subjectId || 'unknown').trim() || 'unknown',
        categoryId: String(doc.categoryId || '_unknown').trim() || '_unknown',
      };
      const newDims = {
        ...oldDims,
        zoneId: set.zoneId || oldDims.zoneId,
        districtId: set.districtId || oldDims.districtId,
        tpId: set.tpId || oldDims.tpId,
      };
      moves.push({
        oldId: rollupDocId(oldDims),
        newId: rollupDocId(newDims),
        ...newDims,
      });
    }
    if (ops.length >= 500) await flush();
  }
  await flush();
  const moved = await moveRollupCounts(db, moves);
  const emptyRollupFilter = {
    $and: [
      { $or: [{ zoneId: '' }, { zoneId: null }, { zoneId: { $exists: false } }] },
      { $or: [{ districtId: '' }, { districtId: null }, { districtId: { $exists: false } }] },
      { $or: [{ tpId: '' }, { tpId: null }, { tpId: { $exists: false } }] },
    ],
  };
  let deletedEmpty = 0;
  for (const name of [ROLLUP_LIVE, ROLLUP_BUILD, ROLLUP_PREV]) {
    try {
      const res = await db.collection(name).deleteMany(emptyRollupFilter);
      deletedEmpty += res.deletedCount || 0;
    } catch (err) {
      if (!(err && (err.code === 26 || String(err.message || '').includes('ns not found')))) {
        console.warn(`[geo-hierarchy] ${name} empty-rollup delete failed:`, err && err.message ? err.message : err);
      }
    }
  }
  stats['inspectionWorks.emptyGeoFilled'] = filled;
  stats['inspectionWorks.emptyGeoUnresolved'] = unresolved;
  stats['rollups.emptyDeleted'] = deletedEmpty;
  console.log(
    `[geo-hierarchy] Blank location-wise rows filled=${filled} unresolved=${unresolved} rollupMoves=${moved} emptyRollupsDeleted=${deletedEmpty} byZoneDistrict=${JSON.stringify(byZone)}`
  );
  return { filled, unresolved, byZone };
}

function relatedCollectionKeys() {
  return [
    ['inspectionWorks', 'inspection_works', 'inspectionworks'],
    ['wardsAndStreets', 'wards_and_streets', 'wardsandstreets'],
    ['inspectionUsers', 'inspection_users', 'inspectionusers'],
    ['users'],
    ['employees'],
  ];
}

/**
 * One-time master parent fix: if a zone exists for a district (same id place or unique
 * same name), write that zoneId onto the district. Tiruvallur district must not stay
 * under Chennai when a Tiruvallur zone master exists.
 */
async function alignDistrictZoneParents(masters, stats) {
  const remaps = [];
  const ops = [];
  for (const dist of masters.districts || []) {
    if (!dist || !dist.id) continue;
    const zone = resolveDistrictZone(dist, masters.townPanchayats, masters.zones, masters.zoneById);
    if (!zone || !zone.id) continue;
    const fromZoneId = String(dist.zoneId || '').trim();
    const childTps = (masters.townPanchayats || []).filter((tp) => normKey(tp && tp.districtId) === normKey(dist.id));
    remaps.push({
      districtId: dist.id,
      fromZoneId,
      zoneId: zone.id,
      zoneNameEn: zone.nameEn || '',
      zoneNameTa: zone.nameTa || '',
      tpIds: childTps.map((tp) => tp && tp.id).filter(Boolean),
    });
    const set = { zoneId: zone.id };
    if (zone.nameEn) set.zoneNameEn = zone.nameEn;
    if (zone.nameTa) set.zoneNameTa = zone.nameTa;
    const parentChanged = fromZoneId.toLowerCase() !== String(zone.id).toLowerCase();
    const shouldWrite = parentChanged || needsGeoSet(dist, set);
    dist.zoneId = zone.id;
    if (zone.nameEn) dist.zoneNameEn = zone.nameEn;
    if (zone.nameTa) dist.zoneNameTa = zone.nameTa;
    if (shouldWrite) {
      const filter = dist._id ? { _id: dist._id } : { id: dist.id };
      ops.push({ updateOne: { filter, update: { $set: set } } });
      if (parentChanged) {
        console.log(
          `[geo-hierarchy] District "${dist.nameEn || dist.id}" (${dist.id}) zone ${fromZoneId || '(empty)'} → ${zone.nameEn || zone.id} (${zone.id})`
        );
      }
    }
  }
  if (ops.length) {
    try {
      const res = await masters.distCol.bulkWrite(ops, { ordered: false });
      stats['districts.zoneParent'] = res.modifiedCount || 0;
    } catch (err) {
      console.warn('[geo-hierarchy] district zone parent bulkWrite failed:', err && err.message ? err.message : err);
    }
  }
  masters.districtById = indexById(masters.districts);
  for (const tp of masters.townPanchayats || []) {
    const dist = tp && tp.districtId ? masters.districtById.get(normKey(tp.districtId)) : null;
    if (dist && dist.zoneId) {
      tp.zoneId = dist.zoneId;
      if (dist.zoneNameEn) tp.zoneNameEn = dist.zoneNameEn;
      if (dist.zoneNameTa) tp.zoneNameTa = dist.zoneNameTa;
    }
  }
  return remaps;
}

function geoGroupsFromTownPanchayats(masters) {
  const groups = new Map();
  for (const tp of masters.townPanchayats || []) {
    if (!tp || !tp.id) continue;
    const { dist, zone } = resolveParents(tp, masters.districtById, masters.zoneById);
    if (zone && zone.id) {
      tp.zoneId = zone.id;
      if (zone.nameEn) tp.zoneNameEn = zone.nameEn;
      if (zone.nameTa) tp.zoneNameTa = zone.nameTa;
    }
    if (dist) {
      if (dist.nameEn) tp.districtNameEn = dist.nameEn;
      if (dist.nameTa) tp.districtNameTa = dist.nameTa;
    }
    const set = geoSetFromParents(tp, dist, zone);
    if (!Object.keys(set).length) continue;
    const key = `${set.districtId || ''}|${set.zoneId || ''}`;
    let group = groups.get(key);
    if (!group) {
      group = { tpIds: [], set, dist, zone };
      groups.set(key, group);
    }
    group.tpIds.push(tp.id);
  }
  return [...groups.values()];
}

/**
 * Restore zone / district / TP from masters by id. Targeted updateMany — no full works scan.
 */
async function repairGeoFromMasters(db, stats, nameCache) {
  console.log('[geo-hierarchy] Repairing zone/district/TP parents from master collections ...');
  const masters = await loadMasterMaps(db, nameCache);
  const remaps = await alignDistrictZoneParents(masters, stats);

  const tpModified = await bulkSetById(
    masters.tpCol,
    masters.townPanchayats,
    (tp) => {
      const { dist, zone } = resolveParents(tp, masters.districtById, masters.zoneById);
      const set = {};
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
    },
    'townPanchayats.geoRepair',
    stats
  );

  const groups = geoGroupsFromTownPanchayats(masters);
  const workKeys = relatedCollectionKeys();
  let worksRepaired = 0;
  for (const names of workKeys) {
    const col = await collectionFor(db, names, nameCache);
    for (const group of groups) {
      if (!group.tpIds.length) continue;
      const before = stats[`${names[0]}.geoStamp`] || 0;
      const mismatch = [];
      if (group.set.zoneId) mismatch.push({ zoneId: { $ne: group.set.zoneId } });
      if (group.set.districtId) mismatch.push({ districtId: { $ne: group.set.districtId } });
      await updateManySafe(
        col,
        {
          $and: [
            { $or: [{ tpId: { $in: group.tpIds } }, { townPanchayatId: { $in: group.tpIds } }] },
            mismatch.length ? { $or: mismatch } : { tpId: { $in: group.tpIds } },
          ],
        },
        group.set,
        `${names[0]}.geoStamp`,
        stats
      );
      if (names[0] === 'inspectionWorks') {
        worksRepaired += (stats[`${names[0]}.geoStamp`] || 0) - before;
      }
    }
    for (const remap of remaps) {
      if (!remap.districtId || !remap.zoneId) continue;
      if (normKey(remap.fromZoneId) === normKey(remap.zoneId)) continue;
      const set = {
        districtId: remap.districtId,
        zoneId: remap.zoneId,
      };
      if (remap.zoneNameEn) set.zoneNameEn = remap.zoneNameEn;
      if (remap.zoneNameTa) set.zoneNameTa = remap.zoneNameTa;
      const dist = masters.districtById.get(normKey(remap.districtId));
      if (dist && dist.nameEn) set.districtNameEn = dist.nameEn;
      if (dist && dist.nameTa) set.districtNameTa = dist.nameTa;
      await updateManySafe(
        col,
        { districtId: remap.districtId, zoneId: { $ne: remap.zoneId } },
        set,
        `${names[0]}.byDistrict`,
        stats
      );
    }
  }

  const emptyGeo = await stampMissingWorkGeo(db, masters, stats, nameCache);
  console.log(
    `[geo-hierarchy] Geo repair done: townPanchayats=${tpModified} inspectionWorks=${worksRepaired} districtParents=${stats['districts.zoneParent'] || 0} emptyFilled=${emptyGeo.filled} emptyUnresolved=${emptyGeo.unresolved}`
  );
  return { worksRepaired, remaps, emptyGeo };
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
  const repaired = await repairGeoFromMasters(db, stats, nameCache);
  const repairedWorks = repaired && repaired.worksRepaired ? repaired.worksRepaired : 0;
  const remaps = (repaired && repaired.remaps) || [];
  const emptyGeo = (repaired && repaired.emptyGeo) || { filled: 0, unresolved: 0, byZone: {} };

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
    remaps,
    emptyGeo,
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
  alignDistrictZoneParents,
  CANONICAL_DISTRICT_EN,
  CANONICAL_DISTRICT_TA,
  CANONICAL_ZONE_EN,
  CANONICAL_ZONE_TA,
};
