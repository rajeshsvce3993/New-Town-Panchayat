import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { getDb, loadEmployeePostMasters } from '@/lib/repositories/mastersRepository';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Employee post / PF master tables (not in slim bootstrap). */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const remote = await fetchRemotePortalJson('/api/masters/employee', origin, { timeoutMs: 60_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote masters/employee unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }
    const data = await loadEmployeePostMasters(db);
    return NextResponse.json(
      { success: true, source: 'mongo-live', data },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}