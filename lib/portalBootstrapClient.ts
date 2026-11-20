'use client';

let inflight: Promise<any> | null = null;
let usersInflight: Promise<{ users: any[]; inspectionUsers: any[] }> | null = null;
type HeavyCollections = {
  wardsAndStreets: any[];
  employees: any[];
  notifications: any[];
  userActivities: any[];
  apkVersions: any[];
};
let heavyInflight: Promise<HeavyCollections> | null = null;
let cached: { json: any; at: number } | null = null;
const freshListeners = new Set<(json: any) => void>();

function notifyFresh(json: any) {
  if (!json?.success) return;
  freshListeners.forEach((cb) => {
    try {
      cb(json);
    } catch {
      /* ignore listener errors */
    }
  });
}

/** Called when a background bootstrap fetch completes (e.g. after F5 cache restore). */
export function onPortalBootstrapFresh(cb: (json: any) => void): () => void {
  freshListeners.add(cb);
  return () => freshListeners.delete(cb);
}
const CACHE_MS = 120000;
const SESSION_KEY = 'portal_bootstrap_v2';
const SESSION_TTL_MS = 20 * 60 * 1000;

function readSessionBootstrap(): any | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.json || Date.now() - parsed.at > SESSION_TTL_MS) return null;
    return parsed.json;
  } catch {
    return null;
  }
}

function writeSessionBootstrap(json: any) {
  if (typeof sessionStorage === 'undefined' || !json?.success) return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ at: Date.now(), json }));
  } catch {
    /* quota — keep in-memory cache only */
  }
}

function patchBootstrapData(partial: Record<string, unknown>) {
  if (!cached?.json?.success || !cached.json.data) return;
  const next = {
    ...cached.json,
    data: { ...cached.json.data, ...partial },
  };
  cached = { json: next, at: Date.now() };
  writeSessionBootstrap(next);
  notifyFresh(next);
}

/** Inspection user directory — defer until after dashboard paint or reports tab. */
export async function loadPortalUserDirectory(): Promise<{ users: any[]; inspectionUsers: any[] }> {
  if (usersInflight) return usersInflight;
  usersInflight = (async () => {
    const [usersRes, inspRes] = await Promise.all([
      fetch('/api/masters/list?collection=users&page=1&limit=500', { cache: 'no-store' }),
      fetch('/api/masters/list?collection=inspectionUsers&page=1&limit=1000&lean=1', { cache: 'no-store' }),
    ]);
    const [usersJson, inspJson] = await Promise.all([usersRes.json(), inspRes.json()]);
    return {
      users: usersJson?.success ? usersJson.items || [] : [],
      inspectionUsers: inspJson?.success ? inspJson.items || [] : [],
    };
  })().finally(() => {
    usersInflight = null;
  });
  return usersInflight;
}

/** Phase 1: core masters + portal users only (fast first paint). */
async function fetchProductionBootstrap(): Promise<any> {
  const [coreRes, usersRes] = await Promise.all([
    fetch('/api/masters/core', { cache: 'no-store' }),
    fetch('/api/masters/list?collection=users&page=1&limit=500', { cache: 'no-store' }),
  ]);

  const [coreJson, usersJson] = await Promise.all([coreRes.json(), usersRes.json()]);

  if (!coreJson?.success || !coreJson.data) {
    return coreJson;
  }

  const data = {
    ...coreJson.data,
    users: usersJson?.success ? usersJson.items || [] : [],
    inspectionUsers: [] as any[],
  };

  void loadPortalUserDirectory()
    .then(({ inspectionUsers }) => {
      if (!inspectionUsers.length) return;
      patchBootstrapData({ inspectionUsers });
    })
    .catch(() => undefined);

  return {
    success: true,
    source: 'mongo-live',
    mode: 'production',
    data,
  };
}

