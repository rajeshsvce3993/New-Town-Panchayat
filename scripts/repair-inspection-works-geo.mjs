/**
 * Repair inspectionWorks whose zone / district / TP / ward / street drifted from the
 * submitter's assigned Mongo place. Does not use user_scope_cache or display names.
 *
 * Dry-run (default — no writes):
 *   node scripts/repair-inspection-works-geo.mjs
 *   node scripts/repair-inspection-works-geo.mjs 8870715287
 *
 * Apply:
 *   node scripts/repair-inspection-works-geo.mjs --apply
 *   node scripts/repair-inspection-works-geo.mjs 8870715287 --apply
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function norm(value) {
  return String(value ?? '').trim();
}

export function key(value) {
  return norm(value).toLowerCase();
}

export function isLoosePersonName(value) {
  const v = norm(value);
  if (!v) return true;
  if (/^\d{10,12}$/.test(v)) return false;
  if (/^(iu|tp|wrk)[_-]/i.test(v)) return false;
  if (/^[a-z0-9._-]{3,}$/i.test(v) && !/\s/.test(v)) return false;
  return /\s/.test(v);
}

export function inspectorNeedles(user) {
  return [...new Set([user?.username, user?.id, user?.mobile, user?.employeeId].map(key).filter(Boolean))];
}

export function classifyInspectorScope(user) {
  const st = key(user?.scopeType).replace(/[\s-]+/g, '_');
  const role = key(user?.roleId || user?.role);
  if (['hod', 'state', 'all'].includes(st) || ['admin', 'director', 'dtpadmin', 'hod'].includes(role)) return 'hod';
  if (st === 'zonal' || st === 'zone' || role === 'role_zonal' || role === 'ad') return 'zonal';
  if (st === 'multi_tp' || st === 'district' || role === 'role_multi_tp' || role === 'role_district') return 'multi_tp';
  if (
    st === 'single_tp' ||
    st === 'field_worker' ||
    st === 'field_workers' ||
    st === 'townpanchayat' ||
    st === 'tp' ||
    role === 'role_single_tp' ||
    role === 'role_field_worker' ||
    role === 'role_field_workers'
  ) {
    return 'single_tp';
  }
  const selected = (user?.selectedTpIds || []).map(norm).filter(Boolean);
  if (selected.length > 1) return 'multi_tp';
  if (user?.zoneId && !user?.tpId && !user?.townPanchayatId && !user?.districtId) return 'zonal';
  if (user?.districtId && selected.length !== 1 && !user?.tpId && !user?.townPanchayatId) return 'multi_tp';
  return 'single_tp';
}

export function assignedTpId(user) {
  return norm(user?.tpId || user?.townPanchayatId);
}

export function workOwnerFilter(needles, username) {
  const ids = needles.filter(Boolean);
  const or = [];
  for (const id of ids) {
    or.push({ username: id }, { submittedByUserId: id }, { userId: id }, { mobile: id });
    if (!isLoosePersonName(id)) or.push({ submittedByUserName: id });
  }
  const uname = norm(username);
  if (uname && uname.length >= 8) {
    or.push({ workId: { $regex: `^WRK-${uname}-`, $options: 'i' } });
  }
  return or.length ? { $or: or } : { _id: null };
}

export function geoPatchFromMasters(tp, dist, zone) {
  if (!tp?.id) return null;
  return {
    tpId: String(tp.id),
    townPanchayatId: String(tp.id),
    tpNameEn: norm(tp.nameEn),
    tpNameTa: norm(tp.nameTa),
    tpCode: norm(tp.code),
    districtId: norm(dist?.id || tp.districtId),
    districtNameEn: norm(dist?.nameEn),
    districtNameTa: norm(dist?.nameTa),
    districtCode: norm(dist?.code),
    zoneId: norm(zone?.id || dist?.zoneId || tp.zoneId),
    zoneNameEn: norm(zone?.nameEn),
    zoneNameTa: norm(zone?.nameTa),
  };
}

export function geoDiffers(work, patch) {
  if (!patch) return false;
  return Object.keys(patch).some((field) => norm(work?.[field]) !== norm(patch[field]));
}

export function pickTargetTp(work, allowedTps, scope) {
  if (!allowedTps.length) return null;
  const workTpId = norm(work?.tpId || work?.townPanchayatId);
  const byId = allowedTps.find((tp) => norm(tp.id) === workTpId);
  if (byId) return byId;
  if (scope === 'single_tp' && allowedTps.length === 1) return allowedTps[0];
  return null;
}

function normWard(value) {
  return String(value ?? '')
    .trim()
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');
}

function streetNamesEqual(row, needle) {
  const n = key(needle);
  if (!n) return false;
  return [row.streetNameEn, row.streetNameTa, row.streetName, row.nameEn]
    .map(key)
    .filter(Boolean)
    .some((name) => name === n || name.replace(/\s+/g, '') === n.replace(/\s+/g, ''));
}

export function streetPatchFromRows(work, rows) {
  if (!rows?.length) return null;
  const needle = norm(work?.streetName || work?.street);
  const ward = normWard(work?.wardNumber || work?.wardNo || work?.ward);
  const named = needle ? rows.filter((row) => streetNamesEqual(row, needle)) : [];
  let match = named.length === 1 ? named[0] : null;
  if (!match && named.length && ward) {
    const inWard = named.filter((row) => normWard(row.wardNo ?? row.wardNumber) === ward);
    if (inWard.length === 1) match = inWard[0];
  }
  if (!match && ward && !needle) {
    const inWard = rows.filter((row) => normWard(row.wardNo ?? row.wardNumber) === ward);
    if (inWard.length === 1) match = inWard[0];
  }
  if (!match) return null;
  const en = norm(match.streetNameEn || match.streetName);
  const ta = norm(match.streetNameTa);
  const display = en || ta;
  const nextWard = normWard(match.wardNo ?? match.wardNumber) || ward;
  const patch = {
    streetName: display,
    streetNameEn: en || display,
    streetNameTa: ta || en || display,
    street: display,
    wardNumber: nextWard,
    wardNo: nextWard,
    ward: nextWard,
  };
  if (match.id) patch.streetId = match.id;
  return patch;
}

function loadMongoUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  try {
    const db = JSON.parse(readFileSync(join(root, 'data/db.json'), 'utf8'));
    if (db?.settings?.mongodbUri) return db.settings.mongodbUri;
  } catch {
    /* local settings optional */
  }
  return 'mongodb://127.0.0.1:27018/dtp_enterprise';
}

