'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  X, 
  Globe, 
  LayoutDashboard, 
  Layers, 
  ShieldAlert, 
  Sliders, 
  Users, 
  FileText, 
  Settings, 
  UserCircle, 
  LogOut,
  ArrowLeftRight,
  AlertTriangle,
  Calculator,
  ArrowLeft,
  ArrowRight,
  Smartphone,
  ClipboardCheck,
  UserCheck,
  FileSpreadsheet,
  Bell,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';

import dynamic from 'next/dynamic';
import { Language, translations } from '@/components/translations';
import { ThemeType, themesConfig, CustomThemeColors, defaultCustomThemeColors, getThemeSidebarGradient, getThemeCanvasColor, getThemeHeaderColor } from '@/lib/themeConfig';
import { getUserEffectiveAllowedPages } from '@/lib/pageAccessControl';
import { LoginPortal } from '@/components/LoginPortal';
import { normalizePortalSessionUser } from '@/lib/userScope';
import { PortalSplash } from '@/components/PortalSplash';
import {
  loadPortalBootstrap,
  invalidatePortalBootstrapCache,
  onPortalBootstrapFresh,
  peekPortalBootstrapCache,
} from '@/lib/portalBootstrapClient';
import {
  UI_SCALE_KEY,
  UI_SCALE_MANUAL_KEY,
  applyUiScale,
  nextUiScale,
  resolveUiScale,
  type UiScale,
} from '@/lib/uiScale';

function hydratePortalStateFromBootstrap(base: any, data: any) {
  const merged = { ...base, ...data };
  Object.entries(data || {}).forEach(([key, value]) => {
    if (Array.isArray(value) && value.length === 0 && Array.isArray(base?.[key]) && base[key].length > 0) {
      merged[key] = base[key];
    }
  });
  if (data?.settings && typeof data.settings === 'object') {
    merged.settings = { ...base.settings, ...data.settings };
  }
  return merged;
}

const EMPTY_PORTAL_STATE = {
  settings: {
    mongodbUri: '',
    mongodbPoolSize: 50,
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3AccessKeyId: '',
    s3SecretAccessKey: '',
    s3PoolSize: 50,
    port: '3000',
    currentLanguage: 'en',
    theme: 'ocean-wave',
  },
  zones: [],
  districts: [],
  townPanchayats: [],
  employeeGroups: [],
  employeeCategories: [],
  postNatures: [],
  payLevels: [],
  posts: [],
  officeCategories: [],
  roles: [],
  users: [],
  modules: [],
  fields: [],
  employees: [],
  transferRequests: [],
};

function TabLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
      <RefreshCw className="h-5 w-5 animate-spin text-indigo-500" />
      <span className="text-xs font-semibold">Loading...</span>
    </div>
  );
}

const DashboardView = dynamic(() => import('@/components/DashboardView'), { ssr: false, loading: TabLoading });
const MasterManagementView = dynamic(() => import('@/components/MasterManagementView'), { ssr: false, loading: TabLoading });
const UserManagementView = dynamic(() => import('@/components/UserManagementView'), { ssr: false, loading: TabLoading });
const ModuleManagementView = dynamic(() => import('@/components/ModuleManagementView'), { ssr: false, loading: TabLoading });
const InspectionManagementView = dynamic(() => import('@/components/InspectionManagementView'), { ssr: false, loading: TabLoading });
const InspectionEmployeeManagementView = dynamic(() => import('@/components/InspectionEmployeeManagementView'), { ssr: false, loading: TabLoading });
const InspectionReportsView = dynamic(() => import('@/components/InspectionReportsView'), { ssr: false, loading: TabLoading });
const EmployeeManagementView = dynamic(() => import('@/components/EmployeeManagementView'), { ssr: false, loading: TabLoading });
const ReportsView = dynamic(() => import('@/components/ReportsView'), { ssr: false, loading: TabLoading });
const WebappSettingsView = dynamic(() => import('@/components/WebappSettingsView'), { ssr: false, loading: TabLoading });
const UserSettingsView = dynamic(() => import('@/components/UserSettingsView'), { ssr: false, loading: TabLoading });
const PendingIssuesView = dynamic(() => import('@/components/PendingIssuesView'), { ssr: false, loading: TabLoading });
const PfManagementView = dynamic(() => import('@/components/PfManagementView'), { ssr: false, loading: TabLoading });
const NotificationApkManagementView = dynamic(() => import('@/components/NotificationApkManagementView'), { ssr: false, loading: TabLoading });
const EmployeeTransferCounselingView = dynamic(() => import('@/components/EmployeeTransferCounselingView'), { ssr: false, loading: TabLoading });

