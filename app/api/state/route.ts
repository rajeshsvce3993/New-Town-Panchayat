import { NextRequest, NextResponse } from 'next/server';
import {
  getCollectionData,
  saveCollectionData,
  getAppSettings,
  saveAppSettings,
  saveSingleInspectionWork,
  getFullDatabaseState,
  rebuildUserScopeCache,
} from '@/lib/storage';
import { invalidateAndRefreshUserScopeCache } from '@/lib/userScopeCache';
import { logServerProcess } from '@/lib/serverLogger';

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

let cachedFullState: { data: any; timestamp: number } | null = null;
const STATE_CACHE_TTL_MS = 60000; // 60s fast server-side cache

async function runDataStructureDiagnostics() {
  const diagnosticLogs: string[] = [];
  const log = (msg: string) => {
    diagnosticLogs.push(msg);
  };

  log('=== STARTING DATA STRUCTURE DIAGNOSTIC RUN ===');

  try {
    const [subjects, categories, streets] = await Promise.all([
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('wardsAndStreets'),
    ]);

    const sList = subjects || [];
    const cList = categories || [];
    const stList = streets || [];

    log(`Counts fetched -> Subjects: ${sList.length}, Categories: ${cList.length}, Streets: ${stList.length}`);

    // Validate Subjects
    let validSubjectsCount = 0;
    const invalidSubjects: any[] = [];
    const subjectIds = new Set<string>();

    sList.forEach((s: any, idx: number) => {
      const hasId = !!s.id;
      const hasNameEn = !!s.nameEn;
      const hasNameTa = !!s.nameTa;
      const hasCode = !!s.code;

      if (hasId && hasNameEn) {
        validSubjectsCount++;
        subjectIds.add(String(s.id));
      } else {
        invalidSubjects.push({ index: idx, id: s.id, nameEn: s.nameEn, code: s.code, hasId, hasNameEn, hasNameTa, hasCode });
      }
    });

    log(`Subjects Mapped Correctly: ${validSubjectsCount}/${sList.length}`);
    if (invalidSubjects.length > 0) {
      log(`⚠️ WARNING: ${invalidSubjects.length} subjects have incomplete mappings: ${JSON.stringify(invalidSubjects.slice(0, 5))}`);
    } else {
      log(`✅ All subjects are fully populated and mapped correctly.`);
    }

    // Validate Categories
    let validCategoriesCount = 0;
    const invalidCategories: any[] = [];
    const orphanedCategories: any[] = [];

    cList.forEach((c: any, idx: number) => {
      const hasId = !!c.id;
      const hasSubjectId = !!c.subjectId;
      const hasNameEn = !!c.nameEn;
      const isSubjectReferencedValid = hasSubjectId && subjectIds.has(String(c.subjectId));

      if (hasId && hasNameEn && hasSubjectId) {
        validCategoriesCount++;
        if (!isSubjectReferencedValid) {
          orphanedCategories.push({ id: c.id, nameEn: c.nameEn, subjectId: c.subjectId });
        }
      } else {
        invalidCategories.push({ index: idx, id: c.id, nameEn: c.nameEn, subjectId: c.subjectId, hasId, hasNameEn, hasSubjectId });
      }
    });

    log(`Categories Mapped Correctly: ${validCategoriesCount}/${cList.length}`);
    if (invalidCategories.length > 0) {
      log(`⚠️ WARNING: ${invalidCategories.length} categories have incomplete mappings: ${JSON.stringify(invalidCategories.slice(0, 5))}`);
    } else {
      log(`✅ All categories are fully populated and mapped correctly.`);
    }

    if (orphanedCategories.length > 0) {
      log(`⚠️ WARNING: ${orphanedCategories.length} categories refer to a non-existent subject ID: ${JSON.stringify(orphanedCategories.slice(0, 5))}`);
    } else {
      log(`✅ No orphaned categories found.`);
    }

    // Validate Streets
    let validStreetsCount = 0;
    const invalidStreets: any[] = [];
    const streetsByTp: Record<string, number> = {};

    stList.forEach((w: any, idx: number) => {
      const hasId = !!w.id;
      const hasTpId = !!w.tpId;
      const hasWardNo = !!w.wardNo;
      const hasStreetNameEn = !!w.streetNameEn;

      if (hasId && hasTpId && hasWardNo && hasStreetNameEn) {
        validStreetsCount++;
        const tp = String(w.tpId);
        streetsByTp[tp] = (streetsByTp[tp] || 0) + 1;
      } else {
        invalidStreets.push({ index: idx, id: w.id, tpId: w.tpId, wardNo: w.wardNo, streetNameEn: w.streetNameEn, hasId, hasTpId, hasWardNo, hasStreetNameEn });
      }
    });

    log(`Streets Mapped Correctly: ${validStreetsCount}/${stList.length}`);
    log(`Streets Distribution by Town Panchayat: ${JSON.stringify(streetsByTp)}`);
    if (invalidStreets.length > 0) {
      log(`⚠️ WARNING: ${invalidStreets.length} streets have incomplete mappings: ${JSON.stringify(invalidStreets.slice(0, 5))}`);
    } else {
      log(`✅ All streets are fully populated and mapped correctly.`);
    }

    log('=== END OF DATA STRUCTURE DIAGNOSTIC RUN ===');

    return {
      success: true,
      timestamp: new Date().toISOString(),
      databaseMode: sList.length > 0 ? "Connected / Hydrated" : "Empty / Local Fallback",
      summary: {
        subjects: { total: sList.length, valid: validSubjectsCount, invalid: invalidSubjects },
        categories: { total: cList.length, valid: validCategoriesCount, invalid: invalidCategories, orphaned: orphanedCategories },
        streets: { total: stList.length, valid: validStreetsCount, invalid: invalidStreets, distributionByTp: streetsByTp }
      },
      sampleData: {
        subjectSample: sList.slice(0, 2),
        categorySample: cList.slice(0, 2),
        streetSample: stList.slice(0, 2)
      },
      logs: diagnosticLogs
    };

  } catch (err: any) {
    log(`❌ ERROR RUNNING DIAGNOSTICS: ${err.message}`);
    return {
      success: false,
      timestamp: new Date().toISOString(),
      error: err.message,
      logs: diagnosticLogs
    };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const key = searchParams.get('key');
    const isDiagnosticRequest = key === 'diagnostic' || searchParams.get('diagnostic') === 'true';

    // Handle manual cache purge request
    const shouldRebuildCache = key === 'rebuildCache' || searchParams.get('rebuildCache') === 'true';
    if (shouldRebuildCache) {
      const success = await rebuildUserScopeCache();
      return NextResponse.json({ success, message: 'User scope cache cleared and dropped. Live dynamic loading is active.' }, { headers: CORS_HEADERS });
    }

    if (isDiagnosticRequest) {
      const diagReport = await runDataStructureDiagnostics();
      return NextResponse.json({ success: true, diagnostics: diagReport }, { headers: CORS_HEADERS });
    }

    if (key === 'settings') {
      const settings = await getAppSettings();
      return NextResponse.json({ success: true, data: settings }, { headers: CORS_HEADERS });
    }

    if (key) {
      const data = await getCollectionData(key as any);
      return NextResponse.json({ success: true, data }, { headers: CORS_HEADERS });
    }

    const forceFresh = searchParams.get('fresh') === 'true';
    if (!forceFresh && cachedFullState && (Date.now() - cachedFullState.timestamp) < STATE_CACHE_TTL_MS) {
      return NextResponse.json({ success: true, data: cachedFullState.data, cached: true }, { headers: CORS_HEADERS });
    }

    // Return the full database state from MongoDB
    const fullState = await getFullDatabaseState();
    cachedFullState = { data: fullState, timestamp: Date.now() };
    return NextResponse.json({ success: true, data: fullState }, { headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(req: NextRequest) {
  try {
    cachedFullState = null; // Instantly invalidate server cache on any update
    const body = await req.json();
    const { action, key, data, skipCacheRebuild } = body;

    if (key === 'settings') {
      await saveAppSettings(data);
      logServerProcess({
        category: 'MASTER_UPDATE',
        action: 'UPDATE_SETTINGS',
        status: 'SUCCESS',
        details: 'System settings updated',
      });
      return NextResponse.json({ success: true, message: 'Settings saved' }, { headers: CORS_HEADERS });
    }

    if (key === 'inspectionWorks') {
      await saveSingleInspectionWork(data);
      logServerProcess({
        category: 'WORK_ENTRY',
        action: 'WORK_SAVED_DIRECT',
        status: 'SUCCESS',
        details: `Inspection work saved directly (${data?.id || 'unknown'})`,
      });
      return NextResponse.json({ success: true, message: 'Inspection work saved directly' }, { headers: CORS_HEADERS });
    }

    if (key && Array.isArray(data)) {
      await saveCollectionData(key, data, !!skipCacheRebuild);
      // As requested: Immediately refresh user_scope_cache and update 1KB version file!
      invalidateAndRefreshUserScopeCache(`master_${key}_saved`).catch((e) => console.error('[State] Refresh scope error:', e));
      logServerProcess({
        category: 'MASTER_UPDATE',
        action: `UPDATE_${key.toUpperCase()}`,
        status: 'SUCCESS',
        details: `Saved ${data.length} records into collection '${key}'`,
      });
      return NextResponse.json({ success: true, message: `${key} saved directly to database` }, { headers: CORS_HEADERS });
    }

    return NextResponse.json({ success: false, message: 'Invalid payload' }, { status: 400, headers: CORS_HEADERS });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500, headers: CORS_HEADERS });
  }
}
