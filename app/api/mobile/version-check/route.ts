import { NextRequest, NextResponse } from 'next/server';
import { getCollectionData, getAppSettings, readLocalDb } from '@/lib/storage';

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
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'localhost:3000';
    const baseUrl = `${proto}://${host}`;

    // Read latest APK version from database
    let apkVersions: any[] = [];
    try {
      apkVersions = await getCollectionData('apkVersions');
    } catch {
      apkVersions = readLocalDb().apkVersions || [];
    }

    const settings = (getAppSettings() || {}) as any;
    const mobileConfig = settings?.mobileAppConfig || {};

    let latestVersionCode = 15;
    let latestVersionName = '2.4.0';
    let minRequiredVersionCode = 14;
    let forceUpdate = false;
    let apkDownloadUrl = `${baseUrl}/api/mobile/download-zip`;
    let releaseNotes = 'புதிய ஆஃப்லைன் வசதிகள் மற்றும் பிழைத் திருத்தங்கள் சேர்க்கப்பட்டுள்ளன.\nNew offline capabilities and performance improvements.';

    if (apkVersions && apkVersions.length > 0) {
      // Sort by versionCode descending or creation date
      const sorted = [...apkVersions].sort((a, b) => (b.versionCode || 0) - (a.versionCode || 0));
      const latest = sorted[0];

      if (latest) {
        latestVersionCode = parseInt(latest.versionCode, 10) || 15;
        latestVersionName = latest.versionName || '2.4.0';
        forceUpdate = Boolean(latest.forceUpdate);
        minRequiredVersionCode = latest.minRequiredVersionCode 
          ? parseInt(latest.minRequiredVersionCode, 10) 
          : (forceUpdate ? latestVersionCode : Math.max(1, latestVersionCode - 1));
        
        let url = latest.apkUrl || latest.downloadUrl || '';
        if (url) {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = url.startsWith('/') ? `${baseUrl}${url}` : `${baseUrl}/${url}`;
          }
          apkDownloadUrl = url;
        }

        if (latest.releaseNotes) {
          releaseNotes = latest.releaseNotes;
        }
      }
    } else if (mobileConfig.buildNumber) {
      latestVersionCode = parseInt(mobileConfig.buildNumber, 10) || 15;
      latestVersionName = mobileConfig.appVersion || '2.4.0';
      forceUpdate = Boolean(mobileConfig.forceUpdate);
      minRequiredVersionCode = forceUpdate ? latestVersionCode : Math.max(1, latestVersionCode - 1);
      if (mobileConfig.apkDownloadUrl) {
        apkDownloadUrl = mobileConfig.apkDownloadUrl;
      }
    }

    return NextResponse.json({
      success: true,
      latestVersionCode,
      latestVersionName,
      minRequiredVersionCode,
      forceUpdate,
      apkDownloadUrl,
      releaseNotes,
      serverTime: new Date().toISOString()
    }, {
      headers: CORS_HEADERS
    });
  } catch (err: any) {
    console.error('Version check error:', err);
    return NextResponse.json({
      success: false,
      message: err?.message || 'Error checking app version',
      latestVersionCode: 15,
      latestVersionName: '2.4.0',
      minRequiredVersionCode: 14,
      forceUpdate: false,
      apkDownloadUrl: '',
      releaseNotes: ''
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
