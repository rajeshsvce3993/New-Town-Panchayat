'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  RefreshCw,
  User,
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
  X,
  ChevronRight,
  Check,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { Language } from './translations';

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

type PanelTone = 'blue' | 'indigo' | 'violet' | 'cyan' | 'emerald' | 'slate';

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
}) {
  const t = panelToneStyles[tone];
  return (
    <section
      className={`portal-dashboard-panel flex flex-col overflow-hidden rounded-xl border bg-white ${t.shell} ${className}`}
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

function StatCard({
  label,
  value,
  icon: Icon,
  iconWrap,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  iconWrap: string;
  accent: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-white/80 bg-white px-3.5 py-3 shadow-[0_2px_8px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/70 ${accent}`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconWrap}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={2.25} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums text-slate-900">{value}</p>
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

const VACANCY_DISTRICT_THEMES = [
  {
    collapsed: 'bg-gradient-to-r from-amber-100/90 via-orange-50 to-yellow-50 border-amber-200',
    expandedShell: 'border-amber-300 shadow-sm shadow-amber-100/80',
    expandedHeader: 'bg-gradient-to-r from-amber-300/90 via-orange-200 to-amber-200',
    expandedBody: 'bg-gradient-to-b from-amber-50/90 to-orange-50/40',
    title: 'text-amber-950',
    meta: 'text-amber-900/75',
    chip: 'bg-amber-600/15 text-amber-950 ring-1 ring-amber-400/30',
    row: 'hover:bg-amber-100/70',
    picked: 'bg-amber-200/80 ring-1 ring-amber-500/35',
  },
  {
    collapsed: 'bg-gradient-to-r from-teal-100/90 via-emerald-50 to-teal-50 border-teal-200',
    expandedShell: 'border-teal-300 shadow-sm shadow-teal-100/80',
    expandedHeader: 'bg-gradient-to-r from-teal-300/90 via-emerald-200 to-teal-200',
    expandedBody: 'bg-gradient-to-b from-teal-50/90 to-emerald-50/40',
    title: 'text-teal-950',
    meta: 'text-teal-900/75',
    chip: 'bg-teal-600/15 text-teal-950 ring-1 ring-teal-400/30',
    row: 'hover:bg-teal-100/70',
    picked: 'bg-teal-200/80 ring-1 ring-teal-500/35',
  },
  {
    collapsed: 'bg-gradient-to-r from-violet-100/90 via-purple-50 to-violet-50 border-violet-200',
    expandedShell: 'border-violet-300 shadow-sm shadow-violet-100/80',
    expandedHeader: 'bg-gradient-to-r from-violet-300/90 via-purple-200 to-violet-200',
    expandedBody: 'bg-gradient-to-b from-violet-50/90 to-purple-50/40',
    title: 'text-violet-950',
    meta: 'text-violet-900/75',
    chip: 'bg-violet-600/15 text-violet-950 ring-1 ring-violet-400/30',
    row: 'hover:bg-violet-100/70',
    picked: 'bg-violet-200/80 ring-1 ring-violet-500/35',
  },
  {
    collapsed: 'bg-gradient-to-r from-sky-100/90 via-blue-50 to-sky-50 border-sky-200',
    expandedShell: 'border-sky-300 shadow-sm shadow-sky-100/80',
    expandedHeader: 'bg-gradient-to-r from-sky-300/90 via-blue-200 to-sky-200',
    expandedBody: 'bg-gradient-to-b from-sky-50/90 to-blue-50/40',
    title: 'text-sky-950',
    meta: 'text-sky-900/75',
    chip: 'bg-sky-600/15 text-sky-950 ring-1 ring-sky-400/30',
    row: 'hover:bg-sky-100/70',
    picked: 'bg-sky-200/80 ring-1 ring-sky-500/35',
  },
  {
    collapsed: 'bg-gradient-to-r from-rose-100/90 via-pink-50 to-rose-50 border-rose-200',
    expandedShell: 'border-rose-300 shadow-sm shadow-rose-100/80',
    expandedHeader: 'bg-gradient-to-r from-rose-300/90 via-pink-200 to-rose-200',
    expandedBody: 'bg-gradient-to-b from-rose-50/90 to-pink-50/40',
    title: 'text-rose-950',
    meta: 'text-rose-900/75',
    chip: 'bg-rose-600/15 text-rose-950 ring-1 ring-rose-400/30',
    row: 'hover:bg-rose-100/70',
    picked: 'bg-rose-200/80 ring-1 ring-rose-500/35',
  },
  {
    collapsed: 'bg-gradient-to-r from-lime-100/90 via-green-50 to-lime-50 border-lime-200',
    expandedShell: 'border-lime-300 shadow-sm shadow-lime-100/80',
    expandedHeader: 'bg-gradient-to-r from-lime-300/90 via-green-200 to-lime-200',
    expandedBody: 'bg-gradient-to-b from-lime-50/90 to-green-50/40',
    title: 'text-lime-950',
    meta: 'text-lime-900/75',
    chip: 'bg-lime-600/15 text-lime-950 ring-1 ring-lime-500/30',
    row: 'hover:bg-lime-100/70',
    picked: 'bg-lime-200/80 ring-1 ring-lime-600/35',
  },
] as const;

function vacancyDistrictTheme(district: string, index: number) {
  let h = index;
  for (let i = 0; i < district.length; i++) h = (h * 31 + district.charCodeAt(i)) >>> 0;
  return VACANCY_DISTRICT_THEMES[h % VACANCY_DISTRICT_THEMES.length];
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
  const [todayAllocations, setTodayAllocations] = useState<any[]>([]);
  const [assignDistrict, setAssignDistrict] = useState('');
  const [assignTp, setAssignTp] = useState('');
  const [selectedVacancyId, setSelectedVacancyId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);
  const [allocateModalOpen, setAllocateModalOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [expandedDistrict, setExpandedDistrict] = useState<string | null>(null);

  /** Tall first row: fills viewport so middle column scrolls inside details + history panels. */
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
    if (data.allocations) setTodayAllocations(data.allocations);
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
    const t = setTimeout(() => {
      void loadBootstrap(filter, search);
    }, 300);
    return () => clearTimeout(t);
  }, [filter, search, loadBootstrap]);

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
        if (data.allocations) setTodayAllocations(data.allocations);
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
  const history = employeeDetail?.history;
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

  const formatDbBool = (value: unknown) => {
    if (value === true) return en ? 'Yes' : 'ஆம்';
    if (value === false) return en ? 'No' : 'இல்லை';
    if (value === null || value === undefined || value === '') return undefined;
    return String(value);
  };

  const initials = (name?: string) =>
    (name || '?')
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0])
      .join('')
      .toUpperCase();

  const flowSteps = useMemo(
    () =>
      [
        { step: 1, label: en ? 'Employee' : 'ஊழியர்' },
        { step: 2, label: en ? 'History' : 'வரலாறு' },
        { step: 3, label: en ? 'Vacancy' : 'காலியிடம்' },
        { step: 4, label: en ? 'Allocation' : 'ஒதுக்கீடு' },
      ] as const,
    [en]
  );

  const activeFlowStep = !selectedId ? 1 : !selectedVacancyId ? 2 : !remarks.trim() ? 3 : 4;

  const vacanciesByDistrict = useMemo(() => {
    const map = new Map<string, VacancyRow[]>();
    for (const v of allVacancies) {
      if (!map.has(v.district)) map.set(v.district, []);
      map.get(v.district)!.push(v);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [allVacancies]);

  const recentAllocRows = useMemo(() => {
    if (selectedId) {
      const mine = todayAllocations.filter((r) => r.counselingEmployeeId === selectedId);
      if (mine.length) return mine;
    }
    return todayAllocations;
  }, [todayAllocations, selectedId]);

  const pickVacancy = (v: VacancyRow) => {
    if (!selectedId) {
      setMessage({ type: 'err', text: en ? 'Select an employee first.' : 'முதலில் ஊழியரைத் தேர்ந்தெடுக்கவும்.' });
      return;
    }
    if (isAllocated) return;
    setAssignDistrict(v.district);
    setAssignTp(v.townPanchayat);
    setSelectedVacancyId(v.vacancyId);
    setRemarks('');
    setAllocateModalOpen(true);
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

  const toggleDistrictAccordion = (district: string) => {
    setExpandedDistrict((prev) => (prev === district ? null : district));
  };

  const transferAppStatus = applicant
    ? formatDbBool(applicant.transferRequestMarked) ?? formatDbStatus(applicant.counselingStatus)
    : '—';

  const postingTimeline = (employeeDetail?.postingTimeline || []) as { label: string; period?: string }[];

  return (
    
    <div className="-mx-1 space-y-4 bg-gradient-to-b from-slate-100 to-[#eef2f7] px-1 py-1 pb-6 sm:px-0">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm ring-1 ring-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
        <div className="border-l-4 border-[#0066FF] pl-3">
          <h1 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
            {en ? 'Employee Transfer Counseling' : 'பணியாளர் இடமாற்று ஆலோசனை'}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {en ? 'Digital counseling desk for transfer allocation' : 'இடமாற்று ஒதுக்கீட்டு ஆலோசனை'}
          </p>
        </div>
        <nav
          className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-50 p-1.5 text-xs ring-1 ring-slate-200/80"
          aria-label={en ? 'Workflow progress' : 'படிப்படி'}
        >
          {flowSteps.map(({ step, label }, idx) => (
            <React.Fragment key={step}>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold transition ${
                  activeFlowStep === step
                    ? 'bg-[#0066FF] text-white shadow-sm'
                    : activeFlowStep > step
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'text-slate-500'
                }`}
              >
                {activeFlowStep > step ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="tabular-nums">{step}.</span>
                )}
                {label}
              </span>
              {idx < flowSteps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-slate-300" aria-hidden />
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

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

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <StatCard accent="border-t-[3px] border-t-slate-500" label={en ? 'Total applicants' : 'மொத்த விண்ணப்பம்'} value={stats?.totalEmployees ?? '—'} icon={Users} iconWrap="bg-slate-100 text-slate-700" />
        <StatCard accent="border-t-[3px] border-t-amber-500" label={en ? 'Pending' : 'நிலுவை'} value={stats?.pending ?? '—'} icon={Hourglass} iconWrap="bg-amber-100 text-amber-700" />
        <StatCard accent="border-t-[3px] border-t-emerald-500" label={en ? 'Completed' : 'முடிந்தது'} value={stats?.completed ?? '—'} icon={CheckCheck} iconWrap="bg-emerald-100 text-emerald-700" />
        <StatCard accent="border-t-[3px] border-t-cyan-500" label={en ? 'Vacancies available' : 'காலியிடம்'} value={stats?.remainingVacancies ?? '—'} icon={MapPin} iconWrap="bg-cyan-100 text-cyan-800" />
        <StatCard accent="border-t-[3px] border-t-[#0066FF]" label={en ? 'Allocated today' : 'இன்று ஒதுக்கீடு'} value={stats?.vacanciesAllocatedToday ?? '—'} icon={Briefcase} iconWrap="bg-blue-100 text-[#0066FF]" />
      </div>

      <div className={`grid items-stretch gap-3 xl:grid-cols-12 ${workspaceRowHeight}`}>
        <div className="flex h-full min-h-0 flex-col xl:col-span-3">
          <Panel
            tone="blue"
            compact
            title={en ? 'Search employee' : 'ஊழியர் தேடல்'}
            subtitle={en ? 'Select an applicant' : 'விண்ணப்பதாரர் தேர்வு'}
            icon={Search}
            className="flex h-full min-h-0 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col p-2.5"
          >
            <div className="flex gap-1.5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={en ? 'Employee ID, name or seniority…' : 'ID / பெயர் / முன்னுரிமை…'}
                  className="w-full rounded-md border border-slate-200 bg-slate-50/50 py-2 pl-8 pr-2.5 text-xs outline-none focus:border-[#0066FF]/50 focus:bg-white focus:ring-2 focus:ring-[#0066FF]/15"
                />
              </div>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="inline-flex shrink-0 items-center justify-center rounded-md bg-[#0066FF] px-2.5 text-white hover:bg-[#0052cc]"
                title={en ? 'Refresh' : 'புதுப்பி'}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5 text-[10px] text-slate-500">
              <span>
                {en ? 'Showing' : 'காட்டப்படுபவை'}{' '}
                <strong className="font-semibold text-slate-800">{applicants.length}</strong>
                {stats?.totalEmployees != null && (
                  <>
                    {' '}
                    {en ? 'of' : '/'} <strong className="font-semibold text-slate-800">{stats.totalEmployees}</strong>{' '}
                    {en ? 'employees' : 'ஊழியர்கள்'}
                  </>
                )}
              </span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-medium text-slate-700 outline-none focus:border-[#0066FF]/50"
              >
                {filterTabs.map(([id, label, count]) => (
                  <option key={id} value={id}>
                    {label}
                    {count != null ? ` (${count})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <ul className="mt-1.5 min-h-0 flex-1 space-y-1 overflow-y-auto pr-0.5">
              {applicants.map((a, listIndex) => {
                const selected = selectedId === a.counselingEmployeeId;
                return (
                  <li key={a.counselingEmployeeId}>
                    <button
                      type="button"
                      onClick={() => void selectEmployee(a.counselingEmployeeId)}
                      className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition ${
                        selected
                          ? 'border-[#0066FF]/45 bg-gradient-to-r from-blue-50 to-indigo-50/80 shadow-sm ring-1 ring-[#0066FF]/25'
                          : 'border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/80'
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
                        <span className="mt-0.5 flex flex-wrap items-center gap-1">
                          {a.seniorityNo && (
                            <span className="text-[9px] font-medium text-violet-600/90">
                              #{a.seniorityNo}
                            </span>
                          )}
                          <MapPin className="h-2.5 w-2.5 text-orange-400" />
                          <span className="max-w-[5.5rem] truncate text-[9px] text-slate-500">{a.currentDistrict || '—'}</span>
                          <span
                            className={`inline-flex rounded px-1 py-px text-[8px] font-bold uppercase ring-1 ring-inset ${statusStyles(a.counselingStatus || '')}`}
                          >
                            {formatDbStatus(a.counselingStatus)}
                          </span>
                        </span>
                      </span>
                      <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${selected ? 'text-[#0066FF]' : 'text-slate-300'}`} />
                    </button>
                  </li>
                );
              })}
              {!applicants.length && (
                <li className="rounded-xl border border-dashed border-slate-200 bg-white py-10 text-center text-sm text-slate-400">
                  {en ? 'No employees match.' : 'பொருந்தும் ஊழியர்கள் இல்லை.'}
                </li>
              )}
            </ul>
          </Panel>
        </div>

        <div className="flex h-full min-h-0 flex-col gap-2 xl:col-span-5">
          <Panel
            tone="indigo"
            compact
            title={en ? 'Employee details' : 'ஊழியர் விவரம்'}
            subtitle={en ? 'Profile & application' : 'சுயவிவரம்'}
            icon={User}
            className="shrink-0"
            bodyGrow={false}
            bodyClassName="overflow-visible p-2.5"
          >
            {!applicant ? (
              <div className="flex min-h-[72px] flex-col items-center justify-center text-center text-[11px] text-slate-500">
                <User className="mb-1.5 h-7 w-7 text-slate-300" />
                {en ? 'Select an employee.' : 'ஊழியரைத் தேர்ந்தெடுக்கவும்.'}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2.5 rounded-md bg-gradient-to-r from-fuchsia-100/80 via-indigo-50 to-cyan-50 p-2 ring-1 ring-indigo-200/60">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-blue-600 text-[11px] font-bold text-white shadow-md ring-2 ring-white/80">
                    {initials(applicant.employeeName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1">
                      <h3 className="text-xs font-semibold text-slate-900">{applicant.employeeName}</h3>
                      <span
                        className={`rounded-full px-1.5 py-px text-[8px] font-bold uppercase ring-1 ring-inset ${statusStyles(applicant.counselingStatus)}`}
                      >
                        {formatDbStatus(applicant.counselingStatus)}
                      </span>
                    </div>
                    <p className="font-mono text-[10px] text-indigo-600/80">{applicant.counselingEmployeeId}</p>
                  </div>
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  <Field accent="blue" label={en ? 'Current district' : 'மாவட்டம்'} value={applicant.currentDistrict} />
                  <Field accent="indigo" label={en ? 'Current Town Panchayat' : 'பேரூராட்சி'} value={applicant.currentTownPanchayat} />
                  <Field accent="violet" label={en ? 'Date of joining' : 'சேர்ந்த தேதி'} value={history?.presentStationJoiningDate} />
                  <Field accent="amber" label={en ? 'Grade' : 'தரம்'} value={history?.grade} />
                  <Field
                    accent="emerald"
                    label={en ? 'Counseling category' : 'வகை'}
                    value={applicant.counselingCategory ? String(applicant.counselingCategory).replace(/_/g, ' ') : undefined}
                  />
                  <Field accent="rose" label={en ? 'Transfer application' : 'இடமாற்று நிலை'} value={transferAppStatus} />
                </div>
              </div>
            )}
          </Panel>
          <Panel
            tone="violet"
            title={en ? 'Transfer / posting history' : 'பணி வரலாறு'}
            subtitle={en ? 'Service timeline' : 'பணி காலவரிசை'}
            icon={Clock}
            className="flex min-h-0 flex-1 flex-col"
            bodyClassName="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3"
          >
            {!postingTimeline.length ? (
              <p className="py-6 text-center text-xs text-slate-400">{en ? 'No posting history.' : 'வரலாறு இல்லை.'}</p>
            ) : (
              <div className="relative ml-1.5 space-y-0 border-l-2 border-slate-200 pl-4">
                {postingTimeline.map((item, idx) => (
                  <div key={idx} className="relative pb-4 last:pb-0">
                    <span
                      className={`absolute -left-[1.28rem] top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                        idx === 0 ? 'bg-[#0066FF]' : 'bg-slate-300'
                      }`}
                    />
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                          idx === 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx === 0 ? (en ? 'Current' : 'தற்போது') : en ? 'Previous' : 'முந்தைய'}
                      </span>
                      {item.period && <span className="text-[11px] text-slate-400">{item.period}</span>}
                    </div>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-800">{item.label}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="flex h-full min-h-0 flex-col xl:col-span-4">
          <Panel
            tone="cyan"
            compact
            title={en ? 'Available vacancies' : 'காலியிடங்கள்'}
            subtitle={en ? 'By district' : 'மாவட்ட வாரியாக'}
            icon={Building2}
            className="flex h-full min-h-0 flex-col"
            bodyClassName="flex min-h-0 flex-1 flex-col p-3"
          >
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
              {vacanciesByDistrict.map(([district, rows], districtIndex) => {
                const open = expandedDistrict === district;
                const districtSlots = rows.reduce((n, r) => n + (r.availableSlots || 0), 0);
                const theme = vacancyDistrictTheme(district, districtIndex);
                return (
                  <div
                    key={district}
                    className={`overflow-hidden rounded-lg border bg-white/60 transition-shadow ${
                      open ? theme.expandedShell : 'border-slate-200/80 shadow-none'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleDistrictAccordion(district)}
                      className={`flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left transition ${
                        open ? theme.expandedHeader : theme.collapsed
                      } ${!open ? 'hover:brightness-[0.98]' : ''}`}
                    >
                      <span className={`truncate text-xs font-bold ${theme.title}`}>{district}</span>
                      <span className={`flex shrink-0 items-center gap-1.5 text-[10px] font-semibold ${theme.meta}`}>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] ${theme.chip}`}>
                          {rows.length} TP · {districtSlots}
                        </span>
                        <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
                      </span>
                    </button>
                    {open && (
                      <ul className={`border-t border-black/5 ${theme.expandedBody}`}>
                        {rows.map((v) => {
                          const picked = selectedVacancyId === v.vacancyId;
                          return (
                            <li key={v.vacancyId} className="border-b border-black/[0.04] last:border-b-0">
                              <button
                                type="button"
                                disabled={!selectedId || isAllocated}
                                onClick={() => pickVacancy(v)}
                                className={`flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition ${
                                  picked ? theme.picked : theme.row
                                } disabled:cursor-not-allowed disabled:opacity-50`}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className={`block truncate text-xs font-medium leading-snug ${theme.title}`}>
                                    {v.townPanchayat}
                                  </span>
                                </span>
                                <span className="min-w-[1.35rem] shrink-0 rounded-full bg-emerald-600 px-2 py-0.5 text-center text-[10px] font-bold tabular-nums text-white shadow-sm">
                                  {v.availableSlots}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
              {!vacanciesByDistrict.length && (
                <p className="py-6 text-center text-xs text-slate-400">{en ? 'No open vacancies.' : 'காலியிடம் இல்லை.'}</p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      <Panel
        tone="emerald"
        compact
        title={en ? 'Recent allocations' : 'சமீப ஒதுக்கீடுகள்'}
        subtitle={en ? 'Today’s counseling outcomes' : 'இன்றைய ஒதுக்கீடுகள்'}
        icon={ClipboardList}
        bodyClassName="p-0"
      >
        <div className="max-h-64 overflow-auto rounded-b-xl">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="sticky top-0 z-[1] border-b border-emerald-200/80 bg-emerald-100/90 backdrop-blur-sm">
              <tr className="text-[10px] font-bold uppercase tracking-wide text-emerald-950">
                <th className="px-3 py-2.5">{en ? 'Date & time' : 'தேதி'}</th>
                <th className="px-3 py-2.5">{en ? 'Employee ID' : 'ID'}</th>
                <th className="px-3 py-2.5">{en ? 'Name' : 'பெயர்'}</th>
                <th className="px-3 py-2.5">{en ? 'District' : 'மாவட்டம்'}</th>
                <th className="px-3 py-2.5">{en ? 'Town Panchayat' : 'பேரூ.'}</th>
                <th className="px-3 py-2.5">{en ? 'Remarks' : 'குறிப்பு'}</th>
                <th className="px-3 py-2.5">{en ? 'Status' : 'நிலை'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100/80 bg-white/70">
              {recentAllocRows.map((row) => (
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
          {!recentAllocRows.length && (
            <p className="bg-white/60 py-10 text-center text-sm text-emerald-800/50">
              {en ? 'No allocations to show.' : 'ஒதுக்கீடுகள் இல்லை.'}
            </p>
          )}
        </div>
      </Panel>

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
