import type { AppUser, InspectionWork } from '../types/models';

function normalizeWorkIdentity(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isLoosePersonName(value?: string | null): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^\d{10,12}$/.test(v)) return false;
  if (/^(iu|tp|wrk)[_-]/i.test(v)) return false;
  if (/^[a-z0-9._-]{3,}$/i.test(v) && !/\s/.test(v)) return false;
  return /\s/.test(v);
}

function workIdentityKeys(work: InspectionWork): string[] {
  const extra = work as InspectionWork & { username?: string; userId?: string; mobile?: string };
  return [extra.username, work.submittedByUserId, work.submittedByUserName, extra.userId, extra.mobile]
    .map((v) => normalizeWorkIdentity(v))
    .filter((v) => v && !isLoosePersonName(v));
}

export function userIdentityNeedles(user?: AppUser | null): string[] {
  if (!user) return [];
  return [user.username, user.id, user.mobile, user.employeeId].map((v) => normalizeWorkIdentity(v)).filter(Boolean);
}

/** Work belongs to this login only — never match on officer display name. */
export function workBelongsToUser(work: InspectionWork, user: AppUser): boolean {
  const needles = new Set(userIdentityNeedles(user));
  if (!needles.size) return false;
  if (workIdentityKeys(work).some((k) => needles.has(k))) return true;
  const wid = String(work.workId || '').toLowerCase();
  if (!wid) return false;
  for (const needle of needles) {
    if (needle.length >= 8 && (wid.startsWith(`wrk-${needle}-`) || wid.includes(`-${needle}-`))) return true;
  }
  return false;
}
