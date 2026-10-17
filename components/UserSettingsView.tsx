'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, 
  Palette, 
  Lock, 
  Upload, 
  CheckCircle, 
  Moon, 
  Sun, 
  LayoutGrid, 
  Zap, 
  Droplet,
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

  return (
    <div id="user-settings-view-container" className="space-y-6">
      {/* Top Header & Subtabs */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-indigo-600" />
            {lang === 'ta' ? 'பயனர் அமைப்புகள் & கட்டமைப்பு' : 'User Settings & Configuration'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {lang === 'ta' 
              ? (canConfigurePfMethod 
                  ? 'சுயவிவரம், கடவுச்சொல், நிறத் தோற்றம் மற்றும் பேரூராட்சிகளின் PF கணக்கீட்டு முறைகளை நிர்வகிக்கவும்' 
                  : 'சுயவிவரம், கடவுச்சொல் மற்றும் நிறத் தோற்றத்தை நிர்வகிக்கவும்')
              : (canConfigurePfMethod
                  ? 'Manage your profile credentials, aesthetic themes, and Town Panchayat PF calculation methods'
                  : 'Manage your profile credentials and aesthetic themes')}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200/80 text-xs font-semibold overflow-x-auto max-w-full">
          {canConfigurePfMethod && (
            <button
              type="button"
              onClick={() => setActiveSettingsTab('pf_calc')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition shrink-0 ${
                activeSettingsTab === 'pf_calc'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calculator className="w-4 h-4 text-indigo-500" />
              <span>{lang === 'ta' ? 'PF கணக்கீட்டு முறை தேர்வு' : 'PF Calculation Methods'}</span>
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
                DTP / ADMIN ONLY
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setActiveSettingsTab('profile')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition shrink-0 ${
              activeSettingsTab === 'profile'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4 text-indigo-500" />
            <span>{t('userSettings')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSettingsTab('theme')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg transition shrink-0 ${
              activeSettingsTab === 'theme'
                ? 'bg-white text-indigo-700 shadow-xs font-bold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Palette className="w-4 h-4 text-indigo-500" />
            <span>{t('themeSettings')}</span>
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: PF CALCULATION METHOD CONFIGURATION (FOR DTP & ADMIN ONLY) */}
      {/* ------------------------------------------------------------- */}
      {activeSettingsTab === 'pf_calc' && canConfigurePfMethod && (
        <div className="space-y-6">
          {/* Authority Banner */}
          <div className="p-4 bg-gradient-to-r from-indigo-50 via-purple-50 to-blue-50 border border-indigo-100 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">
                  {lang === 'ta' 
                    ? 'மாநில இயக்குநர் (DTP) / முதன்மை நிர்வாகி (Admin) - PF கணக்கீட்டு முறை கட்டமைப்பு அதிகாரம்' 
                    : 'Directorate of Town Panchayats (DTP) & State Admin - PF Calculation Method Authority'}
                </h3>
                <p className="text-xs text-gray-600 mt-0.5">
                  {lang === 'ta' 
                    ? 'ஒவ்வொரு பேரூராட்சிக்கும் பொருந்தக்கூடிய PF வட்டி கணக்கீட்டு முறையை (3 முறைகளில்) தேர்வு செய்து ஒதுக்கலாம்.' 
                    : 'Exclusively authorized to assign one of the 3 dedicated PF Calculation Methods for individual Town Panchayats across Tamil Nadu.'}
                </p>
              </div>
            </div>
            <div className="px-3 py-1.5 bg-white/80 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-semibold shadow-xs">
              {filteredTownPanchayats.length} {lang === 'ta' ? 'பேரூராட்சிகள் உள்ளன' : 'Town Panchayats in state'}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Panel: Selection Controls and Methods */}
            <div className="lg:col-span-8 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
                {/* Town Panchayat Selector Section */}
                <div className="space-y-4 border-b border-gray-100 pb-5">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-600" />
                    <h4 className="text-sm font-bold text-gray-900">
                      {lang === 'ta' ? '1. பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : '1. Select Individual Town Panchayat'}
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* District Filter (especially useful for DTP and multi-district zones) */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                        {lang === 'ta' ? 'மாவட்டம் வாரியாக வடிகட்டுக' : 'Filter by District'}
                      </label>
                      <select
                        value={filterDistrictId}
                        onChange={(e) => setFilterDistrictId(e.target.value)}
                        className="w-full border border-gray-200 rounded-xl p-2.5 text-xs font-medium outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      >
                        <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}</option>
                        {zoneDistricts.map((d: any) => (
                          <option key={d.id} value={d.id}>
                            {lang === 'ta' ? (d.nameTa || d.nameEn) : (d.nameEn || d.nameTa)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Town Panchayat Selection Dropdown */}
                    <div>
                      <label className="text-xs font-bold text-gray-500 block mb-1.5">
                        <Building2 className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                        {lang === 'ta' ? 'பேரூராட்சி தேர்வு' : 'Target Town Panchayat'}
                      </label>
                      <select
                        value={selectedTpId}
                        onChange={(e) => setSelectedTpId(e.target.value)}
                        className="w-full border border-indigo-200 bg-indigo-50/40 rounded-xl p-2.5 text-xs font-bold text-indigo-950 outline-none focus:ring-1 focus:ring-indigo-500"
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

                  {/* Current Active Status Pill */}
                  {currentTpObj && (
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-500">{lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்டது:' : 'Currently Configuring:'}</span>
                        <span className="font-bold text-gray-900">{lang === 'ta' ? (currentTpObj.nameTa || currentTpObj.nameEn) : (currentTpObj.nameEn || currentTpObj.nameTa)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 text-[11px]">{lang === 'ta' ? 'தற்போதைய முறை:' : 'Active Method:'}</span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          (currentTpObj.pfCalculationMethod || 'method1') === 'method1'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : (currentTpObj.pfCalculationMethod || 'method1') === 'method2'
                            ? 'bg-blue-100 text-blue-800 border border-blue-200'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {(currentTpObj.pfCalculationMethod || 'method1') === 'method1'
                            ? 'Method 1 (Standard)'
                            : (currentTpObj.pfCalculationMethod || 'method1') === 'method2'
                            ? 'Method 2 (Cumulative)'
                            : 'Method 3 (Full + Cumulative + Post-Retire)'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* The 3 PF Calculation Methods Selection Cards */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
                      {lang === 'ta' ? '2. கணக்கீட்டு முறையைத் தேர்வு செய்க (3 முறைகள்)' : '2. Choose Calculation Method (3 Methods)'}
                    </h4>
                    <span className="text-[11px] text-gray-400">
                      {lang === 'ta' ? 'முறை வாரியாக விளக்கம் கீழே தோன்றும்' : 'Select a card to view its simple calculation summary'}
                    </span>
                  </div>

                  {/* Method 1 Card */}
                  <div
                    onClick={() => setSelectedMethod('method1')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all relative ${
                      selectedMethod === 'method1'
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500'
                        : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method1'}
                            onChange={() => setSelectedMethod('method1')}
                            className="w-4 h-4 text-indigo-600 cursor-pointer"
                          />
                          <span className="font-bold text-sm text-gray-900">
                            {lang === 'ta' 
                              ? 'முறை 1: அரசு வழக்கமான முறை (நடப்பு கணக்கீட்டு முறை)' 
                              : 'Method 1: Standard Govt Rule (Current Calculation Method)'}
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md">
                            Standard Rule
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 pl-6">
                          {lang === 'ta'
                            ? 'ஆரம்ப இருப்பில் தகுதியற்ற தொகைகள் கழிக்கப்படும். திரட்டப்பட்ட வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் கூட்டப்படாது. ஊழியர் ஓய்வு பெற்ற மாதத்திற்குப் பின் வட்டி நிறுத்தப்படும்.'
                            : 'Opening balance deducts ineligible amounts. Annual accrued interest is kept for audit but NOT compounded into next year opening balance. Interest stops after retirement.'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${selectedMethod === 'method1' ? 'bg-indigo-600 text-white' : 'border border-gray-300'}`}>
                        {selectedMethod === 'method1' && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>

                  {/* Method 2 Card */}
                  <div
                    onClick={() => setSelectedMethod('method2')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all relative ${
                      selectedMethod === 'method2'
                        ? 'border-indigo-500 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-500'
                        : 'border-gray-200 bg-white hover:border-indigo-200 hover:bg-gray-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method2'}
                            onChange={() => setSelectedMethod('method2')}
                            className="w-4 h-4 text-indigo-600 cursor-pointer"
                          />
                          <span className="font-bold text-sm text-gray-900">
                            {lang === 'ta' 
                              ? 'முறை 2: ஆண்டு கூட்டு வட்டி முறை (அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேரும் முறை)' 
                              : 'Method 2: Annual Cumulative Compounding with Next Year Opening Balance'}
                          </span>
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                            Annual Compounded
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 pl-6">
                          {lang === 'ta'
                            ? 'தகுதியற்ற தொகைகள் கழிக்கப்பட்ட ஆரம்ப இருப்பு. ஒவ்வொரு நிதியாண்டின் இறுதியிலும் (மார்ச் 31) சேர்ந்த மொத்த வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேர்க்கப்பட்டு கூட்டு வட்டியாகக் கணக்கிடப்படும்.'
                            : 'Opening balance deducts ineligible amounts. Accumulated interest at FY-end is added to next year opening balance (compounded annually). Future interest calculates on the cumulative balance.'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${selectedMethod === 'method2' ? 'bg-indigo-600 text-white' : 'border border-gray-300'}`}>
                        {selectedMethod === 'method2' && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>

                  {/* Method 3 Card */}
                  <div
                    onClick={() => setSelectedMethod('method3')}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all relative ${
                      selectedMethod === 'method3'
                        ? 'border-emerald-500 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500'
                        : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-gray-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="pfMethod"
                            checked={selectedMethod === 'method3'}
                            onChange={() => setSelectedMethod('method3')}
                            className="w-4 h-4 text-emerald-600 cursor-pointer"
                          />
                          <span className="font-bold text-sm text-gray-900">
                            {lang === 'ta' 
                              ? 'முறை 3: முழு ஆரம்ப இருப்பு + கூட்டு வட்டி + ஓய்வுக்குப் பின்னும் வட்டி தொடரும் முறை' 
                              : 'Method 3: Full Ineligible Balance + Annual Cumulative + Post-Retirement Interest'}
                          </span>
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                            Full Balance + Cumulative + Post-Retire
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 pl-6">
                          {lang === 'ta'
                            ? 'ஆரம்ப இருப்பில் தகுதியற்ற தொகைகள் கழிக்கப்படாது (முழுத் தொகைக்கும் வட்டி கணக்கீடு). ஆண்டு வட்டி அடுத்த ஆண்டின் ஆரம்ப இருப்பில் சேர்க்கப்படும். மேலும் ஓய்வு பெற்ற ஊழியர்களுக்கு இறுதி தீர்வு வரை தொடர்ந்து வட்டி ஏறும்!'
                            : 'No deduction of ineligible amounts (calculates on full gross balance). Annual interest is cumulative with next year opening balance, and interest continues to calculate for retired employees until final settlement!'}
                        </p>
                      </div>
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${selectedMethod === 'method3' ? 'bg-emerald-600 text-white' : 'border border-gray-300'}`}>
                        {selectedMethod === 'method3' && <Check className="w-3 h-3" />}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Button & Feedback Alert */}
                <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSavePfCalculationMethod}
                    disabled={pfMethodSaving || !selectedTpId}
                    className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
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
                      className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{pfMethodSaveSuccess}</span>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Panel: Dynamic Simple Calculation Message Box */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <Info className="w-5 h-5 text-amber-500" />
                  <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    {lang === 'ta' ? 'கணக்கீட்டு முறை எளிய விளக்கம்' : 'Selected Method Calculation Details'}
                  </h4>
                </div>

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

          {/* Quick Town Panchayats Methods Overview Table */}
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-indigo-500" />
                {lang === 'ta' ? 'பேரூராட்சிகள் வாரியான கணக்கீட்டு முறை நிலை பட்டியல்' : 'Town Panchayats Assigned Calculation Methods Overview'}
              </h4>
              <span className="text-xs text-gray-400">
                {filteredTownPanchayats.length} {lang === 'ta' ? 'பேரூராட்சிகள்' : 'Town Panchayats'}
              </span>
            </div>

            <div className="overflow-x-auto border border-gray-100 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200/80">
                    <th className="p-3">#</th>
                    <th className="p-3">{lang === 'ta' ? 'பேரூராட்சி பெயர்' : 'Town Panchayat Name'}</th>
                    <th className="p-3">{lang === 'ta' ? 'மாவட்டம்' : 'District'}</th>
                    <th className="p-3">{lang === 'ta' ? 'ஒதுக்கப்பட்ட முறை' : 'Assigned Method'}</th>
                    <th className="p-3 text-right">{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-700">
                  {filteredTownPanchayats.map((tp: any, index: number) => {
                    const method = tp.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[tp.id] || 'method1';
                    const distObj = (state?.districts || []).find((d: any) => d.id === tp.districtId);
                    const isSelected = tp.id === selectedTpId;
                    return (
                      <tr 
                        key={tp.id} 
                        className={`hover:bg-indigo-50/40 transition cursor-pointer ${isSelected ? 'bg-indigo-50/60 font-semibold' : ''}`}
                        onClick={() => setSelectedTpId(tp.id)}
                      >
                        <td className="p-3 text-gray-400">{index + 1}</td>
                        <td className="p-3 font-bold text-gray-900">
                          {lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)}
                        </td>
                        <td className="p-3 text-gray-600">
                          {distObj ? (lang === 'ta' ? (distObj.nameTa || distObj.nameEn) : (distObj.nameEn || distObj.nameTa)) : '--'}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            method === 'method1'
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : method === 'method2'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200'
                              : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          }`}>
                            {method === 'method1' 
                              ? 'Method 1 (Standard)' 
                              : method === 'method2' 
                              ? 'Method 2 (Cumulative)' 
                              : 'Method 3 (Full + Cumulative + Post-Retire)'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTpId(tp.id);
                            }}
                            className="px-2.5 py-1 bg-white border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-[10px] font-bold transition shadow-2xs"
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
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: USER PROFILE & PASSWORD */}
      {/* ------------------------------------------------------------- */}
      {activeSettingsTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <form onSubmit={handleSaveProfile} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-6">
              <h3 className="font-semibold text-gray-800 text-sm border-b border-gray-50 pb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-indigo-500 animate-pulse" />
                {t('userSettings')}
              </h3>

              {/* Profile Picture Uploader */}
              <div className="flex flex-col sm:flex-row items-center gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-indigo-100 border border-indigo-200 shrink-0 flex items-center justify-center">
                  {profileImage ? (
                    <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-indigo-600">{(nameEn || currentUser?.name || currentUser?.username || 'U').slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="space-y-1 text-center sm:text-left">
                  <span className="text-xs font-bold text-gray-800 block truncate">{t('profilePhoto')}</span>
                  <p className="text-[10px] text-gray-400">PNG or JPG formats supported.</p>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 hover:bg-gray-100 rounded-lg text-[10px] font-bold text-gray-600 cursor-pointer transition mt-2">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Photo
                    <input type="file" accept="image/*" onChange={handleProfilePicUpload} className="hidden" />
                  </label>
                </div>
              </div>

              {/* Profile form values - For Employee: Read-only name display; For Admin/Roles: Editable name */}
              {currentUser?.isEmployee ? (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'ஊழியர் சுயவிவரம் (மாற்ற இயலாது)' : 'Employee Profile Information (Read-Only)'}
                    </span>
                    <span className="px-2.5 py-0.5 bg-slate-200/70 text-slate-700 text-[10px] font-bold rounded-full flex items-center gap-1">
                      <Lock className="w-3 h-3 text-slate-500" />
                      {lang === 'ta' ? 'நிர்வாகப் பதிவு' : 'Admin Managed'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-gray-400 block text-[11px] mb-0.5">{t('userFullNameEn')}:</span>
                      <span className="font-bold text-gray-900 text-sm">{currentUser?.nameEn || currentUser?.username}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 block text-[11px] mb-0.5">{t('userFullNameTa')}:</span>
                      <span className="font-bold text-gray-900 text-sm">{currentUser?.nameTa || '--'}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 italic bg-white p-2.5 rounded-xl border border-gray-100">
                    {lang === 'ta'
                      ? '💡 குறிப்பு: ஊழியர் பெயர் திருத்தங்கள் பேரூராட்சி செயல் அலுவலர் (EO) அல்லது மண்டல நிர்வாகத்தால் மட்டுமே அங்கீகரிக்கப்பட்டு மாற்றப்படும்.'
                      : '💡 Note: Employee name changes are managed exclusively by your Town Panchayat Executive Officer (EO) or Zonal Administration.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600">
                  <div>
                    <label className="font-semibold text-gray-400 mb-1 block">{t('userFullNameEn')}</label>
                    <input
                      type="text"
                      value={nameEn}
                      onChange={(e) => setNameEn(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-400 mb-1 block">{t('userFullNameTa')}</label>
                    <input
                      type="text"
                      value={nameTa}
                      onChange={(e) => setNameTa(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Password Reset option */}
              <div className="space-y-4 pt-4 border-t border-gray-50">
                <h4 className="font-bold text-gray-800 text-xs uppercase tracking-wide flex items-center gap-1">
                  <Lock className="w-4 h-4 text-indigo-500" />
                  {t('changePass')}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-gray-600">
                  <div>
                    <label className="font-semibold text-gray-400 block mb-1">
                      {t('currentPass')} <span className="text-rose-500 font-bold">*</span>
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={lang === 'ta' ? 'அங்கீகரிக்க தட்டச்சு செய்யவும்' : 'Type current password'}
                      className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-400 block mb-1">{t('newPass')}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-semibold text-gray-400 block mb-1">Confirm New Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl p-3 outline-none"
                    />
                  </div>
                </div>
                {passError && <p className="text-rose-600 text-[11px] font-bold">{passError}</p>}
              </div>

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                >
                  {currentUser?.isEmployee
                    ? (lang === 'ta' ? 'புகைப்படம் மற்றும் கடவுச்சொல்லைப் புதுப்பிக்கவும்' : 'Update Photo & Password')
                    : t('saveProfile')}
                </button>
                {saveSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }} 
                    animate={{ opacity: 1, x: 0 }} 
                    className="flex items-center gap-1.5 text-emerald-600 text-xs font-bold"
                  >
                    <CheckCircle className="w-5 h-5 animate-bounce" />
                    <span>Profile preference details updated!</span>
                  </motion.div>
                )}
              </div>
            </form>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-3">
              <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'கணக்கு விபரங்கள்' : 'Account Details'}
              </h4>
              <div className="space-y-2 text-xs text-gray-600">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400">{lang === 'ta' ? 'பயனர் பெயர்' : 'Username'}</span>
                  <span className="font-mono font-bold text-gray-800">{currentUser?.username}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400">{lang === 'ta' ? 'பொறுப்பு' : 'Role'}</span>
                  <span className="font-bold text-indigo-600 uppercase">{currentUser?.roleId || 'EMPLOYEE'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">{lang === 'ta' ? 'அதிகார வரம்பு' : 'Scope'}</span>
                  <span className="font-bold text-gray-800">{currentUser?.scopeType || 'State'}</span>
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
              <h4 className="font-semibold text-gray-950 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
                <Palette className="w-5 h-5 text-indigo-500" />
                {t('themeSettings')}
              </h4>

              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1 scrollbar-custom">
                {[
                  { id: 'sunset-aurora' as const, name: lang === 'ta' ? 'அந்திச் செவ்வானம்' : 'Sunset Aurora', icon: Sun, colorLeft: 'bg-[#4c1d95]', colorRight: 'bg-[#fffbfa]', desc: 'Sunset purple-red-amber' },
                  { id: 'ocean-wave' as const, name: lang === 'ta' ? 'கடல் அலை' : 'Ocean Wave', icon: Droplet, colorLeft: 'bg-[#0f172a]', colorRight: 'bg-[#f4fbfd]', desc: 'Refreshing deep marine slate & cyan' },
                  { id: 'magic-lavender' as const, name: lang === 'ta' ? 'மந்திர லாவெண்டர் (இயல்புநிலை)' : 'Magic Lavender (Default)', icon: Zap, colorLeft: 'bg-[#1e1b4b]', colorRight: 'bg-[#faf5f8]', desc: 'Cosmic indigo & magenta fuchsia' },
                  { id: 'rainbow-prism' as const, name: lang === 'ta' ? 'வானவில் பிரிசம்' : 'Rainbow Prism', icon: LayoutGrid, colorLeft: 'bg-[#0369a1]', colorRight: 'bg-[#f8fafc]', desc: 'Brilliant full-spectrum glass refraction' },
                  { id: 'nilgiri-emerald' as const, name: lang === 'ta' ? 'நீலகிரி மரகதம்' : 'Nilgiri Emerald', icon: Palette, colorLeft: 'bg-[#064e3b]', colorRight: 'bg-[#f0faf6]', desc: 'Misty green forest landscapes' },
                  { id: 'kovai-maroon' as const, name: lang === 'ta' ? 'கோவை மரூன்' : 'Kovai Maroon', icon: Palette, colorLeft: 'bg-[#7f1d1d]', colorRight: 'bg-[#fffaf9]', desc: 'Traditional rich red-earth & clay' },
                  { id: 'madurai-blue' as const, name: lang === 'ta' ? 'மதுரை நீலம்' : 'Madurai Blue', icon: Palette, colorLeft: 'bg-[#1e3a8a]', colorRight: 'bg-[#f5f8ff]', desc: 'Regal royal blue & purple mystical' },
                  { id: 'nellai-orange' as const, name: lang === 'ta' ? 'நெல்லை ஆரஞ்சு' : 'Nellai Orange', icon: Sun, colorLeft: 'bg-[#c2410c]', colorRight: 'bg-[#fffbf9]', desc: 'Citrus-red & terracotta high contrast' },
                  { id: 'chennai-slate' as const, name: lang === 'ta' ? 'சென்னை ஸ்லேட்' : 'Chennai Slate', icon: Moon, colorLeft: 'bg-[#1e293b]', colorRight: 'bg-[#f8fafc]', desc: 'Minimal premium corporate graphite' },
                  { id: 'custom' as const, name: lang === 'ta' ? 'தனிப்பயன் தீம் இஞ்சின்' : 'Custom Theme Engine', icon: Palette, colorLeft: 'bg-[#4f46e5]', colorRight: 'bg-[#e0e7ff]', desc: 'Design your own colors on the fly' }
                ].map((th) => {
                  const Icon = th.icon;
                  const isSelected = theme === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setTheme(th.id)}
                      className={`w-full flex flex-col gap-1 p-3 rounded-xl border text-left text-xs font-semibold transition ${
                        isSelected 
                          ? 'bg-[var(--theme-badge-bg)] border-[var(--theme-active-menu)] text-[var(--theme-text-primary)] shadow-xs' 
                          : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${isSelected ? 'text-[var(--theme-active-menu)]' : 'text-gray-400'}`} />
                          <span className="font-bold">{th.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <div className="flex items-center h-4 rounded-md overflow-hidden border border-gray-200">
                            <div className={`w-3 h-4 ${th.colorLeft}`} />
                            <div className={`w-3 h-4 ${th.colorRight}`} />
                          </div>

                          <div className={`w-4 h-4 rounded-full border border-gray-300 flex items-center justify-center shrink-0 ${isSelected ? 'bg-[var(--theme-active-menu)] border-[var(--theme-active-menu)]' : 'bg-white'}`}>
                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </div>
                        </div>
                      </div>
                      <span className="text-[10px] text-gray-400 font-normal pl-6">{th.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            {theme === 'custom' && (
              <motion.div 
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4"
              >
                <h5 className="font-bold text-gray-800 text-xs uppercase tracking-wider border-b border-gray-100 pb-2 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-500" />
                  {lang === 'ta' ? 'தனிப்பயன் வண்ண தேர்வி' : 'Dynamic Theme Designer'}
                </h5>
                
                <div className="space-y-3 text-xs text-gray-600">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold block text-gray-700">Sidebar Gradient From</span>
                      <span className="text-[9px] text-gray-400">Left/top side of sidebar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={customColors.sidebarFrom} 
                        onChange={(e) => setCustomColors({ ...customColors, sidebarFrom: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      />
                      <input 
                        type="text" 
                        value={customColors.sidebarFrom} 
                        onChange={(e) => setCustomColors({ ...customColors, sidebarFrom: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg p-1 text-center font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold block text-gray-700">Sidebar Gradient To</span>
                      <span className="text-[9px] text-gray-400">Right/bottom side of sidebar</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={customColors.sidebarTo} 
                        onChange={(e) => setCustomColors({ ...customColors, sidebarTo: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      />
                      <input 
                        type="text" 
                        value={customColors.sidebarTo} 
                        onChange={(e) => setCustomColors({ ...customColors, sidebarTo: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg p-1 text-center font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold block text-gray-700">Primary Brand Color</span>
                      <span className="text-[9px] text-gray-400">Buttons, active tabs & borders</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={customColors.primaryColor} 
                        onChange={(e) => setCustomColors({ ...customColors, primaryColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      />
                      <input 
                        type="text" 
                        value={customColors.primaryColor} 
                        onChange={(e) => setCustomColors({ ...customColors, primaryColor: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg p-1 text-center font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold block text-gray-700">Accent/Badge Background</span>
                      <span className="text-[9px] text-gray-400">Card headers & callout bgs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={customColors.accentBgColor} 
                        onChange={(e) => setCustomColors({ ...customColors, accentBgColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      />
                      <input 
                        type="text" 
                        value={customColors.accentBgColor} 
                        onChange={(e) => setCustomColors({ ...customColors, accentBgColor: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg p-1 text-center font-mono text-[10px]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-semibold block text-gray-700">App Canvas Background</span>
                      <span className="text-[9px] text-gray-400">General layout background</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="color" 
                        value={customColors.appBgColor} 
                        onChange={(e) => setCustomColors({ ...customColors, appBgColor: e.target.value })}
                        className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent shrink-0"
                      />
                      <input 
                        type="text" 
                        value={customColors.appBgColor} 
                        onChange={(e) => setCustomColors({ ...customColors, appBgColor: e.target.value })}
                        className="w-20 border border-gray-200 rounded-lg p-1 text-center font-mono text-[10px]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
