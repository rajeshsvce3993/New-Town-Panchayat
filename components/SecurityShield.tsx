'use client';

import { useEffect } from 'react';

export default function SecurityShield() {
  useEffect(() => {
    // 1. Console security banner
    try {
      console.log(
        '%cProtected Portal - Access Secured',
        'color: #0284c7; font-size: 18px; font-weight: bold; font-family: sans-serif;'
      );
      console.log(
        '%cSource code inspection and media extraction are restricted on this portal.',
        'color: #64748b; font-size: 12px; font-family: sans-serif;'
      );
    } catch (_) {}

    // 2. Disable right click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    // 3. Disable DevTools and View-Source hotkeys
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key || '';
      const keyCode = e.keyCode || e.which || 0;
      const isCtrl = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;
      const isAlt = e.altKey;

      // F12
      if (key === 'F12' || keyCode === 123) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+I or Cmd+Option+I (Inspect)
      if (isCtrl && (isShift || isAlt) && (key === 'I' || key === 'i' || keyCode === 73)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+J or Cmd+Option+J (Console)
      if (isCtrl && (isShift || isAlt) && (key === 'J' || key === 'j' || keyCode === 74)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+Shift+C or Cmd+Option+C (Element picker)
      if (isCtrl && (isShift || isAlt) && (key === 'C' || key === 'c' || keyCode === 67)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+U or Cmd+Option+U (View Source)
      if (isCtrl && (key === 'U' || key === 'u' || keyCode === 85)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }

      // Ctrl+S (Save Page)
      if (isCtrl && (key === 'S' || key === 's' || keyCode === 83)) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // 4. Disable image dragging
    const handleDragStart = (e: DragEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'IMG') {
        e.preventDefault();
      }
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return null;
}
