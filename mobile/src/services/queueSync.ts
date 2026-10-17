import * as FileSystem from 'expo-file-system/legacy';
import { api, setApiBaseUrl } from '../api/client';
import { prefs } from '../storage/preferences';
import type { InspectionWork, QueuedWorkEntry } from '../types/models';
import { QUEUE_STATUS } from '../types/models';
import { cleanLocalFile, compressImageLocally, fileToBase64DataUri } from '../utils/imageCompression';
import { showInspectionNotification, showSimpleNotification } from './notifications';

function looksLocal(path: string) {
  return (
    !!path &&
    !path.startsWith('http') &&
    !path.startsWith('data:') &&
    (path.startsWith('file:') || path.startsWith('/') || path.includes('offline_images') || path.includes('raw_uploads'))
  );
}

async function exists(path?: string | null) {
  if (!path) return false;
  try {
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function processQueueFifo(): Promise<void> {
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
        return;
      }
      const currentVersion = await prefs.getScopeVersionInt();
      const versionResp = await api.checkScopeVersion(currentVersion);
      if (versionResp.success && versionResp.hasUpdate) {
        const scopeResp = await api.getUserScope(user.username);
        if (scopeResp.success && scopeResp.scope) {
          await prefs.setUserScope(scopeResp.scope);
          await prefs.setScopeVersionInt(scopeResp.scopeVersion || currentVersion);
          await prefs.setPortal(fresh);
        }
      }
    } catch {
      /* offline: keep cache */
    }
  }

  const entries = await prefs.getQueue();
  const pending = entries.filter((e) => e.status !== QUEUE_STATUS.SUBMITTED && e.status !== QUEUE_STATUS.PROCESSING);
  if (!pending.length) return;
  const currentItem = pending[0];
  await processOneEntry(currentItem);
}

export async function processOneEntry(currentItem: QueuedWorkEntry): Promise<boolean> {
  const taskId = currentItem.clientTaskId;
  try {
    let localPath = currentItem.localPhotoPath || undefined;
    if (!(await exists(localPath))) {
      const cand = currentItem.work.imageUrl || '';
      if (looksLocal(cand) && (await exists(cand))) localPath = cand;
      else {
        for (const v of Object.values(currentItem.work.fieldsData)) {
          const pathStr = String(v || '');
          if (looksLocal(pathStr) && (await exists(pathStr))) {
            localPath = pathStr;
            break;
          }
        }
      }
    }

    let compressedPath = currentItem.compressedPhotoPath || null;
    if (!compressedPath && localPath) {
      await prefs.updateQueuedWork(taskId, (it) => {
        it.status = QUEUE_STATUS.IMAGE_COMPRESSING;
        it.progress = 20;
      });
      compressedPath = await compressImageLocally(localPath, `comp_${Date.now()}.jpg`);
      if (compressedPath) {
        await prefs.updateQueuedWork(taskId, (it) => {
          it.compressedPhotoPath = compressedPath;
          it.progress = 50;
        });
      } else compressedPath = localPath;
    }

    await prefs.updateQueuedWork(taskId, (it) => {
      it.status = QUEUE_STATUS.IN_QUEUE;
      it.progress = 60;
    });

    let finalImageUrl = currentItem.work.imageUrl || null;
    const pathForB64 = compressedPath || localPath;
    if (pathForB64) {
      const dataUri = await fileToBase64DataUri(pathForB64);
      if (dataUri) finalImageUrl = dataUri;
    }

    const updatedFields = { ...currentItem.work.fieldsData };
    for (const [k, v] of Object.entries(updatedFields)) {
      const vStr = String(v || '');
      if (vStr === currentItem.work.imageUrl) {
        if (finalImageUrl) updatedFields[k] = finalImageUrl;
      } else if (looksLocal(vStr) && (await exists(vStr))) {
        const ownUri = await fileToBase64DataUri(vStr);
        if (ownUri) updatedFields[k] = ownUri;
      }
    }
    const workPayload: InspectionWork = { ...currentItem.work, imageUrl: finalImageUrl, fieldsData: updatedFields };

    await prefs.updateQueuedWork(taskId, (it) => {
      it.status = QUEUE_STATUS.PROCESSING;
      it.progress = 75;
    });

    const enqueueResp = await api.enqueueInspectionWork(workPayload);
    if (!enqueueResp.success || !enqueueResp.jobId) {
      const direct = await api.submitInspectionWork(workPayload);
      if (direct.success && (direct.workId || direct.work)) {
        await onConfirmed(taskId, direct.workId || direct.work?.workId || '#CONFIRMED', localPath, compressedPath);
        return true;
      }
      await handleSlow(taskId, direct.message || 'Server submission error');
      return false;
    }

    const serverJobId = enqueueResp.jobId;
    await prefs.updateQueuedWork(taskId, (it) => {
      it.serverJobId = serverJobId;
      it.status = QUEUE_STATUS.PROCESSING;
      it.progress = 80;
    });

    let finished = false;
    for (let poll = 0; poll < 45 && !finished; poll++) {
      await delay(1000);
      const statusResp = await api.getQueueJobStatus(serverJobId);
      if (statusResp.success && statusResp.job) {
        const job = statusResp.job;
        if (job.status === 'COMPLETED') {
          await onConfirmed(taskId, job.workId || '#CONFIRMED', localPath, compressedPath);
          finished = true;
        } else if (job.status === 'REJECTED_RETRY_FROM_APP' || job.status === 'FAILED') {
          await handleSlow(taskId, job.error || 'Server processing timeout');
          finished = true;
        } else if (job.status === 'PROCESSING') {
          await prefs.updateQueuedWork(taskId, (it) => {
            it.progress = Math.min(95, 80 + poll);
          });
        }
      }
    }
    if (!finished) await handleSlow(taskId, 'Job status check timed out after 45s');
    return finished;
  } catch (e) {
    await handleSlow(taskId, e instanceof Error ? e.message : 'Network/Worker exception');
    return false;
  }
}

