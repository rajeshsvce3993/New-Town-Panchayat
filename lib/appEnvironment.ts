const PROD_API_URL = 'https://townpanchayat.com';
const PROD_API_HOST = 'townpanchayat.com';

/** Set APP_ENV=local or APP_ENV=prod in `.env` (web) or EXPO_PUBLIC_APP_ENV in mobile/.env */
export type AppEnv = 'local' | 'prod';

export function getAppEnv(): AppEnv {
  const v = String(process.env.APP_ENV || process.env.NEXT_PUBLIC_APP_ENV || 'local')
    .toLowerCase()
    .trim();
  return v === 'prod' || v === 'production' ? 'prod' : 'local';
}

export function getPortalApiUrl(): string {
  if (getAppEnv() === 'prod') return PROD_API_URL;
  const port = String(process.env.PORT || '3000').trim();
  return `http://localhost:${port}`;
}

export function hostnameOf(value?: string | null): string {
  if (!value) return '';
  const raw = String(value).trim().toLowerCase();
  try {
    const withProto = raw.includes('://') ? raw : `http://${raw}`;
    return new URL(withProto).hostname.replace(/^www\./, '');
  } catch {
    return raw.split(':')[0].replace(/^www\./, '');
  }
}

export function isProductionPortalHost(requestOrigin?: string): boolean {
  return hostnameOf(requestOrigin) === PROD_API_HOST;
}

export function isLocalDevHost(requestOrigin?: string): boolean {
  const host = hostnameOf(requestOrigin);
  if (!host) return false;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  );
}

/**
 * APP_ENV=prod on this laptop → call https://townpanchayat.com (server Mongo).
 * APP_ENV=prod on townpanchayat.com → use that machine's Mongo (no HTTP loop).
 */
export function shouldUseRemotePortalApi(requestOrigin?: string): boolean {
  if (getAppEnv() !== 'prod') return false;
  if (isProductionPortalHost(requestOrigin)) return false;
  return true;
}

/** MongoDB (server-side). */
export function getMongoDbUriFromEnv(): string {
  return process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/dtp_enterprise';
}

export function logPortalEnvironmentOnce(requestOrigin?: string) {
  if ((global as any).__tpPortalEnvLogged) return;
  (global as any).__tpPortalEnvLogged = true;
  const remote = shouldUseRemotePortalApi(requestOrigin);
  console.info(
    `[Portal] APP_ENV=${getAppEnv()} origin=${requestOrigin || '-'} api=${getPortalApiUrl()} data=${remote ? 'remote-prod-api' : 'local-mongo'}`
  );
}
