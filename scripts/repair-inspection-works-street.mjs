/**
 * Fix street + ward on inspectionWorks from wardsAndStreets masters (TP + ward + name).
 * Usage:
 *   node scripts/repair-inspection-works-street.mjs 8925809654
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dtp_enterprise';
const onlyUser = process.argv[2] ? String(process.argv[2]).trim() : '';

const PLACEHOLDERS = new Set(
  [
    'anna street',
    'gandhi street',
    'bazaar street',
    'kamarajar salai',
    'bharathiyar street',
    'hospital road',
    'periyar nagar',
    'main road',
    'அண்ணா தெரு',
    'காந்தி தெரு',
    'பஜார் தெரு',
  ].map((s) => s.toLowerCase()),
);

function normWard(v) {
  return String(v ?? '')
    .trim()
    .replace(/[^0-9]/g, '')
    .replace(/^0+/, '');
}

function wardOnRow(row) {
  return normWard(row?.wardNo ?? row?.wardNumber ?? row?.ward);
}

function isPlaceholder(name) {
  const n = String(name || '').trim().toLowerCase();
  return !n || PLACEHOLDERS.has(n);
}

function namesMatch(row, needle) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return false;
  const names = [row.streetNameEn, row.streetNameTa, row.streetName, row.nameEn]
    .map((x) => String(x || '').trim().toLowerCase())
    .filter(Boolean);
  return names.includes(n) || names.some((x) => x.replace(/\s+/g, '') === n.replace(/\s+/g, ''));
}

function streetFromFields(fields) {
  if (!fields || typeof fields !== 'object') return '';
  for (const key of ['street', 'streetName', 'street_name', 'if_street', 'streetNameEn']) {
    const v = fields[key];
    if (typeof v === 'string' && v.trim() && !isPlaceholder(v)) return v.trim();
  }
  return '';
}

function wardFromFields(fields) {
  if (!fields || typeof fields !== 'object') return '';
  for (const key of ['wardNumber', 'wardNo', 'ward', 'if_ward']) {
    const v = fields[key];
    if (v != null && String(v).trim()) return normWard(v);
  }
  return '';
}

function parseCaption(caption) {
  const s = String(caption || '').trim();
  const en = s.match(/(?:at\s+)?ward\s*(\d+)\s+(.+?)\s*\.?\s*$/i);
  if (en) return { ward: normWard(en[1]), street: String(en[2] || '').trim() };
  return { ward: '', street: '' };
}

function pickStreetRow(candidates, preferredWard) {
  if (!candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  if (preferredWard) {
    const inWard = candidates.filter((r) => wardOnRow(r) === preferredWard);
    if (inWard.length === 1) return inWard[0];
    if (inWard.length > 1) return inWard[0];
    return null;
  }
  return null;
}

function streetHits(rows, needle) {
  if (!needle || isPlaceholder(needle)) return [];
  return rows.filter((r) => namesMatch(r, needle));
}

async function resolveStreet(db, work, inspector) {
  const tpId = String(work.tpId || work.townPanchayatId || inspector?.tpId || '').trim();
  if (!tpId) return null;

  const masterStreetId = String(work.streetId || '').trim();
  if (masterStreetId) {
    const byId = await db.collection('wardsAndStreets').findOne({ id: masterStreetId });
    if (byId) {
      const w = wardOnRow(byId);
      const en = String(byId.streetNameEn || byId.streetName || '').trim();
      const ta = String(byId.streetNameTa || '').trim();
      const display = en || ta;
      return {
        streetName: display,
        streetNameEn: en || display,
        streetNameTa: ta || en || display,
        street: display,
        streetId: byId.id,
        wardNumber: w,
        wardNo: w,
        ward: w,
      };
    }
  }

  const allRows = await db
    .collection('wardsAndStreets')
    .find({ $or: [{ tpId }, { townPanchayatId: tpId }] })
    .limit(500)
    .toArray();
  if (!allRows.length) return null;

  const fromCaption = parseCaption(work.imageCaption);

  let needle = String(work.streetName || work.street || '').trim();
  const placeholder = isPlaceholder(needle);
  if (placeholder) {
    const alt = streetFromFields(work.fieldsData);
    if (alt) needle = alt;
    else if (fromCaption.street && !isPlaceholder(fromCaption.street)) needle = fromCaption.street;
  }

  const masterWards = new Set(allRows.map(wardOnRow).filter(Boolean));
  let ward = normWard(work.wardNumber || work.wardNo || work.ward) || wardFromFields(work.fieldsData);
  if ((!ward || (ward === '1' && placeholder)) && fromCaption.ward) ward = fromCaption.ward;

  if (needle && !isPlaceholder(needle)) {
    const globalHits = streetHits(allRows, needle);
    if (globalHits.length === 1) {
      const match = globalHits[0];
      const w = wardOnRow(match);
      const en = String(match.streetNameEn || match.streetName || '').trim();
      const ta = String(match.streetNameTa || '').trim();
      const display = en || ta;
      return {
        streetName: display,
        streetNameEn: en || display,
        streetNameTa: ta || en || display,
        street: display,
        streetId: match.id,
        wardNumber: w,
        wardNo: w,
        ward: w,
      };
    }
    if (ward) {
      const inWardHits = streetHits(
        allRows.filter((r) => wardOnRow(r) === ward),
        needle,
      );
      if (inWardHits.length === 1) {
        const match = inWardHits[0];
        const en = String(match.streetNameEn || match.streetName || '').trim();
        const ta = String(match.streetNameTa || '').trim();
        const display = en || ta;
        return {
          streetName: display,
          streetNameEn: en || display,
          streetNameTa: ta || en || display,
          street: display,
          streetId: match.id,
          wardNumber: ward,
          wardNo: ward,
          ward,
        };
      }
    }
  }

  if (ward && !masterWards.has(ward) && needle && !isPlaceholder(needle)) {
    const hit = allRows.find((r) => namesMatch(r, needle));
    if (hit) ward = wardOnRow(hit);
  }

  const assigned = new Set(
    [...(inspector?.assignedWards || []), ...(inspector?.selectedWards || [])].map(normWard).filter(Boolean),
  );
  if (ward && assigned.size && !assigned.has(ward)) {
    if (needle && !isPlaceholder(needle)) {
      const hit = allRows.find((r) => namesMatch(r, needle) && assigned.has(wardOnRow(r)));
      if (hit) ward = wardOnRow(hit);
    } else if (assigned.size === 1) ward = [...assigned][0];
    else if (isPlaceholder(needle)) ward = '';
  }

  const wardRows = ward ? allRows.filter((r) => wardOnRow(r) === ward) : allRows;
  let match = null;
  let matchInWard = false;
  if (needle && !isPlaceholder(needle)) {
    const named = (ward ? wardRows : allRows).filter((r) => namesMatch(r, needle));
    const pool = named.length ? named : allRows.filter((r) => namesMatch(r, needle));
    match = pickStreetRow(pool, ward) || (pool.length === 1 ? pool[0] : null);
    matchInWard = !!(ward && match && wardOnRow(match) === ward);
  }
  const wardOkForInspector = !assigned.size || !ward || assigned.has(ward);
  if (!match && isPlaceholder(needle) && ward && ward !== '1' && wardRows.length === 1 && wardOkForInspector) {
    match = wardRows[0];
    matchInWard = true;
  }
  if (!match) return null;

  const en = String(match.streetNameEn || match.streetName || '').trim();
  const ta = String(match.streetNameTa || '').trim();
  const display = en || ta;
  const wardNorm =
    matchInWard && ward && wardOnRow(match) === ward ? ward : wardOnRow(match) || ward;
  return {
    streetName: display,
    streetNameEn: en || display,
    streetNameTa: ta || en || display,
    street: display,
    streetId: match.id,
    wardNumber: wardNorm,
    wardNo: wardNorm,
    ward: wardNorm,
  };
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

let userFilter = {};
if (onlyUser) {
  const insp = await db.collection('inspectionUsers').findOne({
    $or: [{ username: onlyUser }, { mobile: onlyUser }, { id: onlyUser }],
  });
  userFilter = {
    $or: [
      { username: onlyUser },
      { submittedByUserName: onlyUser },
      { submittedByUserId: onlyUser },
      ...(insp?.id ? [{ submittedByUserId: insp.id }] : []),
    ],
  };
}

const cursor = db.collection('inspectionWorks').find(userFilter);
let scanned = 0;
let updated = 0;

for await (const work of cursor) {
  scanned += 1;
  const uname = String(work.username || work.submittedByUserName || work.submittedByUserId || '').trim();
  const inspector = uname
    ? await db.collection('inspectionUsers').findOne({
        $or: [{ username: uname }, { mobile: uname }, { id: uname }],
      })
    : null;
  const patch = await resolveStreet(db, work, inspector);
  if (!patch) continue;
  const same =
    String(work.streetName || '') === patch.streetName &&
    String(work.wardNumber || work.wardNo || work.ward || '') === String(patch.wardNumber || '');
  if (same) continue;
  await db.collection('inspectionWorks').updateOne({ _id: work._id }, { $set: patch });
  updated += 1;
}

console.log(JSON.stringify({ onlyUser: onlyUser || 'ALL', scanned, updated }, null, 2));
await client.close();