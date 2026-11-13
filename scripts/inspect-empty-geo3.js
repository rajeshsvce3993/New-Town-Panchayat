print('=== 29 EMPTY WORKS SAMPLE ===');
db.inspectionWorks
  .find(
    {
      $and: [
        { $or: [{ zoneId: { $in: [null, ''] } }, { zoneId: { $exists: false } }] },
        { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
        { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
      ],
    },
    {
      workId: 1,
      submittedDateYmd: 1,
      tpNameEn: 1,
      townPanchayat: 1,
      districtNameEn: 1,
      zoneNameEn: 1,
      submittedByUserName: 1,
      username: 1,
      _id: 0,
    }
  )
  .limit(30)
  .forEach((w) => printjson(w));

print('=== TODAY WORKS vs ROLLUP ===');
print('works today=' + db.inspectionWorks.countDocuments({ submittedDateYmd: '2026-11-13' }));
printjson(
  db.inspectionWorkReportRollups
    .aggregate([
      { $match: { submittedDateYmd: '2026-11-13' } },
      { $group: { _id: null, n: { $sum: '$count' } } },
    ])
    .toArray()
);

print('=== USERS FOR EMPTY INSPECTORS ===');
const names = db.inspectionWorks
  .find(
    {
      $and: [
        { $or: [{ zoneId: { $in: [null, ''] } }, { zoneId: { $exists: false } }] },
        { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
        { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
      ],
    },
    { submittedByUserName: 1, username: 1, _id: 0 }
  )
  .toArray()
  .map((w) => w.submittedByUserName || w.username);
printjson([...new Set(names)]);
db.inspectionUsers
  .find(
    { username: { $in: [...new Set(names)] } },
    { username: 1, tpId: 1, townPanchayatId: 1, districtId: 1, zoneId: 1, tpNameEn: 1, districtNameEn: 1, zoneNameEn: 1, _id: 0 }
  )
  .forEach((u) => printjson(u));
