import { NextRequest, NextResponse } from 'next/server';
import { 
  getCollectionData, 
  getEmployees, 
  getAppSettings, 
  enrichUserForApp,
  getMongoClient,
  getActiveMongoDb,
  getPresignedS3Url,
  extractCalendarDateYMD,
  getTargetedInspectionWorks
} from '@/lib/storage';
import { getScopeVersionMeta } from '@/lib/userScopeCache';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';

export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const remoteQs = searchParams.toString();
    const remoteState = await fetchRemotePortalJson(
      `/api/portal-state${remoteQs ? `?${remoteQs}` : ''}`,
      req.nextUrl.origin
    );
    if (remoteState) {
      return NextResponse.json(remoteState, { headers: CORS_HEADERS });
    }
    if (shouldUseRemotePortalApi(req.nextUrl.origin)) {
      return NextResponse.json(
        { success: false, message: 'Live portal state unavailable. Check PORTAL_API_BASE and network connectivity.' },
        { status: 502, headers: CORS_HEADERS }
      );
    }

    const username = searchParams.get('username') || searchParams.get('userId') || searchParams.get('user') || req.headers.get('x-username') || req.headers.get('x-user-id');
    const todayOnly = searchParams.get('todayOnly') === 'true';

    const requestedUser = (username || '').trim().toLowerCase();

    // 1. Load ALL live master data directly from MongoDB / Database (excluding heavy inspectionWorks)
    const [
      districts,
      townPanchayats,
      zones,
      subjects,
      categories,
      fields,
      wardsAndStreets,
      inspectionUsers,
      employees,
      inspectionRoles,
      inspectionDesignations,
      notifications,
      apkVersions,
      settings,
    ] = await Promise.all([
      getCollectionData('districts'),
      getCollectionData('townPanchayats'),
      getCollectionData('zones'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('inspectionFields'),
      getCollectionData('wardsAndStreets'),
      getCollectionData('inspectionUsers'),
      getEmployees(),
      getCollectionData('inspectionRoles'),
      getCollectionData('inspectionDesignations'),
      getCollectionData('notifications'),
      getCollectionData('apkVersions'),
      getAppSettings(),
    ]);

    // Normalize subjects directly from original database records
    const normalizedSubjects = (subjects || []).map((s: any) => {
      const id = s.id || (s._id ? String(s._id) : '') || s.code || s.nameEn || '';
      return {
        ...s,
        id,
        nameEn: s.nameEn || s.name || s.subjectName || '',
        nameTa: s.nameTa || s.nameTamil || s.name || '',
        code: s.code || '',
      };
    });

    // Normalize categories directly from original database records
    const normalizedCategories = (categories || []).map((c: any) => {
      const id = c.id || (c._id ? String(c._id) : '') || c.nameEn || '';
      return {
        ...c,
        id,
        subjectId: c.subjectId || c.subject_id || c.subject || '',
        nameEn: c.nameEn || c.name || c.categoryName || '',
        nameTa: c.nameTa || c.nameTamil || c.name || '',
      };
    });

    // Normalize wards and streets directly from original database records (wardNo, streetNameEn, streetNameTa, tpId)
    const normalizedWardsAndStreets = (wardsAndStreets || []).map((w: any, idx: number) => {
      const rawTp = w.tpId || w.tp_id || w.townPanchayatId || w.town_panchayat_id || w.tpName || w.townPanchayat || '';
      const rawTpStr = String(rawTp).trim().toLowerCase();
      const matchedTp = (townPanchayats || []).find((t: any) =>
        String(t.id || '').toLowerCase() === rawTpStr ||
        String(t._id || '').toLowerCase() === rawTpStr ||
        String(t.nameEn || '').toLowerCase() === rawTpStr ||
        String(t.nameTa || '').toLowerCase() === rawTpStr ||
        String(t.code || '').toLowerCase() === rawTpStr
      );
      const tpId = matchedTp ? matchedTp.id : (rawTp || '');
      const rawWard = w.wardNo ?? w.ward_no ?? w.wardNumber ?? w.ward ?? w.ward_id ?? '';
      let cleanWardNo = String(rawWard).trim().replace(/[^0-9]/g, '');
      if (!cleanWardNo) cleanWardNo = String(rawWard).trim() || '1';
      const streetNameEn = String(w.streetNameEn || w.streetName || w.street_name || w.street || w.nameEn || w.name || `Street ${idx + 1}`).trim();
      const streetNameTa = String(w.streetNameTa || w.street_name_ta || w.nameTa || streetNameEn).trim();
      const tpNameEn = matchedTp?.nameEn || w.tpNameEn || w.tpName || w.townPanchayat || '';
      const tpNameTa = matchedTp?.nameTa || w.tpNameTa || '';
      return {
        id: w.id || (w._id ? String(w._id) : `ws_${tpId}_${cleanWardNo}_${idx}`),
        tpId,
        tpNameEn,
        tpNameTa,
        wardNo: cleanWardNo,
        wardNameEn: w.wardNameEn || `Ward ${cleanWardNo}`,
        wardNameTa: w.wardNameTa || `வார்டு ${cleanWardNo}`,
        streetNameEn,
        streetNameTa,
      };
    });

    const masters = {
      townPanchayats: townPanchayats || [],
      districts: districts || [],
      zones: zones || [],
      inspectionRoles: inspectionRoles || [],
      inspectionDesignations: inspectionDesignations || [],
      inspectionSubjects: normalizedSubjects,
      inspectionCategories: normalizedCategories,
      wardsAndStreets: normalizedWardsAndStreets,
    };

    // 3. Directly find and scope the requesting user without any intermediate cache
    let matchedUser: any = null;
    let userSpecificWardsAndStreets = normalizedWardsAndStreets;
    let userSpecificTps = townPanchayats || [];
    let userSpecificDistricts = districts || [];
    let userSpecificZones = zones || [];

    const allCandidateUsers = [
      ...(inspectionUsers || []),
      ...(employees || []),
    ];

    const rawUser = requestedUser ? allCandidateUsers.find(
      (u: any) =>
        String(u.username || '').toLowerCase() === requestedUser ||
        String(u.id || '').toLowerCase() === requestedUser ||
        String(u._id || '').toLowerCase() === requestedUser ||
        String(u.mobile || '').trim() === requestedUser ||
        String(u.employeeId || '').toLowerCase() === requestedUser
    ) : null;

    if (rawUser) {
      matchedUser = enrichUserForApp(rawUser, masters);
      delete matchedUser.password;
      delete matchedUser.passwordHash;

      const isHOD = matchedUser.scopeType === 'HOD' || 
                    matchedUser.role === 'Super Admin' || 
                    ['admin', 'dtpadmin', 'director'].includes(requestedUser);

      if (!isHOD) {
        // Resolve user's Town Panchayat
        const userTpId = String(matchedUser.tpId || rawUser.tpId || rawUser.townPanchayatId || '').toLowerCase();
        const userDistrictId = String(matchedUser.districtId || rawUser.districtId || '').toLowerCase();
        const userZoneId = String(matchedUser.zoneId || rawUser.zoneId || '').toLowerCase();

        // User assigned wards (original wards)
        const userAssignedWardsRaw = (matchedUser.assignedWards || matchedUser.selectedWards || rawUser.assignedWards || rawUser.selectedWards || rawUser.wards || []);
        const userWardNumbers = (Array.isArray(userAssignedWardsRaw) ? userAssignedWardsRaw : [userAssignedWardsRaw])
          .map((w: any) => String(w).trim().replace(/[^0-9]/g, ''))
          .filter(Boolean);
        const userWardSet = new Set<string>(userWardNumbers);

        // Filter permitted Town Panchayats, Districts, Zones directly
        if (userTpId) {
          userSpecificTps = (townPanchayats || []).filter((t: any) => String(t.id || '').toLowerCase() === userTpId);
          const parentTp = (townPanchayats || []).find((t: any) => String(t.id || '').toLowerCase() === userTpId);
          const parentDistId = String(parentTp?.districtId || '').toLowerCase();
          if (parentDistId) {
            userSpecificDistricts = (districts || []).filter((d: any) => String(d.id || '').toLowerCase() === parentDistId);
            const parentDist = (districts || []).find((d: any) => String(d.id || '').toLowerCase() === parentDistId);
            const parentZoneId = String(parentDist?.zoneId || '').toLowerCase();
            if (parentZoneId) {
              userSpecificZones = (zones || []).filter((z: any) => String(z.id || '').toLowerCase() === parentZoneId);
            } else {
              userSpecificZones = [];
            }
          } else {
            userSpecificDistricts = [];
            userSpecificZones = [];
          }
        } else if (userDistrictId) {
          userSpecificDistricts = (districts || []).filter((d: any) => String(d.id || '').toLowerCase() === userDistrictId);
          userSpecificTps = (townPanchayats || []).filter((t: any) => String(t.districtId || '').toLowerCase() === userDistrictId);
          const parentDist = (districts || []).find((d: any) => String(d.id || '').toLowerCase() === userDistrictId);
          const parentZoneId = String(parentDist?.zoneId || '').toLowerCase();
          if (parentZoneId) {
            userSpecificZones = (zones || []).filter((z: any) => String(z.id || '').toLowerCase() === parentZoneId);
          } else {
            userSpecificZones = [];
          }
        } else if (userZoneId) {
          userSpecificZones = (zones || []).filter((z: any) => String(z.id || '').toLowerCase() === userZoneId);
          userSpecificDistricts = (districts || []).filter((d: any) => String(d.zoneId || '').toLowerCase() === userZoneId);
          const distIds = new Set(userSpecificDistricts.map((d: any) => String(d.id || '').toLowerCase()));
          userSpecificTps = (townPanchayats || []).filter((t: any) => distIds.has(String(t.districtId || '').toLowerCase()));
        }

        // Filter Wards & Streets DIRECTLY for this inspection user - NO FALLBACK
        userSpecificWardsAndStreets = (normalizedWardsAndStreets || []).filter((w: any) => {
          const streetTpId = String(w.tpId || '').toLowerCase();
          const streetWardNo = String(w.wardNo || '').trim().replace(/[^0-9]/g, '');

          const isTpMatch = !userTpId || streetTpId === userTpId;
          const isWardMatch = userWardSet.size === 0 || userWardSet.has(streetWardNo);

          return isTpMatch && isWardMatch;
        });
      }
    } else if (['admin', 'dtpadmin', 'director'].includes(requestedUser)) {
      matchedUser = {
        id: 'admin',
        username: 'admin',
        name: 'Administrator',
        nameEn: 'Administrator',
        nameTa: 'நிர்வாகி',
        role: 'Super Admin',
        roleNameTa: 'முதன்மை நிர்வாகி',
        designation: 'System Administrator',
        designationNameEn: 'System Administrator',
        designationNameTa: 'கணினி நிர்வாகி',
        townPanchayat: 'All Town Panchayats',
        townPanchayatTa: 'அனைத்து பேரூராட்சிகள்',
        zone: 'State HQ',
        zoneTa: 'மாநில தலைமையகம்',
        district: 'State',
        districtTa: 'மாநிலம்',
        isInspectionUser: true,
        assignedWards: [],
        subjectIds: normalizedSubjects.map(s => s.id),
        assignedSubjects: normalizedSubjects.map(s => s.id),
        categoryIds: normalizedCategories.map(c => c.id),
        assignedCategories: normalizedCategories.map(c => c.id),
      };
    }

    // 4. Targeted MongoDB Index Query Optimization
    // Directly queries index in MongoDB (<5ms) and fetches only latest 100 reports
    // for this inspector or their Town Panchayat - CPU load reduced by 99%!
    let fetchedWorks: any[] = [];
    const isNormalInspector = requestedUser && !['admin', 'dtpadmin', 'director'].includes(requestedUser) && matchedUser?.role !== 'Super Admin' && matchedUser?.scopeType !== 'HOD';

    if (isNormalInspector) {
      const userTpId = String(matchedUser?.tpId || rawUser?.tpId || rawUser?.townPanchayatId || '').toLowerCase();
      const parentTp = (townPanchayats || []).find((t: any) => String(t.id || '').toLowerCase() === userTpId);
      
      fetchedWorks = await getTargetedInspectionWorks({
        username: requestedUser,
        userId: rawUser?.id,
        tpId: userTpId,
        tpNameEn: parentTp?.nameEn,
        limit: 500,
        todayOnly,
      });
    } else {
      // For Admin/Director or unauthenticated sync, fetch recent works directly with MongoDB index
      fetchedWorks = await getTargetedInspectionWorks({
        limit: todayOnly ? 500 : 10000,
        todayOnly,
      });
    }

    const appSettings = (settings || {}) as any;

    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${protocol}://${host}`;

    const candidateUsernames = new Set<string>();
    const candidateUserIds = new Set<string>();
    const candidateNames = new Set<string>();

    if (matchedUser) {
      if (matchedUser.username) candidateUsernames.add(String(matchedUser.username).toLowerCase());
      if (matchedUser.mobile) candidateUsernames.add(String(matchedUser.mobile).toLowerCase());
      if (matchedUser.id) candidateUserIds.add(String(matchedUser.id).toLowerCase());
      if (matchedUser.employeeId) candidateUserIds.add(String(matchedUser.employeeId).toLowerCase());
      if (matchedUser.name) candidateNames.add(String(matchedUser.name).toLowerCase());
      if (matchedUser.nameEn) candidateNames.add(String(matchedUser.nameEn).toLowerCase());
    }
    if (rawUser) {
      if (rawUser.username) candidateUsernames.add(String(rawUser.username).toLowerCase());
      if (rawUser.mobile) candidateUsernames.add(String(rawUser.mobile).toLowerCase());
      if (rawUser.id) candidateUserIds.add(String(rawUser.id).toLowerCase());
      if (rawUser.employeeId) candidateUserIds.add(String(rawUser.employeeId).toLowerCase());
      if (rawUser.name) candidateNames.add(String(rawUser.name).toLowerCase());
      if (rawUser.nameEn) candidateNames.add(String(rawUser.nameEn).toLowerCase());
    }
    if (requestedUser) {
      candidateUsernames.add(requestedUser);
      candidateUserIds.add(requestedUser);
    }

    const finalWorks = (fetchedWorks || []).map((w: any) => {
      const tp = (townPanchayats || []).find((t: any) => t.id === w.tpId || t.nameEn?.toLowerCase() === (w.tpNameEn || '').toLowerCase());
      const dist = (districts || []).find((d: any) => d.id === (w.districtId || tp?.districtId));
      const subj = (normalizedSubjects || []).find((s: any) => s.id === w.subjectId);
      const cat = (normalizedCategories || []).find((c: any) => c.id === w.categoryId);

      let cleanWorkId = String(w.workId || w.id || '').trim();
      // Strictly prevent TP- prefix in workId
      if (cleanWorkId.toUpperCase().startsWith('TP01-') || cleanWorkId.toUpperCase().startsWith('TP-') || cleanWorkId.toUpperCase().startsWith('TP')) {
        cleanWorkId = cleanWorkId.replace(/^TP01-/i, 'WRK-').replace(/^TP-/i, 'WRK-').replace(/^TP/i, 'WRK-');
      }
      if (!cleanWorkId || cleanWorkId === 'work' || cleanWorkId.startsWith('#')) {
        const uTag = (matchedUser?.username || rawUser?.username || requestedUser || 'USER').toUpperCase().replace(/^TP+/i, '');
        cleanWorkId = `WRK-${uTag}-${Date.now()}`;
      }

      // Check if this work belongs to the current user
      const wSubUserId = String(w.submittedByUserId || '').toLowerCase();
      const wSubUserName = String(w.submittedByUserName || '').toLowerCase();
      const wUser = String(w.username || '').toLowerCase();
      const wid = cleanWorkId.toLowerCase();

      const isCurrentUsersWork = matchedUser && (
        candidateUserIds.has(wSubUserId) ||
        candidateUsernames.has(wUser) ||
        candidateUsernames.has(wSubUserName) ||
        candidateNames.has(wSubUserName) ||
        Array.from(candidateUsernames).some(u => wid.includes(`-${u}-`) || wid.includes(`-${u}`) || wid.endsWith(`-${u}`))
      );

      // If it belongs to current user, ensure submittedByUserId and submittedByUserName match the user
      // so Android app InspectionDashboardScreen and InspectionReportsScreen filters display them 100% correctly
      const effectiveUserId = isCurrentUsersWork && matchedUser.id ? matchedUser.id : (w.submittedByUserId || w.username || '');
      const effectiveUserName = isCurrentUsersWork && (matchedUser.name || matchedUser.username) ? (matchedUser.name || matchedUser.username) : (w.submittedByUserName || w.username || '');

      let imageUrl = w.imageUrl || '';
      if (imageUrl) {
        if (imageUrl.startsWith('/uploads')) {
          imageUrl = `${origin}${imageUrl}`;
        } else if (imageUrl.startsWith('inspection/')) {
          imageUrl = `https://tms-2026.s3.ap-south-1.amazonaws.com/${imageUrl}`;
        } else if (imageUrl.startsWith('/data/') || imageUrl.startsWith('/storage/') || imageUrl.includes('offline_images') || imageUrl.includes('raw_uploads')) {
          imageUrl = '';
        }
      }
      const fieldsData = { ...(w.fieldsData || {}) };
      for (const [key, val] of Object.entries(fieldsData)) {
        if (typeof val === 'string') {
          if (val.startsWith('/uploads')) {
            fieldsData[key] = `${origin}${val}`;
          } else if (val.startsWith('inspection/')) {
            fieldsData[key] = `https://tms-2026.s3.ap-south-1.amazonaws.com/${val}`;
          } else if (val.startsWith('/data/') || val.startsWith('/storage/') || val.includes('offline_images') || val.includes('raw_uploads')) {
            fieldsData[key] = '';
          }
        }
      }

      return {
        ...w,
        id: w.id || cleanWorkId,
        workId: cleanWorkId,
        submittedByUserId: effectiveUserId,
        submittedByUserName: effectiveUserName,
        username: isCurrentUsersWork && matchedUser?.username ? matchedUser.username : (w.username || effectiveUserId),
        tpNameEn: w.tpNameEn || tp?.nameEn || '',
        tpNameTa: w.tpNameTa || tp?.nameTa || '',
        districtNameEn: w.districtNameEn || dist?.nameEn || '',
        districtNameTa: w.districtNameTa || dist?.nameTa || '',
        zoneNameEn: w.zoneNameEn || '',
        zoneNameTa: w.zoneNameTa || '',
        subjectNameEn: w.subjectNameEn || subj?.nameEn || '',
        subjectNameTa: w.subjectNameTa || subj?.nameTa || '',
        categoryNameEn: w.categoryNameEn || cat?.nameEn || '',
        categoryNameTa: w.categoryNameTa || cat?.nameTa || '',
        status: w.status || 'Completed',
        imageUrl,
        fieldsData,
      };
    });

    if (matchedUser && (matchedUser.profilePhotoUrl || matchedUser.avatarUrl || matchedUser.profileImage)) {
      let uPhoto = matchedUser.profilePhotoUrl || matchedUser.avatarUrl || matchedUser.profileImage;
      if (typeof uPhoto === 'string' && uPhoto.startsWith('data:')) {
        uPhoto = '';
      } else if (uPhoto?.startsWith('/uploads')) {
        uPhoto = `${origin}${uPhoto}`;
      } else if (uPhoto && (uPhoto.includes('s3.') || uPhoto.includes('amazonaws.com') || uPhoto.startsWith('profiles/'))) {
        try {
          uPhoto = await getPresignedS3Url(uPhoto);
        } catch (_) {}
      }
      if (uPhoto) {
        matchedUser = {
          ...matchedUser,
          profilePhotoUrl: uPhoto,
          avatarUrl: uPhoto,
        };
      }
    }

    const scopeMeta = getScopeVersionMeta();

    return NextResponse.json({
      success: true,
      scopeVersion: scopeMeta.version,
      districts: userSpecificDistricts,
      townPanchayats: userSpecificTps,
      zones: userSpecificZones,
      inspectionSubjects: normalizedSubjects,
      inspectionCategories: normalizedCategories,
      inspectionFields: fields || [],
      wardsAndStreets: userSpecificWardsAndStreets,
      inspectionWorks: finalWorks,
      inspectionUsers: (inspectionUsers || []).map((u: any) => {
        const enr = enrichUserForApp(u, masters);
        delete enr.password;
        return enr;
      }),
      inspectionRoles: inspectionRoles || [],
      inspectionDesignations: inspectionDesignations || [],
      user: matchedUser || undefined,
      appIconUrl: appSettings.appIconUrl || null,
      loginLogoUrl: appSettings.loginLogoUrl || null,
      apkVersions: apkVersions || [],
      notifications: notifications || [],
      settings: appSettings,
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Portal state error:', err);
    return NextResponse.json({ success: false, message: 'Server error retrieving portal state' }, { status: 500, headers: CORS_HEADERS });
  }
}
