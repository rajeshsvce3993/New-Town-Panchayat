/**
 * Fix street names on inspectionWorks from wardsAndStreets masters (TP + ward).
 * Usage:
 *   node scripts/repair-inspection-works-street.mjs 8925809654
 *   node scripts/repair-inspection-works-street.mjs
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

async function resolveStreet(db, work) {
  const tpId = String(work.tpId || work.townPanchayatId || '').trim();
  const ward = normWard(work.wardNumber || work.wardNo || work.ward);
  if (!tpId) return null;

  let needle = String(work.streetName || work.street || '').trim();
  if (isPlaceholder(needle)) {
    const alt = streetFromFields(work.fieldsData);
    if (alt) needle = alt;
  }

  const filter = {
    $and: [
      { $or: [{ tpId }, { townPanchayatId: tpId }] },
      ...(ward
        ? [{ $or: [{ wardNo: ward }, { wardNumber: ward }, { ward: ward }] }]
        : []),
    ],
  };

  const rows = await db.collection('wardsAndStreets').find(filter).limit(200).toArray();
  if (!rows.length) return null;

  let match =
    needle && !isPlaceholder(needle) ? rows.find((r) => namesMatch(r, needle)) : undefined;
  if (!match && rows.length === 1) match = rows[0];
  if (!match) return null;

  const en = String(match.streetNameEn || match.streetName || '').trim();
  const ta = String(match.streetNameTa || '').trim();
  const display = en || ta;
  return {
    streetName: display,
    streetNameEn: en || display,
    streetNameTa: ta || en || display,
    street: display,
    streetId: match.id,
    wardNumber: ward || normWard(match.wardNo),
    wardNo: ward || normWard(match.wardNo),
    ward: ward || normWard(match.wardNo),
  };
}

const client = new MongoClient(uri);
await client.connect();
const db = client.db();
const worksCol = db.collection('inspectionWorks');

const filter = onlyUser
  ? {
      $or: [
        { username: onlyUser },
        { submittedByUserName: onlyUser },
        { submittedByUserId: onlyUser },
      ],
    }
  : {};

const cursor = worksCol.find(filter);
let scanned = 0;
let updated = 0;
let noMaster = 0;

for await (const work of cursor) {
  scanned += 1;
  const patch = await resolveStreet(db, work);
  if (!patch) {
    noMaster += 1;
    continue;
  }
  const before = String(work.streetName || work.street || '');
  if (before === patch.streetName) continue;
  await worksCol.updateOne({ _id: work._id }, { $set: patch });
  updated += 1;
}

console.log(
  JSON.stringify(
    { onlyUser: onlyUser || 'ALL', scanned, updated, noMasterRow: noMaster },
    null,
    2,
  ),
);
await client.close();