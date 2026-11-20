import type { Db } from 'mongodb';
import { resolveGeoForUser } from '@/lib/domain/geoResolver';
import { stampWorkGeoFromMasters } from '@/lib/geoNameMatch';

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function inspectorTpIds(inspector: any): string[] {
  if (!inspector) return [];
  return [
    ...new Set(
      [
        inspector.tpId,
        inspector.townPanchayatId,
        inspector.scopeId,
        ...(Array.isArray(inspector.selectedTpIds) ? inspector.selectedTpIds : []),
        ...(Array.isArray(inspector.townPanchayatIds) ? inspector.townPanchayatIds : []),
      ]
        .map(norm)
        .filter(Boolean),
    ),
  ];
}

function isSingleTpScope(inspector: any): boolean {
  const st = norm(inspector?.scopeType).toLowerCase().replace(/[\s-]+/g, '_');
  if (st === 'single_tp' || st === 'field_worker' || st === 'townpanchayat' || st === 'tp') return true;
  return inspectorTpIds(inspector).length === 1;
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
 * Authoritative work geo: submitter's inspectionUsers row → TP → district → zone, then stampWorkGeoFromMasters.
 */
export async function stampInspectionWorkGeo(
  db: Db,
  work: any,
  inspector: any | null,
): Promise<any> {
  if (!work || typeof work !== 'object') return work;

  let seeded = { ...work };
  let masters = { townPanchayats: [] as any[], districts: [] as any[], zones: [] as any[] };

  if (inspector) {
    const geo = await resolveGeoForUser(db, inspector);
    if (isSingleTpScope(inspector) && geo.tpId) {
      seeded = applyInspectorGeoToWork(seeded, geo);
      masters = await loadGeoMastersForWorkStamp(db, {
        tpId: geo.tpId,
        districtId: geo.districtId,
        zoneId: geo.zoneId,
      });
      return stampWorkGeoFromMasters(seeded, { ...masters, inspector });
    }
    if (geo.tpId || geo.districtId || geo.zoneId) {
      seeded = applyInspectorGeoToWork(seeded, geo);
      masters = await loadGeoMastersForWorkStamp(db, {
        tpId: geo.tpId || seeded.tpId,
        districtId: geo.districtId || seeded.districtId,
        zoneId: geo.zoneId || seeded.zoneId,
      });
    }
  }

  if (!masters.townPanchayats.length && norm(seeded.tpId || seeded.townPanchayatId)) {
    masters = await loadGeoMastersForWorkStamp(db, {
      tpId: norm(seeded.tpId || seeded.townPanchayatId),
      districtId: norm(seeded.districtId),
      zoneId: norm(seeded.zoneId),
    });
  }

  return stampWorkGeoFromMasters(seeded, { ...masters, inspector: inspector || undefined });
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