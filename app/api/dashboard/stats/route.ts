import { NextRequest, NextResponse } from 'next/server';
import { getAppEnv, logPortalEnvironmentOnce } from '@/lib/appEnvironment';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { loadDashboardStats } from '@/lib/dashboardStats';
import { parseInspectionWorksViewQuery, toInspectionWorksFilterQuery } from '@/lib/inspectionWorksViewQuery';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  logPortalEnvironmentOnce(origin);
  const viewQuery = parseInspectionWorksViewQuery(req.nextUrl.searchParams);
  const filter = toInspectionWorksFilterQuery(viewQuery);

  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/dashboard/stats${qs ? `?${qs}` : ''}`, origin, {
      timeoutMs: 120000,
    });
    if (remote && typeof remote === 'object') {
      return NextResponse.json({ ...remote, dataSource: 'remote-prod-api' }, { headers: CORS_HEADERS });
    }
    return NextResponse.json(
      {
        success: false,
        message:
          'Production API did not respond. This app did not use the local database. Check network access to townpanchayat.com and try again.',
        dataSource: 'remote-prod-api-failed',
      },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  try {
    const stats = await loadDashboardStats(origin, filter);
    return NextResponse.json({ success: true, ...stats, dataSource: getAppEnv() }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Could not load dashboard stats' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
