import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';

function addFolderToZip(zip: JSZip, folderPath: string, rootPath: string) {
  const entries = fs.readdirSync(folderPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(folderPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      addFolderToZip(zip, fullPath, rootPath);
    } else if (entry.isFile()) {
      const fileData = fs.readFileSync(fullPath);
      zip.file(relativePath, fileData);
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const kotlinAppDir = path.join(process.cwd(), 'kotlin_app');

    if (!fs.existsSync(kotlinAppDir)) {
      return NextResponse.json({ error: 'Kotlin app directory not found' }, { status: 404 });
    }

    const proto = req.headers.get('x-forwarded-proto') || 'https';
    const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || 'ais-dev-mrncw6qji3d44ew5u2i4yr-495212014240.asia-southeast1.run.app';
    const currentBaseUrl = `${proto}://${host}`;

    const zip = new JSZip();
    addFolderToZip(zip, kotlinAppDir, kotlinAppDir);

    // Dynamically inject active host URL into ApiService and PreferencesManager in the zip
    const apiServicePath = 'app/src/main/kotlin/com/tn/townpanchayat/ems/data/ApiService.kt';
    const existingApiService = zip.file(apiServicePath);
    if (existingApiService) {
      const content = await existingApiService.async('string');
      const updated = content.replace(
        /class ApiService\(var baseUrl: String = "[^"]*"\)/g,
        `class ApiService(var baseUrl: String = "${currentBaseUrl}")`
      );
      zip.file(apiServicePath, updated);
    }

    const prefsPath = 'app/src/main/kotlin/com/tn/townpanchayat/ems/data/PreferencesManager.kt';
    const existingPrefs = zip.file(prefsPath);
    if (existingPrefs) {
      const content = await existingPrefs.async('string');
      const updated = content.replace(
        /prefs\.getString\("server_url", "[^"]*"\) \?: "[^"]*"/g,
        `prefs.getString("server_url", "${currentBaseUrl}") ?: "${currentBaseUrl}"`
      );
      zip.file(prefsPath, updated);
    }

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 }
    });

    return new NextResponse(new Uint8Array(zipBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="town_panchayat_native_kotlin_android_v2.0.0.zip"',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (error: any) {
    console.error('Error generating Kotlin zip:', error);
    return NextResponse.json({ error: error.message || 'Failed to generate zip' }, { status: 500 });
  }
}
