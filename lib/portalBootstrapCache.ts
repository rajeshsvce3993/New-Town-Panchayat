import { MongoClient } from 'mongodb';
import { getActiveMongoDb, getMongoClient } from '@/lib/storage';
import { getScopeVersionMeta } from '@/lib/userScopeCache';
import { buildPortalStatePayload } from '@/lib/buildPortalStatePayload';
import { isBootstrapCacheDisabled } from '@/lib/productionFlags';

const COLLECTION = 'portal_bootstrap_cache';
const META_COLLECTION = 'masters_meta';
const META_ID = 'global';

/** Payload still valid for scope/masters when younger than this. */
export const PORTAL_BOOTSTRAP_FRESH_MS = 120_000;
/** May serve stale body up to this age while rebuilding in background. */
export const PORTAL_BOOTSTRAP_STALE_SERVE_MS = 900_000;
/** Refresh works slice in cache when older than this (async rebuild). */
export const PORTAL_BOOTSTRAP_WORKS_REFRESH_MS = 180_000;

export type PortalBootstrapMongoTag = 'HIT-MONGO' | 'STALE-MONGO' | 'MISS';

export type PortalBootstrapDoc = {
  _id: string;
  username: string;
  todayOnly: boolean;
  scopeVersion: number;
  mastersVersion: number;
  builtAt: string;
  buildDurationMs?: number;
  payload: Record<string, unknown>;
};

let mastersVersionCache: { version: number; at: number } | null = null;
const MASTERS_META_TTL_MS = 30_000;

export function portalBootstrapDocId(username: string, todayOnly: boolean): string {
  return `${String(username || '').trim().toLowerCase()}|${todayOnly ? '1' : '0'}`;
}

export function defaultPortalOrigin(): string {
  return (
    process.env.PORTAL_PUBLIC_ORIGIN ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://townpanchayat.com'
  ).replace(/\/$/, '');
}

export async function ensurePortalBootstrapIndexes(client?: MongoClient | null) {
  try {
    const c = client ?? (await getMongoClient());
    if (!c) return;
    const db = await getActiveMongoDb(c);
    const col = db.collection(COLLECTION);
    await col.createIndex({ username: 1, todayOnly: 1 }, { unique: true, background: true });
    await col.createIndex({ scopeVersion: 1 }, { background: true });
    await col.createIndex({ builtAt: -1 }, { background: true });
  } catch (e: any) {
    console.warn('[PortalBootstrap] Index setup:', e?.message || e);
  }
}

export async function getMastersVersion(): Promise<number> {
  const now = Date.now();
  if (mastersVersionCache && now - mastersVersionCache.at < MASTERS_META_TTL_MS) {
    return mastersVersionCache.version;
  }
  try {
    const client = await getMongoClient();
    if (!client) return 1;
    const db = await getActiveMongoDb(client);
    const doc = await db.collection(META_COLLECTION).findOne({ _id: META_ID }, { maxTimeMS: 2000 });
    const version = Number(doc?.version) || 1;
    mastersVersionCache = { version, at: now };
    return version;
  } catch {
    return mastersVersionCache?.version ?? 1;
  }
}

export async function bumpMastersVersion(reason: string = 'masters_update'): Promise<number> {
  try {
    const client = await getMongoClient();
    if (!client) return 1;
    const db = await getActiveMongoDb(client);
    const col = db.collection(META_COLLECTION);
    const prev = await col.findOne({ _id: META_ID });
    const next = Number(prev?.version || 1) + 1;
    const updatedAt = new Date().toISOString();
    await col.updateOne(
      { _id: META_ID },
      { $set: { version: next, updatedAt, lastReason: reason } },
      { upsert: true },
    );
    mastersVersionCache = { version: next, at: Date.now() };
    console.log(`[PortalBootstrap] mastersVersion → ${next} (${reason})`);
    return next;
  } catch (e: any) {
    console.warn('[PortalBootstrap] bumpMastersVersion:', e?.message || e);
    return await getMastersVersion();
  }
}

function isVersionFresh(doc: PortalBootstrapDoc, scopeVersion: number, mastersVersion: number): boolean {
  return doc.scopeVersion >= scopeVersion && doc.mastersVersion >= mastersVersion;
}

function docAgeMs(doc: PortalBootstrapDoc): number {
  const t = Date.parse(doc.builtAt || '');
  return Number.isFinite(t) ? Date.now() - t : Number.POSITIVE_INFINITY;
}

export async function readPortalBootstrapMongo(
  username: string,
  todayOnly: boolean,
  opts: { allowStale?: boolean } = {},
): Promise<{ payload: Record<string, unknown>; tag: PortalBootstrapMongoTag; scopeVersion: number } | null> {
  if (isBootstrapCacheDisabled()) return null;
  const allowStale = opts.allowStale !== false;
  const clean = String(username || '').trim().toLowerCase();
  if (!clean) return null;

  try {
    const client = await getMongoClient();
    if (!client) return null;
    const db = await getActiveMongoDb(client);
    const doc = (await db
      .collection(COLLECTION)
      .findOne({ _id: portalBootstrapDocId(clean, todayOnly) }, { maxTimeMS: 3000 })) as PortalBootstrapDoc | null;

    if (!doc?.payload) return null;

    const scopeVersion = getScopeVersionMeta().version;
    const mastersVersion = await getMastersVersion();
    const age = docAgeMs(doc);

    if (!isVersionFresh(doc, scopeVersion, mastersVersion)) {
      return null;
    }

    if (age <= PORTAL_BOOTSTRAP_FRESH_MS) {
      return { payload: doc.payload, tag: 'HIT-MONGO', scopeVersion };
    }

    if (allowStale && age <= PORTAL_BOOTSTRAP_STALE_SERVE_MS) {
      schedulePortalBootstrapRebuild(clean, todayOnly, defaultPortalOrigin());
      return { payload: doc.payload, tag: 'STALE-MONGO', scopeVersion };
    }
    return null;
  } catch (e: any) {
    console.warn('[PortalBootstrap] read:', e?.message || e);
    return null;
  }
}

