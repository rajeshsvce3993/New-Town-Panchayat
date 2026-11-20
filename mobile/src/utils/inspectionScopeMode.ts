import type { AppUser, PortalState } from '../types/models';

export type InspectionScopeMode = 'zonal' | 'multi_tp' | 'single_tp';

function key(value?: string | null): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
}

/** How district / TP pickers behave on Add Work. Live `scopeKind` from geo/me wins over stale user.scopeType. */
export function resolveInspectionScopeMode(
  user?: AppUser | null,
  portal?: PortalState | null,
): InspectionScopeMode {
  const fromPortal = key(portal?.scopeKind);
  if (fromPortal === 'hod' || fromPortal === 'zonal' || fromPortal === 'district') return 'zonal';
  if (fromPortal === 'multi_tp') return 'multi_tp';
  if (fromPortal === 'single_tp' || fromPortal === 'field_worker' || fromPortal === 'field_workers') {
    return 'single_tp';
  }

  if (!user) return 'single_tp';
  const st = key(user.scopeType);
  const role = key(user.roleId || user.role);
  if (st === 'hod' || st === 'state') return 'zonal';
  if (
    st === 'zonal' ||
    st === 'zone' ||
    st === 'district' ||
    role === 'role_zonal' ||
    role === 'ad' ||
    /zonal|assistant_director|assistant director/i.test(String(user.role || ''))
  ) {
    return 'zonal';
  }
  if (st === 'multi_tp' || role === 'role_multi_tp' || (user.selectedTpIds?.length ?? 0) > 1) return 'multi_tp';
  return 'single_tp';
}
