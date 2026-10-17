import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient, getActiveMongoDb, readLocalDb, writeLocalDb } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  // FCM registration is temporarily disabled/bypassed by user request
  return NextResponse.json({
    success: true,
    message: 'FCM Token registration bypassed by user request'
  }, { headers: CORS_HEADERS });
}
