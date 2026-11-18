export type ShareCardPaint = {
  id: string;
  name: string;
  group: 'flat' | 'premium_dark' | 'premium_light' | 'greenery';
  header: string[];
  footer: string[];
  accent: string;
  title: string;
  primary: string;
  secondary: string;
  footerName: string;
  footerRole: string;
  avatarFill: string[];
  avatarLetter: string;
  avatarRing: string;
  textShadow: boolean;
  photoGap: string;
};

export const DEFAULT_SHARE_CARD_THEME_ID = 'flat_maroon_gold';

export const SHARE_CARD_GROUPS: { id: ShareCardPaint['group'] | 'all'; labelEn: string; labelTa: string }[] = [
  { id: 'all', labelEn: 'All', labelTa: 'அனைத்தும்' },
  { id: 'flat', labelEn: 'Flat', labelTa: 'பிளாட்' },
  { id: 'premium_dark', labelEn: 'Dark', labelTa: 'இருள்' },
  { id: 'premium_light', labelEn: 'Light', labelTa: 'வெளிர்' },
  { id: 'greenery', labelEn: 'Green', labelTa: 'பச்சை' },
];

const GOLD = '#F5C518';
const GOLD_TITLE = '#F0C43C';
const WHITE = '#FFFFFF';

function t(
  id: string,
  name: string,
  group: ShareCardPaint['group'],
  header: string[],
  footer: string[],
  extra: Partial<ShareCardPaint> = {},
): ShareCardPaint {
  const accent = extra.accent || GOLD;
  const title = extra.title || GOLD_TITLE;
  return {
    id,
    name,
    group,
    header,
    footer,
    accent,
    title,
    primary: extra.primary || WHITE,
    secondary: extra.secondary || '#FAEEDA',
    footerName: extra.footerName || title,
    footerRole: extra.footerRole || WHITE,
    avatarFill: extra.avatarFill || footer,
    avatarLetter: extra.avatarLetter || title,
    avatarRing: extra.avatarRing || accent,
    textShadow: extra.textShadow ?? (group !== 'flat' && group !== 'premium_light'),
    photoGap: extra.photoGap || (group === 'premium_light' || group === 'flat' ? WHITE : header[0]),
  };
}

