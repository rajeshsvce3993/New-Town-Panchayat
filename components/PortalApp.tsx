'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Building, 
  Menu, 
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
  Palette,
  Activity,
  ArrowLeftRight,
  Sun,
  LayoutGrid,
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
  CheckCircle2,
  Moon
} from 'lucide-react';

import dynamic from 'next/dynamic';
import { Language, translations } from '@/components/translations';
import { ThemeType, themesConfig, CustomThemeColors, defaultCustomThemeColors, getThemeSidebarGradient } from '@/lib/themeConfig';
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
    if (theme === 'custom') {
      const root = document.documentElement;
      root.style.setProperty('--theme-bg', customColors.appBgColor);
      root.style.setProperty('--theme-sidebar', `linear-gradient(180deg, ${customColors.sidebarFrom} 0%, ${customColors.sidebarTo} 100%)`);
      root.style.setProperty('--theme-card-bg', '#ffffff');
      root.style.setProperty('--theme-card-border', `${customColors.primaryColor}20`);
      root.style.setProperty('--theme-text-primary', '#1c0e0e');
      root.style.setProperty('--theme-text-secondary', customColors.primaryColor);
      root.style.setProperty('--theme-text-muted', '#64748b');
      root.style.setProperty('--theme-border', `${customColors.primaryColor}20`);
      root.style.setProperty('--theme-header-bg', '#ffffff');
      root.style.setProperty('--theme-header-border', `${customColors.primaryColor}15`);
      root.style.setProperty('--theme-primary-btn', customColors.primaryColor);
      root.style.setProperty('--theme-primary-btn-hover', customColors.primaryColor);
      root.style.setProperty('--theme-primary-btn-text', '#ffffff');
      root.style.setProperty('--theme-table-header', `${customColors.primaryColor}10`);
      root.style.setProperty('--theme-table-row-even', `${customColors.appBgColor}`);
      root.style.setProperty('--theme-table-row-hover', `${customColors.primaryColor}08`);
      root.style.setProperty('--theme-badge-bg', customColors.accentBgColor);
      root.style.setProperty('--theme-badge-text', customColors.primaryColor);
      root.style.setProperty('--theme-scrollbar-thumb', `${customColors.primaryColor}90`);
      root.style.setProperty('--theme-scrollbar-thumb-hover', customColors.primaryColor);
      
      // Update custom theme active menu styling as well
      root.style.setProperty('--theme-active-menu', customColors.primaryColor);
      root.style.setProperty('--theme-active-menu-text', '#ffffff');
    } else {
      const root = document.documentElement;
      const themeConf = themesConfig[theme];
      if (themeConf?.accentColor) {
        root.style.setProperty('--theme-scrollbar-thumb', `${themeConf.accentColor}90`);
        root.style.setProperty('--theme-scrollbar-thumb-hover', themeConf.accentColor);
        root.style.setProperty('--theme-primary-btn', themeConf.accentColor);
      }
      const props = [
        '--theme-bg', '--theme-sidebar', '--theme-card-bg', '--theme-card-border',
        '--theme-text-primary', '--theme-text-secondary', '--theme-text-muted',
        '--theme-border', '--theme-header-bg', '--theme-header-border',
        '--theme-primary-btn-hover', '--theme-primary-btn-text',
        '--theme-table-header', '--theme-table-row-even', '--theme-table-row-hover',
        '--theme-badge-bg', '--theme-badge-text',
        '--theme-active-menu', '--theme-active-menu-text'
      ];
      props.forEach(p => root.style.removeProperty(p));
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

  const handleCycleTheme = async () => {
    const loopThemes: ThemeType[] = [
      'light',
      'dark',
      'ocean-wave',
      'sunset-aurora',
      'magic-lavender',
      'rainbow-prism',
      'nilgiri-emerald',
      'kovai-maroon',
      'madurai-blue',
      'nellai-orange',
      'chennai-slate',
      'royal-gold',
      'crimson-ruby',
      'cyber-teal',
    ];
    const currentIndex = loopThemes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % loopThemes.length;
    await handleSetTheme(loopThemes[nextIndex]);
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
  const activePageLabel = activeMenuItems.find((i) => i.id === activeTab)?.label || t('dashboard');
  const userDisplayName = tObj(currentUser) || currentUser.username || 'User';
  const userRoleLabel = currentUser.designationNameEn || currentUser.designation || currentUser.role || currentUser.roleId || 'Admin';
  const currentTheme = themesConfig[theme] || themesConfig['ocean-wave'];
  const isDark = theme === 'dark';
  const accentColor = theme === 'custom' ? customColors.primaryColor : currentTheme.accentColor;
  const sidebarGradient = getThemeSidebarGradient(theme, customColors);
  const isRail = sidebarCollapsed;
  const brandTitle = lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat';
  const brandSub = lang === 'ta' ? 'நிர்வாக முகப்பு' : 'Management Portal';
  const headerIconBtn = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
    isDark
      ? 'text-slate-400 hover:bg-white/10 hover:text-slate-100'
      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'
  }`;
  const headerTextBtn = `inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold transition-colors ${
    isDark
      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;
  const headerSubtitle =
    activeTab === 'dashboard'
      ? lang === 'ta'
        ? 'டாஷ்போர்டு — நிர்வாக சுருக்கம்'
        : 'Dashboard overview'
      : userRoleLabel;
  const headerTitle =
    activeTab === 'dashboard'
      ? `${lang === 'ta' ? 'வணக்கம்' : 'Welcome'}, ${userDisplayName}`
      : activePageLabel;
  const userInitials = userDisplayName.slice(0, 2).toUpperCase();
  const shellBgClass = theme === 'custom' ? '' : currentTheme.mainBg || 'bg-[#f5f7fa]';
  const shellBgStyle = theme === 'custom' ? { backgroundColor: customColors.appBgColor } : undefined;

  return (
    <div
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
        className={`portal-sidenav fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col text-white transition-[width,transform] duration-300 ease-out print:hidden md:sticky md:inset-auto md:top-0 md:z-20 md:h-screen md:shrink-0 ${
          isRail ? 'md:w-[4.25rem]' : 'md:w-[248px]'
        } ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ backgroundImage: sidebarGradient }}
      >
        <div className="relative flex min-h-[4.5rem] w-full shrink-0 items-center border-b border-white/12 px-3 py-2.5">
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
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/35">
                <img
                  src="/app_icon.png"
                  alt=""
                  className="h-8 w-8 object-contain"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = '/login-logo.png';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex w-full min-w-0 items-center gap-2.5 pr-7 md:pr-0">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-white/35">
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
                <p className="text-[17px] font-extrabold leading-snug text-white">{brandTitle}</p>
                <p className="mt-0.5 text-[12px] font-semibold leading-snug text-white/75">{brandSub}</p>
              </div>
            </div>
          )}
        </div>

        <nav className={`portal-nav-scroll min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden py-2 ${isRail ? 'px-1.5' : 'pl-4 pr-2'}`}>
          {menuGroups.map((group, groupIndex) => {
            const items = activeMenuItems.filter((item) => group.ids.includes(item.id));
            if (items.length === 0) return null;
            return (
              <div key={group.id} className={groupIndex === 0 ? 'mb-0.5' : 'mt-2 mb-0.5'}>
                <p
                  className={`portal-nav-group-label pl-2.5 pr-1 pb-1 ${isRail ? 'md:hidden' : ''}`}
                >
                  {lang === 'ta' ? group.labelTa : group.labelEn}
                </p>
                <div className="flex w-full flex-col gap-0">
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
                        className={`portal-nav-item w-full rounded-lg transition-colors ${
                          isRail
                            ? 'flex h-11 items-center justify-center px-0'
                            : 'grid min-h-[2.375rem] grid-cols-[1.375rem_minmax(0,1fr)] items-center gap-x-2.5 pl-3 pr-2 py-1.5 text-left'
                        } ${
                          active
                            ? 'portal-nav-item-active bg-white/[0.14] text-white'
                            : 'text-white/80 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <Icon className="h-5 w-5" strokeWidth={active ? 2.25 : 2} />
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

      <button
        type="button"
        onClick={() => setSidebarCollapsed((v) => !v)}
        className={`portal-sidenav-toggle fixed z-[60] hidden h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border shadow-[0_2px_10px_rgba(15,47,107,0.12)] transition-[left] duration-300 ease-out md:inline-flex ${
          isDark
            ? 'border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700'
            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
        }`}
        style={{ left: isRail ? '4.25rem' : '248px', top: '2.25rem' }}
        title={isRail ? (lang === 'ta' ? 'பட்டி காட்டுக' : 'Expand menu') : (lang === 'ta' ? 'பட்டி சுருக்குக' : 'Collapse menu')}
        aria-label={isRail ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <Menu className="h-[1.125rem] w-[1.125rem]" strokeWidth={2.25} />
      </button>

      <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${!isDark ? 'bg-[#eef2f7]' : ''}`}>
        <header
          className={`portal-topbar sticky top-0 z-30 print:hidden backdrop-blur-md ${
            isDark ? 'border-b border-white/10 bg-slate-950/95' : 'border-b border-slate-200/80 bg-white/95'
          }`}
        >
          <div className="flex min-h-[4.25rem] w-full items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className={`${headerIconBtn} md:hidden`}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <h1
                className={`truncate text-lg font-bold leading-tight tracking-tight sm:text-xl ${
                  isDark ? 'text-slate-50' : 'text-slate-900'
                }`}
              >
                {headerTitle}
              </h1>
              <p className={`mt-0.5 truncate text-[13px] sm:text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {headerSubtitle}
              </p>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
              <div
                className={`flex items-center gap-0.5 rounded-xl p-0.5 ${
                  isDark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-slate-100/90 ring-1 ring-slate-200/80'
                }`}
              >
                <button
                  type="button"
                  onClick={handleInstantRefresh}
                  disabled={isRefreshing}
                  className={`${headerIconBtn} disabled:opacity-50`}
                  title={isRefreshing ? (lang === 'ta' ? 'புதுப்பிக்கிறது...' : 'Refreshing…') : (lang === 'ta' ? 'புதுப்பி' : 'Refresh')}
                  aria-label="Refresh"
                >
                  <RefreshCw className={`h-[1.125rem] w-[1.125rem] ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleCycleTheme}
                  className={headerIconBtn}
                  title={lang === 'ta' ? 'தீம் மாற்றவும்' : `Theme: ${currentTheme.nameEn || theme}`}
                  aria-label="Change theme"
                >
                  <Palette className="h-[1.125rem] w-[1.125rem]" />
                </button>
                <button
                  type="button"
                  onClick={toggleLanguage}
                  className={headerTextBtn}
                  title={lang === 'en' ? 'Switch to Tamil' : 'Switch to English'}
                >
                  <Globe className="h-[1.125rem] w-[1.125rem]" />
                  <span className="hidden pr-0.5 sm:inline">{lang === 'en' ? 'TA' : 'EN'}</span>
                </button>
              </div>

              <div
                className={`flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 ${
                  isDark ? 'bg-white/[0.06] ring-1 ring-white/10' : 'bg-slate-50 ring-1 ring-slate-200/90'
                }`}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg text-[11px] font-bold text-white shadow-sm"
                  style={{ backgroundColor: accentColor }}
                >
                  {currentUser.profileImage || currentUser.profilePhotoUrl ? (
                    <img src={currentUser.profileImage || currentUser.profilePhotoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    userInitials
                  )}
                </div>
                <div className="hidden min-w-0 max-w-[11rem] md:block">
                  <p className={`truncate text-[13px] font-semibold leading-tight ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                    {userDisplayName}
                  </p>
                  <p className={`truncate text-[11px] leading-tight ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                    {userRoleLabel}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className={`${headerIconBtn} ${
                    isDark ? 'text-rose-300 hover:bg-rose-500/15 hover:text-rose-200' : 'text-rose-600 hover:bg-rose-50'
                  }`}
                  title={t('logout')}
                  aria-label={t('logout')}
                >
                  <LogOut className="h-[1.125rem] w-[1.125rem]" />
                </button>
              </div>
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
          className={`relative mx-auto w-full min-w-0 max-w-[1680px] flex-1 overflow-x-hidden px-4 py-5 sm:px-6 lg:px-8 ${
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
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
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
        <footer className={`mt-auto flex h-12 items-center justify-between px-6 text-[11px] ${
          isDark ? 'border-t border-white/10 bg-slate-950 text-slate-500' : 'border-t border-slate-200 bg-white text-slate-400'
        }`}>
          <span>{lang === 'ta' ? 'பேரூராட்சிகளின் மேலாண்மை திட்டம்' : 'Town Panchayat Management System'} · {lang === 'ta' ? 'நிர்வாக முகப்பு' : 'Admin Portal'}</span>
          <span suppressHydrationWarning>© {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
