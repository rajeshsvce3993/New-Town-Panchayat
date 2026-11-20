import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { queryGeoMasters, type GeoLevel } from '@/lib/repositories/geoMastersRepository';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const LEVEL_BY_KEY: Record<string, GeoLevel> = {
  zones: 'zones',
  districts: 'districts',
  townpanchayats: 'townPanchayats',
  wards: 'wards',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/masters/geo${qs ? `?${qs}` : ''}`, origin, { timeoutMs: 60_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote geo masters unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const { searchParams } = req.nextUrl;
    const levelKey = (searchParams.get('level') || 'zones').toLowerCase();
    const level = LEVEL_BY_KEY[levelKey];
    if (!level) {
      return NextResponse.json(
        { success: false, message: 'level must be zones | districts | townPanchayats | wards' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const result = await queryGeoMasters({
      level,
      zoneId: searchParams.get('zoneId') || undefined,
      districtId: searchParams.get('districtId') || undefined,
      tpId: searchParams.get('tpId') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10) || 1,
      limit: parseInt(searchParams.get('limit') || '100', 10) || 100,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { ...result, source: 'mongo-live' },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}