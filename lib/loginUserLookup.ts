import { getActiveMongoDb, getMongoClient } from '@/lib/storage';

export type LoginUserHit = { userDoc: any; sourceCollection: 'users' | 'inspectionUsers' | 'employees' };

/**
 * Indexed login lookup — avoids slow $or scans on `users` when mobile number is the username.
 */
export async function findUserForLogin(
  username: string,
  cleanUsername: string,
  opts: { mobileClient: boolean },
): Promise<LoginUserHit | null> {
  const client = await getMongoClient();
  if (!client) return null;
  const db = await getActiveMongoDb(client);
  const usernameVariants = Array.from(new Set([cleanUsername, String(username || '').trim()].filter(Boolean)));
  const isPhone = /^\d{10,12}$/.test(cleanUsername);
  const maxTimeMS = opts.mobileClient ? 2500 : 6000;
  const hint = { maxTimeMS };

  const usersCol = db.collection('users');
  const inspCol = db.collection('inspectionUsers');
  const empCol = db.collection('employees');

  const findIndexed = async () => {
    if (isPhone && opts.mobileClient) {
      const byMobile = await usersCol.findOne({ mobile: cleanUsername }, hint);
      if (byMobile) return { userDoc: byMobile, sourceCollection: 'users' as const };
      const byPhone = await usersCol.findOne({ phone: cleanUsername }, hint);
      if (byPhone) return { userDoc: byPhone, sourceCollection: 'users' as const };
    }
    if (usernameVariants.length) {
      const byUser = await usersCol.findOne({ username: { $in: usernameVariants } }, hint);
      if (byUser) return { userDoc: byUser, sourceCollection: 'users' as const };
    }
    return null;
  };

  const findInsp = async () => {
    if (isPhone) {
      const byMobile = await inspCol.findOne({ mobile: cleanUsername }, hint);
      if (byMobile) return { userDoc: byMobile, sourceCollection: 'inspectionUsers' as const };
    }
    if (usernameVariants.length) {
      const byUser = await inspCol.findOne({ username: { $in: usernameVariants } }, hint);
      if (byUser) return { userDoc: byUser, sourceCollection: 'inspectionUsers' as const };
    }
    const byEmpId = await inspCol.findOne({ employeeId: cleanUsername }, hint);
    if (byEmpId) return { userDoc: byEmpId, sourceCollection: 'inspectionUsers' as const };
    return null;
  };

  const [portalHit, inspHit] = await Promise.all([findIndexed(), findInsp()]);
  if (portalHit) return portalHit;
  if (inspHit) return inspHit;

  const empUser = await empCol.findOne(
    {
      $or: [{ username: { $in: usernameVariants } }, { employeeId: cleanUsername }],
    },
    hint,
  );
  if (empUser) return { userDoc: empUser, sourceCollection: 'employees' };

  return null;
}