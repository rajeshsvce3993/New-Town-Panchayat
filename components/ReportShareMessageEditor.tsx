'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Bold } from 'lucide-react';
import { SHARE_FONTS, SHARE_FONT_SIZES, sanitizeShareHtml, templateToHtml } from '@/lib/reportShareHtml';

export type ReportShareMessageEditorHandle = {
  insert: (token: string) => void;
};

function inEditor(node: Node | null, editor: HTMLElement | null) {
  if (!node || !editor) return false;
  return editor === node || editor.contains(node);
}

export default forwardRef<ReportShareMessageEditorHandle, {
  title: string;
  value: string;
  active: boolean;
  background: string;
  color: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onReset: () => void;
  resetLabel: string;
}>(function ReportShareMessageEditor({
  title,
  value,
  active,
  background,
  color,
  onChange,
  onFocus,
  onReset,
  resetLabel,
}, ref) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const lastHtml = useRef('');
  const [font, setFont] = useState('sans-serif');
  const [size, setSize] = useState('16');
  const [textColor, setTextColor] = useState(color);

  useEffect(() => {
    const html = templateToHtml(value);
    if (editorRef.current && html !== lastHtml.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = html || '';
      lastHtml.current = html;
    }
  }, [value]);

  const emit = () => {
    const html = sanitizeShareHtml(editorRef.current?.innerHTML || '');
    lastHtml.current = html;
    onChange(html);
  };

  const saveSelection = () => {
    const editor = editorRef.current;
    const sel = window.getSelection();
    if (!editor || !sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (inEditor(range.commonAncestorContainer, editor)) savedRange.current = range.cloneRange();
  };

  const restoreSelection = () => {
    const editor = editorRef.current;
    const range = savedRange.current;
    if (!editor || !range) return false;
    editor.focus();
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    return true;
  };

  const applyStyle = (styles: Record<string, string>) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();
    restoreSelection();
    const sel = window.getSelection();
    const range = sel && sel.rangeCount ? sel.getRangeAt(0) : savedRange.current;
    if (!range || range.collapsed || !inEditor(range.commonAncestorContainer, editor)) {
      const wrap = document.createElement('span');
      Object.assign(wrap.style, styles);
      while (editor.firstChild) wrap.appendChild(editor.firstChild);
      editor.appendChild(wrap);
      emit();
      return;
    }
    const contents = range.extractContents();
    const span = document.createElement('span');
    Object.assign(span.style, styles);
    span.appendChild(contents);
    range.insertNode(span);
    const next = document.createRange();
    next.selectNodeContents(span);
    sel?.removeAllRanges();
    sel?.addRange(next);
    savedRange.current = next.cloneRange();
    emit();
  };

  useImperativeHandle(ref, () => ({
    insert: (token: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      restoreSelection();
      const sel = window.getSelection();
      const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (range && inEditor(range.commonAncestorContainer, editor)) {
        range.deleteContents();
        const text = document.createTextNode(token);
        range.insertNode(text);
        range.setStartAfter(text);
        range.collapse(true);
        sel?.removeAllRanges();
        sel?.addRange(range);
        savedRange.current = range.cloneRange();
      } else {
        editor.appendChild(document.createTextNode(token));
      }
      emit();
    },
  }));

  return (
    <div className="portal-dashboard-panel">
      <div className="portal-dash-head">
        <div>
          <h3>{title}</h3>
          <p>Select text, then set bold, size, font, or color. If nothing is selected, the whole message is updated.</p>
        </div>
        <button type="button" className="text-[11px] font-semibold text-slate-500 underline" onClick={onReset}>
          {resetLabel}
        </button>
      </div>
      <div className="portal-dash-body space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] font-bold text-slate-700"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => applyStyle({ fontWeight: '700' })}
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700"
            value={font}
            onMouseDown={saveSelection}
            onChange={(e) => {
              setFont(e.target.value);
              applyStyle({ fontFamily: e.target.value });
            }}
          >
            {SHARE_FONTS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-700"
            value={size}
            onMouseDown={saveSelection}
            onChange={(e) => {
              setSize(e.target.value);
              applyStyle({ fontSize: `${e.target.value}px` });
            }}
          >
            {SHARE_FONT_SIZES.map((item) => (
              <option key={item} value={String(item)}>{item}px</option>
            ))}
          </select>
          <label className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
            Color
            <input
              type="color"
              value={textColor}
              className="h-5 w-7 cursor-pointer bg-transparent"
              onMouseDown={saveSelection}
              onChange={(e) => {
                setTextColor(e.target.value);
                applyStyle({ color: e.target.value });
              }}
            />
          </label>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={onFocus}
          onMouseUp={saveSelection}
          onKeyUp={saveSelection}
          onInput={() => {
            saveSelection();
            emit();
          }}
          className="min-h-[180px] rounded-lg border bg-white p-3 text-sm leading-6 outline-none"
          style={{
            borderColor: active ? 'var(--theme-accent)' : '#e2e8f0',
            boxShadow: active ? '0 0 0 1px var(--theme-accent)' : undefined,
            background,
            color,
            fontFamily: font,
            fontSize: `${size}px`,
          }}
        />
      </div>
    </div>
  );
});
