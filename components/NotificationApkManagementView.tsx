'use client';

import React, { useState } from 'react';
import { 
  Bell, 
  Upload, 
  Smartphone, 
  Filter, 
  Trash2, 
  CheckCircle, 
  Download, 
  ArrowUpCircle,
  FileText,
  Clock,
  Link as LinkIcon
} from 'lucide-react';
import { Language } from './translations';

interface NotificationApkManagementViewProps {
  state: any;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function NotificationApkManagementView({ state, lang, onSaveCollection }: NotificationApkManagementViewProps) {
  const [activeTab, setActiveTab] = useState<'notifications' | 'apks'>('notifications');

  // Load masters for dropdowns
  const zones = state.zones || [];
  const districts = state.districts || [];
  const townPanchayats = state.townPanchayats || [];
  const designations = state.inspectionDesignations || [];
  const users = state.inspectionUsers || [];
  const notificationsList = state.notifications || [];
  const apkVersionsList = state.apkVersions || [];

  // Notification form state
  const [notifTitle, setNotifTitle] = useState('');
  const [notifMessage, setNotifMessage] = useState('');
  const [notifExpiresAt, setNotifExpiresAt] = useState('');
  const [notifActionUrl, setNotifActionUrl] = useState('');
  const [targetZone, setTargetZone] = useState('all');
  const [targetDistrict, setTargetDistrict] = useState('all');
  const [targetTp, setTargetTp] = useState('all');
  const [targetDesignation, setTargetDesignation] = useState('all');
  const [targetUser, setTargetUser] = useState('all');
  
  const [attachedFileUrl, setAttachedFileUrl] = useState('');
  const [attachedFileName, setAttachedFileName] = useState('');
  const [attachedFileType, setAttachedFileType] = useState(''); // 'image', 'pdf', 'excel', 'file'
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // APK form state
  const [apkFileUrl, setApkFileUrl] = useState('');
  const [apkFileName, setApkFileName] = useState('');
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [minRequiredVersionCode, setMinRequiredVersionCode] = useState('');
  const [releaseNotes, setReleaseNotes] = useState('');
  const [forceUpdate, setForceUpdate] = useState(false);
  const [uploadingApk, setUploadingApk] = useState(false);
  const [apkSuccess, setApkSuccess] = useState(false);

  // Filter districts based on selected zone
  const filteredDistricts = districts.filter((d: any) => targetZone === 'all' || d.zoneId === targetZone);
  // Filter TPs based on selected district
  const filteredTps = townPanchayats.filter((tp: any) => targetDistrict === 'all' || tp.districtId === targetDistrict);

  const t = (key: string) => {
    const map: any = {
      en: {
        notificationsTab: "Notification Management",
        apksTab: "App Version Updates",
        sendNotif: "Broadcast New Notification",
        notifTitleLabel: "Notification Title",
        notifMsgLabel: "Notification Message (Tamil & English supported)",
        filtersTitle: "Target User Filters",
        zoneFilter: "Select Zone",
        districtFilter: "Select District",
        tpFilter: "Select Town Panchayat",
        desigFilter: "Select Designation",
        userFilter: "Select Specific User",
        attachLabel: "Attach Image or File",
        broadcastBtn: "Send & Broadcast Notification",
        historyTitle: "Broadcast History",
        uploadApk: "Upload New APK Version",
        verNameLabel: "Version Name (e.g. 1.3.0)",
        verCodeLabel: "Version Code (e.g. 103)",
        forceUpdateLabel: "Force Update (Forces Android users to install this version)",
        releaseNotesLabel: "Release Notes",
        uploadApkBtn: "Upload & Release Version",
        apkHistoryTitle: "APK Release History",
        all: "All",
        noNotifs: "No notifications broadcasted yet.",
        noApks: "No APK updates released yet."
      },
      ta: {
        notificationsTab: "அறிவிப்பு மேலாண்மை",
        apksTab: "செயலி பதிப்பு புதுப்பிப்புகள்",
        sendNotif: "புதிய அறிவிப்பு அனுப்புக",
        notifTitleLabel: "அறிவிப்பு தலைப்பு",
        notifMsgLabel: "அறிவிப்பு செய்தி (தமிழ் & ஆங்கிலம்)",
        filtersTitle: "அறிவிப்பு பெறுநர்களின் வடிப்பான்கள்",
        zoneFilter: "மண்டலத்தை தேர்வு செய்க",
        districtFilter: "மாவட்டத்தை தேர்வு செய்க",
        tpFilter: "பேரூராட்சியை தேர்வு செய்க",
        desigFilter: "பதவியை தேர்வு செய்க",
        userFilter: "குறிப்பிட்ட பயனரை தேர்வு செய்க",
        attachLabel: "படம் அல்லது கோப்பை இணைக்கவும்",
        broadcastBtn: "அறிவிப்பை ஒளிபரப்பு செய்க",
        historyTitle: "ஒளிபரப்பு வரலாறு",
        uploadApk: "புதிய செயலி (APK) பதிப்பை பதிவேற்றுக",
        verNameLabel: "பதிப்பு பெயர் (எ.கா. 1.3.0)",
        verCodeLabel: "பதிப்பு குறியீடு (எ.கா. 103)",
        forceUpdateLabel: "கட்டாய புதுப்பிப்பு (பயனர்கள் கட்டாயமாக நிறுவ வேண்டும்)",
        releaseNotesLabel: "வெளியீட்டுக் குறிப்புகள்",
        uploadApkBtn: "செயலியை பதிவேற்றி வெளியிடுக",
        apkHistoryTitle: "APK வெளியீட்டு வரலாறு",
        all: "அனைத்தும்",
        noNotifs: "இதுவரை எந்த அறிவிப்புகளும் அனுப்பப்படவில்லை.",
        noApks: "இதுவரை எந்த APK புதுப்பிப்புகளும் வெளியிடப்படவில்லை."
      }
    };
    return map[lang]?.[key] || map['en']?.[key] || key;
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url) {
        setAttachedFileUrl(data.url);
        setAttachedFileName(file.name);
        const lowerName = file.name.toLowerCase();
        if (file.type.startsWith('image/') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.webp')) {
          setAttachedFileType('image');
        } else if (file.type.includes('pdf') || lowerName.endsWith('.pdf')) {
          setAttachedFileType('pdf');
        } else if (file.type.includes('sheet') || file.type.includes('excel') || lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv')) {
          setAttachedFileType('excel');
        } else {
          setAttachedFileType('file');
        }
      } else {
        alert('Upload failed: ' + (data.message || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading attachment');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleUploadApkFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.apk')) {
      alert(lang === 'ta' ? 'தயவுசெய்து .apk கோப்பை மட்டும் தேர்வு செய்யவும்!' : 'Please select a valid .apk file only!');
      return;
    }
    setUploadingApk(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('purpose', 'apk');
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (data.success && data.url && !String(data.url).startsWith('/uploads/')) {
        setApkFileUrl(data.url);
        setApkFileName(file.name);
      } else {
        const msg =
          data.message ||
          (String(data.url || '').startsWith('/uploads/')
            ? 'APK cannot be saved on this computer.'
            : `HTTP ${res.status}`);
        alert(
          lang === 'ta'
            ? `APK பதிவேற்றம் தோல்வி: ${msg}\n\nhttps://townpanchayat.com → அறிவிப்புகள் → App Update இல் பதிவேற்றவும்.`
            : `APK upload failed: ${msg}\n\nUpload the APK only on the live site: https://townpanchayat.com → Notifications → App Update (S3).`
        );
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading APK file');
    } finally {
      setUploadingApk(false);
    }
  };

  const handleBroadcastNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notifTitle || !notifMessage) {
      alert('Title and Message are required');
      return;
    }

    const newNotif = {
      id: `notif_${Date.now()}`,
      title: notifTitle,
      message: notifMessage,
      mediaUrl: attachedFileUrl,
      imageUrl: attachedFileType === 'image' ? attachedFileUrl : '',
      fileUrl: attachedFileType !== 'image' && attachedFileUrl ? attachedFileUrl : '',
      fileType: attachedFileType || 'none',
      fileName: attachedFileName,
      actionUrl: notifActionUrl.trim(),
      expiresAt: notifExpiresAt ? new Date(notifExpiresAt).toISOString() : null,
      targetFilters: {
        zoneId: targetZone,
        districtId: targetDistrict,
        tpId: targetTp,
        designationId: targetDesignation,
        userId: targetUser
      },
      createdAt: new Date().toISOString()
    };

    const nextList = [newNotif, ...notificationsList];
    await onSaveCollection('notifications', nextList);

    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNotif)
      });
    } catch (_) {}
    
    setSaveSuccess(true);
    setNotifTitle('');
    setNotifMessage('');
    setNotifExpiresAt('');
    setNotifActionUrl('');
    setAttachedFileUrl('');
    setAttachedFileName('');
    setAttachedFileType('');
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleReleaseApk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apkFileUrl || !versionName || !versionCode) {
      alert('APK File, Version Name, and Version Code are required');
      return;
    }

    const parsedVersionCode = parseInt(versionCode) || 1;
    const parsedMinCode = minRequiredVersionCode
      ? parseInt(minRequiredVersionCode) || parsedVersionCode
      : (forceUpdate ? parsedVersionCode : Math.max(1, parsedVersionCode - 1));

    const newVersion = {
      id: `apk_${Date.now()}`,
      versionName: versionName,
      versionCode: parsedVersionCode,
      minRequiredVersionCode: parsedMinCode,
      apkUrl: apkFileUrl,
      downloadUrl: apkFileUrl,
      releaseNotes: releaseNotes,
      forceUpdate: forceUpdate,
      createdAt: new Date().toISOString()
    };

    const nextList = [newVersion, ...apkVersionsList];
    await onSaveCollection('apkVersions', nextList);

    // Also update mobileConfig settings so it propagates immediately to /api/mobile/config
    try {
      const currentConfigRes = await fetch('/api/mobile/config');
      const currentConfigJson = await currentConfigRes.json();
      if (currentConfigJson.success) {
        await fetch('/api/mobile/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...currentConfigJson.config,
            appVersion: versionName,
            buildNumber: parsedVersionCode,
            minRequiredVersionCode: parsedMinCode,
            forceUpdate: forceUpdate,
            apkDownloadUrl: apkFileUrl
          })
        });
      }
    } catch (err) {
      console.error('Failed to update global mobileConfig dynamically:', err);
    }

    setApkSuccess(true);
    setVersionName('');
    setVersionCode('');
    setMinRequiredVersionCode('');
    setReleaseNotes('');
    setApkFileUrl('');
    setApkFileName('');
    setForceUpdate(false);
    setTimeout(() => setApkSuccess(false), 3000);
  };

  const handleDeleteNotification = async (id: string) => {
    if (confirm('Are you sure you want to delete this broadcasted notification?')) {
      const nextList = notificationsList.filter((n: any) => n.id !== id);
      await onSaveCollection('notifications', nextList);
    }
  };

  const handleDeleteApk = async (id: string) => {
    if (confirm('Are you sure you want to remove this APK release from database?')) {
      const nextList = apkVersionsList.filter((a: any) => a.id !== id);
      await onSaveCollection('apkVersions', nextList);
    }
  };

  return (
    <div className="portal-studio">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <Bell className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {lang === 'ta' ? 'அறிவிப்புகள் மற்றும் செயலி' : 'Notifications & App Updates'}
            </h3>
            <p className="text-[10px] text-white/70">
              {lang === 'ta'
                ? 'புஷ் அறிவிப்புகளை ஒளிபரப்பவும் மற்றும் ஆண்ட்ராய்டு APK பதிப்புகளை வெளியிடவும்.'
                : 'Broadcast push notifications and release Android APK versions.'}
            </p>
          </div>
        </div>
      </div>

      <div className="portal-fis-body portal-page">
      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <button
            type="button"
            onClick={() => setActiveTab('notifications')}
            className={`portal-dash-pill ${activeTab === 'notifications' ? 'is-active' : ''}`}
          >
            <Bell className="h-3.5 w-3.5" />
            <span>{t('notificationsTab')}</span>
            <span className="portal-fis-count">{notificationsList.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apks')}
            className={`portal-dash-pill ${activeTab === 'apks' ? 'is-active' : ''}`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>{t('apksTab')}</span>
            <span className="portal-fis-count">{apkVersionsList.length}</span>
          </button>
        </div>
      </div>

      {activeTab === 'notifications' ? (
          <div className="portal-wt-grid">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <Bell className="h-3 w-3" />
                    </span>
                    {t('sendNotif')}
                  </h3>
                  <p>
                    {lang === 'ta'
                      ? 'வடிகட்டிகளுடன் மொபைல் பயனர்களுக்கு உடனடி அறிவிப்பு அனுப்பவும்.'
                      : 'Send push notifications to mobile users with target filters.'}
                  </p>
                </div>
              </div>
              <div className="portal-dash-body portal-wt-form">
                <form onSubmit={handleBroadcastNotification} className="space-y-3">
                  {saveSuccess && (
                    <p className="portal-wt-note">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Notification broadcasted successfully and saved to history!</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label>{t('notifTitleLabel')}</label>
                      <input
                        type="text"
                        required
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        placeholder="e.g. Mandatory Vector Breeding Audit"
                      />
                    </div>
                    <div>
                      <label>{t('attachLabel')}</label>
                      <div className="portal-file-pick">
                        <input
                          type="file"
                          id="notif_file_upload"
                          className="hidden"
                          onChange={handleUploadAttachment}
                        />
                        <label htmlFor="notif_file_upload" className="portal-wt-link inline-flex cursor-pointer items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5" />
                          <span>{uploadingAttachment ? 'Uploading...' : attachedFileName || 'Upload Image or PDF'}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label>{t('notifMsgLabel')}</label>
                    <textarea
                      required
                      rows={3}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Enter broadcast text. Matching field users receive this on their devices..."
                    />
                  </div>

                  <div>
                    <label>
                      {lang === 'ta' ? 'காலாவதி தேதி (விரும்பினால்)' : 'Expiry date (optional)'}
                    </label>
                    <input
                      type="datetime-local"
                      value={notifExpiresAt}
                      onChange={(e) => setNotifExpiresAt(e.target.value)}
                    />
                    <p className="portal-wt-note">
                      {lang === 'ta'
                        ? 'காலாவதியான அறிவிப்புகள் செயலியில் காட்டப்படாது.'
                        : 'Expired notifications will not be shown in the mobile app.'}
                    </p>
                  </div>

                  <div className="portal-wt-section">
                    <div className="portal-wt-section-title">
                      <span className="inline-flex items-center gap-1.5">
                        <Filter className="h-3 w-3" />
                        {t('filtersTitle')}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label>{t('zoneFilter')}</label>
                        <select
                          value={targetZone}
                          onChange={(e) => { setTargetZone(e.target.value); setTargetDistrict('all'); setTargetTp('all'); }}
                        >
                          <option value="all">{t('all')}</option>
                          {zones.map((z: any) => <option key={z.id} value={z.id}>{z.nameEn}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>{t('districtFilter')}</label>
                        <select
                          value={targetDistrict}
                          onChange={(e) => { setTargetDistrict(e.target.value); setTargetTp('all'); }}
                        >
                          <option value="all">{t('all')}</option>
                          {filteredDistricts.map((d: any) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>{t('tpFilter')}</label>
                        <select
                          value={targetTp}
                          onChange={(e) => setTargetTp(e.target.value)}
                        >
                          <option value="all">{t('all')}</option>
                          {filteredTps.map((tp: any) => <option key={tp.id} value={tp.id}>{tp.nameEn}</option>)}
                        </select>
                      </div>
                      <div>
                        <label>{t('desigFilter')}</label>
                        <select
                          value={targetDesignation}
                          onChange={(e) => setTargetDesignation(e.target.value)}
                        >
                          <option value="all">{t('all')}</option>
                          {designations.map((d: any) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label>{t('userFilter')}</label>
                        <select
                          value={targetUser}
                          onChange={(e) => setTargetUser(e.target.value)}
                        >
                          <option value="all">{t('all')}</option>
                          {users.map((u: any) => <option key={u.id} value={u.id}>{u.nameEn} ({u.username})</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label>
                      <LinkIcon className="mr-1 inline h-3 w-3" />
                      {lang === 'ta' ? 'இணையதள இணைப்பு (விருப்பத்தேர்வு)' : 'Action Link URL (optional)'}
                    </label>
                    <input
                      type="url"
                      value={notifActionUrl}
                      onChange={(e) => setNotifActionUrl(e.target.value)}
                      placeholder="https://example.gov.in/portal/circulars/..."
                    />
                  </div>

                  <button type="submit" disabled={uploadingAttachment}>
                    <Bell className="h-3.5 w-3.5" />
                    {t('broadcastBtn')}
                  </button>
                </form>
              </div>
            </div>

            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <Clock className="h-3 w-3" />
                    </span>
                    {t('historyTitle')}
                  </h3>
                </div>
                <span className="portal-fis-count">{notificationsList.length}</span>
              </div>
              <div className="portal-dash-body">
                <div className="portal-wt-fields">
                  {notificationsList.length === 0 ? (
                    <p className="portal-wt-empty is-center">{t('noNotifs')}</p>
                  ) : (
                    notificationsList.map((notif: any) => (
                      <div key={notif.id} className="portal-wt-field">
                        <div className="portal-wt-field-main">
                          <div className="portal-wt-field-name">{notif.title}</div>
                          <p className="portal-wt-meta">{notif.message}</p>
                          {notif.fileName && (
                            <a
                              href={notif.imageUrl || notif.fileUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="portal-wt-link mt-1 inline-flex items-center gap-1"
                            >
                              <FileText className="h-3 w-3" />
                              {notif.fileName}
                            </a>
                          )}
                          <div className="portal-wt-chips">
                            {notif.targetFilters?.zoneId !== 'all' && (
                              <span className="portal-wt-chip">
                                Zone: {zones.find((z: any) => z.id === notif.targetFilters?.zoneId)?.nameEn || notif.targetFilters?.zoneId}
                              </span>
                            )}
                            {notif.targetFilters?.districtId !== 'all' && (
                              <span className="portal-wt-chip">
                                Dist: {districts.find((d: any) => d.id === notif.targetFilters?.districtId)?.nameEn || notif.targetFilters?.districtId}
                              </span>
                            )}
                            {notif.targetFilters?.tpId !== 'all' && (
                              <span className="portal-wt-chip">
                                TP: {townPanchayats.find((tp: any) => tp.id === notif.targetFilters?.tpId)?.nameEn || notif.targetFilters?.tpId}
                              </span>
                            )}
                            {notif.targetFilters?.designationId !== 'all' && (
                              <span className="portal-wt-chip">
                                {designations.find((d: any) => d.id === notif.targetFilters?.designationId)?.nameEn || notif.targetFilters?.designationId}
                              </span>
                            )}
                            {notif.targetFilters?.userId !== 'all' && (
                              <span className="portal-wt-chip">
                                User: {users.find((u: any) => u.id === notif.targetFilters?.userId)?.nameEn || notif.targetFilters?.userId}
                              </span>
                            )}
                          </div>
                          <p className="portal-wt-meta">
                            {new Date(notif.createdAt).toLocaleDateString()} • {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => handleDeleteNotification(notif.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
      ) : (
          <div className="portal-wt-grid">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <Smartphone className="h-3 w-3" />
                    </span>
                    {t('uploadApk')}
                  </h3>
                  <p>
                    {lang === 'ta'
                      ? 'புதிய செயலி பதிப்பை வெளியிட்டு கட்டாய புதுப்பிப்பை அமைக்கவும்.'
                      : 'Release a new APK and optionally force an immediate upgrade.'}
                  </p>
                </div>
              </div>
              <div className="portal-dash-body portal-wt-form">
                <form onSubmit={handleReleaseApk} className="space-y-3">
                  {apkSuccess && (
                    <p className="portal-wt-note">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                      <span>New APK released successfully. Mobile devices will pick up this version.</span>
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label>{t('verNameLabel')}</label>
                      <input
                        type="text"
                        required
                        value={versionName}
                        onChange={(e) => setVersionName(e.target.value)}
                        placeholder="e.g. 1.2.1"
                      />
                    </div>
                    <div>
                      <label>{t('verCodeLabel')}</label>
                      <input
                        type="number"
                        required
                        value={versionCode}
                        onChange={(e) => setVersionCode(e.target.value)}
                        placeholder="e.g. 15"
                      />
                    </div>
                    <div>
                      <label>
                        {lang === 'ta' ? 'குறைந்தபட்ச வெர்ஷன் கோட்' : 'Min Required Code'}
                      </label>
                      <input
                        type="number"
                        value={minRequiredVersionCode}
                        onChange={(e) => setMinRequiredVersionCode(e.target.value)}
                        placeholder="e.g. 14"
                      />
                    </div>
                  </div>

                  <div>
                    <label>APK File (.apk)</label>
                    <div className="portal-file-pick">
                      <input
                        type="file"
                        id="apk_file_upload"
                        accept=".apk"
                        className="hidden"
                        onChange={handleUploadApkFile}
                      />
                      <label htmlFor="apk_file_upload" className="portal-wt-link inline-flex cursor-pointer items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingApk ? 'Uploading APK...' : apkFileName || 'Upload APK File'}</span>
                      </label>
                    </div>
                  </div>

                  <label className="portal-wt-checkgrid" style={{ display: 'block' }}>
                    <span className="inline-flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="force_update_cb"
                        checked={forceUpdate}
                        onChange={(e) => setForceUpdate(e.target.checked)}
                      />
                      <span>{t('forceUpdateLabel')}</span>
                    </span>
                  </label>

                  <div>
                    <label>{t('releaseNotesLabel')}</label>
                    <textarea
                      rows={3}
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      placeholder="Specify release changes, optimization, bug fixes..."
                    />
                  </div>

                  <button type="submit" disabled={uploadingApk || !apkFileUrl}>
                    <ArrowUpCircle className="h-3.5 w-3.5" />
                    {t('uploadApkBtn')}
                  </button>
                </form>
              </div>
            </div>

            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon">
                      <Smartphone className="h-3 w-3" />
                    </span>
                    {t('apkHistoryTitle')}
                  </h3>
                </div>
                <span className="portal-fis-count">{apkVersionsList.length}</span>
              </div>
              <div className="portal-dash-body">
                <div className="portal-wt-fields">
                  {apkVersionsList.length === 0 ? (
                    <p className="portal-wt-empty is-center">{t('noApks')}</p>
                  ) : (
                    apkVersionsList.map((apk: any) => (
                      <div key={apk.id} className="portal-wt-field">
                        <div className="portal-wt-field-main">
                          <div className="portal-wt-field-name">
                            <span>v{apk.versionName}</span>
                            <span className="portal-dash-id">Build {apk.versionCode}</span>
                            {apk.forceUpdate && <span className="portal-dash-status is-pending">FORCE</span>}
                          </div>
                          {apk.releaseNotes && <p className="portal-wt-meta">{apk.releaseNotes}</p>}
                          <a
                            href={apk.apkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="portal-wt-link mt-1 inline-flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            Download APK
                          </a>
                          <p className="portal-wt-meta">
                            Released: {new Date(apk.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="portal-wt-actions">
                          <button
                            type="button"
                            onClick={() => handleDeleteApk(apk.id)}
                            className="portal-fis-icon-btn is-danger"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
      )}
      </div>
    </div>
  );
}
