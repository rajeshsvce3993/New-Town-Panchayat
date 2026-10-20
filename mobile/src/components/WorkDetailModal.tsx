import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import { StatusBar } from 'expo-status-bar';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { getApiBaseUrl, isLocalPhotoPath, resolveMediaUrl, resolveProfilePhotoUrl } from '../api/client';
import { SAMPLE_PHOTO } from '../constants/config';
import { useApp } from '../context/AppContext';
import { profilePhotoFile } from '../storage/preferences';
import { BrandImage } from './BrandImage';
import { DEFAULT_PALETTE_ID, getPaletteById, type AppPalette } from '../theme/palettes';
import type { FieldDefinition, InspectionWork, PortalState } from '../types/models';
import { effectivePhotoUrl, portalFields, resolveOfficerDesignation } from '../types/models';
import { formatTo12Hr } from '../utils/dates';
import { fieldOrderIndex } from '../utils/fieldVisibility';

const EXPORT_W = Math.max(960, Math.round(Dimensions.get('window').width * 1.7));
const EXPORT_FIT_SCALE = Math.min(1, Dimensions.get('window').width / EXPORT_W);
const GOOGLE_STATIC_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function mapFileUri(path: string) {
  if (!path) return path;
  if (path.startsWith('file:') || path.startsWith('content:')) return path;
  if (path.startsWith('/')) return `file://${path}`;
  return path;
}

