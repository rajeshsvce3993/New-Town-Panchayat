import * as FileSystem from 'expo-file-system/legacy';
import { api } from '../api/client';
import { SAMPLE_PHOTO } from '../constants/config';
import type { InspectionWork } from '../types/models';
import { cleanLocalFile, compressImageLocally, ensureDir } from './imageCompression';

export type PhotoUploadMeta = {
  workId?: string | null;
  userId?: string | null;
  username?: string | null;
  zone?: string | null;
  district?: string | null;
  tp?: string | null;
};

function createLock() {
  let locked = false;
  const waiters: Array<() => void> = [];
  return async function withLock<T>(fn: () => Promise<T>): Promise<T> {
    await new Promise<void>((resolve) => {
      if (!locked) {
        locked = true;
        resolve();
      } else {
        waiters.push(resolve);
      }
    });
    try {
      return await fn();
    } finally {
      const next = waiters.shift();
      if (next) next();
      else locked = false;
    }
  };
}

const withOnlinePhotoLock = createLock();
const withQueuedPhotoLock = createLock();

export function isLocalPhotoPath(value: unknown): boolean {
  const s = String(value || '').trim();
  if (!s || s === SAMPLE_PHOTO) return false;
  if (s.startsWith('http') || s.startsWith('https') || s.startsWith('data:') || s.startsWith('blob:')) return false;
  if (s.includes('/api/media') || s.startsWith('/uploads/') || s.startsWith('inspection/')) return false;
  return (
    s.startsWith('file:') ||
    s.startsWith('content:') ||
    s.startsWith('/data/') ||
    s.startsWith('/storage/') ||
    s.includes('offline_images') ||
    s.includes('raw_uploads') ||
    s.includes('compressed_uploads')
  );
}

export function workHasLocalPhotos(work: { imageUrl?: string | null; fieldsData?: Record<string, unknown> }): boolean {
  if (isLocalPhotoPath(work.imageUrl)) return true;
  return Object.values(work.fieldsData || {}).some((v) => isLocalPhotoPath(v));
}

