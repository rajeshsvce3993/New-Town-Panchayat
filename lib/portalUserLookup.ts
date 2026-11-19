import { getActiveMongoDb, getCollectionData, getMongoClient } from '@/lib/storage';

/** Indexed Mongo lookup — avoids loading every inspection user on each portal-state request. */
export async function findPortalRequestingUser(requestedUser: string): Promise<any | null> {
  const key = (requestedUser || '').trim().toLowerCase();
  if (!key) return null;
  const variants = Array.from(new Set([key, String(requestedUser || '').trim()].filter(Boolean)));

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const identityOr = [
        { username: { $in: variants } },
        { mobile: key },
        { phone: key },
        { employeeId: key },
        { id: key },
      ];
      const [insp, portal, emp] = await Promise.all([
        db.collection('inspectionUsers').findOne({ $or: identityOr }),
        db.collection('users').findOne({ $or: identityOr }),
        db.collection('employees').findOne({ $or: identityOr }),
      ]);
      return insp || portal || emp || null;
    }
  } catch {
    /* local fallback */
  }

  const [inspectionUsers, users, employees] = await Promise.all([
    getCollectionData('inspectionUsers'),
    getCollectionData('users'),
    getCollectionData('employees'),
  ]);
  const all = [...(inspectionUsers || []), ...(users || []), ...(employees || [])];
  return (
    all.find(
      (u: any) =>
        String(u.username || '').toLowerCase() === key ||
        String(u.id || '').toLowerCase() === key ||
        String(u._id || '').toLowerCase() === key ||
        String(u.mobile || '').trim() === key ||
        String(u.employeeId || '').toLowerCase() === key,
    ) || null
  );
}