import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveGeoForUser } from '@/lib/domain/geoResolver';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-username, x-user-id',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/geo/me${qs ? `?${qs}` : ''}`, origin, { timeoutMs: 30_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote geo unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const { searchParams } = req.nextUrl;
    const identifier =
      searchParams.get('username') ||
      searchParams.get('userId') ||
      req.headers.get('x-username') ||
      req.headers.get('x-user-id') ||
      '';
    const clean = identifier.trim().toLowerCase();
    if (!clean) {
      return NextResponse.json({ success: false, message: 'username or userId required' }, { status: 400, headers: CORS_HEADERS });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    const hit = await findUserForLogin(identifier, clean, { mobileClient: false });
    const userDoc = hit?.userDoc;
    if (!userDoc) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const geo = await resolveGeoForUser(db, userDoc);
    return NextResponse.json(
      {
        success: true,
        source: 'mongo-live',
        username: userDoc.username || clean,
        geo,
        complete: geo.missing.length === 0,
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}