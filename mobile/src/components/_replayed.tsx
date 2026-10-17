import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import { resolveMediaUrl } from '../api/client';
import type { AppPalette } from '../theme/palettes';
import type { InspectionWork, PortalState } from '../types/models';
import { portalFields } from '../types/models';
import { formatTo12Hr } from '../utils/dates';

const EXPORT_W = Math.max(960, Math.round(Dimensions.get('window').width * 1.7));

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
  const exportRef = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState<'image' | 'report' | null>(null);
  const [idx, setIdx] = useState(0);
  const [photoReady, setPhotoReady] = useState(false);
  const [exportReady, setExportReady] = useState(false);

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
  const submitted = formatTo12Hr(work.submittedAt);
  const gps = `${Number(work.latitude || 0).toFixed(5)}, ${Number(work.longitude || 0).toFixed(5)}`;
  const workRef = work.workId || work.id;
  const photoLabel = current?.name || (isTamil ? 'கள ஆய்வு புகைப்படம்' : 'Field photo');
  const headerPlace = [locTp, locZone, locDistrict].filter(Boolean).join('  ·  ');
  const headerDetail = `${isTamil ? `வார்டு ${work.wardNumber}` : `Ward ${work.wardNumber}`}  ·  ${streetLabel}${subjectName ? `  ·  ${subjectName}` : ''}${categoryName ? `  ·  ${categoryName}` : ''}`;
  const headerInfoRows = useMemo(() => {
    const rows: { label: string; value: string }[] = [
      { label: isTamil ? 'வார்டு' : 'Ward', value: String(work.wardNumber ?? '—') },
      { label: isTamil ? 'தெரு / பகுதி' : 'Street / area', value: streetLabel?.trim() || '—' },
    ];
    if (subjectName) rows.push({ label: isTamil ? 'பொருள்' : 'Subject', value: subjectName });
    if (categoryName) rows.push({ label: isTamil ? 'வகை' : 'Category', value: categoryName });
    return rows;
  }, [work.wardNumber, streetLabel, subjectName, categoryName, isTamil]);
  const headerMeta = `${submitted}  ·  GPS ${gps}`;

  const exportLoadedRef = useRef(0);

  useEffect(() => {
    exportLoadedRef.current = 0;
    setExportReady(images.length === 0);
  }, [images, workRef]);

  const markExportImageLoaded = () => {
    exportLoadedRef.current += 1;
    if (exportLoadedRef.current >= images.length) setExportReady(true);
  };
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
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View>
            <ViewShot ref={shotRef} style={styles.sheet} options={{ format: 'jpg', quality: 0.92 }}>
              <View style={styles.photoCard}>
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

            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={8}>
              <Ionicons name="close" size={18} color="#334155" />
            </Pressable>
            <View style={styles.imageActions}>
              <Pressable onPress={() => void run('report', true)} style={styles.imageBtn} disabled={!!busy}>
                {busy === 'report' ? <ActivityIndicator size="small" color="#4F46E5" /> : <Ionicons name="download-outline" size={18} color="#4F46E5" />}
              </Pressable>
              <Pressable onPress={() => void run('report', false)} style={styles.imageBtn} disabled={!!busy}>
                <Ionicons name="share-outline" size={18} color="#4F46E5" />
              </Pressable>
            </View>
          </View>

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

        </ScrollView>
      </View>
    </Modal>
  );
}

function ReportHeaderBody({
  place,
  detail,
  meta,
  variant,
}: {
  place: string;
  detail: string;
  meta: string;
  variant: 'screen' | 'export';
}) {
  const isExport = variant === 'export';

  return (
    <>
      {!!place && (
        <Text style={[styles.rhPlace, isExport && styles.rhPlaceExport]} numberOfLines={isExport ? 2 : 2}>
          {place}
        </Text>
      )}
      <Text style={[styles.rhDetail, isExport && styles.rhDetailExport]} numberOfLines={isExport ? 2 : 3}>
        {detail}
      </Text>
      <View style={[styles.rhDivider, isExport && styles.rhDividerExport]} />
      <Text style={[styles.rhMeta, isExport && styles.rhMetaExport]} numberOfLines={isExport ? 1 : 1}>
        {meta}
      </Text>
    </>
  );
}

