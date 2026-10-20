import { NextRequest, NextResponse } from 'next/server';
import { getCollectionData, saveCollectionData, readLocalDb, uploadInspectionMediaToS3 } from '@/lib/storage';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const remoteQs = searchParams.toString();
    const remoteNotifs = await fetchRemotePortalJson(
      `/api/notifications${remoteQs ? `?${remoteQs}` : ''}`,
      req.nextUrl.origin
    );
    if (remoteNotifs) {
      return NextResponse.json(remoteNotifs, { headers: CORS_HEADERS });
    }
    if (shouldUseRemotePortalApi(req.nextUrl.origin)) {
      return NextResponse.json(
        { success: false, message: 'Live portal notifications unavailable.', data: [] },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const userId = (searchParams.get('userId') || searchParams.get('username') || '').toLowerCase();
    const zoneId = (searchParams.get('zoneId') || searchParams.get('zone') || '').toLowerCase();
    const tpId = (searchParams.get('tpId') || searchParams.get('tp') || '').toLowerCase();

    let allNotifs: any[] = [];
    try {
      allNotifs = await getCollectionData('notifications');
    } catch {
      allNotifs = readLocalDb().notifications || [];
    }

    if (!Array.isArray(allNotifs)) {
      allNotifs = [];
    }

    const isActiveNotification = (n: any) => {
      if (n?.isExpired === true || n?.active === false) return false;
      const status = String(n?.status || '').trim().toLowerCase();
      if (status === 'expired' || status === 'inactive' || status === 'disabled') return false;
      const raw = String(n?.expiresAt || n?.expiryDate || n?.validTill || n?.validUntil || n?.endDate || '').trim();
      if (!raw) return true;
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        const end = new Date(`${raw}T23:59:59.999`);
        return !Number.isNaN(end.getTime()) && end.getTime() >= Date.now();
      }
      const t = Date.parse(raw);
      return Number.isNaN(t) ? true : t >= Date.now();
    };

    // Filter notifications for target recipient if specified
    const filtered = allNotifs.filter((n: any) => {
      if (!isActiveNotification(n)) return false;
      const targets = n.targetFilters || {};
      const tUser = (targets.userId || '').toLowerCase();
      const tZone = (targets.zoneId || '').toLowerCase();
      const tTp = (targets.tpId || '').toLowerCase();

      if (tUser && tUser !== 'all' && userId && tUser !== userId) return false;
      if (tZone && tZone !== 'all' && zoneId && tZone !== zoneId) return false;
      if (tTp && tTp !== 'all' && tpId && tTp !== tpId) return false;

      return true;
    });

    // Chronologically latest first
    filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return NextResponse.json({
      success: true,
      count: filtered.length,
      notifications: filtered
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Fetch notifications error:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || 'Error fetching notifications',
      notifications: []
    }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      title,
      message,
      mediaUrl,
      fileType,
      fileName,
      actionUrl,
      targetFilters,
      fileBase64,
      fileMimeType,
      sender,
      expiresAt,
      expiryDate,
      validTill,
    } = body;

    if (!title || !message) {
      return NextResponse.json(
        { success: false, message: 'Title and message are required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    let finalMediaUrl = mediaUrl || '';
    let finalFileType = fileType || '';

    // If fileBase64 is passed, upload to AWS S3
    if (fileBase64 && (!finalMediaUrl || !finalMediaUrl.startsWith('http'))) {
      try {
        const cleanBase64 = fileBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
        const buffer = Buffer.from(cleanBase64, 'base64');
        const uploadName = fileName || `attachment_${Date.now()}.${fileMimeType?.includes('pdf') ? 'pdf' : fileMimeType?.includes('sheet') || fileMimeType?.includes('excel') ? 'xlsx' : 'jpg'}`;
        const contentType = fileMimeType || 'application/octet-stream';
        const s3Upload = await uploadInspectionMediaToS3(buffer, uploadName, contentType, 'notifications');
        if (s3Upload.success && s3Upload.url) {
          finalMediaUrl = s3Upload.url;
        }
      } catch (err) {
        console.warn('Error uploading notification attachment to S3:', err);
      }
    }

    if (!finalFileType && finalMediaUrl) {
      const lower = finalMediaUrl.toLowerCase();
      if (lower.endsWith('.pdf')) finalFileType = 'pdf';
      else if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) finalFileType = 'excel';
      else if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') || lower.endsWith('.webp')) finalFileType = 'image';
      else finalFileType = 'file';
    }

    const newNotification = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title,
      message,
      mediaUrl: finalMediaUrl,
      imageUrl: finalFileType === 'image' ? finalMediaUrl : '',
      fileUrl: finalFileType !== 'image' && finalMediaUrl ? finalMediaUrl : '',
      fileType: finalFileType || 'none',
      fileName: fileName || '',
      actionUrl: actionUrl || '',
      targetFilters: targetFilters || {
        zoneId: 'all',
        districtId: 'all',
        tpId: 'all',
        designationId: 'all',
        userId: 'all'
      },
      sender: sender || 'Admin',
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || expiryDate || validTill || null,
    };

    let allNotifs: any[] = [];
    try {
      allNotifs = await getCollectionData('notifications');
    } catch {
      allNotifs = readLocalDb().notifications || [];
    }

    allNotifs = [newNotification, ...allNotifs];
    await saveCollectionData('notifications', allNotifs);

    return NextResponse.json({
      success: true,
      message: 'Notification broadcast successfully',
      notification: newNotification
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Broadcast notification error:', err);
    return NextResponse.json(
      { success: false, message: err?.message || 'Error broadcasting notification' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