async function findById(col, id) {
  const value = norm(id);
  if (!value) return null;
  return col.findOne({ $or: [{ id: value }, { _id: value }] });
}

async function allowedTownPanchayats(db, user, scope) {
  const col = db.collection('townPanchayats');
  if (scope === 'single_tp') {
    const tp = await findById(col, assignedTpId(user));
    return tp ? [tp] : [];
  }
  if (scope === 'multi_tp') {
    const selected = (user.selectedTpIds || []).map(norm).filter(Boolean);
    if (selected.length) {
      return col.find({ id: { $in: selected } }).toArray();
    }
    const districtId = norm(user.districtId);
    if (districtId) return col.find({ districtId }).toArray();
    return [];
  }
  if (scope === 'zonal') {
    const zoneId = norm(user.zoneId);
    if (!zoneId) return [];
    return col.find({ zoneId }).toArray();
  }
  return [];
}

async function chainForTp(db, tp) {
  const dist = tp?.districtId ? await findById(db.collection('districts'), tp.districtId) : null;
  const zoneId = dist?.zoneId || tp?.zoneId;
  const zone = zoneId ? await findById(db.collection('zones'), zoneId) : null;
  return { dist, zone };
}

async function streetRowsForTp(db, tpId) {
  return db
    .collection('wardsAndStreets')
    .find({ $or: [{ tpId }, { townPanchayatId: tpId }] })
    .project({ id: 1, tpId: 1, townPanchayatId: 1, wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1, streetName: 1 })
    .limit(800)
    .toArray();
}

