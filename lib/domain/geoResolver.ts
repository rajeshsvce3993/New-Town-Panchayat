import type { Db } from 'mongodb';
import { geoNamesEqual } from '@/lib/geoNameMatch';
import { isHodLikeUser, isZonalScopedUser } from '@/lib/userScope';

export type ResolvedGeo = {
  tpId: string;
  tpNameEn: string;
  tpNameTa: string;
  tpCode: string;
  districtId: string;
  districtNameEn: string;
  districtNameTa: string;
  districtCode: string;
  zoneId: string;
  zoneNameEn: string;
  zoneNameTa: string;
  zoneCode: string;
  missing: string[];
};

function normId(v: unknown): string {
  return String(v ?? '').trim();
}

async function findTownPanchayat(db: Db, user: any) {
  const tpId = normId(user.tpId || user.townPanchayatId);
  const tpName = normId(user.townPanchayat || user.tpName);
  const col = db.collection('townPanchayats');
  if (tpId) {
    const byId = await col.findOne(
      { $or: [{ id: tpId }, { _id: tpId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, districtId: 1, zoneId: 1 } },
    );
    if (byId) return byId;
  }
  if (tpName) {
    const rows = await col
      .find({}, { maxTimeMS: 4000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, districtId: 1, zoneId: 1 } })
      .limit(800)
      .toArray();
    return (
      rows.find(
        (t: any) =>
          geoNamesEqual(t.nameEn, tpName) ||
          geoNamesEqual(t.nameTa, tpName) ||
          String(t.id || '').toLowerCase() === tpName.toLowerCase(),
      ) || null
    );
  }
  return null;
}

async function findDistrict(db: Db, districtId: string, fallbackName: string) {
  const col = db.collection('districts');
  if (districtId) {
    const row = await col.findOne(
      { $or: [{ id: districtId }, { _id: districtId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } },
    );
    if (row) return row;
  }
  if (fallbackName) {
    const rows = await col
      .find({}, { maxTimeMS: 4000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } })
      .limit(200)
      .toArray();
    return rows.find((d: any) => geoNamesEqual(d.nameEn, fallbackName) || geoNamesEqual(d.nameTa, fallbackName)) || null;
  }
  return null;
}

async function findZone(db: Db, zoneId: string, fallbackName: string) {
  const col = db.collection('zones');
  if (zoneId) {
    const row = await col.findOne(
      { $or: [{ id: zoneId }, { _id: zoneId as any }] },
      { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1 } },
    );
    if (row) return row;
  }
  if (fallbackName) {
    const rows = await col.find({}, { maxTimeMS: 3000, projection: { id: 1, nameEn: 1, nameTa: 1, code: 1 } }).limit(100).toArray();
    return rows.find((z: any) => geoNamesEqual(z.nameEn, fallbackName) || geoNamesEqual(z.nameTa, fallbackName)) || null;
  }
  return null;
}

export type PortalScopeSnapshot = {
  tpId: string | null;
  districtId: string | null;
  zoneId: string | null;
};

export type ResolvedPortalGeo = ResolvedGeo & {
  scopeType: string;
  scopeId: string;
  portalScope: PortalScopeSnapshot;
};

function scopeTypeKey(scopeType: unknown): string {
  return String(scopeType || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
}

function idVariants(key: string): string[] {
  const s = normId(key);
  if (!s) return [];
  return [...new Set([s, s.toLowerCase(), s.toUpperCase()])];
}

async function matchGeoEntity(
  db: Db,
  key: string,
): Promise<{ kind: 'zone' | 'district' | 'tp'; row: Record<string, unknown> } | null> {
  const k = normId(key);
  if (!k || k === 'all') return null;
  const variants = idVariants(k);

  const zone = await db.collection('zones').findOne(
    {
      $or: [
        { id: { $in: variants } },
        { code: { $in: variants } },
        { nameEn: k },
        { nameTa: k },
      ],
    },
    { maxTimeMS: 3000, projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1 } },
  );
  if (zone) return { kind: 'zone', row: zone as Record<string, unknown> };

  const district = await db.collection('districts').findOne(
    {
      $or: [
        { id: { $in: variants } },
        { code: { $in: variants } },
        { nameEn: k },
        { nameTa: k },
      ],
    },
    { maxTimeMS: 3000, projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } },
  );
  if (district) return { kind: 'district', row: district as Record<string, unknown> };

  const tp = await db.collection('townPanchayats').findOne(
    {
      $or: [
        { id: { $in: variants } },
        { code: { $in: variants } },
        { nameEn: k },
        { nameTa: k },
      ],
    },
    { maxTimeMS: 3500, projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1, districtId: 1, zoneId: 1 } },
  );
  if (tp) return { kind: 'tp', row: tp as Record<string, unknown> };

  return null;
}

