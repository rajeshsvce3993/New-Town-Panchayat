import type { InspectionWork } from '../types/models';

export function isAssignedWorkId(value?: string | null): boolean {
  return /^WRK-/i.test(String(value || '').trim());
}

export function readAssignedWorkId(payload: {
  success?: boolean;
  workId?: string | null;
  work?: { id?: string | null; workId?: string | null } | null;
} | null): string {
  if (!payload?.success) return '';
  return String(payload.work?.workId || payload.workId || '').trim();
}

/** Server saved this row when the response has a WRK- id. */
export function toSavedWork(
  payload: {
    success?: boolean;
    workId?: string | null;
    work?: InspectionWork | null;
  } | null,
  clientId: string
): InspectionWork | null {
  const workId = readAssignedWorkId(payload);
  if (!isAssignedWorkId(workId)) return null;
  const returnedId = String(payload?.work?.id || '').trim();
  if (returnedId && returnedId !== clientId) return null;
  return {
    ...(payload?.work || {}),
    id: returnedId || clientId,
    workId,
  };
}

export function isNetworkFailure(message?: string): boolean {
  return /network|timeout|fetch|unreachable|connection|failed to upload|abort/i.test(String(message || ''));
}
