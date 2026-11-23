import type { InspectionWork } from '../types/models';

export function isAssignedWorkId(value?: string | null): boolean {
  return /^WRK-/i.test(String(value || '').trim());
}

/** Saved server work ids shown on dashboard/reports (new WRK- and older TP… ids). */
export function isListedWorkId(value?: string | null): boolean {
  const s = String(value || '').trim();
  if (!s) return false;
  if (/^WRK-/i.test(s)) return true;
  if (/^TP01-/i.test(s) || /^TP-/i.test(s)) return true;
  return /^TP\d{8,}$/i.test(s);
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
  const saved = payload?.work;
  if (!saved) return { id: clientId, workId } as InspectionWork;
  // Keep the client uuid as `id` so queue merge/dedupe still matches the local row
  // even when Mongo returns a different document id or WRK- as id.
  return { ...saved, id: clientId, workId };
}

export function isNetworkFailure(message?: string): boolean {
  return /network|timeout|fetch|unreachable|connection|failed to upload|abort/i.test(String(message || ''));
}
