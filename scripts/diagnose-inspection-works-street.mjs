/**
 * Dump inspector + recent works + sample wardsAndStreets for street/ward debugging.
 * Usage: node scripts/diagnose-inspection-works-street.mjs 8925809654
 */
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dtp_enterprise';
const key = process.argv[2] ? String(process.argv[2]).trim() : '8925809654';

const client = new MongoClient(uri);
await client.connect();
const db = client.db();

const inspector = await db.collection('inspectionUsers').findOne({
  $or: [{ username: key }, { mobile: key }, { id: key }],
});

const tpId = String(inspector?.tpId || inspector?.townPanchayatId || '').trim();

const works = await db
  .collection('inspectionWorks')
  .find({
    $or: [
      { username: key },
      { submittedByUserName: key },
      { submittedByUserId: key },
      ...(inspector?.id ? [{ submittedByUserId: inspector.id }] : []),
      ...(inspector?.username ? [{ username: inspector.username, submittedByUserId: inspector.username }] : []),
    ],
  })
  .sort({ submittedAt: -1, createdAt: -1 })
  .limit(20)
  .project({
    workId: 1,
    id: 1,
    submittedAt: 1,
    wardNumber: 1,
    wardNo: 1,
    ward: 1,
    streetName: 1,
    street: 1,
    streetId: 1,
    tpId: 1,
    townPanchayatId: 1,
    tpNameEn: 1,
    districtNameEn: 1,
    fieldsData: 1,
    imageCaption: 1,
  })
  .toArray();

const wardStreetCount = tpId
  ? await db.collection('wardsAndStreets').countDocuments({
      $or: [{ tpId }, { townPanchayatId: tpId }],
    })
  : 0;

const wardStreetSample = tpId
  ? await db
      .collection('wardsAndStreets')
      .find({ $or: [{ tpId }, { townPanchayatId: tpId }] })
      .limit(8)
      .project({ wardNo: 1, wardNumber: 1, streetNameEn: 1, streetNameTa: 1, tpId: 1, id: 1 })
      .toArray()
  : [];

const wardsInMaster = tpId
  ? await db
      .collection('wardsAndStreets')
      .aggregate([
        { $match: { $or: [{ tpId }, { townPanchayatId: tpId }] } },
        {
          $group: {
            _id: { $ifNull: ['$wardNo', '$wardNumber'] },
            streets: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
        { $limit: 30 },
      ])
      .toArray()
  : [];

function pickFields(fd) {
  if (!fd || typeof fd !== 'object') return {};
  const out = {};
  for (const k of Object.keys(fd)) {
    if (/ward|street|if_/i.test(k)) out[k] = fd[k];
  }
  return out;
}

console.log(
  JSON.stringify(
    {
      key,
      inspector: inspector
        ? {
            id: inspector.id,
            username: inspector.username,
            mobile: inspector.mobile,
            name: inspector.name,
            tpId: inspector.tpId,
            townPanchayatId: inspector.townPanchayatId,
            tpNameEn: inspector.tpNameEn,
            districtId: inspector.districtId,
            assignedWards: inspector.assignedWards,
            selectedWards: inspector.selectedWards,
            scopeType: inspector.scopeType,
          }
        : null,
      tpId,
      wardStreetCount,
      wardsInMaster,
      wardStreetSample,
      works: works.map((w) => ({
        workId: w.workId,
        id: w.id,
        submittedAt: w.submittedAt,
        tpId: w.tpId || w.townPanchayatId,
        tpNameEn: w.tpNameEn,
        ward: w.wardNumber || w.wardNo || w.ward,
        street: w.streetName || w.street,
        streetId: w.streetId,
        caption: w.imageCaption,
        fieldsSubset: pickFields(w.fieldsData),
      })),
    },
    null,
    2,
  ),
);

await client.close();