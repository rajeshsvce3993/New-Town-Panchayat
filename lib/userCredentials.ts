/** Portal stores plain-text credentials in Mongo for admin-managed accounts. */
export function getUserStoredPassword(user: any): string {
  if (!user) return '';
  return String(user.password || user.passwordHash || '').trim();
}

export function applyUserPasswordFields<T extends Record<string, any>>(
  user: T,
  plainPassword?: string
): T {
  const p =
    plainPassword !== undefined
      ? String(plainPassword).trim()
      : getUserStoredPassword(user);
  if (!p) return user;
  return { ...user, password: p, passwordHash: p };
}

export function mergeUserRecordPreservingPassword(incoming: any, previous: any | undefined): any {
  const merged = { ...(previous || {}), ...incoming };
  const pass =
    getUserStoredPassword(incoming) || getUserStoredPassword(previous);
  if (pass) {
    merged.password = pass;
    merged.passwordHash = pass;
  }
  return merged;
}

export function buildUserCredentialIndex(users: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const u of users || []) {
    const p = getUserStoredPassword(u);
    if (!p) continue;
    if (u.id) map[String(u.id)] = p;
    if (u.username) map[`u:${String(u.username).toLowerCase()}`] = p;
  }
  return map;
}

export function resolvePasswordFromIndex(user: any, index: Record<string, string>): string {
  return (
    getUserStoredPassword(user) ||
    index[String(user?.id || '')] ||
    index[`u:${String(user?.username || '').toLowerCase()}`] ||
    ''
  );
}
