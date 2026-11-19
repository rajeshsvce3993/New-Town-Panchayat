import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { getAppSettings } from '@/lib/storage';
import { getDb, loadCoreMasters, loadSlimCoreMasters } from '@/lib/repositories/mastersRepository';
import { isSlimCoreMasters } from '@/lib/productionFlags';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

function slimSettings(settings: any) {
  if (!settings || typeof settings !== 'object') return settings;
  const { mongodbUri, s3AccessKeyId, s3SecretAccessKey, ...rest } = settings;
  return rest;
}

/** Web / admin first paint — masters + KPI stats only (no users, no wards). */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const remote = await fetchRemotePortalJson('/api/masters/core', origin, { timeoutMs: 60_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote masters/core unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    const [core, settings] = await Promise.all([
      isSlimCoreMasters() ? loadSlimCoreMasters(db) : loadCoreMasters(db),
      getAppSettings(),
    ]);
    const data = {
      ...core,
      settings: slimSettings(settings),
      transferRequests: [],
      apkVersions: [],
      userActivities: [],
    };

    return NextResponse.json(
      { success: true, source: 'mongo-live', mode: 'core', data },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}