function fetchAndStoreBootstrap(): Promise<any> {
  if (!inflight) {
    inflight = fetchProductionBootstrap()
      .then((json) => {
        if (json?.success) {
          cached = { json, at: Date.now() };
          writeSessionBootstrap(json);
          notifyFresh(json);
        } else {
          cached = null;
        }
        return json;
      })
      .catch((err) => {
        console.warn('Portal bootstrap failed:', err);
        cached = null;
        const fallback = readSessionBootstrap();
        if (fallback?.success) return fallback;
        return { success: false };
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Sync read for instant UI after browser refresh (same tab session). */
export function peekPortalBootstrapCache(): any | null {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.json;
  return readSessionBootstrap();
}

/** After saving users / inspectionUsers — drop stale bootstrap without passwords. */
export function invalidatePortalBootstrapCache() {
  cached = null;
  inflight = null;
  usersInflight = null;
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem('portal_bootstrap_v1');
    } catch {
      /* ignore */
    }
  }
}

/** Returns cached data immediately when available; refreshes from API in the background. */
export function loadPortalBootstrap(force = false): Promise<any> {
  if (!force) {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return Promise.resolve(cached.json);
    }
    const session = readSessionBootstrap();
    if (session?.success) {
      cached = { json: session, at: Date.now() };
      void fetchAndStoreBootstrap();
      return Promise.resolve(session);
    }
  }
  return fetchAndStoreBootstrap();
}

/** Lazy heavy collections (wards, employees, notifications) — admin tabs only. */
export async function loadPortalHeavyCollections(): Promise<HeavyCollections> {
  if (heavyInflight) return heavyInflight;

  heavyInflight = (async () => {
    const [wards, employees, notifications, activities, apk] = await Promise.all([
      fetch('/api/masters/list?collection=wardsAndStreets&page=1&limit=1000', { cache: 'no-store' }).then((r) =>
        r.json()
      ),
      fetch('/api/masters/list?collection=employees&page=1&limit=500', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/masters/list?collection=notifications&page=1&limit=200', { cache: 'no-store' }).then((r) => r.json()),
      fetch('/api/masters/list?collection=userActivities&page=1&limit=200', { cache: 'no-store' }).then((r) =>
        r.json()
      ),
      fetch('/api/masters/list?collection=apkVersions&page=1&limit=50', { cache: 'no-store' }).then((r) => r.json()),
    ]);
    return {
      wardsAndStreets: wards?.success ? wards.items || [] : [],
      employees: employees?.success ? employees.items || [] : [],
      notifications: notifications?.success ? notifications.items || [] : [],
      userActivities: activities?.success ? activities.items || [] : [],
      apkVersions: apk?.success ? apk.items || [] : [],
    };
  })().finally(() => {
    heavyInflight = null;
  });

  return heavyInflight;
}

export type PortalAdminBundle = {
  zones: any[];
  districts: any[];
  townPanchayats: any[];
  inspectionUsers: any[];
  employeeGroups?: any[];
  employeeCategories?: any[];
  postNatures?: any[];
  payLevels?: any[];
  posts?: any[];
  transferReasons?: any[];
};

let adminBundleInflight: Promise<PortalAdminBundle> | null = null;

/** Lazy admin tabs: zones only + PF masters — geo/users load on tree expand. */
export async function loadPortalAdminLite(includeEmployeeMasters: boolean): Promise<PortalAdminBundle> {
  const { loadPortalZonesOnly, loadPortalEmployeePostMasters } = await import('@/lib/portalMastersClient');
  const zones = await loadPortalZonesOnly();
  const employeeMasters = includeEmployeeMasters ? await loadPortalEmployeePostMasters() : {};
  return {
    zones,
    districts: [],
    townPanchayats: [],
    inspectionUsers: [],
    ...employeeMasters,
  };
}

/** Masters + field-staff tabs: geo, PF masters, full inspection user directory. */
export async function loadPortalAdminBundles(): Promise<PortalAdminBundle> {
  if (adminBundleInflight) return adminBundleInflight;

  adminBundleInflight = (async () => {
    const { loadPortalGeoMasters, loadPortalEmployeePostMasters, fetchAllMastersList } = await import(
      '@/lib/portalMastersClient'
    );
    const geo = await loadPortalGeoMasters();
    const [employeeMasters, inspectionUsers] = await Promise.all([
      loadPortalEmployeePostMasters(),
      fetchAllMastersList('inspectionUsers', { pageSize: 1000, lean: false, maxPages: 5 }),
    ]);
    return {
      ...geo,
      ...employeeMasters,
      inspectionUsers,
    };
  })().finally(() => {
    adminBundleInflight = null;
  });

  return adminBundleInflight;
}