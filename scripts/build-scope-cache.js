/**
 * Build-time script to check and sync user_scope_cache in MongoDB
 * Run automatically during 'npm run build':
 * "build": "next build && node scripts/build-scope-cache.js"
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Read config
function getStorageConfig() {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(dataFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      if (parsed.settings) return parsed.settings;
    }
  } catch (_) {}
  return {
    mongodbUri: 'mongodb://localhost:27018/dtp_enterprise',
  };
}

// Read scope version meta
function getScopeVersion() {
  try {
    const versionFile = path.join(process.cwd(), 'data', 'latest_scope_update.json');
    if (fs.existsSync(versionFile)) {
      const meta = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
      if (meta && meta.version) return meta.version;
    }
  } catch (_) {}
  return 1;
}

async function runBuildScopeCache() {
  console.log('\n======================================================');
  console.log('📦 [BUILD SCOPE CACHE] Checking user_scope_cache in MongoDB...');
  console.log('======================================================');

  const config = getStorageConfig();
  let uri = process.env.MONGODB_URI || config.mongodbUri || 'mongodb://localhost:27018/dtp_enterprise';

  let client;
  try {
    const isLocal = uri.includes('localhost') || uri.includes('127.0.0.1');
    try {
      client = new MongoClient(uri, {
        serverSelectionTimeoutMS: isLocal ? 3000 : 8000,
        connectTimeoutMS: isLocal ? 3000 : 8000,
        maxPoolSize: 10,
      });
      await client.connect();
    } catch (err) {
      if (isLocal && uri.includes('27018')) {
        console.log('> Port 27018 not responding, trying standard MongoDB port 27017...');
        uri = uri.replace('27018', '27017');
        client = new MongoClient(uri, {
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000,
          maxPoolSize: 10,
        });
        await client.connect();
      } else {
        throw err;
      }
    }

    // Detect target DB
    let dbName = 'dtp_enterprise';
    try {
      const dbs = await client.db().admin().listDatabases();
      const targetDb = dbs.databases.find(d => ['dtp_enterprise', 'dtp_clean_prod', 'townpanchayat_ems'].includes(d.name));
      if (targetDb) dbName = targetDb.name;
    } catch (_) {}

    const db = client.db(dbName);
    console.log(`Connected to database "${dbName}" ✅`);

    // 1. Fetch all master users from inspectionUsers, users, and employees
    const [inspUsers, webUsers, employees] = await Promise.all([
      db.collection('inspectionUsers').find({}).toArray().catch(() => []),
      db.collection('users').find({}).toArray().catch(() => []),
      db.collection('employees').find({}).toArray().catch(() => []),
    ]);

    const allUsers = [...inspUsers, ...webUsers, ...employees];
    const uniqueUsersMap = new Map();
    allUsers.forEach((u) => {
      const uName = (u.username || u.mobile || '').trim().toLowerCase();
      if (uName && !uniqueUsersMap.has(uName)) {
        uniqueUsersMap.set(uName, u);
      }
    });

    const totalSystemUsers = uniqueUsersMap.size;
    console.log(`> Total registered users found: ${totalSystemUsers} (Inspection: ${inspUsers.length}, Web: ${webUsers.length}, Employees: ${employees.length})`);

    // 2. Check user_scope_cache collection
    const scopeCol = db.collection('user_scope_cache');
    const existingScopes = await scopeCol.find({}, { projection: { username: 1, userId: 1 } }).toArray();
    const cachedUsernames = new Set(existingScopes.map(s => (s.username || '').toLowerCase()));

    // 3. Find missing users
    const missingUsers = [];
    for (const [uName, uDoc] of uniqueUsersMap.entries()) {
      if (!cachedUsernames.has(uName)) {
        missingUsers.push(uDoc);
      }
    }

    console.log(`> Already cached users in user_scope_cache: ${cachedUsernames.size}`);
    console.log(`> Missing / Uncached users needing scope generation: ${missingUsers.length}`);

    // 4. Pre-cache missing users if any (or all if empty)
    if (missingUsers.length > 0) {
      console.log(`> Pre-caching ${missingUsers.length} user(s)...`);

      // Load lightweight masters once
      const [townPanchayats, subjects, categories, fields] = await Promise.all([
        db.collection('townPanchayats').find({}).limit(100).toArray().catch(() => []),
        db.collection('inspectionSubjects').find({}).limit(50).toArray().catch(() => []),
        db.collection('inspectionCategories').find({}).limit(100).toArray().catch(() => []),
        db.collection('inspectionFields').find({}).limit(100).toArray().catch(() => []),
      ]);

      const scopeVersion = getScopeVersion();
      let newlyCached = 0;

      for (const user of missingUsers) {
        const uId = String(user.id || user._id || '');
        const username = (user.username || user.mobile || '').trim().toLowerCase();
        const userTpId = (user.tpId || user.townPanchayatId || '').trim();
        const userTpName = (user.townPanchayat || '').trim();

        // Query ONLY this user's Town Panchayat streets (NOT whole state!)
        let userStreets = [];
        try {
          userStreets = await db.collection('wardsAndStreets').find({
            $or: [
              { tpId: userTpId },
              { townPanchayatId: userTpId },
              { tpName: { $regex: new RegExp(`^${userTpName}$`, 'i') } },
              { townPanchayat: { $regex: new RegExp(`^${userTpName}$`, 'i') } }
            ]
          }).limit(200).toArray();
        } catch (_) {}

        const compactStreets = userStreets.map((ws, idx) => ({
          id: String(ws.id || ws._id || `st_${idx}`),
          wardNo: String(ws.wardNo || ws.wardNumber || '1').trim().replace(/[^0-9]/g, '') || '1',
          streetNameEn: String(ws.streetNameEn || ws.streetName || ws.nameEn || `Street ${idx + 1}`).trim(),
          streetNameTa: String(ws.streetNameTa || ws.nameTa || ws.streetNameEn || `தெரு ${idx + 1}`).trim(),
        }));

        const matchedTp = townPanchayats.find(t => String(t.id).toLowerCase() === userTpId.toLowerCase() || String(t._id).toLowerCase() === userTpId.toLowerCase()) || {
          id: userTpId || 'tp1',
          nameEn: user.townPanchayat || 'Town Panchayat',
          nameTa: user.townPanchayatTa || 'பேரூராட்சி'
        };

        const compactScope = {
          userId: uId,
          username,
          scopeVersion,
          updatedAt: new Date().toISOString(),
          user: {
            id: uId,
            username,
            name: user.name || user.nameEn || username,
            nameTa: user.nameTa || '',
            mobile: user.mobile || user.phone || '',
            role: user.role || 'Inspection Officer',
            designation: user.designation || 'Field Inspector',
            tpId: userTpId,
            townPanchayat: matchedTp.nameEn,
            townPanchayatTa: matchedTp.nameTa,
            districtId: user.districtId || '',
            district: user.district || '',
            assignedWards: user.assignedWards || user.selectedWards || [],
            status: user.status || 'Active',
            isInspectionUser: true,
          },
          townPanchayat: matchedTp,
          assignedWards: user.assignedWards || user.selectedWards || [],
          wardsAndStreets: compactStreets,
          subjects: subjects.map(s => ({ id: String(s.id || s.code), nameEn: s.nameEn || '', nameTa: s.nameTa || '', code: s.code || '' })),
          categories: categories.map(c => ({ id: String(c.id), nameEn: c.nameEn || '', nameTa: c.nameTa || '', subjectId: String(c.subjectId || '') })),
          fields: fields.map(f => ({
            id: f.id,
            fieldKey: f.id,
            fieldType: f.type || f.fieldType || 'text',
            nameEn: f.nameEn || f.fieldName || '',
            nameTa: f.nameTa || f.fieldNameTa || f.nameEn || '',
            isRequired: f.required === true || f.isRequired === true || f.isMandatory === true,
            categoryId: f.categoryId || '',
            options: Array.isArray(f.options) ? f.options : (typeof f.options === 'string' ? f.options.split(',').map(s => s.trim()).filter(Boolean) : []),
            dependsOnFieldId: f.dependsOnFieldId || undefined,
            dependsOnValue: f.dependsOnValue || undefined,
            conditionType: f.conditionType || undefined,
            conditionalAction: f.conditionalAction || undefined,
            conditionalTriggerValue: f.conditionalTriggerValue || undefined,
            isUnique: f.isUnique === true,
            placeholderEn: f.placeholderEn || undefined,
            placeholderTa: f.placeholderTa || undefined,
          })),
          validationRules: {},
        };

        await scopeCol.updateOne(
          { username },
          { $set: compactScope },
          { upsert: true }
        );
        newlyCached++;
      }

      console.log(`> Successfully cached ${newlyCached} user scope(s)! ✅`);
    } else {
      console.log('> All existing users are already cached in user_scope_cache! No action needed. ✅');
    }

    // 5. Ensure Indexes
    try {
      await scopeCol.createIndex({ username: 1 }, { unique: true });
      await scopeCol.createIndex({ userId: 1 });
      await db.collection('inspectionUsers').createIndex({ username: 1 });
      await db.collection('inspectionUsers').createIndex({ mobile: 1 });
      console.log('> Database indexes verified & active ✅');
    } catch (_) {}

    console.log('======================================================');
    console.log('✨ [BUILD SCOPE CACHE] Ready for ultra-fast instant login!');
    console.log('======================================================\n');
  } catch (err) {
    console.warn('[BUILD SCOPE CACHE] Notice (Non-blocking):', err.message);
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
  }
}

runBuildScopeCache().then(() => process.exit(0)).catch(() => process.exit(0));
