/**
 * Set assignedWards from wardsAndStreets for single-TP users with empty ward assignment (no APK change).
 * Usage:
 *   node scripts/backfill-inspection-user-wards.mjs
 *   node scripts/backfill-inspection-user-wards.mjs 8925809654
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dtp_enterprise';
const only = process.argv[2] ? String(process.argv[2]).trim() : '';

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const filter = only
  ? { $or: [{ username: only }, { mobile: only }, { id: only }] }
  : {
      $or: [{ assignedWards: { $exists: false } }, { assignedWards: { $size: 0 } }, { assignedWards: null }],
    };

const users = await db.collection('inspectionUsers').find(filter).limit(only ? 5 : 5000).toArray();
let updated = 0;

for (const user of users) {
  const tpId = String(user.tpId || user.townPanchayatId || '').trim();
  if (!tpId) continue;
  const rows = await db
    .collection('wardsAndStreets')
    .find({ $or: [{ tpId }, { townPanchayatId: tpId }] }, { projection: { wardNo: 1, wardNumber: 1 } })
    .toArray();
  const wards = [
    ...new Set(
      rows
        .map((r) => String(r.wardNo || r.wardNumber || '').replace(/[^0-9]/g, '').replace(/^0+/, ''))
        .filter(Boolean),
    ),
  ].sort((a, b) => (parseInt(a, 10) || 0) - (parseInt(b, 10) || 0));
  if (!wards.length) continue;
  await db.collection('inspectionUsers').updateOne(
    { _id: user._id },
    { $set: { assignedWards: wards, selectedWards: user.selectedWards?.length ? user.selectedWards : wards } },
  );
  await db.collection('user_scope_cache').deleteMany({
    $or: [
      { username: String(user.username || '').toLowerCase() },
      { userId: user.id },
      { 'user.mobile': user.mobile },
    ],
  });
  updated += 1;
}

console.log(JSON.stringify({ scanned: users.length, updated }, null, 2));
await client.close();