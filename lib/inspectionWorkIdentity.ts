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

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Indexed identity $or. No regex — use this on the mobile list hot path. */
export function loginIdentityMongoOr(
  login: string,
  extra?: { userId?: string | null; mobile?: string | null }
): Record<string, unknown>[] {
  const uStr = String(login || '').trim();
  const uLower = uStr.toLowerCase();
  const or: Record<string, unknown>[] = [];
  const push = (field: string, value: string) => {
    if (!value) return;
    or.push({ [field]: value });
    const lower = value.toLowerCase();
    if (lower !== value) or.push({ [field]: lower });
  };
  if (uStr) {
    push('username', uStr);
    push('submittedByUserId', uStr);
    push('submittedByUserName', uStr);
  }
  const extraId = String(extra?.userId || '').trim();
  if (extraId && extraId.toLowerCase() !== uLower) {
    push('submittedByUserId', extraId);
  }
  const extraMobile = String(extra?.mobile || '').trim();
  if (extraMobile && extraMobile.toLowerCase() !== uLower) {
    push('username', extraMobile);
    push('submittedByUserName', extraMobile);
  }
  return or;
}

/** Slower workId regex — only if the indexed identity query returned nothing. */
export function loginIdentityWorkIdRegexOr(login: string): Record<string, unknown>[] {
  const uClean = String(login || '')
    .trim()
    .toLowerCase()
    .replace(/^tp01/g, '')
    .replace(/^tp/g, '')
    .replace(/[^a-z0-9_-]/g, '');
  if (!uClean || uClean.length < 8) return [];
  return [
    { workId: { $regex: new RegExp(`WRK-${escapeRegex(uClean)}-`, 'i') } },
    { workId: { $regex: new RegExp(`-${escapeRegex(uClean)}-`, 'i') } },
  ];
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
