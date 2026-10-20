import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { api } from '../../src/api/client';
import { HeaderBell } from '../../src/components/AppHeader';
import {
  FormPhotoField,
  FormPickerSheet,
  FormSelectTrigger,
  FormTextField,
  type FormPickerState,
} from '../../src/components/FormControls';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { FALLBACK_STREETS_EN, FALLBACK_STREETS_TA, SAMPLE_PHOTO } from '../../src/constants/config';
import { useApp } from '../../src/context/AppContext';
import { showInspectionNotification } from '../../src/services/notifications';
import { syncPendingWorks } from '../../src/services/queueSync';
import { prefs } from '../../src/storage/preferences';
import type { Category, FieldDefinition, InspectionWork, QueuedWorkEntry, Subject } from '../../src/types/models';
import { QUEUE_STATUS, effectiveCategoryIds, effectiveSubjectIds, effectiveWards, portalCategories, portalFields, portalSubjects, portalWorks } from '../../src/types/models';
import { fieldKey, isCameraField, visibleDynamicFields } from '../../src/utils/fieldVisibility';
import { compressImageLocally, ensureDir } from '../../src/utils/imageCompression';
import {
  cleanLocalPhotoUris,
  persistPhotosInParallel,
  persistPhotosLocalOnly,
  uniquePhotoFileName,
  workHasLocalPhotos,
} from '../../src/utils/photoPersist';
import { now12Hr } from '../../src/utils/dates';
import { validateVisibleFields } from '../../src/utils/validateFields';
import { matchesTp, normalizeWard, resolveUserTpId } from '../../src/utils/wards';
import { nextWorkId } from '../../src/utils/workId';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

