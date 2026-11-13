'use strict';

/**
 * Server write-path geo resolution. Mobile sends names only; reports group by ids.
 * Never guesses a TP when the name is not unique in the resolved zone.
 */

function norm(value) {
  return String(value || '').trim();
}

function normKey(value) {
  return norm(value).toLowerCase();
}

function placeKey(value) {
  return norm(value)
    .toLowerCase()
    .replace(/^(the\s+)/, '')
    .replace(/\s+(zone|district|dt\.?|town panchayat|panchayat|மண்டலம்|மாவட்டம்)$/i, '')
    .replace(/^(thiru)/, 'tiru')
    .replace(/[\s-]+/g, '');
}

function looksLikeGeoId(value, prefix) {
  const s = norm(value);
  if (!s) return false;
  return prefix ? new RegExp('^' + prefix + '_', 'i').test(s) : /^(z|d|tp|iu)_/i.test(s);
}

function nameKeys(item) {
  return [placeKey(item && item.nameEn), placeKey(item && item.nameTa), placeKey(item && item.name)].filter(Boolean);
}

function namesMatch(item, name) {
  const key = placeKey(name);
  if (!key || !item) return false;
  return nameKeys(item).includes(key);
}

function byId(list, id) {
  const n = normKey(id);
  if (!n || !looksLikeGeoId(n)) return undefined;
  return (list || []).find((item) => normKey(item && item.id) === n);
}

function uniqueByName(list, name) {
  const key = placeKey(name);
  if (!key) return undefined;
  const hits = (list || []).filter((item) => namesMatch(item, name));
  return hits.length === 1 ? hits[0] : undefined;
}

function inspectorTpIds(inspector) {
  const ids = new Set();
  if (!inspector || typeof inspector !== 'object') return ids;
  const raw = [
    inspector.tpId,
    inspector.townPanchayatId,
    ...(Array.isArray(inspector.selectedTpIds) ? inspector.selectedTpIds : []),
    ...(Array.isArray(inspector.townPanchayatIds) ? inspector.townPanchayatIds : []),
  ];
  for (const id of raw) {
    const n = normKey(id);
    if (n) ids.add(n);
  }
  return ids;
}

function pickFromCandidates(candidates, work, inspector) {
  if (!candidates.length) return undefined;
  if (candidates.length === 1) return candidates[0];

  const assigned = inspectorTpIds(inspector);
  if (assigned.size) {
    const byUser = candidates.filter((tp) => assigned.has(normKey(tp && tp.id)));
    if (byUser.length === 1) return byUser[0];
  }

  const code = normKey(work && (work.tpCode || (inspector && inspector.tpCode)));
  if (code) {
    const byCode = candidates.filter((tp) => normKey(tp && tp.code) === code);
    if (byCode.length === 1) return byCode[0];
  }

  return undefined;
}

function tpsMatchingName(tps, name) {
  const key = placeKey(name);
  if (!key) return [];
  return (tps || []).filter((tp) => namesMatch(tp, name));
}

function tpsInZoneMatchingName(tps, name, zoneId) {
  const z = normKey(zoneId);
  if (!z) return [];
  return tpsMatchingName(tps, name).filter((tp) => normKey(tp && tp.zoneId) === z);
}

function tpsInDistrictMatchingName(tps, name, districtId) {
  const d = normKey(districtId);
  if (!d) return [];
  return tpsMatchingName(tps, name).filter((tp) => normKey(tp && tp.districtId) === d);
}

function uniqueDistrictInZone(districts, name, zoneId) {
  const z = normKey(zoneId);
  const key = placeKey(name);
  if (!z || !key) return undefined;
  const hits = (districts || []).filter(
    (d) => normKey(d && d.zoneId) === z && namesMatch(d, name)
  );
  return hits.length === 1 ? hits[0] : undefined;
}

function workTpName(work) {
  return (
    (work && (work.tpNameEn || work.townPanchayat || work.tpNameTa || work.townPanchayatTa)) ||
    ''
  );
}

function workHasMasterTpId(work) {
  return looksLikeGeoId(work && (work.tpId || work.townPanchayatId), 'tp');
}

