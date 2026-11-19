import { NextResponse } from 'next/server';
import { getRollupHealth } from '@/lib/jobs/rollupHealth';
import { isPortalStateDisabled, isLiveDataOnly, isSlimCoreMasters } from '@/lib/productionFlags';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
  const rollups = await getRollupHealth();
  const healthy = rollups.ok;
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      service: 'Tamil Nadu Town Panchayat EMS Server',
      port: process.env.PORT || '5000',
      timestamp: new Date().toISOString(),
      production: {
        liveDataOnly: isLiveDataOnly(),
        portalStateDisabled: isPortalStateDisabled(),
        slimCoreMasters: isSlimCoreMasters(),
      },
      rollups,
    },
    {
      status: healthy ? 200 : 503,
      headers: { ...CORS_HEADERS, 'Cache-Control': 'no-store' },
    },
  );
}
