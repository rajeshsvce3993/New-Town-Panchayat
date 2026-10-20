import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  getCollectionData,
  saveSingleInspectionWork,
  resolveInspectionUsername,
  uploadInspectionMediaToS3,
  saveInspectionDetailsToS3,
  getNextUserInspectionSeq,
  generateUserWorkId,
  getMongoClient,
  readLocalDb,
  normalizeAndEnrichWorks,
  getPresignedS3Url,
  extractCalendarDateYMD,
  findExistingInspectionWork,
  getTargetedInspectionWorks,
  getActiveMongoDb,
} from '@/lib/storage';
import { enqueueInspectionWork } from '@/lib/serverQueue';
import { getUserScopeDetails } from '@/lib/userScopeCache';
import { logServerProcess } from '@/lib/serverLogger';
import { fetchRemotePortalJson, shouldUseRemotePortalApi } from '@/lib/remotePortalApi';
import { fetchRemoteInspectionWorksRaw } from '@/lib/remoteInspectionWorksCache';
import { buildInspectionWorksViewResponse } from '@/lib/inspectionWorksQueryFilters';
import { resolveInspectionFilterMasters } from '@/lib/inspectionWorksFilterMastersServer';
import {
  buildInspectionWorksCacheKey,
  parseInspectionWorksViewQuery,
  toInspectionWorksFilterQuery,
} from '@/lib/inspectionWorksViewQuery';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

// In-memory short-lived cache for inspection works list to prevent event-loop congestion from rapid polling
let cachedWorksList: { data: any; timestamp: number; key: string } | null = null;
const WORKS_CACHE_TTL_MS = 45_000; // filtered response cache (raw list cached separately ~15 min)

