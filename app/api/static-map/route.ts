import { NextRequest, NextResponse } from 'next/server';
import { getAppSettings } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

function osmTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, zoom };
}

async function fetchImage(url: string, headers?: Record<string, string>) {
  const res = await fetch(url, { headers, cache: 'no-store' });
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 800) return null;
  const contentType = res.headers.get('content-type') || 'image/png';
  if (!contentType.startsWith('image/')) return null;
  return { buf, contentType };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = Number(searchParams.get('lat') || searchParams.get('latitude'));
    const lng = Number(searchParams.get('lng') || searchParams.get('lon') || searchParams.get('longitude'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return new NextResponse('lat and lng required', { status: 400, headers: CORS_HEADERS });
    }

    const settings = getAppSettings() as { googleMapsApiKey?: string } | null;
    const key =
      process.env.GOOGLE_MAPS_API_KEY ||
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
      settings?.googleMapsApiKey ||
      '';

    if (key) {
      const googleUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=18&size=240x240&scale=2&maptype=hybrid` +
        `&markers=color:red%7C${lat},${lng}` +
        `&key=${encodeURIComponent(key)}`;
      try {
        const got = await fetchImage(googleUrl);
        if (got) {
          return new NextResponse(new Uint8Array(got.buf), {
            headers: {
              ...CORS_HEADERS,
              'Content-Type': got.contentType,
              'Cache-Control': 'public, max-age=86400',
            },
          });
        }
      } catch {
        /* try OSM */
      }
    }

    const { x, y, zoom } = osmTile(lat, lng, 18);
    const osmUrl = `https://tile.openstreetmap.org/${zoom}/${x}/${y}.png`;
    const osm = await fetchImage(osmUrl, {
      'User-Agent': 'TownPanchayatEMS/2.0 (inspection report static map)',
    });
    if (osm) {
      return new NextResponse(new Uint8Array(osm.buf), {
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    return new NextResponse('Map unavailable', { status: 404, headers: CORS_HEADERS });
  } catch (err: any) {
    return new NextResponse(err?.message || 'Map error', { status: 500, headers: CORS_HEADERS });
  }
}
