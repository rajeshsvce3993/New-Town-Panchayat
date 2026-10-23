const PROD_API_URL = 'https://townpanchayat.com';

/** Set APP_ENV=local or APP_ENV=prod in `.env` (web) or EXPO_PUBLIC_APP_ENV in mobile/.env */
export type AppEnv = 'local' | 'prod';

export function getAppEnv(): AppEnv {
  const v = String(process.env.APP_ENV || 'local').toLowerCase().trim();
  return v === 'prod' || v === 'production' ? 'prod' : 'local';
}

export function getPortalApiUrl(): string {
  if (getAppEnv() === 'prod') return PROD_API_URL;
  const port = String(process.env.PORT || '3000').trim();
  return `http://localhost:${port}`;
}

export function isLocalDevHost(requestOrigin?: string): boolean {
  if (!requestOrigin) return false;
  try {
    const host = new URL(requestOrigin).hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('192.168.') ||
      host.startsWith('10.')
    );
  } catch {
    return false;
  }
}

/** MongoDB (server-side). */
export function getMongoDbUriFromEnv(): string {
  return process.env.MONGODB_URI?.trim() || 'mongodb://127.0.0.1:27017/dtp_enterprise';
}

export function logPortalEnvironmentOnce(requestOrigin?: string) {
  if (process.env.NODE_ENV === 'production') return;
  if ((global as any).__tpPortalEnvLogged) return;
  (global as any).__tpPortalEnvLogged = true;
  const remote = getAppEnv() === 'prod' && isLocalDevHost(requestOrigin);
  console.info(
    `[Portal] APP_ENV=${getAppEnv()} api=${getPortalApiUrl()} data=${remote ? 'remote-prod-api' : 'local-mongo'}`
  );
}
