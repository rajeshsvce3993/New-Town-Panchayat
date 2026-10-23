'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
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
  Briefcase,
  Layers,
  MapPin,
  Users,
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
    <div className="space-y-6">
      {/* Tab Navigation header */}
      <div className="flex bg-slate-100/80 p-1.5 rounded-2xl max-w-md">
        <button
          onClick={() => setActiveTab('notifications')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'notifications'
              ? 'bg-white shadow text-indigo-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>{t('notificationsTab')}</span>
        </button>
        <button
          onClick={() => setActiveTab('apks')}
          className={`flex-1 py-3 text-xs font-bold rounded-xl transition flex items-center justify-center gap-2 ${
            activeTab === 'apks'
              ? 'bg-white shadow text-indigo-700'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>{t('apksTab')}</span>
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'notifications' ? (
          <motion.div
            key="notifTab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Broadcaster form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">{t('sendNotif')}</h3>
                    <p className="text-xs text-slate-500">Send push notifications to mobile users instantly with customized filters.</p>
                  </div>
                </div>

                <form onSubmit={handleBroadcastNotification} className="space-y-4">
                  {saveSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>Notification broadcasted successfully and saved to history!</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('notifTitleLabel')}</label>
                      <input
                        type="text"
                        required
                        value={notifTitle}
                        onChange={(e) => setNotifTitle(e.target.value)}
                        placeholder="e.g. Mandatory Vector Breeding Audit"
                        className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('attachLabel')}</label>
                      <div className="relative">
                        <input
                          type="file"
                          id="notif_file_upload"
                          className="hidden"
                          onChange={handleUploadAttachment}
                        />
                        <label
                          htmlFor="notif_file_upload"
                          className="w-full border border-dashed border-purple-200 rounded-2xl p-3 text-xs flex items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition font-bold text-indigo-700"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{uploadingAttachment ? 'Uploading...' : attachedFileName || 'Upload Image or PDF'}</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('notifMsgLabel')}</label>
                    <textarea
                      required
                      rows={3}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      placeholder="Enter broadcast text description. All matching field users will receive this instantly on their devices..."
                      className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'காலாவதி தேதி (விரும்பினால்)' : 'Expiry date (optional)'}
                    </label>
                    <input
                      type="datetime-local"
                      value={notifExpiresAt}
                      onChange={(e) => setNotifExpiresAt(e.target.value)}
                      className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
                    />
                    <p className="text-[10px] text-slate-400">
                      {lang === 'ta'
                        ? 'காலாவதியான அறிவிப்புகள் செயலியில் காட்டப்படாது.'
                        : 'Expired notifications will not be shown in the mobile app.'}
                    </p>
                  </div>

                  {/* Filters block */}
                  <div className="border border-indigo-50 bg-indigo-50/20 rounded-2xl p-4 space-y-4">
                    <div className="flex items-center gap-2 text-indigo-900 font-bold text-xs uppercase tracking-wide">
                      <Filter className="w-4 h-4 text-indigo-500" />
                      <span>{t('filtersTitle')}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('zoneFilter')}</label>
                        <select
                          value={targetZone}
                          onChange={(e) => { setTargetZone(e.target.value); setTargetDistrict('all'); setTargetTp('all'); }}
                          className="w-full border border-purple-50 rounded-xl p-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 transition"
                        >
                          <option value="all">{t('all')}</option>
                          {zones.map((z: any) => <option key={z.id} value={z.id}>{z.nameEn}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('districtFilter')}</label>
                        <select
                          value={targetDistrict}
                          onChange={(e) => { setTargetDistrict(e.target.value); setTargetTp('all'); }}
                          className="w-full border border-purple-50 rounded-xl p-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 transition"
                        >
                          <option value="all">{t('all')}</option>
                          {filteredDistricts.map((d: any) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('tpFilter')}</label>
                        <select
                          value={targetTp}
                          onChange={(e) => setTargetTp(e.target.value)}
                          className="w-full border border-purple-50 rounded-xl p-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 transition"
                        >
                          <option value="all">{t('all')}</option>
                          {filteredTps.map((tp: any) => <option key={tp.id} value={tp.id}>{tp.nameEn}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('desigFilter')}</label>
                        <select
                          value={targetDesignation}
                          onChange={(e) => setTargetDesignation(e.target.value)}
                          className="w-full border border-purple-50 rounded-xl p-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 transition"
                        >
                          <option value="all">{t('all')}</option>
                          {designations.map((d: any) => <option key={d.id} value={d.id}>{d.nameEn}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">{t('userFilter')}</label>
                        <select
                          value={targetUser}
                          onChange={(e) => setTargetUser(e.target.value)}
                          className="w-full border border-purple-50 rounded-xl p-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 transition"
                        >
                          <option value="all">{t('all')}</option>
                          {users.map((u: any) => <option key={u.id} value={u.id}>{u.nameEn} ({u.username})</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Action / Web Link URL */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{lang === 'ta' ? 'இணையதள இணைப்பு (Action Link URL - விருப்பத்தேர்வு)' : 'Action Link URL (Optional Web Link)'}</span>
                    </label>
                    <input
                      type="url"
                      value={notifActionUrl}
                      onChange={(e) => setNotifActionUrl(e.target.value)}
                      placeholder="https://example.gov.in/portal/circulars/..."
                      className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingAttachment}
                    className="w-full py-3.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{t('broadcastBtn')}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Notification list/history */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm">{t('historyTitle')}</h3>
                  <span className="ml-auto bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {notificationsList.length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[500px] flex-1 pr-1 scrollbar-custom">
                  {notificationsList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      {t('noNotifs')}
                    </div>
                  ) : (
                    notificationsList.map((notif: any) => (
                      <div key={notif.id} className="p-4 border border-slate-100 hover:border-indigo-100 bg-slate-50/50 rounded-2xl space-y-2 relative group transition">
                        <button
                          onClick={() => handleDeleteNotification(notif.id)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="pr-6">
                          <h4 className="font-bold text-slate-800 text-xs">{notif.title}</h4>
                          <p className="text-slate-600 text-[11px] leading-relaxed mt-1">{notif.message}</p>
                        </div>

                        {notif.fileName && (
                          <div className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-xl px-2.5 py-1 w-max">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" />
                            <a href={notif.imageUrl || notif.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-indigo-600 hover:underline truncate max-w-[120px]">
                              {notif.fileName}
                            </a>
                          </div>
                        )}

                        {/* Filters list */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {notif.targetFilters?.zoneId !== 'all' && (
                            <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              Zone: {zones.find((z: any) => z.id === notif.targetFilters?.zoneId)?.nameEn || notif.targetFilters?.zoneId}
                            </span>
                          )}
                          {notif.targetFilters?.districtId !== 'all' && (
                            <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              Dist: {districts.find((d: any) => d.id === notif.targetFilters?.districtId)?.nameEn || notif.targetFilters?.districtId}
                            </span>
                          )}
                          {notif.targetFilters?.tpId !== 'all' && (
                            <span className="bg-slate-100 text-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              TP: {townPanchayats.find((tp: any) => tp.id === notif.targetFilters?.tpId)?.nameEn || notif.targetFilters?.tpId}
                            </span>
                          )}
                          {notif.targetFilters?.designationId !== 'all' && (
                            <span className="bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              {designations.find((d: any) => d.id === notif.targetFilters?.designationId)?.nameEn || notif.targetFilters?.designationId}
                            </span>
                          )}
                          {notif.targetFilters?.userId !== 'all' && (
                            <span className="bg-purple-50 text-purple-700 text-[9px] font-bold px-1.5 py-0.5 rounded">
                              User: {users.find((u: any) => u.id === notif.targetFilters?.userId)?.nameEn || notif.targetFilters?.userId}
                            </span>
                          )}
                        </div>

                        <div className="text-[9px] text-slate-400 font-medium">
                          {new Date(notif.createdAt).toLocaleDateString()} • {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="apkTab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* APK upload form */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm sm:text-base">{t('uploadApk')}</h3>
                    <p className="text-xs text-slate-500">Release new application updates and enforce immediate version upgrades.</p>
                  </div>
                </div>

                <form onSubmit={handleReleaseApk} className="space-y-4">
                  {apkSuccess && (
                    <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-semibold rounded-2xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span>New APK released successfully! Mobile devices will now trigger a force update.</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('verNameLabel')}</label>
                      <input
                        type="text"
                        required
                        value={versionName}
                        onChange={(e) => setVersionName(e.target.value)}
                        placeholder="e.g. 1.2.1"
                        className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-100 focus:border-rose-500 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('verCodeLabel')}</label>
                      <input
                        type="number"
                        required
                        value={versionCode}
                        onChange={(e) => setVersionCode(e.target.value)}
                        placeholder="e.g. 15"
                        className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-100 focus:border-rose-500 transition"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        {lang === 'ta' ? 'குறைந்தபட்ச வெர்ஷன் கோட்' : 'Min Required Code'}
                      </label>
                      <input
                        type="number"
                        value={minRequiredVersionCode}
                        onChange={(e) => setMinRequiredVersionCode(e.target.value)}
                        placeholder="e.g. 14 (Hard update threshold)"
                        className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-100 focus:border-rose-500 transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">APK File (.apk)</label>
                      <div className="relative">
                        <input
                          type="file"
                          id="apk_file_upload"
                          accept=".apk"
                          className="hidden"
                          onChange={handleUploadApkFile}
                        />
                        <label
                          htmlFor="apk_file_upload"
                          className="w-full border border-dashed border-purple-200 rounded-2xl p-3 text-xs flex items-center justify-center gap-2 cursor-pointer bg-slate-50 hover:bg-slate-100/50 transition font-bold text-rose-700"
                        >
                          <Upload className="w-4 h-4" />
                          <span>{uploadingApk ? 'Uploading APK...' : apkFileName || 'Upload APK File'}</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 bg-rose-50/40 p-4 rounded-2xl border border-rose-50/50 mt-4 md:mt-0">
                      <input
                        type="checkbox"
                        id="force_update_cb"
                        checked={forceUpdate}
                        onChange={(e) => setForceUpdate(e.target.checked)}
                        className="w-4.5 h-4.5 rounded text-rose-600 focus:ring-rose-500 border-slate-300"
                      />
                      <label htmlFor="force_update_cb" className="text-xs font-bold text-rose-900 cursor-pointer select-none">
                        {t('forceUpdateLabel')}
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{t('releaseNotesLabel')}</label>
                    <textarea
                      rows={3}
                      value={releaseNotes}
                      onChange={(e) => setReleaseNotes(e.target.value)}
                      placeholder="Specify release changes, optimization, bug fixes..."
                      className="w-full border border-purple-50 rounded-2xl p-3 text-xs outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-rose-100 focus:border-rose-500 transition resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={uploadingApk || !apkFileUrl}
                    className="w-full py-3.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 uppercase tracking-wide cursor-pointer"
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    <span>{t('uploadApkBtn')}</span>
                  </button>
                </form>
              </div>
            </div>

            {/* APK versions history */}
            <div className="space-y-6">
              <div className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm h-full flex flex-col">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
                  <Smartphone className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-slate-800 text-sm">{t('apkHistoryTitle')}</h3>
                  <span className="ml-auto bg-rose-50 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {apkVersionsList.length}
                  </span>
                </div>

                <div className="space-y-3 overflow-y-auto max-h-[500px] flex-1 pr-1 scrollbar-custom">
                  {apkVersionsList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      {t('noApks')}
                    </div>
                  ) : (
                    apkVersionsList.map((apk: any) => (
                      <div key={apk.id} className="p-4 border border-slate-100 hover:border-rose-100 bg-slate-50/50 rounded-2xl space-y-2 relative group transition">
                        <button
                          onClick={() => handleDeleteApk(apk.id)}
                          className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <div className="flex items-center gap-2">
                          <span className="bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            v{apk.versionName}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500">
                            Build: {apk.versionCode}
                          </span>
                          {apk.forceUpdate && (
                            <span className="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded-md tracking-wider uppercase">
                              FORCE
                            </span>
                          )}
                        </div>

                        {apk.releaseNotes && (
                          <p className="text-slate-600 text-[11px] leading-relaxed italic">{apk.releaseNotes}</p>
                        )}

                        <div className="flex items-center gap-2 pt-1">
                          <a
                            href={apk.apkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[10px] font-bold text-rose-600 hover:underline flex items-center gap-1 bg-white border border-slate-100 px-2.5 py-1 rounded-xl"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download APK</span>
                          </a>
                        </div>

                        <div className="text-[9px] text-slate-400 font-medium">
                          Released: {new Date(apk.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
