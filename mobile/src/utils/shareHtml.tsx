import { Fragment, type ReactNode } from 'react';
import { Text, type TextStyle } from 'react-native';

type HtmlNode =
  | { type: 'text'; text: string }
  | { type: 'br' }
  | { type: 'el'; style: TextStyle; children: HtmlNode[]; block?: boolean };

const FONT_SIZE_MAP: Record<string, number> = { 1: 10, 2: 13, 3: 16, 4: 18, 5: 24, 6: 32, 7: 48 };

function decode(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function mapFont(name: string): TextStyle['fontFamily'] {
  const n = name.toLowerCase();
  if (n.includes('mono') || n.includes('courier')) return 'monospace';
  if (n.includes('serif') && !n.includes('sans')) return 'serif';
  return undefined;
}

function parseStyle(style: string, extra: TextStyle = {}): TextStyle {
  const out: TextStyle = { ...extra };
  for (const part of String(style || '').split(';')) {
    const idx = part.indexOf(':');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase();
    const val = part.slice(idx + 1).trim();
    if (!val) continue;
    if (key === 'color') out.color = val;
    if (key === 'font-weight' && (val === 'bold' || Number(val) >= 600)) out.fontWeight = '700';
    if (key === 'font-size') out.fontSize = Number.parseFloat(val) || out.fontSize;
    if (key === 'font-family') out.fontFamily = mapFont(val.replace(/['"]/g, '').split(',')[0]);
    if (key === 'font-style' && val === 'italic') out.fontStyle = 'italic';
    if (key === 'text-align' && (val === 'left' || val === 'center' || val === 'right')) out.textAlign = val;
  }
  return out;
}

function attr(raw: string, name: string) {
  const match = raw.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i'));
  return match?.[2] || match?.[3] || '';
}

export function templateToHtml(raw: string): string {
  const text = String(raw || '');
  if (!text.trim()) return '';
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br/>');
}

function parseHtml(html: string): HtmlNode[] {
  const root: HtmlNode[] = [];
  const stack: { style: TextStyle; children: HtmlNode[]; block?: boolean }[] = [{ style: {}, children: root }];
  const re = /<\/?([a-zA-Z0-9]+)([^>]*)\/?>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const current = stack[stack.length - 1];
    if (match[3] != null) {
      const text = decode(match[3]);
      if (text) current.children.push({ type: 'text', text });
      continue;
    }
    const tag = String(match[1] || '').toLowerCase();
    const closing = match[0].startsWith('</');
    if (tag === 'br' || match[0].endsWith('/>') && tag === 'br') {
      current.children.push({ type: 'br' });
      continue;
    }
    if (closing) {
      if (stack.length > 1) {
        const el = stack.pop()!;
        stack[stack.length - 1].children.push({ type: 'el', style: el.style, children: el.children, block: el.block });
      }
      continue;
    }
    const attrs = match[2] || '';
    const style = parseStyle(attr(attrs, 'style'), {
      ...(tag === 'b' || tag === 'strong' ? { fontWeight: '700' as const } : null),
      ...(tag === 'i' || tag === 'em' ? { fontStyle: 'italic' as const } : null),
      ...(tag === 'u' ? { textDecorationLine: 'underline' as const } : null),
      ...(attr(attrs, 'color') ? { color: attr(attrs, 'color') } : null),
      ...(attr(attrs, 'face') ? { fontFamily: mapFont(attr(attrs, 'face')) } : null),
      ...(attr(attrs, 'size') ? { fontSize: FONT_SIZE_MAP[attr(attrs, 'size')] } : null),
    });
    stack.push({ style, children: [], block: tag === 'p' || tag === 'div' });
  }
  while (stack.length > 1) {
    const el = stack.pop()!;
    stack[stack.length - 1].children.push({ type: 'el', style: el.style, children: el.children, block: el.block });
  }
  return root;
}

function renderNodes(nodes: HtmlNode[], prefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${prefix}-${index}`;
    if (node.type === 'br') return '\n';
    if (node.type === 'text') return <Fragment key={key}>{node.text}</Fragment>;
    return (
      <Text key={key} style={node.style}>
        {renderNodes(node.children, key)}
        {node.block ? '\n' : ''}
      </Text>
    );
  });
}

export function ShareHtmlText({
  html,
  style,
}: {
  html: string;
  style: TextStyle | TextStyle[];
}) {
  return (
    <Text style={style}>
      {renderNodes(parseHtml(templateToHtml(html)), 'm')}
    </Text>
  );
}
