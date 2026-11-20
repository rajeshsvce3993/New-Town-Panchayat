import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
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
import { HeaderActions } from '../../src/components/AppHeader';
import {
  FormPhotoField,
  FormPickerSheet,
  FormSelectTrigger,
  FormTextField,
  type FormPickerState,
} from '../../src/components/FormControls';
import { HeaderBrand } from '../../src/components/HeaderBrand';
import { SAMPLE_PHOTO } from '../../src/constants/config';
import { useApp } from '../../src/context/AppContext';
import { scheduleQueueDrain, submitAddWork } from '../../src/services/workPipeline';
import { showInspectionNotification } from '../../src/services/notifications';
import { dedupeInspectionWorks } from '../../src/utils/dedupeWorks';
import { prefs } from '../../src/storage/preferences';
import { portalHasInspectionScope } from '../../src/utils/livePortal';
import type { Category, FieldDefinition, InspectionWork, Subject } from '../../src/types/models';
import { effectiveCategoryIds, effectiveSubjectIds, effectiveWards, portalCategories, portalFields, portalSubjects, portalWorks } from '../../src/types/models';
import {
  fieldKey,
  isCameraField,
  isImageUploadField,
  orderedCategoryFields,
  stableFieldListKey,
  visibleDynamicFields,
} from '../../src/utils/fieldVisibility';
import { compressImageLocally } from '../../src/utils/imageCompression';
import { uniquePhotoFileName } from '../../src/utils/photoPersist';
import { now12Hr } from '../../src/utils/dates';
import { validateVisibleFields } from '../../src/utils/validateFields';
import { matchesTp, normalizeWard, resolveUserTpId } from '../../src/utils/wards';
import * as Location from 'expo-location';
import { acquireGpsFix, gpsFixFromLocation, isPlaceholderCoord, type GpsFix } from '../../src/utils/gpsLocation';
import { nextWorkId } from '../../src/utils/workId';
import { resolveWorkGeoLabels } from '../../src/utils/workGeo';
import { resolveInspectionScopeMode } from '../../src/utils/inspectionScopeMode';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

function openLocationSettings(isTamil: boolean) {
  Alert.alert(
    isTamil ? 'இருப்பிடம் இயக்கவும்' : 'Turn on location',
    isTamil
      ? 'இந்த பணியை ஜிபிஎஸ் இடத்துடன் பதிவு செய்ய, சாதன அமைப்புகளில் இருப்பிடத்தை இயக்கி, பயன்பாட்டிற்கு அனுமதி வழங்கவும்.'
      : 'To geotag this work, enable location on your device and allow access for this app.',
    [
      { text: isTamil ? 'பின்னர்' : 'Not now', style: 'cancel' },
      {
        text: isTamil ? 'அமைப்புகள்' : 'Open settings',
        onPress: () => {
          void Linking.openSettings();
        },
      },
    ]
  );
}

