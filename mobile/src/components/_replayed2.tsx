import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
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

async function materializeFile(url: string, filename: string) {
  const dest = `${FileSystem.cacheDirectory}${filename}`;
  if (url.startsWith('file:')) return url;
  if (url.startsWith('data:image/')) {
    const b64 = url.split(',')[1] || '';
    await FileSystem.writeAsStringAsync(dest, b64, { encoding: FileSystem.EncodingType.Base64 });
    return dest;
  }
  const resolved = resolveMediaUrl(url);
  const result = await FileSystem.downloadAsync(resolved, dest);
  return result.uri;
}

async function shareOrSave(uri: string, mimeType: string, filename: string, save: boolean, isTamil: boolean) {
  if (save) {
    const dir = `${FileSystem.documentDirectory}exports`;
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    const dest = `${dir}/${filename}`;
    const exists = await FileSystem.getInfoAsync(dest);
    if (exists.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
    await FileSystem.copyAsync({ from: uri, to: dest });
    toast(isTamil ? `பதிவிறக்கம் சேமிக்கப்பட்டது: ${filename}` : `Downloaded: ${filename}`);
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    toast(isTamil ? 'பகிர்வு இந்த சாதனத்தில் இல்லை' : 'Sharing is not available on this device');
    return;
  }
  await Sharing.shareAsync(uri, {
    mimeType,
    dialogTitle: filename,
    UTI: mimeType === 'image/png' ? 'public.png' : 'public.jpeg',
  });
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


  const exportLoadedRef = useRef(0);

  useEffect(() => {
    exportLoadedRef.current = 0;
    setExportReady(images.length === 0);
  }, [images, workRef]);

  const markExportImageLoaded = () => {
    exportLoadedRef.current += 1;
    if (exportLoadedRef.current >= images.length) setExportReady(true);
  };

  useEffect(() => {
    setExportReady(!current);
  }, [current]);

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

      if (images.length > 0 && !exportReady) {
        await new Promise((r) => setTimeout(r, 800));
      } else {
        await new Promise((r) => setTimeout(r, 80));
      }
      const captured = await captureRef(exportRef, {
        format: 'jpg',
        quality: 0.95,
        result: 'tmpfile',
        fileName: 'inspection',
        width: EXPORT_W,
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
    <Modal
      visible
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.screen}>
        <StatusBar style="light" translucent backgroundColor="transparent" />
        <DetailScreenHeader
          place={headerPlace}
          detail={headerDetail}
          meta={headerMeta}
          onClose={onClose}
        />
        <ScrollView
          style={styles.scrollFlex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <View style={styles.sheet}>
            <View style={styles.photoWrap}>
              {current ? (
                <View>
                  <Image
                    source={{ uri: resolveMediaUrl(current.url) }}
                    style={styles.photo}
                    resizeMode="contain"
                    onLoad={() => setPhotoReady(true)}
                    onError={() => setPhotoReady(true)}
                  />
                  <View style={styles.photoActions}>
                    <Pressable onPress={() => void run('image', true)} style={styles.photoOverlayBtn} disabled={!!busy} hitSlop={8}>
                      {busy === 'image' ? (
                        <ActivityIndicator size="small" color="#1A3D66" />
                      ) : (
                        <Ionicons name="download-outline" size={16} color="#1A3D66" />
                      )}
                    </Pressable>
                    <Pressable onPress={() => void run('image', false)} style={styles.photoOverlayBtn} disabled={!!busy} hitSlop={8}>
                      <Ionicons name="share-outline" size={16} color="#1A3D66" />
                    </Pressable>
                  </View>
                  <ImageCaption label={photoLabel} count={images.length > 1 ? `${idx + 1}/${images.length}` : undefined} />
                  {images.length > 1 && (
                    <>
                      <Pressable
                        style={[styles.nav, { left: 8 }]}
                        onPress={() => {
                          setPhotoReady(false);
                          setIdx((i) => (i - 1 + images.length) % images.length);
                        }}
                      >
                        <Ionicons name="chevron-back" color="#fff" size={18} />
                      </Pressable>
                      <Pressable
                        style={[styles.nav, { right: 8 }]}
                        onPress={() => {
                          setPhotoReady(false);
                          setIdx((i) => (i + 1) % images.length);
                        }}
                      >
                        <Ionicons name="chevron-forward" color="#fff" size={18} />
                      </Pressable>
                    </>
                  )}
                </View>
              ) : (
                <View>
                  <View style={styles.photoEmpty}>
                    <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyTxt}>{isTamil ? 'புகைப்படம் இல்லை' : 'No photo attached'}</Text>
                  </View>
                  <View style={styles.caption}>
                    <Text style={styles.captionId}>{workRef}</Text>
                    <Text style={styles.captionLine}>{stampLine1}</Text>
                    <Text style={styles.captionLine}>{stampLine2}</Text>
                    <Text style={styles.captionSub}>{stampLine3}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.tablePad}>
              <Text style={styles.tableTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.th, { flex: 1.65 }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                  <Text style={[styles.th, { flex: 1 }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                </View>
                {fieldRows.length ? (
                  fieldRows.map((r, i) => (
                    <View key={r.key} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                      <Text style={[styles.tdL, { flex: 1.65 }]}>{r.label}</Text>
                      <Text style={[styles.tdR, { flex: 1 }]}>{r.value}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyTxt}>
                    {isTamil ? 'புலங்களின் தகவல்கள் எதுவும் பதிவு செய்யப்படவில்லை' : 'No custom field inputs recorded'}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <ViewShot
            ref={exportRef}
            collapsable={false}
            options={{ format: 'jpg', quality: 0.95 }}
            style={[styles.landscapeSheet, { width: EXPORT_W, left: -EXPORT_W - 24 }]}
          >
            <ReportHeader
              isTamil={isTamil}
              workRef={workRef}
              place={headerPlace}
              detail={headerDetail}
              meta={headerMeta}
            />
            <View style={styles.landBody}>
              <View style={styles.landPhoto}>
                <ExportPhotoFrame
                  images={images}
                  isTamil={isTamil}
                  onImageLoad={markExportImageLoaded}
                />
              </View>
              <View style={styles.landTable}>
                <Text style={styles.tableTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
                <View style={styles.table}>
                  <View style={styles.thead}>
                    <Text style={[styles.th, { flex: 1.65 }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                    <Text style={[styles.th, { flex: 1 }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                  </View>
                  {fieldRows.length ? (
                    fieldRows.map((r, i) => (
                      <View key={`ex-${r.key}`} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                        <Text style={[styles.tdL, { flex: 1.65 }]}>{r.label}</Text>
                        <Text style={[styles.tdR, { flex: 1 }]}>{r.value}</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.emptyTxt}>
                      {isTamil ? 'புலங்களின் தகவல்கள் எதுவும் பதிவு செய்யப்படவில்லை' : 'No custom field inputs recorded'}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          </ViewShot>
        </ScrollView>
        <ReportFooterBar
          isTamil={isTamil}
          busy={busy}
          onDownload={() => void run('report', true)}
          onShare={() => void run('report', false)}
        />
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
  screen: { flex: 1, backgroundColor: '#fff' },
  scrollFlex: { flex: 1, backgroundColor: '#fff' },
  body: { paddingTop: 0, paddingHorizontal: 0, paddingBottom: 8 },
  detailHeaderUnified: {
    paddingBottom: 6,
    borderBottomWidth: 2,
  },
  detailHeaderInner: {
    position: 'relative',
    width: '100%',
  },
  detailBackBtn: {
    position: 'absolute',
    left: 6,
    top: 0,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  reportHeaderHighlightBand: {
    backgroundColor: 'rgba(251, 191, 36, 0.18)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.45)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: 'center',
    width: '100%',
  },
  reportHeaderHighlightBandScreen: {
    paddingHorizontal: 34,
    marginTop: 2,
  },
  rhPlace: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
    lineHeight: 17,
    textAlign: 'center',
    width: '100%',
  },
  rhPlaceExport: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
    color: '#FFFBEB',
  },
  rhDetail: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    lineHeight: 15,
    textAlign: 'center',
    width: '100%',
  },
  rhDetailExport: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  rhDivider: {
    marginTop: 5,
    marginBottom: 4,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.35)',
    width: '100%',
  },
  rhDividerExport: {
    marginTop: 6,
    marginBottom: 5,
    backgroundColor: 'rgba(251, 191, 36, 0.55)',
  },
  rhMeta: {
    fontSize: 10,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 13,
    textAlign: 'center',
    width: '100%',
  },
  rhMetaExport: {
    fontSize: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 14,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  reportFooterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 10,
  },
  reportFooterBtnPressed: { opacity: 0.88 },
  reportFooterBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#1A3D66',
  },
  reportFooterBtnPrimary: {
    backgroundColor: '#1A3D66',
  },
  reportFooterBtnTextOutline: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3D66',
  },
  reportFooterBtnTextPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  sheet: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  landscapeSheet: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#fff',
    pointerEvents: 'none',
  },
  landBody: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#fff' },
  landPhoto: { width: '58%', borderRightWidth: 1, borderRightColor: '#E2E8F0', overflow: 'hidden', backgroundColor: '#E8EDF3' },
  exportPhotoFrame: {
    height: EXPORT_PHOTO_H,
    padding: EXPORT_PHOTO_PAD,
    backgroundColor: '#E8EDF3',
    flexDirection: 'column',
  },
  exportStack: { flex: 1, gap: EXPORT_PHOTO_GAP },
  exportRow: { flex: 1, flexDirection: 'row', gap: EXPORT_PHOTO_GAP, alignItems: 'stretch' },
  exportRowSlot: { flex: 1, minWidth: 0 },
  exportRowSide: { flex: 0.5, minWidth: 0 },
  exportRowMain: { flex: 2, minWidth: 0 },
  exportTile: {
    flex: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  exportTileWell: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    minHeight: 0,
  },
  exportTileImg: { width: '100%', height: '100%' },
  exportTileCaption: {
    backgroundColor: '#FBBF24',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: '#F59E0B',
  },
  exportTileCaptionTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7F1D1D',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  landTable: { width: '42%', padding: 10, backgroundColor: '#F8FAFC' },
  landscapeSheet: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#fff',
    pointerEvents: 'none',
  },
  landBody: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#fff' },
  landPhoto: { width: '58%', borderRightWidth: 1, borderRightColor: '#E2E8F0' },
  landImg: { width: '100%', height: 420, backgroundColor: '#0B1220' },
  landTable: { width: '42%', padding: 10, backgroundColor: '#F8FAFC' },
  reportHeader: {
    backgroundColor: '#1A3D66',
    borderBottomWidth: 3,
    borderBottomColor: '#FBBF24',
  },
  reportHeaderExport: {
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 2,
  },
  reportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  reportTitleBlock: { flex: 1, minWidth: 0, paddingRight: 4 },
  reportTitle: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    lineHeight: 14,
  },

  reportTitleAccent: {
    marginTop: 5,
    height: 3,
    width: 52,
    backgroundColor: '#FBBF24',
    borderRadius: 2,
  },
  reportRefBlock: { alignItems: 'flex-end', maxWidth: '38%', paddingTop: 1 },
  reportRefLabel: {
    fontSize: 8,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  reportRefValue: {
    marginTop: 2,
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'right',
  },

  reportHighlight: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FBBF24',
  },

  reportPlace: {
    fontSize: 12,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    lineHeight: 17,
  },

  reportDetail: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.94)',
    textAlign: 'center',
    lineHeight: 14,
  },

  reportMetaDivider: {
    marginTop: 8,
    marginBottom: 6,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  reportMeta: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    lineHeight: 13,
  },

  photoWrap: { backgroundColor: '#fff', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 6 },
  photoCard: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  photoWell: { position: 'relative', backgroundColor: '#0F172A' },
  photoActions: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    zIndex: 2,
    backgroundColor: '#FBBF24',
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderRadius: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  photoOverlayBtn: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FBBF24',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#F59E0B',
  },
  captionBarCompact: { paddingVertical: 4, paddingHorizontal: 6, gap: 4 },
  captionTxt: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    color: '#7F1D1D',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  captionTxtCompact: { fontSize: 8, letterSpacing: 0.2 },
  captionCount: { fontSize: 10, fontWeight: '800', color: '#92400E' },
  photo: { width: '100%', height: 220, backgroundColor: '#0B1220' },
  photoEmpty: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8FAFC' },
  emptyTxt: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textAlign: 'center', padding: 12 },
  nav: { position: 'absolute', top: 96, backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 14, padding: 5 },
  tablePad: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 8, backgroundColor: '#fff' },
  tableTitle: { fontSize: 10, fontWeight: '800', color: '#334155', letterSpacing: 0.5, marginBottom: 6 },
  table: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  thead: { flexDirection: 'row', backgroundColor: '#1A3D66', paddingVertical: 8, paddingHorizontal: 10 },
  th: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.4 },
  tr: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  trAlt: { backgroundColor: '#F8FAFC' },
  tdL: { fontSize: 12, fontWeight: '700', color: '#1E3A5F', paddingRight: 8 },
  tdR: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
});

