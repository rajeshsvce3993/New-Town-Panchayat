import { MongoClient } from 'mongodb';

const tpId = process.argv[2] || 'tp_csv_9kd7';
const client = new MongoClient('mongodb://127.0.0.1:27017/dtp_enterprise');
await client.connect();
const db = client.db('dtp_enterprise');
const tp = await db.collection('townPanchayats').findOne({ id: tpId });
const name = tp?.nameEn || '';
const variants = [...new Set([tpId, tpId.toLowerCase(), tpId.toUpperCase()].filter(Boolean))];
const or = [
  { tpId: { $in: variants } },
  { townPanchayatId: { $in: variants } },
  { assignedTpId: { $in: variants } },
  { selectedTpIds: { $in: variants } },
  { townPanchayatIds: { $in: variants } },
  { scopeId: { $in: variants } },
];
if (name) {
  or.push({ townPanchayat: name }, { tpName: name }, { townPanchayatNameEn: name });
}
const total = await db.collection('inspectionUsers').countDocuments({ $or: or });
const items = await db
  .collection('inspectionUsers')
  .find({ $or: or })
  .project({ username: 1, nameEn: 1, nameTa: 1, employeeName: 1, employeeNameEn: 1, tpId: 1, selectedTpIds: 1 })
  .limit(30)
  .toArray();
console.log(JSON.stringify({ tpId, name, total, items }, null, 2));
await client.close();