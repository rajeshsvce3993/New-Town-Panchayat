import type { AppUser, PortalState } from '../types/models';
import { isPlaceholderGeoName } from './workPlace';

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

function liveText(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text && !isPlaceholderGeoName(text)) return text;
  }
  return '';
}

/** Zone / district / TP for work submit — live portal rows only, no placeholder names. */
export function resolveWorkGeoLabels(
  user: AppUser | null | undefined,
  portal: PortalState | null | undefined,
  selection?: WorkGeoSelection,
): WorkGeoLabels | null {
  if (!user) return null;

  const distId = String(selection?.districtId || user.districtId || '').trim();
  const tpPickId = String(selection?.tpId || user.tpId || user.townPanchayatId || '').trim();

  const pickDist = distId ? portal?.districts?.find((d) => String(d.id) === distId) : undefined;
  const pickTp = tpPickId ? portal?.townPanchayats?.find((t) => String(t.id) === tpPickId) : undefined;

  const tpNameEn = liveText(pickTp?.nameEn);
  const tpNameTa = liveText(pickTp?.nameTa, tpNameEn);
  if (!tpNameEn) return null;

  const pickDistFromTp =
    pickDist ||
    (pickTp?.districtId ? portal?.districts?.find((d) => String(d.id) === String(pickTp.districtId)) : undefined);

  const districtNameEn = liveText(pickDistFromTp?.nameEn);
  const districtNameTa = liveText(pickDistFromTp?.nameTa, districtNameEn);
  if (!districtNameEn) return null;

  const zone =
    (pickTp?.zoneId && portal?.zones?.find((z) => String(z.id) === String(pickTp.zoneId))) ||
    (pickDistFromTp?.zoneId && portal?.zones?.find((z) => String(z.id) === String(pickDistFromTp.zoneId))) ||
    (user.zoneId && portal?.zones?.find((z) => String(z.id) === String(user.zoneId)));

  return {
    zoneNameEn: liveText(zone?.nameEn),
    zoneNameTa: liveText(zone?.nameTa, zone?.nameEn),
    districtNameEn,
    districtNameTa,
    tpNameEn,
    tpNameTa,
  };
}
