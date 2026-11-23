import type { Db } from 'mongodb';
import { resolveGeoForUser } from '@/lib/domain/geoResolver';
import { stampWorkGeoFromMasters } from '@/lib/geoNameMatch';

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function isSingleTpScope(inspector: any): boolean {
  const st = norm(inspector?.scopeType).toLowerCase().replace(/[\s-]+/g, '_');
  const role = norm(inspector?.roleId || inspector?.role).toLowerCase();
  if (['zonal', 'zone', 'hod', 'district', 'multi_tp'].includes(st)) return false;
  if (['role_zonal', 'role_multi_tp', 'role_district'].includes(role)) return false;
  return (
    st === 'single_tp' ||
    st === 'field_worker' ||
    st === 'field_workers' ||
    st === 'townpanchayat' ||
    st === 'tp' ||
    role === 'role_single_tp' ||
    role === 'role_field_worker' ||
    role === 'role_field_workers'
  );
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
 * Authoritative work geo: the place selected on the work wins.
 * Inspector leftover TP/district is used only when the work has no TP and the user is single-TP.
 */
export async function stampInspectionWorkGeo(
  db: Db,
  work: any,
  inspector: any | null,
): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  let seeded = { ...work };
  const workTpId = norm(work.tpId || work.townPanchayatId);
  const inspectorMayFill = !workTpId && !!inspector && isSingleTpScope(inspector);

  if (inspectorMayFill) {
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
    inspector: inspectorMayFill ? inspector : undefined,
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