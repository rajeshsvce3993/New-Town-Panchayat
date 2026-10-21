const PROD_API = 'https://townpanchayat.com';
const LOCAL_API = 'http://localhost:3000';

function getMobileAppEnv(): 'local' | 'prod' {
  const v = String(process.env.EXPO_PUBLIC_APP_ENV || 'local').toLowerCase().trim();
  return v === 'prod' || v === 'production' ? 'prod' : 'local';
}

/** Set EXPO_PUBLIC_APP_ENV=local or prod in mobile/.env */
export const DEFAULT_SERVER_URL = (
  getMobileAppEnv() === 'prod' ? PROD_API : LOCAL_API
).replace(/\/$/, '');

export const APP_VERSION_NAME = '2.0.0';
export const APP_VERSION_CODE = 100;
export const FCM_APP_VERSION_LABEL = '2.4.0';
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
