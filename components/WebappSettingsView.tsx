'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Settings, 
  Database, 
  Cloud, 
  Terminal, 
  Lock, 
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Sliders,
  Smartphone,
  Upload
} from 'lucide-react';
import { Language, translations } from './translations';

interface WebappSettingsViewProps {
  state: any;
  lang: Language;
  currentUser?: any;
  onSaveSettings: (settings: any) => Promise<void>;
}

export default function WebappSettingsView({ state, lang, currentUser, onSaveSettings }: WebappSettingsViewProps) {
  const currentSettings = state?.settings || {};

  const isWebappAdmin = currentUser?.username === 'dtpadmin' || 
    (currentUser?.roleId === 'admin') || 
    (currentUser?.role && (currentUser.role.toLowerCase() === 'admin' || currentUser.role.toLowerCase().includes('admin')));

  // Local Form state
  const [mongodbUri, setMongodbUri] = useState(currentSettings.mongodbUri || '');
  const [mongodbPoolSize, setMongodbPoolSize] = useState<number>(currentSettings.mongodbPoolSize || 50);
  const [s3Bucket, setS3Bucket] = useState(currentSettings.s3Bucket || '');
  const [s3Region, setS3Region] = useState(currentSettings.s3Region || 'us-east-1');
  const [s3AccessKeyId, setS3AccessKeyId] = useState(currentSettings.s3AccessKeyId || '');
  const [s3SecretAccessKey, setS3SecretAccessKey] = useState(currentSettings.s3SecretAccessKey || '');
  const [s3PoolSize, setS3PoolSize] = useState<number>(currentSettings.s3PoolSize || 50);
  const [googleMapsApiKey, setGoogleMapsApiKey] = useState(currentSettings.googleMapsApiKey || '');
  const [enableEmployeeManagement, setEnableEmployeeManagement] = useState<boolean>(currentSettings.enableEmployeeManagement ?? true);
  const [enableTransferPosting, setEnableTransferPosting] = useState<boolean>(currentSettings.enableTransferPosting ?? true);
  const [port, setPort] = useState<string>(currentSettings.port || '3000');
  const [mobileAppIconUrl, setMobileAppIconUrl] = useState(currentSettings.mobileAppIconUrl || '');
  const [mobileLoginLogoUrl, setMobileLoginLogoUrl] = useState(currentSettings.mobileLoginLogoUrl || '');
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const [saveSuccess, setSaveSuccess] = useState(false);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const handleUploadIcon = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIcon(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'icon');
      formData.append('userId', currentUser?.employeeId || currentUser?.id || 'admin');
      const res = await fetch('/api/mobile/upload-branding', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setMobileAppIconUrl(data.url);
        if (onSaveSettings) {
          await onSaveSettings({
            ...currentSettings,
            mobileAppIconUrl: data.url
          });
        }
        alert(lang === 'ta' 
          ? '✅ ஆண்ட்ராய்டு செயலி ஐகான் வெற்றிகரமாக மாற்றப்பட்டது!\n\n1) ஏற்கனவே உங்கள் போனில் நிறுவப்பட்ட செயலியின் தலைப்பில் (In-App Header & Dashboard) இந்த ஐகான் உடனடியாக மாறும்.\n2) போனின் முகப்புத்திரை ஐகானுக்கான சோர்ஸ் கோப்புகளிலும் (res/drawable/app_icon.png & mipmap) மாற்றப்பட்டுள்ளது.' 
          : '✅ Android App Icon successfully updated!\n\n1) Installed Android apps will immediately reflect this icon in headers & dashboard.\n2) Updated in Android source folders (res/drawable/app_icon.png & mipmaps) for next APK build.');
      } else {
        alert(data.message || 'Failed to upload icon');
      }
    } catch (err) {
      console.error('Failed to upload icon:', err);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleUploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'logo');
      formData.append('userId', currentUser?.employeeId || currentUser?.id || 'admin');
      const res = await fetch('/api/mobile/upload-branding', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setMobileLoginLogoUrl(data.url);
        if (onSaveSettings) {
          await onSaveSettings({
            ...currentSettings,
            mobileLoginLogoUrl: data.url
          });
        }
        alert(lang === 'ta'
          ? '✅ ஆண்ட்ராய்டு செயலி லோகோ வெற்றிகரமாக மாற்றப்பட்டது!\n\n1) ஏற்கனவே உங்கள் போனில் நிறுவப்பட்ட ஆண்ட்ராய்டு செயலியைத் திறக்கும்போது (அல்லது Login திரையில் "Server & Sync / புதுப்பி" அழுத்தும்போது) இந்த புதிய லோகோ உடனடியாக மாறும்.\n2) சோர்ஸ் கோப்பிலும் (res/drawable/app_logo.png) மாற்றப்பட்டுள்ளது.'
          : '✅ Android App Logo successfully updated!\n\n1) Installed Android apps will immediately show this new logo upon launch or by tapping "Server & Sync" on the login screen.\n2) Updated in Android source folder (res/drawable/app_logo.png).');
      } else {
        alert(data.message || 'Failed to upload logo');
      }
    } catch (err) {
      console.error('Failed to upload logo:', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const updatedConfig = {
      ...currentSettings,
      mongodbUri,
      mongodbPoolSize: Number(mongodbPoolSize) || 50,
      s3Bucket,
      s3Region,
      s3AccessKeyId,
      s3SecretAccessKey,
      s3PoolSize: Number(s3PoolSize) || 50,
      googleMapsApiKey,
      enableEmployeeManagement,
      enableTransferPosting,
      port,
      mobileAppIconUrl,
      mobileLoginLogoUrl
    };

    await onSaveSettings(updatedConfig);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div id="webapp-settings-container" className="space-y-6">
      {/* Informational header card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-3">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Lock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">{t('webappSettings')}</h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              {t('configWarning')}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column - S3 & MongoDB configs */}
        <div className="lg:col-span-8 space-y-6">
          {/* MongoDB configuration card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                {t('mongoSettings')}
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle className="w-3 h-3 text-emerald-500" />
                {lang === 'ta' ? 'உள்ளூர் ஒத்திசைவு முடக்கப்பட்டுள்ளது (நேரடி தரவுத்தளம்)' : 'Local DB Sync Disabled (Direct Database Mode)'}
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{t('mongoUriLabel')}</label>
                <input
                  type="text"
                  placeholder="mongodb+srv://admin:securepass@cluster0.mongodb.net/dtp_enterprise"
                  value={mongodbUri}
                  onChange={(e) => setMongodbUri(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs text-indigo-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {lang === 'ta' ? 'இணைப்பு பூல் அளவு (Pool Size)' : 'MongoDB Pool Size'}
                </label>
                <input
                  type="number"
                  min="10"
                  max="2000"
                  value={mongodbPoolSize}
                  onChange={(e) => setMongodbPoolSize(parseInt(e.target.value, 10) || 500)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-xs font-bold text-gray-800"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  {lang === 'ta' ? 'இயல்புநிலை: 500 இணைப்புகள்' : 'Default: 500 connections'}
                </span>
              </div>
            </div>
          </div>

          {/* AWS S3 configuration card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Cloud className="w-5 h-5 text-indigo-500" />
                {t('s3Settings')}
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Cloud className="w-3 h-3 text-indigo-500" />
                {lang === 'ta' ? 'S3 பூல் அளவு: 500 சாக்கெட்டுகள்' : 'S3 Pool Size: 500 Sockets'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-semibold text-gray-500 block mb-1">{t('s3BucketLabel')}</label>
                <input
                  type="text"
                  placeholder="e.g. tms-2026"
                  value={s3Bucket}
                  onChange={(e) => setS3Bucket(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-500 block mb-1">{t('s3RegionLabel')}</label>
                <input
                  type="text"
                  placeholder="ap-south-1"
                  value={s3Region}
                  onChange={(e) => setS3Region(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-500 block mb-1">{t('s3AccessKeyLabel')}</label>
                <input
                  type="password"
                  placeholder="AKIAIOSFODNN7EXAMPLE"
                  value={s3AccessKeyId}
                  onChange={(e) => setS3AccessKeyId(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-500 block mb-1">{t('s3SecretKeyLabel')}</label>
                <input
                  type="password"
                  placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                  value={s3SecretAccessKey}
                  onChange={(e) => setS3SecretAccessKey(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-gray-500 block mb-1">
                  {lang === 'ta' ? 'S3 இணைப்பு பூல் அளவு (Socket Pool Size)' : 'S3 Socket Pool Size'}
                </label>
                <input
                  type="number"
                  min="50"
                  max="2000"
                  value={s3PoolSize}
                  onChange={(e) => setS3PoolSize(parseInt(e.target.value, 10) || 500)}
                  className="w-full border border-gray-200 rounded-xl p-3 outline-none font-mono font-bold text-gray-800"
                />
                <span className="text-[10px] text-gray-400 mt-1 block">
                  {lang === 'ta' ? 'இயல்புநிலை: 500 தொடர் சாக்கெட்டுகள்' : 'Default: 500 keep-alive sockets'}
                </span>
              </div>
            </div>
          </div>

          {/* Google Maps API Configuration Card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-2">
              <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                <Sliders className="w-5 h-5 text-indigo-500" />
                {lang === 'ta' ? 'கூகிள் மேப்ஸ் API சாவி (Google Maps Platform API Key)' : 'Google Maps Platform API Key'}
              </h3>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                {lang === 'ta' ? 'வரைபடம் & Replay அனிமேஷன்' : 'Map & Route Replay Animation'}
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <label className="font-semibold text-gray-500 block mb-1">
                {lang === 'ta' ? 'கூகிள் மேப்ஸ் API சாவி' : 'Google Maps API Key'}
              </label>
              <input
                type="text"
                placeholder="e.g. AIzaSyA... (Google Maps Platform API Key)"
                value={googleMapsApiKey}
                onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 outline-none font-mono text-indigo-600"
              />
              <p className="text-[11px] text-gray-400">
                {lang === 'ta'
                  ? 'MapView அறிக்கையில் Model 1 (Spiderfy Cluster), Model 2 (Route Replay Scrubber & Audio Synth) மற்றும் Model 3 (Blinking Dots) பயன்பாட்டிற்காக அமைப்புகள் சேமிக்கப்படும்.'
                  : 'Configures Google Maps Key for Model 1 (Door-to-door Spiderfy Cluster), Model 2 (Route Replay & Synth Clicks), and Model 3 (Blinking Dots).'}
              </p>
            </div>
          </div>

          {/* Module Toggles config card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
              <Sliders className="w-5 h-5 text-indigo-500" />
              {lang === 'ta' ? 'தொகுதி அணுகல் மேலாண்மை' : 'Module Access Management'}
            </h3>
            <p className="text-xs text-gray-400">
              {lang === 'ta' 
                ? 'தளத்தின் முக்கிய பிரிவுகளை ஆன்/ஆஃப் செய்க. முடக்கப்பட்ட தொகுதிகள் எந்த பயனருக்கும் காட்டப்படாது.' 
                : 'Enable or disable core modules globally. Hiding deactivated modules restricts access for all users.'}
            </p>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-800">
                    {lang === 'ta' ? 'பணியாளர்கள் மேலாண்மை தொகுதி' : 'Employee Management Module'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {lang === 'ta' 
                      ? 'பணியாளர்களின் பணி விவரங்கள், தகுதிகள் மற்றும் பட்டியல்களை நிர்வகித்தல்.' 
                      : 'Manage employee service records, directories, and qualifications.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableEmployeeManagement(!enableEmployeeManagement)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 shrink-0 ${
                    enableEmployeeManagement ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <motion.div layout className="bg-white w-4 h-4 rounded-full shadow-xs" />
                </button>
              </div>

              <div className="flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
                <div className="space-y-1">
                  <p className="text-xs font-extrabold text-slate-800">
                    {lang === 'ta' ? 'இடமாற்றம் மற்றும் பணி நியமன தொகுதி' : 'Transfer & Posting Module'}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {lang === 'ta' 
                      ? 'பொது மற்றும் பரஸ்பர இடமாறுதல் விண்ணப்பங்களை சமர்ப்பித்தல் மற்றும் நிர்வகித்தல்.' 
                      : 'Lodge and review general/mutual transfer request applications.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableTransferPosting(!enableTransferPosting)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-all duration-300 shrink-0 ${
                    enableTransferPosting ? 'bg-indigo-600 justify-end' : 'bg-gray-300 justify-start'
                  }`}
                >
                  <motion.div layout className="bg-white w-4 h-4 rounded-full shadow-xs" />
                </button>
              </div>
            </div>
          </div>

          {/* Android App Customization card */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
              <Smartphone className="w-5 h-5 text-indigo-500" />
              {lang === 'ta' ? 'அண்ட்ராய்டு செயலி தனிப்பயனாக்கம்' : 'Android App Customization'}
            </h3>
            <p className="text-xs text-gray-400">
              {lang === 'ta' 
                ? 'அண்ட்ராய்டு கைப்பேசி செயலியின் ஐகான் மற்றும் உள்நுழைவு லோகோவை இங்கே பதிவேற்றலாம் அல்லது மாற்றலாம்.' 
                : 'Upload or modify the dynamic Android App Icon and Login Logo. These changes automatically synchronize with the Android APK.'}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
              {/* App Icon Upload/Input */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-600 block">
                    {lang === 'ta' ? 'கைப்பேசி செயலி ஐகான்' : 'Android App Icon'}
                  </label>
                  {mobileAppIconUrl && (
                    <img 
                      src={mobileAppIconUrl} 
                      alt="App Icon Preview" 
                      className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-white" 
                    />
                  )}
                </div>
                
                <input
                  type="text"
                  placeholder="https://example.com/app_icon.png"
                  value={mobileAppIconUrl}
                  onChange={(e) => isWebappAdmin && setMobileAppIconUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white"
                  disabled={!isWebappAdmin}
                />

                {isWebappAdmin ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      id="upload-app-icon"
                      className="hidden"
                      onChange={handleUploadIcon}
                      disabled={uploadingIcon}
                    />
                    <label
                      htmlFor="upload-app-icon"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold cursor-pointer transition border border-indigo-100"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploadingIcon ? 'Uploading...' : (lang === 'ta' ? 'ஐகானை பதிவேற்றுக' : 'Upload Icon')}</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-600 font-semibold text-center">
                    {lang === 'ta' ? 'நிர்வாகிகள் மட்டுமே மாற்ற முடியும்' : 'Only admins can upload assets'}
                  </p>
                )}
              </div>

              {/* Login Logo Upload/Input */}
              <div className="space-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-gray-600 block">
                    {lang === 'ta' ? 'உள்நுழைவு லோகோ' : 'Android Login Logo'}
                  </label>
                  {mobileLoginLogoUrl && (
                    <img 
                      src={mobileLoginLogoUrl} 
                      alt="Login Logo Preview" 
                      className="w-10 h-10 rounded-lg object-contain border border-gray-200 bg-white" 
                    />
                  )}
                </div>
                
                <input
                  type="text"
                  placeholder="https://example.com/login_logo.png"
                  value={mobileLoginLogoUrl}
                  onChange={(e) => isWebappAdmin && setMobileLoginLogoUrl(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl p-2.5 outline-none bg-white"
                  disabled={!isWebappAdmin}
                />

                {isWebappAdmin ? (
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      id="upload-login-logo"
                      className="hidden"
                      onChange={handleUploadLogo}
                      disabled={uploadingLogo}
                    />
                    <label
                      htmlFor="upload-login-logo"
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold cursor-pointer transition border border-indigo-100"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{uploadingLogo ? 'Uploading...' : (lang === 'ta' ? 'லோகோவை பதிவேற்றுக' : 'Upload Logo')}</span>
                    </label>
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-600 font-semibold text-center">
                    {lang === 'ta' ? 'நிர்வாகிகள் மட்டுமே மாற்ற முடியும்' : 'Only admins can upload assets'}
                  </p>
                )}
              </div>
            </div>

            {/* Android Source File Path Helper Box */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-[11px]">
              <div className="font-bold text-slate-700 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{lang === 'ta' ? 'ஆண்ட்ராய்டு சோர்ஸ் கோப்பு அமைவிடங்கள் (Android Source Locations):' : 'Android Project Source File Locations:'}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600 font-mono">
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-sans font-bold text-indigo-700 text-[10px] mb-0.5">
                    {lang === 'ta' ? '1. செயலி ஐகான் (App Icon):' : '1. App Launcher Icon:'}
                  </div>
                  <code className="text-[10px] text-slate-800 break-all select-all font-semibold">kotlin_app/app/src/main/res/drawable/app_icon.png</code>
                  <div className="font-sans text-[10px] text-slate-400 mt-1">512x512 PNG (mipmap densities auto-generated)</div>
                </div>
                <div className="p-2 bg-white rounded-lg border border-slate-200">
                  <div className="font-sans font-bold text-indigo-700 text-[10px] mb-0.5">
                    {lang === 'ta' ? '2. செயலி லோகோ (Login Logo):' : '2. App Login Logo:'}
                  </div>
                  <code className="text-[10px] text-slate-800 break-all select-all font-semibold">kotlin_app/app/src/main/res/drawable/app_logo.png</code>
                  <div className="font-sans text-[10px] text-slate-400 mt-1">512x512 PNG (Transparent background)</div>
                </div>
              </div>
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-[10px] font-sans">
                💡 <strong>{lang === 'ta' ? 'குறிப்பு:' : 'Tip:'}</strong> {lang === 'ta' 
                  ? 'மேலே உள்ள "பதிவேற்றுக" பொத்தான் மூலமாகவும் பதிவேற்றலாம், அல்லது ஆண்ட்ராய்டு ஜிப் (ZIP) கோப்பைப் பதிவிறக்கிய பிறகு அதில் உள்ள "app/src/main/res/drawable/" கோப்புறையில் உங்கள் கோப்பை அதே பெயரில் (app_logo.png / app_icon.png) மாற்றிவிட்டு Android Studio-வில் இயக்கலாம்.' 
                  : 'You can upload via the buttons above to automatically update the project, or extract the downloaded Android ZIP and directly replace "app/src/main/res/drawable/app_logo.png" & "app_icon.png" in Android Studio.'}
              </div>
            </div>
          </div>

          {/* Port and execution configs */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
              <Terminal className="w-5 h-5 text-indigo-500" />
              {t('portSettings')}
            </h3>
            <div className="text-xs sm:w-1/2">
              <label className="font-semibold text-gray-500 mb-1 block">{t('appPortLabel')}</label>
              <input
                type="text"
                placeholder="3000"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full border border-gray-200 rounded-xl p-3 outline-none font-mono font-bold"
                disabled
              />
              <span className="text-[10px] text-gray-400 mt-1 block">Port is locked to 3000 by AI Studio container limits.</span>
            </div>
          </div>

          {/* Form save button */}
          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow-xs flex items-center gap-2"
            >
              {t('saveConfig')}
            </button>
            {saveSuccess && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }} 
                animate={{ opacity: 1, x: 0 }} 
                className="flex items-center gap-2 text-emerald-600 text-xs font-bold"
              >
                <CheckCircle className="w-5 h-5" />
                <span>Configuration Sync Completed Successfully!</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Right column - documentation helpers */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
            <h4 className="font-semibold text-gray-900 text-sm flex items-center gap-2 border-b border-gray-50 pb-2">
              <HelpCircle className="w-5 h-5 text-indigo-500" />
              Integration Help
            </h4>
            <div className="space-y-4 text-xs text-gray-500 leading-normal">
              <div className="space-y-1">
                <p className="font-bold text-gray-800">Dynamic Multi-DB Partitioning</p>
                <p>Upon connection, the system triggers separate MongoDB databases for each Town Panchayat (e.g. <code>tp_thiruporur</code>), separating municipal records automatically based on role scope.</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <p className="font-bold text-gray-800">Strict S3 File Boundaries</p>
                <p>Employee folders are structured hierarchically under the prefix <code>tp/&lt;town_panchayat_id&gt;/&lt;employee_id&gt;/</code>, enforcing privacy standards across districts.</p>
              </div>
              <div className="space-y-1 pt-2 border-t border-gray-100">
                <p className="font-bold text-gray-800">Environment Variables Fallback</p>
                <p>These credentials can also be declared in the <code>.env</code> file. Forms are pre-populated with either active runtime environment values or custom overrides saved locally.</p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
