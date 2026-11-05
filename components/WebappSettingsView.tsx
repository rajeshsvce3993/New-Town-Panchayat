'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Database, 
  Cloud, 
  Terminal, 
  HelpCircle,
  CheckCircle,
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
    <div id="webapp-settings-container" className="portal-studio portal-page">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Settings className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">{t('webappSettings')}</h3>
            <p className="text-[10px] text-white/70">{t('configWarning')}</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Database className="h-3 w-3" />
                  </span>
                  {t('mongoSettings')}
                </h3>
                <p>
                  {lang === 'ta' ? 'உள்ளூர் ஒத்திசைவு முடக்கப்பட்டுள்ளது (நேரடி தரவுத்தளம்)' : 'Local DB sync disabled — direct database mode'}
                </p>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label>{t('mongoUriLabel')}</label>
                  <input
                    type="text"
                    placeholder="mongodb+srv://admin:securepass@cluster0.mongodb.net/dtp_enterprise"
                    value={mongodbUri}
                    onChange={(e) => setMongodbUri(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    {lang === 'ta' ? 'இணைப்பு பூல் அளவு (Pool Size)' : 'MongoDB Pool Size'}
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="2000"
                    value={mongodbPoolSize}
                    onChange={(e) => setMongodbPoolSize(parseInt(e.target.value, 10) || 500)}
                  />
                  <p className="portal-wt-note">
                    {lang === 'ta' ? 'இயல்புநிலை: 500 இணைப்புகள்' : 'Default: 500 connections'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Cloud className="h-3 w-3" />
                  </span>
                  {t('s3Settings')}
                </h3>
                <p>{lang === 'ta' ? 'S3 பூல் அளவு: 500 சாக்கெட்டுகள்' : 'S3 pool size: 500 sockets'}</p>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label>{t('s3BucketLabel')}</label>
                  <input
                    type="text"
                    placeholder="e.g. tms-2026"
                    value={s3Bucket}
                    onChange={(e) => setS3Bucket(e.target.value)}
                  />
                </div>
                <div>
                  <label>{t('s3RegionLabel')}</label>
                  <input
                    type="text"
                    placeholder="ap-south-1"
                    value={s3Region}
                    onChange={(e) => setS3Region(e.target.value)}
                  />
                </div>
                <div>
                  <label>{t('s3AccessKeyLabel')}</label>
                  <input
                    type="password"
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    value={s3AccessKeyId}
                    onChange={(e) => setS3AccessKeyId(e.target.value)}
                  />
                </div>
                <div>
                  <label>{t('s3SecretKeyLabel')}</label>
                  <input
                    type="password"
                    placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                    value={s3SecretAccessKey}
                    onChange={(e) => setS3SecretAccessKey(e.target.value)}
                  />
                </div>
                <div>
                  <label>
                    {lang === 'ta' ? 'S3 இணைப்பு பூல் அளவு (Socket Pool Size)' : 'S3 Socket Pool Size'}
                  </label>
                  <input
                    type="number"
                    min="50"
                    max="2000"
                    value={s3PoolSize}
                    onChange={(e) => setS3PoolSize(parseInt(e.target.value, 10) || 500)}
                  />
                  <p className="portal-wt-note">
                    {lang === 'ta' ? 'இயல்புநிலை: 500 தொடர் சாக்கெட்டுகள்' : 'Default: 500 keep-alive sockets'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Sliders className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'கூகிள் மேப்ஸ் API சாவி' : 'Google Maps Platform API Key'}
                </h3>
                <p>{lang === 'ta' ? 'வரைபடம் & Replay அனிமேஷன்' : 'Map and route replay animation'}</p>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div>
                <label>{lang === 'ta' ? 'கூகிள் மேப்ஸ் API சாவி' : 'Google Maps API Key'}</label>
                <input
                  type="text"
                  placeholder="e.g. AIzaSyA... (Google Maps Platform API Key)"
                  value={googleMapsApiKey}
                  onChange={(e) => setGoogleMapsApiKey(e.target.value)}
                />
                <p className="portal-wt-note">
                  {lang === 'ta'
                    ? 'MapView அறிக்கையில் Model 1, Model 2 மற்றும் Model 3 பயன்பாட்டிற்காக அமைப்புகள் சேமிக்கப்படும்.'
                    : 'Used for MapView Model 1 (cluster), Model 2 (route replay), and Model 3 (blinking dots).'}
                </p>
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Sliders className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'தொகுதி அணுகல் மேலாண்மை' : 'Module Access Management'}
                </h3>
                <p>
                  {lang === 'ta'
                    ? 'தளத்தின் முக்கிய பிரிவுகளை ஆன்/ஆஃப் செய்க. முடக்கப்பட்ட தொகுதிகள் எந்த பயனருக்கும் காட்டப்படாது.'
                    : 'Enable or disable core modules globally for all users.'}
                </p>
              </div>
            </div>
            <div className="portal-dash-body">
              <div className="portal-wt-fields">
                <div className="portal-wt-field">
                  <div className="portal-wt-field-main">
                    <div className="portal-wt-field-name">
                      {lang === 'ta' ? 'பணியாளர்கள் மேலாண்மை தொகுதி' : 'Employee Management Module'}
                    </div>
                    <p className="portal-wt-meta">
                      {lang === 'ta'
                        ? 'பணியாளர்களின் பணி விவரங்கள், தகுதிகள் மற்றும் பட்டியல்களை நிர்வகித்தல்.'
                        : 'Manage employee service records, directories, and qualifications.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableEmployeeManagement(!enableEmployeeManagement)}
                    className={`portal-switch ${enableEmployeeManagement ? 'is-on' : ''}`}
                    aria-pressed={enableEmployeeManagement}
                  >
                    <span />
                  </button>
                </div>
                <div className="portal-wt-field">
                  <div className="portal-wt-field-main">
                    <div className="portal-wt-field-name">
                      {lang === 'ta' ? 'இடமாற்றம் மற்றும் பணி நியமன தொகுதி' : 'Transfer & Posting Module'}
                    </div>
                    <p className="portal-wt-meta">
                      {lang === 'ta'
                        ? 'பொது மற்றும் பரஸ்பர இடமாறுதல் விண்ணப்பங்களை சமர்ப்பித்தல் மற்றும் நிர்வகித்தல்.'
                        : 'Lodge and review general/mutual transfer request applications.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableTransferPosting(!enableTransferPosting)}
                    className={`portal-switch ${enableTransferPosting ? 'is-on' : ''}`}
                    aria-pressed={enableTransferPosting}
                  >
                    <span />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Smartphone className="h-3 w-3" />
                  </span>
                  {lang === 'ta' ? 'அண்ட்ராய்டு செயலி தனிப்பயனாக்கம்' : 'Android App Customization'}
                </h3>
                <p>
                  {lang === 'ta'
                    ? 'அண்ட்ராய்டு கைப்பேசி செயலியின் ஐகான் மற்றும் உள்நுழைவு லோகோவை இங்கே பதிவேற்றலாம் அல்லது மாற்றலாம்.'
                    : 'Upload or change the Android app icon and login logo.'}
                </p>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="portal-wt-section">
                  <div className="portal-wt-section-title">
                    <span>{lang === 'ta' ? 'கைப்பேசி செயலி ஐகான்' : 'Android App Icon'}</span>
                    {mobileAppIconUrl && (
                      <img src={mobileAppIconUrl} alt="App Icon Preview" className="h-7 w-7 rounded-md object-contain" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="https://example.com/app_icon.png"
                    value={mobileAppIconUrl}
                    onChange={(e) => isWebappAdmin && setMobileAppIconUrl(e.target.value)}
                    disabled={!isWebappAdmin}
                  />
                  {isWebappAdmin ? (
                    <div className="portal-file-pick">
                      <input
                        type="file"
                        accept="image/*"
                        id="upload-app-icon"
                        className="hidden"
                        onChange={handleUploadIcon}
                        disabled={uploadingIcon}
                      />
                      <label htmlFor="upload-app-icon" className="portal-wt-link inline-flex cursor-pointer items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingIcon ? 'Uploading...' : (lang === 'ta' ? 'ஐகானை பதிவேற்றுக' : 'Upload Icon')}</span>
                      </label>
                    </div>
                  ) : (
                    <p className="portal-wt-note">{lang === 'ta' ? 'நிர்வாகிகள் மட்டுமே மாற்ற முடியும்' : 'Only admins can upload assets'}</p>
                  )}
                </div>

                <div className="portal-wt-section">
                  <div className="portal-wt-section-title">
                    <span>{lang === 'ta' ? 'உள்நுழைவு லோகோ' : 'Android Login Logo'}</span>
                    {mobileLoginLogoUrl && (
                      <img src={mobileLoginLogoUrl} alt="Login Logo Preview" className="h-7 w-7 rounded-md object-contain" />
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="https://example.com/login_logo.png"
                    value={mobileLoginLogoUrl}
                    onChange={(e) => isWebappAdmin && setMobileLoginLogoUrl(e.target.value)}
                    disabled={!isWebappAdmin}
                  />
                  {isWebappAdmin ? (
                    <div className="portal-file-pick">
                      <input
                        type="file"
                        accept="image/*"
                        id="upload-login-logo"
                        className="hidden"
                        onChange={handleUploadLogo}
                        disabled={uploadingLogo}
                      />
                      <label htmlFor="upload-login-logo" className="portal-wt-link inline-flex cursor-pointer items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingLogo ? 'Uploading...' : (lang === 'ta' ? 'லோகோவை பதிவேற்றுக' : 'Upload Logo')}</span>
                      </label>
                    </div>
                  ) : (
                    <p className="portal-wt-note">{lang === 'ta' ? 'நிர்வாகிகள் மட்டுமே மாற்ற முடியும்' : 'Only admins can upload assets'}</p>
                  )}
                </div>
              </div>
              <p className="portal-wt-note">
                {lang === 'ta'
                  ? 'சோர்ஸ் பாதைகள்: kotlin_app/app/src/main/res/drawable/app_icon.png மற்றும் app_logo.png'
                  : 'Source paths: kotlin_app/app/src/main/res/drawable/app_icon.png and app_logo.png'}
              </p>
            </div>
          </div>

          <div className="portal-dashboard-panel">
            <div className="portal-dash-head">
              <div>
                <h3>
                  <span className="portal-dash-icon">
                    <Terminal className="h-3 w-3" />
                  </span>
                  {t('portSettings')}
                </h3>
              </div>
            </div>
            <div className="portal-dash-body portal-wt-form">
              <div>
                <label>{t('appPortLabel')}</label>
                <input
                  type="text"
                  placeholder="3000"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  disabled
                />
                <p className="portal-wt-note">Port is locked to 3000 by AI Studio container limits.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit">{t('saveConfig')}</button>
                {saveSuccess && (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700">
                    <CheckCircle className="h-4 w-4" />
                    Configuration Sync Completed Successfully!
                  </span>
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
                    <HelpCircle className="h-3 w-3" />
                  </span>
                  Integration Help
                </h3>
              </div>
            </div>
            <div className="portal-dash-body">
              <div className="portal-wt-fields">
                <div className="portal-wt-field">
                  <div className="portal-wt-field-main">
                    <div className="portal-wt-field-name">Dynamic Multi-DB Partitioning</div>
                    <p className="portal-wt-meta">
                      Upon connection, the system triggers separate MongoDB databases for each Town Panchayat (e.g. tp_thiruporur), separating municipal records automatically based on role scope.
                    </p>
                  </div>
                </div>
                <div className="portal-wt-field">
                  <div className="portal-wt-field-main">
                    <div className="portal-wt-field-name">Strict S3 File Boundaries</div>
                    <p className="portal-wt-meta">
                      Employee folders are structured hierarchically under the prefix tp/&lt;town_panchayat_id&gt;/&lt;employee_id&gt;/, enforcing privacy standards across districts.
                    </p>
                  </div>
                </div>
                <div className="portal-wt-field">
                  <div className="portal-wt-field-main">
                    <div className="portal-wt-field-name">Environment Variables Fallback</div>
                    <p className="portal-wt-meta">
                      These credentials can also be declared in the .env file. Forms are pre-populated with either active runtime environment values or custom overrides saved locally.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
