export const UI_SCALE_KEY = 'tp-ui-scale';
export const UI_SCALE_MANUAL_KEY = 'tp-ui-scale-manual';
export const UI_SCALE_OPTIONS = [90, 100, 110] as const;
export type UiScale = (typeof UI_SCALE_OPTIONS)[number];

export function isUiScale(value: number): value is UiScale {
  return value === 90 || value === 100 || value === 110;
}

export function autoUiScale(): UiScale {
  if (typeof window === 'undefined') return 90;
  const compact = window.innerWidth < 1600 || window.innerHeight < 900;
  return compact ? 90 : 100;
}

export function resolveUiScale(): UiScale {
  if (typeof window === 'undefined') return 90;
  const saved = Number(localStorage.getItem(UI_SCALE_KEY));
  const manual = localStorage.getItem(UI_SCALE_MANUAL_KEY) === '1';
  if (manual && isUiScale(saved)) return saved;
  return autoUiScale();
}

export function applyUiScale(scale: UiScale) {
  if (typeof document === 'undefined') return;
  document.documentElement.style.fontSize = `${(16 * scale) / 100}px`;
}

export function nextUiScale(value: number): UiScale {
  if (value === 100) return 110;
  if (value === 110) return 90;
  return 100;
}

export const UI_SCALE_BOOTSTRAP = `(function(){try{var m=localStorage.getItem('tp-ui-scale-manual')==='1';var s=Number(localStorage.getItem('tp-ui-scale'));var ok=s===90||s===100||s===110;if(!(m&&ok)){s=(window.innerWidth<1600||window.innerHeight<900)?90:100;}document.documentElement.style.fontSize=((16*s)/100)+'px';}catch(e){}})();`;
