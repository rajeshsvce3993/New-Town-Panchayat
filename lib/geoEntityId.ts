/** Canonical Mongo master row id for geo trees and API params. */
export function geoEntityId(row: { id?: string; zoneId?: string; districtId?: string; code?: string } | null | undefined): string {
  if (!row) return '';
  const id = String(row.id ?? row.zoneId ?? row.districtId ?? row.code ?? '').trim();
  return id;
}

/** Distinguish town panchayat master rows from inspection user rows in tree UIs. */
export function isTownPanchayatMasterRow(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  if (row.username != null && String(row.username).trim() !== '') return false;
  if (row.roleId || row.designationId) return false;
  return !!(row.districtId || String(row.id || '').startsWith('tp_'));
}