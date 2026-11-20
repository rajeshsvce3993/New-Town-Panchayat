import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, ToastAndroid } from 'react-native';
import { api, getApiBaseUrl, isRemotePhotoUrl, setApiBaseUrl, setMobileApiLanguage } from '../api/client';
import {
  APP_VERSION_CODE,
  INACTIVITY_MS,
  NOTIF_POLL_MS,
  OFFLINE_SYNC_MS,
  PORTAL_FOREGROUND_REFRESH_MS,
  SESSION_CHECK_MS,
} from '../constants/config';
import { isUsableLogoUrl } from '../components/BrandImage';
import { registerBackgroundSync } from '../services/backgroundTasks';
import { checkAndApplyOtaUpdate } from '../services/otaUpdates';
import {
  createNotificationChannel,
  requestNotificationPermission,
  showRichNotification,
  subscribeNotificationResponses,
} from '../services/notifications';
import { syncPendingWorks } from '../services/queueSync';
import { dedupeInspectionWorks } from '../utils/dedupeWorks';
import { filterUserWorks } from '../utils/workFilters';
import { prefs, profilePhotoFile } from '../storage/preferences';
import { fetchLiveProfilePhotoUrl } from '../services/userProfilePhoto';
import { mergeLiveProfileOntoUser } from '../utils/userProfileMerge';
import { mergeScopeMastersIntoPortal } from '../utils/portalMasters';
import { DEFAULT_PALETTE_ID, getPaletteById, type AppPalette } from '../theme/palettes';
import type { AppUser, InspectionWork, LoginRequest, LoginResponse, PortalState, UserScopeData } from '../types/models';
import { emptyPortal, portalWorks } from '../types/models';
import { isAssignedWorkId } from '../utils/workSaveResult';
import { currentLoginSessionPeriod, todayYyyyMmDd } from '../utils/dates';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

async function isLoginSessionExpired(): Promise<boolean> {
  const today = todayYyyyMmDd();
  const period = await prefs.getLoginSessionPeriod();
  if (period) {
    const normalized = period.replace(/-(AM|PM)$/i, '');
    return normalized !== today;
  }
  const loginDate = await prefs.getLoginDate();
  return !loginDate || loginDate !== today;
}

function pickReportSettings(raw?: Record<string, unknown> | null) {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  if (raw.currentLanguage != null) out.currentLanguage = raw.currentLanguage;
  if (raw.googleMapsApiKey != null) out.googleMapsApiKey = raw.googleMapsApiKey;
  if (raw.theme != null) out.theme = raw.theme;
  if (raw.customColors != null) out.customColors = raw.customColors;
  if (raw.reportShare != null) out.reportShare = raw.reportShare;
  return out;
}

async function withLiveSettings(portal: PortalState): Promise<PortalState> {
  const settings = pickReportSettings(await api.getAppSettings());
  if (!Object.keys(settings).length) return portal;
  return { ...portal, settings: { ...portal.settings, ...settings } };
}

function hydratePortalFromScope(scope: UserScopeData, prev?: PortalState | null): PortalState {
  const sTp = scope.townPanchayat;
  return {
    ...emptyPortal(),
    townPanchayats:
      sTp && sTp.id
        ? [{ id: sTp.id, districtId: sTp.districtId || '', nameEn: sTp.nameEn, nameTa: sTp.nameTa, code: '01' }]
        : [],
    inspectionSubjects: scope.subjects || [],
    inspectionCategories: scope.categories || [],
    inspectionFields: scope.fields || [],
    wardsAndStreets: scope.wardsAndStreets || [],
    subjects: scope.subjects || [],
    categories: scope.categories || [],
    fields: scope.fields || [],
    works: [],
    settings: prev?.settings,
  };
}

