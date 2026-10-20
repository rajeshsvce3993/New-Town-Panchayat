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

export function isLocalPhotoPath(value: unknown): boolean {
  const s = String(value || '').trim();
  if (!s || s === SAMPLE_PHOTO) return false;
  if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:') || s.includes('/api/media')) return false;
  return (
    s.startsWith('file:') ||
    s.startsWith('/') ||
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

async function compressThenUpload(uri: string, fileName: string, meta: PhotoUploadMeta): Promise<{ uploaded: string | null; localFile: string }> {
  const alreadyReady = uri.includes('compressed_uploads') || uri.includes('offline_images');
  const compressed = alreadyReady ? uri : (await compressImageLocally(uri, fileName)) || uri;
  const uploaded = await api.uploadFile({
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
  if (uploaded && compressed !== uri) await cleanLocalFile(compressed);
  return { uploaded, localFile: uploaded ? uri : compressed };
}

export async function persistPhotoToS3OrLocal(
  uri: string,
  fileName: string,
  offlineDir: string,
  meta: PhotoUploadMeta = {}
): Promise<string> {
  const { uploaded, localFile } = await compressThenUpload(uri, fileName, meta);
  if (uploaded) return uploaded;
  if (!offlineDir) return localFile || uri;
  await ensureDir(offlineDir);
  const dest = `${offlineDir}/${fileName}`;
  try {
    if (localFile !== dest) await FileSystem.copyAsync({ from: localFile, to: dest });
    if (localFile !== uri && localFile !== dest) await cleanLocalFile(localFile);
    return dest;
  } catch {
    return localFile || uri;
  }
}

export async function persistPhotosLocalOnly(
  jobs: { key: string; uri: string }[],
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

export async function persistPhotosInParallel(
  jobs: { key: string; uri: string }[],
  offlineDir: string,
  meta: PhotoUploadMeta = {}
): Promise<Record<string, string>> {
  const inflight = new Map<string, Promise<string>>();
  const persistOnce = (uri: string, prefix: string) => {
    const existing = inflight.get(uri);
    if (existing) return existing;
    const pending = persistPhotoToS3OrLocal(uri, uniquePhotoFileName(prefix), offlineDir, meta);
    inflight.set(uri, pending);
    return pending;
  };
  const results = await Promise.all(
    jobs.map(async (job) => ({
      key: job.key,
      url: await persistOnce(job.uri, job.key),
    }))
  );
  return Object.fromEntries(results.map((item) => [item.key, item.url]));
}

export async function uploadLocalPhotosInWork(work: InspectionWork, meta: PhotoUploadMeta = {}): Promise<InspectionWork> {
  const fields = { ...(work.fieldsData || {}) };
  const jobs = Object.entries(fields)
    .filter(([, value]) => isLocalPhotoPath(value))
    .map(([key, value]) => ({ key, uri: String(value) }));
  if (isLocalPhotoPath(work.imageUrl) && !jobs.some((job) => job.uri === work.imageUrl)) {
    jobs.push({ key: '__primary__', uri: String(work.imageUrl) });
  }

  const uploaded = jobs.length ? await persistPhotosInParallel(jobs, '', meta) : {};
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
