'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Briefcase,
  Users,
  Hourglass,
  CheckCheck,
  MapPin,
  Building2,
  ClipboardList,
  FileSpreadsheet,
  X,
  ChevronRight,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Language } from './translations';
import { findRepeatTownPanchayatWithinThreeYears } from '@/lib/transferCounselingService';

type ApplicantRow = {
  counselingEmployeeId: string;
  employeeName: string;
  counselingStatus: string;
  currentDistrict?: string;
  currentTownPanchayat?: string;
  seniorityNo?: string;
};

type VacancyRow = {
  vacancyId: string;
  district: string;
  townPanchayat: string;
  designation: string;
  totalSlots: number;
  availableSlots: number;
  status: string;
};

interface Props {
  lang: Language;
  currentUser: any;
}

function statusStyles(status: string) {
  const s = (status || '').toUpperCase();
  if (!s) return 'bg-slate-50 text-slate-500 ring-slate-200/80';
  if (s === 'ALLOCATED') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (s === 'IN_COUNSELING') return 'bg-violet-50 text-violet-700 ring-violet-600/20';
  if (s === 'AVAILABLE') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (s === 'FILLED') return 'bg-slate-100 text-slate-600 ring-slate-300/80';
  if (s === 'PENDING') return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  return 'bg-slate-50 text-slate-700 ring-slate-200/80';
}

type PanelTone = 'blue' | 'indigo' | 'violet' | 'cyan' | 'emerald' | 'slate' | 'vacancy' | 'allocations';

const panelToneStyles: Record<
  PanelTone,
  { header: string; icon: string; title: string; subtitle: string; shell: string; body: string }
> = {
  blue: {
    header: 'bg-gradient-to-r from-[#0066FF] to-[#0052cc]',
    icon: 'bg-white/20 text-white ring-1 ring-white/25',
    title: 'text-white',
    subtitle: 'text-white/75',
    shell: 'border-[#0066FF]/25 shadow-[0_4px_14px_rgba(0,102,255,0.12)]',
    body: 'bg-gradient-to-b from-blue-50/35 to-white',
  },
  indigo: {
    header: 'bg-gradient-to-r from-indigo-600 to-blue-600',
    icon: 'bg-white/20 text-white ring-1 ring-white/25',
    title: 'text-white',
    subtitle: 'text-white/75',
    shell: 'border-indigo-200/80 shadow-[0_4px_14px_rgba(79,70,229,0.12)]',
    body: 'bg-gradient-to-b from-indigo-50/30 to-white',
  },
  violet: {
    header: 'bg-gradient-to-r from-violet-600 to-indigo-500',
    icon: 'bg-white/20 text-white ring-1 ring-white/25',
    title: 'text-white',
    subtitle: 'text-white/75',
    shell: 'border-violet-200/80 shadow-[0_4px_14px_rgba(124,58,237,0.1)]',
    body: 'bg-gradient-to-b from-violet-50/25 to-white',
  },
  cyan: {
    header: 'bg-gradient-to-r from-cyan-600 to-sky-600',
    icon: 'bg-white/20 text-white ring-1 ring-white/25',
    title: 'text-white',
    subtitle: 'text-white/75',
    shell: 'border-cyan-200/80 shadow-[0_4px_14px_rgba(8,145,178,0.1)]',
    body: 'bg-gradient-to-b from-cyan-50/30 to-white',
  },
  emerald: {
    header: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700',
    icon: 'bg-white/20 text-white ring-1 ring-white/30 shadow-sm',
    title: 'text-white',
    subtitle: 'text-emerald-50/90',
    shell: 'border-emerald-200/90 shadow-[0_4px_16px_rgba(5,150,105,0.14)]',
    body: 'bg-gradient-to-b from-emerald-50/50 via-teal-50/20 to-white',
  },
  slate: {
    header: 'bg-gradient-to-r from-slate-700 to-slate-600',
    icon: 'bg-white/15 text-white ring-1 ring-white/20',
    title: 'text-white',
    subtitle: 'text-white/75',
    shell: 'border-slate-200 shadow-[0_4px_14px_rgba(15,23,42,0.08)]',
    body: 'bg-white',
  },
  /** Neutral chrome so multicolor district blocks read clearly inside. */
  vacancy: {
    header: 'border-b border-slate-200/90 bg-gradient-to-r from-slate-100 via-slate-50 to-white',
    icon: 'bg-[#0066FF] text-white shadow-sm ring-1 ring-[#0066FF]/20',
    title: 'text-slate-900',
    subtitle: 'text-slate-600',
    shell: 'border-slate-200/90 shadow-[0_4px_14px_rgba(15,23,42,0.06)]',
    body: 'bg-slate-200/45',
  },
  allocations: {
    header: 'border-b border-emerald-900/30 bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900',
    icon: 'bg-white/15 text-white ring-1 ring-white/25 shadow-sm',
    title: 'text-white',
    subtitle: 'text-emerald-100/90',
    shell: 'border-emerald-200/80 shadow-[0_4px_16px_rgba(5,150,105,0.14)]',
    body: 'bg-gradient-to-b from-emerald-50/40 via-white to-white',
  },
};

