import { NextRequest, NextResponse } from 'next/server';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { findUserForLogin } from '@/lib/loginUserLookup';
import { getDb } from '@/lib/repositories/mastersRepository';
import { resolveGeoForPortalUser, resolveGeoForUser } from '@/lib/domain/geoResolver';
import { resolveInspectionScopeMasters } from '@/lib/inspectionScopeMasters';
import { isHodLikeUser, isZonalScopedUser, normalizePortalUserScope } from '@/lib/userScope';
import { resolveInspectorProfileFromDb } from '@/lib/inspectionUserProfile';
import { isMobileClientRequest } from '@/lib/mobileAppAuth';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-username, x-user-id',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (shouldUseRemotePortalApi(origin)) {
    const qs = req.nextUrl.searchParams.toString();
    const remote = await fetchRemotePortalJson(`/api/geo/me${qs ? `?${qs}` : ''}`, origin, { timeoutMs: 30_000 });
    if (remote) return NextResponse.json(remote, { headers: CORS_HEADERS });
    return NextResponse.json({ success: false, message: 'Remote geo unavailable' }, { status: 502, headers: CORS_HEADERS });
  }

  try {
    const { searchParams } = req.nextUrl;
    const identifier =
      searchParams.get('username') ||
      searchParams.get('userId') ||
      req.headers.get('x-username') ||
      req.headers.get('x-user-id') ||
      '';
    const clean = identifier.trim().toLowerCase();
    if (!clean) {
      return NextResponse.json({ success: false, message: 'username or userId required' }, { status: 400, headers: CORS_HEADERS });
    }

    const db = await getDb();
    if (!db) {
      return NextResponse.json({ success: false, message: 'MongoDB unavailable' }, { status: 503, headers: CORS_HEADERS });
    }

    const mobileClient = isMobileClientRequest(req);
    const hit = await findUserForLogin(identifier, clean, { mobileClient });
    const userDoc = hit?.userDoc;
    if (!userDoc) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const scopedUser = normalizePortalUserScope(userDoc);
    const scopeGeo = await resolveInspectionScopeMasters(db, scopedUser);
    const portalGeo = await resolveGeoForPortalUser(db, scopedUser);
    const chainGeo = await resolveGeoForUser(db, scopedUser);

    const geo = {
      ...chainGeo,
      scopeType: portalGeo.scopeType,
      scopeId: portalGeo.scopeId,
      portalScope: portalGeo.portalScope,
    };

    if (isZonalScopedUser(scopedUser) || scopeGeo.scopeKind === 'zonal') {
      const zone = scopeGeo.zones[0];
      geo.tpId = '';
      geo.tpNameEn = zone?.nameEn ? `${zone.nameEn} — All Town Panchayats` : 'All Town Panchayats';
      geo.tpNameTa = zone?.nameTa ? `${zone.nameTa} — அனைத்து பேரூராட்சிகள்` : 'அனைத்து பேரூராட்சிகள்';
      geo.districtId = '';
      geo.districtNameEn = zone?.nameEn ? `All districts in ${zone.nameEn}` : 'All Districts';
      geo.districtNameTa = zone?.nameTa ? `${zone.nameTa} — அனைத்து மாவட்டங்கள்` : 'அனைத்து மாவட்டங்கள்';
      geo.zoneId = zone?.id || scopeGeo.zoneId || geo.zoneId;
      geo.zoneNameEn = zone?.nameEn || geo.zoneNameEn;
      geo.zoneNameTa = zone?.nameTa || geo.zoneNameTa;
    } else if (isHodLikeUser(scopedUser) || scopeGeo.scopeKind === 'hod') {
      geo.tpId = '';
      geo.districtId = '';
      geo.tpNameEn = 'All Town Panchayats';
      geo.tpNameTa = 'அனைத்து பேரூராட்சிகள்';
      geo.districtNameEn = 'All Districts';
      geo.districtNameTa = 'அனைத்து மாவட்டங்கள்';
    } else if (scopeGeo.scopeKind === 'multi_tp') {
      geo.tpId = '';
      geo.tpNameEn = `Selected Town Panchayats (${scopeGeo.townPanchayats.length})`;
      geo.tpNameTa = `தேர்ந்தெடுத்த பேரூராட்சிகள் (${scopeGeo.townPanchayats.length})`;
    }

    const mapGeo = (rows: any[], extra?: (r: any) => Record<string, string>) =>
      rows.map((r) => ({
        id: r.id,
        nameEn: r.nameEn || '',
        nameTa: r.nameTa || '',
        code: r.code || '',
        ...(extra ? extra(r) : {}),
      }));

    let profile: Awaited<ReturnType<typeof resolveInspectorProfileFromDb>> | undefined;
    try {
      profile = await resolveInspectorProfileFromDb(db, userDoc);
    } catch {
      /* optional */
    }

    return NextResponse.json(
      {
        success: true,
        source: 'mongo-live',
        username: userDoc.username || clean,
        geo,
        profile,
        zones: mapGeo(scopeGeo.zones),
        districts: mapGeo(scopeGeo.districts, (d) => ({ zoneId: d.zoneId || '' })),
        townPanchayats: mapGeo(scopeGeo.townPanchayats, (t) => ({
          districtId: t.districtId || '',
          zoneId: t.zoneId || '',
        })),
        scopeKind: scopeGeo.scopeKind,
        complete:
          isZonalScopedUser(scopedUser) ||
          isHodLikeUser(scopedUser) ||
          scopeGeo.scopeKind !== 'single_tp'
            ? scopeGeo.townPanchayats.length > 0
            : geo.missing.length === 0,
      },
      { headers: { ...CORS_HEADERS, 'Cache-Control': 'private, no-store, must-revalidate', 'X-Geo-Source': 'mongo-live' } },
    );
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err?.message || 'Server error' }, { status: 500, headers: CORS_HEADERS });
  }
}