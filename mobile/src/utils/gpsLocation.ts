import * as Location from 'expo-location';
import { DEFAULT_LAT, DEFAULT_LNG } from '../constants/config';

export type GpsFix = { lat: number; lng: number; at: number; accuracy?: number };

const PREVIEW_CACHE_MS = 3 * 60 * 1000;
const FRESH_READING_MS = 20 * 1000;
const SUBMIT_TIMEOUT_MS = 8_000;
const PREVIEW_TIMEOUT_MS = 4_000;
const SAME_POINT_DEG = 0.00003;

function roundCoord(n: number) {
  return Math.round(n * 1e6) / 1e6;
}

export function isPlaceholderCoord(lat?: number | null, lng?: number | null): boolean {
  if (lat == null || lng == null) return true;
  return Math.abs(lat - DEFAULT_LAT) < 0.00005 && Math.abs(lng - DEFAULT_LNG) < 0.00005;
}

export function sameGpsPoint(a?: GpsFix | null, b?: GpsFix | null): boolean {
  if (!a || !b) return false;
  return Math.abs(a.lat - b.lat) < SAME_POINT_DEG && Math.abs(a.lng - b.lng) < SAME_POINT_DEG;
}

export function gpsFixFromLocation(loc: Location.LocationObject): GpsFix {
  return {
    lat: roundCoord(loc.coords.latitude),
    lng: roundCoord(loc.coords.longitude),
    at: loc.timestamp || Date.now(),
    accuracy: loc.coords.accuracy ?? undefined,
  };
}

function isFresh(fix: GpsFix | null | undefined, maxAgeMs: number): fix is GpsFix {
  return !!fix && !isPlaceholderCoord(fix.lat, fix.lng) && Date.now() - fix.at <= maxAgeMs;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('GPS timeout')), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

async function readLastKnown(maxAgeMs: number): Promise<GpsFix | null> {
  try {
    const last = await Location.getLastKnownPositionAsync({ maxAge: maxAgeMs });
    if (!last?.coords) return null;
    const fix = gpsFixFromLocation(last);
    return isFresh(fix, maxAgeMs) ? fix : null;
  } catch {
    return null;
  }
}

async function readCurrent(timeoutMs: number): Promise<GpsFix | null> {
  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: false,
      }),
      timeoutMs
    );
    const fix = gpsFixFromLocation(loc);
    if (!isFresh(fix, FRESH_READING_MS)) return null;
    return fix;
  } catch {
    return null;
  }
}

export type AcquireGpsResult =
  | { ok: true; fix: GpsFix; source: 'current' | 'lastKnown' | 'watchCache' }
  | { ok: false; reason: 'permission' | 'disabled' | 'unavailable' };

export async function acquireGpsFix(
  lastFix: GpsFix | null,
  opts?: { forSubmit?: boolean; lastSubmitted?: GpsFix | null }
): Promise<AcquireGpsResult> {
  let perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    perm = await Location.requestForegroundPermissionsAsync();
  }
  if (perm.status !== 'granted') {
    return { ok: false, reason: 'permission' };
  }

  const enabled = await Location.hasServicesEnabledAsync();
  if (!enabled) {
    return { ok: false, reason: 'disabled' };
  }

  if (opts?.forSubmit) {
    const current = await readCurrent(SUBMIT_TIMEOUT_MS);
    if (current && !sameGpsPoint(current, opts.lastSubmitted)) {
      return { ok: true, fix: current, source: 'current' };
    }

    if (isFresh(lastFix, 2 * 60 * 1000) && !sameGpsPoint(lastFix, opts.lastSubmitted)) {
      return { ok: true, fix: lastFix, source: 'watchCache' };
    }

    if (current) return { ok: true, fix: current, source: 'current' };

    const lastKnown = await readLastKnown(FRESH_READING_MS);
    if (lastKnown) return { ok: true, fix: lastKnown, source: 'lastKnown' };

    if (isFresh(lastFix, 2 * 60 * 1000)) {
      return { ok: true, fix: lastFix, source: 'watchCache' };
    }

    return { ok: false, reason: 'unavailable' };
  }

  if (isFresh(lastFix, PREVIEW_CACHE_MS)) {
    return { ok: true, fix: lastFix, source: 'watchCache' };
  }

  const previewKnown = await readLastKnown(PREVIEW_CACHE_MS);
  if (previewKnown) return { ok: true, fix: previewKnown, source: 'lastKnown' };

  const previewCurrent = await readCurrent(PREVIEW_TIMEOUT_MS);
  if (previewCurrent) return { ok: true, fix: previewCurrent, source: 'current' };

  return { ok: false, reason: 'unavailable' };
}
