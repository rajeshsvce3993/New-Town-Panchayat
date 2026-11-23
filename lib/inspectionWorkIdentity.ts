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
  return [
    work?.username,
    work?.submittedByUserId,
    work?.submittedByUserName,
    work?.userId,
    work?.mobile,
    work?.employeeId,
  ]
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
  extra?: { userId?: string | null; mobile?: string | null; employeeId?: string | null }
): Record<string, unknown>[] {
  const seen = new Set<string>();
  const or: Record<string, unknown>[] = [];
  const pushValue = (value: string) => {
    const raw = String(value || '').trim();
    if (!raw || isLoosePersonName(raw)) return;
    const lower = raw.toLowerCase();
    if (seen.has(lower)) return;
    seen.add(lower);
    or.push(
      { username: raw },
      { submittedByUserId: raw },
      { submittedByUserName: raw },
      { userId: raw },
      { mobile: raw },
      { employeeId: raw },
    );
    if (lower !== raw) {
      or.push(
        { username: lower },
        { submittedByUserId: lower },
        { submittedByUserName: lower },
        { userId: lower },
        { mobile: lower },
        { employeeId: lower },
      );
    }
  };
  pushValue(login);
  pushValue(extra?.userId || '');
  pushValue(extra?.mobile || '');
  pushValue(extra?.employeeId || '');
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

/** Mongo lookup keys for a saved work — WRK- and older TP… ids, plus the raw id. */
export function inspectionWorkLookupKeys(lookupId: string): string[] {
  const s = String(lookupId || '').trim();
  if (!s) return [];
  const keys = new Set<string>([s]);
  if (/^WRK-/i.test(s)) {
    const rest = s.replace(/^WRK-/i, '');
    keys.add(`TP01-${rest}`);
    keys.add(`TP-${rest}`);
    keys.add(`TP${rest}`);
  } else if (/^TP01-/i.test(s)) {
    keys.add(s.replace(/^TP01-/i, 'WRK-'));
  } else if (/^TP-/i.test(s)) {
    keys.add(s.replace(/^TP-/i, 'WRK-'));
  }
  return [...keys];
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
