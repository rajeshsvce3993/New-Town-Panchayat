import type { AppUser, PortalState } from '../types/models';

export type WorkGeoLabels = {
  zoneNameEn: string;
  zoneNameTa: string;
  districtNameEn: string;
  districtNameTa: string;
  tpNameEn: string;
  tpNameTa: string;
};

export type WorkGeoSelection = {
  districtId?: string;
  tpId?: string;
};

/** Zone / district / TP for work submit — optional selection from Add Work district/TP pickers. */
export function resolveWorkGeoLabels(
  user: AppUser | null | undefined,
  portal: PortalState | null | undefined,
  selection?: WorkGeoSelection,
): WorkGeoLabels | null {
  if (!user) return null;

  const distId = String(selection?.districtId || user.districtId || '').trim();
  const tpPickId = String(selection?.tpId || user.tpId || user.townPanchayatId || '').trim();

  const pickDist =
    (distId && portal?.districts?.find((d) => String(d.id) === distId)) ||
    (user.district &&
      portal?.districts?.find(
        (d) =>
          d.nameEn?.toLowerCase() === user.district!.toLowerCase() ||
          d.nameTa?.toLowerCase() === user.district!.toLowerCase(),
      ));

  const pickTp =
    (tpPickId && portal?.townPanchayats?.find((t) => String(t.id) === tpPickId)) ||
    (user.townPanchayat &&
      portal?.townPanchayats?.find(
        (t) =>
          t.nameEn?.toLowerCase() === user.townPanchayat!.toLowerCase() ||
          t.nameTa?.toLowerCase() === user.townPanchayat!.toLowerCase(),
      ));

  if (!pickTp?.nameEn && !pickTp?.nameTa) return null;

  const zone =
    (pickTp?.zoneId && portal?.zones?.find((z) => String(z.id) === String(pickTp.zoneId))) ||
    (pickDist?.zoneId && portal?.zones?.find((z) => String(z.id) === String(pickDist.zoneId))) ||
    (user.zoneId && portal?.zones?.find((z) => String(z.id) === String(user.zoneId)));

  const tpNameEn = String(pickTp?.nameEn || '').trim();
  const tpNameTa = String(pickTp?.nameTa || tpNameEn).trim();
  if (!tpNameEn) return null;

  const pickDistFromTp =
    !pickDist && pickTp?.districtId
      ? portal?.districts?.find((d) => String(d.id) === String(pickTp.districtId))
      : pickDist;

  const districtNameEn = String(pickDistFromTp?.nameEn || user.district || '').trim();
  const districtNameTa = String(pickDistFromTp?.nameTa || user.districtTa || districtNameEn).trim();
  if (!districtNameEn) return null;

  const zoneNameEn = String(zone?.nameEn || user.zone || '').trim();
  const zoneNameTa = String(zone?.nameTa || user.zoneTa || zoneNameEn).trim();

  return {
    zoneNameEn: zoneNameEn || zoneNameTa || '—',
    zoneNameTa: zoneNameTa || zoneNameEn || '—',
    districtNameEn,
    districtNameTa,
    tpNameEn,
    tpNameTa,
  };
}