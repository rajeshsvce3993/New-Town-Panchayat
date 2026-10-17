import { NextRequest, NextResponse } from 'next/server';
import { bulkUserStatusAction } from '@/lib/userActivity';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, roleId, designation, tpId, adminUsername = 'admin' } = body;

    if (!['disable_and_logout', 'logout_only', 'enable'].includes(action)) {
      return NextResponse.json(
        { success: false, message: 'Invalid bulk action. Allowed: disable_and_logout, logout_only, enable' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const result = await bulkUserStatusAction({
      action,
      roleId,
      designation,
      tpId,
      adminUsername,
      req,
    });

    return NextResponse.json(result, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Error processing bulk action' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
