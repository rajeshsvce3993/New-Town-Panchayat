import { getScopeVersionMeta, buildSingleUserScope, type CachedUserScope } from '@/lib/userScopeCache';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { loadDistrictsByZone, loadTownPanchayatsByDistrict } from '@/lib/repositories/geoMastersRepository';

const LIVE_SCOPE = process.env.LIVE_DATA_ONLY !== '0';
const PROJ = { projection: { _id: 0, password: 0, passwordHash: 0 }, maxTimeMS: 8000 };
const WARD_SCOPE_LIMIT = 2500;

export function isLiveDataOnly(): boolean {
  return LIVE_SCOPE;
}

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function idVariants(id: string): string[] {
  const s = norm(id);
  if (!s) return [];
  return [...new Set([s, s.toLowerCase(), s.toUpperCase()])];
}

function userTownPanchayatIds(user: any): string[] {
  const fromArrays = [
    ...(Array.isArray(user.townPanchayatIds) ? user.townPanchayatIds : []),
    ...(Array.isArray(user.selectedTpIds) ? user.selectedTpIds : []),
  ].map(norm).filter(Boolean);
  const single = norm(user.tpId || user.townPanchayatId);
  return [...new Set(single ? [single, ...fromArrays] : fromArrays)];
}

/**
 * Build inspection scope from Mongo for one user — no user_scope_cache read/write.
 * Geo masters loaded by id / cascade (zone → district → TP → wards), not full-state scan.
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

  const tpIds = userTownPanchayatIds(foundUser);
  let townPanchayats: any[] = [];
  if (tpIds.length) {
    const idIn = [...new Set(tpIds.flatMap((id) => idVariants(id)))];
    townPanchayats = await db.collection('townPanchayats').find({ id: { $in: idIn } }, PROJ).toArray();
  } else if (foundUser.districtId) {
    townPanchayats = await loadTownPanchayatsByDistrict(db, String(foundUser.districtId));
  } else if (foundUser.zoneId) {
    const districts = await loadDistrictsByZone(db, String(foundUser.zoneId));
    const districtIds = districts.map((d: any) => d.id).filter(Boolean);
    if (districtIds.length) {
      townPanchayats = await db
        .collection('townPanchayats')
        .find({ districtId: { $in: districtIds } }, PROJ)
        .limit(500)
        .toArray();
    }
  }

  const districtIds = [
    ...new Set(
      [
        norm(foundUser.districtId),
        ...townPanchayats.map((t: any) => norm(t.districtId)).filter(Boolean),
      ].filter(Boolean),
    ),
  ];
  const zoneIds = [
    ...new Set(
      [
        norm(foundUser.zoneId),
        ...townPanchayats.map((t: any) => norm(t.zoneId)).filter(Boolean),
      ].filter(Boolean),
    ),
  ];

  const scopeTpIds = townPanchayats.map((t: any) => norm(t.id)).filter(Boolean);
  const wardFilter =
    scopeTpIds.length > 0
      ? { $or: [{ tpId: { $in: scopeTpIds } }, { townPanchayatId: { $in: scopeTpIds } }] }
      : tpIds.length > 0
        ? { $or: [{ tpId: { $in: tpIds } }, { townPanchayatId: { $in: tpIds } }] }
        : {};

  const [districts, zones, userStreets, subjects, categories, fields] = await Promise.all([
    districtIds.length
      ? db.collection('districts').find({ id: { $in: districtIds } }, PROJ).toArray()
      : Promise.resolve([] as any[]),
    zoneIds.length
      ? db.collection('zones').find({ id: { $in: zoneIds } }, PROJ).toArray()
      : Promise.resolve([] as any[]),
    Object.keys(wardFilter).length
      ? db.collection('wardsAndStreets').find(wardFilter, PROJ).limit(WARD_SCOPE_LIMIT).toArray()
      : Promise.resolve([] as any[]),
    db.collection('inspectionSubjects').find({}, PROJ).limit(100).toArray(),
    db.collection('inspectionCategories').find({}, PROJ).limit(200).toArray(),
    db.collection('inspectionFields').find({}, PROJ).limit(200).toArray(),
  ]);

  const meta = getScopeVersionMeta();
  return buildSingleUserScope(
    foundUser,
    {
      townPanchayats,
      districts,
      zones,
      wardsAndStreets: userStreets,
      subjects,
      categories,
      fields,
    },
    meta.version,
  );
}