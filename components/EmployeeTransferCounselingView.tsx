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
  ArrowLeftRight,
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
  if (s === 'IN_COUNSELING') return 'bg-[color-mix(in_srgb,var(--theme-accent)_12%,#ffffff)] text-slate-800 ring-[color-mix(in_srgb,var(--theme-accent)_28%,transparent)]';
  if (s === 'AVAILABLE') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (s === 'FILLED') return 'bg-slate-100 text-slate-600 ring-slate-300/80';
  if (s === 'PENDING') return 'bg-amber-50 text-amber-800 ring-amber-600/20';
  return 'bg-slate-50 text-slate-700 ring-slate-200/80';
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  accent?: string;
}) {
  return (
    <div
      className="portal-counsel-stat"
      style={accent ? { ['--stat-tone' as string]: accent } : undefined}
    >
      <span className="portal-counsel-stat-icon">
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <div className="portal-counsel-stat-copy">
        <p className="portal-counsel-stat-label">{label}</p>
        <p className="portal-counsel-stat-value">{value}</p>
      </div>
    </div>
  );
}

const AVATAR_PALETTE = [
  'text-white',
  'text-white',
  'text-white',
  'text-white',
  'text-white',
  'text-white',
];
const AVATAR_TONES = ['#1d4ed8', '#c2410c', '#0f766e', '#be185d', '#7c3aed', '#b45309'];
const COUNSEL_TONES = ['#1d4ed8', '#0f766e', '#c2410c', '#7c3aed', '#be185d', '#0369a1', '#b45309', '#4f46e5'];

function avatarListClass(index: number, selected: boolean) {
  if (selected) return 'text-white ring-2 ring-white/40';
  return `${AVATAR_PALETTE[index % AVATAR_PALETTE.length]} ring-1 ring-white/40`;
}

function counselTone(district: string, index: number) {
  let h = index;
  for (let i = 0; i < district.length; i++) h = (h * 31 + district.charCodeAt(i)) >>> 0;
  return COUNSEL_TONES[h % COUNSEL_TONES.length];
}

