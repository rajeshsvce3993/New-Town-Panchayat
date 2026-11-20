import type { PortalState } from '../types/models';

/** True when live bootstrap has enough data to add inspection work (no legacy scope download). */
export function portalHasInspectionScope(portal: PortalState | null | undefined): boolean {
  if (!portal) return false;
  const subjects = portal.inspectionSubjects?.length || portal.subjects?.length || 0;
  const streets = portal.wardsAndStreets?.length || 0;
  return subjects > 0 && streets > 0;
}