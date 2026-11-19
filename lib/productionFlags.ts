/** Production cutover toggles (see ops/PRODUCTION_CUTOVER.md). */

export function isLiveDataOnly(): boolean {
  return process.env.LIVE_DATA_ONLY !== '0';
}

export function isPortalStateDisabled(): boolean {
  if (process.env.DISABLE_PORTAL_STATE === '0') return false;
  if (process.env.DISABLE_PORTAL_STATE === '1') return true;
  return isLiveDataOnly();
}

export function isBootstrapCacheDisabled(): boolean {
  if (process.env.DISABLE_BOOTSTRAP_CACHE === '0') return false;
  if (process.env.DISABLE_BOOTSTRAP_CACHE === '1') return true;
  return isPortalStateDisabled();
}

/** Web bootstrap: subjects/categories/fields only — geo via /api/masters/geo. */
export function isSlimCoreMasters(): boolean {
  if (process.env.SLIM_CORE_MASTERS === '0') return false;
  if (process.env.SLIM_CORE_MASTERS === '1') return true;
  return isLiveDataOnly();
}

export function useMongoSharedResponseCache(): boolean {
  return process.env.MONGO_RESPONSE_CACHE !== '0' && isLiveDataOnly();
}