/** Canonical login identity for inspection works. Never match on display name. */

export function normalizeWorkIdentity(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/** Display names ("Ramesh Kumar") must not be used to look up or attribute works. */
export function isLoosePersonName(value?: string | null): boolean {
  const v = String(value || '').trim();
  if (!v) return true;
  if (/^\d{10,12}$/.test(v)) return false;
  if (/^(iu|tp|wrk)[_-]/i.test(v)) return false;
  if (/^[a-z0-9._-]{3,}$/i.test(v) && !/\s/.test(v)) return false;
  return /\s/.test(v);
}

export function workIdentityKeys(work: any): string[] {
  return [work?.username, work?.submittedByUserId, work?.submittedByUserName, work?.userId, work?.mobile]
    .map((v) => normalizeWorkIdentity(v))
    .filter((v) => v && !isLoosePersonName(v));
}

export function workBelongsToLogin(work: any, login: string): boolean {
  const needle = normalizeWorkIdentity(login);
  if (!needle) return false;
  if (workIdentityKeys(work).includes(needle)) return true;
  const wid = String(work?.workId || '').toLowerCase();
  if (needle.length >= 8 && (wid.startsWith(`wrk-${needle}-`) || wid.includes(`-${needle}-`))) return true;
  return false;
}

export function userIdentityNeedles(user?: {
  id?: string | null;
  username?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
} | null): string[] {
  if (!user) return [];
  return [user.username, user.id, user.mobile, user.employeeId].map((v) => normalizeWorkIdentity(v)).filter(Boolean);
}

export function workBelongsToUserNeedles(work: any, needles: string[]): boolean {
  const set = new Set(needles.map(normalizeWorkIdentity).filter(Boolean));
  if (!set.size) return false;
  if (workIdentityKeys(work).some((k) => set.has(k))) return true;
  const wid = String(work?.workId || '').toLowerCase();
  for (const needle of set) {
    if (needle.length >= 8 && (wid.startsWith(`wrk-${needle}-`) || wid.includes(`-${needle}-`))) return true;
  }
  return false;
}
