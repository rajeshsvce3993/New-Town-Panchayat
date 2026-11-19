import { NextRequest, NextResponse } from 'next/server';
import { runProductionRefresh } from '@/lib/jobs/productionRefresh';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
};

function jobAuthorized(req: NextRequest): boolean {
  const secret = String(process.env.PRODUCTION_JOB_SECRET || process.env.ADMIN_JOB_KEY || '').trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'prod';
  }
  const header = req.headers.get('x-admin-key') || '';
  const query = req.nextUrl.searchParams.get('key') || '';
  return header === secret || query === secret;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Deploy / off-peak: indexes, lifetime rollups, SWM totals, cache invalidation.
 * POST /api/jobs/production-refresh?forceLifetime=1&forceRollupRebuild=0
 * Header: x-admin-key: $PRODUCTION_JOB_SECRET
 */
export async function POST(req: NextRequest) {
  if (!jobAuthorized(req)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });
  }

  const forceLifetime = req.nextUrl.searchParams.get('forceLifetime') === '1';
  const forceRollupRebuild = req.nextUrl.searchParams.get('forceRollupRebuild') === '1';

  try {
    const result = await runProductionRefresh({ forceLifetime, forceRollupRebuild });
    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        status: result.ok ? 200 : 202,
        headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
      },
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Production refresh failed' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}