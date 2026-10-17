import { getMongoClient, getActiveMongoDb, getCollectionData, saveCollectionData, readLocalDb, writeLocalDb } from '@/lib/storage';
import { logServerProcess } from '@/lib/serverLogger';

export interface UserActivityRecord {
  id?: string;
  activityId: string;
  userId: string;
  username: string;
  name: string;
  role: string;
  roleId: string;
  designation: string;
  townPanchayat: string;
  tpId: string;
  status: 'LOGGED_IN' | 'LOGGED_OUT' | 'FORCED_LOGOUT' | 'DISABLED';
  loginTime: string;
  logoutTime?: string | null;
  lastActiveAt?: string;
  logoutReason?: string | null;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Extract client IP from Next.js request
 */
export function getClientIp(req?: any): string {
  if (!req) return '127.0.0.1';
  try {
    const forwarded = req.headers?.get?.('x-forwarded-for') || req.headers?.['x-forwarded-for'];
    if (forwarded) {
      return String(forwarded).split(',')[0].trim();
    }
    const realIp = req.headers?.get?.('x-real-ip') || req.headers?.['x-real-ip'];
    if (realIp) return String(realIp).trim();
    return req.ip || '127.0.0.1';
  } catch {
    return '127.0.0.1';
  }
}

/**
 * 1. Record User Login in user_activity MongoDB collection
 */
export async function recordUserLogin(user: any, req?: any): Promise<UserActivityRecord> {
  const ip = getClientIp(req);
  const now = new Date().toISOString();
  const userId = String(user.id || user._id || user.userId || 'u_' + user.username);
  const username = String(user.username || '').trim().toLowerCase();
  const activityId = `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const activityRecord: UserActivityRecord = {
    activityId,
    userId,
    username,
    name: user.name || user.nameEn || username,
    role: user.role || user.roleName || 'User',
    roleId: user.roleId || 'user',
    designation: user.designation || user.designationNameEn || '',
    townPanchayat: user.townPanchayat || user.tpNameEn || '',
    tpId: user.tpId || user.townPanchayatId || '',
    status: 'LOGGED_IN',
    loginTime: now,
    logoutTime: null,
    lastActiveAt: now,
    logoutReason: null,
    ipAddress: ip,
    userAgent: req?.headers?.get?.('user-agent') || req?.headers?.['user-agent'] || 'Mobile App',
  };

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const activityCol = db.collection('user_activity');
      await activityCol.insertOne(activityRecord as any);

      // Close previous unclosed sessions for this user
      await activityCol.updateMany(
        {
          username,
          status: 'LOGGED_IN',
          activityId: { $ne: activityId },
        },
        {
          $set: {
            status: 'LOGGED_OUT',
            logoutTime: now,
            logoutReason: 'Superseded by new login session',
          },
        }
      );

      // Update user state across user collections
      const userFilter = { $or: [{ username }, { id: userId }] };
      const userUpdate = {
        $set: {
          isLoggedIn: true,
          status: 'active',
          isActive: true,
          forceLoggedOut: false,
          lastLoginAt: now,
          lastActiveAt: now,
        },
      };

      await Promise.all([
        db.collection('users').updateOne(userFilter, userUpdate),
        db.collection('inspectionUsers').updateOne(userFilter, userUpdate),
        db.collection('employees').updateOne(userFilter, userUpdate),
      ]);
    }
  } catch (err: any) {
    console.error('[UserActivity] Error recording login in MongoDB:', err?.message || err);
  }

  // Also write instantly to local storage so user activity is immediately reflected
  try {
    const localDb = readLocalDb();
    if (!Array.isArray((localDb as any).user_activity)) (localDb as any).user_activity = [];
    (localDb as any).user_activity.forEach((act: any) => {
      if ((act.username === username || act.userId === userId) && act.status === 'LOGGED_IN') {
        act.status = 'LOGGED_OUT';
        act.logoutTime = now;
      }
    });
    (localDb as any).user_activity.unshift(activityRecord);
    (localDb as any).userActivities = [...(localDb as any).user_activity];
    writeLocalDb(localDb);
  } catch (_) {}

  // Write to human-readable server_process.log
  logServerProcess({
    category: 'LOGIN',
    action: 'USER_LOGIN_SUCCESS',
    username,
    userId,
    role: activityRecord.role,
    townPanchayat: activityRecord.townPanchayat,
    status: 'SUCCESS',
    details: `User logged in from ${activityRecord.userAgent} (${ip})`,
    ip,
  });

  return activityRecord;
}

/**
 * 2. Record User Logout in user_activity MongoDB collection
 */
export async function recordUserLogout(
  userIdOrUsername: string,
  reason: string = 'User voluntary logout',
  req?: any
): Promise<{ success: boolean; message: string }> {
  const cleanKey = String(userIdOrUsername || '').trim().toLowerCase();
  if (!cleanKey) return { success: true, message: 'Logged out successfully' };

  const now = new Date().toISOString();
  const ip = getClientIp(req);

  // Execute database updates & server process logging in background without blocking the HTTP response
  const executeLogoutWork = async () => {
    try {
      const client = await getMongoClient();
      if (client) {
        const db = await getActiveMongoDb(client);
        const activityCol = db.collection('user_activity');

        // Update active login session to LOGGED_OUT
        await activityCol.updateMany(
          {
            $or: [{ username: cleanKey }, { userId: cleanKey }],
            status: 'LOGGED_IN',
          },
          {
            $set: {
              status: 'LOGGED_OUT',
              logoutTime: now,
              logoutReason: reason,
            },
          }
        );

        // Mark user as logged out in master collections
        const userFilter = { $or: [{ username: cleanKey }, { id: cleanKey }] };
        const userUpdate = {
          $set: {
            isLoggedIn: false,
            lastLogoutAt: now,
          },
        };

        await Promise.allSettled([
          db.collection('users').updateOne(userFilter, userUpdate),
          db.collection('inspectionUsers').updateOne(userFilter, userUpdate),
          db.collection('employees').updateOne(userFilter, userUpdate),
        ]);
      }
    } catch (err: any) {
      console.error('[UserActivity] Background error recording logout in MongoDB:', err?.message || err);
    }

    // Write to server_process.log
    try {
      logServerProcess({
        category: 'LOGOUT',
        action: 'USER_LOGOUT',
        username: cleanKey,
        status: 'SUCCESS',
        details: `User logged out. Reason: ${reason}`,
        ip,
      });
    } catch (_) {}
  };

  // Trigger non-blocking async execution
  executeLogoutWork().catch((e) => console.error('[UserActivity] Logout background job failed:', e));

  return { success: true, message: 'Logged out successfully' };
}

/**
 * 3. Strictly Disable and Force Logout Single User
 * "If i disable user that time user logged in then logout then disable (strictly)"
 */
export async function disableAndLogoutUser(
  userIdOrUsername: string,
  adminUsername: string = 'admin',
  req?: any
): Promise<{ success: boolean; message: string }> {
  const cleanKey = String(userIdOrUsername || '').trim().toLowerCase();
  if (!cleanKey) return { success: false, message: 'User identifier required' };

  const now = new Date().toISOString();
  const ip = getClientIp(req);

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);

      // STEP 1: Check if user is currently logged in -> FIRST LOGOUT STRICTLY
      const activityCol = db.collection('user_activity');
      const activeSessions = await activityCol
        .find({
          $or: [{ username: cleanKey }, { userId: cleanKey }],
          status: 'LOGGED_IN',
        })
        .toArray();

      const wasLoggedIn = activeSessions.length > 0;

      // Close all sessions as FORCED_LOGOUT
      await activityCol.updateMany(
        {
          $or: [{ username: cleanKey }, { userId: cleanKey }],
          status: 'LOGGED_IN',
        },
        {
          $set: {
            status: 'FORCED_LOGOUT',
            logoutTime: now,
            logoutReason: `Disabled and force-logged-out by admin '${adminUsername}'`,
          },
        }
      );

      // STEP 2: THEN DISABLE USER
      const userFilter = { $or: [{ username: cleanKey }, { id: cleanKey }] };
      const userUpdate = {
        $set: {
          isLoggedIn: false,
          forceLoggedOut: true,
          status: 'disabled',
          isActive: false,
          disabledAt: now,
          disabledBy: adminUsername,
        },
      };

      await Promise.all([
        db.collection('users').updateOne(userFilter, userUpdate),
        db.collection('inspectionUsers').updateOne(userFilter, userUpdate),
        db.collection('employees').updateOne(userFilter, userUpdate),
      ]);

      // Write to server_process.log
      logServerProcess({
        category: 'USER_STATUS_CHANGE',
        action: 'USER_DISABLE_AND_LOGOUT',
        username: cleanKey,
        status: 'SUCCESS',
        details: `Strict sequence executed: ${wasLoggedIn ? 'User was logged in -> Forced logout first ->' : 'User was not logged in ->'} Then account disabled by admin '${adminUsername}'`,
        ip,
      });

      return {
        success: true,
        message: wasLoggedIn
          ? 'பயனர் உடனடியாக வெளியேற்றப்பட்டு (Logged out), பின்னர் கணக்கு முடக்கப்பட்டது (Disabled).'
          : 'பயனர் கணக்கு வெற்றிகரமாக முடக்கப்பட்டது (Disabled).',
      };
    }
  } catch (err: any) {
    console.error('[UserActivity] Error in disableAndLogoutUser:', err?.message || err);
    return { success: false, message: err?.message || 'Error executing disable and logout' };
  }

  return { success: false, message: 'Database connection failed' };
}

/**
 * 4. Bulk Disable and Logout by Role, Designation, and/or Town Panchayat
 * "Need user disable all and logout all by selecting user designation and user role wise, town panchayat wise."
 */
export async function bulkUserStatusAction(params: {
  action: 'disable_and_logout' | 'logout_only' | 'enable';
  roleId?: string;
  designation?: string;
  tpId?: string;
  adminUsername?: string;
  req?: any;
}): Promise<{ success: boolean; affectedCount: number; message: string }> {
  const { action, roleId, designation, tpId, adminUsername = 'admin', req } = params;
  const now = new Date().toISOString();
  const ip = getClientIp(req);

  try {
    const client = await getMongoClient();
    if (!client) {
      return { success: false, affectedCount: 0, message: 'MongoDB not connected' };
    }

    const db = await getActiveMongoDb(client);

    // Build filter based on criteria
    const matchFilter: any = {};
    if (roleId && roleId !== 'all') {
      matchFilter.$or = [{ roleId }, { role: roleId }, { roleName: roleId }];
    }
    if (designation && designation !== 'all') {
      const desRegex = new RegExp(`^${designation}$`, 'i');
      matchFilter.$or = [
        ...(matchFilter.$or || []),
        { designation: desRegex },
        { designationNameEn: desRegex },
        { designationNameTa: desRegex },
      ];
    }
    if (tpId && tpId !== 'all') {
      const tpRegex = new RegExp(`^${tpId}$`, 'i');
      matchFilter.$or = [
        ...(matchFilter.$or || []),
        { tpId: tpRegex },
        { townPanchayatId: tpRegex },
        { townPanchayat: tpRegex },
      ];
    }

    // Never disable the master admin account
    const excludeFilter = {
      username: { $nin: ['admin', 'dtpadmin', 'director', adminUsername.toLowerCase()] },
    };

    const finalQuery = Object.keys(matchFilter).length > 0 ? { $and: [matchFilter, excludeFilter] } : excludeFilter;

    // Find affected users across inspectionUsers, users, and employees
    const matchedInspectionUsers = await db.collection('inspectionUsers').find(finalQuery).toArray();
    const matchedUsers = await db.collection('users').find(finalQuery).toArray();
    const matchedEmployees = await db.collection('employees').find(finalQuery).toArray();

    const uniqueUsernames = new Set<string>();
    [...matchedInspectionUsers, ...matchedUsers, ...matchedEmployees].forEach((u) => {
      const uName = (u.username || '').trim().toLowerCase();
      if (uName) uniqueUsernames.add(uName);
    });

    const targetUsernames = Array.from(uniqueUsernames);
    if (targetUsernames.length === 0) {
      return {
        success: true,
        affectedCount: 0,
        message: 'தேர்ந்தெடுக்கப்பட்ட நிபந்தனைகளுக்கு எந்த பயனர்களும் கண்டறியப்படவில்லை (No matching users found).',
      };
    }

    const activityCol = db.collection('user_activity');

    if (action === 'disable_and_logout') {
      // 1. First logout all currently logged-in users
      await activityCol.updateMany(
        {
          username: { $in: targetUsernames },
          status: 'LOGGED_IN',
        },
        {
          $set: {
            status: 'FORCED_LOGOUT',
            logoutTime: now,
            logoutReason: `Bulk disabled and force-logged-out by admin '${adminUsername}'`,
          },
        }
      );

      // 2. Then strictly disable them
      const updateData = {
        $set: {
          isLoggedIn: false,
          forceLoggedOut: true,
          status: 'disabled',
          isActive: false,
          disabledAt: now,
          disabledBy: adminUsername,
        },
      };

      await Promise.all([
        db.collection('users').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('inspectionUsers').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('employees').updateMany({ username: { $in: targetUsernames } }, updateData),
      ]);

      logServerProcess({
        category: 'BULK_ACTION',
        action: 'BULK_DISABLE_AND_LOGOUT',
        username: adminUsername,
        status: 'SUCCESS',
        details: `Bulk action: Disabled and forced-logout ${targetUsernames.length} users (Criteria: Role=${roleId || 'All'}, Desig=${designation || 'All'}, TP=${tpId || 'All'}). Affected: ${targetUsernames.join(', ')}`,
        ip,
      });

      return {
        success: true,
        affectedCount: targetUsernames.length,
        message: `${targetUsernames.length} பயனர்கள் உடனடியாக வெளியேற்றப்பட்டு கணக்குகள் முடக்கப்பட்டன (Disabled & Logged out).`,
      };
    } else if (action === 'logout_only') {
      // Logout only
      await activityCol.updateMany(
        {
          username: { $in: targetUsernames },
          status: 'LOGGED_IN',
        },
        {
          $set: {
            status: 'FORCED_LOGOUT',
            logoutTime: now,
            logoutReason: `Bulk force-logged-out by admin '${adminUsername}'`,
          },
        }
      );

      const updateData = {
        $set: {
          isLoggedIn: false,
          forceLoggedOut: true,
        },
      };

      await Promise.all([
        db.collection('users').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('inspectionUsers').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('employees').updateMany({ username: { $in: targetUsernames } }, updateData),
      ]);

      logServerProcess({
        category: 'BULK_ACTION',
        action: 'BULK_LOGOUT_ONLY',
        username: adminUsername,
        status: 'SUCCESS',
        details: `Bulk action: Forced-logout ${targetUsernames.length} users. Affected: ${targetUsernames.join(', ')}`,
        ip,
      });

      return {
        success: true,
        affectedCount: targetUsernames.length,
        message: `${targetUsernames.length} பயனர்கள் உடனடியாக வெளியேற்றப்பட்டனர் (Logged out).`,
      };
    } else if (action === 'enable') {
      // Re-enable
      const updateData = {
        $set: {
          status: 'active',
          isActive: true,
          forceLoggedOut: false,
        },
      };

      await Promise.all([
        db.collection('users').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('inspectionUsers').updateMany({ username: { $in: targetUsernames } }, updateData),
        db.collection('employees').updateMany({ username: { $in: targetUsernames } }, updateData),
      ]);

      logServerProcess({
        category: 'BULK_ACTION',
        action: 'BULK_ENABLE_USERS',
        username: adminUsername,
        status: 'SUCCESS',
        details: `Bulk action: Re-enabled ${targetUsernames.length} users. Affected: ${targetUsernames.join(', ')}`,
        ip,
      });

      return {
        success: true,
        affectedCount: targetUsernames.length,
        message: `${targetUsernames.length} பயனர்கள் மீண்டும் செயல்படுத்தப்பட்டனர் (Enabled).`,
      };
    }

    return { success: false, affectedCount: 0, message: 'Invalid bulk action' };
  } catch (err: any) {
    console.error('[UserActivity] Error in bulkUserStatusAction:', err?.message || err);
    return { success: false, affectedCount: 0, message: err?.message || 'Error executing bulk action' };
  }
}

/**
 * 5. Get recent user activities & live active sessions
 */
export async function getUserActivitiesList(limit: number = 100, date?: string): Promise<{
  activeSessions: UserActivityRecord[];
  recentActivities: UserActivityRecord[];
}> {
  let mongoSessions: any[] = [];
  let mongoRecent: any[] = [];

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const activityCol = db.collection('user_activity');

      const dateQuery: any = {};
      if (date) {
        dateQuery.loginTime = { $regex: `^${date}` };
      }

      const [activeSessions, recentActivities] = await Promise.all([
        activityCol.find({ status: 'LOGGED_IN' }).sort({ loginTime: -1 }).toArray(),
        activityCol.find(dateQuery).sort({ loginTime: -1 }).limit(limit).toArray(),
      ]);

      mongoSessions = activeSessions.map((a: any) => ({ ...a, id: a._id?.toString() }));
      mongoRecent = recentActivities.map((a: any) => ({ ...a, id: a._id?.toString() }));
    }
  } catch (err) {
    console.error('[UserActivity] Error reading user activity list:', err);
  }

  // Merge with localDb records
  const localDb = readLocalDb();
  let localList: any[] = Array.isArray((localDb as any).user_activity) ? (localDb as any).user_activity : [];
  if (date) {
    localList = localList.filter((item) => String(item.loginTime || '').startsWith(date));
  }

  const activityMap = new Map<string, UserActivityRecord>();
  [...mongoRecent, ...localList].forEach((item) => {
    const key = item.activityId || `${item.userId}_${item.loginTime}`;
    if (!activityMap.has(key)) {
      activityMap.set(key, item);
    }
  });

  const mergedRecent = Array.from(activityMap.values())
    .sort((a, b) => new Date(b.loginTime || 0).getTime() - new Date(a.loginTime || 0).getTime())
    .slice(0, limit);

  const mergedActive = mergedRecent.filter((a) => a.status === 'LOGGED_IN');

  return {
    activeSessions: mergedActive,
    recentActivities: mergedRecent,
  };
}
