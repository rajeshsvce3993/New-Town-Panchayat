import { NextRequest, NextResponse } from 'next/server';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveInspectorProfileFromDb } from '@/lib/inspectionUserProfile';
import { isMobileClientRequest } from '@/lib/mobileAppAuth';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-username, x-user-id, x-client',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Live profile labels (designation, role, name) from Mongo — not user_scope_cache. */
export async function GET(req: NextRequest) {
  try {
    const username = (
      req.nextUrl.searchParams.get('username') ||
      req.headers.get('x-username') ||
      ''
    ).trim();
    if (!username) {
      return NextResponse.json({ success: false, message: 'username required' }, { status: 400, headers: CORS_HEADERS });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    const hit = await findUserForLogin(username, username.toLowerCase(), { mobileClient: isMobileClientRequest(req) });
    const userDoc = hit?.userDoc;
    if (!userDoc) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const profile = await resolveInspectorProfileFromDb(db, userDoc);

    return NextResponse.json(
      {
        success: true,
        source: 'mongo-live',
        profile,
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store, must-revalidate' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}