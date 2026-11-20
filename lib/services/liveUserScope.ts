import { getScopeVersionMeta, buildSingleUserScope, type CachedUserScope } from '@/lib/userScopeCache';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveInspectionScopeMasters } from '@/lib/inspectionScopeMasters';
import { resolveInspectorProfileFromDb } from '@/lib/inspectionUserProfile';
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

function compactGeo(
  rows: any[],
  extra?: (r: any) => Record<string, string>,
): { id: string; nameEn: string; nameTa: string; code?: string; districtId?: string; zoneId?: string }[] {
  return (rows || [])
    .map((r) => ({
      id: String(r.id || ''),
      nameEn: String(r.nameEn || ''),
      nameTa: String(r.nameTa || ''),
      code: r.code ? String(r.code) : undefined,
      ...(extra ? extra(r) : {}),
    }))
    .filter((r) => r.id);
}

/**
 * Fast mobile login payload: live zone/district/TP + profile only.
 * Streets, subjects, and fields load after sign-in via /api/masters/scope.
 */
export async function buildMobileLoginScope(userDoc: any): Promise<CachedUserScope | null> {
  if (!userDoc) return null;
  const db = await getDb();
  if (!db) return null;

  const scopeGeo = await resolveInspectionScopeMasters(db, userDoc, { includeWards: false });
  let profile: Awaited<ReturnType<typeof resolveInspectorProfileFromDb>> | undefined;
  try {
    profile = await resolveInspectorProfileFromDb(db, userDoc);
  } catch {
    /* optional */
  }

  const zones = compactGeo(scopeGeo.zones);
  const districts = compactGeo(scopeGeo.districts, (d) => ({ zoneId: String(d.zoneId || '') }));
  const townPanchayats = compactGeo(scopeGeo.townPanchayats, (t) => ({
    districtId: String(t.districtId || ''),
    zoneId: String(t.zoneId || ''),
  }));
  const zone = zones[0];
  const district = districts[0];
  const tp = townPanchayats.length === 1 ? townPanchayats[0] : null;
  const meta = getScopeVersionMeta();
  const safeUser = { ...userDoc };
  delete safeUser.password;
  delete safeUser.passwordHash;

  return {
    userId: String(userDoc.id || userDoc._id || ''),
    username: String(userDoc.username || '').trim().toLowerCase(),
    scopeVersion: meta.version,
    updatedAt: new Date().toISOString(),
    scopeType: scopeGeo.scopeKind,
    scopeKind: scopeGeo.scopeKind,
    user: safeUser,
    townPanchayat: {
      id: tp?.id || '',
      nameEn: tp?.nameEn || '',
      nameTa: tp?.nameTa || '',
      districtId: String(district?.id || tp?.districtId || ''),
      districtNameEn: district?.nameEn || '',
      districtNameTa: district?.nameTa || '',
      zoneId: String(zone?.id || scopeGeo.zoneId || ''),
      zoneNameEn: zone?.nameEn || '',
      zoneNameTa: zone?.nameTa || '',
    },
    zones,
    districts,
    townPanchayats,
    assignedWards: [],
    wardsAndStreets: [],
    subjects: [],
    categories: [],
    fields: [],
    validationRules: {},
    profile,
  };
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

  const roles = await db
    .collection('inspectionRoles')
    .find({}, { projection: { _id: 0, id: 1, code: 1, scopeType: 1, scope: 1, nameEn: 1 }, maxTimeMS: 4000 })
    .toArray()
    .catch(() => [] as any[]);
  const roleKey = String(foundUser.roleId || foundUser.role || '').toLowerCase().trim();
  const matchedRole = (roles || []).find(
    (r: any) =>
      String(r.id || '').toLowerCase() === roleKey ||
      String(r.code || '').toLowerCase() === roleKey ||
      String(r.nameEn || '').toLowerCase() === roleKey,
  );
  const existingScope = String(foundUser.scopeType || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
  const keepAssigned = ['zone', 'zonal', 'hod', 'district', 'multi_tp'].includes(existingScope);
  const userForScope = {
    ...foundUser,
    roleId: foundUser.roleId || matchedRole?.id || foundUser.role,
    scopeType: keepAssigned
      ? foundUser.scopeType
      : matchedRole?.scopeType || matchedRole?.scope || foundUser.scopeType,
  };

  const scopeGeo = await resolveInspectionScopeMasters(db, userForScope);

  const [subjects, categories, fields, inspectionRoles, inspectionDesignations] = await Promise.all([
    getCollectionData('inspectionSubjects'),
    getCollectionData('inspectionCategories'),
    getCollectionData('inspectionFields'),
    getCollectionData('inspectionRoles'),
    getCollectionData('inspectionDesignations'),
  ]);

  const meta = getScopeVersionMeta();
  return buildSingleUserScope(
    userForScope,
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