function emptyResolved(missing: string[] = []): ResolvedGeo {
  return {
    tpId: '',
    tpNameEn: '',
    tpNameTa: '',
    tpCode: '',
    districtId: '',
    districtNameEn: '',
    districtNameTa: '',
    districtCode: '',
    zoneId: '',
    zoneNameEn: '',
    zoneNameTa: '',
    zoneCode: '',
    missing,
  };
}

/**
 * Portal login: resolve zone / district / TP from scopeType + scopeId (Mongo), not stray tpId fields on zonal users.
 */
export async function resolveGeoForPortalUser(db: Db, user: any): Promise<ResolvedPortalGeo> {
  if (isHodLikeUser(user)) {
    const base = emptyResolved();
    return {
      ...base,
      scopeType: 'HOD',
      scopeId: 'all',
      portalScope: { tpId: null, districtId: null, zoneId: null },
    };
  }

  const st = scopeTypeKey(user.scopeType);
  const role = String(user.roleId || user.role || '').toLowerCase();
  const scopeKey = normId(user.scopeId);

  const preferZone =
    isZonalScopedUser(user) ||
    st === 'zone' ||
    st === 'zonal' ||
    role === 'zonal' ||
    (role === 'ad' && (st === 'zone' || st === 'zonal'));

  if (preferZone) {
    const zoneLookup = await matchGeoEntity(
      db,
      normId(user.zoneId || user.scopeId || user.zone || user.zoneNameEn || user.zoneName),
    );
    const zoneRow = zoneLookup?.kind === 'zone' ? zoneLookup.row : null;
    const zoneId = normId(zoneRow?.id) || normId(user.zoneId || user.scopeId);
    return {
      ...emptyResolved(zoneRow ? [] : ['zone']),
      zoneId,
      zoneNameEn: normId(zoneRow?.nameEn),
      zoneNameTa: normId(zoneRow?.nameTa),
      zoneCode: normId(zoneRow?.code),
      scopeType: 'Zone',
      scopeId: zoneId || scopeKey,
      portalScope: { tpId: null, districtId: null, zoneId: zoneId || null },
    };
  }

  const preferDistrict = st === 'district' || role === 'district';
  if (preferDistrict) {
    const districtLookup = await matchGeoEntity(
      db,
      normId(user.districtId || user.scopeId || user.district || user.districtName),
    );
    const distRow =
      districtLookup?.kind === 'district'
        ? districtLookup.row
        : await db.collection('districts').findOne(
              {
                $or: [{ id: normId(user.districtId) }, { nameEn: normId(user.district) }],
              },
              { maxTimeMS: 3000, projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } },
            );
    const districtId = normId((distRow as any)?.id) || normId(user.districtId);
    let zoneId = normId((distRow as any)?.zoneId) || normId(user.zoneId);
    if (!zoneId) {
      const z = await matchGeoEntity(db, normId(user.zone || user.zoneNameEn));
      if (z?.kind === 'zone') zoneId = normId(z.row.id);
    }
    return {
      ...emptyResolved(distRow ? [] : ['district']),
      districtId,
      districtNameEn: normId((distRow as any)?.nameEn),
      districtNameTa: normId((distRow as any)?.nameTa),
      districtCode: normId((distRow as any)?.code),
      zoneId,
      scopeType: 'District',
      scopeId: districtId || scopeKey,
      portalScope: { tpId: null, districtId: districtId || null, zoneId: zoneId || null },
    };
  }

  if (st === 'multi_tp' && Array.isArray(user.selectedTpIds) && user.selectedTpIds.length > 1) {
    const districtLookup = await matchGeoEntity(
      db,
      normId(user.districtId || user.scopeId || user.district || user.districtName),
    );
    const distRow =
      districtLookup?.kind === 'district'
        ? districtLookup.row
        : await db.collection('districts').findOne(
            { $or: [{ id: normId(user.districtId) }, { nameEn: normId(user.district) }] },
            { maxTimeMS: 3000, projection: { _id: 0, id: 1, nameEn: 1, nameTa: 1, code: 1, zoneId: 1 } },
          );
    const districtId = normId((distRow as any)?.id) || normId(user.districtId);
    let zoneId = normId((distRow as any)?.zoneId) || normId(user.zoneId);
    if (!zoneId) {
      const z = await matchGeoEntity(db, normId(user.zone || user.zoneNameEn));
      if (z?.kind === 'zone') zoneId = normId(z.row.id);
    }
    return {
      ...emptyResolved(distRow ? [] : ['district']),
      districtId,
      districtNameEn: normId((distRow as any)?.nameEn),
      districtNameTa: normId((distRow as any)?.nameTa),
      districtCode: normId((distRow as any)?.code),
      zoneId,
      scopeType: 'District',
      scopeId: districtId || scopeKey,
      portalScope: { tpId: null, districtId: districtId || null, zoneId: zoneId || null },
    };
  }

  const tpKey = normId(
    user.tpId ||
      user.townPanchayatId ||
      user.assignedTpId ||
      (st === 'single_tp' || st === 'townpanchayat' || st === 'tp' ? scopeKey : '') ||
      user.townPanchayat ||
      user.tpName,
  );
  const tpSeed = {
    ...user,
    tpId: tpKey,
    townPanchayat: user.townPanchayat || user.tpName,
  };
  const chain = await resolveGeoForUser(db, tpSeed);
  const portalScope: PortalScopeSnapshot = {
    tpId: chain.tpId || null,
    districtId: chain.districtId || null,
    zoneId: chain.zoneId || null,
  };
  return {
    ...chain,
    scopeType: 'TownPanchayat',
    scopeId: chain.tpId || scopeKey,
    portalScope,
  };
}

