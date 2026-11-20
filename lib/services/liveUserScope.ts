import { getScopeVersionMeta, buildSingleUserScope, type CachedUserScope } from '@/lib/userScopeCache';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveInspectionScopeMasters } from '@/lib/inspectionScopeMasters';

const LIVE_SCOPE = process.env.LIVE_DATA_ONLY !== '0';
const PROJ = { projection: { _id: 0, password: 0, passwordHash: 0 }, maxTimeMS: 8000 };

export function isLiveDataOnly(): boolean {
  return LIVE_SCOPE;
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

  const [subjects, categories, fields] = await Promise.all([
    db.collection('inspectionSubjects').find({}, PROJ).limit(100).toArray(),
    db.collection('inspectionCategories').find({}, PROJ).limit(200).toArray(),
    db.collection('inspectionFields').find({}, PROJ).limit(200).toArray(),
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
      scopeKind: scopeGeo.scopeKind,
      scopeZoneId: scopeGeo.zoneId,
      scopeTpIds: scopeGeo.tpIds,
    },
    meta.version,
  );
}