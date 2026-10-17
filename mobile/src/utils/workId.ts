import type { AppUser, InspectionWork, PortalState } from '../types/models';

export function nextWorkId(user: AppUser | null | undefined, portal: PortalState, selectedWard: string): {
  workId: string;
  distCode: string;
  townCode: string;
} {
  const districts = portal.districts || [];
  const tps = portal.townPanchayats || [];
  const works = portal.inspectionWorks?.length ? portal.inspectionWorks : portal.works || [];

  const distCode =
    user?.districtCode?.replace(/\D/g, '').padStart(2, '0') ||
    districts
      .find(
        (d) =>
          (user?.districtId && d.id === user.districtId) ||
          (user?.district &&
            (d.nameEn.toLowerCase() === user.district.toLowerCase() ||
              d.nameTa.toLowerCase() === user.district.toLowerCase()))
      )
      ?.code?.replace(/\D/g, '')
      .padStart(2, '0') ||
    '03';

  const townCode =
    user?.tpCode?.replace(/\D/g, '').padStart(2, '0') ||
    tps
      .find(
        (t) =>
          (user?.tpId && t.id === user.tpId) ||
          (user?.townPanchayat &&
            (t.nameEn.toLowerCase() === user.townPanchayat.toLowerCase() ||
              t.nameTa.toLowerCase() === user.townPanchayat.toLowerCase()))
      )
      ?.code?.replace(/\D/g, '')
      .padStart(2, '0') ||
    '01';

  const wardDigits = selectedWard.replace(/\D/g, '') || '1';
  const ward2Digit = wardDigits.padStart(2, '0');
  const wardPrefix = `TP${distCode}${townCode}${ward2Digit}`;
  const existing = works
    .map((w: InspectionWork) => w.workId)
    .filter((id) => id.startsWith(wardPrefix) && id.length === 13)
    .map((id) => Number(id.substring(8)))
    .filter((n) => !Number.isNaN(n));
  const next = (existing.length ? Math.max(...existing) : 0) + 1;
  return {
    workId: `${wardPrefix}${String(next).padStart(5, '0')}`,
    distCode,
    townCode,
  };
}