/** Authoritative geo chain: TP master → district → zone (no hardcoded district defaults). */
export async function resolveGeoForUser(db: Db, user: any): Promise<ResolvedGeo> {
  const missing: string[] = [];
  const tp = await findTownPanchayat(db, user);
  if (!tp) missing.push('townPanchayat');

  const districtIdFromTp = normId(tp?.districtId);
  const district = await findDistrict(db, districtIdFromTp, normId(user.district || user.districtName));
  if (!district) missing.push('district');

  const zoneIdCandidates = [normId(tp?.zoneId), normId(district?.zoneId), normId(user.zoneId)].filter(Boolean);
  let zone: any = null;
  for (const zid of zoneIdCandidates) {
    zone = await findZone(db, zid, '');
    if (zone) break;
  }
  if (!zone) {
    zone = await findZone(db, '', normId(user.zone || user.zoneName));
  }
  if (!zone) missing.push('zone');

  return {
    tpId: normId(tp?.id) || normId(user.tpId),
    tpNameEn: normId(tp?.nameEn),
    tpNameTa: normId(tp?.nameTa),
    tpCode: normId(tp?.code),
    districtId: normId(district?.id) || districtIdFromTp,
    districtNameEn: normId(district?.nameEn),
    districtNameTa: normId(district?.nameTa),
    districtCode: normId(district?.code),
    zoneId: normId(zone?.id) || normId(zoneIdCandidates[0]),
    zoneNameEn: normId(zone?.nameEn),
    zoneNameTa: normId(zone?.nameTa),
    zoneCode: normId(zone?.code),
    missing,
  };
}