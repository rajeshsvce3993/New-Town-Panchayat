import { MongoClient } from 'mongodb';

const client = new MongoClient('mongodb://127.0.0.1:27017/dtp_enterprise');
await client.connect();
const db = client.db('dtp_enterprise');
const top = await db
  .collection('inspectionUsers')
  .aggregate([
    { $project: { tpId: 1, selectedTpIds: 1, townPanchayatIds: 1 } },
    {
      $facet: {
        byTpId: [{ $group: { _id: '$tpId', c: { $sum: 1 } } }, { $sort: { c: -1 } }, { $limit: 5 }],
      },
    },
  ])
  .toArray();
console.log(JSON.stringify(top, null, 2));
await client.close();