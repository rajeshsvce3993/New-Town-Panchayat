import { ensureMongoSharedCacheIndexes } from '@/lib/cache/mongoSharedCache';
import { getMongoClient, ensureDatabaseIndexes } from '@/lib/db/mongo';
import { invalidateDashboardStatsCache } from '@/lib/dashboardStats';
import { invalidateInspectionWorksAggregateCache } from '@/lib/inspectionWorksReportsAggregate';
import {
  ensureInspectionWorkReportIndexes,
  ensureInspectionWorkReportRollupsReady,
  enqueueInspectionWorkReportRollupRebuild,
  refreshLifetimeRollupsFromLive,
} from '@/lib/inspectionWorkReportRollups';
import { getRollupHealth, type RollupHealth } from '@/lib/jobs/rollupHealth';
import { refreshSwmDashboardTotals } from '@/lib/jobs/swmDashboardTotals';
import { invalidateInspectionFilterMastersCache } from '@/lib/inspectionWorksFilterMastersServer';
import { invalidateInspectionWorksLiteCache } from '@/lib/inspectionWorksLiteLoader';

export type ProductionRefreshResult = {
  ok: boolean;
  lifetimeBuckets: number;
  rollupQueued: boolean;
  swmBuiltAt: string | null;
  rollups: RollupHealth;
  steps: string[];
};

export async function runProductionRefresh(opts?: {
  forceLifetime?: boolean;
  forceRollupRebuild?: boolean;
}): Promise<ProductionRefreshResult> {
  const steps: string[] = [];
  const forceLifetime = !!opts?.forceLifetime;
  const forceRollupRebuild = !!opts?.forceRollupRebuild;

  const client = await getMongoClient();
  if (client) {
    await ensureDatabaseIndexes(client);
    steps.push('database_indexes');
  }

  await ensureInspectionWorkReportIndexes();
  steps.push('rollup_indexes');

  await ensureMongoSharedCacheIndexes();
  steps.push('response_cache_indexes');

  let rollupQueued = false;
  if (forceRollupRebuild) {
    await enqueueInspectionWorkReportRollupRebuild();
    rollupQueued = true;
    steps.push('rollup_rebuild_queued');
  } else {
    await ensureInspectionWorkReportRollupsReady();
    steps.push('rollup_worker_ready');
  }

  const lifetimeBuckets = await refreshLifetimeRollupsFromLive(forceLifetime);
  steps.push('lifetime_sync');

  const swmDoc = await refreshSwmDashboardTotals();
  steps.push('swm_totals');

  invalidateDashboardStatsCache();
  invalidateInspectionWorksAggregateCache();
  invalidateInspectionFilterMastersCache();
  invalidateInspectionWorksLiteCache();
  steps.push('caches_invalidated');

  const rollups = await getRollupHealth();
  return {
    ok: rollups.ok && lifetimeBuckets > 0,
    lifetimeBuckets,
    rollupQueued,
    swmBuiltAt: swmDoc?.builtAt ? new Date(swmDoc.builtAt).toISOString() : null,
    rollups,
    steps,
  };
}