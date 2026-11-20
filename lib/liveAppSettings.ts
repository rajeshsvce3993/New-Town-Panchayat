import { getDb } from '@/lib/repositories/mastersRepository';
import { getAppSettings, saveAppSettings } from '@/lib/storage';
import { invalidatePortalMastersCache } from '@/lib/portalMastersCache';

const SETTINGS_DOC_ID = 'portal';
const COLLECTION = 'appSettings';

function stripMongoMeta(doc: Record<string, unknown> | null | undefined) {
  if (!doc || typeof doc !== 'object') return {};
  const { _id: _dropId, id: _dropKey, ...rest } = doc;
  return rest;
}

/** Live portal settings (report share captions, theme) from Mongo, then local JSON. */
export async function loadLiveAppSettings(): Promise<Record<string, unknown>> {
  const local = (getAppSettings() || {}) as Record<string, unknown>;
  try {
    const db = await getDb();
    if (!db) return local;
    const col = db.collection(COLLECTION);
    const doc = await col.findOne(
      { id: SETTINGS_DOC_ID },
      { maxTimeMS: 4000, projection: { _id: 0 } },
    );
    if (!doc) {
      if (local.reportShare) {
        await col.updateOne(
          { id: SETTINGS_DOC_ID },
          { $set: { ...local, id: SETTINGS_DOC_ID, updatedAt: new Date().toISOString() } },
          { upsert: true },
        );
      }
      return local;
    }
    const mongo = stripMongoMeta(doc as Record<string, unknown>);
    return {
      ...local,
      ...mongo,
      reportShare: mongo.reportShare ?? local.reportShare,
    };
  } catch {
    return local;
  }
}

/** Persist settings to local JSON and Mongo so mobile and all PM2 workers see the same captions. */
export async function persistLiveAppSettings(settings: Record<string, unknown>): Promise<void> {
  saveAppSettings(settings as any);
  try {
    const db = await getDb();
    if (db) {
      const payload = {
        ...settings,
        id: SETTINGS_DOC_ID,
        updatedAt: new Date().toISOString(),
      };
      await db.collection(COLLECTION).updateOne(
        { id: SETTINGS_DOC_ID },
        { $set: payload },
        { upsert: true },
      );
    }
  } catch (err) {
    console.warn('[liveAppSettings] Mongo persist failed; local JSON was saved', err);
  }
  invalidatePortalMastersCache();
}
