export interface AppPalette {
  id: string;
  nameEn: string;
  nameTa: string;
  primary: string;
  primaryContainer: string;
  secondary: string;
  surface: string;
  background: string;
  textPrimary: string;
  cardBorder: string;
  isGradient: boolean;
  gradientColors: string[];
  chartShades: string[];
}

/** Shared icon/header badge fill — reads on every theme accent. */
export const BRAND_NAVY = '#1A3D66';

const base = {
  surface: '#F8FAFC',
  background: '#F1F5F9',
  textPrimary: '#0F172A',
  cardBorder: '#E2E8F0',
};

export const palettes: AppPalette[] = [
  { id: 'royal_gold', nameEn: 'Royal Gold', nameTa: 'ராயல் தங்கம்', primary: '#D97706', primaryContainer: '#FEF3C7', secondary: '#B45309', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'crimson_ruby', nameEn: 'Crimson Ruby', nameTa: 'மாணிக்க சிவப்பு', primary: '#DC2626', primaryContainer: '#FEE2E2', secondary: '#991B1B', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'cyber_teal', nameEn: 'Cyber Teal', nameTa: 'சைபர் நீலம்', primary: '#0D9488', primaryContainer: '#CCFBF1', secondary: '#0F766E', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'sunset_aurora', nameEn: 'Sunset Aurora', nameTa: 'சூரிய அஸ்தமன ஆரஞ்சு', primary: '#EA580C', primaryContainer: '#FFEDD5', secondary: '#C2410C', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'ocean_wave', nameEn: 'Ocean Wave', nameTa: 'கடல் அலை', primary: '#0284C7', primaryContainer: '#E0F2FE', secondary: '#0369A1', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'nilgiri_emerald', nameEn: 'Nilgiri Emerald', nameTa: 'நீலகிரி மரகதம்', primary: '#16A34A', primaryContainer: '#DCFCE7', secondary: '#15803D', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'kovai_maroon', nameEn: 'Kovai Maroon', nameTa: 'கோவை மெரூன்', primary: '#9F1239', primaryContainer: '#FFE4E6', secondary: '#881337', isGradient: false, gradientColors: [], chartShades: [], ...base },
  { id: 'saffron_sunshine', nameEn: 'Saffron Gradient', nameTa: 'குங்குமப்பூ சுடர் (Multi)', primary: '#F97316', primaryContainer: '#FEF3C7', secondary: '#EA580C', isGradient: true, gradientColors: ['#F97316', '#FBBF24'], chartShades: [], ...base },
  { id: 'royal_amethyst', nameEn: 'Royal Amethyst', nameTa: 'அரச நீல ஊதா (Multi)', primary: '#6366F1', primaryContainer: '#E0E7FF', secondary: '#4F46E5', isGradient: true, gradientColors: ['#6366F1', '#A855F7'], chartShades: [], ...base },
  { id: 'cauvery_indigo', nameEn: 'Cauvery Indigo', nameTa: 'காவிரி இந்திர நீலம் (Multi)', primary: '#1D4ED8', primaryContainer: '#DBEAFE', secondary: '#1E40AF', isGradient: true, gradientColors: ['#1D4ED8', '#06B6D4'], chartShades: [], ...base },
  { id: 'madurai_jasmine', nameEn: 'Madurai Pink', nameTa: 'மதுரை மல்லிகை ரோஸ் (Multi)', primary: '#EC4899', primaryContainer: '#FCE7F3', secondary: '#DB2777', isGradient: true, gradientColors: ['#EC4899', '#F43F5E'], chartShades: [], ...base },
  { id: 'forest_sunrise', nameEn: 'Forest Sunrise', nameTa: 'வன சூரிய உதயம் (Multi)', primary: '#10B981', primaryContainer: '#D1FAE5', secondary: '#047857', isGradient: true, gradientColors: ['#115E59', '#10B981'], chartShades: ['#10B981', '#14B8A6', '#059669', '#34D399', '#047857'], ...base },
  { id: 'coral_bliss', nameEn: 'Coral Sunset', nameTa: 'பவள அந்தி (Multi)', primary: '#F43F5E', primaryContainer: '#FFE4E6', secondary: '#E11D48', isGradient: true, gradientColors: ['#FB7185', '#F97316'], chartShades: ['#FB7185', '#F97316', '#F43F5E', '#FB923C', '#E11D48'], ...base },
  { id: 'neon_cyan', nameEn: 'Cyber Cyan', nameTa: 'மின்மய நீலம் (Multi)', primary: '#06B6D4', primaryContainer: '#CFFAFE', secondary: '#0891B2', isGradient: true, gradientColors: ['#06B6D4', '#3B82F6'], chartShades: ['#06B6D4', '#3B82F6', '#0891B2', '#60A5FA', '#0284C7'], ...base },
  { id: 'peacock_plume', nameEn: 'Peacock Royal', nameTa: 'மயில் தோகை நீலம் (Multi)', primary: '#0D9488', primaryContainer: '#CCFBF1', secondary: '#4338CA', isGradient: true, gradientColors: ['#0D9488', '#4338CA'], chartShades: ['#0D9488', '#4338CA', '#14B8A6', '#6366F1', '#0F766E'], ...base },
  { id: 'twilight_violet', nameEn: 'Twilight Violet', nameTa: 'அந்திய மாலை ஊதா (Multi)', primary: '#8B5CF6', primaryContainer: '#EDE9FE', secondary: '#7C3AED', isGradient: true, gradientColors: ['#8B5CF6', '#EC4899'], chartShades: ['#8B5CF6', '#EC4899', '#7C3AED', '#F472B6', '#A855F7'], ...base },
  { id: 'amber_flame', nameEn: 'Amber Fire', nameTa: 'தீச்சுடர் அம்பர் (Multi)', primary: '#F59E0B', primaryContainer: '#FEF3C7', secondary: '#DC2626', isGradient: true, gradientColors: ['#F59E0B', '#EF4444'], chartShades: ['#F59E0B', '#EF4444', '#D97706', '#F87171', '#B45309'], ...base },
  { id: 'mint_lagoon', nameEn: 'Mint Lagoon', nameTa: 'புதினா அலை (Multi)', primary: '#14B8A6', primaryContainer: '#CCFBF1', secondary: '#0F766E', isGradient: true, gradientColors: ['#14B8A6', '#10B981'], chartShades: ['#14B8A6', '#10B981', '#0D9488', '#34D399', '#059669'], ...base },
];

export function getPaletteById(id: string): AppPalette {
  return palettes.find((p) => p.id === id) || palettes[0];
}
