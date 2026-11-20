import type { Db } from 'mongodb';
import { isHodLikeUser, isZonalScopedUser } from '@/lib/userScope';
import { geoNamesEqual } from '@/lib/geoNameMatch';
import {
  loadDistrictsByZone,
  loadTownPanchayatsByDistrict,
  loadTownPanchayatsByZone,
} from '@/lib/repositories/geoMastersRepository';

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
  const single = norm(user.tpId || user.townPanchayatId || user.assignedTpId);
  return [...new Set(single ? [single, ...fromArrays] : fromArrays)];
}

function uniqueById(rows: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const row of rows) {
    const id = norm(row?.id);
    if (!id || seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    out.push(row);
  }
  return out;
}

function inspectionRoleKey(user: any): string {
  return String(user?.roleId || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
}

export function resolveInspectionScopeKind(user: any): InspectionScopeKind {
  if (!user) return 'single_tp';
  const roleKey = inspectionRoleKey(user);
  const st = scopeTypeKey(user.scopeType);

  if (roleKey === 'role_field_worker' || roleKey === 'role_field_workers' || st === 'field_worker' || st === 'field_workers') {
    return 'field_worker';
  }
  if (roleKey === 'role_single_tp' || st === 'single_tp' || st === 'townpanchayat' || st === 'tp') {
    return 'single_tp';
  }
  if (roleKey === 'role_multi_tp' || st === 'multi_tp') return 'multi_tp';
  if (roleKey === 'role_zonal' || st === 'zonal' || st === 'zone') return 'zonal';
  if (roleKey === 'role_district' || st === 'district') return 'district';

  if (isZonalScopedUser(user)) return 'zonal';
  if (isHodLikeUser(user)) return 'hod';
  if (userTownPanchayatIds(user).length > 1) return 'multi_tp';
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

async function loadAssignedTownPanchayats(db: Db, user: any): Promise<any[]> {
  const ids = userTownPanchayatIds(user);
  const names = [user.townPanchayat, user.townPanchayatTa, user.tpName, user.tpNameEn, user.townPanchayatNameEn]
    .map(norm)
    .filter(Boolean);
  const needles = [...ids, ...names];
  if (!needles.length) return [];

  const idIn = [...new Set(ids.flatMap((id) => idVariants(id)))];
  const or: Record<string, unknown>[] = [];
  if (idIn.length) {
    or.push({ id: { $in: idIn } }, { code: { $in: idIn } });
  }
  if (or.length) {
    const byId = await db.collection('townPanchayats').find({ $or: or }, PROJ).limit(200).toArray();
    if (byId.length) return uniqueById(byId);
  }

  const districtHint = norm(user.districtId);
  const filter = districtHint ? { districtId: { $in: idVariants(districtHint) } } : {};
  const pool = await db
    .collection('townPanchayats')
    .find(filter, PROJ)
    .limit(districtHint ? 300 : 800)
    .toArray();
  const matched = pool.filter((t: any) =>
    needles.some(
      (n) =>
        String(t.id || '').toLowerCase() === n.toLowerCase() ||
        String(t.code || '').toLowerCase() === n.toLowerCase() ||
        geoNamesEqual(t.nameEn, n) ||
        geoNamesEqual(t.nameTa, n),
    ),
  );
  return uniqueById(matched);
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
async function applyInspectionRole(db: Db, user: any): Promise<any> {
  if (!user) return user;
  try {
    const roles = await db
      .collection('inspectionRoles')
      .find({}, { projection: { _id: 0, id: 1, code: 1, scopeType: 1, scope: 1, nameEn: 1 }, maxTimeMS: 3000 })
      .toArray();
    const roleKey = String(user.roleId || user.role || '').toLowerCase().trim();
    const matched = (roles || []).find(
      (r: any) =>
        String(r.id || '').toLowerCase() === roleKey ||
        String(r.code || '').toLowerCase() === roleKey ||
        String(r.nameEn || '').toLowerCase() === roleKey,
    );
    if (!matched) return user;
    return {
      ...user,
      roleId: user.roleId || matched.id,
      scopeType: matched.scopeType || matched.scope || user.scopeType,
    };
  } catch {
    return user;
  }
}

export async function resolveInspectionScopeMasters(db: Db, user: any): Promise<InspectionScopeMasters> {
  const scoped = await applyInspectionRole(db, user);
  const scopeKind = resolveInspectionScopeKind(scoped);
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
    zoneId = await resolveZoneId(db, scoped);
    if (zoneId) {
      zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
      districts = await loadDistrictsByZone(db, zoneId);
      districtIds = districts.map((d: any) => norm(d.id)).filter(Boolean);
      townPanchayats = await loadTownPanchayatsByZone(db, zoneId);
    }
  } else if (scopeKind === 'district') {
    const districtId = await resolveDistrictId(db, scoped);
    if (districtId) {
      districts = await db
        .collection('districts')
        .find({ id: { $in: idVariants(districtId) } }, PROJ)
        .toArray();
      districtIds = [districtId];
      zoneId = norm(districts[0]?.zoneId || scoped.zoneId);
      if (zoneId) {
        zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
      }
      townPanchayats = await loadTownPanchayatsByDistrict(db, districtId);
    }
  } else {
    townPanchayats = await loadAssignedTownPanchayats(db, scoped);

    districtIds = [
      ...new Set(
        [
          ...townPanchayats.map((t: any) => norm(t.districtId)).filter(Boolean),
          norm(scoped.districtId),
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
      norm(townPanchayats[0]?.zoneId) ||
      norm(districts[0]?.zoneId) ||
      (await resolveZoneId(db, scoped));
    if (zoneId && !zones.length) {
      zones = await db.collection('zones').find({ id: { $in: idVariants(zoneId) } }, PROJ).toArray();
    }
  }

  if (!zoneId) {
    zoneId = norm(scoped.zoneId) || norm(zones[0]?.id) || norm(districts[0]?.zoneId);
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