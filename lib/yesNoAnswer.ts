/** Shared Yes/No matching for SWM flags (door locked, segregation, composting). */

const YES_RE = /^(yes|y|true|1|locked)(\b|$)|^(ஆம்)/i;
const NO_RE = /^(no|n|false|0)(\b|$)|^(இல்லை)/i;

export function scalarFieldAnswer(raw: unknown): string {
  if (raw == null) return '';
  if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') {
    return String(raw).trim();
  }
  if (Array.isArray(raw)) return scalarFieldAnswer(raw[0]);
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    return scalarFieldAnswer(obj.value ?? obj.label ?? obj.nameEn ?? obj.name ?? obj.en ?? obj.ta);
  }
  return String(raw).trim();
}

export function isYesAnswer(raw: unknown): boolean {
  const v = scalarFieldAnswer(raw).toLowerCase();
  if (!v || isNoAnswer(raw)) return false;
  return YES_RE.test(v) || v.includes('door locked');
}

export function isNoAnswer(raw: unknown): boolean {
  const v = scalarFieldAnswer(raw).toLowerCase();
  if (!v) return false;
  return NO_RE.test(v);
}

export const MONGO_YES_ANSWER_REGEX = '^(yes|y|true|1|locked)(\\b|$)|^(ஆம்)';
export const MONGO_NO_ANSWER_REGEX = '^(no|n|false|0)(\\b|$)|^(இல்லை)';