async function onConfirmed(taskId: string, workId: string, localPath?: string | null, compressedPath?: string | null) {
  await prefs.updateQueuedWork(taskId, (it) => {
    it.status = QUEUE_STATUS.SUBMITTED;
    it.progress = 100;
    it.workId = workId;
  });
  await cleanLocalFile(compressedPath);
  await cleanLocalFile(localPath);
  const entries = await prefs.getQueue();
  const item = entries.find((e) => e.clientTaskId === taskId);
  if (item) {
    await cleanLocalFile(item.work.imageUrl);
    for (const v of Object.values(item.work.fieldsData)) {
      const p = String(v || '');
      if (p.startsWith('/') || p.startsWith('file:')) await cleanLocalFile(p);
    }
    try {
      await showInspectionNotification(workId, item.work.subjectNameEn || 'Field Work', false);
    } catch {
      /* ignore */
    }
    const offline = await prefs.getOfflineWorks();
    await prefs.setOfflineWorks(offline.filter((w) => w.id !== item.work.id));
  }
  await prefs.removeQueuedWork(taskId);
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

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function syncOfflineWorksForeground(): Promise<InspectionWork[]> {
  const user = await prefs.getCurrentUser();
  if (!user) return [];
  const offline = await prefs.getOfflineWorks();
  if (!offline.length) return [];
  const remaining = [...offline];
  const synced: InspectionWork[] = [];
  for (const work of offline) {
    try {
      let updatedWork = { ...work, fieldsData: { ...work.fieldsData } };
      let primaryUrl = work.imageUrl;
      if (primaryUrl && looksLocal(primaryUrl) && (await exists(primaryUrl))) {
        const uploaded = await api.uploadFile({
          uri: primaryUrl,
          fileName: `${work.id}_photo.jpg`,
          mimeType: 'image/jpeg',
          workId: work.workId,
          userId: user.id || user.username,
          zone: work.zoneNameEn,
          district: work.districtNameEn,
          tp: work.tpNameEn,
        });
        if (uploaded) {
          for (const [k, v] of Object.entries(updatedWork.fieldsData)) {
            if (String(v) === primaryUrl) updatedWork.fieldsData[k] = uploaded;
          }
          primaryUrl = uploaded;
          updatedWork.imageUrl = uploaded;
          await cleanLocalFile(work.imageUrl);
        } else {
          const dataUri = await fileToBase64DataUri(primaryUrl);
          if (dataUri) {
            primaryUrl = dataUri;
            updatedWork.imageUrl = dataUri;
          }
        }
      }
      for (const [key, value] of Object.entries(updatedWork.fieldsData)) {
        const valueStr = String(value || '');
        if (valueStr && looksLocal(valueStr) && (await exists(valueStr))) {
          const uploaded = await api.uploadFile({
            uri: valueStr,
            fileName: `${work.id}_captured_photo_${key}.jpg`,
            mimeType: 'image/jpeg',
            workId: work.workId,
            userId: user.id || user.username,
            zone: work.zoneNameEn,
            district: work.districtNameEn,
            tp: work.tpNameEn,
          });
          if (uploaded) {
            updatedWork.fieldsData[key] = uploaded;
            if (!primaryUrl || looksLocal(primaryUrl)) {
              primaryUrl = uploaded;
              updatedWork.imageUrl = uploaded;
            }
            await cleanLocalFile(valueStr);
          }
        }
      }
      const res = await api.submitInspectionWork(updatedWork);
      if (res.success && res.work) {
        remaining.splice(remaining.indexOf(work), 1);
        await prefs.removeQueuedWorkMatching(
          (it) =>
            it.work.id === work.id ||
            (!!res.work?.workId && (it.workId === res.work.workId || it.work.workId === res.work.workId))
        );
        synced.push(res.work);
        await showInspectionNotification(res.work.workId, res.work.subjectNameEn, false);
      }
    } catch {
      break;
    }
  }
  if (synced.length) await prefs.setOfflineWorks(remaining);
  return synced;
}
