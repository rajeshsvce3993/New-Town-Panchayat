import { api } from '../api/client';
import { SAMPLE_PHOTO } from '../constants/config';
import { markWorkSyncedAndRemove, sweepLeftoverOfflineCache, writeOfflineDraft } from '../storage/offlineQueueStore';
import { prefs } from '../storage/preferences';
import type { InspectionWork, QueuedWorkEntry } from '../types/models';
import { QUEUE_STATUS } from '../types/models';
import {
  isLocalPhotoPath,
  savePhotosOfflineLocal,
  uploadPhotosOnlineApi,
  uploadQueuedPhotosInWork,
  workHasLocalPhotos,
  type PhotoUploadMeta,
} from '../utils/photoPersist';
import { isNetworkFailure, toSavedWork } from '../utils/workSaveResult';

export type SubmitPhotoJob = { key: string; uri: string };

export type AddWorkInput = {
  work: InspectionWork;
  photoJobs: SubmitPhotoJob[];
  photoMeta: PhotoUploadMeta;
};

export type AddWorkResult =
  | { status: 'online'; saved: InspectionWork }
  | { status: 'queued'; queued: InspectionWork }
  | { status: 'error'; message: string };

let onlineTail: Promise<void> = Promise.resolve();
let queueTail: Promise<void> = Promise.resolve();

