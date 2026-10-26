import type { InspectionWork } from '../types/models';
import type { PhotoUploadMeta } from '../utils/photoPersist';
import { submitAddWork, type SubmitPhotoJob } from './workPipeline';

export type { SubmitPhotoJob };

export type OnlineSaveResult =
  | { ok: true; saved: InspectionWork }
  | { ok: false; message: string };

export async function saveWorkOnline(
  baseWork: InspectionWork,
  photoJobs: SubmitPhotoJob[],
  photoMeta: PhotoUploadMeta
): Promise<OnlineSaveResult> {
  const result = await submitAddWork({ work: baseWork, photoJobs, photoMeta });
  if (result.status === 'online') return { ok: true, saved: result.saved };
  if (result.status === 'queued') {
    return { ok: false, message: 'Network error: work was queued for later sync' };
  }
  return { ok: false, message: result.message };
}

export const submitWorkOnline = saveWorkOnline;
