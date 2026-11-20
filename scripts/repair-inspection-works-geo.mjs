/**
 * Re-stamp inspectionWorks geo from each submitter's inspectionUsers profile (Mongo).
 * Usage:
 *   node scripts/repair-inspection-works-geo.mjs
 *   node scripts/repair-inspection-works-geo.mjs 8925809654
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dtp_enterprise';
const onlyUsername = process.argv[2] ? String(process.argv[2]).trim() : '';

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const usersCol = db.collection('inspectionUsers');
const worksCol = db.collection('inspectionWorks');

const users = onlyUsername
  ? await usersCol
      .find({
        $or: [{ username: onlyUsername }, { mobile: onlyUsername }, { id: onlyUsername }],
      })
      .toArray()
  : await usersCol
      .find({})
      .project({
        username: 1,
        mobile: 1,
        id: 1,
        tpId: 1,
        townPanchayatId: 1,
        districtId: 1,
        zoneId: 1,
        scopeType: 1,
        selectedTpIds: 1,
      })
      .toArray();

let repaired = 0;
let skipped = 0;

for (const user of users) {
  const username = String(user.username || user.mobile || '').trim();
  const userId = String(user.id || '').trim();
  if (!username && !userId) continue;

  const tpId = String(user.tpId || user.townPanchayatId || user.selectedTpIds?.[0] || '').trim();
  if (!tpId) {
    skipped += 1;
    continue;
  }

  const tp = await db.collection('townPanchayats').findOne({ id: tpId });
  if (!tp) {
    skipped += 1;
    continue;
  }

  const dist = tp.districtId
    ? await db.collection('districts').findOne({ id: String(tp.districtId) })
    : null;
  const zone = dist?.zoneId
    ? await db.collection('zones').findOne({ id: String(dist.zoneId) })
    : tp.zoneId
      ? await db.collection('zones').findOne({ id: String(tp.zoneId) })
      : null;

  const workFilter = {
    $or: [
      { username },
      { submittedByUserName: username },
      { submittedByUserId: username },
      ...(userId ? [{ submittedByUserId: userId }, { submittedByUserId: userId.toLowerCase() }] : []),
    ],
  };

  const $set = {
    tpId: tp.id,
    townPanchayatId: tp.id,
    tpNameEn: tp.nameEn || '',
    tpNameTa: tp.nameTa || '',
    tpCode: tp.code || '',
    districtId: dist?.id || String(tp.districtId || ''),
    districtNameEn: dist?.nameEn || '',
    districtNameTa: dist?.nameTa || '',
    districtCode: dist?.code || '',
    zoneId: zone?.id || String(dist?.zoneId || tp.zoneId || ''),
    zoneNameEn: zone?.nameEn || '',
    zoneNameTa: zone?.nameTa || '',
  };

  const res = await worksCol.updateMany(workFilter, { $set });
  if (res.modifiedCount > 0) {
    repaired += res.modifiedCount;
    console.log(`${username || userId}: updated ${res.modifiedCount} work(s) → TP ${tp.nameEn}`);
  }
}

console.log(JSON.stringify({ usersProcessed: users.length, worksRepaired: repaired, usersSkippedNoTp: skipped }, null, 2));
await client.close();