function serializeOnline<T>(fn: () => Promise<T>): Promise<T> {
  const next = onlineTail.then(fn, fn);
  onlineTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function serializeQueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queueTail.then(fn, fn);
  queueTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

async function recoverIfAlreadySaved(clientId: string): Promise<InspectionWork | null> {
  const found = await api.lookupInspectionWork(clientId);
  return toSavedWork({ success: true, work: found, workId: found?.workId }, clientId);
}

function applyPhotoMap(
  base: InspectionWork,
  uploaded: Record<string, string>
): { fieldCopy: Record<string, string>; imageUrl: string } {
  const fieldCopy = { ...(base.fieldsData || {}) };
  let imageUrl = base.imageUrl || SAMPLE_PHOTO;
  for (const [key, url] of Object.entries(uploaded)) {
    if (key === '__primary__') continue;
    fieldCopy[key] = url;
    if (!imageUrl || imageUrl === SAMPLE_PHOTO) imageUrl = url;
  }
  if (uploaded.__primary__) imageUrl = uploaded.__primary__;
  return { fieldCopy, imageUrl };
}

async function attemptOnlineSave(input: AddWorkInput): Promise<AddWorkResult> {
  const clientId = input.work.id;
  const uploaded = input.photoJobs.length ? await uploadPhotosOnlineApi(input.photoJobs, input.photoMeta) : {};
  const { fieldCopy, imageUrl } = applyPhotoMap(input.work, uploaded);
  const payload: InspectionWork = { ...input.work, fieldsData: fieldCopy, imageUrl, workId: '' };

  for (const url of [payload.imageUrl, ...Object.values(payload.fieldsData || {})]) {
    const s = String(url || '');
    if (!s || s === SAMPLE_PHOTO) continue;
    if (isLocalPhotoPath(s)) {
      return { status: 'error', message: 'Failed to upload photos. Please try again.' };
    }
  }

  const direct = await api.submitWorkOnlineApi(payload);
  const saved = toSavedWork(direct, clientId);
  if (saved) return { status: 'online', saved };
  return {
    status: 'error',
    message: direct.message || 'Server could not save this work. Please try again.',
  };
}

async function enqueueOfflineOnly(input: AddWorkInput): Promise<InspectionWork> {
  const clientId = input.work.id;
  const offlineDir = await writeOfflineDraft(input.work);
  const uploaded = await savePhotosOfflineLocal(input.photoJobs, offlineDir);
  const { fieldCopy, imageUrl } = applyPhotoMap(input.work, uploaded);
  const queued: InspectionWork = {
    ...input.work,
    fieldsData: fieldCopy,
    imageUrl,
    workId: '',
    status: 'Pending',
  };
  const firstLocal =
    [imageUrl, ...Object.values(fieldCopy).map((v) => String(v || ''))].find((u) => isLocalPhotoPath(u)) || null;
  await prefs.enqueueOfflineWorkAtomic(
    {
      clientTaskId: clientId,
      work: queued,
      localPhotoPath: firstLocal,
      status: QUEUE_STATUS.IN_QUEUE,
      progress: 10,
      attemptCount: 0,
      createdAt: Date.now(),
    },
    queued
  );
  return queued;
}

async function runOnlineSubmit(input: AddWorkInput): Promise<AddWorkResult> {
  const clientId = String(input.work.id || '').trim();
  if (!clientId) return { status: 'error', message: 'Missing client work id' };

  if (await api.isReachable()) {
    const first = await attemptOnlineSave(input);
    if (first.status === 'online') return first;
    if (!isNetworkFailure(first.message)) return first;
    const recovered = await recoverIfAlreadySaved(clientId);
    if (recovered) return { status: 'online', saved: recovered };
  }

  return enqueueOfflineOnly(input);
}

let drainTimer: ReturnType<typeof setTimeout> | null = null;

/** Wait so two quick offline saves are both on disk before sync starts. */
export function scheduleQueueDrain(delayMs = 1500) {
  if (drainTimer) clearTimeout(drainTimer);
  drainTimer = setTimeout(() => {
    drainTimer = null;
    void syncQueuedWorks();
  }, delayMs);
}

async function ensureOfflineWorksAreQueued() {
  const offline = await prefs.getOfflineWorks();
  const queue = await prefs.getQueue();
  for (const work of offline) {
    if (!work.id || String(work.workId || '').trim()) continue;
    if (queue.some((e) => e.clientTaskId === work.id || e.work?.id === work.id)) continue;
    await prefs.enqueueOfflineWorkAtomic(
      {
        clientTaskId: work.id,
        work,
        localPhotoPath: isLocalPhotoPath(work.imageUrl) ? String(work.imageUrl) : null,
        status: QUEUE_STATUS.IN_QUEUE,
        progress: 10,
        attemptCount: 0,
        createdAt: Date.now(),
      },
      work
    );
  }
}

async function syncOne(item: QueuedWorkEntry): Promise<InspectionWork | null> {
  const clientId = String(item.clientTaskId || item.work?.id || '').trim();
  if (!clientId) return null;

  const stillQueued = (await prefs.getQueue()).some((e) => e.clientTaskId === clientId);
  if (!stillQueued) return null;

  const user = await prefs.getCurrentUser();
  await prefs.updateQueuedWork(clientId, (it) => {
    it.status = QUEUE_STATUS.IMAGE_COMPRESSING;
    it.progress = 25;
  });

  const latest = (await prefs.getQueue()).find((e) => e.clientTaskId === clientId) || item;
  const uploaded = await uploadQueuedPhotosInWork(latest.work, {
    workId: latest.work.id,
    userId: user?.id || user?.username,
    username: user?.username,
    zone: latest.work.zoneNameEn,
    district: latest.work.districtNameEn,
    tp: latest.work.tpNameEn,
  });
  await prefs.updateQueuedWork(clientId, (it) => {
    it.work = { ...it.work, imageUrl: uploaded.imageUrl, fieldsData: uploaded.fieldsData };
  });
  await prefs.upsertOfflineWork({ ...uploaded, id: clientId, workId: '' });

  if (workHasLocalPhotos(uploaded)) {
    await prefs.updateQueuedWork(clientId, (it) => {
      it.status = QUEUE_STATUS.IN_QUEUE;
      it.errorMessage = 'Waiting to upload photos';
      it.attemptCount = (it.attemptCount || 0) + 1;
    });
    return null;
  }

  await prefs.updateQueuedWork(clientId, (it) => {
    it.status = QUEUE_STATUS.PROCESSING;
    it.progress = 70;
  });

  const direct = await api.submitWorkFromQueueApi({ ...uploaded, id: clientId, workId: '' });
  const saved = toSavedWork(direct, clientId) || (await recoverIfAlreadySaved(clientId));
  if (saved) {
    const confirm = (await prefs.getQueue()).find((e) => e.clientTaskId === clientId);
    if (confirm) await markWorkSyncedAndRemove(clientId, saved.workId);
    return saved;
  }
  await prefs.updateQueuedWork(clientId, (it) => {
    it.status = QUEUE_STATUS.IN_QUEUE;
    it.errorMessage = direct.message || 'Server submission error';
    it.attemptCount = (it.attemptCount || 0) + 1;
    it.progress = 10;
  });
  return null;
}

async function runSync(): Promise<InspectionWork[]> {
  if (!(await api.isReachable())) return [];
  await ensureOfflineWorksAreQueued();
  const synced: InspectionWork[] = [];
  const failed = new Set<string>();
  for (;;) {
    const pending = (await prefs.getQueue())
      .filter((e) => e.status !== QUEUE_STATUS.SUBMITTED && e.clientTaskId && !failed.has(e.clientTaskId))
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    if (!pending.length) break;
    const item = pending[0];
    try {
      const saved = await syncOne(item);
      if (saved) synced.push(saved);
      else failed.add(item.clientTaskId);
    } catch (e) {
      await prefs.updateQueuedWork(item.clientTaskId, (it) => {
        it.status = QUEUE_STATUS.IN_QUEUE;
        it.errorMessage = e instanceof Error ? e.message : 'Sync failed';
        it.attemptCount = (it.attemptCount || 0) + 1;
      });
      failed.add(item.clientTaskId);
    }
  }
  await sweepLeftoverOfflineCache();
  return synced;
}

/** Add Work button. Online save never reads or writes the offline queue. */
export function submitAddWork(input: AddWorkInput): Promise<AddWorkResult> {
  return serializeOnline(() => runOnlineSubmit(input));
}

/** Queue drain only. Never used by the online Add Work POST. */
export function syncQueuedWorks(): Promise<InspectionWork[]> {
  return serializeQueue(() => runSync());
}
