import { NextRequest, NextResponse } from 'next/server';
import { getJobStatus, getQueueStatistics } from '@/lib/serverQueue';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { success: false, message: 'jobId query parameter is required', stats: getQueueStatistics() },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const job = await getJobStatus(jobId);

    if (!job) {
      return NextResponse.json(
        { success: false, message: `Job ${jobId} not found in server queue` },
        { status: 404, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json({
      success: true,
      job,
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('[Queue Status Error]:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || 'Failed to fetch job status',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