function Panel({
  title,
  subtitle,
  icon: Icon,
  children,
  action,
  className = '',
  bodyClassName = 'px-6 py-5',
  bodyGrow = true,
  tone = 'blue',
  compact = false,
  allowBodyShadowBleed = false,
}: {
  title: string;
  subtitle?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  bodyGrow?: boolean;
  tone?: PanelTone;
  compact?: boolean;
  /** Lets focus rings / shadows show (overrides .portal-dashboard-panel overflow). */
  allowBodyShadowBleed?: boolean;
}) {
  const t = panelToneStyles[tone];
  return (
    <section
      className={`portal-dashboard-panel flex flex-col rounded-xl border bg-white ${allowBodyShadowBleed ? '!overflow-visible' : 'overflow-hidden'} ${t.shell} ${className}`}
    >
      <header
        className={`flex shrink-0 items-center justify-between gap-2 ${compact ? 'px-3 py-2' : 'px-4 py-3'} ${t.header}`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`flex shrink-0 items-center justify-center rounded-lg ${compact ? 'h-8 w-8' : 'h-9 w-9'} ${t.icon}`}
          >
            <Icon className={`${compact ? 'h-4 w-4' : 'h-[17px] w-[17px]'}`} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <h2 className={`${compact ? 'text-[13px]' : 'text-sm'} font-semibold tracking-tight ${t.title}`}>{title}</h2>
            {subtitle && (
              <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} mt-0.5 leading-snug ${t.subtitle}`}>{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 [&_button]:border-white/30 [&_button]:bg-white/15 [&_button]:text-white">{action}</div>}
      </header>
      <div className={`${t.body} ${bodyGrow ? 'min-h-0 flex-1' : 'shrink-0'} ${bodyClassName}`}>{children}</div>
    </section>
  );
}

type StatTheme = 'indigo' | 'amber' | 'emerald' | 'teal' | 'blue';

const statThemeStyles: Record<
  StatTheme,
  { card: string; label: string; value: string; icon: string; orb: string }
> = {
  indigo: {
    card: 'border-indigo-200/90 bg-gradient-to-br from-indigo-50 via-white to-violet-100/50 shadow-[0_4px_14px_rgba(79,70,229,0.12)]',
    label: 'text-indigo-700/85',
    value: 'text-indigo-950',
    icon: 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-md shadow-indigo-500/30',
    orb: 'bg-indigo-400/25',
  },
  amber: {
    card: 'border-amber-200/90 bg-gradient-to-br from-amber-50 via-white to-orange-100/45 shadow-[0_4px_14px_rgba(245,158,11,0.14)]',
    label: 'text-amber-800/80',
    value: 'text-amber-950',
    icon: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/35',
    orb: 'bg-amber-400/30',
  },
  emerald: {
    card: 'border-emerald-200/90 bg-gradient-to-br from-emerald-50 via-white to-teal-100/40 shadow-[0_4px_14px_rgba(16,185,129,0.13)]',
    label: 'text-emerald-800/80',
    value: 'text-emerald-950',
    icon: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30',
    orb: 'bg-emerald-400/25',
  },
  teal: {
    card: 'border-cyan-200/90 bg-gradient-to-br from-cyan-50 via-white to-sky-100/50 shadow-[0_4px_14px_rgba(6,182,212,0.14)]',
    label: 'text-cyan-800/80',
    value: 'text-cyan-950',
    icon: 'bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md shadow-cyan-500/30',
    orb: 'bg-cyan-400/28',
  },
  blue: {
    card: 'border-[#0066FF]/25 bg-gradient-to-br from-blue-50 via-white to-[#0066FF]/10 shadow-[0_4px_14px_rgba(0,102,255,0.15)]',
    label: 'text-[#0052cc]/85',
    value: 'text-[#003d99]',
    icon: 'bg-gradient-to-br from-[#0066FF] to-[#0052cc] text-white shadow-md shadow-blue-500/35',
    orb: 'bg-[#0066FF]/20',
  },
};

function StatCard({
  label,
  value,
  icon: Icon,
  theme,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  theme: StatTheme;
}) {
  const t = statThemeStyles[theme];
  return (
    <div className={`relative overflow-hidden rounded-xl border px-4 py-4 ${t.card}`}>
      <div
        className={`pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full blur-2xl ${t.orb}`}
        aria-hidden
      />
      <div className="relative flex items-center gap-3.5">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.icon}`}>
          <Icon className="h-[19px] w-[19px]" strokeWidth={2.25} />
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className={`truncate text-[10px] font-semibold uppercase tracking-wider ${t.label}`}>{label}</p>
          <p className={`mt-1 text-2xl font-bold leading-tight tabular-nums tracking-tight ${t.value}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

type FieldAccent = 'blue' | 'indigo' | 'violet' | 'amber' | 'emerald' | 'rose';

const fieldAccentStyles: Record<FieldAccent, string> = {
  blue: 'border-l-[#0066FF] bg-blue-50/70 ring-blue-100/80',
  indigo: 'border-l-indigo-500 bg-indigo-50/60 ring-indigo-100/80',
  violet: 'border-l-violet-500 bg-violet-50/50 ring-violet-100/80',
  amber: 'border-l-amber-500 bg-amber-50/60 ring-amber-100/80',
  emerald: 'border-l-emerald-500 bg-emerald-50/50 ring-emerald-100/80',
  rose: 'border-l-rose-500 bg-rose-50/40 ring-rose-100/80',
};

function Field({ label, value, accent = 'blue' }: { label: string; value: React.ReactNode; accent?: FieldAccent }) {
  return (
    <div className={`rounded-md border border-l-[3px] px-2 py-1.5 ring-1 ring-inset ${fieldAccentStyles[accent]}`}>
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-xs font-semibold leading-snug text-slate-900">{value || '—'}</p>
    </div>
  );
}

const AVATAR_PALETTE = [
  'bg-violet-600 text-white',
  'bg-orange-500 text-white',
  'bg-teal-600 text-white',
  'bg-rose-500 text-white',
  'bg-indigo-600 text-white',
  'bg-amber-600 text-white',
];

function avatarListClass(index: number, selected: boolean) {
  if (selected) return 'bg-[#0066FF] text-white ring-2 ring-blue-200';
  return `${AVATAR_PALETTE[index % AVATAR_PALETTE.length]} ring-1 ring-white/40`;
}

/** Solid district block palettes — rich header + tinted body + white TP tiles */
const VACANCY_DISTRICT_THEMES = [
  {
    shell: 'shadow-lg shadow-indigo-900/15',
    header: 'bg-indigo-700',
    headerTitle: 'text-white',
    headerMeta: 'text-indigo-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-indigo-200/90',
    card: 'border border-indigo-300/50 bg-white shadow-[0_2px_10px_rgba(49,46,129,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(49,46,129,0.18)] hover:ring-2 hover:ring-indigo-400/40',
    cardTitle: 'text-indigo-950',
    cardMuted: 'text-indigo-700/75',
    icon: 'bg-indigo-600 text-white shadow-sm',
    slot: 'bg-indigo-700 text-white',
    picked: 'border-2 border-[#0066FF] bg-indigo-50/90 shadow-md shadow-indigo-900/10',
  },
  {
    shell: 'shadow-lg shadow-teal-900/15',
    header: 'bg-teal-700',
    headerTitle: 'text-white',
    headerMeta: 'text-teal-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-teal-200/90',
    card: 'border border-teal-300/50 bg-white shadow-[0_2px_10px_rgba(15,118,110,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(15,118,110,0.18)] hover:ring-2 hover:ring-teal-500/40',
    cardTitle: 'text-teal-950',
    cardMuted: 'text-teal-800/70',
    icon: 'bg-teal-600 text-white shadow-sm',
    slot: 'bg-teal-700 text-white',
    picked: 'border-2 border-[#0066FF] bg-teal-50/90 shadow-md shadow-teal-900/10',
  },
  {
    shell: 'shadow-lg shadow-violet-900/15',
    header: 'bg-violet-700',
    headerTitle: 'text-white',
    headerMeta: 'text-violet-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-violet-200/90',
    card: 'border border-violet-300/50 bg-white shadow-[0_2px_10px_rgba(91,33,182,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(91,33,182,0.18)] hover:ring-2 hover:ring-violet-500/40',
    cardTitle: 'text-violet-950',
    cardMuted: 'text-violet-800/70',
    icon: 'bg-violet-600 text-white shadow-sm',
    slot: 'bg-violet-700 text-white',
    picked: 'border-2 border-[#0066FF] bg-violet-50/90 shadow-md shadow-violet-900/10',
  },
  {
    shell: 'shadow-lg shadow-blue-900/15',
    header: 'bg-[#0052cc]',
    headerTitle: 'text-white',
    headerMeta: 'text-blue-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-blue-200/90',
    card: 'border border-blue-300/50 bg-white shadow-[0_2px_10px_rgba(29,78,216,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(29,78,216,0.18)] hover:ring-2 hover:ring-blue-500/40',
    cardTitle: 'text-blue-950',
    cardMuted: 'text-blue-800/70',
    icon: 'bg-[#0066FF] text-white shadow-sm',
    slot: 'bg-[#0052cc] text-white',
    picked: 'border-2 border-[#0066FF] bg-blue-50/90 shadow-md shadow-blue-900/10',
  },
  {
    shell: 'shadow-lg shadow-rose-900/15',
    header: 'bg-rose-700',
    headerTitle: 'text-white',
    headerMeta: 'text-rose-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-rose-200/90',
    card: 'border border-rose-300/50 bg-white shadow-[0_2px_10px_rgba(190,18,60,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(190,18,60,0.18)] hover:ring-2 hover:ring-rose-500/40',
    cardTitle: 'text-rose-950',
    cardMuted: 'text-rose-800/70',
    icon: 'bg-rose-600 text-white shadow-sm',
    slot: 'bg-rose-700 text-white',
    picked: 'border-2 border-[#0066FF] bg-rose-50/90 shadow-md shadow-rose-900/10',
  },
  {
    shell: 'shadow-lg shadow-amber-900/15',
    header: 'bg-amber-700',
    headerTitle: 'text-white',
    headerMeta: 'text-amber-100/90',
    chip: 'bg-white/15 text-white ring-1 ring-white/25',
    body: 'bg-amber-200/90',
    card: 'border border-amber-300/50 bg-white shadow-[0_2px_10px_rgba(180,83,9,0.12)]',
    cardHover: 'hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(180,83,9,0.18)] hover:ring-2 hover:ring-amber-500/40',
    cardTitle: 'text-amber-950',
    cardMuted: 'text-amber-900/70',
    icon: 'bg-amber-600 text-white shadow-sm',
    slot: 'bg-amber-800 text-white',
    picked: 'border-2 border-[#0066FF] bg-amber-50/90 shadow-md shadow-amber-900/10',
  },
] as const;

function vacancyDistrictTheme(district: string, index: number) {
  let h = index;
  for (let i = 0; i < district.length; i++) h = (h * 31 + district.charCodeAt(i)) >>> 0;
  return VACANCY_DISTRICT_THEMES[h % VACANCY_DISTRICT_THEMES.length];
}

type VacancyTheme = (typeof VACANCY_DISTRICT_THEMES)[number];

function VacancyTpTile({
  vacancy,
  theme,
  picked,
  disabled,
  slotsLabel,
  allottedLabel,
  onSelect,
}: {
  vacancy: VacancyRow;
  theme: VacancyTheme;
  picked: boolean;
  disabled: boolean;
  slotsLabel: string;
  allottedLabel: string;
  onSelect: () => void;
}) {
  const hasOpenSlots = (vacancy.availableSlots ?? 0) > 0;
  const tileDisabled = disabled || !hasOpenSlots;

  return (
    <button
      type="button"
      disabled={tileDisabled}
      onClick={onSelect}
      aria-disabled={tileDisabled}
      className={`flex h-full min-h-[5.5rem] w-full flex-col gap-0 rounded-xl p-0 text-center transition ${
        hasOpenSlots
          ? `border-emerald-200/80 bg-gradient-to-b from-white to-emerald-50/50 shadow-[0_2px_10px_rgba(16,185,129,0.1)] ${theme.card} ${
              picked ? theme.picked : theme.cardHover
            }`
          : 'cursor-not-allowed border border-slate-300/70 bg-gradient-to-b from-slate-100 to-slate-200/80 opacity-95'
      } disabled:cursor-not-allowed`}
    >
      <div className="flex flex-col items-center px-3 pb-3 pt-4">
        <span
          className={`mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            hasOpenSlots ? theme.icon : 'bg-slate-400 text-white'
          }`}
        >
          <Building2 className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <p
          className={`w-full px-1 text-center text-[14px] font-bold leading-snug sm:text-[15px] ${
            hasOpenSlots ? theme.cardTitle : 'text-slate-600'
          }`}
        >
          {vacancy.townPanchayat}
        </p>
      </div>
      <div
        className={`mt-auto flex items-center justify-between gap-3 border-t px-4 py-2.5 ${
          hasOpenSlots ? 'border-emerald-200/60' : 'border-slate-300/60'
        }`}
      >
        <span
          className={`text-left text-[10px] font-medium uppercase tracking-wider ${
            hasOpenSlots ? theme.cardMuted : 'text-slate-500'
          }`}
        >
          {hasOpenSlots ? slotsLabel : allottedLabel}
        </span>
        <span
          className={`min-w-[2.25rem] shrink-0 rounded-md px-2.5 py-1 text-center text-sm font-bold tabular-nums leading-none ${
            hasOpenSlots ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-500 text-white'
          }`}
        >
          {vacancy.availableSlots}
        </span>
      </div>
    </button>
  );
}

const VACANCY_SUBBLOCKS_PER_ROW = 4;

/** Column count for TP tiles; narrower max when nested under a district in a 3-column grid. */
function vacancySubBlockGridClass(tpCount: number, nestedInDistrictRow = false): string {
  const cap = nestedInDistrictRow ? 2 : VACANCY_SUBBLOCKS_PER_ROW;
  const cols = Math.min(Math.max(tpCount, 1), cap);
  if (cols === 1) return 'grid-cols-1';
  if (cols === 2) return 'grid-cols-1 sm:grid-cols-2';
  if (cols === 3) return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';
}

const inputClass =
  'mt-2 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#0066FF]/50 focus:ring-2 focus:ring-[#0066FF]/15 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400';

export default function EmployeeTransferCounselingView({ lang, currentUser }: Props) {
  const en = lang !== 'ta';

  const [stats, setStats] = useState<any>(null);
  const [filterCounts, setFilterCounts] = useState<{
    all: number;
    pending: number;
    in_counseling: number;
    allocated: number;
  } | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_counseling' | 'allocated'>('all');
  const [search, setSearch] = useState('');
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [employeeDetail, setEmployeeDetail] = useState<any>(null);
  const [allVacancies, setAllVacancies] = useState<VacancyRow[]>([]);
  const [districts, setDistricts] = useState<{ district: string; availableSlots: number }[]>([]);
  const [allocationRecords, setAllocationRecords] = useState<any[]>([]);
  const [assignDistrict, setAssignDistrict] = useState('');
  const [assignTp, setAssignTp] = useState('');
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [expandedVacancyDistrict, setExpandedVacancyDistrict] = useState<string | null>(null);
  const [repeatPostingPrompt, setRepeatPostingPrompt] = useState<{
    vacancy: VacancyRow;
    matchedLabel: string;
  } | null>(null);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  /** Tall main workspace row. */
  const workspaceRowHeight = 'h-[min(780px,calc(100vh-11.5rem))] min-h-[620px]';

  const authorityName =
    currentUser?.nameEn ||
    currentUser?.username ||
    currentUser?.designationNameEn ||
    'Authority User';

  const listReadyRef = useRef(false);

  const applyBootstrap = useCallback((data: any) => {
    if (data.stats) setStats(data.stats);
    if (data.filterCounts) setFilterCounts(data.filterCounts);
    if (data.applicants) setApplicants(data.applicants);
    if (data.allVacancies) setAllVacancies(data.allVacancies);
    if (data.districts) setDistricts(data.districts);
    if (data.allocations) setAllocationRecords(data.allocations);
  }, []);

  const loadBootstrap = useCallback(
    async (f: typeof filter, q: string) => {
      const params = new URLSearchParams({
        view: 'bootstrap',
        filter: f,
        q: q.trim(),
      });
      const res = await fetch(`/api/transfer-counseling?${params}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.success) applyBootstrap(data);
      return data.success;
    },
    [applyBootstrap]
  );

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadBootstrap(filter, search);
    } finally {
      setLoading(false);
    }
  }, [loadBootstrap, filter, search]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadBootstrap(filter, search);
      } finally {
        setLoading(false);
        listReadyRef.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    if (!listReadyRef.current) return;
    void loadBootstrap(filter, '');
  }, [filter, loadBootstrap]);

  const searchQuery = search.trim();
  const searchActive = searchQuery.length > 0;

  const filteredApplicants = useMemo(() => {
    if (!searchActive) return [];
    const q = searchQuery.toLowerCase();
    return applicants.filter(
      (a) =>
        a.employeeName?.toLowerCase().includes(q) ||
        a.counselingEmployeeId?.toLowerCase().includes(q)
    );
  }, [applicants, searchActive, searchQuery]);

  useEffect(() => {
    if (!searchActive) {
      setSelectedId('');
      setEmployeeDetail(null);
      setAllocateModalOpen(false);
      return;
    }
    if (selectedId && !filteredApplicants.some((a) => a.counselingEmployeeId === selectedId)) {
      setSelectedId('');
      setEmployeeDetail(null);
      setAllocateModalOpen(false);
    }
  }, [searchActive, searchQuery, selectedId, filteredApplicants]);

  const selectEmployee = async (id: string) => {
    setSelectedId(id);
    setMessage(null);
    setAssignDistrict('');
    setAssignTp('');
    setSelectedVacancyId('');
    setRemarks('');
    setAllocateModalOpen(false);
    const res = await fetch('/api/transfer-counseling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'select_employee',
        counselingEmployeeId: id,
        search: search.trim(),
      }),
    });
    const data = await res.json();
    if (data.success) {
      setEmployeeDetail(data);
      if (data.stats) setStats(data.stats);
      if (data.filterCounts) setFilterCounts(data.filterCounts);
      const status = data.applicant?.counselingStatus as string | undefined;
      if (status) {
        setApplicants((prev) =>
          prev.map((a) => (a.counselingEmployeeId === id ? { ...a, counselingStatus: status } : a))
        );
      }
    } else {
      const detailRes = await fetch(
        `/api/transfer-counseling?view=employee&employeeId=${encodeURIComponent(id)}`,
        { cache: 'no-store' }
      );
      const detail = await detailRes.json();
      if (detail.success) setEmployeeDetail(detail);
      else setMessage({ type: 'err', text: data.message || 'Could not load employee.' });
    }
  };

  const assignTpOptions = useMemo(() => {
    if (!assignDistrict) return [];
    return allVacancies.filter((v) => v.district === assignDistrict);
  }, [assignDistrict, allVacancies]);

  useEffect(() => {
    if (assignDistrict && assignTp) {
      const match = assignTpOptions.find((v) => v.townPanchayat === assignTp);
      setSelectedVacancyId(match?.vacancyId || '');
    } else {
      setSelectedVacancyId('');
    }
  }, [assignDistrict, assignTp, assignTpOptions]);

  const selectedVacancy = allVacancies.find((v) => v.vacancyId === selectedVacancyId);

  const canAllocate =
    selectedId &&
    employeeDetail?.applicant?.counselingStatus !== 'ALLOCATED' &&
    selectedVacancyId &&
    remarks.trim().length > 0;

  const performAllocate = async () => {
    setAllocateModalOpen(false);
    setLoading(true);
    try {
      const res = await fetch('/api/transfer-counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'allocate',
          counselingEmployeeId: selectedId,
          vacancyId: selectedVacancyId,
          remarks: remarks.trim(),
          allocatedBy: authorityName,
          search: search.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'ok', text: data.message });
        if (data.stats) setStats(data.stats);
        if (data.filterCounts) setFilterCounts(data.filterCounts);
        if (data.allocations) setAllocationRecords(data.allocations);
        setRemarks('');
        setSelectedId('');
        setEmployeeDetail(null);
        await refreshAll();
      } else {
        setMessage({ type: 'err', text: data.message || 'Allocation failed.' });
        await loadBootstrap(filter, search);
      }
    } finally {
      setLoading(false);
    }
  };

  const applicant = employeeDetail?.applicant;
  const isAllocated = applicant?.counselingStatus === 'ALLOCATED';

  const filterTabs = useMemo(
    () =>
      [
        ['all', en ? 'All' : 'அனைத்தும்', filterCounts?.all],
        ['pending', en ? 'Pending' : 'நிலுவை', filterCounts?.pending],
        ['in_counseling', en ? 'In counseling' : 'ஆலோசனை', filterCounts?.in_counseling],
        ['allocated', en ? 'Allocated' : 'ஒதுக்கப்பட்டது', filterCounts?.allocated],
      ] as const,
    [en, filterCounts]
  );

  const formatDbStatus = (status?: string) =>
    status ? status.replace(/_/g, ' ') : '—';

  const initials = (name?: string) =>
    (name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const vacanciesByDistrict = useMemo(() => {
    const map = new Map<string, VacancyRow[]>();
    for (const v of allVacancies) {
      if (!map.has(v.district)) map.set(v.district, []);
      map.get(v.district)!.push(v);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allVacancies]);

  useEffect(() => {
    setExpandedVacancyDistrict(null);
    setRepeatPostingPrompt(null);
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId || vacanciesByDistrict.length !== 1) return;
    setExpandedVacancyDistrict(vacanciesByDistrict[0][0]);
  }, [selectedId, vacanciesByDistrict]);

  const exportAllocationsExcel = useCallback(() => {
    if (!allocationRecords.length) {
      setMessage({ type: 'err', text: en ? 'No allocation records to export.' : 'ஏற்றுமதி செய்ய ஒதுக்கீடுகள் இல்லை.' });
      return;
    }
    const locale = en ? 'en-IN' : 'ta-IN';
    const rows = allocationRecords.map((row, idx) => ({
      SNo: idx + 1,
      [en ? 'Date & time' : 'தேதி']: row.allocatedAt
        ? new Date(row.allocatedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
        : '',
      [en ? 'Employee ID' : 'ஊழியர் ID']: row.counselingEmployeeId ?? '',
      [en ? 'Name' : 'பெயர்']: row.employeeName ?? '',
      [en ? 'District' : 'மாவட்டம்']: row.allocatedDistrict ?? '',
      [en ? 'Town Panchayat' : 'பேரூராட்சி']: row.allocatedTownPanchayat ?? '',
      [en ? 'Remarks' : 'குறிப்பு']: row.remarks ?? '',
      [en ? 'Allocated by' : 'ஒதுக்கியவர்']: row.allocatedBy ?? '',
      [en ? 'Status' : 'நிலை']: row.status ?? '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, en ? 'Allocations' : 'Allocations');
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `transfer_counseling_allocations_${stamp}.xlsx`);
  }, [allocationRecords, en]);

  const postingHistoryGrouped = useMemo(() => {
    const g = employeeDetail?.postingHistoryGrouped as
      | { current: { label: string; period?: string }[]; recent: { label: string; period?: string }[]; older: { label: string; period?: string }[] }
      | undefined;
    if (g) return g;
    return { current: [], recent: [], older: [] };
  }, [employeeDetail]);

  const openAllocateModalForVacancy = useCallback((v: VacancyRow) => {
    setAssignDistrict(v.district);
    setAssignTp(v.townPanchayat);
    setSelectedVacancyId(v.vacancyId);
    setRemarks('');
    setAllocateModalOpen(true);
  }, []);

  const pickVacancy = (v: VacancyRow) => {
    if (!selectedId) {
      setMessage({ type: 'err', text: en ? 'Select an employee first.' : 'முதலில் ஊழியரைத் தேர்ந்தெடுக்கவும்.' });
      return;
    }
    if (isAllocated) return;
    if ((v.availableSlots ?? 0) <= 0) return;

    const repeatCheck = findRepeatTownPanchayatWithinThreeYears(postingHistoryGrouped, v.townPanchayat);
    if (repeatCheck.repeat) {
      setRepeatPostingPrompt({
        vacancy: v,
        matchedLabel: repeatCheck.matchedLabel || v.townPanchayat,
      });
      return;
    }

    openAllocateModalForVacancy(v);
  };

  const confirmRepeatPostingAllocation = () => {
    if (!repeatPostingPrompt) return;
    const v = repeatPostingPrompt.vacancy;
    setRepeatPostingPrompt(null);
    openAllocateModalForVacancy(v);
  };

  const cancelRepeatPostingAllocation = () => {
    setRepeatPostingPrompt(null);
  };

  const closeAllocateModal = () => {
    setAllocateModalOpen(false);
  };

  const resetAllocationForm = () => {
    setAssignDistrict('');
    setAssignTp('');
    setSelectedVacancyId('');
    setRemarks('');
    setAllocateModalOpen(false);
  };

  const hasWorkHistory =
    postingHistoryGrouped.current.length > 0 ||
    postingHistoryGrouped.recent.length > 0 ||
    postingHistoryGrouped.older.length > 0;

  const employeeProfileReady = Boolean(searchActive && selectedId && applicant);

  return (
    <div className="-mx-1 space-y-4 bg-gradient-to-br from-slate-100 via-indigo-50/30 to-[#eef2f7] px-1 py-1 pb-6 sm:px-0">
      {message && (
        <div
          role="alert"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
            message.type === 'ok'
              ? 'border-emerald-200 bg-white text-emerald-900'
              : 'border-red-200 bg-white text-red-900'
          }`}
        >
          {message.type === 'ok' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard theme="indigo" label={en ? 'Total applicants' : 'மொத்த விண்ணப்பம்'} value={stats?.totalEmployees ?? '—'} icon={Users} />
        <StatCard theme="amber" label={en ? 'Pending' : 'நிலுவை'} value={stats?.pending ?? '—'} icon={Hourglass} />
        <StatCard theme="emerald" label={en ? 'Completed' : 'முடிந்தது'} value={stats?.completed ?? '—'} icon={CheckCheck} />
        <StatCard theme="teal" label={en ? 'Vacancies available' : 'காலியிடம்'} value={stats?.remainingVacancies ?? '—'} icon={MapPin} />
        <StatCard theme="blue" label={en ? 'Allocated today' : 'இன்று ஒதுக்கீடு'} value={stats?.vacanciesAllocatedToday ?? '—'} icon={Briefcase} />
      </div>

      <div
        className={`grid items-stretch gap-3 xl:grid-cols-[minmax(0,25fr)_minmax(0,75fr)] ${workspaceRowHeight}`}
      >
        <Panel
          tone="blue"
          compact
          title={en ? 'Search employee' : 'ஊழியர் தேடல்'}
          subtitle={
            employeeProfileReady
              ? en
                ? 'Profile — pick a vacancy on the right'
                : 'விவரம் — வலதில் காலியிடம்'
              : searchActive
                ? en
                  ? 'Matches update as you type'
                  : 'தட்டச்சு செய்து தேர்வு'
                : en
                  ? 'Search by name or employee ID'
                  : 'பெயர் அல்லது ID மூலம் தேடல்'
          }
          icon={Search}
          className="flex h-full min-h-0 flex-col"
          bodyClassName={
            employeeProfileReady
              ? 'flex flex-col justify-start p-2.5'
              : 'flex min-h-0 flex-1 flex-col p-2.5'
          }
        >
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#0066FF]/70" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={en ? 'Type name or employee ID…' : 'பெயர் அல்லது ID…'}
                className="w-full rounded-md border border-blue-200/80 bg-white py-2 pl-8 pr-2.5 text-xs shadow-sm outline-none focus:border-[#0066FF]/60 focus:ring-2 focus:ring-[#0066FF]/15"
              />
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-[#0066FF] to-[#0052cc] px-3 text-white shadow-sm hover:brightness-105"
              title={en ? 'Refresh' : 'புதுப்பி'}
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          {searchActive && !employeeProfileReady && (
            <>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
                <span>
                  {en ? 'Matches' : 'பொருத்தம்'}{' '}
                  <strong className="font-semibold text-slate-900">{filteredApplicants.length}</strong>
                </span>
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value as typeof filter)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 outline-none focus:border-[#0066FF]/50"
                >
                  {filterTabs.map(([id, label, count]) => (
                    <option key={id} value={id}>
                      {label}
                      {count != null ? ` (${count})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <ul className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
                {filteredApplicants.map((a, listIndex) => {
                  const selected = selectedId === a.counselingEmployeeId;
                  return (
                    <li key={a.counselingEmployeeId}>
                      <button
                        type="button"
                        onClick={() => void selectEmployee(a.counselingEmployeeId)}
                        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition ${
                          selected
                            ? 'border-[#0066FF]/50 bg-gradient-to-r from-blue-50 to-indigo-100/80 shadow-md ring-1 ring-[#0066FF]/30'
                            : 'border-slate-200/90 bg-white/90 hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm ${avatarListClass(listIndex, selected)}`}
                        >
                          {initials(a.employeeName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-900">{a.employeeName}</span>
                          <span className="block font-mono text-[10px] text-slate-500">{a.counselingEmployeeId}</span>
                        </span>
                        <ChevronRight className={`h-4 w-4 shrink-0 ${selected ? 'text-[#0066FF]' : 'text-slate-300'}`} />
                      </button>
                    </li>
                  );
                })}
                {!filteredApplicants.length && (
                  <li className="rounded-xl border border-dashed border-blue-200/80 bg-blue-50/30 py-8 text-center text-xs text-slate-500">
                    {en ? 'No match for this name or ID.' : 'பொருத்தம் இல்லை.'}
                  </li>
                )}
              </ul>
            </>
          )}

          {employeeProfileReady && applicant && (
            <div className="mt-2 max-h-full shrink-0 overflow-y-auto overflow-x-hidden">
              <div className="overflow-hidden rounded-lg border border-blue-200/70 bg-white shadow-sm ring-1 ring-blue-100/80">
                <div className="border-b border-blue-100 bg-gradient-to-r from-[#0066FF]/10 via-blue-50/80 to-white px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#0066FF] text-[11px] font-bold text-white shadow-sm">
                      {initials(applicant.employeeName)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="truncate text-[13px] font-semibold leading-tight text-slate-900">{applicant.employeeName}</h3>
                      <p className="mt-0.5 truncate font-mono text-[10px] font-medium text-[#0066FF]">{applicant.counselingEmployeeId}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase ring-1 ring-inset ${statusStyles(applicant.counselingStatus)}`}
                    >
                      {formatDbStatus(applicant.counselingStatus)}
                    </span>
                  </div>
                  {(applicant.seniorityNo || applicant.counselingCategory) && (
                    <div className="mt-1.5 flex flex-wrap gap-1 border-t border-blue-100/80 pt-1.5">
                      {applicant.seniorityNo && (
                        <span className="rounded bg-white px-1.5 py-px text-[8px] font-semibold text-violet-800 ring-1 ring-violet-200/80">
                          {en ? 'Sr.' : 'முன்.'} {applicant.seniorityNo}
                        </span>
                      )}
                      {applicant.counselingCategory && (
                        <span className="truncate rounded bg-white px-1.5 py-px text-[8px] font-semibold text-emerald-800 ring-1 ring-emerald-200/80">
                          {String(applicant.counselingCategory).replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <Clock className="h-3.5 w-3.5 text-slate-600" strokeWidth={2.25} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-700">
                    {en ? 'Work history' : 'பணி வரலாறு'}
                  </p>
                </div>
                <div className="px-3 py-2.5">
                  {!hasWorkHistory ? (
                    <p className="py-0.5 text-[9px] text-slate-400">—</p>
                  ) : (
                    <div className="space-y-1.5">
                      {[
                        {
                          key: 'current',
                          title: en ? 'Current' : 'தற்போது',
                          tone: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
                          items: postingHistoryGrouped.current,
                        },
                        {
                          key: 'recent',
                          title: en ? 'Previous (last 3 years)' : 'கடந்த 3 ஆண்டு',
                          tone: 'border-blue-200 bg-blue-50/60 text-blue-900',
                          items: postingHistoryGrouped.recent,
                        },
                        {
                          key: 'older',
                          title: en ? 'Older' : 'பழைய பணிகள்',
                          tone: 'border-slate-200 bg-slate-50/80 text-slate-700',
                          items: postingHistoryGrouped.older,
                        },
                      ].map(
                        (section) =>
                          section.items.length > 0 && (
                            <div key={section.key} className={`rounded-md border px-2 py-1 ${section.tone}`}>
                              <p className="text-[8px] font-bold uppercase tracking-wide opacity-90">{section.title}</p>
                              <ul className="mt-0.5 space-y-1">
                                {section.items.map((item, idx) => (
                                  <li key={idx} className="border-t border-black/[0.06] pt-1 first:border-t-0 first:pt-0">
                                    {item.period && (
                                      <p className="text-[8px] font-medium tabular-nums opacity-75">
                                        {en ? 'Since' : 'முதல்'} {item.period}
                                      </p>
                                    )}
                                    <p className="whitespace-pre-line text-[9px] font-semibold leading-snug">{item.label}</p>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!searchActive && (
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-blue-200/70 bg-gradient-to-b from-white to-blue-50/50 px-4 py-10 text-center">
              <Search className="mb-2 h-9 w-9 text-[#0066FF]/45" />
              <p className="text-sm font-semibold text-slate-700">{en ? 'Start typing to search' : 'தேடத் தொடங்குங்கள்'}</p>
              <p className="mt-1 max-w-[14rem] text-xs text-slate-500">
                {en ? 'Enter a name or employee ID — matches appear from the first letter.' : 'முதல் எழுத்திலிருந்தே பொருத்தம் காட்டப்படும்.'}
              </p>
            </div>
          )}
        </Panel>

        <Panel
          tone="vacancy"
          compact
          title={en ? 'Available vacancies' : 'காலியிடங்கள்'}
          subtitle={
            employeeProfileReady
              ? en
                ? 'Pick a district · Town Panchayat vacancies below'
                : 'மாவட்டம் தேர்வு · கீழே காலியிடம்'
              : en
                ? 'Select an employee to unlock'
                : 'முதலில் ஊழியர் தேர்வு'
          }
          icon={Building2}
          allowBodyShadowBleed
          className="flex h-full min-h-0 flex-col"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-4"
        >
          {!employeeProfileReady ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300/70 bg-white/80 px-6 py-16 text-center">
              <Building2 className="mb-3 h-12 w-12 text-[#0066FF]/50" />
              <p className="max-w-sm text-sm font-semibold text-slate-700">
                {en ? 'Vacancy map will appear here after you select an employee.' : 'ஊழியர் தேர்வுக்குப் பிறகு காலியிடம் காட்டப்படும்.'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {en ? 'Use the left panel to search by ID, name, or seniority.' : 'இடதுபுறத்தில் தேடல் செய்யவும்.'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 px-0.5 py-1">
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vacanciesByDistrict.map(([district, rows], districtIndex) => {
                  const districtSlots = rows.reduce((n, r) => n + (r.availableSlots || 0), 0);
                  const theme = vacancyDistrictTheme(district, districtIndex);
                  const expanded = expandedVacancyDistrict === district;
                  const slotsLabel = en ? 'Available slots' : 'காலியிடம்';
                  const allottedLabel = en ? 'Allotted / full' : 'நிரம்பியது';
                  return (
                    <div
                      key={district}
                      className={`flex min-w-0 flex-col self-start overflow-hidden rounded-2xl border transition ${theme.shell} ${
                        expanded
                          ? 'col-span-full border-[#0066FF]/70 shadow-[0_8px_28px_rgba(0,102,255,0.18)]'
                          : 'border-white/40'
                      }`}
                    >
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedVacancyDistrict((d) => (d === district ? null : district))}
                        className={`w-full text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 ${
                          expanded ? '' : 'hover:brightness-[1.03] active:scale-[0.995]'
                        }`}
                      >
                        <div
                          className={`relative px-4 pb-4 pt-3.5 ${theme.header} ${expanded ? 'rounded-t-2xl' : 'rounded-2xl'}`}
                        >
                          <span
                            className={`absolute left-3.5 top-3.5 flex h-9 w-9 items-center justify-center rounded-lg ${theme.chip}`}
                          >
                            <MapPin className="h-[17px] w-[17px] text-white" strokeWidth={2.25} />
                          </span>
                          <ChevronDown
                            className={`absolute right-3.5 top-4 h-5 w-5 text-white/85 transition-transform ${expanded ? 'rotate-180' : ''}`}
                            aria-hidden
                          />
                          <h3
                            className={`mx-auto max-w-[calc(100%-4.5rem)] px-1 text-center text-lg font-bold leading-snug tracking-tight sm:text-xl ${theme.headerTitle}`}
                          >
                            {district}
                          </h3>
                          <div
                            className={`mt-3.5 grid grid-cols-2 gap-3 border-t border-white/25 pt-3.5 text-left ${theme.headerMeta}`}
                          >
                            <div className="flex min-w-0 items-center justify-between gap-2 pr-1">
                              <span className="truncate text-[11px] font-medium leading-tight opacity-95">
                                {en ? 'Town Panchayat' : 'பேரூராட்சி'}
                              </span>
                              <span className="shrink-0 text-base font-bold tabular-nums leading-none">{rows.length}</span>
                            </div>
                            <div className="flex min-w-0 items-center justify-between gap-2 border-l border-white/25 pl-3">
                              <span className="truncate text-[11px] font-medium leading-tight opacity-95">
                                {en ? 'Open slots' : 'காலியிடம்'}
                              </span>
                              <span className="shrink-0 text-base font-bold tabular-nums leading-none">{districtSlots}</span>
                            </div>
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className={`rounded-b-2xl border-t border-black/10 px-4 pb-4 pt-3 ${theme.body}`}>
                          <p className={`mb-3 text-left text-[10px] font-semibold uppercase tracking-wider ${theme.cardMuted}`}>
                            {en ? 'Select Town Panchayat' : 'பேரூராட்சி தேர்வு'}
                          </p>
                          <div className={`grid auto-rows-fr items-stretch gap-3 ${vacancySubBlockGridClass(rows.length, false)}`}>
                            {rows.map((v) => (
                              <VacancyTpTile
                                key={v.vacancyId}
                                vacancy={v}
                                theme={theme}
                                picked={selectedVacancyId === v.vacancyId}
                                disabled={isAllocated}
                                slotsLabel={slotsLabel}
                                allottedLabel={allottedLabel}
                                onSelect={() => pickVacancy(v)}
                              />
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {!vacanciesByDistrict.length && (
                <p className="py-12 text-center text-sm text-slate-600">{en ? 'No open vacancies.' : 'காலியிடம் இல்லை.'}</p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <Panel
        tone="allocations"
        compact
        title={en ? 'Allocation register' : 'ஒதுக்கீட்டு பதிவேடு'}
        subtitle={
          en
            ? `All allocated records · ${allocationRecords.length} total`
            : `மொத்த ஒதுக்கீடுகள் · ${allocationRecords.length}`
        }
        icon={ClipboardList}
        bodyClassName="p-0"
        action={
          <button
            type="button"
            onClick={exportAllocationsExcel}
            disabled={!allocationRecords.length}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/30 bg-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2.25} />
            {en ? 'Excel' : 'Excel'}
          </button>
        }
      >
        <div className="max-h-80 overflow-auto rounded-b-xl border-t border-emerald-100/80">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-emerald-200 bg-emerald-50/95 backdrop-blur-sm">
              <tr className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                <th className="px-3 py-2.5">{en ? 'Date & time' : 'தேதி'}</th>
                <th className="px-3 py-2.5">{en ? 'Employee ID' : 'ID'}</th>
                <th className="px-3 py-2.5">{en ? 'Name' : 'பெயர்'}</th>
                <th className="px-3 py-2.5">{en ? 'District' : 'மாவட்டம்'}</th>
                <th className="px-3 py-2.5">{en ? 'Town Panchayat' : 'பேரூ.'}</th>
                <th className="px-3 py-2.5">{en ? 'Remarks' : 'குறிப்பு'}</th>
                <th className="px-3 py-2.5">{en ? 'Status' : 'நிலை'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100/80 bg-white">
              {allocationRecords.map((row) => (
                <tr
                  key={row.counselingEmployeeId + String(row.allocatedAt)}
                  className="transition-colors hover:bg-emerald-50/70 even:bg-emerald-50/25"
                >
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {row.allocatedAt
                      ? new Date(row.allocatedAt).toLocaleString(en ? 'en-IN' : 'ta-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-[11px] text-[#0066FF]">{row.counselingEmployeeId}</td>
                  <td className="px-3 py-2 font-medium text-slate-800">{row.employeeName}</td>
                  <td className="px-3 py-2 text-slate-700">{row.allocatedDistrict || '—'}</td>
                  <td className="px-3 py-2 text-slate-800">{row.allocatedTownPanchayat || '—'}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-slate-600" title={row.remarks}>
                    {row.remarks || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ring-1 ring-inset ${statusStyles(row.status)}`}
                    >
                      {formatDbStatus(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!allocationRecords.length && (
            <p className="bg-white py-10 text-center text-sm text-slate-500">
              {en ? 'No allocation records yet.' : 'ஒதுக்கீட்டு பதிவுகள் இல்லை.'}
            </p>
          )}
        </div>
      </Panel>

      {repeatPostingPrompt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="repeat-posting-title"
          >
            <div className="border-b border-amber-200 bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3.5">
              <h3 id="repeat-posting-title" className="flex items-center gap-2 text-sm font-bold text-white">
                <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={2.25} />
                {en ? 'Prior posting in last 3 years' : 'கடந்த 3 ஆண்டில் பணி'}
              </h3>
            </div>
            <div className="space-y-3 px-4 py-4 text-sm text-slate-700">
              <p>
                {en
                  ? 'This employee has already served at this Town Panchayat (or the same location) within the last three years.'
                  : 'இந்த ஊழியர் கடந்த மூன்று ஆண்டுகளில் இந்த பேரூராட்சியில் (அல்லது அதே இடத்தில்) பணியாற்றியுள்ளார்.'}
              </p>
              <div className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-xs">
                <p className="font-semibold text-amber-950">{en ? 'Selected vacancy' : 'தேர்ந்தெடுத்த காலியிடம்'}</p>
                <p className="mt-1 font-medium text-slate-900">
                  {repeatPostingPrompt.vacancy.townPanchayat}
                  {repeatPostingPrompt.vacancy.district ? ` · ${repeatPostingPrompt.vacancy.district}` : ''}
                </p>
                <p className="mt-2 font-semibold text-amber-950">{en ? 'Matched history' : 'பொருந்தும் வரலாறு'}</p>
                <p className="mt-1 whitespace-pre-line text-slate-800">{repeatPostingPrompt.matchedLabel}</p>
              </div>
              <p className="text-xs text-slate-500">
                {en ? 'Do you want to continue with this allocation?' : 'இந்த ஒதுக்கீட்டைத் தொடர விரும்புகிறீர்களா?'}
              </p>
            </div>
            <div className="flex gap-2 border-t border-slate-100 bg-slate-50/80 px-4 py-3">
              <button
                type="button"
                onClick={cancelRepeatPostingAllocation}
                className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                {en ? 'Cancel' : 'ரத்து'}
              </button>
              <button
                type="button"
                onClick={confirmRepeatPostingAllocation}
                className="inline-flex flex-1 items-center justify-center rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 py-2.5 text-sm font-bold text-white shadow-sm hover:from-amber-500 hover:to-orange-500"
              >
                {en ? 'Continue' : 'தொடரவும்'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allocateModalOpen && applicant && selectedVacancy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-indigo-950/45 p-4 backdrop-blur-sm">
          <div
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-indigo-200/60 bg-white shadow-[0_24px_64px_rgba(49,46,129,0.28)] ring-1 ring-indigo-100"
            role="dialog"
            aria-modal="true"
            aria-labelledby="allocation-modal-title"
          >
            <div className="relative flex items-center justify-between bg-gradient-to-r from-[#0066FF] via-indigo-600 to-violet-600 px-4 py-3.5">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.22),transparent_55%)]" />
              <h3
                id="allocation-modal-title"
                className="relative flex items-center gap-2.5 text-sm font-bold tracking-tight text-white"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/30">
                  <Briefcase className="h-4 w-4" strokeWidth={2.25} />
                </span>
                {en ? 'Confirm transfer allocation' : 'இடமாற்று ஒதுக்கீடு'}
              </h3>
              <button
                type="button"
                onClick={closeAllocateModal}
                className="relative rounded-lg p-1.5 text-white/80 ring-1 ring-transparent hover:bg-white/15 hover:text-white hover:ring-white/25"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 bg-gradient-to-b from-indigo-50/80 via-white to-emerald-50/30 px-4 py-4 text-sm">
              <div className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-violet-100/90 via-indigo-50 to-blue-50 p-3 ring-1 ring-indigo-200/70">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white shadow-md">
                  {initials(applicant.employeeName)}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-indigo-600/90">{en ? 'Employee' : 'ஊழியர்'}</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{applicant.employeeName}</p>
                  <p className="font-mono text-[11px] text-indigo-700/80">{applicant.counselingEmployeeId}</p>
                </div>
                <span
                  className={`ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ring-1 ring-inset sm:inline-flex ${statusStyles(applicant.counselingStatus)}`}
                >
                  {formatDbStatus(applicant.counselingStatus)}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-l-[3px] border-l-sky-500 bg-sky-50/90 px-2.5 py-2 ring-1 ring-sky-100">
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase text-sky-800/70">
                    <MapPin className="h-3 w-3" />
                    {en ? 'District' : 'மாவட்டம்'}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-slate-900">{assignDistrict || selectedVacancy.district}</p>
                </div>
                <div className="rounded-lg border border-l-[3px] border-l-emerald-500 bg-emerald-50/90 px-2.5 py-2 ring-1 ring-emerald-100">
                  <p className="flex items-center gap-1 text-[9px] font-bold uppercase text-emerald-800/70">
                    <Building2 className="h-3 w-3" />
                    {en ? 'Town Panchayat' : 'பேரூராட்சி'}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-snug text-slate-900">
                    {assignTp || selectedVacancy.townPanchayat}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 px-3 py-2.5 ring-1 ring-amber-200/80">
                <span className="text-xs font-semibold text-amber-900/80">{en ? 'Available slots at this TP' : 'காலியிடம்'}</span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-sm font-bold tabular-nums text-white shadow-sm">
                  {selectedVacancy.availableSlots}
                </span>
              </div>

              <label className="block">
                <span className="text-xs font-bold text-violet-900">
                  {en ? 'Remarks / comments' : 'குறிப்புகள்'} <span className="text-rose-500">*</span>
                </span>
                <textarea
                  value={remarks}
                  autoFocus
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="mt-2 w-full resize-none rounded-xl border border-violet-200/80 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none ring-1 ring-violet-100/80 transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200/60"
                  placeholder={en ? 'Enter mandatory counseling remarks…' : 'கட்டாய குறிப்புகள்…'}
                />
                <span className="mt-1 block text-right text-[10px] font-medium text-violet-600/60">{remarks.length}/500</span>
              </label>
            </div>

            <div className="flex gap-2 border-t border-indigo-100/80 bg-gradient-to-r from-slate-50 to-indigo-50/40 px-4 py-3.5">
              <button
                type="button"
                onClick={resetAllocationForm}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-amber-200 hover:bg-amber-50/80 hover:text-amber-950"
              >
                <RotateCcw className="h-4 w-4" />
                {en ? 'Reset' : 'மீட்டமை'}
              </button>
              <button
                type="button"
                disabled={!canAllocate || loading}
                onClick={() => void performAllocate()}
                className="inline-flex flex-[1.35] items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-600/25 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 disabled:shadow-none"
              >
                <CheckCircle2 className="h-4 w-4" />
                {en ? 'Submit allocation' : 'ஒதுக்கீடு செய்'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
