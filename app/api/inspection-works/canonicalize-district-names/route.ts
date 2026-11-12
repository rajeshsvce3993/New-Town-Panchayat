import { NextRequest, NextResponse } from 'next/server';
import { canonicalizeThiruvallurDistrictSpellings } from '@/lib/canonicalizeDistrictSpellings';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/** Spelling correction: Thiruvallur / Tiruvallue → Tiruvallur district and Tiruvallur Zone. */
export async function POST(req: NextRequest) {
  const confirm = (req.nextUrl.searchParams.get('confirm') || '').trim().toLowerCase();
  if (confirm !== 'thiruvallur' && confirm !== 'tiruvallur') {
    return NextResponse.json(
      { success: false, message: 'Pass confirm=thiruvallur to run this spelling correction.' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (shouldUseRemotePortalApi(req.nextUrl.origin)) {
    const remote = await fetchRemotePortalJson(
      `/api/inspection-works/canonicalize-district-names?confirm=${encodeURIComponent(confirm)}`,
      req.nextUrl.origin,
      { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' }, timeoutMs: 180000 }
    );
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json(
      { success: false, message: 'Live portal is unavailable. Deploy this API to townpanchayat.com, then run it there.' },
      { status: 502, headers: CORS_HEADERS }
    );
  }

  const result = await canonicalizeThiruvallurDistrictSpellings();
  return NextResponse.json({ success: true, ...result }, { headers: CORS_HEADERS });
}
