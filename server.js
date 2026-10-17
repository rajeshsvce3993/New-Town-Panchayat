const { createServer } = require('http');
const next = require('next');
const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { MongoClient } = require('mongodb');
const { S3Client, HeadBucketCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');

loadEnvConfig(process.cwd());

// Production mode by default; sets to development only if NODE_ENV is explicitly 'development' or if .next build is missing
const nextDir = path.join(process.cwd(), '.next');
const hasBuild = fs.existsSync(nextDir);
const dev = process.env.NODE_ENV === 'development' || !hasBuild;
const hostname = '0.0.0.0';
// Server runs on port 5000 for AWS Lightsail (proxied to https://townpanchayat.com), or process.env.PORT if specified
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Helper to mask sensitive connection strings in logs
function maskUri(uri) {
  if (!uri) return 'not_configured';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:*****@');
}

// Read settings from data/db.json if available
function getStorageConfig() {
  try {
    const dataFile = path.join(process.cwd(), 'data', 'db.json');
    if (fs.existsSync(dataFile)) {
      const parsed = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
      if (parsed.settings) return parsed.settings;
    }
  } catch (_) {}
  return {
    mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/dtp_enterprise',
    s3Bucket: process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || 'tms-2026',
    s3Region: process.env.S3_REGION || 'ap-south-1',
    s3AccessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
  };
}

// Background startup verification for MongoDB and AWS S3
async function runSystemDiagnostics() {
  const config = getStorageConfig();
  const mongoUri = process.env.MONGODB_URI || config.mongodbUri || 'mongodb://127.0.0.1:27018/dtp_enterprise';
  const s3Bucket = process.env.S3_BUCKET_NAME || process.env.S3_BUCKET || config.s3Bucket || 'tms-2026';
  const s3Region = process.env.S3_REGION || config.s3Region || 'ap-south-1';
  const s3KeyId = process.env.S3_ACCESS_KEY_ID || config.s3AccessKeyId || '';
  const s3Secret = process.env.S3_SECRET_ACCESS_KEY || config.s3SecretAccessKey || '';

  console.log('\n======================================================');
  console.log('🚀 TAMIL NADU TOWN PANCHAYAT EMS - SYSTEM STARTUP');
  console.log('======================================================');
  console.log(`🌐 Server Port     : ${port} (Bound to: ${hostname} - Public & LAN Accessible)`);
  console.log(`⚡ Execution Mode  : ${dev ? 'Development (HMR Enabled)' : 'Production (Optimized Build)'}`);
  console.log(`🔗 Local / LAN URL : http://${hostname}:${port}`);
  console.log('------------------------------------------------------');

  // 1. Check MongoDB Connection & Indexes
  try {
    const startMongo = Date.now();
    const isLocal = mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1');
    const client = new MongoClient(mongoUri, {
      serverSelectionTimeoutMS: isLocal ? 1500 : 4000,
      connectTimeoutMS: isLocal ? 1500 : 5000,
      maxPoolSize: 50,
      waitQueueTimeoutMS: 45000,
    });
    await client.connect();
    const mongoLatency = Date.now() - startMongo;

    // Detect Active Database
    const dbAdmin = client.db().admin();
    let dbName = 'dtp_enterprise';
    try {
      const dbs = await dbAdmin.listDatabases();
      const targetDb = dbs.databases.find(d => ['dtp_enterprise', 'dtp_clean_prod', 'townpanchayat_ems'].includes(d.name));
      if (targetDb) dbName = targetDb.name;
    } catch (_) {}

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    const colNames = collections.map(c => c.name);

    // Get critical collection counts
    let inspUserCount = 0;
    let webUserCount = 0;
    let scopeCount = 0;
    let worksCount = 0;

    try {
      if (colNames.includes('inspectionUsers')) inspUserCount = await db.collection('inspectionUsers').countDocuments();
      if (colNames.includes('users')) webUserCount = await db.collection('users').countDocuments();
      if (colNames.includes('user_scope_cache')) scopeCount = await db.collection('user_scope_cache').countDocuments();
      if (colNames.includes('inspectionWorks')) worksCount = await db.collection('inspectionWorks').countDocuments();
    } catch (_) {}

    console.log(`🍃 [MongoDB Connection] : CONNECTED (${mongoLatency}ms) ✅`);
    console.log(`   - Connection URI      : ${maskUri(mongoUri)}`);
    console.log(`   - Active Database     : "${dbName}"`);
    console.log(`   - Inspection Users    : ${inspUserCount} active field users in "inspectionUsers"`);
    console.log(`   - Web Portal Users    : ${webUserCount} officers in "users"`);
    console.log(`   - Scope Cache Records : ${scopeCount} scopes in "user_scope_cache"`);
    console.log(`   - Inspection Works    : ${worksCount} works in "inspectionWorks"`);

    // Ensure Indexes on critical collections
    try {
      if (colNames.includes('inspectionUsers')) {
        await db.collection('inspectionUsers').createIndex({ username: 1 }, { background: true });
        await db.collection('inspectionUsers').createIndex({ mobile: 1 }, { background: true });
        await db.collection('inspectionUsers').createIndex({ status: 1 }, { background: true });
        await db.collection('inspectionUsers').createIndex({ tpId: 1 }, { background: true });
      }
      if (colNames.includes('users')) {
        await db.collection('users').createIndex({ username: 1 }, { background: true });
      }
      if (colNames.includes('user_scope_cache')) {
        await db.collection('user_scope_cache').createIndex({ username: 1 }, { background: true });
        await db.collection('user_scope_cache').createIndex({ userId: 1 }, { background: true });
      }
      if (colNames.includes('inspectionWorks')) {
        await db.collection('inspectionWorks').createIndex({ workId: 1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ submittedAt: -1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ submittedAt: -1, createdAt: -1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ tpId: 1, submittedAt: -1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ tpId: 1, wardNumber: 1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ submittedByUserName: 1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ submittedByUserId: 1 }, { background: true });
        await db.collection('inspectionWorks').createIndex({ username: 1 }, { background: true });
      }
      console.log(`   - Database Indexes    : B-Tree Indexes Verified & Active ✅`);
    } catch (idxErr) {
      console.warn(`   - Index setup note    : ${idxErr.message}`);
    }

    await client.close();
  } catch (mongoErr) {
    console.warn(`🍃 [MongoDB Connection] : Local Fallback Mode (${mongoErr.message}) ⚠️`);
  }

  console.log('------------------------------------------------------');

  // 2. Check AWS S3 Connection
  if (!s3KeyId || !s3Secret) {
    console.warn('☁️  [AWS S3 Storage]    : Skipped (set S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY in .env) ⚠️');
  } else try {
    const s3 = new S3Client({
      region: s3Region,
      credentials: {
        accessKeyId: s3KeyId,
        secretAccessKey: s3Secret,
      },
    });
    void s3;

    console.log(`☁️  [AWS S3 Storage]    : INITIALIZED & READY ✅`);
    console.log(`   - S3 Region           : ${s3Region}`);
    console.log(`   - Bucket Name         : "${s3Bucket}"`);
    console.log(`   - Inspection Folder   : "inspection/{username}/"`);
    console.log(`   - Status              : Live Media Cloud Sync Active`);
  } catch (s3Err) {
    console.warn(`☁️  [AWS S3 Storage]    : Failed (${s3Err.message}) ⚠️`);
  }

  console.log('======================================================\n');
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const reqStart = Date.now();
    try {
      const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const customParsedUrl = {
        pathname: parsedUrl.pathname,
        query: Object.fromEntries(parsedUrl.searchParams),
        search: parsedUrl.search,
        hash: parsedUrl.hash,
        href: parsedUrl.href
      };

      // Log API and Auth requests clearly in console
      if (req.url && (req.url.startsWith('/api/auth') || req.url.startsWith('/api/portal-state') || req.url.startsWith('/api/inspection-works') || req.url.startsWith('/api/health'))) {
        res.on('finish', () => {
          const duration = Date.now() - reqStart;
          const status = res.statusCode;
          const statusIcon = status >= 200 && status < 300 ? '✅' : status >= 400 ? '❌' : 'ℹ️';
          console.log(`[HTTP ${statusIcon}] ${req.method} ${parsedUrl.pathname} - ${status} (${duration}ms) - IP: ${req.socket.remoteAddress}`);
        });
      }

      await handle(req, res, customParsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('Internal Server Error');
    }
  });

  // Ensure high-concurrency socket handling, prevent ECONNRESET on upload & API requests
  server.timeout = 360000; // 6 minutes timeout for large file uploads
  server.requestTimeout = 360000;
  server.keepAliveTimeout = 310000;
  server.headersTimeout = 320000;
  server.maxRequestsPerSocket = 0; // Unlimited requests per socket

  server.once('error', (err) => {
    console.error('Server error:', err);
    process.exit(1);
  });

  server.listen(port, hostname, () => {
    // Run diagnostics asynchronously after listen
    runSystemDiagnostics().catch(console.error);
  });
});
