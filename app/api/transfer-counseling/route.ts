import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient, getActiveMongoDb } from '@/lib/storage';
import {
  allocateTransferCounseling,
  getCounselingEmployeeDetail,
  getCounselingBootstrap,
  getCounselingStats,
  getCounselingMetrics,
  getApplicantFilterCounts,
  listCounselingApplicants,
  listAvailableVacancies,
  listDistrictsWithVacancies,
  listTodayAllocations,
  markEmployeeInCounseling,
  type CounselingApplicantFilter,
} from '@/lib/transferCounselingService';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

async function getDb() {
  const client = await getMongoClient();
  if (!client) return null;
  return getActiveMongoDb(client);
}

export async function GET(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, message: 'Database unavailable.' },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view') || 'bootstrap';

    if (view === 'bootstrap') {
      const filter = (searchParams.get('filter') || 'all') as CounselingApplicantFilter;
      const q = searchParams.get('q') || '';
      const payload = await getCounselingBootstrap(db, filter, q);
      return NextResponse.json({ success: true, ...payload }, { headers: CORS_HEADERS });
    }

    if (view === 'stats') {
      const stats = await getCounselingStats(db);
      return NextResponse.json({ success: true, stats }, { headers: CORS_HEADERS });
    }

    if (view === 'applicants') {
      const filter = (searchParams.get('filter') || 'all') as CounselingApplicantFilter;
      const q = searchParams.get('q') || '';
      const applicants = await listCounselingApplicants(db, filter, q);
      return NextResponse.json({ success: true, applicants }, { headers: CORS_HEADERS });
    }

    if (view === 'employee') {
      const employeeId = searchParams.get('employeeId') || '';
      const detail = await getCounselingEmployeeDetail(db, employeeId);
      if (!detail) {
        return NextResponse.json(
          { success: false, message: 'Employee not found.' },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      return NextResponse.json({ success: true, ...detail }, { headers: CORS_HEADERS });
    }

    if (view === 'vacancies') {
      const district = searchParams.get('district') || undefined;
      const vacancies = await listAvailableVacancies(db, district);
      const districts = await listDistrictsWithVacancies(db);
      return NextResponse.json({ success: true, vacancies, districts }, { headers: CORS_HEADERS });
    }

    if (view === 'today-allocations') {
      const allocations = await listTodayAllocations(db);
      return NextResponse.json({ success: true, allocations }, { headers: CORS_HEADERS });
    }

    return NextResponse.json(
      { success: false, message: 'Unknown view.' },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[transfer-counseling GET]', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Server error.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = await getDb();
    if (!db) {
      return NextResponse.json(
        { success: false, message: 'Database unavailable.' },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    const body = await req.json();
    const action = body.action;

    if (action === 'select_employee') {
      const counselingEmployeeId = String(body.counselingEmployeeId || '').trim();
      if (!counselingEmployeeId) {
        return NextResponse.json(
          { success: false, message: 'Employee ID required.' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const updated = await markEmployeeInCounseling(db, counselingEmployeeId);
      if (!updated) {
        return NextResponse.json(
          { success: false, message: 'Employee not eligible for counseling.' },
          { status: 409, headers: CORS_HEADERS }
        );
      }
      const searchQ = String(body.search || '');
      const [detail, metrics] = await Promise.all([
        getCounselingEmployeeDetail(db, counselingEmployeeId),
        getCounselingMetrics(db, searchQ),
      ]);
      if (!detail) {
        return NextResponse.json(
          { success: false, message: 'Employee not found.' },
          { status: 404, headers: CORS_HEADERS }
        );
      }
      return NextResponse.json(
        { success: true, ...detail, stats: metrics.stats, filterCounts: metrics.filterCounts },
        { headers: CORS_HEADERS }
      );
    }

    if (action === 'allocate') {
      const result = await allocateTransferCounseling(db, {
        counselingEmployeeId: body.counselingEmployeeId,
        vacancyId: body.vacancyId,
        remarks: body.remarks,
        allocatedBy: body.allocatedBy,
      });
      const status = result.success ? 200 : result.message.includes('no longer') ? 409 : 400;
      if (!result.success) {
        return NextResponse.json(result, { status, headers: CORS_HEADERS });
      }
      const searchQ = String(body.search || '');
      const [metrics, allocations] = await Promise.all([
        getCounselingMetrics(db, searchQ),
        listTodayAllocations(db),
      ]);
      return NextResponse.json(
        { ...result, stats: metrics.stats, filterCounts: metrics.filterCounts, allocations },
        { status, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { success: false, message: 'Unknown action.' },
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[transfer-counseling POST]', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Server error.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
