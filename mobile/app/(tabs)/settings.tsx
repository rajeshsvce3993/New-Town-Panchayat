import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  ToastAndroid,
  View,
} from 'react-native';
import { api, isRemotePhotoUrl, resolveProfilePhotoUrl } from '../../src/api/client';
import { HeaderBell } from '../../src/components/AppHeader';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { PhotoSourceDialog } from '../../src/components/PhotoSourceDialog';
import { APP_VERSION_CODE, APP_VERSION_NAME, PACKAGE_NAME } from '../../src/constants/config';
import { useApp } from '../../src/context/AppContext';
import { createNotificationChannel } from '../../src/services/notifications';
import { pickAndUploadProfile } from '../../src/services/profilePhoto';
import { prefs, profilePhotoFile } from '../../src/storage/preferences';
import { palettes } from '../../src/theme/palettes';
import { designationNameEn, effectivePhotoUrl, effectiveSubjectIds, effectiveWards } from '../../src/types/models';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}


const TONE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  default: 'volume-high',
  high_alert: 'alert',
  chime: 'musical-notes',
  gentle: 'volume-low',
  vibrate: 'phone-portrait',
};

export default function SettingsScreen() {
  const { user, palette, isTamil, setLanguage, setThemeId, logout, updateUserPhoto, appIcon } = useApp();
  const insets = useSafeAreaInsets();
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;
  const [photo, setPhoto] = useState<string | null>(effectivePhotoUrl(user));
  const [photoDlg, setPhotoDlg] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<string | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');
  const [showCur, setShowCur] = useState(false);
  const [showNw, setShowNw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [pwErr, setPwErr] = useState<string | null>(null);
  const [pwBusy, setPwBusy] = useState(false);
  const [tone, setTone] = useState('default');
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    (async () => {
      setTone((await prefs.getTone()) || 'default');
      const remote = effectivePhotoUrl(user);
      if (isRemotePhotoUrl(remote)) {
        setPhoto(remote);
        return;
      }
      try {
        const local = profilePhotoFile();
        const info = await FileSystem.getInfoAsync(local);
        if (info.exists) {
          setPhoto(local);
          return;
        }
      } catch {
        /* */
      }
      setPhoto(remote);
    })();
  }, [user]);

  const tones = [
    ['default', isTamil ? 'இயல்புநிலை ஒலி' : 'Default Sound', isTamil ? 'நிலையான கணினி அறிவிப்பு ஒலி' : 'Standard system notification alert'],
    ['high_alert', isTamil ? 'உயர் எச்சரிக்கை (முக்கியம்)' : 'High Alert (Urgent)', isTamil ? 'தொடர் அதிர்வு மற்றும் உடனடி ஒலி' : 'Urgent repetitive pulse & priority sound'],
    ['chime', isTamil ? 'மணி ஒலி (Chime)' : 'Chime Tone', isTamil ? 'இனிமையான மணி ஒலி அறிவிப்பு' : 'Gentle bell chime alert'],
    ['gentle', isTamil ? 'மென்மையான ஒலி' : 'Gentle Tone', isTamil ? 'குறைந்த தொந்தரவு கொண்ட மென்மையான ஒலி' : 'Subtle unobtrusive notification'],
    ['vibrate', isTamil ? 'அதிர்வு மட்டும்' : 'Vibrate Only', isTamil ? 'சத்தமின்றி அதிர்வு மட்டும் செயல்படும்' : 'Silent with vibration pulse only'],
  ] as const;

  const photoUri = resolveProfilePhotoUrl(photo);
  const wards = effectiveWards(user);
  const subjects = user?.assignedSubjectNames?.length ? user.assignedSubjectNames : effectiveSubjectIds(user);
  const desig = isTamil ? user?.designationNameTa || user?.designation : designationNameEn(user) || user?.designation;
  const versionName = Application.nativeApplicationVersion || APP_VERSION_NAME;
  const versionCode = Application.nativeBuildVersion || String(APP_VERSION_CODE);
  const pkg = Application.applicationId || PACKAGE_NAME;
  const rows: (typeof palettes)[] = [];
  for (let i = 0; i < palettes.length; i += 3) rows.push(palettes.slice(i, i + 3));

  const onPickPhoto = async (src: 'camera' | 'gallery') => {
    setPhotoDlg(false);
    setUploading(true);
    setPhotoMsg(isTamil ? 'புகைப்படம் சுருக்கப்பட்டு S3-ல் பதிவேற்றப்படுகிறது...' : 'Compressing and uploading profile photo to AWS S3...');
    const r = await pickAndUploadProfile(src, user?.id || 'officer', user?.username || 'officer');
    setUploading(false);
    if (r) {
      setPhoto(r.remote);
      await updateUserPhoto(r.remote);
      setPhotoMsg(isTamil ? 'சுயவிவரப் படம் வெற்றிகரமாக சேமிக்கப்பட்டது!' : 'Profile photo updated successfully!');
    } else {
      setPhotoMsg(isTamil ? 'புகைப்படம் பதிவேற்ற முடியவில்லை' : 'Failed to upload photo');
    }
  };

  const pwField = (
    value: string,
    set: (v: string) => void,
    visible: boolean,
    setVisible: (v: boolean) => void,
    label: string,
    placeholder: string,
    lead: keyof typeof Ionicons.glyphMap
  ) => (
    <View>
      <Text style={styles.pwLabel}>{label}</Text>
      <View style={styles.pwRow}>
        <Ionicons name={lead} size={18} color={palette.primary} />
        <TextInput
          value={value}
          onChangeText={(t) => {
            set(t);
            setPwErr(null);
          }}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={!visible}
          style={styles.pwInput}
        />
        <Pressable onPress={() => setVisible(!visible)}>
          <Ionicons name={visible ? 'eye' : 'eye-off'} size={18} color="#64748B" />
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#F3F4F8' }}>
      <LinearGradient
        colors={['#0B1220', palette.primary, heroEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 10 }]}
      >
        <View style={styles.heroTop}>
          <HeaderBrand />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.kicker}>{isTamil ? 'கணக்கு' : 'ACCOUNT'}</Text>
            <Text style={styles.heroTitle}>{isTamil ? 'அமைப்புகள்' : 'Settings'}</Text>
          </View>
          <HeaderBell />
        </View>
      </LinearGradient>
    <ScrollView style={{ flex: 1, marginTop: -14 }} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 40 }}>
      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => setPhotoDlg(true)} style={{ width: 44, height: 44 }}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={[styles.av, { borderColor: palette.primary }]}
                onError={() => {
                  if (isRemotePhotoUrl(photo)) setPhoto(profilePhotoFile());
                  else setPhoto(null);
                }}
              />
            ) : (
              <View style={[styles.av, { backgroundColor: palette.primaryContainer, borderColor: palette.primary, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="person" size={18} color={palette.primary} />
              </View>
            )}
            {uploading && (
              <View style={styles.avMask}>
                <ActivityIndicator color="#fff" />
              </View>
            )}
            <View style={[styles.camBadge, { backgroundColor: palette.primary }]}>
              <Ionicons name="camera" size={9} color="#fff" />
            </View>
          </Pressable>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={{ fontWeight: '800', fontSize: 14, color: '#0F172A' }}>{user?.name || 'Officer'}</Text>
            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }} numberOfLines={1}>
              {user?.role}{user?.mobile ? `  ·  ${user.mobile}` : ''}
            </Text>
            {!!photoMsg && (
              <Text style={{ fontSize: 10, marginTop: 2, fontWeight: '500', color: /வெற்றி|successfully/i.test(photoMsg) ? '#16A34A' : '#EA580C' }}>
                {photoMsg}
              </Text>
            )}
          </View>
        </View>
        <View style={styles.detailGrid}>
          <View style={styles.detailCol}>
            <Text style={styles.miniLbl}>{isTamil ? 'பேரூராட்சி' : 'TP'}</Text>
            <Text style={styles.miniVal} numberOfLines={2}>{user?.townPanchayat || '—'}</Text>
          </View>
          <View style={styles.detailCol}>
            <Text style={styles.miniLbl}>{isTamil ? 'வார்டுகள்' : 'Wards'}</Text>
            <Text style={styles.miniVal} numberOfLines={2}>{!wards.length ? (isTamil ? 'அனைத்தும்' : 'All') : wards.join(', ')}</Text>
          </View>
          <View style={[styles.detailCol, { borderRightWidth: 0 }]}>
            <Text style={styles.miniLbl}>{isTamil ? 'பதவி' : 'Role'}</Text>
            <Text style={styles.miniVal} numberOfLines={2}>{desig || user?.role || '—'}</Text>
          </View>
        </View>
        {!!subjects.length && (
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 8 }} numberOfLines={2}>
            {isTamil ? 'பொருட்கள்' : 'Subjects'}: {subjects.join(', ')}
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
              <Ionicons name="trash-outline" size={15} color={palette.primary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cardTitle}>{isTamil ? 'ஒத்திசைவு நினைவகம்' : 'Clear synced cache'}</Text>
              <Text style={styles.cardSub}>{isTamil ? 'ஒத்திசைக்கப்பட்ட புகைப்படங்களை நீக்கு' : 'Remove local photos of synced works'}</Text>
            </View>
          </View>
          <Pressable
            style={[styles.smallBtn, { backgroundColor: palette.primary }]}
            onPress={async () => {
              const active = new Set<string>();
              (await prefs.getOfflineWorks()).forEach((w) => {
                if (w.imageUrl) active.add(w.imageUrl);
                Object.values(w.fieldsData).forEach((v) => active.add(String(v)));
              });
              const dir = `${FileSystem.documentDirectory}offline_images`;
              let deleted = 0;
              try {
                const files = await FileSystem.readDirectoryAsync(dir);
                for (const f of files) {
                  const p = `${dir}/${f}`;
                  if (!active.has(p)) {
                    await FileSystem.deleteAsync(p, { idempotent: true });
                    deleted++;
                  }
                }
              } catch {
                /* */
              }
              toast(isTamil ? `ஒத்திசைக்கப்பட்ட பணி நினைவகம் வெற்றிகரமாக நீக்கப்பட்டது (${deleted} கோப்புகள்)` : `Synced entry cache cleared successfully! (${deleted} files deleted)`);
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'நீக்கு' : 'Clear'}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Pressable
          onPress={() => {
            setPwOpen((o) => !o);
            setPwErr(null);
          }}
          style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
              <Ionicons name="lock-closed-outline" size={15} color={palette.primary} />
            </View>
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={styles.cardTitle}>{isTamil ? 'கடவுச்சொல் மாற்று' : 'Change password'}</Text>
              <Text style={styles.cardSub}>{isTamil ? 'கணக்கு உள்நுழைவைப் புதுப்பிக்கவும்' : 'Update your login password'}</Text>
            </View>
          </View>
          <Ionicons name={pwOpen ? 'chevron-up' : 'chevron-down'} color={palette.primary} size={22} />
        </Pressable>
        {pwOpen && (
          <View style={{ marginTop: 16, gap: 12 }}>
            <View style={styles.hr} />
            {pwField(cur, setCur, showCur, setShowCur, isTamil ? 'தற்போதைய கடவுச்சொல்' : 'Current Password', isTamil ? 'தற்போதைய கடவுச்சொல்லை உள்ளிடவும்' : 'Enter current password', 'lock-open')}
            {pwField(nw, setNw, showNw, setShowNw, isTamil ? 'புதிய கடவுச்சொல் (குறைந்தது 6 எழுத்துகள்)' : 'New Password (min 6 chars)', isTamil ? 'புதிய கடவுச்சொல்லை உள்ளிடவும்' : 'Enter new password', 'key')}
            {pwField(cf, setCf, showCf, setShowCf, isTamil ? 'புதிய கடவுச்சொல்லை உறுதிசெய்க' : 'Confirm New Password', isTamil ? 'மீண்டும் புதிய கடவுச்சொல்லை உள்ளிடவும்' : 'Re-enter new password', 'shield-checkmark')}
            {!!pwErr && (
              <View style={styles.errBox}>
                <Ionicons name="alert-circle" size={18} color="#DC2626" />
                <Text style={{ color: '#DC2626', fontSize: 11, fontWeight: '500', flex: 1, marginLeft: 8 }}>{pwErr}</Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Pressable
                style={styles.cancelBtn}
                disabled={pwBusy}
                onPress={() => {
                  setCur('');
                  setNw('');
                  setCf('');
                  setPwErr(null);
                  setPwOpen(false);
                }}
              >
                <Text style={{ fontSize: 12 }}>{isTamil ? 'ரத்து செய்' : 'Cancel'}</Text>
              </Pressable>
              <Pressable
                style={[styles.smallBtn, { backgroundColor: palette.primary, flex: 1, height: 44, alignItems: 'center', justifyContent: 'center' }]}
                disabled={pwBusy}
                onPress={async () => {
                  if (!cur) return setPwErr(isTamil ? 'தற்போதைய கடவுச்சொல்லை உள்ளிடவும்' : 'Please enter your current password');
                  if (!nw) return setPwErr(isTamil ? 'புதிய கடவுச்சொல்லை உள்ளிடவும்' : 'Please enter a new password');
                  if (nw.length < 6) return setPwErr(isTamil ? 'புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துகள் கொண்டிருக்க வேண்டும்' : 'New password must be at least 6 characters');
                  if (nw !== cf) return setPwErr(isTamil ? 'புதிய கடவுச்சொற்கள் பொருந்தவில்லை' : 'New passwords do not match');
                  if (cur === nw) return setPwErr(isTamil ? 'புதிய கடவுச்சொல் தற்போதைய கடவுச்சொல்லில் இருந்து மாறுபட்டிருக்க வேண்டும்' : 'New password must be different from current password');
                  const username = user?.username || user?.id || (await prefs.getSavedUsername()) || '';
                  if (!username) return setPwErr(isTamil ? 'பயனர் அடையாளம் கிடைக்கவில்லை' : 'User identification not found');
                  setPwBusy(true);
                  const res = await api.changePassword(username, cur, nw);
                  setPwBusy(false);
                  if (res.success) {
                    if (await prefs.getSavedPassword()) await prefs.setSavedPassword(nw);
                    setCur('');
                    setNw('');
                    setCf('');
                    setPwOpen(false);
                    Alert.alert(
                      isTamil ? 'கடவுச்சொல் மாற்றப்பட்டது!' : 'Password Changed Successfully!',
                      isTamil
                        ? 'உங்கள் ஆய்வு கணக்கின் கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது. அடுத்த முறை உள்நுழையும்போது புதிய கடவுச்சொல்லைப் பயன்படுத்தவும்.'
                        : 'Your inspection account password has been updated successfully. Please use your new password for your next login.'
                    );
                  } else setPwErr(res.message || (isTamil ? 'கடவுச்சொல் மாற்றுவதில் பிழை' : 'Failed to change password'));
                }}
              >
                {pwBusy ? (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'புதுப்பிக்கப்படுகிறது...' : 'Updating...'}</Text>
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'கடவுச்சொல்லை மாற்று' : 'Update Password'}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.sectionHead}>
          <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
            <Ionicons name="color-palette-outline" size={15} color={palette.primary} />
          </View>
          <Text style={styles.cardTitle}>{isTamil ? 'வண்ணத் தீம்' : 'Theme colour'}</Text>
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {row.map((p) => {
              const sel = p.id === palette.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => void setThemeId(p.id)}
                  style={[styles.theme, { flex: 1, borderColor: sel ? p.primary : '#E2E8F0', borderWidth: sel ? 2 : 1, backgroundColor: sel ? p.primaryContainer : '#F1F5F9' }]}
                >
                  <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: p.primary, alignSelf: 'center' }} />
                  <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 6, fontWeight: sel ? '700' : '500', color: sel ? p.secondary : '#334155' }} numberOfLines={1}>
                    {isTamil ? p.nameTa : p.nameEn}
                  </Text>
                </Pressable>
              );
            })}
            {row.length < 3 && Array.from({ length: 3 - row.length }).map((_, i) => <View key={`pad-${i}`} style={{ flex: 1 }} />)}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
            <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
              <Ionicons name="language-outline" size={15} color={palette.primary} />
            </View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.cardTitle}>{isTamil ? 'மொழி' : 'Language'}</Text>
              <Text style={styles.cardSub}>{isTamil ? 'தமிழ் இயக்கத்தில்' : 'English active'}</Text>
            </View>
          </View>
          <Switch value={isTamil} onValueChange={(v) => void setLanguage(v)} trackColor={{ true: palette.primaryContainer }} thumbColor={isTamil ? palette.primary : undefined} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
            <Ionicons name="notifications-outline" size={15} color={palette.primary} />
          </View>
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={styles.cardTitle}>{isTamil ? 'அறிவிப்பு ஒலி' : 'Notification tone'}</Text>
            <Text style={styles.cardSub}>{isTamil ? 'சுற்றறிக்கை எச்சரிக்கை ஒலி' : 'Tone for circulars and notices'}</Text>
          </View>
        </View>
        <View style={{ marginTop: 14, gap: 8 }}>
          {tones.map(([k, title, desc]) => {
            const sel = tone === k;
            return (
              <Pressable
                key={k}
                style={[styles.tone, sel && { borderColor: palette.primary, borderWidth: 1.5, backgroundColor: palette.primaryContainer + '80' }]}
                onPress={async () => {
                  setTone(k);
                  await prefs.setTone(k);
                  await createNotificationChannel(k);
                  toast(isTamil ? `${title} தேர்ந்தெடுக்கப்பட்டது` : `${title} selected`);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={[styles.radio, sel && { borderColor: palette.primary, borderWidth: 5 }]} />
                  <View style={{ marginLeft: 8, flex: 1 }}>
                    <Text style={{ fontWeight: sel ? '700' : '500', fontSize: 12, color: sel ? palette.secondary : '#1E293B' }}>{title}</Text>
                    <Text style={{ fontSize: 10, color: '#64748B' }}>{desc}</Text>
                  </View>
                </View>
                <Ionicons name={TONE_ICON[k] || 'volume-high'} size={18} color={sel ? palette.primary : '#94A3B8'} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
            <Ionicons name="information-circle-outline" size={15} color={palette.primary} />
          </View>
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.cardTitle}>{isTamil ? 'பயன்பாட்டு பதிப்பு' : 'App version'}</Text>
            <Text style={styles.cardSub}>{isTamil ? 'நிறுவப்பட்ட பதிப்பு விவரம்' : 'Installed build details'}</Text>
          </View>
        </View>
        <View style={styles.verBox}>
          <View style={styles.verRow}>
            <Text style={styles.verK}>{isTamil ? 'பதிப்பு பெயர் (Version Name)' : 'Version Name'}</Text>
            <View style={{ backgroundColor: palette.primaryContainer, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: palette.primary }}>v{versionName}</Text>
            </View>
          </View>
          <View style={styles.verRow}>
            <Text style={styles.verK}>{isTamil ? 'பதிப்பு எண் (Version Code)' : 'Version Code'}</Text>
            <View style={{ backgroundColor: '#E2E8F0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: '#1E293B' }}>Build {versionCode}</Text>
            </View>
          </View>
          <View style={styles.verRow}>
            <Text style={styles.verK}>{isTamil ? 'தொகுப்பு பெயர் (Package)' : 'Package Name'}</Text>
            <Text style={{ fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: '#475569' }}>{pkg}</Text>
          </View>
        </View>
      </View>

      <Pressable
        style={styles.logout}
        disabled={loggingOut}
        onPress={() => {
          setLoggingOut(true);
          void logout();
        }}
      >
        {loggingOut ? (
          <ActivityIndicator color="#DC2626" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={18} color="#DC2626" />
            <Text style={{ color: '#DC2626', fontWeight: '700', fontSize: 13, marginLeft: 8 }}>{isTamil ? 'வெளியேறு' : 'Sign out'}</Text>
          </>
        )}
      </Pressable>
      <Text style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8' }}>Town Panchayats Management System</Text>

      <PhotoSourceDialog
        visible={photoDlg}
        isTamil={isTamil}
        palette={palette}
        onClose={() => setPhotoDlg(false)}
        onCamera={() => void onPickPhoto('camera')}
        onGallery={() => void onPickPhoto('gallery')}
      />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E8EEF4' },
  av: { width: 44, height: 44, borderRadius: 12, borderWidth: 1.5 },
  avMask: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  camBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  hr: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  detailGrid: { flexDirection: 'row', marginTop: 10, borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 8 },
  detailCol: { flex: 1, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#EEF2F7' },
  miniLbl: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  miniVal: { fontSize: 11, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  cardTitle: { fontWeight: '700', fontSize: 13, color: '#0F172A' },
  cardSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  smallBtn: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  pwLabel: { fontSize: 12, color: '#475569', marginBottom: 4 },
  pwRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8EEF4', borderRadius: 12, paddingHorizontal: 10, backgroundColor: '#F8FAFC' },
  pwInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, color: '#0F172A' },
  errBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#E8EEF4', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  theme: { borderRadius: 12, paddingVertical: 10, paddingHorizontal: 8 },
  tone: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E8EEF4', borderRadius: 12, padding: 10, backgroundColor: '#F8FAFC' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: '#CBD5E1' },
  verBox: { marginTop: 12, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E8EEF4', padding: 12, gap: 8 },
  verRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  verK: { fontSize: 12, color: '#64748B' },
  logout: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
});
