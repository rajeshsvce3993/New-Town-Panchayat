import type { AppUser, DistrictModel, PortalState, TownPanchayatModel } from '../types/models';
import { effectiveWards } from '../types/models';
import { resolveInspectionScopeMode, type InspectionScopeMode } from './inspectionScopeMode';

function norm(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function geoRowLabel(row?: { nameEn?: string; nameTa?: string } | null, isTamil = false): string {
  if (!row) return '';
  return (isTamil ? row.nameTa || row.nameEn : row.nameEn || row.nameTa || '').trim();
}

function namesMatch(row: { nameEn?: string; nameTa?: string }, name?: string | null): boolean {
  const n = norm(name);
  if (!n) return false;
  return norm(row.nameEn) === n || norm(row.nameTa) === n;
}

export function resolveAssignedDistrict(
  user?: AppUser | null,
  portal?: PortalState | null,
): DistrictModel | null {
  const districts = portal?.districts || [];
  const tps = portal?.townPanchayats || [];
  if (!districts.length) return null;
  const byId = districts.find((d) => user?.districtId && String(d.id) === String(user.districtId));
  if (byId) return byId;
  const byName = districts.find((d) => namesMatch(d, user?.district) || namesMatch(d, user?.districtTa));
  if (byName) return byName;
  const tp =
    tps.find((t) => user?.tpId && String(t.id) === String(user.tpId)) ||
    tps.find((t) => namesMatch(t, user?.townPanchayat) || namesMatch(t, user?.townPanchayatTa)) ||
    tps[0];
  const fromTp = tp?.districtId ? districts.find((d) => String(d.id) === String(tp.districtId)) : null;
  if (fromTp) return fromTp;
  return districts[0] || null;
}

export function resolveAssignedTownPanchayat(
  user?: AppUser | null,
  portal?: PortalState | null,
): TownPanchayatModel | null {
  const tps = portal?.townPanchayats || [];
  if (!tps.length) return null;
  const uid = String(user?.tpId || user?.townPanchayatId || '').trim();
  const byId = tps.find((t) => uid && String(t.id) === uid);
  if (byId) return byId;
  const byName = tps.find((t) => namesMatch(t, user?.townPanchayat) || namesMatch(t, user?.townPanchayatTa));
  if (byName) return byName;
  if (tps.length === 1) return tps[0];
  return null;
}

export type ProfilePlaceItem = { label: string; value: string };

export function resolveProfilePlace(
  user?: AppUser | null,
  portal?: PortalState | null,
  isTamil = false,
): { mode: InspectionScopeMode; items: ProfilePlaceItem[] } {
  const mode = resolveInspectionScopeMode(user, portal);
  const districts = portal?.districts || [];
  const tps = portal?.townPanchayats || [];
  const zone = portal?.zones?.[0];
  const zoneName =
    geoRowLabel(zone, isTamil) || String(isTamil ? user?.zoneTa || user?.zone : user?.zone || '').trim();
  const dash = '—';
  const wardList = effectiveWards(user);
  const wardText = wardList.length ? wardList.join(', ') : isTamil ? 'அனைத்தும்' : 'All';

  const districtLbl = isTamil ? 'மாவட்டம்' : 'District';
  const tpLbl = isTamil ? 'பேரூராட்சி' : 'TP';
  const zoneLbl = isTamil ? 'மண்டலம்' : 'Zone';
  const wardLbl = isTamil ? 'வார்டு' : 'Wards';

  if (mode === 'zonal') {
    return {
      mode,
      items: [
        { label: zoneLbl, value: zoneName || dash },
        {
          label: districtLbl,
          value: districts.length
            ? isTamil
              ? `${districts.length} மாவட்டங்கள்`
              : `${districts.length} districts`
            : dash,
        },
        {
          label: tpLbl,
          value: tps.length ? (isTamil ? `${tps.length} பேரூராட்சிகள்` : `${tps.length} TPs`) : dash,
        },
      ],
    };
  }

  const district = resolveAssignedDistrict(user, portal);
  const districtName = geoRowLabel(district, isTamil) || dash;

  if (mode === 'multi_tp') {
    const tpValue =
      tps.length === 1
        ? geoRowLabel(tps[0], isTamil) || dash
        : tps.length
          ? isTamil
            ? `${tps.length} பேரூராட்சிகள்`
            : `${tps.length} TPs`
          : dash;
    return {
      mode,
      items: [
        { label: districtLbl, value: districtName },
        { label: tpLbl, value: tpValue },
        { label: wardLbl, value: wardText },
      ],
    };
  }

  const tp = resolveAssignedTownPanchayat(user, portal);
  const tpName = geoRowLabel(tp, isTamil) || dash;
  return {
    mode,
    items: [
      { label: tpLbl, value: tpName },
      { label: districtLbl, value: districtName },
      { label: wardLbl, value: wardText },
    ],
  };
}

export function addWorkDistrictOptions(
  user: AppUser | null | undefined,
  portal: PortalState | null | undefined,
  scopeMode: InspectionScopeMode,
  isTamil: boolean,
): { id: string; label: string }[] {
  const districts = portal?.districts || [];
  const toOpt = (d: DistrictModel) => ({ id: d.id, label: geoRowLabel(d, isTamil) || d.id });
  if (scopeMode === 'zonal') return districts.map(toOpt);
  const assigned = resolveAssignedDistrict(user, portal);
  if (assigned) return [toOpt(assigned)];
  return districts.map(toOpt);
}

export function addWorkTpOptions(
  user: AppUser | null | undefined,
  portal: PortalState | null | undefined,
  scopeMode: InspectionScopeMode,
  districtId: string,
  isTamil: boolean,
): { id: string; label: string }[] {
  const tps = portal?.townPanchayats || [];
  const toOpt = (t: TownPanchayatModel) => ({ id: t.id, label: geoRowLabel(t, isTamil) || t.id });
  if (scopeMode === 'single_tp') {
    const assigned = resolveAssignedTownPanchayat(user, portal);
    if (assigned) return [toOpt(assigned)];
    return tps.map(toOpt);
  }
  let list = tps;
  if (scopeMode === 'zonal' && districtId) {
    list = list.filter((t) => String(t.districtId || '') === String(districtId));
  }
  if (scopeMode === 'multi_tp') {
    const allowed = new Set((user?.selectedTpIds || []).map(String).filter(Boolean));
    if (allowed.size) list = list.filter((t) => allowed.has(String(t.id)));
    else if (districtId) list = list.filter((t) => String(t.districtId || '') === String(districtId));
  }
  return list.map(toOpt);
}
