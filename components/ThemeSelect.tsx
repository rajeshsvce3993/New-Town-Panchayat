'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type ThemeSelectProps = {
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
};

type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    if (child.type === 'option') {
      const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
      options.push({
        value: String(props.value ?? ''),
        label: String(props.children ?? ''),
        disabled: Boolean(props.disabled),
      });
      return;
    }
    const nested = (child.props as { children?: React.ReactNode })?.children;
    if (nested) options.push(...collectOptions(nested));
  });
  return options;
}

export default function ThemeSelect({ value, onChange, children, disabled, className }: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const options = useMemo(() => collectOptions(children), [children]);
  const selected = options.find((option) => option.value === value) || options[0];

  const updateMenuPos = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(140, Math.min(240, openUp ? spaceAbove : spaceBelow));
    setMenuPos({
      top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 160),
      maxHeight,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    const close = () => setOpen(false);
    const onDoc = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      const menu = document.getElementById('portal-theme-select-menu');
      if (menu?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={`portal-theme-select ${open ? 'is-open' : ''} ${className || ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="portal-theme-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={selected?.label}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
      >
        <span>{selected?.label || ''}</span>
        <ChevronDown className="portal-theme-select-caret" />
      </button>
      {open && menuPos && typeof document !== 'undefined' && createPortal(
        <div
          id="portal-theme-select-menu"
          className="portal-theme-select-menu"
          role="listbox"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
          }}
        >
          {options.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              disabled={option.disabled}
              className={`portal-theme-select-option ${option.value === value ? 'is-active' : ''}`}
              onClick={() => {
                onChange({ target: { value: option.value } });
                setOpen(false);
              }}
            >
              <span>{option.label}</span>
              {option.value === value && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