function latLngToTile(lat: number, lon: number, zoom: number) {
  const n = 2 ** zoom;
  const x = Math.floor(((lon + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x, y, z: zoom };
}

function googleStaticMapUrl(latitude: number, longitude: number, key: string) {
  const k = String(key || '').trim();
  if (!k) return '';
  const q = `${latitude},${longitude}`;
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(q)}` +
    `&zoom=18&size=240x240&scale=2&maptype=hybrid` +
    `&markers=color:red%7C${encodeURIComponent(q)}` +
    `&key=${encodeURIComponent(k)}`
  );
}

function googleHybridTileUrl(latitude: number, longitude: number) {
  const { x, y, z } = latLngToTile(latitude, longitude, 18);
  return `https://mt1.google.com/vt/lyrs=y&x=${x}&y=${y}&z=${z}`;
}

function esriSatelliteTileUrl(latitude: number, longitude: number) {
  const { x, y, z } = latLngToTile(latitude, longitude, 18);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

function osmTileUrl(latitude: number, longitude: number) {
  const { x, y, z } = latLngToTile(latitude, longitude, 18);
  return `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
}

function uint8ToBase64(bytes: Uint8Array) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b1 >> 2];
    out += chars[((b1 & 3) << 4) | (b2 >> 4)];
    out += i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b3 & 63] : '=';
  }
  return out;
}

function isImageMagic(bytes: Uint8Array) {
  if (bytes.length < 4) return false;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
  return false;
}

async function cachedFileIsImage(path: string) {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists || !('size' in info) || typeof info.size !== 'number' || info.size < 800) return false;
    const head = await FileSystem.readAsStringAsync(path, {
      encoding: FileSystem.EncodingType.Base64,
      length: 12,
      position: 0,
    });
    return (
      head.startsWith('iVBOR') ||
      head.startsWith('/9j/') ||
      head.startsWith('R0lGOD') ||
      head.startsWith('UklGR')
    );
  } catch {
    return false;
  }
}

async function saveMapUrlToFile(url: string, dest: string, headers?: Record<string, string>) {
  try {
    const result = await FileSystem.downloadAsync(url, dest, headers ? { headers } : undefined);
    if (result.status >= 200 && result.status < 300 && (await cachedFileIsImage(result.uri || dest))) {
      return true;
    }
  } catch {
    /* fall through to fetch */
  }
  try {
    const res = await fetch(url, { headers, cache: 'no-store' });
    if (!res.ok) return false;
    const type = (res.headers.get('content-type') || '').toLowerCase();
    if (type && !type.startsWith('image/') && !type.includes('octet-stream') && !type.includes('binary')) {
      return false;
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.length < 800 || !isImageMagic(bytes)) return false;
    await FileSystem.writeAsStringAsync(dest, uint8ToBase64(bytes), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return true;
  } catch {
    return false;
  }
}

async function downloadLocationMap(latitude: number, longitude: number, mapsKey?: string): Promise<string | null> {
  const lat = Number(latitude || 0);
  const lon = Number(longitude || 0);
  if (!lat && !lon) return null;
  const dest = `${FileSystem.cacheDirectory}gps_map_${lat.toFixed(5)}_${lon.toFixed(5)}.png`;
  if (await cachedFileIsImage(dest)) return mapFileUri(dest);
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* download fresh */
  }
  const key = String(mapsKey || GOOGLE_STATIC_MAPS_KEY || '').trim();
  const candidates: { url: string; headers?: Record<string, string> }[] = [
    { url: googleStaticMapUrl(lat, lon, key) },
    { url: `${getApiBaseUrl()}/api/static-map?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lon))}` },
    { url: googleHybridTileUrl(lat, lon) },
    { url: esriSatelliteTileUrl(lat, lon) },
    {
      url: osmTileUrl(lat, lon),
      headers: { 'User-Agent': 'TownPanchayatEMS/2.0 (inspection report map)' },
    },
  ].filter((item) => !!item.url);
  for (const item of candidates) {
    const ok = await saveMapUrlToFile(item.url, dest, item.headers);
    if (ok) return mapFileUri(dest);
  }
  return null;
}

async function downloadOfficerPhoto(raw?: string | null): Promise<string | null> {
  const local = profilePhotoFile();
  if (await cachedFileIsImage(local)) return mapFileUri(local);
  const src = String(raw || '').trim();
  if (!src) return null;
  if (isLocalPhotoPath(src)) {
    const uri = resolveProfilePhotoUrl(src);
    if (uri && (await cachedFileIsImage(uri))) return mapFileUri(uri);
    return uri;
  }
  const remote = resolveProfilePhotoUrl(src);
  if (!remote) return null;
  const dest = `${FileSystem.cacheDirectory}officer_profile.jpg`;
  if (await cachedFileIsImage(dest)) return mapFileUri(dest);
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* download fresh */
  }
  const ok = await saveMapUrlToFile(remote, dest);
  return ok ? mapFileUri(dest) : null;
}

const EXPORT_PHOTO_H = 440;
const EXPORT_PHOTO_PAD = 10;
const EXPORT_PHOTO_GAP = 8;
const EXPORT_CAPTION_H = 28;
const EXPORT_CAPTION_H_SINGLE = 34;
const REPORT_AMBER = '#FBBF24';
const CAPTION_BORDER = '#F59E0B';
const CAPTION_BROWN = '#800000';
const REPORT_GREEN = '#288C46';
/** Page header: light green → brand green → deep green. */
const REPORT_HEADER_GRADIENT = ['#4CB86A', REPORT_GREEN, '#1B6B34'] as const;
const REPORT_HEADER_GRADIENT_LOCATIONS = [0, 0.52, 1] as const;
const REPORT_HEADER_STRIPE_COUNT = 32;
const SUMMARY_NAVY = '#1A3D66';

function hexToRgb(hex: string) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number) {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function lerpHex(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function reportHeaderGradientColor(t: number) {
  const stops = REPORT_HEADER_GRADIENT;
  const locs = REPORT_HEADER_GRADIENT_LOCATIONS;
  if (t <= locs[0]) return stops[0];
  if (t >= locs[locs.length - 1]) return stops[stops.length - 1];
  for (let i = 0; i < locs.length - 1; i++) {
    const lo = locs[i];
    const hi = locs[i + 1];
    if (t >= lo && t <= hi) {
      return lerpHex(stops[i], stops[i + 1], (t - lo) / (hi - lo));
    }
  }
  return stops[stops.length - 1];
}

const REPORT_HEADER_STRIPE_COLORS = Array.from({ length: REPORT_HEADER_STRIPE_COUNT }, (_, i) =>
  reportHeaderGradientColor((i + 0.5) / REPORT_HEADER_STRIPE_COUNT),
);

/** On-screen report detail header + table header only. */
function ReportHeaderSurface({
  style,
  children,
}: {
  style?: object;
  children: ReactNode;
}) {
  return (
    <View style={[styles.reportHeaderSurface, style]}>
      <View style={styles.reportHeaderBands} pointerEvents="none">
        <View style={[styles.reportHeaderBand, { backgroundColor: REPORT_HEADER_GRADIENT[0] }]} />
        <View style={[styles.reportHeaderBand, { backgroundColor: REPORT_HEADER_GRADIENT[1] }]} />
        <View style={[styles.reportHeaderBand, { backgroundColor: REPORT_HEADER_GRADIENT[2] }]} />
      </View>
      <LinearGradient
        colors={[...REPORT_HEADER_GRADIENT]}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

/** Download/share JPEG only — pixel stripes so ViewShot captures the same light→dark header. */
function ExportReportHeaderSurface({
  style,
  defaultHeight,
  children,
}: {
  style?: object;
  defaultHeight: number;
  children: ReactNode;
}) {
  const [height, setHeight] = useState(defaultHeight);
  const stripeHeight = height / REPORT_HEADER_STRIPE_COUNT;

  return (
    <View
      collapsable={false}
      removeClippedSubviews={false}
      style={[styles.reportHeaderSurface, style]}
      onLayout={(e) => {
        const next = Math.ceil(e.nativeEvent.layout.height);
        if (next > 0 && next !== height) setHeight(next);
      }}
    >
      <View
        collapsable={false}
        pointerEvents="none"
        style={[styles.exportHeaderStripeWrap, { height }]}
      >
        {REPORT_HEADER_STRIPE_COLORS.map((color, i) => (
          <View
            key={`export-header-stripe-${i}`}
            collapsable={false}
            style={{ height: stripeHeight, width: '100%', backgroundColor: color }}
          />
        ))}
      </View>
      {children}
    </View>
  );
}
const SUMMARY_TEXT = '#475569';
const SUMMARY_MUTED = '#64748B';

function toast(msg: string) {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.LONG);
  else Alert.alert('', msg);
}

function unwrapMediaUrl(raw: string): string {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (v.includes('/api/media')) {
    try {
      const parsed = new URL(v, 'http://localhost');
      const inner = parsed.searchParams.get('url');
      if (inner) return unwrapMediaUrl(inner);
      const token = parsed.searchParams.get('token');
      if (token) {
        try {
          const decoded = typeof atob === 'function' ? atob(token) : token;
          if (decoded) return decoded;
        } catch {
          return `token:${token}`;
        }
      }
      const k = parsed.searchParams.get('k');
      if (k) return k;
    } catch {
      /* keep original */
    }
  }
  return v;
}

function mediaFingerprint(raw: string): string {
  const v = unwrapMediaUrl(raw);
  if (!v) return '';
  if (v.startsWith('data:image/')) return `data:${v.length}:${v.slice(-80)}`;
  try {
    const parsed = new URL(v, 'http://localhost');
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, '').toLowerCase();
    const host = parsed.hostname.toLowerCase();
    if (path.includes('/api/media')) {
      const mark = parsed.searchParams.get('k') || parsed.searchParams.get('token') || parsed.searchParams.get('url') || parsed.search;
      return `media:${mark}`;
    }
    if (host && host !== 'localhost') return `${host}${path}`;
    return path || v.replace(/\?.*$/, '').toLowerCase();
  } catch {
    return v.replace(/\?.*$/, '').toLowerCase();
  }
}

function displayImageUri(url: string, fieldKey: string) {
  const resolved = resolveMediaUrl(url);
  const mark = encodeURIComponent(fieldKey || 'photo');
  return resolved.includes('#') ? `${resolved}-${mark}` : `${resolved}#${mark}`;
}

function isImageValue(v: string) {
  const s = String(v || '').trim();
  if (!s || s === SAMPLE_PHOTO) return false;
  if (/^captured_photo_/i.test(s) && !s.startsWith('http') && !s.startsWith('file:') && !s.includes('/')) return false;
  return (
    s.startsWith('http') ||
    s.startsWith('/uploads') ||
    s.includes('/api/media') ||
    s.startsWith('inspection/') ||
    s.startsWith('data:image/') ||
    s.startsWith('file:') ||
    s.includes('offline_images') ||
    /\.(jpg|jpeg|png|webp)$/i.test(s)
  );
}

