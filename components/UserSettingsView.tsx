'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Palette, 
  Lock, 
  Upload, 
  CheckCircle, 
  Zap, 
  Calculator,
  Building2,
  MapPin,
  Info,
  Check,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  SlidersHorizontal
} from 'lucide-react';
import { Language, translations } from './translations';
import { ThemeType, CustomThemeColors, defaultCustomThemeColors } from '@/lib/themeConfig';

interface UserSettingsViewProps {
  lang: Language;
  currentUser: any;
  state?: any;
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  customColors: CustomThemeColors;
  setCustomColors: (colors: CustomThemeColors) => void;
  onUpdateUserProfile: (updatedUser: any) => Promise<void>;
  onSaveCollection?: (key: string, data: any[]) => Promise<void>;
  onSaveSettings?: (settings: any) => Promise<void>;
}

export default function UserSettingsView({
  lang,
  currentUser,
  state,
  theme,
  setTheme,
  customColors,
  setCustomColors,
  onUpdateUserProfile,
  onSaveCollection,
  onSaveSettings
}: UserSettingsViewProps) {
  // Role checks: Only DTP and Admin user roles are authorized to configure/change PF Calculation Methods
  // (Employees, Town Panchayat Executive Officers, and Zonal ADTP users cannot change PF calculation methods)
  const isDtpOrAdmin = !currentUser?.isEmployee && (
    currentUser?.roleId === 'admin' ||
    currentUser?.roleId === 'dtp_admin' ||
    currentUser?.roleId === 'dtp_user' ||
    currentUser?.roleId === 'dtp' ||
    currentUser?.scopeType === 'State' ||
    currentUser?.scopeType === 'HOD'
  );
  const canConfigurePfMethod = isDtpOrAdmin;

  // Active subtab in User Settings
  const [activeSettingsTab, setActiveSettingsTab] = useState<'profile' | 'theme' | 'pf_calc'>('profile');

  // Profile Form States
  const [nameEn, setNameEn] = useState(currentUser?.nameEn || '');
  const [nameTa, setNameTa] = useState(currentUser?.nameTa || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileImage, setProfileImage] = useState(currentUser?.profileImage || '');

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [passError, setPassError] = useState('');

  // ----------------------------------------------------
  // PF Calculation Method States (Requirement 1: DTP & Admin only)
  // ----------------------------------------------------
  const zoneDistricts = useMemo(() => {
    return state?.districts || [];
  }, [state?.districts]);

  const allowedTownPanchayats = useMemo(() => {
    return state?.townPanchayats || [];
  }, [state?.townPanchayats]);

  const [filterDistrictId, setFilterDistrictId] = useState<string>('all');
  const filteredTownPanchayats = useMemo(() => {
    if (filterDistrictId === 'all') return allowedTownPanchayats;
    return allowedTownPanchayats.filter((tp: any) => tp.districtId === filterDistrictId);
  }, [allowedTownPanchayats, filterDistrictId]);

  const [manuallySelectedTpId, setManuallySelectedTpId] = useState<string>('');
  const selectedTpId = useMemo(() => {
    if (manuallySelectedTpId && allowedTownPanchayats.some((tp: any) => tp.id === manuallySelectedTpId)) {
      return manuallySelectedTpId;
    }
    return allowedTownPanchayats[0]?.id || '';
  }, [manuallySelectedTpId, allowedTownPanchayats]);

  const setSelectedTpId = (id: string) => {
    setManuallySelectedTpId(id);
  };

  // Read the current method for selected TP
  const currentTpObj = useMemo(() => {
    return state?.townPanchayats?.find((tp: any) => tp.id === selectedTpId) || null;
  }, [state?.townPanchayats, selectedTpId]);

  const savedMethodForTp = useMemo(() => {
    return currentTpObj?.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[selectedTpId] || 'method1';
  }, [currentTpObj, selectedTpId, state?.settings?.pfCalculationMethods]);

  const [methodOverrides, setMethodOverrides] = useState<Record<string, 'method1' | 'method2' | 'method3'>>({});
  const selectedMethod: 'method1' | 'method2' | 'method3' = methodOverrides[selectedTpId] || (savedMethodForTp as any) || 'method1';

  const setSelectedMethod = (method: 'method1' | 'method2' | 'method3') => {
    if (selectedTpId) {
      setMethodOverrides(prev => ({ ...prev, [selectedTpId]: method }));
    }
  };

  const [pfMethodSaveSuccess, setPfMethodSaveSuccess] = useState<string>('');
  const [pfMethodSaving, setPfMethodSaving] = useState<boolean>(false);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  // Get actual current password from state
  const getActualPassword = () => {
    if (!currentUser) return '';
    if (!currentUser.isEmployee) {
      const dbUser = state?.users?.find((u: any) => u.id === currentUser.id);
      return dbUser?.passwordHash || '';
    } else {
      const dbEmp = state?.employees?.find((e: any) => e.id === currentUser.id || e.employeeId === currentUser.employeeId);
      return dbEmp?.passwordHash || '';
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');

    const actualPassword = getActualPassword();

    if (!currentPassword) {
      setPassError(lang === 'ta' ? 'மாற்றங்களைச் சேமிக்க தற்போதைய கடவுச்சொல் தேவை!' : 'Current password is required to save changes!');
      return;
    }

    if (currentPassword !== actualPassword) {
      setPassError(lang === 'ta' ? 'தவறான தற்போதைய கடவுச்சொல்!' : 'Incorrect current password!');
      return;
    }

    if (newPassword || confirmPassword) {
      if (newPassword !== confirmPassword) {
        setPassError(lang === 'ta' ? 'புதிய கடவுச்சொற்கள் பொருந்தவில்லை!' : 'New passwords do not match!');
        return;
      }
    }

    const updatedUserObj = {
      ...currentUser,
      nameEn: currentUser?.isEmployee ? (currentUser.nameEn || nameEn) : nameEn,
      nameTa: currentUser?.isEmployee ? (currentUser.nameTa || nameTa) : nameTa,
      profileImage,
      passwordHash: newPassword ? newPassword : actualPassword
    };

    await onUpdateUserProfile(updatedUserObj);
    setSaveSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleProfilePicUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setProfileImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handler to assign PF Calculation Method for a Town Panchayat
  const handleSavePfCalculationMethod = async () => {
    if (!selectedTpId) return;
    setPfMethodSaving(true);
    setPfMethodSaveSuccess('');

    try {
      // 1. Update in townPanchayats master collection
      const allTownPanchayats = state?.townPanchayats || [];
      const updatedTps = allTownPanchayats.map((tp: any) => {
        if (tp.id === selectedTpId) {
          return {
            ...tp,
            pfCalculationMethod: selectedMethod
          };
        }
        return tp;
      });

      if (onSaveCollection) {
        await onSaveCollection('townPanchayats', updatedTps);
      }

      // 2. Also sync to settings.pfCalculationMethods map
      const currentSettings = state?.settings || {};
      const updatedSettings = {
        ...currentSettings,
        pfCalculationMethods: {
          ...(currentSettings.pfCalculationMethods || {}),
          [selectedTpId]: selectedMethod
        }
      };

      if (onSaveSettings) {
        await onSaveSettings(updatedSettings);
      }

      const tpName = lang === 'ta' ? (currentTpObj?.nameTa || currentTpObj?.nameEn) : (currentTpObj?.nameEn || currentTpObj?.nameTa);
      setPfMethodSaveSuccess(
        lang === 'ta'
          ? `${tpName} பேரூராட்சிக்கு "${
              selectedMethod === 'method1' ? 'முறை 1 (அரசு வழக்கம்)' : selectedMethod === 'method2' ? 'முறை 2 (ஆண்டு கூட்டு வட்டி)' : 'முறை 3 (முழு இருப்பு + கூட்டு வட்டி + ஓய்வுக்குப் பின்னும் வட்டி)'
            }" வெற்றிகரமாக நிர்ணயிக்கப்பட்டது!`
          : `PF Calculation Method "${
              selectedMethod === 'method1' ? 'Method 1 (Standard Govt)' : selectedMethod === 'method2' ? 'Method 2 (Annual Cumulative)' : 'Method 3 (Full Ineligible + Cumulative + Post-Retire)'
            }" assigned to ${tpName} successfully!`
      );

      setTimeout(() => setPfMethodSaveSuccess(''), 4500);
    } catch (err) {
      console.error('Failed to save calculation method:', err);
    } finally {
      setPfMethodSaving(false);
    }
  };

  const methodCardStyle = (active: boolean): React.CSSProperties | undefined =>
    active
      ? {
          borderColor: 'var(--theme-accent)',
          background: 'color-mix(in srgb, var(--theme-accent) 8%, #ffffff)',
          boxShadow: '0 0 0 1px var(--theme-accent)',
        }
      : undefined;

  return (
    <div id="user-settings-view-container" className="portal-studio">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <User className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {lang === 'ta' ? 'பயனர் அமைப்புகள் & கட்டமைப்பு' : 'User Settings & Configuration'}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? (canConfigurePfMethod
                    ? 'சுயவிவரம், கடவுச்சொல், நிறத் தோற்றம் மற்றும் பேரூராட்சிகளின் PF கணக்கீட்டு முறைகளை நிர்வகிக்கவும்'
                    : 'சுயவிவரம், கடவுச்சொல் மற்றும் நிறத் தோற்றத்தை நிர்வகிக்கவும்')
                : (canConfigurePfMethod
                    ? 'Manage your profile credentials, aesthetic themes, and Town Panchayat PF calculation methods'
                    : 'Manage your profile credentials and aesthetic themes')}
            </p>
          </div>
        </div>
      </div>

      <div className="portal-fis-body portal-page">
      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <button
            type="button"
            onClick={() => setActiveSettingsTab('profile')}
            className={`portal-dash-pill ${activeSettingsTab === 'profile' ? 'is-active' : ''}`}
          >
            <User className="h-3.5 w-3.5" />
            <span>{t('userSettings')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSettingsTab('theme')}
            className={`portal-dash-pill ${activeSettingsTab === 'theme' ? 'is-active' : ''}`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>{t('themeSettings')}</span>
          </button>
          {canConfigurePfMethod && (
            <button
              type="button"
              onClick={() => setActiveSettingsTab('pf_calc')}
              className={`portal-dash-pill ${activeSettingsTab === 'pf_calc' ? 'is-active' : ''}`}
            >
              <Calculator className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'PF கணக்கீட்டு முறை தேர்வு' : 'PF Calculation Methods'}</span>
            </button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PF CALCULATION METHOD CONFIGURATION (FOR DTP & ADMIN ONLY) */}
      {/* ------------------------------------------------------------- */}
      {activeSettingsTab === 'pf_calc' && canConfigurePfMethod && (
        <div className="space-y-3">
          <div className="portal-dash-toolbar">
            <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-600">
              <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: 'var(--theme-accent)' }} />
              <span>
                {lang === 'ta'
                  ? 'மாநில இயக்குநர் (DTP) / முதன்மை நிர்வாகி (Admin) - ஒவ்வொரு பேரூராட்சிக்கும் PF கணக்கீட்டு முறையை ஒதுக்கலாம்.'
                  : 'DTP & State Admin — assign one of 3 PF calculation methods for each Town Panchayat.'}
              </span>
            </div>
            <span className="portal-dash-pill is-active">
              {filteredTownPanchayats.length} {lang === 'ta' ? 'பேரூராட்சிகள்' : 'Town Panchayats'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            <div className="lg:col-span-8 space-y-3">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Building2 className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? '1. பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : '1. Select Individual Town Panchayat'}
                    </h3>
                    <p>
                      {lang === 'ta'
                        ? 'மாவட்டம் மற்றும் பேரூராட்சியைத் தேர்ந்தெடுத்து முறையை ஒதுக்கவும்'
                        : 'Filter by district, pick a Town Panchayat, then assign a method'}
                    </p>
                  </div>
                </div>
                <div className="portal-dash-body portal-wt-form">
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label>
                        <MapPin className="mr-1 inline h-3 w-3" />
                        {lang === 'ta' ? 'மாவட்டம் வாரியாக வடிகட்டுக' : 'Filter by District'}
                      </label>
                      <select
                        value={filterDistrictId}
                        onChange={(e) => setFilterDistrictId(e.target.value)}
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}</option>
                        {zoneDistricts.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {lang === 'ta' ? (d.nameTa || d.nameEn) : (d.nameEn || d.nameTa)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>
                        <Building2 className="mr-1 inline h-3 w-3" />
                        {lang === 'ta' ? 'பேரூராட்சி தேர்வு' : 'Target Town Panchayat'}
                      </label>
                      <select
                        value={selectedTpId}
                        onChange={(e) => setSelectedTpId(e.target.value)}
                      >
                        {filteredTownPanchayats.map((tp: any) => {
                          const method = tp.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[tp.id] || 'method1';
                          const methodTag = method === 'method1' ? '[Method 1]' : method === 'method2' ? '[Method 2]' : '[Method 3]';
                          return (
                            <option key={tp.id} value={tp.id}>
                              {methodTag} {lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {currentTpObj && (
                    <div className="portal-wt-note">
                      <span>
                        {lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டது:' : 'Currently Configuring:'}{' '}
                        <strong>{lang === 'ta' ? (currentTpObj.nameTa || currentTpObj.nameEn) : (currentTpObj.nameEn || currentTpObj.nameTa)}</strong>
                        {' · '}
                        {lang === 'ta' ? 'தற்போதைய முறை:' : 'Active Method:'}{' '}
                        {(currentTpObj.pfCalculationMethod || 'method1') === 'method1'
                          ? 'Method 1 (Standard)'
                          : (currentTpObj.pfCalculationMethod || 'method1') === 'method2'
                          ? 'Method 2 (Cumulative)'
                          : 'Method 3 (Full + Cumulative + Post-Retire)'}
                      </span>
                    </div>
                  )}
                </div>

                <p className="portal-wt-section-title">
                  <span className="inline-flex items-center gap-1.5">
                    <SlidersHorizontal className="h-3 w-3" />
                    {lang === 'ta' ? '2. கணக்கீட்டு முறையைத் தேர்வு செய்க (3 முறைகள்)' : '2. Choose Calculation Method (3 Methods)'}
                  </span>
                </p>

                <div
                  onClick={() => setSelectedMethod('method1')}
                  className={`portal-dashboard-panel cursor-pointer p-3 transition-all ${selectedMethod === 'method1' ? '' : 'hover:brightness-[0.99]'}`}
                  style={methodCardStyle(selectedMethod === 'method1')}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method1'}
                            onChange={() => setSelectedMethod('method1')}
                            className="h-4 w-4 cursor-pointer"
                            style={{ accentColor: 'var(--theme-accent)' }}
                          />
                          <span className="text-sm font-bold text-slate-900">
                            {lang === 'ta'
                              ? 'முறை 1: அரசு வழக்கமான முறை (நடப்பு கணக்கீட்டு முறை)'
                              : 'Method 1: Standard Govt Rule (Current Calculation Method)'}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            Standard Rule
                          </span>
                        </div>
                        <p className="pl-6 text-xs text-slate-600">
                          {lang === 'ta'
                            ? 'ஆரம்ப இருப்பில் தகுதியற்ற தொகைகள் கழிக்கப்படும். திரட்டப்பட்ட வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் கூட்டப்படாது. ஊழியர் ஓய்வு பெற்ற மாதத்திற்குப் பின் வட்டி நிறுத்தப்படும்.'
                            : 'Opening balance deducts ineligible amounts. Annual accrued interest is kept for audit but NOT compounded into next year opening balance. Interest stops after retirement.'}
                        </p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selectedMethod === 'method1' ? 'text-white' : 'border border-slate-300'}`}
                        style={selectedMethod === 'method1' ? { background: 'var(--theme-accent)' } : undefined}
                      >
                        {selectedMethod === 'method1' && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                </div>

                <div
                  onClick={() => setSelectedMethod('method2')}
                  className={`portal-dashboard-panel cursor-pointer p-3 transition-all ${selectedMethod === 'method2' ? '' : 'hover:brightness-[0.99]'}`}
                  style={methodCardStyle(selectedMethod === 'method2')}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method2'}
                            onChange={() => setSelectedMethod('method2')}
                            className="h-4 w-4 cursor-pointer"
                            style={{ accentColor: 'var(--theme-accent)' }}
                          />
                          <span className="text-sm font-bold text-slate-900">
                            {lang === 'ta'
                              ? 'முறை 2: ஆண்டு கூட்டு வட்டி முறை (அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேரும் முறை)'
                              : 'Method 2: Annual Cumulative Compounding with Next Year Opening Balance'}
                          </span>
                          <span className="rounded-md px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: 'var(--theme-accent)' }}>
                            Annual Compounded
                          </span>
                        </div>
                        <p className="pl-6 text-xs text-slate-600">
                          {lang === 'ta'
                            ? 'தகுதியற்ற தொகைகள் கழிக்கப்பட்ட ஆரம்ப இருப்பு. ஒவ்வொரு நிதியாண்டின் இறுதியிலும் (மார்ச் 31) சேர்ந்த மொத்த வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேர்க்கப்பட்டு கூட்டு வட்டியாகக் கணக்கிடப்படும்.'
                            : 'Opening balance deducts ineligible amounts. Accumulated interest at FY-end is added to next year opening balance (compounded annually). Future interest calculates on the cumulative balance.'}
                        </p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selectedMethod === 'method2' ? 'text-white' : 'border border-slate-300'}`}
                        style={selectedMethod === 'method2' ? { background: 'var(--theme-accent)' } : undefined}
                      >
                        {selectedMethod === 'method2' && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                </div>

                <div
                  onClick={() => setSelectedMethod('method3')}
                  className={`portal-dashboard-panel cursor-pointer p-3 transition-all ${selectedMethod === 'method3' ? '' : 'hover:brightness-[0.99]'}`}
                  style={methodCardStyle(selectedMethod === 'method3')}
                >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method3'}
                            onChange={() => setSelectedMethod('method3')}
                            className="h-4 w-4 cursor-pointer"
                            style={{ accentColor: 'var(--theme-accent)' }}
                          />
                          <span className="text-sm font-bold text-slate-900">
                            {lang === 'ta'
                              ? 'முறை 3: முழு ஆரம்ப இருப்பு + கூட்டு வட்டி + ஓய்வுக்குப் பின்னும் வட்டி தொடரும் முறை'
                              : 'Method 3: Full Ineligible Balance + Annual Cumulative + Post-Retirement Interest'}
                          </span>
                          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Full Balance + Cumulative + Post-Retire
                          </span>
                        </div>
                        <p className="pl-6 text-xs text-slate-600">
                          {lang === 'ta'
                            ? 'ஆரம்ப இருப்பில் தகுதியற்ற தொகைகள் கழிக்கப்படாது (முழுத் தொகைக்கும் வட்டி கணக்கீடு). ஆண்டு வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேர்க்கப்படும். மேலும் ஓய்வு பெற்ற ஊழியர்களுக்கு இறுதி தீர்வு வரை தொடர்ந்து வட்டி ஏறும்!'
                            : 'No deduction of ineligible amounts (calculates on full gross balance). Annual interest is cumulative with next year opening balance, and interest continues to calculate for retired employees until final settlement!'}
                        </p>
                      </div>
                      <div
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${selectedMethod === 'method3' ? 'text-white' : 'border border-slate-300'}`}
                        style={selectedMethod === 'method3' ? { background: 'var(--theme-accent)' } : undefined}
                      >
                        {selectedMethod === 'method3' && <Check className="h-3 w-3" />}
                      </div>
                    </div>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={handleSavePfCalculationMethod}
                    disabled={pfMethodSaving || !selectedTpId}
                    className="inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-bold text-white disabled:opacity-50"
                    style={{ background: 'var(--theme-accent)' }}
                  >
                    <CheckCircle className="h-4 w-4" />
                    {pfMethodSaving
                      ? (lang === 'ta' ? 'சேமிக்கப்படுகிறது...' : 'Saving Method...')
                      : (lang === 'ta'
                          ? `தேர்ந்தெடுத்த பேரூராட்சிக்கு முறையைச் சேமி (${selectedMethod === 'method1' ? 'முறை 1' : selectedMethod === 'method2' ? 'முறை 2' : 'முறை 3'})`
                          : `Assign ${selectedMethod === 'method1' ? 'Method 1' : selectedMethod === 'method2' ? 'Method 2' : 'Method 3'} to Selected TP`)}
                  </button>

                  {pfMethodSaveSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"
                    >
                      <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{pfMethodSaveSuccess}</span>
                    </motion.div>
                  )}
                </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4">
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Info className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? 'கணக்கீட்டு முறை எளிய விளக்கம்' : 'Selected Method Calculation Details'}
                    </h3>
                    <p>{lang === 'ta' ? 'தேர்ந்தெடுத்த முறையின் சுருக்கம்' : 'Simple summary of the selected method'}</p>
                  </div>
                </div>
                <div className="portal-dash-body space-y-3">

                {/* DYNAMIC SIMPLE CALCULATION MESSAGE (Requirement 4) */}
                {selectedMethod === 'method1' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                        <Sparkles className="w-4 h-4 text-slate-500" />
                        <span>{lang === 'ta' ? 'முறை 1: அரசு வழக்கமான முறை' : 'Method 1: Standard Govt Rule'}</span>
                      </div>
                      <p className="text-gray-600 leading-relaxed text-[11px]">
                        {lang === 'ta'
                          ? 'இந்த முறையில், தகுதியற்ற தொகைகள் கழித்து நிகர ஆரம்ப இருப்புக்கு மட்டுமே வட்டி கணக்கிடப்படுகிறது. மேலும், ஆண்டு வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் கூட்டப்படாது.'
                          : 'In this method, interest is strictly calculated on the net eligible opening balance. Accrued interest is tracked for audit but remains separate and non-compounded.'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          1. {lang === 'ta' ? 'ஆரம்ப இருப்பு (Opening Balance):' : 'Opening Balance Rule:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'அலுவலக ஆரம்ப இருப்பு - (ஓய்வு + மரணம் + பிற தகுதியற்ற தொகைகள்) = தகுதியான இருப்பு.'
                            : 'Office Opening Balance minus (Retired + Death + Other Ineligible) = Net Eligible.'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          2. {lang === 'ta' ? 'ஆண்டு வட்டி (Annual Compounding):' : 'Annual Compounding:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'சேர்ந்த வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் கூட்டப்படாது (Non-Cumulative). அரசு நிதி ஆணை வரும் போது மட்டுமே வரவு வைக்கப்படும்.'
                            : 'Interest does NOT compound into next year opening balance. Remains pure principal.'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          3. {lang === 'ta' ? 'ஓய்வு பெற்ற ஊழியர்கள்:' : 'Retired Employees:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'ஊழியர் ஓய்வு பெற்ற தேதியுடன் மாதாந்திர வட்டி கணக்கீடு நிறுத்தப்படும்.'
                            : 'Monthly interest accrual freezes after employee retirement date.'}
                        </p>
                      </div>
                    </div>

                    {/* Step by step illustrative box */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-1.5 text-[11px]">
                      <span className="font-bold text-amber-900 block">
                        {lang === 'ta' ? 'எளிய கணக்கு மாதிரி:' : 'Simple Calculation Example:'}
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-amber-800 text-[10px]">
                        <li>{lang === 'ta' ? '2023-24 அசல் இருப்பு:' : '2023-24 Principal:'} ₹1,00,000</li>
                        <li>{lang === 'ta' ? '2023-24 சேர்ந்த வட்டி:' : '2023-24 Interest Earned:'} ₹5,000</li>
                        <li>
                          <strong>{lang === 'ta' ? '2024-25 ஆரம்ப இருப்பு:' : '2024-25 Opening Balance:'}</strong> ₹1,00,000
                          <span className="text-gray-500 block text-[9px]">{lang === 'ta' ? '(வட்டி தனியாக உள்ளது, அசலில் கூட்டப்படவில்லை)' : '(Interest remains separate, not compounded)'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedMethod === 'method2' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-blue-900 font-bold">
                        <Sparkles className="w-4 h-4 text-blue-600" />
                        <span>{lang === 'ta' ? 'முறை 2: ஆண்டு கூட்டு வட்டி முறை' : 'Method 2: Annual Cumulative Compounding'}</span>
                      </div>
                      <p className="text-blue-800 leading-relaxed text-[11px]">
                        {lang === 'ta'
                          ? 'ஒவ்வொரு நிதியாண்டின் முடிவிலும் (மார்ச் 31) கணக்கிடப்பட்ட வட்டித்தொகை, அடுத்த ஆண்டின் ஆரம்ப இருப்பில் கூட்டப்பட்டு கூட்டு வட்டியாக (Cumulative Compounding) கணக்கிடப்படுகிறது.'
                          : 'Accumulated annual interest at every March 31 is automatically added to the next year opening balance, compounding future returns!'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          1. {lang === 'ta' ? 'ஆரம்ப இருப்பு (Opening Balance):' : 'Opening Balance Rule:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'தகுதியற்ற தொகைகள் கழிக்கப்பட்ட நிகர தகுதியான ஆரம்ப இருப்புடன் துவங்குகிறது.'
                            : 'Starts with net eligible opening balance (deducting ineligible amounts).'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          2. {lang === 'ta' ? 'ஆண்டு கூட்டு வட்டி (Cumulative Compounding):' : 'Cumulative Compounding:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'மார்ச் 31-ல் சேர்ந்த வட்டி அடுத்த நிதியாண்டின் ஆரம்ப இருப்பில் சேர்க்கப்படுகிறது (கூட்டு வட்டி).'
                            : 'Accrued interest is added to next year opening balance (balance += annual interest).'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          3. {lang === 'ta' ? 'ஓய்வு பெற்ற ஊழியர்கள்:' : 'Retired Employees:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'பணிபுரியும் காலம் வரை கூட்டு வட்டி ஏறும்; ஓய்வு பெற்ற பின் வட்டி நிறுத்தப்படும்.'
                            : 'Compounded during active service; freezes upon retirement date.'}
                        </p>
                      </div>
                    </div>

                    {/* Step by step illustrative box */}
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1.5 text-[11px]">
                      <span className="font-bold text-blue-900 block">
                        {lang === 'ta' ? 'எளிய கணக்கு மாதிரி (உதாரணம்):' : 'Simple Calculation Example:'}
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-blue-800 text-[10px]">
                        <li>{lang === 'ta' ? '2023-24 ஆரம்ப இருப்பு (OB):' : '2023-24 Opening Balance (OB):'} ₹1,00,000</li>
                        <li>{lang === 'ta' ? '2023-24 கணக்கிடப்பட்ட வட்டி:' : '2023-24 Accrued Interest:'} ₹5,000</li>
                        <li>
                          <strong>{lang === 'ta' ? '2023-24 முடிவு இருப்பு (CB):' : '2023-24 Closing Balance (CB):'}</strong> ₹1,05,000
                          <span className="text-blue-700 block text-[9px]">{lang === 'ta' ? '(ஆரம்ப இருப்பு + அந்த ஆண்டின் வட்டி = முடிவு இருப்பு)' : '(Opening Balance + That FY Interest = Closing Balance)'}</span>
                        </li>
                        <li className="pt-0.5">
                          <strong>{lang === 'ta' ? '2024-25 ஆரம்ப இருப்பு (OB):' : '2024-25 Opening Balance (OB):'}</strong> ₹1,05,000
                          <span className="text-emerald-700 font-semibold block text-[9px]">{lang === 'ta' ? '(முந்தைய ஆண்டின் முடிவு இருப்பு அடுத்த ஆண்டின் ஆரம்ப இருப்பாக மாறும்; ₹1,05,000 கூட்டுத் தொகைக்கு வட்டி கணக்கிடப்படும்!)' : '(Cumulative closing balance is next year opening balance; interest calculates on ₹1,05,000!)'}</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}

                {selectedMethod === 'method3' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                      <div className="flex items-center gap-1.5 text-emerald-900 font-bold">
                        <Sparkles className="w-4 h-4 text-emerald-600" />
                        <span>{lang === 'ta' ? 'முறை 3: முழு இருப்பு + கூட்டு வட்டி + ஓய்வுக்குப் பின்னும் வட்டி' : 'Method 3: Full Balance + Cumulative + Post-Retirement'}</span>
                      </div>
                      <p className="text-emerald-800 leading-relaxed text-[11px]">
                        {lang === 'ta'
                          ? 'ஆரம்ப இருப்பில் தகுதியற்ற தொகைகள் கழிக்கப்படாது; முழுத் தொகைக்கும் வட்டி ஏறும். மேலும், ஓய்வு பெற்ற ஊழியர்களுக்கும் இறுதி தீர்வு (Final Settlement) நாள் வரை தொடர்ந்து வட்டி கணக்கிடப்படும்!'
                          : 'No need to minus ineligible amounts from opening balance (interest calculates on full gross balance), interest compounds annually, AND retired employees continue to earn interest till settlement!'}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          1. {lang === 'ta' ? 'முழு ஆரம்ப இருப்பு (No Minus Rule):' : 'Full Opening Balance (No Minus):'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'தகுதியற்ற தொகைகள் கழிக்கப்படாமல் முழு ஆரம்ப இருப்புக்கும் வட்டி கணக்கிடப்படும்.'
                            : 'No deduction of ineligible amounts. Calculates on full gross opening balance.'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          2. {lang === 'ta' ? 'ஆண்டு கூட்டு வட்டி (Cumulative Compounding):' : 'Cumulative Compounding:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'ஆண்டுதோறும் சேர்ந்த வட்டி அடுத்த ஆண்டின் தொடக்க இருப்பில் சேர்க்கப்படும்.'
                            : 'Annual interest compounds into next year opening balance.'}
                        </p>
                      </div>

                      <div className="p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-bold text-gray-700 block text-[11px]">
                          3. {lang === 'ta' ? 'ஓய்வு பெற்ற ஊழியர்களுக்கு வட்டி:' : 'Retired Employees Interest Rule:'}
                        </span>
                        <p className="text-gray-500 text-[10px] mt-0.5">
                          {lang === 'ta' 
                            ? 'ஓய்வு பெற்றாலும், அவர்களின் கணக்கு இறுதி தீர்வு (Final Settlement) செய்யப்படும் வரை தொடர்ந்து வட்டி கணக்கிடப்படும்!'
                            : 'Interest continues to accrue every month until final settlement is officially executed!'}
                        </p>
                      </div>
                    </div>

                    {/* Step by step illustrative box */}
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1.5 text-[11px]">
                      <span className="font-bold text-emerald-900 block">
                        {lang === 'ta' ? 'எளிய கணக்கு மாதிரி (உதாரணம்):' : 'Simple Calculation Example:'}
                      </span>
                      <ul className="list-disc pl-4 space-y-1 text-emerald-800 text-[10px]">
                        <li>{lang === 'ta' ? 'முழு ஆரம்ப இருப்பு (கழிக்கப்படாதது):' : 'Full Gross Balance (Undeducted):'} ₹1,20,000</li>
                        <li>{lang === 'ta' ? 'சேர்ந்த ஆண்டு வட்டி:' : 'Accrued Annual Interest:'} ₹6,000</li>
                        <li>
                          <strong>{lang === 'ta' ? 'அடுத்த ஆண்டு ஆரம்ப இருப்பு:' : 'Next Year Opening Balance:'}</strong> ₹1,26,000
                        </li>
                        <li>
                          <span className="text-emerald-900 font-bold block text-[10px] mt-1">
                            {lang === 'ta' ? 'ஓய்வுக்குப் பின்னும் இறுதி தீர்வு நாள் வரை வட்டி தொடர்ந்து கணக்கிடப்படுகிறது!' : 'Retired employees continue earning monthly interest until final settlement!'}
                          </span>
                        </li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Building2 className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'பேரூராட்சிகள் வாரியான கணக்கீட்டு முறை நிலை பட்டியல்' : 'Town Panchayats Assigned Calculation Methods Overview'}
                </h3>
                <p>
                  {filteredTownPanchayats.length} {lang === 'ta' ? 'பேரூராட்சிகள்' : 'Town Panchayats'}
                </p>
              </div>
            </div>
            <div className="portal-dash-body">
            <div className="portal-dash-table overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{lang === 'ta' ? 'பேரூராட்சி பெயர்' : 'Town Panchayat Name'}</th>
                    <th>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
                    <th>{lang === 'ta' ? 'ஒதுக்கப்பட்ட முறை' : 'Assigned Method'}</th>
                    <th className="text-right">{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTownPanchayats.map((tp: any, index: number) => {
                    const method = tp.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[tp.id] || 'method1';
                    const distObj = (state?.districts || []).find((d: any) => d.id === tp.districtId);
                    const isSelected = tp.id === selectedTpId;
                    return (
                      <tr
                        key={tp.id}
                        className={isSelected ? 'is-selected' : ''}
                        onClick={() => setSelectedTpId(tp.id)}
                      >
                        <td>{index + 1}</td>
                        <td className="font-semibold">
                          {lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)}
                        </td>
                        <td>
                          {distObj ? (lang === 'ta' ? (distObj.nameTa || distObj.nameEn) : (distObj.nameEn || distObj.nameTa)) : '--'}
                        </td>
                        <td>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            method === 'method1'
                              ? 'border border-slate-200 bg-slate-100 text-slate-700'
                              : method === 'method2'
                              ? 'text-white'
                              : 'border border-emerald-200 bg-emerald-100 text-emerald-800'
                          }`}
                          style={method === 'method2' ? { background: 'var(--theme-accent)' } : undefined}
                          >
                            {method === 'method1'
                              ? 'Method 1 (Standard)'
                              : method === 'method2'
                              ? 'Method 2 (Cumulative)'
                              : 'Method 3 (Full + Cumulative + Post-Retire)'}
                          </span>
                        </td>
                        <td className="text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTpId(tp.id);
                            }}
                            className="portal-dash-pill"
                          >
                            {lang === 'ta' ? 'மாற்று' : 'Configure'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: USER PROFILE & PASSWORD */}
      {/* ------------------------------------------------------------- */}
      {activeSettingsTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-8">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <User className="h-3 w-3" />
                    </span>
                    {t('userSettings')}
                  </h3>
                  <p>
                    {lang === 'ta' ? 'சுயவிவரம், புகைப்படம் மற்றும் கடவுச்சொல்' : 'Profile, photo, and password'}
                  </p>
                </div>
              </div>
              <div className="portal-dash-body portal-wt-form">
            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div className="portal-wt-section">
                <div className="flex flex-col items-center gap-3 sm:flex-row">
                  <div
                    className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-white"
                    style={{ background: 'color-mix(in srgb, var(--theme-accent) 18%, #ffffff)', color: 'var(--theme-accent)' }}
                  >
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xl font-bold">{(nameEn || currentUser?.name || currentUser?.username || 'U').slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <label>{t('profilePhoto')}</label>
                    <p className="text-[10px] text-slate-400">PNG or JPG formats supported.</p>
                    <label className="portal-wt-link inline-flex cursor-pointer items-center gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      Upload Photo
                      <input type="file" accept="image/*" onChange={handleProfilePicUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>

              {currentUser?.isEmployee ? (
                <div className="portal-wt-section space-y-2">
                  <div className="portal-wt-section-title">
                    <span>{lang === 'ta' ? 'ஊழியர் சுயவிவரம் (மாற்ற இயலாது)' : 'Employee Profile Information (Read-Only)'}</span>
                    <span className="inline-flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {lang === 'ta' ? 'நிர்வாகப் பதிவு' : 'Admin Managed'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label>{t('userFullNameEn')}</label>
                      <p className="text-sm font-semibold text-slate-900">{currentUser?.nameEn || currentUser?.username}</p>
                    </div>
                    <div>
                      <label>{t('userFullNameTa')}</label>
                      <p className="text-sm font-semibold text-slate-900">{currentUser?.nameTa || '--'}</p>
                    </div>
                  </div>
                  <p className="portal-wt-note">
                    {lang === 'ta'
                      ? 'ஊழியர் பெயர் திருத்தங்கள் பேரூராட்சி செயல் அலுவலர் (EO) அல்லது மண்டல நிர்வாகத்தால் மட்டுமே அங்கீகரிக்கப்பட்டு மாற்றப்படும்.'
                      : 'Employee name changes are managed exclusively by your Town Panchayat Executive Officer (EO) or Zonal Administration.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label>{t('userFullNameEn')}</label>
                    <input
                      type="text"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      required
                    />
                  </div>
                  <div>
                    <label>{t('userFullNameTa')}</label>
                    <input
                      type="text"
                      value={nameTa}
                      onChange={(e) => setNameTa(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="portal-wt-section">
                <p className="portal-wt-section-title">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {t('changePass')}
                  </span>
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label>
                      {t('currentPass')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={lang === 'ta' ? 'அங்கீகரிக்க தட்டச்சு செய்யவும்' : 'Type current password'}
                      required
                    />
                  </div>
                  <div>
                    <label>{t('newPass')}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>{lang === 'ta' ? 'புதிய கடவுச்சொல்லை உறுதிசெய்க' : 'Confirm New Password'}</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
                {passError && <p className="text-[11px] font-bold text-rose-600">{passError}</p>}
              </div>

              <div className="flex items-center gap-4">
                <button type="submit">
                  {currentUser?.isEmployee
                    ? (lang === 'ta' ? 'புகைப்படம் மற்றும் கடவுச்சொல்லைப் புதுப்பிக்கவும்' : 'Update Photo & Password')
                    : t('saveProfile')}
                </button>
                {saveSuccess && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-600"
                  >
                    <CheckCircle className="h-5 w-5 animate-bounce" />
                    <span>Profile preference details updated!</span>
                  </motion.div>
                )}
              </div>
            </form>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <ShieldCheck className="h-3 w-3" />
                    </span>
                    {lang === 'ta' ? 'கணக்கு விபரங்கள்' : 'Account Details'}
                  </h3>
                  <p>{lang === 'ta' ? 'உள்நுழைவு மற்றும் அதிகார வரம்பு' : 'Login identity and scope'}</p>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="space-y-2 text-xs text-slate-600">
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span>{lang === 'ta' ? 'பயனர் பெயர்' : 'Username'}</span>
                    <span className="font-mono font-bold text-slate-800">{currentUser?.username}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 py-1">
                    <span>{lang === 'ta' ? 'பொறுப்பு' : 'Role'}</span>
                    <span className="font-bold uppercase" style={{ color: 'var(--theme-accent)' }}>{currentUser?.roleId || 'EMPLOYEE'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span>{lang === 'ta' ? 'அதிகார வரம்பு' : 'Scope'}</span>
                    <span className="font-bold text-slate-800">{currentUser?.scopeType || 'State'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 3: THEMES & APPEARANCE */}
      {/* ------------------------------------------------------------- */}
      {activeSettingsTab === 'theme' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-7">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <Palette className="h-3 w-3" />
                    </span>
                    {t('themeSettings')}
                  </h3>
                  <p>{lang === 'ta' ? 'போர்டல் தோற்றத்தைத் தேர்ந்தெடுக்கவும்' : 'Choose a look for the portal'}</p>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="portal-theme-grid">
                  {[
                    { id: 'light' as const, name: lang === 'ta' ? 'வெளிச்சம்' : 'Light', from: '#0f172a', to: '#94a3b8', desc: lang === 'ta' ? 'இருள் முதல் வெளிர் ஸ்லேட்' : 'Dark-to-light slate' },
                    { id: 'dark' as const, name: lang === 'ta' ? 'இருள்' : 'Dark', from: '#e2e8f0', to: '#334155', desc: lang === 'ta' ? 'வெளிர் முதல் இருள் ஸ்லேட்' : 'Light-to-dark slate' },
                    { id: 'ocean-wave' as const, name: lang === 'ta' ? 'கடல் அலை' : 'Ocean Wave', from: '#0f172a', to: '#0d9488', desc: lang === 'ta' ? 'இருள் கடல் முதல் வெளிர் டீல்' : 'Dark-to-light ocean' },
                    { id: 'sunset-aurora' as const, name: lang === 'ta' ? 'அந்திச் செவ்வானம்' : 'Sunset Aurora', from: '#4c1d95', to: '#f59e0b', desc: lang === 'ta' ? 'இருள் ஊதா முதல் வெளிர் அம்பர்' : 'Dark-to-light sunset' },
                    { id: 'magic-lavender' as const, name: lang === 'ta' ? 'மந்திர லாவெண்டர்' : 'Magic Lavender', from: '#1e1b4b', to: '#db2777', desc: lang === 'ta' ? 'இருள் இண்டிகோ முதல் வெளிர் இளஞ்சிவப்பு' : 'Dark-to-light lavender' },
                    { id: 'rainbow-prism' as const, name: lang === 'ta' ? 'வானவில் பிரிசம்' : 'Rainbow Prism', from: '#0369a1', to: '#be123c', desc: lang === 'ta' ? 'இருள் நீலம் முதல் வெளிர் சிவப்பு' : 'Dark-to-light prism' },
                    { id: 'nilgiri-emerald' as const, name: lang === 'ta' ? 'நீலகிரி மரகதம்' : 'Nilgiri Emerald', from: '#064e3b', to: '#10b981', desc: lang === 'ta' ? 'இருள் பச்சை முதல் வெளிர் மரகதம்' : 'Dark-to-light emerald' },
                    { id: 'kovai-maroon' as const, name: lang === 'ta' ? 'கோவை மரூன்' : 'Kovai Maroon', from: '#7f1d1d', to: '#ea580c', desc: lang === 'ta' ? 'இருள் மெரூன் முதல் வெளிர் செம்மண்' : 'Dark-to-light maroon' },
                    { id: 'madurai-blue' as const, name: lang === 'ta' ? 'மதுரை நீலம்' : 'Madurai Blue', from: '#1e3a8a', to: '#8b5cf6', desc: lang === 'ta' ? 'இருள் நீலம் முதல் வெளிர் ஊதா' : 'Dark-to-light royal blue' },
                    { id: 'nellai-orange' as const, name: lang === 'ta' ? 'நெல்லை ஆரஞ்சு' : 'Nellai Orange', from: '#c2410c', to: '#f97316', desc: lang === 'ta' ? 'இருள் ஆரஞ்சு முதல் வெளிர் ஆரஞ்சு' : 'Dark-to-light orange' },
                    { id: 'chennai-slate' as const, name: lang === 'ta' ? 'சென்னை ஸ்லேட்' : 'Chennai Slate', from: '#1e293b', to: '#64748b', desc: lang === 'ta' ? 'இருள் கிராஃபைட் முதல் வெளிர் ஸ்லேட்' : 'Dark-to-light graphite' },
                    { id: 'royal-gold' as const, name: lang === 'ta' ? 'அரச பொன்' : 'Royal Gold', from: '#78350f', to: '#f59e0b', desc: lang === 'ta' ? 'இருள் பழுப்பு முதல் வெளிர் பொன்' : 'Dark-to-light gold' },
                    { id: 'crimson-ruby' as const, name: lang === 'ta' ? 'மாணிக்க சிவப்பு' : 'Crimson Ruby', from: '#881337', to: '#fb7185', desc: lang === 'ta' ? 'இருள் சிவப்பு முதல் வெளிர் ரோஜா' : 'Dark-to-light ruby' },
                    { id: 'cyber-teal' as const, name: lang === 'ta' ? 'நவீன நீலப்பச்சை' : 'Cyber Teal', from: '#134e4a', to: '#2dd4bf', desc: lang === 'ta' ? 'இருள் டீல் முதல் வெளிர் டீல்' : 'Dark-to-light teal' },
                    { id: 'custom' as const, name: lang === 'ta' ? 'தனிப்பயன் தீம்' : 'Custom Theme', from: customColors.sidebarFrom, to: customColors.sidebarTo, desc: lang === 'ta' ? 'இருள் முதல் வெளிர் தனிப்பயன் நிறம்' : 'Dark-to-light custom colors' },
                  ].map((th) => {
                    const isSelected = theme === th.id;
                    return (
                      <button
                        key={th.id}
                        type="button"
                        onClick={() => setTheme(th.id)}
                        className={`portal-theme-card ${isSelected ? 'is-active' : ''}`}
                      >
                        <span className="portal-theme-card-bar" style={{ backgroundImage: `linear-gradient(90deg, ${th.from}, ${th.to})` }} />
                        <span className="portal-theme-card-meta">
                          <span>
                            <strong>{th.name}</strong>
                            <em>{th.desc}</em>
                          </span>
                          {isSelected && (
                            <span className="portal-theme-card-check">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            {theme === 'custom' && (
              <div className="portal-dashboard-panel">
                <div className="portal-dash-head">
                  <div>
                    <h3>
                      <span className="portal-dash-icon">
                        <Zap className="h-3 w-3" />
                      </span>
                      {lang === 'ta' ? 'தனிப்பயன் வண்ண தேர்வி' : 'Dynamic Theme Designer'}
                    </h3>
                    <p>{lang === 'ta' ? 'பக்க பட்டி, முதன்மை நிறம் மற்றும் பின்னணி' : 'Sidebar, brand color, and canvas'}</p>
                  </div>
                </div>
                <div className="portal-dash-body">
                  <div className="portal-theme-designer">
                    <div className="portal-theme-designer-row">
                      <div>
                        <span>Sidebar Gradient From</span>
                        <em>Left/top side of sidebar</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.sidebarFrom}
                          onChange={(e) => setCustomColors({ ...customColors, sidebarFrom: e.target.value })}
                        />
                        <input
                          type="text"
                          value={customColors.sidebarFrom}
                          onChange={(e) => setCustomColors({ ...customColors, sidebarFrom: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="portal-theme-designer-row">
                      <div>
                        <span>Sidebar Gradient To</span>
                        <em>Right/bottom side of sidebar</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.sidebarTo}
                          onChange={(e) => setCustomColors({ ...customColors, sidebarTo: e.target.value })}
                        />
                        <input
                          type="text"
                          value={customColors.sidebarTo}
                          onChange={(e) => setCustomColors({ ...customColors, sidebarTo: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="portal-theme-designer-row">
                      <div>
                        <span>Primary Brand Color</span>
                        <em>Buttons, active tabs & borders</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.primaryColor}
                          onChange={(e) => setCustomColors({ ...customColors, primaryColor: e.target.value })}
                        />
                        <input
                          type="text"
                          value={customColors.primaryColor}
                          onChange={(e) => setCustomColors({ ...customColors, primaryColor: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="portal-theme-designer-row">
                      <div>
                        <span>Accent/Badge Background</span>
                        <em>Card headers & callout bgs</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.accentBgColor}
                          onChange={(e) => setCustomColors({ ...customColors, accentBgColor: e.target.value })}
                        />
                        <input
                          type="text"
                          value={customColors.accentBgColor}
                          onChange={(e) => setCustomColors({ ...customColors, accentBgColor: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="portal-theme-designer-row">
                      <div>
                        <span>App Canvas Background</span>
                        <em>General layout background</em>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={customColors.appBgColor}
                          onChange={(e) => setCustomColors({ ...customColors, appBgColor: e.target.value })}
                        />
                        <input
                          type="text"
                          value={customColors.appBgColor}
                          onChange={(e) => setCustomColors({ ...customColors, appBgColor: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
