import type { AppUser } from '../types/models';

export type InspectionScopeMode = 'zonal' | 'multi_tp' | 'single_tp';

/** How district / TP pickers behave on Add Work. */
export function resolveInspectionScopeMode(user?: AppUser | null): InspectionScopeMode {
  if (!user) return 'single_tp';
  const st = String(user.scopeType || '').toLowerCase().replace(/\s+/g, '_');
  if (st === 'hod' || st === 'zonal' || st === 'zone') return 'zonal';
  if (st === 'multi_tp' || (user.selectedTpIds?.length ?? 0) > 1) return 'multi_tp';
  if (/zonal|zone.*inspector/i.test(user.role || '')) return 'zonal';
  return 'single_tp';
}