const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'span', 'font', 'p', 'div', 'br']);

export const SHARE_FONTS = [
  { id: 'sans-serif', label: 'Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'monospace', label: 'Mono' },
] as const;

export const SHARE_FONT_SIZES = [12, 14, 16, 18, 22, 26] as const;

export function templateToHtml(raw: string): string {
  const text = String(raw || '');
  if (!text.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return sanitizeShareHtml(text);
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

export function sanitizeShareHtml(raw: string): string {
  let html = String(raw || '');
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '');
  html = html.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  html = html.replace(/javascript:/gi, '');
  html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (full, tag: string, attrs: string) => {
    const name = tag.toLowerCase();
    if (name === 'br') return '<br/>';
    if (!ALLOWED_TAGS.has(name)) return '';
    if (full.startsWith('</')) return `</${name}>`;
    const style = attrVal(attrs, 'style');
    const extra = [
      attrVal(attrs, 'color') ? `color:${attrVal(attrs, 'color')}` : '',
      attrVal(attrs, 'face') ? `font-family:${attrVal(attrs, 'face')}` : '',
      attrVal(attrs, 'size') ? `font-size:${fontSizeFromHtml(attrVal(attrs, 'size'))}px` : '',
    ].filter(Boolean).join(';');
    const merged = [sanitizeStyle(style), extra].filter(Boolean).join(';');
    return merged ? `<${name} style="${merged}">` : `<${name}>`;
  });
  return html;
}

function attrVal(attrs: string, name: string) {
  const match = String(attrs || '').match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match?.[2] || match?.[3] || '';
}

function sanitizeStyle(style: string): string {
  return String(style || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const idx = part.indexOf(':');
      if (idx < 0) return '';
      const key = part.slice(0, idx).trim().toLowerCase();
      const value = part.slice(idx + 1).trim();
      if (!value || /expression|url\s*\(|javascript/i.test(value)) return '';
      if (key === 'color' || key === 'font-size' || key === 'font-family' || key === 'font-weight' || key === 'font-style' || key === 'text-decoration' || key === 'text-align') {
        return `${key}:${value}`;
      }
      return '';
    })
    .filter(Boolean)
    .join(';');
}

function fontSizeFromHtml(size: string): number {
  const n = Number(size);
  const map: Record<number, number> = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 };
  return map[n] || 16;
}
