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

function scopeTypeKey(scopeType: unknown): string {
  return String(scopeType || '')
    .toLowerCase()
    .trim()
    .replace(/[\s_-]+/g, '_');
}

/** Zonal-scoped user (single zone) — not state-wide HOD/admin. */
export function isZonalScopedUser(user: any): boolean {
  if (!user || isHodLikeUser(user)) return false;

  const st = scopeTypeKey(user.scopeType);
  if (st === 'zone' || st === 'zonal') return true;

  const r = String(user.roleId || user.role || '').toLowerCase();
  if (r === 'zonal' || (r.includes('zone') && !r.includes('panchayat'))) return true;
  if (r === 'ad' && (st === 'zone' || st === 'zonal')) return true;

  return false;
}

function isTownPanchayatScopedUser(user: any): boolean {
  if (!user || isHodLikeUser(user) || isZonalScopedUser(user)) return false;

  const st = scopeTypeKey(user.scopeType);
  if (st === 'townpanchayat' || st === 'single_tp' || st === 'multi_tp' || st === 'tp') return true;

  const r = String(user.roleId || user.role || '').toLowerCase();
  if (r === 'eo' || r === 'tp' || r.includes('panchayat') || r.includes('town_panchayat') || r.endsWith('_tp')) {
    return true;
  }

  return !!(user.tpId || user.townPanchayatId || user.assignedTpId);
}

/**
 * Align legacy Mongo / CSV scope labels with what dashboard & APIs expect.
 * Call after login and when hydrating localStorage sessions.
 */
export function normalizePortalUserScope(user: any): any {
  if (!user) return user;
  if (isHodLikeUser(user)) {
    return { ...user, scopeType: 'HOD', scopeId: user.scopeId || 'all' };
  }

  const next = { ...user };
  if (isZonalScopedUser(next)) {
    const zoneId =
      next.zoneId && next.zoneId !== 'all'
        ? next.zoneId
        : next.scopeId && next.scopeId !== 'all'
          ? next.scopeId
          : '';
    return {
      ...next,
      scopeType: 'Zone',
      scopeId: zoneId || next.scopeId,
      zoneId: zoneId || next.zoneId,
    };
  }

  if (isTownPanchayatScopedUser(next)) {
    const tpId =
      next.tpId ||
      next.townPanchayatId ||
      next.assignedTpId ||
      (next.scopeId && next.scopeId !== 'all' ? next.scopeId : '');
    return {
      ...next,
      scopeType: 'TownPanchayat',
      scopeId: tpId || next.scopeId,
      tpId: tpId || next.tpId,
      townPanchayatId: tpId || next.townPanchayatId,
    };
  }

  return next;
}

export type PortalGeoMasters = {
  townPanchayats?: any[];
  districts?: any[];
  zones?: any[];
};

