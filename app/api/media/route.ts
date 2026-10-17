import { NextRequest, NextResponse } from 'next/server';
import { getS3Client, getAppSettings } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function getOfflineImageSvg(label: string = 'Inspection Photo (Offline Entry)') {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="260" viewBox="0 0 400 260">
      <rect width="400" height="260" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" rx="8"/>
      <circle cx="200" cy="100" r="32" fill="#e2e8f0"/>
      <path d="M190 100 L197 107 L212 92" stroke="#64748b" stroke-width="3" fill="none" stroke-linecap="round"/>
      <text x="200" y="160" text-anchor="middle" fill="#334155" font-family="-apple-system, sans-serif" font-size="14" font-weight="bold">${label}</text>
      <text x="200" y="185" text-anchor="middle" fill="#64748b" font-family="-apple-system, sans-serif" font-size="11">Captured on inspector mobile device</text>
    </svg>`,
    'utf-8'
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token') || searchParams.get('id');
    const key = searchParams.get('key');
    const url = searchParams.get('url');

    let rawKey = token || key || '';

    // If token/rawKey is base64 encoded, decode it
    if (token || (rawKey && !rawKey.includes('/') && !rawKey.includes('.'))) {
      try {
        const decoded = Buffer.from(rawKey, 'base64').toString('utf-8');
        if (decoded && (decoded.includes('/') || decoded.includes('.'))) {
          rawKey = decoded;
        }
      } catch (_) {}
    }

    let s3Key = rawKey || '';
    if (url && !s3Key) {
      try {
        const parsed = new URL(url, 'http://localhost');
        s3Key = parsed.searchParams.get('token') || parsed.searchParams.get('id') || parsed.searchParams.get('key') || decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
      } catch {
        s3Key = decodeURIComponent(url.replace(/^https?:\/\/[^/]+\//, '')).replace(/\+/g, ' ');
      }
    } else if (s3Key) {
      s3Key = decodeURIComponent(s3Key).replace(/\+/g, ' ');
    }

    // Recursively unpack nested proxy query keys if s3Key contains "key=" or "/api/media"
    while (s3Key.includes('key=')) {
      const idx = s3Key.indexOf('key=');
      s3Key = s3Key.substring(idx + 4);
      s3Key = decodeURIComponent(s3Key);
    }
    s3Key = s3Key.replace(/^(?:\/?api\/(?:media-proxy|media)\??)+/, '');
    s3Key = s3Key.replace(/^\/+/, '');

    if (!s3Key) {
      return new NextResponse('Media request required', { status: 400 });
    }

    // Check if key is a client local offline path from Android internal storage (e.g. /data/user/0/...)
    const lowerKey = s3Key.toLowerCase();
    const isAndroidLocalPath =
      !lowerKey.includes('inspection/') &&
      (lowerKey.includes('com.tn.townpanchayat.ems') ||
       lowerKey.includes('offline_images') ||
       lowerKey.startsWith('/data/') ||
       lowerKey.startsWith('data/') ||
       lowerKey.startsWith('/storage/') ||
       lowerKey.startsWith('storage/'));

    if (isAndroidLocalPath) {
      return new NextResponse(new Uint8Array(getOfflineImageSvg('Inspection Photo (Offline Entry)')), {
        status: 200,
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Clean key: ensure no leading slash for S3 GetObject
    const cleanS3Key = s3Key;

    // Try fetching from S3 first
    const s3 = getS3Client();
    const appSettings = getAppSettings();
    const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || appSettings?.s3Bucket || 'tms-2026';

    if (s3 && bucket) {
      try {
        const response = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: cleanS3Key,
        }));

        if (response.Body) {
          const streamToBuffer = async (stream: any): Promise<Buffer> => {
            const chunks: any[] = [];
            for await (const chunk of stream) chunks.push(chunk);
            return Buffer.concat(chunks);
          };
          const buffer = await streamToBuffer(response.Body);
          const contentType = response.ContentType || 'image/jpeg';

          return new NextResponse(new Uint8Array(buffer), {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=86400',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      } catch (_s3Err: any) {
        // Silently catch missing S3 keys to avoid exposing S3 bucket/key details in server logs
      }
    }

    // Local file fallback
    const localFilePath = path.join(
      process.cwd(),
      'public',
      cleanS3Key.startsWith('uploads') ? cleanS3Key : path.join('uploads', cleanS3Key)
    );
    if (fs.existsSync(localFilePath)) {
      const fileBuffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath).toLowerCase();
      const mimeMap: Record<string, string> = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.json': 'application/json',
      };
      const contentType = mimeMap[ext] || 'application/octet-stream';
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Clean 404 error instead of fallback SVG
    return new NextResponse('Image not found', {
      status: 404,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error: any) {
    const errName = error?.name || error?.Code || error?.code || '';
    const errMsg = String(error?.message || '').toLowerCase();
    if (
      errName !== 'NoSuchKey' &&
      errName !== 'NotFound' &&
      !errMsg.includes('does not exist') &&
      !errMsg.includes('nosuchkey') &&
      !errMsg.includes('not found')
    ) {
      console.error('Media proxy error:', error?.message || error);
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
