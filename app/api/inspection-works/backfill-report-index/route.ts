import { NextRequest, NextResponse } from 'next/server';
import { backfillInspectionWorksReportIndexFields } from '@/lib/inspectionWorkReportIndex';
import { enqueueInspectionWorkReportRollupRebuild } from '@/lib/inspectionWorkReportRollups';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Dev/ops: backfill submittedDateYmd and enqueue a background BUILD→LIVE rollup rebuild. Never deletes LIVE. */
export async function POST(req: NextRequest) {
  if (process.env.APP_ENV === 'prod' && process.env.ALLOW_REPORT_INDEX_BACKFILL !== '1') {
    return NextResponse.json({ success: false, message: 'Backfill disabled on production' }, { status: 403 });
  }
  const limitParam = req.nextUrl.searchParams.get('limit');
  const rebuildRollups = req.nextUrl.searchParams.get('rollups') !== '0';
  const limit = limitParam ? parseInt(limitParam, 10) : 2000;
  const indexResult = await backfillInspectionWorksReportIndexFields(limit);
  const rollupResult = rebuildRollups ? await enqueueInspectionWorkReportRollupRebuild() : { queued: false };
  return NextResponse.json({ success: true, ...indexResult, rollupQueued: rollupResult.queued });
}
