/** Report chrome colors keyed to the web report-share theme id. */

export type ReportThemePack = {
  headerFrom: string;
  headerMid: string;
  headerTo: string;
  accent: string;
  highlight: string;
  tableHeader: string;
  tableHeaderText: string;
  caption: string;
};

function hexToRgb(hex: string) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = Number.parseInt(full, 16) || 0;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mix(a: string, b: string, t: number) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(A.r, B.r)}${c(A.g, B.g)}${c(A.b, B.b)}`;
}

function luminance(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function pack(from: string, to: string, accent: string): ReportThemePack {
  const highlight = mix(accent, '#FDE68A', 0.58);
  return {
    headerFrom: mix(from, '#ffffff', 0.16),
    headerMid: mix(from, to, 0.42),
    headerTo: to,
    accent,
    highlight,
    tableHeader: accent,
    tableHeaderText: luminance(accent) > 0.62 ? '#1A3D66' : '#FFFFFF',
    caption: accent,
  };
}

const REPORT_THEMES: Record<string, ReportThemePack> = {
  light: pack('#334155', '#0f172a', '#334155'),
  dark: pack('#475569', '#020617', '#cbd5e1'),
  'sunset-aurora': pack('#4c1d95', '#f59e0b', '#ea580c'),
  'ocean-wave': pack('#0b1b4b', '#0d9488', '#0891b2'),
  'magic-lavender': pack('#1e1b4b', '#db2777', '#db2777'),
  'rainbow-prism': pack('#0369a1', '#be123c', '#a21caf'),
  'nilgiri-emerald': pack('#064e3b', '#10b981', '#0d9488'),
  'kovai-maroon': pack('#7f1d1d', '#ea580c', '#b45309'),
  'madurai-blue': pack('#1e3a8a', '#8b5cf6', '#1e3a8a'),
  'nellai-orange': pack('#c2410c', '#f97316', '#c2410c'),
  'chennai-slate': pack('#1e293b', '#64748b', '#475569'),
  'royal-gold': pack('#78350f', '#f59e0b', '#d97706'),
  'crimson-ruby': pack('#881337', '#fb7185', '#e11d48'),
  'cyber-teal': pack('#134e4a', '#2dd4bf', '#0f766e'),
  custom: pack('#1e293b', '#4f46e5', '#4f46e5'),
};

export function reportThemeFromId(themeId?: string | null): ReportThemePack | null {
  const id = String(themeId || '').trim();
  if (!id) return null;
  return REPORT_THEMES[id] || REPORT_THEMES[id.replace(/_/g, '-')] || null;
}
