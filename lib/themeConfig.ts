export type ThemeType = 
  | 'sunset-aurora'
  | 'ocean-wave'
  | 'magic-lavender'
  | 'rainbow-prism'
  | 'nilgiri-emerald'
  | 'kovai-maroon'
  | 'madurai-blue'
  | 'nellai-orange'
  | 'chennai-slate'
  | 'royal-gold'
  | 'crimson-ruby'
  | 'cyber-teal'
  | 'custom';

export interface ThemeConfig {
  id: ThemeType;
  nameEn: string;
  nameTa: string;
  sidebarBg: string;
  sidebarActive: string;
  sidebarHover: string;
  mainBg: string;
  accentColor: string;
  contrastBg: string;
  cardBorder: string;
  primaryCta: string;
  secondaryCta: string;
  chartColors: string[];
  chartGradient: string[];
}

export interface CustomThemeColors {
  sidebarFrom: string;
  sidebarTo: string;
  primaryColor: string;
  accentBgColor: string;
  appBgColor: string;
}

export const defaultCustomThemeColors: CustomThemeColors = {
  sidebarFrom: '#1e293b',
  sidebarTo: '#0f172a',
  primaryColor: '#4f46e5',
  accentBgColor: '#e0e7ff',
  appBgColor: '#f8fafc',
};

