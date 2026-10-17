import type { AppUser, TownPanchayatModel, WardAndStreet } from '../types/models';
import { resolvedTpId } from '../types/models';

export function normalizeWard(w: string): string {
  const cleaned = w
    .trim()
    .replace(/ward/gi, '')
    .trim()
    .replace(/^0+/, '');
  return cleaned || '0';
}

export function matchesTp(
  ws: WardAndStreet,
  user: AppUser | null | undefined,
  userTpId: string,
  townPanchayats: TownPanchayatModel[]
): boolean {
  const wsTp = ws.tpId?.trim() || '';
  const wsTpName = ws.tpNameEn?.trim() || '';
  const uTpId = userTpId.trim();
  const uTpName = user?.townPanchayat?.trim() || '';
  if (!wsTp && !wsTpName) return true;
  if (!uTpId && !uTpName) return true;
  if (wsTp && (wsTp.toLowerCase() === uTpId.toLowerCase() || wsTp.toLowerCase() === uTpName.toLowerCase())) return true;
  if (wsTpName && (wsTpName.toLowerCase() === uTpName.toLowerCase() || wsTpName.toLowerCase() === uTpId.toLowerCase()))
    return true;
  const matchedTp = townPanchayats.find(
    (t) =>
      t.id.toLowerCase() === wsTp.toLowerCase() ||
      t.nameEn.toLowerCase() === wsTpName.toLowerCase() ||
      t.nameEn.toLowerCase() === wsTp.toLowerCase()
  );
  return !!matchedTp && (matchedTp.id.toLowerCase() === uTpId.toLowerCase() || matchedTp.nameEn.toLowerCase() === uTpName.toLowerCase());
}

export function resolveUserTpId(
  user: AppUser | null | undefined,
  townPanchayats: TownPanchayatModel[],
  scopeTpId?: string
): string {
  const id = user?.tpId || resolvedTpId(user);
  if (id) return id;
  if (scopeTpId) return scopeTpId;
  const name = user?.townPanchayat || '';
  if (name) {
    return (
      townPanchayats.find(
        (t) => t.nameEn.toLowerCase() === name.toLowerCase() || t.nameTa.toLowerCase() === name.toLowerCase()
      )?.id || ''
    );
  }
  return '';
}