function DetailScreenHeader({
  place,
  detail,
  meta,
  onClose,
}: {
  place: string;
  detail: string;
  meta: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.reportHeader, styles.detailHeaderUnified, { paddingTop: insets.top }]}>
      <View style={styles.detailHeaderInner}>
        <Pressable onPress={onClose} style={styles.detailBackBtn} hitSlop={8} accessibilityRole="button">
          <Ionicons name="arrow-back" size={18} color="#fff" />
        </Pressable>
        <View style={[styles.reportHeaderHighlightBand, styles.reportHeaderHighlightBandScreen]}>
          <ReportHeaderBody place={place} detail={detail} meta={meta} variant="screen" />
        </View>
      </View>
    </View>
  );
}

function ReportFooterBar({
  isTamil,
  busy,
  onDownload,
  onShare,
}: {
  isTamil: boolean;
  busy: 'image' | 'report' | null;
  onDownload: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.reportFooter, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Pressable
        onPress={onDownload}
        style={({ pressed }) => [styles.reportFooterBtn, styles.reportFooterBtnOutline, pressed && styles.reportFooterBtnPressed]}
        disabled={!!busy}
      >
        {busy === 'report' ? (
          <ActivityIndicator size="small" color="#1A3D66" />
        ) : (
          <>
            <Ionicons name="download-outline" size={18} color="#1A3D66" />
            <Text style={styles.reportFooterBtnTextOutline}>{isTamil ? 'அறிக்கை பதிவிறக்கம்' : 'Download report'}</Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [styles.reportFooterBtn, styles.reportFooterBtnPrimary, pressed && styles.reportFooterBtnPressed]}
        disabled={!!busy}
      >
        <Ionicons name="share-outline" size={18} color="#fff" />
        <Text style={styles.reportFooterBtnTextPrimary}>{isTamil ? 'அறிக்கை பகிர்வு' : 'Share report'}</Text>
      </Pressable>
    </View>
  );
}

function ReportHeader({
  isTamil,
  workRef,
  place,
  detail,
  meta,
}: {
  isTamil: boolean;
  workRef: string;
  place: string;
  detail: string;
  meta: string;
}) {
  return (
    <View style={[styles.reportHeader, styles.reportHeaderExport]}>
      <View style={styles.reportHeaderRow}>
        <View style={styles.reportTitleBlock}>
          <Text style={styles.reportTitle}>{isTamil ? 'கள ஆய்வு பதிவு' : 'FIELD INSPECTION RECORD'}</Text>
          <View style={styles.reportTitleAccent} />
        </View>
        <View style={styles.reportRefBlock}>
          <Text style={styles.reportRefLabel}>{isTamil ? 'அடையாள எண்' : 'Reference'}</Text>
          <Text style={styles.reportRefValue} numberOfLines={1}>
            {workRef}
          </Text>
        </View>
      </View>
      <View style={styles.reportHeaderHighlightBand}>
        <ReportHeaderBody place={place} detail={detail} meta={meta} variant="export" />
      </View>
    </View>
  );
}

function ImageCaption({ label, count, compact }: { label: string; count?: string; compact?: boolean }) {
  return (
    <View style={[styles.captionBar, compact && styles.captionBarCompact]}>
      <Text style={[styles.captionTxt, compact && styles.captionTxtCompact]} numberOfLines={compact ? 1 : 2}>
        {label}
      </Text>
      {!!count && <Text style={styles.captionCount}>{count}</Text>}
    </View>
  );
}

const EXPORT_PHOTO_H = 440;
const EXPORT_PHOTO_PAD = 10;
const EXPORT_PHOTO_GAP = 8;
const EXPORT_CAPTION_H = 28;
const EXPORT_CAPTION_H_SINGLE = 34;

function ExportPhotoTile({
  item,
  captionHeight,
  onImageLoad,
}: {
  item: { url: string; name: string };
  captionHeight: number;
  onImageLoad: () => void;
}) {
  return (
    <View style={styles.exportTile}>
      <View style={styles.exportTileWell}>
        <Image
          source={{ uri: resolveMediaUrl(item.url) }}
          style={styles.exportTileImg}
          resizeMode="contain"
          onLoad={onImageLoad}
          onError={onImageLoad}
        />
      </View>
      <View style={[styles.exportTileCaption, { height: captionHeight }]}>
        <Text style={styles.exportTileCaptionTxt} numberOfLines={1}>
          {item.name}
        </Text>
      </View>
    </View>
  );
}

function ExportPhotoRow({
  items,
  onImageLoad,
  captionHeight,
  centerSingle,
}: {
  items: { url: string; name: string }[];
  onImageLoad: () => void;
  captionHeight: number;
  centerSingle?: boolean;
}) {
  if (items.length === 1 && centerSingle) {
    return (
      <View style={styles.exportRow}>
        <View style={styles.exportRowSide} />
        <View style={styles.exportRowMain}>
          <ExportPhotoTile item={items[0]} captionHeight={captionHeight} onImageLoad={onImageLoad} />
        </View>
        <View style={styles.exportRowSide} />
      </View>
    );
  }

  return (
    <View style={styles.exportRow}>
      {items.map((item, i) => (
        <View key={`${item.url}-${i}`} style={styles.exportRowSlot}>
          <ExportPhotoTile item={item} captionHeight={captionHeight} onImageLoad={onImageLoad} />
        </View>
      ))}
    </View>
  );
}

function ExportPhotoFrame({
  images,
  isTamil,
  onImageLoad,
}: {
  images: { url: string; name: string }[];
  isTamil: boolean;
  onImageLoad: () => void;
}) {
  if (!images.length) {
    return (
      <View style={[styles.photoEmpty, { height: EXPORT_PHOTO_H }]}>
        <Text style={styles.emptyTxt}>{isTamil ? 'புகைப்படம் இல்லை' : 'No photo attached'}</Text>
      </View>
    );
  }

  const captionH = images.length === 1 ? EXPORT_CAPTION_H_SINGLE : EXPORT_CAPTION_H;

  if (images.length === 1) {
    return (
      <View style={styles.exportPhotoFrame}>
        <ExportPhotoTile item={images[0]} captionHeight={captionH} onImageLoad={onImageLoad} />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View style={styles.exportPhotoFrame}>
        <ExportPhotoRow items={images} captionHeight={captionH} onImageLoad={onImageLoad} />
      </View>
    );
  }

  if (images.length === 3) {
    return (
      <View style={styles.exportPhotoFrame}>
        <View style={styles.exportStack}>
          <ExportPhotoRow items={[images[0], images[1]]} captionHeight={captionH} onImageLoad={onImageLoad} />
          <ExportPhotoRow items={[images[2]]} captionHeight={captionH} onImageLoad={onImageLoad} centerSingle />
        </View>
      </View>
    );
  }

  const pairs: { url: string; name: string }[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    pairs.push(images.slice(i, i + 2));
  }

  return (
    <View style={styles.exportPhotoFrame}>
      <View style={styles.exportStack}>
        {pairs.map((row, ri) => (
          <ExportPhotoRow
            key={`pair-${ri}`}
            items={row}
            captionHeight={captionH}
            onImageLoad={onImageLoad}
            centerSingle={row.length === 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF2F7' },
  scroll: { padding: 10, paddingBottom: 28, gap: 10 },
  sheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageActions: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
  },
  imageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(15,23,42,0.62)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCard: { backgroundColor: '#0F172A' },
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
});
