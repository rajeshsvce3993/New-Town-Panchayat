import { NextRequest, NextResponse } from 'next/server';
import { uploadInspectionMediaToS3, resolveInspectionUsername, getPresignedS3Url } from '@/lib/storage';

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
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let contentType = 'image/jpeg';
    let userId = '';
    let username = '';

    const contentTypeHeader = (req.headers.get('content-type') || '').toLowerCase();

    if (contentTypeHeader.includes('application/json')) {
      const jsonBody = await req.json();
      userId = jsonBody.userId || jsonBody.submittedByUserId || '';
      username = jsonBody.username || jsonBody.submittedByUserName || '';
      fileName = jsonBody.fileName || `photo_${Date.now()}.jpg`;
      contentType = jsonBody.mimeType || jsonBody.contentType || 'image/jpeg';

      const base64Str = jsonBody.fileBase64 || jsonBody.base64 || jsonBody.image || jsonBody.file || '';
      if (!base64Str) {
        return NextResponse.json(
          { success: false, message: 'No file content provided in request' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      const cleanBase64 = base64Str.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
      fileBuffer = Buffer.from(cleanBase64, 'base64');
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      userId = (formData.get('userId') as string) || (formData.get('submittedByUserId') as string) || '';
      username = (formData.get('username') as string) || (formData.get('submittedByUserName') as string) || '';

      if (!file) {
        return NextResponse.json(
          { success: false, message: 'No file provided in form data' },
          { status: 400, headers: CORS_HEADERS }
        );
      }
      fileBuffer = Buffer.from(await file.arrayBuffer());
      fileName = file.name || `photo_${Date.now()}.jpg`;
      contentType = file.type || 'image/jpeg';
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { success: false, message: 'File is empty' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Resolve canonical username
    const resolvedUsername = await resolveInspectionUsername(userId, username);

    // Save to AWS S3 under strictly required pattern: inspection/{username}/
    const uploadResult = await uploadInspectionMediaToS3(
      fileBuffer,
      fileName,
      contentType,
      resolvedUsername
    );

    if (!uploadResult.success || !uploadResult.url) {
      return NextResponse.json(
        { success: false, message: uploadResult.message || 'Failed to save file to S3' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const finalSavedName = uploadResult.s3Key.split('/').pop() || fileName;
    const authenticatedUrl = await getPresignedS3Url(uploadResult.s3Key);

    return NextResponse.json({
      success: true,
      url: authenticatedUrl,
      fileName: finalSavedName,
      s3Key: uploadResult.s3Key,
      folder: `inspection/${resolvedUsername}`,
      username: resolvedUsername,
      message: `File saved successfully in AWS S3 (inspection/${resolvedUsername})`,
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    const errCode = err?.code || err?.cause?.code || '';
    const errMsg = String(err?.message || err || '').toLowerCase();
    const isEconnReset =
      errCode === 'ECONNRESET' ||
      errCode === 'ECONNABORTED' ||
      errMsg.includes('econnreset') ||
      errMsg.includes('aborted') ||
      errMsg.includes('connection reset');

    if (isEconnReset) {
      console.error(
        `File upload error: [Error: aborted] { code: 'ECONNRESET' }\n` +
        `Detailed Reason for Error:\n` +
        `  1. Connection Aborted by Client (ECONNRESET): The mobile app or HTTP client unexpectedly severed the TCP socket before the image stream finished.\n` +
        `  2. Cellular Signal Fluctuation: Mobile network lost connectivity or shifted base towers (4G/3G handover) during multipart image upload.\n` +
        `  3. Client-side Socket Timeout: The mobile OkHttpClient timeout elapsed while uploading high-resolution inspection media.\n` +
        `  4. Device OS App Suspension: The Android app was minimized, screen turned off, or backgrounded during data transfer.\n` +
        `  * Offline Safety: The mobile app safely preserves the photo in local storage (/files/offline_images/) and will automatically retry background sync.`
      );
      return NextResponse.json({
        success: false,
        message: 'Upload aborted by client connection reset (ECONNRESET)',
      }, { status: 499, headers: CORS_HEADERS });
    }

    console.error('File upload error:', err?.message || err);
    return NextResponse.json({
      success: false,
      message: err?.message || 'Server error while uploading file to S3',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
