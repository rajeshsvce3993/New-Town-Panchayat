import * as Location from 'expo-location';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, BackHandler, Linking, Platform, ToastAndroid } from 'react-native';
import { api, getApiBaseUrl, setApiBaseUrl } from '../api/client';
import {
  APP_VERSION_CODE,
  INACTIVITY_MS,
  NOTIF_POLL_MS,
  OFFLINE_SYNC_MS,
  SESSION_CHECK_MS,
} from '../constants/config';
import { isUsableLogoUrl } from '../components/BrandImage';
import { registerBackgroundSync } from '../services/backgroundTasks';
import {
  createNotificationChannel,
  requestNotificationPermission,
  showRichNotification,
  subscribeNotificationResponses,
} from '../services/notifications';
import { processQueueFifo, syncOfflineWorksForeground } from '../services/queueSync';
import { prefs, profilePhotoFile } from '../storage/preferences';
import { getPaletteById, type AppPalette } from '../theme/palettes';
import type { AppUser, InspectionWork, LoginRequest, LoginResponse, PortalState, UserScopeData } from '../types/models';
import { emptyPortal, isInspectionUser, portalWorks } from '../types/models';
import { todayYyyyMmDd } from '../utils/dates';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

function hydratePortalFromScope(scope: UserScopeData): PortalState {
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
  };
}

