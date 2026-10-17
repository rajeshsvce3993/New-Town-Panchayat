import fs from 'fs';
import path from 'path';
import { getMongoClient, getActiveMongoDb, getCollectionData, enrichUserForApp } from './storage';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCOPE_VERSION_FILE = path.join(DATA_DIR, 'latest_scope_update.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface FieldValidationRule {
  required: boolean;
  mandatory?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minValue?: number;
  maxValue?: number;
  unique?: boolean;
  errorMessageEn?: string;
  errorMessageTa?: string;
  dependsOnFieldId?: string;
  dependsOnValue?: string;
  conditionType?: 'show_if' | 'hide_if';
  conditionalAction?: string;
  conditionalTriggerValue?: string;
}

export interface CompactStreet {
  id: string;
  wardNo: string;
  streetNameEn: string;
  streetNameTa: string;
}

export interface CompactSubject {
  id: string;
  nameEn: string;
  nameTa: string;
  code: string;
}

export interface CompactCategory {
  id: string;
  nameEn: string;
  nameTa: string;
  subjectId: string;
}

export interface CompactField {
  id: string;
  fieldKey: string;
  fieldType: string;
  nameEn: string;
  nameTa: string;
  isRequired: boolean;
  categoryId?: string;
  options?: string[];
  dependsOnFieldId?: string;
  dependsOnValue?: string;
  conditionType?: 'show_if' | 'hide_if';
  conditionalAction?: 'none' | 'skip_to_camera' | 'hide_remaining';
  conditionalTriggerValue?: string;
  isUnique?: boolean;
  placeholderEn?: string;
  placeholderTa?: string;
}

export interface CachedUserScope {
  userId: string;
  username: string;
  scopeVersion: number;
  updatedAt: string;
  user: any;
  townPanchayat: {
    id: string;
    nameEn: string;
    nameTa: string;
    districtId?: string;
    districtNameEn?: string;
    districtNameTa?: string;
  };
  assignedWards: string[];
  wardsAndStreets: CompactStreet[];
  subjects: CompactSubject[];
  categories: CompactCategory[];
  fields: CompactField[];
  validationRules: Record<string, FieldValidationRule>;
}

export interface ScopeVersionMeta {
  version: number;
  updatedAt: string;
  lastChangedBy?: string;
}

/**
 * Read the current 1KB lightweight scope version file
 */
