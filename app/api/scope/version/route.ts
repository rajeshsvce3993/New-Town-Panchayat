import { NextRequest, NextResponse } from 'next/server';
import { getScopeVersionMeta, initializeUserScopeCacheOnce } from '@/lib/userScopeCache';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-username, x-scope-version',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

/**
 * Lightweight ~1KB version check endpoint for Android background worker.
 * Allows mobile app to check if scope has changed without transferring full master database.
 */
export async function GET(req: NextRequest) {
  try {
    // Ensure cache is initialized if server started
    initializeUserScopeCacheOnce().catch(() => {});

    const { searchParams } = new URL(req.url);
    const clientVersionStr = searchParams.get('clientVersion') || req.headers.get('x-scope-version') || '0';
    const clientVersion = parseInt(clientVersionStr, 10) || 0;

    const meta = getScopeVersionMeta();
    const hasUpdate = clientVersion < meta.version;

    return NextResponse.json(
      {
        success: true,
        scopeVersion: meta.version,
        updatedAt: meta.updatedAt,
        hasUpdate,
        message: hasUpdate ? 'New scope updates available' : 'Local scope is up-to-date',
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
      { success: false, error: err?.message || 'Error checking scope version' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
