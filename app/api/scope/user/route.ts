import { NextRequest, NextResponse } from 'next/server';
import { getUserScopeDetails, initializeUserScopeCacheOnce } from '@/lib/userScopeCache';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-username',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const identifier =
      searchParams.get('userId') ||
      searchParams.get('username') ||
      req.headers.get('x-user-id') ||
      req.headers.get('x-username') ||
      '';

    if (!identifier) {
      return NextResponse.json(
        { success: false, message: 'User ID or username query parameter is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const scope = await getUserScopeDetails(identifier);

    if (!scope) {
      return NextResponse.json(
        {
          success: false,
          message: 'No assigned inspection scope found for this user in user_scope_cache',
        },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        scopeVersion: scope.scopeVersion,
        updatedAt: scope.updatedAt,
        scope,
      },
      {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, message: err?.message || 'Server error loading user scope' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