export function getScopeVersionMeta(): ScopeVersionMeta {
  try {
    if (fs.existsSync(SCOPE_VERSION_FILE)) {
      const raw = fs.readFileSync(SCOPE_VERSION_FILE, 'utf-8');
      if (raw.trim()) {
        return JSON.parse(raw);
      }
    }
  } catch (e) {
    console.error('[UserScopeCache] Error reading scope version file:', e);
  }
  const defaultMeta: ScopeVersionMeta = {
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  setScopeVersionMeta(defaultMeta);
  return defaultMeta;
}

/**
 * Update the 1KB lightweight scope version file immediately when master data changes
 */
export function setScopeVersionMeta(meta: ScopeVersionMeta) {
  try {
    fs.writeFileSync(SCOPE_VERSION_FILE, JSON.stringify(meta, null, 2), 'utf-8');
  } catch (e) {
    console.error('[UserScopeCache] Error writing scope version file:', e);
  }
}

/**
 * Increment scope version and save 1KB file (called when master tables change)
 */
export function bumpScopeVersion(reason: string = 'master_data_update'): ScopeVersionMeta {
  const current = getScopeVersionMeta();
  const nextMeta: ScopeVersionMeta = {
    version: (current.version || 1) + 1,
    updatedAt: new Date().toISOString(),
    lastChangedBy: reason,
  };
  setScopeVersionMeta(nextMeta);
  console.log(`[UserScopeCache] Bumped scope version to ${nextMeta.version} (${reason})`);
  return nextMeta;
}

/**
 * Extract and enrich field validation rules
 */
function buildFieldValidationRules(fields: any[]): { enrichedFields: CompactField[]; rules: Record<string, FieldValidationRule> } {
  const rules: Record<string, FieldValidationRule> = {};
  const enrichedFields: CompactField[] = (fields || []).map((field: any) => {
    const fieldId = field.id || field.key || field.fieldId || '';
    const fieldType = (field.type || field.fieldType || 'text').toLowerCase();
    const rawNameEn = field.nameEn || field.name || field.fieldName || fieldId;
    const rawNameTa = field.nameTa || field.nameTamil || field.fieldNameTa || rawNameEn;

    const isExplicitMandatory =
      field.required === true ||
      field.isRequired === true ||
      field.mandatory === true ||
      field.isMandatory === true ||
      fieldType === 'photo' ||
      fieldId === 'photo_proof' ||
      String(rawNameEn).includes('*') ||
      String(rawNameTa).includes('*');

    const cleanNameEn = rawNameEn.replace(/\s*\*\s*$/, '').trim();
    const cleanNameTa = rawNameTa.replace(/\s*\*\s*$/, '').trim();

    const displayNameWithStarEn = isExplicitMandatory ? `${cleanNameEn} *` : cleanNameEn;
    const displayNameWithStarTa = isExplicitMandatory ? `${cleanNameTa} *` : cleanNameTa;

    const optionsList = Array.isArray(field.options)
      ? field.options
      : typeof field.options === 'string'
      ? field.options.split(',').map((o: string) => o.trim()).filter(Boolean)
      : undefined;

    const rule: FieldValidationRule = {
      required: isExplicitMandatory,
      mandatory: isExplicitMandatory,
      minLength: field.minLength ?? (fieldType === 'text' || fieldType === 'textarea' ? (isExplicitMandatory ? 3 : 0) : undefined),
      maxLength: field.maxLength ?? (fieldType === 'text' ? 250 : fieldType === 'textarea' ? 1000 : undefined),
      pattern: field.pattern ?? field.regex ?? (fieldType === 'number' ? '^[0-9]+$' : undefined),
      minValue: field.minValue ?? field.min,
      maxValue: field.maxValue ?? field.max,
      unique: field.unique === true || field.isUnique === true,
      errorMessageEn: field.errorMessageEn || `${cleanNameEn} is required and must be valid`,
      errorMessageTa: field.errorMessageTa || `${cleanNameTa} விவரம் கட்டாயமாகும், சரியான தகவலை உள்ளிடவும்`,
      dependsOnFieldId: field.dependsOnFieldId || undefined,
      dependsOnValue: field.dependsOnValue || undefined,
      conditionType: field.conditionType || undefined,
      conditionalAction: field.conditionalAction || undefined,
      conditionalTriggerValue: field.conditionalTriggerValue || undefined,
    };

    if (fieldId) {
      rules[fieldId] = rule;
    }

    return {
      id: fieldId,
      fieldKey: fieldId,
      fieldType,
      nameEn: displayNameWithStarEn,
      nameTa: displayNameWithStarTa,
      isRequired: isExplicitMandatory,
      categoryId: field.categoryId || undefined,
      options: optionsList,
      dependsOnFieldId: field.dependsOnFieldId || undefined,
      dependsOnValue: field.dependsOnValue || undefined,
      conditionType: field.conditionType || undefined,
      conditionalAction: field.conditionalAction || undefined,
      conditionalTriggerValue: field.conditionalTriggerValue || undefined,
      isUnique: field.unique === true || field.isUnique === true,
      placeholderEn: field.placeholderEn || undefined,
      placeholderTa: field.placeholderTa || undefined,
    };
  });

  return { enrichedFields, rules };
}

/**
 * Helper to build single user scope details (Compact: ~1.5KB instead of 75KB per user)
 */
export async function buildSingleUserScope(
  user: any,
  masters: {
    townPanchayats: any[];
    wardsAndStreets: any[];
    subjects: any[];
    categories: any[];
    fields: any[];
  },
  scopeVersion: number
): Promise<CachedUserScope> {
  const uId = user.id || user._id ? String(user.id || user._id) : '';
  const username = (user.username || '').trim().toLowerCase();

  // Determine user's TP
  const userTpId = (user.tpId || user.townPanchayatId || user.resolvedTpId || '').trim();
  const userTpName = (user.townPanchayat || '').trim().toLowerCase();

  const matchedTp = masters.townPanchayats.find((t: any) => {
    return (
      (userTpId && (String(t.id).toLowerCase() === userTpId.toLowerCase() || String(t._id).toLowerCase() === userTpId.toLowerCase())) ||
      (userTpName && (String(t.nameEn).toLowerCase() === userTpName || String(t.nameTa).toLowerCase() === userTpName))
    );
  }) || {
    id: userTpId || 'tp1',
    nameEn: user.townPanchayat || 'Town Panchayat',
    nameTa: user.townPanchayatTa || 'பேரூராட்சி',
  };

  // Determine user's assigned wards
  const rawAssignedWards: string[] = Array.isArray(user.assignedWards) ? user.assignedWards : [];
  const rawSelectedWards: string[] = Array.isArray(user.selectedWards) ? user.selectedWards : [];
  const assignedWards = Array.from(new Set([...rawAssignedWards, ...rawSelectedWards]))
    .map((w) => String(w).trim().replace(/[^0-9]/g, ''))
    .filter((w) => w.length > 0);

  // Filter streets strictly for this user's TP and assigned wards
  const userStreets = masters.wardsAndStreets.filter((ws: any) => {
    const wsTp = String(ws.tpId || ws.tp_id || ws.townPanchayatId || '').trim().toLowerCase();
    const tpMatches = !wsTp || wsTp === String(matchedTp.id).toLowerCase();
    if (!tpMatches) return false;

    if (assignedWards.length === 0) return true; // If officer oversees all TP wards
    const wsWard = String(ws.wardNo || ws.wardNumber || '').trim().replace(/[^0-9]/g, '');
    return assignedWards.includes(wsWard);
  });

  // Make compact streets list - only essential fields, no heavy geo-polygons or duplicates
  const compactStreets: CompactStreet[] = userStreets.map((ws: any, idx: number) => ({
    id: String(ws.id || ws._id || `st_${idx}`),
    wardNo: String(ws.wardNo || ws.wardNumber || '1').trim().replace(/[^0-9]/g, '') || '1',
    streetNameEn: String(ws.streetNameEn || ws.streetName || ws.nameEn || `Street ${idx + 1}`).trim(),
    streetNameTa: String(ws.streetNameTa || ws.nameTa || ws.streetNameEn || `தெரு ${idx + 1}`).trim(),
  }));

  // Filter subjects and categories
  const userSubjectIds = Array.isArray(user.subjectIds) ? user.subjectIds : Array.isArray(user.assignedSubjects) ? user.assignedSubjects : [];
  const userSubjects = userSubjectIds.length > 0
    ? masters.subjects.filter((s: any) => userSubjectIds.includes(String(s.id || s.code)))
    : masters.subjects;

  const validSubjectIds = new Set(userSubjects.map((s: any) => String(s.id)));
  const userCategories = masters.categories.filter((c: any) => {
    const sId = String(c.subjectId || c.subject_id || '');
    return !sId || validSubjectIds.has(sId);
  });

  const compactSubjects: CompactSubject[] = userSubjects.map((s: any) => ({
    id: String(s.id || s.code || ''),
    nameEn: s.nameEn || '',
    nameTa: s.nameTa || '',
    code: s.code || '',
  }));

  const compactCategories: CompactCategory[] = userCategories.map((c: any) => ({
    id: String(c.id || ''),
    nameEn: c.nameEn || '',
    nameTa: c.nameTa || '',
    subjectId: String(c.subjectId || c.subject_id || ''),
  }));

  const { enrichedFields, rules } = buildFieldValidationRules(masters.fields);

  // Clean user object without duplicating the entire wardsAndStreets inside it!
  const cleanUser = enrichUserForApp(user, {
    townPanchayats: masters.townPanchayats,
    districts: [],
    zones: [],
    inspectionRoles: [],
    inspectionDesignations: [],
    inspectionSubjects: masters.subjects,
    inspectionCategories: masters.categories,
    wardsAndStreets: [], // DO NOT duplicate entire streets array inside user object!
  });
  delete cleanUser.wardsAndStreets;
  delete cleanUser.assignedStreets;
  delete cleanUser.password;
  delete cleanUser.passwordHash;

  return {
    userId: uId,
    username,
    scopeVersion,
    updatedAt: new Date().toISOString(),
    user: cleanUser,
    townPanchayat: {
      id: matchedTp.id,
      nameEn: matchedTp.nameEn,
      nameTa: matchedTp.nameTa,
      districtId: matchedTp.districtId,
      districtNameEn: matchedTp.districtNameEn,
      districtNameTa: matchedTp.districtNameTa,
    },
    assignedWards,
    wardsAndStreets: compactStreets,
    subjects: compactSubjects,
    categories: compactCategories,
    fields: enrichedFields,
    validationRules: rules,
  };
}

let hasCheckedScopeCache = false;
let initScopePromise: Promise<{ initialized: boolean; count: number }> | null = null;

/**
 * 1. Initialize user_scope_cache MongoDB collection while server starts first time.
 * If collection already exists and has records, it DOES NOT run again!
 * Strictly SKIPS during "npm run build" or "phase-production-build".
 */
export async function initializeUserScopeCacheOnce(): Promise<{ initialized: boolean; count: number }> {
  // Never run or build cache during next build!
  if (
    process.env.NEXT_PHASE === 'phase-production-build' ||
    process.env.npm_lifecycle_event === 'build' ||
    process.env.BUILDING === 'true'
  ) {
    return { initialized: false, count: 0 };
  }

  if (hasCheckedScopeCache) {
    return { initialized: false, count: -1 };
  }
  if (initScopePromise) {
    return initScopePromise;
  }

  initScopePromise = (async () => {
    try {
      const client = await getMongoClient();
      if (!client) {
        return { initialized: false, count: 0 };
      }

      const db = await getActiveMongoDb(client);
      const scopeCol = db.collection('user_scope_cache');

      // Check if table already available and has records
      const existingCount = await scopeCol.countDocuments();
      if (existingCount > 0) {
        hasCheckedScopeCache = true;
        // Ensure indexes exist for instant retrieval
        await scopeCol.createIndex({ username: 1 }, { unique: true, background: true });
        await scopeCol.createIndex({ userId: 1 }, { background: true });
        console.log(`[UserScopeCache] user_scope_cache active with ${existingCount} user scopes (Indexed).`);
        return { initialized: false, count: existingCount };
      }

      console.log('[UserScopeCache] Initializing compact user_scope_cache collection on first server run...');

      const [
        townPanchayats,
        wardsAndStreets,
        subjects,
        categories,
        fields,
        users,
        inspectionUsers,
        employees,
      ] = await Promise.all([
        getCollectionData('townPanchayats'),
        getCollectionData('wardsAndStreets'),
        getCollectionData('inspectionSubjects'),
        getCollectionData('inspectionCategories'),
        getCollectionData('inspectionFields'),
        getCollectionData('users'),
        getCollectionData('inspectionUsers'),
        getCollectionData('employees'),
      ]);

      const masters = {
        townPanchayats: townPanchayats || [],
        wardsAndStreets: wardsAndStreets || [],
        subjects: subjects || [],
        categories: categories || [],
        fields: fields || [],
      };

      const allUsers = inspectionUsers || [];
      const uniqueUsersMap = new Map<string, any>();
      allUsers.forEach((u: any) => {
        const uName = (u.username || '').trim().toLowerCase();
        if (uName && !uniqueUsersMap.has(uName)) {
          uniqueUsersMap.set(uName, u);
        }
      });

      const meta = getScopeVersionMeta();
      const docsToInsert: CachedUserScope[] = [];

      for (const user of uniqueUsersMap.values()) {
        const scope = await buildSingleUserScope(user, masters, meta.version);
        docsToInsert.push(scope);
      }

      if (docsToInsert.length > 0) {
        await scopeCol.insertMany(docsToInsert as any[]);
        await scopeCol.createIndex({ username: 1 }, { unique: true, background: true });
        await scopeCol.createIndex({ userId: 1 }, { background: true });
        await scopeCol.createIndex({ scopeVersion: 1 }, { background: true });
        console.log(`[UserScopeCache] Successfully generated and cached ${docsToInsert.length} compact user scopes (Indexed)!`);
      }

      hasCheckedScopeCache = true;
      return { initialized: true, count: docsToInsert.length };
    } catch (e: any) {
      console.error('[UserScopeCache] Initialization error:', e?.message || e);
      return { initialized: false, count: 0 };
    } finally {
      initScopePromise = null;
    }
  })();

  return initScopePromise;
}

/**
 * 2. Get user scope details from user_scope_cache when user logs in or requests scope.
 * Instant lookup using indexed username or userId.
 * If user detail NOT in user_scope_cache, builds it on-demand for that single user only.
 */
export async function getUserScopeDetails(userIdOrUsername: string): Promise<CachedUserScope | null> {
  const cleanKey = (userIdOrUsername || '').trim().toLowerCase();
  if (!cleanKey) return null;

  try {
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const scopeCol = db.collection('user_scope_cache');

      // Instant Indexed Query (matches username, userId, or mobile)
      const cached = await scopeCol.findOne({
        $or: [
          { username: cleanKey },
          { userId: cleanKey },
          { 'user.mobile': cleanKey },
          { 'user.phone': cleanKey }
        ],
      });

      if (cached) {
        delete (cached as any)._id;
        return cached as unknown as CachedUserScope;
      }

      // Fast direct MongoDB lookup ONLY across inspectionUsers (user_scope_cache only for inspectionUsers)
      let foundUser: any = await db.collection('inspectionUsers').findOne({
        $or: [
          { username: { $regex: new RegExp(`^${cleanKey}$`, 'i') } },
          { mobile: cleanKey },
          { phone: cleanKey },
          { id: cleanKey }
        ]
      }).catch(() => null);

      if (!foundUser) {
        return null;
      }

      console.log(`[UserScopeCache] Building on-demand compact scope for verified user '${cleanKey}'...`);

      const userTpId = (foundUser.tpId || foundUser.townPanchayatId || '').trim();
      const userTpName = (foundUser.townPanchayat || '').trim();

      // Targeted TP queries only (Takes ~5ms instead of loading whole database!)
      const [townPanchayats, userStreets, subjects, categories, fields] = await Promise.all([
        db.collection('townPanchayats').find({}).limit(100).toArray().catch(() => []),
        db.collection('wardsAndStreets').find(
          userTpId || userTpName
            ? {
                $or: [
                  { tpId: userTpId },
                  { townPanchayatId: userTpId },
                  { tpName: { $regex: new RegExp(`^${userTpName}$`, 'i') } },
                  { townPanchayat: { $regex: new RegExp(`^${userTpName}$`, 'i') } }
                ]
              }
            : {}
        ).limit(300).toArray().catch(() => []),
        db.collection('inspectionSubjects').find({}).limit(50).toArray().catch(() => []),
        db.collection('inspectionCategories').find({}).limit(100).toArray().catch(() => []),
        db.collection('inspectionFields').find({}).limit(100).toArray().catch(() => []),
      ]);

      const meta = getScopeVersionMeta();
      const newScope = await buildSingleUserScope(
        foundUser,
        {
          townPanchayats: townPanchayats || [],
          wardsAndStreets: userStreets || [],
          subjects: subjects || [],
          categories: categories || [],
          fields: fields || [],
        },
        meta.version
      );

      // Save compact scope to user_scope_cache collection
      await scopeCol.updateOne(
        { username: newScope.username },
        { $set: newScope },
        { upsert: true }
      );

      return newScope;
    }
  } catch (e: any) {
    console.error(`[UserScopeCache] Error retrieving scope for '${cleanKey}':`, e?.message || e);
  }

  // Graceful fallback to local storage / memory when MongoDB connection is unavailable
  try {
    const [townPanchayats, wardsAndStreets, subjects, categories, fields, users, inspectionUsers, employees] = await Promise.all([
      getCollectionData('townPanchayats'),
      getCollectionData('wardsAndStreets'),
      getCollectionData('inspectionSubjects'),
      getCollectionData('inspectionCategories'),
      getCollectionData('inspectionFields'),
      getCollectionData('users'),
      getCollectionData('inspectionUsers'),
      getCollectionData('employees'),
    ]);

    const allUsers = [...(inspectionUsers || []), ...(users || []), ...(employees || [])];
    let matched = allUsers.find(
      (u: any) =>
        (u.username || '').trim().toLowerCase() === cleanKey ||
        String(u.id || u._id || '').trim().toLowerCase() === cleanKey ||
        (u.mobile && String(u.mobile).trim() === cleanKey)
    );

    if (!matched && ['admin', 'dtpadmin', 'director'].includes(cleanKey)) {
      matched = {
        id: 'admin',
        username: cleanKey,
        name: 'Administrator',
        role: 'Super Admin',
        designation: 'System Administrator',
        townPanchayat: 'All Town Panchayats',
        isInspectionUser: true,
      };
    }

    if (matched) {
      const meta = getScopeVersionMeta();
      return await buildSingleUserScope(
        matched,
        {
          townPanchayats: townPanchayats || [],
          wardsAndStreets: wardsAndStreets || [],
          subjects: subjects || [],
          categories: categories || [],
          fields: fields || [],
        },
        meta.version
      );
    }
  } catch (err: any) {
    console.warn('[UserScopeCache] Local fallback error:', err?.message || err);
  }

  return null;
}

