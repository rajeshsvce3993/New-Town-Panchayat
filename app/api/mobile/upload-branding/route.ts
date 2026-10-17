import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Jimp } from 'jimp';
import { getAppSettings, saveAppSettings } from '@/lib/storage';

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
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const type = (formData.get('type') as string) || 'logo'; // 'logo' | 'icon'

    if (!file) {
      return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400, headers: CORS_HEADERS });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const rootDir = process.cwd();
    const kotlinAppDir = path.join(rootDir, 'kotlin_app');
    const resDir = path.join(kotlinAppDir, 'app', 'src', 'main', 'res');
    const drawableDir = path.join(resDir, 'drawable');
    const brandingDir = path.join(kotlinAppDir, 'app_branding_assets');
    const publicDir = path.join(rootDir, 'public');

    // Ensure directories exist
    [drawableDir, brandingDir, publicDir].forEach(d => {
      if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
    });

    const isLogo = type === 'logo';
    const targetFileName = isLogo ? 'app_logo.png' : 'app_icon.png';

    // 1. Process with Jimp to ensure crisp 512x512 PNG
    const jimpImg = await Jimp.read(buffer);
    jimpImg.contain({ w: 512, h: 512 });
    const processedPng = await jimpImg.getBuffer('image/png');

    // 2. Write to res/drawable/
    fs.writeFileSync(path.join(drawableDir, targetFileName), processedPng);

    // 3. Write to app_branding_assets/
    fs.writeFileSync(path.join(brandingDir, targetFileName), processedPng);

    // 4. Write to public/ for web preview
    fs.writeFileSync(path.join(publicDir, targetFileName), processedPng);

    // 5. If it's an icon, generate mipmap densities
    if (!isLogo) {
      const mipmaps = [
        { dir: path.join(resDir, 'mipmap-mdpi'), size: 48 },
        { dir: path.join(resDir, 'mipmap-hdpi'), size: 72 },
        { dir: path.join(resDir, 'mipmap-xhdpi'), size: 96 },
        { dir: path.join(resDir, 'mipmap-xxhdpi'), size: 144 },
        { dir: path.join(resDir, 'mipmap-xxxhdpi'), size: 192 },
      ];

      for (const m of mipmaps) {
        if (!fs.existsSync(m.dir)) fs.mkdirSync(m.dir, { recursive: true });
        
        const mImg = await Jimp.read(buffer);
        mImg.contain({ w: m.size, h: m.size });
        const mBuf = await mImg.getBuffer('image/png');
        fs.writeFileSync(path.join(m.dir, 'ic_launcher.png'), mBuf);

        // Circular cropped round icon
        const mRoundImg = await Jimp.read(buffer);
        mRoundImg.cover({ w: m.size, h: m.size });
        mRoundImg.circle();
        const mRoundBuf = await mRoundImg.getBuffer('image/png');
        fs.writeFileSync(path.join(m.dir, 'ic_launcher_round.png'), mRoundBuf);
      }
    }

    // 6. Update App Settings with absolute URL for Android and relative URL support
    const settings = getAppSettings() as any;
    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'ais-dev-mrncw6qji3d44ew5u2i4yr-495212014240.asia-southeast1.run.app';
    const baseUrl = `${proto}://${host}`;
    const timestamp = Date.now();
    const relativeUrl = `/${targetFileName}?t=${timestamp}`;
    const absoluteUrl = `${baseUrl}/${targetFileName}?t=${timestamp}`;

    if (isLogo) {
      settings.mobileLoginLogoUrl = absoluteUrl;
      if (!settings.mobileAppConfig) settings.mobileAppConfig = {};
      settings.mobileAppConfig.login_logo_url = absoluteUrl;
    } else {
      settings.mobileAppIconUrl = absoluteUrl;
      if (!settings.mobileAppConfig) settings.mobileAppConfig = {};
      settings.mobileAppConfig.app_icon_url = absoluteUrl;
    }

    saveAppSettings(settings);

    return NextResponse.json({
      success: true,
      message: `${isLogo ? 'App Logo' : 'App Icon'} successfully saved into Android source folder (res/drawable/${targetFileName})!`,
      url: absoluteUrl,
      relativeUrl: relativeUrl,
      targetFile: `kotlin_app/app/src/main/res/drawable/${targetFileName}`
    }, { headers: CORS_HEADERS });

  } catch (error: any) {
    console.error('Error uploading branding asset:', error);
    return NextResponse.json({ success: false, message: error.message || 'Upload failed' }, { status: 500, headers: CORS_HEADERS });
  }
}
