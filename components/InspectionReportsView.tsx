'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Search, 
  Printer, 
  Download, 
  Filter, 
  MapPin, 
  Calendar, 
  CheckCircle2, 
  Eye, 
  Image as ImageIcon, 
  Layers, 
  Maximize2, 
  Minimize2, 
  Compass, 
  Database, 
  Cloud, 
  FileSpreadsheet, 
  ChevronRight, 
  AlertCircle,
  Navigation,
  Globe,
  SlidersHorizontal,
  ExternalLink,
  ShieldCheck,
  Building,
  X,
  Pencil,
  Trash2,
  RefreshCw,
  RotateCcw,
  Save,
  ZoomIn,
  ZoomOut,
  Map as MapIcon,
  ChevronLeft,
  Archive,
  FolderArchive,
  Loader2,
  Sun,
  Moon,
  RotateCw,
  Users,
  ChevronUp,
  ChevronDown,
  Home,
  Zap,
  BarChart3,
  Building2,
  Recycle,
  Presentation
} from 'lucide-react';
import { Language, translations } from './translations';
import { ThemeType, themesConfig } from '@/lib/themeConfig';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  generateHtmlTablePDF, 
  downloadZipArchive, 
  exportMultiSheetExcel, 
  sanitizeSheetName 
} from '@/lib/inspectionReportExport';
import {
  buildSubjectCategoryRollupsFromDashboardStats,
  categoryCountsFromSubjectRollups,
  extractWorksFromInspectionApiPayload,
  filterDashboardStatsForScope,
  getWorkDynamicFieldValue,
  storedValueMatchesAdminFilter,
  isFallbackInspectionWork,
  collapseDimensionRollupsToSubjectCategory,
  workMatchesCategory,
  workMatchesDistrict,
  workMatchesSubject,
  workMatchesTp,
  workMatchesZone,
  type InspectionWorkReportDimensionRollup,
} from '@/lib/inspectionWorksQueryFilters';
import { geoNamesEqual } from '@/lib/geoNameMatch';
import { isHodLikeUser, isZonalScopedUser } from '@/lib/userScope';
import MapViewReport from './MapViewReport';
import ThemeSelect from './ThemeSelect';
import { buildInspectionSlidesFile, renderInspectionSlideJpeg } from '@/lib/buildInspectionSlideDeck';

export function formatIndianTime(dateStr: any): string {
  if (!dateStr) return '-';
  const s = String(dateStr).trim();

  // If formatted as DD-MM-YYYY or DD/MM/YYYY with time (from Android app or server)
  const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP][mM])?)?/);
  if (dmyMatch && dmyMatch[4]) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    let hours = parseInt(dmyMatch[4], 10);
    const minutes = dmyMatch[5].padStart(2, '0');
    let ampm = dmyMatch[7] ? dmyMatch[7].toUpperCase() : '';
    if (!ampm) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = String(istDate.getDate()).padStart(2, '0');
      const month = String(istDate.getMonth() + 1).padStart(2, '0');
      const year = istDate.getFullYear();
      let hours = istDate.getHours();
      const minutes = String(istDate.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
  } catch (e) {}
  return s;
}

function formatTo12Hr(dateStr: string): string {
  if (!dateStr) return '';
  return formatIndianTime(dateStr);
}

const TAMIL_SCRIPT_RE = /[\u0B80-\u0BFF]/;

function streetLookupKey(value: any): string {
  return String(value || '').trim().toLowerCase();
}

function getLocalizedStreetName(work: any, lang: string, streets: any[] = []): string {
  const isTa = lang === 'ta';
  const raw = String(work?.streetName || work?.street || '').trim();
  const storedEn = String(work?.streetNameEn || '').trim();
  const storedTa = String(work?.streetNameTa || '').trim();
  if (!raw && !storedEn && !storedTa) return '-';

  const ward = String(work?.wardNumber || work?.wardNo || '').trim().replace(/^0+/, '');
  const tpNeedles = [
    streetLookupKey(work?.tpId),
    streetLookupKey(work?.townPanchayatId),
    streetLookupKey(work?.tpNameEn),
    streetLookupKey(work?.tpNameTa),
  ].filter(Boolean);
  const nameNeedles = [raw, storedEn, storedTa].map(streetLookupKey).filter(Boolean);

  const streetNameMatches = (ws: any) => {
    const names = [ws?.streetNameEn, ws?.streetNameTa, ws?.streetName, ws?.nameEn, ws?.nameTa]
      .map(streetLookupKey)
      .filter(Boolean);
    return nameNeedles.some((n) => names.includes(n));
  };
  const wardMatches = (ws: any) => {
    if (!ward) return true;
    const wsWard = String(ws?.wardNo || ws?.wardNumber || '').trim().replace(/^0+/, '');
    return !wsWard || wsWard === ward;
  };
  const tpMatches = (ws: any) => {
    if (!tpNeedles.length) return true;
    const wsTps = [ws?.tpId, ws?.townPanchayatId, ws?.tpNameEn, ws?.tpNameTa].map(streetLookupKey).filter(Boolean);
    if (!wsTps.length) return true;
    return wsTps.some((t) => tpNeedles.includes(t));
  };

  const list = Array.isArray(streets) ? streets : [];
  const match =
    list.find((ws) => streetNameMatches(ws) && wardMatches(ws) && tpMatches(ws)) ||
    list.find((ws) => streetNameMatches(ws) && wardMatches(ws)) ||
    list.find((ws) => streetNameMatches(ws));

  if (match) {
    const en = String(match.streetNameEn || match.streetName || '').trim();
    const ta = String(match.streetNameTa || '').trim();
    if (isTa) return ta || en || raw || '-';
    if (en && !TAMIL_SCRIPT_RE.test(en)) return en;
    if (raw && !TAMIL_SCRIPT_RE.test(raw)) return raw;
    if (storedEn && !TAMIL_SCRIPT_RE.test(storedEn)) return storedEn;
    return en || raw || '-';
  }

  if (isTa) {
    if (storedTa) return storedTa;
    if (raw && TAMIL_SCRIPT_RE.test(raw)) return raw;
    return storedTa || raw || storedEn || '-';
  }

  if (storedEn && !TAMIL_SCRIPT_RE.test(storedEn)) return storedEn;
  if (raw && !TAMIL_SCRIPT_RE.test(raw)) return raw;
  return storedEn || raw || storedTa || '-';
}

function isYesAnswer(raw: any): boolean {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return false;
  if (isNoAnswer(raw)) return false;
  return (
    v === 'yes' ||
    v === 'y' ||
    v === 'true' ||
    v === '1' ||
    v === 'ஆம்' ||
    v.startsWith('yes') ||
    v.startsWith('ஆம்') ||
    v.includes('door locked') ||
    v === 'locked'
  );
}

function isNoAnswer(raw: any): boolean {
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return false;
  return (
    v === 'no' ||
    v === 'n' ||
    v === 'false' ||
    v === '0' ||
    v === 'இல்லை' ||
    v.startsWith('no') ||
    v.startsWith('இல்லை')
  );
}

const SWM_COL = {
  sno: { en: 'S.No', ta: 'வ.எண்' },
  zone: { en: 'Zone', ta: 'மண்டலம்' },
  district: { en: 'District', ta: 'மாவட்டம்' },
  tp: { en: 'Town Panchayat', ta: 'பேரூராட்சி' },
  wardNo: { en: 'Ward No', ta: 'வார்டு எண்' },
  street: { en: 'Street Names', ta: 'தெருப்பெயர்' },
  totalWards: { en: 'Total No of Wards', ta: 'மொத்த வார்டுகளின் எண்ணிக்கை' },
  wardsSurveyed: { en: 'Wards surveyed', ta: 'கணக்கெடுக்கப்பட்ட வார்டுகள்' },
  totalStreets: { en: 'Total No of Streets', ta: 'மொத்த தெருக்களின் எண்ணிக்கை' },
  streetsSurveyed: { en: 'Streets surveyed', ta: 'கணக்கெடுக்கப்பட்ட தெருக்கள்' },
  households: { en: 'Total Households Surveyed', ta: 'கணக்கெடுக்கப்பட்ட மொத்த குடியிருப்புகள்' },
  segregating: { en: 'Households Segregating Waste at Source', ta: 'தரம் பிரித்து வழங்கும் வீடுகள்' },
  notSegregating: { en: 'Households Not Segregating Waste at Source', ta: 'தரம் பிரிக்காமல் வழங்கும் வீடுகள்' },
  doorLocked: { en: 'Households with Door Locked', ta: 'பூட்டிய வீடுகள்' },
  compost: { en: 'Households with Home Composting', ta: 'வீட்டு உரமாக்கம் உள்ள வீடுகள்' },
  pct: { en: 'Percentage (%)', ta: 'சதவீதம்' },
};

function SwmHeaderCell({
  col,
  lang,
  align = 'text',
  sortKey,
  sortState,
  onSort,
}: {
  col: { en: string; ta: string };
  lang: string;
  align?: 'text' | 'num' | 'sno' | 'pct';
  sortKey?: string;
  sortState?: { key: string; dir: 'asc' | 'desc' };
  onSort?: (key: string) => void;
}) {
  const active = Boolean(sortKey && sortState?.key === sortKey);
  const sortable = Boolean(onSort && sortKey);
  return (
    <th
      className={`portal-swm-th is-${align} ${sortable ? 'is-sortable' : ''}`.trim()}
      onClick={sortable ? () => onSort?.(sortKey!) : undefined}
      aria-sort={active ? (sortState?.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <span className="portal-swm-th-label">
        <span>{lang === 'ta' ? col.ta : col.en}</span>
        {sortable && (
          <span className="portal-swm-th-sort" aria-hidden="true">
            {active ? (sortState?.dir === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        )}
      </span>
    </th>
  );
}

function SwmViewportStatus({
  loading,
  lang,
  loadingLabel,
}: {
  loading?: boolean;
  lang: string;
  loadingLabel: string;
}) {
  return (
    <div className="portal-swm-viewport-msg-inner">
      {loading ? (
        <span className="portal-swm-viewport-loader">
          <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--theme-accent)' }} />
          {loadingLabel}
        </span>
      ) : (
        <>
          <svg className="portal-fis-empty-art" viewBox="0 0 72 72" fill="none" aria-hidden="true">
            <rect x="8" y="18" width="40" height="32" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
            <path d="M16 28h24M16 34h18M16 40h12" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
            <circle cx="50" cy="46" r="12" fill="#fff" stroke="#6366f1" strokeWidth="3" />
            <path d="M58 54l8 8" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p className="portal-swm-viewport-title">
            {lang === 'ta'
              ? 'தேர்ந்தெடுத்த வடிகட்டிகளுக்கு SWM பதிவுகள் இல்லை.'
              : 'No SWM records found for the selected filters.'}
          </p>
          <p className="portal-swm-viewport-sub">
            {lang === 'ta' ? 'வடிகட்டிகளை மாற்றி மீண்டும் முயலவும்.' : 'Please adjust your filters and try again.'}
          </p>
        </>
      )}
    </div>
  );
}

function isDoorToDoorCategory(c: any): boolean {
  const name = String(c?.nameEn || c?.name || '').toLowerCase();
  const id = String(c?.id || '').toLowerCase();
  return (
    (name.includes('door') && (name.includes('segregat') || name.includes('source') || name.includes('survey')))
    || id.includes('door_to_door_source')
    || id.includes('door-to-door')
  );
}

function isSwmDoorToDoorWork(work: any, categoryIds: Set<string>): boolean {
  const wCat = String(work?.categoryId || '').trim().toLowerCase();
  const wCatName = String(work?.categoryNameEn || work?.categoryName || work?.categoryNameTa || '').trim().toLowerCase();
  if (!wCat) return true;
  return (
    categoryIds.has(wCat) ||
    (wCat.includes('door') && (wCat.includes('segregat') || wCat.includes('source'))) ||
    (wCatName.includes('door') && (wCatName.includes('segregat') || wCatName.includes('source')))
  );
}

function readWorkFieldAnswer(work: any, fields: any[], pred: (label: string) => boolean): string {
  const list = Array.isArray(fields) ? fields : [];
  for (const field of list) {
    const blob = [field?.id, field?.nameEn, field?.nameTa, field?.fieldName, field?.fieldNameTa]
      .map((x) => String(x || '').toLowerCase())
      .join(' | ');
    if (!pred(blob)) continue;
    const value = getWorkDynamicFieldValue(work, field, list);
    if (String(value || '').trim()) return String(value);
  }
  const fd = work?.fieldsData;
  if (fd && typeof fd === 'object') {
    for (const [key, value] of Object.entries(fd)) {
      if (!pred(String(key).toLowerCase())) continue;
      if (value != null && String(value).trim()) return String(value);
    }
  }
  return '';
}

function readSwmHouseholdFlags(work: any, fields: any[]) {
  const segregated =
    getWorkDynamicFieldValue(work, 'fld_is_waste_segregated_at_source__jdua', fields) ||
    readWorkFieldAnswer(work, fields, (label) =>
      label.includes('segregat') && label.includes('source') && !label.includes('worker') && !label.includes('collected')
    );
    const locked =
    getWorkDynamicFieldValue(work, 'fld_is_door_locked__r98z', fields) ||
    readWorkFieldAnswer(work, fields, (label) =>
      label.includes('door locked') ||
      label.includes('house locked') ||
      label.includes('is_door_locked') ||
      label.includes('வீடு பூட்ட') ||
      (label.includes('பூட்ட') && label.includes('வீடு'))
    );
  const compost =
    getWorkDynamicFieldValue(work, 'fld_home_composting_available___c5p9', fields) ||
    readWorkFieldAnswer(work, fields, (label) =>
      label.includes('compost')
    );
  const doorLocked = isYesAnswer(locked);
  const doorUnlocked = !doorLocked;
  return {
    doorLocked,
    segregating: doorUnlocked && isYesAnswer(segregated),
    notSegregating: doorUnlocked && isNoAnswer(segregated),
    homeComposting: isYesAnswer(compost),
  };
}

function formatSwmWard(ward: string, lang: string) {
  const n = String(ward || '').trim() || '0';
  return lang === 'ta' ? `வார்டு ${n}` : `Ward - ${n}`;
}

function readSwmBuildingType(work: any, fields: any[]): 'residential' | 'commercial' | '' {
  const raw =
    getWorkDynamicFieldValue(work, 'fld_building_type_cu5l', fields) ||
    readWorkFieldAnswer(work, fields, (label) =>
      label.includes('building type') || label.includes('கட்டிட')
    );
  const v = String(raw || '').trim().toLowerCase();
  if (!v) return '';
  if (v.includes('commercial') || v.includes('வணிகம்')) return 'commercial';
  if (v.includes('residential') || v.includes('குடியிருப்பு')) return 'residential';
  return '';
}

function swmPercent(count: number, total: number): number {
  if (!total) return 0;
  return Math.round((count / total) * 100);
}

function swmSummaryGroupKey(row: any): string {
  return [
    String(row.tpId || row.townPanchayatId || row.tpNameEn || '').trim().toLowerCase(),
    String(row.wardNumber || row.wardNo || '').trim().replace(/^0+/, '') || '0',
    String(row.streetName || row.street || '').trim().toLowerCase() || '-',
  ].join('|');
}

function workToSwmSummaryGroup(work: any, fields: any[]) {
  const flags = readSwmHouseholdFlags(work, fields);
  return {
    zoneId: work.zoneId || '',
    zoneNameEn: work.zoneNameEn || '',
    zoneNameTa: work.zoneNameTa || '',
    districtId: work.districtId || '',
    districtNameEn: work.districtNameEn || '',
    districtNameTa: work.districtNameTa || '',
    tpId: work.tpId || work.townPanchayatId || '',
    tpNameEn: work.tpNameEn || '',
    tpNameTa: work.tpNameTa || '',
    wardNumber: String(work.wardNumber || work.wardNo || '').trim().replace(/^0+/, '') || '0',
    streetName: String(work.streetName || work.streetNameEn || work.street || '').trim() || '-',
    householdsSurveyed: 1,
    segregating: flags.segregating ? 1 : 0,
    notSegregating: flags.notSegregating ? 1 : 0,
    doorLocked: flags.doorLocked ? 1 : 0,
    homeComposting: flags.homeComposting ? 1 : 0,
    buildingType: readSwmBuildingType(work, fields),
  };
}

function mergeSwmSummaryGroups(existing: any[], incoming: any[]): any[] {
  const map = new Map<string, any>();
  for (const row of existing) {
    map.set(swmSummaryGroupKey(row), { ...row });
  }
  for (const row of incoming) {
    const key = swmSummaryGroupKey(row);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
      continue;
    }
    prev.householdsSurveyed = (Number(prev.householdsSurveyed) || 0) + (Number(row.householdsSurveyed) || 0);
    prev.segregating = (Number(prev.segregating) || 0) + (Number(row.segregating) || 0);
    prev.notSegregating = (Number(prev.notSegregating) || 0) + (Number(row.notSegregating) || 0);
    prev.doorLocked = (Number(prev.doorLocked) || 0) + (Number(row.doorLocked) || 0);
    prev.homeComposting = (Number(prev.homeComposting) || 0) + (Number(row.homeComposting) || 0);
    if (!prev.tpNameEn && row.tpNameEn) prev.tpNameEn = row.tpNameEn;
    if (!prev.districtNameEn && row.districtNameEn) prev.districtNameEn = row.districtNameEn;
    if (!prev.zoneNameEn && row.zoneNameEn) prev.zoneNameEn = row.zoneNameEn;
  }
  return [...map.values()];
}

type SwmAbstractRow = {
  zoneNameEn: string;
  zoneNameTa: string;
  districtNameEn: string;
  districtNameTa: string;
  tpNameEn: string;
  tpNameTa: string;
  totalWards: number;
  wardsSurveyed: number;
  totalStreets: number;
  streetsSurveyed: number;
  householdsSurveyed: number;
  segregating: number;
  segregatingPct: number;
  notSegregating: number;
  notSegregatingPct: number;
  doorLocked: number;
  doorLockedPct: number;
  homeComposting: number;
  homeCompostingPct: number;
  wardNumber?: string;
  streetName?: string;
};

type SwmTpStreetRow = {
  wardNumber: string;
  streetName: string;
  householdsSurveyed: number;
  segregating: number;
  segregatingPct: number;
  notSegregating: number;
  notSegregatingPct: number;
  doorLocked: number;
  doorLockedPct: number;
  homeComposting: number;
  homeCompostingPct: number;
};

export function extractCalendarDateYMD(dateVal: any): string | null {
  if (!dateVal) return null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(dateVal);
  }

  // 1. Numeric timestamp (number or digits string)
  if (typeof dateVal === 'number' || /^\d{10,13}$/.test(String(dateVal).trim())) {
    try {
      const num = typeof dateVal === 'number' ? dateVal : parseInt(String(dateVal).trim(), 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
      }
    } catch (_) {}
  }

  const s = String(dateVal).trim();
  if (!s) return null;

  // 2. Format: DD-MM-YYYY or DD/MM/YYYY with optional time (e.g. 03-10-2026, 03/10/2026 11:30 AM)
  // CRITICAL: MUST check before new Date() because JS parses 03-10-2026 as MM-DD-YYYY (March 10th)!
  const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // 3. Format: YYYY-MM-DD (e.g. 2026-10-03 or ISO string 2026-10-03T11:45:00Z)
  const ymdMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    if (s.includes('T') || s.includes('Z') || s.includes(':')) {
      try {
        const d = new Date(s.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).format(d);
        }
      } catch (_) {}
    }
    return `${year}-${month}-${day}`;
  }

  // 4. ISO timestamp or standard date string - format strictly in Asia/Kolkata timezone
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    }
  } catch (_) {}

  return null;
}

export function localizeFieldTitle(key: string, activeLang: 'ta' | 'en', stateFields?: any[]): string {
  if (!key) return '';
  const cleanKey = String(key).trim();
  const lowerKey = cleanKey.toLowerCase();

  if (stateFields && Array.isArray(stateFields)) {
    const matched = stateFields.find((f: any) => {
      const fId = String(f.id || '').toLowerCase();
      const fName = String(f.fieldName || '').toLowerCase();
      const fEn = String(f.nameEn || '').toLowerCase();
      const fTa = String(f.nameTa || '').toLowerCase();
      return fId === lowerKey || fName === lowerKey || fEn === lowerKey || fTa === lowerKey;
    });
    if (matched) {
      if (activeLang === 'ta') {
        if (matched.nameTa || matched.fieldNameTa) return matched.nameTa || matched.fieldNameTa;
      } else {
        if (matched.nameEn || matched.fieldName) return matched.nameEn || matched.fieldName;
      }
    }
  }

  if (activeLang === 'en') return cleanKey.toUpperCase();

  // Tamil dictionary mapping for common field titles
  const dict: Record<string, string> = {
    'building type': 'கட்டிட வகை',
    'building_type': 'கட்டிட வகை',
    'surveyor/enumerator remarks': 'ஆய்வாளர் குறிப்பு',
    'surveyor remarks': 'ஆய்வாளர் குறிப்பு',
    'enumerator remarks': 'ஆய்வாளர் குறிப்பு',
    'remarks': 'குறிப்புகள்',
    'is waste segregated at source?': 'குப்பைகள் மூலாதாரத்திலேயே பிரிக்கப்படுகிறதா?',
    'is waste segregated at source': 'குப்பைகள் மூலாதாரத்திலேயே பிரிக்கப்படுகிறதா?',
    'waste_segregated_at_source': 'குப்பைகள் மூலாதாரத்திலேயே பிரிக்கப்படுகிறதா?',
    'name': 'பெயர்',
    'resident_name': 'குடியிருப்பாளர் பெயர்',
    'resident name': 'குடியிருப்பாளர் பெயர்',
    'floor': 'தளம்',
    'is segregated waste collected by the sanitation worker?': 'பிரிக்கப்பட்ட கழிவுகள் தூய்மைப் பணியாளரால் சேகரிக்கப்படுகிறதா?',
    'is segregated waste collected by the sanitation worker': 'பிரிக்கப்பட்ட கழிவுகள் தூய்மைப் பணியாளரால் சேகரிக்கப்படுகிறதா?',
    'is_segregated_waste_collected': 'பிரிக்கப்பட்ட கழிவுகள் தூய்மைப் பணியாளரால் சேகரிக்கப்படுகிறதா?',
    'number of family members': 'குடும்ப உறுப்பினர்களின் எண்ணிக்கை',
    'number_of_family_members': 'குடும்ப உறுப்பினர்களின் எண்ணிக்கை',
    'family_members': 'குடும்ப உறுப்பினர்கள்',
    'is compost created at home?': 'வீட்டிலேயே உரம் தயாரிக்கப்படுகிறதா?',
    'is compost created at home': 'வீட்டிலேயே உரம் தயாரிக்கப்படுகிறதா?',
    'is house locked?': 'வீடு பூட்டப்பட்டுள்ளதா?',
    'is house locked': 'வீடு பூட்டப்பட்டுள்ளதா?',
    'door number': 'கதவு எண்',
    'door_number': 'கதவு எண்',
    'door_no': 'கதவு எண்',
    'door no': 'கதவு எண்',
    'mobile': 'கைபேசி எண்',
    'mobile number': 'கைபேசி எண்',
    'mobile_no': 'கைபேசி எண்',
    'contact_number': 'தொடர்பு எண்',
    'phone': 'கைபேசி எண்',
    'status': 'நிலை',
  };

  if (dict[lowerKey]) return dict[lowerKey];

  if (lowerKey.includes('building')) return 'கட்டிட வகை';
  if (lowerKey.includes('remarks') || lowerKey.includes('comment')) return 'ஆய்வாளர் குறிப்பு';
  if (lowerKey.includes('segregate') && lowerKey.includes('source')) return 'குப்பைகள் மூலாதாரத்திலேயே பிரிக்கப்படுகிறதா?';
  if (lowerKey.includes('segregate') && lowerKey.includes('worker')) return 'பிரிக்கப்பட்ட கழிவுகள் தூய்மைப் பணியாளரால் சேகரிக்கப்படுகிறதா?';
  if (lowerKey === 'name') return 'பெயர்';
  if (lowerKey.includes('family') || lowerKey.includes('member')) return 'குடும்ப உறுப்பினர்களின் எண்ணிக்கை';
  if (lowerKey.includes('compost')) return 'வீட்டிலேயே உரம் தயாரிக்கப்படுகிறதா?';
  if (lowerKey.includes('locked')) return 'வீடு பூட்டப்பட்டுள்ளதா?';
  if (lowerKey.includes('door')) return 'கதவு எண்';
  if (lowerKey.includes('mobile') || lowerKey.includes('phone')) return 'கைபேசி எண்';
  if (lowerKey.includes('floor')) return 'தளம்';

  return cleanKey;
}

function resolveWorkSubjectAndCategory(work: any, subjects: any[], categories: any[], fields?: any[]) {
  if (!work) return work;

  const wCatId = String(work.categoryId || '').trim().toLowerCase();
  const wCatName = String(work.categoryNameEn || work.categoryName || work.category || '').trim().toLowerCase();
  const wSubjId = String(work.subjectId || '').trim().toLowerCase();
  const wSubjName = String(work.subjectNameEn || work.subjectName || work.subject || '').trim().toLowerCase();

  // Filter out any dummy fallback categories/subjects from the masters list
  const realCategories = (categories || []).filter((c: any) => {
    const name = String(c.nameEn || c.name || '').trim().toLowerCase();
    const id = String(c.id || '').trim().toLowerCase();
    return name !== 'field check' && name !== 'general category' && name !== 'general inspection' && !name.includes('fallback') && id !== 'cat_field_check' && id !== 'cat_general';
  });

  const realSubjects = (subjects || []).filter((s: any) => {
    const name = String(s.nameEn || s.name || '').trim().toLowerCase();
    const id = String(s.id || '').trim().toLowerCase();
    return name !== 'general inspection' && name !== 'general' && !name.includes('fallback') && id !== 'subj_general';
  });

  // 1. Match category from created categories list (strict match by ID, code, or exact name)
  let matchedCat = realCategories.find((c: any) => {
    const cId = String(c.id || '').trim().toLowerCase();
    const cCode = String(c.code || '').trim().toLowerCase();
    const cNameEn = String(c.nameEn || c.name || '').trim().toLowerCase();
    const cNameTa = String(c.nameTa || '').trim().toLowerCase();

    return (wCatId && (cId === wCatId || cCode === wCatId)) ||
           (wCatName && wCatName !== 'field check' && wCatName !== 'general category' && (cNameEn === wCatName || cNameTa === wCatName)) ||
           (wCatId && (cNameEn === wCatId || cNameTa === wCatId));
  });

  // 2. If not matched, try matching from fieldsData keys in inspectionFields
  if (!matchedCat && work.fieldsData && typeof work.fieldsData === 'object' && fields && fields.length > 0) {
    const keys = Object.keys(work.fieldsData);
    for (const key of keys) {
      const fieldMatch = fields.find((f: any) => f.id === key || f.fieldName === key || f.nameEn === key);
      if (fieldMatch && fieldMatch.categoryId) {
        matchedCat = realCategories.find((c: any) => c.id === fieldMatch.categoryId);
        if (matchedCat) break;
      }
    }
  }

  // 3. Match subject from created subjects list
  let matchedSubj = realSubjects.find((s: any) => {
    const sId = String(s.id || '').trim().toLowerCase();
    const sCode = String(s.code || '').trim().toLowerCase();
    const sNameEn = String(s.nameEn || s.name || '').trim().toLowerCase();
    const sNameTa = String(s.nameTa || '').trim().toLowerCase();

    return (matchedCat && (sId === String(matchedCat.subjectId || '').toLowerCase() || sCode === String(matchedCat.subjectId || '').toLowerCase())) ||
           (wSubjId && (sId === wSubjId || sCode === wSubjId)) ||
           (wSubjName && wSubjName !== 'general inspection' && wSubjName !== 'general' && (sNameEn === wSubjName || sNameTa === wSubjName));
  });

  if (!matchedSubj && matchedCat?.subjectId) {
    matchedSubj = realSubjects.find((s: any) => String(s.id || '').toLowerCase() === String(matchedCat.subjectId || '').toLowerCase() || String(s.code || '').toLowerCase() === String(matchedCat.subjectId || '').toLowerCase());
  }

  // Preserve work's existing subject and category - NEVER overwrite with realCategories[0] or realSubjects[0]
  const subjectId = matchedSubj ? matchedSubj.id : (work.subjectId || '');
  const subjectNameEn = matchedSubj ? (matchedSubj.nameEn || matchedSubj.name) : (work.subjectNameEn || '');
  const subjectNameTa = matchedSubj ? (matchedSubj.nameTa || matchedSubj.nameEn) : (work.subjectNameTa || subjectNameEn);

  const categoryId = matchedCat ? matchedCat.id : (work.categoryId || '');
  const categoryNameEn = matchedCat ? (matchedCat.nameEn || matchedCat.name) : (work.categoryNameEn || '');
  const categoryNameTa = matchedCat ? (matchedCat.nameTa || matchedCat.nameEn) : (work.categoryNameTa || categoryNameEn);

  return {
    ...work,
    subjectId,
    subjectNameEn,
    subjectNameTa,
    categoryId,
    categoryNameEn,
    categoryNameTa,
  };
}

function safeParseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;

  if (typeof dateStr === 'number') {
    const num = dateStr < 1e11 ? dateStr * 1000 : dateStr;
    const d = new Date(num);
    if (!isNaN(d.getTime())) return d;
  }

  const s = String(dateStr).trim();
  if (!s) return null;

  if (/^\d{10,13}$/.test(s)) {
    const num = parseInt(s, 10);
    const d = new Date(num < 1e11 ? num * 1000 : num);
    if (!isNaN(d.getTime())) return d;
  }

  // 1. Check Indian format first: DD-MM-YYYY or DD/MM/YYYY with optional time
  const match = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP][mM])?)?/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const year = parseInt(match[3], 10);
    let hour = match[4] ? parseInt(match[4], 10) : 0;
    const min = match[5] ? parseInt(match[5], 10) : 0;
    const sec = match[6] ? parseInt(match[6], 10) : 0;
    const ampm = match[7];

    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) {
        hour += 12;
      } else if (ampm.toLowerCase() === 'am' && hour === 12) {
        hour = 0;
      }
    }
    const parsed = new Date(year, month, day, hour, min, sec);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  try {
    const standard = new Date(s);
    if (!isNaN(standard.getTime())) return standard;
  } catch (e) {}
  return null;
}

function toStableMediaSrc(raw: string) {
  if (!raw) return '';
  if (raw.startsWith('data:image') || raw.startsWith('blob:') || raw.startsWith('/api/media')) return raw;
  try {
    let key = raw;
    if (/^https?:\/\//i.test(raw)) {
      key = new URL(raw).pathname.replace(/^\//, '');
    }
    key = key.split('?')[0];
    const cut = key.indexOf('inspection/');
    if (cut >= 0) key = key.slice(cut);
    if (key.startsWith('inspection/') || key.startsWith('profiles/')) {
      const token = typeof window !== 'undefined' ? btoa(key) : Buffer.from(key).toString('base64');
      return `/api/media?token=${encodeURIComponent(token)}`;
    }
  } catch {
    /* fall through */
  }
  return `/api/media?url=${encodeURIComponent(raw.split('?')[0])}`;
}

// Slide Photo component with eager rendering, loading shimmer, and instant proxy fallback
function SlidePhotoDisplay({
  url,
  label,
  className,
  onZoom
}: {
  url: string;
  label: string;
  className?: string;
  onZoom?: () => void;
}) {
  const [currentSrc, setCurrentSrc] = useState(() => toStableMediaSrc(url) || url);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setCurrentSrc(toStableMediaSrc(url) || url);
    setHasError(false);
  }, [url]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden cursor-pointer group select-none"
      onClick={onZoom}
    >
      <img
        src={currentSrc}
        alt={label}
        loading="eager"
        decoding="sync"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer"
        onError={() => {
          const proxied = toStableMediaSrc(url);
          if (proxied && proxied !== currentSrc) {
            setCurrentSrc(proxied);
          } else {
            setHasError(true);
          }
        }}
        className={`${className || ''} ${hasError ? 'hidden' : 'block'}`}
      />
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-400">
          <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
          <span className="text-xs font-semibold">{label || 'Photo unavailable'}</span>
        </div>
      )}
    </div>
  );
}

interface InspectionReportsViewProps {
  state: any;
  lang: Language;
  theme: ThemeType;
  currentUser?: any;
  defaultActiveTab?: 'abstract' | 'detailed' | 'mapview' | 'tp';
  defaultReportModule?: 'inspection' | 'swm';
  /** Dashboard embed: keep one reports instance and switch module after the tab paints. */
  forcedReportModule?: 'inspection' | 'swm';
  hideTabsHeader?: boolean;
  hideTopTitle?: boolean;
  /** Dashboard embed: no global refresh hooks; user applies filters explicitly */
  embedMode?: boolean;
  hideFilterActions?: boolean;
  onFilterActionsReady?: (actions: {
    apply: () => void;
    reset: () => void;
    isRefreshing: boolean;
    fetchError: string | null;
  }) => void;
  onSwmTotalsReady?: (totals: {
    totalWards: number;
    totalStreets: number;
    householdsSurveyed: number;
    segregating: number;
    notSegregating: number;
    doorLocked: number;
    homeComposting: number;
  }) => void;
  onSaveCollection?: (key: string, data: any[]) => Promise<void>;
}

export default function InspectionReportsView({
  state,
  lang,
  theme,
  currentUser,
  defaultActiveTab,
  defaultReportModule,
  forcedReportModule,
  hideTabsHeader = false,
  hideTopTitle = false,
  embedMode = false,
  hideFilterActions = false,
  onFilterActionsReady,
  onSwmTotalsReady,
  onSaveCollection
}: InspectionReportsViewProps) {
  // Current active sub-tab: 'abstract' | 'detailed' | 'mapview'
  const [activeTab, setActiveTab] = useState<'abstract' | 'detailed' | 'mapview' | 'tp'>(defaultActiveTab || 'abstract');
  const [reportModule, setReportModule] = useState<'inspection' | 'swm'>(defaultReportModule || 'inspection');
  const [swmSort, setSwmSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: '', dir: 'asc' });
  const [swmSummaryGroups, setSwmSummaryGroups] = useState<any[]>([]);
  const [swmServerRows, setSwmServerRows] = useState<SwmAbstractRow[] | null>(null);
  const [swmServerTotals, setSwmServerTotals] = useState<{
    totalWards: number;
    wardsSurveyed: number;
    totalStreets: number;
    streetsSurveyed: number;
    householdsSurveyed: number;
    segregating: number;
    notSegregating: number;
    doorLocked: number;
    homeComposting: number;
  } | null>(null);
  const [swmServerGroup, setSwmServerGroup] = useState<'tp' | 'ward' | 'street' | ''>('');
  const [swmAbstractLoading, setSwmAbstractLoading] = useState(false);
  const [swmWardCol, setSwmWardCol] = useState(false);
  const [swmStreetCol, setSwmStreetCol] = useState(false);
  const [swmBuildingType, setSwmBuildingType] = useState<'all' | 'residential' | 'commercial'>('all');

  useEffect(() => {
    if (defaultActiveTab) {
      setActiveTab(defaultActiveTab);
    }
  }, [defaultActiveTab]);

  const getInspectorDesignation = (work: any) => {
    if (!work) return lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector';
    const designations = state.inspectionDesignations || state.designations || [];

    // Check direct designation on work
    if (work.submittedByUserDesignation) {
      const match = designations.find((d: any) => d.id === work.submittedByUserDesignation || d.nameEn === work.submittedByUserDesignation || d.nameTa === work.submittedByUserDesignation);
      if (match) return lang === 'ta' ? (match.nameTa || match.nameEn) : match.nameEn;
      return work.submittedByUserDesignation;
    }

    const uId = String(work.submittedByUserId || '').toLowerCase().trim();
    const uName = String(work.submittedByUserName || '').toLowerCase().trim();

    // Check inspectionUsers & inspectionEmployees first (where field staff are stored)
    const allInspUsers = [...(state.inspectionUsers || []), ...(state.inspectionEmployees || [])];
    const matchedInspUser = allInspUsers.find((u: any) => {
      const idMatch = uId && (
        String(u.id || '').toLowerCase() === uId || 
        String(u.username || '').toLowerCase() === uId || 
        String(u.employeeId || '').toLowerCase() === uId
      );
      const nameMatch = uName && (
        (u.nameEn && u.nameEn.toLowerCase() === uName) || 
        (u.username && u.username.toLowerCase() === uName)
      );
      return idMatch || nameMatch;
    });

    if (matchedInspUser) {
      if (matchedInspUser.designationId) {
        const dMatch = designations.find((d: any) => d.id === matchedInspUser.designationId);
        if (dMatch) return lang === 'ta' ? (dMatch.nameTa || dMatch.nameEn) : dMatch.nameEn;
      }
      if (matchedInspUser.designation) return matchedInspUser.designation;
      if (matchedInspUser.designationNameEn) return lang === 'ta' ? (matchedInspUser.designationNameTa || matchedInspUser.designationNameEn) : matchedInspUser.designationNameEn;
      if (matchedInspUser.roleId) {
        const rMatch = (state.inspectionRoles || []).find((r: any) => r.id === matchedInspUser.roleId);
        if (rMatch) return lang === 'ta' ? (rMatch.nameTa || rMatch.nameEn) : rMatch.nameEn;
      }
    }

    // Check general users
    const allUsers = state.users || [];
    const matchedUser = allUsers.find((u: any) => 
      (uId && (String(u.id || '').toLowerCase() === uId || String(u.username || '').toLowerCase() === uId)) || 
      (uName && (u.nameEn || u.username || '').toLowerCase() === uName)
    );
    if (matchedUser) {
      if (matchedUser.designationId) {
        const dMatch = designations.find((d: any) => d.id === matchedUser.designationId);
        if (dMatch) return lang === 'ta' ? (dMatch.nameTa || dMatch.nameEn) : dMatch.nameEn;
      }
      if (matchedUser.designation) return matchedUser.designation;
      if (matchedUser.roleId) {
        const rMatch = (state.roles || []).find((r: any) => r.id === matchedUser.roleId);
        if (rMatch) return lang === 'ta' ? (rMatch.nameTa || rMatch.nameEn) : rMatch.nameEn;
      }
    }
    
    // Check general employees
    const matchedEmp = (state.employees || []).find((e: any) => 
      (uId && (String(e.id || '').toLowerCase() === uId || String(e.employeeId || '').toLowerCase() === uId)) || 
      (uName && (e.nameEn || '').toLowerCase() === uName)
    );
    if (matchedEmp) {
      if (matchedEmp.designationId) {
        const dMatch = designations.find((d: any) => d.id === matchedEmp.designationId);
        if (dMatch) return lang === 'ta' ? (dMatch.nameTa || dMatch.nameEn) : dMatch.nameEn;
      }
      if (matchedEmp.designation) return matchedEmp.designation;
    }
    
    if (work.designation) return work.designation;
    if (work.userDesignation) return work.userDesignation;
    return lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector';
  };

  // Helper to extract designation localized strictly respecting current language
  const getInspectorDesignationLocalized = (work: any, targetLang: 'ta' | 'en') => {
    const raw = getInspectorDesignation(work);
    if (targetLang === 'ta') {
      const dMatch = (state.designations || state.inspectionDesignations || []).find((d: any) => 
        (d.nameEn && d.nameEn.toLowerCase() === raw.toLowerCase()) ||
        (d.nameTa && d.nameTa === raw)
      );
      if (dMatch?.nameTa) return dMatch.nameTa;
      const lower = raw.toLowerCase();
      if (lower.includes('sanitary inspector')) return 'சுகாதார ஆய்வாளர்';
      if (lower.includes('executive officer')) return 'செயல் அலுவலர்';
      if (lower.includes('assistant engineer')) return 'உதவி பொறியாளர்';
      if (lower.includes('junior engineer')) return 'இளநிலை பொறியாளர்';
      if (lower.includes('supervisor')) return 'மேற்பார்வையாளர்';
      if (lower.includes('field inspector') || lower.includes('inspector')) return 'கள ஆய்வாளர்';
      if (lower.includes('admin') || lower.includes('administrator')) return 'நிர்வாகி';
      return raw;
    } else {
      const dMatch = (state.designations || state.inspectionDesignations || []).find((d: any) => 
        (d.nameTa && d.nameTa === raw) ||
        (d.nameEn && d.nameEn.toLowerCase() === raw.toLowerCase())
      );
      const val = dMatch?.nameEn || raw;
      if (val.includes('சுகாதார ஆய்வாளர்')) return 'SANITARY INSPECTOR';
      if (val.includes('செயல் அலுவலர்')) return 'EXECUTIVE OFFICER';
      if (val.includes('உதவி பொறியாளர்')) return 'ASSISTANT ENGINEER';
      if (val.includes('இளநிலை பொறியாளர்')) return 'JUNIOR ENGINEER';
      if (val.includes('மேற்பார்வையாளர்')) return 'SUPERVISOR';
      if (val.includes('கள ஆய்வாளர்')) return 'FIELD INSPECTOR';
      return String(val).toUpperCase();
    }
  };

  // Google Map Lite Map popup modal state
  const [gpsModalWork, setGpsModalWork] = useState<any>(null);

  // Category photo thumbnail popup modal state
  const [photoPreviewModal, setPhotoPreviewModal] = useState<{ url: string; label: string; work?: any } | null>(null);

  // Slideview Google Map Lite Map modal state (maximum level zoom)
  const [slideGpsModalOpen, setSlideGpsModalOpen] = useState<boolean>(false);

  // Helper to translate photo labels to Tamil when Tamil language is enabled
  const translatePhotoLabelToTamil = (rawLabel: string) => {
    if (!rawLabel) return 'கள ஆய்வு புகைப்படம்';
    const clean = String(rawLabel).trim();
    const lower = clean.toLowerCase().replace(/_/g, ' ').replace(/-/g, ' ');

    if (lower.includes('secondary') && (lower.includes('1') || lower.endsWith(' 1'))) return 'இரண்டாம் நிலை புகைப்படம் 1';
    if (lower.includes('secondary') && (lower.includes('2') || lower.endsWith(' 2'))) return 'இரண்டாம் நிலை புகைப்படம் 2';
    if (lower.includes('secondary') && (lower.includes('3') || lower.endsWith(' 3'))) return 'இரண்டாம் நிலை புகைப்படம் 3';
    if (lower.includes('secondary') && (lower.includes('4') || lower.endsWith(' 4'))) return 'இரண்டாம் நிலை புகைப்படம் 4';
    if (lower.includes('secondary') || lower.includes('second')) return 'இரண்டாம் நிலை புகைப்படம்';

    if (lower.includes('primary') || lower.includes('main')) return 'முதன்மை புகைப்படம்';
    if (lower.includes('before')) return 'ஆய்வுக்கு முந்தைய புகைப்படம்';
    if (lower.includes('after')) return 'ஆய்வுக்கு பிந்தைய புகைப்படம்';
    if (lower.includes('site') || lower.includes('location')) return 'கள ஆய்விட புகைப்படம்';
    if (lower.includes('camera') && (lower.includes('1') || lower.endsWith(' 1'))) return 'கேமரா படம் 1';
    if (lower.includes('camera') && (lower.includes('2') || lower.endsWith(' 2'))) return 'கேமரா படம் 2';
    if (lower.includes('photo') && (lower.includes('1') || lower.endsWith(' 1'))) return 'புகைப்படம் 1';
    if (lower.includes('photo') && (lower.includes('2') || lower.endsWith(' 2'))) return 'புகைப்படம் 2';

    let translated = lower
      .replace(/secondary photo 1/gi, 'இரண்டாம் நிலை புகைப்படம் 1')
      .replace(/secondary photo 2/gi, 'இரண்டாம் நிலை புகைப்படம் 2')
      .replace(/secondary photo 3/gi, 'இரண்டாம் நிலை புகைப்படம் 3')
      .replace(/secondary photo/gi, 'இரண்டாம் நிலை புகைப்படம்')
      .replace(/primary photo/gi, 'முதன்மை புகைப்படம்')
      .replace(/photo/gi, 'புகைப்படம்')
      .replace(/image/gi, 'புகைப்படம்')
      .replace(/camera/gi, 'கேமரா');

    if (translated === lower || /^[a-z0-9_\s-]+$/i.test(clean)) {
      if (lower.includes('secondary') || lower.includes('second')) return 'இரண்டாம் நிலை புகைப்படம்';
      if (lower.includes('primary') || lower.includes('main')) return 'முதன்மை புகைப்படம்';
      return 'கள ஆய்வு புகைப்படம்';
    }

    return translated;
  };

  // Helper to extract all photo evidence for a work entry
  const getWorkPhotos = (work: any, customLang?: string) => {
    const activeLang = customLang || lang;
    if (!work) return [];
    const photos: { label: string; url: string }[] = [];
    
    const normalizeUrl = (raw: string) => {
      if (!raw || typeof raw !== 'string') return '';
      const trimmed = raw.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('inspection/')) {
        return `https://tms-2026.s3.ap-south-1.amazonaws.com/${trimmed}`;
      }
      return trimmed;
    };

    // 1. Process Photos in fieldsData first to get specific field names
    if (work.fieldsData && typeof work.fieldsData === 'object') {
      Object.entries(work.fieldsData).forEach(([key, val]) => {
        if (typeof val === 'string' && val.trim() !== '') {
          const normVal = normalizeUrl(val);
          const valLower = normVal.toLowerCase();
          const keyLower = key.toLowerCase();
          const matchedField = (state.inspectionFields || []).find((f: any) => f.id === key || f.fieldName === key);
          const isCameraField = matchedField && ['camera', 'image', 'image_upload'].includes(String(matchedField.type || matchedField.fieldType || '').toLowerCase());
          const isPhotoUrl = normVal.startsWith('http') || normVal.startsWith('/uploads') || normVal.startsWith('data:image') || valLower.endsWith('.jpg') || valLower.endsWith('.jpeg') || valLower.endsWith('.png') || valLower.endsWith('.webp') || normVal.includes('s3.amazonaws.com') || normVal.includes('offline_images');
          const isPhotoKey = keyLower.includes('photo') || keyLower.includes('camera') || keyLower.includes('image') || keyLower.includes('picture');

          if (isCameraField || isPhotoUrl || isPhotoKey) {
            if (!photos.some(p => p.url === normVal)) {
              let label = '';
              if (matchedField) {
                label = activeLang === 'ta' ? (matchedField.nameTa || matchedField.nameEn) : (matchedField.nameEn || matchedField.nameTa || key);
              } else {
                label = key;
              }
              if (activeLang === 'en') label = label.toUpperCase();
              photos.push({ label, url: normVal });
            }
          }
        }
      });
    }

    // 2. Add primary imageUrl if not already present
    if (work.imageUrl) {
      const normImg = normalizeUrl(work.imageUrl);
      if (normImg && !photos.some(p => p.url === normImg)) {
        let primaryLabel = '';
        if (work.fieldsData && typeof work.fieldsData === 'object') {
          const foundEntry = Object.entries(work.fieldsData).find(([_, val]) => String(val) === work.imageUrl || normalizeUrl(String(val)) === normImg);
          if (foundEntry) {
            const key = foundEntry[0];
            const matchedField = (state.inspectionFields || []).find((f: any) => f.id === key || f.fieldName === key);
            const raw = matchedField ? (activeLang === 'ta' ? (matchedField.nameTa || matchedField.nameEn) : (matchedField.nameEn || matchedField.nameTa || key)) : key;
            primaryLabel = activeLang === 'en' ? raw.toUpperCase() : raw;
          }
        }
        
        if (!primaryLabel) {
          if (photos.length > 0) {
            primaryLabel = photos[photos.length - 1].label;
          } else {
            const catName = activeLang === 'ta' ? (work.categoryNameTa || 'கள ஆய்வு படம்') : (work.categoryNameEn || 'CATEGORY CAMERA FIELD');
            primaryLabel = activeLang === 'en' ? catName.toUpperCase() : catName;
          }
        }
        
        photos.unshift({ label: primaryLabel, url: normImg });
      }
    }

    // 3. photoUrl or image property if present
    const altPhoto = work.photoUrl || work.image || work.photo;
    if (altPhoto && typeof altPhoto === 'string') {
      const normAlt = normalizeUrl(altPhoto);
      if (normAlt && !photos.some(p => p.url === normAlt)) {
        const lbl = activeLang === 'ta' ? 'கள ஆய்வு புகைப்படம்' : 'INSPECTION PHOTO';
        photos.push({ label: activeLang === 'en' ? lbl.toUpperCase() : lbl, url: normAlt });
      }
    }

    // 4. Work.photos array if present
    if (Array.isArray(work.photos)) {
      work.photos.forEach((p: any, idx: number) => {
        const url = normalizeUrl(typeof p === 'string' ? p : p.url);
        let label = typeof p === 'object' && p.label ? p.label : (activeLang === 'ta' ? `படம் ${photos.length + 1}` : `PHOTO ${photos.length + 1}`);
        if (activeLang === 'en') label = label.toUpperCase();
        if (url && !photos.some(item => item.url === url)) {
          photos.push({ label, url });
        }
      });
    }

    if (activeLang === 'ta') {
      photos.forEach(p => {
        p.label = translatePhotoLabelToTamil(p.label);
      });
    } else {
      photos.forEach(p => {
        p.label = String(p.label).toUpperCase();
      });
    }

    return photos;
  };

  // Helper to extract non-photo textual field key-values in exact master created order
  const getWorkTextData = (work: any, customLang?: string) => {
    const activeLang = customLang || lang;
    if (!work || !work.fieldsData || typeof work.fieldsData !== 'object') return [];

    const data: { label: string; value: string }[] = [];
    const processedKeys = new Set<string>();
    const fieldsData = work.fieldsData;

    // Helper to check if a value or key is photo/image
    const checkIsPhoto = (valStr: string, keyName: string, matchedField?: any) => {
      const valLower = valStr.toLowerCase();
      const keyLower = keyName.toLowerCase();
      const isCamera = matchedField && ['camera', 'image', 'image_upload'].includes(String(matchedField.type || matchedField.fieldType || '').toLowerCase());
      return isCamera || 
        valStr.startsWith('http') || 
        valStr.startsWith('/uploads') || 
        valStr.startsWith('inspection/') || 
        valStr.startsWith('data:image') || 
        valLower.endsWith('.jpg') || 
        valLower.endsWith('.jpeg') || 
        valLower.endsWith('.png') || 
        valLower.endsWith('.webp') || 
        keyLower.includes('photo') || 
        keyLower.includes('camera') || 
        keyLower.includes('image');
    };

    // 1. Get all master field definitions from state.inspectionFields sorted by order/sequence
    const allMasterFields = (state.inspectionFields || []).slice().sort((a: any, b: any) => {
      const orderA = typeof a.order === 'number' ? a.order : (typeof a.sequence === 'number' ? a.sequence : 999);
      const orderB = typeof b.order === 'number' ? b.order : (typeof b.sequence === 'number' ? b.sequence : 999);
      return orderA - orderB;
    });

    // Filter fields belonging to this work's category if categoryId exists
    const wCatId = String(work.categoryId || '').trim();
    const catMasterFields = wCatId 
      ? allMasterFields.filter((f: any) => String(f.categoryId || '').trim() === wCatId)
      : allMasterFields;

    const fieldsToProcess = catMasterFields.length > 0 ? catMasterFields : allMasterFields;

    // 2. Iterate in EXACT MASTER FIELD CREATED ORDER first
    fieldsToProcess.forEach((f: any) => {
      const candidateKeys = [f.id, f.fieldName, f.key, f.nameEn, f.nameTa].filter(Boolean);
      let matchedKey: string | null = null;
      let val: any = null;

      for (const k of candidateKeys) {
        if (fieldsData[k] !== undefined && fieldsData[k] !== null && String(fieldsData[k]).trim() !== '' && !processedKeys.has(k)) {
          matchedKey = k;
          val = fieldsData[k];
          break;
        }
      }

      if (!matchedKey) {
        for (const [k, v] of Object.entries(fieldsData)) {
          if (!processedKeys.has(k) && v !== undefined && v !== null && String(v).trim() !== '') {
            const kLower = k.toLowerCase();
            if (
              (f.id && String(f.id).toLowerCase() === kLower) ||
              (f.fieldName && String(f.fieldName).toLowerCase() === kLower) ||
              (f.nameEn && String(f.nameEn).toLowerCase() === kLower)
            ) {
              matchedKey = k;
              val = v;
              break;
            }
          }
        }
      }

      if (matchedKey && val !== null) {
        processedKeys.add(matchedKey);
        const valStr = String(val);
        const isPhoto = checkIsPhoto(valStr, matchedKey, f);

        if (!isPhoto) {
          let label = localizeFieldTitle(f.fieldName || f.nameEn || matchedKey, activeLang as any, state.inspectionFields);
          let value = valStr;
          if (activeLang === 'en') {
            label = label.toUpperCase();
            value = value.toUpperCase();
          } else {
            const vLower = valStr.trim().toLowerCase();
            if (vLower === 'yes' || vLower === 'y' || vLower === 'true') value = 'ஆம்';
            else if (vLower === 'no' || vLower === 'n' || vLower === 'false') value = 'இல்லை';
            else if (vLower === 'good') value = 'நன்று';
            else if (vLower === 'bad') value = 'மோசம்';
            else if (vLower === 'average') value = 'சராசரி';
            else if (vLower === 'completed') value = 'முடிவடைந்தது';
            else if (vLower === 'pending') value = 'நிலுவையில்';
          }
          data.push({ label, value });
        }
      }
    });

    // 3. Append any remaining fields in fieldsData that were not in state.inspectionFields
    Object.entries(fieldsData).forEach(([key, val]) => {
      if (!processedKeys.has(key) && val !== undefined && val !== null && String(val).trim() !== '') {
        const valStr = String(val);
        const matchedField = (state.inspectionFields || []).find((f: any) => f.id === key || f.fieldName === key);
        const isPhoto = checkIsPhoto(valStr, key, matchedField);

        if (!isPhoto) {
          processedKeys.add(key);
          let label = localizeFieldTitle(key, activeLang as any, state.inspectionFields);
          let value = valStr;
          if (activeLang === 'en') {
            label = label.toUpperCase();
            value = value.toUpperCase();
          } else {
            const vLower = valStr.trim().toLowerCase();
            if (vLower === 'yes' || vLower === 'y' || vLower === 'true') value = 'ஆம்';
            else if (vLower === 'no' || vLower === 'n' || vLower === 'false') value = 'இல்லை';
            else if (vLower === 'good') value = 'நன்று';
            else if (vLower === 'bad') value = 'மோசம்';
            else if (vLower === 'average') value = 'சராசரி';
            else if (vLower === 'completed') value = 'முடிவடைந்தது';
            else if (vLower === 'pending') value = 'நிலுவையில்';
          }
          data.push({ label, value });
        }
      }
    });

    return data;
  };

  // Helper to get today's date formatted YYYY-MM-DD in Asia/Kolkata timezone
  const getTodayYmd = () => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date());
  };

  // Filter States — default to today's IST date; Clear Today still shows all time
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedTpId, setSelectedTpId] = useState<string>('all');
  const [selectedWard, setSelectedWard] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>(() => getTodayYmd());
  const [toDate, setToDate] = useState<string>(() => getTodayYmd());

  // Admin dynamic field filter states
  const [adminFilterFieldId, setAdminFilterFieldId] = useState<string>('');
  const [adminFilterValue, setAdminFilterValue] = useState<string>('');

  // Additional New Filters requested: Zone, District, Street
  const [selectedZoneId, setSelectedZoneId] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedStreetName, setSelectedStreetName] = useState<string>('all');

  // Subjects - ONLY created subjects, filter out dummy fallbacks
  const availableSubjects = useMemo(() => {
    return (state.inspectionSubjects || []).filter((s: any) => {
      const name = String(s.nameEn || s.name || '').trim().toLowerCase();
      const nameTa = String(s.nameTa || '').trim();
      const id = String(s.id || '').trim().toLowerCase();
      return name !== 'general inspection' && name !== 'general' && !name.includes('fallback') && id !== 'subj_general' && id !== 'general_inspection' && nameTa !== 'பொது ஆய்வு';
    });
  }, [state.inspectionSubjects]);

  const swmDoorToDoorCategories = useMemo(
    () => (state.inspectionCategories || []).filter(isDoorToDoorCategory),
    [state.inspectionCategories]
  );

  const swmSubjectId = useMemo(() => {
    const fromCat = swmDoorToDoorCategories.find((c: any) => c?.subjectId)?.subjectId;
    if (fromCat) return String(fromCat);
    const subjects = state.inspectionSubjects || [];
    const score = (s: any) => {
      const id = String(s.id || '').trim().toLowerCase();
      const name = String(s.nameEn || s.name || '').trim().toLowerCase();
      if (id.includes('swm_monitoring') || name.includes('swm monitoring')) return 4;
      if (name.includes('swm') && name.includes('monitor')) return 3;
      return 0;
    };
    const ranked = [...subjects].sort((a, b) => score(b) - score(a));
    return score(ranked[0]) > 0 ? String(ranked[0].id) : 'subj_swm_monitoring_i5a3';
  }, [state.inspectionSubjects, swmDoorToDoorCategories]);

  const swmDoorToDoorCategoryId = useMemo(() => {
    const ranked = [...swmDoorToDoorCategories].sort((a: any, b: any) => {
      const an = String(a.nameEn || '').toLowerCase();
      const bn = String(b.nameEn || '').toLowerCase();
      const as = (an.includes('source') ? 2 : 0) + (an.includes('segregat') ? 2 : 0) + (String(a.id).includes('gb8o') ? 1 : 0);
      const bs = (bn.includes('source') ? 2 : 0) + (bn.includes('segregat') ? 2 : 0) + (String(b.id).includes('gb8o') ? 1 : 0);
      return bs - as;
    });
    return String(ranked[0]?.id || 'cat_door_to_door_source_segregation_gb8o');
  }, [swmDoorToDoorCategories]);

  const swmDoorToDoorCategoryIds = useMemo(() => {
    const ids = new Set<string>(swmDoorToDoorCategories.map((c: any) => String(c.id || '').trim().toLowerCase()).filter(Boolean));
    ids.add(String(swmDoorToDoorCategoryId).toLowerCase());
    ids.add('cat_door_to_door_source_segregation_gb8o');
    ids.add('cat_door_to_door_source_segregation_nis3');
    return ids;
  }, [swmDoorToDoorCategories, swmDoorToDoorCategoryId]);

  // Categories filtered by selected subject - ONLY created categories
  const availableCategories = useMemo(() => {
    const allCats = (state.inspectionCategories || []).filter((c: any) => {
      const name = String(c.nameEn || c.name || '').trim().toLowerCase();
      const nameTa = String(c.nameTa || '').trim();
      const id = String(c.id || '').trim().toLowerCase();
      return name !== 'field check' && name !== 'general category' && name !== 'general inspection' && !name.includes('fallback') && id !== 'cat_field_check' && id !== 'cat_general' && id !== 'field_check' && nameTa !== 'கள ஆய்வு' && nameTa !== 'பொது வகை';
    });
    if (selectedSubjectId === 'all') {
      return allCats;
    }
    const sSubj = String(selectedSubjectId).toLowerCase();
    const matchedSubject = (state.inspectionSubjects || []).find((s: any) => String(s.id).toLowerCase() === sSubj || String(s.code || '').toLowerCase() === sSubj);
    const targetSubjId = matchedSubject ? String(matchedSubject.id).toLowerCase() : sSubj;
    const targetSubjCode = matchedSubject?.code ? String(matchedSubject.code).toLowerCase() : '';

    return allCats.filter((c: any) => {
      const cSubj = String(c.subjectId || '').toLowerCase();
      return cSubj === targetSubjId || (targetSubjCode && cSubj === targetSubjCode);
    });
  }, [state.inspectionCategories, state.inspectionSubjects, selectedSubjectId]);

  // Compute fields available for dynamic filtering based on category & subject selection
  const fieldMatchesCategory = React.useCallback(
    (f: any, categoryId: string) => {
      if (!categoryId || categoryId === 'all') return true;
      const fCat = String(f.categoryId || f.category_id || '').trim();
      if (!fCat) return false;
      if (fCat === categoryId) return true;
      const cat = (state.inspectionCategories || []).find(
        (c: any) => String(c.id) === categoryId || String(c.code || '') === categoryId
      );
      if (!cat) return fCat.toLowerCase() === String(categoryId).toLowerCase();
      return (
        fCat === cat.id ||
        fCat === cat.code ||
        String(fCat).toLowerCase() === String(cat.id).toLowerCase() ||
        String(fCat).toLowerCase() === String(cat.code || '').toLowerCase()
      );
    },
    [state.inspectionCategories]
  );

  const fieldsForFilter = useMemo(() => {
    let list = state.inspectionFields || [];
    if (selectedCategoryId !== 'all') {
      list = list.filter((f: any) => fieldMatchesCategory(f, selectedCategoryId));
    } else if (selectedSubjectId !== 'all') {
      const catIds = new Set(availableCategories.flatMap((c: any) => [c.id, c.code].filter(Boolean)));
      list = list.filter((f: any) => {
        const fCat = String(f.categoryId || f.category_id || '');
        return catIds.has(fCat) || [...catIds].some((id) => String(id).toLowerCase() === fCat.toLowerCase());
      });
    }
    return list;
  }, [state.inspectionFields, selectedCategoryId, selectedSubjectId, availableCategories, fieldMatchesCategory]);

  const selectedAdminFilterField = useMemo(
    () => fieldsForFilter.find((f: any) => String(f.id) === String(adminFilterFieldId)) || null,
    [fieldsForFilter, adminFilterFieldId]
  );

  const adminFieldValueOptions = useMemo(() => {
    if (!selectedAdminFilterField) return [] as string[];
    const type = String(selectedAdminFilterField.type || selectedAdminFilterField.fieldType || '').toLowerCase();
    const raw = selectedAdminFilterField.options;
    let opts: string[] = [];
    if (Array.isArray(raw)) {
      opts = raw
        .map((o: any) => {
          if (o == null) return '';
          if (typeof o === 'string' || typeof o === 'number') return String(o).trim();
          return String(o.label || o.nameEn || o.nameTa || o.name || o.value || o.id || '').trim();
        })
        .filter(Boolean);
    } else if (typeof raw === 'string' && raw.trim()) {
      opts = raw.split(',').map((s: string) => s.trim()).filter(Boolean);
    }
    const isYesNo =
      type === 'yes_no' ||
      type === 'radio' ||
      type.includes('option');
    if (isYesNo && opts.length === 0) {
      opts = lang === 'ta' ? ['ஆம்', 'இல்லை'] : ['Yes', 'No'];
    }
    return [...new Set(opts)];
  }, [selectedAdminFilterField, lang]);

  // Compute dynamic columns for the table based on category & subject selection
  const dynamicColumns = useMemo(() => {
    let fields = state.inspectionFields || [];
    if (selectedCategoryId !== 'all') {
      fields = fields.filter((f: any) => fieldMatchesCategory(f, selectedCategoryId));
    } else if (selectedSubjectId !== 'all') {
      const catIds = new Set(availableCategories.flatMap((c: any) => [c.id, c.code].filter(Boolean)));
      fields = fields.filter((f: any) => {
        const fCat = String(f.categoryId || f.category_id || '');
        return catIds.has(fCat) || [...catIds].some((id) => String(id).toLowerCase() === fCat.toLowerCase());
      });
    }
    const seen = new Set();
    return fields.filter((f: any) => {
      const fId = f.id || f.fieldKey || f.fieldName;
      if (!fId || seen.has(fId)) return false;
      seen.add(fId);
      return true;
    });
  }, [state.inspectionFields, selectedCategoryId, selectedSubjectId, availableCategories, fieldMatchesCategory]);

  // Dynamic Grouping Style: 'subject' | 'user' | 'location'
  const [groupingStyle, setGroupingStyle] = useState<'subject' | 'user' | 'location'>('subject');
  const abstractGroupingLabel =
    groupingStyle === 'subject'
      ? (lang === 'ta' ? 'பிரிவு மற்றும் வகை வாரியாக' : 'Subject / Category')
      : groupingStyle === 'user'
        ? (lang === 'ta' ? 'பயனர் வாரியாக' : 'User Wise')
        : (lang === 'ta' ? 'இடம் வாரியாக' : 'Location Wise');

  // Category wise details always enabled
  const categoryWiseEnabled = true;

  // Sort State
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>(null);

  // Pagination State (50 items per page)
  const [abstractPage, setAbstractPage] = useState<number>(1);
  const [detailedPage, setDetailedPage] = useState<number>(1);

  // Fullscreen Detailed Slideshow Mode (individual works)
  const [isDetailedSlideOpen, setIsDetailedSlideOpen] = useState<boolean>(false);
  const [detailedSlideIndex, setDetailedSlideIndex] = useState<number>(0);
  const [slideTheme, setSlideTheme] = useState<'dark' | 'light'>('dark');
  const [slideLang, setSlideLang] = useState<'ta' | 'en'>(lang);
  const [isSlideDownloading, setIsSlideDownloading] = useState(false);
  const [slideDeckExport, setSlideDeckExport] = useState<{ current: number; total: number; format: 'pdf' | 'ppt' } | null>(null);
  const slideContainerRef = useRef<HTMLDivElement | null>(null);
  const slidePageCacheRef = useRef<Map<number, any[]>>(new Map());
  const slideCacheGenRef = useRef(0);
  const lastSlideWorkRef = useRef<any>(null);
  const [slideCacheTick, setSlideCacheTick] = useState(0);
  const [slideWorkFields, setSlideWorkFields] = useState<any | null>(null);

  // Sync slideLang with main lang prop
  useEffect(() => {
    setSlideLang(lang);
  }, [lang]);

  // Sort state for Detailed Register table (default: recent work entries on top)
  const [detailedSortField, setDetailedSortField] = useState<string>('submittedAt');
  const [detailedSortDirection, setDetailedSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleDetailedSort = (field: string) => {
    if (detailedSortField === field) {
      setDetailedSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setDetailedSortField(field);
      setDetailedSortDirection(field === 'submittedAt' ? 'desc' : 'asc');
    }
  };

  // Multiselect columns selection states
  const [userCols, setUserCols] = useState<{ subject: boolean; category: boolean }>({
    subject: false,
    category: false
  });

  const [locCols, setLocCols] = useState<{
    district: boolean;
    tp: boolean;
    ward: boolean;
    street: boolean;
    subject: boolean;
    category: boolean;
  }>({
    district: false,
    tp: false,
    ward: false,
    street: false,
    subject: false,
    category: false
  });

  // Handle toggles for user columns
  const handleToggleUserCol = (col: 'subject' | 'category') => {
    setUserCols(prev => {
      let nextSubject = prev.subject;
      let nextCategory = prev.category;
      if (col === 'category') {
        nextCategory = !prev.category;
        if (nextCategory) {
          nextSubject = true; // category enabled -> subject automatically enabled
        }
      } else {
        nextSubject = !prev.subject;
        if (!nextSubject) {
          nextCategory = false; // subject disabled -> category also disabled
        }
      }
      return { subject: nextSubject, category: nextCategory };
    });
  };

  // Handle toggles for location columns with hierarchy logic
  const handleToggleLocCol = (col: keyof typeof locCols) => {
    setLocCols(prev => {
      const next = { ...prev };
      next[col] = !prev[col];

      if (next[col]) {
        // Automatic activation logic:
        if (col === 'street') {
          next.district = true;
          next.tp = true;
          next.ward = true;
        } else if (col === 'ward') {
          next.district = true;
          next.tp = true;
        } else if (col === 'tp') {
          next.district = true;
        } else if (col === 'category') {
          next.subject = true;
        }
      } else {
        // Automatic deactivation logic:
        if (col === 'district') {
          next.tp = false;
          next.ward = false;
          next.street = false;
        } else if (col === 'tp') {
          next.ward = false;
          next.street = false;
        } else if (col === 'ward') {
          next.street = false;
        } else if (col === 'subject') {
          next.category = false;
        }
      }
      return next;
    });
  };

  // Selected work for detailed slip modal
  const [selectedWorkModal, setSelectedWorkModal] = useState<any | null>(null);

  // Selected work for edit modal
  const [editingWork, setEditingWork] = useState<any | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const currentTheme = themesConfig[theme] || themesConfig.light;

  // Real-time works data and live refresh
  const [fetchedWorks, setFetchedWorks] = useState<any[] | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [filtersCollapsed, setFiltersCollapsed] = useState(false);
  const [apiCategoryCounts, setApiCategoryCounts] = useState<Record<string, number>>({});
  const [apiTotalWithoutCategory, setApiTotalWithoutCategory] = useState(0);
  const [apiWorksTotal, setApiWorksTotal] = useState(0);
  const [apiSubjectRollups, setApiSubjectRollups] = useState<
    Array<{ subjectId: string; categoryId: string; count: number }>
  >([]);
  const [apiDimensionRollups, setApiDimensionRollups] = useState<InspectionWorkReportDimensionRollup[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<string>(() => new Date().toLocaleTimeString());

  // Google Map controls
  const [mapCoords, setMapCoords] = useState<{ lat: number; lng: number }>({ lat: 12.7244, lng: 80.1873 });
  const [mapZoom, setMapZoom] = useState<number>(15);
  const [mapType, setMapType] = useState<'streets' | 'satellite'>('streets');
  const [selectedMapPinWork, setSelectedMapPinWork] = useState<any | null>(null);

  // Requirement 1: admin user role only can delete inspection entries in webapp. No need delete option for other than admin users.
  const isAdmin = useMemo(() => {
    if (!currentUser) return false;
    const role = String(currentUser.role || currentUser.roleId || '').toLowerCase().trim();
    const username = String(currentUser.username || '').toLowerCase().trim();
    return (
      role === 'admin' ||
      role === 'super admin' ||
      role === 'superadmin' ||
      role === 'administrator' ||
      role.includes('admin') ||
      username === 'admin' ||
      username === 'dtpadmin' ||
      currentUser.isSuperAdmin === true ||
      currentUser.isAdmin === true
    );
  }, [currentUser]);

  // Strict admin role for TP Wise reports export
  const isAdminRole = useMemo(() => {
    if (!currentUser) return true;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    const username = String(currentUser.username || '').toLowerCase();
    return (
      role === 'admin' ||
      role === 'dtpadmin' ||
      role.includes('admin') ||
      username === 'dtpadmin' ||
      username === 'admin' ||
      currentUser.isSuperAdmin === true ||
      currentUser.isAdmin === true
    );
  }, [currentUser]);

  const [isExportingZip, setIsExportingZip] = useState(false);
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const isExportingExcelRef = React.useRef(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const isExportingPdfRef = React.useRef(false);
  const [exportStatusText, setExportStatusText] = useState('');

  const isFetchingRef = React.useRef(false);
  const fetchSeqRef = React.useRef(0);
  const fetchedWorksRef = React.useRef<any[] | null>(null);
  fetchedWorksRef.current = fetchedWorks;
  const lastUserActivityRef = React.useRef(Date.now());
  /** Increment to load report rows from API (Apply / Refresh — not dashboard auto-refresh). */
  const [filtersLoadToken, setFiltersLoadToken] = React.useState(0);
  const refreshRemoteOnFetchRef = React.useRef(false);
  const skipFilterDebounceRef = React.useRef(false);
  const filterQueryRef = React.useRef<Record<string, string>>({});

  // Listen to user interactions to detect active vs idle state
  React.useEffect(() => {
    const markActivity = () => {
      lastUserActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', markActivity, { passive: true });
    window.addEventListener('keydown', markActivity, { passive: true });
    window.addEventListener('touchstart', markActivity, { passive: true });
    window.addEventListener('scroll', markActivity, { passive: true });
    window.addEventListener('click', markActivity, { passive: true });

    return () => {
      window.removeEventListener('mousemove', markActivity);
      window.removeEventListener('keydown', markActivity);
      window.removeEventListener('touchstart', markActivity);
      window.removeEventListener('scroll', markActivity);
      window.removeEventListener('click', markActivity);
    };
  }, []);

  const t = (key: keyof typeof translations['en']) => {
    return translations[lang][key] || translations['en'][key] || key;
  };

  const tObj = (obj: any) => {
    if (!obj) return '';
    return lang === 'ta' ? (obj.nameTa || obj.nameEn) : (obj.nameEn || obj.nameTa);
  };

  const streetLabel = (work: any, activeLang: string = lang) =>
    getLocalizedStreetName(work, activeLang, state.wardsAndStreets || []);

  // Deduplicate inspection works to eliminate duplicate rows and resolve real subjects and categories
  const worksFromApi = fetchedWorks !== null;

  const rawWorks: any[] = useMemo(() => {
    const list =
      fetchedWorks !== null
        ? fetchedWorks
        : embedMode
          ? []
          : (state.inspectionWorks || []);
    const seen = new Set<string>();
    const deduplicated: any[] = [];
    const subjects = state.inspectionSubjects || [];
    const categories = state.inspectionCategories || [];
    const fields = state.inspectionFields || [];

    for (const rawItem of list) {
      const w = worksFromApi
        ? rawItem
        : resolveWorkSubjectAndCategory(rawItem, subjects, categories, fields);

      const key = (w.workId || w.id || '').trim();
      if (!key) {
        deduplicated.push(w);
      } else if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(w);
      }
    }
    return deduplicated;
  }, [
    embedMode,
    fetchedWorks,
    worksFromApi,
    state.inspectionWorks,
    state.inspectionSubjects,
    state.inspectionCategories,
    state.inspectionFields,
  ]);

  // Helper to determine if the logged in user is Admin or Director (full unrestricted state-wide access)
  const isAdminOrDirector = useMemo(() => isHodLikeUser(currentUser), [currentUser]);

  // Restricted scope helper values - strict scoping for Town Panchayat and Zonal roles
  const userTpId = useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    if (isZonalScopedUser(currentUser)) return null;
    const uName = String(currentUser.username || '').toLowerCase();

    // Direct check for Arani EO or username (matching any login with username eo/arani/tp_csv)
    if (uName === 'eo' || uName.includes('eo') || uName.includes('arani') || uName.includes('36u9')) {
      const araniTp = (state.townPanchayats || []).find((t: any) => 
        String(t.nameEn || '').toLowerCase().includes('arani') ||
        String(t.id || '').toLowerCase().includes('arani') ||
        String(t.id || '').toLowerCase().includes('36u9')
      );
      if (araniTp) return araniTp.id;
    }

    const isTpRole = currentUser.scopeType === 'TownPanchayat' || role === 'eo' || role === 'town_panchayat' || role === 'tp' || role === 'townpanchayat' || role.includes('tp') || role.includes('panchayat') || !!currentUser.tpId || !!currentUser.townPanchayatId || !!currentUser.assignedTpId || uName.includes('arani') || uName.startsWith('eo_') || uName.startsWith('tp_');
    if (isTpRole) {
      const explicitTp = currentUser.tpId || currentUser.townPanchayatId || currentUser.assignedTpId || (currentUser.scopeType === 'TownPanchayat' ? currentUser.scopeId : null);
      if (explicitTp && explicitTp !== 'all') {
        const matched = (state.townPanchayats || []).find((t: any) => 
          String(t.id).toLowerCase() === String(explicitTp).toLowerCase() ||
          String(t.nameEn || '').toLowerCase() === String(explicitTp).toLowerCase()
        );
        if (matched) return matched.id;
        if (String(explicitTp).startsWith('tp_csv_')) {
          const araniTp = (state.townPanchayats || []).find((t: any) => 
            String(t.nameEn || '').toLowerCase().includes('arani') ||
            String(t.id || '').toLowerCase().includes('arani')
          );
          if (araniTp) return araniTp.id;
        }
        return explicitTp;
      }
      if (currentUser.scopeId && currentUser.scopeId !== 'all') {
        const matched = (state.townPanchayats || []).find((t: any) => 
          String(t.id).toLowerCase() === String(currentUser.scopeId).toLowerCase() ||
          String(t.nameEn || '').toLowerCase() === String(currentUser.scopeId).toLowerCase()
        );
        if (matched) return matched.id;
        if (String(currentUser.scopeId).startsWith('tp_csv_')) {
          const araniTp = (state.townPanchayats || []).find((t: any) => 
            String(t.nameEn || '').toLowerCase().includes('arani') ||
            String(t.id || '').toLowerCase().includes('arani')
          );
          if (araniTp) return araniTp.id;
        }
        return currentUser.scopeId;
      }
      if (Array.isArray(currentUser.townPanchayatIds) && currentUser.townPanchayatIds.length > 0) {
        return currentUser.townPanchayatIds[0];
      }
      if (Array.isArray(currentUser.selectedTpIds) && currentUser.selectedTpIds.length > 0) {
        return currentUser.selectedTpIds[0];
      }
      const matchedUserTp = (state.townPanchayats || []).find((t: any) => 
        String(t.nameEn || '').toLowerCase() === uName ||
        String(t.id || '').toLowerCase() === uName
      );
      if (matchedUserTp) return matchedUserTp.id;

      if (uName.includes('arani')) {
        const araniTp = (state.townPanchayats || []).find((t: any) => 
          String(t.nameEn || '').toLowerCase().includes('arani') ||
          String(t.id || '').toLowerCase().includes('arani')
        );
        if (araniTp) return araniTp.id;
      }
    }
    return null;
  }, [currentUser, isAdminOrDirector, state.townPanchayats]);

  const userDistrictId = useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    const role = String(currentUser.roleId || currentUser.role || '').toLowerCase();
    if (isZonalScopedUser(currentUser)) return null;
    if (userTpId) {
      const tpObj = (state.townPanchayats || []).find((t: any) => 
        String(t.id).toLowerCase() === String(userTpId).toLowerCase() || 
        String(t.nameEn || '').toLowerCase() === String(userTpId).toLowerCase() ||
        String(t.nameTa || '').toLowerCase() === String(userTpId).toLowerCase()
      );
      if (tpObj?.districtId) return tpObj.districtId;
      if (currentUser.districtId && currentUser.districtId !== 'all') return currentUser.districtId;
      if (currentUser.assignedDistrictId && currentUser.assignedDistrictId !== 'all') return currentUser.assignedDistrictId;
      if (tpObj?.districtNameEn) {
        const matchedDist = (state.districts || []).find((d: any) =>
          geoNamesEqual(d.nameEn, tpObj.districtNameEn) ||
          geoNamesEqual(d.nameTa, tpObj.districtNameEn)
        );
        if (matchedDist) return matchedDist.id;
      }
      if (String(userTpId).toLowerCase().includes('arani') || String(currentUser?.username).toLowerCase().includes('arani')) {
        const thiruvallurDist = (state.districts || []).find((d: any) =>
          geoNamesEqual(d.nameEn, 'Thiruvallur') ||
          geoNamesEqual(d.nameEn, 'Tiruvallur') ||
          String(d.id || '').toLowerCase().includes('thiruvallur') ||
          String(d.id || '').toLowerCase().includes('tiruvallur')
        );
        if (thiruvallurDist) return thiruvallurDist.id;
      }
    }
    if (!isZonalScopedUser(currentUser) && currentUser.districtId && currentUser.districtId !== 'all') {
      return currentUser.districtId;
    }
    return null;
  }, [currentUser, userTpId, isAdminOrDirector, state.townPanchayats, state.districts]);

  const userZoneId = useMemo(() => {
    if (isAdminOrDirector || !currentUser) return null;
    if (isZonalScopedUser(currentUser)) {
      const explicitZone = currentUser.zoneId || (currentUser.scopeType === 'Zone' ? currentUser.scopeId : null);
      if (explicitZone && explicitZone !== 'all') {
        const matched = (state.zones || []).find((z: any) => 
          String(z.id).toLowerCase() === String(explicitZone).toLowerCase() ||
          String(z.nameEn || '').toLowerCase() === String(explicitZone).toLowerCase()
        );
        return matched ? matched.id : explicitZone;
      }
      if (currentUser.scopeId && currentUser.scopeId !== 'all') {
        const matched = (state.zones || []).find((z: any) => 
          String(z.id).toLowerCase() === String(currentUser.scopeId).toLowerCase() ||
          String(z.nameEn || '').toLowerCase() === String(currentUser.scopeId).toLowerCase()
        );
        return matched ? matched.id : currentUser.scopeId;
      }
    }
    if (userDistrictId) {
      const distObj = (state.districts || []).find((d: any) => 
        String(d.id).toLowerCase() === String(userDistrictId).toLowerCase() ||
        String(d.nameEn || '').toLowerCase() === String(userDistrictId).toLowerCase()
      );
      if (distObj?.zoneId) return distObj.zoneId;
      if (distObj?.zoneNameEn) {
        const matchedZone = (state.zones || []).find((z: any) => 
          String(z.nameEn || '').toLowerCase() === String(distObj.zoneNameEn).toLowerCase()
        );
        if (matchedZone) return matchedZone.id;
      }
    }
    if (userTpId) {
      const tpObj = (state.townPanchayats || []).find((t: any) => 
        String(t.id).toLowerCase() === String(userTpId).toLowerCase() || 
        String(t.nameEn || '').toLowerCase() === String(userTpId).toLowerCase()
      );
      if (tpObj) {
        const distObj = (state.districts || []).find((d: any) =>
          String(d.id).toLowerCase() === String(tpObj.districtId).toLowerCase() ||
          geoNamesEqual(d.nameEn, tpObj.districtNameEn) ||
          geoNamesEqual(d.nameTa, tpObj.districtNameEn)
        );
        if (distObj?.zoneId) return distObj.zoneId;
      }
    }
    if (currentUser.zoneId && currentUser.zoneId !== 'all') return currentUser.zoneId;
    return null;
  }, [currentUser, userTpId, userDistrictId, isAdminOrDirector, state.townPanchayats, state.districts, state.zones]);

  const lastAutoLoadKeyRef = React.useRef('');

  filterQueryRef.current = {
    fromDate,
    toDate,
    selectedTpId,
    selectedDistrictId,
    selectedZoneId,
    selectedWard,
    selectedSubjectId,
    selectedCategoryId,
    selectedStreetName,
    searchQuery,
    adminFilterFieldId,
    adminFilterValue,
    scopeTpId: userTpId || '',
    scopeZoneId: userZoneId || '',
    scopeDistrictId: userDistrictId || '',
  };

  const REPORTS_SERVER_PAGE_SIZE = 50;

  const buildInspectionWorksQueryParams = React.useCallback(
    (extra?: { countsOnly?: boolean; rowsOnly?: boolean; reportsBundle?: boolean; page?: number; pageSize?: number }) => {
      const p = filterQueryRef.current;
      const qParams = new URLSearchParams();
      if (p.fromDate) qParams.set('fromDate', p.fromDate);
      if (p.toDate) qParams.set('toDate', p.toDate);
      if (!p.fromDate && !p.toDate) qParams.set('allTime', '1');
      if (p.selectedTpId && p.selectedTpId !== 'all') {
        qParams.set('tpId', p.selectedTpId);
        const tp = (state.townPanchayats || []).find(
          (t: any) => String(t.id || '').toLowerCase() === String(p.selectedTpId).toLowerCase()
        );
        if (tp?.nameEn) qParams.set('tpNameEn', String(tp.nameEn));
      }
      if (p.selectedDistrictId && p.selectedDistrictId !== 'all') {
        qParams.set('districtId', p.selectedDistrictId);
        const dist = (state.districts || []).find(
          (d: any) => String(d.id || '').toLowerCase() === String(p.selectedDistrictId).toLowerCase()
        );
        if (dist?.nameEn) qParams.set('districtNameEn', String(dist.nameEn));
      }
      if (p.selectedZoneId && p.selectedZoneId !== 'all') {
        qParams.set('zoneId', p.selectedZoneId);
        const zone = (state.zones || []).find(
          (z: any) => String(z.id || '').toLowerCase() === String(p.selectedZoneId).toLowerCase()
        );
        if (zone?.nameEn) qParams.set('zoneNameEn', String(zone.nameEn));
      }
      if (p.selectedWard && p.selectedWard !== 'all') qParams.set('ward', p.selectedWard);
      if (p.selectedSubjectId && p.selectedSubjectId !== 'all') qParams.set('subjectId', p.selectedSubjectId);
      if (p.selectedCategoryId && p.selectedCategoryId !== 'all') qParams.set('categoryId', p.selectedCategoryId);
      if (p.selectedStreetName && p.selectedStreetName !== 'all') qParams.set('street', p.selectedStreetName);
      if (p.searchQuery?.trim()) qParams.set('q', p.searchQuery.trim());
      if (p.adminFilterFieldId) qParams.set('adminFieldId', p.adminFilterFieldId);
      if (p.adminFilterValue) qParams.set('adminFieldValue', p.adminFilterValue);
      if (!isAdminOrDirector) {
        if (p.scopeTpId) qParams.set('scopeTpId', p.scopeTpId);
        else if (p.scopeZoneId) qParams.set('scopeZoneId', p.scopeZoneId);
        else if (p.scopeDistrictId) qParams.set('scopeDistrictId', p.scopeDistrictId);
      }
      qParams.set('lite', '1');
      if (extra?.reportsBundle) {
        qParams.set('reportsBundle', '1');
        qParams.set('page', String(extra.page && extra.page > 0 ? extra.page : 1));
        qParams.set('pageSize', String(extra.pageSize && extra.pageSize > 0 ? extra.pageSize : REPORTS_SERVER_PAGE_SIZE));
      } else {
        if (extra?.countsOnly) qParams.set('countsOnly', '1');
        if (extra?.rowsOnly) {
          qParams.set('rowsOnly', '1');
          qParams.set('page', String(extra.page && extra.page > 0 ? extra.page : 1));
          qParams.set('pageSize', String(extra.pageSize && extra.pageSize > 0 ? extra.pageSize : REPORTS_SERVER_PAGE_SIZE));
        }
      }
      if (refreshRemoteOnFetchRef.current) {
        qParams.set('refreshRemote', '1');
        refreshRemoteOnFetchRef.current = false;
      }
      return qParams;
    },
    [isAdminOrDirector, state.townPanchayats, state.districts, state.zones]
  );

  const applyCountsPayload = React.useCallback((json: any) => {
    let applied = false;
    if (Array.isArray(json?.subjectCategoryRollups)) {
      setApiSubjectRollups(json.subjectCategoryRollups);
      applied = true;
    }
    if (json?.categoryCounts && typeof json.categoryCounts === 'object') {
      setApiCategoryCounts(json.categoryCounts);
      applied = true;
    } else if (Array.isArray(json?.subjectCategoryRollups) && json.subjectCategoryRollups.length > 0) {
      setApiCategoryCounts(
        categoryCountsFromSubjectRollups(json.subjectCategoryRollups, state.inspectionCategories || [])
      );
      applied = true;
    }
    if (typeof json?.totalWithoutCategoryFilter === 'number') {
      setApiTotalWithoutCategory(json.totalWithoutCategoryFilter);
      applied = true;
    } else if (Array.isArray(json?.subjectCategoryRollups)) {
      const total = json.subjectCategoryRollups.reduce((s: number, r: { count: number }) => s + (r.count || 0), 0);
      setApiTotalWithoutCategory(total);
    }
    if (Array.isArray(json?.dimensionRollups)) {
      setApiDimensionRollups(json.dimensionRollups);
      applied = true;
    }
    return applied;
  }, [state.inspectionCategories]);

  const applyBootstrapStatsFallback = React.useCallback(() => {
    const stats = state.inspectionWorkStats;
    if (!Array.isArray(stats) || stats.length === 0) return false;
    const p = filterQueryRef.current;
    const selectedTp = p.selectedTpId && p.selectedTpId !== 'all' ? p.selectedTpId : '';
    const selectedDistrict = p.selectedDistrictId && p.selectedDistrictId !== 'all' ? p.selectedDistrictId : '';
    const selectedZone = p.selectedZoneId && p.selectedZoneId !== 'all' ? p.selectedZoneId : '';
    const tpId = selectedTp || userTpId || null;
    const districtId = selectedTp ? null : selectedDistrict || userDistrictId || null;
    const zoneId = selectedTp || selectedDistrict ? null : selectedZone || userZoneId || null;
    const masters = {
      districts: state.districts || [],
      zones: state.zones || [],
      townPanchayats: state.townPanchayats || [],
      inspectionSubjects: state.inspectionSubjects || [],
      inspectionCategories: state.inspectionCategories || [],
    };
    let scoped = filterDashboardStatsForScope(stats, masters, {
      unrestricted: !tpId && !districtId && !zoneId,
      tpId,
      districtId,
      zoneId,
    });
    if (p.selectedSubjectId && p.selectedSubjectId !== 'all') {
      scoped = scoped.filter((row) => workMatchesSubject(row, p.selectedSubjectId, masters));
    }
    if (p.selectedCategoryId && p.selectedCategoryId !== 'all') {
      scoped = scoped.filter((row) => workMatchesCategory(row, p.selectedCategoryId, masters));
    }
    const rollups = buildSubjectCategoryRollupsFromDashboardStats(scoped);
    if (!rollups.length) {
      setApiSubjectRollups([]);
      setApiDimensionRollups([]);
      setApiTotalWithoutCategory(0);
      setApiCategoryCounts({});
      return false;
    }
    setApiSubjectRollups(rollups);
    setApiDimensionRollups([]);
    const total = rollups.reduce((s, r) => s + r.count, 0);
    setApiTotalWithoutCategory(total);
    setApiCategoryCounts(categoryCountsFromSubjectRollups(rollups, state.inspectionCategories || []));
    return true;
  }, [
    state.inspectionWorkStats,
    state.inspectionCategories,
    state.inspectionSubjects,
    state.districts,
    state.zones,
    state.townPanchayats,
    userTpId,
    userDistrictId,
    userZoneId,
  ]);

  const fetchReportRowsPage = React.useCallback(
    async (page: number, seq: number) => {
      const res = await fetch(
        `/api/inspection-works?${buildInspectionWorksQueryParams({
          reportsBundle: true,
          page,
          pageSize: REPORTS_SERVER_PAGE_SIZE,
        }).toString()}`,
        { cache: 'no-store' }
      );
      if (seq !== fetchSeqRef.current) return;
      const json = await res.json().catch(() => ({}));
      const works = extractWorksFromInspectionApiPayload(json);
      if (res.ok && json.success !== false && Array.isArray(works)) {
        setFetchedWorks(works);
        if (typeof json.total === 'number') setApiWorksTotal(json.total);
        else setApiWorksTotal(works.length);
        if (json.categoryCounts && typeof json.categoryCounts === 'object') {
          setApiCategoryCounts(json.categoryCounts);
        }
        if (typeof json.totalWithoutCategoryFilter === 'number') {
          setApiTotalWithoutCategory(json.totalWithoutCategoryFilter);
        }
        if (Array.isArray(json.subjectCategoryRollups)) {
          setApiSubjectRollups(json.subjectCategoryRollups);
        }
        if (Array.isArray(json.dimensionRollups)) {
          setApiDimensionRollups(json.dimensionRollups);
        }
        setLastRefreshed(new Date().toLocaleTimeString());
        if (seq === fetchSeqRef.current) setFetchError(null);
      } else if (!res.ok && seq === fetchSeqRef.current) {
        setFetchError(json?.message || (lang === 'ta' ? 'தரவு பெற முடியவில்லை' : 'Could not load inspection works'));
      }
    },
    [buildInspectionWorksQueryParams, lang]
  );

  const fetchRowsOnlyPage = React.useCallback(
    async (page: number, pageSize: number) => {
      const res = await fetch(
        `/api/inspection-works?${buildInspectionWorksQueryParams({
          rowsOnly: true,
          page,
          pageSize,
        }).toString()}`,
        { cache: 'no-store' }
      );
      const json = await res.json().catch(() => ({}));
      const works = extractWorksFromInspectionApiPayload(json);
      return {
        ok: res.ok && json.success !== false,
        works: Array.isArray(works) ? works : [],
        total: typeof json.total === 'number' ? json.total : (Array.isArray(works) ? works.length : 0),
      };
    },
    [buildInspectionWorksQueryParams]
  );

  const requestInspectionWorks = React.useCallback(async () => {
    if (embedMode && fetchedWorksRef.current == null) {
      applyBootstrapStatsFallback();
    }
    const seq = ++fetchSeqRef.current;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    const countsOnly = embedMode && (activeTab === 'abstract' || !activeTab);
    try {
      const bundleUrl = `/api/inspection-works?${buildInspectionWorksQueryParams({
        countsOnly,
        reportsBundle: !countsOnly,
        page: 1,
        pageSize: REPORTS_SERVER_PAGE_SIZE,
      }).toString()}`;
      const res = await fetch(bundleUrl, { cache: 'no-store' });
      if (seq !== fetchSeqRef.current) return;

      const json = await res.json().catch(() => ({}));
      const works = extractWorksFromInspectionApiPayload(json);
      if (res.ok && json.success !== false) {
        if (!countsOnly && Array.isArray(works)) {
          setFetchedWorks(works);
          if (typeof json.total === 'number') setApiWorksTotal(json.total);
          else setApiWorksTotal(works.length);
        } else if (countsOnly) {
          setFetchedWorks([]);
          if (typeof json.totalWithoutCategoryFilter === 'number') {
            setApiWorksTotal(json.totalWithoutCategoryFilter);
          }
        }
        applyCountsPayload(json);
        if (Array.isArray(json.subjectCategoryRollups)) {
          setApiSubjectRollups(json.subjectCategoryRollups);
        }
        if (typeof json.totalWithoutCategoryFilter === 'number') {
          setApiTotalWithoutCategory(json.totalWithoutCategoryFilter);
        }
        if (Array.isArray(json.dimensionRollups)) {
          setApiDimensionRollups(json.dimensionRollups);
        }
        setLastRefreshed(new Date().toLocaleTimeString());
        if (seq === fetchSeqRef.current) setFetchError(null);
      } else if (!res.ok) {
        console.warn('Inspection works fetch failed:', res.status, json?.message || '');
        if (seq === fetchSeqRef.current) {
          setFetchError(json?.message || (lang === 'ta' ? 'தரவு பெற முடியவில்லை' : 'Could not load inspection works'));
        }
      } else if (json.success === false && seq === fetchSeqRef.current) {
        setFetchError(json?.message || (lang === 'ta' ? 'தரவு இல்லை' : 'No data returned'));
      }
    } catch (err) {
      console.warn('Instant view fetch error:', err);
      if (seq === fetchSeqRef.current) {
        setFetchError(lang === 'ta' ? 'பிணையம் / சேவையகப் பிழை' : 'Network or server error while loading works');
      }
    } finally {
      if (seq === fetchSeqRef.current) {
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    }
  }, [
    activeTab,
    lang,
    buildInspectionWorksQueryParams,
    embedMode,
    applyBootstrapStatsFallback,
    applyCountsPayload,
  ]);

  // Hydrate abstract/category stats from bootstrap until the reports API returns.
  useEffect(() => {
    if (fetchedWorks !== null) return;
    applyBootstrapStatsFallback();
  }, [state.inspectionWorkStats, applyBootstrapStatsFallback, fetchedWorks]);

  const applyFiltersAndLoad = React.useCallback((opts?: { refreshRemote?: boolean }) => {
    if (opts?.refreshRemote) refreshRemoteOnFetchRef.current = true;
    setFiltersLoadToken((t) => t + 1);
  }, []);

  const handleResetFilters = React.useCallback(() => {
    const swmMode = reportModule === 'swm';
    setSelectedSubjectId(swmMode ? swmSubjectId : 'all');
    setSelectedCategoryId(swmMode ? swmDoorToDoorCategoryId : 'all');
    setSelectedZoneId(userZoneId || 'all');
    setSelectedDistrictId(userDistrictId || 'all');
    setSelectedTpId(userTpId || 'all');
    setSelectedWard('all');
    setSelectedStreetName('all');
    setSearchQuery('');
    setAdminFilterFieldId('');
    setAdminFilterValue('');
    setFromDate(getTodayYmd());
    setToDate(getTodayYmd());
    setUserCols({ subject: false, category: false });
    setLocCols({
      district: false,
      tp: false,
      ward: false,
      street: false,
      subject: false,
      category: false
    });
    setSwmWardCol(false);
    setSwmStreetCol(false);
    setSwmBuildingType('all');
    queueMicrotask(() => applyFiltersAndLoad());
  }, [applyFiltersAndLoad, reportModule, swmDoorToDoorCategoryId, swmSubjectId, userDistrictId, userTpId, userZoneId]);

  const switchReportModule = React.useCallback((next: 'inspection' | 'swm') => {
    if (next === reportModule) return;
    setReportModule(next);
    if (next === 'swm') {
      setSwmSummaryGroups([]);
      setSelectedSubjectId(swmSubjectId);
      setSelectedCategoryId(swmDoorToDoorCategoryId);
      setSelectedWard('all');
      setSelectedStreetName('all');
      setSearchQuery('');
      setAdminFilterFieldId('');
      setAdminFilterValue('');
      setActiveTab('abstract');
      filterQueryRef.current = {
        ...filterQueryRef.current,
        selectedSubjectId: swmSubjectId,
        selectedCategoryId: swmDoorToDoorCategoryId,
        selectedWard: 'all',
        selectedStreetName: 'all',
        searchQuery: '',
        adminFilterFieldId: '',
        adminFilterValue: '',
      };
    } else {
      const nextSubject = String(selectedSubjectId).toLowerCase() === String(swmSubjectId).toLowerCase() ? 'all' : selectedSubjectId;
      setSelectedSubjectId(nextSubject);
      if (nextSubject === 'all') setSelectedCategoryId('all');
      setFromDate(getTodayYmd());
      setToDate(getTodayYmd());
      filterQueryRef.current = {
        ...filterQueryRef.current,
        selectedSubjectId: nextSubject,
        selectedCategoryId: nextSubject === 'all' ? 'all' : filterQueryRef.current.selectedCategoryId,
        fromDate: getTodayYmd(),
        toDate: getTodayYmd(),
      };
    }
    queueMicrotask(() => applyFiltersAndLoad());
  }, [applyFiltersAndLoad, reportModule, selectedSubjectId, swmDoorToDoorCategoryId, swmSubjectId]);

  useEffect(() => {
    if (!forcedReportModule || forcedReportModule === reportModule) return;
    switchReportModule(forcedReportModule);
  }, [forcedReportModule, reportModule, switchReportModule]);

  useEffect(() => {
    if (reportModule !== 'swm') return;
    if (activeTab !== 'abstract' && activeTab !== 'tp') setActiveTab('abstract');
  }, [activeTab, reportModule]);

  useEffect(() => {
    if (!onFilterActionsReady) return;
    onFilterActionsReady({
      apply: () => applyFiltersAndLoad({ refreshRemote: true }),
      reset: handleResetFilters,
      isRefreshing,
      fetchError,
    });
  }, [applyFiltersAndLoad, fetchError, handleResetFilters, isRefreshing, onFilterActionsReady]);

  const detailedPageFetchSkipRef = React.useRef(false);

  useEffect(() => {
    if (filtersLoadToken === 0) return;
    if (reportModule === 'swm' && (activeTab === 'abstract' || activeTab === 'tp')) return;
    detailedPageFetchSkipRef.current = true;
    void requestInspectionWorks();
  }, [activeTab, filtersLoadToken, reportModule, requestInspectionWorks]);

  useEffect(() => {
    if (filtersLoadToken === 0 || detailedPage <= 1) return;
    if (detailedPageFetchSkipRef.current) {
      detailedPageFetchSkipRef.current = false;
      return;
    }
    const seq = ++fetchSeqRef.current;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    void fetchReportRowsPage(detailedPage, seq).finally(() => {
      if (seq === fetchSeqRef.current) {
        setIsRefreshing(false);
        isFetchingRef.current = false;
      }
    });
  }, [detailedPage, filtersLoadToken, fetchReportRowsPage]);

  useEffect(() => {
    if (embedMode) return;
    const onReportsRefresh = () => {
      applyFiltersAndLoad();
    };
    window.addEventListener('portal:inspection-reports-refresh', onReportsRefresh);
    return () => window.removeEventListener('portal:inspection-reports-refresh', onReportsRefresh);
  }, [embedMode, applyFiltersAndLoad]);

  // Apply restricted scope to filter dropdowns (does not fetch)
  useEffect(() => {
    if (userZoneId) setSelectedZoneId(userZoneId);
    if (userDistrictId) setSelectedDistrictId(userDistrictId);
    if (userTpId) setSelectedTpId(userTpId);
  }, [userZoneId, userDistrictId, userTpId]);

  // Auto-load when portal masters / user scope are ready (bootstrap often arrives after first paint)
  useEffect(() => {
    const mastersReady =
      isAdminOrDirector ||
      (state.townPanchayats?.length ?? 0) > 0 ||
      (state.zones?.length ?? 0) > 0;
    if (!mastersReady) return;

    const loadKey = [
      embedMode ? 'embed' : 'reports',
      isAdminOrDirector ? 'admin' : 'scoped',
      userTpId || '',
      userZoneId || '',
      userDistrictId || '',
      state.townPanchayats?.length ?? 0,
      embedMode ? 'stats' : '',
    ].join('|');
    if (lastAutoLoadKeyRef.current === loadKey) return;
    lastAutoLoadKeyRef.current = loadKey;

    if (embedMode && fetchedWorksRef.current == null) {
      queueMicrotask(() => applyBootstrapStatsFallback());
    }
    queueMicrotask(() => applyFiltersAndLoad());
  }, [
    embedMode,
    isAdminOrDirector,
    userTpId,
    userZoneId,
    userDistrictId,
    state.townPanchayats?.length,
    state.zones?.length,
    applyFiltersAndLoad,
    applyBootstrapStatsFallback,
  ]);

  // Reset pages and reload when filters change (debounced so cascading dropdowns settle).
  const filterLoadSkipRef = React.useRef(true);
  useEffect(() => {
    setAbstractPage(1);
    setDetailedPage(1);
    if (filterLoadSkipRef.current) {
      filterLoadSkipRef.current = false;
      return;
    }
    if (skipFilterDebounceRef.current) {
      skipFilterDebounceRef.current = false;
      return;
    }
    const t = window.setTimeout(() => applyFiltersAndLoad(), 400);
    return () => window.clearTimeout(t);
  }, [
    selectedSubjectId,
    selectedCategoryId,
    selectedTpId,
    selectedWard,
    selectedZoneId,
    selectedDistrictId,
    selectedStreetName,
    fromDate,
    toDate,
    searchQuery,
    adminFilterFieldId,
    adminFilterValue,
    embedMode,
    applyFiltersAndLoad,
  ]);

  const filterMasters = useMemo(
    () => ({
      inspectionSubjects: state.inspectionSubjects || [],
      inspectionCategories: state.inspectionCategories || [],
      zones: state.zones || [],
      districts: state.districts || [],
      townPanchayats: state.townPanchayats || [],
    }),
    [state.inspectionSubjects, state.inspectionCategories, state.zones, state.districts, state.townPanchayats]
  );

  // Rows from API (primary filters server-side) + client guard for dynamic field filter/columns
  const filteredWorks = useMemo(() => {
    let list = rawWorks;
    if (selectedZoneId && selectedZoneId !== 'all') {
      list = list.filter((w: any) => workMatchesZone(w, selectedZoneId, filterMasters));
    }
    if (selectedDistrictId && selectedDistrictId !== 'all') {
      list = list.filter((w: any) => workMatchesDistrict(w, selectedDistrictId, filterMasters));
    }
    if (selectedTpId && selectedTpId !== 'all') {
      list = list.filter((w: any) => workMatchesTp(w, selectedTpId, filterMasters));
    }
    if (adminFilterFieldId && !worksFromApi) {
      list = list.filter((w: any) => {
        const val = getWorkDynamicFieldValue(w, adminFilterFieldId, state.inspectionFields || []);
        if (!adminFilterValue) return !!String(val).trim();
        return storedValueMatchesAdminFilter(val, adminFilterValue);
      });
    }

    const sorted = [...list].sort((a: any, b: any) => {
      let valA: any = '';
      let valB: any = '';
      if (detailedSortField === 'submittedAt') {
        const dateA = safeParseDate(a.submittedAt || a.createdAt || a.date || a.inspectionDate);
        const dateB = safeParseDate(b.submittedAt || b.createdAt || b.date || b.inspectionDate);
        const timeA = dateA ? dateA.getTime() : 0;
        const timeB = dateB ? dateB.getTime() : 0;
        if (timeA !== timeB) {
          return detailedSortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
        const idA = String(a._id || a.workId || a.id || '');
        const idB = String(b._id || b.workId || b.id || '');
        const idCmp = idB.localeCompare(idA);
        return detailedSortDirection === 'asc' ? -idCmp : idCmp;
      } else if (detailedSortField === 'workId') {
        valA = a.workId || a.id || '';
        valB = b.workId || b.id || '';
      } else if (detailedSortField === 'subject') {
        valA = lang === 'ta' ? (a.subjectNameTa || a.subjectNameEn || '') : (a.subjectNameEn || a.subjectNameTa || '');
        valB = lang === 'ta' ? (b.subjectNameTa || b.subjectNameEn || '') : (b.subjectNameEn || b.subjectNameTa || '');
      } else if (detailedSortField === 'category') {
        valA = lang === 'ta' ? (a.categoryNameTa || a.categoryNameEn || '') : (a.categoryNameEn || a.categoryNameTa || '');
        valB = lang === 'ta' ? (b.categoryNameTa || b.categoryNameEn || '') : (b.categoryNameEn || b.categoryNameTa || '');
      } else if (detailedSortField === 'ward') {
        const numA = parseInt(String(a.wardNumber || a.wardNo || a.ward || '').replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(String(b.wardNumber || b.wardNo || b.ward || '').replace(/\D/g, ''), 10) || 0;
        return detailedSortDirection === 'asc' ? numA - numB : numB - numA;
      } else if (detailedSortField === 'street') {
        valA = a.streetName || a.street || '';
        valB = b.streetName || b.street || '';
      } else if (detailedSortField === 'username') {
        valA = a.submittedByUserName || a.username || '';
        valB = b.submittedByUserName || b.username || '';
      } else if (detailedSortField === 'designation') {
        valA = a.submittedByDesignation || a.designation || '';
        valB = b.submittedByDesignation || b.designation || '';
      } else if (detailedSortField === 'gps') {
        valA = a.latitude && a.longitude ? `${Number(a.latitude).toFixed(4)},${Number(a.longitude).toFixed(4)}` : '';
        valB = b.latitude && b.longitude ? `${Number(b.latitude).toFixed(4)},${Number(b.longitude).toFixed(4)}` : '';
      } else if (detailedSortField === 'fieldsData') {
        valA = a.fieldsData ? JSON.stringify(a.fieldsData) : '';
        valB = b.fieldsData ? JSON.stringify(b.fieldsData) : '';
      }

      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: 'base' });
      return detailedSortDirection === 'asc' ? cmp : -cmp;
    });

    return sorted;
  }, [
    rawWorks,
    worksFromApi,
    selectedZoneId,
    selectedDistrictId,
    selectedTpId,
    filterMasters,
    adminFilterFieldId,
    adminFilterValue,
    state.inspectionFields,
    detailedSortField,
    detailedSortDirection,
    lang,
  ]);

  const resolveCategoryCountFromApi = React.useCallback(
    (cat: any) => {
      const id = String(cat.id || '').trim();
      const name = String(cat.nameEn || '').trim().toLowerCase();
      const code = String(cat.code || '').trim().toLowerCase();
      if (id && apiCategoryCounts[id] != null) return apiCategoryCounts[id];
      if (code && apiCategoryCounts[code] != null) return apiCategoryCounts[code];
      if (name && apiCategoryCounts[name] != null) return apiCategoryCounts[name];
      const fromApi = Object.entries(apiCategoryCounts).reduce((sum, [key, n]) => {
        const k = key.toLowerCase();
        if (k === id.toLowerCase() || k === name || k === code) return sum + n;
        return sum;
      }, 0);
      if (fromApi > 0) return fromApi;
      const masters = {
        inspectionSubjects: state.inspectionSubjects || [],
        inspectionCategories: state.inspectionCategories || [],
      };
      return apiSubjectRollups
        .filter((row) => workMatchesCategory({ categoryId: row.categoryId }, id || name || code, masters))
        .reduce((sum, row) => sum + (row.count || 0), 0);
    },
    [apiCategoryCounts, apiSubjectRollups, state.inspectionSubjects, state.inspectionCategories]
  );

  // Paginated detailed works (server page when loaded from API)
  const paginatedDetailedWorks = useMemo(() => {
    if (worksFromApi) return filteredWorks;
    const startIndex = (detailedPage - 1) * 50;
    return filteredWorks.slice(startIndex, startIndex + 50);
  }, [filteredWorks, detailedPage, worksFromApi, apiWorksTotal]);

  const detailedTotalPages = useMemo(() => {
    if (worksFromApi) {
      return Math.max(1, Math.ceil((apiWorksTotal || 0) / REPORTS_SERVER_PAGE_SIZE));
    }
    return Math.ceil(filteredWorks.length / 50) || 1;
  }, [worksFromApi, apiWorksTotal, filteredWorks.length]);

  // Zones available from state, filtered by user scope
  const filteredZones = useMemo(() => {
    const list = state.zones || [];
    if (userZoneId) {
      const matched = list.filter((z: any) => 
        String(z.id).toLowerCase() === String(userZoneId).toLowerCase() ||
        String(z.nameEn || '').toLowerCase() === String(userZoneId).toLowerCase()
      );
      if (matched.length > 0) return matched;
      return [{ id: userZoneId, nameEn: userZoneId, nameTa: userZoneId }];
    }
    return list;
  }, [state.zones, userZoneId]);

  // Districts available from state, filtered by selected zone if applicable and restricted by scope
  const availableDistricts = useMemo(() => {
    let list = state.districts || [];
    if (userDistrictId) {
      const matched = list.filter((d: any) => 
        String(d.id).toLowerCase() === String(userDistrictId).toLowerCase() ||
        String(d.nameEn || '').toLowerCase() === String(userDistrictId).toLowerCase()
      );
      if (matched.length > 0) return matched;
      return [{ id: userDistrictId, nameEn: userDistrictId, nameTa: userDistrictId }];
    }
    const effZoneId = userZoneId || selectedZoneId;
    if (effZoneId && effZoneId !== 'all') {
      const sZone = String(effZoneId).toLowerCase();
      const zone = (state.zones || []).find(
        (z: any) =>
          String(z.id || '').toLowerCase() === sZone ||
          String(z.nameEn || '').toLowerCase() === sZone ||
          String(z.nameTa || '').toLowerCase() === sZone ||
          String(z.code || '').toLowerCase() === sZone
      );
      const zoneKeys = new Set(
        [sZone, zone?.id, zone?.nameEn, zone?.nameTa, zone?.code]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
      );
      list = list.filter((d: any) => {
        const dZone = String(d.zoneId || '').toLowerCase();
        const dZoneName = String(d.zoneNameEn || '').toLowerCase();
        return (dZone && zoneKeys.has(dZone)) || (dZoneName && zoneKeys.has(dZoneName));
      });
    }
    return list;
  }, [state.districts, state.zones, selectedZoneId, userZoneId, userDistrictId]);

  // Town Panchayats available from state, filtered by selected district and zone and restricted by scope
  const availableTownPanchayats = useMemo(() => {
    let list = state.townPanchayats || [];
    if (userTpId) {
      const matched = list.filter((tp: any) => 
        String(tp.id).toLowerCase() === String(userTpId).toLowerCase() ||
        String(tp.nameEn || '').toLowerCase() === String(userTpId).toLowerCase()
      );
      if (matched.length > 0) return matched;

      // Clean fallback name mapping for demo EO / Arani / csv town panchayat IDs (extremely robust to prevent tp_csv_36u9 showing on refresh)
      const isAraniLike = String(currentUser?.username).toLowerCase().includes('eo') || 
                          String(currentUser?.username).toLowerCase().includes('arani') || 
                          String(userTpId).toLowerCase().includes('arani') || 
                          String(userTpId).toLowerCase().includes('36u9');
      const fallbackNameEn = currentUser?.townPanchayat || currentUser?.tpName || (isAraniLike ? 'Arani' : userTpId);
      const fallbackNameTa = currentUser?.townPanchayatTa || currentUser?.tpNameTa || (isAraniLike ? 'ஆரணி' : fallbackNameEn);

      const cleanLabelEn = (String(fallbackNameEn).startsWith('tp_') || String(userTpId).startsWith('tp_csv_') || String(userTpId).includes('36u9')) 
        ? (currentUser?.townPanchayat || 'Arani') 
        : fallbackNameEn;
      const cleanLabelTa = (String(fallbackNameTa).startsWith('tp_') || String(userTpId).startsWith('tp_csv_') || String(userTpId).includes('36u9')) 
        ? (currentUser?.townPanchayatTa || 'ஆரணி') 
        : fallbackNameTa;

      return [{ id: userTpId, nameEn: cleanLabelEn, nameTa: cleanLabelTa }];
    }
    if (selectedDistrictId !== 'all') {
      const sDist = String(selectedDistrictId).toLowerCase();
      const dist = (state.districts || []).find(
        (d: any) =>
          String(d.id || '').toLowerCase() === sDist ||
          geoNamesEqual(d.nameEn, selectedDistrictId) ||
          geoNamesEqual(d.nameTa, selectedDistrictId)
      );
      list = list.filter((tp: any) =>
        String(tp.districtId || '').toLowerCase() === sDist ||
        String(tp.districtId || '').toLowerCase() === String(dist?.id || '').toLowerCase() ||
        geoNamesEqual(tp.districtNameEn, dist?.nameEn) ||
        geoNamesEqual(tp.districtNameEn, selectedDistrictId)
      );
    } else {
      const effZoneId = userZoneId || selectedZoneId;
      if (effZoneId && effZoneId !== 'all') {
        const sZone = String(effZoneId).toLowerCase();
        const zone = (state.zones || []).find(
          (z: any) =>
            String(z.id || '').toLowerCase() === sZone ||
            String(z.nameEn || '').toLowerCase() === sZone ||
            String(z.nameTa || '').toLowerCase() === sZone ||
            String(z.code || '').toLowerCase() === sZone
        );
        const zoneKeys = new Set(
          [sZone, zone?.id, zone?.nameEn, zone?.nameTa, zone?.code]
            .filter(Boolean)
            .map((v) => String(v).toLowerCase())
        );
        list = list.filter((tp: any) => {
          const tpZone = String(tp.zoneId || '').toLowerCase();
          const tpZoneName = String(tp.zoneNameEn || '').toLowerCase();
          if ((tpZone && zoneKeys.has(tpZone)) || (tpZoneName && zoneKeys.has(tpZoneName))) return true;
          const dist = (state.districts || []).find((d: any) => 
            String(d.id).toLowerCase() === String(tp.districtId || '').toLowerCase() ||
            String(d.nameEn || '').toLowerCase() === String(tp.districtNameEn || '').toLowerCase()
          );
          if (!dist) return false;
          const dZone = String(dist.zoneId || '').toLowerCase();
          const dZoneName = String(dist.zoneNameEn || '').toLowerCase();
          return (dZone && zoneKeys.has(dZone)) || (dZoneName && zoneKeys.has(dZoneName));
        });
      }
    }
    return list;
  }, [state.townPanchayats, state.districts, state.zones, selectedDistrictId, selectedZoneId, userZoneId, userTpId]);

  // Wards available from state, filtered strictly by selected town panchayat if applicable
  const availableWards = useMemo(() => {
    const set = new Set<string>();
    const effectiveTpId = userTpId || (selectedTpId !== 'all' ? selectedTpId : '');
    if (effectiveTpId) {
      const activeTp = (state.townPanchayats || []).find((t: any) => 
        String(t.id).toLowerCase() === String(effectiveTpId).toLowerCase() || 
        String(t.nameEn || '').toLowerCase() === String(effectiveTpId).toLowerCase() ||
        String(t.nameTa || '').toLowerCase() === String(effectiveTpId).toLowerCase()
      );
      const activeTpIdLower = String(activeTp?.id || effectiveTpId).toLowerCase().trim();
      const activeTpNameEnLower = String(activeTp?.nameEn || '').toLowerCase().trim();
      const activeTpNameTaLower = String(activeTp?.nameTa || '').toLowerCase().trim();

      (state.wardsAndStreets || []).forEach((w: any) => {
        const wsTp = String(w.tpId || w.townPanchayatId || '').toLowerCase().trim();
        const wsTpNameEn = String(w.tpNameEn || w.tpName || '').toLowerCase().trim();
        const wsTpNameTa = String(w.tpNameTa || '').toLowerCase().trim();
        const matchTp = (
          (wsTp && wsTp === activeTpIdLower) ||
          (activeTpNameEnLower && wsTpNameEn && wsTpNameEn === activeTpNameEnLower) ||
          (activeTpNameTaLower && wsTpNameTa && wsTpNameTa === activeTpNameTaLower)
        );
        if (matchTp) {
          const wNo = w.wardNumber || w.wardNo;
          if (wNo) {
            set.add(String(wNo).trim().replace(/^0+/, '') || '0');
          }
        }
      });

      // Also extract wards from inspection works of this specific Town Panchayat
      (rawWorks || []).forEach((w: any) => {
        const wTp = String(w.tpId || w.tpCode || '').toLowerCase().trim();
        const wTpName = String(w.tpNameEn || '').toLowerCase().trim();
        const matchTp =
          (wTp && wTp === activeTpIdLower) ||
          (activeTpNameEnLower && wTpName && wTpName === activeTpNameEnLower);
        if (matchTp) {
          const wNo = w.wardNumber || w.wardNo;
          if (wNo) {
            set.add(String(wNo).trim().replace(/^0+/, '') || '0');
          }
        }
      });
    } else {
      for (let i = 1; i <= 15; i++) set.add(String(i));
    }

    if (set.size === 0) {
      for (let i = 1; i <= 15; i++) {
        set.add(String(i));
      }
    }
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [state.wardsAndStreets, state.townPanchayats, selectedTpId, userTpId, rawWorks]);

  // Requirement 2: when selecting ward, only show street names belonging to the selected Town Panchayat
  const availableStreets = useMemo(() => {
    const set = new Set<string>();

    // 1. Identify active Town Panchayat (either from user restriction or currently selected TP)
    const effectiveTpId = userTpId || (selectedTpId !== 'all' ? selectedTpId : '');
    if (!effectiveTpId) {
      // If no town panchayat is selected, do NOT mix streets from all other town panchayats
      return [];
    }

    // 2. Resolve matching Town Panchayat entity
    const matchedTp = (state.townPanchayats || []).find((t: any) => 
      String(t.id).toLowerCase() === String(effectiveTpId).toLowerCase() || 
      String(t.nameEn || '').toLowerCase() === String(effectiveTpId).toLowerCase() ||
      String(t.nameTa || '').toLowerCase() === String(effectiveTpId).toLowerCase()
    );
    const targetTpId = String(matchedTp?.id || effectiveTpId).toLowerCase().trim();
    const targetTpNameEn = String(matchedTp?.nameEn || '').toLowerCase().trim();
    const targetTpNameTa = String(matchedTp?.nameTa || '').toLowerCase().trim();

    const normSelWard = String(selectedWard || '').trim().replace(/^0+/, '');

    // 3. Search wardsAndStreets collection strictly for this selected Town Panchayat
    (state.wardsAndStreets || []).forEach((ws: any) => {
      const wsTpId = String(ws.tpId || ws.townPanchayatId || '').toLowerCase().trim();
      const wsTpNameEn = String(ws.tpNameEn || ws.tpName || '').toLowerCase().trim();
      const wsTpNameTa = String(ws.tpNameTa || '').toLowerCase().trim();

      // Must strictly match the selected Town Panchayat
      const matchTp = (
        (wsTpId && wsTpId === targetTpId) ||
        (targetTpNameEn && wsTpNameEn && wsTpNameEn === targetTpNameEn) ||
        (targetTpNameTa && wsTpNameTa && wsTpNameTa === targetTpNameTa)
      );

      if (!matchTp) return;

      const normWsWard = String(ws.wardNo || ws.wardNumber || '').trim().replace(/^0+/, '');
      const matchWard = selectedWard === 'all' || (normWsWard && normWsWard === normSelWard);

      if (matchWard) {
        const street = ws.streetNameEn || ws.streetName || ws.streetNameTa;
        if (street && String(street).trim()) {
          set.add(String(street).trim());
        }
      }
    });

    // 4. Also search actual inspection works for this selected Town Panchayat & Ward
    (rawWorks || []).forEach((w: any) => {
      const wTpId = String(w.tpId || '').toLowerCase().trim();
      const wTpNameEn = String(w.tpNameEn || '').toLowerCase().trim();

      const matchTp = (
        (wTpId && wTpId === targetTpId) ||
        (targetTpNameEn && wTpNameEn && wTpNameEn === targetTpNameEn)
      );

      if (!matchTp) return;

      const normWorkWard = String(w.wardNumber || w.wardNo || '').trim().replace(/^0+/, '');
      const matchWard = selectedWard === 'all' || (normWorkWard && normWorkWard === normSelWard);

      if (matchWard && w.streetName && String(w.streetName).trim()) {
        set.add(String(w.streetName).trim());
      }
    });

    return Array.from(set).sort();
  }, [state.wardsAndStreets, state.townPanchayats, selectedTpId, userTpId, selectedWard, rawWorks]);

  // Default to showing all subjects as requested by the user, instead of auto-selecting the first one.

  // Categories belonging to selected subject (or all if all selected)
  const categoriesInSelectedSubject = useMemo(() => {
    return availableCategories;
  }, [availableCategories]);

  // All inspection users for 0-entry reporting
  const allInspectionUsers = useMemo(() => {
    return state.inspectionUsers || state.users || [];
  }, [state.inspectionUsers, state.users]);

  // Filtered users by zone, district, town panchayat
  const matchedFilterUsers = useMemo(() => {
    return allInspectionUsers.filter((user: any) => {
      if (selectedZoneId !== 'all' && user.zoneId !== selectedZoneId) return false;
      if (selectedDistrictId !== 'all' && user.districtId !== selectedDistrictId) return false;
      if (selectedTpId !== 'all') {
        const userTpIds = user.townPanchayatIds || user.selectedTpIds || (user.tpId ? [user.tpId] : []);
        if (!userTpIds.includes(selectedTpId)) return false;
      }
      return true;
    });
  }, [allInspectionUsers, selectedZoneId, selectedDistrictId, selectedTpId]);

  // 0-Entry Users list (Not Entered Single Entry User List) with Zone, District, TP, and Last Work Entry
  const zeroEntryUsers = useMemo(() => {
    const enteredNames = new Set<string>();
    if (worksFromApi) {
      for (const row of apiDimensionRollups) {
        if (selectedSubjectId !== 'all' && !workMatchesSubject({ subjectId: row.subjectId }, selectedSubjectId, {
          inspectionSubjects: state.inspectionSubjects || [],
          inspectionCategories: state.inspectionCategories || [],
        })) continue;
        if (selectedCategoryId !== 'all' && !workMatchesCategory({ categoryId: row.categoryId }, selectedCategoryId, {
          inspectionSubjects: state.inspectionSubjects || [],
          inspectionCategories: state.inspectionCategories || [],
        })) continue;
        const name = String(row.submittedByUserName || '').toLowerCase().trim();
        if (name) enteredNames.add(name);
      }
    }
    const list = matchedFilterUsers.filter((user: any) => {
      if (worksFromApi) {
        const names = [user.nameEn, user.username, user.id].map((v: any) => String(v || '').toLowerCase().trim()).filter(Boolean);
        return !names.some((n: string) => enteredNames.has(n));
      }
      const count = filteredWorks.filter(w => 
        w.submittedByUserId === user.id || 
        w.submittedByUserId === user.username ||
        (w.submittedByUserName && user.nameEn && w.submittedByUserName.toLowerCase() === user.nameEn.toLowerCase())
      ).length;
      return count === 0;
    });

    const allHistoricalWorks = fetchedWorks !== null ? fetchedWorks : (state.inspectionWorks || []);

    return list.map((user: any) => {
      // Find designation
      const desigObj = (state.inspectionDesignations || state.designations || []).find((d: any) => d.id === user.designationId);
      const roleObj = (state.inspectionRoles || []).find((r: any) => r.id === user.roleId);
      const userDesig = desigObj 
        ? (lang === 'ta' ? (desigObj.nameTa || desigObj.nameEn) : desigObj.nameEn)
        : (user.designation || (roleObj ? (lang === 'ta' ? roleObj.nameTa || roleObj.nameEn : roleObj.nameEn) : (lang === 'ta' ? 'கள பணியாளர்' : 'Field Worker')));

      // Find Town Panchayat(s)
      const userTpIds = user.townPanchayatIds || user.selectedTpIds || (user.tpId ? [user.tpId] : []);
      const matchedTps = (state.townPanchayats || []).filter((tp: any) => userTpIds.includes(tp.id));
      const tpNameEn = matchedTps.map((t: any) => t.nameEn).join(', ') || user.tpNameEn || '-';
      const tpNameTa = matchedTps.map((t: any) => t.nameTa || t.nameEn).join(', ') || user.tpNameTa || tpNameEn;

      // Find District
      let distObj = (state.districts || []).find((d: any) => d.id === user.districtId);
      if (!distObj && matchedTps.length > 0 && matchedTps[0].districtId) {
        distObj = (state.districts || []).find((d: any) => d.id === matchedTps[0].districtId);
      }
      const districtNameEn = distObj ? distObj.nameEn : (user.districtNameEn || '-');
      const districtNameTa = distObj ? (distObj.nameTa || distObj.nameEn) : (user.districtNameTa || districtNameEn);

      // Find Zone
      let zoneObj = (state.zones || []).find((z: any) => z.id === user.zoneId);
      if (!zoneObj && distObj && distObj.zoneId) {
        zoneObj = (state.zones || []).find((z: any) => z.id === distObj.zoneId);
      }
      const zoneNameEn = zoneObj ? zoneObj.nameEn : (user.zoneNameEn || '-');
      const zoneNameTa = zoneObj ? (zoneObj.nameTa || zoneObj.nameEn) : (user.zoneNameTa || zoneNameEn);

      // Find last work entry date & time from all historical works
      const uWorks = allHistoricalWorks.filter((w: any) =>
        w.submittedByUserId === user.id ||
        w.submittedByUserId === user.username ||
        (w.submittedByUserName && user.nameEn && String(w.submittedByUserName).toLowerCase() === String(user.nameEn).toLowerCase())
      );

      let lastWorkEntryRaw: any = null;
      if (uWorks.length > 0) {
        const sortedWorks = [...uWorks].sort((a: any, b: any) => {
          const tA = new Date(a.submittedAt || a.createdAt || a.date || a.inspectionDate || 0).getTime();
          const tB = new Date(b.submittedAt || b.createdAt || b.date || b.inspectionDate || 0).getTime();
          return tB - tA;
        });
        lastWorkEntryRaw = sortedWorks[0].submittedAt || sortedWorks[0].createdAt || sortedWorks[0].date || sortedWorks[0].inspectionDate;
      }

      const lastWorkEntryFormatted = lastWorkEntryRaw
        ? formatIndianTime(lastWorkEntryRaw)
        : (lang === 'ta' ? 'பதிவுகள் ஏதுமில்லை (Never)' : 'No entries (Never)');

      return {
        ...user,
        resolvedDesignation: userDesig,
        zoneNameEn,
        zoneNameTa,
        districtNameEn,
        districtNameTa,
        tpNameEn,
        tpNameTa,
        lastWorkEntry: lastWorkEntryFormatted,
        lastWorkEntryRaw
      };
    });
  }, [matchedFilterUsers, filteredWorks, worksFromApi, apiDimensionRollups, selectedSubjectId, selectedCategoryId, state.inspectionSubjects, state.inspectionCategories, state.inspectionDesignations, state.designations, state.inspectionRoles, state.townPanchayats, state.districts, state.zones, fetchedWorks, state.inspectionWorks, lang]);

  // 0-Entry Categories list (Not Entered Subject & Category List - only created subjects & categories)
  const zeroEntryCategories = useMemo(() => {
    const allSubjects = (state.inspectionSubjects || []).filter((s: any) => {
      const name = String(s.nameEn || s.name || '').trim().toLowerCase();
      return name !== 'general inspection' && name !== 'general' && !name.includes('fallback');
    });
    const allCategories = (state.inspectionCategories || []).filter((c: any) => {
      const name = String(c.nameEn || c.name || '').trim().toLowerCase();
      return name !== 'field check' && name !== 'general category' && name !== 'general inspection' && !name.includes('fallback');
    });
    const list: any[] = [];
    allCategories.forEach((cat: any) => {
      if (selectedSubjectId !== 'all' && cat.subjectId !== selectedSubjectId) return;
      const targetId = String(cat.id || '').trim().toLowerCase();
      const targetName = String(cat.nameEn || '').trim().toLowerCase();
      const masters = {
        inspectionSubjects: state.inspectionSubjects || [],
        inspectionCategories: state.inspectionCategories || [],
      };
      const count = worksFromApi
        ? apiSubjectRollups
            .filter((row) => workMatchesCategory({ categoryId: row.categoryId }, cat.id || cat.nameEn || '', masters))
            .reduce((sum, row) => sum + (row.count || 0), 0)
        : filteredWorks.filter(w => {
            const wCat = String(w.categoryId || '').trim().toLowerCase();
            const wCatName = String(w.categoryNameEn || '').trim().toLowerCase();
            return wCat === targetId || wCatName === targetName;
          }).length;
      if (count === 0) {
        const subj = allSubjects.find((s: any) => s.id === cat.subjectId);
        list.push({
          ...cat,
          subjectNameEn: subj ? subj.nameEn : (allSubjects[0]?.nameEn || ''),
          subjectNameTa: subj ? subj.nameTa : (allSubjects[0]?.nameTa || '')
        });
      }
    });
    return list;
  }, [state.inspectionSubjects, state.inspectionCategories, selectedSubjectId, filteredWorks, worksFromApi, apiSubjectRollups]);

  // Find wards and streets of the town panchayat of the work currently being edited
  const editingTpWardsAndStreets = useMemo(() => {
    if (!editingWork || !editingWork.tpId) return [];
    return (state.wardsAndStreets || []).filter(
      (ws: any) => ws.tpId === editingWork.tpId
    );
  }, [editingWork, state.wardsAndStreets]);

  // Unique list of ward numbers under the town panchayat of the edited work
  const editingTpWardsList = useMemo(() => {
    const set = new Set<string>();
    editingTpWardsAndStreets.forEach((ws: any) => {
      const wNo = ws.wardNo || ws.wardNumber;
      if (wNo) {
        set.add(String(wNo).trim().replace(/^0+/, '') || '0');
      }
    });
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [editingTpWardsAndStreets]);

  // Mapped street names under the edited work's selected ward number and town panchayat
  const editingTpStreetsList = useMemo(() => {
    if (!editingWork) return [];
    const normEditWard = String(editingWork.wardNumber || '').trim().replace(/^0+/, '') || '0';
    return editingTpWardsAndStreets
      .filter((ws: any) => {
        const normWard = String(ws.wardNo || ws.wardNumber || '').trim().replace(/^0+/, '') || '0';
        return normWard === normEditWard;
      })
      .map((ws: any) => ({
        en: ws.streetNameEn || '',
        ta: ws.streetNameTa || ''
      }));
  }, [editingWork, editingTpWardsAndStreets]);

  const filteredApiDimensionRollups = useMemo(() => {
    let rows = apiDimensionRollups;
    if (selectedZoneId !== 'all') {
      rows = rows.filter((row) => workMatchesZone(row, selectedZoneId, filterMasters));
    }
    if (selectedDistrictId !== 'all') {
      rows = rows.filter((row) => workMatchesDistrict(row, selectedDistrictId, filterMasters));
    }
    if (selectedTpId !== 'all') {
      rows = rows.filter((row) => workMatchesTp(row, selectedTpId, filterMasters));
    }
    if (selectedSubjectId !== 'all') {
      rows = rows.filter((row) =>
        workMatchesSubject({ subjectId: row.subjectId }, selectedSubjectId, filterMasters)
      );
    }
    if (selectedCategoryId !== 'all') {
      rows = rows.filter((row) =>
        workMatchesCategory({ categoryId: row.categoryId }, selectedCategoryId, filterMasters)
      );
    }
    return rows;
  }, [
    apiDimensionRollups,
    selectedZoneId,
    selectedDistrictId,
    selectedTpId,
    selectedSubjectId,
    selectedCategoryId,
    filterMasters,
  ]);

  const hasGeoFilter =
    (selectedZoneId && selectedZoneId !== 'all') ||
    (selectedDistrictId && selectedDistrictId !== 'all') ||
    (selectedTpId && selectedTpId !== 'all');

  const filteredApiSubjectRollups = useMemo(() => {
    if (hasGeoFilter) {
      return collapseDimensionRollupsToSubjectCategory(filteredApiDimensionRollups);
    }
    let rows = apiSubjectRollups;
    if (selectedSubjectId !== 'all') {
      rows = rows.filter((row) =>
        workMatchesSubject({ subjectId: row.subjectId }, selectedSubjectId, filterMasters)
      );
    }
    if (selectedCategoryId !== 'all') {
      rows = rows.filter((row) =>
        workMatchesCategory({ categoryId: row.categoryId }, selectedCategoryId, filterMasters)
      );
    }
    return rows;
  }, [
    hasGeoFilter,
    filteredApiDimensionRollups,
    apiSubjectRollups,
    selectedSubjectId,
    selectedCategoryId,
    filterMasters,
  ]);

  const filteredWorksTotal = hasGeoFilter
    ? filteredApiDimensionRollups.reduce((sum, row) => sum + (row.count || 0), 0)
    : worksFromApi
      ? apiWorksTotal
      : filteredWorks.length;

  const slideRecordTotal = worksFromApi
    ? Math.max(Number(filteredWorksTotal) || 0, Number(apiWorksTotal) || 0, filteredWorks.length)
    : filteredWorks.length;

  const fetchAllFilteredWorksForExport = React.useCallback(async () => {
    if (!worksFromApi) return filteredWorks;
    const pageSize = REPORTS_SERVER_PAGE_SIZE;
    const maxRows = 50000;
    const all: any[] = [];
    let page = 1;
    let total = Math.max(slideRecordTotal, 1);
    while (all.length < maxRows) {
      const loaded = await fetchRowsOnlyPage(page, pageSize);
      if (!loaded.ok) break;
      if (loaded.total > 0) total = loaded.total;
      if (!loaded.works.length) break;
      all.push(...loaded.works);
      if (all.length >= total || loaded.works.length < pageSize) break;
      page += 1;
    }
    return all;
  }, [worksFromApi, filteredWorks, slideRecordTotal, fetchRowsOnlyPage]);

  useEffect(() => {
    if (reportModule !== 'swm' || (activeTab !== 'abstract' && activeTab !== 'tp')) return;
    if (filtersLoadToken === 0) return;
    const ac = new AbortController();
    setSwmAbstractLoading(true);

    const load = async () => {
      const swmGroup = activeTab === 'tp' || swmStreetCol ? 'street' : swmWardCol ? 'ward' : 'tp';
      const firstParams = buildInspectionWorksQueryParams();
      firstParams.set('swmReport', '1');
      firstParams.set('swmGroup', swmGroup);
      if (swmBuildingType !== 'all') firstParams.set('swmBuildingType', swmBuildingType);
      const firstRes = await fetch(`/api/inspection-works?${firstParams.toString()}`, {
        cache: 'no-store',
        signal: ac.signal,
      });
      const firstJson = await firstRes.json().catch(() => ({}));
      if (ac.signal.aborted) return;
      if (!firstRes.ok || firstJson.success === false) {
        setFetchError(firstJson?.message || (lang === 'ta' ? 'SWM தரவு பெற முடியவில்லை' : 'Could not load SWM reports'));
        return;
      }
      if (firstJson.swmReport && Array.isArray(firstJson.rows)) {
        setSwmServerRows(firstJson.rows);
        setSwmServerTotals(firstJson.totals || null);
        setSwmServerGroup(firstJson.groupBy === 'ward' || firstJson.groupBy === 'street' ? firstJson.groupBy : 'tp');
        setSwmSummaryGroups([]);
        setFetchError(null);
        return;
      }
      if (firstJson.swmSummary && Array.isArray(firstJson.groups)) {
        setSwmServerRows(null);
        setSwmServerTotals(null);
        setSwmServerGroup('');
        setSwmSummaryGroups(firstJson.groups);
        setFetchError(null);
        return;
      }

      setFetchError(lang === 'ta' ? 'SWM தரவு பெற முடியவில்லை' : 'Could not load SWM reports');
    };

    void load()
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        if (!ac.signal.aborted) {
          setFetchError(lang === 'ta' ? 'பிணையம் / சேவையகப் பிழை' : 'Network or server error while loading SWM reports');
        }
      })
      .finally(() => {
        if (!ac.signal.aborted) setSwmAbstractLoading(false);
      });
    return () => ac.abort();
  }, [
    activeTab,
    buildInspectionWorksQueryParams,
    filtersLoadToken,
    lang,
    reportModule,
    swmBuildingType,
    swmWardCol,
    swmStreetCol,
  ]);

  const currentSlideWork = useMemo(() => {
    const pageSize = REPORTS_SERVER_PAGE_SIZE;
    let work: any = null;
    if (!worksFromApi) {
      work = filteredWorks[detailedSlideIndex] || filteredWorks[0] || null;
    } else {
      const page = Math.floor(detailedSlideIndex / pageSize) + 1;
      const local = detailedSlideIndex % pageSize;
      const cached = slidePageCacheRef.current.get(page);
      work = cached?.[local];
      if (!work && page === detailedPage) work = filteredWorks[local];
      if (!work) work = filteredWorks[local] || null;
    }
    if (
      work &&
      slideWorkFields &&
      (slideWorkFields.id === work.id || slideWorkFields.workId === work.workId) &&
      slideWorkFields.fieldsData
    ) {
      work = { ...work, fieldsData: slideWorkFields.fieldsData };
    }
    if (work) lastSlideWorkRef.current = work;
    return work || lastSlideWorkRef.current;
  }, [
    worksFromApi,
    filteredWorks,
    detailedSlideIndex,
    detailedPage,
    slideCacheTick,
    slideWorkFields,
  ]);

  const openSlideAtGlobalIndex = React.useCallback(
    (globalIndex: number) => {
      slideCacheGenRef.current += 1;
      slidePageCacheRef.current.clear();
      if (worksFromApi) {
        slidePageCacheRef.current.set(detailedPage, filteredWorks);
      }
      setSlideWorkFields(null);
      setDetailedSlideIndex(Math.max(0, globalIndex));
      setIsDetailedSlideOpen(true);
      setSlideCacheTick((t) => t + 1);
    },
    [worksFromApi, detailedPage, filteredWorks]
  );

  const goToSlideIndex = React.useCallback(
    (nextIndex: number) => {
      const max = Math.max(0, slideRecordTotal - 1);
      setDetailedSlideIndex(Math.min(Math.max(nextIndex, 0), max));
    },
    [slideRecordTotal]
  );

  const resolveGeoNames = React.useCallback(
    (
      zoneId: string,
      districtId: string,
      tpId: string,
      names?: { zoneNameEn?: string; districtNameEn?: string; tpNameEn?: string; streetName?: string; street?: string }
    ) => {
      const norm = (v: any) => String(v || '').trim().toLowerCase();
      const matchesGeo = (entity: any, ...needles: string[]) => {
        const ids = [entity?.id].map(norm).filter(Boolean);
        return needles.some((n) => {
          if (!n) return false;
          if (ids.includes(n)) return true;
          return geoNamesEqual(entity?.nameEn, n) || geoNamesEqual(entity?.nameTa, n);
        });
      };
      const zoneName = String(names?.zoneNameEn || '').trim();
      const distName = String(names?.districtNameEn || '').trim();
      const tpName = String(names?.tpNameEn || '').trim();
      const streetName = String(names?.streetName || names?.street || '').trim();

      let tp = (state.townPanchayats || []).find((t: any) =>
        matchesGeo(t, norm(tpId), norm(tpName))
      );
      let dist = (state.districts || []).find((d: any) =>
        matchesGeo(d, norm(districtId), norm(distName))
      );
      if (!dist && tp?.districtId) {
        dist = (state.districts || []).find((d: any) => matchesGeo(d, norm(tp.districtId)));
      }
      let zone = (state.zones || []).find((z: any) =>
        matchesGeo(z, norm(zoneId), norm(zoneName))
      );
      if (!zone && dist?.zoneId) {
        zone = (state.zones || []).find((z: any) => matchesGeo(z, norm(dist.zoneId)));
      }
      if (!zone && tp?.zoneId) {
        zone = (state.zones || []).find((z: any) => matchesGeo(z, norm(tp.zoneId)));
      }

      return {
        zoneNameEn: zone?.nameEn || zoneName || zoneId || '-',
        zoneNameTa: zone?.nameTa || zoneName || zone?.nameEn || zoneId || '-',
        districtNameEn: dist?.nameEn || distName || districtId || '-',
        districtNameTa: dist?.nameTa || distName || dist?.nameEn || districtId || '-',
        tpNameEn: tp?.nameEn || tpName || tpId || '-',
        tpNameTa: tp?.nameTa || tpName || tp?.nameEn || tpId || '-',
        streetName: streetName || '-',
      };
    },
    [state.zones, state.districts, state.townPanchayats]
  );

  const swmShowWard = swmWardCol;
  const swmShowStreet = swmStreetCol;
  const swmBuildingFilter = swmBuildingType;

  const swmAbstractRows = useMemo(() => {
    if (swmServerRows) return swmServerRows;
    if (reportModule !== 'swm' || !swmSummaryGroups.length) return [];
    const fields = state.inspectionFields || [];
    const groups = new Map<string, SwmAbstractRow & { wardSet: Set<string>; streetSet: Set<string> }>();

    const sourceGroups = swmSummaryGroups;
    sourceGroups.forEach((work: any) => {
      if (isFallbackInspectionWork(work)) return;
      if (work.categoryId && !isSwmDoorToDoorWork(work, swmDoorToDoorCategoryIds)) return;
      if (swmBuildingFilter !== 'all' && readSwmBuildingType(work, fields) && readSwmBuildingType(work, fields) !== swmBuildingFilter) return;
      const geo = resolveGeoNames(work.zoneId, work.districtId, work.tpId || work.townPanchayatId, work);
      const tpId = String(geo.tpNameEn || work.tpId || work.townPanchayatId || 'unknown').trim();
      const ward = String(work.wardNumber || work.wardNo || '').trim().replace(/^0+/, '') || '0';
      const street = String(work.streetName || '').trim() || streetLabel(work);
      const streetKey = street && street !== '-' ? street : '-';
      const groupKey = [tpId.toLowerCase(), swmShowWard ? ward : '', swmShowStreet ? streetKey.toLowerCase() : ''].join('|');
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          zoneNameEn: geo.zoneNameEn,
          zoneNameTa: geo.zoneNameTa,
          districtNameEn: geo.districtNameEn,
          districtNameTa: geo.districtNameTa,
          tpNameEn: geo.tpNameEn,
          tpNameTa: geo.tpNameTa,
          wardNumber: ward,
          streetName: streetKey,
          totalWards: Number(work.totalWards) || (swmShowStreet || swmShowWard ? 1 : 0),
          wardsSurveyed: 0,
          totalStreets: Number(work.totalStreets) || (swmShowStreet || swmShowWard ? 1 : 0),
          streetsSurveyed: 0,
          householdsSurveyed: 0,
          segregating: 0,
          segregatingPct: 0,
          notSegregating: 0,
          notSegregatingPct: 0,
          doorLocked: 0,
          doorLockedPct: 0,
          homeComposting: 0,
          homeCompostingPct: 0,
          wardSet: new Set<string>(),
          streetSet: new Set<string>(),
        });
      }
      const row = groups.get(groupKey)!;
      const households = Number(work.householdsSurveyed || 0) || 1;
      row.householdsSurveyed += households;
      if (ward) row.wardSet.add(ward);
      if (streetKey && streetKey !== '-') row.streetSet.add(streetKey.toLowerCase());

      if (work.householdsSurveyed != null) {
        const surveyedHH = Number(work.householdsSurveyed) || 0;
        const seg = Number(work.segregating) || 0;
        const locked = Number(work.doorLocked) || 0;
        row.segregating += seg;
        row.notSegregating += work.notSegregating != null
          ? Number(work.notSegregating) || 0
          : Math.max(0, surveyedHH - seg - locked);
        row.doorLocked += locked;
        row.homeComposting += Number(work.homeComposting) || 0;
      } else {
        const flags = readSwmHouseholdFlags(work, fields);
        if (flags.segregating) row.segregating += 1;
        if (flags.notSegregating) row.notSegregating += 1;
        if (flags.doorLocked) row.doorLocked += 1;
        if (flags.homeComposting) row.homeComposting += 1;
      }
    });

    return Array.from(groups.values()).map((row) => {
      const surveyed = row.householdsSurveyed;
      const notSegregating = Number(row.notSegregating) || 0;
      return {
        zoneNameEn: row.zoneNameEn,
        zoneNameTa: row.zoneNameTa,
        districtNameEn: row.districtNameEn,
        districtNameTa: row.districtNameTa,
        tpNameEn: row.tpNameEn,
        tpNameTa: row.tpNameTa,
        wardNumber: row.wardNumber,
        streetName: row.streetName,
        totalWards: row.totalWards,
        wardsSurveyed: row.wardSet.size,
        totalStreets: row.totalStreets,
        streetsSurveyed: row.streetSet.size,
        householdsSurveyed: surveyed,
        segregating: row.segregating,
        segregatingPct: swmPercent(row.segregating, surveyed),
        notSegregating,
        notSegregatingPct: swmPercent(notSegregating, surveyed),
        doorLocked: row.doorLocked,
        doorLockedPct: swmPercent(row.doorLocked, surveyed),
        homeComposting: row.homeComposting,
        homeCompostingPct: swmPercent(row.homeComposting, surveyed),
      } as SwmAbstractRow;
    }).sort((a, b) =>
      String(a.zoneNameEn).localeCompare(String(b.zoneNameEn))
      || String(a.districtNameEn).localeCompare(String(b.districtNameEn))
      || String(a.tpNameEn).localeCompare(String(b.tpNameEn))
      || String(a.wardNumber || '').localeCompare(String(b.wardNumber || ''), undefined, { numeric: true })
      || String(a.streetName || '').localeCompare(String(b.streetName || ''))
    );
  }, [reportModule, resolveGeoNames, state.inspectionFields, streetLabel, swmSummaryGroups, swmBuildingFilter, swmDoorToDoorCategoryIds, swmShowStreet, swmShowWard, swmServerRows]);

  const swmAbstractTotals = useMemo(() => {
    if (swmServerTotals) {
      return {
        totalWards: Number(swmServerTotals.totalWards) || 0,
        wardsSurveyed: Number(swmServerTotals.wardsSurveyed) || 0,
        totalStreets: Number(swmServerTotals.totalStreets) || 0,
        streetsSurveyed: Number(swmServerTotals.streetsSurveyed) || 0,
        householdsSurveyed: Number(swmServerTotals.householdsSurveyed) || 0,
        segregating: Number(swmServerTotals.segregating) || 0,
        notSegregating: Number(swmServerTotals.notSegregating) || 0,
        doorLocked: Number(swmServerTotals.doorLocked) || 0,
        homeComposting: Number(swmServerTotals.homeComposting) || 0,
      };
    }
    return swmAbstractRows.reduce((acc, row) => {
      acc.totalWards += row.totalWards;
      acc.wardsSurveyed += row.wardsSurveyed;
      acc.totalStreets += row.totalStreets;
      acc.streetsSurveyed += row.streetsSurveyed;
      acc.householdsSurveyed += row.householdsSurveyed;
      acc.segregating += row.segregating;
      acc.notSegregating += row.notSegregating;
      acc.doorLocked += row.doorLocked;
      acc.homeComposting += row.homeComposting;
      return acc;
    }, {
      totalWards: 0,
      wardsSurveyed: 0,
      totalStreets: 0,
      streetsSurveyed: 0,
      householdsSurveyed: 0,
      segregating: 0,
      notSegregating: 0,
      doorLocked: 0,
      homeComposting: 0,
    });
  }, [swmAbstractRows, swmServerTotals]);

  const swmTpStreetRows = useMemo(() => {
    if (reportModule !== 'swm') return [];
    if (swmServerRows && swmServerGroup === 'street') {
      return swmServerRows.map((row) => ({
        wardNumber: String(row.wardNumber || '0'),
        streetName: String(row.streetName || '-'),
        householdsSurveyed: row.householdsSurveyed,
        segregating: row.segregating,
        segregatingPct: row.segregatingPct,
        notSegregating: row.notSegregating,
        notSegregatingPct: row.notSegregatingPct,
        doorLocked: row.doorLocked,
        doorLockedPct: row.doorLockedPct,
        homeComposting: row.homeComposting,
        homeCompostingPct: row.homeCompostingPct,
        sortWard: Number.parseInt(String(row.wardNumber || '0'), 10) || 0,
      }));
    }
    const fields = state.inspectionFields || [];
    const groups = new Map<string, SwmTpStreetRow & { sortWard: number }>();
    const sourceGroups = swmSummaryGroups.length ? swmSummaryGroups : [];
    sourceGroups.forEach((work: any) => {
      if (isFallbackInspectionWork(work)) return;
      if (work.categoryId && !isSwmDoorToDoorWork(work, swmDoorToDoorCategoryIds)) return;
      const ward = String(work.wardNumber || work.wardNo || '').trim().replace(/^0+/, '') || '0';
      const street = String(work.streetName || '').trim() || streetLabel(work);
      const streetKey = street && street !== '-' ? street : (lang === 'ta' ? 'தெரியவில்லை' : 'Unknown');
      const tpKey = String(work.tpId || work.townPanchayatId || work.tpNameEn || '').trim().toLowerCase();
      const key = `${tpKey}|${ward}|${streetKey.toLowerCase()}`;
      if (!groups.has(key)) {
        groups.set(key, {
          wardNumber: ward,
          streetName: streetKey,
          householdsSurveyed: 0,
          segregating: 0,
          segregatingPct: 0,
          notSegregating: 0,
          notSegregatingPct: 0,
          doorLocked: 0,
          doorLockedPct: 0,
          homeComposting: 0,
          homeCompostingPct: 0,
          sortWard: Number.parseInt(ward, 10) || 0,
        });
      }
      const row = groups.get(key)!;
      const households = Number(work.householdsSurveyed || 0) || 1;
      row.householdsSurveyed += households;
      if (work.householdsSurveyed != null) {
        const seg = Number(work.segregating) || 0;
        const locked = Number(work.doorLocked) || 0;
        row.segregating += seg;
        row.notSegregating += work.notSegregating != null
          ? Number(work.notSegregating) || 0
          : Math.max(0, households - seg - locked);
        row.doorLocked += locked;
        row.homeComposting += Number(work.homeComposting) || 0;
      } else {
        const flags = readSwmHouseholdFlags(work, fields);
        if (flags.segregating) row.segregating += 1;
        if (flags.notSegregating) row.notSegregating += 1;
        if (flags.doorLocked) row.doorLocked += 1;
        if (flags.homeComposting) row.homeComposting += 1;
      }
    });

    return Array.from(groups.values()).map((row) => {
      const surveyed = row.householdsSurveyed;
      const notSegregating = Number(row.notSegregating) || 0;
      return {
        wardNumber: row.wardNumber,
        streetName: row.streetName,
        householdsSurveyed: surveyed,
        segregating: row.segregating,
        segregatingPct: swmPercent(row.segregating, surveyed),
        notSegregating,
        notSegregatingPct: swmPercent(notSegregating, surveyed),
        doorLocked: row.doorLocked,
        doorLockedPct: swmPercent(row.doorLocked, surveyed),
        homeComposting: row.homeComposting,
        homeCompostingPct: swmPercent(row.homeComposting, surveyed),
        sortWard: row.sortWard,
      };
    }).sort((a, b) =>
      a.sortWard - b.sortWard
      || String(a.wardNumber).localeCompare(String(b.wardNumber), undefined, { numeric: true })
      || String(a.streetName).localeCompare(String(b.streetName))
    );
  }, [lang, reportModule, state.inspectionFields, streetLabel, swmSummaryGroups, swmDoorToDoorCategoryIds, swmServerRows, swmServerGroup]);

  const swmTpStreetTotals = useMemo(() => {
    return swmTpStreetRows.reduce((acc, row) => {
      acc.householdsSurveyed += row.householdsSurveyed;
      acc.segregating += row.segregating;
      acc.notSegregating += row.notSegregating;
      acc.doorLocked += row.doorLocked;
      acc.homeComposting += row.homeComposting;
      return acc;
    }, {
      householdsSurveyed: 0,
      segregating: 0,
      notSegregating: 0,
      doorLocked: 0,
      homeComposting: 0,
    });
  }, [swmTpStreetRows]);

  const toggleSwmSort = (key: string) => {
    setSwmSort((prev) => (
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' }
    ));
  };

  const swmSortValue = (row: any, key: string) => {
    if (key === 'zone') return lang === 'ta' ? row.zoneNameTa : row.zoneNameEn;
    if (key === 'district') return lang === 'ta' ? row.districtNameTa : row.districtNameEn;
    if (key === 'tp') return lang === 'ta' ? row.tpNameTa : row.tpNameEn;
    if (key === 'ward') return Number.parseInt(String(row.wardNumber || '0'), 10) || 0;
    if (key === 'street') return row.streetName || '';
    return row[key];
  };

  const sortSwmRows = <T,>(rows: T[]) => {
    if (!swmSort.key) return rows;
    const dir = swmSort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = swmSortValue(a, swmSort.key);
      const bv = swmSortValue(b, swmSort.key);
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * dir;
    });
  };

  const swmAbstractRowsView = useMemo(
    () => sortSwmRows(swmAbstractRows),
    [swmAbstractRows, swmSort, lang]
  );
  const swmTpStreetRowsView = useMemo(
    () => sortSwmRows(swmTpStreetRows),
    [swmTpStreetRows, swmSort, lang]
  );

  useEffect(() => {
    if (reportModule !== 'swm' || !onSwmTotalsReady) return;
    onSwmTotalsReady({
      totalWards: swmAbstractTotals.totalWards,
      totalStreets: swmAbstractTotals.totalStreets || swmAbstractTotals.streetsSurveyed,
      householdsSurveyed: swmAbstractTotals.householdsSurveyed,
      segregating: swmAbstractTotals.segregating,
      notSegregating: swmAbstractTotals.notSegregating,
      doorLocked: swmAbstractTotals.doorLocked,
      homeComposting: swmAbstractTotals.homeComposting,
    });
  }, [onSwmTotalsReady, reportModule, swmAbstractTotals]);

  useEffect(() => {
    if (reportModule !== 'swm') return;
    setSelectedSubjectId(swmSubjectId);
    setSelectedCategoryId(swmDoorToDoorCategoryId);
  }, [reportModule, swmDoorToDoorCategoryId, swmSubjectId]);

  // Abstract calculations
  const abstractData = useMemo(() => {
    if (worksFromApi || filteredApiSubjectRollups.length > 0) {
      const subjectsMap: Record<string, {
        subjectId: string;
        subjectNameEn: string;
        subjectNameTa: string;
        totalInspections: number;
        completed: number;
        pending: number;
        actionRequired: number;
        categories: Record<string, {
          categoryId: string;
          categoryNameEn: string;
          categoryNameTa: string;
          count: number;
        }>;
      }> = {};

      for (const row of filteredApiSubjectRollups) {
        const sId = row.subjectId || 'unknown';
        const cId = row.categoryId || 'unknown';
        const subj = (state.inspectionSubjects || []).find((s: any) => s.id === sId || s.code === sId || s.nameEn === sId || s.nameTa === sId);
        const cat = (state.inspectionCategories || []).find((c: any) => c.id === cId || c.code === cId || c.nameEn === cId || c.nameTa === cId);
        const sNameEn = subj?.nameEn || sId;
        const sNameTa = subj?.nameTa || sNameEn;
        const cNameEn = cat?.nameEn || cId;
        const cNameTa = cat?.nameTa || cNameEn;
        if (!subjectsMap[sId]) {
          subjectsMap[sId] = {
            subjectId: sId,
            subjectNameEn: sNameEn,
            subjectNameTa: sNameTa,
            totalInspections: 0,
            completed: 0,
            pending: 0,
            actionRequired: 0,
            categories: {},
          };
        }
        subjectsMap[sId].totalInspections += row.count;
        subjectsMap[sId].completed += row.count;
        if (!subjectsMap[sId].categories[cId]) {
          subjectsMap[sId].categories[cId] = {
            categoryId: cId,
            categoryNameEn: cNameEn,
            categoryNameTa: cNameTa,
            count: 0,
          };
        }
        subjectsMap[sId].categories[cId].count += row.count;
      }
      return Object.values(subjectsMap);
    }

    const subjectsMap: Record<string, {
      subjectId: string;
      subjectNameEn: string;
      subjectNameTa: string;
      totalInspections: number;
      completed: number;
      pending: number;
      actionRequired: number;
      categories: Record<string, {
        categoryId: string;
        categoryNameEn: string;
        categoryNameTa: string;
        count: number;
      }>;
    }> = {};

    filteredWorks.forEach((work) => {
      if (isFallbackInspectionWork(work)) return;

      const sId = work.subjectId || 'unknown';
      const subj = (state.inspectionSubjects || []).find((s: any) => s.id === sId || s.code === sId || s.nameEn === sId || s.nameTa === sId);
      const sNameEn = work.subjectNameEn || subj?.nameEn || sId;
      const sNameTa = work.subjectNameTa || subj?.nameTa || sNameEn;

      const cId = work.categoryId || 'unknown';
      const cat = (state.inspectionCategories || []).find((c: any) => c.id === cId || c.code === cId || c.nameEn === cId || c.nameTa === cId);
      const cNameEn = work.categoryNameEn || cat?.nameEn || cId;
      const cNameTa = work.categoryNameTa || cat?.nameTa || cNameEn;

      if (!subjectsMap[sId]) {
        subjectsMap[sId] = {
          subjectId: sId,
          subjectNameEn: sNameEn,
          subjectNameTa: sNameTa,
          totalInspections: 0,
          completed: 0,
          pending: 0,
          actionRequired: 0,
          categories: {}
        };
      }

      subjectsMap[sId].totalInspections += 1;
      const status = (work.status || 'Completed').toLowerCase();
      if (status.includes('complete') || status.includes('done')) {
        subjectsMap[sId].completed += 1;
      } else if (status.includes('action') || status.includes('require')) {
        subjectsMap[sId].actionRequired += 1;
      } else {
        subjectsMap[sId].pending += 1;
      }

      if (!subjectsMap[sId].categories[cId]) {
        subjectsMap[sId].categories[cId] = {
          categoryId: cId,
          categoryNameEn: cNameEn,
          categoryNameTa: cNameTa,
          count: 0
        };
      }
      subjectsMap[sId].categories[cId].count += 1;
    });

    return Object.values(subjectsMap);
  }, [filteredWorks, worksFromApi, filteredApiSubjectRollups, state.inspectionSubjects, state.inspectionCategories]);

  // Subject-wise grouping calculations
  const subjectWiseData = useMemo(() => {
    if (worksFromApi || filteredApiSubjectRollups.length > 0) {
      return filteredApiSubjectRollups.map((row) => {
        const sId = row.subjectId || 'unknown';
        const cId = row.categoryId || 'unknown';
        const subj = (state.inspectionSubjects || []).find((s: any) => s.id === sId || s.code === sId || s.nameEn === sId || s.nameTa === sId);
        const cat = (state.inspectionCategories || []).find((c: any) => c.id === cId || c.code === cId || c.nameEn === cId || c.nameTa === cId);
        return {
          subjectId: sId,
          subjectNameEn: subj?.nameEn || sId,
          subjectNameTa: subj?.nameTa || subj?.nameEn || sId,
          categoryId: cId,
          categoryNameEn: cat?.nameEn || cId,
          categoryNameTa: cat?.nameTa || cat?.nameEn || cId,
          totalInspections: row.count,
        };
      });
    }

    const groups: Record<string, {
      subjectId: string;
      subjectNameEn: string;
      subjectNameTa: string;
      categoryId: string;
      categoryNameEn: string;
      categoryNameTa: string;
      totalInspections: number;
    }> = {};

    filteredWorks.forEach((w) => {
      if (isFallbackInspectionWork(w)) return;

      const sId = w.subjectId || 'unknown';
      const cId = w.categoryId || 'unknown';
      const key = `${sId}_${cId}`;

      const subj = (state.inspectionSubjects || []).find((s: any) => s.id === sId || s.code === sId || s.nameEn === sId || s.nameTa === sId);
      const cat = (state.inspectionCategories || []).find((c: any) => c.id === cId || c.code === cId || c.nameEn === cId || c.nameTa === cId);

      const sNameEn = w.subjectNameEn || subj?.nameEn || sId;
      const sNameTa = w.subjectNameTa || subj?.nameTa || sNameEn;
      const cNameEn = w.categoryNameEn || cat?.nameEn || cId;
      const cNameTa = w.categoryNameTa || cat?.nameTa || cNameEn;

      if (!groups[key]) {
        groups[key] = {
          subjectId: sId,
          subjectNameEn: sNameEn,
          subjectNameTa: sNameTa,
          categoryId: cId,
          categoryNameEn: cNameEn,
          categoryNameTa: cNameTa,
          totalInspections: 0
        };
      }
      groups[key].totalInspections += 1;
    });

    return Object.values(groups);
  }, [filteredWorks, worksFromApi, filteredApiSubjectRollups, state.inspectionSubjects, state.inspectionCategories]);

  // User-wise grouping calculations
  const userWiseData = useMemo(() => {
    const groups: Record<string, {
      zoneNameEn: string;
      zoneNameTa: string;
      districtNameEn: string;
      districtNameTa: string;
      tpNameEn: string;
      tpNameTa: string;
      userName: string;
      userDesignation: string;
      subjectNameEn?: string;
      subjectNameTa?: string;
      categoryNameEn?: string;
      categoryNameTa?: string;
      totalInspections: number;
    }> = {};

    const includeSubject = categoryWiseEnabled && userCols.subject;
    const includeCategory = categoryWiseEnabled && userCols.category;

    if (worksFromApi) {
      filteredApiDimensionRollups.forEach((row) => {
        const geo = resolveGeoNames(row.zoneId, row.districtId, row.tpId, row);
        const uName = row.submittedByUserName || (lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector');
        const uDesig = getInspectorDesignation({ submittedByUserName: uName });
        let key = `${geo.zoneNameEn}_${geo.districtNameEn}_${geo.tpNameEn}_${uName}_${uDesig}`;
        if (includeSubject) key += `_${row.subjectId || 'unknown'}`;
        if (includeCategory) key += `_${row.categoryId || 'unknown'}`;
        if (!groups[key]) {
          groups[key] = {
            zoneNameEn: geo.zoneNameEn,
            zoneNameTa: geo.zoneNameTa,
            districtNameEn: geo.districtNameEn,
            districtNameTa: geo.districtNameTa,
            tpNameEn: geo.tpNameEn,
            tpNameTa: geo.tpNameTa,
            userName: uName,
            userDesignation: uDesig,
            totalInspections: 0,
          };
          if (includeSubject) {
            const subj = (state.inspectionSubjects || []).find(
              (s: any) => s.id === row.subjectId || s.code === row.subjectId || s.nameEn === row.subjectId || s.nameTa === row.subjectId
            );
            groups[key].subjectNameEn = subj?.nameEn || row.subjectId || 'General';
            groups[key].subjectNameTa = subj?.nameTa || subj?.nameEn || row.subjectId || 'பொது';
          }
          if (includeCategory) {
            const cat = (state.inspectionCategories || []).find(
              (c: any) => c.id === row.categoryId || c.code === row.categoryId || c.nameEn === row.categoryId || c.nameTa === row.categoryId
            );
            groups[key].categoryNameEn = cat?.nameEn || row.categoryId || 'General';
            groups[key].categoryNameTa = cat?.nameTa || cat?.nameEn || row.categoryId || 'பொது';
          }
        }
        groups[key].totalInspections += row.count || 0;
      });
      return Object.values(groups);
    }

    filteredWorks.forEach((w) => {
      const uName = w.submittedByUserName || (lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector');
      const uDesig = getInspectorDesignation(w);
      const geo = resolveGeoNames(w.zoneId, w.districtId, w.tpId || w.townPanchayatId, w);
      const zNameEn = geo.zoneNameEn;
      const zNameTa = geo.zoneNameTa;
      const dNameEn = geo.districtNameEn;
      const dNameTa = geo.districtNameTa;
      const tNameEn = geo.tpNameEn;
      const tNameTa = geo.tpNameTa;
      
      let key = `${zNameEn}_${dNameEn}_${tNameEn}_${uName}_${uDesig}`;
      
      const includeSubject = categoryWiseEnabled && userCols.subject;
      const includeCategory = categoryWiseEnabled && userCols.category;

      if (includeSubject) {
        key += `_${w.subjectId || 'unknown'}`;
      }
      if (includeCategory) {
        key += `_${w.categoryId || 'unknown'}`;
      }

      if (!groups[key]) {
        groups[key] = {
          zoneNameEn: zNameEn,
          zoneNameTa: zNameTa,
          districtNameEn: dNameEn,
          districtNameTa: dNameTa,
          tpNameEn: tNameEn,
          tpNameTa: tNameTa,
          userName: uName,
          userDesignation: uDesig,
          totalInspections: 0,
        };
        if (includeSubject) {
          groups[key].subjectNameEn = w.subjectNameEn || 'General';
          groups[key].subjectNameTa = w.subjectNameTa || 'பொது';
        }
        if (includeCategory) {
          groups[key].categoryNameEn = w.categoryNameEn || 'General';
          groups[key].categoryNameTa = w.categoryNameTa || 'பொது';
        }
      }

      groups[key].totalInspections += 1;
    });

    return Object.values(groups);
  }, [
    filteredWorks,
    worksFromApi,
    filteredApiDimensionRollups,
    categoryWiseEnabled,
    userCols,
    resolveGeoNames,
    lang,
    state.users,
    state.employees,
    state.inspectionSubjects,
    state.inspectionCategories,
  ]);

  // Location-wise grouping calculations
  const locationWiseData = useMemo(() => {
    const groups: Record<string, {
      zoneNameEn: string;
      zoneNameTa: string;
      districtNameEn: string;
      districtNameTa: string;
      tpNameEn: string;
      tpNameTa: string;
      wardNumber?: string;
      streetName?: string;
      subjectNameEn?: string;
      subjectNameTa?: string;
      categoryNameEn?: string;
      categoryNameTa?: string;
      totalInspections: number;
    }> = {};

    const showDistrict = locCols.district;
    const showTp = locCols.tp;
    const showWard = locCols.ward;
    const showStreet = locCols.street;
    const showSubj = locCols.subject;
    const showCat = locCols.category;

    const locationGroupKey = (geo: {
      zoneNameEn: string;
      districtNameEn: string;
      tpNameEn: string;
      streetName?: string;
    }, extra: { wardNumber?: string; streetName?: string; subjectId?: string; categoryId?: string; tpId?: string; districtId?: string }) => {
      let key = `zone_${geo.zoneNameEn || '-'}`;
      if (showDistrict) key += `|d_${geo.districtNameEn || extra.districtId || '-'}`;
      if (showTp) key += `|tp_${geo.tpNameEn || extra.tpId || '-'}`;
      if (showWard) key += `|ward_${extra.wardNumber || 'unknown'}`;
      if (showStreet) key += `|street_${extra.streetName || geo.streetName || '-'}`;
      if (showSubj) key += `|subj_${extra.subjectId || 'unknown'}`;
      if (showCat) key += `|cat_${extra.categoryId || 'unknown'}`;
      return key;
    };

    if (worksFromApi) {
      filteredApiDimensionRollups.forEach((row) => {
        const geo = resolveGeoNames(row.zoneId, row.districtId, row.tpId, row);
        const streetName = String(row.streetName || geo.streetName || '').trim() || '-';
        const key = locationGroupKey(geo, {
          wardNumber: row.wardNumber,
          streetName,
          subjectId: row.subjectId,
          categoryId: row.categoryId,
          tpId: row.tpId,
          districtId: row.districtId,
        });
        if (!groups[key]) {
          groups[key] = {
            zoneNameEn: geo.zoneNameEn,
            zoneNameTa: geo.zoneNameTa,
            districtNameEn: geo.districtNameEn,
            districtNameTa: geo.districtNameTa,
            tpNameEn: geo.tpNameEn,
            tpNameTa: geo.tpNameTa,
            totalInspections: 0,
          };
          if (showWard) groups[key].wardNumber = row.wardNumber;
          if (showStreet) groups[key].streetName = streetName;
          if (showSubj) {
            const subj = (state.inspectionSubjects || []).find(
              (s: any) => s.id === row.subjectId || s.code === row.subjectId || s.nameEn === row.subjectId || s.nameTa === row.subjectId
            );
            groups[key].subjectNameEn = subj?.nameEn || row.subjectId;
            groups[key].subjectNameTa = subj?.nameTa || subj?.nameEn || row.subjectId;
          }
          if (showCat) {
            const cat = (state.inspectionCategories || []).find(
              (c: any) => c.id === row.categoryId || c.code === row.categoryId || c.nameEn === row.categoryId || c.nameTa === row.categoryId
            );
            groups[key].categoryNameEn = cat?.nameEn || row.categoryId;
            groups[key].categoryNameTa = cat?.nameTa || cat?.nameEn || row.categoryId;
          }
        }
        groups[key].totalInspections += row.count || 0;
      });
      return Object.values(groups);
    }

    filteredWorks.forEach((w) => {
      const geo = resolveGeoNames(w.zoneId, w.districtId, w.tpId || w.townPanchayatId, w);
      const key = locationGroupKey(geo, {
        wardNumber: w.wardNumber || w.wardNo,
        streetName: geo.streetName,
        subjectId: w.subjectId,
        categoryId: w.categoryId,
        tpId: w.tpId || w.townPanchayatId,
        districtId: w.districtId,
      });

      if (!groups[key]) {
        groups[key] = {
          zoneNameEn: geo.zoneNameEn,
          zoneNameTa: geo.zoneNameTa,
          districtNameEn: geo.districtNameEn,
          districtNameTa: geo.districtNameTa,
          tpNameEn: geo.tpNameEn,
          tpNameTa: geo.tpNameTa,
          totalInspections: 0
        };
        if (showWard) {
          groups[key].wardNumber = w.wardNumber;
        }
        if (showStreet) {
          groups[key].streetName = geo.streetName;
        }
        if (showSubj) {
          groups[key].subjectNameEn = w.subjectNameEn;
          groups[key].subjectNameTa = w.subjectNameTa;
        }
        if (showCat) {
          groups[key].categoryNameEn = w.categoryNameEn;
          groups[key].categoryNameTa = w.categoryNameTa;
        }
      }

      groups[key].totalInspections += 1;
    });

    return Object.values(groups);
  }, [
    filteredWorks,
    worksFromApi,
    filteredApiDimensionRollups,
    locCols,
    resolveGeoNames,
    state.inspectionSubjects,
    state.inspectionCategories,
  ]);

  // Request sort helper
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Sorted Subject-wise data
  const sortedSubjectWiseData = useMemo(() => {
    const data = [...subjectWiseData];
    if (sortConfig) {
      data.sort((a: any, b: any) => {
        let valA = a[sortConfig.key] ?? '';
        let valB = b[sortConfig.key] ?? '';
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [subjectWiseData, sortConfig]);

  // Sorted User-wise data
  const sortedUserWiseData = useMemo(() => {
    const data = [...userWiseData];
    if (sortConfig) {
      data.sort((a: any, b: any) => {
        let valA = a[sortConfig.key] ?? '';
        let valB = b[sortConfig.key] ?? '';
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [userWiseData, sortConfig]);

  // Sorted Location-wise data
  const sortedLocationWiseData = useMemo(() => {
    const data = [...locationWiseData];
    if (sortConfig) {
      data.sort((a: any, b: any) => {
        let valA = a[sortConfig.key] ?? '';
        let valB = b[sortConfig.key] ?? '';
        if (sortConfig.key === 'wardNumber' || sortConfig.key === 'totalInspections') {
          const numA = Number(valA) || 0;
          const numB = Number(valB) || 0;
          return sortConfig.direction === 'ascending' ? numA - numB : numB - numA;
        }
        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = valB.toLowerCase();
        }
        if (valA < valB) return sortConfig.direction === 'ascending' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'ascending' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [locationWiseData, sortConfig]);

  // Unified active rows array
  const activeRows = useMemo(() => {
    if (groupingStyle === 'subject') return sortedSubjectWiseData;
    if (groupingStyle === 'user') return sortedUserWiseData;
    return sortedLocationWiseData;
  }, [groupingStyle, sortedSubjectWiseData, sortedUserWiseData, sortedLocationWiseData]);

  const activeRowsTotal = useMemo(() => {
    const rowSum = activeRows.reduce((sum, r: any) => sum + (r.totalInspections || 0), 0);
    if (rowSum > 0) return rowSum;
    if (worksFromApi) return filteredWorksTotal;
    return apiTotalWithoutCategory || 0;
  }, [activeRows, worksFromApi, filteredWorksTotal, apiTotalWithoutCategory]);

  // Paginated Rows (50 items per page)
  const paginatedRows = useMemo(() => {
    const startIndex = (abstractPage - 1) * 50;
    return activeRows.slice(startIndex, startIndex + 50);
  }, [activeRows, abstractPage]);

  const totalPages = Math.ceil(activeRows.length / 50) || 1;

  // Reset pagination on filter or style changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAbstractPage(1);
  }, [
    groupingStyle,
    selectedZoneId,
    selectedDistrictId,
    selectedTpId,
    selectedWard,
    selectedStreetName,
    selectedSubjectId,
    selectedCategoryId,
    searchQuery,
    locCols,
    userCols,
  ]);

  // Handle Admin Delete of Inspected Work
  const handleDeleteWork = async (workId: string) => {
    if (!isAdmin) {
      alert('Only administrators can delete inspection works.');
      return;
    }
    const confirmed = window.confirm(
      lang === 'ta'
        ? 'இந்த ஆய்வு பதிவை நிரந்தரமாக நீக்க விரும்புகிறீர்களா? MongoDB மற்றும் S3 காப்பகத்திலிருந்து நீக்கப்படும்.'
        : 'Are you sure you want to permanently delete this inspection record from MongoDB and S3?'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`/api/inspection-works?id=${encodeURIComponent(workId)}`, {
        method: 'DELETE',
        headers: {
          'x-role': String(currentUser?.role || currentUser?.roleId || ''),
          'x-username': String(currentUser?.username || ''),
        }
      });
      const data = await res.json();
      if (data.success) {
        setFetchedWorks(prev => (prev || state.inspectionWorks || []).filter((w: any) => (w.id !== workId && w.workId !== workId)));
        if (selectedWorkModal && (selectedWorkModal.id === workId || selectedWorkModal.workId === workId)) {
          setSelectedWorkModal(null);
        }
        alert(lang === 'ta' ? 'ஆய்வு பதிவு வெற்றிகரமாக நீக்கப்பட்டது!' : 'Inspection record successfully deleted!');
      } else {
        alert(data.message || 'Failed to delete record');
      }
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Error deleting inspection record: ' + err.message);
    }
  };

  // Handle Save Edited Inspection Work
  const handleSaveEditWork = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWork) return;

    // Validate Ward and Street Name (always mandatory)
    if (!editingWork.wardNumber || String(editingWork.wardNumber).trim() === '') {
      alert(lang === 'ta' ? 'வார்டு எண் கட்டாயமாகும்!' : 'Ward Number is mandatory!');
      return;
    }
    if (!editingWork.streetName || String(editingWork.streetName).trim() === '') {
      alert(lang === 'ta' ? 'தெரு பெயர் கட்டாயமாகும்!' : 'Street / Location Name is mandatory!');
      return;
    }

    // Validate Category-specific dynamic fields marked as mandatory
    const categoryFields = (state.inspectionFields || []).filter((f: any) => f.categoryId === editingWork.categoryId);
    for (const field of categoryFields) {
      const isMand = field.isMandatory === true || field.isRequired === true;
      if (isMand) {
        const val = editingWork.fieldsData?.[field.id] || editingWork.fieldsData?.[field.fieldName] || '';
        if (typeof val !== 'string' || val.trim() === '') {
          const fieldLabel = lang === 'ta' ? field.fieldNameTa || field.nameTa || field.fieldName : field.fieldName || field.nameEn;
          alert(lang === 'ta' ? `${fieldLabel} கட்டாய புலமாகும்!` : `${fieldLabel} is a mandatory field!`);
          return;
        }
      }
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch('/api/inspection-works', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingWork),
      });
      const data = await res.json();
      if (data.success) {
        setFetchedWorks(prev => (prev || state.inspectionWorks || []).map((w: any) => 
          (w.id === editingWork.id || w.workId === editingWork.workId) ? { ...w, ...editingWork } : w
        ));
        if (selectedWorkModal && (selectedWorkModal.id === editingWork.id || selectedWorkModal.workId === editingWork.workId)) {
          setSelectedWorkModal({ ...selectedWorkModal, ...editingWork });
        }
        setEditingWork(null);
        alert(lang === 'ta' ? 'ஆய்வு விவரங்கள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன!' : 'Inspection work successfully updated in MongoDB & S3!');
      } else {
        alert(data.message || 'Failed to update inspection work');
      }
    } catch (err: any) {
      console.error('Edit error:', err);
      alert('Error updating inspection: ' + err.message);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Helper for S3 partitioned folder path (folder pattern: inspection/username/)
  const getWorkS3Path = (w: any) => {
    const username = (w.username || w.submittedByUserName || w.submittedByUserId || 'inspector')
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '') || 'inspector';
    const cleanId = (w.workId || w.id || 'work').replace('#', '').trim();
    return `inspection/${username}/${cleanId}`;
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Work ID',
      'Submitted Date',
      'Subject (En)',
      'Subject (Ta)',
      'Category (En)',
      'Category (Ta)',
      'Town Panchayat',
      'Ward Number',
      'Street Name',
      'Inspector Name',
      'Inspector Designation',
      'Latitude',
      'Longitude',
      'Status',
      'Image URL',
      'S3 Path'
    ];

    const rows = filteredWorks.map((w) => [
      w.workId || w.id,
      w.submittedAt || '',
      w.subjectNameEn || '',
      w.subjectNameTa || '',
      w.categoryNameEn || '',
      w.categoryNameTa || '',
      w.tpNameEn || '',
      w.wardNumber || '',
      `"${streetLabel(w).replace(/"/g, '""')}"`,
      `"${(w.submittedByUserName || '').replace(/"/g, '""')}"`,
      `"${getInspectorDesignation(w).replace(/"/g, '""')}"`,
      w.latitude || '',
      w.longitude || '',
      w.status || 'Completed',
      w.imageUrl || '',
      getWorkS3Path(w)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inspection_Reports_${activeTab}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to extract works grouped by Town Panchayat
  const getTpWiseAbstractData = () => {
    const tpMap = new Map<string, {
      id: string;
      nameEn: string;
      nameTa: string;
      districtEn: string;
      districtTa: string;
      zoneEn: string;
      zoneTa: string;
      works: any[];
    }>();

    filteredWorks.forEach(w => {
      const tpKey = String(w.tpId || w.tpNameEn || 'General').trim();
      const matchedTp = (state.townPanchayats || []).find((t: any) => 
        t.id === w.tpId || (w.tpNameEn && (t.nameEn === w.tpNameEn || t.name === w.tpNameEn))
      );
      const nameEn = w.tpNameEn || matchedTp?.nameEn || matchedTp?.name || tpKey;
      const nameTa = w.tpNameTa || matchedTp?.nameTa || nameEn;
      const districtEn = w.districtNameEn || 'District';
      const districtTa = w.districtNameTa || (lang === 'ta' ? 'மாவட்டம்' : 'District');
      const zoneEn = w.zoneNameEn || 'Zone';
      const zoneTa = w.zoneNameTa || (lang === 'ta' ? 'மண்டலம்' : 'Zone');

      if (!tpMap.has(tpKey)) {
        tpMap.set(tpKey, {
          id: tpKey,
          nameEn,
          nameTa,
          districtEn,
          districtTa,
          zoneEn,
          zoneTa,
          works: []
        });
      }
      tpMap.get(tpKey)!.works.push(w);
    });

    return Array.from(tpMap.values());
  };

  // Excel Export for current active Abstract Summary view
  const swmAbstractExportHeaders = (() => {
    const isTa = lang === 'ta';
    const headers = [
      isTa ? 'வ.எண்' : 'S.No',
      isTa ? 'மண்டலம்' : 'Zone',
      isTa ? 'மாவட்டம்' : 'District',
      isTa ? 'பேரூராட்சி' : 'Town Panchayat',
    ];
    if (swmShowWard) headers.push(isTa ? 'வார்டு எண்' : 'Ward No');
    if (swmShowStreet) headers.push(isTa ? 'தெருப்பெயர்' : 'Street Names');
    if (!swmShowWard && !swmShowStreet) {
      headers.push(
        isTa ? SWM_COL.totalWards.ta : SWM_COL.totalWards.en,
        isTa ? SWM_COL.wardsSurveyed.ta : SWM_COL.wardsSurveyed.en,
        isTa ? SWM_COL.totalStreets.ta : SWM_COL.totalStreets.en,
        isTa ? SWM_COL.streetsSurveyed.ta : SWM_COL.streetsSurveyed.en
      );
    } else if (swmShowWard && !swmShowStreet) {
      headers.push(isTa ? SWM_COL.streetsSurveyed.ta : SWM_COL.streetsSurveyed.en);
    }
    headers.push(
      isTa ? SWM_COL.households.ta : SWM_COL.households.en,
      isTa ? SWM_COL.segregating.ta : SWM_COL.segregating.en,
      isTa ? SWM_COL.pct.ta : SWM_COL.pct.en,
      isTa ? SWM_COL.notSegregating.ta : SWM_COL.notSegregating.en,
      isTa ? SWM_COL.pct.ta : SWM_COL.pct.en,
      isTa ? SWM_COL.doorLocked.ta : SWM_COL.doorLocked.en,
      isTa ? SWM_COL.pct.ta : SWM_COL.pct.en,
      isTa ? SWM_COL.compost.ta : SWM_COL.compost.en,
      isTa ? SWM_COL.pct.ta : SWM_COL.pct.en
    );
    return headers;
  })();

  const swmAbstractExportRows = () => {
    const rows = swmAbstractRows.map((row, idx) => {
      const item: (string | number)[] = [
        idx + 1,
        lang === 'ta' ? row.zoneNameTa : row.zoneNameEn,
        lang === 'ta' ? row.districtNameTa : row.districtNameEn,
        lang === 'ta' ? row.tpNameTa : row.tpNameEn,
      ];
      if (swmShowWard) item.push(formatSwmWard(row.wardNumber || '0', lang));
      if (swmShowStreet) item.push(row.streetName || '-');
      if (!swmShowWard && !swmShowStreet) {
        item.push(row.totalWards, row.wardsSurveyed, row.totalStreets, row.streetsSurveyed);
      } else if (swmShowWard && !swmShowStreet) {
        item.push(row.streetsSurveyed);
      }
      item.push(
        row.householdsSurveyed,
        row.segregating,
        row.segregatingPct,
        row.notSegregating,
        row.notSegregatingPct,
        row.doorLocked,
        row.doorLockedPct,
        row.homeComposting,
        row.homeCompostingPct
      );
      return item;
    });
    const t = swmAbstractTotals;
    const total: (string | number)[] = [lang === 'ta' ? 'மொத்தம்' : 'Total', '-', '-', '-'];
    if (swmShowWard) total.push('-');
    if (swmShowStreet) total.push('-');
    if (!swmShowWard && !swmShowStreet) {
      total.push(t.totalWards, t.wardsSurveyed, t.totalStreets, t.streetsSurveyed);
    } else if (swmShowWard && !swmShowStreet) {
      total.push(t.streetsSurveyed);
    }
    total.push(
      t.householdsSurveyed,
      t.segregating,
      swmPercent(t.segregating, t.householdsSurveyed),
      t.notSegregating,
      swmPercent(t.notSegregating, t.householdsSurveyed),
      t.doorLocked,
      swmPercent(t.doorLocked, t.householdsSurveyed),
      t.homeComposting,
      swmPercent(t.homeComposting, t.householdsSurveyed)
    );
    rows.push(total);
    return rows;
  };

  const swmAbstractColCount = swmAbstractExportHeaders.length;

  const swmTpHeaderEn = [
    SWM_COL.sno.en,
    SWM_COL.wardNo.en,
    SWM_COL.street.en,
    SWM_COL.households.en,
    SWM_COL.segregating.en,
    SWM_COL.pct.en,
    SWM_COL.notSegregating.en,
    SWM_COL.pct.en,
    SWM_COL.doorLocked.en,
    SWM_COL.pct.en,
    SWM_COL.compost.en,
    SWM_COL.pct.en,
  ];
  const swmTpHeaderTa = [
    SWM_COL.sno.ta,
    SWM_COL.wardNo.ta,
    SWM_COL.street.ta,
    SWM_COL.households.ta,
    SWM_COL.segregating.ta,
    SWM_COL.pct.ta,
    SWM_COL.notSegregating.ta,
    SWM_COL.pct.ta,
    SWM_COL.doorLocked.ta,
    SWM_COL.pct.ta,
    SWM_COL.compost.ta,
    SWM_COL.pct.ta,
  ];
  const swmTpExportHeaders = lang === 'ta' ? swmTpHeaderTa : swmTpHeaderEn;

  const swmTpExportRows = () => {
    const rows = swmTpStreetRows.map((row, idx) => [
      idx + 1,
      formatSwmWard(row.wardNumber, lang),
      row.streetName,
      row.householdsSurveyed,
      row.segregating,
      row.segregatingPct,
      row.notSegregating,
      row.notSegregatingPct,
      row.doorLocked,
      row.doorLockedPct,
      row.homeComposting,
      row.homeCompostingPct,
    ]);
    const t = swmTpStreetTotals;
    rows.push([
      lang === 'ta' ? 'மொத்தம்' : 'Total',
      '-',
      '-',
      t.householdsSurveyed,
      t.segregating,
      swmPercent(t.segregating, t.householdsSurveyed),
      t.notSegregating,
      swmPercent(t.notSegregating, t.householdsSurveyed),
      t.doorLocked,
      swmPercent(t.doorLocked, t.householdsSurveyed),
      t.homeComposting,
      swmPercent(t.homeComposting, t.householdsSurveyed),
    ]);
    return rows;
  };

  const handleExportSwmTpExcel = () => {
    if (isExportingExcelRef.current) return;
    isExportingExcelRef.current = true;
    setIsExportingExcel(true);
    try {
      exportMultiSheetExcel([
        {
          name: 'SWM TP',
          data: [
            [lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats'],
            [lang === 'ta' ? 'SWM கண்காணிப்பு • வார்டு / தெரு அறிக்கை' : 'SWM Monitoring • Ward / Street Report'],
            [lang === 'ta' ? `தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Date: ${new Date().toLocaleDateString()}`],
            [],
            swmTpExportHeaders,
            ...swmTpExportRows(),
          ],
        },
      ], `SWM_Door_to_Door_TP_${getTodayYmd()}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting SWM TP Excel:', err);
      alert('Error: ' + (err?.message || 'Excel export failed'));
    } finally {
      isExportingExcelRef.current = false;
      setIsExportingExcel(false);
    }
  };

  const handleExportSwmTpPDF = async () => {
    if (isExportingPdfRef.current) return;
    isExportingPdfRef.current = true;
    setIsExportingPdf(true);
    try {
      await generateHtmlTablePDF({
        title: lang === 'ta' ? 'SWM கண்காணிப்பு பேரூராட்சி அறிக்கை' : 'SWM Monitoring Town Panchayat Report',
        subtitle: lang === 'ta' ? 'வார்டு மற்றும் தெரு வாரியாக வீடு வீடாக மூலத்திலேயே பிரித்தல்' : 'Ward & Street Door-to-Door Source Segregation',
        metadata: [
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() },
          { label: lang === 'ta' ? 'தெருக்கள்' : 'Streets', value: String(swmTpStreetRows.length) },
        ],
        headers: swmTpExportHeaders,
        rows: swmTpExportRows(),
        filename: `SWM_Door_to_Door_TP_${getTodayYmd()}.pdf`,
        landscape: true,
        lang: lang === 'ta' ? 'ta' : 'en',
      });
    } catch (err: any) {
      console.error('Error exporting SWM TP PDF:', err);
      alert('Error: ' + (err?.message || 'PDF export failed'));
    } finally {
      isExportingPdfRef.current = false;
      setIsExportingPdf(false);
    }
  };

  const handleExportAbstractExcel = () => {
    try {
      if (reportModule === 'swm') {
        if (isExportingExcelRef.current) return;
        isExportingExcelRef.current = true;
        setIsExportingExcel(true);
        try {
          exportMultiSheetExcel([
            {
              name: 'SWM Abstract',
              data: [
                [lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats'],
                [lang === 'ta' ? 'SWM கண்காணிப்பு • வீடு வீடாக மூலத்திலேயே பிரித்தல்' : 'SWM Monitoring • Door-to-Door Source Segregation'],
                [lang === 'ta' ? `தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Date: ${new Date().toLocaleDateString()}`],
                [],
                swmAbstractExportHeaders,
                ...swmAbstractExportRows(),
              ],
            },
          ], `SWM_Door_to_Door_Abstract_${getTodayYmd()}.xlsx`);
        } finally {
          isExportingExcelRef.current = false;
          setIsExportingExcel(false);
        }
        return;
      }
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      const totalSum = activeRows.reduce((sum, r) => sum + (r.totalInspections || 0), 0);

      if (groupingStyle === 'subject') {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject Name',
          lang === 'ta' ? 'ஆய்வு வகை' : 'Category Name',
          lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections'
        ];
        rows = sortedSubjectWiseData.map((row, idx) => [
          idx + 1,
          lang === 'ta' ? row.subjectNameTa : row.subjectNameEn,
          lang === 'ta' ? row.categoryNameTa : row.categoryNameEn,
          row.totalInspections
        ]);
        rows.push([
          lang === 'ta' ? 'மொத்தம்' : 'Total',
          '-',
          '-',
          totalSum
        ]);
      } else if (groupingStyle === 'user') {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'மண்டலம்' : 'Zone',
          lang === 'ta' ? 'மாவட்டம்' : 'District',
          lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
          lang === 'ta' ? 'பயனர் பெயர்' : 'User Name',
          lang === 'ta' ? 'பதவி' : 'Designation'
        ];
        if (userCols.subject) headers.push(lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject');
        if (userCols.category) headers.push(lang === 'ta' ? 'ஆய்வு வகை' : 'Category');
        headers.push(lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections');

        rows = sortedUserWiseData.map((row, idx) => {
          const item: (string | number)[] = [
            idx + 1,
            lang === 'ta' ? row.zoneNameTa : row.zoneNameEn,
            lang === 'ta' ? row.districtNameTa : row.districtNameEn,
            lang === 'ta' ? row.tpNameTa : row.tpNameEn,
            row.userName,
            row.userDesignation || ''
          ];
          if (userCols.subject) item.push(lang === 'ta' ? (row.subjectNameTa || '-') : (row.subjectNameEn || '-'));
          if (userCols.category) item.push(lang === 'ta' ? (row.categoryNameTa || '-') : (row.categoryNameEn || '-'));
          item.push(row.totalInspections);
          return item;
        });

        const totalRow: (string | number)[] = [lang === 'ta' ? 'மொத்தம்' : 'Total', '-', '-', '-', '-', '-'];
        if (userCols.subject) totalRow.push('-');
        if (userCols.category) totalRow.push('-');
        totalRow.push(totalSum);
        rows.push(totalRow);
      } else {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'மண்டலம்' : 'Zone'
        ];
        if (locCols.district) headers.push(lang === 'ta' ? 'மாவட்டம்' : 'District');
        if (locCols.tp) headers.push(lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat');
        if (locCols.ward) headers.push(lang === 'ta' ? 'வார்டு' : 'Ward');
        if (locCols.street) headers.push(lang === 'ta' ? 'தெரு' : 'Street');
        if (locCols.subject) headers.push(lang === 'ta' ? 'பிரிவு' : 'Subject');
        if (locCols.category) headers.push(lang === 'ta' ? 'வகை' : 'Category');
        headers.push(lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections');

        rows = sortedLocationWiseData.map((row, idx) => {
          const item: (string | number)[] = [
            idx + 1,
            lang === 'ta' ? row.zoneNameTa : row.zoneNameEn
          ];
          if (locCols.district) item.push(lang === 'ta' ? (row.districtNameTa || '-') : (row.districtNameEn || '-'));
          if (locCols.tp) item.push(lang === 'ta' ? (row.tpNameTa || '-') : (row.tpNameEn || '-'));
          if (locCols.ward) item.push(lang === 'ta' ? `வார்டு ${row.wardNumber || '0'}` : `Ward ${row.wardNumber || '0'}`);
          if (locCols.street) item.push(streetLabel(row));
          if (locCols.subject) item.push(lang === 'ta' ? (row.subjectNameTa || '-') : (row.subjectNameEn || '-'));
          if (locCols.category) item.push(lang === 'ta' ? (row.categoryNameTa || '-') : (row.categoryNameEn || '-'));
          item.push(row.totalInspections);
          return item;
        });

        const totalRow: (string | number)[] = [lang === 'ta' ? 'மொத்தம்' : 'Total', '-'];
        if (locCols.district) totalRow.push('-');
        if (locCols.tp) totalRow.push('-');
        if (locCols.ward) totalRow.push('-');
        if (locCols.street) totalRow.push('-');
        if (locCols.subject) totalRow.push('-');
        if (locCols.category) totalRow.push('-');
        totalRow.push(totalSum);
        rows.push(totalRow);
      }

      exportMultiSheetExcel([
        {
          name: lang === 'ta' ? 'சுருக்க அறிக்கை' : 'Abstract Summary',
          data: [
            [lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats'],
            [lang === 'ta' ? 'கள ஆய்வுகள் சுருக்க அறிக்கை' : 'Town Panchayat Field Inspection Abstract Report'],
            [lang === 'ta' ? `தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Date: ${new Date().toLocaleDateString()}`],
            [],
            headers,
            ...rows
          ]
        }
      ], `Abstract_Summary_Report_${getTodayYmd()}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting Abstract Excel:', err);
      alert('Error: ' + err.message);
    }
  };

  // PDF Export for Abstract Summary view with native Tamil font rendering
  const handleExportAbstractPDF = async () => {
    try {
      if (reportModule === 'swm') {
        if (isExportingPdfRef.current) return;
        isExportingPdfRef.current = true;
        setIsExportingPdf(true);
        try {
          await generateHtmlTablePDF({
            title: lang === 'ta' ? 'SWM கண்காணிப்பு சுருக்க அறிக்கை' : 'SWM Monitoring Abstract Report',
            subtitle: lang === 'ta' ? 'வீடு வீடாக மூலத்திலேயே பிரித்தல்' : 'Door-to-Door Source Segregation',
            metadata: [
              { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() },
              { label: lang === 'ta' ? 'பேரூராட்சிகள்' : 'Town Panchayats', value: String(swmAbstractRows.length) },
            ],
            headers: swmAbstractExportHeaders,
            rows: swmAbstractExportRows(),
            filename: `SWM_Door_to_Door_Abstract_${getTodayYmd()}.pdf`,
            landscape: true,
            lang: lang === 'ta' ? 'ta' : 'en',
          });
        } finally {
          isExportingPdfRef.current = false;
          setIsExportingPdf(false);
        }
        return;
      }
      let headers: string[] = [];
      let rows: (string | number)[][] = [];
      const totalSum = activeRows.reduce((sum, r) => sum + (r.totalInspections || 0), 0);

      if (groupingStyle === 'subject') {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject Name',
          lang === 'ta' ? 'ஆய்வு வகை' : 'Category Name',
          lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections'
        ];
        rows = sortedSubjectWiseData.map((row, idx) => [
          idx + 1,
          lang === 'ta' ? row.subjectNameTa : row.subjectNameEn,
          lang === 'ta' ? row.categoryNameTa : row.categoryNameEn,
          row.totalInspections
        ]);
      } else if (groupingStyle === 'user') {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'மண்டலம்' : 'Zone',
          lang === 'ta' ? 'மாவட்டம்' : 'District',
          lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
          lang === 'ta' ? 'பயனர் பெயர்' : 'User Name',
          lang === 'ta' ? 'பதவி' : 'Designation'
        ];
        if (userCols.subject) headers.push(lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject');
        if (userCols.category) headers.push(lang === 'ta' ? 'ஆய்வு வகை' : 'Category');
        headers.push(lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections');

        rows = sortedUserWiseData.map((row, idx) => {
          const item: (string | number)[] = [
            idx + 1,
            lang === 'ta' ? row.zoneNameTa : row.zoneNameEn,
            lang === 'ta' ? row.districtNameTa : row.districtNameEn,
            lang === 'ta' ? row.tpNameTa : row.tpNameEn,
            row.userName,
            row.userDesignation || ''
          ];
          if (userCols.subject) item.push(lang === 'ta' ? (row.subjectNameTa || '-') : (row.subjectNameEn || '-'));
          if (userCols.category) item.push(lang === 'ta' ? (row.categoryNameTa || '-') : (row.categoryNameEn || '-'));
          item.push(row.totalInspections);
          return item;
        });
      } else {
        headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'மண்டலம்' : 'Zone'
        ];
        if (locCols.district) headers.push(lang === 'ta' ? 'மாவட்டம்' : 'District');
        if (locCols.tp) headers.push(lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat');
        if (locCols.ward) headers.push(lang === 'ta' ? 'வார்டு' : 'Ward');
        if (locCols.street) headers.push(lang === 'ta' ? 'தெரு' : 'Street');
        if (locCols.subject) headers.push(lang === 'ta' ? 'பிரிவு' : 'Subject');
        if (locCols.category) headers.push(lang === 'ta' ? 'வகை' : 'Category');
        headers.push(lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspections');

        rows = sortedLocationWiseData.map((row, idx) => {
          const item: (string | number)[] = [
            idx + 1,
            lang === 'ta' ? row.zoneNameTa : row.zoneNameEn
          ];
          if (locCols.district) item.push(lang === 'ta' ? (row.districtNameTa || '-') : (row.districtNameEn || '-'));
          if (locCols.tp) item.push(lang === 'ta' ? (row.tpNameTa || '-') : (row.tpNameEn || '-'));
          if (locCols.ward) item.push(lang === 'ta' ? `வார்டு ${row.wardNumber || '0'}` : `Ward ${row.wardNumber || '0'}`);
          if (locCols.street) item.push(streetLabel(row));
          if (locCols.subject) item.push(lang === 'ta' ? (row.subjectNameTa || '-') : (row.subjectNameEn || '-'));
          if (locCols.category) item.push(lang === 'ta' ? (row.categoryNameTa || '-') : (row.categoryNameEn || '-'));
          item.push(row.totalInspections);
          return item;
        });
      }

      const totalRow: (string | number)[] = [lang === 'ta' ? 'மொத்தம்' : 'Total'];
      for (let i = 1; i < headers.length - 1; i++) {
        totalRow.push('-');
      }
      totalRow.push(totalSum);

      await generateHtmlTablePDF({
        title: lang === 'ta' ? 'பேரூராட்சிகள் கள ஆய்வுச் சுருக்க அறிக்கை' : 'Town Panchayat - Abstract Summary Report',
        subtitle: lang === 'ta'
          ? `வகைப்படுத்தல்: ${abstractGroupingLabel}`
          : `Grouping Style: ${abstractGroupingLabel}`,
        metadata: [
          { label: lang === 'ta' ? 'மொத்த ஆய்வுகள்' : 'Total Inspections', value: String(totalSum) },
          { label: lang === 'ta' ? 'வகைப்பாடு' : 'Grouping', value: abstractGroupingLabel },
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() }
        ],
        headers,
        rows,
        totalRow,
        filename: `Abstract_Summary_Report_${getTodayYmd()}.pdf`,
        landscape: groupingStyle !== 'subject',
        returnBlob: false,
        lang: lang === 'ta' ? 'ta' : 'en'
      });
    } catch (err: any) {
      console.error('Error generating Abstract PDF:', err);
      alert('Error creating PDF: ' + err.message);
    }
  };

  // Export Abstract Report - TP Wise Excel (Sheet 1: Total All TPs, subsequent sheets: Each TP)
  const handleExportAbstractTPWiseExcel = () => {
    try {
      const tpDataList = getTpWiseAbstractData();
      if (tpDataList.length === 0) {
        alert(lang === 'ta' ? 'பதிவிறக்கம் செய்ய பேரூராட்சி தரவுகள் இல்லை' : 'No Town Panchayat inspection records found');
        return;
      }

      const sheets: { name: string; data: (string | number)[][] }[] = [];

      // Sheet 1: Total All TPs Summary
      const sheet1Headers = lang === 'ta'
        ? ['வ.எண்', 'மண்டலம்', 'மாவட்டம்', 'பேரூராட்சி', 'மொத்த ஆய்வுகள்', 'நிறைவுற்றது', 'செயல்பாடு தேவை', 'நிலுவையில்']
        : ['S.No', 'Zone', 'District', 'Town Panchayat', 'Total Inspections', 'Completed', 'Action Required', 'Pending'];

      let totalInspectionsSum = 0;
      let totalCompletedSum = 0;
      let totalActionSum = 0;
      let totalPendingSum = 0;

      const sheet1Rows = tpDataList.map((tp, idx) => {
        let completed = 0;
        let actionRequired = 0;
        let pending = 0;
        tp.works.forEach(w => {
          const s = (w.status || 'Completed').toLowerCase();
          if (s.includes('complete') || s.includes('done')) completed++;
          else if (s.includes('action') || s.includes('require')) actionRequired++;
          else pending++;
        });

        totalInspectionsSum += tp.works.length;
        totalCompletedSum += completed;
        totalActionSum += actionRequired;
        totalPendingSum += pending;

        return [
          idx + 1,
          lang === 'ta' ? tp.zoneTa : tp.zoneEn,
          lang === 'ta' ? tp.districtTa : tp.districtEn,
          lang === 'ta' ? tp.nameTa : tp.nameEn,
          tp.works.length,
          completed,
          actionRequired,
          pending
        ];
      });

      const sheet1TotalRow = [
        lang === 'ta' ? 'மொத்தம்' : 'Total',
        '-',
        '-',
        '-',
        totalInspectionsSum,
        totalCompletedSum,
        totalActionSum,
        totalPendingSum
      ];

      const sheet1Data: (string | number)[][] = [
        [lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats'],
        [lang === 'ta' ? 'பேரூராட்சிகள் வாரியான கள ஆய்வுகள் சுருக்க அறிக்கை' : 'Town Panchayat Wise Field Inspections Abstract Summary Report'],
        [lang === 'ta' ? `அறிக்கை உருவாக்கப்பட்ட தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Generated on: ${new Date().toLocaleDateString()}`],
        [],
        sheet1Headers,
        ...sheet1Rows,
        sheet1TotalRow
      ];

      sheets.push({
        name: lang === 'ta' ? 'மொத்த பேரூராட்சிகள்' : 'Total All TPs',
        data: sheet1Data
      });

      // Subsequent Sheets: Each Town Panchayat's breakdown matching current table groupingStyle
      tpDataList.forEach((tp) => {
        let tpHeaders: string[] = [];
        let tpRows: (string | number)[][] = [];
        let tpTitle = '';

        if (groupingStyle === 'subject') {
          tpTitle = lang === 'ta'
            ? `${tp.nameTa} பேரூராட்சி • பிரிவு & வகை வாரியான கள ஆய்வு சுருக்கம்`
            : `${tp.nameEn} Town Panchayat • Subject & Category Wise Inspection Summary`;

          tpHeaders = lang === 'ta'
            ? ['வ.எண்', 'ஆய்வுப் பிரிவு', 'ஆய்வு வகை', 'ஆய்வு எண்ணிக்கை', 'நிறைவுற்றது', 'நிலுவையில்']
            : ['S.No', 'Subject', 'Category', 'Inspections Count', 'Completed', 'Pending'];

          const groups: Record<string, { sName: string; cName: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            const key = `${sName}___${cName}`;
            if (!groups[key]) {
              groups[key] = { sName, cName, count: 0, completed: 0, pending: 0 };
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => [
            gIdx + 1,
            g.sName,
            g.cName,
            g.count,
            g.completed,
            g.pending
          ]);
        } else if (groupingStyle === 'user') {
          tpTitle = lang === 'ta'
            ? `${tp.nameTa} பேரூராட்சி • பயனர் வாரியான கள ஆய்வு சுருக்கம்`
            : `${tp.nameEn} Town Panchayat • User Wise Inspection Summary`;

          tpHeaders = [
            lang === 'ta' ? 'வ.எண்' : 'S.No',
            lang === 'ta' ? 'பயனர் பெயர்' : 'User Name',
            lang === 'ta' ? 'பதவி' : 'Designation'
          ];
          if (userCols.subject) tpHeaders.push(lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject');
          if (userCols.category) tpHeaders.push(lang === 'ta' ? 'ஆய்வு வகை' : 'Category');
          tpHeaders.push(
            lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Inspections Count',
            lang === 'ta' ? 'நிறைவுற்றது' : 'Completed',
            lang === 'ta' ? 'நிலுவையில்' : 'Pending'
          );

          const groups: Record<string, { uName: string; uDesig: string; sName?: string; cName?: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const uName = w.submittedByUserName || (lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector');
            const uDesig = getInspectorDesignation(w);
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            let key = `${uName}___${uDesig}`;
            if (userCols.subject) key += `___${sName}`;
            if (userCols.category) key += `___${cName}`;

            if (!groups[key]) {
              groups[key] = { uName, uDesig, count: 0, completed: 0, pending: 0 };
              if (userCols.subject) groups[key].sName = sName;
              if (userCols.category) groups[key].cName = cName;
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => {
            const r: (string | number)[] = [
              gIdx + 1,
              g.uName,
              g.uDesig
            ];
            if (userCols.subject) r.push(g.sName || '-');
            if (userCols.category) r.push(g.cName || '-');
            r.push(g.count, g.completed, g.pending);
            return r;
          });
        } else {
          // Location Wise
          tpTitle = lang === 'ta'
            ? `${tp.nameTa} பேரூராட்சி • வார்டு மற்றும் தெரு வாரியான கள ஆய்வு சுருக்கம்`
            : `${tp.nameEn} Town Panchayat • Ward & Street Wise Inspection Summary`;

          tpHeaders = [
            lang === 'ta' ? 'வ.எண்' : 'S.No',
            lang === 'ta' ? 'வார்டு' : 'Ward',
            lang === 'ta' ? 'தெரு' : 'Street'
          ];
          if (locCols.subject) tpHeaders.push(lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject');
          if (locCols.category) tpHeaders.push(lang === 'ta' ? 'ஆய்வு வகை' : 'Category');
          tpHeaders.push(
            lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Inspections Count',
            lang === 'ta' ? 'நிறைவுற்றது' : 'Completed',
            lang === 'ta' ? 'நிலுவையில்' : 'Pending'
          );

          const groups: Record<string, { ward: string; street: string; sName?: string; cName?: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const ward = w.wardNumber ? (lang === 'ta' ? `வார்டு ${w.wardNumber}` : `Ward ${w.wardNumber}`) : '-';
            const street = streetLabel(w);
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            let key = `${ward}___${street}`;
            if (locCols.subject) key += `___${sName}`;
            if (locCols.category) key += `___${cName}`;

            if (!groups[key]) {
              groups[key] = { ward, street, count: 0, completed: 0, pending: 0 };
              if (locCols.subject) groups[key].sName = sName;
              if (locCols.category) groups[key].cName = cName;
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => {
            const r: (string | number)[] = [
              gIdx + 1,
              g.ward,
              g.street
            ];
            if (locCols.subject) r.push(g.sName || '-');
            if (locCols.category) r.push(g.cName || '-');
            r.push(g.count, g.completed, g.pending);
            return r;
          });
        }

        const countColIdx = tpHeaders.length - 3;
        const compColIdx = tpHeaders.length - 2;
        const pendColIdx = tpHeaders.length - 1;

        const tpTotal: (string | number)[] = [
          lang === 'ta' ? 'மொத்தம்' : 'Total',
          ...Array(countColIdx - 1).fill('-'),
          tpRows.reduce((sum, r) => sum + (Number(r[countColIdx]) || 0), 0),
          tpRows.reduce((sum, r) => sum + (Number(r[compColIdx]) || 0), 0),
          tpRows.reduce((sum, r) => sum + (Number(r[pendColIdx]) || 0), 0)
        ];

        const tpSheetData: (string | number)[][] = [
          [tpTitle],
          [
            lang === 'ta'
              ? `மண்டலம்: ${tp.zoneTa} | மாவட்டம்: ${tp.districtTa} | மொத்த ஆய்வுகள்: ${tp.works.length}`
              : `Zone: ${tp.zoneEn} | District: ${tp.districtEn} | Total Inspections: ${tp.works.length}`
          ],
          [lang === 'ta' ? `தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Date: ${new Date().toLocaleDateString()}`],
          [],
          tpHeaders,
          ...tpRows,
          tpTotal
        ];

        sheets.push({
          name: sanitizeSheetName(tp.nameEn),
          data: tpSheetData
        });
      });

      const reportStyleSuffix = groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location';
      exportMultiSheetExcel(sheets, `TP_Wise_${reportStyleSuffix}_Abstract_Report_${getTodayYmd()}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting TP Wise Excel:', err);
      alert('Error exporting Excel: ' + err.message);
    }
  };

  // Export Abstract Report - TP Wise PDF ZIP
  const handleExportAbstractTPWisePDF = async () => {
    try {
      const tpDataList = getTpWiseAbstractData();
      if (tpDataList.length === 0) {
        alert(lang === 'ta' ? 'பதிவிறக்கம் செய்ய பேரூராட்சி தரவுகள் இல்லை' : 'No Town Panchayat inspection records found');
        return;
      }

      setIsExportingZip(true);
      setExportStatusText(lang === 'ta' ? 'பேரூராட்சி வாரியான PDF கோப்புகள் தயாராகிறது...' : 'Generating TP Wise PDF reports...');

      const pdfFiles: { filename: string; blob: Blob }[] = [];

      // 1. Total All TPs Summary PDF
      const totalHeaders = lang === 'ta'
        ? ['வ.எண்', 'மண்டலம்', 'மாவட்டம்', 'பேரூராட்சி', 'மொத்த ஆய்வுகள்', 'நிறைவுற்றது', 'நிலுவையில்']
        : ['S.No', 'Zone', 'District', 'Town Panchayat', 'Total Inspections', 'Completed', 'Pending'];

      let grandTotal = 0;
      let grandCompleted = 0;
      let grandPending = 0;

      const totalRows = tpDataList.map((tp, idx) => {
        let completed = 0;
        let pending = 0;
        tp.works.forEach(w => {
          const s = (w.status || 'Completed').toLowerCase();
          if (s.includes('complete') || s.includes('done')) completed++;
          else pending++;
        });
        grandTotal += tp.works.length;
        grandCompleted += completed;
        grandPending += pending;

        return [
          idx + 1,
          lang === 'ta' ? tp.zoneTa : tp.zoneEn,
          lang === 'ta' ? tp.districtTa : tp.districtEn,
          lang === 'ta' ? tp.nameTa : tp.nameEn,
          tp.works.length,
          completed,
          pending
        ];
      });

      const totalSummaryResult = await generateHtmlTablePDF({
        title: lang === 'ta' ? 'அனைத்து பேரூராட்சிகள் - கள ஆய்வு சுருக்க அறிக்கை' : 'All Town Panchayats - Field Inspection Abstract Report',
        subtitle: lang === 'ta' ? 'மண்டலம் மற்றும் மாவட்ட வாரியான பேரூராட்சி ஆய்வுகள் ஒப்பீட்டுச் சுருக்கம்' : 'Comparative Inspection Summary across all Town Panchayats',
        metadata: [
          { label: lang === 'ta' ? 'மொத்த பேரூராட்சிகள்' : 'Total Town Panchayats', value: String(tpDataList.length) },
          { label: lang === 'ta' ? 'மொத்த ஆய்வுகள்' : 'Total Inspections', value: String(grandTotal) },
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() }
        ],
        headers: totalHeaders,
        rows: totalRows,
        totalRow: [lang === 'ta' ? 'மொத்தம்' : 'Total', '-', '-', '-', grandTotal, grandCompleted, grandPending],
        filename: 'Total_All_TP_Report.pdf',
        landscape: false,
        returnBlob: true,
        lang: lang === 'ta' ? 'ta' : 'en'
      });

      if (totalSummaryResult && typeof totalSummaryResult === 'object') {
        pdfFiles.push(totalSummaryResult);
      }

      // 2. Individual PDF for each Town Panchayat matching groupingStyle
      for (let i = 0; i < tpDataList.length; i++) {
        const tp = tpDataList[i];
        setExportStatusText(
          lang === 'ta' 
            ? `கோப்பு ${i + 1}/${tpDataList.length}: ${tp.nameTa} PDF தயாராகிறது...`
            : `Generating ${i + 1}/${tpDataList.length}: ${tp.nameEn} PDF...`
        );

        let tpTitle = '';
        let tpSubtitle = '';
        let tpHeaders: string[] = [];
        let tpRows: (string | number)[][] = [];
        let pdfFilename = '';

        if (groupingStyle === 'subject') {
          tpTitle = lang === 'ta' ? `${tp.nameTa} பேரூராட்சி - கள ஆய்வு சுருக்க அறிக்கை` : `${tp.nameEn} Town Panchayat - Inspection Abstract Report`;
          tpSubtitle = lang === 'ta' ? 'பிரிவு மற்றும் வகை வாரியான விரிவான கள ஆய்வு விவரங்கள்' : 'Subject & Category Level Inspection Summary';
          pdfFilename = `TP_${sanitizeSheetName(tp.nameEn)}_Subject_Report.pdf`;

          tpHeaders = lang === 'ta'
            ? ['வ.எண்', 'ஆய்வுப் பிரிவு', 'ஆய்வு வகை', 'ஆய்வு எண்ணிக்கை', 'நிறைவுற்றது', 'நிலுவையில்']
            : ['S.No', 'Subject', 'Category', 'Inspections Count', 'Completed', 'Pending'];

          const groups: Record<string, { sName: string; cName: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            const key = `${sName}___${cName}`;
            if (!groups[key]) {
              groups[key] = { sName, cName, count: 0, completed: 0, pending: 0 };
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => [
            gIdx + 1,
            g.sName,
            g.cName,
            g.count,
            g.completed,
            g.pending
          ]);
        } else if (groupingStyle === 'user') {
          tpTitle = lang === 'ta' ? `${tp.nameTa} பேரூராட்சி - பயனர் வாரியான கள ஆய்வு அறிக்கை` : `${tp.nameEn} Town Panchayat - User Wise Inspection Report`;
          tpSubtitle = lang === 'ta' ? 'பயனர் மற்றும் பதவி வாரியான விரிவான கள ஆய்வு விவரங்கள்' : 'User & Designation Level Inspection Summary';
          pdfFilename = `TP_${sanitizeSheetName(tp.nameEn)}_User_Report.pdf`;

          tpHeaders = [
            lang === 'ta' ? 'வ.எண்' : 'S.No',
            lang === 'ta' ? 'பயனர் பெயர்' : 'User Name',
            lang === 'ta' ? 'பதவி' : 'Designation'
          ];
          if (userCols.subject) tpHeaders.push(lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject');
          if (userCols.category) tpHeaders.push(lang === 'ta' ? 'ஆய்வு வகை' : 'Category');
          tpHeaders.push(
            lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Inspections Count',
            lang === 'ta' ? 'நிறைவுற்றது' : 'Completed',
            lang === 'ta' ? 'நிலுவையில்' : 'Pending'
          );

          const groups: Record<string, { uName: string; uDesig: string; sName?: string; cName?: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const uName = w.submittedByUserName || (lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector');
            const uDesig = getInspectorDesignation(w);
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            let key = `${uName}___${uDesig}`;
            if (userCols.subject) key += `___${sName}`;
            if (userCols.category) key += `___${cName}`;

            if (!groups[key]) {
              groups[key] = { uName, uDesig, count: 0, completed: 0, pending: 0 };
              if (userCols.subject) groups[key].sName = sName;
              if (userCols.category) groups[key].cName = cName;
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => {
            const r: (string | number)[] = [
              gIdx + 1,
              g.uName,
              g.uDesig
            ];
            if (userCols.subject) r.push(g.sName || '-');
            if (userCols.category) r.push(g.cName || '-');
            r.push(g.count, g.completed, g.pending);
            return r;
          });
        } else {
          // Location Wise
          tpTitle = lang === 'ta' ? `${tp.nameTa} பேரூராட்சி - வார்டு மற்றும் தெரு வாரியான ஆய்வு அறிக்கை` : `${tp.nameEn} Town Panchayat - Location Wise Inspection Report`;
          tpSubtitle = lang === 'ta' ? 'வார்டு மற்றும் தெரு வாரியான விரிவான கள ஆய்வு விவரங்கள்' : 'Ward & Street Level Inspection Summary';
          pdfFilename = `TP_${sanitizeSheetName(tp.nameEn)}_Location_Report.pdf`;

          tpHeaders = [
            lang === 'ta' ? 'வ.எண்' : 'S.No',
            lang === 'ta' ? 'வார்டு' : 'Ward',
            lang === 'ta' ? 'தெரு' : 'Street'
          ];
          if (locCols.subject) tpHeaders.push(lang === 'ta' ? 'பிரிவு' : 'Subject');
          if (locCols.category) tpHeaders.push(lang === 'ta' ? 'வகை' : 'Category');
          tpHeaders.push(
            lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Inspections Count',
            lang === 'ta' ? 'நிறைவுற்றது' : 'Completed',
            lang === 'ta' ? 'நிலுவையில்' : 'Pending'
          );

          const groups: Record<string, { ward: string; street: string; sName?: string; cName?: string; count: number; completed: number; pending: number }> = {};
          tp.works.forEach(w => {
            const ward = w.wardNumber ? (lang === 'ta' ? `வார்டு ${w.wardNumber}` : `Ward ${w.wardNumber}`) : '-';
            const street = streetLabel(w);
            const sName = lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || w.subjectNameTa || '-');
            const cName = lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || w.categoryNameTa || '-');
            let key = `${ward}___${street}`;
            if (locCols.subject) key += `___${sName}`;
            if (locCols.category) key += `___${cName}`;

            if (!groups[key]) {
              groups[key] = { ward, street, count: 0, completed: 0, pending: 0 };
              if (locCols.subject) groups[key].sName = sName;
              if (locCols.category) groups[key].cName = cName;
            }
            groups[key].count++;
            const s = (w.status || 'Completed').toLowerCase();
            if (s.includes('complete') || s.includes('done')) groups[key].completed++;
            else groups[key].pending++;
          });

          tpRows = Object.values(groups).map((g, gIdx) => {
            const r: (string | number)[] = [
              gIdx + 1,
              g.ward,
              g.street
            ];
            if (locCols.subject) r.push(g.sName || '-');
            if (locCols.category) r.push(g.cName || '-');
            r.push(g.count, g.completed, g.pending);
            return r;
          });
        }

        const countColIdx = tpHeaders.length - 3;
        const compColIdx = tpHeaders.length - 2;
        const pendColIdx = tpHeaders.length - 1;

        const tpTotal: (string | number)[] = [
          lang === 'ta' ? 'மொத்தம்' : 'Total',
          ...Array(countColIdx - 1).fill('-'),
          tpRows.reduce((sum, r) => sum + (Number(r[countColIdx]) || 0), 0),
          tpRows.reduce((sum, r) => sum + (Number(r[compColIdx]) || 0), 0),
          tpRows.reduce((sum, r) => sum + (Number(r[pendColIdx]) || 0), 0)
        ];

        const singleTpResult = await generateHtmlTablePDF({
          title: tpTitle,
          subtitle: tpSubtitle,
          metadata: [
            { label: lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat', value: lang === 'ta' ? tp.nameTa : tp.nameEn },
            { label: lang === 'ta' ? 'மாவட்டம்' : 'District', value: lang === 'ta' ? tp.districtTa : tp.districtEn },
            { label: lang === 'ta' ? 'மண்டலம்' : 'Zone', value: lang === 'ta' ? tp.zoneTa : tp.zoneEn },
            { label: lang === 'ta' ? 'மொத்த ஆய்வுகள்' : 'Total Inspections', value: String(tp.works.length) }
          ],
          headers: tpHeaders,
          rows: tpRows,
          totalRow: tpTotal,
          filename: pdfFilename,
          landscape: false,
          returnBlob: true,
          lang: lang === 'ta' ? 'ta' : 'en'
        });

        if (singleTpResult && typeof singleTpResult === 'object') {
          pdfFiles.push(singleTpResult);
        }
      }

      const reportStyleSuffix = groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location';
      setExportStatusText(lang === 'ta' ? 'ஜிப் கோப்பாக சுருக்கப்படுகிறது...' : 'Packaging ZIP archive...');
      await downloadZipArchive(pdfFiles, `TP_Wise_${reportStyleSuffix}_Reports_${getTodayYmd()}.zip`);
    } catch (err: any) {
      console.error('Error exporting TP Wise PDF ZIP:', err);
      alert('Error creating ZIP: ' + err.message);
    } finally {
      setIsExportingZip(false);
      setExportStatusText('');
    }
  };

  // Helper function to escape XML special characters
  const escapeXml = (str: string | number | null | undefined): string => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // Download as Excel for Not Entered Single Entry User List with Zone, District, and Last Work Entry
  const handleExportZeroUsersExcel = () => {
    const rowsHtml = zeroEntryUsers.map((user: any, idx: number) => `
      <tr>
        <td style="border: 1px solid #000000; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000000; font-weight: bold;">${user.nameEn || user.username}</td>
        <td style="border: 1px solid #000000;">${user.username || '-'}</td>
        <td style="border: 1px solid #000000;">${user.resolvedDesignation || user.designation || 'Field Worker'}</td>
        <td style="border: 1px solid #000000;">${user.mobile || '-'}</td>
        <td style="border: 1px solid #000000;">${user.zoneNameEn || '-'}</td>
        <td style="border: 1px solid #000000;">${user.districtNameEn || '-'}</td>
        <td style="border: 1px solid #000000;">${user.tpNameEn || user.tpId || '-'}</td>
        <td style="border: 1px solid #000000; font-family: monospace;">${user.lastWorkEntry || 'Never'}</td>
        <td style="border: 1px solid #000000; text-align: center; color: #b91c1c; font-weight: bold;">0 Entries</td>
      </tr>
    `).join('');

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
          th { border: 1px solid #000000; background-color: #fee2e2; padding: 8px; font-size: 11px; font-weight: bold; }
          td { border: 1px solid #000000; padding: 6px; font-size: 10px; }
        </style>
      </head>
      <body>
        <h3 style="color: #b91c1c; font-family: sans-serif;">Employees with 0 Work Entries (Not Entered Single Entry User List)</h3>
        <p style="font-family: sans-serif; font-size: 11px; color: #475569;">Total Users with 0 Entries: ${zeroEntryUsers.length} | Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>S.No</th>
              <th>Employee Name</th>
              <th>Username</th>
              <th>Designation</th>
              <th>Mobile</th>
              <th>Zone</th>
              <th>District</th>
              <th>Town Panchayat</th>
              <th>Last Work Entry Date & Time</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Not_Entered_Users_List_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download as PDF for Not Entered Single Entry User List with Zone, District, and Last Work Entry
  const handleExportZeroUsersPDF = async () => {
    try {
      const headers = [
        lang === 'ta' ? 'வ.எண்' : 'S.No',
        lang === 'ta' ? 'பணியாளர் பெயர்' : 'Employee Name',
        lang === 'ta' ? 'பயனர் ஐடி' : 'Username',
        lang === 'ta' ? 'பதவி' : 'Designation',
        lang === 'ta' ? 'கைபேசி' : 'Mobile',
        lang === 'ta' ? 'மண்டலம்' : 'Zone',
        lang === 'ta' ? 'மாவட்டம்' : 'District',
        lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
        lang === 'ta' ? 'கடைசி ஆய்வுப் பதிவு' : 'Last Entry Date/Time',
        lang === 'ta' ? 'நிலை' : 'Status'
      ];
      const rows = zeroEntryUsers.map((u: any, idx: number) => [
        idx + 1,
        lang === 'ta' ? (u.nameTa || u.nameEn || u.username) : (u.nameEn || u.username),
        u.username || '-',
        u.resolvedDesignation || u.designation || 'Field Worker',
        u.mobile || '-',
        lang === 'ta' ? (u.zoneNameTa || u.zoneNameEn || '-') : (u.zoneNameEn || '-'),
        lang === 'ta' ? (u.districtNameTa || u.districtNameEn || '-') : (u.districtNameEn || '-'),
        lang === 'ta' ? (u.tpNameTa || u.tpNameEn || u.tpId || '-') : (u.tpNameEn || u.tpId || '-'),
        u.lastWorkEntry || 'Never',
        lang === 'ta' ? '0 ஆய்வுகள்' : '0 Entries'
      ]);

      await generateHtmlTablePDF({
        title: lang === 'ta' ? 'ஆய்வு மேற்கொள்ளாத பணியாளர்கள் பட்டியல்' : 'Employees with 0 Work Entries (Not Entered List)',
        subtitle: lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின்படி ஆய்வுப் பதிவு செய்யாதவர்கள்' : 'List of officers/inspectors with 0 inspection submissions',
        metadata: [
          { label: lang === 'ta' ? 'மொத்தப் பணியாளர்கள்' : 'Total Users', value: String(zeroEntryUsers.length) },
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() }
        ],
        headers,
        rows,
        filename: `Not_Entered_Users_${getTodayYmd()}.pdf`,
        landscape: true,
        returnBlob: false,
        lang: lang === 'ta' ? 'ta' : 'en'
      });
    } catch (err: any) {
      console.error('Error exporting zero users PDF:', err);
      alert('Error: ' + err.message);
    }
  };

  // Download as Excel for Not Entered Subject & Category List
  const handleExportZeroCategoriesExcel = () => {
    const rowsHtml = zeroEntryCategories.map((cat: any, idx: number) => `
      <tr>
        <td style="border: 1px solid #000000; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid #000000; font-weight: bold;">${lang === 'ta' ? (cat.subjectNameTa || cat.subjectNameEn) : cat.subjectNameEn}</td>
        <td style="border: 1px solid #000000;">${cat.subjectNameTa || '-'}</td>
        <td style="border: 1px solid #000000; font-weight: bold;">${lang === 'ta' ? (cat.nameTa || cat.nameEn) : cat.nameEn}</td>
        <td style="border: 1px solid #000000;">${cat.nameTa || '-'}</td>
        <td style="border: 1px solid #000000; text-align: center;">${cat.code || '-'}</td>
        <td style="border: 1px solid #000000; text-align: center; color: #d97706; font-weight: bold;">${lang === 'ta' ? '0 ஆய்வுகள்' : '0 Entries'}</td>
      </tr>
    `).join('');

    const template = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <style>
          table { border-collapse: collapse; width: 100%; font-family: sans-serif; }
          th { border: 1px solid #000000; background-color: #fef3c7; padding: 8px; font-size: 11px; font-weight: bold; }
          td { border: 1px solid #000000; padding: 6px; font-size: 10px; }
        </style>
      </head>
      <body>
        <h3 style="color: #d97706; font-family: sans-serif;">${lang === 'ta' ? 'ஆய்வு மேற்கொள்ளப்படாத பிரிவுகள் & வகைகள்' : 'Not Entered Subject & Category List (0 Work Entries)'}</h3>
        <p style="font-family: sans-serif; font-size: 11px; color: #475569;">${lang === 'ta' ? 'மொத்தம்' : 'Total'}: ${zeroEntryCategories.length} | Generated: ${new Date().toLocaleString()}</p>
        <table>
          <thead>
            <tr>
              <th>${lang === 'ta' ? 'வ.எண்' : 'S.No'}</th>
              <th>${lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject (English)'}</th>
              <th>${lang === 'ta' ? 'பிரிவு (தமிழ்)' : 'Subject (Tamil)'}</th>
              <th>${lang === 'ta' ? 'ஆய்வு வகை' : 'Category (English)'}</th>
              <th>${lang === 'ta' ? 'வகை (தமிழ்)' : 'Category (Tamil)'}</th>
              <th>${lang === 'ta' ? 'குறியீடு' : 'Category Code'}</th>
              <th>${lang === 'ta' ? 'நிலை' : 'Status'}</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([template], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Not_Entered_Categories_List_${getTodayYmd()}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download as PDF for Not Entered Subject & Category List
  const handleExportZeroCategoriesPDF = async () => {
    try {
      const headers = [
        lang === 'ta' ? 'வ.எண்' : 'S.No',
        lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject',
        lang === 'ta' ? 'ஆய்வு வகை' : 'Category',
        lang === 'ta' ? 'குறியீடு' : 'Code',
        lang === 'ta' ? 'நிலை' : 'Status'
      ];
      const rows = zeroEntryCategories.map((c: any, idx: number) => [
        idx + 1,
        lang === 'ta' ? (c.subjectNameTa || c.subjectNameEn) : c.subjectNameEn,
        lang === 'ta' ? (c.nameTa || c.nameEn) : c.nameEn,
        c.code || '-',
        lang === 'ta' ? '0 ஆய்வுகள்' : '0 Entries'
      ]);

      await generateHtmlTablePDF({
        title: lang === 'ta' ? 'ஆய்வு செய்யப்படாத பிரிவுகள் & வகைகள்' : 'Not Entered Subject & Category List (0 Entries)',
        subtitle: lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின் கீழ் 0 ஆய்வு செய்யப்பட்டவை' : 'Categories with 0 work entries based on current filters',
        metadata: [
          { label: lang === 'ta' ? 'மொத்த வகைகள்' : 'Total Categories', value: String(zeroEntryCategories.length) },
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() }
        ],
        headers,
        rows,
        filename: `Not_Entered_Categories_${getTodayYmd()}.pdf`,
        landscape: false,
        returnBlob: false,
        lang: lang === 'ta' ? 'ta' : 'en'
      });
    } catch (err: any) {
      console.error('Error exporting zero categories PDF:', err);
      alert('Error: ' + err.message);
    }
  };

  // Download Detailed Field Register as Excel with full Tamil/English support
  const handleExportDetailedExcel = async () => {
    if (isExportingExcelRef.current) return;
    isExportingExcelRef.current = true;
    setIsExportingExcel(true);
    try {
      const exportWorks = await fetchAllFilteredWorksForExport();
      const targetCats = selectedCategoryId !== 'all'
        ? (availableCategories || []).filter((c: any) => {
            const sCat = String(selectedCategoryId).trim().toLowerCase();
            return String(c.id).trim().toLowerCase() === sCat || String(c.nameEn || '').trim().toLowerCase() === sCat || String(c.code || '').trim().toLowerCase() === sCat;
          })
        : availableCategories;

      const sheets: { name: string; data: (string | number)[][] }[] = [];

      targetCats.forEach((cat: any) => {
        const targetId = String(cat.id || '').trim().toLowerCase();
        const targetName = String(cat.nameEn || '').trim().toLowerCase();
        const targetNameTa = String(cat.nameTa || '').trim().toLowerCase();
        const targetCode = String(cat.code || '').trim().toLowerCase();

        const catWorks = exportWorks.filter(w => {
          const wCat = String(w.categoryId || '').trim().toLowerCase();
          const wCatName = String(w.categoryNameEn || '').trim().toLowerCase();
          const wCatNameTa = String(w.categoryNameTa || '').trim().toLowerCase();
          return wCat === targetId || (targetCode && wCat === targetCode) || wCatName === targetName || (targetNameTa && wCatNameTa === targetNameTa);
        });
        if (catWorks.length === 0 && selectedCategoryId === 'all') {
          return;
        }

        // Collect all dynamic fields for this category
        const dynamicFieldCols: { id: string; label: string }[] = [];
        (state.inspectionFields || []).filter((f: any) => f.categoryId === cat.id).forEach((f: any) => {
          const label = lang === 'ta' ? f.nameTa || f.nameEn : f.nameEn;
          if (!dynamicFieldCols.some(c => c.id === f.id)) {
            dynamicFieldCols.push({ id: f.id, label });
          }
        });

        const headers = [
          lang === 'ta' ? 'வ.எண்' : 'S.No',
          lang === 'ta' ? 'பணி எண்' : 'Work ID',
          lang === 'ta' ? 'தேதி & நேரம் (IST)' : 'Date & Time (IST)',
          lang === 'ta' ? 'பிரிவு' : 'Subject',
          lang === 'ta' ? 'வகை' : 'Category',
          lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
          lang === 'ta' ? 'வார்டு' : 'Ward',
          lang === 'ta' ? 'தெரு' : 'Street',
          lang === 'ta' ? 'பயனர் பெயர்' : 'User Name',
          lang === 'ta' ? 'பதவி' : 'Designation',
          lang === 'ta' ? 'ஜிபிஎஸ் அட்சரேகை' : 'GPS Lat',
          lang === 'ta' ? 'ஜிபிஎஸ் தீர்க்கரேகை' : 'GPS Lng',
          ...dynamicFieldCols.map(df => df.label),
          lang === 'ta' ? 'நிலை' : 'Status'
        ];

        const rows = catWorks.map((work, idx) => [
          idx + 1,
          work.workId || work.id || '',
          formatIndianTime(work.submittedAt),
          lang === 'ta' ? work.subjectNameTa || work.subjectNameEn || '' : work.subjectNameEn || '',
          lang === 'ta' ? work.categoryNameTa || work.categoryNameEn || '' : work.categoryNameEn || '',
          lang === 'ta' ? work.tpNameTa || work.tpNameEn || '-' : work.tpNameEn || '-',
          `${lang === 'ta' ? 'வார்டு' : 'Ward'} ${work.wardNumber || work.wardNo || '-'}`,
          streetLabel(work),
          work.submittedByUserName || 'Field Cadre',
          getInspectorDesignation(work),
          work.latitude ? Number(work.latitude).toFixed(5) : '-',
          work.longitude ? Number(work.longitude).toFixed(5) : '-',
          ...dynamicFieldCols.map((df) => {
            const val = getWorkDynamicFieldValue(work, df, state.inspectionFields || []);
            if (val.startsWith('http')) return '[Photo]';
            return val || '-';
          }),
          lang === 'ta'
            ? ((work.status || 'Completed').toLowerCase().includes('complete') ? 'நிறைவுற்றது' : 'நிலுவையில்')
            : (work.status || 'Completed')
        ]);

        const catTitle = lang === 'ta' ? cat.nameTa || cat.nameEn : cat.nameEn;
        sheets.push({
          name: sanitizeSheetName(cat.nameEn || `Cat_${cat.id}`),
          data: [
            [lang === 'ta' ? `கள ஆய்வுப் பதிவேடு • ${catTitle}` : `Field Inspection Register • ${catTitle}`],
            [lang === 'ta' ? `மொத்தப் பணிகள்: ${catWorks.length} | தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Total Entries: ${catWorks.length} | Date: ${new Date().toLocaleDateString()}`],
            [],
            headers,
            ...rows
          ]
        });
      });

      if (sheets.length === 0) {
        sheets.push({
          name: 'Detailed Register',
          data: [
            [lang === 'ta' ? 'தரவுகள் எதுவும் இல்லை' : 'No records found matching filters']
          ]
        });
      }

      exportMultiSheetExcel(sheets, `Detailed_Field_Register_${getTodayYmd()}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting Detailed Excel:', err);
      alert('Error: ' + err.message);
    } finally {
      isExportingExcelRef.current = false;
      setIsExportingExcel(false);
    }
  };

  // Download Detailed Field Register as PDF with native Tamil font support
  const handleExportDetailedPDF = async () => {
    if (isExportingPdfRef.current) return;
    isExportingPdfRef.current = true;
    setIsExportingPdf(true);
    try {
      const exportWorks = await fetchAllFilteredWorksForExport();
      if (exportWorks.length === 0) {
        alert(lang === 'ta' ? 'பதிவிறக்கம் செய்ய ஆய்வுகள் எதுவும் இல்லை' : 'No inspection records found');
        return;
      }

      const headers = [
        lang === 'ta' ? 'வ.எண்' : 'S.No',
        lang === 'ta' ? 'பணி எண்' : 'Work ID',
        lang === 'ta' ? 'தேதி & நேரம் (IST)' : 'Date & Time (IST)',
        lang === 'ta' ? 'பிரிவு' : 'Subject',
        lang === 'ta' ? 'வகை' : 'Category',
        lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat',
        lang === 'ta' ? 'வார்டு' : 'Ward',
        lang === 'ta' ? 'தெரு' : 'Street',
        lang === 'ta' ? 'ஆய்வாளர்' : 'Inspector',
        lang === 'ta' ? 'பதவி' : 'Designation',
        lang === 'ta' ? 'ஜிபிஎஸ்' : 'GPS',
        lang === 'ta' ? 'நிலை' : 'Status'
      ];

      const rows = exportWorks.map((w, idx) => {
        const geo = resolveGeoNames(w.zoneId, w.districtId, w.tpId || w.townPanchayatId, w);
        const subj = (state.inspectionSubjects || []).find(
          (s: any) => s.id === w.subjectId || s.code === w.subjectId || s.nameEn === w.subjectNameEn
        );
        const cat = (state.inspectionCategories || []).find(
          (c: any) => c.id === w.categoryId || c.code === w.categoryId || c.nameEn === w.categoryNameEn
        );
        return [
        idx + 1,
        w.workId || w.id || '',
        formatIndianTime(w.submittedAt),
        lang === 'ta' ? (subj?.nameTa || w.subjectNameTa || w.subjectNameEn || '-') : (subj?.nameEn || w.subjectNameEn || '-'),
        lang === 'ta' ? (cat?.nameTa || w.categoryNameTa || w.categoryNameEn || '-') : (cat?.nameEn || w.categoryNameEn || '-'),
        lang === 'ta' ? geo.tpNameTa : geo.tpNameEn,
        `${lang === 'ta' ? 'வார்டு' : 'Ward'} ${w.wardNumber || w.wardNo || '-'}`,
        geo.streetName,
        w.submittedByUserName || (lang === 'ta' ? 'கள பணியாளர்' : 'Field Cadre'),
        getInspectorDesignation(w),
        w.latitude && w.longitude ? `${Number(w.latitude).toFixed(3)}, ${Number(w.longitude).toFixed(3)}` : '-',
        lang === 'ta'
          ? ((w.status || 'Completed').toLowerCase().includes('complete') ? 'நிறைவுற்றது' : 'நிலுவையில்')
          : (w.status || 'Completed')
      ];
      });

      await generateHtmlTablePDF({
        title: lang === 'ta' ? 'கள ஆய்வுப் பதிவேடு (விரிவான அறிக்கை)' : 'Field Inspection Detailed Register',
        subtitle: lang === 'ta' ? 'முழுமையான கள ஆய்வு விவரங்கள் மற்றும் அலுவலர் தகவல்கள்' : 'Comprehensive Inspection Entries with Inspector Details',
        metadata: [
          { label: lang === 'ta' ? 'மொத்தப் பதிவுகள்' : 'Total Entries', value: String(exportWorks.length) },
          { label: lang === 'ta' ? 'தேதி வரம்பு' : 'Period', value: `${fromDate} - ${toDate}` },
          { label: lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat', value: selectedTpId === 'all' ? (lang === 'ta' ? 'அனைத்தும்' : 'All') : selectedTpId }
        ],
        headers,
        rows,
        filename: `Detailed_Field_Register_${getTodayYmd()}.pdf`,
        landscape: true,
        returnBlob: false,
        lang: lang === 'ta' ? 'ta' : 'en'
      });
    } catch (err: any) {
      console.error('Error generating Detailed PDF:', err);
      alert('Error creating PDF: ' + err.message);
    } finally {
      isExportingPdfRef.current = false;
      setIsExportingPdf(false);
    }
  };

  // Export Detailed Field Register - TP Wise Excel (Sheet 1: Total All TPs, subsequent sheets: Each TP)
  const handleExportDetailedTPWiseExcel = () => {
    try {
      const tpDataList = getTpWiseAbstractData();
      if (tpDataList.length === 0) {
        alert(lang === 'ta' ? 'பதிவிறக்கம் செய்ய பேரூராட்சி தரவுகள் இல்லை' : 'No Town Panchayat inspection records found');
        return;
      }

      const sheets: { name: string; data: (string | number)[][] }[] = [];

      // Sheet 1: Summary of all TPs
      const sheet1Headers = lang === 'ta'
        ? ['வ.எண்', 'மண்டலம்', 'மாவட்டம்', 'பேரூராட்சி', 'மொத்த பணிகள்', 'கடைசி ஆய்வு தேதி']
        : ['S.No', 'Zone', 'District', 'Town Panchayat', 'Total Records', 'Last Inspection Date'];

      let grandTotalWorks = 0;
      const sheet1Rows = tpDataList.map((tp, idx) => {
        grandTotalWorks += tp.works.length;
        const lastWork = tp.works[0];
        const lastDate = lastWork ? formatIndianTime(lastWork.submittedAt) : '-';
        return [
          idx + 1,
          lang === 'ta' ? tp.zoneTa : tp.zoneEn,
          lang === 'ta' ? tp.districtTa : tp.districtEn,
          lang === 'ta' ? tp.nameTa : tp.nameEn,
          tp.works.length,
          lastDate
        ];
      });

      sheets.push({
        name: lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'Total All TPs',
        data: [
          [lang === 'ta' ? 'பேரூராட்சிகள் இயக்ககம்' : 'Directorate of Town Panchayats'],
          [lang === 'ta' ? 'பேரூராட்சிகள் வாரியான கள ஆய்வுப் பதிவேடு சுருக்கம்' : 'Town Panchayat Wise Detailed Inspection Register Summary'],
          [lang === 'ta' ? `அறிக்கை தேதி: ${new Date().toLocaleDateString('ta-IN')}` : `Date: ${new Date().toLocaleDateString()}`],
          [],
          sheet1Headers,
          ...sheet1Rows,
          [lang === 'ta' ? 'மொத்தம்' : 'Total', '-', '-', '-', grandTotalWorks, '-']
        ]
      });

      // Subsequent sheets: Each TP's detailed entries
      tpDataList.forEach((tp) => {
        const tpHeaders = lang === 'ta'
          ? ['வ.எண்', 'பணி எண்', 'தேதி & நேரம் (IST)', 'பிரிவு', 'வகை', 'வார்டு', 'தெரு', 'ஆய்வாளர்', 'பதவி', 'ஜிபிஎஸ்', 'நிலை']
          : ['S.No', 'Work ID', 'Date & Time (IST)', 'Subject', 'Category', 'Ward', 'Street', 'Inspector', 'Designation', 'GPS', 'Status'];

        const tpRows = tp.works.map((w, wIdx) => [
          wIdx + 1,
          w.workId || w.id || '',
          formatIndianTime(w.submittedAt),
          lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || '-'),
          lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || '-'),
          `${lang === 'ta' ? 'வார்டு' : 'Ward'} ${w.wardNumber || w.wardNo || '-'}`,
          streetLabel(w),
          w.submittedByUserName || 'Field Cadre',
          getInspectorDesignation(w),
          w.latitude && w.longitude ? `${Number(w.latitude).toFixed(4)}, ${Number(w.longitude).toFixed(4)}` : '-',
          lang === 'ta' 
            ? ((w.status || 'Completed').toLowerCase().includes('complete') ? 'நிறைவுற்றது' : 'நிலுவையில்')
            : (w.status || 'Completed')
        ]);

        sheets.push({
          name: sanitizeSheetName(tp.nameEn),
          data: [
            [lang === 'ta' ? `${tp.nameTa} பேரூராட்சி • விரிவான கள ஆய்வுப் பதிவேடு` : `${tp.nameEn} Town Panchayat • Detailed Inspection Register`],
            [
              lang === 'ta'
                ? `மண்டலம்: ${tp.zoneTa} | மாவட்டம்: ${tp.districtTa} | மொத்த பணிகள்: ${tp.works.length}`
                : `Zone: ${tp.zoneEn} | District: ${tp.districtEn} | Total Records: ${tp.works.length}`
            ],
            [],
            tpHeaders,
            ...tpRows
          ]
        });
      });

      exportMultiSheetExcel(sheets, `TP_Wise_Detailed_Register_${getTodayYmd()}.xlsx`);
    } catch (err: any) {
      console.error('Error exporting TP Wise Detailed Excel:', err);
      alert('Error: ' + err.message);
    }
  };

  // Export Detailed Field Register - TP Wise PDF ZIP
  const handleExportDetailedTPWisePDF = async () => {
    try {
      const tpDataList = getTpWiseAbstractData();
      if (tpDataList.length === 0) {
        alert(lang === 'ta' ? 'பதிவிறக்கம் செய்ய பேரூராட்சி தரவுகள் இல்லை' : 'No Town Panchayat inspection records found');
        return;
      }

      setIsExportingZip(true);
      setExportStatusText(lang === 'ta' ? 'விரிவான பதிவேடு PDF கோப்புகள் தயாராகிறது...' : 'Generating TP Wise Detailed PDF registers...');

      const pdfFiles: { filename: string; blob: Blob }[] = [];

      // 1. Total All TPs Overview PDF
      const totalHeaders = lang === 'ta'
        ? ['வ.எண்', 'மண்டலம்', 'மாவட்டம்', 'பேரூராட்சி', 'மொத்த பணிகள்', 'கடைசி ஆய்வு தேதி']
        : ['S.No', 'Zone', 'District', 'Town Panchayat', 'Total Records', 'Last Inspection Date'];

      let grandTotalWorks = 0;
      const totalRows = tpDataList.map((tp, idx) => {
        grandTotalWorks += tp.works.length;
        const lastWork = tp.works[0];
        const lastDate = lastWork ? formatIndianTime(lastWork.submittedAt) : '-';
        return [
          idx + 1,
          lang === 'ta' ? tp.zoneTa : tp.zoneEn,
          lang === 'ta' ? tp.districtTa : tp.districtEn,
          lang === 'ta' ? tp.nameTa : tp.nameEn,
          tp.works.length,
          lastDate
        ];
      });

      const totalResult = await generateHtmlTablePDF({
        title: lang === 'ta' ? 'அனைத்து பேரூராட்சிகள் - விரிவான கள ஆய்வுப் பதிவேடு சுருக்கம்' : 'All Town Panchayats - Detailed Inspection Register Summary',
        subtitle: lang === 'ta' ? 'பேரூராட்சிகள் வாரியாக ஆய்வுப் பதிவேடு தொகுப்பு' : 'Town Panchayat Level Register Overview',
        metadata: [
          { label: lang === 'ta' ? 'மொத்த பேரூராட்சிகள்' : 'Total Town Panchayats', value: String(tpDataList.length) },
          { label: lang === 'ta' ? 'மொத்தப் பணிகள்' : 'Total Records', value: String(grandTotalWorks) },
          { label: lang === 'ta' ? 'தேதி' : 'Date', value: getTodayYmd() }
        ],
        headers: totalHeaders,
        rows: totalRows,
        totalRow: [lang === 'ta' ? 'மொத்தம்' : 'Total', '-', '-', '-', grandTotalWorks, '-'],
        filename: 'Total_All_TPs_Detailed_Register.pdf',
        landscape: true,
        returnBlob: true,
        lang: lang === 'ta' ? 'ta' : 'en'
      });

      if (totalResult && typeof totalResult === 'object') {
        pdfFiles.push(totalResult);
      }

      // 2. Individual Detailed PDF for each TP
      for (let i = 0; i < tpDataList.length; i++) {
        const tp = tpDataList[i];
        setExportStatusText(
          lang === 'ta'
            ? `கோப்பு ${i + 1}/${tpDataList.length}: ${tp.nameTa} விரிவான PDF தயாராகிறது...`
            : `Generating ${i + 1}/${tpDataList.length}: ${tp.nameEn} Detailed PDF...`
        );

        const tpHeaders = lang === 'ta'
          ? ['வ.எண்', 'பணி எண்', 'தேதி & நேரம்', 'பிரிவு', 'வகை', 'வார்டு', 'தெரு', 'ஆய்வாளர்', 'பதவி', 'நிலை']
          : ['S.No', 'Work ID', 'Date & Time', 'Subject', 'Category', 'Ward', 'Street', 'Inspector', 'Designation', 'Status'];

        const tpRows = tp.works.map((w, wIdx) => [
          wIdx + 1,
          w.workId || w.id || '',
          formatIndianTime(w.submittedAt),
          lang === 'ta' ? (w.subjectNameTa || w.subjectNameEn || '-') : (w.subjectNameEn || '-'),
          lang === 'ta' ? (w.categoryNameTa || w.categoryNameEn || '-') : (w.categoryNameEn || '-'),
          `${lang === 'ta' ? 'வார்டு' : 'Ward'} ${w.wardNumber || w.wardNo || '-'}`,
          streetLabel(w),
          w.submittedByUserName || 'Field Cadre',
          getInspectorDesignation(w),
          lang === 'ta'
            ? ((w.status || 'Completed').toLowerCase().includes('complete') ? 'நிறைவுற்றது' : 'நிலுவையில்')
            : (w.status || 'Completed')
        ]);

        const tpResult = await generateHtmlTablePDF({
          title: lang === 'ta' ? `${tp.nameTa} பேரூராட்சி - கள ஆய்வுப் பதிவேடு` : `${tp.nameEn} Town Panchayat - Field Inspection Register`,
          subtitle: lang === 'ta' ? 'விரிவான ஆய்வுப் பதிவுகள் மற்றும் களப் பணியாளர்கள் விவரம்' : 'Comprehensive Inspection Entries and Field Officer Details',
          metadata: [
            { label: lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat', value: lang === 'ta' ? tp.nameTa : tp.nameEn },
            { label: lang === 'ta' ? 'மாவட்டம்' : 'District', value: lang === 'ta' ? tp.districtTa : tp.districtEn },
            { label: lang === 'ta' ? 'மண்டலம்' : 'Zone', value: lang === 'ta' ? tp.zoneTa : tp.zoneEn },
            { label: lang === 'ta' ? 'மொத்தப் பணிகள்' : 'Total Works', value: String(tp.works.length) }
          ],
          headers: tpHeaders,
          rows: tpRows,
          filename: `TP_${sanitizeSheetName(tp.nameEn)}_Detailed_Register.pdf`,
          landscape: true,
          returnBlob: true,
          lang: lang === 'ta' ? 'ta' : 'en'
        });

        if (tpResult && typeof tpResult === 'object') {
          pdfFiles.push(tpResult);
        }
      }

      setExportStatusText(lang === 'ta' ? 'ஜிப் கோப்பாக சுருக்கப்படுகிறது...' : 'Packaging ZIP archive...');
      await downloadZipArchive(pdfFiles, `TP_Wise_Detailed_Registers_${getTodayYmd()}.zip`);
    } catch (err: any) {
      console.error('Error exporting TP Wise Detailed PDF ZIP:', err);
      alert('Error creating ZIP: ' + err.message);
    } finally {
      setIsExportingZip(false);
      setExportStatusText('');
    }
  };

  // Keyboard Navigation for Fullscreen Detailed Slide mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDetailedSlideOpen) return;
      if (e.key === 'ArrowLeft') {
        goToSlideIndex(detailedSlideIndex - 1);
      } else if (e.key === 'ArrowRight') {
        goToSlideIndex(detailedSlideIndex + 1);
      } else if (e.key === 'Escape') {
        setIsDetailedSlideOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDetailedSlideOpen, detailedSlideIndex, goToSlideIndex]);

  // Touch Swipe navigation (swipe left/right) on mobile devices
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const handleSlideTouchStart = (e: React.TouchEvent) => {
    if (e.touches && e.touches.length > 0) {
      touchStartXRef.current = e.touches[0].clientX;
      touchStartYRef.current = e.touches[0].clientY;
    }
  };

  const handleSlideTouchMove = (e: React.TouchEvent) => {
    if (touchStartXRef.current !== null && e.touches && e.touches.length > 0) {
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const deltaX = Math.abs(currentX - touchStartXRef.current);
      const deltaY = Math.abs(currentY - (touchStartYRef.current || 0));
      // If horizontal swipe is dominant, prevent vertical scroll interference
      if (deltaX > deltaY && deltaX > 15) {
        if (e.cancelable) {
          e.preventDefault();
        }
      }
    }
  };

  const handleSlideTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - (touchStartYRef.current || 0);

    // Only trigger if horizontal swipe is dominant and exceeds 30px threshold
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 30) {
      if (deltaX < 0) {
        // Swiped Left -> View Next Slide
        goToSlideIndex(detailedSlideIndex + 1);
      } else {
        // Swiped Right -> View Previous Slide
        goToSlideIndex(detailedSlideIndex - 1);
      }
    }
    touchStartXRef.current = null;
    touchStartYRef.current = null;
  };

  // Automatically request landscape orientation on mobile when slideview is open
  useEffect(() => {
    if (!isDetailedSlideOpen) return;
    const tryLockOrientation = async () => {
      if (typeof window !== 'undefined' && 'screen' in window) {
        try {
          const orientation = window.screen.orientation || (window.screen as any).mozOrientation || (window.screen as any).msOrientation;
          if (orientation && orientation.lock) {
            await orientation.lock('landscape').catch(() => {
              orientation.lock('landscape-primary').catch(() => {});
            });
          } else if ((window.screen as any).lockOrientation) {
            (window.screen as any).lockOrientation('landscape');
          }
        } catch (_) {}
      }
    };

    tryLockOrientation();

    return () => {
      if (typeof window !== 'undefined' && 'screen' in window) {
        try {
          const orientation = window.screen.orientation;
          if (orientation && orientation.unlock) {
            orientation.unlock();
          } else if ((window.screen as any).unlockOrientation) {
            (window.screen as any).unlockOrientation();
          }
        } catch (_) {}
      }
    };
  }, [isDetailedSlideOpen]);

  // Preload adjacent slide photos (current, next 5 slides, and previous 2) into browser cache
  useEffect(() => {
    if (!isDetailedSlideOpen || filteredWorks.length === 0) return;
    const preloadIndices = [
      detailedSlideIndex,
      detailedSlideIndex + 1,
      detailedSlideIndex + 2,
      detailedSlideIndex + 3,
      detailedSlideIndex + 4,
      detailedSlideIndex + 5,
      detailedSlideIndex + 6,
      detailedSlideIndex + 7,
      detailedSlideIndex + 8,
      detailedSlideIndex + 9,
      detailedSlideIndex + 10,
      detailedSlideIndex - 1,
      detailedSlideIndex - 2,
      detailedSlideIndex - 3,
      detailedSlideIndex - 4,
      detailedSlideIndex - 5
    ];
    preloadIndices.forEach(idx => {
      if (idx >= 0 && idx < filteredWorks.length) {
        const w = filteredWorks[idx];
        const photos = getWorkPhotos(w);
        photos.forEach(p => {
          if (p.url) {
            const img = new Image();
            img.referrerPolicy = 'no-referrer';
            img.src = p.url;
          }
        });
      }
    });
  }, [isDetailedSlideOpen, detailedSlideIndex, filteredWorks]);

  // Slide-only page cache: walk all filtered records without changing the table page.
  useEffect(() => {
    if (!isDetailedSlideOpen || !worksFromApi) return;
    const pageSize = REPORTS_SERVER_PAGE_SIZE;
    const page = Math.floor(detailedSlideIndex / pageSize) + 1;
    const gen = slideCacheGenRef.current;
    const loadPage = async (targetPage: number) => {
      if (slidePageCacheRef.current.has(targetPage)) return;
      const loaded = await fetchRowsOnlyPage(targetPage, pageSize);
      if (gen !== slideCacheGenRef.current) return;
      if (loaded.ok && loaded.works.length) {
        slidePageCacheRef.current.set(targetPage, loaded.works);
        setSlideCacheTick((t) => t + 1);
      }
    };
    void loadPage(page);
    const maxPage = Math.max(1, Math.ceil(slideRecordTotal / pageSize));
    if (page + 1 <= maxPage) void loadPage(page + 1);
    if (page - 1 >= 1) void loadPage(page - 1);
  }, [
    isDetailedSlideOpen,
    detailedSlideIndex,
    worksFromApi,
    slideRecordTotal,
    fetchRowsOnlyPage,
  ]);

  useEffect(() => {
    if (!isDetailedSlideOpen || !currentSlideWork) return;
    const fd = currentSlideWork.fieldsData;
    if (fd && typeof fd === 'object' && Object.keys(fd).length > 0) return;
    const id = currentSlideWork.id || currentSlideWork.workId;
    if (!id) return;
    let cancelled = false;
    fetch(`/api/inspection-works?lookupId=${encodeURIComponent(String(id))}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        const work = json?.work;
        if (work?.fieldsData && typeof work.fieldsData === 'object') {
          setSlideWorkFields(work);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isDetailedSlideOpen, currentSlideWork]);

  // Inspector profile matching for slide view top header
  const slideInspector = useMemo(() => {
    if (!currentSlideWork) return null;
    const allUsers = [...(state.inspectionUsers || []), ...(state.users || [])];
    const uId = String(currentSlideWork.submittedByUserId || currentSlideWork.userId || '').trim().toLowerCase();
    const uName = String(currentSlideWork.submittedByUserName || currentSlideWork.submittedByName || currentSlideWork.username || '').trim().toLowerCase();
    return allUsers.find((u: any) => 
      (uId && (String(u.id || u._id).toLowerCase() === uId || String(u.employeeId).toLowerCase() === uId)) ||
      (uName && (String(u.username).toLowerCase() === uName || String(u.mobile).toLowerCase() === uName || String(u.phone).toLowerCase() === uName || String(u.nameEn).toLowerCase() === uName || String(u.name).toLowerCase() === uName))
    );
  }, [currentSlideWork, state.inspectionUsers, state.users]);

  const slideInspectorPhoto = useMemo(() => {
    return currentSlideWork?.profilePhotoUrl || 
      currentSlideWork?.avatarUrl || 
      slideInspector?.profilePhotoUrl || 
      slideInspector?.avatarUrl || 
      slideInspector?.profileImage || 
      null;
  }, [currentSlideWork, slideInspector]);

  // Safe URL generator for canvas drawing and obfuscated media loading
  const getSafeCanvasUrl = (url: string) => toStableMediaSrc(url);

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Could not read image data'));
      reader.readAsDataURL(blob);
    });

  const dataUrlFromImageElement = (img: HTMLImageElement): string | null => {
    if (!img.naturalWidth || !img.naturalHeight) return null;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch {
      return null;
    }
  };

  const fetchPhotoDataUrl = async (url: string): Promise<string | null> => {
    const safe = getSafeCanvasUrl(url) || url;
    if (!safe) return null;
    if (safe.startsWith('data:image')) return safe;
    try {
      const res = await fetch(safe);
      if (!res.ok) return null;
      const blob = await res.blob();
      const type = String(blob.type || '');
      if (type && !type.startsWith('image/') && type !== 'application/octet-stream') return null;
      const dataUrl = await blobToDataUrl(blob);
      return dataUrl.startsWith('data:') ? dataUrl : null;
    } catch {
      return null;
    }
  };

  const findLiveSlideImage = (url: string): HTMLImageElement | null => {
    const root = slideContainerRef.current;
    if (!root || !url) return null;
    const want = getSafeCanvasUrl(url) || url;
    const imgs = Array.from(root.querySelectorAll('img')) as HTMLImageElement[];
    return (
      imgs.find((img) => {
        const src = img.currentSrc || img.src || '';
        if (!src) return false;
        if (src === url || src === want) return true;
        const stable = getSafeCanvasUrl(src);
        return !!(stable && (stable === want || stable === url));
      }) || null
    );
  };

  const resolvePhotoDataUrl = async (url: string): Promise<string | null> => {
    if (!url) return null;
    if (url.startsWith('data:image')) return url;
    const live = findLiveSlideImage(url);
    if (live) {
      const drawn = dataUrlFromImageElement(live);
      if (drawn) return drawn;
    }
    return (await fetchPhotoDataUrl(url)) || (await fetchPhotoDataUrl(getSafeCanvasUrl(url)));
  };

  const loadImageFromDataUrl = (dataUrl: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not decode photo'));
      img.src = dataUrl;
    });

  // Inline displayed photos as data URLs and pin pixel sizes so html2canvas keeps them
  const convertImagesToBase64InContainer = async (container: HTMLElement) => {
    const images = Array.from(container.querySelectorAll('img')) as HTMLImageElement[];
    const originals: Array<{
      img: HTMLImageElement;
      origSrc: string;
      width: string;
      height: string;
      maxWidth: string;
      maxHeight: string;
      objectFit: string;
    }> = [];

    await Promise.all(
      images.map(async (img) => {
        const src = img.currentSrc || img.src || img.getAttribute('src') || '';
        if (!src) return;

        const rect = img.getBoundingClientRect();
        originals.push({
          img,
          origSrc: src,
          width: img.style.width,
          height: img.style.height,
          maxWidth: img.style.maxWidth,
          maxHeight: img.style.maxHeight,
          objectFit: img.style.objectFit,
        });

        try {
          let dataUrl = src.startsWith('data:image') ? src : dataUrlFromImageElement(img);
          if (!dataUrl) dataUrl = await resolvePhotoDataUrl(src);
          if (dataUrl && dataUrl.startsWith('data:')) {
            img.src = dataUrl;
            await img.decode().catch(() => undefined);
          }
          if (rect.width > 1 && rect.height > 1) {
            img.style.width = `${Math.round(rect.width)}px`;
            img.style.height = `${Math.round(rect.height)}px`;
            img.style.maxWidth = 'none';
            img.style.maxHeight = 'none';
            img.style.objectFit = 'contain';
          }
        } catch (err) {
          console.warn('Failed to inline image for full slide capture:', src, err);
        }
      })
    );

    return () => {
      originals.forEach(({ img, origSrc, width, height, maxWidth, maxHeight, objectFit }) => {
        img.src = origSrc;
        img.style.width = width;
        img.style.height = height;
        img.style.maxWidth = maxWidth;
        img.style.maxHeight = maxHeight;
        img.style.objectFit = objectFit;
      });
    };
  };

  // Helper to download single photo with bigger, bold, high quality golden caption text with white borders
  const downloadSingleCaptionedPhoto = async (work: any, activePhoto: { url: string; label: string }, activeLang: string) => {
    try {
      const dataUrl = await resolvePhotoDataUrl(activePhoto.url);
      if (!dataUrl) {
        window.open(getSafeCanvasUrl(activePhoto.url) || activePhoto.url, '_blank');
        return;
      }
      const img = await loadImageFromDataUrl(dataUrl);
      {
        const targetWidth = Math.max(img.width || 1200, 1000);
        const scale = targetWidth / (img.width || 1200);
        const targetHeight = (img.height || 800) * scale;
        const captionHeight = 175;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight + captionHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 1. Draw Image
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        // 2. Draw Golden Amber Stamp (#FBBF24) at bottom
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(0, targetHeight, targetWidth, captionHeight);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(0, targetHeight, targetWidth, 6);

        // Function for high contrast crisp text with white outline
        const drawTextWithOutline = (text: string, x: number, y: number, fontSize: number) => {
          ctx.save();
          ctx.font = `bold ${fontSize}px sans-serif`;
          ctx.textAlign = 'center';
          
          // White stroke border around text
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(3, Math.round(fontSize / 6));
          ctx.lineJoin = 'round';
          ctx.strokeText(text, x, y);
          
          // High contrast rich dark fill
          ctx.fillStyle = '#7F1D1D';
          ctx.fillText(text, x, y);
          ctx.restore();
        };

        const isTa = activeLang === 'ta';
        const workIdStr = work.workId || work.id || '-';

        // Header Line 1 - Bigger & Bold
        const tpStr = isTa ? (work.tpNameTa || work.tpNameEn || 'பேரூராட்சி') : String(work.tpNameEn || 'TOWN PANCHAYAT').toUpperCase();
        const zoneStr = isTa ? (work.zoneNameTa || work.zoneNameEn || 'மண்டலம்') : String(work.zoneNameEn || 'ZONE').toUpperCase();
        const distStr = isTa ? (work.districtNameTa || work.districtNameEn || 'மாவட்டம்') : String(work.districtNameEn || 'DISTRICT').toUpperCase();
        drawTextWithOutline(`${tpStr}, ${zoneStr}, ${distStr}`, targetWidth / 2, targetHeight + 42, Math.max(24, Math.round(targetWidth * 0.022)));

        // Subheader Line 2 - Bigger & Bold
        const wardStr = isTa ? `வார்டு எண்: ${work.wardNumber || '1'}` : `WARD NO: ${work.wardNumber || '1'}`;
        const streetStr = isTa ? streetLabel(work, 'ta') : streetLabel(work, 'en').toUpperCase();
        const subjStr = isTa ? (work.subjectNameTa || work.subjectNameEn || '') : String(work.subjectNameEn || '').toUpperCase();
        const photoLbl = isTa ? translatePhotoLabelToTamil(activePhoto.label) : String(activePhoto.label).toUpperCase();
        drawTextWithOutline(`${wardStr}, ${streetStr} • ${subjStr} • ${photoLbl}`, targetWidth / 2, targetHeight + 92, Math.max(20, Math.round(targetWidth * 0.018)));

        // Metadata Line 3 - Crisp Metadata
        const timeStr = isTa ? formatIndianTime(work.submittedAt).replace('AM', 'மு.ப').replace('PM', 'பி.ப') : formatIndianTime(work.submittedAt).toUpperCase();
        const gpsStr = (work.latitude && work.longitude) ? `GPS: ${Number(work.latitude).toFixed(5)}, ${Number(work.longitude).toFixed(5)}` : 'GPS: N/A';
        const inspectorStr = isTa ? (work.submittedByNameTa || work.submittedByName || 'கள ஆய்வாளர்') : String(work.submittedByNameEn || work.submittedByName || work.submittedByUserName || 'FIELD INSPECTOR').toUpperCase();
        drawTextWithOutline(`${timeStr} • ${gpsStr} • ${inspectorStr} • WORK ID: ${workIdStr}`, targetWidth / 2, targetHeight + 138, Math.max(16, Math.round(targetWidth * 0.014)));

        // Download canvas output
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.95);
        const a = document.createElement('a');
        a.href = jpegUrl;
        a.download = `Work_${workIdStr}_${photoLbl.replace(/[^a-zA-Z0-9_\u0B80-\u0BFF]/g, '_')}_Captioned.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (e) {
      window.open(getSafeCanvasUrl(activePhoto.url) || activePhoto.url, '_blank');
    }
  };

  // Helper to draw MULTI-PHOTO COLLAGE with golden captions on each photo panel
  const downloadMultiPhotoCollage = async (work: any, photos: { url: string; label: string }[], activeLang: string) => {
    try {
      const isTa = activeLang === 'ta';
      const workIdStr = work.workId || work.id || '-';

      // Load all images asynchronously
      const loadedImgs = await Promise.all(
        photos.map(async (p) => {
          try {
            const photoDataUrl = await resolvePhotoDataUrl(p.url);
            if (!photoDataUrl) return null;
            const img = await loadImageFromDataUrl(photoDataUrl);
            return { img, label: p.label, blobUrl: '' };
          } catch (_) {
            return null;
          }
        })
      );

      const validImgs = loadedImgs.filter(item => item !== null) as { img: HTMLImageElement; label: string; blobUrl: string }[];
      if (validImgs.length === 0) {
        alert(isTa ? 'படங்களை பதிவிறக்குவதில் பிழை ஏற்பட்டது.' : 'FAILED TO LOAD PHOTOS FOR COLLAGE.');
        return;
      }

      // Calculate Collage Layout Dimensions
      const cols = validImgs.length === 2 ? 2 : (validImgs.length === 3 ? 3 : 2);
      const rows = Math.ceil(validImgs.length / cols);

      const cellWidth = 800;
      const cellImageHeight = 600;
      const cellCaptionHeight = 140;
      const cellHeight = cellImageHeight + cellCaptionHeight;

      const collageWidth = cols * cellWidth;
      const headerHeight = 100;
      const collageHeight = headerHeight + (rows * cellHeight);

      const canvas = document.createElement('canvas');
      canvas.width = collageWidth;
      canvas.height = collageHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill Background
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, collageWidth, collageHeight);

      // Render Top Master Header
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(0, 0, collageWidth, headerHeight);
      ctx.fillStyle = '#6366F1';
      ctx.fillRect(0, headerHeight - 4, collageWidth, 4);

      ctx.fillStyle = '#F8FAFC';
      ctx.textAlign = 'center';
      ctx.font = 'bold 24px sans-serif';
      const tpStr = isTa ? (work.tpNameTa || work.tpNameEn || 'பேரூராட்சி') : String(work.tpNameEn || 'TOWN PANCHAYAT').toUpperCase();
      const zoneStr = isTa ? (work.zoneNameTa || work.zoneNameEn || 'மண்டலம்') : String(work.zoneNameEn || 'ZONE').toUpperCase();
      const distStr = isTa ? (work.districtNameTa || work.districtNameEn || 'மாவட்டம்') : String(work.districtNameEn || 'DISTRICT').toUpperCase();
      ctx.fillText(`${tpStr}, ${zoneStr}, ${distStr} • ${validImgs.length} ${isTa ? 'கள ஆய்வு புகைப்படத் தொகுப்பு' : 'PHOTOS COLLAGE'}`, collageWidth / 2, 38);

      ctx.font = 'bold 16px sans-serif';
      ctx.fillStyle = '#94A3B8';
      const wardStr = isTa ? `வார்டு: ${work.wardNumber || '1'}` : `WARD: ${work.wardNumber || '1'}`;
      const streetStr = isTa ? streetLabel(work, 'ta') : streetLabel(work, 'en').toUpperCase();
      const subjStr = isTa ? (work.subjectNameTa || work.subjectNameEn || '') : String(work.subjectNameEn || '').toUpperCase();
      const timeStr = isTa ? formatIndianTime(work.submittedAt).replace('AM', 'மு.ப').replace('PM', 'பி.ப') : formatIndianTime(work.submittedAt).toUpperCase();
      ctx.fillText(`${wardStr} • ${streetStr} • ${subjStr} • ${timeStr} • WORK ID: ${workIdStr}`, collageWidth / 2, 72);

      // Render Each Photo Panel with Golden Caption Box
      validImgs.forEach((item, idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);

        const x = c * cellWidth;
        const y = headerHeight + (r * cellHeight);

        // Draw Image fit in cell
        ctx.save();
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 2, y + 2, cellWidth - 4, cellImageHeight - 2);

        const imgRatio = item.img.width / item.img.height;
        const cellRatio = cellWidth / cellImageHeight;
        let drawW = cellWidth;
        let drawH = cellImageHeight;
        let drawX = x;
        let drawY = y;

        if (imgRatio > cellRatio) {
          drawH = cellWidth / imgRatio;
          drawY = y + (cellImageHeight - drawH) / 2;
        } else {
          drawW = cellImageHeight * imgRatio;
          drawX = x + (cellWidth - drawW) / 2;
        }

        ctx.drawImage(item.img, drawX, drawY, drawW, drawH);
        ctx.restore();

        // Draw Golden Caption Box (#FBBF24) under each photo
        const capY = y + cellImageHeight;
        ctx.fillStyle = '#FBBF24';
        ctx.fillRect(x + 2, capY, cellWidth - 4, cellCaptionHeight - 4);
        ctx.fillStyle = '#B45309';
        ctx.fillRect(x + 2, capY, cellWidth - 4, 4);

        // Caption Text with white border outline
        const photoLbl = isTa ? translatePhotoLabelToTamil(item.label) : String(item.label).toUpperCase();
        
        ctx.save();
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 4;
        ctx.strokeText(`[ ${photoLbl} ]`, x + (cellWidth / 2), capY + 38);
        ctx.fillStyle = '#7F1D1D';
        ctx.fillText(`[ ${photoLbl} ]`, x + (cellWidth / 2), capY + 38);

        ctx.font = 'bold 15px sans-serif';
        const gpsStr = (work.latitude && work.longitude) ? `GPS: ${Number(work.latitude).toFixed(5)}, ${Number(work.longitude).toFixed(5)}` : 'GPS: N/A';
        const inspectorStr = isTa ? (work.submittedByNameTa || work.submittedByName || 'கள ஆய்வாளர்') : String(work.submittedByNameEn || work.submittedByName || work.submittedByUserName || 'FIELD INSPECTOR').toUpperCase();
        
        ctx.strokeText(`${wardStr}, ${streetStr} • ${gpsStr}`, x + (cellWidth / 2), capY + 72);
        ctx.fillText(`${wardStr}, ${streetStr} • ${gpsStr}`, x + (cellWidth / 2), capY + 72);

        ctx.strokeText(`${timeStr} • ${inspectorStr}`, x + (cellWidth / 2), capY + 106);
        ctx.fillText(`${timeStr} • ${inspectorStr}`, x + (cellWidth / 2), capY + 106);
        ctx.restore();

        if (item.blobUrl.startsWith('blob:')) URL.revokeObjectURL(item.blobUrl);
      });

      // Output Collage Canvas
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `Work_${workIdStr}_Collage_Captioned.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error generating collage:', err);
      alert('Error creating collage image: ' + err.message);
    }
  };

  // Helper to download slideshow image with burned-in golden captions
  const handleDownloadSlidePhotoWithCaptions = async (work: any, photoObj?: { url: string; label: string }) => {
    if (!work || isSlideDownloading) return;
    const activeLang = slideLang || lang;
    const photos = getWorkPhotos(work, activeLang);
    if (photos.length === 0) {
      alert(activeLang === 'ta' ? 'பதிவிறக்குவதற்கு படம் எதுவும் இல்லை.' : 'NO PHOTO AVAILABLE TO DOWNLOAD.');
      return;
    }
    setIsSlideDownloading(true);
    try {
      if (photoObj) {
        await downloadSingleCaptionedPhoto(work, photoObj, activeLang);
        return;
      }
      for (let i = 0; i < photos.length; i++) {
        await downloadSingleCaptionedPhoto(work, photos[i], activeLang);
      }
    } finally {
      setIsSlideDownloading(false);
    }
  };

  const loadSlideExportImage = async (url: string) => {
    const dataUrl = await resolvePhotoDataUrl(url);
    if (!dataUrl) return null;
    try {
      return await loadImageFromDataUrl(dataUrl);
    } catch {
      return null;
    }
  };

  const renderCurrentSlideJpeg = async () => {
    if (!currentSlideWork) throw new Error('Slide is not ready');
    return renderInspectionSlideJpeg({
      work: currentSlideWork,
      index: detailedSlideIndex,
      total: Math.max(1, slideRecordTotal),
      lang: slideLang,
      theme: slideTheme,
      fields: state.inspectionFields || [],
      loadImage: loadSlideExportImage,
    });
  };

  const handleDownloadFullSlideAsImage = async () => {
    if (isSlideDownloading || !currentSlideWork) return;
    setIsSlideDownloading(true);
    try {
      const jpeg = await renderCurrentSlideJpeg();
      const a = document.createElement('a');
      a.href = jpeg;
      a.download = `Full_Slide_Work_${currentSlideWork?.workId || currentSlideWork?.id || 'entry'}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      console.error('Error capturing full slide image:', err);
      alert('Error capturing slide frame image: ' + err.message);
    } finally {
      setIsSlideDownloading(false);
    }
  };

  const handleDownloadFullSlideAsPdf = async () => {
    if (isSlideDownloading || !currentSlideWork) return;
    setIsSlideDownloading(true);
    try {
      const jpeg = await renderCurrentSlideJpeg();
      const pdf = new jsPDF({ orientation: 'l', unit: 'pt', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const props = pdf.getImageProperties(jpeg);
      const ratio = Math.min(pageW / props.width, pageH / props.height);
      pdf.addImage(
        jpeg,
        'JPEG',
        (pageW - props.width * ratio) / 2,
        (pageH - props.height * ratio) / 2,
        props.width * ratio,
        props.height * ratio
      );
      pdf.save(`Full_Slide_Work_${currentSlideWork?.workId || currentSlideWork?.id || 'entry'}.pdf`);
    } catch (err: any) {
      console.error('Error capturing full slide image:', err);
      alert('Error capturing slide frame image: ' + err.message);
    } finally {
      setIsSlideDownloading(false);
    }
  };

  const handleDownloadAllSlidesDeck = async (format: 'pdf' | 'ppt') => {
    if (isSlideDownloading) return;
    setIsSlideDownloading(true);
    setSlideDeckExport({ current: 0, total: Math.max(1, slideRecordTotal), format });
    try {
      const loaded = await fetchAllFilteredWorksForExport();
      const works = (loaded && loaded.length ? loaded : filteredWorks).filter(Boolean);
      if (!works.length) {
        alert(slideLang === 'ta' ? 'பதிவிறக்க ஸ்லைடுகள் இல்லை.' : 'No slides available to download.');
        return;
      }
      setSlideDeckExport({ current: 0, total: works.length, format });
      const missing = works.filter((w) => !w.fieldsData || !Object.keys(w.fieldsData).length).slice(0, 40);
      await Promise.all(
        missing.map(async (w) => {
          const id = w.id || w.workId;
          if (!id) return;
          try {
            const res = await fetch(`/api/inspection-works?lookupId=${encodeURIComponent(String(id))}`, {
              cache: 'no-store',
            });
            const json = await res.json();
            if (json?.work?.fieldsData) w.fieldsData = json.work.fieldsData;
            if (json?.work?.imageUrl) w.imageUrl = json.work.imageUrl;
          } catch {
            /* keep lite row */
          }
        })
      );
      await buildInspectionSlidesFile({
        works,
        lang: slideLang,
        theme: slideTheme,
        fields: state.inspectionFields || [],
        format,
        filename: `Inspection_Slides_${works.length}_${getTodayYmd()}`,
        loadImage: async (url) => {
          const dataUrl = await resolvePhotoDataUrl(url);
          if (!dataUrl) return null;
          try {
            return await loadImageFromDataUrl(dataUrl);
          } catch {
            return null;
          }
        },
        onProgress: (current, total) => setSlideDeckExport({ current, total, format }),
      });
    } catch (err: any) {
      console.error('Error exporting all slides:', err);
      alert(
        slideLang === 'ta'
          ? `அனைத்து ஸ்லைடுகளையும் பதிவிறக்க முடியவில்லை: ${err?.message || ''}`
          : `Could not download all slides: ${err?.message || ''}`
      );
    } finally {
      setSlideDeckExport(null);
      setIsSlideDownloading(false);
    }
  };

  const getImageFieldLabel = (work: any, imageUrl?: string, fallbackKey?: string) => {
    const fieldsData = work?.fieldsData || {};
    const matchingField = imageUrl
      ? Object.entries(fieldsData).find(([_, value]) => String(value) === imageUrl)
      : undefined;
    const firstImageField = Object.entries(fieldsData).find(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      const normalizedValue = String(value).toLowerCase();
      return normalizedKey.includes('photo')
        || normalizedKey.includes('image')
        || normalizedKey.includes('camera')
        || normalizedValue.startsWith('http')
        || normalizedValue.includes('captured_photo')
        || normalizedValue.includes('gallery_photo');
    });
    const fieldKey = matchingField?.[0] || fallbackKey || firstImageField?.[0];
    const field = fieldKey
      ? (state.inspectionFields || []).find((item: any) => item.id === fieldKey)
      : undefined;

    if (field) return lang === 'ta' ? field.nameTa || field.nameEn : field.nameEn;
    if (fieldKey) return fieldKey;
    return lang === 'ta' ? work?.categoryNameTa : work?.categoryNameEn;
  };

  const embedEmptyMessage = (
    <div className="portal-fis-empty">
      <svg className="portal-fis-empty-art" viewBox="0 0 72 72" fill="none" aria-hidden="true">
        <rect x="8" y="18" width="40" height="32" rx="6" fill="#eef2ff" stroke="#c7d2fe" />
        <path d="M16 28h24M16 34h18M16 40h12" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="50" cy="46" r="12" fill="#fff" stroke="#6366f1" strokeWidth="3" />
        <path d="M58 54l8 8" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <p className="text-[13px] font-semibold text-slate-600">
        {lang === 'ta' ? 'தேர்ந்தெடுத்த வடிகட்டிகளுக்கு ஆய்வுப் பதிவுகள் இல்லை.' : 'No inspection records found for the selected filters.'}
      </p>
      <p className="text-[11px] text-slate-400">
        {lang === 'ta' ? 'வடிகட்டிகளை மாற்றி மீண்டும் முயலவும்.' : 'Please adjust your filters and try again.'}
      </p>
    </div>
  );

  return (
    <div className={embedMode ? 'portal-fis-sheet' : 'portal-studio'}>
      {!embedMode && (
        <div className="portal-fis-hero">
          <div className="relative z-[1] min-w-0">
            <div className="portal-fis-hero-tabs">
              <button
                type="button"
                onClick={() => switchReportModule('inspection')}
                className={`portal-fis-hero-tab ${reportModule === 'inspection' ? 'is-active' : ''}`}
              >
                <FileSpreadsheet />
                <span>{lang === 'ta' ? 'ஆய்வு அறிக்கைகள்' : 'Inspection Reports'}</span>
              </button>
              <button
                type="button"
                onClick={() => switchReportModule('swm')}
                className={`portal-fis-hero-tab ${reportModule === 'swm' ? 'is-active' : ''}`}
              >
                <Recycle />
                <span>{lang === 'ta' ? 'SWM அறிக்கைகள்' : 'SWM Reports'}</span>
              </button>
            </div>
          </div>
          <div className="portal-fis-hero-actions relative z-[1] flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {fetchError && (
              <span className="max-w-[14rem] truncate text-right text-[11px] font-semibold text-rose-100">
                {fetchError}
              </span>
            )}
            <button
              type="button"
              onClick={() => applyFiltersAndLoad({ refreshRemote: true })}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white shadow-md hover:brightness-110 disabled:opacity-60 cursor-pointer"
              style={{ backgroundImage: `linear-gradient(90deg, ${currentTheme.chartGradient?.[0] || currentTheme.accentColor}, ${currentTheme.accentColor})` }}
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              {lang === 'ta' ? 'வடிகட்டி பயன்படுத்து' : 'Apply Filters'}
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/40 bg-white/10 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-white/15 cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              {lang === 'ta' ? 'அனைத்தையும் மீட்டமை' : 'Reset Filters'}
            </button>
          </div>
        </div>
      )}

      <div className={embedMode ? 'portal-fis-sheet' : 'portal-fis-body'}>
      {!hideTabsHeader && (
        <div className="portal-dash-toolbar">
          <div className="portal-dash-pills">
            <button
              type="button"
              onClick={() => setActiveTab('abstract')}
              className={`portal-dash-pill ${activeTab === 'abstract' ? 'is-active' : ''}`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'சுருக்க அறிக்கை' : 'Abstract'}</span>
            </button>
            {reportModule === 'swm' ? (
            <button
              type="button"
              onClick={() => setActiveTab('tp')}
              className={`portal-dash-pill ${activeTab === 'tp' ? 'is-active' : ''}`}
            >
              <Building2 className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'பேரூராட்சி' : 'TP'}</span>
            </button>
            ) : (
            <>
            <button
              type="button"
              onClick={() => setActiveTab('detailed')}
              className={`portal-dash-pill ${activeTab === 'detailed' ? 'is-active' : ''}`}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'விரிவான அறிக்கை' : 'Detailed'}</span>
              <span className="portal-fis-count">{filteredWorksTotal}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mapview')}
              className={`portal-dash-pill ${activeTab === 'mapview' ? 'is-active' : ''}`}
            >
              <MapIcon className="h-3.5 w-3.5" />
              <span>{lang === 'ta' ? 'வரைபடம்' : 'Map View'}</span>
            </button>
            </>
            )}
          </div>
        </div>
      )}

      <div className="portal-fis-filters">
        {reportModule !== 'swm' && (
        <div className="portal-fis-search-bar">
          <div className="portal-fis-filters-head">
            <div className="portal-fis-search">
              <label className="sr-only" htmlFor="inspection-report-search">
                {lang === 'ta' ? 'தேடு (Work ID, Street)' : 'Search (ID, Street)'}
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="inspection-report-search"
                  type="text"
                  placeholder={lang === 'ta' ? 'தேடு (Work ID, Street)' : 'Search (ID, Street)'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFiltersCollapsed((open) => !open)}
              aria-expanded={!filtersCollapsed}
            >
              <Filter className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
              <span>{lang === 'ta' ? 'வடிகட்டிகள்' : 'Filters'}</span>
              {filtersCollapsed ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronUp className="h-4 w-4 text-slate-400" />}
            </button>
          </div>
        </div>
        )}
        <div className={`portal-fis-filter-fields${reportModule !== 'swm' && filtersCollapsed ? ' is-collapsed' : ''}`}>
        {embedMode && !hideFilterActions && (
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {fetchError && (
              <span className="max-w-md text-right text-[11px] font-semibold text-rose-600">
                {fetchError}
              </span>
            )}
            <button
              type="button"
              onClick={() => applyFiltersAndLoad({ refreshRemote: true })}
              disabled={isRefreshing}
              className="portal-dash-pill is-active"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {lang === 'ta' ? 'வடிகட்டி பயன்படுத்து' : 'Apply filters'}
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="portal-dash-pill"
            >
              {lang === 'ta' ? 'அனைத்தையும் மீட்டமை' : 'Reset Filters'}
            </button>
          </div>
        </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 ${reportModule === 'swm' ? 'md:grid-cols-3 lg:grid-cols-5' : 'md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5'} portal-studio-fields ${reportModule !== 'swm' && filtersCollapsed ? 'hidden' : ''}`}>
          {/* Zone Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <MapPin className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              <span>{lang === 'ta' ? 'மண்டலம்' : 'Zone'}</span>
            </label>
            <ThemeSelect
              value={selectedZoneId}
              disabled={!!userZoneId}
              onChange={(e) => {
                if (userZoneId) return;
                setSelectedZoneId(e.target.value);
                setSelectedDistrictId('all');
                setSelectedTpId('all');
                setSelectedWard('all');
                setSelectedStreetName('all');
              }}
            >
              {!userZoneId && <option value="all">{lang === 'ta' ? 'அனைத்து மண்டலங்களும்' : 'All Zones'}</option>}
              {filteredZones.map((z: any) => (
                <option key={z.id} value={z.id}>
                  {lang === 'ta' ? (z.nameTa || z.nameEn) : (z.nameEn || z.nameTa)}
                </option>
              ))}
            </ThemeSelect>
          </div>

          {/* District Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Building className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              <span>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</span>
            </label>
            <ThemeSelect
              value={selectedDistrictId}
              disabled={!!userDistrictId}
              onChange={(e) => {
                if (userDistrictId) return;
                setSelectedDistrictId(e.target.value);
                setSelectedTpId('all');
                setSelectedWard('all');
                setSelectedStreetName('all');
              }}
            >
              {!userDistrictId && <option value="all">{lang === 'ta' ? 'அனைத்து மாவட்டங்களும்' : 'All Districts'}</option>}
              {availableDistricts.map((d: any) => (
                <option key={d.id} value={d.id}>
                  {lang === 'ta' ? (d.nameTa || d.nameEn) : (d.nameEn || d.nameTa)}
                </option>
              ))}
            </ThemeSelect>
          </div>

          {/* Town Panchayat Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Building2 className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              <span>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</span>
            </label>
            <ThemeSelect
              value={selectedTpId}
              disabled={!!userTpId}
              onChange={(e) => {
                if (userTpId) return;
                setSelectedTpId(e.target.value);
                setSelectedWard('all');
                setSelectedStreetName('all');
              }}
            >
              {!userTpId && <option value="all">{lang === 'ta' ? 'அனைத்து பேரூராட்சிகளும்' : 'All Town Panchayats'}</option>}
              {availableTownPanchayats.map((tp: any) => (
                <option key={tp.id} value={tp.id}>
                  {lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)}
                </option>
              ))}
            </ThemeSelect>
          </div>

          {reportModule !== 'swm' && (
          <>
          {/* Ward Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Home className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'வார்டு எண்' : 'Ward Number'}
            </label>
            <ThemeSelect
              value={selectedWard}
              onChange={(e) => {
                setSelectedWard(e.target.value);
                setSelectedStreetName('all');
              }}
            >
              <option value="all">{lang === 'ta' ? 'அனைத்து வார்டுகளும்' : 'All Wards'}</option>
              {availableWards.map((w) => (
                <option key={w} value={w}>Ward {w}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Street Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <MapPin className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'தெரு' : 'Street'}
            </label>
            <ThemeSelect
              value={selectedStreetName}
              onChange={(e) => setSelectedStreetName(e.target.value)}
            >
              <option value="all">
                {!userTpId && selectedTpId === 'all'
                  ? (lang === 'ta' ? 'முதலில் பேரூராட்சியைத் தேர்ந்தெடுக்கவும்' : 'Select Town Panchayat first')
                  : (lang === 'ta' ? 'அனைத்து தெருக்களும்' : 'All Streets')}
              </option>
              {availableStreets.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Layers className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'ஆய்வு பிரிவு (Subject)' : 'Inspection Subject'}
            </label>
            <ThemeSelect
              value={reportModule === 'swm' ? swmSubjectId : selectedSubjectId}
              disabled={reportModule === 'swm'}
              onChange={(e) => {
                setSelectedSubjectId(e.target.value);
                setSelectedCategoryId('all');
              }}
            >
              {reportModule !== 'swm' && (
                <option value="all">{lang === 'ta' ? 'அனைத்து பிரிவுகளும்' : 'All Subjects'}</option>
              )}
              {(reportModule === 'swm'
                ? availableSubjects.filter((s: any) => String(s.id) === swmSubjectId)
                : availableSubjects
              ).map((s: any) => (
                <option key={s.id} value={s.id}>{tObj(s)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Category Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Layers className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'ஆய்வு வகை (Category)' : 'Category Hierarchy'}
            </label>
            <ThemeSelect
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setAdminFilterFieldId('');
                setAdminFilterValue('');
              }}
            >
              <option value="all">{lang === 'ta' ? 'அனைத்து வகைகளும்' : 'All Categories'}</option>
              {availableCategories.map((c: any) => (
                <option key={c.id} value={c.id}>{tObj(c)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Admin Dynamic Field Filter */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Zap className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'புல வடிகட்டி' : 'Dynamic Field Filter'}
            </label>
            <ThemeSelect
              value={adminFilterFieldId}
              onChange={(e) => {
                setAdminFilterFieldId(e.target.value);
                setAdminFilterValue('');
              }}
            >
              <option value="">{lang === 'ta' ? '-- புலத்தைத் தேர்வுசெய் --' : '-- Choose Field --'}</option>
              {fieldsForFilter.map((f: any) => (
                <option key={f.id} value={f.id}>{tObj(f)}</option>
              ))}
            </ThemeSelect>
          </div>

          {/* Admin Dynamic Field Filter Value */}
          {adminFilterFieldId && (
            <div>
              <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
                {lang === 'ta' ? 'புல மதிப்பு' : 'Field Value'}
              </label>
              {adminFieldValueOptions.length > 0 ? (
                <ThemeSelect
                  value={adminFieldValueOptions.includes(adminFilterValue) ? adminFilterValue : ''}
                  onChange={(e) => setAdminFilterValue(e.target.value)}
                >
                  <option value="">{lang === 'ta' ? '-- மதிப்பைத் தேர்வுசெய் --' : '-- Select value --'}</option>
                  {adminFieldValueOptions.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </ThemeSelect>
              ) : (
                <input
                  type="text"
                  placeholder={lang === 'ta' ? 'மதிப்பை உள்ளிடவும் (எ.கா. 9894491631)' : 'Type a value (e.g. 9894491631)'}
                  value={adminFilterValue}
                  onChange={(e) => setAdminFilterValue(e.target.value)}
                  className="portal-theme-select-trigger"
                />
              )}
            </div>
          )}
          </>
          )}

          {/* From Date */}
          <div>
            <div className="portal-fis-field-label mb-1 flex items-center justify-between gap-1">
              <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold text-slate-500">
                <Calendar className="h-3 w-3 shrink-0" style={{ color: 'var(--theme-accent)' }} />
                {lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}
              </span>
              <button
                type="button"
                onClick={() => {
                  const today = getTodayYmd();
                  const clearing = fromDate === today && toDate === today;
                  const nextFrom = clearing ? '' : today;
                  const nextTo = clearing ? '' : today;
                  if (fromDate !== nextFrom || toDate !== nextTo) skipFilterDebounceRef.current = true;
                  setFromDate(nextFrom);
                  setToDate(nextTo);
                  filterQueryRef.current = {
                    ...filterQueryRef.current,
                    fromDate: nextFrom,
                    toDate: nextTo,
                  };
                  applyFiltersAndLoad();
                }}
                className="portal-fis-today"
              >
                {fromDate === getTodayYmd() && toDate === fromDate
                  ? (lang === 'ta' ? 'அனைத்தும் (Clear)' : 'Clear Today')
                  : (lang === 'ta' ? 'இன்று' : 'Today')}
              </button>
            </div>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          {/* To Date */}
          <div>
            <label className="portal-fis-field-label mb-1.5 flex items-center gap-1 text-[11px] font-semibold text-slate-500">
              <Calendar className="h-3 w-3" style={{ color: 'var(--theme-accent)' }} />
              {lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}
            </label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
        </div>
        </div>
      </div>

      {activeTab === 'abstract' && reportModule !== 'swm' && (
        <div className="portal-fis-toolbar">
            <div className="portal-fis-toolbar-row">
              <div className="portal-fis-group">
                <span className="portal-fis-bar-label">
                  <BarChart3 className="h-3.5 w-3.5" />
                  {lang === 'ta' ? 'அறிக்கைக் குழு முறை' : 'Abstract Report Grouping'}
                </span>
                <div className="portal-fis-pills">
                  <button
                    type="button"
                    onClick={() => setGroupingStyle('subject')}
                    className={`portal-fis-pill ${groupingStyle === 'subject' ? 'is-active' : ''}`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'பிரிவு வாரியாக' : 'Subject wise'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupingStyle('user')}
                    className={`portal-fis-pill ${groupingStyle === 'user' ? 'is-active' : ''}`}
                  >
                    <Users className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'பயனர் வாரியாக' : 'User wise'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGroupingStyle('location')}
                    className={`portal-fis-pill ${groupingStyle === 'location' ? 'is-active' : ''}`}
                  >
                    <MapPin className="h-3.5 w-3.5" />
                    {lang === 'ta' ? 'இடம் வாரியாக' : 'Location wise'}
                  </button>
                </div>
              </div>

              <div className="portal-fis-columns">
                <div className={`portal-fis-pills${groupingStyle !== 'subject' ? '' : ' hidden'}`}>
                  {groupingStyle === 'user' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleUserCol('subject')}
                        className={`portal-fis-pill ${userCols.subject ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'பிரிவு (Subject)' : 'Subject'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleUserCol('category')}
                        className={`portal-fis-pill ${userCols.category ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'வகை (Category)' : 'Category'}</span>
                      </button>
                    </>
                  )}

                  {groupingStyle === 'location' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('district')}
                        className={`portal-fis-pill ${locCols.district ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'மாவட்டம்' : 'District'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('tp')}
                        className={`portal-fis-pill ${locCols.tp ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('ward')}
                        className={`portal-fis-pill ${locCols.ward ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'வார்டு' : 'Ward'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('street')}
                        className={`portal-fis-pill ${locCols.street ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'தெரு' : 'Street'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('subject')}
                        className={`portal-fis-pill ${locCols.subject ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'பிரிவு' : 'Subject'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleLocCol('category')}
                        className={`portal-fis-pill ${locCols.category ? 'is-active' : ''}`}
                      >
                        <span>{lang === 'ta' ? 'வகை' : 'Category'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
        </div>
      )}

      {activeTab === 'abstract' && reportModule === 'swm' && (
        <div className="portal-fis-toolbar portal-swm-dyn">
          <div className="portal-swm-dyn-row">
            <div className="portal-swm-dyn-right">
                <div className="portal-fis-pills">
                  <button
                    type="button"
                    onClick={() => {
                      setSwmWardCol((open) => {
                        const next = !open;
                        if (!next) setSwmStreetCol(false);
                        return next;
                      });
                    }}
                    className={`portal-fis-pill ${swmWardCol ? 'is-active' : ''}`}
                  >
                    <Home className="h-3 w-3" />
                    <span>{lang === 'ta' ? 'வார்டு வாரியாக' : 'Ward wise'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSwmStreetCol((open) => {
                        const next = !open;
                        if (next) setSwmWardCol(true);
                        return next;
                      });
                    }}
                    className={`portal-fis-pill ${swmStreetCol ? 'is-active' : ''}`}
                  >
                    <MapPin className="h-3 w-3" />
                    <span>{lang === 'ta' ? 'தெரு வாரியாக' : 'Street wise'}</span>
                  </button>
                </div>
                <div className="portal-swm-build">
                  <span className="portal-swm-build-label">
                    <Building2 className="h-3 w-3" />
                    {lang === 'ta' ? 'கட்டிட வகை' : 'Building Type'}
                  </span>
                  <div className="portal-swm-build-track" role="radiogroup" aria-label={lang === 'ta' ? 'கட்டிட வகை' : 'Building Type'}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={swmBuildingType === 'all'}
                      className={swmBuildingType === 'all' ? 'is-active' : ''}
                      onClick={() => setSwmBuildingType('all')}
                    >
                      {lang === 'ta' ? 'அனைத்தும்' : 'All'}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={swmBuildingType === 'residential'}
                      className={swmBuildingType === 'residential' ? 'is-active' : ''}
                      onClick={() => setSwmBuildingType('residential')}
                    >
                      {lang === 'ta' ? 'குடியிருப்பு' : 'Residential'}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={swmBuildingType === 'commercial'}
                      className={swmBuildingType === 'commercial' ? 'is-active' : ''}
                      onClick={() => setSwmBuildingType('commercial')}
                    >
                      {lang === 'ta' ? 'வணிகம்' : 'Commercial'}
                    </button>
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: ABSTRACT SUMMARY VIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'abstract' && (
        <div className="portal-fis-follow">
          {/* Grouped Abstract breakdown table */}
          <div className="portal-fis-results">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between portal-fis-results-head">
              <h3 className="flex items-center font-semibold text-slate-800 gap-1.5 text-[13px]">
                {reportModule === 'swm' ? (
                  <Recycle className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
                ) : (
                  <BarChart3 className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
                )}
                <span>
                  {reportModule === 'swm'
                    ? (lang === 'ta' ? 'SWM கண்காணிப்பு • வீடு வீடாக மூலத்திலேயே பிரித்தல்' : 'SWM Monitoring • Door-to-Door Source Segregation')
                    : groupingStyle === 'subject'
                      ? (lang === 'ta' ? 'பிரிவு மற்றும் வகை வாரியான சுருக்கம்' : 'Subject & Category Level Breakdown')
                      : groupingStyle === 'user'
                        ? (lang === 'ta' ? 'பயனர் வாரியான ஆய்வுச் சுருக்கம்' : 'User Wise Inspection Summary')
                        : (lang === 'ta' ? 'மண்டல/இட வாரியான ஆய்வுச் சுருக்கம்' : 'Location Wise Inspection Summary')}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {/* Standard Excel Export */}
                <button
                  type="button"
                  onClick={handleExportAbstractExcel}
                  disabled={reportModule === 'swm' ? (isExportingExcel || swmAbstractRows.length === 0) : false}
                  className="portal-fis-chip portal-fis-chip-excel disabled:opacity-40"
                  title={lang === 'ta' ? 'சுருக்க அறிக்கை எக்செல்' : 'Export Abstract to Excel'}
                >
                  {isExportingExcel && reportModule === 'swm' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'ta' ? 'எக்செல்' : 'Excel Export'}</span>
                </button>

                {/* Standard PDF Export */}
                <button
                  type="button"
                  onClick={handleExportAbstractPDF}
                  disabled={reportModule === 'swm' ? (isExportingPdf || swmAbstractRows.length === 0) : false}
                  className="portal-fis-chip portal-fis-chip-pdf disabled:opacity-40"
                  title={lang === 'ta' ? 'சுருக்க அறிக்கை PDF' : 'Export Abstract to PDF'}
                >
                  {isExportingPdf && reportModule === 'swm' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'ta' ? 'PDF' : 'PDF Export'}</span>
                </button>

                {/* Admin Role Only: TP Wise Excel */}
                {isAdminRole && reportModule !== 'swm' && (
                  <button
                    onClick={handleExportAbstractTPWiseExcel}
                    disabled={filteredWorks.length === 0}
                    className="portal-fis-chip portal-fis-chip-tp-excel"
                    title={
                      lang === 'ta'
                        ? `பேரூராட்சி வாரியாக ${groupingStyle === 'subject' ? 'பிரிவு & வகை' : groupingStyle === 'user' ? 'பயனர் வாரியாக' : 'வார்டு & தெரு'} எக்செல் பதிவிறக்கம்`
                        : `Download TP-wise ${groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location'} Excel report`
                    }
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>
                      {lang === 'ta'
                        ? `பேரூராட்சி வாரியாக (${groupingStyle === 'subject' ? 'பிரிவு' : groupingStyle === 'user' ? 'பயனர்' : 'இடம்'}) Excel`
                        : `TP Wise Excel (${groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location'})`
                      }
                    </span>
                  </button>
                )}

                {/* Admin Role Only: TP Wise PDF (ZIP) */}
                {isAdminRole && reportModule !== 'swm' && (
                  <button
                    onClick={handleExportAbstractTPWisePDF}
                    disabled={filteredWorks.length === 0 || isExportingZip}
                    className="portal-fis-chip portal-fis-chip-tp-pdf"
                    title={
                      lang === 'ta'
                        ? `பேரூராட்சி வாரியாக ${groupingStyle === 'subject' ? 'பிரிவு & வகை' : groupingStyle === 'user' ? 'பயனர் வாரியாக' : 'வார்டு & தெரு'} தனித்தனி PDF-களை ZIP வடிவில் பதிவிறக்கம்`
                        : `Download ZIP containing individual TP ${groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location'} PDFs`
                    }
                  >
                    {isExportingZip ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FolderArchive className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {lang === 'ta'
                        ? `பேரூராட்சி வாரியாக (${groupingStyle === 'subject' ? 'பிரிவு' : groupingStyle === 'user' ? 'பயனர்' : 'இடம்'}) PDF`
                        : `TP Wise PDF (${groupingStyle === 'subject' ? 'Subject' : groupingStyle === 'user' ? 'User' : 'Location'})`
                      }
                    </span>
                  </button>
                )}
              </div>
            </div>

            <div className={`portal-fis-table${reportModule === 'swm' ? ' is-wide' : ''}`}>
            {reportModule === 'swm' ? (
            <div className="overflow-x-auto portal-swm-table-view">
              <table className="w-full text-left text-xs border-collapse portal-studio-table">
                <thead>
                  <tr>
                    <SwmHeaderCell lang={lang} col={SWM_COL.sno} align="sno" />
                    <SwmHeaderCell lang={lang} col={SWM_COL.zone} align="text" sortKey="zone" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.district} align="text" sortKey="district" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.tp} align="text" sortKey="tp" sortState={swmSort} onSort={toggleSwmSort} />
                    {swmShowWard && <SwmHeaderCell lang={lang} col={SWM_COL.wardNo} align="text" sortKey="ward" sortState={swmSort} onSort={toggleSwmSort} />}
                    {swmShowStreet && <SwmHeaderCell lang={lang} col={SWM_COL.street} align="text" sortKey="street" sortState={swmSort} onSort={toggleSwmSort} />}
                    {!swmShowWard && !swmShowStreet && (
                      <>
                        <SwmHeaderCell lang={lang} col={SWM_COL.totalWards} align="num" sortKey="totalWards" sortState={swmSort} onSort={toggleSwmSort} />
                        <SwmHeaderCell lang={lang} col={SWM_COL.wardsSurveyed} align="num" sortKey="wardsSurveyed" sortState={swmSort} onSort={toggleSwmSort} />
                        <SwmHeaderCell lang={lang} col={SWM_COL.totalStreets} align="num" sortKey="totalStreets" sortState={swmSort} onSort={toggleSwmSort} />
                        <SwmHeaderCell lang={lang} col={SWM_COL.streetsSurveyed} align="num" sortKey="streetsSurveyed" sortState={swmSort} onSort={toggleSwmSort} />
                      </>
                    )}
                    {swmShowWard && !swmShowStreet && (
                      <SwmHeaderCell lang={lang} col={SWM_COL.streetsSurveyed} align="num" sortKey="streetsSurveyed" sortState={swmSort} onSort={toggleSwmSort} />
                    )}
                    <SwmHeaderCell lang={lang} col={SWM_COL.households} align="num" sortKey="householdsSurveyed" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.segregating} align="num" sortKey="segregating" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="segregatingPct" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.notSegregating} align="num" sortKey="notSegregating" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="notSegregatingPct" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.doorLocked} align="num" sortKey="doorLocked" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="doorLockedPct" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.compost} align="num" sortKey="homeComposting" sortState={swmSort} onSort={toggleSwmSort} />
                    <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="homeCompostingPct" sortState={swmSort} onSort={toggleSwmSort} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {swmAbstractLoading && swmAbstractRows.length === 0 ? (
                    <tr>
                      <td colSpan={swmAbstractColCount} className="portal-swm-viewport-msg">
                        <SwmViewportStatus
                          loading
                          lang={lang}
                          loadingLabel={lang === 'ta' ? 'SWM சுருக்கம் ஏற்றப்படுகிறது...' : 'Loading SWM abstract...'}
                        />
                      </td>
                    </tr>
                  ) : swmAbstractRows.length === 0 ? (
                    <tr>
                      <td colSpan={swmAbstractColCount} className="portal-swm-viewport-msg">
                        <SwmViewportStatus
                          lang={lang}
                          loadingLabel=""
                        />
                      </td>
                    </tr>
                  ) : (
                    swmAbstractRowsView.map((row, idx) => (
                      <tr key={`${row.tpNameEn}-${row.wardNumber || ''}-${row.streetName || ''}-${idx}`}>
                        <td className="portal-swm-td is-sno">{idx + 1}</td>
                        <td className="portal-swm-td is-text">{lang === 'ta' ? row.zoneNameTa : row.zoneNameEn}</td>
                        <td className="portal-swm-td is-text">{lang === 'ta' ? row.districtNameTa : row.districtNameEn}</td>
                        <td className="portal-swm-td is-text is-strong">{lang === 'ta' ? row.tpNameTa : row.tpNameEn}</td>
                        {swmShowWard && (
                          <td className="portal-swm-td is-text">{formatSwmWard(row.wardNumber || '0', lang)}</td>
                        )}
                        {swmShowStreet && (
                          <td className="portal-swm-td is-text">{row.streetName || '-'}</td>
                        )}
                        {!swmShowWard && !swmShowStreet && (
                          <>
                            <td className="portal-swm-td is-num">{row.totalWards}</td>
                            <td className="portal-swm-td is-num">{row.wardsSurveyed}</td>
                            <td className="portal-swm-td is-num">{row.totalStreets}</td>
                            <td className="portal-swm-td is-num">{row.streetsSurveyed}</td>
                          </>
                        )}
                        {swmShowWard && !swmShowStreet && (
                          <td className="portal-swm-td is-num">{row.streetsSurveyed}</td>
                        )}
                        <td className="portal-swm-td is-num">{row.householdsSurveyed}</td>
                        <td className="portal-swm-td is-num">{row.segregating}</td>
                        <td className="portal-swm-td is-pct">{row.segregatingPct}%</td>
                        <td className="portal-swm-td is-num">{row.notSegregating}</td>
                        <td className="portal-swm-td is-pct">{row.notSegregatingPct}%</td>
                        <td className="portal-swm-td is-num">{row.doorLocked}</td>
                        <td className="portal-swm-td is-pct">{row.doorLockedPct}%</td>
                        <td className="portal-swm-td is-num">{row.homeComposting}</td>
                        <td className="portal-swm-td is-pct">{row.homeCompostingPct}%</td>
                      </tr>
                    ))
                  )}
                  {!swmAbstractLoading && swmAbstractRows.length > 0 && (
                    <tr className="portal-fis-total">
                      <td className="portal-swm-td is-sno">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                      <td className="portal-swm-td is-text">-</td>
                      <td className="portal-swm-td is-text">-</td>
                      <td className="portal-swm-td is-text">-</td>
                      {swmShowWard && <td className="portal-swm-td is-text">-</td>}
                      {swmShowStreet && <td className="portal-swm-td is-text">-</td>}
                      {!swmShowWard && !swmShowStreet && (
                        <>
                          <td className="portal-swm-td is-num">{swmAbstractTotals.totalWards}</td>
                          <td className="portal-swm-td is-num">{swmAbstractTotals.wardsSurveyed}</td>
                          <td className="portal-swm-td is-num">{swmAbstractTotals.totalStreets}</td>
                          <td className="portal-swm-td is-num">{swmAbstractTotals.streetsSurveyed}</td>
                        </>
                      )}
                      {swmShowWard && !swmShowStreet && (
                        <td className="portal-swm-td is-num">{swmAbstractTotals.streetsSurveyed}</td>
                      )}
                      <td className="portal-swm-td is-num">{swmAbstractTotals.householdsSurveyed}</td>
                      <td className="portal-swm-td is-num">{swmAbstractTotals.segregating}</td>
                      <td className="portal-swm-td is-pct">{swmPercent(swmAbstractTotals.segregating, swmAbstractTotals.householdsSurveyed)}%</td>
                      <td className="portal-swm-td is-num">{swmAbstractTotals.notSegregating}</td>
                      <td className="portal-swm-td is-pct">{swmPercent(swmAbstractTotals.notSegregating, swmAbstractTotals.householdsSurveyed)}%</td>
                      <td className="portal-swm-td is-num">{swmAbstractTotals.doorLocked}</td>
                      <td className="portal-swm-td is-pct">{swmPercent(swmAbstractTotals.doorLocked, swmAbstractTotals.householdsSurveyed)}%</td>
                      <td className="portal-swm-td is-num">{swmAbstractTotals.homeComposting}</td>
                      <td className="portal-swm-td is-pct">{swmPercent(swmAbstractTotals.homeComposting, swmAbstractTotals.householdsSurveyed)}%</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            ) : (
            <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse portal-studio-table">
                {/* 1. SUBJECT WISE RENDER */}
                {groupingStyle === 'subject' && (
                  <>
                    <thead>
                      <tr>
                        <th 
                          onClick={() => requestSort(lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn')}
                          className="cursor-pointer"
                        >
                          {lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'} {sortConfig?.key === (lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th 
                          onClick={() => requestSort(lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn')}
                          className="cursor-pointer"
                        >
                          {lang === 'ta' ? 'ஆய்வு வகை' : 'Category'} {sortConfig?.key === (lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th 
                          onClick={() => requestSort('totalInspections')}
                          className="cursor-pointer text-right"
                        >
                          {lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Count of Inspections'} {sortConfig?.key === 'totalInspections' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="border-0">
                            {embedEmptyMessage}
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.subjectNameTa : row.subjectNameEn}
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.categoryNameTa : row.categoryNameEn}
                            </td>
                            <td className="py-3.5 px-4 text-right font-black text-slate-900 dark:text-white text-sm border border-slate-100 dark:border-slate-800">
                              {row.totalInspections}
                            </td>
                          </tr>
                        ))
                      )}
                      {activeRows.length > 0 && (
                        <tr className="portal-fis-total">
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700 text-right font-black text-sm text-slate-900 dark:text-white">
                            <span className="portal-fis-count">{activeRowsTotal}</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}

                {/* 2. USER WISE RENDER */}
                {groupingStyle === 'user' && (
                  <>
                    <thead>
                      <tr>
                        <th onClick={() => requestSort(lang === 'ta' ? 'zoneNameTa' : 'zoneNameEn')} className="cursor-pointer">
                          {lang === 'ta' ? 'மண்டலம்' : 'Zone'} {sortConfig?.key === (lang === 'ta' ? 'zoneNameTa' : 'zoneNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th onClick={() => requestSort(lang === 'ta' ? 'districtNameTa' : 'districtNameEn')} className="cursor-pointer">
                          {lang === 'ta' ? 'மாவட்டம்' : 'District'} {sortConfig?.key === (lang === 'ta' ? 'districtNameTa' : 'districtNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th onClick={() => requestSort(lang === 'ta' ? 'tpNameTa' : 'tpNameEn')} className="cursor-pointer">
                          {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'} {sortConfig?.key === (lang === 'ta' ? 'tpNameTa' : 'tpNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th onClick={() => requestSort('userName')} className="cursor-pointer">
                          {lang === 'ta' ? 'பயனர் பெயர்' : 'User Name'} {sortConfig?.key === 'userName' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        <th onClick={() => requestSort('userDesignation')} className="cursor-pointer">
                          {lang === 'ta' ? 'பதவி' : 'Designation'} {sortConfig?.key === 'userDesignation' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        {userCols.subject && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'} {sortConfig?.key === (lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {userCols.category && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'ஆய்வு வகை' : 'Category'} {sortConfig?.key === (lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        <th onClick={() => requestSort('totalInspections')} className="cursor-pointer text-right">
                          {lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspection'} {sortConfig?.key === 'totalInspections' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={5 + (userCols.subject ? 1 : 0) + (userCols.category ? 1 : 0) + 1} className="border-0">
                            {embedEmptyMessage}
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-medium border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.zoneNameTa : row.zoneNameEn}
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.districtNameTa : row.districtNameEn}
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.tpNameTa : row.tpNameEn}
                            </td>
                            <td className="py-3.5 px-4 text-slate-900 dark:text-white font-bold border border-slate-100 dark:border-slate-800">
                              {row.userName}
                            </td>
                            <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                              {row.userDesignation}
                            </td>
                            {userCols.subject && (
                              <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-semibold border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.subjectNameTa : row.subjectNameEn}
                              </td>
                            )}
                            {userCols.category && (
                              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.categoryNameTa : row.categoryNameEn}
                              </td>
                            )}
                            <td className="text-right">
                              {row.totalInspections}
                            </td>
                          </tr>
                        ))
                      )}
                      {activeRows.length > 0 && (
                        <tr className="portal-fis-total">
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>
                          {userCols.subject && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {userCols.category && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          <td className="text-right">
                            <span className="portal-fis-count">{activeRowsTotal}</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}

                {/* 3. LOCATION WISE RENDER */}
                {groupingStyle === 'location' && (
                  <>
                    <thead>
                      <tr>
                        <th onClick={() => requestSort(lang === 'ta' ? 'zoneNameTa' : 'zoneNameEn')} className="cursor-pointer">
                          {lang === 'ta' ? 'மண்டலம்' : 'Zone'} {sortConfig?.key === (lang === 'ta' ? 'zoneNameTa' : 'zoneNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                        {locCols.district && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'districtNameTa' : 'districtNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'மாவட்டம்' : 'District'} {sortConfig?.key === (lang === 'ta' ? 'districtNameTa' : 'districtNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {locCols.tp && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'tpNameTa' : 'tpNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'} {sortConfig?.key === (lang === 'ta' ? 'tpNameTa' : 'tpNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {locCols.ward && (
                          <th onClick={() => requestSort('wardNumber')} className="cursor-pointer">
                            {lang === 'ta' ? 'வார்டு' : 'Ward'} {sortConfig?.key === 'wardNumber' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {locCols.street && (
                          <th onClick={() => requestSort('streetName')} className="cursor-pointer">
                            {lang === 'ta' ? 'தெரு' : 'Street'} {sortConfig?.key === 'streetName' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {locCols.subject && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'பிரிவு' : 'Subject'} {sortConfig?.key === (lang === 'ta' ? 'subjectNameTa' : 'subjectNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        {locCols.category && (
                          <th onClick={() => requestSort(lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn')} className="cursor-pointer">
                            {lang === 'ta' ? 'வகை' : 'Category'} {sortConfig?.key === (lang === 'ta' ? 'categoryNameTa' : 'categoryNameEn') ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                          </th>
                        )}
                        <th onClick={() => requestSort('totalInspections')} className="cursor-pointer text-right">
                          {lang === 'ta' ? 'ஆய்வு எண்ணிக்கை' : 'Total Inspection'} {sortConfig?.key === 'totalInspections' ? (sortConfig.direction === 'ascending' ? '▲' : '▼') : '↕'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="border-0">
                            {embedEmptyMessage}
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white border border-slate-100 dark:border-slate-800">
                              {lang === 'ta' ? row.zoneNameTa : row.zoneNameEn}
                            </td>
                            {locCols.district && (
                              <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.districtNameTa : row.districtNameEn}
                              </td>
                            )}
                            {locCols.tp && (
                              <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 font-medium border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.tpNameTa : row.tpNameEn}
                              </td>
                            )}
                            {locCols.ward && (
                              <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? `வார்டு ${row.wardNumber || '0'}` : `Ward ${row.wardNumber || '0'}`}
                              </td>
                            )}
                            {locCols.street && (
                              <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-xs border border-slate-100 dark:border-slate-800">
                                {streetLabel(row)}
                              </td>
                            )}
                            {locCols.subject && (
                              <td className="py-3.5 px-4 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.subjectNameTa : row.subjectNameEn}
                              </td>
                            )}
                            {locCols.category && (
                              <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-800">
                                {lang === 'ta' ? row.categoryNameTa : row.categoryNameEn}
                              </td>
                            )}
                            <td className="text-right">
                              {row.totalInspections}
                            </td>
                          </tr>
                        ))
                      )}
                      {activeRows.length > 0 && (
                        <tr className="portal-fis-total">
                          <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                          {locCols.district && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {locCols.tp && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {locCols.ward && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {locCols.street && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {locCols.subject && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          {locCols.category && <td className="py-3 px-4 border border-slate-200 dark:border-slate-700">-</td>}
                          <td className="text-right">
                            <span className="portal-fis-count">{activeRowsTotal}</span>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="portal-fis-pager">
                <span className="text-xs font-bold text-slate-500">
                  {lang === 'ta'
                    ? `பக்கம் ${abstractPage} / ${totalPages} (மொத்தம் ${activeRows.length} வரிசைகள்)`
                    : `Page ${abstractPage} of ${totalPages} (Total ${activeRows.length} rows)`}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAbstractPage(prev => Math.max(prev - 1, 1))}
                    disabled={abstractPage === 1}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 transition"
                  >
                    {lang === 'ta' ? 'முந்தைய' : 'Previous'}
                  </button>
                  <button
                    onClick={() => setAbstractPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={abstractPage === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-600 dark:text-slate-300 disabled:opacity-50 transition"
                  >
                    {lang === 'ta' ? 'அடுத்தது' : 'Next'}
                  </button>
                </div>
              </div>
            )}
            </>
            )}
            </div>
          </div>

          {/* Dynamic 0-entry (Not entered) Users & Subjects/Categories Lists based on filters */}
          {!embedMode && reportModule !== 'swm' && (
          <div className="portal-fis-zero-grid">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon"><Users className="h-3.5 w-3.5" /></span>
                    <span>{lang === 'ta' ? 'ஆய்வுப் பதிவு செய்யாத பணியாளர்கள்' : 'Not Entered Single Entry User List'}</span>
                    <span className="portal-fis-count">{zeroEntryUsers.length}</span>
                  </h3>
                  <p>{lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின் கீழ் 0 ஆய்வு செய்தவர்கள்' : 'Users with 0 work entries based on current filters'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportZeroUsersExcel}
                    disabled={zeroEntryUsers.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Users as Excel"
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportZeroUsersPDF}
                    disabled={zeroEntryUsers.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Users as PDF"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="portal-dash-bars is-scroll">
                  {zeroEntryUsers.map((user: any) => (
                    <div key={user.id} className="portal-fis-zero-item">
                      <div>
                        <strong>{tObj(user)}</strong>
                        <em>@{user.username} • {user.mobile}</em>
                      </div>
                      <span className="portal-dash-status is-progress">{user.designation || 'Sanitary Inspector'}</span>
                    </div>
                  ))}
                  {zeroEntryUsers.length === 0 && (
                    <p className="portal-fis-empty" style={{ padding: '1.5rem 0.5rem' }}>
                      {lang === 'ta' ? 'அனைத்து பயனர்களும் ஆய்வு செய்துள்ளனர்!' : 'All users have submitted inspections for these filters!'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon"><Layers className="h-3.5 w-3.5" /></span>
                    <span>{lang === 'ta' ? 'ஆய்வு செய்யப்படாத பிரிவுகள் & வகைகள்' : 'Not Entered Subject & Category List'}</span>
                    <span className="portal-fis-count">{zeroEntryCategories.length}</span>
                  </h3>
                  <p>{lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின் கீழ் 0 ஆய்வு செய்யப்பட்டவை' : 'Categories with 0 work entries based on current filters'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportZeroCategoriesExcel}
                    disabled={zeroEntryCategories.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Categories as Excel"
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportZeroCategoriesPDF}
                    disabled={zeroEntryCategories.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Categories as PDF"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="portal-dash-bars is-scroll">
                  {zeroEntryCategories.map((cat: any) => (
                    <div key={cat.id} className="portal-fis-zero-item">
                      <div>
                        <strong>{lang === 'ta' ? cat.nameTa : cat.nameEn}</strong>
                        <em>{lang === 'ta' ? `பிரிவு: ${cat.subjectNameTa}` : `Subject: ${cat.subjectNameEn}`}</em>
                      </div>
                    </div>
                  ))}
                  {zeroEntryCategories.length === 0 && (
                    <p className="portal-fis-empty" style={{ padding: '1.5rem 0.5rem' }}>
                      {lang === 'ta' ? 'அனைத்து பிரிவுகளிலும் ஆய்வு செய்யப்பட்டுள்ளது!' : 'All categories have inspections for these filters!'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}

      {activeTab === 'tp' && reportModule === 'swm' && (
        <div className="portal-fis-follow">
          <div className="portal-fis-results">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between portal-fis-results-head">
              <h3 className="flex items-center font-semibold text-slate-800 gap-1.5 text-[13px]">
                <Building2 className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
                <span>
                  {lang === 'ta'
                    ? 'SWM கண்காணிப்பு • வார்டு / தெரு அறிக்கை'
                    : 'SWM Monitoring • Ward / Street Report'}
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportSwmTpExcel}
                  disabled={isExportingExcel || swmTpStreetRows.length === 0}
                  className="portal-fis-chip portal-fis-chip-excel disabled:opacity-40"
                  title={lang === 'ta' ? 'பேரூராட்சி அறிக்கை எக்செல்' : 'Export TP report to Excel'}
                >
                  {isExportingExcel ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'ta' ? 'எக்செல்' : 'Excel Export'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportSwmTpPDF}
                  disabled={isExportingPdf || swmTpStreetRows.length === 0}
                  className="portal-fis-chip portal-fis-chip-pdf disabled:opacity-40"
                  title={lang === 'ta' ? 'பேரூராட்சி அறிக்கை PDF' : 'Export TP report to PDF'}
                >
                  {isExportingPdf ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'ta' ? 'PDF' : 'PDF Export'}</span>
                </button>
              </div>
            </div>

            <div className="portal-fis-table is-wide">
              <div className="overflow-x-auto portal-swm-table-view">
                <table className="w-full text-left text-xs border-collapse portal-studio-table">
                  <thead>
                    <tr>
                      <SwmHeaderCell lang={lang} col={SWM_COL.sno} align="sno" />
                      <SwmHeaderCell lang={lang} col={SWM_COL.wardNo} align="text" sortKey="ward" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.street} align="text" sortKey="street" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.households} align="num" sortKey="householdsSurveyed" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.segregating} align="num" sortKey="segregating" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="segregatingPct" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.notSegregating} align="num" sortKey="notSegregating" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="notSegregatingPct" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.doorLocked} align="num" sortKey="doorLocked" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="doorLockedPct" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.compost} align="num" sortKey="homeComposting" sortState={swmSort} onSort={toggleSwmSort} />
                      <SwmHeaderCell lang={lang} col={SWM_COL.pct} align="pct" sortKey="homeCompostingPct" sortState={swmSort} onSort={toggleSwmSort} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {swmAbstractLoading && swmTpStreetRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="portal-swm-viewport-msg">
                          <SwmViewportStatus
                            loading
                            lang={lang}
                            loadingLabel={lang === 'ta' ? 'SWM பேரூராட்சி அறிக்கை ஏற்றப்படுகிறது...' : 'Loading SWM TP report...'}
                          />
                        </td>
                      </tr>
                    ) : swmTpStreetRows.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="portal-swm-viewport-msg">
                          <SwmViewportStatus
                            lang={lang}
                            loadingLabel=""
                          />
                        </td>
                      </tr>
                    ) : (
                      swmTpStreetRowsView.map((row, idx) => (
                        <tr key={`${row.wardNumber}-${row.streetName}-${idx}`}>
                          <td className="portal-swm-td is-sno">{idx + 1}</td>
                          <td className="portal-swm-td is-text">{formatSwmWard(row.wardNumber, lang)}</td>
                          <td className="portal-swm-td is-text is-strong">{row.streetName}</td>
                          <td className="portal-swm-td is-num">{row.householdsSurveyed}</td>
                          <td className="portal-swm-td is-num">{row.segregating}</td>
                          <td className="portal-swm-td is-pct">{row.segregatingPct}%</td>
                          <td className="portal-swm-td is-num">{row.notSegregating}</td>
                          <td className="portal-swm-td is-pct">{row.notSegregatingPct}%</td>
                          <td className="portal-swm-td is-num">{row.doorLocked}</td>
                          <td className="portal-swm-td is-pct">{row.doorLockedPct}%</td>
                          <td className="portal-swm-td is-num">{row.homeComposting}</td>
                          <td className="portal-swm-td is-pct">{row.homeCompostingPct}%</td>
                        </tr>
                      ))
                    )}
                    {!swmAbstractLoading && swmTpStreetRows.length > 0 && (
                      <tr className="portal-fis-total">
                        <td className="portal-swm-td is-sno">{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                        <td className="portal-swm-td is-text">-</td>
                        <td className="portal-swm-td is-text">-</td>
                        <td className="portal-swm-td is-num">{swmTpStreetTotals.householdsSurveyed}</td>
                        <td className="portal-swm-td is-num">{swmTpStreetTotals.segregating}</td>
                        <td className="portal-swm-td is-pct">{swmPercent(swmTpStreetTotals.segregating, swmTpStreetTotals.householdsSurveyed)}%</td>
                        <td className="portal-swm-td is-num">{swmTpStreetTotals.notSegregating}</td>
                        <td className="portal-swm-td is-pct">{swmPercent(swmTpStreetTotals.notSegregating, swmTpStreetTotals.householdsSurveyed)}%</td>
                        <td className="portal-swm-td is-num">{swmTpStreetTotals.doorLocked}</td>
                        <td className="portal-swm-td is-pct">{swmPercent(swmTpStreetTotals.doorLocked, swmTpStreetTotals.householdsSurveyed)}%</td>
                        <td className="portal-swm-td is-num">{swmTpStreetTotals.homeComposting}</td>
                        <td className="portal-swm-td is-pct">{swmPercent(swmTpStreetTotals.homeComposting, swmTpStreetTotals.householdsSurveyed)}%</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DETAILED FIELD REGISTER VIEW                                       */}
      {/* ========================================================================= */}
      {activeTab === 'detailed' && reportModule !== 'swm' && (
        <div className="portal-fis-follow">
        <div className="portal-fis-results">
          <div className="portal-fis-results-head">
            <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-slate-800">
              <FileSpreadsheet className="h-4 w-4" style={{ color: 'var(--theme-accent)' }} />
              <span>{lang === 'ta' ? 'முழுமையான கள ஆய்வு பதிவேடு' : 'Detailed Field Work Records'}</span>
              <span className="portal-fis-count">{filteredWorksTotal}</span>
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Download Excel */}
              <button
                onClick={handleExportDetailedExcel}
                disabled={filteredWorks.length === 0 || isExportingExcel}
                className="portal-fis-chip portal-fis-chip-excel disabled:opacity-40"
                title={selectedCategoryId === 'all' ? (lang === 'ta' ? 'அனைத்து வகைகளும் தனித்தனி தாள்களில் எக்செல் பதிவிறக்கம்' : 'Download Excel with each category in a separate sheet') : (lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வகைக்கு எக்செல்' : 'Download Excel for selected category')}
              >
                {isExportingExcel ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                )}
                <span>
                  {isExportingExcel
                    ? (lang === 'ta' ? 'பதிவிறக்குகிறது...' : 'Downloading...')
                    : (lang === 'ta' ? 'எக்செல் பதிவிறக்கம்' : 'Download Excel')}
                </span>
              </button>

              {/* Download PDF */}
              <button
                onClick={handleExportDetailedPDF}
                disabled={filteredWorks.length === 0 || isExportingPdf}
                className="portal-fis-chip portal-fis-chip-pdf disabled:opacity-40"
                title={lang === 'ta' ? 'பிடிஎஃப் பதிவிறக்கம்' : 'Download PDF'}
              >
                {isExportingPdf ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                <span>
                  {isExportingPdf
                    ? (lang === 'ta' ? 'பதிவிறக்குகிறது...' : 'Downloading...')
                    : (lang === 'ta' ? 'பிடிஎஃப் பதிவிறக்கம்' : 'Download PDF')}
                </span>
              </button>

              {/* Admin Role Only: TP Wise Excel Button */}
              {isAdminRole && (
                <button
                  onClick={handleExportDetailedTPWiseExcel}
                  disabled={filteredWorks.length === 0}
                  className="portal-fis-chip portal-fis-chip-tp-excel disabled:opacity-40"
                  title={lang === 'ta' ? 'பேரூராட்சி வாரியாக ஒவ்வொரு தாளில் எக்செல் பதிவிறக்கம்' : 'Download TP-wise detailed register with each Town Panchayat in a separate sheet'}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>{lang === 'ta' ? 'பேரூராட்சி வாரியாக (Excel)' : 'TP Wise Excel'}</span>
                </button>
              )}

              {/* Admin Role Only: TP Wise PDF (ZIP) Button */}
              {isAdminRole && (
                <button
                  onClick={handleExportDetailedTPWisePDF}
                  disabled={filteredWorks.length === 0 || isExportingZip}
                  className="portal-fis-chip portal-fis-chip-tp-pdf disabled:opacity-40"
                  title={lang === 'ta' ? 'பேரூராட்சி வாரியாக விரிவான பதிவேடு தனித்தனி PDF-களை ZIP வடிவில் பதிவிறக்கம்' : 'Download ZIP containing individual detailed register PDF for each Town Panchayat'}
                >
                  {isExportingZip ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FolderArchive className="w-3.5 h-3.5" />
                  )}
                  <span>{lang === 'ta' ? 'பேரூராட்சி வாரியாக PDF (ZIP)' : 'TP Wise PDF (ZIP)'}</span>
                </button>
              )}

              {/* Fullscreen Slideview Button */}
              {filteredWorks.length > 0 && (
                <button
                  onClick={() => {
                    openSlideAtGlobalIndex(
                      worksFromApi ? (detailedPage - 1) * REPORTS_SERVER_PAGE_SIZE : 0
                    );
                  }}
                  className="portal-dash-pill is-active"
                  title={lang === 'ta' ? 'விளக்க காட்சி' : 'Slide View'}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>{lang === 'ta' ? 'விளக்க காட்சி' : 'Slide View'}</span>
                </button>
              )}
            </div>
          </div>

          {reportModule !== 'swm' && (
          <div className="portal-fis-cats">
            <div className="portal-fis-cats-head">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {lang === 'ta' ? 'பிரிவின் கீழ் உள்ள ஆய்வு வகைகள்' : 'Categories in subject'}
            </div>
            <div className="portal-fis-cats-list">
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryId('all');
                  queueMicrotask(() => applyFiltersAndLoad());
                }}
                className={`portal-fis-cat ${selectedCategoryId === 'all' ? 'is-active' : ''}`}
              >
                <span className="portal-fis-cat-name">{lang === 'ta' ? 'அனைத்து வகைகளும்' : 'All categories'}</span>
                <span className="portal-fis-count">{worksFromApi ? apiTotalWithoutCategory : filteredWorks.length}</span>
              </button>
              {availableCategories.map((cat: any) => {
                const isSelected = selectedCategoryId === cat.id || selectedCategoryId === cat.nameEn;
                const count = Number(resolveCategoryCountFromApi(cat) || 0);

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryId(isSelected ? 'all' : cat.id);
                      queueMicrotask(() => applyFiltersAndLoad());
                    }}
                    className={`portal-fis-cat ${isSelected ? 'is-active' : ''} ${count === 0 ? 'is-empty' : ''}`}
                    title={lang === 'ta' ? cat.nameTa || cat.nameEn : cat.nameEn}
                  >
                    <span className="portal-fis-cat-name">{lang === 'ta' ? cat.nameTa || cat.nameEn : cat.nameEn}</span>
                    <span className="portal-fis-count">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
          )}

          <div className="portal-fis-table is-wide">
            <table className="w-full text-left text-xs border-collapse portal-studio-table">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleDetailedSort('workId')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'பணி எண்' : 'Work ID'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'workId' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('submittedAt')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'தேதி & நேரம்' : 'Date & Time'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'submittedAt' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('subject')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'ஆய்வுப் பிரிவு' : 'Subject'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'subject' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('category')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'ஆய்வு வகை' : 'Category'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'category' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('ward')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'வார்டு' : 'Ward'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'ward' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('street')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'தெரு' : 'Street'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'street' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('username')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'பயனர் பெயர்' : 'User Name'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'username' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('designation')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center gap-1">
                      <span>{lang === 'ta' ? 'பதவி' : 'Designation'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'designation' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  <th 
                    onClick={() => handleDetailedSort('gps')}
                    className="cursor-pointer"
                    title={lang === 'ta' ? 'வரிசைப்படுத்த கிளிக் செய்யவும்' : 'Click to sort'}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>{lang === 'ta' ? 'ஜிபிஎஸ்' : 'GPS Coordinates'}</span>
                      <span className="portal-dash-sort text-[10px] font-bold">
                        {detailedSortField === 'gps' ? (detailedSortDirection === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </div>
                  </th>
                  {dynamicColumns.map((col: any) => (
                    <th key={col.id}>
                      {lang === 'ta' ? col.nameTa || col.nameEn : col.nameEn}
                    </th>
                  ))}
                  <th>
                    <span>{lang === 'ta' ? 'செயல்கள்' : 'Actions'}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredWorks.length === 0 ? (
                  <tr>
                    <td colSpan={10 + dynamicColumns.length} className="border-0">
                      {lang === 'ta' ? 'பொருந்தும் ஆய்வுகள் எதுவும் இல்லை.' : 'No detailed inspection works found matching your filter criteria.'}
                    </td>
                  </tr>
                ) : (
                  paginatedDetailedWorks.map((work) => {
                    const textFields = getWorkTextData(work);
                    const photos = getWorkPhotos(work);

                    return (
                      <tr key={work.id || work.workId}>
                        <td className="portal-dash-id">
                          {work.workId || work.id}
                        </td>
                        <td>
                          {formatIndianTime(work.submittedAt)}
                        </td>
                        <td className="portal-fis-clip">
                          {lang === 'ta' ? work.subjectNameTa || work.subjectNameEn : work.subjectNameEn}
                        </td>
                        <td className="portal-fis-clip">
                          {lang === 'ta' ? work.categoryNameTa || work.categoryNameEn : work.categoryNameEn}
                        </td>
                        <td>
                          Ward {work.wardNumber || work.wardNo || '-'}
                        </td>
                        <td className="portal-fis-clip">
                          {streetLabel(work)}
                        </td>
                        <td className="portal-fis-clip">
                          {work.submittedByUserName || work.submittedByName || 'Field Cadre'}
                        </td>
                        <td>
                          <span className="portal-dash-status is-progress">
                            {getInspectorDesignation(work)}
                          </span>
                        </td>
                        <td>
                          {work.latitude && work.longitude ? (
                            <button
                              type="button"
                              onClick={() => setGpsModalWork(work)}
                              className="portal-fis-gps"
                              title="Click to open Google Map Lite popup"
                            >
                              <MapPin className="w-3 h-3" />
                              <span>{Number(work.latitude).toFixed(4)}, {Number(work.longitude).toFixed(4)}</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400">No GPS</span>
                          )}
                        </td>
                        {dynamicColumns.map((col: any) => {
                          const val = getWorkDynamicFieldValue(work, col, state.inspectionFields || []);
                          const isPhoto = ['camera', 'image', 'image_upload'].includes(String(col.type || col.fieldType || '').toLowerCase()) || (typeof val === 'string' && (val.startsWith('http') || val.startsWith('/uploads') || val.includes('s3.amazonaws.com') || val.endsWith('.jpg') || val.endsWith('.png')));
                          
                          return (
                            <td key={col.id} className="portal-fis-clip">
                              {isPhoto && val ? (
                                <div 
                                  onClick={() => setPhotoPreviewModal({ url: val, label: lang === 'ta' ? col.nameTa || col.nameEn : col.nameEn, work })}
                                  className="portal-fis-thumb-wrap cursor-pointer"
                                  title={lang === 'ta' ? 'பெரிதாக்க கிளிக் செய்க' : 'Click to preview'}
                                >
                                  <img 
                                    src={val} 
                                    alt={col.nameEn}
                                    width={16}
                                    height={16}
                                    className="portal-fis-thumb"
                                    onError={(e) => {
                                      if (!e.currentTarget.dataset.retried) {
                                        e.currentTarget.dataset.retried = 'true';
                                        e.currentTarget.src = toStableMediaSrc(val);
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <span>{val || '-'}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="portal-fis-actions">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Slideview Button */}
                            <button
                              onClick={() => {
                                const localIdx = paginatedDetailedWorks.findIndex(
                                  (w: any) => w.id === work.id || w.workId === work.workId
                                );
                                const globalIdx = worksFromApi
                                  ? (detailedPage - 1) * REPORTS_SERVER_PAGE_SIZE + Math.max(localIdx, 0)
                                  : (localIdx >= 0 ? localIdx : 0);
                                openSlideAtGlobalIndex(globalIdx);
                              }}
                              className="portal-fis-icon-btn"
                              title={lang === 'ta' ? 'விளக்க காட்சி' : 'Open Slide View'}
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Google Map Lite Map Popup Button */}
                            {work.latitude && work.longitude && (
                              <button
                                onClick={() => setGpsModalWork(work)}
                                className="portal-fis-icon-btn is-map"
                                title="Open Google Map Lite Popup"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* View Details Modal */}
                            <button
                              onClick={() => setSelectedWorkModal(work)}
                              className="portal-fis-icon-btn is-muted"
                              title="View Full Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete (Admin Only) */}
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteWork(work.id || work.workId)}
                                className="portal-fis-icon-btn is-danger"
                                title="Delete Work"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {detailedTotalPages > 1 && (
            <div className="portal-fis-pager">
              <span>
                {lang === 'ta'
                  ? `பக்கம் ${detailedPage} / ${detailedTotalPages} (மொத்தம் ${filteredWorksTotal} வரிசைகள்)`
                  : `Page ${detailedPage} of ${detailedTotalPages} (Total ${filteredWorksTotal} rows)`}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailedPage(prev => Math.max(prev - 1, 1))}
                  disabled={detailedPage === 1}
                >
                  {lang === 'ta' ? 'முந்தைய' : 'Previous'}
                </button>
                <button
                  type="button"
                  onClick={() => setDetailedPage(prev => Math.min(prev + 1, detailedTotalPages))}
                  disabled={detailedPage === detailedTotalPages}
                >
                  {lang === 'ta' ? 'அடுத்தது' : 'Next'}
                </button>
              </div>
            </div>
          )}
        </div>

          <div className="portal-fis-zero-grid">
            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon"><Users className="h-3.5 w-3.5" /></span>
                    <span>{lang === 'ta' ? 'ஆய்வுப் பதிவு செய்யாத பணியாளர்கள்' : 'Not Entered Single Entry User List'}</span>
                    <span className="portal-fis-count">{zeroEntryUsers.length}</span>
                  </h3>
                  <p>{lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின் கீழ் 0 ஆய்வு செய்தவர்கள்' : 'Users with 0 work entries based on current filters'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportZeroUsersExcel}
                    disabled={zeroEntryUsers.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Users as Excel"
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportZeroUsersPDF}
                    disabled={zeroEntryUsers.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Users as PDF"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="portal-dash-bars is-scroll">
                  {zeroEntryUsers.map((user: any, idx: number) => (
                    <div key={user.id || idx} className="portal-fis-zero-item">
                      <div>
                        <strong>{tObj(user)}</strong>
                        <em>
                          @{user.username}
                          {user.mobile ? ` • ${user.mobile}` : ''}
                          {` • ${user.resolvedDesignation || user.designation || 'Field Worker'}`}
                        </em>
                        <em>
                          {[
                            lang === 'ta' ? user.zoneNameTa || user.zoneNameEn : user.zoneNameEn,
                            lang === 'ta' ? user.districtNameTa || user.districtNameEn : user.districtNameEn,
                            lang === 'ta' ? user.tpNameTa || user.tpNameEn : user.tpNameEn,
                          ].filter(Boolean).join(' • ')}
                          {` • ${user.lastWorkEntry || 'Never'}`}
                        </em>
                      </div>
                      <span className="portal-dash-status is-pending shrink-0">{lang === 'ta' ? '0 பதிவு' : '0 Entries'}</span>
                    </div>
                  ))}
                  {zeroEntryUsers.length === 0 && (
                    <p className="portal-fis-empty" style={{ padding: '1.5rem 0.5rem' }}>
                      {lang === 'ta' ? 'அனைத்து பணியாளர்களும் ஆய்வு செய்துள்ளனர்!' : 'All users have submitted inspections for these filters!'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="portal-dashboard-panel">
              <div className="portal-dash-head">
                <div>
                  <h3>
                    <span className="portal-dash-icon"><Layers className="h-3.5 w-3.5" /></span>
                    <span>{lang === 'ta' ? 'ஆய்வு செய்யப்படாத பிரிவுகள் & வகைகள்' : 'Not Entered Subject & Category List'}</span>
                    <span className="portal-fis-count">{zeroEntryCategories.length}</span>
                  </h3>
                  <p>{lang === 'ta' ? 'தேர்ந்தெடுக்கப்பட்ட வடிகட்டிகளின் கீழ் 0 ஆய்வு செய்யப்பட்டவை' : 'Categories with 0 work entries based on current filters'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportZeroCategoriesExcel}
                    disabled={zeroEntryCategories.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Categories as Excel"
                  >
                    <FileSpreadsheet className="h-3 w-3" />
                    Excel
                  </button>
                  <button
                    type="button"
                    onClick={handleExportZeroCategoriesPDF}
                    disabled={zeroEntryCategories.length === 0}
                    className="portal-dash-head-action disabled:opacity-40"
                    title="Download Not Entered Categories as PDF"
                  >
                    <Download className="h-3 w-3" />
                    PDF
                  </button>
                </div>
              </div>
              <div className="portal-dash-body">
                <div className="portal-dash-bars is-scroll">
                  {zeroEntryCategories.map((cat: any) => (
                    <div key={cat.id} className="portal-fis-zero-item">
                      <div>
                        <strong>{lang === 'ta' ? cat.nameTa : cat.nameEn}</strong>
                        <em>{lang === 'ta' ? `பிரிவு: ${cat.subjectNameTa}` : `Subject: ${cat.subjectNameEn}`}</em>
                      </div>
                    </div>
                  ))}
                  {zeroEntryCategories.length === 0 && (
                    <p className="portal-fis-empty" style={{ padding: '1.5rem 0.5rem' }}>
                      {lang === 'ta' ? 'அனைத்து பிரிவுகளிலும் ஆய்வு செய்யப்பட்டுள்ளது!' : 'All categories have inspections for these filters!'}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: EXPANDED MAP VIEW REPORT WITH 3 MODELS                             */}
      {/* ========================================================================= */}
      {activeTab === 'mapview' && reportModule !== 'swm' && (
        <MapViewReport
          works={filteredWorks}
          state={state}
          lang={lang}
          selectedZoneId={selectedZoneId}
          selectedDistrictId={selectedDistrictId}
          selectedTpId={selectedTpId}
          selectedWard={selectedWard}
          selectedStreetName={selectedStreetName}
          selectedSubjectId={selectedSubjectId}
          selectedCategoryId={selectedCategoryId}
          fromDate={fromDate}
          toDate={toDate}
          searchQuery={searchQuery}
          googleMapsApiKey={state?.settings?.googleMapsApiKey}
          onOpenDetailsModal={(work) => setSelectedWorkModal(work)}
        />
      )}
      </div>

      {/* ========================================================================= */}
      {/* DETAILED WORK SLIP MODAL DIALOG                                           */}
      {/* ========================================================================= */}
      {selectedWorkModal && (
        <div className="portal-modal-overlay">
          <div className="portal-modal max-w-2xl w-full">
            <div className="portal-dash-modal-head flex items-start justify-between gap-3 px-5 py-3.5">
              <div>
                <span className="portal-dash-modal-badge text-[10px] font-mono font-bold px-2.5 py-1 rounded-full">
                  {selectedWorkModal.workId || selectedWorkModal.id}
                </span>
                <h3 className="text-[15px] font-bold tracking-tight mt-1.5">
                  {lang === 'ta' ? selectedWorkModal.subjectNameTa : selectedWorkModal.subjectNameEn} - {lang === 'ta' ? selectedWorkModal.categoryNameTa : selectedWorkModal.categoryNameEn}
                </h3>
                <p className="text-[11px] text-white/70 mt-0.5">
                  {selectedWorkModal.tpNameEn || 'Thiruporur'} Town Panchayat • Ward {selectedWorkModal.wardNumber} ({streetLabel(selectedWorkModal)})
                </p>
              </div>
              <button
                onClick={() => setSelectedWorkModal(null)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="portal-modal-body">

            {/* Modal Body */}
            <div className="space-y-4 my-4">
              {/* Photo Evidence with 3-Row Golden Amber Caption Frame matching Mobile App */}
              {selectedWorkModal.imageUrl && (
                <div className="relative rounded-2xl overflow-hidden border border-amber-300 dark:border-amber-700/60 shadow-lg bg-black">
                  <div className="relative">
                    <img
                      src={selectedWorkModal.imageUrl}
                      onError={(e) => {
                        if (!e.currentTarget.dataset.retried && selectedWorkModal.imageUrl) {
                          e.currentTarget.dataset.retried = 'true';
                          e.currentTarget.src = toStableMediaSrc(selectedWorkModal.imageUrl);
                        }
                      }}
                      alt="Field evidence"
                      className="w-full max-h-80 object-contain bg-slate-950 block"
                    />
                    <a
                      href={selectedWorkModal.imageUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-3 right-3 bg-black/70 hover:bg-black text-white text-[11px] px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition shadow-md"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>View S3 Photo</span>
                    </a>
                  </div>

                  {/* 3-Row Golden Amber Photo Caption matching mobile app with minimal line space and NO separators */}
                  <div className="bg-[#FBBF24] py-1.5 px-3 text-center text-[#7F1D1D] select-text leading-tight flex flex-col gap-0.5">
                    {/* Line 1: Tp, zone, district */}
                    <div className="font-black text-[11px] md:text-xs">
                      {selectedWorkModal.tpNameEn || 'Thiruporur'}, {selectedWorkModal.zoneNameEn || 'Zone 1'}, {selectedWorkModal.districtNameEn || 'Chengalpattu'}
                    </div>

                     {/* Line 2: next line ward & streets, inspection subject, field name stamp */}
                    <div className="font-bold text-[10px] md:text-[11px]">
                      Ward No: {selectedWorkModal.wardNumber || '1'}, {streetLabel(selectedWorkModal)} • {lang === 'ta' ? selectedWorkModal.subjectNameTa : selectedWorkModal.subjectNameEn}
                    </div>

                    {/* Line 3: next line is date & time, gps lat & long */}
                    <div className="font-bold text-[9px] md:text-[10px]">
                      {formatTo12Hr(selectedWorkModal.submittedAt) || new Date().toLocaleString('en-US', { hour12: true })} • GPS: {selectedWorkModal.latitude || '12.7244'}, {selectedWorkModal.longitude || '80.1873'}
                    </div>
                    <div className="mt-1 rounded-lg bg-amber-100 px-2 py-1 font-black text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                      {getImageFieldLabel(selectedWorkModal, selectedWorkModal.imageUrl)}
                    </div>
                  </div>
                </div>
              )}

              {/* Caption */}
              {selectedWorkModal.imageCaption && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 italic">
                  &ldquo;{selectedWorkModal.imageCaption}&rdquo;
                </div>
              )}

              {/* Dynamic Key-Values */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  {lang === 'ta' ? 'கள ஆய்வு விவரங்கள் (Dynamic Fields)' : 'Audit Field Key-Values'}
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {selectedWorkModal.fieldsData && Object.entries(selectedWorkModal.fieldsData).map(([key, val]) => {
                    const isImageUrl = typeof val === 'string' && (
                      val.startsWith('http') || 
                      val.startsWith('/') || 
                      val.includes('offline_images') || 
                      val.toLowerCase().endsWith('.jpg') || 
                      val.toLowerCase().endsWith('.jpeg') || 
                      val.toLowerCase().endsWith('.png')
                    ) && (
                      val.toLowerCase().includes('photo') || 
                      val.toLowerCase().includes('image') || 
                      val.toLowerCase().includes('s3') || 
                      val.toLowerCase().includes('captured') ||
                      key.toLowerCase().includes('photo') ||
                      key.toLowerCase().includes('image') ||
                      key.toLowerCase().includes('camera')
                    );

                    if (isImageUrl) {
                      if (String(val) === selectedWorkModal.imageUrl) {
                        return null; // Skip duplicate of the main photo
                      }
                      return (
                        <div key={key} className="col-span-2 relative rounded-2xl overflow-hidden border border-amber-300 dark:border-amber-700/60 shadow-lg bg-black mt-2">
                          <div className="relative">
                            <img
                              src={val}
                              onError={(e) => {
                                if (!e.currentTarget.dataset.retried) {
                                  e.currentTarget.dataset.retried = 'true';
                                  e.currentTarget.src = toStableMediaSrc(val);
                                }
                              }}
                              alt={key}
                              className="w-full max-h-80 object-contain bg-slate-950 block"
                            />
                            <a
                              href={val}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute top-3 right-3 bg-black/70 hover:bg-black text-white text-[11px] px-2.5 py-1 rounded-lg font-semibold flex items-center gap-1 transition shadow-md"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>View S3 Photo</span>
                            </a>
                          </div>

                          {/* 3-Row Golden Amber Stamp Caption for this camera field */}
                          <div className="bg-[#FBBF24] py-1.5 px-3 text-center text-[#7F1D1D] select-text leading-tight flex flex-col gap-0.5">
                            <div className="font-black text-[11px] md:text-xs">
                              {selectedWorkModal.tpNameEn || 'Thiruporur'}, {selectedWorkModal.zoneNameEn || 'Zone 1'}, {selectedWorkModal.districtNameEn || 'Chengalpattu'}
                            </div>
                            <div className="font-bold text-[10px] md:text-[11px]">
                              Ward No: {selectedWorkModal.wardNumber || '1'}, {streetLabel(selectedWorkModal)} • {lang === 'ta' ? selectedWorkModal.subjectNameTa : selectedWorkModal.subjectNameEn}
                            </div>
                            <div className="font-bold text-[9px] md:text-[10px]">
                              {formatTo12Hr(selectedWorkModal.submittedAt) || new Date().toLocaleString('en-US', { hour12: true })} • GPS: {selectedWorkModal.latitude || '12.7244'}, {selectedWorkModal.longitude || '80.1873'}
                            </div>
                            <div className="mt-1 rounded-lg bg-amber-100 px-2 py-1 font-black text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100">
                              {getImageFieldLabel(selectedWorkModal, String(val), key)}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={key} className="p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] text-slate-400 block uppercase font-mono">{key}</span>
                        <strong className="text-slate-900 dark:text-white font-semibold">{String(val)}</strong>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Storage sync breakdown */}
              <div className="p-3 rounded-xl border space-y-1.5" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 16%, #e8edf4)', background: 'color-mix(in srgb, var(--theme-accent) 6%, #ffffff)' }}>
                <div className="flex items-center gap-2 text-xs font-bold portal-dash-label">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Dual Cloud Storage Verified (MongoDB Primary + S3 Backup)</span>
                </div>
                <div className="text-[11px] font-mono text-slate-600 break-all">
                  S3 Hierarchy: <strong>s3://{getWorkS3Path(selectedWorkModal)}</strong>
                </div>
                <div className="text-[11px] text-slate-500">
                  Persistent Storage: <strong>MongoDB collection &lsquo;inspectionWorks&rsquo;</strong>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setEditingWork({ ...selectedWorkModal });
                    setSelectedWorkModal(null);
                  }}
                  className="portal-fis-chip portal-fis-chip-tp-pdf"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Work</span>
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleDeleteWork(selectedWorkModal.id || selectedWorkModal.workId)}
                    className="portal-fis-chip portal-fis-chip-pdf"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="portal-fis-chip portal-fis-chip-tp-excel"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Slip</span>
                </button>
                <button
                  onClick={() => setSelectedWorkModal(null)}
                  className="portal-dash-action rounded-lg px-4 py-2 text-xs font-bold"
                >
                  Close
                </button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* EDIT INSPECTION WORK MODAL                                                */}
      {/* ========================================================================= */}
      {editingWork && (
        <div className="portal-modal-overlay">
          <div className="portal-modal max-w-xl w-full">
            <div className="portal-dash-modal-head flex items-center justify-between gap-3 px-5 py-3.5">
              <h3 className="flex items-center gap-2">
                <span className="portal-dash-icon"><Pencil className="h-3.5 w-3.5" /></span>
                <span>{lang === 'ta' ? 'ஆய்வு விவரங்களை திருத்து' : 'Edit Inspection Work'} ({editingWork.workId || editingWork.id})</span>
              </h3>
              <button
                onClick={() => setEditingWork(null)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="portal-modal-body">

            <form onSubmit={handleSaveEditWork} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Status</label>
                  <ThemeSelect
                    value={editingWork.status || 'Completed'}
                    onChange={(e) => setEditingWork({ ...editingWork, status: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-semibold"
                  >
                    <option value="Completed">Completed</option>
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Action Required">Action Required</option>
                  </ThemeSelect>
                </div>

                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Ward Number</label>
                  {editingTpWardsList.length > 0 ? (
                    <ThemeSelect
                      value={editingWork.wardNumber || ''}
                      onChange={(e) => {
                        const newWard = e.target.value;
                        // Find first street of this ward to set as a reasonable default with normalized matching
                        const normNewWard = String(newWard).trim().replace(/^0+/, '') || '0';
                        const firstStreetObj = (state.wardsAndStreets || []).find(
                          (ws: any) => {
                            const wsWard = String(ws.wardNo || ws.wardNumber || '').trim().replace(/^0+/, '') || '0';
                            return ws.tpId === editingWork.tpId && wsWard === normNewWard;
                          }
                        );
                        const defaultStreetName = firstStreetObj 
                          ? (lang === 'ta' ? (firstStreetObj.streetNameTa || firstStreetObj.streetNameEn) : (firstStreetObj.streetNameEn || firstStreetObj.streetNameTa))
                          : '';
                        setEditingWork({ 
                          ...editingWork, 
                          wardNumber: newWard,
                          streetName: defaultStreetName
                        });
                      }}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-semibold text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="">Select Ward</option>
                      {editingTpWardsList.map((wardNum) => (
                        <option key={wardNum} value={wardNum}>Ward {wardNum}</option>
                      ))}
                      {editingWork.wardNumber && !editingTpWardsList.includes(String(editingWork.wardNumber)) && (
                        <option value={editingWork.wardNumber}>Ward {editingWork.wardNumber}</option>
                      )}
                      <option value="custom">{lang === 'ta' ? 'மற்றவை / புதிய வார்டு' : 'Other / Custom Ward'}</option>
                    </ThemeSelect>
                  ) : (
                    <input
                      type="number"
                      value={editingWork.wardNumber || ''}
                      onChange={(e) => setEditingWork({ ...editingWork, wardNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-xs text-slate-800 dark:text-slate-200"
                      placeholder="e.g. 5"
                    />
                  )}
                  {editingWork.wardNumber === 'custom' && (
                    <input
                      type="number"
                      placeholder="Enter Custom Ward No"
                      onChange={(e) => setEditingWork({ ...editingWork, wardNumber: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 mt-1.5 outline-none text-xs text-slate-800 dark:text-slate-200"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Street / Location Name</label>
                {editingTpStreetsList.length > 0 ? (
                  <ThemeSelect
                    value={editingWork.streetName || ''}
                    onChange={(e) => {
                      if (e.target.value === 'custom') {
                        setEditingWork({ ...editingWork, streetName: '', isCustomStreet: true });
                      } else {
                        setEditingWork({ ...editingWork, streetName: e.target.value, isCustomStreet: false });
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none font-semibold text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="">Select Street</option>
                    {editingTpStreetsList.map((street: { en: string; ta: string }, sIdx: number) => {
                      const displayStreet = lang === 'ta' ? (street.ta || street.en) : (street.en || street.ta);
                      return (
                        <option key={sIdx} value={displayStreet}>{displayStreet}</option>
                      );
                    })}
                    {editingWork.streetName && !editingTpStreetsList.some((s: { en: string; ta: string }) => (lang === 'ta' ? (s.ta || s.en) : (s.en || s.ta)) === editingWork.streetName) && (
                      <option value={editingWork.streetName}>{editingWork.streetName}</option>
                    )}
                    <option value="custom">{lang === 'ta' ? 'மற்றவை / புதிய தெரு' : 'Other / Custom Street'}</option>
                  </ThemeSelect>
                ) : (
                  <input
                    type="text"
                    value={editingWork.streetName || ''}
                    onChange={(e) => setEditingWork({ ...editingWork, streetName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                )}
                {(editingTpStreetsList.length === 0 || editingWork.isCustomStreet || !editingWork.streetName) && (
                  <input
                    type="text"
                    placeholder={lang === 'ta' ? 'தெரு பெயர் தட்டச்சு செய்க' : 'Type Street Name...'}
                    value={editingWork.streetName || ''}
                    onChange={(e) => setEditingWork({ ...editingWork, streetName: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 mt-1.5 outline-none text-xs text-slate-800 dark:text-slate-200"
                  />
                )}
              </div>

              <div>
                <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-1">Photo Caption / Note</label>
                <textarea
                  rows={2}
                  value={editingWork.imageCaption || ''}
                  onChange={(e) => setEditingWork({ ...editingWork, imageCaption: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none"
                />
              </div>

              {/* Dynamic Key-Values Editing */}
              {editingWork && (
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-300 block mb-2 uppercase text-[10px] tracking-wider">
                    {lang === 'ta' ? 'கள ஆய்வு விவரங்கள் (Dynamic Fields)' : 'Dynamic Inspection Field Values'}
                  </label>
                  <div className="space-y-3">
                    {(() => {
                      const categoryFields = (state.inspectionFields || []).filter((f: any) => f.categoryId === editingWork.categoryId);
                      
                      if (categoryFields.length > 0) {
                        return categoryFields.map((field: any) => {
                          const isMand = field.isMandatory === true || field.isRequired === true;
                          const label = lang === 'ta' 
                            ? field.fieldNameTa || field.nameTa || field.fieldName || field.id
                            : field.fieldName || field.nameEn || field.id;
                          
                          // Look up current value
                          const currentVal = editingWork.fieldsData?.[field.id] !== undefined
                            ? editingWork.fieldsData[field.id]
                            : (editingWork.fieldsData?.[field.fieldName] || '');

                          return (
                            <div key={field.id} className="flex flex-col gap-1">
                              <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center">
                                <span>{label}</span>
                                {isMand && <span className="text-red-500 font-bold ml-1" title="Mandatory">*</span>}
                              </span>
                              <input
                                type="text"
                                value={String(currentVal || '')}
                                onChange={(e) => {
                                  const newFields = { 
                                    ...(editingWork.fieldsData || {}),
                                    [field.id]: e.target.value,
                                    [field.fieldName || field.id]: e.target.value
                                  };
                                  setEditingWork({ ...editingWork, fieldsData: newFields });
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 outline-none text-xs text-slate-800 dark:text-slate-200"
                              />
                            </div>
                          );
                        });
                      }

                      // Fallback if no schema is found in state.inspectionFields
                      if (editingWork.fieldsData) {
                        return Object.entries(editingWork.fieldsData).map(([key, val]) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="w-1/3 text-[11px] font-mono text-slate-500 truncate">{key}:</span>
                            <input
                              type="text"
                              value={String(val || '')}
                              onChange={(e) => {
                                const newFields = { ...(editingWork.fieldsData || {}), [key]: e.target.value };
                                setEditingWork({ ...editingWork, fieldsData: newFields });
                              }}
                              className="w-2/3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2 outline-none text-xs"
                            />
                          </div>
                        ));
                      }

                      return null;
                    })()}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingWork(null)}
                  className="portal-fis-chip portal-fis-chip-tp-excel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="portal-dash-action rounded-lg px-4 py-2 text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingEdit ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAILED WORK FULLSCREEN SLIDEVIEW (60% PHOTOS / 40% DETAILS)             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDetailedSlideOpen && currentSlideWork && (
          <motion.div
            ref={slideContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onTouchStart={handleSlideTouchStart}
            onTouchMove={handleSlideTouchMove}
            onTouchEnd={handleSlideTouchEnd}
            className={`fixed inset-0 z-50 flex flex-col w-full h-full overflow-hidden transition-colors duration-200 select-none ${slideTheme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-white'}`}
          >
            {isSlideDownloading && (
              <div className="hide-on-export portal-slide-export-progress is-blocking">
                <div className="portal-slide-export-progress-card">
                  <Loader2 className="h-5 w-5 animate-spin shrink-0" />
                  <div className="min-w-0">
                    <p>
                      {slideDeckExport
                        ? slideLang === 'ta'
                          ? `பதிவிறக்கம் தயாராகிறது ${slideDeckExport.current}/${slideDeckExport.total} · ${slideDeckExport.format === 'ppt' ? 'PPT' : 'PDF'}`
                          : `Preparing download ${slideDeckExport.current}/${slideDeckExport.total} · ${slideDeckExport.format === 'ppt' ? 'PPT' : 'PDF'}`
                        : slideLang === 'ta'
                          ? 'பதிவிறக்கம் நடைபெறுகிறது...'
                          : 'Download in progress...'}
                    </p>
                    <span
                      className={`portal-slide-export-progress-bar ${!slideDeckExport || slideDeckExport.current < 1 ? 'is-busy' : ''}`}
                      style={{
                        width: slideDeckExport
                          ? `${Math.max(8, Math.round((slideDeckExport.current / Math.max(1, slideDeckExport.total)) * 100))}%`
                          : '40%',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Top Bar with Autofit Height, Center-Aligned Subject & Category, Hierarchy & Action Controls */}
            <div className={`w-full h-auto min-h-fit py-2 px-3 md:px-6 flex flex-wrap items-center justify-between shrink-0 gap-2 md:gap-3 z-20 border-b transition-colors duration-200 ${slideTheme === 'light' ? 'bg-white border-slate-200 text-slate-800 shadow-xs' : 'bg-slate-900/95 border-slate-800 text-white'}`}>
              {/* Left: Work index & Nav & Inspector info */}
              <div className="flex items-center gap-2 md:gap-2.5 shrink-0">
                <span className="text-[11px] font-mono font-bold px-2 py-1 rounded-lg text-white shrink-0" style={{ background: 'var(--theme-accent)' }}>
                  {detailedSlideIndex + 1} / {slideRecordTotal}
                </span>
                <div className={`hide-on-export flex items-center rounded-lg p-0.5 border transition-colors duration-200 shrink-0 ${slideTheme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-800 border-slate-700'}`}>
                  <button
                    onClick={() => goToSlideIndex(detailedSlideIndex - 1)}
                    disabled={detailedSlideIndex === 0}
                    className={`p-1 rounded disabled:opacity-30 transition cursor-pointer ${slideTheme === 'light' ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}
                    title={slideLang === 'ta' ? 'முந்தைய பணிப் பதிவு (இடது அம்பு)' : 'PREVIOUS WORK (LEFT ARROW)'}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => goToSlideIndex(detailedSlideIndex + 1)}
                    disabled={detailedSlideIndex >= slideRecordTotal - 1}
                    className={`p-1 rounded disabled:opacity-30 transition cursor-pointer ${slideTheme === 'light' ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' : 'hover:bg-slate-700 text-slate-300 hover:text-white'}`}
                    title={slideLang === 'ta' ? 'அடுத்த பணிப் பதிவு (வலது அம்பு)' : 'NEXT WORK (RIGHT ARROW)'}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <span className="hidden sm:inline text-xs font-mono font-bold px-2 py-0.5 rounded border shrink-0 portal-dash-id" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 28%, transparent)', background: 'color-mix(in srgb, var(--theme-accent) 10%, transparent)' }}>
                  {currentSlideWork.workId || currentSlideWork.id}
                </span>

                {/* Name and Designation */}
                <div className="flex flex-col min-w-0 text-left ml-1">
                  <span className={`text-xs font-extrabold leading-tight ${slideTheme === 'light' ? 'text-slate-800' : 'text-slate-200'}`}>
                    {slideLang === 'ta'
                      ? (currentSlideWork.submittedByNameTa || currentSlideWork.submittedByName || slideInspector?.nameTa || slideInspector?.nameEn || 'கள ஆய்வாளர்')
                      : String(currentSlideWork.submittedByNameEn || currentSlideWork.submittedByName || currentSlideWork.submittedByUserName || slideInspector?.nameEn || 'FIELD INSPECTOR').toUpperCase()
                    }
                  </span>
                  <span className={`text-[10px] font-bold ${slideTheme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>
                    {getInspectorDesignationLocalized(currentSlideWork, slideLang)}
                  </span>
                </div>

                {/* Profile picture */}
                {slideInspectorPhoto && (
                  <img 
                    src={toStableMediaSrc(slideInspectorPhoto) || slideInspectorPhoto} 
                    alt="Inspector profile" 
                    crossOrigin="anonymous"
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-full object-cover border border-indigo-500 shadow-xs shrink-0 ml-1" 
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </div>

              {/* CENTER ALIGNED: Hierarchy details & SUBJECT & CATEGORIES */}
              <div className="flex-1 flex flex-col items-center justify-center text-center px-2 min-w-[200px] py-1">
                <div className="flex items-center gap-1.5 md:gap-2 flex-wrap justify-center">
                  <span className="text-xs md:text-sm lg:text-base font-black tracking-wide uppercase portal-dash-label">
                    {slideLang === 'ta'
                      ? (currentSlideWork.subjectNameTa || currentSlideWork.subjectNameEn || 'ஆய்வுப் பிரிவு')
                      : String(currentSlideWork.subjectNameEn || currentSlideWork.subjectNameTa || 'SUBJECT').toUpperCase()
                    }
                  </span>
                  <span className="text-slate-500 font-bold">•</span>
                  <span className={`text-xs md:text-sm lg:text-base font-black tracking-wide uppercase ${slideTheme === 'light' ? 'text-emerald-700' : 'text-emerald-300'}`}>
                    {slideLang === 'ta'
                      ? (currentSlideWork.categoryNameTa || currentSlideWork.categoryNameEn || 'ஆய்வு வகை')
                      : String(currentSlideWork.categoryNameEn || currentSlideWork.categoryNameTa || 'CATEGORY').toUpperCase()
                    }
                  </span>
                </div>
                <div className={`text-xs md:text-sm font-extrabold flex items-center gap-1.5 justify-center flex-wrap mt-0.5 leading-normal transition-colors duration-200 ${slideTheme === 'light' ? 'text-slate-700 font-black' : 'text-slate-100 font-black'}`}>
                  <span>
                    {slideLang === 'ta'
                      ? (currentSlideWork.tpNameTa || currentSlideWork.tpNameEn || 'பேரூராட்சி')
                      : String(currentSlideWork.tpNameEn || currentSlideWork.tpNameTa || 'TOWN PANCHAYAT').toUpperCase()
                    }
                  </span>
                  <span className="text-slate-400 font-bold">•</span>
                  <span className="text-indigo-600 dark:text-indigo-300 font-black">
                    {slideLang === 'ta'
                      ? `வார்டு ${currentSlideWork.wardNumber || currentSlideWork.wardNo || '-'}`
                      : `WARD ${currentSlideWork.wardNumber || currentSlideWork.wardNo || '-'}`
                    }
                  </span>
                  <span className="text-slate-400 font-bold">•</span>
                  <span>
                    {slideLang === 'ta'
                      ? streetLabel(currentSlideWork, 'ta')
                      : streetLabel(currentSlideWork, 'en').toUpperCase()
                    }
                  </span>
                  <span className="text-slate-400 font-bold">•</span>
                  <span className="font-mono text-[11px] md:text-xs font-bold">
                    {slideLang === 'ta'
                      ? formatIndianTime(currentSlideWork.submittedAt).replace('AM', 'மு.ப').replace('PM', 'பி.ப')
                      : formatIndianTime(currentSlideWork.submittedAt).toUpperCase()
                    }
                  </span>
                  
                  {/* GPS Next to time with Map icon */}
                  {currentSlideWork.latitude && currentSlideWork.longitude && (
                    <>
                      <span className="text-slate-400 font-bold">•</span>
                      <button
                        onClick={() => setSlideGpsModalOpen(true)}
                        className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs font-black hover:underline cursor-pointer border-none bg-transparent p-0"
                        title={slideLang === 'ta' ? 'வரைபடத்தில் பார்க்க சொடுக்கவும்' : 'CLICK TO VIEW WORK ENTRY LOCATION ON MAP'}
                      >
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span>GPS: {Number(currentSlideWork.latitude).toFixed(5)}, {Number(currentSlideWork.longitude).toFixed(5)}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Right: LANGUAGE SWITCH, DOWNLOAD BUTTONS, Location Button, Theme Switch & Actions */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {/* 1. Language Switcher Button in Slideshow */}
                <button
                  onClick={() => setSlideLang(prev => prev === 'ta' ? 'en' : 'ta')}
                  className="hide-on-export portal-fis-chip portal-fis-chip-tp-excel shrink-0"
                  title={slideLang === 'ta' ? 'ஆங்கிலத்திற்கு மாறுக (Switch to English)' : 'தமிழ் மொழிக்கு மாறுக (Switch to Tamil)'}
                >
                  <Globe className="w-3.5 h-3.5 text-indigo-600 dark:text-amber-400" />
                  <span className="text-[11px] font-black uppercase">
                    {slideLang === 'ta' ? 'தமிழ்' : 'ENGLISH'}
                  </span>
                </button>

                <div className={`hide-on-export portal-slide-exports ${slideTheme === 'light' ? 'is-light' : 'is-dark'}`}>
                  <div className="portal-slide-exports-col">
                    <span className="portal-slide-exports-kicker">
                      {slideLang === 'ta' ? 'இந்த ஸ்லைடு' : 'This slide'}
                    </span>
                    <div className="portal-slide-exports-btns">
                      <button
                        type="button"
                        onClick={() => handleDownloadSlidePhotoWithCaptions(currentSlideWork)}
                        disabled={isSlideDownloading}
                        title={slideLang === 'ta' ? 'படத்தை மட்டும் தலைப்புடன் பதிவிறக்குக' : 'Download photo with captions'}
                      >
                        {isSlideDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                        <span>{slideLang === 'ta' ? 'படம்' : 'Photo'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadFullSlideAsImage}
                        disabled={isSlideDownloading}
                        title={slideLang === 'ta' ? 'முழு ஸ்லைடை படமாக பதிவிறக்குக' : 'Download this slide as image'}
                      >
                        {isSlideDownloading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{slideLang === 'ta' ? 'ஸ்லைடு' : 'Image'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadFullSlideAsPdf}
                        disabled={isSlideDownloading}
                        className="is-pdf"
                        title={slideLang === 'ta' ? 'இந்த ஸ்லைடை PDF ஆக பதிவிறக்குக' : 'Download this slide as PDF'}
                      >
                        {isSlideDownloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                        <span>PDF</span>
                      </button>
                    </div>
                  </div>
                  <span className="portal-slide-exports-rule" aria-hidden="true" />
                  <div className="portal-slide-exports-col">
                    <span className="portal-slide-exports-kicker">
                      {slideLang === 'ta'
                        ? `அனைத்து ${slideRecordTotal} ஸ்லைடுகள்`
                        : `All ${slideRecordTotal} slides`}
                    </span>
                    <div className="portal-slide-exports-btns">
                      <button
                        type="button"
                        onClick={() => handleDownloadAllSlidesDeck('pdf')}
                        disabled={isSlideDownloading || slideRecordTotal < 1}
                        className="is-pdf"
                        title={slideLang === 'ta' ? 'பார்க்கும் அனைத்து ஸ்லைடுகளையும் PDF ஆக பதிவிறக்குக' : 'Download all browsed slides as PDF'}
                      >
                        {slideDeckExport?.format === 'pdf' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileText className="w-3.5 h-3.5" />
                        )}
                        <span>PDF</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadAllSlidesDeck('ppt')}
                        disabled={isSlideDownloading || slideRecordTotal < 1}
                        className="is-ppt"
                        title={slideLang === 'ta' ? 'பார்க்கும் அனைத்து ஸ்லைடுகளையும் PPT ஆக பதிவிறக்குக' : 'Download all browsed slides as PPT'}
                      >
                        {slideDeckExport?.format === 'ppt' ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Presentation className="w-3.5 h-3.5" />
                        )}
                        <span>PPT</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile rotate to landscape button */}
                <button
                  onClick={async () => {
                    try {
                      if (!document.fullscreenElement) {
                        await document.documentElement.requestFullscreen?.().catch(() => {});
                      }
                      if (typeof window !== 'undefined' && 'screen' in window && window.screen.orientation) {
                        await (window.screen.orientation as any).lock?.('landscape').catch(() => {});
                      }
                    } catch (_) {}
                  }}
                  className={`hide-on-export p-1.5 rounded-xl border transition cursor-pointer md:hidden ${slideTheme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                  title={slideLang === 'ta' ? 'கிடைமட்ட காட்சி' : 'LANDSCAPE'}
                >
                  <RotateCw className="w-4 h-4 text-emerald-500" />
                </button>

                {/* Theme Switcher */}
                <button
                  onClick={() => setSlideTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                  className={`hide-on-export p-1.5 rounded-xl border transition cursor-pointer ${slideTheme === 'light' ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                  title={slideTheme === 'dark' ? (slideLang === 'ta' ? 'வெளிச்ச முறைக்கு மாறுக' : 'SWITCH TO LIGHT MODE') : (slideLang === 'ta' ? 'இருண்ட முறைக்கு மாறுக' : 'SWITCH TO DARK MODE')}
                >
                  {slideTheme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
                </button>

                {/* Top Small Location Button */}
                {currentSlideWork.latitude && currentSlideWork.longitude && (
                  <button
                    onClick={() => setSlideGpsModalOpen(true)}
                    className="hide-on-export inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer border border-emerald-500/50"
                    title={slideLang === 'ta' ? 'வரைபடத்தில் பார்க்க சொடுக்கவும்' : 'CLICK TO VIEW WORK ENTRY LOCATION ON MAP'}
                  >
                    <MapPin className="w-3.5 h-3.5 text-emerald-200" />
                    <span className="text-[11px] font-bold">
                      {slideLang === 'ta' ? 'இடம்' : 'LOCATION'}
                    </span>
                  </button>
                )}

                {/* Fullscreen Toggle */}
                <button
                  onClick={() => {
                    if (!document.fullscreenElement) {
                      document.documentElement.requestFullscreen?.().catch(() => {});
                    } else {
                      document.exitFullscreen?.().catch(() => {});
                    }
                  }}
                  className={`hide-on-export p-1.5 rounded-xl transition cursor-pointer ${slideTheme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                  title={slideLang === 'ta' ? 'முழுத்திரை நிலை' : 'TOGGLE FULLSCREEN'}
                >
                  <Maximize2 className="w-4 h-4" />
                </button>

                {/* Close Button */}
                <button
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen?.().catch(() => {});
                    }
                    setIsDetailedSlideOpen(false);
                  }}
                  className="hide-on-export p-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 text-rose-300 hover:text-white transition cursor-pointer border border-rose-800"
                  title={slideLang === 'ta' ? 'மூடுக (Esc)' : 'CLOSE (ESC)'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Mobile swipe helper bar on mobile viewport */}
            <div className="md:hidden flex items-center justify-between px-3 py-1 bg-indigo-950/80 text-[10px] text-indigo-200 border-b border-indigo-900/50 select-none">
              <span>{slideLang === 'ta' ? '👈 👉 இடது/வலது ஸ்வைப் செய்து அடுத்த காட்சியைக் காண்க' : '👈 👉 SWIPE LEFT / RIGHT TO CHANGE SLIDES'}</span>
              <span className="font-bold">{detailedSlideIndex + 1}/{slideRecordTotal}</span>
            </div>

            {/* Main Content Area: Left 60% Photos / Right 40% Columns & Fields (Responsive Landscape side-by-side) */}
            <div className="flex-1 flex flex-col landscape:flex-row md:flex-row w-full min-h-0 overflow-hidden">
              {/* LEFT 60%: Allotted for photo space */}
              <div className={`w-full landscape:w-[60%] md:w-[60%] h-1/2 landscape:h-full md:h-full p-2.5 md:p-4 flex flex-col border-r transition-colors duration-200 overflow-hidden relative ${slideTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800/80'}`}>
                {(() => {
                  const photos = getWorkPhotos(currentSlideWork, slideLang);

                  if (photos.length === 0) {
                    return (
                      <div className={`flex-1 flex flex-col items-center justify-center border border-dashed rounded-2xl p-8 ${slideTheme === 'light' ? 'border-slate-300 text-slate-400 bg-white' : 'border-slate-800 text-slate-500'}`}>
                        <ImageIcon className="w-16 h-16 mb-3 stroke-[1.5] text-slate-500" />
                        <p className="text-sm font-semibold">
                          {slideLang === 'ta' ? 'புகைப்பட ஆதாரம் எதுவும் இல்லை' : 'NO PHOTO UPLOADED FOR THIS WORK ENTRY'}
                        </p>
                        <span className="text-xs text-slate-500 mt-1 font-mono">
                          {slideLang === 'ta' ? `பணி எண்: ${currentSlideWork.workId || currentSlideWork.id}` : `WORK ID: ${currentSlideWork.workId || currentSlideWork.id}`}
                        </span>
                      </div>
                    );
                  }

                  // Single photo: Full space for that single photo with field column name
                  if (photos.length === 1) {
                    const p = photos[0];
                    const displayLabel = slideLang === 'en' ? String(p.label).toUpperCase() : p.label;
                    return (
                      <div className={`flex-1 flex flex-col h-full w-full justify-between items-center relative rounded-2xl overflow-hidden shadow-2xl transition-colors duration-200 min-h-0 ${slideTheme === 'light' ? 'bg-white border border-slate-200' : 'bg-black border border-slate-800'}`}>
                        {/* Top field column name badge & download */}
                        <div className={`w-full px-4 py-2 flex items-center justify-between border-b z-10 shrink-0 ${slideTheme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'}`}>
                          <span className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${slideTheme === 'light' ? 'text-indigo-700' : 'text-amber-300'}`}>
                            <ImageIcon className="w-3.5 h-3.5 text-amber-500" />
                            <span>{displayLabel}</span>
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDownloadSlidePhotoWithCaptions(currentSlideWork, p)}
                              className="hide-on-export text-[11px] flex items-center gap-1 font-bold px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer"
                              title={slideLang === 'ta' ? 'தலைப்புடன் படத்தை பதிவிறக்கு' : 'DOWNLOAD CAPTIONED IMAGE'}
                            >
                              <Download className="w-3 h-3" />
                              <span>{slideLang === 'ta' ? 'பதிவிறக்கு' : 'DOWNLOAD'}</span>
                            </button>
                            <button
                              onClick={() => setPhotoPreviewModal({ url: p.url, label: displayLabel, work: currentSlideWork })}
                              className={`hide-on-export text-[11px] flex items-center gap-1 font-bold hover:underline cursor-pointer ${slideTheme === 'light' ? 'text-indigo-600 hover:text-indigo-800' : 'text-slate-300 hover:text-white'}`}
                            >
                              <ZoomIn className="w-3 h-3" />
                              <span>{slideLang === 'ta' ? 'பெரிதாக்குக' : 'ZOOM'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Full Photo with eager instant rendering */}
                        <div className="flex-1 w-full flex items-center justify-center p-2 overflow-hidden relative min-h-0">
                          <SlidePhotoDisplay
                            url={p.url}
                            label={displayLabel}
                            className="max-h-full max-w-full object-contain rounded-lg group-hover:scale-[1.01] transition duration-200"
                            onZoom={() => setPhotoPreviewModal({ url: p.url, label: displayLabel, work: currentSlideWork })}
                          />
                        </div>

                        {/* Golden Amber Stamp */}
                        <div className="w-full bg-[#FBBF24] py-1.5 px-3 text-center text-[#7F1D1D] select-text leading-tight flex flex-col gap-0.5 shrink-0 z-10">
                          <div className="font-black text-[11px] md:text-xs">
                            {slideLang === 'ta'
                              ? `${currentSlideWork.tpNameTa || currentSlideWork.tpNameEn || 'பேரூராட்சி'}, ${currentSlideWork.zoneNameTa || currentSlideWork.zoneNameEn || 'மண்டலம்'}, ${currentSlideWork.districtNameTa || currentSlideWork.districtNameEn || 'மாவட்டம்'}`
                              : `${(currentSlideWork.tpNameEn || 'TOWN PANCHAYAT').toUpperCase()}, ${(currentSlideWork.zoneNameEn || 'ZONE').toUpperCase()}, ${(currentSlideWork.districtNameEn || 'DISTRICT').toUpperCase()}`
                            }
                          </div>
                          <div className="font-bold text-[10px] md:text-[11px]">
                            {slideLang === 'ta'
                              ? `வார்டு எண்: ${currentSlideWork.wardNumber || '1'}, ${streetLabel(currentSlideWork, 'ta')} • ${currentSlideWork.subjectNameTa || currentSlideWork.subjectNameEn || ''} • ${displayLabel}`
                              : `WARD NO: ${currentSlideWork.wardNumber || '1'}, ${streetLabel(currentSlideWork, 'en').toUpperCase()} • ${(currentSlideWork.subjectNameEn || '').toUpperCase()} • ${displayLabel}`
                            }
                          </div>
                          <div className="font-bold text-[9px] md:text-[10px]">
                            {slideLang === 'ta'
                              ? `${formatIndianTime(currentSlideWork.submittedAt).replace('AM', 'மு.ப').replace('PM', 'பி.ப')} • GPS: ${currentSlideWork.latitude || '-'}, ${currentSlideWork.longitude || '-'}`
                              : `${formatIndianTime(currentSlideWork.submittedAt).toUpperCase()} • GPS: ${currentSlideWork.latitude || '-'}, ${currentSlideWork.longitude || '-'}`
                            }
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Multiple photos
                  const gridColsClass = photos.length === 2 ? 'grid-cols-2' : photos.length === 3 ? 'grid-cols-2 md:grid-cols-3' : 'grid-cols-2';
                  return (
                    <div className="flex-1 flex flex-col h-full w-full overflow-hidden min-h-0">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400 shrink-0">
                        <span className={`font-bold flex items-center gap-1.5 ${slideTheme === 'light' ? 'text-slate-800' : 'text-slate-300'}`}>
                          <ImageIcon className="w-4 h-4 text-amber-500" />
                          <span>
                            {slideLang === 'ta'
                              ? `${photos.length} கள ஆய்வு புகைப்படங்கள்`
                              : `${photos.length} CAPTURED INSPECTION PHOTOS`
                            }
                          </span>
                        </span>
                        <span className="text-[11px] text-slate-500 italic">
                          {slideLang === 'ta' ? 'பெரிதாக்க அல்லது பதிவிறக்க புகைப்படத்தை சொடுக்கவும்' : 'CLICK PHOTO TO ZOOM OR DOWNLOAD'}
                        </span>
                      </div>
                      <div className={`flex-1 grid ${gridColsClass} gap-2.5 md:gap-3 overflow-y-auto pr-1 min-h-0`}>
                        {photos.map((p, idx) => {
                          const displayLabel = slideLang === 'en' ? String(p.label).toUpperCase() : p.label;
                          return (
                            <div
                              key={`multi_photo_${currentSlideWork.workId || currentSlideWork.id}_${idx}_${p.url}`}
                              className={`flex flex-col rounded-xl overflow-hidden hover:border-indigo-500 transition group cursor-pointer shadow-lg relative min-h-[140px] ${slideTheme === 'light' ? 'bg-white border border-slate-200' : 'bg-black border border-slate-800'}`}
                            >
                              {/* Field column name banner */}
                              <div className={`px-2.5 py-1 text-[11px] font-bold truncate flex items-center justify-between border-b ${slideTheme === 'light' ? 'bg-slate-100 border-slate-200 text-indigo-700' : 'bg-slate-900/90 border-slate-800 text-amber-300'}`}>
                                <span className="truncate">{displayLabel}</span>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDownloadSlidePhotoWithCaptions(currentSlideWork, p);
                                    }}
                                    className="hide-on-export p-0.5 rounded hover:bg-amber-500/20 text-amber-500 transition"
                                    title={slideLang === 'ta' ? 'தலைப்புடன் பதிவிறக்கு' : 'DOWNLOAD WITH CAPTIONS'}
                                  >
                                    <Download className="w-3 h-3" />
                                  </button>
                                  <span className={`text-[9px] px-1 rounded font-mono ${slideTheme === 'light' ? 'bg-slate-200 text-slate-600' : 'bg-slate-800 text-slate-400'}`}>#{idx + 1}</span>
                                </div>
                              </div>

                              {/* Image container */}
                              <div className="flex-1 flex items-center justify-center p-1 bg-slate-950 overflow-hidden relative min-h-0">
                                <SlidePhotoDisplay
                                  url={p.url}
                                  label={displayLabel}
                                  className="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-200"
                                  onZoom={() => setPhotoPreviewModal({ url: p.url, label: displayLabel, work: currentSlideWork })}
                                />
                              </div>

                              {/* Mini Golden Amber Stamp */}
                              <div className="bg-[#FBBF24] py-1 px-2 text-center text-[#7F1D1D] select-text text-[9px] font-bold leading-tight truncate">
                                {slideLang === 'ta'
                                  ? `வார்டு ${currentSlideWork.wardNumber || '-'} • ${displayLabel} • ${formatIndianTime(currentSlideWork.submittedAt).replace('AM', 'மு.ப').replace('PM', 'பி.ப')}`
                                  : `WARD ${currentSlideWork.wardNumber || '-'} • ${displayLabel} • ${formatIndianTime(currentSlideWork.submittedAt).toUpperCase()}`
                                }
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* RIGHT 40%: Table Format Layout (CATEGORIES FIELDS DATA TABLE ONLY) */}
              <div className={`w-full landscape:w-[40%] md:w-[40%] h-1/2 landscape:h-full md:h-full overflow-y-auto p-3 md:p-5 flex flex-col justify-between space-y-3 select-text transition-colors duration-200 min-h-0 ${slideTheme === 'light' ? 'bg-white border-l border-slate-200 text-slate-800' : 'bg-slate-900/95 border-l border-slate-800 text-white'}`}>
                
                {/* CATEGORIES FIELDS DATA TABLE */}
                <div className={`rounded-2xl p-3 md:p-4 border transition-colors duration-200 flex-1 flex flex-col space-y-2.5 overflow-hidden min-h-0 ${slideTheme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'}`}>
                  <h4 className={`text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 ${slideTheme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>{slideLang === 'ta' ? 'விவரங்கள் அட்டவணை' : 'DETAILS TABLE'}</span>
                  </h4>

                  {(() => {
                    const textFields = getWorkTextData(currentSlideWork, slideLang);
                    if (textFields.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic py-6 text-center">
                          {slideLang === 'ta' ? 'புலங்களின் தகவல்கள் எதுவும் பதிவு செய்யப்படவில்லை' : 'NO CUSTOM FIELD INPUTS RECORDED FOR THIS ENTRY.'}
                        </p>
                      );
                    }
                    return (
                      <div className="flex-1 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs min-h-0">
                        <table className="w-full text-left border-collapse text-xs table-fixed">
                          <thead className={`sticky top-0 z-10 text-[11px] font-black uppercase tracking-wider border-b ${
                            slideTheme === 'light' 
                              ? 'bg-slate-200 text-slate-800 border-slate-300' 
                              : 'bg-slate-900 text-amber-300 border-slate-800'
                          }`}>
                            <tr>
                              <th className="py-2.5 px-3 w-[65%] text-left font-black border-r border-slate-300 dark:border-slate-800">
                                {slideLang === 'ta' ? 'தலைப்புகள்' : 'HEADINGS'}
                              </th>
                              <th className="py-2.5 px-3 w-[35%] text-left font-black">
                                {slideLang === 'ta' ? 'விவரங்கள்' : 'DETAILS'}
                              </th>
                            </tr>
                          </thead>
                          <tbody className={`divide-y ${slideTheme === 'light' ? 'divide-slate-200 bg-white' : 'divide-slate-800/80 bg-slate-950/60'}`}>
                            {textFields.map((f, idx) => (
                              <tr key={idx} className={`transition-colors ${slideTheme === 'light' ? 'hover:bg-indigo-50/40' : 'hover:bg-slate-900/50'}`}>
                                <td className={`py-2 px-3 w-[65%] text-left font-bold border-r border-slate-200 dark:border-slate-800/80 align-top break-words ${
                                  slideTheme === 'light' ? 'text-indigo-900' : 'text-indigo-300'
                                }`}>
                                  <span>{slideLang === 'en' ? String(f.label).toUpperCase() : f.label}</span>
                                  <span className="ml-1 font-black text-slate-400">:</span>
                                </td>
                                <td className={`py-2 px-3 w-[35%] text-left font-extrabold align-top break-words ${
                                  slideTheme === 'light' ? 'text-slate-800' : 'text-slate-100'
                                }`}>
                                  {slideLang === 'en' ? String(f.value).toUpperCase() : f.value}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>

                {/* Bottom Navigation Buttons */}
                <div className={`hide-on-export pt-2.5 flex items-center justify-between gap-3 border-t shrink-0 ${slideTheme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                  <button
                    onClick={() => goToSlideIndex(detailedSlideIndex - 1)}
                    disabled={detailedSlideIndex === 0}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold disabled:opacity-30 transition flex items-center justify-center gap-1 cursor-pointer ${slideTheme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{slideLang === 'ta' ? 'முந்தையது' : 'PREVIOUS'}</span>
                  </button>

                  <button
                    onClick={() => goToSlideIndex(detailedSlideIndex + 1)}
                    disabled={detailedSlideIndex >= slideRecordTotal - 1}
                    className="flex-1 py-2 px-3 rounded-xl portal-dash-action text-xs font-bold disabled:opacity-30 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>{slideLang === 'ta' ? 'அடுத்தது' : 'NEXT'}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MAXIMUM LEVEL ZOOM GOOGLE MAP LITE POPUP FOR SLIDEVIEW                     */}
      {/* ========================================================================= */}
      {slideGpsModalOpen && currentSlideWork && currentSlideWork.latitude && currentSlideWork.longitude && (
        <div className="portal-modal-overlay is-raised">
          <div className="portal-modal max-w-3xl w-full">
            <div className="portal-modal-head">
              <div className="flex items-center gap-2">
                <span className="portal-dash-icon"><MapPin className="h-3.5 w-3.5" /></span>
                <div>
                  <h4>
                    Work Location at Maximum Level Zoom ({currentSlideWork.workId || currentSlideWork.id})
                  </h4>
                  <p>
                    {currentSlideWork.tpNameEn || 'Town Panchayat'} • Ward {currentSlideWork.wardNumber} • {streetLabel(currentSlideWork)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSlideGpsModalOpen(false)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="portal-modal-body space-y-3">
            {/* Google Map Lite Iframe Embed at Zoom 19 (Max Zoom) */}
            <div className="w-full h-96 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative">
              <iframe
                title="Google Map Lite Max Zoom"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${currentSlideWork.latitude},${currentSlideWork.longitude}&z=19&t=m&output=embed`}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-mono font-bold portal-dash-id">
                Coordinates: {Number(currentSlideWork.latitude).toFixed(6)}, {Number(currentSlideWork.longitude).toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${currentSlideWork.latitude},${currentSlideWork.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-dash-action inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* GPS POPUP MODAL FROM DETAILED REGISTER TABLE                               */}
      {/* ========================================================================= */}
      {gpsModalWork && gpsModalWork.latitude && gpsModalWork.longitude && (
        <div className="portal-modal-overlay is-raised">
          <div className="portal-modal max-w-3xl w-full">
            <div className="portal-dash-modal-head flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="portal-dash-icon"><MapPin className="h-3.5 w-3.5" /></span>
                <div>
                  <h3>
                    Inspection Location Map ({gpsModalWork.workId || gpsModalWork.id})
                  </h3>
                  <p>
                    {gpsModalWork.tpNameEn || 'Town Panchayat'} • Ward {gpsModalWork.wardNumber} • {gpsModalWork.streetName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGpsModalWork(null)}
                className="portal-modal-close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="portal-modal-body space-y-3">

            {/* Google Map Lite Iframe Embed */}
            <div className="w-full h-96 rounded-lg overflow-hidden border border-slate-200 bg-slate-50 relative">
              <iframe
                title="Google Map Lite"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://maps.google.com/maps?q=${gpsModalWork.latitude},${gpsModalWork.longitude}&z=19&t=m&output=embed`}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <span className="font-mono font-bold portal-dash-id">
                GPS: {Number(gpsModalWork.latitude).toFixed(6)}, {Number(gpsModalWork.longitude).toFixed(6)}
              </span>
              <a
                href={`https://www.google.com/maps?q=${gpsModalWork.latitude},${gpsModalWork.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="portal-dash-action rounded-lg px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Open in Google Maps</span>
              </a>
            </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* HIGH-RESOLUTION PHOTO PREVIEW POPUP MODAL                                  */}
      {/* ========================================================================= */}
      {photoPreviewModal && (
        <div className="portal-modal-overlay is-media">
          <div className="portal-modal max-w-5xl w-full">
            <div className="portal-modal-head">
              <div>
                <h3>{photoPreviewModal.label}</h3>
                <p>Photo preview</p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoPreviewModal(null)}
                className="portal-modal-close"
                title="Close Preview (Esc)"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="portal-modal-body flex flex-col items-center">

            {/* Image Box */}
            <div className="relative rounded-lg overflow-hidden bg-slate-50 border border-slate-200 max-h-[70vh] w-full flex items-center justify-center">
              <img
                src={toStableMediaSrc(photoPreviewModal.url) || photoPreviewModal.url}
                alt={photoPreviewModal.label}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  if (!e.currentTarget.dataset.retried && photoPreviewModal.url) {
                    e.currentTarget.dataset.retried = 'true';
                    e.currentTarget.src = toStableMediaSrc(photoPreviewModal.url);
                  }
                }}
                className="max-h-[80vh] max-w-full object-contain"
              />
            </div>

            {/* Label and Caption */}
            <div className="mt-3 flex items-center justify-between w-full px-3 py-2 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <span className="font-bold text-slate-700 uppercase tracking-wide">
                {photoPreviewModal.label}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (photoPreviewModal.work) {
                      void handleDownloadSlidePhotoWithCaptions(photoPreviewModal.work, {
                        url: photoPreviewModal.url,
                        label: photoPreviewModal.label,
                      });
                    }
                  }}
                  className="portal-dash-label hover:underline flex items-center gap-1 font-semibold cursor-pointer bg-transparent border-none p-0"
                >
                  <Download className="w-3 h-3" />
                  <span>Download photo</span>
                </button>
                <a
                  href={toStableMediaSrc(photoPreviewModal.url) || photoPreviewModal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="portal-dash-label hover:underline flex items-center gap-1 font-semibold"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Open Full Image</span>
                </a>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
