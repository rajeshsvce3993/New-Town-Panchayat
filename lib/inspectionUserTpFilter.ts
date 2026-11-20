/** Mongo filter for inspection users tied to a town panchayat (id variants + optional name). */

export function tpIdVariants(tpId: string): string[] {
  const id = String(tpId || '').trim();
  if (!id) return [];
  return [...new Set([id, id.toLowerCase(), id.toUpperCase()].filter(Boolean))];
}

export function buildInspectionUsersTpMongoFilter(
  tpId: string,
  opts?: { tpNameEn?: string; zoneId?: string; districtId?: string; includeNameMatch?: boolean },
): Record<string, unknown> {
  const ids = tpIdVariants(tpId);
  const or: Record<string, unknown>[] = [];
  if (ids.length) {
    or.push(
      { tpId: { $in: ids } },
      { townPanchayatId: { $in: ids } },
      { assignedTpId: { $in: ids } },
      { selectedTpIds: { $in: ids } },
      { townPanchayatIds: { $in: ids } },
      { scopeId: { $in: ids } },
    );
  }
  const name = String(opts?.tpNameEn || '').trim();
  if (name && opts?.includeNameMatch !== false) {
    or.push({ townPanchayat: name }, { tpName: name }, { townPanchayatNameEn: name });
  }
  const zoneId = String(opts?.zoneId || '').trim();
  const districtId = String(opts?.districtId || '').trim();
  if (zoneId) or.push({ zoneId });
  if (districtId) or.push({ districtId });

  if (!or.length) return {};
  if (or.length === 1) return or[0];
  return { $or: or };
}