/** Scope ids for dashboard KPIs and inspection-works API (works without full geo in bootstrap). */
export function getPortalFilterScopeIds(
  user: any,
  masters: PortalGeoMasters = {},
): { tpId: string | null; districtId: string | null; zoneId: string | null } {
  if (!user || isHodLikeUser(user)) {
    return { tpId: null, districtId: null, zoneId: null };
  }

  const snap = user.portalScope;
  if (snap && (snap.tpId || snap.zoneId || snap.districtId)) {
    return {
      tpId: snap.tpId ? String(snap.tpId) : null,
      districtId: snap.districtId ? String(snap.districtId) : null,
      zoneId: snap.zoneId ? String(snap.zoneId) : null,
    };
  }

  const scoped = normalizePortalUserScope(user);
  const tps = masters.townPanchayats || [];
  const districts = masters.districts || [];
  const zones = masters.zones || [];

  const st = scopeTypeKey(scoped.scopeType);
  if (
    st === 'multi_tp' &&
    Array.isArray(scoped.selectedTpIds) &&
    scoped.selectedTpIds.length > 1
  ) {
    const districtId =
      scoped.districtId && scoped.districtId !== 'all'
        ? String(scoped.districtId)
        : (() => {
            const firstTp = tps.find((t) =>
              scoped.selectedTpIds.some(
                (sel: string) => String(t.id).toLowerCase() === String(sel).toLowerCase(),
              ),
            );
            return firstTp?.districtId ? String(firstTp.districtId) : null;
          })();
    let zoneId = scoped.zoneId && scoped.zoneId !== 'all' ? String(scoped.zoneId) : null;
    if (!zoneId && districtId) {
      const dist = districts.find((d) => String(d.id).toLowerCase() === String(districtId).toLowerCase());
      if (dist?.zoneId) zoneId = String(dist.zoneId);
    }
    return { tpId: null, districtId, zoneId };
  }

  if (isZonalScopedUser(scoped)) {
    const rawZone =
      (scoped.zoneId && scoped.zoneId !== 'all' ? scoped.zoneId : null) ||
      (scoped.scopeId && scoped.scopeId !== 'all' ? scoped.scopeId : null);
    if (rawZone) {
      const rz = String(rawZone).toLowerCase();
      const matched = zones.find(
        (z) =>
          String(z.id).toLowerCase() === rz ||
          String(z.code || '').toLowerCase() === rz ||
          String(z.nameEn || '').toLowerCase() === rz ||
          String(z.nameTa || '').toLowerCase() === rz,
      );
      return { tpId: null, districtId: null, zoneId: matched?.id || String(rawZone) };
    }
    return { tpId: null, districtId: null, zoneId: null };
  }

  const rawTp =
    scoped.tpId ||
    scoped.townPanchayatId ||
    (scoped.scopeId && scoped.scopeId !== 'all' ? scoped.scopeId : null);
  if (rawTp) {
    const rt = String(rawTp).toLowerCase();
    const matched = tps.find(
      (t) =>
        String(t.id).toLowerCase() === rt ||
        String(t.code || '').toLowerCase() === rt ||
        String(t.nameEn || '').toLowerCase() === rt ||
        String(t.nameTa || '').toLowerCase() === rt,
    );
    const tpId = matched?.id || String(rawTp);
    const tpObj = matched || tps.find((t) => String(t.id).toLowerCase() === String(tpId).toLowerCase());
    const districtId =
      scoped.districtId && scoped.districtId !== 'all'
        ? scoped.districtId
        : tpObj?.districtId
          ? String(tpObj.districtId)
          : null;
    let zoneId = scoped.zoneId && scoped.zoneId !== 'all' ? String(scoped.zoneId) : null;
    if (!zoneId && districtId) {
      const dist = districts.find((d) => String(d.id).toLowerCase() === String(districtId).toLowerCase());
      if (dist?.zoneId) zoneId = String(dist.zoneId);
    }
    return { tpId, districtId, zoneId };
  }

  if (scoped.districtId && scoped.districtId !== 'all') {
    const dist = districts.find((d) => String(d.id).toLowerCase() === String(scoped.districtId).toLowerCase());
    return {
      tpId: null,
      districtId: String(scoped.districtId),
      zoneId: dist?.zoneId ? String(dist.zoneId) : scoped.zoneId ? String(scoped.zoneId) : null,
    };
  }

  if (scoped.zoneId && scoped.zoneId !== 'all') {
    return { tpId: null, districtId: null, zoneId: String(scoped.zoneId) };
  }

  return { tpId: null, districtId: null, zoneId: null };
}

/** Hydrate localStorage / SSR session — always a web portal identity (never field-only). */
export function normalizePortalSessionUser(user: any): any {
  if (!user) return user;
  const portalScope = user.portalScope;
  const scoped = normalizePortalUserScope(user);
  return {
    ...scoped,
    portalScope: portalScope || scoped.portalScope || null,
    isInspectionUser: false,
    isPortalUser: true,
    portalLogin: scoped.portalLogin !== false,
  };
}