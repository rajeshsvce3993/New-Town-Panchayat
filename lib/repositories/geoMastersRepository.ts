import type { Db } from 'mongodb';
import { getDb } from '@/lib/repositories/mastersRepository';
import { loadWardsForTp } from '@/lib/repositories/mastersRepository';

const PROJ = { projection: { _id: 0 }, maxTimeMS: 6000 };
const PAGE_MAX = 2000;

function norm(v: unknown): string {
  return String(v ?? '').trim();
}

function idOrVariants(id: string): string[] {
  const s = norm(id);
  if (!s) return [];
  return [...new Set([s, s.toLowerCase(), s.toUpperCase()])];
}

export async function loadAllZones(db?: Db | null) {
  const database = db || (await getDb());
  if (!database) return [];
  return database.collection('zones').find({}, PROJ).sort({ nameEn: 1 }).toArray();
}

export async function loadAllDistricts(db: Db) {
  return db.collection('districts').find({}, PROJ).sort({ nameEn: 1 }).toArray();
}

export async function loadDistrictsByZone(db: Db, zoneId: string) {
  const ids = idOrVariants(zoneId);
  if (!ids.length) return [];
  const direct = await db
    .collection('districts')
    .find({ $or: [{ zoneId: { $in: ids } }, { zone_id: { $in: ids } }] }, PROJ)
    .sort({ nameEn: 1 })
    .toArray();
  if (direct.length) return direct;

  const zone = await db.collection('zones').findOne(
    {
      $or: [
        { id: { $in: ids } },
        { code: { $in: ids } },
        { nameEn: norm(zoneId) },
        { nameTa: norm(zoneId) },
      ],
    },
    PROJ,
  );
  const aliases = [
    ...ids,
    ...idOrVariants(zone?.id),
    ...idOrVariants(zone?.code),
    norm(zone?.nameEn),
    norm(zone?.nameTa),
  ].filter(Boolean);
  if (!aliases.length) return [];
  return db
    .collection('districts')
    .find({
      $or: [
        { zoneId: { $in: aliases } },
        { zone_id: { $in: aliases } },
        { zone: { $in: aliases } },
      ],
    }, PROJ)
    .sort({ nameEn: 1 })
    .toArray();
}

export async function loadTownPanchayatsByDistrict(db: Db, districtId: string) {
  const raw = norm(districtId);
  if (!raw) return [];
  const dist = await db.collection('districts').findOne(
    {
      $or: [
        { id: { $in: idOrVariants(raw) } },
        { code: { $in: idOrVariants(raw) } },
        { nameEn: raw },
        { nameTa: raw },
      ],
    },
    PROJ,
  );
  const aliases = [
    ...idOrVariants(raw),
    ...idOrVariants(dist?.id),
    ...idOrVariants(dist?.code),
    norm(dist?.nameEn),
    norm(dist?.nameTa),
  ].filter(Boolean);
  return db
    .collection('townPanchayats')
    .find(
      {
        $or: [{ districtId: { $in: aliases } }, { district_id: { $in: aliases } }],
      },
      PROJ,
    )
    .sort({ nameEn: 1 })
    .toArray();
}

export async function loadTownPanchayatsByZone(db: Db, zoneId: string) {
  const districts = await loadDistrictsByZone(db, zoneId);
  const distIds = districts.flatMap((d: any) => idOrVariants(d.id).concat(norm(d.nameEn), norm(d.code))).filter(Boolean);
  const zoneIds = idOrVariants(zoneId);
  return db
    .collection('townPanchayats')
    .find(
      {
        $or: [
          { zoneId: { $in: zoneIds } },
          { zone_id: { $in: zoneIds } },
          ...(distIds.length ? [{ districtId: { $in: distIds } }, { district_id: { $in: distIds } }] : []),
        ],
      },
      PROJ,
    )
    .sort({ nameEn: 1 })
    .toArray();
}

export async function loadWardsByTp(db: Db, tpId: string, page: number, limit: number) {
  return loadWardsForTp(db, tpId, { page, limit: Math.min(limit, PAGE_MAX) });
}

export type GeoLevel = 'zones' | 'districts' | 'townPanchayats' | 'wards';

export async function queryGeoMasters(opts: {
  level: GeoLevel;
  zoneId?: string;
  districtId?: string;
  tpId?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  if (!db) {
    return { success: false as const, message: 'MongoDB unavailable', items: [] as any[] };
  }

  if (opts.level === 'zones') {
    const items = await loadAllZones(db);
    return { success: true as const, level: 'zones', items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }

  if (opts.level === 'districts') {
    const items = opts.zoneId ? await loadDistrictsByZone(db, opts.zoneId) : await loadAllDistricts(db);
    return { success: true as const, level: 'districts', zoneId: opts.zoneId || '', items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }

  if (opts.level === 'townPanchayats') {
    if (opts.districtId) {
      const items = await loadTownPanchayatsByDistrict(db, opts.districtId);
      return { success: true as const, level: 'townPanchayats', districtId: opts.districtId, items, total: items.length, page: 1, limit: items.length, hasMore: false };
    }
    if (opts.zoneId) {
      const items = await loadTownPanchayatsByZone(db, opts.zoneId);
      return { success: true as const, level: 'townPanchayats', zoneId: opts.zoneId, items, total: items.length, page: 1, limit: items.length, hasMore: false };
    }
    return { success: false as const, message: 'districtId or zoneId required for townPanchayats', items: [] as any[] };
  }

  if (!opts.tpId) {
    return { success: false as const, message: 'tpId required for wards', items: [] as any[] };
  }
  const page = Math.max(1, opts.page || 1);
  const limit = Math.min(Math.max(opts.limit || 100, 1), PAGE_MAX);
  const ward = await loadWardsByTp(db, opts.tpId, page, limit);
  return {
    success: true as const,
    level: 'wards' as const,
    tpId: opts.tpId,
    items: ward.items,
    total: ward.total,
    page: ward.page,
    limit: ward.limit,
    hasMore: ward.hasMore,
  };
}