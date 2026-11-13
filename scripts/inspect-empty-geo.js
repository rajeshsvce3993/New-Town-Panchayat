const empty = (v) => v == null || String(v).trim() === '';

print('=== ZONES ===');
db.zones.find({}, { id: 1, nameEn: 1, nameTa: 1, code: 1, _id: 0 }).forEach((z) => printjson(z));

print('=== DISTRICTS ===');
db.districts
  .find({}, { id: 1, nameEn: 1, nameTa: 1, zoneId: 1, zoneNameEn: 1, code: 1, _id: 0 })
  .forEach((d) => printjson(d));

print('=== TIRUVALLUR TPS (sample 30) ===');
db.townPanchayats
  .find(
    {
      $or: [
        { districtNameEn: /vallur/i },
        { nameEn: /vallur/i },
        { zoneNameEn: /vallur/i },
        { districtId: /vallur/i },
        { zoneId: /vallur/i },
      ],
    },
    { id: 1, nameEn: 1, districtId: 1, districtNameEn: 1, zoneId: 1, zoneNameEn: 1, _id: 0 }
  )
  .limit(30)
  .forEach((t) => printjson(t));

print('=== TODAY EMPTY GEO WORKS ===');
const today = '2026-11-13';
const emptyFilter = {
  submittedDateYmd: today,
  $and: [
    { $or: [{ zoneId: { $in: [null, ''] } }, { zoneId: { $exists: false } }] },
    { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
    { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
  ],
};
print('empty zone+district+tp count=' + db.inspectionWorks.countDocuments(emptyFilter));

print('=== TODAY WORKS GEO BREAKDOWN ===');
db.inspectionWorks
  .aggregate([
    { $match: { submittedDateYmd: today } },
    {
      $group: {
        _id: {
          zoneId: { $ifNull: ['$zoneId', ''] },
          districtId: { $ifNull: ['$districtId', ''] },
          tpId: { $ifNull: ['$tpId', ''] },
          zoneNameEn: { $ifNull: ['$zoneNameEn', ''] },
          districtNameEn: { $ifNull: ['$districtNameEn', ''] },
          tpNameEn: { $ifNull: ['$tpNameEn', ''] },
        },
        n: { $sum: 1 },
      },
    },
    { $sort: { n: -1 } },
    { $limit: 40 },
  ])
  .forEach((r) => printjson(r));

print('=== SAMPLE EMPTY TODAY ===');
db.inspectionWorks
  .find(emptyFilter, {
    workId: 1,
    tpId: 1,
    townPanchayatId: 1,
    tpNameEn: 1,
    townPanchayat: 1,
    districtId: 1,
    districtNameEn: 1,
    zoneId: 1,
    zoneNameEn: 1,
    submittedByUserName: 1,
    username: 1,
    _id: 0,
  })
  .limit(15)
  .forEach((w) => printjson(w));

print('=== SAMPLE TIRUVALLUR ZONE NO DISTRICT ===');
db.inspectionWorks
  .find(
    {
      submittedDateYmd: today,
      $or: [{ zoneNameEn: /vallur/i }, { zoneId: /vallur/i }],
      $and: [
        { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
        { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
      ],
    },
    {
      workId: 1,
      zoneId: 1,
      zoneNameEn: 1,
      districtId: 1,
      districtNameEn: 1,
      tpId: 1,
      tpNameEn: 1,
      townPanchayat: 1,
      submittedByUserName: 1,
      _id: 0,
    }
  )
  .limit(15)
  .forEach((w) => printjson(w));

print('=== ROLLUP EMPTY TODAY ===');
db.inspectionWorkReportRollups
  .aggregate([
    { $match: { submittedDateYmd: today } },
    {
      $group: {
        _id: {
          zoneId: { $ifNull: ['$zoneId', ''] },
          districtId: { $ifNull: ['$districtId', ''] },
          tpId: { $ifNull: ['$tpId', ''] },
        },
        n: { $sum: '$count' },
      },
    },
    { $sort: { n: -1 } },
    { $limit: 20 },
  ])
  .forEach((r) => printjson(r));
