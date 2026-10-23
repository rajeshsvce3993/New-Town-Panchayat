export const PROD_API = 'https://townpanchayat.com';
const LOCAL_API = 'http://localhost:3000';

export function getMobileAppEnv(): 'local' | 'prod' {
  const v = String(process.env.EXPO_PUBLIC_APP_ENV || '').toLowerCase().trim();
  if (v === 'prod' || v === 'production') return 'prod';
  if (v === 'local' || v === 'development' || v === 'dev') return 'local';
  // EAS/release builds often have no .env — use prod when not in dev mode.
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return 'prod';
  return 'local';
}

export const IS_PROD_MOBILE = getMobileAppEnv() === 'prod';

/** Set EXPO_PUBLIC_APP_ENV=local or prod in mobile/.env (or eas.json env for cloud builds). */
export const DEFAULT_SERVER_URL = (IS_PROD_MOBILE ? PROD_API : LOCAL_API).replace(/\/$/, '');

/** Dev / LAN URLs saved from login “Configure Server” must not stick on production builds. */
export function isNonProductionServerUrl(url?: string | null): boolean {
  const u = String(url || '')
    .trim()
    .toLowerCase();
  if (!u) return false;
  if (u.includes('localhost') || u.includes('127.0.0.1') || u.includes('10.0.2.2')) return true;
  if (/^https?:\/\/192\.168\.\d+\.\d+/.test(u)) return true;
  if (/^https?:\/\/10\.\d+\.\d+\.\d+/.test(u)) return true;
  if (/^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+/.test(u)) return true;
  if (u.includes(':5000')) return true;
  if (IS_PROD_MOBILE && !u.includes('townpanchayat.com')) return true;
  return false;
}

export const APP_VERSION_NAME = '2.0.1';
export const APP_VERSION_CODE = 101;
export const FCM_APP_VERSION_LABEL = '2.0.1';
export const PACKAGE_NAME = 'com.tn.townpanchayat.ems';
export const REQUEST_TIMEOUT_MS = 30000;
/** Non-critical startup calls (config, version check) — fail fast so splash does not hang. */
export const BOOTSTRAP_API_TIMEOUT_MS = 12000;
export const UPLOAD_TIMEOUT_MS = 90000;
export const INACTIVITY_MS = 3600000;
export const SESSION_CHECK_MS = 10000;
export const OFFLINE_SYNC_MS = 15000;
export const NOTIF_POLL_MS = 120000;
export const SCOPE_BG_MINUTES = 15;
export const DEFAULT_LAT = 12.7244;
export const DEFAULT_LNG = 80.1873;
export const FALLBACK_LOGO_URL =
  'https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Tamil_Nadu_Logo.svg/1200px-Tamil_Nadu_Logo.svg.png';
export const SAMPLE_PHOTO =
  'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=600&auto=format&fit=crop';
export const BG_SCOPE_TASK = 'FiveMinuteScopeSync';
export const FALLBACK_STREETS_EN = [
  'Anna Street',
  'Gandhi Street',
  'Bazaar Street',
  'Kamarajar Salai',
  'Bharathiyar Street',
  'Hospital Road',
  'Periyar Nagar',
];
export const FALLBACK_STREETS_TA = [
  'அண்ணா தெரு',
  'காந்தி தெரு',
  'பஜார் தெரு',
  'காமராஜர் சாலை',
  'பாரதியார் தெரு',
  'மருத்துவமனை சாலை',
  'பெரியார் நகர்',
];
