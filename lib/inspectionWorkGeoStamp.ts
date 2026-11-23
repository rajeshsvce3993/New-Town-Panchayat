import type { Db } from 'mongodb';
import { resolveGeoForUser } from '@/lib/domain/geoResolver';
import { stampWorkGeoFromMasters } from '@/lib/geoNameMatch';

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

export function isSingleTpScope(inspector: any): boolean {
  const st = norm(inspector?.scopeType).toLowerCase().replace(/[\s-]+/g, '_');
  const role = norm(inspector?.roleId || inspector?.role).toLowerCase().replace(/[\s-]+/g, '_');
  if (['zonal', 'zone', 'hod', 'district', 'multi_tp'].includes(st)) return false;
  if (['role_zonal', 'role_multi_tp', 'role_district', 'zonal'].includes(role)) return false;
  if (
    st === 'single_tp' ||
    st === 'field_worker' ||
    st === 'field_workers' ||
    st === 'townpanchayat' ||
    st === 'tp'
  ) {
    return true;
  }
  if (
    role === 'role_single_tp' ||
    role === 'role_field_worker' ||
    role === 'role_field_workers' ||
    role === 'single_tp' ||
    role === 'field_worker'
  ) {
    return true;
  }
  const tp = norm(inspector?.tpId || inspector?.townPanchayatId);
  const selected = Array.isArray(inspector?.selectedTpIds)
    ? inspector.selectedTpIds.map((id: unknown) => norm(id)).filter(Boolean)
    : [];
  return !!tp && selected.length <= 1;
}

/** Load only the geo chain needed for one work (not full master scan). */
export async function loadGeoMastersForWorkStamp(
  db: Db,
  opts: { tpId?: string; districtId?: string; zoneId?: string },
): Promise<{ townPanchayats: any[]; districts: any[]; zones: any[] }> {
  const proj = { projection: { _id: 0 }, maxTimeMS: 5000 };
  let tp: any = null;
  let dist: any = null;
  let zone: any = null;

  const tpId = norm(opts.tpId);
  if (tpId) {
    tp = await db.collection('townPanchayats').findOne(
      { $or: [{ id: tpId }, { _id: tpId as any }] },
      proj,
    );
  }
  const districtId = norm(opts.districtId || tp?.districtId);
  if (districtId) {
    dist = await db.collection('districts').findOne(
      { $or: [{ id: districtId }, { _id: districtId as any }] },
      proj,
    );
  }
  const zoneId = norm(opts.zoneId || dist?.zoneId || tp?.zoneId);
  if (zoneId) {
    zone = await db.collection('zones').findOne(
      { $or: [{ id: zoneId }, { _id: zoneId as any }] },
      proj,
    );
  }

  return {
    townPanchayats: tp ? [tp] : [],
    districts: dist ? [dist] : [],
    zones: zone ? [zone] : [],
  };
}

export function applyInspectorGeoToWork(work: any, geo: Awaited<ReturnType<typeof resolveGeoForUser>>): any {
  if (!geo?.tpId && !geo?.districtId && !geo?.zoneId) return work;
  return {
    ...work,
    ...(geo.tpId
      ? {
          tpId: geo.tpId,
          townPanchayatId: geo.tpId,
          tpNameEn: geo.tpNameEn || work.tpNameEn,
          tpNameTa: geo.tpNameTa || work.tpNameTa,
        }
      : {}),
    ...(geo.districtId
      ? {
          districtId: geo.districtId,
          districtNameEn: geo.districtNameEn || work.districtNameEn,
          districtNameTa: geo.districtNameTa || work.districtNameTa,
        }
      : {}),
    ...(geo.zoneId
      ? {
          zoneId: geo.zoneId,
          zoneNameEn: geo.zoneNameEn || work.zoneNameEn,
          zoneNameTa: geo.zoneNameTa || work.zoneNameTa,
        }
      : {}),
  };
}

/**
 * Authoritative work geo: single-TP / field-worker always uses the inspector's assigned
 * Theni/Thevaram (etc.) place. Leftover Kilpennathur tpId on the payload is overwritten.
 * Zonal / multi-TP keep the TP selected on the work.
 */
export async function stampInspectionWorkGeo(
  db: Db,
  work: any,
  inspector: any | null,
): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  let seeded = { ...work };
  const inspectorAssignedWins = !!inspector && isSingleTpScope(inspector);

  if (inspectorAssignedWins) {
    const geo = await resolveGeoForUser(db, inspector);
    if (geo.tpId) seeded = applyInspectorGeoToWork(seeded, geo);
  }

  const masters = await loadGeoMastersForWorkStamp(db, {
    tpId: norm(seeded.tpId || seeded.townPanchayatId),
    districtId: norm(seeded.districtId),
    zoneId: norm(seeded.zoneId),
  });

  return stampWorkGeoFromMasters(seeded, {
    ...masters,
    inspector: inspectorAssignedWins ? inspector : undefined,
  });
}

export function workSubmitKeysForUser(user: any): string[] {
  return [
    user?.username,
    user?.mobile,
    user?.id,
    user?.submittedByUserName,
    user?.submittedByUserId,
  ]
    .map((v) => norm(v))
    .filter(Boolean);
}