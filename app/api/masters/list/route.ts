import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { buildInspectionUsersTpMongoFilter } from '@/lib/inspectionUserTpFilter';
import { enrichUserForApp } from '@/lib/storage';
import { getDb, loadPaginatedCollection, loadWardsForTp } from '@/lib/repositories/mastersRepository';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const ALLOWED = new Set([
  'inspectionUsers',
  'users',
  'wardsAndStreets',
  'employees',
  'notifications',
  'userActivities',
  'userSessions',
  'apkVersions',
]);

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/masters/list${qs ? `?${qs}` : ''}`, origin, { timeoutMs: 90_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote masters/list unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const { searchParams } = req.nextUrl;
    const collection = String(searchParams.get('collection') || '').trim();
    if (!ALLOWED.has(collection)) {
      return NextResponse.json(
        { success: false, message: `collection must be one of: ${Array.from(ALLOWED).join(', ')}` },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const page = parseInt(searchParams.get('page') || '1', 10) || 1;
    const limit = parseInt(searchParams.get('limit') || '200', 10) || 200;
    const tpId = String(searchParams.get('tpId') || '').trim();
    const tpNameEn = String(searchParams.get('tpNameEn') || '').trim();
    const zoneId = String(searchParams.get('zoneId') || '').trim();
    const districtId = String(searchParams.get('districtId') || '').trim();

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    let result;
    if (collection === 'wardsAndStreets' && tpId) {
      result = await loadWardsForTp(db, tpId, { page, limit });
    } else {
      const filter: Record<string, unknown> = {};
      if (collection === 'wardsAndStreets' && tpId) {
        filter.$or = [{ tpId }, { townPanchayatId: tpId }];
      } else if (collection === 'inspectionUsers') {
        if (tpId) {
          let effectiveTpName = tpNameEn;
          if (!effectiveTpName) {
            const tpRow = await db.collection('townPanchayats').findOne(
              { $or: [{ id: tpId }, { _id: tpId }] },
              { projection: { nameEn: 1 }, maxTimeMS: 4000 },
            );
            effectiveTpName = String(tpRow?.nameEn || '').trim();
          }
          Object.assign(
            filter,
            buildInspectionUsersTpMongoFilter(tpId, {
              tpNameEn: effectiveTpName,
              zoneId,
              districtId,
              includeNameMatch: true,
            }),
          );
        } else {
          const geoParts: Record<string, unknown>[] = [];
          if (tpNameEn) {
            geoParts.push(
              { townPanchayat: tpNameEn },
              { tpName: tpNameEn },
              { townPanchayatNameEn: tpNameEn },
            );
          }
          if (zoneId) geoParts.push({ zoneId });
          if (districtId) geoParts.push({ districtId });
          if (geoParts.length === 1) Object.assign(filter, geoParts[0]);
          else if (geoParts.length > 1) filter.$or = geoParts;
        }
      }
      result = await loadPaginatedCollection(db, collection, { page, limit, filter });
    }

    const lean = searchParams.get('lean') === '1';
    let items = result.items;
    if (collection === 'inspectionUsers' && items.length > 0 && !lean) {
      let townPanchayats: any[] = [];
      let districts: any[] = [];
      let zones: any[] = [];
      if (tpId) {
        const tp = await db.collection('townPanchayats').findOne(
          { $or: [{ id: tpId }, { _id: tpId }] },
          { projection: { _id: 0 }, maxTimeMS: 4000 },
        );
        if (tp) townPanchayats = [tp];
        const districtKey = String(tp?.districtId || districtId || '').trim();
        if (districtKey) {
          const district = await db.collection('districts').findOne(
            { $or: [{ id: districtKey }, { _id: districtKey }] },
            { projection: { _id: 0 }, maxTimeMS: 4000 },
          );
          if (district) districts = [district];
          const zoneKey = String(district?.zoneId || tp?.zoneId || zoneId || '').trim();
          if (zoneKey) {
            const zone = await db.collection('zones').findOne(
              { $or: [{ id: zoneKey }, { _id: zoneKey }] },
              { projection: { _id: 0 }, maxTimeMS: 4000 },
            );
            if (zone) zones = [zone];
          }
        }
      } else {
        [townPanchayats, districts, zones] = await Promise.all([
          db.collection('townPanchayats').find({}, { projection: { _id: 0 }, maxTimeMS: 6000 }).limit(500).toArray(),
          db.collection('districts').find({}, { projection: { _id: 0 }, maxTimeMS: 6000 }).limit(200).toArray(),
          db.collection('zones').find({}, { projection: { _id: 0 }, maxTimeMS: 6000 }).limit(100).toArray(),
        ]);
      }
      const [inspectionRoles, inspectionDesignations] = await Promise.all([
        db.collection('inspectionRoles').find({}, { projection: { _id: 0 }, maxTimeMS: 4000 }).toArray(),
        db.collection('inspectionDesignations').find({}, { projection: { _id: 0 }, maxTimeMS: 4000 }).toArray(),
      ]);
      const masters = { townPanchayats, districts, zones, inspectionRoles, inspectionDesignations };
      items = items.map((u: any) => {
        const e = enrichUserForApp(u, masters);
        delete e.password;
        delete e.passwordHash;
        return e;
      });
    } else if (collection === 'inspectionUsers' && lean && items.length > 0) {
      items = items.map((u: any) => {
        const e = { ...u };
        delete e.password;
        delete e.passwordHash;
        return e;
      });
    }

    const cacheable = collection === 'apkVersions' || collection === 'notifications';
    return NextResponse.json(
      {
        success: true,
        source: 'mongo-live',
        collection,
        ...result,
        items,
      },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': cacheable ? 'private, max-age=60, stale-while-revalidate=120' : 'private, no-store',
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}