export function uniquePhotoFileName(prefix: string): string {
  const safe = String(prefix || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return `${Date.now()}_${safe}_${Math.random().toString(16).slice(2, 10)}.jpg`;
}

type PhotoJob = { key: string; uri: string };
type UploadFn = (opts: {
  uri: string;
  fileName: string;
  mimeType: string;
  workId?: string | null;
  userId?: string | null;
  username?: string | null;
  zone?: string | null;
  district?: string | null;
  tp?: string | null;
}) => Promise<string | null>;

async function compressForUpload(uri: string, fileName: string): Promise<string> {
  const alreadyReady = uri.includes('compressed_uploads') || uri.includes('offline_images');
  return alreadyReady ? uri : (await compressImageLocally(uri, fileName)) || uri;
}

async function uploadPhotosViaApi(
  jobs: PhotoJob[],
  meta: PhotoUploadMeta,
  uploadFn: UploadFn,
  uploadLock: <T>(fn: () => Promise<T>) => Promise<T>
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const seen = new Map<string, string>();
  for (const job of jobs) {
    if (!job.uri) continue;
    if (!isLocalPhotoPath(job.uri)) {
      out[job.key] = job.uri;
      continue;
    }
    const reused = seen.get(job.uri);
    if (reused) {
      out[job.key] = reused;
      continue;
    }
    const fileName = uniquePhotoFileName(job.key);
    const url = await uploadLock(async () => {
      const compressed = await compressForUpload(job.uri, fileName);
      const uploaded = await uploadFn({
        uri: compressed,
        fileName,
        mimeType: 'image/jpeg',
        workId: meta.workId,
        userId: meta.userId,
        username: meta.username,
        zone: meta.zone,
        district: meta.district,
        tp: meta.tp,
      });
      if (uploaded && compressed !== job.uri) await cleanLocalFile(compressed);
      return uploaded;
    });
    const finalUrl = url || job.uri;
    seen.set(job.uri, finalUrl);
    out[job.key] = finalUrl;
  }
  return out;
}

function applyUploadedPhotos(work: InspectionWork, jobs: PhotoJob[], uploaded: Record<string, string>): InspectionWork {
  const fields = { ...(work.fieldsData || {}) };
  for (const [key, url] of Object.entries(uploaded)) {
    if (key !== '__primary__') fields[key] = url;
  }
  let imageUrl = work.imageUrl || '';
  if (uploaded.__primary__) {
    imageUrl = uploaded.__primary__;
  } else if (isLocalPhotoPath(imageUrl)) {
    const same = jobs.find((job) => job.uri === work.imageUrl);
    if (same && uploaded[same.key]) imageUrl = uploaded[same.key];
  }
  if (!imageUrl) {
    const firstRemote = Object.values(fields).find((v) => String(v || '').startsWith('http'));
    if (firstRemote) imageUrl = String(firstRemote);
  }
  return { ...work, imageUrl, fieldsData: fields };
}

function localPhotoJobsFromWork(work: InspectionWork): PhotoJob[] {
  const fields = work.fieldsData || {};
  const jobs = Object.entries(fields)
    .filter(([, value]) => isLocalPhotoPath(value))
    .map(([key, value]) => ({ key, uri: String(value) }));
  if (isLocalPhotoPath(work.imageUrl) && !jobs.some((job) => job.uri === work.imageUrl)) {
    jobs.push({ key: '__primary__', uri: String(work.imageUrl) });
  }
  return jobs;
}

/** Online Add Work: S3 only. Never copies into the offline folder. */
export async function uploadPhotosOnlineApi(
  jobs: PhotoJob[],
  meta: PhotoUploadMeta = {}
): Promise<Record<string, string>> {
  return uploadPhotosViaApi(jobs, meta, (opts) => api.uploadPhotoOnlineApi(opts), withOnlinePhotoLock);
}

/** Offline Add Work: local files only. Never calls the upload API. */
export async function savePhotosOfflineLocal(
  jobs: PhotoJob[],
  offlineDir: string
): Promise<Record<string, string>> {
  await ensureDir(offlineDir);
  const out: Record<string, string> = {};
  const copied = new Map<string, string>();
  for (const job of jobs) {
    if (!job.uri) continue;
    if (!isLocalPhotoPath(job.uri)) {
      out[job.key] = job.uri;
      continue;
    }
    const cached = copied.get(job.uri);
    if (cached) {
      out[job.key] = cached;
      continue;
    }
    const dest = `${offlineDir}/${uniquePhotoFileName(job.key)}`;
    try {
      await FileSystem.copyAsync({ from: job.uri, to: dest });
      copied.set(job.uri, dest);
      out[job.key] = dest;
    } catch {
      out[job.key] = job.uri;
    }
  }
  return out;
}

/** Queue sync: S3 only, one photo at a time. Never used by Add Work online. */
export async function uploadQueuedPhotosInWork(
  work: InspectionWork,
  meta: PhotoUploadMeta = {}
): Promise<InspectionWork> {
  const jobs = localPhotoJobsFromWork(work);
  if (!jobs.length) return work;
  const uploaded = await uploadPhotosViaApi(jobs, meta, (opts) => api.uploadQueuedPhotoApi(opts), withQueuedPhotoLock);
  return applyUploadedPhotos(work, jobs, uploaded);
}

export const persistPhotosLocalOnly = savePhotosOfflineLocal;
export const persistPhotosInParallel = uploadPhotosOnlineApi;
export const uploadLocalPhotosInWork = uploadQueuedPhotosInWork;

export async function persistPhotoToS3OrLocal(
  uri: string,
  fileName: string,
  offlineDir: string,
  meta: PhotoUploadMeta = {}
): Promise<string> {
  void fileName;
  if (offlineDir) {
    const saved = await savePhotosOfflineLocal([{ key: 'photo', uri }], offlineDir);
    return saved.photo || uri;
  }
  const uploaded = await uploadPhotosOnlineApi([{ key: 'photo', uri }], meta);
  return uploaded.photo || uri;
}

export async function cleanLocalPhotosFromWork(work?: {
  imageUrl?: string | null;
  fieldsData?: Record<string, unknown>;
  documentUrl?: string | null;
} | null) {
  if (!work) return;
  await cleanLocalFile(work.imageUrl);
  await cleanLocalFile(work.documentUrl);
  for (const value of Object.values(work.fieldsData || {})) {
    if (isLocalPhotoPath(value)) await cleanLocalFile(String(value));
  }
}

export async function cleanLocalPhotoUris(uris: Array<string | null | undefined>) {
  for (const uri of uris) {
    if (isLocalPhotoPath(uri)) await cleanLocalFile(uri);
  }
}
