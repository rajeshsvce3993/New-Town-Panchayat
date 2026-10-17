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
  CheckCircle2
} from 'lucide-react';

import { Language, translations } from '@/components/translations';
import DashboardView from '@/components/DashboardView';
import MasterManagementView from '@/components/MasterManagementView';
import UserManagementView from '@/components/UserManagementView';
import ModuleManagementView from '@/components/ModuleManagementView';
import InspectionManagementView from '@/components/InspectionManagementView';
import InspectionEmployeeManagementView from '@/components/InspectionEmployeeManagementView';
import InspectionReportsView from '@/components/InspectionReportsView';
import EmployeeManagementView from '@/components/EmployeeManagementView';
import ReportsView from '@/components/ReportsView';
import WebappSettingsView from '@/components/WebappSettingsView';
import UserSettingsView from '@/components/UserSettingsView';
import PendingIssuesView from '@/components/PendingIssuesView';
import PfManagementView from '@/components/PfManagementView';
import NotificationApkManagementView from '@/components/NotificationApkManagementView';
import { ThemeType, themesConfig, CustomThemeColors, defaultCustomThemeColors } from '@/lib/themeConfig';
import { getUserEffectiveAllowedPages } from '@/lib/pageAccessControl';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [authenticating, setAuthenticating] = useState(false);

  // Core Global State
  const [state, setState] = useState<any>({
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
      theme: 'magic-lavender'
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
    transferRequests: []
  });

  // Navigation and Customization states
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<Language>('en');
  const [theme, setTheme] = useState<ThemeType>('magic-lavender');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [customColors, setCustomColors] = useState<CustomThemeColors>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('custom_theme_colors');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {}
      }
    }
    return defaultCustomThemeColors;
  });

  const handleSetCustomColors = (newColors: CustomThemeColors) => {
    setCustomColors(newColors);
    localStorage.setItem('custom_theme_colors', JSON.stringify(newColors));
  };

  const sanitizeTheme = (t: any): ThemeType => {
    const validThemes: ThemeType[] = [
      'sunset-aurora', 'ocean-wave', 'magic-lavender', 'rainbow-prism',
      'nilgiri-emerald', 'kovai-maroon', 'madurai-blue', 'nellai-orange',
      'chennai-slate', 'custom'
    ];
    if (validThemes.includes(t)) return t as ThemeType;
    return 'magic-lavender';
  };

  useEffect(() => {
    if (theme === 'custom') {
      const root = document.documentElement;
      root.style.setProperty('--theme-bg', customColors.appBgColor);
      root.style.setProperty('--theme-sidebar', `linear-gradient(135deg, ${customColors.sidebarFrom}, ${customColors.sidebarTo})`);
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

  // Fetch full database state
  const loadState = async (showToast: boolean = false) => {
    const startMs = Date.now();
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      const json = await res.json();
      if (json.success && json.data) {
        setState(json.data);
        // Map configs
        if (json.data.settings?.currentLanguage) {
          setLang(json.data.settings.currentLanguage);
        }
        if (json.data.settings?.theme) {
          const loadedTheme = json.data.settings.theme;
          // Only use global if no user-specific is saved yet
          if (currentUser) {
            const savedUserTheme = localStorage.getItem(`theme_user_${currentUser.id || currentUser.employeeId}`);
            setTheme(sanitizeTheme(savedUserTheme || loadedTheme));
          } else {
            setTheme(sanitizeTheme(loadedTheme));
          }
        }
        if (showToast) {
          const elapsed = Date.now() - startMs;
          setRefreshToast(lang === 'ta' ? `தரவுகள் உடனே புதுப்பிக்கப்பட்டன (${elapsed}ms) ✅` : `Refreshed in ${elapsed}ms ✅`);
          setTimeout(() => setRefreshToast(null), 2500);
        }
      }
    } catch (err) {
      console.error('Failed to load portal database state:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleInstantRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    loadState(true);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('ems_current_user');
      if (savedUser) {
        try {
          const parsed = JSON.parse(savedUser);
          setCurrentUser(parsed);
          if (parsed.isEmployee) {
            setActiveTab('employeeManagement');
          } else {
            setActiveTab('dashboard');
          }
        } catch (e) {
          console.error('Failed to parse saved user:', e);
        }
      }
    }
    loadState();
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
      setTheme('magic-lavender');
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

  // Cycle through themes in a loop mode except 'custom' theme
  const handleCycleTheme = async () => {
    const loopThemes: ThemeType[] = [
      'magic-lavender',
      'sunset-aurora',
      'ocean-wave',
      'rainbow-prism',
      'nilgiri-emerald',
      'kovai-maroon',
      'madurai-blue',
      'nellai-orange',
      'chennai-slate'
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
        await loadState();
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
        await loadState();
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
        await loadState();
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
        await loadState();
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
        await loadState();
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

    // 3. Instantly reset React UI state (zero millisecond switch to login screen)
    setCurrentUser(null);
    setActiveTab('dashboard');
    setLoginUsername('');
    setLoginPassword('');
    setLoginError('');
    setSidebarOpen(false);
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
        // Auto routing based on employee
        if (data.user.isEmployee) {
          setActiveTab('employeeManagement');
        } else {
          setActiveTab('dashboard');
        }
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
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <Activity className="w-12 h-12 text-indigo-600 animate-spin" />
        <p className="text-sm font-semibold text-slate-500 tracking-wider font-mono animate-pulse">{t('loading')}</p>
      </div>
    );
  }

  // Auth screen layout
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1e1b4b] via-[#3b0764] to-[#701a75] px-4 relative overflow-hidden">
        {/* Magic Lavender Ambient Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-500/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/20 blur-[120px] pointer-events-none" />
        <div className="absolute top-[40%] left-[30%] w-[30%] h-[30%] rounded-full bg-pink-500/10 blur-[100px] pointer-events-none" />

        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md bg-white/95 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden p-8 space-y-6 relative z-10"
        >
          {/* Brand header */}
          <div className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-700 via-fuchsia-600 to-pink-500 flex items-center justify-center text-white shadow-lg shadow-fuchsia-500/20">
              <Building className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{t('appName')}</h1>
              <p className="text-xs text-fuchsia-600 font-bold mt-1.5 uppercase tracking-wide">{t('tagline')}</p>
            </div>
          </div>

          <form onSubmit={handleLoginSubmit} className="space-y-4">
            {loginError && (
              <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold rounded-xl text-center">
                {loginError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t('username')}</label>
              <input
                type="text"
                required
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="Enter Username"
                className="w-full border border-purple-100 rounded-2xl p-3.5 text-sm outline-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-100 focus:border-fuchsia-500 transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">{t('password')}</label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter Password"
                className="w-full border border-purple-100 rounded-2xl p-3.5 text-sm outline-none bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-2 focus:ring-fuchsia-100 focus:border-fuchsia-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={authenticating}
              className="w-full py-4 bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-pink-500 hover:from-indigo-600 hover:via-fuchsia-500 hover:to-pink-400 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition-all duration-300 hover:shadow-lg hover:shadow-fuchsia-500/20 hover:scale-[1.01] tracking-wider uppercase flex items-center justify-center gap-2"
            >
              {authenticating ? 'Authenticating...' : t('login')}
            </button>
          </form>

          {/* Language selector in login */}
          <div className="flex justify-center border-t border-slate-100 pt-4">
            <button
              onClick={toggleLanguage}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-fuchsia-600 transition-colors"
            >
              <Globe className="w-4 h-4 text-fuchsia-500" />
              <span>{lang === 'en' ? 'தமிழ் இடைமுகம்' : 'English Interface'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Sidebar Menu mapping
  const adminMenuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard, view: DashboardView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'masters', label: t('masterManagement'), icon: Layers, view: MasterManagementView, roles: ['admin'] },
    { id: 'users', label: t('userManagement'), icon: ShieldAlert, view: UserManagementView, roles: ['admin'] },
    { id: 'modules', label: t('moduleManagement'), icon: Sliders, view: ModuleManagementView, roles: ['admin'] },
    { id: 'inspectionModules', label: t('inspectionModuleManagement'), icon: ClipboardCheck, view: InspectionManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'inspectionEmployees', label: t('inspectionEmployeeManagement'), icon: UserCheck, view: InspectionEmployeeManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'inspectionReports', label: t('inspectionReports'), icon: FileSpreadsheet, view: InspectionReportsView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'pfManagement', label: t('pfManagement'), icon: Calculator, view: PfManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'employees', label: t('employeeManagement'), icon: Users, view: EmployeeManagementView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'pendingIssues', label: t('pendingIssues'), icon: AlertTriangle, view: PendingIssuesView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'appManagement', label: lang === 'ta' ? 'அறிவிப்பு & பதிப்பு மேலாண்மை' : 'App Updates & Notifications', icon: Bell, view: NotificationApkManagementView, roles: ['admin'] },
    { id: 'userSettings', label: t('userSettings'), icon: UserCircle, view: UserSettingsView, roles: ['admin', 'ad', 'eo', 'zonal'] },
    { id: 'webappSettings', label: t('webappSettings'), icon: Settings, view: WebappSettingsView, roles: ['admin'] }
  ];

  const employeeMenuItems = [
    { id: 'employeeManagement', label: t('employeeManagement'), icon: Users, view: EmployeeManagementView },
    { id: 'inspectionReports', label: t('inspectionReports'), icon: FileSpreadsheet, view: InspectionReportsView },
    { id: 'pfManagement', label: t('pfManagement'), icon: Calculator, view: PfManagementView },
    { id: 'userSettings', label: t('userSettings'), icon: UserCircle, view: UserSettingsView }
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

  // Determine container theme style class maps
  const getThemeClass = () => {
    return `theme-${theme} bg-[var(--theme-bg)] text-[var(--theme-text-primary)]`;
  };

  const getCardThemeClass = () => {
    return `bg-[var(--theme-card-bg)] border-[var(--theme-card-border)] text-[var(--theme-text-primary)]`;
  };

  const currentThemeConfig = themesConfig[theme] || themesConfig['sunset-aurora'];

  return (
    <div className={`min-h-screen font-sans transition-colors duration-200 flex ${getThemeClass()}`}>
      {/* Sidebar Navigation */}
      <aside 
        className={`fixed inset-y-0 left-0 z-50 w-64 ${currentThemeConfig.sidebarBg} border-r border-white/10 flex flex-col justify-between transition-all duration-300 transform ${
          sidebarOpen 
            ? 'translate-x-0' 
            : sidebarCollapsed 
              ? 'md:-translate-x-full -translate-x-full' 
              : 'md:translate-x-0 -translate-x-full'
        }`}
      >
        <div className="p-6 flex flex-col h-full">
          {/* Logo - Fixed Top */}
          <div className="flex items-center justify-between pb-6 shrink-0 border-b border-white/5 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shadow-md">
                <Building className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xs sm:text-sm font-bold text-white break-words whitespace-normal leading-normal">{t('appName')}</h1>
                <span className="text-[10px] text-white/70 font-bold block uppercase tracking-wide mt-0.5">STATE PORTAL</span>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg md:hidden">
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>

          {/* Menu options list - Scrollable container */}
          <div className="flex-1 overflow-y-auto pr-1 space-y-1 scrollbar-custom">
            <nav className="space-y-1">
              {activeMenuItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                     key={item.id}
                     onClick={() => { setActiveTab(item.id); setSidebarOpen(false); }}
                     className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold tracking-wide transition text-left ${
                       active 
                         ? `${currentThemeConfig.sidebarActive} shadow-md` 
                         : `text-white/90 ${currentThemeConfig.sidebarHover}`
                     }`}
                  >
                    <Icon className={`w-5 h-5 ${active ? 'text-inherit' : 'text-white/80'}`} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom logout and user tag - Fixed Bottom */}
          <div className="border-t border-white/10 pt-4 mt-6 space-y-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {currentUser.profileImage || currentUser.profilePhotoUrl ? (
                  <img src={currentUser.profileImage || currentUser.profilePhotoUrl} alt="profile" className="w-full h-full rounded-full object-cover" />
                ) : (
                  (currentUser.nameEn || currentUser.name || currentUser.username || 'U').slice(0, 2).toUpperCase()
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white break-words whitespace-normal leading-normal">{tObj(currentUser)}</p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-semibold text-white/90 hover:bg-white/10 transition text-left cursor-pointer"
            >
              <LogOut className="w-5 h-5 text-white/80" />
              <span>{t('logout')}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Frame */}
      <div className={`flex-1 min-w-0 flex flex-col min-h-screen transition-all duration-300 ${sidebarCollapsed ? 'md:pl-0' : 'md:pl-64'}`}>
        {/* Dynamic header navbar */}
        <header className="h-16 px-6 bg-transparent border-b border-[var(--theme-header-border)] flex items-center justify-between relative z-40 print:hidden text-[var(--theme-text-primary)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-[var(--theme-table-row-hover)] rounded-xl md:hidden">
              <Menu className="w-5 h-5 text-[var(--theme-text-muted)]" />
            </button>
            
            {/* Small arrow button to hide sidebar on desktop */}
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1.5 hover:bg-[var(--theme-table-row-hover)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] rounded-xl hidden md:flex items-center justify-center transition duration-200 cursor-pointer"
              title={sidebarCollapsed ? (lang === 'ta' ? 'பட்டி காட்டுக' : 'Show Menu') : (lang === 'ta' ? 'பட்டி மறைக்க' : 'Hide Menu')}
            >
              <AnimatePresence mode="wait">
                {sidebarCollapsed ? (
                  <motion.div
                    key="arrow-right"
                    initial={{ opacity: 0, scale: 0.8, x: -4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: 4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ArrowRight className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="arrow-left"
                    initial={{ opacity: 0, scale: 0.8, x: 4 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, x: -4 }}
                    transition={{ duration: 0.15 }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>

            <h2 className="text-sm font-bold text-[var(--theme-text-primary)] uppercase tracking-wider hidden sm:block">
              {tObj(activeMenuItems.find(i => i.id === activeTab))}
            </h2>
          </div>

          {/* Quick Actions: Instant Refresh, Theme, Language & Logout */}
          <div className="flex items-center gap-2.5">
            {/* Instant Refresh Button */}
            <button
              onClick={handleInstantRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--theme-table-header)] border border-[var(--theme-card-border)] hover:bg-[var(--theme-table-row-hover)] rounded-xl text-xs font-semibold text-[var(--theme-text-secondary)] transition cursor-pointer disabled:opacity-60"
              title={lang === 'ta' ? 'உடனடி புதுப்பிப்பு (Instant Refresh)' : 'Instant Refresh'}
            >
              <RefreshCw className={`w-4 h-4 text-emerald-500 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-medium">
                {isRefreshing ? (lang === 'ta' ? 'புதுப்பிக்கிறது...' : 'Refreshing...') : (lang === 'ta' ? 'புதுப்பி' : 'Refresh')}
              </span>
            </button>

            {/* Theme switcher single action looping */}
            <button 
              onClick={handleCycleTheme} 
              className="flex items-center gap-2 px-3 py-2 bg-[var(--theme-table-header)] border border-[var(--theme-card-border)] hover:bg-[var(--theme-table-row-hover)] rounded-xl text-xs font-semibold text-[var(--theme-text-secondary)] transition cursor-pointer"
              title={lang === 'ta' ? 'தீம் மாற்றவும்' : 'Cycle Theme'}
            >
              <Palette className="w-4 h-4 text-indigo-500" />
              <span className="capitalize hidden md:inline">{themesConfig[theme]?.nameEn || theme}</span>
            </button>

            <button
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-3 py-2 bg-[var(--theme-table-header)] border border-[var(--theme-card-border)] hover:bg-[var(--theme-table-row-hover)] rounded-xl text-xs font-semibold text-[var(--theme-text-secondary)] transition cursor-pointer"
            >
              <Globe className="w-4 h-4 text-indigo-500" />
              <span>{lang === 'en' ? 'தமிழ்' : 'English'}</span>
            </button>

            {currentUser && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition cursor-pointer"
                title={t('logout')}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </button>
            )}
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

        {/* Content workspace stage */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.15 }}
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
      </div>
    </div>
  );
}
