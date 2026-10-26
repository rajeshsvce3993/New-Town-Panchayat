import { setApiBaseUrl } from '../api/client';
import { sweepLeftoverOfflineCache } from '../storage/offlineQueueStore';
import { prefs } from '../storage/preferences';
import type { InspectionWork } from '../types/models';
import { syncQueuedWorks } from './workPipeline';

export async function syncPendingWorks(): Promise<InspectionWork[]> {
  const server = await prefs.getServerUrl();
  setApiBaseUrl(server);
  return syncQueuedWorks();
}

export async function processQueueFifo(): Promise<InspectionWork[]> {
  return syncPendingWorks();
}

export async function syncOfflineWorksForeground(): Promise<InspectionWork[]> {
  return syncPendingWorks();
}

export function scheduleSyncSoon(_delayMs = 2500) {
  void _delayMs;
}

export async function sweepSyncedOfflineCache() {
  return sweepLeftoverOfflineCache();
}