export default function AddWorkScreen() {
  const { user, palette, isTamil, portal, setWorks, refreshPortal, appIcon } = useApp();
  const insets = useSafeAreaInsets();
  const heroEnd = palette.isGradient && palette.gradientColors[1] ? palette.gradientColors[1] : palette.secondary;
  const [step, setStep] = useState(1);
  const [subjectId, setSubjectId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [ward, setWard] = useState('');
  const [street, setStreet] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [primaryPhoto, setPrimaryPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [lat, setLat] = useState(12.7244);
  const [lng, setLng] = useState(80.1873);
  const [gpsOk, setGpsOk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitInFlightRef = useRef(false);
  const draftClientWorkIdRef = useRef<string | null>(null);
  const lastGpsFixRef = useRef<GpsFix | null>(null);
  const lastSubmittedGpsRef = useRef<GpsFix | null>(null);

  const ensureDraftClientWorkId = () => {
    if (!draftClientWorkIdRef.current) {
      draftClientWorkIdRef.current = `work_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
    }
    return draftClientWorkIdRef.current;
  };

  const [success, setSuccess] = useState(false);
  const [lastId, setLastId] = useState('');
  const [scopeMissing, setScopeMissing] = useState(false);
  const [dlScope, setDlScope] = useState(false);
  const [picker, setPicker] = useState<FormPickerState>(null);
  const [dateField, setDateField] = useState<string | null>(null);
  const [districtId, setDistrictId] = useState('');
  const [tpId, setTpId] = useState('');

  const scopeMode = useMemo(() => resolveInspectionScopeMode(user), [user]);
  const portalDistricts = portal.districts || [];
  const portalTps = portal.townPanchayats || [];

  const activeTpId = useMemo(() => {
    if (tpId) return tpId;
    return resolveUserTpId(user, portalTps, undefined);
  }, [tpId, user, portalTps]);

  const districtOptions = useMemo(() => {
    if (scopeMode === 'multi_tp' || scopeMode === 'single_tp') {
      const d =
        portalDistricts.find((x) => user?.districtId && x.id === user.districtId) ||
        portalDistricts.find(
          (x) =>
            user?.district &&
            (x.nameEn.toLowerCase() === user.district.toLowerCase() ||
              x.nameTa.toLowerCase() === user.district.toLowerCase()),
        );
      return d ? [{ id: d.id, label: isTamil ? d.nameTa || d.nameEn : d.nameEn || d.nameTa }] : [];
    }
    return portalDistricts.map((d) => ({
      id: d.id,
      label: isTamil ? d.nameTa || d.nameEn : d.nameEn || d.nameTa,
    }));
  }, [scopeMode, portalDistricts, user, isTamil]);

  const tpOptions = useMemo(() => {
    if (scopeMode === 'single_tp') {
      const t =
        portalTps.find((x) => x.id === activeTpId) ||
        portalTps.find(
          (x) =>
            user?.townPanchayat &&
            (x.nameEn.toLowerCase() === user.townPanchayat.toLowerCase() ||
              x.nameTa.toLowerCase() === user.townPanchayat.toLowerCase()),
        );
      if (!t) return [];
      return [{ id: t.id, label: isTamil ? t.nameTa || t.nameEn : t.nameEn || t.nameTa }];
    }
    let list = portalTps;
    if (scopeMode === 'zonal' && districtId) {
      list = list.filter((t) => String(t.districtId || '') === String(districtId));
    }
    if (scopeMode === 'multi_tp') {
      const allowed = new Set((user?.selectedTpIds || []).map(String));
      if (allowed.size) list = list.filter((t) => allowed.has(String(t.id)));
      else if (districtId) list = list.filter((t) => String(t.districtId || '') === String(districtId));
    }
    return list.map((t) => ({
      id: t.id,
      label: isTamil ? t.nameTa || t.nameEn : t.nameEn || t.nameTa,
    }));
  }, [scopeMode, portalTps, districtId, activeTpId, user, isTamil]);

  useEffect(() => {
    const dists = portalDistricts;
    const tps = portalTps;
    const mode = resolveInspectionScopeMode(user);
    if (mode === 'single_tp') {
      const d =
        user?.districtId ||
        dists.find((x) => user?.district && x.nameEn.toLowerCase() === user.district.toLowerCase())?.id ||
        '';
      const t = resolveUserTpId(user, tps) || '';
      setDistrictId(d);
      setTpId(t);
      return;
    }
    if (mode === 'multi_tp') {
      const d =
        user?.districtId ||
        dists.find((x) => user?.district && x.nameEn.toLowerCase() === user.district.toLowerCase())?.id ||
        '';
      setDistrictId(d);
      const allowed = new Set((user?.selectedTpIds || []).map(String));
      const pool = allowed.size
        ? tps.filter((t) => allowed.has(String(t.id)))
        : tps.filter((t) => !d || String(t.districtId) === String(d));
      setTpId((prev) => (pool.some((t) => t.id === prev) ? prev : pool.length === 1 ? pool[0].id : ''));
      return;
    }
    if (dists.length === 1) setDistrictId((prev) => prev || dists[0].id);
    if (!districtId && user?.districtId) setDistrictId(user.districtId);
  }, [user?.id, user?.scopeType, user?.districtId, user?.selectedTpIds, portalDistricts, portalTps]);

  useEffect(() => {
    if (scopeMode !== 'zonal') return;
    const tps = portalTps.filter((t) => !districtId || String(t.districtId) === String(districtId));
    if (tps.some((t) => t.id === tpId)) return;
    setTpId(tps.length === 1 ? tps[0].id : '');
  }, [districtId, scopeMode, portalTps, tpId]);

  useEffect(() => {
    setWard('');
    setStreet('');
  }, [activeTpId]);

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

  const streetsDb = portal.wardsAndStreets || [];
  const wards = useMemo(() => {
    if (!activeTpId && (scopeMode === 'zonal' || scopeMode === 'multi_tp')) return [];
    const mongo = streetsDb
      .filter((w) => matchesTp(w, user, activeTpId, portalTps))
      .map((w) => normalizeWard(w.wardNo))
      .filter((w) => w && w !== '0');
    const userW = effectiveWards(user).map(normalizeWard).filter((w) => w && w !== '0');
    const combined = [...new Set([...userW, ...mongo])].sort((a, b) => Number(a) - Number(b));
    if (combined.length) return combined;
    if ((user?.role || '').toLowerCase().includes('admin')) return Array.from({ length: 18 }, (_, i) => String(i + 1));
    return [];
  }, [streetsDb, user, activeTpId, portalTps, scopeMode]);

  const streets = useMemo(() => {
    if (!ward) return [];
    const norm = normalizeWard(ward);
    const filtered = streetsDb
      .filter((ws) => normalizeWard(ws.wardNo) === norm && matchesTp(ws, user, activeTpId, portalTps))
      .map((ws) => (isTamil ? ws.streetNameTa || ws.streetNameEn : ws.streetNameEn))
      .filter(Boolean);
    return [...new Set(filtered)].sort();
  }, [streetsDb, ward, isTamil, user, activeTpId, portalTps]);

  const allCategories = useMemo(() => portalCategories(portal), [portal]);
  const dynFields = useMemo(
    () => orderedCategoryFields(portalFields(portal), categoryId, allCategories),
    [portal, categoryId, allCategories],
  );
  const visible = useMemo(() => visibleDynamicFields(dynFields, values), [dynFields, values]);

  useEffect(() => {
    if (!subjectId && subjects[0]) setSubjectId(subjects[0].id);
  }, [subjects, subjectId]);
  useEffect(() => {
    if (!categories.some((c) => c.id === categoryId)) setCategoryId(categories[0]?.id || '');
  }, [categories, categoryId]);
  useEffect(() => {
    if (!ward && wards.length === 1) setWard(wards[0]);
    else if (ward && !wards.includes(ward)) setWard(wards.length === 1 ? wards[0] : '');
  }, [wards, ward]);
  useEffect(() => {
    if (!ward) {
      setStreet('');
      return;
    }
    if (street && streets.includes(street)) return;
    const next = streets.length === 1 ? streets[0] : '';
    if (street !== next) setStreet(next);
  }, [ward, streets, street]);

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

  const acquireGps = useCallback(
    async (opts?: { silent?: boolean; forSubmit?: boolean }): Promise<{ lat: number; lng: number } | null> => {
      const forSubmit = !!opts?.forSubmit;
      const result = await acquireGpsFix(lastGpsFixRef.current, {
        forSubmit,
        lastSubmitted: forSubmit ? lastSubmittedGpsRef.current : null,
      });
      if (!result.ok) {
        setGpsOk(false);
        if (result.reason === 'permission') {
          if (forSubmit && lastGpsFixRef.current) {
            /* submit will use last known coords */
          } else if (forSubmit) {
            if (!opts?.silent) {
              toast(isTamil ? 'ஜிபிஎஸ் அனுமதி தேவை — அனுமதிக்கவும்' : 'Location permission is required — please allow access');
            }
            openLocationSettings(isTamil);
          } else if (!opts?.silent) toast(isTamil ? 'GPS அனுமதி தேவை' : 'GPS location permission is required');
        } else if (result.reason === 'disabled') {
          if (forSubmit && lastGpsFixRef.current) {
            /* submit will use last known coords */
          } else if (forSubmit && !opts?.silent) {
            openLocationSettings(isTamil);
          } else if (!opts?.silent) {
            toast(
              isTamil ? 'உங்கள் சாதனத்தின் ஜிபிஎஸ் முடக்கப்பட்டுள்ளது' : 'Location services are turned off on your device'
            );
          }
        } else if (!opts?.silent) {
          toast(
            isTamil
              ? 'GPS fix தயாராகவில்லை. வெளியில் சிறிது நேரம் காத்து மீண்டும் Submit செய்யவும்.'
              : 'GPS fix not ready yet. Wait in open sky for a moment, then tap Submit again.'
          );
        }
        return null;
      }

      const { fix } = result;
      lastGpsFixRef.current = fix;
      setLat(fix.lat);
      setLng(fix.lng);
      setGpsOk(true);
      if (!opts?.silent && !forSubmit) {
        const acc = fix.accuracy != null ? ` (±${Math.round(fix.accuracy * 10) / 10}m)` : '';
        toast(isTamil ? `GPS அமைவிடம்${acc}` : `GPS location ready${acc}`);
      }
      return { lat: fix.lat, lng: fix.lng };
    },
    [isTamil]
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let watch: Location.LocationSubscription | null = null;
      void (async () => {
        const has = portalHasInspectionScope(portal);
        setScopeMissing(!has && (!subjects.length || !wards.length));
        await acquireGps({ silent: true });
        if (cancelled) return;
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.status !== 'granted') return;
          watch = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, distanceInterval: 3, timeInterval: 2000 },
            (loc) => {
              if (cancelled) return;
              const fix = gpsFixFromLocation(loc);
              if (isPlaceholderCoord(fix.lat, fix.lng)) return;
              lastGpsFixRef.current = fix;
              setLat(fix.lat);
              setLng(fix.lng);
              setGpsOk(true);
            }
          );
        } catch {
          /* submit still takes a live reading */
        }
      })();
      return () => {
        cancelled = true;
        watch?.remove();
      };
    }, [user, portal, subjects.length, wards.length, acquireGps])
  );

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

  const pickGalleryImage = async (key: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast(isTamil ? 'தொகுப்பு அனுமதி தேவை' : 'Gallery permission is required to upload an image');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.75,
      exif: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const raw = res.assets[0].uri;
    const compressed = await compressImageLocally(raw, uniquePhotoFileName(key || 'gallery'));
    const uri = compressed || raw;
    setPhotos((p) => ({ ...p, [key]: uri }));
    setValues((v) => ({ ...v, [key]: `gallery_photo_${key}_${Date.now()}.jpg` }));
    toast(isTamil ? 'படம் தேர்ந்தெடுக்கப்பட்டது!' : 'Image selected from gallery');
  };

  const submit = async () => {
    if (submitInFlightRef.current || submitting || success) return;
    submitInFlightRef.current = true;
    setSubmitting(true);
    try {
    if (!portalHasInspectionScope(portal) || !subjects.length || !wards.length) {
      toast(
        isTamil
          ? 'ஆய்வு வரம்பு ஏற்றப்படவில்லை. இணையத்துடன் இணைந்து மீண்டும் பதிவேற்றவும்.'
          : 'Inspection scope not loaded. Connect to the internet and refresh.',
      );
      return;
    }
    const liveGps = await acquireGps({ forSubmit: true, silent: true });
    const fallbackFix = lastGpsFixRef.current;
    const submitLat = liveGps?.lat ?? fallbackFix?.lat ?? lat;
    const submitLng = liveGps?.lng ?? fallbackFix?.lng ?? lng;
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
    const subject = subjects.find((s) => s.id === subjectId);
    const category = categories.find((c) => c.id === categoryId);
    if (scopeMode === 'zonal' && !districtId) {
      toast(isTamil ? 'மாவட்டத்தைத் தேர்ந்தெடுக்கவும்.' : 'Please select a district.');
      return;
    }
    if ((scopeMode === 'zonal' || scopeMode === 'multi_tp') && !activeTpId) {
      toast(isTamil ? 'பேரூராட்சியைத் தேர்ந்தெடுக்கவும்.' : 'Please select a Town Panchayat.');
      return;
    }
    if (!ward || !street) {
      toast(isTamil ? 'வார்டு மற்றும் தெருவைத் தேர்ந்தெடுக்கவும்.' : 'Please select ward and street from the list.');
      return;
    }
    const geoLabels = resolveWorkGeoLabels(user, portal, { districtId, tpId: activeTpId });
    if (!geoLabels) {
      toast(
        isTamil
          ? 'மண்டலம் / மாவட்டம் / பேரூராட்சி விவரம் இல்லை. மீண்டும் உள்நுழைந்து பிணைப்பை சரிபார்க்கவும்.'
          : 'Missing zone, district, or town panchayat from your account. Sign in again to refresh location from the server.'
      );
      return;
    }
    const ids = nextWorkId(user, portal, ward, { districtId, tpId: activeTpId });
    let actualWorkId = '';
    const { zoneNameEn: zoneName, districtNameEn: districtName, tpNameEn: tpName } = geoLabels;
    const fieldCopy = { ...values };
    let s3 = SAMPLE_PHOTO;
    const clientWorkId = ensureDraftClientWorkId();
    const photoMeta = {
      workId: clientWorkId,
      userId: user?.id || user?.username,
      username: user?.username,
      zone: zoneName,
      district: districtName,
      tp: tpName,
    };

    const photoJobs = Object.entries(photos).map(([k, uri]) => ({ key: k, uri }));
    if (primaryPhoto) photoJobs.push({ key: '__primary__', uri: primaryPhoto });

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
      tpNameTa: geoLabels.tpNameTa,
      zoneNameEn: zoneName,
      zoneNameTa: geoLabels.zoneNameTa,
      districtNameEn: districtName,
      districtNameTa: geoLabels.districtNameTa,
      wardNumber: ward,
      streetName: street,
      latitude: submitLat,
      longitude: submitLng,
      fieldsData: fieldCopy,
      imageUrl: s3,
      imageCaption: caption || `Field verification confirmed at Ward ${ward} ${street}.`,
      submittedAt: now12Hr(),
      submittedByUserName: user?.name || user?.username || 'Field Inspector',
      submittedByUserId: user?.id || user?.username || '',
      status: 'Pending',
    };

    const result = await submitAddWork({ work: newWork, photoJobs, photoMeta });
    if (result.status === 'error') {
      toast(result.message);
      return;
    }
    lastSubmittedGpsRef.current = { lat: submitLat, lng: submitLng, at: Date.now() };
    draftClientWorkIdRef.current = null;
    if (result.status === 'online') {
      const saved = result.saved;
      setWorks((w) => dedupeInspectionWorks([saved, ...w.filter((x) => x.id !== clientWorkId && x.workId !== saved.workId)]));
      setLastId(saved.workId || '');
      setSuccess(true);
      toast(isTamil ? 'பணி வெற்றிகரமாக சேமிக்கப்பட்டது' : 'Work saved successfully');
      try {
        await showInspectionNotification(saved.workId || '', subject?.nameEn || 'Field Work', isTamil);
      } catch {
        /* ignore */
      }
      scheduleQueueDrain();
      void refreshPortal();
      return;
    }
    setLastId('');
    setSuccess(true);
    toast(isTamil ? 'பணி வெற்றிகரமாக சேமிக்கப்பட்டது' : 'Work saved successfully');
    scheduleQueueDrain();
    } catch (e) {
      console.warn('submit failed', e);
      toast(isTamil ? 'பணி சேமிப்பு தோல்வி. மீண்டும் முயற்சிக்கவும்.' : 'Could not save work. Please try again.');
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const resetFields = (toStep: number) => {
    setValues({});
    setPhotos({});
    setPrimaryPhoto(null);
    setCaption('');
    setSuccess(false);
    setLastId('');
    draftClientWorkIdRef.current = null;
    submitInFlightRef.current = false;
    setSubmitting(false);
    setStep(toStep);
    void acquireGps({ silent: true });
  };

  const dropdown = (
    label: string,
    value: string,
    options: { id: string; label: string }[],
    onPick: (id: string) => void,
    key: string,
    locked = false,
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
        locked={locked}
        onPress={() => {
          if (locked) return;
          setPicker({ title: label, value, options, onPick });
        }}
      />
    );
  };

  const fieldLabel = (f: FieldDefinition) => {
    const k = fieldKey(f);
    const base = isTamil
      ? f.fieldNameTa || f.nameTa || f.nameEn || k
      : f.nameEn || f.fieldName || f.nameTa || k;
    const raw = String(base || k).replace(/\s*\*\s*$/, '');
    const mandatory = !!(f.isRequired || f.isMandatory);
    return mandatory ? `${raw} *` : raw;
  };

  const renderField = (f: FieldDefinition, listKey: string) => {
    const k = fieldKey(f);
    const type = (f.fieldType || f.type || 'text').toLowerCase();
    const label = String(fieldLabel(f) || k || 'Field');
    const currentVal = values[k] || '';
    if (isCameraField(f)) {
      return (
        <FormPhotoField
          key={listKey}
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
    if (isImageUploadField(f)) {
      return (
        <FormPhotoField
          key={listKey}
          label={label}
          uri={photos[k] || null}
          primary={palette.primary}
          onPress={() => void pickGalleryImage(k)}
          emptyTitle={isTamil ? 'தொகுப்பிலிருந்து படம் தேர்வு' : 'Choose image from gallery'}
          emptySubtitle={isTamil ? 'உங்கள் தொகுப்பில் உள்ள படத்தை பதிவேற்றவும்' : 'Pick a photo from your gallery'}
          capturedBadge={isTamil ? 'படம் சேர்க்கப்பட்டது' : 'Image added'}
          retakeLabel={isTamil ? 'மாற்று' : 'Change'}
          ctaLabel={isTamil ? 'தொகுப்பைத் திற' : 'Open gallery'}
          source="gallery"
        />
      );
    }
    if (type.includes('yes') || type.includes('boolean')) {
      const yesText = isTamil ? 'ஆம்' : 'Yes';
      const noText = isTamil ? 'இல்லை' : 'No';
      return (
        <View key={listKey} style={styles.ynBlock}>
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
          key={listKey}
          label={label}
          display={currentVal}
          placeholder={isTamil ? 'தேதியைத் தேர்ந்தெடுக்கவும்' : 'Tap to pick date'}
          primary={palette.primary}
          trailingIcon="calendar-outline"
          onPress={() => setDateField(k)}
        />
      );
    }
    if (
      !isImageUploadField(f) &&
      (type === 'file' || type.includes('document') || type.includes('pdf') || type === 'upload' || type === 'file_upload')
    ) {
      return (
        <View key={listKey} style={styles.fieldCard}>
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
        <View key={listKey}>
          {dropdown(label, currentVal, (f.options || []).map((o) => ({ id: o, label: o })), (id) => setValues((v) => ({ ...v, [k]: id })), listKey)}
        </View>
      );
    }
    const numeric = type.includes('number') || type.includes('digit') || type.includes('mobile');
    return (
      <FormTextField
        key={listKey}
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
          <HeaderActions />
        </View>
      </LinearGradient>

      <View style={styles.sheet}>
        <View style={styles.stepBar}>
          <Pressable
            style={[styles.step, step === 1 && [styles.stepActive, { backgroundColor: palette.primaryContainer, borderColor: palette.primary }]]}
            onPress={() => setStep(1)}
          >
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
          <Pressable
            style={[styles.step, step === 2 && [styles.stepActive, { backgroundColor: palette.primaryContainer, borderColor: palette.primary }]]}
            onPress={() => {
              ensureDraftClientWorkId();
              setStep(2);
            }}
          >
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
                    try {
                      await refreshPortal();
                      const scopeResp = await api.getUserScope(user?.username || '');
                      if (scopeResp.success && scopeResp.scope) {
                        await prefs.setUserScope(scopeResp.scope);
                        await prefs.setScopeVersionInt(scopeResp.scopeVersion || 1);
                      }
                      const fresh = await prefs.getPortal();
                      const ok = portalHasInspectionScope(fresh);
                      setScopeMissing(!ok);
                      toast(
                        ok
                          ? isTamil
                            ? 'ஆய்வு வரம்பு சேவையகத்திலிருந்து ஏற்றப்பட்டது!'
                            : 'Inspection scope loaded from server.'
                          : isTamil
                            ? 'வரம்பை ஏற்ற முடியவில்லை. இணையத்தை சரிபார்க்கவும்.'
                            : 'Could not load scope. Check internet.',
                      );
                    } finally {
                      setDlScope(false);
                    }
                  }}
                >
                  {dlScope ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{isTamil ? 'இணையத்திலிருந்து வரம்பைப் பதிவிறக்கு' : 'Download Assigned Scope Now'}</Text>}
                </Pressable>
              </View>
            )}

            <View style={styles.card}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: palette.primaryContainer }]}>
                <Ionicons name="layers-outline" size={15} color={palette.primary} />
              </View>
              <Text style={styles.sectionTitle}>{isTamil ? 'பொருள் & வார்டு' : 'Subject & location'}</Text>
            </View>
            {dropdown(
              isTamil ? 'மாவட்டம் (District)' : 'Select District',
              districtId,
              districtOptions,
              (id) => setDistrictId(id),
              'geo-dist',
              scopeMode !== 'zonal',
            )}
            {dropdown(
              isTamil ? 'பேரூராட்சி (Town Panchayat)' : 'Select TP (Town Panchayat)',
              tpId,
              tpOptions,
              (id) => setTpId(id),
              'geo-tp',
              scopeMode === 'single_tp',
            )}
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
                void acquireGps({ silent: true });
                ensureDraftClientWorkId();
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
                  {!portalFields(portal).length
                    ? isTamil
                      ? 'புல வரையறைகள் பதிவிறக்கம் செய்யப்படவில்லை. மேலே பக்கத்தில் "இணையத்திலிருந்து வரம்பைப் பதிவிறக்கு" என்பதைத் தட்டவும் அல்லது வெளியேறி மீண்டும் உள்நுழையவும்.'
                      : 'Field definitions are not loaded yet. On step 1 tap “Download Assigned Scope Now”, or log out and sign in again.'
                    : isTamil
                      ? 'இந்த வகைக்கு ஆய்வு மேலாண்மை பக்கத்தில் தனிப்பயன் புலங்கள் எதுவும் உருவாக்கப்படவில்லை.'
                      : 'No custom fields configured for this category in inspection module management.'}
                </Text>
              </View>
            )}
            {visible.map((f, idx) => renderField(f, stableFieldListKey(f, idx)))}
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
              <Pressable
                style={[
                  styles.next,
                  { flex: 2, backgroundColor: success || submitting ? '#94A3B8' : palette.primary, marginTop: 0 },
                ]}
                onPress={() => void submit()}
                disabled={submitting || success}
              >
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

      <Modal visible={success} transparent animationType="fade" onRequestClose={() => resetFields(2)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' }}>
              <View style={styles.ok}>
                <Ionicons name="checkmark" size={20} color="#16A34A" />
              </View>
              <Text style={{ fontWeight: '700', fontSize: 16, marginLeft: 12 }}>{isTamil ? 'பணி சேமிக்கப்பட்டது!' : 'Work saved!'}</Text>
            </View>
            <Text style={{ color: '#475569', marginVertical: 12, textAlign: 'center', fontSize: 13 }}>
              {lastId
                ? isTamil
                  ? `பணி வெற்றிகரமாக சேமிக்கப்பட்டது\n${lastId}`
                  : `Work saved successfully\n${lastId}`
                : isTamil
                  ? 'பணி வெற்றிகரமாக சேமிக்கப்பட்டது'
                  : 'Work saved successfully'}
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
  step: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  stepActive: { borderWidth: 1 },
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
