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
  Share,
  StyleSheet,
  Text,
  ToastAndroid,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ViewShot, { captureRef, type ViewShotRef } from 'react-native-view-shot';
import { api, getApiBaseUrl, isLocalPhotoPath, resolveMediaUrl, resolveProfilePhotoUrl } from '../api/client';
import { SAMPLE_PHOTO } from '../constants/config';
import { useApp } from '../context/AppContext';
import { prefs, profilePhotoFile } from '../storage/preferences';
import { BrandImage } from './BrandImage';
import { ShareCardThemePicker } from './ShareCardThemePicker';
import { type AppPalette } from '../theme/palettes';
import { reportThemeFromId } from '../theme/reportThemes';
import {
  DEFAULT_SHARE_CARD_THEME_ID,
  resolveShareCardPaint,
  shareCardGradient,
  type ShareCardPaint,
} from '../theme/shareCardThemes';
import type { FieldDefinition, InspectionWork, PortalState } from '../types/models';
import { effectivePhotoUrl, portalFields, resolveOfficerDesignation } from '../types/models';
import { formatTo12Hr } from '../utils/dates';
import { fieldOrderIndex } from '../utils/fieldVisibility';
import { htmlToPlain } from '../utils/shareHtml';
import { isShareWithCaptionAvailable, shareFileWithCaption } from 'share-with-caption';

const EXPORT_W = Math.max(960, Math.round(Dimensions.get('window').width * 1.7));
const EXPORT_FIT_SCALE = Math.min(1, Dimensions.get('window').width / EXPORT_W);
const SCREEN_W = Dimensions.get('window').width;
const SCREEN_H = Dimensions.get('window').height;
const PORTRAIT_W = Math.round(Math.max(SCREEN_W, 360));
const PORTRAIT_H = Math.round(Math.max(SCREEN_H * 0.9, PORTRAIT_W * 1.7));
const PORTRAIT_HEADER_MIN_H = 148;
const PORTRAIT_HEADER_H = PORTRAIT_HEADER_MIN_H;
const PORTRAIT_FOOTER_H = 76;
const PORTRAIT_RIBBON_H = 3;
const PORTRAIT_PHOTO_AREA_H = PORTRAIT_H - PORTRAIT_HEADER_H - PORTRAIT_FOOTER_H - PORTRAIT_RIBBON_H * 2;
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

async function downloadOfficerPhoto(raw?: string | null, userKey?: { id?: string; username?: string }): Promise<string | null> {
  const local = profilePhotoFile(userKey);
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
  const key = String(userKey?.id || userKey?.username || 'officer')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_');
  const dest = `${FileSystem.cacheDirectory}officer_profile_${key || 'officer'}.jpg`;
  if (await cachedFileIsImage(dest)) return mapFileUri(dest);
  try {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  } catch {
    /* download fresh */
  }
  const ok = await saveMapUrlToFile(remote, dest);
  return ok ? mapFileUri(dest) : null;
}

const EXPORT_PHOTO_GAP = 8;
const LAND_EXPORT_PAD = 10;
/** Title line + marginBottom under FIELD PHOTOS / DETAILS TABLE */
const LAND_PANE_TITLE_H = 16;
const EXPORT_CAPTION_H = 28;
const EXPORT_CAPTION_H_SINGLE = 34;
const EXPORT_TILE_WELL_MIN = 132;
/** Minimum data rows to show when the table is short (balanced photo + table band). */
const LAND_BODY_MIN_DATA_ROWS = 8;
const LAND_TABLE_HEAD_H = 36;
const LAND_TABLE_DATA_ROW_H = 34;
const LAND_TABLE_CHROME_H = 4;

function estimateLandTableDataHeight(fieldRows: { label: string; value: string }[]): number {
  const lineH = 15;
  const rowPad = 18;
  let rows = 0;
  for (const r of fieldRows) {
    const lines = Math.max(1, Math.ceil(r.label.length / 18), Math.ceil(r.value.length / 16));
    rows += lines * lineH + rowPad;
  }
  if (!fieldRows.length) rows = LAND_TABLE_DATA_ROW_H;
  return rows;
}

function estimateLandTablePaneHeight(fieldRows: { label: string; value: string }[]): number {
  return (
    LAND_EXPORT_PAD * 2 +
    LAND_PANE_TITLE_H +
    LAND_TABLE_HEAD_H +
    estimateLandTableDataHeight(fieldRows) +
    LAND_TABLE_CHROME_H
  );
}

function estimateLandBodyMinPaneHeight(): number {
  return (
    LAND_EXPORT_PAD * 2 +
    LAND_PANE_TITLE_H +
    LAND_TABLE_HEAD_H +
    LAND_BODY_MIN_DATA_ROWS * LAND_TABLE_DATA_ROW_H +
    LAND_TABLE_CHROME_H
  );
}

function landExportPhotoColWidth(): number {
  return Math.round(EXPORT_W * 0.58) - LAND_EXPORT_PAD * 2;
}

function wellHeightFromAspect(slotWidth: number, imgW: number, imgH: number, minH: number): number {
  if (!slotWidth || !imgW || !imgH) return minH;
  return Math.max(minH, Math.ceil(slotWidth * (imgH / imgW)));
}

/** Conservative photo band height before image dimensions are known (contain, no crop). */
function estimateLandPhotoPaneHeight(imageCount: number): number {
  const colW = landExportPhotoColWidth();
  const cap = imageCount === 1 ? EXPORT_CAPTION_H_SINGLE : EXPORT_CAPTION_H;
  const pad = LAND_EXPORT_PAD * 2 + LAND_PANE_TITLE_H;
  if (imageCount <= 0) return pad + 120;
  if (imageCount === 1) return pad + Math.round(colW * 1.05) + cap + 4;
  const slotW = (colW - EXPORT_PHOTO_GAP) / 2;
  const well = Math.round(slotW * 1.05);
  if (imageCount === 2) return pad + well + cap + 4;
  const rows = Math.ceil(imageCount / 2);
  return pad + rows * (well + cap) + Math.max(0, rows - 1) * EXPORT_PHOTO_GAP + 4;
}

function resolveExportLandBodyHeight(
  fieldRows: { label: string; value: string }[],
  measuredPaneH: number,
  imageCount: number,
): number {
  return Math.max(
    measuredPaneH,
    estimateLandTablePaneHeight(fieldRows),
    estimateLandBodyMinPaneHeight(),
    estimateLandPhotoPaneHeight(imageCount),
  );
}

function estimatePortraitPhotoAreaHeight(headerHeight: number): number {
  return Math.max(120, PORTRAIT_H - headerHeight - PORTRAIT_FOOTER_H - PORTRAIT_RIBBON_H * 2);
}
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

function paintStripeColors(colors: string[], count = REPORT_HEADER_STRIPE_COUNT) {
  const from = colors[0] || '#1A1A1A';
  const to = colors[colors.length - 1] || from;
  if (from.toLowerCase() === to.toLowerCase()) return Array.from({ length: count }, () => from);
  return Array.from({ length: count }, (_, i) => lerpHex(from, to, (i + 0.5) / count));
}

function paintTextShadow(enabled: boolean) {
  return enabled
    ? {
        textShadowColor: 'rgba(0,0,0,0.45)',
        textShadowOffset: { width: 0, height: 1 } as const,
        textShadowRadius: 3,
      }
    : {
        textShadowColor: 'transparent',
        textShadowOffset: { width: 0, height: 0 } as const,
        textShadowRadius: 0,
      };
}

