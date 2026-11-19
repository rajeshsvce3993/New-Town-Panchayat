import type { AppUser, PortalState } from '../types/models';

export type WorkGeoLabels = {
  zoneNameEn: string;
  zoneNameTa: string;
  districtNameEn: string;
  districtNameTa: string;
  tpNameEn: string;
  tpNameTa: string;
};

/** Zone / district / TP for work submit & uploads — user login fields first, then portal geo from API bootstrap. */
export function resolveWorkGeoLabels(
  user: AppUser | null | undefined,
  portal: PortalState | null | undefined,
): WorkGeoLabels | null {
  if (!user) return null;

  const zone = portal?.zones?.[0];

  const zoneNameEn = String(user.zone || zone?.nameEn || '').trim();
  const zoneNameTa = String(user.zoneTa || zone?.nameTa || zoneNameEn).trim();

  const dist = portal?.districts?.[0];
  const districtNameEn = String(user.district || dist?.nameEn || '').trim();
  const districtNameTa = String(user.districtTa || dist?.nameTa || districtNameEn).trim();

  const tpId = user.townPanchayatId?.trim();
  const tpFromPortal =
    tpId && portal?.townPanchayats?.length
      ? portal.townPanchayats.find((t) => String(t.id) === tpId)
      : portal?.townPanchayats?.[0];

  const tpNameEn = String(user.townPanchayat || tpFromPortal?.nameEn || '').trim();
  const tpNameTa = String(user.townPanchayatTa || tpFromPortal?.nameTa || tpNameEn).trim();

  if (!zoneNameEn || !districtNameEn || !tpNameEn) return null;

  return {
    zoneNameEn,
    zoneNameTa,
    districtNameEn,
    districtNameTa,
    tpNameEn,
    tpNameTa,
  };
}