function matchWorkField(fields: FieldDefinition[], key: string, categoryId?: string): FieldDefinition | undefined {
  const k = String(key || '').trim().toLowerCase();
  if (!k) return undefined;
  const matches = (f: FieldDefinition) =>
    [f.id, f.fieldName, f.nameEn, f.nameTa, f.fieldNameTa].some((x) => String(x || '').trim().toLowerCase() === k);
  const inCat = categoryId ? fields.filter((f) => !f.categoryId || f.categoryId === categoryId) : fields;
  return inCat.find(matches) || fields.find(matches);
}

function localizedFieldLabel(field: FieldDefinition | undefined, isTamil: boolean, fallback: string): string {
  if (isTamil && field) {
    const ta = String(field.nameTa || field.fieldNameTa || '').trim();
    if (ta) return prettyLabel(ta) || ta;
  }
  if (field) {
    const en = String(field.nameEn || field.fieldName || '').trim();
    if (en) return prettyLabel(en) || en;
  }
  return prettyLabel(fallback) || fallback;
}

function prettyLabel(raw: string) {
  return raw.replace(/[_-]/g, ' ').replace(/photo field\s*:?\s*/i, '').trim();
}

function formatWardLabel(isTamil: boolean, wardNumber: string | number) {
  const raw = String(wardNumber ?? '').trim();
  if (!raw) return isTamil ? 'வார்டு —' : 'Ward —';
  const stripped = raw
    .replace(/^(ward|w)\s*[#:]?\s*/i, '')
    .replace(/^வார்டு\s*[#:]?\s*/i, '')
    .trim();
  const num = stripped || raw;
  return isTamil ? `வார்டு ${num}` : `Ward ${num}`;
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

type MediaLibraryLegacy = typeof import('expo-media-library/legacy');

let mediaLibraryMod: MediaLibraryLegacy | null | undefined;

function getMediaLibrary(): MediaLibraryLegacy | null {
  if (mediaLibraryMod !== undefined) return mediaLibraryMod;
  try {
    // Load the legacy native module only. `expo-media-library` default export is
    // ExpoMediaLibraryNext, which is not in Expo Go and crashes on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mediaLibraryMod = require('expo-media-library/legacy') as MediaLibraryLegacy;
  } catch {
    mediaLibraryMod = null;
  }
  return mediaLibraryMod;
}

async function saveToGallery(uri: string): Promise<'saved' | 'denied' | 'unavailable'> {
  const MediaLibrary = getMediaLibrary();
  if (!MediaLibrary) return 'unavailable';
  try {
    if (MediaLibrary.requestPermissionsAsync) {
      const perm = await MediaLibrary.requestPermissionsAsync(true);
      if (!perm?.granted) return 'denied';
    }
    if (MediaLibrary.saveToLibraryAsync) {
      await MediaLibrary.saveToLibraryAsync(uri);
      return 'saved';
    }
    if (MediaLibrary.createAssetAsync) {
      await MediaLibrary.createAssetAsync(uri);
      return 'saved';
    }
    return 'unavailable';
  } catch {
    return 'unavailable';
  }
}

async function copyToExports(uri: string, filename: string) {
  const dir = `${FileSystem.documentDirectory}exports`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}/${filename}`;
  const exists = await FileSystem.getInfoAsync(dest);
  if (exists.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

async function shareOrSave(uri: string, mimeType: string, filename: string, save: boolean, isTamil: boolean) {
  if (save) {
    const result = await saveToGallery(uri);
    if (result === 'saved') {
      toast(isTamil ? 'படம் தொலைபேசி கேலரியில் சேமிக்கப்பட்டது' : 'Saved to phone gallery');
      return;
    }
    if (result === 'denied') {
      toast(isTamil ? 'கேலரியில் சேமிக்க அனுமதி தேவை' : 'Permission is required to save to the photo gallery');
      return;
    }
    await copyToExports(uri, filename);
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

function ImageCaption({ label, count }: { label: string; count?: string }) {
  return (
    <View style={styles.captionBar}>
      <Text style={styles.captionText} numberOfLines={2}>
        {count ? `${label}  ${count}` : label}
      </Text>
    </View>
  );
}

function ExportPhotoTile({
  item,
  captionHeight,
  imageCount,
  index,
  onImageLoad,
}: {
  item: { url: string; name: string; fieldKey: string };
  captionHeight: number;
  imageCount: number;
  index: number;
  onImageLoad: () => void;
}) {
  return (
    <View style={styles.exportTile}>
      <View style={styles.exportTileWell}>
        <Image
          key={`tile-${item.fieldKey}-${mediaFingerprint(item.url)}`}
          source={{ uri: displayImageUri(item.url, item.fieldKey) }}
          style={styles.exportTileImg}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={onImageLoad}
          onError={onImageLoad}
        />
      </View>
      <View style={[styles.exportTileCaption, { height: captionHeight }]}>
        <Text style={styles.exportTileCaptionTxt} numberOfLines={1}>
          {imageCount > 1 ? `${item.name}  ${index + 1}/${imageCount}` : item.name}
        </Text>
      </View>
    </View>
  );
}

function ExportPhotoRow({
  items,
  startIndex,
  imageCount,
  onImageLoad,
  captionHeight,
  centerSingle,
}: {
  items: { url: string; name: string; fieldKey: string }[];
  startIndex: number;
  imageCount: number;
  onImageLoad: () => void;
  captionHeight: number;
  centerSingle?: boolean;
}) {
  if (items.length === 1 && centerSingle) {
    return (
      <View style={styles.exportRow}>
        <View style={styles.exportRowSide} />
        <View style={styles.exportRowMain}>
          <ExportPhotoTile
            item={items[0]}
            index={startIndex}
            imageCount={imageCount}
            captionHeight={captionHeight}
            onImageLoad={onImageLoad}
          />
        </View>
        <View style={styles.exportRowSide} />
      </View>
    );
  }

  return (
    <View style={styles.exportRow}>
      {items.map((item, i) => (
        <View key={`export-${item.fieldKey}-${startIndex + i}`} style={styles.exportRowSlot}>
          <ExportPhotoTile
            item={item}
            index={startIndex + i}
            imageCount={imageCount}
            captionHeight={captionHeight}
            onImageLoad={onImageLoad}
          />
        </View>
      ))}
    </View>
  );
}

/** Download/share report only — photo grid fills the same height as the details table. */
function ExportPhotoFrame({
  images,
  isTamil,
  onImageLoad,
  height,
}: {
  images: { url: string; name: string; fieldKey: string }[];
  isTamil: boolean;
  onImageLoad: () => void;
  height: number;
}) {
  const frameStyle = [styles.exportPhotoFrame, { height, minHeight: height }];
  if (!images.length) {
    return (
      <View style={[frameStyle, styles.exportPhotoFrameEmpty]}>
        <Text style={styles.emptyTxt}>{isTamil ? 'புகைப்படம் இல்லை' : 'No photo attached'}</Text>
      </View>
    );
  }

  const captionH = images.length === 1 ? EXPORT_CAPTION_H_SINGLE : EXPORT_CAPTION_H;

  if (images.length === 1) {
    return (
      <View style={frameStyle}>
        <ExportPhotoTile item={images[0]} index={0} imageCount={1} captionHeight={captionH} onImageLoad={onImageLoad} />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View style={frameStyle}>
        <ExportPhotoRow items={images} startIndex={0} imageCount={2} captionHeight={captionH} onImageLoad={onImageLoad} />
      </View>
    );
  }

  if (images.length === 3) {
    return (
      <View style={frameStyle}>
        <View style={styles.exportStack}>
          <ExportPhotoRow
            items={[images[0], images[1]]}
            startIndex={0}
            imageCount={3}
            captionHeight={captionH}
            onImageLoad={onImageLoad}
          />
          <ExportPhotoRow
            items={[images[2]]}
            startIndex={2}
            imageCount={3}
            captionHeight={captionH}
            onImageLoad={onImageLoad}
            centerSingle
          />
        </View>
      </View>
    );
  }

  const pairs: { url: string; name: string; fieldKey: string }[][] = [];
  for (let i = 0; i < images.length; i += 2) {
    pairs.push(images.slice(i, i + 2));
  }

  return (
    <View style={frameStyle}>
      <View style={styles.exportStack}>
        {pairs.map((row, ri) => (
          <ExportPhotoRow
            key={`export-pair-${row.map((x) => x.fieldKey).join('-')}`}
            items={row}
            startIndex={ri * 2}
            imageCount={images.length}
            captionHeight={captionH}
            onImageLoad={onImageLoad}
            centerSingle={row.length === 1}
          />
        ))}
      </View>
    </View>
  );
}

function DetailSummaryBody({
  isTamil,
  place,
  wardNumber,
  streetLabel,
  subjectName,
  categoryName,
  submitted,
  gps,
  variant = 'screen',
}: {
  isTamil: boolean;
  place: string;
  wardNumber: number | string;
  streetLabel: string;
  subjectName: string;
  categoryName: string;
  submitted: string;
  gps: string;
  variant?: 'screen' | 'brandHeader';
}) {
  const isBrandHeader = variant === 'brandHeader';
  const wardLabel = formatWardLabel(isTamil, wardNumber);
  const street = streetLabel?.trim() || '';
  const subjectCategory = [subjectName?.trim(), categoryName?.trim()].filter(Boolean).join(' · ');
  const wardLine = street ? `${wardLabel} · ${street}` : wardLabel;
  const metaLine = `${submitted} · ${gps}`;

  const headerRow = (line: 1 | 2 | 3 | 4) => {
    if (!isBrandHeader) return undefined;
    if (line === 1) return styles.sumHeaderRow1;
    if (line === 2) return styles.sumHeaderRow2;
    if (line === 3) return styles.sumHeaderRow3;
    return styles.sumHeaderRow4;
  };

  if (isBrandHeader) {
    return (
      <View style={[styles.detailSummaryBody, styles.detailSummaryBodyTight]}>
        {!!subjectCategory && (
          <Text style={headerRow(1)} numberOfLines={1}>
            {subjectCategory}
          </Text>
        )}
        {!!place && (
          <Text style={headerRow(2)} numberOfLines={1}>
            {place}
          </Text>
        )}
        <Text style={headerRow(3)} numberOfLines={1}>
          {wardLine}
          {!!metaLine && <Text style={headerRow(4)}>{`  ·  ${metaLine}`}</Text>}
        </Text>
      </View>
    );
  }

  const subLine = subjectCategory;
  const wardStreet = wardLine;

  return (
    <View style={styles.detailSummaryBody}>
      {!!place && (
        <Text style={styles.sumPlace} numberOfLines={2}>
          {place}
        </Text>
      )}
      <Text style={styles.sumPrimary} numberOfLines={3}>
        {wardStreet}
      </Text>
      {!!subLine && (
        <Text style={styles.sumSecondary} numberOfLines={2}>
          {subLine}
        </Text>
      )}
      <Text style={styles.sumMeta} numberOfLines={1}>
        {metaLine}
      </Text>
    </View>
  );
}

function ExportLocationMapThumb({
  mapUri,
  onLoad,
}: {
  mapUri?: string | null;
  onLoad: () => void;
}) {
  useEffect(() => {
    if (!mapUri) onLoad();
  }, [mapUri, onLoad]);

  return (
    <View style={styles.exportHeaderMapWrap} collapsable={false}>
      {mapUri ? (
        <>
          <Image
            source={{ uri: mapUri }}
            style={styles.exportHeaderMapImg}
            resizeMode="cover"
            fadeDuration={0}
            onLoad={onLoad}
            onError={onLoad}
          />
          <View style={styles.exportMapPinOverlay} pointerEvents="none">
            <Ionicons name="location" size={18} color="#DC2626" />
          </View>
        </>
      ) : (
        <LinearGradient
          colors={['#7CBA6B', '#4A8F3C', '#2F6B2A', '#8B6B3A']}
          locations={[0, 0.38, 0.7, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.exportHeaderMapImg}
        >
          <View style={styles.exportMapRoadH} />
          <View style={styles.exportMapRoadV} />
          <View style={styles.exportMapPin}>
            <Ionicons name="location" size={18} color="#DC2626" />
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

/** Download/share report header only (ViewShot capture). */
function ExportReportHeader({
  isTamil,
  place,
  wardNumber,
  streetLabel,
  subjectName,
  categoryName,
  submitted,
  latitude,
  longitude,
  mapUri,
  onMapLoad,
  officerPhotoUri,
  officerName,
  officerDesignation,
  onOfficerLoad,
}: {
  isTamil: boolean;
  place: string;
  wardNumber: number | string;
  streetLabel: string;
  subjectName: string;
  categoryName: string;
  submitted: string;
  latitude: number;
  longitude: number;
  mapUri?: string | null;
  onMapLoad: () => void;
  officerPhotoUri?: string | null;
  officerName: string;
  officerDesignation: string;
  onOfficerLoad: () => void;
}) {
  const wardLabel = formatWardLabel(isTamil, wardNumber);
  const street = streetLabel?.trim() || '';
  const wardLine = street ? `${wardLabel} · ${street}` : wardLabel;
  const subjectCategory = [subjectName?.trim(), categoryName?.trim()].filter(Boolean).join(' · ');
  const latText = Number(latitude || 0).toFixed(5);
  const lonText = Number(longitude || 0).toFixed(5);
  const dateGpsLine = [submitted, `${latText}, ${lonText}`].filter(Boolean).join('  ·  ');

  return (
    <ExportReportHeaderSurface style={styles.exportSummaryHeader} defaultHeight={76}>
      <View style={styles.exportHeaderRow} collapsable={false}>
        <View style={styles.exportHeaderLogoPlate} collapsable={false}>
          <BrandImage kind="logo" style={styles.exportHeaderLogo} />
        </View>
        <View style={styles.exportHeaderContentCentered} collapsable={false}>
          {!!subjectCategory && (
            <Text style={styles.exportHeadLine1} numberOfLines={2}>
              {subjectCategory}
            </Text>
          )}
          {!!place && (
            <Text style={styles.exportHeadLine2} numberOfLines={2}>
              {place}
            </Text>
          )}
          <Text style={styles.exportHeadLine3} numberOfLines={1}>
            {wardLine}
            {!!dateGpsLine && <Text style={styles.exportHeadLine4}>{`  ·  ${dateGpsLine}`}</Text>}
          </Text>
        </View>
        <View style={styles.exportHeaderRight} collapsable={false}>
          <ExportLocationMapThumb mapUri={mapUri} onLoad={onMapLoad} />
          <ExportOfficerBlock
            isTamil={isTamil}
            photoUri={officerPhotoUri}
            name={officerName}
            designation={officerDesignation}
            onLoad={onOfficerLoad}
          />
        </View>
      </View>
    </ExportReportHeaderSurface>
  );
}

function ExportOfficerBlock({
  isTamil,
  photoUri,
  name,
  designation,
  onLoad,
}: {
  isTamil?: boolean;
  photoUri?: string | null;
  name: string;
  designation: string;
  onLoad: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUri && !failed;
  const letter = (name || 'U').trim().slice(0, 1).toUpperCase() || 'U';

  useEffect(() => {
    if (!photoUri) onLoad();
  }, [photoUri, onLoad]);

  return (
    <View style={styles.exportOfficerInner} collapsable={false}>
      {showPhoto ? (
        <Image
          source={{ uri: photoUri }}
          style={styles.exportOfficerImg}
          resizeMode="cover"
          fadeDuration={0}
          onLoad={onLoad}
          onError={() => {
            setFailed(true);
            onLoad();
          }}
        />
      ) : (
        <LinearGradient
          colors={['#1A3D66', '#288C46']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.exportOfficerLetter}
        >
          <Text style={styles.exportOfficerLetterTxt}>{letter}</Text>
        </LinearGradient>
      )}
      <Text style={styles.exportOfficerName} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.exportOfficerRole} numberOfLines={1}>
        {designation || (isTamil ? 'களப் பணியாளர்' : 'Field worker')}
      </Text>
    </View>
  );
}

function ReportFooterBar({
  isTamil,
  busy,
  palette,
  onDownload,
  onShare,
}: {
  isTamil: boolean;
  busy: 'image' | 'report' | null;
  palette?: AppPalette;
  onDownload: () => void;
  onShare: () => void;
}) {
  const insets = useSafeAreaInsets();
  const theme = (palette ?? getPaletteById(DEFAULT_PALETTE_ID)).primary;

  return (
    <View style={[styles.reportFooter, { paddingBottom: Math.max(insets.bottom, 6) }]}>
      <Pressable
        onPress={onDownload}
        style={({ pressed }) => [
          styles.reportFooterBtn,
          styles.reportFooterBtnOutline,
          { borderColor: theme },
          pressed && styles.reportFooterBtnPressed,
        ]}
        disabled={!!busy}
      >
        {busy === 'report' ? (
          <ActivityIndicator size="small" color={theme} />
        ) : (
          <>
            <Ionicons name="download-outline" size={14} color={theme} />
            <Text
              style={[styles.reportFooterBtnTextOutline, { color: theme }, isTamil && styles.reportFooterBtnTextTa]}
              numberOfLines={1}
            >
              {isTamil ? 'அறிக்கை பதிவிறக்கம்' : 'Download report'}
            </Text>
          </>
        )}
      </Pressable>
      <Pressable
        onPress={onShare}
        style={({ pressed }) => [
          styles.reportFooterBtn,
          styles.reportFooterBtnPrimary,
          { backgroundColor: theme },
          pressed && styles.reportFooterBtnPressed,
        ]}
        disabled={!!busy}
      >
        <Ionicons name="share-outline" size={14} color="#fff" />
        <Text style={[styles.reportFooterBtnTextPrimary, isTamil && styles.reportFooterBtnTextTa]} numberOfLines={1}>
          {isTamil ? 'அறிக்கை பகிர்வு' : 'Share report'}
        </Text>
      </Pressable>
    </View>
  );
}

export function WorkDetailModal({
  work,
  portal,
  isTamil,
  palette,
  streetLabel,
  onClose,
}: {
  work: InspectionWork;
  portal: PortalState;
  isTamil: boolean;
  palette?: AppPalette;
  streetLabel: string;
  onClose: () => void;
}) {
  const { user } = useApp();
  const resolvedPalette = palette ?? getPaletteById(DEFAULT_PALETTE_ID);
  const insets = useSafeAreaInsets();
  const exportRef = useRef<ViewShotRef>(null);
  const exportLoadedCount = useRef(0);
  const exportLaidOut = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState<'image' | 'report' | null>(null);
  const [idx, setIdx] = useState(0);
  const [photoReady, setPhotoReady] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [exportCapturing, setExportCapturing] = useState(false);
  const [exportColH, setExportColH] = useState(EXPORT_PHOTO_H);
  const [exportMapUri, setExportMapUri] = useState<string | null>(null);
  const [exportOfficerUri, setExportOfficerUri] = useState<string | null>(null);

  const images = useMemo(() => {
    const list: { url: string; name: string; fieldKey: string }[] = [];
    const fields = portalFields(portal);
    const resolveName = (key: string) => localizedFieldLabel(matchWorkField(fields, key, work.categoryId), isTamil, key);
    Object.entries(work.fieldsData || {}).forEach(([key, value]) => {
      const v = String(value || '');
      if (isImageValue(v)) list.push({ url: v, name: resolveName(key), fieldKey: key });
    });
    if (work.imageUrl && isImageValue(String(work.imageUrl))) {
      const primaryKey = mediaFingerprint(work.imageUrl);
      const i = list.findIndex((x) => mediaFingerprint(x.url) === primaryKey);
      if (i < 0) {
        list.push({
          url: work.imageUrl,
          name: isTamil ? 'கள ஆய்வு புகைப்படம்' : 'Field photo',
          fieldKey: '__imageUrl__',
        });
      }
    }
    const unique = list.filter((x, i, a) => a.findIndex((y) => mediaFingerprint(y.url) === mediaFingerprint(x.url)) === i);
    return unique
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rank = fieldOrderIndex(fields, a.item.fieldKey, work.categoryId) - fieldOrderIndex(fields, b.item.fieldKey, work.categoryId);
        return rank !== 0 ? rank : a.index - b.index;
      })
      .map((x) => x.item);
  }, [work, portal, isTamil]);

  const fieldRows = useMemo(() => {
    const fields = portalFields(portal);
    return Object.entries(work.fieldsData || {})
      .map(([key, value], index) => {
        const v = String(value ?? '').trim();
        if (!v || isImageValue(v)) return null;
        const label = localizedFieldLabel(matchWorkField(fields, key, work.categoryId), isTamil, key);
        return { key, label, value: v, index };
      })
      .filter((row): row is { key: string; label: string; value: string; index: number } => !!row)
      .sort((a, b) => {
        const rank = fieldOrderIndex(fields, a.key, work.categoryId) - fieldOrderIndex(fields, b.key, work.categoryId);
        return rank !== 0 ? rank : a.index - b.index;
      })
      .map(({ key, label, value }) => ({ key, label, value }));
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
  const headerPlace = [locTp, locZone, locDistrict].filter(Boolean).join(' · ');
  const resolvedStreet = streetLabel?.trim() || String(work.streetName || '').trim();

  const markExportImageLoaded = useCallback(() => {
    exportLoadedCount.current += 1;
    if (exportLoadedCount.current >= images.length) setExportReady(true);
  }, [images.length]);

  useEffect(() => {
    exportLoadedCount.current = 0;
    setExportReady(images.length === 0);
  }, [images]);

  const mapsApiKey = String(portal.settings?.googleMapsApiKey || '').trim();
  const officerName = (
    isTamil
      ? user?.nameTa || user?.name || user?.nameEn || work.submittedByUserName
      : user?.name || user?.nameEn || work.submittedByUserName
  )?.trim() || '';
  const officerDesignation =
    resolveOfficerDesignation(user, portal, isTamil) || (isTamil ? 'களப் பணியாளர்' : 'Field worker');

  useEffect(() => {
    let live = true;
    setExportMapUri(null);
    void downloadLocationMap(Number(work.latitude || 0), Number(work.longitude || 0), mapsApiKey).then((uri) => {
      if (live) setExportMapUri(uri);
    });
    return () => {
      live = false;
    };
  }, [work.latitude, work.longitude, work.id, mapsApiKey]);

  useEffect(() => {
    let live = true;
    setExportOfficerUri(null);
    void downloadOfficerPhoto(effectivePhotoUrl(user)).then((uri) => {
      if (live) setExportOfficerUri(uri);
    });
    return () => {
      live = false;
    };
  }, [user?.id, user?.profilePhotoUrl, user?.avatarUrl, user?.profileImage]);

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

      const stamp = Date.now();
      exportLoadedCount.current = 0;
      setExportColH(EXPORT_PHOTO_H);
      let mapUri = exportMapUri;
      if (!mapUri) {
        mapUri = await downloadLocationMap(Number(work.latitude || 0), Number(work.longitude || 0), mapsApiKey);
        setExportMapUri(mapUri);
      }
      let officerUri = exportOfficerUri;
      if (!officerUri) {
        officerUri = await downloadOfficerPhoto(effectivePhotoUrl(user));
        setExportOfficerUri(officerUri);
      }
      const laidOut = new Promise<void>((resolve) => {
        exportLaidOut.current = resolve;
      });
      setExportCapturing(true);
      await Promise.race([laidOut, new Promise<void>((r) => setTimeout(r, 900))]);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      {
        const needed = images.length + 2;
        const started = Date.now();
        while (exportLoadedCount.current < needed && Date.now() - started < 6000) {
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      await new Promise((r) => setTimeout(r, 280));
      let captured: string;
      try {
        captured = await captureRef(exportRef, {
          format: 'jpg',
          quality: 0.95,
          result: 'tmpfile',
          fileName: `inspection_${stamp}`,
          width: EXPORT_W,
        });
      } finally {
        exportLaidOut.current = null;
        setExportCapturing(false);
      }
      const filename = `inspection_${safeFilePart(workRef)}_${stamp}.jpg`;
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
        <StatusBar style="dark" />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          bounces={false}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <View style={styles.sheet}>
            <ReportHeaderSurface style={[styles.detailHeader, { paddingTop: insets.top }]}>
              <DetailSummaryBody
                variant="brandHeader"
                isTamil={isTamil}
                place={headerPlace}
                wardNumber={work.wardNumber}
                streetLabel={resolvedStreet}
                subjectName={subjectName || ''}
                categoryName={categoryName || ''}
                submitted={submitted}
                gps={gps}
              />
            </ReportHeaderSurface>

            <View style={styles.photoWrap}>
              {current ? (
                <View style={styles.photoCard}>
                  <View style={styles.photoFrame}>
                    {images.map((img, i) =>
                      i === idx ? (
                        <Image
                          key={`detail-${img.fieldKey}-${mediaFingerprint(img.url)}`}
                          source={{ uri: displayImageUri(img.url, img.fieldKey) }}
                          style={styles.photo}
                          resizeMode="contain"
                          fadeDuration={0}
                          onLoad={() => setPhotoReady(true)}
                          onError={() => setPhotoReady(true)}
                        />
                      ) : null,
                    )}
                    <View style={styles.photoActions}>
                      <Pressable
                        onPress={() => void run('image', true)}
                        style={styles.photoActionBtn}
                        disabled={!!busy}
                        hitSlop={6}
                      >
                        {busy === 'image' ? (
                          <ActivityIndicator size="small" color="#1A3D66" />
                        ) : (
                          <Ionicons name="download-outline" size={13} color="#1A3D66" />
                        )}
                      </Pressable>
                      <Pressable
                        onPress={() => void run('image', false)}
                        style={styles.photoActionBtn}
                        disabled={!!busy}
                        hitSlop={6}
                      >
                        <Ionicons name="share-outline" size={13} color="#1A3D66" />
                      </Pressable>
                    </View>
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
                    <ImageCaption
                      label={photoLabel}
                      count={images.length > 1 ? `${idx + 1}/${images.length}` : undefined}
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.photoCard}>
                  <View style={styles.photoEmpty}>
                    <Ionicons name="image-outline" size={32} color="#CBD5E1" />
                    <Text style={styles.emptyTxt}>{isTamil ? 'புகைப்படம் இல்லை' : 'No photo attached'}</Text>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.tablePad}>
              <Text style={styles.tableTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
              <View style={styles.table}>
                <View style={styles.thead}>
                  <Text style={[styles.th, { flex: 1.65 }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                  <View style={styles.colSplit} />
                  <Text style={[styles.th, { flex: 1 }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                </View>
                {fieldRows.length ? (
                  fieldRows.map((r, i) => (
                    <View key={r.key} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                      <Text style={[styles.tdL, { flex: 1.65 }]}>{r.label}</Text>
                      <View style={styles.colSplit} />
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
        </ScrollView>
        <ReportFooterBar
          isTamil={isTamil}
          busy={busy}
          palette={resolvedPalette}
          onDownload={() => void run('report', true)}
          onShare={() => void run('report', false)}
        />
        {exportCapturing ? (
          <>
            <View pointerEvents="none" style={styles.exportCaptureMask} />
            <View pointerEvents="none" style={styles.exportCaptureStage}>
              <ViewShot
                ref={exportRef}
                options={{ format: 'jpg', quality: 0.95 }}
                style={styles.landscapeSheet}
              >
          <View
            collapsable={false}
            style={styles.exportSheet}
            removeClippedSubviews={false}
            onLayout={() => {
              exportLaidOut.current?.();
              exportLaidOut.current = null;
            }}
          >
            <ExportReportHeader
              key={`export-header-${work.id}-${resolvedStreet}`}
              isTamil={isTamil}
              place={headerPlace}
              wardNumber={work.wardNumber}
              streetLabel={resolvedStreet}
              subjectName={subjectName || ''}
              categoryName={categoryName || ''}
              submitted={submitted}
              latitude={Number(work.latitude || 0)}
              longitude={Number(work.longitude || 0)}
              mapUri={exportMapUri}
              onMapLoad={markExportImageLoaded}
              officerPhotoUri={exportOfficerUri}
              officerName={officerName}
              officerDesignation={officerDesignation}
              onOfficerLoad={markExportImageLoaded}
            />
            <View style={styles.landBody}>
              <View style={[styles.landPhotoExport, { height: exportColH }]} collapsable={false}>
                <ExportPhotoFrame
                  images={images}
                  isTamil={isTamil}
                  height={exportColH}
                  onImageLoad={markExportImageLoaded}
                />
              </View>
              <View style={[styles.exportSplit, { height: exportColH }]} collapsable={false} />
              <View style={[styles.landTable, { height: exportColH }]} collapsable={false}>
                <View
                  collapsable={false}
                  onLayout={(e) => {
                    const h = Math.ceil(e.nativeEvent.layout.height);
                    setExportColH((prev) => Math.max(EXPORT_PHOTO_H, prev, h));
                  }}
                >
                  <Text style={styles.tableTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
                  <View style={styles.table}>
                    <View style={styles.thead}>
                      <Text style={[styles.th, { flex: 1.65 }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                      <View style={styles.colSplit} />
                      <Text style={[styles.th, { flex: 1 }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                    </View>
                    {fieldRows.length ? (
                      fieldRows.map((r, i) => (
                        <View key={`ex-${r.key}`} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
                          <Text style={[styles.tdL, { flex: 1.65 }]}>{r.label}</Text>
                          <View style={styles.colSplit} />
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
            </View>
            <View style={styles.exportFooterRule} collapsable={false} />
          </View>
              </ViewShot>
            </View>
          </>
        ) : null}
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#EEF2F6' },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 0, paddingBottom: 8, flexGrow: 1 },
  reportHeaderSurface: { overflow: 'hidden', position: 'relative' },
  reportHeaderBands: { ...StyleSheet.absoluteFill, flexDirection: 'column' },
  reportHeaderBand: { flex: 1 },
  detailHeader: {
    paddingHorizontal: 8,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: CAPTION_BORDER,
  },
  detailSummaryBody: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 2,
    gap: 3,
  },
  detailSummaryBodyTight: {
    gap: 0,
    paddingHorizontal: 0,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
    zIndex: 20,
    elevation: 12,
  },
  reportFooterBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 36,
  },
  reportFooterBtnPressed: { opacity: 0.88 },
  reportFooterBtnOutline: {
    backgroundColor: '#fff',
    borderWidth: 1,
  },
  reportFooterBtnPrimary: {},
  reportFooterBtnTextOutline: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  reportFooterBtnTextPrimary: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    flexShrink: 1,
  },
  reportFooterBtnTextTa: {
    fontSize: 10,
    lineHeight: 13,
  },
  sheet: {
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  landscapeSheet: {
    width: EXPORT_W,
    backgroundColor: '#fff',
    transformOrigin: 'top left',
    transform: [{ scale: EXPORT_FIT_SCALE }],
  },
  exportCaptureStage: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  exportCaptureMask: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#EEF2F6',
    zIndex: 40,
  },
  exportHeaderStripeWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 0,
  },
  exportSheet: {
    width: '100%',
    backgroundColor: '#fff',
  },
  exportSummaryHeader: {
    position: 'relative',
    paddingVertical: 8,
    paddingHorizontal: 10,
    minHeight: 76,
    width: '100%',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: CAPTION_BORDER,
  },
  exportHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    zIndex: 1,
  },
  exportHeaderLogoPlate: {
    width: 56,
    height: 58,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    flexShrink: 0,
  },
  exportHeaderLogo: {
    width: 48,
    height: 50,
  },
  exportHeaderContentCentered: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  exportHeadLine1: {
    width: '100%',
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  exportHeadLine2: {
    width: '100%',
    marginTop: 3,
    marginBottom: 1,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    color: REPORT_AMBER,
    letterSpacing: 0.25,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  exportHeadLine3: {
    width: '100%',
    marginTop: 2,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  exportHeadLine4: {
    width: '100%',
    marginTop: 2,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 0.15,
    textAlign: 'center',
  },
  exportHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 8,
  },
  exportOfficerInner: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    paddingHorizontal: 1,
  },
  exportOfficerImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E2E8F0',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
  },
  exportOfficerLetter: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportOfficerLetterTxt: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800',
    color: '#fff',
  },
  exportOfficerName: {
    width: '100%',
    marginTop: 1,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  exportOfficerRole: {
    width: '100%',
    marginTop: 0,
    fontSize: 7,
    lineHeight: 9,
    fontWeight: '700',
    color: REPORT_AMBER,
    textAlign: 'center',
  },
  exportHeaderMapWrap: {
    width: 56,
    height: 56,
    borderRadius: 7,
    overflow: 'hidden',
    backgroundColor: '#4A8F3C',
    borderWidth: 1,
    borderColor: '#fff',
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportHeaderMapImg: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportMapRoadH: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 26,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  exportMapRoadV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 22,
    width: 3,
    backgroundColor: 'rgba(255,230,180,0.45)',
  },
  exportMapPinOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  exportMapPin: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  landBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: '#fff',
    minHeight: EXPORT_PHOTO_H,
  },
  landPhotoExport: {
    width: '58%',
    minHeight: EXPORT_PHOTO_H,
    alignSelf: 'stretch',
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  exportSplit: {
    width: 3,
    backgroundColor: REPORT_GREEN,
  },
  exportFooterRule: {
    width: '100%',
    height: 3,
    backgroundColor: REPORT_GREEN,
  },
  exportPhotoFrame: {
    width: '100%',
    padding: EXPORT_PHOTO_PAD,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  exportPhotoFrameEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REPORT_AMBER,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: CAPTION_BORDER,
  },
  exportTileCaptionTxt: {
    width: '100%',
    fontSize: 9,
    fontWeight: '800',
    color: CAPTION_BROWN,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  landTable: {
    width: '42%',
    padding: 10,
    backgroundColor: '#F8FAFC',
  },
  sumPlace: {
    width: '100%',
    fontSize: 13,
    fontWeight: '800',
    color: SUMMARY_NAVY,
    lineHeight: 17,
    textAlign: 'center',
  },
  sumPrimary: {
    width: '100%',
    fontSize: 13,
    fontWeight: '800',
    color: SUMMARY_NAVY,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  sumSecondary: {
    width: '100%',
    fontSize: 12,
    fontWeight: '700',
    color: SUMMARY_TEXT,
    lineHeight: 16,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  sumMeta: {
    width: '100%',
    marginTop: 1,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: SUMMARY_MUTED,
    textAlign: 'center',
  },
  sumHeaderRow1: {
    width: '100%',
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  sumHeaderRow2: {
    width: '100%',
    marginTop: 1,
    marginBottom: 0,
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '900',
    color: REPORT_AMBER,
    letterSpacing: 0.2,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sumHeaderRow3: {
    width: '100%',
    marginTop: 1,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  sumHeaderRow4: {
    width: '100%',
    marginTop: 0,
    fontSize: 8,
    lineHeight: 10,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
  photoWrap: { paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6 },
  photoCard: {
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  photoFrame: { position: 'relative', overflow: 'hidden', backgroundColor: '#0B1220' },
  photoActions: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  photoActionBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: REPORT_AMBER,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(26, 61, 102, 0.12)',
  },
  captionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: REPORT_AMBER,
    borderTopWidth: 1,
    borderTopColor: CAPTION_BORDER,
  },
  captionText: {
    width: '100%',
    fontSize: 11,
    fontWeight: '800',
    color: CAPTION_BROWN,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  photo: { width: '100%', height: 260, backgroundColor: '#0B1220' },
  photoEmpty: { height: 120, alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F8FAFC' },
  emptyTxt: { color: '#94A3B8', fontSize: 12, fontWeight: '600', textAlign: 'center', padding: 12 },
  nav: { position: 'absolute', top: 112, backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 14, padding: 5 },
  tablePad: { paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8, backgroundColor: '#F8FAFC' },
  tableTitle: { fontSize: 10, fontWeight: '800', color: '#334155', letterSpacing: 0.5, marginBottom: 6 },
  table: { backgroundColor: '#fff', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' },
  thead: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 0,
    backgroundColor: REPORT_AMBER,
    borderBottomWidth: 2,
    borderBottomColor: CAPTION_BORDER,
  },
  colSplit: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#C2410C',
  },
  th: {
    fontSize: 10,
    fontWeight: '800',
    color: CAPTION_BROWN,
    letterSpacing: 0.4,
    textAlign: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'stretch',
    paddingVertical: 8,
    paddingHorizontal: 0,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  trAlt: { backgroundColor: '#F8FAFC' },
  tdL: { fontSize: 12, fontWeight: '700', color: '#1E3A5F', paddingHorizontal: 8 },
  tdR: { fontSize: 12, fontWeight: '700', color: '#0F172A', paddingHorizontal: 8 },
});

