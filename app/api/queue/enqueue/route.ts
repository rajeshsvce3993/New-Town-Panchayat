import { NextRequest, NextResponse } from 'next/server';
import { enqueueInspectionWork, getQueueStatistics } from '@/lib/serverQueue';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Work entry data payload is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { jobId, queuePosition } = await enqueueInspectionWork(data);

    return NextResponse.json({
      success: true,
      message: 'Work entry accepted and added to Server FIFO Queue',
      jobId,
      status: 'QUEUED',
      queuePosition,
      queueStats: getQueueStatistics(),
    }, { status: 202, headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[Queue Enqueue Error]:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || 'Failed to enqueue work submission',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    stats: getQueueStatistics(),
  }, { headers: CORS_HEADERS });
}