function reportHeaderGradientColor(
  t: number,
  stops: readonly [string, string, string] = REPORT_HEADER_GRADIENT,
) {
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

type ReportThemeColors = {
  headerFrom: string;
  headerMid: string;
  headerTo: string;
  accent: string;
  highlight: string;
  tableHeader: string;
  tableHeaderText: string;
  pageBackground: string;
  messageBackground: string;
  messageText: string;
  caption: string;
};

const FALLBACK_REPORT_THEME: ReportThemeColors = {
  headerFrom: REPORT_HEADER_GRADIENT[0],
  headerMid: REPORT_HEADER_GRADIENT[1],
  headerTo: REPORT_HEADER_GRADIENT[2],
  accent: SUMMARY_NAVY,
  highlight: REPORT_AMBER,
  tableHeader: REPORT_AMBER,
  tableHeaderText: SUMMARY_NAVY,
  pageBackground: '#EEF2F6',
  messageBackground: '#F8D4C6',
  messageText: '#3F2A28',
  caption: CAPTION_BROWN,
};

function themeStops(theme: ReportThemeColors): [string, string, string] {
  return [theme.headerFrom, theme.headerMid, theme.headerTo];
}

function reportShareConfig(portal: PortalState) {
  const settings = portal.settings as {
    theme?: string;
    reportShare?: {
      enabled?: boolean;
      template?: string;
      imagesTemplateEn?: string;
      imagesTemplateTa?: string;
      captionTemplateEn?: string;
      captionTemplateTa?: string;
      detailedTemplateEn?: string;
      detailedTemplateTa?: string;
      themeId?: string;
      theme?: Partial<ReportThemeColors>;
    };
  } | undefined;
  const saved = settings?.reportShare;
  const themeId = String(saved?.themeId || settings?.theme || '').trim();
  const legacy = String(saved?.template || '');
  const plain = (text: string) =>
    String(text || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const isLegacyGpsHeader = (text: string) => {
    const t = plain(text);
    if (!t) return true;
    if (!(t.includes('{DateTime}') && t.includes('{Gps}'))) return false;
    return t.length < 280;
  };
  const firstLetter = (...candidates: string[]) => {
    for (const candidate of candidates) {
      if (!isLegacyGpsHeader(candidate)) return candidate;
    }
    return '';
  };
  const templateEn = firstLetter(saved?.captionTemplateEn || '', saved?.detailedTemplateEn || '', saved?.imagesTemplateEn || '');
  const templateTa = firstLetter(saved?.captionTemplateTa || '', saved?.detailedTemplateTa || '', saved?.imagesTemplateTa || '', legacy);
  return {
    enabled: saved?.enabled !== false,
    imagesTemplateEn: templateEn,
    imagesTemplateTa: templateTa,
    detailedTemplateEn: templateEn,
    detailedTemplateTa: templateTa,
    theme: {
      ...FALLBACK_REPORT_THEME,
      ...(saved?.theme || {}),
      ...(reportThemeFromId(themeId) || {}),
      ...(saved?.theme?.messageBackground ? { messageBackground: saved.theme.messageBackground } : {}),
      ...(saved?.theme?.messageText ? { messageText: saved.theme.messageText } : {}),
    },
  };
}

function fillShareTemplate(template: string, values: Record<string, string>) {
  return template.replace(/\{([A-Za-z_]+)\}/g, (token, key) => values[key] || '');
}

/** On-screen report detail header + table header only. */
function ReportHeaderSurface({
  style,
  children,
  theme,
}: {
  style?: object;
  children: ReactNode;
  theme: ReportThemeColors;
}) {
  const stops = themeStops(theme);
  return (
    <View style={[styles.reportHeaderSurface, style, { borderBottomColor: theme.accent }]}>
      <LinearGradient
        colors={stops}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.surfaceForeground}>{children}</View>
    </View>
  );
}

/** Download/share JPEG — smooth gradient (no stripe bands). */
function ExportReportHeaderSurface({
  style,
  defaultHeight,
  children,
  theme,
}: {
  style?: object;
  defaultHeight: number;
  children: ReactNode;
  theme: ReportThemeColors;
}) {
  const stops = themeStops(theme);
  return (
    <View
      collapsable={false}
      removeClippedSubviews={false}
      style={[styles.reportHeaderSurface, style, { borderBottomColor: theme.accent, minHeight: defaultHeight }]}
    >
      <LinearGradient
        colors={stops}
        locations={[0, 0.52, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View collapsable={false} style={styles.surfaceForeground}>
        {children}
      </View>
    </View>
  );
}

function hexAlpha(hex: string, a: number) {
  const { r, g, b } = hexToRgb(hex || '#FFFFFF');
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

function isLightHex(hex: string) {
  const { r, g, b } = hexToRgb(hex || '#000000');
  return (r * 299 + g * 587 + b * 114) / 1000 > 168;
}

function sharePaintToReportTheme(paint: ShareCardPaint): ReportThemeColors {
  const from = paint.header[0] || '#1A1A1A';
  const to = paint.header[paint.header.length - 1] || from;
  const mid =
    paint.header.length >= 2 ? paint.header[Math.floor((paint.header.length - 1) / 2)] || to : lerpHex(from, to, 0.45);
  const tableHeader = paint.accent;
  return {
    headerFrom: from,
    headerMid: mid,
    headerTo: to,
    accent: paint.accent,
    highlight: paint.title,
    tableHeader,
    tableHeaderText: isLightHex(tableHeader) ? '#1A1A1A' : '#FFFFFF',
    pageBackground:
      paint.group === 'premium_light' || paint.photoGap.toLowerCase() === '#ffffff' ? '#F3F4F8' : lerpHex(from, '#F3F4F8', 0.9),
    messageBackground: lerpHex(paint.accent, '#FFFFFF', 0.88),
    messageText: paint.primary,
    caption: paint.accent,
  };
}

function ThemeRibbon({ paint }: { paint: ShareCardPaint }) {
  return <View collapsable={false} style={{ width: PORTRAIT_W, height: PORTRAIT_RIBBON_H, backgroundColor: paint.accent }} />;
}

function PortraitActivityTitle({
  text,
  paint,
  isTamil,
  onHeight,
}: {
  text: string;
  paint: ShareCardPaint;
  isTamil?: boolean;
  onHeight?: (h: number) => void;
}) {
  const shadow = paintTextShadow(paint.textShadow);
  const long = text.length > (isTamil ? 22 : 32);
  const fontSize = long ? (isTamil ? 16 : 17) : isTamil ? 18 : 20;
  const lineHeight = fontSize + (long ? 3 : 4);
  return (
    <Text
      style={[
        styles.portraitHeadTitle,
        { color: paint.title, fontSize, lineHeight },
        shadow,
      ]}
      numberOfLines={2}
      adjustsFontSizeToFit
      minimumFontScale={0.7}
      onLayout={(e) => {
        const next = Math.ceil(e.nativeEvent.layout.height);
        if (next > 0) onHeight?.(next);
      }}
    >
      {text}
    </Text>
  );
}

function portraitGradientLocations(count: number): number[] | undefined {
  if (count <= 1) return undefined;
  if (count === 2) return [0, 1];
  if (count === 3) return [0, 0.52, 1];
  return Array.from({ length: count }, (_, i) => i / (count - 1));
}

function PortraitPaintSurface({
  paint,
  colors,
  defaultHeight,
  style,
  children,
}: {
  paint: ShareCardPaint;
  colors: string[];
  defaultHeight: number;
  style?: object;
  children: ReactNode;
}) {
  const stops = shareCardGradient(colors);
  const locations = portraitGradientLocations(stops.length);
  const fill = colors[0] || '#1A1A1A';

  return (
    <View
      collapsable={false}
      removeClippedSubviews={false}
      style={[styles.reportHeaderSurface, { backgroundColor: fill }, style, { borderColor: paint.accent }]}
    >
      <LinearGradient
        colors={stops}
        locations={locations}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View collapsable={false} style={styles.surfaceForeground}>
        {children}
      </View>
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
  if (/^(captured_photo_|gallery_photo_)/i.test(s) && !s.startsWith('http') && !s.startsWith('file:') && !s.includes('/')) return false;
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

function formatGpsWithLabels(latitude: number, longitude: number) {
  const lat = Number(latitude || 0).toFixed(5);
  const lng = Number(longitude || 0).toFixed(5);
  return `Lat ${lat}, Lng ${lng}`;
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

async function shareOrSave(uri: string, mimeType: string, filename: string, save: boolean, isTamil: boolean, caption?: string) {
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
  const fileUri = mapFileUri(uri);
  const note = String(caption || '').trim();

  if (note && isShareWithCaptionAvailable()) {
    await shareFileWithCaption({
      uri: fileUri,
      mimeType: mimeType || 'image/jpeg',
      caption: note,
      dialogTitle: filename,
    });
    return;
  }

  if (Platform.OS === 'ios') {
    await Share.share({
      title: filename,
      url: fileUri,
      ...(note ? { message: note } : {}),
    });
    return;
  }

  if (!(await Sharing.isAvailableAsync())) {
    toast(isTamil ? 'பகிர்வு இந்த சாதனத்தில் இல்லை' : 'Sharing is not available on this device');
    return;
  }
  await Sharing.shareAsync(fileUri, {
    mimeType: mimeType || 'image/jpeg',
    dialogTitle: filename,
    UTI: mimeType === 'image/png' ? 'public.png' : 'public.jpeg',
  });
}

function ImageCaption({
  label,
  count,
  highlight,
}: {
  label: string;
  count?: string;
  highlight: string;
}) {
  return (
    <View style={[styles.captionBar, { backgroundColor: highlight, borderTopColor: highlight }]}>
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
  highlight,
  wellMinHeight = EXPORT_TILE_WELL_MIN,
  slotWidth,
  onWellHeight,
}: {
  item: { url: string; name: string; fieldKey: string };
  captionHeight: number;
  imageCount: number;
  index: number;
  onImageLoad: () => void;
  highlight: string;
  wellMinHeight?: number;
  slotWidth: number;
  onWellHeight?: (height: number) => void;
}) {
  const [wellH, setWellH] = useState(wellMinHeight);

  const applyWellHeight = (next: number) => {
    const h = Math.max(wellMinHeight, Math.ceil(next));
    setWellH((prev) => (prev !== h ? h : prev));
    onWellHeight?.(h);
  };

  return (
    <View style={styles.exportTile}>
      <View style={[styles.exportTileWell, { height: wellH, minHeight: wellMinHeight }]}>
        <Image
          key={`tile-${item.fieldKey}-${mediaFingerprint(item.url)}`}
          source={{ uri: displayImageUri(item.url, item.fieldKey) }}
          style={styles.exportTileImgContain}
          resizeMode="contain"
          fadeDuration={0}
          onLoad={(e) => {
            const iw = e.nativeEvent.source.width;
            const ih = e.nativeEvent.source.height;
            applyWellHeight(wellHeightFromAspect(slotWidth, iw, ih, wellMinHeight));
            onImageLoad();
          }}
          onError={onImageLoad}
        />
      </View>
      <View style={[styles.exportTileCaption, { height: captionHeight, backgroundColor: highlight, borderTopColor: highlight }]}>
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
  highlight,
  slotWidth,
  slotWidthCenter,
  onWellHeight,
}: {
  items: { url: string; name: string; fieldKey: string }[];
  startIndex: number;
  imageCount: number;
  onImageLoad: () => void;
  captionHeight: number;
  centerSingle?: boolean;
  highlight: string;
  slotWidth: number;
  slotWidthCenter: number;
  onWellHeight?: (index: number, height: number) => void;
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
            highlight={highlight}
            slotWidth={slotWidthCenter}
            onWellHeight={(h) => onWellHeight?.(startIndex, h)}
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
            highlight={highlight}
            slotWidth={slotWidth}
            onWellHeight={(h) => onWellHeight?.(startIndex + i, h)}
          />
        </View>
      ))}
    </View>
  );
}

/** Download/share report — photos use contain; row height grows to fit full image. */
function ExportPhotoFrame({
  images,
  isTamil,
  onImageLoad,
  highlight,
  photoColWidth,
  onFrameContentHeight,
}: {
  images: { url: string; name: string; fieldKey: string }[];
  isTamil: boolean;
  onImageLoad: () => void;
  highlight: string;
  photoColWidth: number;
  onFrameContentHeight?: (contentHeight: number) => void;
}) {
  const wellsRef = useRef<Record<number, number>>({});
  const frameStyle = [styles.exportPhotoFrame, styles.exportPhotoFrameNatural];
  const wellMin = Math.max(EXPORT_TILE_WELL_MIN, 96);
  const slotHalf = Math.max(80, (photoColWidth - EXPORT_PHOTO_GAP) / 2);
  const slotFull = photoColWidth;
  const slotCenter = Math.max(96, photoColWidth * (2 / 3));

  const reportFrameHeight = useCallback(() => {
    const n = images.length;
    if (!n) return;
    if (Object.keys(wellsRef.current).length < n) return;
    const wells = Array.from({ length: n }, (_, i) => wellsRef.current[i] || wellMin);
    const cap = n === 1 ? EXPORT_CAPTION_H_SINGLE : EXPORT_CAPTION_H;
    let content = 0;
    if (n === 1) {
      content = wells[0] + cap;
    } else if (n === 2) {
      content = Math.max(wells[0], wells[1]) + cap;
    } else if (n === 3) {
      content = Math.max(wells[0], wells[1]) + cap + EXPORT_PHOTO_GAP + wells[2] + cap;
    } else {
      const rowCount = Math.ceil(n / 2);
      for (let r = 0; r < rowCount; r++) {
        const a = wells[r * 2] || 0;
        const b = wells[r * 2 + 1];
        content += Math.max(a, b ?? a) + cap;
        if (r < rowCount - 1) content += EXPORT_PHOTO_GAP;
      }
    }
    onFrameContentHeight?.(content);
  }, [images.length, onFrameContentHeight, wellMin]);

  const onWellHeight = useCallback(
    (index: number, h: number) => {
      wellsRef.current[index] = h;
      reportFrameHeight();
    },
    [reportFrameHeight],
  );

  useEffect(() => {
    wellsRef.current = {};
  }, [images]);

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
        <ExportPhotoTile
          item={images[0]}
          index={0}
          imageCount={1}
          captionHeight={captionH}
          onImageLoad={onImageLoad}
          highlight={highlight}
          wellMinHeight={wellMin}
          slotWidth={slotFull}
          onWellHeight={(h) => onWellHeight(0, h)}
        />
      </View>
    );
  }

  if (images.length === 2) {
    return (
      <View style={frameStyle}>
        <ExportPhotoRow
          items={images}
          startIndex={0}
          imageCount={2}
          captionHeight={captionH}
          onImageLoad={onImageLoad}
          highlight={highlight}
          slotWidth={slotHalf}
          slotWidthCenter={slotCenter}
          onWellHeight={onWellHeight}
        />
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
            highlight={highlight}
            slotWidth={slotHalf}
            slotWidthCenter={slotCenter}
            onWellHeight={onWellHeight}
          />
          <ExportPhotoRow
            items={[images[2]]}
            startIndex={2}
            imageCount={3}
            captionHeight={captionH}
            onImageLoad={onImageLoad}
            highlight={highlight}
            centerSingle
            slotWidth={slotHalf}
            slotWidthCenter={slotCenter}
            onWellHeight={onWellHeight}
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
            highlight={highlight}
            centerSingle={row.length === 1}
            slotWidth={slotHalf}
            slotWidthCenter={slotCenter}
            onWellHeight={onWellHeight}
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
  highlight = REPORT_AMBER,
  paint,
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
  highlight?: string;
  paint?: ShareCardPaint;
}) {
  const isBrandHeader = variant === 'brandHeader';
  const wardLabel = formatWardLabel(isTamil, wardNumber);
  const street = streetLabel?.trim() || '';
  const subjectCategory = [subjectName?.trim(), categoryName?.trim()].filter(Boolean).join(' · ');
  const wardLine = street ? `${wardLabel} · ${street}` : wardLabel;
  const metaLine = `${submitted} · ${gps}`;
  const titleColor = paint?.title || highlight;
  const primaryColor = paint?.primary || '#FFFFFF';
  const secondaryColor = paint?.secondary || 'rgba(255,255,255,0.92)';

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
          <Text style={[headerRow(1), { color: titleColor }]} numberOfLines={1}>
            {subjectCategory}
          </Text>
        )}
        {!!place && (
          <Text style={[headerRow(2), { color: primaryColor }]} numberOfLines={1}>
            {place}
          </Text>
        )}
        <Text style={[headerRow(3), { color: secondaryColor }]} numberOfLines={1}>
          {wardLine}
          {!!metaLine && <Text style={[headerRow(4), { color: titleColor }]}>{`  ·  ${metaLine}`}</Text>}
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
  width,
  height,
  framed = true,
}: {
  mapUri?: string | null;
  onLoad: () => void;
  width?: number;
  height?: number;
  framed?: boolean;
}) {
  useEffect(() => {
    if (!mapUri) onLoad();
  }, [mapUri, onLoad]);
  const sizeStyle = width && height ? { width, height } : undefined;

  return (
    <View style={[styles.exportHeaderMapWrap, sizeStyle, !framed && { borderWidth: 0 }]} collapsable={false}>
      {mapUri ? (
        <>
          <Image
            source={{ uri: mapUri }}
            style={[styles.exportHeaderMapImg, sizeStyle]}
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
          style={[styles.exportHeaderMapImg, sizeStyle]}
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
  theme,
  paint,
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
  theme: ReportThemeColors;
  paint: ShareCardPaint;
}) {
  const wardLabel = formatWardLabel(isTamil, wardNumber);
  const street = streetLabel?.trim() || '';
  const wardLine = street ? `${wardLabel} · ${street}` : wardLabel;
  const subjectCategory = [subjectName?.trim(), categoryName?.trim()].filter(Boolean).join(' · ');
  const dateGpsLine = [submitted, formatGpsWithLabels(latitude, longitude)].filter(Boolean).join('  ·  ');

  return (
    <ExportReportHeaderSurface style={[styles.exportSummaryHeader, { borderBottomColor: theme.accent }]} defaultHeight={96} theme={theme}>
      <View style={styles.exportHeaderRow} collapsable={false}>
        <View style={styles.exportHeaderLogoPlate} collapsable={false}>
          <BrandImage kind="logo" style={styles.exportHeaderLogo} />
        </View>
        <View style={styles.exportHeaderContentCentered} collapsable={false}>
          {!!subjectCategory && (
            <Text style={[styles.exportHeadLine1, { color: paint.title }]} numberOfLines={2}>
              {subjectCategory}
            </Text>
          )}
          {!!place && (
            <Text style={[styles.exportHeadLine2, { color: paint.primary }]} numberOfLines={2}>
              {place}
            </Text>
          )}
          <Text style={[styles.exportHeadLine3, { color: paint.secondary }]} numberOfLines={1}>
            {wardLine}
            {!!dateGpsLine && <Text style={[styles.exportHeadLine4, { color: paint.title }]}>{`  ·  ${dateGpsLine}`}</Text>}
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
            highlight={paint.title}
            nameColor={paint.primary}
          />
        </View>
      </View>
    </ExportReportHeaderSurface>
  );
}

function ExportPortraitHeader({
  isTamil,
  tpName,
  districtName,
  zoneName,
  wardNumber,
  streetLabel,
  activityName,
  submitted,
  latitude,
  longitude,
  paint,
  onHeaderHeight,
}: {
  isTamil: boolean;
  tpName: string;
  districtName: string;
  zoneName: string;
  wardNumber: number | string;
  streetLabel: string;
  activityName: string;
  submitted: string;
  latitude: number;
  longitude: number;
  paint: ShareCardPaint;
  onHeaderHeight?: (height: number) => void;
}) {
  const wardLabel = formatWardLabel(isTamil, wardNumber);
  const street = streetLabel?.trim() || '';
  const tpSuffix = isTamil ? 'பேரூராட்சி' : 'Town Panchayat';
  const tpLine = (() => {
    const name = String(tpName || '').trim();
    if (!name) return '';
    const compact = name.replace(/\s+/g, '').toLowerCase();
    const alreadyHas =
      compact.includes('townpanchayat') ||
      compact.includes('பேரூராட்சி') ||
      compact.includes('பேருராட்சி');
    return alreadyHas ? name : `${name} ${tpSuffix}`;
  })();
  const districtLine = districtName ? `${districtName} ${isTamil ? 'மாவட்டம்' : 'District'}` : '';
  const zoneLine = zoneName ? `${zoneName} ${isTamil ? 'மண்டலம்' : 'Zone'}` : '';
  const gps = formatGpsWithLabels(latitude, longitude);
  const shadow = paintTextShadow(paint.textShadow);

  return (
    <PortraitPaintSurface
      paint={paint}
      colors={paint.header}
      defaultHeight={PORTRAIT_HEADER_MIN_H}
      style={[styles.portraitHeader, { borderBottomWidth: 0, minHeight: PORTRAIT_HEADER_MIN_H }]}
    >
      <View
        style={styles.portraitHeaderCenter}
        collapsable={false}
        onLayout={(e) => {
          const block = Math.ceil(e.nativeEvent.layout.height) + 14;
          onHeaderHeight?.(Math.max(PORTRAIT_HEADER_MIN_H, block));
        }}
      >
        {!!activityName && (
          <PortraitActivityTitle text={activityName} paint={paint} isTamil={isTamil} onHeight={() => undefined} />
        )}
        {!!tpLine && (
          <Text style={[styles.portraitHeadPlace, { color: paint.primary }, shadow]} numberOfLines={2}>
            {tpLine}
          </Text>
        )}
        {!!districtLine && (
          <Text style={[styles.portraitHeadWard, { color: paint.secondary }, shadow]} numberOfLines={1}>
            {districtLine}
          </Text>
        )}
        {!!zoneLine && (
          <Text style={[styles.portraitHeadWard, { color: paint.secondary }, shadow]} numberOfLines={1}>
            {zoneLine}
          </Text>
        )}
        <Text
          style={[styles.portraitHeadWard, styles.portraitHeadWardStreet, isTamil && styles.portraitHeadWardStreetTa, { color: paint.secondary }, shadow]}
          numberOfLines={1}
        >
          {street ? `${wardLabel}  ·  ${street}` : wardLabel}
        </Text>
        <Text style={[styles.portraitHeadMeta, { color: paint.title }, shadow]} numberOfLines={1}>
          {submitted}   |   {gps}
        </Text>
      </View>
    </PortraitPaintSurface>
  );
}

function ExportPortraitFooter({
  isTamil,
  officerPhotoUri,
  officerName,
  officerDesignation,
  mapUri,
  onOfficerLoad,
  onMapLoad,
  paint,
}: {
  isTamil: boolean;
  officerPhotoUri?: string | null;
  officerName: string;
  officerDesignation: string;
  mapUri?: string | null;
  onOfficerLoad: () => void;
  onMapLoad: () => void;
  paint: ShareCardPaint;
}) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!officerPhotoUri && !failed;
  const letter = (officerName || 'U').trim().slice(0, 1).toUpperCase() || 'U';
  const shadow = paintTextShadow(paint.textShadow);

  useEffect(() => {
    if (!officerPhotoUri) onOfficerLoad();
  }, [officerPhotoUri, onOfficerLoad]);

  return (
    <PortraitPaintSurface
      paint={paint}
      colors={paint.footer}
      defaultHeight={PORTRAIT_FOOTER_H}
      style={[styles.portraitFooter, { borderTopWidth: 0, height: PORTRAIT_FOOTER_H }]}
    >
      <View style={styles.portraitFooterRow} collapsable={false}>
        <View style={styles.portraitFooterOfficer} collapsable={false}>
          {showPhoto ? (
            <Image
              source={{ uri: officerPhotoUri }}
              style={[styles.portraitFooterAvatar, { borderColor: paint.avatarRing }]}
              onLoad={onOfficerLoad}
              onError={() => {
                setFailed(true);
                onOfficerLoad();
              }}
            />
          ) : (
            <View
              style={[
                styles.portraitFooterAvatarFallback,
                { backgroundColor: paint.avatarFill[0] || paint.footer[0], borderColor: paint.avatarRing },
              ]}
            >
              <Text style={[styles.portraitFooterAvatarLetter, { color: paint.avatarLetter }]} onLayout={onOfficerLoad}>
                {letter}
              </Text>
            </View>
          )}
          <View style={styles.portraitFooterOfficerText}>
            <Text style={[styles.portraitFooterName, { color: paint.footerName }, shadow]} numberOfLines={1}>
              {officerName}
            </Text>
            <Text style={[styles.portraitFooterRole, { color: paint.footerRole }]} numberOfLines={1}>
              {officerDesignation}
            </Text>
          </View>
        </View>
        <View style={[styles.portraitFooterMapFrame, { borderColor: paint.accent }]} collapsable={false}>
          <ExportLocationMapThumb mapUri={mapUri} onLoad={onMapLoad} width={82} height={48} framed={false} />
        </View>
      </View>
    </PortraitPaintSurface>
  );
}

function PortraitPhotoGrid({
  images,
  onLoad,
  paint,
  areaHeight,
}: {
  images: { url: string; name: string; fieldKey: string }[];
  onLoad: () => void;
  paint: ShareCardPaint;
  areaHeight: number;
}) {
  const border = 1;
  const rows: { url: string; name: string; fieldKey: string }[][] = [];
  if (images.length === 1) {
    rows.push(images);
  } else {
    for (let i = 0; i < images.length; i += 2) rows.push(images.slice(i, i + 2));
  }
  const rowCount = Math.max(rows.length, 1);
  const baseH = Math.max(1, Math.floor(areaHeight / rowCount));
  const lastH = areaHeight - baseH * (rowCount - 1);
  const colW = Math.floor(PORTRAIT_W / 2);
  const lastW = PORTRAIT_W - colW;

  const tile = (
    img: { url: string; name: string; fieldKey: string },
    width: number,
    height: number,
    edges: { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean },
  ) => (
    <View
      key={img.fieldKey}
      collapsable={false}
      style={{
        width,
        height,
        borderColor: paint.accent,
        borderTopWidth: edges.top ? border : 0,
        borderBottomWidth: edges.bottom ? border : 0,
        borderLeftWidth: edges.left ? border : 0,
        borderRightWidth: edges.right ? border : 0,
        backgroundColor: paint.photoGap,
      }}
    >
      <Image
        source={{ uri: displayImageUri(img.url, img.fieldKey) }}
        style={{
          width: Math.max(1, width - border * 2),
          height: Math.max(1, height - border * 2),
          backgroundColor: paint.photoGap,
        }}
        resizeMode="contain"
        fadeDuration={0}
        onLoad={onLoad}
        onError={onLoad}
      />
    </View>
  );

  return (
    <View
      collapsable={false}
      style={{ width: PORTRAIT_W, height: areaHeight, backgroundColor: paint.photoGap }}
    >
      {rows.map((row, ri) => {
        const height = ri === rowCount - 1 ? lastH : baseH;
        const full = row.length === 1;
        return (
          <View key={`row-${ri}`} collapsable={false} style={{ flexDirection: 'row', width: PORTRAIT_W, height }}>
            {row.map((img, ii) =>
              tile(img, full ? PORTRAIT_W : ii === 0 ? colW : lastW, height, {
                top: ri > 0,
                bottom: ri < rowCount - 1,
                left: true,
                right: true,
              }),
            )}
          </View>
        );
      })}
    </View>
  );
}

function ExportOfficerBlock({
  isTamil,
  photoUri,
  name,
  designation,
  onLoad,
  highlight = REPORT_AMBER,
  nameColor,
}: {
  isTamil?: boolean;
  photoUri?: string | null;
  name: string;
  designation: string;
  onLoad: () => void;
  highlight?: string;
  nameColor?: string;
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
      <Text style={[styles.exportOfficerName, nameColor ? { color: nameColor } : null]}>
        {name}
      </Text>
      <Text style={[styles.exportOfficerRole, { color: highlight }]}>
        {designation || (isTamil ? 'களப் பணியாளர்' : 'Field worker')}
      </Text>
    </View>
  );
}

function ReportFooterBar({
  isTamil,
  busy,
  theme,
  paint,
  selectedThemeId,
  onSelectTheme,
  onShareDetailed,
  onShareImages,
}: {
  isTamil: boolean;
  busy: 'image' | 'report' | 'images' | null;
  theme: ReportThemeColors;
  paint: ShareCardPaint;
  selectedThemeId: string;
  onSelectTheme: (id: string) => void;
  onShareDetailed: () => void;
  onShareImages: () => void;
}) {
  const insets = useSafeAreaInsets();
  const softBg = lerpHex(theme.accent, '#FFFFFF', 0.88);
  const shareStops = shareCardGradient(paint.header);
  const lightShare = paint.group === 'premium_light' || paint.header[0]?.toLowerCase() === '#ffffff';
  const shareTitleColor = lightShare ? paint.title : '#FFFFFF';
  const shareHintColor = lightShare ? paint.secondary : 'rgba(255,255,255,0.86)';

  return (
    <View style={[styles.reportFooterWrap, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <ShareCardThemePicker isTamil={isTamil} selectedId={selectedThemeId} onSelect={onSelectTheme} />
      <View style={styles.reportFooter}>
        <Pressable
          onPress={onShareDetailed}
          style={({ pressed }) => [styles.reportShareCard, pressed && styles.reportFooterBtnPressed]}
          disabled={!!busy}
        >
          <View style={[styles.reportShareCardInner, styles.reportShareCardDetailed, { backgroundColor: softBg, borderColor: theme.accent }]}>
            {busy === 'report' ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : (
              <>
                <View style={[styles.reportShareIconWrap, { backgroundColor: theme.accent }]}>
                  <Ionicons name="document-text" size={16} color="#fff" />
                </View>
                <View style={styles.reportShareCopy}>
                  <Text style={[styles.reportShareTitle, { color: theme.headerTo }]} numberOfLines={1}>
                    {isTamil ? 'விரிவான அறிக்கை பகிர்வு' : 'Share detailed report'}
                  </Text>
                  <Text style={styles.reportShareHint} numberOfLines={1}>
                    {isTamil ? 'படங்கள் + விவரங்கள்' : 'Images + Details'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </Pressable>
        <Pressable
          onPress={onShareImages}
          style={({ pressed }) => [styles.reportShareCard, pressed && styles.reportFooterBtnPressed]}
          disabled={!!busy}
        >
          <LinearGradient
            colors={shareStops}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.reportShareCardInner, styles.reportShareCardImages]}
          >
            {busy === 'images' ? (
              <ActivityIndicator size="small" color={shareTitleColor} />
            ) : (
              <>
                <View style={[styles.reportShareIconWrap, { backgroundColor: paint.accent }]}>
                  <Ionicons name="images" size={16} color={lightShare ? paint.avatarLetter : SUMMARY_NAVY} />
                </View>
                <View style={styles.reportShareCopy}>
                  <Text style={[styles.reportShareTitleLight, { color: shareTitleColor }]} numberOfLines={1}>
                    {isTamil ? 'அறிக்கை பகிர்வு' : 'Share report'}
                  </Text>
                  <Text style={[styles.reportShareHintLight, { color: shareHintColor }]} numberOfLines={1}>
                    {isTamil ? 'படங்கள் மட்டும்' : 'Images only'}
                  </Text>
                </View>
              </>
            )}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

export function WorkDetailModal({
  work,
  portal,
  isTamil,
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
  const insets = useSafeAreaInsets();
  const [liveSettings, setLiveSettings] = useState(portal.settings);
  const exportRef = useRef<ViewShotRef>(null);
  const exportLoadedCount = useRef(0);
  const exportLaidOut = useRef<(() => void) | null>(null);
  const [busy, setBusy] = useState<'image' | 'report' | 'images' | null>(null);
  const [exportKind, setExportKind] = useState<'detailed' | 'images'>('detailed');
  const [idx, setIdx] = useState(0);
  const [photoReady, setPhotoReady] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [exportCapturing, setExportCapturing] = useState(false);
  const [exportLandBodyH, setExportLandBodyH] = useState(0);
  const exportLandBodyHRef = useRef(0);
  const exportPhotoPaneHRef = useRef(0);
  const exportTablePaneHRef = useRef(0);
  const [portraitHeaderH, setPortraitHeaderH] = useState(PORTRAIT_HEADER_MIN_H);
  const [exportMapUri, setExportMapUri] = useState<string | null>(null);
  const [exportOfficerUri, setExportOfficerUri] = useState<string | null>(null);
  const [shareThemeId, setShareThemeId] = useState(DEFAULT_SHARE_CARD_THEME_ID);
  const sharePaint = resolveShareCardPaint(shareThemeId);

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

  const portraitPhotoAreaH = useMemo(
    () => estimatePortraitPhotoAreaHeight(portraitHeaderH),
    [portraitHeaderH],
  );

  const current = images[idx];
  const locTp = isTamil ? work.tpNameTa || work.tpNameEn : work.tpNameEn;
  const locZone = isTamil ? work.zoneNameTa || work.zoneNameEn : work.zoneNameEn;
  const locDistrict = isTamil ? work.districtNameTa || work.districtNameEn : work.districtNameEn;
  const subjectName = isTamil ? work.subjectNameTa || work.subjectNameEn : work.subjectNameEn;
  const categoryName = isTamil ? work.categoryNameTa || work.categoryNameEn : work.categoryNameEn;
  const submitted = formatTo12Hr(work.submittedAt);
  const gps = formatGpsWithLabels(Number(work.latitude || 0), Number(work.longitude || 0));
  const workRef = work.workId || work.id;
  const photoLabel = current?.name || (isTamil ? 'கள ஆய்வு புகைப்படம்' : 'Field photo');
  const headerPlace = [locTp, locZone, locDistrict].filter(Boolean).join(' · ');
  const resolvedStreet = streetLabel?.trim() || String(work.streetName || '').trim();

  const markExportImageLoaded = useCallback(() => {
    exportLoadedCount.current += 1;
    if (exportLoadedCount.current >= images.length) setExportReady(true);
  }, [images.length]);

  const measureExportLandPane = useCallback(
    (pane: 'photo' | 'table', height: number) => {
      const h = Math.ceil(height);
      if (pane === 'photo') exportPhotoPaneHRef.current = h;
      else exportTablePaneHRef.current = h;
      const merged = Math.max(exportPhotoPaneHRef.current, exportTablePaneHRef.current);
      const target = resolveExportLandBodyHeight(fieldRows, merged, images.length);
      if (target !== exportLandBodyHRef.current) {
        exportLandBodyHRef.current = target;
        setExportLandBodyH(target);
      }
    },
    [fieldRows, images.length],
  );

  const landPhotoColWidth = useMemo(() => landExportPhotoColWidth(), []);

  const syncPhotoFrameHeight = useCallback(
    (frameContentH: number) => {
      const paneH = LAND_EXPORT_PAD * 2 + LAND_PANE_TITLE_H + Math.ceil(frameContentH);
      exportPhotoPaneHRef.current = Math.max(exportPhotoPaneHRef.current, paneH);
      const merged = Math.max(exportPhotoPaneHRef.current, exportTablePaneHRef.current);
      const target = resolveExportLandBodyHeight(fieldRows, merged, images.length);
      if (target !== exportLandBodyHRef.current) {
        exportLandBodyHRef.current = target;
        setExportLandBodyH(target);
      }
    },
    [fieldRows, images.length],
  );

  useEffect(() => {
    if (exportCapturing && exportKind === 'detailed') {
      exportPhotoPaneHRef.current = 0;
      exportTablePaneHRef.current = 0;
      const guess = resolveExportLandBodyHeight(fieldRows, 0, images.length);
      exportLandBodyHRef.current = guess;
      exportTablePaneHRef.current = guess;
      setExportLandBodyH(guess);
    }
  }, [exportCapturing, exportKind, fieldRows, images.length]);

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
    void downloadOfficerPhoto(effectivePhotoUrl(user), user || undefined).then((uri) => {
      if (live) setExportOfficerUri(uri);
    });
    return () => {
      live = false;
    };
  }, [user?.id, user?.profilePhotoUrl, user?.avatarUrl, user?.profileImage]);

  useEffect(() => {
    let alive = true;
    void prefs.getShareCardThemeId().then((id) => {
      if (!alive) return;
      const resolved = resolveShareCardPaint(id || DEFAULT_SHARE_CARD_THEME_ID);
      setShareThemeId(resolved.id);
      if ((id || '').trim() === 'flat_maroon_gold' || !(id || '').trim()) {
        void prefs.setShareCardThemeId(resolved.id);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const selectShareTheme = useCallback((id: string) => {
    const next = resolveShareCardPaint(id);
    setShareThemeId(next.id);
    void prefs.setShareCardThemeId(next.id);
  }, []);

  useEffect(() => {
    let alive = true;
    void api.getAppSettings().then((raw) => {
      if (!alive || !raw) return;
      setLiveSettings({
        ...portal.settings,
        ...(raw.theme != null ? { theme: raw.theme } : {}),
        ...(raw.customColors != null ? { customColors: raw.customColors } : {}),
        ...(raw.googleMapsApiKey != null ? { googleMapsApiKey: raw.googleMapsApiKey } : {}),
        ...(raw.reportShare != null ? { reportShare: raw.reportShare } : {}),
      });
    });
    return () => {
      alive = false;
    };
  }, [portal.settings]);

  const shareConfig = reportShareConfig({ ...portal, settings: liveSettings || portal.settings });
  const reportTheme = useMemo(() => sharePaintToReportTheme(sharePaint), [sharePaint]);
  const shareValues = {
    Zone_EN: String(work.zoneNameEn || ''),
    Zone_TA: String(work.zoneNameTa || work.zoneNameEn || ''),
    District_EN: String(work.districtNameEn || ''),
    District_TA: String(work.districtNameTa || work.districtNameEn || ''),
    TownPanchayat_EN: String(work.tpNameEn || ''),
    TownPanchayat_TA: String(work.tpNameTa || work.tpNameEn || ''),
    Ward_No: String(work.wardNumber || ''),
    Street_Name: String(resolvedStreet || work.streetName || ''),
    CategoryNameEn: String(work.categoryNameEn || work.subjectNameEn || ''),
    CategoryNameTa: String(work.categoryNameTa || work.categoryNameEn || ''),
    EmployeeName_EN: String(user?.nameEn || user?.name || work.submittedByUserName || ''),
    EmployeeName_TA: String(user?.nameTa || user?.name || work.submittedByUserName || ''),
    Designation_EN: resolveOfficerDesignation(user, portal, false) || '',
    Designation_TA: resolveOfficerDesignation(user, portal, true) || '',
    DateTime: submitted,
    Gps: gps,
  };
  const pickTemplate = (primary: string, fallback: string) => (isTamil ? primary || fallback : fallback || primary);
  const letterEn = `Respected Sir/Madam,\n\nA field inspection on {CategoryNameEn} was carried out at Ward {Ward_No}, {Street_Name}, {TownPanchayat_EN} Town Panchayat, {District_EN} District, {Zone_EN} Zone. This is submitted for your kind information.\n\n{EmployeeName_EN}\n{Designation_EN}\n{TownPanchayat_EN} Town Panchayat\n{District_EN} District`;
  const letterTa = `மதிப்பிற்குரிய அம்மையீர்/ஐயா வணக்கம்,\n\n{Zone_TA} மண்டலம், {District_TA} மாவட்டம், {TownPanchayat_TA} பேரூராட்சி வார்டு எண்.{Ward_No}, {Street_Name} பகுதியில் {CategoryNameTa} தொடர்பாக கள ஆய்வு மேற்கொள்ளப்பட்டது என்ற விவரம் பணிந்து சமர்ப்பிக்கப்படுகிறது.\n\n{EmployeeName_TA}\n{Designation_TA}\n{TownPanchayat_TA} பேரூராட்சி\n{District_TA} மாவட்டம்`;
  const buildShareMessage = (cfg: ReturnType<typeof reportShareConfig>) =>
    fillShareTemplate(
      pickTemplate(cfg.imagesTemplateTa || letterTa, cfg.imagesTemplateEn || letterEn),
      shareValues,
    );
  const shareMessage = buildShareMessage(shareConfig);

  const run = async (kind: 'image' | 'report' | 'images', save: boolean) => {
    try {
      setBusy(kind);
      let captionMessage = shareMessage;
      try {
        const raw = await api.getAppSettings();
        if (raw && typeof raw === 'object') {
          const nextSettings = {
            ...portal.settings,
            ...(raw.theme != null ? { theme: raw.theme } : {}),
            ...(raw.customColors != null ? { customColors: raw.customColors } : {}),
            ...(raw.googleMapsApiKey != null ? { googleMapsApiKey: raw.googleMapsApiKey } : {}),
            ...(raw.reportShare != null ? { reportShare: raw.reportShare } : {}),
          };
          setLiveSettings(nextSettings);
          captionMessage = buildShareMessage(reportShareConfig({ ...portal, settings: nextSettings }));
        }
      } catch {
        /* use templates already on screen */
      }
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

      const portrait = kind === 'images';
      const stamp = Date.now();
      exportLoadedCount.current = 0;
      setExportKind(portrait ? 'images' : 'detailed');
      if (portrait) {
        setPortraitHeaderH(PORTRAIT_HEADER_MIN_H);
      }
      let mapUri = exportMapUri;
      if (!mapUri) {
        mapUri = await downloadLocationMap(Number(work.latitude || 0), Number(work.longitude || 0), mapsApiKey);
        setExportMapUri(mapUri);
      }
      let officerUri = exportOfficerUri;
      if (!officerUri) {
        officerUri = await downloadOfficerPhoto(effectivePhotoUrl(user), user || undefined);
        setExportOfficerUri(officerUri);
      }
      const laidOut = new Promise<void>((resolve) => {
        exportLaidOut.current = resolve;
      });
      setExportCapturing(true);
      await Promise.race([laidOut, new Promise<void>((r) => setTimeout(r, 900))]);
      if (!portrait) {
        await new Promise<void>((r) => setTimeout(r, 80));
        const layoutStart = Date.now();
        while (exportTablePaneHRef.current < 1 && Date.now() - layoutStart < 1200) {
          await new Promise<void>((r) => setTimeout(r, 40));
        }
        const syncStart = Date.now();
        while (exportLandBodyHRef.current < exportTablePaneHRef.current && Date.now() - syncStart < 600) {
          await new Promise<void>((r) => setTimeout(r, 40));
        }
        await new Promise<void>((r) => setTimeout(r, 280));
      }
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      {
        const needed = images.length + 2;
        const started = Date.now();
        while (exportLoadedCount.current < needed && Date.now() - started < 6000) {
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      await new Promise((r) => setTimeout(r, 400));
      let captured: string;
      try {
        captured = await captureRef(exportRef, {
          format: 'jpg',
          quality: 0.95,
          result: 'tmpfile',
          fileName: `inspection_${stamp}`,
          ...(portrait ? { pixelRatio: 3 } : { width: EXPORT_W }),
        });
      } finally {
        exportLaidOut.current = null;
        setExportCapturing(false);
        setExportLandBodyH(0);
        exportLandBodyHRef.current = 0;
        exportPhotoPaneHRef.current = 0;
        exportTablePaneHRef.current = 0;
      }
      const filename = `inspection_${safeFilePart(workRef)}_${portrait ? 'images_' : ''}${stamp}.jpg`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      const exists = await FileSystem.getInfoAsync(dest);
      if (exists.exists) await FileSystem.deleteAsync(dest, { idempotent: true });
      await FileSystem.copyAsync({ from: captured, to: dest });
      await shareOrSave(dest, 'image/jpeg', filename, save, isTamil, htmlToPlain(captionMessage));
    } catch (error) {
      console.warn('Report share failed', error);
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
      <View style={[styles.screen, { backgroundColor: reportTheme.pageBackground }]}>
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
            <ReportHeaderSurface theme={reportTheme} style={[styles.detailHeader, { paddingTop: insets.top, borderBottomColor: reportTheme.accent }]}>
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
                highlight={reportTheme.highlight}
                paint={sharePaint}
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
                        style={[styles.photoActionBtn, { backgroundColor: reportTheme.highlight }]}
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
                        style={[styles.photoActionBtn, { backgroundColor: reportTheme.highlight }]}
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
                      highlight={reportTheme.highlight}
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
                <View style={[styles.thead, { backgroundColor: reportTheme.tableHeader, borderBottomColor: reportTheme.caption }]}>
                  <Text style={[styles.th, { flex: 1.65, color: reportTheme.tableHeaderText }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                  <View style={styles.colSplit} />
                  <Text style={[styles.th, { flex: 1, color: reportTheme.tableHeaderText }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
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
          theme={reportTheme}
          paint={sharePaint}
          selectedThemeId={sharePaint.id}
          onSelectTheme={selectShareTheme}
          onShareDetailed={() => void run('report', false)}
          onShareImages={() => void run('images', false)}
        />
        {exportCapturing ? (
          <>
            <View pointerEvents="none" style={styles.exportCaptureMask} />
            <View pointerEvents="none" style={styles.exportCaptureStage}>
              <ViewShot
                ref={exportRef}
                collapsable={false}
                options={{ format: 'jpg', quality: 0.95 }}
                style={
                  exportKind === 'images'
                    ? [styles.portraitSheet, { backgroundColor: sharePaint.photoGap }]
                    : styles.landscapeSheet
                }
              >
          <View
            collapsable={false}
            style={
              exportKind === 'images'
                ? [styles.exportSheet, { backgroundColor: sharePaint.photoGap }]
                : styles.landscapeExportInner
            }
            removeClippedSubviews={false}
            onLayout={() => {
              exportLaidOut.current?.();
              exportLaidOut.current = null;
            }}
          >
            {exportKind === 'images' ? (
              <>
                <ExportPortraitHeader
                  isTamil={isTamil}
                  tpName={String(locTp || '')}
                  districtName={String(locDistrict || '')}
                  zoneName={String(locZone || '')}
                  wardNumber={work.wardNumber}
                  streetLabel={resolvedStreet}
                  activityName={categoryName || subjectName || ''}
                  submitted={submitted}
                  latitude={Number(work.latitude || 0)}
                  longitude={Number(work.longitude || 0)}
                  paint={sharePaint}
                  onHeaderHeight={setPortraitHeaderH}
                />
                <ThemeRibbon paint={sharePaint} />
                <View
                  collapsable={false}
                  style={{ width: PORTRAIT_W, height: portraitPhotoAreaH, backgroundColor: sharePaint.photoGap }}
                >
                  <PortraitPhotoGrid images={images} onLoad={markExportImageLoaded} paint={sharePaint} areaHeight={portraitPhotoAreaH} />
                </View>
                <ThemeRibbon paint={sharePaint} />
                <ExportPortraitFooter
                  isTamil={isTamil}
                  officerPhotoUri={exportOfficerUri}
                  officerName={officerName}
                  officerDesignation={officerDesignation}
                  mapUri={exportMapUri}
                  onOfficerLoad={markExportImageLoaded}
                  onMapLoad={markExportImageLoaded}
                  paint={sharePaint}
                />
              </>
            ) : (
              <>
                <ExportReportHeader
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
                  theme={reportTheme}
                  paint={sharePaint}
                />
                <View
                  style={[
                    styles.landBody,
                    { borderBottomColor: reportTheme.caption, borderBottomWidth: 2 },
                    exportLandBodyH > 0 ? { height: exportLandBodyH } : null,
                  ]}
                  collapsable={false}
                >
                  <View
                    style={[styles.landPhotoExport, exportLandBodyH > 0 ? { height: exportLandBodyH } : null]}
                    collapsable={false}
                    onLayout={(e) => measureExportLandPane('photo', e.nativeEvent.layout.height)}
                  >
                    <Text style={styles.landPaneTitle}>{isTamil ? 'புகைப்படங்கள்' : 'FIELD PHOTOS'}</Text>
                    <ExportPhotoFrame
                      images={images}
                      isTamil={isTamil}
                      onImageLoad={markExportImageLoaded}
                      highlight={reportTheme.highlight}
                      photoColWidth={landPhotoColWidth}
                      onFrameContentHeight={syncPhotoFrameHeight}
                    />
                  </View>
                  <View style={[styles.exportSplit, { backgroundColor: reportTheme.highlight }]} />
                  <View
                    style={[styles.landTable, exportLandBodyH > 0 ? { height: exportLandBodyH } : null]}
                    collapsable={false}
                    onLayout={(e) => measureExportLandPane('table', e.nativeEvent.layout.height)}
                  >
                    <Text style={styles.landPaneTitle}>{isTamil ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</Text>
                    <View style={styles.landPaneBody} collapsable={false}>
                    <View style={styles.table} collapsable={false}>
                      <View style={[styles.thead, { backgroundColor: reportTheme.tableHeader, borderBottomColor: reportTheme.caption }]}>
                        <Text style={[styles.th, { flex: 1.65, color: reportTheme.tableHeaderText }]}>{isTamil ? 'தலைப்புகள்' : 'HEADINGS'}</Text>
                        <View style={styles.colSplit} />
                        <Text style={[styles.th, { flex: 1, color: reportTheme.tableHeaderText }]}>{isTamil ? 'விவரங்கள்' : 'DETAILS'}</Text>
                      </View>
                      {fieldRows.length ? (
                        fieldRows.map((r, i) => (
                          <View key={`ex-${r.key}`} style={[styles.tr, styles.trExport, i % 2 === 1 && styles.trAlt]}>
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
              </>
            )}
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
  surfaceForeground: { zIndex: 2, position: 'relative', width: '100%' },
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
  reportFooterWrap: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#fff',
    zIndex: 20,
    elevation: 12,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  reportShareCard: {
    flex: 1,
    minWidth: 0,
  },
  reportShareCardInner: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  reportShareCardDetailed: {
    borderWidth: 1.5,
  },
  reportShareCardImages: {
    borderWidth: 0,
  },
  reportShareIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  reportShareCopy: {
    flex: 1,
    minWidth: 0,
  },
  reportShareTitle: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
  },
  reportShareHint: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  reportShareTitleLight: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '800',
    color: '#fff',
  },
  reportShareHintLight: {
    marginTop: 2,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.86)',
  },
  reportFooterBtnPressed: { opacity: 0.88 },
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
  portraitSheet: {
    width: PORTRAIT_W,
    height: PORTRAIT_H,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  portraitHeader: {
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 12,
  },
  portraitHeaderCenter: {
    zIndex: 2,
    alignItems: 'center',
    width: '100%',
  },
  portraitHeadTitle: {
    width: '100%',
    textAlign: 'center',
    color: '#FFE566',
    fontSize: 20,
    lineHeight: 23,
    fontWeight: '900',
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  portraitHeadPlace: {
    width: '100%',
    marginTop: 2,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  portraitHeadWard: {
    width: '100%',
    marginTop: 1,
    textAlign: 'center',
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 17,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  portraitHeadWardStreet: {
    fontSize: 12,
    lineHeight: 15,
  },
  portraitHeadWardStreetTa: {
    fontSize: 10,
    lineHeight: 13,
  },
  portraitHeadMeta: {
    width: '100%',
    marginTop: 2,
    textAlign: 'center',
    color: '#FFE566',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  portraitFooter: {
    width: '100%',
    height: PORTRAIT_FOOTER_H,
    flexGrow: 0,
    flexShrink: 0,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  portraitFooterRow: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  portraitFooterOfficer: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 10,
  },
  portraitFooterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E2E8F0',
    borderWidth: 3,
    borderColor: REPORT_AMBER,
  },
  portraitFooterAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A3D66',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: REPORT_AMBER,
  },
  portraitFooterAvatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  portraitFooterOfficerText: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  portraitFooterKicker: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  portraitFooterName: {
    color: REPORT_AMBER,
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  portraitFooterRole: {
    marginTop: 1,
    color: '#fff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
  },
  portraitFooterMapFrame: {
    borderWidth: 1.5,
    borderColor: REPORT_AMBER,
    borderRadius: 6,
    overflow: 'hidden',
  },
  portraitPhotoHost: {
    width: PORTRAIT_W,
    height: PORTRAIT_PHOTO_AREA_H,
  },
  portraitTableWrap: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#fff',
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
    width: PORTRAIT_W,
    height: PORTRAIT_H,
    flexDirection: 'column',
    backgroundColor: '#fff',
  },
  landscapeExportInner: {
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
    fontSize: 13,
    lineHeight: 16,
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
    width: 78,
    maxWidth: 86,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: 'transparent',
    paddingHorizontal: 2,
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
    marginTop: 2,
    fontSize: 8,
    lineHeight: 11,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  exportOfficerRole: {
    width: '100%',
    marginTop: 1,
    fontSize: 7,
    lineHeight: 10,
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
    width: '100%',
    overflow: 'hidden',
  },
  landPhotoExport: {
    width: '58%',
    alignSelf: 'stretch',
    flexDirection: 'column',
    padding: LAND_EXPORT_PAD,
    backgroundColor: '#fff',
    justifyContent: 'flex-start',
  },
  landPaneTitle: { fontSize: 10, fontWeight: '800', color: '#334155', letterSpacing: 0.5, marginBottom: 6 },
  landPaneBody: { flex: 1, width: '100%', minHeight: 0 },
  exportSplit: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: REPORT_GREEN,
    flexShrink: 0,
  },
  exportFooterRule: {
    width: '100%',
    height: 3,
    backgroundColor: REPORT_GREEN,
  },
  exportPhotoFrame: {
    width: '100%',
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  exportPhotoFrameNatural: {
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'stretch',
  },
  exportPhotoFrameEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  exportStack: { width: '100%', gap: EXPORT_PHOTO_GAP },
  exportRow: { flexDirection: 'row', gap: EXPORT_PHOTO_GAP, alignItems: 'flex-start', width: '100%' },
  exportRowSlot: { flex: 1, minWidth: 0 },
  exportRowSide: { flex: 0.5, minWidth: 0 },
  exportRowMain: { flex: 2, minWidth: 0 },
  exportTile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  exportTileWell: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
    width: '100%',
    overflow: 'hidden',
  },
  exportTileImgContain: { width: '100%', height: '100%' },
  exportTileImg: { width: '100%', minHeight: 96 },
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
    padding: LAND_EXPORT_PAD,
    backgroundColor: '#F8FAFC',
    alignSelf: 'stretch',
    flexDirection: 'column',
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
  trExport: {
    alignItems: 'flex-start',
  },
  trAlt: { backgroundColor: '#F8FAFC' },
  tdL: { fontSize: 12, fontWeight: '700', color: '#1E3A5F', paddingHorizontal: 8, flexShrink: 1 },
  tdR: { fontSize: 12, fontWeight: '700', color: '#0F172A', paddingHorizontal: 8, flexShrink: 1 },
});

