'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

type ThemeSelectProps = {
  value?: string | number | null;
  onChange?: (event: { target: { value: string } }) => void;
  children: React.ReactNode;
  disabled?: boolean;
  className?: string;
  name?: string;
  required?: boolean;
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

function isInside(node: EventTarget | null, el: HTMLElement | null) {
  if (!el || !(node instanceof Node)) return false;
  return el === node || el.contains(node);
}

export default function ThemeSelect({
  value,
  onChange,
  children,
  disabled,
  className,
  name,
  required,
}: ThemeSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const options = useMemo(() => collectOptions(children), [children]);
  const normalizedValue = String(value ?? '');
  const selected = options.find((option) => option.value === normalizedValue) || options[0];

  const updateMenuPos = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));
    setMenuPos({
      top: openUp ? Math.max(8, rect.top - maxHeight - 4) : rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 160) - 8),
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
      if (isInside(target, rootRef.current) || isInside(target, menuRef.current)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    const onScroll = (event: Event) => {
      if (isInside(event.target, menuRef.current)) return;
      close();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <div className={`portal-theme-select ${open ? 'is-open' : ''} ${className || ''}`} ref={rootRef}>
      {name ? <input type="hidden" name={name} value={normalizedValue} required={required} /> : null}
      <button
        ref={triggerRef}
        type="button"
        className="portal-theme-select-trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
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
          ref={menuRef}
          id={menuId}
          className="portal-theme-select-menu"
          role="listbox"
          style={{
            top: menuPos.top,
            left: menuPos.left,
            width: menuPos.width,
            maxHeight: menuPos.maxHeight,
          }}
          onWheel={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          {options.map((option, index) => (
            <button
              key={`${option.value}-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === normalizedValue}
              disabled={option.disabled}
              className={`portal-theme-select-option ${option.value === normalizedValue ? 'is-active' : ''}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange?.({ target: { value: option.value } });
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
