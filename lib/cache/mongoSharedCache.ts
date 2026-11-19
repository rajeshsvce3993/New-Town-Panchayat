import { getDb } from '@/lib/repositories/mastersRepository';
import { useMongoSharedResponseCache } from '@/lib/productionFlags';

const COLLECTION = 'app_response_cache';
const MAX_DOC_BYTES = 400_000;

type CacheDoc = {
  _id: string;
  payload: unknown;
  expiresAt: Date;
  updatedAt: Date;
};

export async function readMongoSharedCache<T>(key: string): Promise<T | null> {
  if (!useMongoSharedResponseCache()) return null;
  const db = await getDb();
  if (!db) return null;
  try {
    const doc = (await db.collection<CacheDoc>(COLLECTION).findOne({ _id: key, expiresAt: { $gt: new Date() } })) as
      | CacheDoc
      | null;
    return doc?.payload != null ? (doc.payload as T) : null;
  } catch {
    return null;
  }
}

export async function writeMongoSharedCache(key: string, payload: unknown, ttlMs: number): Promise<void> {
  if (!useMongoSharedResponseCache()) return;
  const db = await getDb();
  if (!db) return;
  try {
    const size = JSON.stringify(payload).length;
    if (size > MAX_DOC_BYTES) return;
    const now = new Date();
    await db.collection(COLLECTION).updateOne(
      { _id: key },
      {
        $set: {
          payload,
          updatedAt: now,
          expiresAt: new Date(now.getTime() + ttlMs),
        },
      },
      { upsert: true },
    );
  } catch (err) {
    console.warn('[mongoSharedCache] write failed:', (err as Error)?.message || err);
  }
}

export async function invalidateMongoSharedCachePrefix(prefix: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    await db.collection(COLLECTION).deleteMany({ _id: { $regex: `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } });
  } catch {
    /* ignore */
  }
}

export async function ensureMongoSharedCacheIndexes(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await Promise.allSettled([
    db.collection(COLLECTION).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true }),
  ]);
}