import type { Db } from 'mongodb';
import { isHodLikeUser, isZonalScopedUser } from '@/lib/userScope';
import { loadDistrictsByZone, loadTownPanchayatsByDistrict } from '@/lib/repositories/geoMastersRepository';

const PROJ = { projection: { _id: 0, password: 0, passwordHash: 0 }, maxTimeMS: 8000 };
const WARD_LIMIT = 8000;

export type InspectionScopeKind = 'hod' | 'zonal' | 'district' | 'multi_tp' | 'single_tp' | 'field_worker';

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function scopeTypeKey(scopeType: unknown): string {
  return norm(scopeType).toLowerCase().replace(/[\s_-]+/g, '_');
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

export function resolveInspectionScopeKind(user: any): InspectionScopeKind {
  if (isHodLikeUser(user)) return 'hod';
  const st = scopeTypeKey(user.scopeType);
  if (isZonalScopedUser(user) || st === 'zonal' || st === 'zone') return 'zonal';
  if (st === 'district') return 'district';
  if (st === 'multi_tp' && userTownPanchayatIds(user).length > 1) return 'multi_tp';
  if (st === 'field_worker' || st === 'field_workers') return 'field_worker';
  return 'single_tp';
}

async function resolveZoneId(db: Db, user: any): Promise<string> {
  const candidates = [
    user.zoneId,
    user.scopeId,
    user.zone,
    user.zoneNameEn,
    user.zoneName,
  ].map(norm).filter(Boolean);
  for (const cand of candidates) {
    const hit = await db.collection('zones').findOne(
      {
        $or: [
          { id: { $in: idVariants(cand) } },
          { nameEn: { $regex: new RegExp(`^${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      },
      { projection: { id: 1 }, maxTimeMS: 3000 },
    );
    if (hit?.id) return String(hit.id);
  }
  return norm(user.zoneId || user.scopeId);
}

async function resolveDistrictId(db: Db, user: any): Promise<string> {
  const candidates = [user.districtId, user.scopeId, user.district, user.districtName].map(norm).filter(Boolean);
  for (const cand of candidates) {
    const hit = await db.collection('districts').findOne(
      {
        $or: [
          { id: { $in: idVariants(cand) } },
          { nameEn: { $regex: new RegExp(`^${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } },
        ],
      },
      { projection: { id: 1, zoneId: 1 }, maxTimeMS: 3000 },
    );
    if (hit?.id) return String(hit.id);
  }
  return norm(user.districtId);
}

async function loadTpsForZone(db: Db, zoneId: string): Promise<any[]> {
  if (!zoneId) return [];
  const districts = await loadDistrictsByZone(db, zoneId);
  const districtIds = districts.map((d: any) => d.id).filter(Boolean);
  if (!districtIds.length) return [];
  return db
    .collection('townPanchayats')
    .find({ districtId: { $in: districtIds.map((id) => idVariants(id)).flat() } }, PROJ)
    .limit(500)
    .toArray();
}

export type InspectionScopeMasters = {
  scopeKind: InspectionScopeKind;
  zoneId: string;
  districtIds: string[];
  tpIds: string[];
  zones: any[];
  districts: any[];
  townPanchayats: any[];
  wardsAndStreets: any[];
};

/**
 * Role-aware geo masters for inspection mobile scope (zonal / multi TP / single TP / district).
 */
export async function resolveInspectionScopeMasters(db: Db, user: any): Promise<InspectionScopeMasters> {
  const scopeKind = resolveInspectionScopeKind(user);
  let zones: any[] = [];
  let districts: any[] = [];
  let townPanchayats: any[] = [];
  let zoneId = '';
  let districtIds: string[] = [];

  if (scopeKind === 'hod') {
    const [z, d, tps] = await Promise.all([
      db.collection('zones').find({}, PROJ).limit(100).toArray(),
      db.collection('districts').find({}, PROJ).limit(200).toArray(),
      db.collection('townPanchayats').find({}, PROJ).limit(500).toArray(),
    ]);
    zones = z;
    districts = d;
    townPanchayats = tps;
    zoneId = norm(zones[0]?.id);
    districtIds = districts.map((x: any) => norm(x.id)).filter(Boolean);
  } else if (scopeKind === 'zonal') {
    zoneId = await resolveZoneId(db, user);
    if (zoneId) {
      zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
      districts = await loadDistrictsByZone(db, zoneId);
      districtIds = districts.map((d: any) => norm(d.id)).filter(Boolean);
      townPanchayats = await loadTpsForZone(db, zoneId);
    }
  } else if (scopeKind === 'district') {
    const districtId = await resolveDistrictId(db, user);
    if (districtId) {
      districts = await db
        .collection('districts')
        .find({ id: { $in: idVariants(districtId) } }, PROJ)
        .toArray();
      districtIds = [districtId];
      zoneId = norm(districts[0]?.zoneId || user.zoneId);
      if (zoneId) {
        zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
      }
      townPanchayats = await loadTownPanchayatsByDistrict(db, districtId);
    }
  } else {
    const tpIds = userTownPanchayatIds(user);
    if (tpIds.length) {
      const idIn = [...new Set(tpIds.flatMap((id) => idVariants(id)))];
      townPanchayats = await db.collection('townPanchayats').find({ id: { $in: idIn } }, PROJ).toArray();
    } else if (user.districtId) {
      townPanchayats = await loadTownPanchayatsByDistrict(db, String(user.districtId));
    } else if (user.zoneId) {
      zoneId = await resolveZoneId(db, user);
      townPanchayats = await loadTpsForZone(db, zoneId);
      districts = await loadDistrictsByZone(db, zoneId);
      districtIds = districts.map((d: any) => norm(d.id)).filter(Boolean);
      zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
    }

    districtIds = [
      ...new Set(
        [
          norm(user.districtId),
          ...townPanchayats.map((t: any) => norm(t.districtId)).filter(Boolean),
        ].filter(Boolean),
      ),
    ];
    if (districtIds.length) {
      districts = await db
        .collection('districts')
        .find({ id: { $in: districtIds.flatMap((id) => idVariants(id)) } }, PROJ)
        .toArray();
    }
    zoneId =
      norm(user.zoneId) ||
      norm(districts[0]?.zoneId) ||
      norm(townPanchayats[0]?.zoneId) ||
      (await resolveZoneId(db, user));
    if (zoneId && !zones.length) {
      zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
    }
  }

  if (!zoneId) {
    zoneId = norm(user.zoneId) || norm(zones[0]?.id) || norm(districts[0]?.zoneId);
  }

  const tpIds = townPanchayats.map((t: any) => norm(t.id)).filter(Boolean);
  const tpIdIn = [...new Set(tpIds.flatMap((id) => idVariants(id)))];
  const wardFilter =
    tpIdIn.length > 0
      ? { $or: [{ tpId: { $in: tpIdIn } }, { townPanchayatId: { $in: tpIdIn } }] }
      : {};

  const wardsAndStreets =
    Object.keys(wardFilter).length > 0
      ? await db.collection('wardsAndStreets').find(wardFilter, PROJ).limit(WARD_LIMIT).toArray()
      : [];

  return {
    scopeKind,
    zoneId,
    districtIds,
    tpIds,
    zones,
    districts,
    townPanchayats,
    wardsAndStreets,
  };
}