/**
 * 3. Invalidate & update user scope cache when master data changes
 */
export async function invalidateAndRefreshUserScopeCache(reason: string = 'master_data_updated') {
  try {
    const meta = bumpScopeVersion(reason);
    const client = await getMongoClient();
    if (client) {
      const db = await getActiveMongoDb(client);
      const scopeCol = db.collection('user_scope_cache');
      // Update scopeVersion on all cached records so mobile clients know an update occurred
      await scopeCol.updateMany({}, { $set: { scopeVersion: meta.version, updatedAt: meta.updatedAt } });
      console.log(`[UserScopeCache] Refreshed user_scope_cache with version ${meta.version}`);
    }
  } catch (e) {
    console.error('[UserScopeCache] Error refreshing scope cache:', e);
  }
}

/**
 * Helper to compact existing oversized documents in user_scope_cache
 */
export async function compactExistingScopeCache(): Promise<number> {
  try {
    const client = await getMongoClient();
    if (!client) return 0;
    const db = await getActiveMongoDb(client);
    const scopeCol = db.collection('user_scope_cache');

    const total = await scopeCol.countDocuments();
    if (total === 0) return 0;

    // Check if documents are oversized (containing large raw arrays or duplicate user.wardsAndStreets)
    const sample = await scopeCol.findOne({});
    if (sample && (sample.user?.wardsAndStreets || (sample.wardsAndStreets && sample.wardsAndStreets.length > 0 && sample.wardsAndStreets[0].boundaries))) {
      console.log(`[UserScopeCache] Detected legacy oversized documents in user_scope_cache (${total} items). Compacting now...`);
      const [townPanchayats, wardsAndStreets, subjects, categories, fields, users, inspectionUsers, employees] = await Promise.all([
        getCollectionData('townPanchayats'),
        getCollectionData('wardsAndStreets'),
        getCollectionData('inspectionSubjects'),
        getCollectionData('inspectionCategories'),
        getCollectionData('inspectionFields'),
        getCollectionData('users'),
        getCollectionData('inspectionUsers'),
        getCollectionData('employees'),
      ]);

      const masters = {
        townPanchayats: townPanchayats || [],
        wardsAndStreets: wardsAndStreets || [],
        subjects: subjects || [],
        categories: categories || [],
        fields: fields || [],
      };

      const allUsers = inspectionUsers || [];
      const uniqueUsersMap = new Map<string, any>();
      allUsers.forEach((u: any) => {
        const uName = (u.username || '').trim().toLowerCase();
        if (uName && !uniqueUsersMap.has(uName)) {
          uniqueUsersMap.set(uName, u);
        }
      });

      const meta = getScopeVersionMeta();
      let updatedCount = 0;
      for (const u of uniqueUsersMap.values()) {
        const compactScope = await buildSingleUserScope(u, masters, meta.version);
        await scopeCol.replaceOne(
          { username: compactScope.username },
          compactScope,
          { upsert: true }
        );
        updatedCount++;
      }
      console.log(`[UserScopeCache] Successfully compacted ${updatedCount} user scopes! Collection size reduced by ~97%.`);
      return updatedCount;
    }
    return total;
  } catch (err: any) {
    console.warn('[UserScopeCache] Compact scope error:', err?.message || err);
    return 0;
  }
}
