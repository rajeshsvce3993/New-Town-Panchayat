import type { Db } from 'mongodb';
import { getDb } from '@/lib/repositories/mastersRepository';
import { loadWardsForTp } from '@/lib/repositories/mastersRepository';

const PROJ = { projection: { _id: 0 }, maxTimeMS: 6000 };
const PAGE_MAX = 500;

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

export async function loadDistrictsByZone(db: Db, zoneId: string) {
  const ids = idOrVariants(zoneId);
  if (!ids.length) return [];
  return db
    .collection('districts')
    .find({ zoneId: { $in: ids } }, PROJ)
    .sort({ nameEn: 1 })
    .toArray();
}

export async function loadTownPanchayatsByDistrict(db: Db, districtId: string) {
  const ids = idOrVariants(districtId);
  if (!ids.length) return [];
  return db
    .collection('townPanchayats')
    .find({ districtId: { $in: ids } }, PROJ)
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
    if (!opts.zoneId) {
      return { success: false as const, message: 'zoneId required for districts', items: [] as any[] };
    }
    const items = await loadDistrictsByZone(db, opts.zoneId);
    return { success: true as const, level: 'districts', zoneId: opts.zoneId, items, total: items.length, page: 1, limit: items.length, hasMore: false };
  }

  if (opts.level === 'townPanchayats') {
    if (!opts.districtId) {
      return { success: false as const, message: 'districtId required for townPanchayats', items: [] as any[] };
    }
    const items = await loadTownPanchayatsByDistrict(db, opts.districtId);
    return { success: true as const, level: 'townPanchayats', districtId: opts.districtId, items, total: items.length, page: 1, limit: items.length, hasMore: false };
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