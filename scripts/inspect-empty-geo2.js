print('=== TP NAME DUPES IN TIRUVALLUR ZONE ===');
db.townPanchayats
  .aggregate([
    { $match: { zoneId: 'z_csv_c4gr' } },
    { $group: { _id: '$nameEn', n: { $sum: 1 }, ids: { $push: { id: '$id', districtId: '$districtId' } } } },
    { $match: { n: { $gt: 1 } } },
  ])
  .forEach((r) => printjson(r));

print('=== GLOBAL TP NAME DUPES FOR ARANI/UTHUKOTTAI ===');
db.townPanchayats
  .aggregate([
    { $match: { nameEn: { $in: ['Arani', 'Uthukottai', 'Gummidipoondi'] } } },
    { $group: { _id: '$nameEn', n: { $sum: 1 }, rows: { $push: { id: '$id', districtId: '$districtId', zoneId: '$zoneId' } } } },
  ])
  .forEach((r) => printjson(r));

print('=== ALL-TIME TIRUVALLUR ZONE MISSING DISTRICT/TP ===');
printjson(
  db.inspectionWorks.countDocuments({
    $or: [{ zoneId: 'z_csv_c4gr' }, { zoneNameEn: /vallur/i }],
    $and: [
      { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
      { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
    ],
  })
);

print('=== ALL-TIME FULLY EMPTY GEO WORKS ===');
printjson(
  db.inspectionWorks.countDocuments({
    $and: [
      { $or: [{ zoneId: { $in: [null, ''] } }, { zoneId: { $exists: false } }] },
      { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
      { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
    ],
  })
);

print('=== EMPTY ROLLUP TOTAL ===');
printjson(
  db.inspectionWorkReportRollups
    .aggregate([
      {
        $match: {
          $and: [
            { $or: [{ zoneId: '' }, { zoneId: null }, { zoneId: { $exists: false } }] },
            { $or: [{ districtId: '' }, { districtId: null }, { districtId: { $exists: false } }] },
            { $or: [{ tpId: '' }, { tpId: null }, { tpId: { $exists: false } }] },
          ],
        },
      },
      { $group: { _id: '$submittedDateYmd', n: { $sum: '$count' } } },
      { $sort: { _id: -1 } },
      { $limit: 10 },
    ])
    .toArray()
);

print('=== TIRUVALLUR ZONE EMPTY DISTRICT ROLLUP ===');
printjson(
  db.inspectionWorkReportRollups
    .aggregate([
      { $match: { zoneId: 'z_csv_c4gr', $or: [{ districtId: '' }, { districtId: null }, { districtId: { $exists: false } }] } },
      { $group: { _id: '$submittedDateYmd', n: { $sum: '$count' } } },
      { $sort: { _id: -1 } },
      { $limit: 10 },
    ])
    .toArray()
);
