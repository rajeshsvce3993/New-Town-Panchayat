import * as FileSystem from 'expo-file-system/legacy';
import { api, setApiBaseUrl } from '../api/client';
import { prefs } from '../storage/preferences';
import type { InspectionWork, QueuedWorkEntry } from '../types/models';
import { QUEUE_STATUS } from '../types/models';
import { cleanLocalFile } from '../utils/imageCompression';
import { cleanLocalPhotosFromWork, isLocalPhotoPath, uploadLocalPhotosInWork, workHasLocalPhotos } from '../utils/photoPersist';
import { showInspectionNotification, showSimpleNotification } from './notifications';

let syncLock = false;

async function exists(path?: string | null) {
  if (!path) return false;
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

async function rememberWorkUrls(taskId: string, work: InspectionWork) {
  await prefs.updateQueuedWork(taskId, (it) => {
    it.work = { ...it.work, imageUrl: work.imageUrl, fieldsData: work.fieldsData };
  });
  await prefs.upsertOfflineWork({ ...work, workId: work.workId || '' });
}

async function ensureOfflineWorksAreQueued() {
  const offline = await prefs.getOfflineWorks();
  const queue = await prefs.getQueue();
  for (const work of offline) {
    if (work.workId) continue;
    if (queue.some((e) => e.work.id === work.id)) continue;
    await prefs.enqueueWork({
      clientTaskId: `off-${work.id}`,
      work,
      localPhotoPath: isLocalPhotoPath(work.imageUrl) ? String(work.imageUrl) : null,
      status: QUEUE_STATUS.IN_QUEUE,
      progress: 10,
      attemptCount: 0,
      createdAt: Date.now(),
    });
  }
}

export async function processQueueFifo(): Promise<InspectionWork[]> {
  return syncPendingWorks();
}

export async function syncOfflineWorksForeground(): Promise<InspectionWork[]> {
  return syncPendingWorks();
}

export async function syncPendingWorks(): Promise<InspectionWork[]> {
  if (syncLock) return [];
  syncLock = true;
  const synced: InspectionWork[] = [];
  try {
    const server = await prefs.getServerUrl();
    setApiBaseUrl(server);
    const user = await prefs.getCurrentUser();
    if (user) {
      try {
        const fresh = await api.getPortalState(user.username);
        if (fresh.user && (fresh.user.status === 'disabled' || fresh.user.forceLoggedOut)) {
          await prefs.setCurrentUser(null);
          await prefs.setAuthToken(null);
          await showSimpleNotification('கணக்கு முடக்கப்பட்டது', 'உங்கள் கணக்கு நிர்வாகியால் முடக்கப்பட்டு வெளியேற்றப்பட்டுள்ளது.');
          return [];
        }
      } catch {
        /* offline: keep cache */
      }
    }

    if (!(await api.isReachable())) return [];

    await ensureOfflineWorksAreQueued();
    const entries = await prefs.getQueue();
    const pending = entries.filter((e) => e.status !== QUEUE_STATUS.SUBMITTED);
    for (const item of pending) {
      const saved = await processOneEntry(item);
      if (!saved) break;
      synced.push(saved);
    }
  } finally {
    syncLock = false;
  }
  return synced;
}

export async function processOneEntry(currentItem: QueuedWorkEntry): Promise<InspectionWork | null> {
  const taskId = currentItem.clientTaskId;
  try {
    const user = await prefs.getCurrentUser();
    await prefs.updateQueuedWork(taskId, (it) => {
      it.status = QUEUE_STATUS.IMAGE_COMPRESSING;
      it.progress = 25;
    });

    const payload = await uploadLocalPhotosInWork(currentItem.work, {
      workId: currentItem.work.workId,
      userId: user?.id || user?.username,
      username: user?.username,
      zone: currentItem.work.zoneNameEn,
      district: currentItem.work.districtNameEn,
      tp: currentItem.work.tpNameEn,
    });
    await rememberWorkUrls(taskId, { ...payload, workId: '' });

    if (workHasLocalPhotos(payload)) {
      await handleSlow(taskId, 'Waiting to upload remaining photos');
      return null;
    }

    await prefs.updateQueuedWork(taskId, (it) => {
      it.status = QUEUE_STATUS.PROCESSING;
      it.progress = 70;
    });

    const direct = await api.submitInspectionWork(payload);
    if (direct.success && (direct.workId || direct.work)) {
      const saved = direct.work || { ...payload, workId: direct.workId || payload.workId };
      await onConfirmed(taskId, saved.workId || '#CONFIRMED', currentItem.work, payload, saved);
      return saved;
    }
    await handleSlow(taskId, direct.message || 'Server submission error');
    return null;
  } catch (e) {
    await handleSlow(taskId, e instanceof Error ? e.message : 'Network/Worker exception');
    return null;
  }
}

async function onConfirmed(
  taskId: string,
  workId: string,
  original: InspectionWork,
  uploaded: InspectionWork,
  savedWork?: InspectionWork | null
) {
  await prefs.updateQueuedWork(taskId, (it) => {
    it.status = QUEUE_STATUS.SUBMITTED;
    it.progress = 100;
    it.workId = workId;
  });
  const entries = await prefs.getQueue();
  const item = entries.find((e) => e.clientTaskId === taskId);
  await cleanLocalFile(item?.compressedPhotoPath);
  await cleanLocalFile(item?.localPhotoPath);
  await cleanLocalPhotosFromWork(original);
  await cleanLocalPhotosFromWork(uploaded);
  await cleanLocalPhotosFromWork(item?.work);
  await prefs.removeOfflineWork(original.id);
  await prefs.removeQueuedWorkMatching((e) => e.clientTaskId === taskId || e.work.id === original.id);
  try {
    await showInspectionNotification(workId, original.subjectNameEn || 'Field Work', false);
  } catch {
    /* ignore */
  }
  void savedWork;
}

async function handleSlow(taskId: string, reason: string) {
  const current = await prefs.getQueue();
  const index = current.findIndex((e) => e.clientTaskId === taskId);
  if (index >= 0) {
    const item = current.splice(index, 1)[0];
    item.status = QUEUE_STATUS.REJECTED_RETRY;
    item.errorMessage = reason;
    item.attemptCount += 1;
    current.push(item);
    await prefs.setQueue(current);
  }
}

export { exists, isLocalPhotoPath };