export interface AppCtx {
  ready: boolean;
  palette: AppPalette;
  isTamil: boolean;
  user: AppUser | null;
  portal: PortalState;
  works: InspectionWork[];
  worksHydrated: boolean;
  loginLogo: string;
  appIcon: string;
  serverUrl: string;
  pendingOpen: string | null;
  pendingMedia: { url: string; type: string; name: string } | null;
  setPendingOpen: (v: string | null) => void;
  setPendingMedia: (v: { url: string; type: string; name: string } | null) => void;
  setLanguage: (ta: boolean) => Promise<void>;
  setThemeId: (id: string) => Promise<void>;
  touch: () => void;
  performLogin: (req: LoginRequest) => Promise<LoginResponse>;
  onLoginSuccess: (user: AppUser) => Promise<void>;
  logout: () => Promise<void>;
  refreshPortal: () => Promise<void>;
  setWorks: React.Dispatch<React.SetStateAction<InspectionWork[]>>;
  updateUserPhoto: (url: string) => Promise<void>;
  saveServerUrl: (url: string) => Promise<void>;
  setBrandingUrls: (iconUrl: string, logoUrl: string) => Promise<void>;
  updateDialog: {
    visible: boolean;
    force: boolean;
    versionName: string;
    notes: string;
    apkUrl: string;
    dismiss: () => void;
    updateNow: () => void;
  };
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [palette, setPalette] = useState(getPaletteById(DEFAULT_PALETTE_ID));
  const [isTamil, setIsTamil] = useState(true);
  const [user, setUser] = useState<AppUser | null>(null);
  const [portal, setPortal] = useState<PortalState>(emptyPortal());
  const [works, setWorks] = useState<InspectionWork[]>([]);
  const [worksHydrated, setWorksHydrated] = useState(false);
  const [loginLogo, setLoginLogo] = useState('');
  const [appIcon, setAppIcon] = useState('');
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [update, setUpdate] = useState({ visible: false, force: false, versionName: '2.4.0', notes: '', apkUrl: '' });
  const lastInteract = useRef(Date.now());
  const userRef = useRef<AppUser | null>(null);
  const sessionIdRef = useRef(0);
  const portalRefreshInFlight = useRef(false);
  const portalRefreshAgain = useRef(false);

  const applyUser = useCallback((next: AppUser | null) => {
    if (!next && userRef.current) sessionIdRef.current += 1;
    userRef.current = next;
    setUser(next);
  }, []);

