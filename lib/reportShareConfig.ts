import { defaultCustomThemeColors, themesConfig, type CustomThemeColors, type ThemeType } from '@/lib/themeConfig';

export const REPORT_SHARE_PLACEHOLDERS = [
  '{Zone_EN}',
  '{Zone_TA}',
  '{District_EN}',
  '{District_TA}',
  '{TownPanchayat_EN}',
  '{TownPanchayat_TA}',
  '{Ward_No}',
  '{Street_Name}',
  '{CategoryNameEn}',
  '{CategoryNameTa}',
  '{EmployeeName_EN}',
  '{EmployeeName_TA}',
  '{Designation_EN}',
  '{Designation_TA}',
  '{DateTime}',
  '{Gps}',
] as const;

export const DEFAULT_DETAILED_TEMPLATE_EN = `Respected Sir/Madam,

A field inspection on {CategoryNameEn} was carried out at Ward {Ward_No}, {Street_Name}, {TownPanchayat_EN} Town Panchayat, {District_EN} District, {Zone_EN} Zone. This is submitted for your kind information.

{EmployeeName_EN}
{Designation_EN}
{TownPanchayat_EN} Town Panchayat
{District_EN} District`;

export const DEFAULT_DETAILED_TEMPLATE_TA = `மதிப்பிற்குரிய அம்மையீர்/ஐயா வணக்கம்,

{Zone_TA} மண்டலம், {District_TA} மாவட்டம், {TownPanchayat_TA} பேரூராட்சி வார்டு எண்.{Ward_No}, {Street_Name} பகுதியில் {CategoryNameTa} தொடர்பாக கள ஆய்வு மேற்கொள்ளப்பட்டது என்ற விவரம் பணிந்து சமர்ப்பிக்கப்படுகிறது.

{EmployeeName_TA}
{Designation_TA}
{TownPanchayat_TA} பேரூராட்சி
{District_TA} மாவட்டம்`;

export const DEFAULT_IMAGES_TEMPLATE_EN = DEFAULT_DETAILED_TEMPLATE_EN;
export const DEFAULT_IMAGES_TEMPLATE_TA = DEFAULT_DETAILED_TEMPLATE_TA;

export const REPORT_THEME_IDS = Object.keys(themesConfig) as ThemeType[];

export const DEFAULT_REPORT_THEME = {
  headerFrom: '#4CB86A',
  headerMid: '#288C46',
  headerTo: '#1B6B34',
  accent: '#1A3D66',
  tableHeader: '#FBBF24',
  tableHeaderText: '#1A3D66',
  pageBackground: '#EEF2F6',
  messageBackground: '#F8D4C6',
  messageText: '#3F2A28',
  caption: '#800000',
};

export type ReportTheme = typeof DEFAULT_REPORT_THEME;

export const REPORT_SHARE_PREVIEW_VALUES: Record<string, string> = {
  Zone_EN: 'Thiruvallur',
  Zone_TA: 'திருவள்ளூர்',
  District_EN: 'Tiruvallur',
  District_TA: 'திருவள்ளூர்',
  TownPanchayat_EN: 'Gummidipoondi',
  TownPanchayat_TA: 'கும்மிடிப்பூண்டி',
  Ward_No: '1',
  Street_Name: 'Gangan Thotti',
  CategoryNameEn: 'Waste Reduction Awareness Drive',
  CategoryNameTa: 'காலை ஆய்வு - வீடு வீடாக குப்பை சேகரிப்பு',
  EmployeeName_EN: 'Guna',
  EmployeeName_TA: 'குணா',
  Designation_EN: 'Computer Operator',
  Designation_TA: 'கணினி இயக்குநர்',
  DateTime: '08-11-2026 · 09:35 AM',
  Gps: '13.36098, 80.13814',
};

export function fillReportShareTemplate(template: string, values: Record<string, string>): string {
  return String(template || '').replace(/\{([A-Za-z_]+)\}/g, (token, key) => {
    const value = values[key];
    return value == null || value === '' ? '' : value;
  });
}

export function reportThemeForId(themeId: string, custom?: Partial<CustomThemeColors>): ReportTheme {
  const id = (REPORT_THEME_IDS.includes(themeId as ThemeType) ? themeId : 'nilgiri-emerald') as ThemeType;
  const conf = themesConfig[id];
  const colors = { ...defaultCustomThemeColors, ...(custom || {}) };
  const accent = id === 'custom' ? colors.primaryColor : conf.accentColor;
  const headerFrom = DEFAULT_REPORT_THEME.headerFrom;
  const headerTo = DEFAULT_REPORT_THEME.headerTo;
  return {
    headerFrom,
    headerMid: DEFAULT_REPORT_THEME.headerMid,
    headerTo,
    accent,
    tableHeader: accent,
    tableHeaderText: luminance(accent) > 0.62 ? '#1A3D66' : '#FFFFFF',
    pageBackground: '#EEF2F6',
    messageBackground: mix(accent, '#FFFFFF', 0.82),
    messageText: '#1F2937',
    caption: accent,
  };
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function hexToRgb(hex: string) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(A.r, B.r)}${c(A.g, B.g)}${c(A.b, B.b)}`;
}

function isHeaderLineTemplate(text: string) {
  const t = String(text || '').trim();
  if (!t) return true;
  return t.includes('{DateTime}') && t.includes('{Gps}') && t.split('\n').length <= 6;
}

function firstLetterTemplate(...candidates: string[]) {
  for (const candidate of candidates) {
    const value = String(candidate || '').trim();
    if (value && !isHeaderLineTemplate(value)) return value;
  }
  return '';
}

export function resolveReportShare(settings: any) {
  const saved = settings?.reportShare || {};
  const legacy = String(saved.template || '');
  const templateEn = firstLetterTemplate(saved.captionTemplateEn, saved.detailedTemplateEn, saved.imagesTemplateEn) || DEFAULT_DETAILED_TEMPLATE_EN;
  const templateTa = firstLetterTemplate(saved.captionTemplateTa, saved.detailedTemplateTa, saved.imagesTemplateTa, legacy) || DEFAULT_DETAILED_TEMPLATE_TA;
  return {
    enabled: saved.enabled !== false,
    captionTemplateEn: templateEn,
    captionTemplateTa: templateTa,
    imagesTemplateEn: templateEn,
    imagesTemplateTa: templateTa,
    detailedTemplateEn: templateEn,
    detailedTemplateTa: templateTa,
    themeId: String(saved.themeId || ''),
    theme: {
      ...(saved.themeId ? reportThemeForId(String(saved.themeId), settings?.customColors) : { ...DEFAULT_REPORT_THEME }),
      ...(saved.theme?.messageBackground ? { messageBackground: saved.theme.messageBackground } : {}),
      ...(saved.theme?.messageText ? { messageText: saved.theme.messageText } : {}),
    },
  };
}
