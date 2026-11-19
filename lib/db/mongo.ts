/**
 * Mongo entrypoint for production APIs — import here instead of `@/lib/storage` in new code.
 */
import {
  getMongoClient,
  getActiveMongoDb,
  ensureDatabaseIndexes,
} from '@/lib/storage';

export { getMongoClient, getActiveMongoDb, ensureDatabaseIndexes };

/** Ensure indexes on first connect (idempotent). */
export async function warmMongoOnBoot(): Promise<void> {
  const client = await getMongoClient();
  if (!client) return;
  await ensureDatabaseIndexes(client);
  const { ensureMongoSharedCacheIndexes } = await import('@/lib/cache/mongoSharedCache');
  const { ensureInspectionWorkReportIndexes } = await import('@/lib/inspectionWorkReportRollups');
  await Promise.allSettled([ensureMongoSharedCacheIndexes(), ensureInspectionWorkReportIndexes()]);
}