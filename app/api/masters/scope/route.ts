import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { buildLiveUserScope } from '@/lib/services/liveUserScope';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-username',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Mobile / field scope — live Mongo, no portal-state or user_scope_cache. */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/masters/scope${qs ? `?${qs}` : ''}`, origin, { timeoutMs: 45_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote masters/scope unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const username = (
      req.nextUrl.searchParams.get('username') ||
      req.headers.get('x-username') ||
      ''
    ).trim();
    if (!username) {
      return NextResponse.json({ success: false, message: 'username required' }, { status: 400, headers: CORS_HEADERS });
    }

    const scope = await buildLiveUserScope(username, 12_000);
    if (!scope) {
      return NextResponse.json({ success: false, message: 'No inspection scope for this user' }, { status: 404, headers: CORS_HEADERS });
    }

    return NextResponse.json(
      {
        success: true,
        source: 'mongo-live',
        scopeVersion: scope.scopeVersion,
        updatedAt: scope.updatedAt,
        scope,
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}