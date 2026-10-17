import { NextRequest, NextResponse } from 'next/server';
import { getUserActivitiesList, disableAndLogoutUser, recordUserLogout } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limitParam = searchParams.get('limit');
    const dateParam = searchParams.get('date');
    const limit = limitParam ? parseInt(limitParam, 10) : 100;

    const data = await getUserActivitiesList(limit, dateParam || undefined);

    return NextResponse.json(
      {
        success: true,
        ...data,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Error fetching user activities' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, username, userId, adminUsername = 'admin', reason } = body;

    const identifier = username || userId;
    if (!identifier) {
      return NextResponse.json(
        { success: false, message: 'User identifier required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (action === 'disable_and_logout') {
      const res = await disableAndLogoutUser(identifier, adminUsername, req);
      return NextResponse.json(res, { headers: CORS_HEADERS });
    }

    if (action === 'force_logout') {
      const res = await recordUserLogout(identifier, reason || `Force logged out by admin '${adminUsername}'`, req);
      return NextResponse.json(res, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Error updating user activity' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
