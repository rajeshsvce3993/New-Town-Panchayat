import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef, type ViewShotRef } from 'react-native-view-shot';
import ViewShot from 'react-native-view-shot';
import { resolveMediaUrl } from '../api/client';
import type { AppPalette } from '../theme/palettes';
import type { InspectionWork, PortalState } from '../types/models';
import { portalFields } from '../types/models';
import { formatTo12Hr } from '../utils/dates';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

function isImageValue(v: string) {
  return (
    v.startsWith('http') ||
    v.startsWith('/uploads') ||
    v.startsWith('data:image/') ||
    v.startsWith('file:') ||
    v.includes('captured_photo') ||
    /\.(jpg|jpeg|png|webp)$/i.test(v)
  );
}

function prettyLabel(raw: string) {
  return raw
    .replace(/[_-]/g, ' ')
    .replace(/photo field\s*:?\s*/i, '')
    .replace(/புகைப்படம்\s*:?\s*/i, '')
    .trim();
}

function safeFilePart(raw: string) {
  return String(raw || 'report').replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function displayText(value: string, uppercase: boolean) {
  const t = value.trim() || '—';
  return uppercase ? t.toUpperCase() : t;
}

async function materializeFile(url: string, filename: string) {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  if (url.startsWith('file:')) return url;
  if (url.startsWith('data:image/')) {
    const b64 = url.split(',')[1] || '';
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
  const result = await FileSystem.downloadAsync(resolveMediaUrl(url), dest);
  return result.uri;
}

async function shareOrSave(uri: string, mimeType: string, filename: string, save: boolean, isTamil: boolean) {
  const opts = {
    mimeType,
    dialogTitle: filename,
    UTI: mimeType === 'image/png' ? 'public.png' : 'public.jpeg',
  };
  if (save) {
    const dir = `${FileSystem.documentDirectory}exports`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}/${filename}`;
    const exists = await FileSystem.getInfoAsync(dest);
    if (exists.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    toast(isTamil ? `சேமிக்கப்பட்டது: ${filename}` : `Saved: ${filename}`);
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(dest, opts);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    toast(isTamil ? 'பகிர்வு இந்த சாதனத்தில் இல்லை' : 'Sharing is not available on this device');
    return;
  }
  await Sharing.shareAsync(uri, opts);
}

export function WorkDetailModal({
  work,
  portal,
  isTamil,
  palette: _palette,
  streetLabel,
  onClose,
}: {
  work: InspectionWork;
  portal: PortalState;
  isTamil: boolean;
  palette: AppPalette;
  streetLabel: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const shotRef = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState<'image' | 'report' | null>(null);
  const [idx, setIdx] = useState(0);
  const [photoReady, setPhotoReady] = useState(false);

  const images = useMemo(() => {
    const list: { url: string; name: string }[] = [];
    const fields = portalFields(portal);
    const resolveName = (key: string) => {
      const match = fields.find((f) => f.categoryId === work.categoryId && (f.fieldName === key || f.nameEn === key || f.id === key));
      const raw = match ? (isTamil && match.fieldNameTa ? match.fieldNameTa : match.nameEn || match.fieldName || key) : key;
      return prettyLabel(raw) || key;
    };
    Object.entries(work.fieldsData).forEach(([key, value]) => {
      const v = String(value || '');
      if (isImageValue(v)) list.push({ url: v, name: resolveName(key) });
    });
    if (work.imageUrl) {
      const i = list.findIndex((x) => x.url === work.imageUrl);
      if (i >= 0) {
        const [item] = list.splice(i, 1);
        list.unshift(item);
      } else list.unshift({ url: work.imageUrl, name: isTamil ? 'கள ஆய்வு புகைப்படம்' : 'Field photo' });
    }
    return list.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i);
  }, [work, portal, isTamil]);

  const fieldRows = useMemo(() => {
    const fields = portalFields(portal);
    return Object.entries(work.fieldsData)
      .map(([key, value]) => {
        const v = String(value ?? '').trim();
        if (!v || isImageValue(v)) return null;
        const match = fields.find((f) => f.categoryId === work.categoryId && (f.fieldName === key || f.nameEn === key || f.id === key));
        const label = prettyLabel(
          match ? (isTamil && match.fieldNameTa ? match.fieldNameTa : match.nameEn || match.fieldName || key) : key,
        );
        return { key, label, value: v };
      })
      .filter((row): row is { key: string; label: string; value: string } => !!row);
  }, [work, portal, isTamil]);

  const current = images[idx];
  const locTp = isTamil ? work.tpNameTa || work.tpNameEn : work.tpNameEn;
  const locZone = isTamil ? work.zoneNameTa || work.zoneNameEn : work.zoneNameEn;
  const locDistrict = isTamil ? work.districtNameTa || work.districtNameEn : work.districtNameEn;
  const subjectName = isTamil ? work.subjectNameTa || work.subjectNameEn : work.subjectNameEn;
  const categoryName = isTamil ? work.categoryNameTa || work.categoryNameEn : work.categoryNameEn;
  const submitted = formatTo12Hr(work.submittedAt);
  const gps = `${Number(work.latitude || 0).toFixed(5)}, ${Number(work.longitude || 0).toFixed(5)}`;
  const workRef = work.workId || work.id;
  const photoLabel = current?.name || (isTamil ? 'கள ஆய்வு புகைப்படம்' : 'Field photo');
  const stampLine1 = isTamil
    ? `${locTp}, ${locZone}, ${locDistrict}`
    : `${displayText(locTp, true)}, ${displayText(locZone, true)}, ${displayText(locDistrict, true)}`;
  const stampLine2 = isTamil
    ? `வார்டு எண்: ${work.wardNumber}, ${streetLabel} • ${subjectName} • ${photoLabel}`
    : `WARD NO: ${work.wardNumber}, ${displayText(streetLabel, true)} • ${displayText(subjectName, true)} • ${displayText(photoLabel, true)}`;
  const stampLine3 = `${isTamil ? submitted : submitted.toUpperCase()} • GPS: ${gps}`;

  const run = async (kind: 'image' | 'report', save: boolean) => {
    try {
      setBusy(kind);
      if (kind === 'image') {
        if (!current) {
          toast(isTamil ? 'பகிர புகைப்படம் இல்லை' : 'No photo to share');
          return;
        }
        const ext = /\.png$/i.test(current.url) ? 'png' : 'jpg';
        const filename = `inspection_${safeFilePart(workRef)}_photo_${idx + 1}.${ext}`;
        const uri = await materializeFile(current.url, filename);
        await shareOrSave(uri, ext === 'png' ? 'image/png' : 'image/jpeg', filename, save, isTamil);
        return;
      }
      if (current && !photoReady) await new Promise((r) => setTimeout(r, 400));
      const captured = await captureRef(shotRef, {
        format: 'jpg',
        quality: 0.92,
        result: 'tmpfile',
        fileName: 'inspection',
      });
      const filename = `inspection_${safeFilePart(workRef)}.jpg`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      const exists = await FileSystem.getInfoAsync(dest);
      if (exists.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: captured, to: dest });
      await shareOrSave(dest, 'image/jpeg', filename, save, isTamil);
    } catch {
      toast(isTamil ? 'செயல் தோல்வியுற்றது. மீண்டும் முயலவும்.' : 'Could not complete that action. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <StatusBar style="dark" />
        <View style={[styles.chrome, { paddingTop: Math.max(insets.top, 8) }]}>
          <Pressable onPress={onClose} style={styles.chromeIcon} hitSlop={8}>
            <Ionicons name="close" size={18} color="#334155" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.chromeKicker}>{isTamil ? 'கள ஆய்வு அறிக்கை' : 'FIELD INSPECTION REPORT'}</Text>
            <Text style={styles.chromeTitle} numberOfLines={1}>
              {workRef}
            </Text>
          </View>
          <Pressable onPress={() => void run('image', true)} style={[styles.pillBtn, styles.pillAmber]} disabled={!!busy || !current}>
            {busy === 'image' ? <ActivityIndicator size="small" color="#1C1917" /> : <Ionicons name="image-outline" size={14} color="#1C1917" />}
            <Text style={styles.pillAmberTxt}>{isTamil ? 'படம்' : 'Photo'}</Text>
          </Pressable>
          <Pressable onPress={() => void run('report', true)} style={[styles.pillBtn, styles.pillNavy]} disabled={!!busy}>
            {busy === 'report' ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="download-outline" size={14} color="#fff" />}
            <Text style={styles.pillNavyTxt}>{isTamil ? 'அறிக்கை' : 'Report'}</Text>
          </Pressable>
          <Pressable onPress={() => void run('report', false)} style={styles.chromeIcon} disabled={!!busy}>
            <Ionicons name="share-outline" size={18} color="#4F46E5" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <ViewShot ref={shotRef} style={styles.sheet} options={{ format: 'jpg', quality: 0.92 }}>
            <View style={styles.docHead}>
              <View style={styles.docHeadTop}>
                <View style={styles.idChip}>
                  <Text style={styles.idTxt}>{workRef}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.officer} numberOfLines={1}>
                    {displayText(work.submittedByUserName || '', !isTamil)}
                  </Text>
                  <Text style={styles.role}>{isTamil ? 'கள ஆய்வாளர்' : 'FIELD INSPECTOR'}</Text>
                </View>
              </View>
              <View style={styles.titleBlock}>
                <Text style={styles.subject}>{displayText(subjectName, !isTamil)}</Text>
                <Text style={styles.dot}>•</Text>
                <Text style={styles.category}>{displayText(categoryName, !isTamil)}</Text>
              </View>
              <Text style={styles.meta}>
                {displayText(locTp, !isTamil)}
                {'  •  '}
                {isTamil ? `வார்டு ${work.wardNumber}` : `WARD ${work.wardNumber}`}
                {'  •  '}
                {displayText(streetLabel, !isTamil)}
                {'  •  '}
                {isTamil ? submitted : submitted.toUpperCase()}
                {'  •  GPS: '}
                {gps}
              </Text>
            </View>

            <View style={styles.photoCard}>
              <View style={styles.photoBar}>
                <Ionicons name="camera-outline" size={14} color="#D97706" />
                <Text style={styles.photoBarTxt} numberOfLines={1}>
                  {displayText(photoLabel, !isTamil)}
                </Text>
                {images.length > 1 && (
                  <Text style={styles.photoCount}>
                    {idx + 1}/{images.length}
                  </Text>
                )}
              </View>
              {current ? (
                <Image
                  source={{ uri: resolveMediaUrl(current.url) }}
                  style={styles.photo}
                  resizeMode="contain"
                  onLoad={() => setPhotoReady(true)}
                  onError={() => setPhotoReady(true)}
                />
              ) : (
                <View style={styles.photoEmpty}>
                  <Ionicons name="image-outline" size={36} color="#CBD5E1" />
                  <Text style={styles.emptyTxt}>{isTamil ? 'புகைப்படம் இல்லை' : 'NO PHOTO UPLOADED'}</Text>
                </View>
              )}
              <View style={styles.stamp}>
                <Text style={styles.stamp1}>{stampLine1}</Text>
                <Text style={styles.stamp2}>{stampLine2}</Text>
                <Text style={styles.stamp3}>{stampLine3}</Text>
              </View>
            </View>

            <View style={styles.tableCard}>
              <View style={styles.tableTitleRow}>
                <Ionicons name="document-text-outline" size={14} color="#D97706" />
                <Text style={styles.tableTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
              </View>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.th, { flex: 1.65 }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                  <Text style={[styles.th, { flex: 1 }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                </View>
                {fieldRows.length ? (
                  fieldRows.map((r, i) => (
                    <View key={r.key} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                      <Text style={[styles.tdL, { flex: 1.65 }]}>
                        {displayText(r.label, !isTamil)}
                        <Text style={styles.colon}> :</Text>
                      </Text>
                      <Text style={[styles.tdR, { flex: 1 }]}>{displayText(r.value, !isTamil)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTxt}>
                    {isTamil ? 'புலங்களின் தகவல்கள் எதுவும் பதிவு செய்யப்படவில்லை' : 'NO CUSTOM FIELD INPUTS RECORDED'}
                  </Text>
                )}
              </View>
            </View>
          </ViewShot>

          {images.length > 1 && (
            <View style={styles.pager}>
              <Pressable
                style={styles.pageBtn}
                onPress={() => {
                  setPhotoReady(false);
                  setIdx((i) => (i - 1 + images.length) % images.length);
                }}
              >
                <Ionicons name="chevron-back" size={16} color="#334155" />
                <Text style={styles.pageLbl}>{isTamil ? 'முந்தைய படம்' : 'Previous photo'}</Text>
              </Pressable>
              <Pressable
                style={styles.pageBtn}
                onPress={() => {
                  setPhotoReady(false);
                  setIdx((i) => (i + 1) % images.length);
                }}
              >
                <Text style={styles.pageLbl}>{isTamil ? 'அடுத்த படம்' : 'Next photo'}</Text>
                <Ionicons name="chevron-forward" size={16} color="#334155" />
              </Pressable>
            </View>
          )}

          {!!current && (
            <View style={styles.actionRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#FBBF24' }]} disabled={!!busy} onPress={() => void run('image', true)}>
                <Ionicons name="download-outline" size={15} color="#1C1917" />
                <Text style={styles.actionDark}>{isTamil ? 'படம் பதிவிறக்கு' : 'Download photo'}</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: '#4F46E5' }]} disabled={!!busy} onPress={() => void run('image', false)}>
                <Ionicons name="share-outline" size={15} color="#fff" />
                <Text style={styles.actionLight}>{isTamil ? 'படம் பகிர்' : 'Share photo'}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF2F7' },
  chrome: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingHorizontal: 10,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chromeIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  chromeKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, color: '#64748B' },
  chromeTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  pillBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 7 },
  pillAmber: { backgroundColor: '#FBBF24' },
  pillNavy: { backgroundColor: '#4F46E5' },
  pillAmberTxt: { fontSize: 10, fontWeight: '800', color: '#1C1917' },
  pillNavyTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },
  scroll: { padding: 10, paddingBottom: 28, gap: 10 },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  docHead: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  docHeadTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  idChip: { backgroundColor: '#4F46E5', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, maxWidth: 160 },
  idTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  officer: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  role: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 1 },
  titleBlock: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 6 },
  subject: { fontSize: 13, fontWeight: '800', color: '#3730A3', textAlign: 'center', letterSpacing: 0.3 },
  category: { fontSize: 13, fontWeight: '800', color: '#047857', textAlign: 'center', letterSpacing: 0.3 },
  dot: { color: '#94A3B8', fontWeight: '800' },
  meta: { marginTop: 6, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#334155', lineHeight: 16 },
  photoCard: { backgroundColor: '#0F172A' },
  photoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  photoBarTxt: { flex: 1, fontSize: 11, fontWeight: '800', color: '#4338CA', letterSpacing: 0.4 },
  photoCount: { fontSize: 10, fontWeight: '800', color: '#64748B' },
  photo: { width: '100%', height: 280, backgroundColor: '#0F172A' },
  photoEmpty: { height: 140, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8FAFC' },
  emptyTxt: { color: '#94A3B8', fontSize: 11, fontWeight: '700', textAlign: 'center', paddingVertical: 14, paddingHorizontal: 12 },
  stamp: { backgroundColor: '#FBBF24', paddingVertical: 8, paddingHorizontal: 10 },
  stamp1: { color: '#7F1D1D', fontWeight: '800', fontSize: 11, textAlign: 'center' },
  stamp2: { color: '#7F1D1D', fontWeight: '700', fontSize: 10, textAlign: 'center', marginTop: 2 },
  stamp3: { color: '#7F1D1D', fontWeight: '700', fontSize: 9, textAlign: 'center', marginTop: 2 },
  tableCard: { backgroundColor: '#F8FAFC', padding: 10 },
  tableTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  tableTitle: { fontSize: 11, fontWeight: '800', color: '#334155', letterSpacing: 0.6 },
  table: { backgroundColor: '#fff', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  thead: { flexDirection: 'row', backgroundColor: '#E2E8F0', paddingVertical: 8, paddingHorizontal: 10 },
  th: { fontSize: 10, fontWeight: '800', color: '#1E293B', letterSpacing: 0.5 },
  tr: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  trAlt: { backgroundColor: '#F8FAFC' },
  tdL: { fontSize: 11, fontWeight: '700', color: '#312E81', paddingRight: 8 },
  colon: { color: '#94A3B8', fontWeight: '800' },
  tdR: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  pager: { flexDirection: 'row', gap: 8 },
  pageBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageLbl: { fontSize: 11, fontWeight: '700', color: '#334155' },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
  },
  actionDark: { fontSize: 11, fontWeight: '800', color: '#1C1917' },
  actionLight: { fontSize: 11, fontWeight: '800', color: '#fff' },
});
