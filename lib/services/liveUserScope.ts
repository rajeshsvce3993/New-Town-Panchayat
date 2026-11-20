import { getScopeVersionMeta, buildSingleUserScope, type CachedUserScope } from '@/lib/userScopeCache';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveInspectionScopeMasters } from '@/lib/inspectionScopeMasters';
import { isLiveDataOnly as liveDataOnlyEnv } from '@/lib/productionFlags';
import { getCollectionData } from '@/lib/storage';

const PROJ = { projection: { _id: 0, password: 0, passwordHash: 0 }, maxTimeMS: 8000 };

export function isLiveDataOnly(): boolean {
  return liveDataOnlyEnv();
}

/** Field/mobile app must never use user_scope_cache — always Mongo masters + inspectionUsers. */
export function useLiveInspectionScope(mobileClient?: boolean): boolean {
  if (mobileClient) return true;
  return liveDataOnlyEnv();
}

/**
 * Build inspection scope from Mongo for one user — no user_scope_cache read/write.
 */
export async function buildLiveUserScope(userIdOrUsername: string, maxTimeMS = 10_000): Promise<CachedUserScope | null> {
  const cleanKey = (userIdOrUsername || '').trim().toLowerCase();
  if (!cleanKey) return null;

  const db = await getDb();
  if (!db) return null;

  const ms = Math.min(maxTimeMS, 12_000);

  let foundUser: any = await db.collection('inspectionUsers').findOne(
    {
      $or: [{ username: cleanKey }, { mobile: cleanKey }, { phone: cleanKey }, { id: cleanKey }],
    },
    { ...PROJ, maxTimeMS: Math.min(ms, 4000) },
  );
  if (!foundUser) {
    const hit = await findUserForLogin(cleanKey, cleanKey, { mobileClient: true });
    if (hit?.sourceCollection === 'inspectionUsers') foundUser = hit.userDoc;
  }
  if (!foundUser) return null;

  const scopeGeo = await resolveInspectionScopeMasters(db, foundUser);

  const [subjects, categories, fields, inspectionRoles, inspectionDesignations] = await Promise.all([
    getCollectionData('inspectionSubjects'),
    getCollectionData('inspectionCategories'),
    getCollectionData('inspectionFields'),
    getCollectionData('inspectionRoles'),
    getCollectionData('inspectionDesignations'),
  ]);

  const meta = getScopeVersionMeta();
  return buildSingleUserScope(
    foundUser,
    {
      townPanchayats: scopeGeo.townPanchayats,
      districts: scopeGeo.districts,
      zones: scopeGeo.zones,
      wardsAndStreets: scopeGeo.wardsAndStreets,
      subjects,
      categories,
      fields,
      inspectionRoles,
      inspectionDesignations,
      scopeKind: scopeGeo.scopeKind,
      scopeZoneId: scopeGeo.zoneId,
      scopeTpIds: scopeGeo.tpIds,
    },
    meta.version,
    db,
  );
}