import { NextRequest, NextResponse } from 'next/server';
import { backfillInspectionWorksReportIndexFields } from '@/lib/inspectionWorkReportIndex';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Dev/ops: backfill submittedDateYmd on existing works. Not for public production use. */
export async function POST(req: NextRequest) {
  if (process.env.APP_ENV === 'prod' && process.env.ALLOW_REPORT_INDEX_BACKFILL !== '1') {
    return NextResponse.json({ success: false, message: 'Backfill disabled on production' }, { status: 403 });
  }
  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = limitParam ? parseInt(limitParam, 10) : 2000;
  const result = await backfillInspectionWorksReportIndexFields(limit);
  return NextResponse.json({ success: true, ...result });
}
