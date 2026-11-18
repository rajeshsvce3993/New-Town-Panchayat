import type { NextRequest } from 'next/server';

/** Role hints allowed to use the field mobile app (aligned with /api/mobile/config). */
const MOBILE_ALLOWED_ROLE_HINTS = [
  'admin',
  'ad',
  'eo',
  'zonal',
  'employee',
  'role_single_tp',
  'role_multi_tp',
  'role_zonal',
  'role_field_worker',
  'single_tp',
  'multi_tp',
  'zonal_inspector',
  'field_worker',
  'inspection',
  'inspector',
  'field',
  'officer',
  'worker',
  'animator',
  'supervisor',
  'tp',
];

export const MOBILE_LOGIN_DENIED_EN =
  'Access denied: Only administrators or field inspection officers may use the mobile app.';
export const MOBILE_LOGIN_DENIED_TA =
  'அணுகல் மறுக்கப்பட்டது: நிர்வாகிகள் அல்லது கள ஆய்வு பணியாளர்கள் மட்டுமே மொபைல் செயலியைப் பயன்படுத்த முடியும்.';

export function isMobileClientRequest(req: NextRequest, body?: Record<string, unknown>): boolean {
  const header = (req.headers.get('x-client') || req.headers.get('X-Client') || '').trim().toLowerCase();
  if (header === 'mobile' || header === 'town-panchayat-ems') return true;
  const client = String(body?.client || '').trim().toLowerCase();
  if (client === 'mobile') return true;
  return false;
}

export function userMayUseMobileApp(user: Record<string, unknown>, sourceCollection: string): boolean {
  if (!user) return false;
  if (sourceCollection === 'inspectionUsers') return true;
  if (user.isInspectionUser === true) return true;

  const role = String(user.role || user.roleId || '').toLowerCase();
  if (!role) return false;
  if (role.includes('admin') || role.includes('director')) return true;
  if (MOBILE_ALLOWED_ROLE_HINTS.some((hint) => role.includes(hint))) return true;

  const id = String(user.id || '').toLowerCase();
  if (id.startsWith('iu_')) return true;

  return false;
}

export function mobileLoginDeniedMessage(isTamil?: boolean): string {
  return isTamil ? MOBILE_LOGIN_DENIED_TA : MOBILE_LOGIN_DENIED_EN;
}