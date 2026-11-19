import type { NextRequest } from 'next/server';
import { isMobileClientRequest } from '@/lib/mobileAppAuth';

/** Browser / web portal login — not the field mobile app. */
export function isWebPortalClientRequest(req: NextRequest, body?: Record<string, unknown>): boolean {
  const header = (req.headers.get('x-client') || req.headers.get('X-Client') || '').trim().toLowerCase();
  if (header === 'web' || header === 'portal') return true;
  const client = String(body?.client || '').trim().toLowerCase();
  if (client === 'web' || client === 'portal') return true;
  return !isMobileClientRequest(req, body);
}

/**
 * Web portal sessions are always portal users for ACL, menus, and scopes —
 * even when the credential lives in `inspectionUsers` or the person also uses the mobile app.
 */
export function applyWebPortalLoginIdentity(user: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!user) return user;
  return {
    ...user,
    isInspectionUser: false,
    isPortalUser: true,
    portalLogin: true,
  };
}