export const SHARE_CARD_THEMES: ShareCardPaint[] = [
  t('flat_maroon_gold', 'Maroon Gold', 'flat', ['#8E1B1B'], ['#1F2C6E'], { accent: GOLD, title: GOLD, secondary: '#FAEEDA', avatarFill: [GOLD], avatarLetter: '#1F2C6E', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_govt_green', 'Govt Green', 'flat', ['#0B5D3B'], ['#063A25'], { accent: GOLD, title: GOLD, secondary: '#E1F5EA', avatarFill: [GOLD], avatarLetter: '#063A25', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_navy_saffron', 'Navy Saffron', 'flat', ['#1F2C6E'], ['#1F2C6E'], { accent: '#F28C28', title: '#FFB048', secondary: '#D6E2FA', avatarFill: ['#F28C28'], avatarLetter: WHITE, avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_teal_gold', 'Teal Gold', 'flat', ['#0F6E56'], ['#04342C'], { accent: '#FAC775', title: '#FAC775', secondary: '#E1F5EE', avatarFill: ['#FAC775'], avatarLetter: '#04342C', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_purple_gold', 'Purple Gold', 'flat', ['#3C3489'], ['#26215C'], { accent: '#FAC775', title: '#FAC775', secondary: '#EEEDFE', avatarFill: ['#FAC775'], avatarLetter: '#26215C', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_black_gold', 'Black Gold', 'flat', ['#1A1A1A'], ['#1A1A1A'], { accent: '#D4AF37', title: '#D4AF37', secondary: '#D2D2D2', avatarFill: ['#D4AF37'], avatarLetter: '#1A1A1A', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_white_maroon', 'White Maroon', 'flat', ['#FFFFFF'], ['#8E1B1B'], { accent: '#8E1B1B', title: '#8E1B1B', primary: '#1E1E1E', secondary: '#5A5A5A', footerName: GOLD, footerRole: WHITE, avatarFill: [GOLD], avatarLetter: '#8E1B1B', avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('flat_sky_blue', 'Sky Blue', 'flat', ['#0C447C'], ['#042C53'], { accent: '#378ADD', title: WHITE, primary: '#E6F1FB', secondary: '#B5D4F4', footerName: '#85B7EB', avatarFill: ['#378ADD'], avatarLetter: WHITE, avatarRing: WHITE, textShadow: false, photoGap: WHITE }),
  t('dark_royal_maroon', 'Royal Maroon', 'premium_dark', ['#46080E', '#9E2028'], ['#34060A', '#78161E'], { title: GOLD_TITLE, secondary: '#F5E2D2', textShadow: true, photoGap: '#46080E', avatarRing: GOLD }),
  t('dark_emerald', 'Emerald', 'premium_dark', ['#03281A', '#10764C'], ['#021E14', '#0A5638'], { title: GOLD_TITLE, secondary: '#D6F0E2', textShadow: true, photoGap: '#03281A', avatarRing: GOLD }),
  t('dark_midnight_navy', 'Midnight Navy', 'premium_dark', ['#080E30', '#263E94'], ['#060A24', '#1C2E70'], { title: GOLD_TITLE, secondary: '#D2DEFA', textShadow: true, photoGap: '#080E30', avatarRing: GOLD }),
  t('dark_deep_teal', 'Deep Teal', 'premium_dark', ['#022422', '#0E7864'], ['#011C1A', '#0A5A4C'], { title: GOLD_TITLE, secondary: '#D0F0E8', textShadow: true, photoGap: '#022422', avatarRing: GOLD }),
  t('dark_royal_purple', 'Royal Purple', 'premium_dark', ['#180E40', '#5C44B4'], ['#120A30', '#42308C'], { title: GOLD_TITLE, secondary: '#E8E4FF', textShadow: true, photoGap: '#180E40', avatarRing: GOLD }),
  t('dark_black_gold', 'Black Gold', 'premium_dark', ['#060606', '#3A3428'], ['#040404', '#2C281E'], { title: GOLD_TITLE, secondary: '#D6CEBA', textShadow: true, photoGap: '#060606', avatarRing: GOLD }),
  t('dark_ivory_maroon', 'Ivory Maroon', 'premium_dark', ['#FFFAEE', '#E8D6B2'], ['#46080E', '#961E26'], { title: '#6E0E16', primary: '#3C1010', secondary: '#6E3C32', footerName: GOLD_TITLE, footerRole: WHITE, textShadow: false, photoGap: '#46080E', avatarRing: GOLD }),
  t('dark_ocean_silver', 'Ocean Silver', 'premium_dark', ['#021836', '#1468B2'], ['#02122A', '#0E4C88'], { accent: '#D6E2F0', title: '#D6E2F0', secondary: '#C8E2FA', textShadow: true, photoGap: '#021836', avatarRing: '#D6E2F0' }),
  t('light_pearl_gold', 'Pearl Gold', 'premium_light', ['#FFFFFF', '#ECE6D6'], ['#ECE6D6', '#FFFFFF'], { accent: GOLD, title: '#966C14', primary: '#28241E', secondary: '#645A46', footerRole: '#28241E', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_mint_fresh', 'Mint Fresh', 'premium_light', ['#F4FDF8', '#C4ECD6'], ['#C4ECD6', '#F4FDF8'], { accent: '#388C40', title: '#0E603A', primary: '#0E4830', secondary: '#326E50', footerRole: '#0E4830', textShadow: false, photoGap: WHITE, avatarRing: '#388C40' }),
  t('light_sky_light', 'Sky Light', 'premium_light', ['#F4FAFF', '#C0DEF8'], ['#C0DEF8', '#F4FAFF'], { accent: '#AAB6C6', title: '#12468C', primary: '#0C3062', secondary: '#345A8C', footerRole: '#0C3062', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_peach_saffron', 'Peach Saffron', 'premium_light', ['#FFFAF0', '#FCD6A8'], ['#FCD6A8', '#FFFAF0'], { accent: GOLD, title: '#AA3C0A', primary: '#6E280A', secondary: '#965028', footerRole: '#6E280A', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_lavender', 'Lavender', 'premium_light', ['#FAF8FF', '#DED6FA'], ['#DED6FA', '#FAF8FF'], { accent: '#AAB6C6', title: '#503AAA', primary: '#342878', secondary: '#6054A0', footerRole: '#342878', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_cream_maroon', 'Cream Maroon', 'premium_light', ['#FFFCF4', '#F0E2C4'], ['#F0E2C4', '#FFFCF4'], { accent: GOLD, title: '#78121A', primary: '#5A1016', secondary: '#82463C', footerRole: '#5A1016', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('green_forest_gold', 'Forest Gold', 'greenery', ['#042814', '#287832'], ['#031E10', '#1C5C28'], { title: GOLD_TITLE, secondary: '#E1F0E4', textShadow: true, photoGap: '#042814', avatarRing: GOLD }),
  t('green_fresh_leaf', 'Fresh Leaf', 'greenery', ['#145A1E', '#6EBE5A'], ['#0E4618', '#469640'], { title: '#ECFAC8', secondary: '#E1F0E4', textShadow: true, photoGap: '#145A1E', avatarRing: '#DCF0AA' }),
  t('green_teal_green', 'Teal Green', 'greenery', ['#004038', '#46AA5A'], ['#00322C', '#288250'], { title: GOLD_TITLE, secondary: '#E1F0E4', textShadow: true, photoGap: '#004038', avatarRing: GOLD }),
  t('green_nature_lime', 'Nature Lime', 'greenery', ['#105C28', '#A8C428'], ['#0C461E', '#6EA024'], { title: '#FAF0AA', secondary: '#E1F0E4', textShadow: true, photoGap: '#105C28', avatarRing: GOLD }),
  t('green_sage_light', 'Sage Light', 'greenery', ['#F0F6EA', '#BAD2A6'], ['#BAD2A6', '#F0F6EA'], { accent: '#388C40', title: '#2C5C22', primary: '#20401C', secondary: '#46643C', footerRole: '#20401C', textShadow: false, photoGap: WHITE, avatarRing: '#388C40' }),
  t('green_emerald_mint', 'Emerald Mint', 'greenery', ['#023C2C', '#3CBE8C'], ['#022E22', '#1E8C64'], { title: '#DCF8EC', secondary: '#E1F0E4', textShadow: true, photoGap: '#023C2C', avatarRing: '#AAB6C6' }),
  t('light_rose_blush', 'Rose Blush', 'premium_light', ['#FFF7FA', '#F8D0DE'], ['#F8D0DE', '#FFF7FA'], { accent: GOLD, title: '#A01E50', primary: '#6E143C', secondary: '#964664', footerRole: '#6E143C', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_champagne', 'Champagne', 'premium_light', ['#FFFCF5', '#EEDCBA'], ['#EEDCBA', '#FFFCF5'], { accent: GOLD, title: '#966C14', primary: '#503814', secondary: '#82683C', footerRole: '#503814', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_powder_blue', 'Powder Blue', 'premium_light', ['#F6FAFF', '#CEE0F6'], ['#CEE0F6', '#F6FAFF'], { accent: '#AAB6C6', title: '#143C8C', primary: '#102A60', secondary: '#3C5A8C', footerRole: '#102A60', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_coral_sunset', 'Coral Sunset', 'premium_light', ['#FFF6F0', '#FAC4B0'], ['#FAC4B0', '#FFF6F0'], { accent: GOLD, title: '#B43C1E', primary: '#782814', secondary: '#A0543C', footerRole: '#782814', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_lemon_gold', 'Lemon Gold', 'premium_light', ['#FFFDEC', '#FAE896'], ['#FAE896', '#FFFDEC'], { accent: GOLD, title: '#966800', primary: '#604200', secondary: '#82641E', footerRole: '#604200', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
  t('light_silver_grey', 'Silver Grey', 'premium_light', ['#FCFCFE', '#D4D8E2'], ['#D4D8E2', '#FCFCFE'], { accent: '#AAB6C6', title: '#323848', primary: '#282C38', secondary: '#5A606E', footerRole: '#282C38', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_lilac_rose', 'Lilac Rose', 'premium_light', ['#FCF6FF', '#EACEF0'], ['#EACEF0', '#FCF6FF'], { accent: '#AAB6C6', title: '#6E288C', primary: '#5A1E6E', secondary: '#825096', footerRole: '#5A1E6E', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_ice_blue', 'Ice Blue', 'premium_light', ['#F2FCFF', '#BEE6F6'], ['#BEE6F6', '#F2FCFF'], { accent: '#AAB6C6', title: '#0A5A88', primary: '#0A4264', secondary: '#326888', footerRole: '#0A4264', textShadow: false, photoGap: WHITE, avatarRing: '#AAB6C6' }),
  t('light_sand_beige', 'Sand Beige', 'premium_light', ['#FCF8F0', '#E2CEB0'], ['#E2CEB0', '#FCF8F0'], { accent: GOLD, title: '#74481E', primary: '#46301A', secondary: '#785E42', footerRole: '#46301A', textShadow: false, photoGap: WHITE, avatarRing: GOLD }),
];

export function resolveShareCardPaint(id?: string | null): ShareCardPaint {
  const key = String(id || '').trim();
  return SHARE_CARD_THEMES.find((item) => item.id === key) || SHARE_CARD_THEMES[0];
}

export function shareCardGradient(colors: string[]): [string, string, ...string[]] {
  if (colors.length >= 2) return colors as [string, string, ...string[]];
  const color = colors[0] || '#1A1A1A';
  return [color, color];
}
