/** State-wide portal access (all zones / districts / TPs in filters). */
export function isHodLikeUser(user: any): boolean {
  if (!user) return false;
  if (String(user.scopeType || '') === 'HOD') return true;

  const r = String(user.roleId || user.role || '').toLowerCase().trim();
  const u = String(user.username || '').toLowerCase().trim();

  if (['admin', 'director', 'dtpadmin', 'superadmin', 'super admin', 'state'].includes(r)) return true;
  if (r.includes('admin') || r.includes('director')) return true;
  if (['dtpadmin', 'admin', 'director'].includes(u)) return true;

  return false;
}

/** Zonal-scoped user (single zone) — not state-wide HOD/admin. */
export function isZonalScopedUser(user: any): boolean {
  if (!user || isHodLikeUser(user)) return false;
  if (String(user.scopeType || '') === 'Zone') return true;

  const r = String(user.roleId || user.role || '').toLowerCase();
  if (r === 'zonal' || r.includes('zone')) return true;
  if (r === 'ad' && String(user.scopeType || '') === 'Zone') return true;

  return false;
}

/** Ensure stored session users get correct HOD scope for filters. */
export function normalizePortalSessionUser(user: any): any {
  if (!user) return user;
  if (isHodLikeUser(user)) {
    return { ...user, scopeType: 'HOD', scopeId: 'all' };
  }
  return user;
}