  const touch = useCallback(() => {
    lastInteract.current = Date.now();
    void prefs.setLastInteraction(Date.now());
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyBranding = async (iconUrl?: string | null, logoUrl?: string | null) => {
      const resolve = (raw?: string | null) => {
        if (!raw?.trim()) return '';
        if (raw.startsWith('http')) return raw;
        return `${getApiBaseUrl()}${raw.startsWith('/') ? raw : `/${raw}`}`;
      };
      const nextIcon = resolve(iconUrl);
      const nextLogo = resolve(logoUrl);
      if (isUsableLogoUrl(nextIcon)) {
        await prefs.setAppIconUrl(nextIcon);
        if (!cancelled) setAppIcon(nextIcon);
      }
      if (isUsableLogoUrl(nextLogo)) {
        await prefs.setLoginLogoUrl(nextLogo);
        if (!cancelled) setLoginLogo(nextLogo);
      }
    };

    (async () => {
      const [url, theme, tamil, u, cached, logo, icon, tone, cachedScope] = await Promise.all([
        prefs.getServerUrl(),
        prefs.getThemeId(),
        prefs.getIsTamil(),
        prefs.getCurrentUser(),
        prefs.getPortal(),
        prefs.getLoginLogoUrl(),
        prefs.getAppIconUrl(),
        prefs.getTone(),
        prefs.getUserScope(),
      ]);
      if (cancelled) return;

      setApiBaseUrl(url);
      setServerUrl(url);
      setPalette(getPaletteById(theme));
      setIsTamil(tamil);
      let activeUser = u;
      if (u && (await isLoginSessionExpired())) {
        await prefs.logoutClear();
        activeUser = null;
      }
      applyUser(activeUser);
      if (cached) setPortal(mergeScopeMastersIntoPortal(cached, cachedScope));
      setWorks([]);
      setWorksHydrated(false);
      if (isUsableLogoUrl(logo)) setLoginLogo(logo);
      if (isUsableLogoUrl(icon)) setAppIcon(icon);

      setReady(true);
      setMobileApiLanguage(tamil);

      void checkAndApplyOtaUpdate();

      void createNotificationChannel(tone).catch(() => undefined);
      void registerBackgroundSync();

      const runAfterIdle = (fn: () => void) => {
        const ric = (globalThis as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void })
          .requestIdleCallback;
        if (typeof ric === 'function') ric(fn, { timeout: 1500 });
        else setTimeout(fn, 400);
      };
      runAfterIdle(() => {
        void (async () => {
          try {
            await Location.requestForegroundPermissionsAsync();
            await requestNotificationPermission();
          } catch {
            /* first-install prompts — must not block splash */
          }
        })();
      });

      void (async () => {
        try {
          const cfg = await api.getMobileConfig();
          if (cfg && !cancelled) await applyBranding(cfg.appIconUrl, cfg.loginLogoUrl);
        } catch {
          /* */
        }
      })();

      void (async () => {
        try {
          const versionResp = await api.checkAppVersion();
          if (cancelled || !versionResp.success || !(versionResp.latestVersionCode || 0)) return;
          const latest = versionResp.latestVersionCode || 0;
          const minReq = versionResp.minRequiredVersionCode || 0;
          const hasNew = latest > APP_VERSION_CODE;
          const isHard = APP_VERSION_CODE < minReq || !!versionResp.forceUpdate;
          if (hasNew || (isHard && APP_VERSION_CODE < latest)) {
            setUpdate({
              visible: true,
              force: isHard,
              versionName: versionResp.latestVersionName || '2.4.0',
              notes: versionResp.releaseNotes || '',
              apkUrl: versionResp.apkDownloadUrl || '',
            });
          }
        } catch {
          /* */
        }
      })();
    })();

    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  useEffect(() => {
    return subscribeNotificationResponses((data) => {
      if (data?.OPEN_SCREEN === 'NOTIFICATIONS') {
        setPendingOpen('NOTIFICATIONS');
        if (data.VIEW_MEDIA_URL) {
          setPendingMedia({
            url: data.VIEW_MEDIA_URL,
            type: data.VIEW_FILE_TYPE || 'file',
            name: data.VIEW_FILE_NAME || 'Attachment',
          });
        }
      } else if (data?.OPEN_SCREEN === 'REPORTS') {
        setPendingOpen('REPORTS');
      }
    });
  }, []);

  const refreshPortal = useCallback(async () => {
    const current = userRef.current;
    if (!current) {
      setWorksHydrated(true);
      return;
    }
    if (portalRefreshInFlight.current) {
      portalRefreshAgain.current = true;
      return;
    }
    portalRefreshInFlight.current = true;
    const sid = sessionIdRef.current;
    touch();
    try {
      const remote = await api.bootstrapProductionPortal(current.username, current, { worksLimit: 80 });
      if (sid !== sessionIdRef.current || !userRef.current) return;
      const liveSettings = pickReportSettings(await api.getAppSettings());
      const nextPortal: PortalState = {
        ...remote,
        settings: {
          ...pickReportSettings(remote.settings as Record<string, unknown> | undefined),
          ...liveSettings,
        },
      };
      setPortal(nextPortal);
      await prefs.setPortal(nextPortal);
      if (sid !== sessionIdRef.current || !userRef.current) return;
      const remoteWorks = filterUserWorks(portalWorks(remote), current, 'reports').filter((w) =>
        isAssignedWorkId(w.workId)
      );
      const remoteIds = new Set(remoteWorks.map((w) => w.id));
      const remoteWorkIds = new Set(remoteWorks.map((w) => w.workId).filter(Boolean));
      setWorks((prev) => {
        const prevById = new Map(prev.map((w) => [w.id, w]));
        const prevByWorkId = new Map(prev.filter((w) => w.workId).map((w) => [w.workId, w]));
        const mergedRemote = remoteWorks.map((rw) => {
          const local = prevByWorkId.get(rw.workId) || prevById.get(rw.id);
          const localFields = local?.fieldsData && Object.keys(local.fieldsData).length ? local.fieldsData : null;
          const remoteFields = rw.fieldsData && Object.keys(rw.fieldsData).length ? rw.fieldsData : null;
          if (!localFields) return rw;
          return {
            ...rw,
            fieldsData: { ...localFields, ...(remoteFields || {}) },
            imageUrl: rw.imageUrl || local?.imageUrl,
          };
        });
        return dedupeInspectionWorks([
          ...mergedRemote,
          ...prev.filter(
            (w) =>
              isAssignedWorkId(w.workId) &&
              !remoteIds.has(w.id) &&
              !remoteWorkIds.has(w.workId)
          ),
        ]);
      });
      const resolve = (raw?: string | null) => {
        if (!raw?.trim()) return '';
        if (raw.startsWith('http')) return raw;
        return `${getApiBaseUrl()}${raw.startsWith('/') ? raw : `/${raw}`}`;
      };
      const nextIcon = resolve(remote.appIconUrl);
      const nextLogo = resolve(remote.loginLogoUrl);
      if (isUsableLogoUrl(nextIcon)) {
        await prefs.setAppIconUrl(nextIcon);
        setAppIcon(nextIcon);
      }
      if (isUsableLogoUrl(nextLogo)) {
        await prefs.setLoginLogoUrl(nextLogo);
        setLoginLogo(nextLogo);
      }
      if (sid !== sessionIdRef.current || !userRef.current) return;
      const liveBeforeProfile = userRef.current;
      if (liveBeforeProfile?.username) {
        try {
          const prof = await api.getMobileProfile(liveBeforeProfile.username);
          if (prof.success && sid === sessionIdRef.current && userRef.current) {
            const merged = mergeLiveProfileOntoUser(
              userRef.current,
              prof.profile ?? null,
              prof.profilePhotoUrl,
            );
            await prefs.setCurrentUser(merged);
            applyUser(merged);
          }
        } catch {
          /* online-only enrichment; offline catch below unchanged */
        }
      }
      if (remote.user) {
        if (remote.user.status === 'disabled' || remote.user.forceLoggedOut) {
          applyUser(null);
          await prefs.logoutClear();
          toast('உங்கள் கணக்கு நிர்வாகியால் முடக்கப்பட்டு வெளியேற்றப்பட்டுள்ளது.');
        } else {
          const live = userRef.current;
          if (!live || sid !== sessionIdRef.current) return;
          const photoFile = profilePhotoFile(live);
          let persistent: string | null = null;
          try {
            const FileSystem = await import('expo-file-system/legacy');
            const info = await FileSystem.getInfoAsync(photoFile);
            if (info.exists) persistent = photoFile;
          } catch {
            /* */
          }
          const remotePhoto = remote.user.profilePhotoUrl || remote.user.avatarUrl || '';
          const livePhoto = live.profilePhotoUrl || live.avatarUrl || '';
          const chosen =
            (isRemotePhotoUrl(remotePhoto) && remotePhoto) ||
            (isRemotePhotoUrl(livePhoto) && livePhoto) ||
            remotePhoto ||
            livePhoto ||
            persistent;
          const safePhoto =
            chosen && chosen.includes('amazonaws.com') && chosen.includes('?') ? chosen.split('?')[0] : chosen;
          const safeUser = { ...live, profilePhotoUrl: safePhoto, avatarUrl: safePhoto };
          await prefs.setCurrentUser(safeUser);
          if (sid !== sessionIdRef.current || !userRef.current) {
            await prefs.logoutClear();
            return;
          }
          applyUser(safeUser);
        }
      }
    } catch {
      const cached = await prefs.getPortal();
      setWorks((prev) =>
        dedupeInspectionWorks([
          ...filterUserWorks(portalWorks(cached), current, 'reports'),
          ...prev,
        ].filter((w) => isAssignedWorkId(w.workId)))
      );
    } finally {
      portalRefreshInFlight.current = false;
      setWorksHydrated(true);
      if (portalRefreshAgain.current) {
        portalRefreshAgain.current = false;
        void refreshPortal();
      }
    }
  }, [touch, applyUser]);

  useEffect(() => {
    if (!ready || !user?.username) return;
    void refreshPortal();
  }, [ready, user?.username, refreshPortal]);

  const lastForegroundRefresh = useRef(0);
  useEffect(() => {
    if (!user?.username) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = Date.now();
      if (now - lastForegroundRefresh.current < PORTAL_FOREGROUND_REFRESH_MS) return;
      lastForegroundRefresh.current = now;
      void refreshPortal();
    });
    return () => sub.remove();
  }, [user?.username, refreshPortal]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const expireSession = async (notify: boolean) => {
      if (cancelled || !userRef.current) return;
      if (!(await isLoginSessionExpired())) return;
      applyUser(null);
      await prefs.logoutClear();
      if (notify) {
        toast(
          isTamil
            ? 'அமர்வு காலாவதியானது (நள்ளிரவு 12). மீண்டும் உள்நுழையவும்.'
            : 'Your session expired at midnight. Please sign in again.'
        );
      }
    };
    void (async () => {
      if (!(await prefs.getLoginDate())) await prefs.setLoginDate(todayYyyyMmDd());
      if (!(await prefs.getLastInteraction())) await prefs.setLastInteraction(Date.now());
      await expireSession(true);
    })();
    const t = setInterval(async () => {
      if (cancelled) return;
      await expireSession(true);
      if (cancelled || !userRef.current) return;
      const elapsed = Date.now() - lastInteract.current;
      if (elapsed > INACTIVITY_MS) {
        applyUser(null);
        await prefs.logoutClear();
      }
    }, SESSION_CHECK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void expireSession(true);
    });
    return () => {
      cancelled = true;
      clearInterval(t);
      sub.remove();
    };
  }, [user, applyUser, isTamil]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      try {
        const notifs = await api.getNotifications(user.id || user.username, user.zone, user.tpId || user.townPanchayatId);
        if (notifs) {
          await prefs.setNotifications(notifs);
          const shown = new Set(await prefs.getNotifiedIds());
          const read = new Set(await prefs.getReadIds());
          let changed = false;
          const tone = await prefs.getTone();
          for (const n of notifs) {
            if (!shown.has(n.id) && !read.has(n.id)) {
              shown.add(n.id);
              changed = true;
              await showRichNotification({
                title: n.title,
                message: n.message,
                mediaUrl: n.mediaUrl || n.imageUrl || n.fileUrl,
                fileType: n.fileType,
                fileName: n.fileName,
                actionUrl: n.actionUrl,
                uniqueId: n.id,
              });
              void tone;
            }
          }
          if (changed) await prefs.setNotifiedIds([...shown]);
        }
      } catch {
        /* */
      }
    }, NOTIF_POLL_MS);
    return () => clearInterval(t);
  }, [user]);

  useEffect(() => {
    if (!user?.username) return;
    let cancelled = false;
    const mergeSynced = (synced: InspectionWork[]) => {
      if (!synced.length || !userRef.current) return;
      setWorks((prev) => {
        const ids = new Set(synced.map((s) => s.id));
        const workIds = new Set(synced.map((s) => s.workId).filter(Boolean));
        return dedupeInspectionWorks([
          ...synced.filter((w) => isAssignedWorkId(w.workId)),
          ...prev.filter((w) => isAssignedWorkId(w.workId) && !ids.has(w.id) && !workIds.has(w.workId)),
        ]);
      });
    };
    const run = async () => {
      if (AppState.currentState !== 'active') return;
      const synced = await syncPendingWorks();
      // Always merge after a successful drain — do not drop the result if a
      // profile refresh replaced `user` while this await was in flight.
      if (cancelled && !userRef.current) return;
      mergeSynced(synced);
    };
    void run();
    const t = setInterval(() => void run(), OFFLINE_SYNC_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void run();
    });
    return () => {
      cancelled = true;
      clearInterval(t);
      sub.remove();
    };
  }, [user?.username]);

  const performLogin = useCallback(
    async (req: LoginRequest): Promise<LoginResponse> => {
      const res = await api.login(req);
      if (res.success && res.user) {
        await prefs.setAuthToken(res.token || null);
        if (res.userScope) {
          await prefs.setUserScope(res.userScope);
          await prefs.setScopeVersionInt(res.scopeVersion || 1);
          const masters = mergeScopeMastersIntoPortal(emptyPortal(), res.userScope);
          setPortal((prev) => mergeScopeMastersIntoPortal(prev, res.userScope));
          const cached = (await prefs.getPortal()) || emptyPortal();
          await prefs.setPortal(mergeScopeMastersIntoPortal(cached, res.userScope));
          if (!masters.fields?.length && !masters.inspectionFields?.length) {
            /* refreshPortal will load full scope */
          }
        }
        return res;
      }
      return res;
    },
    []
  );

  const onLoginSuccess = useCallback(async (u: AppUser) => {
    let photo = (await fetchLiveProfilePhotoUrl(u)) || u.profilePhotoUrl || u.avatarUrl || '';
    const canonical = photo.includes('amazonaws.com') && photo.includes('?') ? photo.split('?')[0] : photo;
    const next = canonical ? { ...u, profilePhotoUrl: canonical, avatarUrl: canonical } : u;
    applyUser(next);
    setWorks([]);
    setWorksHydrated(false);
    await prefs.setCurrentUser(next);
    await prefs.setLoginDate(todayYyyyMmDd());
    await prefs.setLoginSessionPeriod(currentLoginSessionPeriod());
    await prefs.setLastInteraction(Date.now());
    lastInteract.current = Date.now();
  }, [applyUser]);

  const logout = useCallback(async () => {
    const u = userRef.current;
    setWorks([]);
    setWorksHydrated(false);
    applyUser(null);
    try {
      await prefs.logoutClear();
    } catch {
      /* */
    }
    if (u) void api.logout(u.id, u.username);
  }, [applyUser]);

  const updateUserPhoto = useCallback(async (url: string) => {
    const updated = await prefs.updateUserPhoto(url, getApiBaseUrl());
    if (updated && userRef.current) applyUser(updated);
  }, [applyUser]);

  const saveServerUrl = useCallback(async (url: string) => {
    const clean = url.trim().replace(/\/$/, '');
    await prefs.setServerUrl(clean);
    setApiBaseUrl(clean);
    setServerUrl(clean);
  }, []);

  const setBrandingUrls = useCallback(async (iconUrl: string, logoUrl: string) => {
    const icon = iconUrl.trim();
    const logo = logoUrl.trim();
    if (isUsableLogoUrl(icon)) {
      await prefs.setAppIconUrl(icon);
      setAppIcon(icon);
    } else {
      await prefs.setAppIconUrl('');
      setAppIcon('');
    }
    if (isUsableLogoUrl(logo)) {
      await prefs.setLoginLogoUrl(logo);
      setLoginLogo(logo);
    } else {
      await prefs.setLoginLogoUrl('');
      setLoginLogo('');
    }
  }, []);

  const value = useMemo<AppCtx>(
    () => ({
      ready,
      palette,
      isTamil,
      user,
      portal,
      works,
      worksHydrated,
      loginLogo,
      appIcon,
      serverUrl,
      pendingOpen,
      pendingMedia,
      setPendingOpen,
      setPendingMedia,
      setLanguage: async (ta) => {
        setIsTamil(ta);
        setMobileApiLanguage(ta);
        await prefs.setIsTamil(ta);
      },
      setThemeId: async (id) => {
        setPalette(getPaletteById(id));
        await prefs.setThemeId(id);
      },
      touch,
      performLogin,
      onLoginSuccess,
      logout,
      refreshPortal,
      setWorks,
      updateUserPhoto,
      saveServerUrl,
      setBrandingUrls,
      updateDialog: {
        visible: update.visible,
        force: update.force,
        versionName: update.versionName,
        notes: update.notes,
        apkUrl: update.apkUrl,
        dismiss: () => setUpdate((u) => ({ ...u, visible: false })),
        updateNow: () => {
          if (!update.apkUrl) {
            toast(isTamil ? 'APK பதிவிறக்க முகவரி கிடைக்கவில்லை' : 'APK download URL not available');
            return;
          }
          void Linking.openURL(update.apkUrl);
          toast(
            isTamil
              ? 'APK பதிவிறக்கம் தொடங்கப்பட்டது... பதிவிறக்கம் முடிந்ததும் திறக்கவும்'
              : 'APK download started. Open notification once downloaded to install.'
          );
        },
      },
    }),
    [
      ready,
      palette,
      isTamil,
      user,
      portal,
      works,
      worksHydrated,
      loginLogo,
      appIcon,
      serverUrl,
      pendingOpen,
      pendingMedia,
      touch,
      performLogin,
      onLoginSuccess,
      logout,
      refreshPortal,
      update,
      updateUserPhoto,
      saveServerUrl,
      setBrandingUrls,
    ]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside provider');
  return v;
}

export function useAndroidExitOnDashboard(enabled: boolean) {
  const { isTamil, palette } = useApp();
  useEffect(() => {
    if (!enabled || Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(
        isTamil ? 'செயலியிலிருந்து வெளியேறவா?' : 'Exit Town Panchayat EMS?',
        isTamil
          ? 'Town Panchayat EMS செயலியில் இருந்து வெளியேற விரும்புகிறீர்களா?'
          : 'Are you sure you want to exit Town Panchayat EMS application?',
        [
          { text: isTamil ? 'ரத்து செய்' : 'Cancel', style: 'cancel' },
          { text: isTamil ? 'வெளியேறு (Exit)' : 'Exit', style: 'destructive', onPress: () => BackHandler.exitApp() },
        ]
      );
      return true;
    });
    return () => sub.remove();
  }, [enabled, isTamil, palette]);
}
