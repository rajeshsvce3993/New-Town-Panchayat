import { NextRequest, NextResponse } from 'next/server';
import { recordUserLogout } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-username',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    let userId = '';
    let username = '';
    let reason = 'User voluntary logout';

    try {
      const body = await req.json();
      userId = body.userId || '';
      username = body.username || '';
      reason = body.reason || reason;
    } catch {
      // Body may be empty on plain post
    }

    userId = userId || req.headers.get('x-user-id') || '';
    username = username || req.headers.get('x-username') || userId;

    if (username || userId) {
      // Fire and forget so response is returned instantaneously (< 5ms)
      recordUserLogout(username || userId, reason, req).catch((e) =>
        console.error('[Logout Route] Error recording logout:', e)
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Logged out successfully',
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: true, message: 'Logged out successfully' },
      { headers: CORS_HEADERS }
    );
  }
}
