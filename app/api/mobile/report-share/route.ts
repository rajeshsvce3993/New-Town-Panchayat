import { NextResponse } from 'next/server';
import { loadLiveAppSettings } from '@/lib/liveAppSettings';
import { resolveReportShare } from '@/lib/reportShareConfig';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-username, x-user-id, x-client',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Live report-share caption templates from Mongo/web settings. */
export async function GET() {
  try {
    const settings = await loadLiveAppSettings();
    const reportShare = resolveReportShare(settings);
    return NextResponse.json(
      {
        success: true,
        reportShare,
        theme: (settings as { theme?: unknown }).theme,
        customColors: (settings as { customColors?: unknown }).customColors,
        googleMapsApiKey: (settings as { googleMapsApiKey?: unknown }).googleMapsApiKey,
      },
      {
        headers: {
          ...CORS_HEADERS,
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      },
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to load report share settings' },
      { status: 500, headers: CORS_HEADERS },
    );
  }
}