function VacancyTpTile({
  vacancy,
  tone,
  picked,
  disabled,
  slotsLabel,
  allottedLabel,
  onSelect,
}: {
  vacancy: VacancyRow;
  tone: string;
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
      className={`portal-counsel-tp${picked ? ' is-picked' : ''}${!hasOpenSlots ? ' is-full' : ''}`}
      style={{ ['--counsel-tone' as string]: tone }}
    >
      <p className="portal-counsel-tp-name">{vacancy.townPanchayat}</p>
      <div className="portal-counsel-tp-foot">
        <span>{hasOpenSlots ? slotsLabel : allottedLabel}</span>
        <span className="portal-counsel-tp-slots">{vacancy.availableSlots}</span>
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
    <div className="portal-studio portal-page">
      <div className="portal-fis-hero">
        <div className="relative z-[1] flex min-w-0 items-center gap-2.5">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white ring-1 ring-white/20">
            <ArrowLeftRight className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <h3 className="text-[14px] font-semibold tracking-tight text-white">
              {en ? 'Transfer counseling' : 'இடமாற்று ஆலோசனை'}
            </h3>
            <p className="text-[10px] text-white/70">
              {en
                ? 'Search an employee, pick a vacancy, and confirm the allocation.'
                : 'ஊழியரைத் தேடி, காலியிடம் தேர்ந்தெடுத்து ஒதுக்கீட்டை உறுதிசெய்க.'}
            </p>
          </div>
        </div>
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

      <div className="portal-counsel-stats">
        <StatCard label={en ? 'Total applicants' : 'மொத்த விண்ணப்பம்'} value={stats?.totalEmployees ?? '—'} icon={Users} />
        <StatCard accent="#d97706" label={en ? 'Pending' : 'நிலுவை'} value={stats?.pending ?? '—'} icon={Hourglass} />
        <StatCard accent="#059669" label={en ? 'Completed' : 'முடிந்தது'} value={stats?.completed ?? '—'} icon={CheckCheck} />
        <StatCard accent="#0f766e" label={en ? 'Vacancies available' : 'காலியிடம்'} value={stats?.remainingVacancies ?? '—'} icon={MapPin} />
        <StatCard accent="#0284c7" label={en ? 'Allocated today' : 'இன்று ஒதுக்கீடு'} value={stats?.vacanciesAllocatedToday ?? '—'} icon={Briefcase} />
      </div>

      <div
        className={`grid items-stretch gap-3 xl:grid-cols-[minmax(0,25fr)_minmax(0,75fr)] ${workspaceRowHeight}`}
      >
        <section className="portal-dashboard-panel flex h-full min-h-0 flex-col overflow-hidden">
          <div className="portal-dash-head shrink-0">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Search className="h-3 w-3" />
                </span>
                {en ? 'Search employee' : 'ஊழியர் தேடல்'}
              </h3>
              <p>
                {employeeProfileReady
                  ? en
                    ? 'Profile — pick a vacancy on the right'
                    : 'விவரம் — வலதில் காலியிடம்'
                  : searchActive
                    ? en
                      ? 'Matches update as you type'
                      : 'தட்டச்சு செய்து தேர்வு'
                    : en
                      ? 'Search by name or employee ID'
                      : 'பெயர் அல்லது ID மூலம் தேடல்'}
              </p>
            </div>
          </div>
          <div
            className={`portal-dash-body ${
              employeeProfileReady ? 'flex flex-col justify-start' : 'flex min-h-0 flex-1 flex-col'
            } min-h-0 flex-1`}
          >
          <div className="flex gap-1.5">
            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2"
                style={{ color: 'var(--theme-accent)' }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={en ? 'Type name or employee ID…' : 'பெயர் அல்லது ID…'}
                className="w-full rounded-md border bg-white py-2 pl-8 pr-2.5 text-xs shadow-sm outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => void refreshAll()}
              className="inline-flex shrink-0 items-center justify-center rounded-lg px-3 text-white shadow-sm hover:brightness-105"
              style={{ background: 'var(--theme-accent)' }}
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
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 outline-none"
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
                            ? 'shadow-md'
                            : 'border-slate-200/90 bg-white/90 hover:bg-slate-50'
                        }`}
                        style={
                          selected
                            ? {
                                borderColor: 'var(--theme-accent)',
                                background: 'color-mix(in srgb, var(--theme-accent) 10%, #ffffff)',
                                boxShadow: '0 0 0 1px color-mix(in srgb, var(--theme-accent) 30%, transparent)',
                              }
                            : undefined
                        }
                      >
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold shadow-sm ${avatarListClass(listIndex, selected)}`}
                          style={{ background: selected ? 'var(--theme-accent)' : AVATAR_TONES[listIndex % AVATAR_TONES.length] }}
                        >
                          {initials(a.employeeName)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-slate-900">{a.employeeName}</span>
                          <span className="block font-mono text-[10px] text-slate-500">{a.counselingEmployeeId}</span>
                        </span>
                        <ChevronRight
                          className={`h-4 w-4 shrink-0 ${selected ? '' : 'text-slate-300'}`}
                          style={selected ? { color: 'var(--theme-accent)' } : undefined}
                        />
                      </button>
                    </li>
                  );
                })}
                {!filteredApplicants.length && (
                  <li className="portal-wt-empty is-center">
                    {en ? 'No match for this name or ID.' : 'பொருத்தம் இல்லை.'}
                  </li>
                )}
              </ul>
            </>
          )}

          {employeeProfileReady && applicant && (
            <div className="mt-2 max-h-full shrink-0 overflow-y-auto overflow-x-hidden">
              <div className="overflow-hidden rounded-lg border bg-white shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 22%, #e8edf4)' }}>
                <div className="border-b px-3 py-2.5" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 16%, #e8edf4)', background: 'color-mix(in srgb, var(--theme-accent) 8%, #ffffff)' }}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-white shadow-sm" style={{ background: 'var(--theme-accent)' }}>
                      {initials(applicant.employeeName)}
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <h3 className="truncate text-[13px] font-semibold leading-tight text-slate-900">{applicant.employeeName}</h3>
                      <p className="mt-0.5 truncate font-mono text-[10px] font-medium" style={{ color: 'var(--theme-accent)' }}>{applicant.counselingEmployeeId}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[8px] font-bold uppercase ring-1 ring-inset ${statusStyles(applicant.counselingStatus)}`}
                    >
                      {formatDbStatus(applicant.counselingStatus)}
                    </span>
                  </div>
                  {(applicant.seniorityNo || applicant.counselingCategory) && (
                    <div className="mt-1.5 flex flex-wrap gap-1 border-t pt-1.5" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 16%, #e8edf4)' }}>
                      {applicant.seniorityNo && (
                        <span className="rounded bg-white px-1.5 py-px text-[8px] font-semibold ring-1" style={{ color: 'var(--theme-accent)', boxShadow: '0 0 0 1px color-mix(in srgb, var(--theme-accent) 22%, transparent)' }}>
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
                          tone: 'border-[color-mix(in_srgb,var(--theme-accent)_22%,#e8edf4)] bg-[color-mix(in_srgb,var(--theme-accent)_8%,#ffffff)] text-slate-800',
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
            <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 28%, #e8edf4)', background: 'color-mix(in srgb, var(--theme-accent) 6%, #ffffff)' }}>
              <Search className="mb-2 h-9 w-9" style={{ color: 'color-mix(in srgb, var(--theme-accent) 45%, transparent)' }} />
              <p className="text-sm font-semibold text-slate-700">{en ? 'Start typing to search' : 'தேடத் தொடங்குங்கள்'}</p>
              <p className="mt-1 max-w-[14rem] text-xs text-slate-500">
                {en ? 'Enter a name or employee ID — matches appear from the first letter.' : 'முதல் எழுத்திலிருந்தே பொருத்தம் காட்டப்படும்.'}
              </p>
            </div>
          )}
          </div>
        </section>

        <section className="portal-dashboard-panel flex h-full min-h-0 flex-col !overflow-visible">
          <div className="portal-dash-head shrink-0">
            <div>
              <h3>
                <span className="portal-dash-icon">
                  <Building2 className="h-3 w-3" />
                </span>
                {en ? 'Available vacancies' : 'காலியிடங்கள்'}
              </h3>
              <p>
                {employeeProfileReady
                  ? en
                    ? 'Pick a district · Town Panchayat vacancies below'
                    : 'மாவட்டம் தேர்வு · கீழே காலியிடம்'
                  : en
                    ? 'Select an employee to unlock'
                    : 'முதலில் ஊழியர் தேர்வு'}
              </p>
            </div>
          </div>
          <div className="portal-dash-body flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden">
          {!employeeProfileReady ? (
            <div className="portal-counsel-vacancy-empty">
              <Building2 className="mb-3 h-12 w-12" />
              <p className="portal-counsel-vacancy-empty-title">
                {en ? 'Vacancy map will appear here after you select an employee.' : 'ஊழியர் தேர்வுக்குப் பிறகு காலியிடம் காட்டப்படும்.'}
              </p>
              <p className="portal-counsel-vacancy-empty-copy">
                {en ? 'Use the left panel to search by ID, name, or seniority.' : 'இடதுபுறத்தில் தேடல் செய்யவும்.'}
              </p>
            </div>
          ) : (
            <div className="min-h-0 flex-1 px-0.5 py-1">
              <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {vacanciesByDistrict.map(([district, rows], districtIndex) => {
                  const districtSlots = rows.reduce((n, r) => n + (r.availableSlots || 0), 0);
                  const tone = counselTone(district, districtIndex);
                  const expanded = expandedVacancyDistrict === district;
                  const slotsLabel = en ? 'Available slots' : 'காலியிடம்';
                  const allottedLabel = en ? 'Allotted / full' : 'நிரம்பியது';
                  return (
                    <div
                      key={district}
                      className={`portal-counsel-block self-start ${expanded ? 'is-open' : ''}`}
                      style={{ ['--counsel-tone' as string]: tone }}
                    >
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setExpandedVacancyDistrict((d) => (d === district ? null : district))}
                        className="portal-counsel-block-head"
                      >
                        <ChevronDown
                          className={`portal-counsel-block-caret absolute right-3 top-3.5 h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          aria-hidden
                        />
                        <h3 className="portal-counsel-block-title">{district}</h3>
                        <div className="portal-counsel-block-meta">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span>{en ? 'Town Panchayat' : 'பேரூராட்சி'}</span>
                            <strong>{rows.length}</strong>
                          </div>
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <span>{en ? 'Open slots' : 'காலியிடம்'}</span>
                            <strong>{districtSlots}</strong>
                          </div>
                        </div>
                      </button>

                      {expanded && (
                        <div className="portal-counsel-block-body">
                          <p className="portal-counsel-block-caption">
                            {en ? 'Select Town Panchayat' : 'பேரூராட்சி தேர்வு'}
                          </p>
                          <div className={`grid auto-rows-fr items-stretch gap-2 ${vacancySubBlockGridClass(rows.length, false)}`}>
                            {rows.map((v) => (
                              <VacancyTpTile
                                key={v.vacancyId}
                                vacancy={v}
                                tone={tone}
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
                <p className="portal-counsel-vacancy-none">{en ? 'No open vacancies.' : 'காலியிடம் இல்லை.'}</p>
              )}
            </div>
          )}
          </div>
        </section>
      </div>

      <section className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>
              <span className="portal-dash-icon">
                <ClipboardList className="h-3 w-3" />
              </span>
              {en ? 'Allocation register' : 'ஒதுக்கீட்டு பதிவேடு'}
            </h3>
            <p>
              {en
                ? `All allocated records · ${allocationRecords.length} total`
                : `மொத்த ஒதுக்கீடுகள் · ${allocationRecords.length}`}
            </p>
          </div>
          <button
            type="button"
            onClick={exportAllocationsExcel}
            disabled={!allocationRecords.length}
            className="portal-dash-head-action"
          >
            <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={2.25} />
            {en ? 'Excel' : 'Excel'}
          </button>
        </div>
        <div className="portal-dash-body p-0">
        <div className="portal-dash-table max-h-80 overflow-auto">
          <table className="w-full min-w-[720px]">
            <thead>
              <tr>
                <th>{en ? 'Date & time' : 'தேதி'}</th>
                <th>{en ? 'Employee ID' : 'ID'}</th>
                <th>{en ? 'Name' : 'பெயர்'}</th>
                <th>{en ? 'District' : 'மாவட்டம்'}</th>
                <th>{en ? 'Town Panchayat' : 'பேரூ.'}</th>
                <th>{en ? 'Remarks' : 'குறிப்பு'}</th>
                <th>{en ? 'Status' : 'நிலை'}</th>
              </tr>
            </thead>
            <tbody>
              {allocationRecords.map((row) => (
                <tr
                  key={row.counselingEmployeeId + String(row.allocatedAt)}
                >
                  <td className="whitespace-nowrap">
                    {row.allocatedAt
                      ? new Date(row.allocatedAt).toLocaleString(en ? 'en-IN' : 'ta-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="font-mono text-[11px]" style={{ color: 'var(--theme-accent)' }}>{row.counselingEmployeeId}</td>
                  <td className="font-medium">{row.employeeName}</td>
                  <td>{row.allocatedDistrict || '—'}</td>
                  <td>{row.allocatedTownPanchayat || '—'}</td>
                  <td className="max-w-[200px] truncate" title={row.remarks}>
                    {row.remarks || '—'}
                  </td>
                  <td>
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
        </div>
      </section>

      {repeatPostingPrompt && (
        <div className="portal-modal-overlay is-raised">
          <div
            className="portal-modal w-full max-w-md"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="repeat-posting-title"
          >
            <div className="portal-modal-head">
              <h3 id="repeat-posting-title" className="flex items-center gap-2">
                <span className="portal-dash-icon"><AlertTriangle className="h-3.5 w-3.5" /></span>
                {en ? 'Prior posting in last 3 years' : 'கடந்த 3 ஆண்டில் பணி'}
              </h3>
            </div>
            <div className="portal-modal-body space-y-3 text-sm text-slate-700">
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
            <div className="portal-modal-foot">
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
                className="inline-flex flex-1 items-center justify-center rounded-lg bg-amber-600 py-2.5 text-sm font-bold text-white hover:bg-amber-700"
              >
                {en ? 'Continue' : 'தொடரவும்'}
              </button>
            </div>
          </div>
        </div>
      )}

      {allocateModalOpen && applicant && selectedVacancy && (
        <div className="portal-modal-overlay">
          <div
            className="portal-modal w-full max-w-lg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="allocation-modal-title"
          >
            <div className="portal-dash-head">
              <div>
                <h3 id="allocation-modal-title">
                  <span className="portal-dash-icon">
                    <Briefcase className="h-3 w-3" />
                  </span>
                  {en ? 'Confirm transfer allocation' : 'இடமாற்று ஒதுக்கீடு'}
                </h3>
              </div>
              <button type="button" onClick={closeAllocateModal} className="portal-dash-head-action">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="portal-dash-body portal-wt-form space-y-3">
              <div
                className="flex items-center gap-3 rounded-xl p-3"
                style={{ background: 'color-mix(in srgb, var(--theme-accent) 8%, #ffffff)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--theme-accent) 18%, transparent)' }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-md" style={{ background: 'var(--theme-accent)' }}>
                  {initials(applicant.employeeName)}
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--theme-accent)' }}>{en ? 'Employee' : 'ஊழியர்'}</p>
                  <p className="truncate text-sm font-semibold text-slate-900">{applicant.employeeName}</p>
                  <p className="font-mono text-[11px] text-slate-500">{applicant.counselingEmployeeId}</p>
                </div>
                <span
                  className={`ml-auto hidden shrink-0 rounded-full px-2 py-0.5 text-[8px] font-bold uppercase ring-1 ring-inset sm:inline-flex ${statusStyles(applicant.counselingStatus)}`}
                >
                  {formatDbStatus(applicant.counselingStatus)}
                </span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="portal-wt-section">
                  <p className="portal-wt-section-title">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {en ? 'District' : 'மாவட்டம்'}
                    </span>
                  </p>
                  <p className="text-xs font-semibold text-slate-900">{assignDistrict || selectedVacancy.district}</p>
                </div>
                <div className="portal-wt-section">
                  <p className="portal-wt-section-title">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {en ? 'Town Panchayat' : 'பேரூராட்சி'}
                    </span>
                  </p>
                  <p className="text-xs font-semibold leading-snug text-slate-900">
                    {assignTp || selectedVacancy.townPanchayat}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-amber-50 px-3 py-2.5 ring-1 ring-amber-200/80">
                <span className="text-xs font-semibold text-amber-900/80">{en ? 'Available slots at this TP' : 'காலியிடம்'}</span>
                <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-sm font-bold tabular-nums text-white shadow-sm">
                  {selectedVacancy.availableSlots}
                </span>
              </div>

              <div>
                <label>
                  {en ? 'Remarks / comments' : 'குறிப்புகள்'} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={remarks}
                  autoFocus
                  maxLength={500}
                  rows={4}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder={en ? 'Enter mandatory counseling remarks…' : 'கட்டாய குறிப்புகள்…'}
                />
                <span className="mt-1 block text-right text-[10px] font-medium text-slate-400">{remarks.length}/500</span>
              </div>
            </div>

            <div className="flex gap-2 border-t px-4 py-3.5" style={{ borderColor: 'color-mix(in srgb, var(--theme-accent) 14%, #eeeaf8)' }}>
              <button
                type="button"
                onClick={resetAllocationForm}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                {en ? 'Reset' : 'மீட்டமை'}
              </button>
              <button
                type="button"
                disabled={!canAllocate || loading}
                onClick={() => void performAllocate()}
                className="inline-flex flex-[1.35] items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white shadow-md disabled:opacity-50 disabled:shadow-none"
                style={{ background: 'var(--theme-accent)' }}
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
