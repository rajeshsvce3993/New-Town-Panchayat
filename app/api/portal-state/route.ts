import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { buildPortalStatePayload } from '@/lib/buildPortalStatePayload';
import { buildAndPersistPortalBootstrap, readPortalBootstrapMongo } from '@/lib/portalBootstrapCache';
import { portalStateCacheKey, runExclusivePortalBuild } from '@/lib/portalStateCache';
import { getScopeVersionMeta } from '@/lib/userScopeCache';
import { isPortalStateDisabled } from '@/lib/productionFlags';

export const dynamic = 'force-dynamic';

const GONE_BODY = {
  success: false,
  deprecated: true,
  message:
    'portal-state is retired. Use POST /api/auth/login, GET /api/geo/me, GET /api/masters/scope, GET /api/inspection-works (slim).',
  replacement: {
    login: '/api/auth/login',
    geo: '/api/geo/me',
    scope: '/api/masters/scope',
    works: '/api/inspection-works?lite=1',
  },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

function requestOrigin(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const protocol = req.headers.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}`;
}

export async function GET(req: NextRequest) {
  try {
    if (isPortalStateDisabled()) {
      return NextResponse.json(GONE_BODY, {
        status: 410,
        headers: { ...CORS_HEADERS, 'X-Portal-State': 'gone' },
      });
    }

    const { searchParams } = new URL(req.url);
    const remoteQs = searchParams.toString();
    const remoteState = await fetchRemotePortalJson(
      `/api/portal-state${remoteQs ? `?${remoteQs}` : ''}`,
      req.nextUrl.origin
    );
    if (remoteState) {
      return NextResponse.json(remoteState, { headers: CORS_HEADERS });
    }
    if (shouldUseRemotePortalApi(req.nextUrl.origin)) {
      return NextResponse.json(
        { success: false, message: 'Live portal state unavailable. Check PORTAL_API_BASE and network connectivity.' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const username =
      searchParams.get('username') ||
      searchParams.get('userId') ||
      searchParams.get('user') ||
      req.headers.get('x-username') ||
      req.headers.get('x-user-id');
    const todayOnly = searchParams.get('todayOnly') === 'true';
    const forceRebuild = searchParams.get('rebuildCache') === 'true';

    const requestedUser = (username || '').trim().toLowerCase();
    const cacheKey = requestedUser ? portalStateCacheKey(requestedUser, todayOnly) : '';
    const origin = requestOrigin(req);

    if (cacheKey && !forceRebuild) {
      const mongoHit = await readPortalBootstrapMongo(requestedUser, todayOnly, { allowStale: true });
      if (mongoHit) {
        return NextResponse.json(mongoHit.payload, {
          headers: {
            ...CORS_HEADERS,
            'X-Portal-Cache': mongoHit.tag,
            'X-Scope-Version': String(mongoHit.scopeVersion),
          },
        });
      }
    }

    const producePayload = async () => {
      const start = Date.now();
      const payload = await buildPortalStatePayload({ requestedUser, todayOnly, origin });
      if (requestedUser) {
        const { writePortalBootstrapMongo } = await import('@/lib/portalBootstrapCache');
        await writePortalBootstrapMongo(requestedUser, todayOnly, payload, Date.now() - start);
      }
      return payload;
    };

    if (cacheKey) {
      const { payload, tag } = await runExclusivePortalBuild(cacheKey, producePayload);
      const scopeVersion = getScopeVersionMeta().version;
      const cacheTag = tag === 'HIT' ? 'HIT-MEM' : tag === 'STALE' ? 'STALE-MEM' : 'MISS-BUILD';
      return NextResponse.json(payload, {
        headers: {
          ...CORS_HEADERS,
          'X-Portal-Cache': cacheTag,
          'X-Scope-Version': String(scopeVersion),
        },
      });
    }

    if (forceRebuild && requestedUser) {
      const payload = await buildAndPersistPortalBootstrap(requestedUser, todayOnly, origin);
      return NextResponse.json(payload, {
        headers: { ...CORS_HEADERS, 'X-Portal-Cache': 'REBUILD', 'X-Scope-Version': String(getScopeVersionMeta().version) },
      });
    }

    const payload = await producePayload();
    return NextResponse.json(payload, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Portal state error:', err);
    return NextResponse.json(
      { success: false, message: 'Server error retrieving portal state' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}