export default function AddWorkScreen() {
  const { user, palette, isTamil, portal, setWorks, refreshPortal, appIcon } = useApp();
  const insets = useSafeAreaInsets();
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;
  const [step, setStep] = useState(1);
  const [subjectId, setSubjectId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [ward, setWard] = useState('1');
  const [street, setStreet] = useState('Anna Street');
  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [primaryPhoto, setPrimaryPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [lat, setLat] = useState(12.7244);
  const [lng, setLng] = useState(80.1873);
  const [gpsOk, setGpsOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastId, setLastId] = useState('');
  const [scopeMissing, setScopeMissing] = useState(false);
  const [dlScope, setDlScope] = useState(false);
  const [picker, setPicker] = useState<FormPickerState>(null);
  const [dateField, setDateField] = useState<string | null>(null);

  const subjects: Subject[] = useMemo(() => {
    const all = portalSubjects(portal);
    const ids = effectiveSubjectIds(user);
    if (ids.length) {
      const f = all.filter((s) => ids.includes(s.id));
      return f.length ? f : all;
    }
    return all;
  }, [portal, user]);

  const categories: Category[] = useMemo(() => {
    const all = portalCategories(portal);
    const matched = subjects.find((s) => s.id === subjectId);
    const target = (matched?.id || subjectId).toLowerCase();
    const code = (matched?.code || '').toLowerCase();
    let subjectCats = all.filter((c) => {
      const cs = (c.subjectId || '').toLowerCase();
      return cs === target || (code && cs === code) || (code && cs.includes(code)) || (target && cs.includes(target));
    });
    const catIds = effectiveCategoryIds(user);
    if (catIds.length) {
      const assigned = subjectCats.filter((cat) =>
        catIds.some((u) => cat.id.toLowerCase() === u.toLowerCase() || cat.nameEn.toLowerCase() === u.toLowerCase())
      );
      if (assigned.length) subjectCats = assigned;
    }
    return subjectCats.length ? subjectCats : all;
  }, [portal, user, subjectId, subjects]);

  const userTpId = resolveUserTpId(user, portal.townPanchayats || [], undefined);
  const streetsDb = portal.wardsAndStreets || [];
  const wards = useMemo(() => {
    const mongo = streetsDb
      .filter((w) => matchesTp(w, user, userTpId, portal.townPanchayats || []))
      .map((w) => normalizeWard(w.wardNo))
      .filter((w) => w && w !== '0');
    const userW = effectiveWards(user).map(normalizeWard).filter((w) => w && w !== '0');
    const combined = [...new Set([...userW, ...mongo])].sort((a, b) => Number(a) - Number(b));
    if (combined.length) return combined;
    if ((user?.role || '').toLowerCase().includes('admin')) return Array.from({ length: 18 }, (_, i) => String(i + 1));
    return [];
  }, [streetsDb, user, userTpId, portal.townPanchayats]);

  const streets = useMemo(() => {
    const norm = normalizeWard(ward);
    const filtered = streetsDb
      .filter((ws) => normalizeWard(ws.wardNo) === norm && matchesTp(ws, user, userTpId, portal.townPanchayats || []))
      .map((ws) => (isTamil ? ws.streetNameTa || ws.streetNameEn : ws.streetNameEn))
      .filter(Boolean);
    const uniq = [...new Set(filtered)].sort();
    if (uniq.length) return uniq;
    return isTamil ? FALLBACK_STREETS_TA : FALLBACK_STREETS_EN;
  }, [streetsDb, ward, isTamil, user, userTpId, portal.townPanchayats]);

  const dynFields = useMemo(
    () => portalFields(portal).filter((f) => f.categoryId === categoryId),
    [portal, categoryId]
  );
  const visible = useMemo(() => visibleDynamicFields(dynFields, values), [dynFields, values]);

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id || '');
  }, [categories, categoryId]);
  useEffect(() => {
    if (!wards.includes(ward) && wards[0]) setWard(wards[0]);
  }, [wards, ward]);
  useEffect(() => {
    setStreet(streets[0] || (isTamil ? 'அண்ணா தெரு' : 'Anna Street'));
  }, [ward, streets, isTamil]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2) {
        setStep(1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  useEffect(() => {
    (async () => {
      const has = await prefs.hasDownloadedScope(user, await prefs.getUserScope(), portal);
      setScopeMissing(!has && (!subjects.length || !wards.length));
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast(isTamil ? 'GPS அனுமதி தேவை' : 'GPS location permission is required');
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLat(Math.round(loc.coords.latitude * 1e6) / 1e6);
      setLng(Math.round(loc.coords.longitude * 1e6) / 1e6);
      setGpsOk(true);
      toast(
        isTamil
          ? `GPS அமைவிடம் பெறப்பட்டது (±${Math.round((loc.coords.accuracy || 0) * 10) / 10}m): ${lat}, ${lng}`
          : `GPS location acquired (±${Math.round((loc.coords.accuracy || 0) * 10) / 10}m)`
      );
    })();
  }, []);

  const capture = async (key?: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      toast(isTamil ? 'கேமரா அனுமதி தேவை' : 'Camera permission is required to capture evidence');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.75, exif: false });
    if (res.canceled || !res.assets[0]) return;
    const raw = res.assets[0].uri;
    const compressed = await compressImageLocally(raw, uniquePhotoFileName(key || 'primary'));
    const uri = compressed || raw;
    if (key) {
      setPhotos((p) => ({ ...p, [key]: uri }));
      setValues((v) => ({ ...v, [key]: `captured_photo_${key}_${Date.now()}.jpg` }));
    } else setPrimaryPhoto(uri);
    toast(isTamil ? 'புகைப்படம் வெற்றிகரமாக எடுக்கப்பட்டது!' : 'High quality photo captured successfully!');
  };

  const pickFile = async (key: string) => {
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    setValues((v) => ({ ...v, [key]: res.assets[0].name }));
    toast(isTamil ? 'கோப்பு தேர்ந்தெடுக்கப்பட்டது!' : 'File selected successfully!');
  };

  const submit = async () => {
    const hasScope = await prefs.hasDownloadedScope(user, await prefs.getUserScope(), portal);
    if (!hasScope || !subjects.length || !wards.length) {
      toast(
        isTamil
          ? 'பிழை: உங்கள் கணக்கிற்கான ஆய்வு வரம்பு (Scope) இன்னும் பதிவிறக்கப்படவில்லை. பொதுவான ஆய்வு (Fallback Scope) அனுமதிக்கப்படாது!'
          : 'Error: No assigned inspection scope downloaded. General inspection fallback is disabled!'
      );
      return;
    }
    const locPerm = await Location.getForegroundPermissionsAsync();
    if (locPerm.status !== 'granted') {
      toast(isTamil ? 'பிழை: ஜிபிஎஸ் அனுமதி வழங்கப்படவில்லை!' : 'Error: GPS location permission is not granted!');
      return;
    }
    const enabled = await Location.hasServicesEnabledAsync();
    if (!enabled) {
      toast(isTamil ? 'பிழை: உங்கள் சாதனத்தின் ஜிபிஎஸ் முடக்கப்பட்டுள்ளது!' : "Error: Your device's GPS is turned off! Please enable it.");
      return;
    }
    if (!gpsOk) {
      toast(isTamil ? 'பிழை: நேரடி ஜிபிஎஸ் இருப்பிடத்தை இன்னும் பெற முடியவில்லை!' : 'Error: Could not acquire live GPS coordinates yet!');
      return;
    }
    const scope = await prefs.getUserScope();
    const err = validateVisibleFields({
      fields: visible,
      values: { ...values, ...Object.fromEntries(Object.entries(photos).map(([k, u]) => [k, u])) },
      rules: scope?.validationRules,
      isTamil,
      works: portalWorks(portal),
      categoryId,
    });
    if (err) {
      toast(err);
      return;
    }
    setSubmitting(true);
    const subject = subjects.find((s) => s.id === subjectId);
    const category = categories.find((c) => c.id === categoryId);
    const ids = nextWorkId(user, portal, ward);
    let actualWorkId = ids.workId;
    const zoneName = user?.zone || 'Kanchipuram';
    const districtName = user?.district || 'Chengalpattu';
    const tpName = user?.townPanchayat || 'Thiruporur';
    const fieldCopy = { ...values };
    let s3 = SAMPLE_PHOTO;
    const clientWorkId = `work_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    const offlineDir = `${FileSystem.documentDirectory}offline_images/${clientWorkId}`;
    await ensureDir(offlineDir);
    const photoMeta = {
      workId: actualWorkId,
      userId: user?.id || user?.username,
      username: user?.username,
      zone: zoneName,
      district: districtName,
      tp: tpName,
    };

    const photoJobs = Object.entries(photos).map(([k, uri]) => ({ key: k, uri }));
    if (primaryPhoto) photoJobs.push({ key: '__primary__', uri: primaryPhoto });
    const reachable = await api.isReachable();
    if (photoJobs.length > 1 && reachable) {
      toast(isTamil ? `${photoJobs.length} புகைப்படங்கள் ஒரே நேரத்தில் பதிவேற்றப்படுகின்றன...` : `Uploading ${photoJobs.length} photos together...`);
    }
    if (photoJobs.length) {
      const uploaded = reachable
        ? await persistPhotosInParallel(photoJobs, offlineDir, photoMeta)
        : await persistPhotosLocalOnly(photoJobs, offlineDir);
      for (const [k, url] of Object.entries(uploaded)) {
        if (k === '__primary__') continue;
        fieldCopy[k] = url;
        if (s3 === SAMPLE_PHOTO) s3 = url;
      }
      if (uploaded.__primary__) s3 = uploaded.__primary__;
    }

    const newWork: InspectionWork = {
      id: clientWorkId,
      workId: actualWorkId,
      districtCode: ids.distCode,
      tpCode: ids.townCode,
      subjectId,
      subjectNameEn: subject?.nameEn || 'General Inspection',
      subjectNameTa: subject?.nameTa || 'பொது ஆய்வு',
      categoryId,
      categoryNameEn: category?.nameEn || 'Field Check',
      categoryNameTa: category?.nameTa || 'கள ஆய்வு',
      tpNameEn: tpName,
      tpNameTa: user?.townPanchayatTa || 'திருப்போரூர் பேரூராட்சி',
      zoneNameEn: zoneName,
      zoneNameTa: user?.zoneTa || 'காஞ்சிபுரம் மண்டலம்',
      districtNameEn: districtName,
      districtNameTa: user?.districtTa || 'செங்கல்பட்டு மாவட்டம்',
      wardNumber: ward,
      streetName: street,
      latitude: lat,
      longitude: lng,
      fieldsData: fieldCopy,
      imageUrl: s3,
      imageCaption: caption || `Field verification confirmed at Ward ${ward} ${street}.`,
      submittedAt: now12Hr(),
      submittedByUserName: user?.name || user?.username || 'Field Inspector',
      submittedByUserId: user?.id || user?.username || '',
      status: 'Completed',
    };

    const firstLocal =
      [s3, ...Object.values(fieldCopy).map((v) => String(v || ''))].find((u) => typeof u === 'string' && !u.startsWith('http') && !u.startsWith('data:')) ||
      null;
    const entry: QueuedWorkEntry = {
      clientTaskId: clientWorkId,
      work: { ...newWork, workId: '' },
      localPhotoPath: firstLocal,
      status: QUEUE_STATUS.IN_QUEUE,
      progress: 10,
      attemptCount: 0,
      createdAt: Date.now(),
    };

    let finalWork = newWork;
    let online = false;
    try {
      if (reachable && !workHasLocalPhotos(newWork)) {
        const res = await api.submitInspectionWork(newWork);
        if (res.success && res.work) {
          finalWork = res.work;
          actualWorkId = res.work.workId;
          online = true;
        }
      }
    } catch {
      /* offline */
    }
    if (online) {
      await cleanLocalPhotoUris([primaryPhoto, s3, ...Object.values(photos), ...Object.values(fieldCopy).map((v) => String(v || ''))]);
      try {
        await refreshPortal();
      } catch {
        /* keep submitted work in memory */
      }
    } else {
      await prefs.enqueueWork(entry);
      const off = { ...newWork, workId: '' };
      await prefs.upsertOfflineWork(off);
      finalWork = off;
      actualWorkId = '';
      if (reachable) void syncPendingWorks();
    }
    setWorks((w) => [finalWork, ...w.filter((x) => x.id !== finalWork.id)]);
    setLastId(actualWorkId);
    setSubmitting(false);
    setSuccess(true);
    await showInspectionNotification(actualWorkId, subject?.nameEn || 'Field Work', isTamil);
  };

  const resetFields = (toStep: number) => {
    setValues({});
    setPhotos({});
    setPrimaryPhoto(null);
    setCaption('');
    setSuccess(false);
    setStep(toStep);
  };

  const dropdown = (
    label: string,
    value: string,
    options: { id: string; label: string }[],
    onPick: (id: string) => void,
    key: string
  ) => {
    const display = options.find((o) => o.id === value)?.label || value;
    const placeholder = isTamil ? 'தேர்வு செய்யவும்' : 'Tap to choose';
    return (
      <FormSelectTrigger
        key={key}
        label={label}
        display={display}
        placeholder={placeholder}
        primary={palette.primary}
        onPress={() => setPicker({ title: label, value, options, onPick })}
      />
    );
  };

  const fieldLabel = (f: FieldDefinition) => {
    const k = fieldKey(f);
    const raw = (isTamil ? f.fieldNameTa || f.nameTa || k : f.nameEn || k).replace(/\s*\*\s*$/, '');
    const mandatory = !!(f.isRequired || f.isMandatory);
    return mandatory ? `${raw} *` : raw;
  };

  const renderField = (f: FieldDefinition) => {
    const k = fieldKey(f);
    const type = (f.fieldType || f.type || 'text').toLowerCase();
    const label = fieldLabel(f);
    const currentVal = values[k] || '';
    if (isCameraField(f)) {
      return (
        <FormPhotoField
          key={k}
          label={label}
          uri={photos[k] || null}
          primary={palette.primary}
          onPress={() => void capture(k)}
          emptyTitle={isTamil ? 'புகைப்படம் எடுக்கவும்' : 'Take photo'}
          emptySubtitle={isTamil ? 'தெளிவான காட்சி புகைப்படம் எடுக்கவும்' : 'Capture a clear view of the site'}
          capturedBadge={isTamil ? 'புகைப்படம் சேர்க்கப்பட்டது' : 'Photo added'}
          retakeLabel={isTamil ? 'மீண்டும் எடு' : 'Retake'}
          ctaLabel={isTamil ? 'கேமரா திற' : 'Open camera'}
        />
      );
    }
    if (type.includes('yes') || type.includes('boolean')) {
      const yesText = isTamil ? 'ஆம்' : 'Yes';
      const noText = isTamil ? 'இல்லை' : 'No';
      return (
        <View key={k} style={styles.ynBlock}>
          <Text style={styles.lbl}>{label}</Text>
          <View style={styles.ynRow}>
            <Pressable
              style={[styles.yn, { backgroundColor: currentVal === yesText ? palette.primary : '#F1F5F9', borderColor: currentVal === yesText ? palette.primary : '#D0D5DD' }]}
              onPress={() => setValues((v) => ({ ...v, [k]: yesText }))}
            >
              <Text style={[styles.ynText, { color: currentVal === yesText ? '#fff' : '#475569' }]}>{yesText}</Text>
            </Pressable>
            <Pressable
              style={[styles.yn, { backgroundColor: currentVal === noText ? '#EF4444' : '#F1F5F9', borderColor: currentVal === noText ? '#EF4444' : '#D0D5DD' }]}
              onPress={() => setValues((v) => ({ ...v, [k]: noText }))}
            >
              <Text style={[styles.ynText, { color: currentVal === noText ? '#fff' : '#475569' }]}>{noText}</Text>
            </Pressable>
          </View>
        </View>
      );
    }
    if (type.includes('date')) {
      return (
        <FormSelectTrigger
          key={k}
          label={label}
          display={currentVal}
          placeholder={isTamil ? 'தேதியைத் தேர்ந்தெடுக்கவும்' : 'Tap to pick date'}
          primary={palette.primary}
          trailingIcon="calendar-outline"
          onPress={() => setDateField(k)}
        />
      );
    }
    if (type.includes('file') || type.includes('document') || type.includes('pdf') || type.includes('upload')) {
      return (
        <View key={k} style={styles.fieldCard}>
          <Text style={styles.fieldLbl}>{label}</Text>
          {currentVal ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{currentVal}</Text>
                <Text style={{ fontSize: 10, color: '#16A34A' }}>{isTamil ? 'கோப்பு இணைக்கப்பட்டுள்ளது' : 'File Attached'}</Text>
              </View>
              <Pressable onPress={() => setValues((v) => ({ ...v, [k]: '' }))}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </Pressable>
            </View>
          ) : (
            <Pressable style={[styles.cam, { backgroundColor: palette.primary }]} onPress={() => void pickFile(k)}>
              <Ionicons name="document" size={16} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12, marginLeft: 8 }}>
                {isTamil ? 'கோப்பை பதிவேற்றவும் (Upload File)' : 'Upload File'}
              </Text>
            </Pressable>
          )}
        </View>
      );
    }
    if (type.includes('select') || type.includes('dropdown') || type.includes('option') || type.includes('choice') || (f.options && f.options.length)) {
      return (
        <View key={k}>
          {dropdown(label, currentVal, (f.options || []).map((o) => ({ id: o, label: o })), (id) => setValues((v) => ({ ...v, [k]: id })), k)}
        </View>
      );
    }
    const numeric = type.includes('number') || type.includes('digit') || type.includes('mobile');
    return (
      <FormTextField
        key={k}
        label={label}
        value={currentVal}
        primary={palette.primary}
        keyboardType={numeric ? 'number-pad' : 'default'}
        onChangeText={(t) =>
          setValues((v) => ({
            ...v,
            [k]: type.includes('mobile') ? t.replace(/\D/g, '').slice(0, 10) : numeric ? t.replace(/\D/g, '') : t,
          }))
        }
        placeholder={isTamil ? f.placeholderTa || 'உள்ளிடவும்' : f.placeholderEn || 'Type here'}
      />
    );
  };

  const assignedWards = effectiveWards(user);

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
            <Text style={styles.kicker}>{isTamil ? 'புதிய ஆய்வு' : 'NEW INSPECTION'}</Text>
            <Text style={styles.heroTitle}>{isTamil ? 'பணி பதிவு' : 'Add field work'}</Text>
          </View>
          <HeaderBell />
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={styles.stepBar}>
          <Pressable style={styles.step} onPress={() => setStep(1)}>
            <View style={[styles.num, { backgroundColor: step === 1 ? palette.primary : step > 1 ? '#0F766E' : '#E2E8F0' }]}>
              <Text style={{ color: step >= 1 ? '#fff' : '#64748B', fontWeight: '700', fontSize: 12 }}>{step > 1 ? '✓' : '1'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepSmall}>{isTamil ? 'படி 1' : 'Step 1'}</Text>
              <Text style={{ color: step === 1 ? palette.primary : '#334155', fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
                {isTamil ? 'பொருள் & வார்டு' : 'Subject & Ward'}
              </Text>
            </View>
          </Pressable>
          <View style={styles.stepLine} />
          <Pressable style={styles.step} onPress={() => setStep(2)}>
            <View style={[styles.num, { backgroundColor: step === 2 ? palette.primary : '#E2E8F0' }]}>
              <Text style={{ color: step === 2 ? '#fff' : '#64748B', fontWeight: '700', fontSize: 12 }}>2</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepSmall}>{isTamil ? 'படி 2' : 'Step 2'}</Text>
              <Text style={{ color: step === 2 ? palette.primary : '#64748B', fontWeight: '700', fontSize: 11 }} numberOfLines={1}>
                {isTamil ? 'பணி விவரம்' : 'Work Detail'}
              </Text>
            </View>
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 40 }} style={{ marginTop: 12 }}>
        {step === 1 && (
          <>
            {scopeMissing && (
              <View style={styles.scopeAlert}>
                <Ionicons name="cloud-offline" size={44} color="#DC2626" />
                <Text style={{ fontWeight: '700', color: '#991B1B', textAlign: 'center', fontSize: 14, marginTop: 8 }}>
                  {isTamil ? 'ஆய்வு வரம்பு (Scope) எதுவும் பதிவிறக்கப்படவில்லை!' : 'No Inspection Scope Downloaded!'}
                </Text>
                <Text style={{ fontSize: 11, color: '#7F1D1D', textAlign: 'center', marginTop: 4 }}>
                  {isTamil
                    ? 'உங்கள் கணக்கிற்கு ஒதுக்கப்பட்ட ஆய்வு வரம்பு (வார்டு, தெரு, பொருள்) சர்வரில் இருந்து இன்னும் பதிவிறக்கப்படவில்லை. இணையத்தை இயக்கி வரம்பைப் பதிவிறக்கிய பிறகே பணிகளைச் சமர்ப்பிக்க முடியும். பொதுவான ஆய்வு (Fallback Scope) அனுமதிக்கப்படாது.'
                    : 'Your assigned inspection scope has not been downloaded from server. Please connect to internet and download your scope before submitting. General fallback scope is strictly disabled.'}
                </Text>
                <Pressable
                  style={styles.dl}
                  disabled={dlScope}
                  onPress={async () => {
                    setDlScope(true);
                    const scopeResp = await api.getUserScope(user?.username || '');
                    if (scopeResp.success && scopeResp.scope) {
                      await prefs.setUserScope(scopeResp.scope);
                      await prefs.setScopeVersionInt(scopeResp.scopeVersion || 1);
                      await prefs.setPortal(await api.getPortalState(user?.username));
                      await refreshPortal();
                      setScopeMissing(false);
                      toast(isTamil ? 'ஆய்வு வரம்பு வெற்றிகரமாகப் பதிவிறக்கப்பட்டது!' : 'Assigned scope downloaded successfully!');
                    } else {
                      toast(isTamil ? 'வரம்பைப் பதிவிறக்க முடியவில்லை. இணையத்தை சரிபார்க்கவும்.' : 'Failed to download scope. Check internet connection.');
                    }
                    setDlScope(false);
                  }}
                >
                  {dlScope ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'இணையத்திலிருந்து வரம்பைப் பதிவிறக்கு' : 'Download Assigned Scope Now'}</Text>}
                </Pressable>
              </View>
            )}

            <View style={styles.card}>
              <View style={styles.sectionHead}>
                <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
                  <Ionicons name="person-outline" size={15} color={palette.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>{isTamil ? 'அலுவலர் விவரங்கள்' : 'Officer details'}</Text>
                  <Text style={styles.sectionSub}>
                    {user?.name || 'Officer'} · {user?.role || user?.designation || 'Inspector'}
                  </Text>
                </View>
              </View>
              <View style={styles.detailGrid}>
                <View style={styles.detailCol}>
                  <Text style={styles.miniLbl}>{isTamil ? 'பேரூராட்சி' : 'TP'}</Text>
                  <Text style={styles.miniVal} numberOfLines={2}>{user?.townPanchayat || '—'}</Text>
                </View>
                <View style={[styles.detailCol, { borderRightWidth: 0 }]}>
                  <Text style={styles.miniLbl}>{isTamil ? 'வார்டுகள்' : 'Wards'}</Text>
                  <Text style={styles.miniVal} numberOfLines={2}>
                    {!assignedWards.length ? (isTamil ? 'அனைத்தும்' : 'All') : assignedWards.join(', ')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
                <Ionicons name="layers-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'பொருள் & வார்டு' : 'Subject & location'}</Text>
            </View>
            {!subjects.length ? (
              <View style={[styles.scopeAlert, { borderColor: '#FECACA' }]}>
                <Text style={{ fontSize: 12, color: '#991B1B' }}>
                  {isTamil
                    ? 'உங்கள் கணக்கிற்கு ஆய்வுக்குரிய பொருட்கள் எதுவும் ஒதுக்கப்படவில்லை அல்லது உருவாக்கப்படவில்லை.'
                    : 'No inspection subjects assigned to your user account.'}
                </Text>
              </View>
            ) : (
              dropdown(
                isTamil ? 'ஆய்வு பொருள் *' : 'Inspection Subject *',
                subjectId,
                subjects.map((s) => ({ id: s.id, label: isTamil ? s.nameTa : s.nameEn })),
                setSubjectId,
                'sub'
              )
            )}
            {!categories.length ? (
              <View style={styles.fieldCard}>
                <Text style={{ fontSize: 12, color: '#64748B' }}>
                  {isTamil ? 'இந்த பொருளுக்கு வகைகள் எதுவும் உருவாக்கப்படவில்லை.' : 'No categories created for this subject in inspection module management.'}
                </Text>
              </View>
            ) : (
              dropdown(
                isTamil ? 'ஆய்வு வகை (Category) *' : 'Inspection Category *',
                categoryId,
                categories.map((c) => ({ id: c.id, label: isTamil ? c.nameTa : c.nameEn })),
                setCategoryId,
                'cat'
              )
            )}
            {dropdown(
              isTamil ? 'வார்டு எண் (Ward) *' : 'Ward Number *',
              ward,
              wards.map((w) => ({
                id: w,
                label: isTamil ? `வார்டு ${w}` : `Ward ${w}`,
              })),
              setWard,
              'ward'
            )}
            {dropdown(
              isTamil ? 'தெரு பெயர் (Street) *' : 'Street Name *',
              street,
              streets.map((s) => ({ id: s, label: s })),
              setStreet,
              'st'
            )}
            <Pressable
              style={[styles.next, { backgroundColor: scopeMissing ? '#94A3B8' : palette.primary }]}
              onPress={() => {
                if (scopeMissing) {
                  toast(isTamil ? 'வரம்பு பதிவிறக்கப்படவில்லை. ஆய்வு தொடர முடியாது!' : 'No scope downloaded. Cannot continue!');
                  return;
                }
                setStep(2);
              }}
            >
              <Text style={styles.btnPrimaryText}>
                {scopeMissing
                  ? isTamil
                    ? 'வரம்பு தேவை'
                    : 'No scope downloaded'
                  : isTamil
                    ? 'பணி விவரம்'
                    : 'Continue to details'}
              </Text>
              {!scopeMissing && <Ionicons name="arrow-forward" size={15} color="#fff" />}
            </Pressable>
            </View>
          </>
        )}

        {step === 2 && (
          <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
                <Ionicons name="create-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'பணி விவரம்' : 'Work detail'}</Text>
              <View style={[styles.gpsChip, { backgroundColor: gpsOk ? '#ECFDF5' : '#FFFBEB' }]}>
                <Ionicons name="locate" size={12} color={gpsOk ? '#047857' : '#B45309'} />
                <Text style={{ color: gpsOk ? '#047857' : '#B45309', fontSize: 10, fontWeight: '700', marginLeft: 4 }}>
                  {gpsOk ? 'GPS' : 'GPS …'}
                </Text>
              </View>
            </View>
            {!visible.length && (
              <View style={styles.fieldCard}>
                <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center' }}>
                  {isTamil
                    ? 'இந்த வகைக்கு ஆய்வு மேலாண்மை பக்கத்தில் தனிப்பயன் புலங்கள் எதுவும் உருவாக்கப்படவில்லை.'
                    : 'No custom fields configured for this category in inspection module management.'}
                </Text>
              </View>
            )}
            {visible.map(renderField)}
            {!visible.some(isCameraField) && (
              <FormPhotoField
                label={isTamil ? 'சான்று புகைப்படம்' : 'Evidence photo'}
                uri={primaryPhoto}
                primary={palette.primary}
                onPress={() => void capture()}
                emptyTitle={isTamil ? 'சான்று புகைப்படம் எடுக்கவும்' : 'Take evidence photo'}
                emptySubtitle={isTamil ? 'தெளிவான சான்று புகைப்படம் எடுக்கவும்' : 'Capture clear evidence on site'}
                capturedBadge={isTamil ? 'சான்று சேர்க்கப்பட்டது' : 'Evidence attached'}
                retakeLabel={isTamil ? 'மீண்டும் எடு' : 'Retake'}
                ctaLabel={isTamil ? 'கேமரா திற' : 'Open camera'}
              />
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable style={styles.back} onPress={() => setStep(1)}>
                <Text style={styles.btnSecondaryText}>{isTamil ? 'பின்செல்' : 'Back'}</Text>
              </Pressable>
              <Pressable style={[styles.next, { flex: 2, backgroundColor: palette.primary, marginTop: 0 }]} onPress={() => void submit()} disabled={submitting}>
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={styles.btnPrimaryText}>{isTamil ? 'சமர்ப்பி' : 'Submit work'}</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <FormPickerSheet
        picker={picker}
        primary={palette.primary}
        onClose={() => setPicker(null)}
        closeLabel={isTamil ? 'மூடு' : 'Close'}
      />

      {dateField && (
        <DateTimePicker
          value={new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onValueChange={(_, d) => {
            if (Platform.OS === 'android') setDateField(null);
            if (!dateField) return;
            const s = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
            setValues((v) => ({ ...v, [dateField]: s }));
          }}
          onDismiss={() => setDateField(null)}
        />
      )}

      <Modal visible={success} transparent animationType="fade">
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
              <View style={styles.ok}>
                <Ionicons name="checkmark" size={20} color="#16A34A" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 16, marginLeft: 12 }}>{isTamil ? 'பணி சமர்ப்பிக்கப்பட்டது!' : 'Work Submitted!'}</Text>
            </View>
            <Text style={{ color: '#475569', marginVertical: 12, textAlign: 'center', fontSize: 13 }}>
              {isTamil ? 'பணி வெற்றிகரமாக சமர்ப்பிக்கப்பட்டது.' : 'Work has been submitted successfully.'}
              {lastId ? `\n${lastId}` : ''}
            </Text>
            <Pressable style={[styles.next, { backgroundColor: palette.primary, alignSelf: 'stretch' }]} onPress={() => resetFields(2)}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'பணி சேர்க்க+' : '+ Add Work'}</Text>
            </Pressable>
            <Pressable onPress={() => resetFields(1)} style={{ padding: 12 }}>
              <Text style={{ textAlign: 'center', fontSize: 12 }}>{isTamil ? 'முடிந்தது' : 'Done'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 22, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center' },
  kicker: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800', letterSpacing: 1.6 },
  heroTitle: { color: '#fff', fontSize: 17, fontWeight: '800', marginTop: 2 },
  sheet: { marginTop: -14, paddingHorizontal: 16 },
  stepBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF4',
  },
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepLine: { width: 12, height: 2, backgroundColor: '#E2E8F0', marginHorizontal: 4, borderRadius: 1 },
  num: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  stepSmall: { fontSize: 9, color: '#94A3B8', fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  sectionIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0F172A' },
  sectionSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  detailGrid: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#EEF2F7', paddingTop: 8 },
  detailCol: { flex: 1, paddingHorizontal: 6, borderRightWidth: 1, borderRightColor: '#EEF2F7' },
  fieldLbl: { fontWeight: '600', fontSize: 12, color: '#1E293B', marginBottom: 8 },
  lbl: { fontSize: 12, fontWeight: '600', color: '#344054', marginBottom: 6, lineHeight: 16 },
  ynBlock: { marginBottom: 16 },
  ynRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'stretch', width: '100%' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8EEF4' },
  fieldCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E8EEF4', marginTop: 8 },
  next: {
    minHeight: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  back: {
    flex: 1,
    minHeight: 42,
    height: 42,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D0D5DD',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnSecondaryText: { fontWeight: '700', fontSize: 13, color: '#475569' },
  cam: { borderRadius: 10, padding: 12, alignItems: 'center', justifyContent: 'center', marginTop: 4, flexDirection: 'row' },
  retake: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  yn: {
    flex: 1,
    minHeight: 34,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ynText: { fontWeight: '700', fontSize: 12 },
  scopeAlert: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 14, alignItems: 'center' },
  dl: { backgroundColor: '#DC2626', borderRadius: 12, padding: 12, alignItems: 'center', marginTop: 12, alignSelf: 'stretch' },
  miniLbl: { fontSize: 9, fontWeight: '700', color: '#94A3B8', letterSpacing: 0.3, textTransform: 'uppercase' },
  miniVal: { fontSize: 11, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  gpsChip: { flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4 },
  ok: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  modalBack: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center' },
});
