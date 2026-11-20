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
  if (fromPortal === 'hod' || fromPortal === 'zonal' || fromPortal === 'zone') return 'zonal';
  if (fromPortal === 'district' || fromPortal === 'multi_tp') return 'multi_tp';
  if (
    fromPortal === 'single_tp' ||
    fromPortal === 'field_worker' ||
    fromPortal === 'field_workers' ||
    fromPortal === 'townpanchayat'
  ) {
    return 'single_tp';
  }

  if (!user) return 'single_tp';
  const st = key(user.scopeType);
  const role = key(user.roleId || user.role);
  if (st === 'hod' || st === 'state') return 'zonal';
  if (
    st === 'zonal' ||
    st === 'zone' ||
    role === 'role_zonal' ||
    role === 'ad' ||
    /zonal|assistant_director|assistant director/i.test(String(user.role || ''))
  ) {
    return 'zonal';
  }
  if (
    st === 'single_tp' ||
    st === 'field_worker' ||
    st === 'field_workers' ||
    st === 'townpanchayat' ||
    role === 'role_single_tp' ||
    role === 'role_field_worker' ||
    role === 'role_field_workers'
  ) {
    return 'single_tp';
  }
  if (st === 'district' || st === 'multi_tp' || role === 'role_multi_tp' || role === 'role_district') {
    return 'multi_tp';
  }
  if ((user.selectedTpIds?.length ?? 0) > 1) return 'multi_tp';
  return 'single_tp';
}

export function districtPickerLocked(mode: InspectionScopeMode): boolean {
  return mode !== 'zonal';
}

export function tpPickerLocked(mode: InspectionScopeMode): boolean {
  return mode === 'single_tp';
}
