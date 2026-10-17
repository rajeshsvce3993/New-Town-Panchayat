import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings, saveAppSettings } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const DEFAULT_MOBILE_CONFIG = {
  apiBaseUrl: '',
  appVersion: '1.2.0',
  buildNumber: 102,
  minSupportedVersion: '1.0.0',
  forceUpdate: false,
  maintenanceMode: false,
  maintenanceMessageEn: 'System maintenance in progress. Mobile services will resume shortly.',
  maintenanceMessageTa: 'கணினி பராமரிப்பு பணியில் உள்ளது. விரைவில் சேவை தொடங்கும்.',
  allowedRoles: [
    'admin', 'ad', 'eo', 'zonal', 'employee',
    'role_single_tp', 'role_multi_tp', 'role_zonal', 'role_field_worker',
    'SINGLE_TP', 'MULTI_TP', 'ZONAL', 'FIELD_WORKER',
    'single_tp', 'multi_tp', 'zonal_inspector', 'field_worker',
    'Inspection Officer', 'Field Inspector'
  ],
  features: {
    enableBiometricAuth: true,
    enableOfflineSync: true,
    enablePfLedger: true,
    enableTransferRequests: true,
    enableIssueReporting: true,
    enableDynamicThemes: true,
    enablePushNotifications: true,
  },
  activeDefaultTheme: 'magic-lavender'
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  try {
    const settings = getAppSettings() as any;

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'ais-dev-mrncw6qji3d44ew5u2i4yr-495212014240.asia-southeast1.run.app';
    const baseUrl = `${proto}://${host}`;

    const toAbsolute = (url?: string) => {
      if (!url) return '';
      if (url.startsWith('http://') || url.startsWith('https://')) return url;
      const clean = url.startsWith('/') ? url : `/${url}`;
      return `${baseUrl}${clean}`;
    };

    const rawIcon = settings?.mobileAppIconUrl || settings?.mobileAppConfig?.app_icon_url;
    const rawLogo = settings?.mobileLoginLogoUrl || settings?.mobileAppConfig?.login_logo_url;

    const finalAppIconUrl = rawIcon ? toAbsolute(rawIcon) : `${baseUrl}/app_icon.png?v=default`;
    const finalLoginLogoUrl = rawLogo ? toAbsolute(rawLogo) : `${baseUrl}/app_logo.png?v=default`;

    const mobileConfig = {
      ...DEFAULT_MOBILE_CONFIG,
      ...(settings?.mobileAppConfig || {}),
      features: {
        ...DEFAULT_MOBILE_CONFIG.features,
        ...(settings?.mobileAppConfig?.features || {})
      },
      currentLanguage: settings?.currentLanguage || 'en',
      theme: settings?.theme || 'magic-lavender',
      serverTime: new Date().toISOString(),
      app_icon_url: finalAppIconUrl,
      login_logo_url: finalLoginLogoUrl
    };

    return NextResponse.json({
      success: true,
      config: mobileConfig
    }, {
      headers: CORS_HEADERS
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err?.message || 'Error fetching mobile configuration'
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = getAppSettings() as any;

    const updatedMobileConfig = {
      ...DEFAULT_MOBILE_CONFIG,
      ...(settings?.mobileAppConfig || {}),
      ...body,
      features: {
        ...DEFAULT_MOBILE_CONFIG.features,
        ...(settings?.mobileAppConfig?.features || {}),
        ...(body.features || {})
      }
    };

    saveAppSettings({
      ...settings,
      mobileAppConfig: updatedMobileConfig
    });

    return NextResponse.json({
      success: true,
      config: updatedMobileConfig
    }, {
      headers: CORS_HEADERS
    });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      message: err?.message || 'Error updating mobile configuration'
    }, {
      status: 500,
      headers: CORS_HEADERS
    });
  }
}
