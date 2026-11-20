'use client';

import React from 'react';
import { RefreshCw } from 'lucide-react';

export default function GeoTreeBranchLoader({ label }: { label?: string }) {
  return (
    <div className="portal-wt-empty flex items-center justify-center gap-2 py-3 text-slate-500" role="status">
      <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden />
      <span className="text-xs">{label || 'Loading…'}</span>
    </div>
  );
}