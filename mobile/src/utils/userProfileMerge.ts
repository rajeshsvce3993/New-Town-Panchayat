import type { AppUser } from '../types/models';

/** Merge live Mongo profile fields onto session user (designation, names, photo URL). */
export function mergeLiveProfileOntoUser(
  user: AppUser,
  profile?: Record<string, unknown> | null,
  profilePhotoUrl?: string | null,
): AppUser {
  if (!profile && !profilePhotoUrl) return user;
  const next: AppUser = { ...user };
  if (profile) {
    const dEn = String(profile.designationNameEn || profile.designation || '').trim();
    const dTa = String(profile.designationNameTa || '').trim();
    if (dEn) {
      next.designation = dEn;
      next.designationNameEn = dEn;
    }
    if (dTa) next.designationNameTa = dTa;
    if (profile.designationId) next.designationId = String(profile.designationId);
    const role = String(profile.role || '').trim();
    if (role) next.role = role;
    const roleTa = String(profile.roleNameTa || '').trim();
    if (roleTa) next.roleNameTa = roleTa;
    if (profile.name) next.name = String(profile.name);
    if (profile.nameEn) next.nameEn = String(profile.nameEn);
    if (profile.nameTa) next.nameTa = String(profile.nameTa);
  }
  const photo = String(profilePhotoUrl || '').trim();
  if (photo) {
    const clean = photo.includes('amazonaws.com') && photo.includes('?') ? photo.split('?')[0] : photo;
    next.profilePhotoUrl = clean;
    next.avatarUrl = clean;
  }
  return next;
}