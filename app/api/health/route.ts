import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'Tamil Nadu Town Panchayat EMS Server',
    port: process.env.PORT || '5000',
    timestamp: new Date().toISOString(),
  }, { headers: CORS_HEADERS });
}