export const themesConfig: Record<ThemeType, ThemeConfig> = {
  'sunset-aurora': {
    id: 'sunset-aurora',
    nameEn: 'Sunset Aurora',
    nameTa: 'செவ்வான விடியல்',
    sidebarBg: 'bg-[linear-gradient(135deg,#4c1d95,#b91c1c,#f59e0b)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#fffbfa]',
    accentColor: '#ea580c',
    contrastBg: 'bg-orange-50/70 text-orange-900 border-orange-200',
    cardBorder: 'border-l-4 border-amber-500',
    primaryCta: 'bg-gradient-to-r from-violet-600 via-red-500 to-amber-500 hover:scale-[1.02] hover:shadow-md hover:shadow-red-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-orange-200 text-orange-900 hover:bg-orange-50/50',
    chartColors: ['#4c1d95', '#b91c1c', '#f59e0b', '#ef4444'],
    chartGradient: ['#4c1d95', '#f59e0b']
  },
  'ocean-wave': {
    id: 'ocean-wave',
    nameEn: 'Ocean Wave',
    nameTa: 'கடல் அலை',
    sidebarBg: 'bg-[linear-gradient(135deg,#0f172a,#0891b2,#0d9488)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#f4fbfd]',
    accentColor: '#0891b2',
    contrastBg: 'bg-cyan-50/70 text-cyan-900 border-cyan-200',
    cardBorder: 'border-l-4 border-cyan-500',
    primaryCta: 'bg-gradient-to-r from-blue-700 via-teal-600 to-cyan-500 hover:scale-[1.02] hover:shadow-md hover:shadow-cyan-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-cyan-200 text-cyan-900 hover:bg-cyan-50/50',
    chartColors: ['#0f172a', '#0891b2', '#0d9488', '#06b6d4'],
    chartGradient: ['#0f172a', '#0d9488']
  },
  'magic-lavender': {
    id: 'magic-lavender',
    nameEn: 'Magic Lavender',
    nameTa: 'மந்திர லாவெண்டர்',
    sidebarBg: 'bg-[linear-gradient(135deg,#1e1b4b,#701a75,#db2777)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#faf5f8]',
    accentColor: '#db2777',
    contrastBg: 'bg-fuchsia-50/70 text-fuchsia-900 border-fuchsia-200',
    cardBorder: 'border-l-4 border-fuchsia-500',
    primaryCta: 'bg-gradient-to-r from-indigo-700 via-fuchsia-600 to-pink-500 hover:scale-[1.02] hover:shadow-md hover:shadow-fuchsia-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-fuchsia-200 text-fuchsia-900 hover:bg-fuchsia-50/50',
    chartColors: ['#1e1b4b', '#701a75', '#db2777', '#ec4899'],
    chartGradient: ['#1e1b4b', '#db2777']
  },
  'rainbow-prism': {
    id: 'rainbow-prism',
    nameEn: 'Rainbow Prism',
    nameTa: 'வானவில் பிரிசம்',
    sidebarBg: 'bg-[linear-gradient(135deg,#0369a1,#15803d,#a21caf,#be123c)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#f8fafc]',
    accentColor: '#a21caf',
    contrastBg: 'bg-slate-100/70 text-slate-900 border-slate-200',
    cardBorder: 'border-l-4 border-indigo-500',
    primaryCta: 'bg-gradient-to-r from-sky-600 via-emerald-600 via-pink-600 to-indigo-600 hover:scale-[1.02] hover:shadow-md hover:shadow-indigo-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-slate-200 text-slate-900 hover:bg-slate-100/50',
    chartColors: ['#0369a1', '#15803d', '#a21caf', '#be123c'],
    chartGradient: ['#0369a1', '#be123c']
  },
  'nilgiri-emerald': {
    id: 'nilgiri-emerald',
    nameEn: 'Nilgiri Emerald',
    nameTa: 'நீலகிரி மரகதம்',
    sidebarBg: 'bg-[linear-gradient(135deg,#064e3b,#0d9488)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#f0faf6]',
    accentColor: '#0d9488',
    contrastBg: 'bg-emerald-50/70 text-emerald-900 border-emerald-200',
    cardBorder: 'border-l-4 border-emerald-600',
    primaryCta: 'bg-gradient-to-r from-emerald-800 via-teal-700 to-emerald-600 hover:scale-[1.02] hover:shadow-md hover:shadow-emerald-600/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-emerald-200 text-emerald-900 hover:bg-emerald-50/50',
    chartColors: ['#064e3b', '#0d9488', '#10b981', '#34d399'],
    chartGradient: ['#064e3b', '#10b981']
  },
  'kovai-maroon': {
    id: 'kovai-maroon',
    nameEn: 'Kovai Maroon',
    nameTa: 'கோவை மரூன்',
    sidebarBg: 'bg-[linear-gradient(135deg,#7f1d1d,#b45309)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#fffaf9]',
    accentColor: '#b45309',
    contrastBg: 'bg-red-50/70 text-red-900 border-red-200',
    cardBorder: 'border-l-4 border-red-600',
    primaryCta: 'bg-gradient-to-r from-red-800 via-amber-700 to-red-600 hover:scale-[1.02] hover:shadow-md hover:shadow-red-600/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-red-200 text-red-900 hover:bg-red-50/50',
    chartColors: ['#7f1d1d', '#b45309', '#ea580c', '#f59e0b'],
    chartGradient: ['#7f1d1d', '#ea580c']
  },
  'madurai-blue': {
    id: 'madurai-blue',
    nameEn: 'Madurai Blue',
    nameTa: 'மதுரை நீலம்',
    sidebarBg: 'bg-[linear-gradient(135deg,#1e3a8a,#581c87)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#f5f8ff]',
    accentColor: '#1e3a8a',
    contrastBg: 'bg-blue-50/70 text-blue-900 border-blue-200',
    cardBorder: 'border-l-4 border-blue-600',
    primaryCta: 'bg-gradient-to-r from-blue-800 via-indigo-700 to-purple-600 hover:scale-[1.02] hover:shadow-md hover:shadow-blue-600/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-blue-200 text-blue-900 hover:bg-blue-50/50',
    chartColors: ['#1e3a8a', '#581c87', '#3b82f6', '#8b5cf6'],
    chartGradient: ['#1e3a8a', '#8b5cf6']
  },
  'nellai-orange': {
    id: 'nellai-orange',
    nameEn: 'Nellai Orange',
    nameTa: 'நெல்லை ஆரஞ்சு',
    sidebarBg: 'bg-[linear-gradient(135deg,#c2410c,#991b1b)]',
    sidebarActive: 'bg-white/20 text-white shadow-xs border border-white/10 font-bold',
    sidebarHover: 'hover:bg-white/15 hover:text-white hover:border-l-4 hover:border-orange-500 transition-all',
    mainBg: 'bg-[#fffbf9]',
    accentColor: '#c2410c',
    contrastBg: 'bg-orange-50/70 text-orange-900 border-orange-200',
    cardBorder: 'border-l-4 border-orange-500',
    primaryCta: 'bg-gradient-to-r from-orange-700 via-red-600 to-orange-500 hover:scale-[1.02] hover:shadow-md hover:shadow-orange-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-orange-200 text-orange-900 hover:bg-orange-50/50',
    chartColors: ['#c2410c', '#991b1b', '#ea580c', '#f97316'],
    chartGradient: ['#c2410c', '#f97316']
  },
  'chennai-slate': {
    id: 'chennai-slate',
    nameEn: 'Chennai Slate',
    nameTa: 'சென்னை ஸ்லேட்',
    sidebarBg: 'bg-[linear-gradient(135deg,#1e293b,#0f172a)]',
    sidebarActive: 'bg-white/10 text-white shadow-xs',
    sidebarHover: 'hover:bg-black/30 hover:text-white',
    mainBg: 'bg-[#f8fafc]',
    accentColor: '#475569',
    contrastBg: 'bg-slate-100/70 text-slate-900 border-slate-200',
    cardBorder: 'border-l-4 border-slate-600',
    primaryCta: 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 hover:from-black hover:to-black transition-all text-white font-semibold',
    secondaryCta: 'border border-slate-200 text-slate-900 hover:bg-slate-100/50',
    chartColors: ['#1e293b', '#0f172a', '#475569', '#64748b'],
    chartGradient: ['#1e293b', '#64748b']
  },
  'royal-gold': {
    id: 'royal-gold',
    nameEn: 'Royal Gold',
    nameTa: 'அரச பொன்',
    sidebarBg: 'bg-[linear-gradient(135deg,#78350f,#d97706,#f59e0b)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#fffdf5]',
    accentColor: '#d97706',
    contrastBg: 'bg-amber-50/70 text-amber-900 border-amber-200',
    cardBorder: 'border-l-4 border-amber-500',
    primaryCta: 'bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 hover:scale-[1.02] hover:shadow-md hover:shadow-amber-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-amber-200 text-amber-900 hover:bg-amber-50/50',
    chartColors: ['#78350f', '#d97706', '#f59e0b', '#fbbf24'],
    chartGradient: ['#78350f', '#f59e0b']
  },
  'crimson-ruby': {
    id: 'crimson-ruby',
    nameEn: 'Crimson Ruby',
    nameTa: 'மாணிக்க சிவப்பு',
    sidebarBg: 'bg-[linear-gradient(135deg,#881337,#e11d48,#fb7185)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#fff5f7]',
    accentColor: '#e11d48',
    contrastBg: 'bg-rose-50/70 text-rose-900 border-rose-200',
    cardBorder: 'border-l-4 border-rose-500',
    primaryCta: 'bg-gradient-to-r from-rose-700 via-rose-600 to-pink-500 hover:scale-[1.02] hover:shadow-md hover:shadow-rose-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-rose-200 text-rose-900 hover:bg-rose-50/50',
    chartColors: ['#881337', '#e11d48', '#be123c', '#fb7185'],
    chartGradient: ['#881337', '#fb7185']
  },
  'cyber-teal': {
    id: 'cyber-teal',
    nameEn: 'Cyber Teal',
    nameTa: 'நவீன நீலப்பச்சை',
    sidebarBg: 'bg-[linear-gradient(135deg,#134e4a,#0f766e,#14b8a6)]',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: 'bg-[#f0fdfa]',
    accentColor: '#0f766e',
    contrastBg: 'bg-teal-50/70 text-teal-900 border-teal-200',
    cardBorder: 'border-l-4 border-teal-500',
    primaryCta: 'bg-gradient-to-r from-teal-800 via-teal-600 to-emerald-500 hover:scale-[1.02] hover:shadow-md hover:shadow-teal-500/10 transition-all text-white font-semibold',
    secondaryCta: 'border border-teal-200 text-teal-900 hover:bg-teal-50/50',
    chartColors: ['#134e4a', '#0f766e', '#14b8a6', '#2dd4bf'],
    chartGradient: ['#134e4a', '#2dd4bf']
  },
  'custom': {
    id: 'custom',
    nameEn: 'Custom Theme',
    nameTa: 'தனிப்பயன் தீம்',
    sidebarBg: '',
    sidebarActive: 'bg-white/15 text-white shadow-xs border border-white/10',
    sidebarHover: 'hover:bg-white/10 hover:text-white',
    mainBg: '',
    accentColor: '#4f46e5',
    contrastBg: 'custom-contrast',
    cardBorder: 'border-l-4 border-[var(--theme-active-menu)]',
    primaryCta: 'custom-primary-cta',
    secondaryCta: 'custom-secondary-cta',
    chartColors: ['#4f46e5', '#10b981', '#f59e0b', '#ef4444'],
    chartGradient: ['#4f46e5', '#10b981']
  }
};
