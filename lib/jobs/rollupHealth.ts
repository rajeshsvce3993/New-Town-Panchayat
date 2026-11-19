import { INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION } from '@/lib/inspectionWorkReportRollups';
import { getDb } from '@/lib/repositories/mastersRepository';

const LIFETIME = `${INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION}Lifetime`;
const META_ROLLUP = 'inspection_work_report_rollups';
const META_LIFETIME = 'inspection_work_report_rollups_lifetime';

export type RollupHealth = {
  ok: boolean;
  liveBuckets: number;
  lifetimeBuckets: number;
  rollupStatus?: string;
  lifetimeStatus?: string;
  lastCatchupAt?: string | null;
  warnings: string[];
};

export async function getRollupHealth(): Promise<RollupHealth> {
  const warnings: string[] = [];
  const db = await getDb();
  if (!db) {
    return { ok: false, liveBuckets: 0, lifetimeBuckets: 0, warnings: ['MongoDB unavailable'] };
  }

  const [liveBuckets, lifetimeBuckets, rollupMeta, lifetimeMeta] = await Promise.all([
    db.collection(INSPECTION_WORK_REPORT_ROLLUPS_COLLECTION).estimatedDocumentCount(),
    db.collection(LIFETIME).estimatedDocumentCount().catch(() => 0),
    db.collection('appMeta').findOne({ _id: META_ROLLUP }),
    db.collection('appMeta').findOne({ _id: META_LIFETIME }),
  ]);

  const rollupStatus = String(rollupMeta?.status || 'unknown');
  const lifetimeStatus = String(lifetimeMeta?.status || 'unknown');
  const lastCatchupAt = rollupMeta?.lastCatchupAt
    ? new Date(rollupMeta.lastCatchupAt as Date).toISOString()
    : null;

  if (liveBuckets === 0) warnings.push('inspectionWorkReportRollups is empty');
  if (lifetimeBuckets === 0 && liveBuckets > 0) warnings.push('lifetime rollups not built yet');
  if (rollupStatus === 'building') warnings.push('rollup full build in progress');

  const ok = liveBuckets > 0 && (lifetimeBuckets > 0 || rollupStatus === 'building' || rollupStatus === 'ready');

  return {
    ok,
    liveBuckets,
    lifetimeBuckets,
    rollupStatus,
    lifetimeStatus,
    lastCatchupAt,
    warnings,
  };
}