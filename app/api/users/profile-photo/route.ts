import { NextRequest, NextResponse } from 'next/server';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getMongoClient, getActiveMongoDb, readLocalDb, writeLocalDb, getPresignedS3Url } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id, x-username',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    let userId = '';
    let username = '';
    let imageBuffer: Buffer | null = null;
    let contentType = 'image/jpeg';

    const contentTypeHeader = req.headers.get('content-type') || '';

    if (contentTypeHeader.includes('multipart/form-data')) {
      const formData = await req.formData();
      userId = (formData.get('userId') as string) || '';
      username = (formData.get('username') as string) || '';
      const file = formData.get('file') as File | null;
      if (file) {
        const arrayBuffer = await file.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
        contentType = file.type || 'image/jpeg';
      }
    } else {
      const body = await req.json();
      userId = body.userId || '';
      username = body.username || '';
      const base64Data = body.image || body.photo || body.imageBase64 || '';
      if (base64Data) {
        const cleanBase64 = base64Data.replace(/^data:image\/[a-zA-Z0-9]+;base64,/, '');
        imageBuffer = Buffer.from(cleanBase64, 'base64');
      }
    }

    userId = (userId || username || req.headers.get('x-user-id') || req.headers.get('x-username') || 'user').trim();
    username = (username || userId).trim().toLowerCase();

    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Image data is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const cleanUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `profile_${Date.now()}.jpg`;
    // As requested: Save in S3 in user ID folder name!
    const s3Key = `profiles/${cleanUserId}/${fileName}`;

    let publicPhotoUrl = '';
    const s3 = getS3Client();
    const localSettings = readLocalDb().settings;
    const bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || localSettings.s3Bucket || 'tms-2026';
    const region = process.env.S3_REGION || localSettings.s3Region || 'ap-south-1';

    if (s3 && bucket) {
      try {
        await s3.send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: s3Key,
            Body: imageBuffer,
            ContentType: contentType,
          })
        );
        publicPhotoUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`;
        console.log(`[ProfilePhoto] Uploaded user profile photo to S3: ${publicPhotoUrl}`);
      } catch (s3Err) {
        console.warn('[ProfilePhoto] S3 upload error, saving locally:', s3Err);
      }
    }

    // Always save a local static backup copy for high reliability
    let localPhotoUrl = '';
    try {
      const localDir = path.join(process.cwd(), 'public', 'uploads', 'profiles', cleanUserId);
      if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localDir, fileName), imageBuffer);
      localPhotoUrl = `/uploads/profiles/${cleanUserId}/${fileName}`;
    } catch (localErr) {
      console.warn('[ProfilePhoto] Local backup write error:', localErr);
    }

    // Local fallback if S3 not reached
    if (!publicPhotoUrl) {
      publicPhotoUrl = localPhotoUrl;
    }

    // Generate signed URL if stored in S3 so mobile/web can fetch without 403 Forbidden
    let presignedPhotoUrl = '';
    if (publicPhotoUrl.includes('s3.') || publicPhotoUrl.includes('amazonaws.com') || publicPhotoUrl.startsWith('profiles/')) {
      try {
        presignedPhotoUrl = await getPresignedS3Url(publicPhotoUrl);
      } catch (_) {}
    }

    // Update MongoDB collections with new profile photo URL
    try {
      const client = await getMongoClient();
      if (client) {
        const db = await getActiveMongoDb(client);

        const filter = {
          $or: [
            { id: userId },
            { id: cleanUserId },
            { username: username },
            { username: { $regex: new RegExp(`^${username}$`, 'i') } },
          ],
        };

        const updateDoc = {
          $set: {
            profilePhotoUrl: publicPhotoUrl,
            avatarUrl: publicPhotoUrl,
            updatedAt: new Date().toISOString(),
          },
        };

        await Promise.all([
          db.collection('users').updateMany(filter, updateDoc).catch(() => {}),
          db.collection('inspectionUsers').updateMany(filter, updateDoc).catch(() => {}),
          db.collection('employees').updateMany(filter, updateDoc).catch(() => {}),
          db.collection('user_scope_cache').updateMany(
            { $or: [{ userId: cleanUserId }, { username }] },
            {
              $set: {
                'user.profilePhotoUrl': publicPhotoUrl,
                'user.avatarUrl': publicPhotoUrl,
                updatedAt: new Date().toISOString(),
              },
            }
          ).catch(() => {}),
        ]);
      }
    } catch (dbErr) {
      console.error('[ProfilePhoto] Error updating MongoDB user records:', dbErr);
    }

    // Also update local fallback DB if present
    try {
      const localDb = readLocalDb();
      let updatedLocal = false;
      const updateList = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach((u) => {
          if (u.id === userId || (u.username && u.username.toLowerCase() === username)) {
            u.profilePhotoUrl = publicPhotoUrl;
            u.avatarUrl = publicPhotoUrl;
            updatedLocal = true;
          }
        });
      };
      updateList(localDb.users);
      updateList(localDb.inspectionUsers);
      updateList(localDb.employees);
      if (updatedLocal) {
        writeLocalDb(localDb);
      }
    } catch (_) {}

    return NextResponse.json(
      {
        success: true,
        message: 'Profile photo uploaded successfully to user S3 folder',
        profilePhotoUrl: presignedPhotoUrl || publicPhotoUrl,
        rawS3Url: publicPhotoUrl,
        localPhotoUrl: localPhotoUrl || null,
        s3Key,
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    console.error('[ProfilePhoto] Upload handler error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Failed to upload profile photo' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
