import { NextRequest, NextResponse } from 'next/server';
import { backfillInspectionWorksReportIndexFields } from '@/lib/inspectionWorkReportIndex';
import { rebuildInspectionWorkReportRollups } from '@/lib/inspectionWorkReportRollups';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Dev/ops: backfill submittedDateYmd and rebuild report rollups. Not for public production use. */
export async function POST(req: NextRequest) {
  if (process.env.APP_ENV === 'prod' && process.env.ALLOW_REPORT_INDEX_BACKFILL !== '1') {
    return NextResponse.json({ success: false, message: 'Backfill disabled on production' }, { status: 403 });
  }
  const limitParam = req.nextUrl.searchParams.get('limit');
  const rebuildRollups = req.nextUrl.searchParams.get('rollups') !== '0';
  const limit = limitParam ? parseInt(limitParam, 10) : 2000;
  const indexResult = await backfillInspectionWorksReportIndexFields(limit);
  const rollupResult = rebuildRollups ? await rebuildInspectionWorkReportRollups() : { buckets: 0 };
  return NextResponse.json({ success: true, ...indexResult, rollupBuckets: rollupResult.buckets });
}