export interface AppCtx {
  ready: boolean;
  palette: AppPalette;
  isTamil: boolean;
  user: AppUser | null;
  portal: PortalState;
  works: InspectionWork[];
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
  const [palette, setPalette] = useState(getPaletteById('royal_gold'));
  const [isTamil, setIsTamil] = useState(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [portal, setPortal] = useState<PortalState>(emptyPortal());
  const [works, setWorks] = useState<InspectionWork[]>([]);
  const [loginLogo, setLoginLogo] = useState('');
  const [appIcon, setAppIcon] = useState('');
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl());
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const [pendingMedia, setPendingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [update, setUpdate] = useState({ visible: false, force: false, versionName: '2.4.0', notes: '', apkUrl: '' });
  const lastInteract = useRef(Date.now());
  const userRef = useRef<AppUser | null>(null);
  const sessionIdRef = useRef(0);

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
    (async () => {
      const url = await prefs.getServerUrl();
      setApiBaseUrl(url);
      setServerUrl(url);
      const theme = await prefs.getThemeId();
      setPalette(getPaletteById(theme));
      setIsTamil(await prefs.getIsTamil());
      const u = await prefs.getCurrentUser();
      applyUser(u);
      const cached = await prefs.getPortal();
      if (cached) {
        setPortal(cached);
        setWorks(portalWorks(cached));
      }
      const logo = await prefs.getLoginLogoUrl();
      const icon = await prefs.getAppIconUrl();
      if (isUsableLogoUrl(logo)) setLoginLogo(logo);
      if (isUsableLogoUrl(icon)) setAppIcon(icon);
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
          setAppIcon(nextIcon);
        }
        if (isUsableLogoUrl(nextLogo)) {
          await prefs.setLoginLogoUrl(nextLogo);
          setLoginLogo(nextLogo);
        }
      };
      try {
        const cfg = await api.getMobileConfig();
        if (cfg) await applyBranding(cfg.appIconUrl, cfg.loginLogoUrl);
      } catch {
        /* */
      }
      try {
        const remote = await api.getPortalState(u?.username);
        await applyBranding(remote.appIconUrl, remote.loginLogoUrl);
      } catch {
        /* */
      }
      await createNotificationChannel(await prefs.getTone());
      await registerBackgroundSync();
      try {
        await Location.requestForegroundPermissionsAsync();
        await requestNotificationPermission();
      } catch {
        /* */
      }
      try {
        const versionResp = await api.checkAppVersion();
        if (versionResp.success && (versionResp.latestVersionCode || 0) > 0) {
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
        }
      } catch {
        /* */
      }
      setReady(true);
    })();
  }, []);

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
    if (!current) return;
    const sid = sessionIdRef.current;
    touch();
    try {
      const remote = await api.getPortalState(current.username);
      if (sid !== sessionIdRef.current || !userRef.current) return;
      setPortal(remote);
      await prefs.setPortal(remote);
      if (sid !== sessionIdRef.current || !userRef.current) return;
      setWorks(portalWorks(remote));
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
      if (remote.user) {
        if (remote.user.status === 'disabled' || remote.user.forceLoggedOut) {
          applyUser(null);
          await prefs.logoutClear();
          toast('உங்கள் கணக்கு நிர்வாகியால் முடக்கப்பட்டு வெளியேற்றப்பட்டுள்ளது.');
        } else {
          const photoFile = profilePhotoFile();
          let persistent: string | null = null;
          try {
            const FileSystem = await import('expo-file-system/legacy');
            const info = await FileSystem.getInfoAsync(photoFile);
            if (info.exists) persistent = photoFile;
          } catch {
            /* */
          }
          const live = userRef.current;
          if (!live || sid !== sessionIdRef.current) return;
          const safePhoto = remote.user.profilePhotoUrl || remote.user.avatarUrl || live.profilePhotoUrl || persistent;
          const safeUser = { ...remote.user, profilePhotoUrl: safePhoto, avatarUrl: safePhoto };
          await prefs.setCurrentUser(safeUser);
          if (sid !== sessionIdRef.current || !userRef.current) {
            await prefs.logoutClear();
            return;
          }
          applyUser(safeUser);
        }
      }
    } catch {
      /* cache */
    }
  }, [touch, applyUser]);

  useEffect(() => {
    if (!ready) return;
    void refreshPortal();
  }, [ready, user?.username, refreshPortal]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      if (!(await prefs.getLoginDate())) await prefs.setLoginDate(todayYyyyMmDd());
      if (!(await prefs.getLastInteraction())) await prefs.setLastInteraction(Date.now());
    })();
    const t = setInterval(async () => {
      if (cancelled) return;
      if ((await prefs.getLoginDate()) !== todayYyyyMmDd()) {
        applyUser(null);
        await prefs.logoutClear();
        return;
      }
      const elapsed = Date.now() - lastInteract.current;
      if (elapsed > INACTIVITY_MS) {
        applyUser(null);
        await prefs.logoutClear();
      }
    }, SESSION_CHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [user, applyUser]);

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
    if (!user) return;
    const t = setInterval(async () => {
      if (AppState.currentState !== 'active') return;
      const synced = await syncOfflineWorksForeground();
      if (synced.length) {
        setWorks((prev) => {
          const ids = new Set(synced.map((s) => s.id));
          return [...synced, ...prev.filter((w) => !ids.has(w.id))];
        });
      }
      await processQueueFifo();
    }, OFFLINE_SYNC_MS);
    return () => clearInterval(t);
  }, [user]);

  const performLogin = useCallback(
    async (req: LoginRequest): Promise<LoginResponse> => {
      const res = await api.login(req);
      if (res.success && res.user) {
        const allowed = isInspectionUser(res.user) || (res.user.role || '').toLowerCase().includes('admin');
        if (!allowed) {
          return {
            success: false,
            token: null,
            user: null,
            message: isTamil
              ? 'அணுகல் மறுக்கப்பட்டது: நிர்வாகிகள் அல்லது கள ஆய்வு பணியாளர்கள் மட்டுமே உள்நுழைய முடியும்.'
              : 'Access Denied: Only Admins or Field Inspection Officers are permitted to log in.',
          };
        }
        await prefs.setAuthToken(res.token || null);
        if (res.userScope) {
          await prefs.setUserScope(res.userScope);
          await prefs.setScopeVersionInt(res.scopeVersion || 1);
          const immediate = hydratePortalFromScope(res.userScope);
          await prefs.setPortal(immediate);
          setPortal(immediate);
        }
        return res;
      }
      return res;
    },
    [isTamil]
  );

  const onLoginSuccess = useCallback(async (u: AppUser) => {
    applyUser(u);
    await prefs.setCurrentUser(u);
    await prefs.setLoginDate(todayYyyyMmDd());
    await prefs.setLastInteraction(Date.now());
    lastInteract.current = Date.now();
    try {
      const versionResp = await api.checkScopeVersion(await prefs.getScopeVersionInt());
      if (versionResp.success && (versionResp.scopeVersion || 0) > (await prefs.getScopeVersionInt())) {
        const scopeResp = await api.getUserScope(u.username);
        if (scopeResp.success && scopeResp.scope) {
          await prefs.setUserScope(scopeResp.scope);
          await prefs.setScopeVersionInt(scopeResp.scopeVersion || 1);
          const st = hydratePortalFromScope(scopeResp.scope);
          await prefs.setPortal(st);
          setPortal(st);
        }
      }
    } catch {
      /* */
    }
  }, [applyUser]);

  const logout = useCallback(async () => {
    const u = userRef.current;
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
      loginLogo,
      appIcon,
      serverUrl,
      pendingOpen,
      pendingMedia,
      setPendingOpen,
      setPendingMedia,
      setLanguage: async (ta) => {
        setIsTamil(ta);
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