export async function planWorkRepair(db, work, user, allowedTps, scope) {
  const target = pickTargetTp(work, allowedTps, scope);
  if (!target) return { skip: 'tp_not_in_assigned_scope' };
  const { dist, zone } = await chainForTp(db, target);
  const geo = geoPatchFromMasters(target, dist, zone);
  const streets = await streetRowsForTp(db, target.id);
  const street = streetPatchFromRows(work, streets);
  const patch = { ...(geoDiffers(work, geo) ? geo : {}), ...(street && geoDiffers(work, street) ? street : {}) };
  if (!Object.keys(patch).length) return { skip: 'already_correct' };
  return { patch, targetTp: target.nameEn || target.id };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const onlyUsername = process.argv.slice(2).find((arg) => arg && arg !== '--apply') || '';
  const uri = loadMongoUri();
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();

  const usersCol = db.collection('inspectionUsers');
  const users = onlyUsername
    ? await usersCol.find({ $or: [{ username: onlyUsername }, { mobile: onlyUsername }, { id: onlyUsername }] }).toArray()
    : await usersCol
        .find({})
        .project({
          username: 1,
          mobile: 1,
          id: 1,
          employeeId: 1,
          tpId: 1,
          townPanchayatId: 1,
          districtId: 1,
          zoneId: 1,
          scopeType: 1,
          roleId: 1,
          role: 1,
          selectedTpIds: 1,
        })
        .toArray();

  const summary = {
    apply,
    usersProcessed: 0,
    worksScanned: 0,
    wouldUpdate: 0,
    updated: 0,
    skippedHod: 0,
    skippedNoTp: 0,
    skippedOther: 0,
    samples: [],
  };

  for (const user of users) {
    const scope = classifyInspectorScope(user);
    if (scope === 'hod') {
      summary.skippedHod += 1;
      continue;
    }
    const needles = inspectorNeedles(user);
    if (!needles.length) continue;
    summary.usersProcessed += 1;

    const allowedTps = await allowedTownPanchayats(db, user, scope);
    if (!allowedTps.length) {
      summary.skippedNoTp += 1;
      continue;
    }

    const works = await db.collection('inspectionWorks').find(workOwnerFilter(needles, user.username)).toArray();
    for (const work of works) {
      summary.worksScanned += 1;
      const plan = await planWorkRepair(db, work, user, allowedTps, scope);
      if (plan.skip) {
        if (plan.skip !== 'already_correct') summary.skippedOther += 1;
        continue;
      }
      summary.wouldUpdate += 1;
      if (summary.samples.length < 25) {
        summary.samples.push({
          workId: work.workId || work.id,
          user: user.username || user.id,
          from: {
            zone: work.zoneNameEn || work.zoneId,
            district: work.districtNameEn || work.districtId,
            tp: work.tpNameEn || work.tpId,
            ward: work.wardNumber,
            street: work.streetName,
          },
          to: {
            zone: plan.patch.zoneNameEn || work.zoneNameEn,
            district: plan.patch.districtNameEn || work.districtNameEn,
            tp: plan.patch.tpNameEn || work.tpNameEn,
            ward: plan.patch.wardNumber || work.wardNumber,
            street: plan.patch.streetName || work.streetName,
          },
        });
      }
      if (apply) {
        await db.collection('inspectionWorks').updateOne({ _id: work._id }, { $set: plan.patch });
        summary.updated += 1;
      }
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  await client.close();
}

const thisFile = fileURLToPath(import.meta.url);
const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (thisFile.toLowerCase() === invoked.toLowerCase()) {
  await main();
}
