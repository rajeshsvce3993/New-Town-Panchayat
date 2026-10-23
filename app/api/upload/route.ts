import { NextRequest, NextResponse } from 'next/server';
import {
  uploadInspectionMediaToS3,
  uploadApkReleaseToS3,
  resolveInspectionUsername,
  getPresignedS3Url,
} from '@/lib/storage';
import {
  postRemotePortalJson,
  postRemotePortalUpload,
  shouldUseRemotePortalApi,
} from '@/lib/remotePortalApi';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

/** Many nginx fronts default to 1m; APKs are larger — upload direct to S3 locally instead of proxying. */
const REMOTE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

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

async function respondWithUploadResult(
  uploadResult: { success: boolean; url: string; s3Key: string; message?: string },
  fileName: string,
  isApk: boolean,
  resolvedUsername: string
) {
  if (!uploadResult.success || !uploadResult.url) {
    return NextResponse.json(
      { success: false, message: uploadResult.message || 'Failed to save file to S3' },
      { status: 500, headers: CORS_HEADERS }
    );
  }

  if (isApk && uploadResult.url.startsWith('/uploads/')) {
    return NextResponse.json(
      {
        success: false,
        message:
          'APK cannot be stored on this PC. Use https://townpanchayat.com → Notifications → App Update to upload to S3.',
      },
      { status: 503, headers: CORS_HEADERS }
    );
  }

  const finalSavedName = uploadResult.s3Key.split('/').pop() || fileName;
  const authenticatedUrl = uploadResult.url.startsWith('/uploads/')
    ? uploadResult.url
    : await getPresignedS3Url(uploadResult.url || uploadResult.s3Key);

  return NextResponse.json(
    {
      success: true,
      url: authenticatedUrl,
      fileName: finalSavedName,
      s3Key: uploadResult.s3Key,
      folder: isApk ? 'apk/releases' : `inspection/${resolvedUsername}`,
      username: resolvedUsername,
      message: uploadResult.message || `File saved (${isApk ? 'apk/releases' : `inspection/${resolvedUsername}`})`,
    },
    { headers: CORS_HEADERS }
  );
}

export async function POST(req: NextRequest) {
  try {
    let fileBuffer: Buffer | null = null;
    let fileName = '';
    let contentType = 'image/jpeg';
    let userId = '';
    let username = '';
    let purpose = '';

    const contentTypeHeader = (req.headers.get('content-type') || '').toLowerCase();
    const requestOrigin = req.nextUrl.origin;
    let useRemotePortal = shouldUseRemotePortalApi(requestOrigin);

    if (contentTypeHeader.includes('application/json')) {
      const jsonBody = await req.json();
      userId = jsonBody.userId || jsonBody.submittedByUserId || '';
      username = jsonBody.username || jsonBody.submittedByUserName || '';
      purpose = String(jsonBody.purpose || '').toLowerCase();
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

      if (useRemotePortal && fileBuffer.length <= REMOTE_UPLOAD_MAX_BYTES) {
        const remote = await postRemotePortalJson('/api/upload', requestOrigin, jsonBody, 300_000);
        if (remote.status >= 200 && remote.status < 300 && remote.data?.success) {
          return NextResponse.json(remote.data, { status: remote.status, headers: CORS_HEADERS });
        }
        if (remote.status !== 413 && remote.status !== 502 && remote.status !== 503) {
          return NextResponse.json(remote.data, { status: remote.status, headers: CORS_HEADERS });
        }
        console.warn('[upload] Remote JSON upload failed; trying local S3', remote.status);
      } else if (useRemotePortal) {
        console.info('[upload] Payload too large for remote proxy; using local S3');
      }
    } else {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      userId = (formData.get('userId') as string) || (formData.get('submittedByUserId') as string) || '';
      username = (formData.get('username') as string) || (formData.get('submittedByUserName') as string) || '';
      purpose = String(formData.get('purpose') || '').toLowerCase();

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

    const isApk =
      purpose === 'apk' ||
      fileName.toLowerCase().endsWith('.apk') ||
      contentType.includes('vnd.android.package-archive');

    if (useRemotePortal && !isApk && fileBuffer.length <= REMOTE_UPLOAD_MAX_BYTES) {
      const remote = await postRemotePortalUpload(requestOrigin, {
        fileBuffer,
        fileName,
        contentType,
        purpose,
        userId,
        username,
      });
      if (remote.status >= 200 && remote.status < 300 && remote.data?.success) {
        return NextResponse.json(remote.data, { status: remote.status, headers: CORS_HEADERS });
      }
      if (remote.status !== 413 && remote.status !== 502 && remote.status !== 503) {
        return NextResponse.json(remote.data, { status: remote.status, headers: CORS_HEADERS });
      }
      console.warn('[upload] Remote multipart upload failed; trying local S3', remote.status);
    } else if (useRemotePortal && isApk) {
      console.info(
        `[upload] APK (${(fileBuffer.length / (1024 * 1024)).toFixed(1)} MB) — direct local S3 (production nginx limits proxy size)`
      );
    }

    const resolvedUsername = await resolveInspectionUsername(userId, username);

    const uploadResult = isApk
      ? await uploadApkReleaseToS3(fileBuffer, fileName, contentType, { requestOrigin })
      : await uploadInspectionMediaToS3(fileBuffer, fileName, contentType, resolvedUsername, {
          requestOrigin,
        });

    return respondWithUploadResult(uploadResult, fileName, isApk, resolvedUsername);
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
      return NextResponse.json(
        {
          success: false,
          message: 'Upload aborted by client connection reset (ECONNRESET)',
        },
        { status: 499, headers: CORS_HEADERS }
      );
    }

    console.error('File upload error:', err?.message || err);
    return NextResponse.json(
      {
        success: false,
        message: err?.message || 'Server error while uploading file to S3',
      },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
