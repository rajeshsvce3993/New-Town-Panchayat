const SEP = '\x1f';
const ZONE_ID = 'z_csv_c4gr';

function emptyVal(v) {
  return v == null || String(v).trim() === '';
}

function rollupId(dims) {
  return [
    dims.submittedDateYmd || '',
    dims.zoneId || '',
    dims.districtId || '',
    dims.tpId || '',
    dims.wardNumber || '',
    dims.submittedByUserName || '',
    dims.subjectId || 'unknown',
    dims.categoryId || '_unknown',
  ].join(SEP);
}

const tps = db.townPanchayats.find({ zoneId: ZONE_ID }).toArray();
const byName = {};
tps.forEach((tp) => {
  const k = String(tp.nameEn || '')
    .trim()
    .toLowerCase();
  if (!k) return;
  if (!byName[k]) byName[k] = [];
  byName[k].push(tp);
});

const districts = {};
db.districts.find({ zoneId: ZONE_ID }).forEach((d) => {
  districts[d.id] = d;
});
const zone = db.zones.findOne({ id: ZONE_ID });

const works = db.inspectionWorks
  .find({
    $or: [{ zoneId: ZONE_ID }, { zoneNameEn: /vallur/i }],
    $and: [
      { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
      { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
    ],
  })
  .toArray();

print('Tiruvallur works missing district/tp=' + works.length);

let filled = 0;
const rollupCols = ['inspectionWorkReportRollups', 'inspectionWorkReportRollups_build', 'inspectionWorkReportRollups_prev'];

works.forEach((w) => {
  const name = String(w.tpNameEn || w.townPanchayat || '')
    .trim()
    .toLowerCase();
  const matches = byName[name] || [];
  if (matches.length !== 1) {
    print('SKIP unique tp name failed: ' + (w.workId || w._id) + ' tpName=' + name + ' matches=' + matches.length);
    return;
  }
  const tp = matches[0];
  const dist = districts[tp.districtId] || db.districts.findOne({ id: tp.districtId });
  const set = {
    tpId: tp.id,
    townPanchayatId: tp.id,
    tpNameEn: tp.nameEn,
    tpNameTa: tp.nameTa || w.tpNameTa,
    districtId: tp.districtId,
    districtNameEn: (dist && dist.nameEn) || w.districtNameEn || 'Tiruvallur',
    districtNameTa: (dist && dist.nameTa) || w.districtNameTa,
    zoneId: tp.zoneId || ZONE_ID,
    zoneNameEn: (zone && zone.nameEn) || 'Tiruvallur',
    zoneNameTa: (zone && zone.nameTa) || w.zoneNameTa,
  };
  db.inspectionWorks.updateOne({ _id: w._id }, { $set: set });
  filled += 1;

  const ymd = String(w.submittedDateYmd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
  const ward = String(w.wardNumber ?? w.wardNo ?? w.ward ?? '').trim();
  const user = String(w.submittedByUserName || w.username || '').trim();
  const oldDims = {
    submittedDateYmd: ymd,
    zoneId: String(w.zoneId || '').trim(),
    districtId: '',
    tpId: '',
    wardNumber: ward,
    submittedByUserName: user,
    subjectId: String(w.subjectId || 'unknown').trim() || 'unknown',
    categoryId: String(w.categoryId || '_unknown').trim() || '_unknown',
  };
  const newDims = {
    ...oldDims,
    zoneId: set.zoneId,
    districtId: set.districtId,
    tpId: set.tpId,
  };
  const oldId = rollupId(oldDims);
  const newId = rollupId(newDims);
  rollupCols.forEach((name) => {
    const col = db.getCollection(name);
    try {
      col.updateOne({ _id: oldId }, { $inc: { count: -1 } });
      col.deleteMany({ _id: oldId, count: { $lte: 0 } });
      col.updateOne(
        { _id: newId },
        {
          $inc: { count: 1 },
          $set: { zoneId: newDims.zoneId, districtId: newDims.districtId, tpId: newDims.tpId },
          $setOnInsert: {
            submittedDateYmd: newDims.submittedDateYmd,
            wardNumber: newDims.wardNumber,
            submittedByUserName: newDims.submittedByUserName,
            subjectId: newDims.subjectId,
            categoryId: newDims.categoryId,
          },
        },
        { upsert: true }
      );
    } catch (e) {
      print(name + ' rollup move skip: ' + e.message);
    }
  });
});

print('Filled Tiruvallur district/tp=' + filled);

const emptyFilter = {
  $and: [
    { $or: [{ zoneId: '' }, { zoneId: null }, { zoneId: { $exists: false } }] },
    { $or: [{ districtId: '' }, { districtId: null }, { districtId: { $exists: false } }] },
    { $or: [{ tpId: '' }, { tpId: null }, { tpId: { $exists: false } }] },
  ],
};

rollupCols.forEach((name) => {
  try {
    const res = db.getCollection(name).deleteMany(emptyFilter);
    print('Deleted empty rollup buckets from ' + name + '=' + res.deletedCount);
  } catch (e) {
    print(name + ' empty delete skip: ' + e.message);
  }
});

print('=== AFTER TODAY LOCATION ===');
printjson(
  db.inspectionWorkReportRollups
    .aggregate([
      { $match: { submittedDateYmd: '2026-11-13' } },
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
    ])
    .toArray()
);

print('today works=' + db.inspectionWorks.countDocuments({ submittedDateYmd: '2026-11-13' }));
printjson(
  db.inspectionWorkReportRollups
    .aggregate([{ $match: { submittedDateYmd: '2026-11-13' } }, { $group: { _id: null, n: { $sum: '$count' } } }])
    .toArray()
);
print(
  'remaining Tiruvallur missing district/tp=' +
    db.inspectionWorks.countDocuments({
      $or: [{ zoneId: ZONE_ID }, { zoneNameEn: /vallur/i }],
      $and: [
        { $or: [{ districtId: { $in: [null, ''] } }, { districtId: { $exists: false } }] },
        { $or: [{ tpId: { $in: [null, ''] } }, { tpId: { $exists: false } }] },
      ],
    })
);