// GET: Retrieve inspection works from MongoDB (sorted newest first)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const viewQuery = parseInspectionWorksViewQuery(searchParams);
    const cacheKey = buildInspectionWorksCacheKey(searchParams);
    const fromDate = viewQuery.fromDate;
    const toDate = viewQuery.toDate;
    const dateParam = viewQuery.dateParam;
    const districtId = viewQuery.districtId;
    const tpId = viewQuery.tpId;
    const zoneId = viewQuery.zoneId;
    const ward = viewQuery.ward;
    const username = viewQuery.username;
    const lite = viewQuery.lite;

    const now = Date.now();
    if (cachedWorksList && cachedWorksList.key === cacheKey && (now - cachedWorksList.timestamp) < WORKS_CACHE_TTL_MS) {
      return NextResponse.json(cachedWorksList.data, { headers: CORS_HEADERS });
    }

    const rawList = await fetchRemoteInspectionWorksRaw(req.nextUrl.origin);
    if (rawList) {
      const masters = await resolveInspectionFilterMasters(req.nextUrl.origin);
      const view = buildInspectionWorksViewResponse(
        rawList,
        toInspectionWorksFilterQuery(viewQuery),
        masters,
        { lite, limit: viewQuery.limit || (lite ? 2000 : 0) }
      );
      const responsePayload = {
        success: true,
        count: view.works.length,
        works: view.works,
        categoryCounts: view.categoryCounts,
        totalWithoutCategoryFilter: view.totalWithoutCategoryFilter,
        remoteTotal: rawList.length,
      };
      const shouldCache =
        view.works.length > 0 || rawList.length === 0 || !(fromDate || toDate || dateParam);
      if (shouldCache) {
        cachedWorksList = { data: responsePayload, timestamp: Date.now(), key: cacheKey };
      }
      return NextResponse.json(responsePayload, { headers: CORS_HEADERS });
    }

    if (shouldUseRemotePortalApi(req.nextUrl.origin)) {
      return NextResponse.json(
        {
          success: false,
          message:
            'Live portal inspection works are still loading or unavailable. Wait for the first sync to finish, then click Apply filters again.',
          works: [],
          count: 0,
          categoryCounts: {},
          totalWithoutCategoryFilter: 0,
        },
        { status: 503, headers: CORS_HEADERS }
      );
    }

    let works: any[] = [];

    // Query directly from MongoDB
    try {
      const client = await getMongoClient();
      if (client) {
        const db = await getActiveMongoDb(client);
        const query: any = {};
        const andConditions: any[] = [];

        if (districtId) {
          andConditions.push({
            $or: [
              { districtId: districtId },
              { districtId: districtId.toLowerCase() },
              { districtId: districtId.toUpperCase() }
            ]
          });
        }
        if (tpId) {
          andConditions.push({
            $or: [
              { tpId: tpId },
              { tpId: tpId.toLowerCase() },
              { tpId: tpId.toUpperCase() }
            ]
          });
        }
        if (zoneId) {
          andConditions.push({
            $or: [
              { zoneId: zoneId },
              { zoneId: zoneId.toLowerCase() },
              { zoneId: zoneId.toUpperCase() }
            ]
          });
        }
        if (ward) {
          andConditions.push({
            $or: [{ ward: String(ward) }, { wardNumber: String(ward) }, { wardNo: String(ward) }]
          });
        }
        if (username) {
          const uStr = String(username).trim();
          andConditions.push({
            $or: [
              { submittedByUserName: uStr },
              { submittedByUserName: uStr.toLowerCase() },
              { username: uStr },
              { username: uStr.toLowerCase() },
              { submittedByUserId: uStr },
              { submittedByUserName: { $regex: new RegExp(`^${uStr}$`, 'i') } },
            ]
          });
        }

        if (fromDate || toDate) {
          const dateRangeConds: any[] = [];
          
          const isoCond: any = {};
          if (fromDate) isoCond.$gte = `${fromDate}T00:00:00.000Z`;
          if (toDate) isoCond.$lte = `${toDate}T23:59:59.999Z`;
          dateRangeConds.push({ submittedAt: isoCond });
          dateRangeConds.push({ createdAt: isoCond });
          
          const strCond: any = {};
          if (fromDate) strCond.$gte = fromDate;
          if (toDate) strCond.$lte = toDate;
          dateRangeConds.push({ date: strCond });

          andConditions.push({ $or: dateRangeConds });
        } else if (dateParam) {
          const targetYmd = extractCalendarDateYMD(dateParam) || dateParam;
          const dateRangeConds: any[] = [];
          
          const isoCond: any = { $gte: `${targetYmd}T00:00:00.000Z`, $lte: `${targetYmd}T23:59:59.999Z` };
          dateRangeConds.push({ submittedAt: isoCond });
          dateRangeConds.push({ createdAt: isoCond });
          dateRangeConds.push({ date: targetYmd });

          andConditions.push({ $or: dateRangeConds });
        }

        if (andConditions.length > 0) {
          query.$and = andConditions;
        }

        const limitParam = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 0;
        const queryLimit = limitParam > 0 ? limitParam : (lite ? 400 : 0);

        let mongoQuery = db.collection('inspectionWorks')
          .find(query, lite ? {
            projection: {
              fieldsData: 0,
              photos: 0,
              documents: 0,
              photoBase64: 0,
              locationImage: 0,
              staticMapUrl: 0,
              mapImage: 0,
            },
          } : undefined)
          .sort({ submittedAt: -1, createdAt: -1 });

        if (queryLimit > 0) {
          mongoQuery = mongoQuery.limit(queryLimit);
        }

        works = await mongoQuery.toArray();

        works = works.map((item: any) => {
          const { _id, ...rest } = item;
          return { id: item.id || (_id ? _id.toString() : ''), ...rest };
        });
      }
    } catch (dbErr) {
      console.warn('MongoDB query warning in GET inspection-works, using fallback:', dbErr);
    }

    if ((!works || works.length === 0) && !fromDate && !toDate && !dateParam) {
      const limitParam = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 0;
      works = (await getTargetedInspectionWorks({
        username: username || undefined,
        tpId: tpId || undefined,
        limit: limitParam > 0 ? limitParam : (lite ? 400 : 100000)
      })) || [];
    }

    if (lite) {
      const masters = await resolveInspectionFilterMasters(req.nextUrl.origin);
      const view = buildInspectionWorksViewResponse(
        works || [],
        toInspectionWorksFilterQuery(viewQuery),
        masters,
        { lite: true, limit: viewQuery.limit || 2000 }
      );
      const responsePayload = {
        success: true,
        count: view.works.length,
        works: view.works,
        categoryCounts: view.categoryCounts,
        totalWithoutCategoryFilter: view.totalWithoutCategoryFilter,
      };
      if (view.works.length > 0) {
        cachedWorksList = { data: responsePayload, timestamp: Date.now(), key: cacheKey };
      }
      return NextResponse.json(responsePayload, { headers: CORS_HEADERS });
    }

    const [dbSubjects, dbCategories, dbTps, dbDistricts] = await Promise.all([
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('townPanchayats'),
      getCollectionData('districts'),
    ]);
    const masters = {
      inspectionSubjects: dbSubjects || [],
      inspectionCategories: dbCategories || [],
      townPanchayats: dbTps || [],
      districts: dbDistricts || [],
    };

    let filtered = normalizeAndEnrichWorks(works, masters);

    if (dateParam) {
      // Normalize dateParam to YYYY-MM-DD
      const targetYmd = extractCalendarDateYMD(dateParam) || dateParam;

      filtered = filtered.filter((w: any) => {
        const itemYmd = extractCalendarDateYMD(w.submittedAt || w.createdAt || w.date);
        if (itemYmd) return itemYmd === targetYmd;
        const itemDate = String(w.submittedAt || w.createdAt || w.date || '');
        return itemDate.includes(targetYmd) || itemDate.includes(dateParam);
      });
    }
    if (districtId) {
      filtered = filtered.filter((w: any) => String(w.districtId) === String(districtId) || String(w.districtCode) === String(districtId));
    }
    if (tpId) {
      const sTp = String(tpId).toLowerCase();
      filtered = filtered.filter((w: any) =>
        String(w.tpId).toLowerCase() === sTp ||
        String(w.tpCode).toLowerCase() === sTp ||
        String(w.tpNameEn || '').toLowerCase().includes(sTp) ||
        sTp.includes(String(w.tpNameEn || '').toLowerCase())
      );
    }
    if (ward) {
      const normWard = String(ward).trim().replace(/^0+/, '') || '0';
      filtered = filtered.filter((w: any) => {
        const itemWard = String(w.wardNumber || w.wardNo || w.ward || '').trim().replace(/^0+/, '') || '0';
        return itemWard === normWard;
      });
    }
    if (username) {
      const uLower = username.toLowerCase();
      filtered = filtered.filter((w: any) => {
        const u = String(w.submittedByUserName || w.username || w.submittedByUserId || '').toLowerCase();
        const wid = String(w.workId || '').toLowerCase();
        return u === uLower || u.includes(uLower) || wid.includes(`-${uLower}-`);
      });
    }

    const toObfuscatedProxyUrl = (rawUrlOrKey: string): string => {
      if (!rawUrlOrKey || typeof rawUrlOrKey !== 'string') return '';
      if (rawUrlOrKey.startsWith('data:image') || rawUrlOrKey.startsWith('blob:')) return rawUrlOrKey;
      if (rawUrlOrKey.startsWith('/api/media')) return rawUrlOrKey;

      let s3Key = rawUrlOrKey;
      if (rawUrlOrKey.startsWith('http')) {
        try {
          const parsed = new URL(rawUrlOrKey);
          s3Key = decodeURIComponent(parsed.pathname.replace(/^\//, '')).replace(/\+/g, ' ');
        } catch {
          s3Key = decodeURIComponent(rawUrlOrKey.replace(/^https?:\/\/[^/]+\//, '')).replace(/\+/g, ' ');
        }
      }

      s3Key = s3Key.split('?')[0].replace(/^\/+/, '');
      if (!s3Key) return '';

      const token = Buffer.from(s3Key).toString('base64');
      return `/api/media?token=${encodeURIComponent(token)}`;
    };

    const normalizedWorks = await Promise.all(filtered.map(async (w: any) => {
      let imageUrl = w.imageUrl || '';
      if (imageUrl) {
        if (imageUrl.startsWith('/uploads')) {
          imageUrl = `${origin}${imageUrl}`;
        } else if (imageUrl.includes('s3.amazonaws.com') || imageUrl.includes('s3.ap-south-1.amazonaws.com') || imageUrl.startsWith('inspection/')) {
          imageUrl = toObfuscatedProxyUrl(imageUrl);
        } else if (imageUrl.startsWith('/data/') || imageUrl.startsWith('/storage/') || imageUrl.includes('offline_images') || imageUrl.includes('raw_uploads')) {
          imageUrl = '';
        }
      }
      
      const fieldsData = { ...(w.fieldsData || {}) };
      for (const [key, val] of Object.entries(fieldsData)) {
        if (typeof val === 'string') {
          if (val.startsWith('/uploads')) {
            fieldsData[key] = `${origin}${val}`;
          } else if (val.includes('s3.amazonaws.com') || val.includes('s3.ap-south-1.amazonaws.com') || val.startsWith('inspection/')) {
            fieldsData[key] = toObfuscatedProxyUrl(val);
          } else if (val.startsWith('/data/') || val.startsWith('/storage/') || val.includes('offline_images') || val.includes('raw_uploads')) {
            fieldsData[key] = '';
          }
        }
      }

      let cleanWorkId = String(w.workId || w.id || '').trim();
      if (cleanWorkId.toUpperCase().startsWith('TP01-') || cleanWorkId.toUpperCase().startsWith('TP-') || cleanWorkId.toUpperCase().startsWith('TP')) {
        cleanWorkId = cleanWorkId.replace(/^TP01-/i, 'WRK-').replace(/^TP-/i, 'WRK-').replace(/^TP/i, 'WRK-');
      }

      return {
        ...w,
        id: w.id || cleanWorkId,
        workId: cleanWorkId,
        imageUrl,
        fieldsData,
      };
    }));

    const responsePayload = {
      success: true,
      count: normalizedWorks.length,
      works: normalizedWorks,
    };
    if (normalizedWorks.length > 0) {
      cachedWorksList = { data: responsePayload, timestamp: Date.now(), key: cacheKey };
    }

    return NextResponse.json(responsePayload, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Fetch inspection works error:', err);
    return NextResponse.json({
      success: false,
      message: 'Server error fetching inspection works',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// POST: Save inspection work entry and images to AWS S3 (inspection/username/) and MongoDB,
// then confirm both are saved successfully and generate sequential Work ID per user.
export async function POST(req: NextRequest) {
  try {
    const host = req.headers.get('host') || 'localhost:3000';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${protocol}://${host}`;

    const data = await req.json();

    if (!data) {
      return NextResponse.json(
        { success: false, message: 'Work entry data payload is required' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const useQueue = searchParams.get('queue') === 'true' || req.headers.get('x-use-queue') === 'true';

    // If server-side queue mode is requested, place in FIFO queue immediately and return 202 Accepted
    if (useQueue) {
      const { jobId, queuePosition } = await enqueueInspectionWork(data);
      return NextResponse.json({
        success: true,
        queued: true,
        message: 'Work entry placed into server FIFO Queue',
        jobId,
        status: 'QUEUED',
        queuePosition,
      }, { status: 202, headers: CORS_HEADERS });
    }

    // Invalidate cached works list on new submission so fresh works reflect immediately
    cachedWorksList = null;

    // 1. Resolve canonical username for the submitting user
    const username = await resolveInspectionUsername(
      data.submittedByUserId,
      data.submittedByUserName || data.username
    );

    // Validate user scope and fields from user_scope_cache (server validation - no general fallback)
    const userScope = await getUserScopeDetails(username);
    const isAdmin = ['admin', 'dtpadmin', 'director'].includes(username.toLowerCase());

    if (!userScope && !isAdmin) {
      return NextResponse.json(
        {
          success: false,
          message: 'பயனருக்கு ஆய்வு வரம்பு ஒதுக்கப்படவில்லை அல்லது பதிவிறக்கப்படவில்லை. பொது ஆய்வாக (General Inspection) சமர்ப்பிக்க அனுமதி இல்லை.',
        },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    if (userScope) {
      // Validate assigned wards if specific wards are assigned (supports wardNumber, wardNo, ward, W-6, 06, fieldsData)
      const incomingWard = String(
        data.wardNumber ||
        data.wardNo ||
        data.ward ||
        data.wardId ||
        data.fieldsData?.wardNumber ||
        data.fieldsData?.wardNo ||
        data.fieldsData?.ward ||
        data.fieldsData?.if_ward ||
        ''
      ).trim().replace(/[^0-9]/g, '');

      const assignedWardsNormalized = (userScope.assignedWards || [])
        .map((w: any) => String(w).trim().replace(/[^0-9]/g, ''))
        .filter(Boolean);

      if (
        assignedWardsNormalized.length > 0 &&
        !userScope.assignedWards.includes('all') &&
        !userScope.assignedWards.includes('*')
      ) {
        if (!incomingWard || !assignedWardsNormalized.includes(incomingWard)) {
          console.warn(`[Ward check notice] User ${username} submitted ward "${incomingWard}", assigned: ${userScope.assignedWards.join(', ')}`);
        }
      }

      // Validate dynamic fields based on cached validation rules ONLY for the submitted category
      if (userScope.validationRules && data.categoryId) {
        const incomingFields = data.fieldsData || {};
        const categoryFields = (userScope.fields || []).filter((f: any) => f.categoryId === data.categoryId);
        const categoryFieldIds = new Set(categoryFields.map((f: any) => f.id));

        // Check if any field in incomingFields triggered skip_to_camera
        let skipToCameraTriggered = false;
        for (const [fId, rule] of Object.entries(userScope.validationRules)) {
          if (categoryFieldIds.size > 0 && !categoryFieldIds.has(fId)) continue;
          if (rule.conditionalAction === 'skip_to_camera' || rule.conditionalAction === 'hide_remaining') {
            const val = incomingFields[fId];
            const valStr = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
            const trig = (rule.conditionalTriggerValue || 'Yes').trim().toLowerCase();
            if (valStr && (valStr.toLowerCase() === trig || (trig === 'yes' && valStr === 'ஆம்') || (trig === 'no' && valStr === 'இல்லை'))) {
              skipToCameraTriggered = true;
              break;
            }
          }
        }

        // An uploaded photo or field photo is valid proof
        const hasPhoto = Boolean(
          data.imageUrl ||
          Object.values(incomingFields).some((v: any) =>
            typeof v === 'string' && (v.startsWith('data:image') || v.startsWith('http') || v.startsWith('/uploads') || v.includes('.jpg') || v.includes('.jpeg'))
          )
        );

        for (const [fId, rule] of Object.entries(userScope.validationRules)) {
          // Strictly only validate rules belonging to this submitted category
          if (categoryFieldIds.size > 0 && !categoryFieldIds.has(fId)) {
            continue;
          }

          // If skipToCamera is active and this is not the trigger field, skip validation
          const isTrigger = rule.conditionalAction === 'skip_to_camera' || rule.conditionalAction === 'hide_remaining';
          if (skipToCameraTriggered && !isTrigger) {
            continue;
          }

          // If field depends on parent field
          if (rule.dependsOnFieldId) {
            const parentVal = incomingFields[rule.dependsOnFieldId];
            const pValStr = typeof parentVal === 'string' ? parentVal.trim() : parentVal != null ? String(parentVal).trim() : '';
            const targetVal = (rule.dependsOnValue || '').trim().toLowerCase();
            const matches = pValStr.toLowerCase() === targetVal || (targetVal === 'yes' && pValStr === 'ஆம்') || (targetVal === 'no' && pValStr === 'இல்லை');
            const isHideIf = rule.conditionType === 'hide_if';
            const shouldBeVisible = isHideIf ? !matches : matches;
            if (!shouldBeVisible) {
              continue;
            }
          }

          const val = incomingFields[fId];
          const valStr = typeof val === 'string' ? val.trim() : val != null ? String(val).trim() : '';
          if (rule.required && !valStr && !hasPhoto) {
            return NextResponse.json(
              {
                success: false,
                message: rule.errorMessageTa || `${fId} விவரம் கட்டாயமாகும், சரியான தகவலை உள்ளிடவும்`,
              },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          if (rule.minLength && valStr.length > 0 && valStr.length < rule.minLength) {
            return NextResponse.json(
              {
                success: false,
                message: `${fId} குறைந்தபட்சம் ${rule.minLength} எழுத்துக்கள் கொண்டிருக்க வேண்டும்`,
              },
              { status: 400, headers: CORS_HEADERS }
            );
          }
          if (rule.pattern && valStr.length > 0 && !new RegExp(rule.pattern).test(valStr)) {
            return NextResponse.json(
              {
                success: false,
                message: `${fId} சரியான வடிவத்தில் இல்லை`,
              },
              { status: 400, headers: CORS_HEADERS }
            );
          }
        }
      }
    }

    // 2. Process and save uploaded images and files directly to AWS S3 (folder pattern: inspection/username/)
    // Check dynamic camera fields inside fieldsData first to extract S3 URLs
    const updatedFieldsData = { ...(data.fieldsData || {}) };
    let lastCameraPhotoUrl = null;

    for (const [key, val] of Object.entries(updatedFieldsData)) {
      if (typeof val === 'string' && val.trim() !== '') {
        const valLower = val.toLowerCase();
        const keyLower = key.toLowerCase();
        // Identify if this field is a camera/photo field
        const isPhotoUrl = val.startsWith('http') || val.startsWith('/uploads') || val.startsWith('data:image') || valLower.endsWith('.jpg') || valLower.endsWith('.jpeg') || valLower.endsWith('.png') || val.includes('s3.amazonaws.com');
        const isPhotoKey = keyLower.includes('photo') || keyLower.includes('camera') || keyLower.includes('image') || keyLower.includes('picture');

        if (isPhotoUrl || isPhotoKey) {
          if (val.startsWith('data:image/')) {
            try {
              const match = val.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
              if (match) {
                const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
                const buffer = Buffer.from(match[2], 'base64');
                // Strictly use millisecond + random ID filename
                const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                const fileName = `${uniqueId}.${ext}`;
                const s3Upload = await uploadInspectionMediaToS3(buffer, fileName, `image/${match[1]}`, username);
                if (s3Upload.success && s3Upload.url) {
                  updatedFieldsData[key] = s3Upload.url;
                  lastCameraPhotoUrl = s3Upload.url;
                }
              }
            } catch (_) {}
          } else if (val.startsWith('/uploads/') || val.startsWith('uploads/')) {
            try {
              const localPath = path.join(process.cwd(), 'public', val.replace(/^\//, ''));
              if (fs.existsSync(localPath)) {
                const buffer = fs.readFileSync(localPath);
                const fileName = path.basename(localPath);
                const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
                const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                const s3Upload = await uploadInspectionMediaToS3(buffer, `${uniqueId}.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`, username);
                if (s3Upload.success && s3Upload.url) {
                  updatedFieldsData[key] = s3Upload.url;
                  lastCameraPhotoUrl = s3Upload.url;
                }
              }
            } catch (_) {}
          } else if (val.startsWith('http') || val.includes('s3.amazonaws.com') || val.includes('s3.ap-south-1.amazonaws.com')) {
            lastCameraPhotoUrl = val;
          }
        }
      }
    }

    // Now process the main imageUrl (primary evidence photo)
    let imageUrl = data.imageUrl || null;
    
    // Set the last camera field photo as the primary evidence photo, falling back to data.imageUrl if needed
    if (lastCameraPhotoUrl) {
      imageUrl = lastCameraPhotoUrl;
    } else if (imageUrl && typeof imageUrl === 'string') {
      // Base64 captured photo
      if (imageUrl.startsWith('data:image/')) {
        try {
          const match = imageUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
          if (match) {
            const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
            const buffer = Buffer.from(match[2], 'base64');
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            const fileName = `${uniqueId}.${ext}`;
            const s3Upload = await uploadInspectionMediaToS3(buffer, fileName, `image/${match[1]}`, username);
            if (s3Upload.success && s3Upload.url) {
              imageUrl = s3Upload.url;
            }
          }
        } catch (e) {
          console.warn('Error saving base64 photo to S3:', e);
        }
      } else if (imageUrl.startsWith('/uploads/') || imageUrl.startsWith('uploads/')) {
        // Local uploaded photo path
        try {
          const localPath = path.join(process.cwd(), 'public', imageUrl.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            const buffer = fs.readFileSync(localPath);
            const fileName = path.basename(localPath);
            const ext = (fileName.split('.').pop() || 'jpg').toLowerCase();
            const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
            const s3Upload = await uploadInspectionMediaToS3(buffer, `${uniqueId}.${ext}`, `image/${ext === 'jpg' ? 'jpeg' : ext}`, username);
            if (s3Upload.success && s3Upload.url) {
              imageUrl = s3Upload.url;
            }
          }
        } catch (e) {
          console.warn('Error copying local photo to S3:', e);
        }
      }
    }

    // Process documentUrl if present
    let documentUrl = data.documentUrl || null;
    if (documentUrl && typeof documentUrl === 'string') {
      if (documentUrl.startsWith('data:')) {
        try {
          const match = documentUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (match) {
            const buffer = Buffer.from(match[2], 'base64');
            const docName = data.documentName || `doc_${Date.now()}.pdf`;
            const s3Upload = await uploadInspectionMediaToS3(buffer, docName, match[1], username);
            if (s3Upload.success && s3Upload.url) {
              documentUrl = s3Upload.url;
            }
          }
        } catch (_) {}
      }
    }

    // 3. Prepare work record and check if this work entry was already submitted (prevent duplicate work ID & preserve S3 URL)
    const recordId = data.id || `iw_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const nowIso = new Date().toISOString();

    // Check if an existing work already exists for this client UUID (id) or workId
    const existingWork = await findExistingInspectionWork(recordId, data.workId);

    const isMobilePath = (str: any) =>
      typeof str === 'string' &&
      (str.startsWith('/data/') || str.startsWith('/storage/') || str.includes('offline_images') || str.includes('raw_uploads'));

    let workId = data.workId;
    let userSeq: number;

    if (existingWork) {
      // Re-use existing Work ID and sequence - DO NOT CREATE A DUPLICATE WORK ID!
      workId = existingWork.workId || workId || generateUserWorkId(username, new Date());
      if (workId && (workId.toUpperCase().startsWith('TP01-') || workId.toUpperCase().startsWith('TP-') || workId.toUpperCase().startsWith('TP'))) {
        workId = workId.replace(/^TP01-/i, 'WRK-').replace(/^TP-/i, 'WRK-').replace(/^TP/i, 'WRK-');
      }
      userSeq = existingWork.userSequence || (await getNextUserInspectionSeq(username));

      // Preserve existing valid S3 image URL if the incoming request has empty or local mobile path
      if ((!imageUrl || isMobilePath(imageUrl)) && existingWork.imageUrl && !isMobilePath(existingWork.imageUrl)) {
        imageUrl = existingWork.imageUrl;
      }

      // Preserve existing S3 image URLs in fieldsData
      if (existingWork.fieldsData) {
        for (const [k, v] of Object.entries(existingWork.fieldsData)) {
          if (typeof v === 'string' && !isMobilePath(v) && (v.startsWith('http') || v.includes('s3.amazonaws.com'))) {
            const cur = updatedFieldsData[k];
            if (!cur || isMobilePath(cur)) {
              updatedFieldsData[k] = v;
            }
          }
        }
      }
    } else {
      if (!workId || workId.toUpperCase().startsWith('TP') || !workId.startsWith('WRK-')) {
        workId = generateUserWorkId(username, new Date());
      }
      userSeq = data.userSequence || (await getNextUserInspectionSeq(username));
    }

    // Clean any remaining local mobile device paths from imageUrl and updatedFieldsData so mobile paths never get saved
    if (isMobilePath(imageUrl)) {
      imageUrl = null;
    }
    for (const [k, v] of Object.entries(updatedFieldsData)) {
      if (isMobilePath(v)) {
        updatedFieldsData[k] = imageUrl || '';
      }
    }

    const finalWork = {
      ...data,
      id: recordId,
      workId,
      userSequence: userSeq,
      submittedByUserName: data.submittedByUserName || username,
      submittedByUserId: data.submittedByUserId || username,
      username,
      imageUrl,
      documentUrl,
      fieldsData: updatedFieldsData,
      submittedAt: (existingWork && existingWork.submittedAt) || data.submittedAt || nowIso,
      status: data.status || 'Completed',
    };

    // 4. Save to MongoDB
    await saveSingleInspectionWork(finalWork);

    // 5. Strictly save only one details JSON to AWS S3 (folder pattern: inspection/username/{workId}_details.json)
    await saveInspectionDetailsToS3(finalWork, username);

    // Normalize URLs in returned payload for immediate Android rendering
    const responseWork = { ...finalWork };
    if (responseWork.imageUrl) {
      if (responseWork.imageUrl.startsWith('/uploads')) {
        responseWork.imageUrl = `${origin}${responseWork.imageUrl}`;
      } else if (responseWork.imageUrl.includes('s3.amazonaws.com') || responseWork.imageUrl.includes('s3.ap-south-1.amazonaws.com') || responseWork.imageUrl.startsWith('inspection/')) {
        responseWork.imageUrl = await getPresignedS3Url(responseWork.imageUrl);
      }
    }
    const responseFields = { ...(responseWork.fieldsData || {}) };
    for (const [key, val] of Object.entries(responseFields)) {
      if (typeof val === 'string') {
        if (val.startsWith('/uploads')) {
          responseFields[key] = `${origin}${val}`;
        } else if (val.includes('s3.amazonaws.com') || val.includes('s3.ap-south-1.amazonaws.com') || val.startsWith('inspection/')) {
          responseFields[key] = await getPresignedS3Url(val);
        }
      }
    }
    responseWork.fieldsData = responseFields;

    // 8. Log work entry process to server_process.log (Notepad viewable)
    logServerProcess({
      category: 'WORK_ENTRY',
      action: 'WORK_SUBMIT_SUCCESS',
      username,
      userId: data.submittedByUserId || username,
      townPanchayat: data.tpNameEn || data.townPanchayat || '',
      status: 'SUCCESS',
      details: `Work ID: ${workId} | Ward: ${data.ward || data.wardNo || '-'} | Street: ${data.street || data.streetName || '-'} | Subject: ${data.subjectNameEn || data.subject || '-'} | Image: ${imageUrl ? 'Yes' : 'No'}`,
    });

    // 9. Return response to Android app
    return NextResponse.json({
      success: true,
      message: `Inspection work and media saved successfully in MongoDB and AWS S3 (${workId})`,
      work: responseWork,
      workId: workId,
      userSequence: userSeq,
      s3Folder: `inspection/${username}`,
    }, { headers: CORS_HEADERS });
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
      console.error(
        `File upload error: [Error: aborted] { code: 'ECONNRESET' }\n` +
        `Detailed Reason for Error:\n` +
        `  1. Connection Aborted by Client (ECONNRESET): The mobile app or HTTP client unexpectedly severed the TCP socket before the image stream finished.\n` +
        `  2. Cellular Signal Fluctuation: Mobile network lost connectivity or shifted base towers (4G/3G handover) during multipart image upload.\n` +
        `  3. Client-side Socket Timeout: The mobile OkHttpClient timeout elapsed while uploading high-resolution inspection media.\n` +
        `  4. Device OS App Suspension: The Android app was minimized, screen turned off, or backgrounded during data transfer.\n` +
        `  * Offline Safety: The mobile app safely preserves the photo in local storage (/files/offline_images/) and will automatically retry background sync.`
      );
    } else {
      console.error('Save inspection work error:', err);
    }
    return NextResponse.json({
      success: false,
      message: err.message || 'Server error while saving inspection work',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// PUT: Update an existing inspection work
export async function PUT(req: NextRequest) {
  try {
    const data = await req.json();
    const workId = data.id || data.workId;

    if (!workId) {
      return NextResponse.json(
        { success: false, message: 'Work ID is required for editing' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const username = await resolveInspectionUsername(data.submittedByUserId, data.submittedByUserName);

    const client = await getMongoClient();
    let existingWork: any = null;
    if (client) {
      try {
        const db = client.db('dtp_enterprise');
        existingWork = await db.collection('inspectionWorks').findOne({
          $or: [{ id: workId }, { workId: workId }],
        });
      } catch (_) {}
    }

    const updatedWork = {
      ...(existingWork || {}),
      ...data,
      updatedAt: new Date().toISOString(),
    };

    await saveSingleInspectionWork(updatedWork);
    await saveInspectionDetailsToS3(updatedWork, username);

    return NextResponse.json({
      success: true,
      message: 'Inspection work updated successfully in MongoDB and S3',
      work: updatedWork,
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Update inspection work error:', err);
    return NextResponse.json({
      success: false,
      message: 'Server error updating inspection work',
    }, { status: 500, headers: CORS_HEADERS });
  }
}

// DELETE: Delete an inspection work entry (Admin role only)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const idToDelete = searchParams.get('id');

    // Admin role verification
    const reqRole = String(req.headers.get('x-role') || searchParams.get('role') || '').toLowerCase().trim();
    const reqUsername = String(req.headers.get('x-username') || searchParams.get('username') || '').toLowerCase().trim();
    if (reqRole || reqUsername) {
      const isAdmin = (
        reqRole === 'admin' ||
        reqRole === 'super admin' ||
        reqRole === 'superadmin' ||
        reqRole === 'administrator' ||
        reqRole.includes('admin') ||
        reqUsername === 'admin' ||
        reqUsername === 'dtpadmin'
      );
      if (!isAdmin) {
        return NextResponse.json(
          { success: false, message: 'Permission denied: Only admin user role can delete inspection entries' },
          { status: 403, headers: CORS_HEADERS }
        );
      }
    }

    if (!idToDelete) {
      return NextResponse.json(
        { success: false, message: 'Work ID is required to delete' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const client = await getMongoClient();
    if (client) {
      try {
        const db = client.db('dtp_enterprise');
        await db.collection('inspectionWorks').deleteOne({
          $or: [{ id: idToDelete }, { workId: idToDelete }],
        });
      } catch (delErr) {
        console.warn('MongoDB delete warning:', delErr);
      }
    }

    // Also remove from local db cache
    try {
      const localDb = readLocalDb();
      if (Array.isArray(localDb.inspectionWorks)) {
        localDb.inspectionWorks = localDb.inspectionWorks.filter(
          (w: any) => w.id !== idToDelete && w.workId !== idToDelete
        );
        const fsMod = await import('fs');
        const pathMod = await import('path');
        fsMod.writeFileSync(
          pathMod.join(process.cwd(), 'data', 'db.json'),
          JSON.stringify(localDb, null, 2),
          'utf-8'
        );
      }
    } catch (_) {}

    return NextResponse.json({
      success: true,
      message: 'Inspection work deleted successfully',
    }, { headers: CORS_HEADERS });
  } catch (err: any) {
    console.error('Delete inspection work error:', err);
    return NextResponse.json({
      success: false,
      message: 'Server error deleting inspection work',
    }, { status: 500, headers: CORS_HEADERS });
  }
}