export default function PortalApp({ initialUser = null }: { initialUser?: any }) {
  const [loading, setLoading] = useState(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(localStorage.getItem('ems_current_user'));
  });
  const [currentUser, setCurrentUser] = useState<any>(
    initialUser ? normalizePortalSessionUser(initialUser) : null
  );
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  const [state, setState] = useState<any>(() => {
    const snap = peekPortalBootstrapCache();
    if (snap?.success && snap.data) {
      return hydratePortalStateFromBootstrap(EMPTY_PORTAL_STATE, snap.data);
    }
    return EMPTY_PORTAL_STATE;
  });

  // Navigation and Customization states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<ThemeType>('ocean-wave');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [customColors, setCustomColors] = useState<CustomThemeColors>(defaultCustomThemeColors);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [uiScale, setUiScale] = useState<UiScale>(90);
  const [uiScaleReady, setUiScaleReady] = useState(false);

  const handleSetCustomColors = (newColors: CustomThemeColors) => {
    setCustomColors(newColors);
    localStorage.setItem('custom_theme_colors', JSON.stringify(newColors));
  };

  const sanitizeTheme = (t: any): ThemeType => {
    const validThemes: ThemeType[] = [
      'light', 'dark', 'sunset-aurora', 'ocean-wave', 'magic-lavender', 'rainbow-prism',
      'nilgiri-emerald', 'kovai-maroon', 'madurai-blue', 'nellai-orange',
      'chennai-slate', 'royal-gold', 'crimson-ruby', 'cyber-teal', 'custom'
    ];
    if (validThemes.includes(t)) return t as ThemeType;
    return 'ocean-wave';
  };

  useEffect(() => {
    const next = resolveUiScale();
    setUiScale(next);
    applyUiScale(next);
    setUiScaleReady(true);
  }, []);

  useEffect(() => {
    if (!uiScaleReady) return;
    applyUiScale(uiScale);
    localStorage.setItem(UI_SCALE_KEY, String(uiScale));
  }, [uiScale, uiScaleReady]);

  useEffect(() => {
    if (!uiScaleReady) return;
    if (localStorage.getItem(UI_SCALE_MANUAL_KEY) === '1') return;
    const syncAutoScale = () => {
      const next = resolveUiScale();
      setUiScale(next);
      applyUiScale(next);
    };
    window.addEventListener('resize', syncAutoScale);
    return () => window.removeEventListener('resize', syncAutoScale);
  }, [uiScaleReady]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointer = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest('[data-user-menu]')) setUserMenuOpen(false);
    };
    document.addEventListener('click', onPointer);
    return () => document.removeEventListener('click', onPointer);
  }, [userMenuOpen]);

  useEffect(() => {
    const root = document.documentElement;
    const conf = themesConfig[theme] || themesConfig['ocean-wave'];
    const accent = theme === 'custom' ? customColors.primaryColor : conf.accentColor;
    const canvas = getThemeCanvasColor(theme, customColors);
    const headerBg = getThemeHeaderColor(theme, customColors);
    const sidebar = getThemeSidebarGradient(theme, customColors);
    const from = theme === 'custom' ? customColors.sidebarFrom : (conf.chartGradient?.[0] || accent);
    const to = theme === 'custom' ? customColors.sidebarTo : (conf.chartGradient?.[1] || accent);
    const dark = theme === 'dark';

    root.style.setProperty('--theme-canvas', canvas);
    root.style.setProperty('--tp-canvas', canvas);
    root.style.setProperty('--theme-bg', canvas);
    root.style.setProperty('--theme-accent', accent);
    root.style.setProperty('--theme-sidebar', sidebar);
    root.style.setProperty('--theme-header-bg', headerBg);
    root.style.setProperty('--theme-header-fg', dark ? '#f8fafc' : '#0f172a');
    root.style.setProperty('--theme-header-sub', accent);
    root.style.setProperty('--theme-header-bar', `linear-gradient(90deg, ${from}, ${accent}, ${to})`);
    root.style.setProperty('--theme-header-border', `${accent}22`);
    root.style.setProperty('--theme-border', `${accent}22`);
    root.style.setProperty('--theme-active-menu', from);
    root.style.setProperty('--theme-active-menu-text', dark ? '#e2e8f0' : from);
    root.style.setProperty('--theme-primary-btn', accent);
    root.style.setProperty('--theme-primary-btn-hover', accent);
    root.style.setProperty('--theme-primary-btn-text', '#ffffff');
    root.style.setProperty('--theme-scrollbar-thumb', `${accent}90`);
    root.style.setProperty('--theme-scrollbar-thumb-hover', accent);
    document.body.style.backgroundColor = canvas;

    if (theme === 'custom') {
      root.style.setProperty('--theme-card-bg', '#ffffff');
      root.style.setProperty('--theme-card-border', `${customColors.primaryColor}20`);
      root.style.setProperty('--theme-text-primary', '#1c0e0e');
      root.style.setProperty('--theme-text-secondary', customColors.primaryColor);
      root.style.setProperty('--theme-text-muted', '#64748b');
      root.style.setProperty('--theme-table-header', `${customColors.primaryColor}10`);
      root.style.setProperty('--theme-table-row-even', customColors.appBgColor);
      root.style.setProperty('--theme-table-row-hover', `${customColors.primaryColor}08`);
      root.style.setProperty('--theme-badge-bg', customColors.accentBgColor);
      root.style.setProperty('--theme-badge-text', customColors.primaryColor);
    }
  }, [theme, customColors]);

  // Instant Refresh States
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshToast, setRefreshToast] = useState<string | null>(null);

  const applySettingsFromState = (data: any) => {
    try {
      const savedLang = localStorage.getItem('portal_lang');
      if (savedLang === 'en' || savedLang === 'ta') {
        setLang(savedLang);
      }
    } catch {
      /* keep English */
    }
    if (data.settings?.theme) {
      const loadedTheme = data.settings.theme;
      if (currentUser) {
        const savedUserTheme = localStorage.getItem(`theme_user_${currentUser.id || currentUser.employeeId}`);
        setTheme(sanitizeTheme(savedUserTheme || loadedTheme));
      } else {
        setTheme(sanitizeTheme(loadedTheme));
      }
    }
  };

  const mergePortalState = (prev: any, next: any) => {
    const merged = { ...prev, ...next };
    Object.entries(next || {}).forEach(([key, value]) => {
      if (Array.isArray(value) && value.length === 0 && Array.isArray(prev?.[key]) && prev[key].length > 0) {
        merged[key] = prev[key];
      }
    });
    if (Array.isArray(next?.users) && Array.isArray(prev?.users)) {
      const prevById = new Map(prev.users.map((u: any) => [String(u.id), u]));
      merged.users = next.users.map((u: any) => {
        const p =
          u.password ||
          u.passwordHash ||
          prevById.get(String(u.id))?.password ||
          prevById.get(String(u.id))?.passwordHash ||
          '';
        return p ? { ...u, password: p, passwordHash: p } : u;
      });
    }
    if (next?.settings && typeof next.settings === 'object') {
      merged.settings = { ...(prev?.settings || {}), ...next.settings };
    }
    return merged;
  };

  const loadExtendedState = async () => {
    try {
      const res = await fetch('/api/state?mode=extended', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setState((prev: any) => mergePortalState(prev, json.data));
      }
    } catch (err) {
      console.error('Failed to load extended portal state:', err);
    }
  };

  // Fast bootstrap for login/dashboard; heavy collections load after first paint
  const loadState = async (showToast: boolean = false, forceBootstrap = false, silent = false) => {
    const startMs = Date.now();
    if (!showToast && !silent) setLoading(true);
    try {
      const json = await loadPortalBootstrap(forceBootstrap);
      if (json.success && json.data) {
        setState((prev: any) => mergePortalState(prev, json.data));
        applySettingsFromState(json.data);
        if (showToast) {
          const elapsed = Date.now() - startMs;
          setRefreshToast(lang === 'ta' ? `தரவுகள் உடனே புதுப்பிக்கப்பட்டன (${elapsed}ms) ✅` : `Refreshed in ${elapsed}ms ✅`);
          setTimeout(() => setRefreshToast(null), 2500);
        }
        window.setTimeout(() => void loadExtendedState(), 1500);
      }
    } catch (err) {
      console.error('Failed to load portal database state:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const refreshDashboardStats = React.useCallback(async (showToast = false) => {
    await loadState(showToast, false, true);
  }, [lang]);

  const handleInstantRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    void refreshDashboardStats(true).finally(() => {
      if (activeTab === 'inspectionReports' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('portal:inspection-reports-refresh'));
      }
      setIsRefreshing(false);
    });
  };

  // When opening Inspection Reports, ensure bootstrap has started and trigger a filter load
  useEffect(() => {
    if (activeTab !== 'inspectionReports' || !currentUser) return;
    if ((state.townPanchayats?.length ?? 0) === 0 && (state.zones?.length ?? 0) === 0) {
      void loadState(false, false, true);
    }
    window.dispatchEvent(new CustomEvent('portal:inspection-reports-refresh'));
  }, [activeTab, currentUser]);

  // Dashboard-only background refresh (KPI cards / bootstrap stats — not inspection filter API)
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    const interval = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void loadPortalBootstrap(false).then((json) => {
        if (json?.success && json.data) {
          setState((prev: any) => mergePortalState(prev, json.data));
          applySettingsFromState(json.data);
        }
      });
    }, 90_000);
    return () => window.clearInterval(interval);
  }, [activeTab]);

  useEffect(() => {
    return onPortalBootstrapFresh((json) => {
      if (json?.data) {
        setState((prev: any) => mergePortalState(prev, json.data));
        applySettingsFromState(json.data);
      }
    });
  }, []);

  useEffect(() => {
    let hasSession = false;
    try {
      const savedColors = localStorage.getItem('custom_theme_colors');
      if (savedColors) {
        setCustomColors(JSON.parse(savedColors));
      }
      const savedLang = localStorage.getItem('portal_lang');
      if (savedLang === 'en' || savedLang === 'ta') {
        setLang(savedLang);
      } else {
        setLang('en');
      }
    } catch {
      /* ignore */
    }
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ems_current_user');
      if (savedUser) {
        try {
          const parsed = normalizePortalSessionUser(JSON.parse(savedUser));
          setCurrentUser(parsed);
          localStorage.setItem('ems_current_user', JSON.stringify(parsed));
          hasSession = true;
          if (parsed.isEmployee) {
            setActiveTab('employeeManagement');
          } else {
            setActiveTab('dashboard');
          }
        } catch (e) {
          console.error('Failed to parse saved user:', e);
        }
      } else if (initialUser) {
        hasSession = true;
        setActiveTab(initialUser.isEmployee ? 'employeeManagement' : 'dashboard');
      }
    }
    if (hasSession) {
      const snap = peekPortalBootstrapCache();
      if (snap?.success && snap.data) {
        setState((prev: any) => mergePortalState(prev, snap.data));
        applySettingsFromState(snap.data);
      }
      void loadState(false, !snap?.success);
    } else {
      setLoading(false);
      fetch('/api/state?key=settings', { cache: 'no-store' })
        .then((res) => res.json())
        .then((json) => {
          if (json.success && json.data) {
            setState((prev: any) => ({ ...prev, settings: { ...prev.settings, ...json.data } }));
            applySettingsFromState({ settings: json.data });
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load user-based theme when currentUser changes
  useEffect(() => {
    if (currentUser) {
      const savedUserTheme = localStorage.getItem(`theme_user_${currentUser.id || currentUser.employeeId}`);
      if (savedUserTheme) {
        setTheme(sanitizeTheme(savedUserTheme));
      } else if (state.settings?.theme) {
        setTheme(sanitizeTheme(state.settings.theme));
      }
    } else {
      setTheme('ocean-wave');
    }
  }, [currentUser, state.settings?.theme]);

  // Keep currentUser in sync with state.users so admin ACL modifications reflect immediately
  useEffect(() => {
    if (currentUser && state.users && state.users.length > 0) {
      const freshUser = state.users.find((u: any) => u.id === currentUser.id || u.username === currentUser.username);
      if (freshUser) {
        const freshPerms = freshUser.customPagePermissions || [];
        const currentPerms = currentUser.customPagePermissions || [];
        const customChanged = JSON.stringify(freshPerms) !== JSON.stringify(currentPerms);

        const freshRole = freshUser.roleId || freshUser.role || '';
        const currentRole = currentUser.roleId || currentUser.role || '';
        const roleChanged = freshRole !== currentRole;

        if (customChanged || roleChanged) {
          const merged = { 
            ...currentUser, 
            ...freshUser,
            customPagePermissions: freshUser.customPagePermissions || null
          };
          setCurrentUser(merged);
          localStorage.setItem('ems_current_user', JSON.stringify(merged));
        }
      }
    }
  }, [state.users, state.roles, currentUser]);

  const allowedPageIds = useMemo(() => getUserEffectiveAllowedPages(currentUser, state.roles), [currentUser, state.roles]);

  // Auto-redirect if current active tab is restricted by Page Access Control or disabled by admin settings
  useEffect(() => {
    if (currentUser && allowedPageIds && allowedPageIds.length > 0) {
      const isEmployeeMgmtDisabled = state.settings?.enableEmployeeManagement === false;
      const isTransferPostingDisabled = state.settings?.enableTransferPosting === false;

      const isDisallowedPage = !allowedPageIds.includes(activeTab);
      const isDisallowedEmpMgmt = (activeTab === 'employees' || activeTab === 'employeeManagement') && isEmployeeMgmtDisabled;
      const isDisallowedTransfer = activeTab === 'transferAndPosting' && isTransferPostingDisabled;

      if (isDisallowedPage || isDisallowedEmpMgmt || isDisallowedTransfer) {
        const fallbackTab = allowedPageIds.includes('dashboard') 
          ? 'dashboard' 
          : (allowedPageIds.includes('userSettings') ? 'userSettings' : allowedPageIds[0]);
        if (fallbackTab && fallbackTab !== activeTab) {
          setActiveTab(fallbackTab);
        }
      }
    }
  }, [activeTab, allowedPageIds, state.settings?.enableEmployeeManagement, state.settings?.enableTransferPosting, currentUser]);

  // Handle language switch
  const toggleLanguage = async () => {
    const nextLang = lang === 'en' ? 'ta' : 'en';
    setLang(nextLang);
    try {
      localStorage.setItem('portal_lang', nextLang);
    } catch {
      /* ignore */
    }
    
    // Sync to DB settings
    const updatedSettings = { ...state.settings, currentLanguage: nextLang };
    await handleSaveSettings(updatedSettings);
  };

  // Handle active theme class updates
  const handleSetTheme = async (nextTheme: ThemeType) => {
    setTheme(nextTheme);
    if (currentUser) {
      localStorage.setItem(`theme_user_${currentUser.id || currentUser.employeeId}`, nextTheme);
    }
    const updatedSettings = { ...state.settings, theme: nextTheme };
    await handleSaveSettings(updatedSettings);
  };

  // Master Collection Save
  const handleSaveCollection = async (key: string, data: any[], skipCacheRebuild?: boolean) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'saveCollection', key, data, skipCacheRebuild })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setState((prev: any) => mergePortalState(prev, { [key]: data }));
        const forceBootstrap = key === 'users' || key === 'inspectionUsers';
        if (forceBootstrap) invalidatePortalBootstrapCache();
        await loadState(false, forceBootstrap, true);
      }
    } catch (err) {
      console.error(`Error saving collection ${key}:`, err);
    }
  };

  // Employee CRUD Save
  const handleSaveEmployee = async (employee: any) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'saveEmployee', data: employee })
      });
      const resJson = await res.json();
      if (resJson.success) {
        await loadState(false, false, true);
      }
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  // Employee delete
  const handleDeleteEmployee = async (id: string) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'deleteEmployee', data: { id } })
      });
      const resJson = await res.json();
      if (resJson.success) {
        await loadState(false, false, true);
      }
    } catch (err) {
      console.error('Error deleting employee:', err);
    }
  };

  // Transfer lodge/approve save
  const handleSaveTransferRequest = async (request: any) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'saveTransferRequest', data: request })
      });
      const resJson = await res.json();
      if (resJson.success) {
        await loadState(false, false, true);
      }
    } catch (err) {
      console.error('Error processing transfer request:', err);
    }
  };

  // Activity Logging helper
  const handleLogActivity = async (logData: any) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'logActivity', data: logData })
      });
      const resJson = await res.json();
      if (resJson.success) {
        await loadState(false, false, true);
      }
    } catch (err) {
      console.error('Error logging activity:', err);
    }
  };

  // Webapp Settings save
  const handleSaveSettings = async (settingsObj: any) => {
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'saveSettings', data: settingsObj })
      });
      const resJson = await res.json();
      if (resJson.success) {
        setState((prev: any) => ({ ...prev, settings: settingsObj }));
      }
    } catch (err) {
      console.error('Error saving webapp settings:', err);
    }
  };

  // Instant User Logout
  const handleLogout = () => {
    // 1. Immediately wipe all cached auth tokens and keys
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ems_current_user');
        sessionStorage.removeItem('ems_current_user');
        localStorage.removeItem('token');
        sessionStorage.removeItem('token');
        document.cookie = 'ems_current_user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        // Clean up URL without hard page refresh
        window.history.replaceState(null, '', '/');
      }

      // 2. Fire and forget server logout notification in background
      if (currentUser) {
        try {
          fetch('/api/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: currentUser.id,
              username: currentUser.username,
              name: currentUser.name || currentUser.nameEn,
              role: currentUser.role,
              designation: currentUser.designation,
              zone: currentUser.zone,
              district: currentUser.district,
              tp: currentUser.townPanchayat
            }),
            keepalive: true
          }).catch(() => {});
        } catch (_) {}
      }
    } catch (_) {}

    setCurrentUser(null);
    setActiveTab('dashboard');
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setSidebarOpen(false);
    window.location.replace('/');
  };

  // User Profile self save
  const handleUpdateUserProfile = async (updatedUser: any) => {
    // If administrative user
    if (!currentUser.isEmployee) {
      const updatedUsers = state.users.map((u: any) => u.id === updatedUser.id ? updatedUser : u);
      await handleSaveCollection('users', updatedUsers);
      setCurrentUser(updatedUser);
      localStorage.setItem('ems_current_user', JSON.stringify(updatedUser));
    } else {
      // If Employee account
      await handleSaveEmployee(updatedUser);
      const nextUser = {
        ...currentUser,
        nameEn: updatedUser.nameEn,
        nameTa: updatedUser.nameTa,
        profileImage: updatedUser.profileImage
      };
      setCurrentUser(nextUser);
      localStorage.setItem('ems_current_user', JSON.stringify(nextUser));
    }
  };

  // Administrative/Employee Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setAuthenticating(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      if (data.success && data.user) {
        // Allow all users & employees to log in to the webapp, except field inspection users
        const isInspectionUser = data.user.isInspectionUser || 
                                 (data.user.roleId && data.user.roleId.toLowerCase().includes('inspect')) ||
                                 (data.user.role && data.user.role.toLowerCase().includes('inspect'));
        if (isInspectionUser) {
          setLoginError(lang === 'ta' ? 'அனுமதி மறுக்கப்பட்டது: கள ஆய்வுப் பயனர்கள் இணையதளத்தில் உள்நுழைய அனுமதியில்லை.' : 'Access Denied: Field inspection users are not permitted to log in to the webapp.');
          return;
        }

        setCurrentUser(data.user);
        localStorage.setItem('ems_current_user', JSON.stringify(data.user));
        if (data.user.isEmployee) {
          setActiveTab('employeeManagement');
        } else {
          setActiveTab('dashboard');
        }
        void loadState();
      } else {
        setLoginError(data.message || translations[lang].invalidLogin);
      }
    } catch (err) {
      setLoginError('Server error connecting to authentication service.');
    } finally {
      setAuthenticating(false);
    }
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' 
      ? (obj.nameTa || obj.nameEn || obj.name || obj.username || '') 
      : (obj.nameEn || obj.name || obj.nameTa || obj.username || '');
  };

  // Loading Screen
  if (loading) {
    return <PortalSplash variant="app" lang={lang} />;
  }

  // Auth screen layout
  if (!currentUser) {
    return (
      <LoginPortal
        lang={lang}
        logoSrc="/app_logo.png"
        username={loginUsername}
        password={loginPassword}
        error={loginError}
        authenticating={authenticating}
        onUsername={setLoginUsername}
        onPassword={setLoginPassword}
        onToggleLanguage={toggleLanguage}
        onSubmit={handleLoginSubmit}
      />
    );
  }

  const nav = (en: string, ta: string) => (lang === 'ta' ? ta : en);
  const adminMenuItems = [
    { id: 'dashboard', label: t('dashboard'), navLabel: nav('Dashboard', 'டாஷ்போர்டு'), icon: LayoutDashboard, view: DashboardView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'masters', label: t('masterManagement'), navLabel: nav('Masters', 'முதன்மை'), icon: Layers, view: MasterManagementView, roles: ['admin'] },
    { id: 'users', label: t('userManagement'), navLabel: nav('Users', 'பயனர்கள்'), icon: ShieldAlert, view: UserManagementView, roles: ['admin'] },
    { id: 'modules', label: t('moduleManagement'), navLabel: nav('Modules', 'தொகுதிகள்'), icon: Sliders, view: ModuleManagementView, roles: ['admin'] },
    { id: 'inspectionModules', label: t('inspectionModuleManagement'), navLabel: nav('Work types', 'ஆய்வு வகைகள்'), icon: ClipboardCheck, view: InspectionManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'inspectionEmployees', label: t('inspectionEmployeeManagement'), navLabel: nav('Field staff', 'கள ஊழியர்'), icon: UserCheck, view: InspectionEmployeeManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'inspectionReports', label: t('inspectionReports'), navLabel: nav('Reports', 'அறிக்கைகள்'), icon: FileSpreadsheet, view: InspectionReportsView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'pfManagement', label: t('pfManagement'), navLabel: nav('Provident fund', 'வருங்கால வைப்பு'), icon: Calculator, view: PfManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'employees', label: t('employeeManagement'), navLabel: nav('Employees', 'ஊழியர்கள்'), icon: Users, view: EmployeeManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'transferCounseling', label: lang === 'ta' ? 'இடமாற்று ஆலோசனை' : 'Transfer counseling', navLabel: nav('Counseling', 'ஆலோசனை'), icon: ArrowLeftRight, view: EmployeeTransferCounselingView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'pendingIssues', label: t('pendingIssues'), navLabel: nav('Issues', 'பிரச்சினைகள்'), icon: AlertTriangle, view: PendingIssuesView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'appManagement', label: lang === 'ta' ? 'அறிவிப்பு மேலாண்மை' : 'Notifications', navLabel: nav('Notifications', 'அறிவிப்புகள்'), icon: Bell, view: NotificationApkManagementView, roles: ['admin'] },
    { id: 'userSettings', label: t('userSettings'), navLabel: nav('Profile', 'சுயவிவரம்'), icon: UserCircle, view: UserSettingsView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'webappSettings', label: t('webappSettings'), navLabel: nav('Settings', 'அமைப்புகள்'), icon: Settings, view: WebappSettingsView, roles: ['admin'] }
  ];

  const employeeMenuItems = [
    { id: 'employeeManagement', label: t('employeeManagement'), navLabel: nav('Employees', 'ஊழியர்கள்'), icon: Users, view: EmployeeManagementView },
    { id: 'inspectionReports', label: t('inspectionReports'), navLabel: nav('Reports', 'அறிக்கைகள்'), icon: FileSpreadsheet, view: InspectionReportsView },
    { id: 'pfManagement', label: t('pfManagement'), navLabel: nav('Provident fund', 'வருங்கால வைப்பு'), icon: Calculator, view: PfManagementView },
    { id: 'userSettings', label: t('userSettings'), navLabel: nav('Profile', 'சுயவிவரம்'), icon: UserCircle, view: UserSettingsView }
  ];

  let userRole = (currentUser.roleId || currentUser.role || '').toLowerCase();
  if (!currentUser.isEmployee && (userRole === 'officer' || userRole === 'field inspector' || !userRole)) {
    userRole = 'admin'; // Self-healing fallback for web portal administrative sessions
  }
  const activeMenuItems = (currentUser.isEmployee ? employeeMenuItems : adminMenuItems)
    .filter(item => allowedPageIds.includes(item.id))
    .filter((item) => {
      if (item.id === 'employees' || item.id === 'employeeManagement') {
        return state.settings?.enableEmployeeManagement !== false;
      }
      return true;
    });

  const menuGroups = [
    { id: 'overview', labelEn: 'Overview', labelTa: 'கண்ணோட்டம்', ids: ['dashboard'] },
    { id: 'field', labelEn: 'Field operations', labelTa: 'களப் பணிகள்', ids: ['inspectionModules', 'inspectionEmployees', 'inspectionReports', 'pendingIssues'] },
    { id: 'admin', labelEn: 'Administration', labelTa: 'நிர்வாகம்', ids: ['masters', 'users', 'modules', 'employees', 'employeeManagement', 'transferCounseling', 'pfManagement'] },
    { id: 'system', labelEn: 'System', labelTa: 'அமைப்பு', ids: ['appManagement', 'userSettings', 'webappSettings'] },
  ];
  const userDisplayName = tObj(currentUser) || currentUser.username || 'User';
  const userRoleLabel = currentUser.designationNameEn || currentUser.designation || currentUser.role || currentUser.roleId || 'Admin';
  const currentTheme = themesConfig[theme] || themesConfig['ocean-wave'];
  const isDark = theme === 'dark';
  const accentColor = theme === 'custom' ? customColors.primaryColor : currentTheme.accentColor;
  const sidebarGradient = getThemeSidebarGradient(theme, customColors);
  const isRail = sidebarCollapsed;
  const brandTitle = lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat';
  const brandSub = lang === 'ta' ? 'நிர்வாக முகப்பு' : 'Management Portal';
  const headerOfficeName = userDisplayName || (lang === 'ta' ? 'இயக்குநர் அலுவலகம்' : 'Director Office');
  const headerOfficeSub = lang === 'ta' ? 'நிர்வாக முகப்பு' : 'Administration Dashboard';
  const headerPageCopy: Record<string, { en: string; ta: string; subEn: string; subTa: string }> = {
    dashboard: { en: 'Dashboard', ta: 'டாஷ்போர்டு', subEn: 'Field inspection overview', subTa: 'கள ஆய்வு கண்ணோட்டம்' },
    inspectionModules: { en: 'Work types', ta: 'ஆய்வு வகைகள்', subEn: 'Inspection work modules', subTa: 'ஆய்வுப் பணி தொகுதிகள்' },
    inspectionEmployees: { en: 'Field staff', ta: 'கள ஊழியர்', subEn: 'Inspection employee records', subTa: 'கள ஊழியர் பதிவுகள்' },
    inspectionReports: { en: 'Reports', ta: 'அறிக்கைகள்', subEn: 'Inspection reports and abstracts', subTa: 'ஆய்வு அறிக்கைகள் மற்றும் சுருக்கங்கள்' },
    pendingIssues: { en: 'Issues', ta: 'பிரச்சினைகள்', subEn: 'Pending field issues', subTa: 'நிலுவைக் களப் பிரச்சினைகள்' },
    masters: { en: 'Masters', ta: 'முதன்மை', subEn: 'Location and reference data', subTa: 'இடம் மற்றும் அடிப்படை தரவு' },
    users: { en: 'Users', ta: 'பயனர்கள்', subEn: 'Portal user access', subTa: 'முகப்பு பயனர் அணுகல்' },
    modules: { en: 'Modules', ta: 'தொகுதிகள்', subEn: 'Application module setup', subTa: 'பயன்பாட்டு தொகுதி அமைப்பு' },
    employees: { en: 'Employees', ta: 'ஊழியர்கள்', subEn: 'Employee records', subTa: 'ஊழியர் பதிவுகள்' },
    employeeManagement: { en: 'Employees', ta: 'ஊழியர்கள்', subEn: 'Employee records', subTa: 'ஊழியர் பதிவுகள்' },
    transferCounseling: { en: 'Counseling', ta: 'ஆலோசனை', subEn: 'Transfer counseling', subTa: 'இடமாற்று ஆலோசனை' },
    pfManagement: { en: 'Provident fund', ta: 'வருங்கால வைப்பு', subEn: 'PF accounts and reports', subTa: 'வருங்கால வைப்பு கணக்குகள்' },
    appManagement: { en: 'Notifications', ta: 'அறிவிப்புகள்', subEn: 'Alerts and mobile app', subTa: 'அறிவிப்புகள் மற்றும் செயலி' },
    userSettings: { en: 'Profile', ta: 'சுயவிவரம்', subEn: 'Your account settings', subTa: 'உங்கள் கணக்கு அமைப்புகள்' },
    webappSettings: { en: 'Settings', ta: 'அமைப்புகள்', subEn: 'Portal configuration', subTa: 'முகப்பு அமைப்புகள்' },
  };
  const currentPageCopy = headerPageCopy[activeTab] || headerPageCopy.dashboard;
  const headerPageTitle = lang === 'ta' ? currentPageCopy.ta : currentPageCopy.en;
  const headerPageSub = lang === 'ta' ? currentPageCopy.subTa : currentPageCopy.subEn;
  const profileNavItem = activeMenuItems.find((item) => item.id === 'userSettings');
  const settingsNavItem = activeMenuItems.find((item) => item.id === 'webappSettings');
  const notifCount = Array.isArray(state.notifications) ? state.notifications.length : 0;
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();
  const cycleUiScale = () => {
    localStorage.setItem(UI_SCALE_MANUAL_KEY, '1');
    setUiScale((value) => nextUiScale(value));
  };
  const shellBgClass = theme === 'custom' ? '' : currentTheme.mainBg || 'bg-[#f5f7fa]';
  const shellBgStyle = theme === 'custom' ? { backgroundColor: customColors.appBgColor } : undefined;

  return (
    <div
      data-theme={theme}
      className={`flex min-h-screen font-sans ${isDark ? 'text-slate-100' : 'text-slate-800'} ${shellBgClass}`}
      style={{ ...(shellBgStyle || {}), ['--theme-accent']: accentColor } as React.CSSProperties}
    >
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-slate-950/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`portal-sidenav fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col overflow-hidden text-white transition-[width,transform] duration-300 ease-out print:hidden md:sticky md:inset-auto md:top-0 md:z-20 md:h-screen md:shrink-0 ${
          isRail ? 'md:w-[4.25rem]' : 'md:w-[248px]'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ backgroundImage: sidebarGradient }}
      >
        <div className={`relative z-10 flex h-[4.75rem] w-full shrink-0 items-center border-b border-white/10 ${isRail ? 'justify-center px-2' : 'gap-3 px-3'}`}>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2 rounded-md p-1.5 text-white/75 hover:bg-white/10 md:hidden"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>

          {isRail ? (
            <div className="flex w-full items-center justify-center">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                <img
                  src="/app_icon.png"
                  alt=""
                  className="h-9 w-9 object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/login-logo.png';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center gap-2.5 pr-7 md:pr-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                <img
                  src="/app_icon.png"
                  alt=""
                  className="h-9 w-9 object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/login-logo.png';
                  }}
                />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-[17px] font-black leading-tight tracking-tight text-white">{brandTitle}</p>
                <p className="mt-0.5 truncate text-[12px] font-black leading-tight text-white/80">{brandSub}</p>
              </div>
            </div>
          )}
        </div>

        <nav className={`portal-nav-scroll relative z-10 min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-3 ${isRail ? 'px-1.5' : 'pl-5 pr-2.5'}`}>
          {menuGroups.map((group, groupIndex) => {
            const items = activeMenuItems.filter((item) => group.ids.includes(item.id));
            if (items.length === 0) return null;
            return (
              <div key={group.id} className={groupIndex === 0 ? 'mb-1' : 'mt-3 mb-1'}>
                <p
                  className={`portal-nav-group-label px-2.5 pb-1.5 ${isRail ? 'md:hidden' : ''}`}
                >
                  {lang === 'ta' ? group.labelTa : group.labelEn}
                </p>
                <div className="flex w-full flex-col gap-[3px]">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const active = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        title={item.label}
                        onClick={() => {
                          setActiveTab(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`portal-nav-item w-full rounded-[10px] transition-colors ${
                          isRail
                            ? 'flex h-10 items-center justify-center px-0'
                            : 'grid h-10 grid-cols-[20px_minmax(0,1fr)] items-center gap-x-2.5 px-2.5 text-left'
                        } ${
                          active
                            ? 'portal-nav-item-active'
                            : 'text-white/80 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.9} />
                        </span>
                        <span
                          className={`portal-nav-item-label min-w-0 ${isRail ? 'md:hidden' : ''}`}
                        >
                          {item.navLabel || item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
      </aside>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col pt-16 ${isDark ? 'bg-slate-950' : 'portal-shell-canvas'}`}>
        <header
          className={`portal-brand-header print:hidden ${
            isRail ? 'md:left-[4.25rem]' : 'md:left-[248px]'
          } left-0`}
        >
            <div className="relative z-10 flex h-full items-center justify-between gap-3 pl-10 pr-4 sm:pl-12 sm:pr-6 lg:pr-8">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && window.innerWidth >= 768) {
                    setSidebarCollapsed((v) => !v);
                  } else {
                    setSidebarOpen(true);
                  }
                }}
                className="portal-edge-menu"
                title={isRail ? (lang === 'ta' ? 'பட்டி காட்டுக' : 'Expand menu') : (lang === 'ta' ? 'பட்டி சுருக்குக' : 'Collapse menu')}
                aria-label={isRail ? 'Expand sidebar' : 'Open menu'}
              >
                <span className={`portal-burger ${sidebarOpen ? 'is-open' : ''} ${isRail ? 'is-collapsed' : ''}`} aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>

              <div className="min-w-0 flex-1">
                <h1 className="portal-header-title truncate text-[16px] font-semibold leading-tight tracking-tight sm:text-[17px]">
                  {headerPageTitle}
                </h1>
                <p className="portal-header-sub mt-0.5 truncate text-[12px] font-medium opacity-85">
                  {headerPageSub}
                </p>
              </div>

              <div className="relative z-50 flex min-w-0 items-center gap-3" data-user-menu>
                <div className="min-w-0 max-w-[min(52vw,22rem)] text-right">
                  <h1 className="portal-header-title truncate text-[15px] font-semibold leading-tight tracking-tight sm:text-[16px]">
                    {headerOfficeName}
                  </h1>
                  <p className="portal-header-sub mt-0.5 truncate text-[11px] font-medium opacity-85 sm:text-[12px]">
                    {headerOfficeSub}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setUserMenuOpen((open) => !open);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white shadow-md ring-2 ring-white/80"
                  style={{ backgroundImage: `linear-gradient(135deg, ${currentTheme.chartGradient?.[0] || accentColor}, ${currentTheme.chartGradient?.[1] || accentColor})` }}
                  title={userDisplayName}
                  aria-label={userDisplayName}
                >
                  {userInitials}
                </button>
                {userMenuOpen && (
                  <div className="portal-user-menu">
                    <div className="portal-user-menu-head">
                      <span
                        className="portal-user-menu-avatar"
                        style={{ backgroundImage: `linear-gradient(135deg, ${currentTheme.chartGradient?.[0] || accentColor}, ${currentTheme.chartGradient?.[1] || accentColor})` }}
                      >
                        {userInitials}
                      </span>
                      <div className="min-w-0">
                        <strong className="truncate">{userDisplayName}</strong>
                        <span>{currentUser?.roleId || currentUser?.scopeType || 'User'}</span>
                      </div>
                    </div>
                    <div className="portal-user-menu-body">
                      <button type="button" onClick={() => { setUserMenuOpen(false); toggleLanguage(); }} className="portal-user-menu-item">
                        <Globe />
                        {lang === 'en' ? 'தமிழ் / Tamil' : 'English'}
                      </button>
                      <button type="button" onClick={() => { cycleUiScale(); }} className="portal-user-menu-item">
                        <span className="portal-user-menu-glyph">A</span>
                        {lang === 'ta' ? `எழுத்து அளவு ${uiScale}%` : `Text size ${uiScale}%`}
                      </button>
                      <button type="button" onClick={() => { setUserMenuOpen(false); handleInstantRefresh(); }} className="portal-user-menu-item">
                        <RefreshCw />
                        {lang === 'ta' ? 'புதுப்பி' : 'Refresh'}
                      </button>
                      {allowedPageIds.includes('appManagement') && (
                        <button type="button" onClick={() => { setActiveTab('appManagement'); setUserMenuOpen(false); }} className="portal-user-menu-item">
                          <Bell />
                          {lang === 'ta' ? 'அறிவிப்புகள்' : 'Notifications'}
                          {notifCount > 0 && (
                            <span className="portal-user-menu-badge">
                              {notifCount > 9 ? '9+' : notifCount}
                            </span>
                          )}
                        </button>
                      )}
                      {profileNavItem && (
                        <button type="button" onClick={() => { setActiveTab('userSettings'); setUserMenuOpen(false); }} className="portal-user-menu-item">
                          <UserCircle />
                          {lang === 'ta' ? 'சுயவிவரம்' : 'Profile'}
                        </button>
                      )}
                      {settingsNavItem && (
                        <button type="button" onClick={() => { setActiveTab('webappSettings'); setUserMenuOpen(false); }} className="portal-user-menu-item">
                          <Settings />
                          {lang === 'ta' ? 'அமைப்புகள்' : 'Settings'}
                        </button>
                      )}
                      <div className="portal-user-menu-themes">
                        <p>{lang === 'ta' ? 'தீம்' : 'Theme'} · {lang === 'ta' ? currentTheme.nameTa : currentTheme.nameEn}</p>
                        <div className="portal-theme-swatches">
                          {(Object.values(themesConfig) as { id: ThemeType; nameEn: string; nameTa: string; chartGradient: string[] }[]).map((th) => {
                            const from = th.id === 'custom' ? customColors.sidebarFrom : (th.chartGradient?.[0] || accentColor);
                            const to = th.id === 'custom' ? customColors.sidebarTo : (th.chartGradient?.[1] || accentColor);
                            return (
                              <button
                                key={th.id}
                                type="button"
                                title={lang === 'ta' ? th.nameTa : th.nameEn}
                                onClick={() => { void handleSetTheme(th.id); }}
                                className={`portal-theme-swatch ${theme === th.id ? 'is-active' : ''}`}
                                style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="portal-user-menu-rule" />
                    <button type="button" onClick={() => { setUserMenuOpen(false); handleLogout(); }} className="portal-user-menu-item is-danger">
                      <LogOut />
                      {t('logout')}
                    </button>
                  </div>
                )}
              </div>
            </div>
        </header>

        {/* Instant Refresh Feedback Toast */}
        <AnimatePresence>
          {refreshToast && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="fixed top-20 right-6 z-50 px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold rounded-2xl shadow-xl flex items-center gap-2 border border-emerald-500/30"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              <span>{refreshToast}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <main
          className={`relative mx-auto w-full min-w-0 max-w-[1680px] flex-1 overflow-x-hidden px-2 pt-5 pb-3 sm:px-3 lg:px-3 ${
            activeTab === 'dashboard' && !isDark ? 'bg-transparent' : ''
          }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
              className="relative w-full"
            >
              {!allowedPageIds.includes(activeTab) ? (
                <div className="bg-white rounded-3xl p-10 text-center border border-rose-100 shadow-sm space-y-4 max-w-lg mx-auto my-12">
                  <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                    <ShieldAlert className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-800">{t('accessDenied')}</h3>
                  <p className="text-xs text-slate-500 leading-relaxed">{t('accessDeniedDesc')}</p>
                  <button
                    onClick={() => {
                      const fallback = allowedPageIds.includes('dashboard') 
                        ? 'dashboard' 
                        : (allowedPageIds.includes('userSettings') ? 'userSettings' : allowedPageIds[0]);
                      if (fallback) setActiveTab(fallback);
                    }}
                    className="portal-dash-action px-5 py-2.5 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    {t('goToAllowedPage')}
                  </button>
                </div>
              ) : (
                <>
                  {activeTab === 'dashboard' && (
                    <DashboardView 
                      state={state} 
                      lang={lang} 
                      currentUser={currentUser} 
                      setActiveTab={setActiveTab} 
                      theme={theme}
                      onSaveCollection={handleSaveCollection}
                      onRefreshDashboardStats={() => refreshDashboardStats(true)}
                    />
                  )}
              {activeTab === 'masters' && (
                <MasterManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'users' && (
                <UserManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'modules' && (
                <ModuleManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'inspectionModules' && (
                <InspectionManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'inspectionEmployees' && (
                <InspectionEmployeeManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'pfManagement' && (
                <PfManagementView 
                  state={state} 
                  lang={lang} 
                  currentUser={currentUser}
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'employees' && (
                <EmployeeManagementView 
                  state={state} 
                  lang={lang} 
                  currentUser={currentUser} 
                  onSaveEmployee={handleSaveEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onSaveTransferRequest={handleSaveTransferRequest}
                  onLogActivity={handleLogActivity}
                />
              )}
              {activeTab === 'employeeManagement' && (
                <EmployeeManagementView 
                  state={state} 
                  lang={lang} 
                  currentUser={currentUser} 
                  onSaveEmployee={handleSaveEmployee}
                  onDeleteEmployee={handleDeleteEmployee}
                  onSaveTransferRequest={handleSaveTransferRequest}
                  onLogActivity={handleLogActivity}
                />
              )}
              {activeTab === 'reports' && (
                <ReportsView 
                  state={state} 
                  lang={lang} 
                  theme={theme}
                  currentUser={currentUser}
                />
              )}
              {activeTab === 'inspectionReports' && (
                <InspectionReportsView
                  state={state}
                  lang={lang}
                  theme={theme}
                  currentUser={currentUser}
                  onSaveCollection={handleSaveCollection}
                />
              )}
              {activeTab === 'transferCounseling' && (
                <EmployeeTransferCounselingView lang={lang} currentUser={currentUser} />
              )}
              {activeTab === 'pendingIssues' && (
                <PendingIssuesView
                  state={state}
                  lang={lang}
                  currentUser={currentUser}
                  onSaveCollection={handleSaveCollection}
                  theme={theme}
                />
              )}
              {activeTab === 'appManagement' && (
                <NotificationApkManagementView 
                  state={state} 
                  lang={lang} 
                  onSaveCollection={handleSaveCollection} 
                />
              )}
              {activeTab === 'webappSettings' && (
                <WebappSettingsView 
                  state={state} 
                  lang={lang} 
                  currentUser={currentUser}
                  onSaveSettings={handleSaveSettings} 
                />
              )}
              {activeTab === 'userSettings' && (
                <UserSettingsView 
                  lang={lang} 
                  currentUser={currentUser} 
                  state={state}
                  theme={theme}
                  setTheme={handleSetTheme}
                  customColors={customColors}
                  setCustomColors={handleSetCustomColors}
                  onUpdateUserProfile={handleUpdateUserProfile}
                  onSaveCollection={handleSaveCollection}
                  onSaveSettings={handleSaveSettings}
                />
              )}
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <footer
          className={`mt-auto flex h-12 items-center justify-between px-2 text-[11px] sm:px-3 lg:px-3 ${
            isDark ? 'border-t border-white/10 bg-slate-950 text-slate-500' : 'border-t bg-transparent'
          }`}
          style={isDark ? undefined : { borderColor: `${accentColor}28`, color: accentColor }}
        >
          <span>{lang === 'ta' ? 'பேரூராட்சிகளின் மேலாண்மை திட்டம்' : 'Town Panchayat Management System'} · {lang === 'ta' ? 'நிர்வாக முகப்பு' : 'Admin Portal'}</span>
          <span suppressHydrationWarning>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