export async function writePortalBootstrapMongo(
  username: string,
  todayOnly: boolean,
  payload: Record<string, unknown>,
  buildDurationMs?: number,
): Promise<void> {
  if (isBootstrapCacheDisabled()) return;
  const clean = String(username || '').trim().toLowerCase();
  if (!clean) return;

  const scopeVersion = getScopeVersionMeta().version;
  const mastersVersion = await getMastersVersion();
  const builtAt = new Date().toISOString();

  const doc: PortalBootstrapDoc = {
    _id: portalBootstrapDocId(clean, todayOnly),
    username: clean,
    todayOnly,
    scopeVersion,
    mastersVersion,
    builtAt,
    buildDurationMs,
    payload,
  };

  try {
    const client = await getMongoClient();
    if (!client) return;
    const db = await getActiveMongoDb(client);
    await db.collection(COLLECTION).replaceOne({ _id: doc._id }, doc, { upsert: true });
  } catch (e: any) {
    console.warn('[PortalBootstrap] write:', e?.message || e);
  }
}

const rebuildInflight = new Set<string>();
let prewarmInflight: Promise<{ warmed: number; skipped: number; failed: number }> | null = null;

export function schedulePortalBootstrapRebuild(username: string, todayOnly: boolean, origin?: string): void {
  const clean = String(username || '').trim().toLowerCase();
  if (!clean) return;
  const key = portalBootstrapDocId(clean, todayOnly);
  if (rebuildInflight.has(key)) return;
  rebuildInflight.add(key);
  const base = (origin || defaultPortalOrigin()).replace(/\/$/, '');

  void (async () => {
    const start = Date.now();
    try {
      const payload = await buildPortalStatePayload({ requestedUser: clean, todayOnly, origin: base });
      await writePortalBootstrapMongo(clean, todayOnly, payload, Date.now() - start);
    } catch (e: any) {
      console.warn(`[PortalBootstrap] async rebuild failed for ${clean}:`, e?.message || e);
    } finally {
      rebuildInflight.delete(key);
    }
  })();
}

export async function buildAndPersistPortalBootstrap(
  username: string,
  todayOnly: boolean,
  origin: string,
): Promise<Record<string, unknown>> {
  const clean = String(username || '').trim().toLowerCase();
  const start = Date.now();
  const payload = await buildPortalStatePayload({ requestedUser: clean, todayOnly, origin });
  await writePortalBootstrapMongo(clean, todayOnly, payload, Date.now() - start);
  return payload;
}

/** Prewarm portal_bootstrap_cache for inspection users (+ portal users with username). */
export async function prewarmMissingPortalBootstraps(opts?: {
  origin?: string;
  maxUsers?: number;
  concurrency?: number;
}): Promise<{ warmed: number; skipped: number; failed: number }> {
  if (prewarmInflight) return prewarmInflight;

  prewarmInflight = (async () => {
    let warmed = 0;
    let skipped = 0;
    let failed = 0;
    const origin = (opts?.origin || defaultPortalOrigin()).replace(/\/$/, '');
    const maxUsers = Math.min(opts?.maxUsers ?? 2000, 5000);
    const concurrency = Math.min(Math.max(opts?.concurrency ?? 3, 1), 6);

    try {
      const client = await getMongoClient();
      if (!client) return { warmed, skipped, failed };
      await ensurePortalBootstrapIndexes(client);
      const db = await getActiveMongoDb(client);
      const scopeVersion = getScopeVersionMeta().version;
      const mastersVersion = await getMastersVersion();

      const insp = await db.collection('inspectionUsers').find({ status: { $ne: 'disabled' } }).project({ username: 1, mobile: 1 }).limit(maxUsers).maxTimeMS(60_000).toArray();

      const keys = new Set<string>();
      for (const u of insp) {
        const un = String(u.username || u.mobile || '').trim().toLowerCase();
        if (un) keys.add(un);
      }

      const existing = await db
        .collection(COLLECTION)
        .find({ todayOnly: false })
        .project({ username: 1, scopeVersion: 1, mastersVersion: 1, builtAt: 1 })
        .maxTimeMS(30_000)
        .toArray();

      const freshSet = new Set(
        existing
          .filter((d: any) => d.scopeVersion >= scopeVersion && d.mastersVersion >= mastersVersion)
          .map((d: any) => String(d.username || '').toLowerCase()),
      );

      const todo = [...keys].filter((k) => !freshSet.has(k)).slice(0, maxUsers);

      let idx = 0;
      const worker = async () => {
        while (idx < todo.length) {
          const myIdx = idx++;
          const user = todo[myIdx];
          try {
            await buildAndPersistPortalBootstrap(user, false, origin);
            warmed += 1;
          } catch {
            failed += 1;
          }
        }
      };

      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      skipped = keys.size - todo.length;
      console.log(`[PortalBootstrap] Prewarm: warmed=${warmed} skipped=${skipped} failed=${failed}`);
    } catch (e: any) {
      console.warn('[PortalBootstrap] prewarm:', e?.message || e);
    }

    return { warmed, skipped, failed };
  })().finally(() => {
    prewarmInflight = null;
  });

  return prewarmInflight;
}