function listTpNameCandidates(work, masters) {
  const tps = (masters && masters.townPanchayats) || [];
  const zones = (masters && masters.zones) || [];
  const name = workTpName(work);
  const zone =
    byId(zones, work && work.zoneId) || uniqueByName(zones, work && (work.zoneNameEn || work.zoneNameTa || work.zone));
  if (!name || !zone || !zone.id) return [];
  return tpsInZoneMatchingName(tps, name, zone.id);
}

/**
 * Copy zone/district/TP ids from masters onto a work.
 * ID wins. Names are used only when they uniquely identify a row in the resolved scope.
 */
function stampWorkGeoFromMasters(work, masters) {
  if (!work || typeof work !== 'object') return work;
  const tps = (masters && masters.townPanchayats) || [];
  const districts = (masters && masters.districts) || [];
  const zones = (masters && masters.zones) || [];
  const inspector = masters && masters.inspector;

  let tp = byId(tps, work.tpId || work.townPanchayatId);
  let zone = byId(zones, work.zoneId) || uniqueByName(zones, work.zoneNameEn || work.zoneNameTa || work.zone);
  let dist = byId(districts, work.districtId);

  const tpName = workTpName(work);
  if (!tp && zone && tpName) {
    tp = pickFromCandidates(tpsInZoneMatchingName(tps, tpName, zone.id), work, inspector);
  }
  if (!tp && dist && tpName) {
    tp = pickFromCandidates(tpsInDistrictMatchingName(tps, tpName, dist.id), work, inspector);
  }
  if (!tp && zone && tpName) {
    const scopedDist = uniqueDistrictInZone(districts, work.districtNameEn || work.districtNameTa || work.district, zone.id);
    if (scopedDist) {
      dist = dist || scopedDist;
      tp = pickFromCandidates(tpsInDistrictMatchingName(tps, tpName, scopedDist.id), work, inspector);
    }
  }
  if (!tp && tpName) {
    const statewide = tpsMatchingName(tps, tpName);
    if (statewide.length === 1 && (!zone || normKey(statewide[0].zoneId) === normKey(zone.id))) {
      tp = statewide[0];
    } else if (zone) {
      tp = pickFromCandidates(
        statewide.filter((row) => normKey(row && row.zoneId) === normKey(zone.id)),
        work,
        inspector
      );
    }
  }
  if (!tp && inspector) {
    const assigned = inspectorTpIds(inspector);
    const assignedTps = tps.filter((row) => assigned.has(normKey(row && row.id)));
    if (tpName) {
      tp = pickFromCandidates(
        assignedTps.filter((row) => namesMatch(row, tpName)),
        work,
        inspector
      );
    } else if (assignedTps.length === 1) {
      tp = assignedTps[0];
    }
  }

  if (tp) {
    dist = byId(districts, tp.districtId) || dist;
    zone = byId(zones, tp.zoneId) || (dist && byId(zones, dist.zoneId)) || zone;
  } else if (dist) {
    zone = byId(zones, dist.zoneId) || zone;
  }

  if (!tp && !dist && !zone) return work;

  return {
    ...work,
    ...(tp && tp.id
      ? {
          tpId: tp.id,
          townPanchayatId: tp.id,
          tpNameEn: tp.nameEn || work.tpNameEn,
          tpNameTa: tp.nameTa || work.tpNameTa,
        }
      : {}),
    ...(dist && dist.id
      ? {
          districtId: dist.id,
          districtNameEn: dist.nameEn || work.districtNameEn,
          districtNameTa: dist.nameTa || work.districtNameTa,
        }
      : {}),
    ...(zone && zone.id
      ? {
          zoneId: zone.id,
          zoneNameEn: zone.nameEn || work.zoneNameEn,
          zoneNameTa: zone.nameTa || work.zoneNameTa,
        }
      : {}),
  };
}

module.exports = {
  stampWorkGeoFromMasters,
  workHasMasterTpId,
  listTpNameCandidates,
  placeKey,
  looksLikeGeoId,
};
