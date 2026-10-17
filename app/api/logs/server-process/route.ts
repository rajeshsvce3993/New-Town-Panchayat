import { NextRequest, NextResponse } from 'next/server';
import { readServerProcessLogs, getLogFilePath } from '@/lib/serverLogger';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const download = searchParams.get('download') === 'true';
    const linesParam = searchParams.get('lines');
    const maxLines = linesParam ? parseInt(linesParam, 10) : 1000;

    const logPath = getLogFilePath();
    const logContent = readServerProcessLogs(maxLines);

    if (download) {
      return new NextResponse(logContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': 'attachment; filename="server_process.log"',
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        filePath: logPath,
        exists: fs.existsSync(logPath),
        sizeBytes: fs.existsSync(logPath) ? fs.statSync(logPath).size : 0,
        logs: logContent,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || 'Error fetching server logs' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function DELETE() {
  try {
    const logPath = getLogFilePath();
    if (fs.existsSync(logPath)) {
      fs.writeFileSync(
        logPath,
        `[${new Date().toISOString()}] [SERVER_PROCESS] [INFO] Log file cleared by Administrator\n`,
        'utf-8'
      );
    }
    return NextResponse.json({ success: true, message: 'Log file cleared' }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message }, { status: 500, headers: CORS_HEADERS });
  }
}
