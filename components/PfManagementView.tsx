'use client';
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useMemo, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import { motion } from 'motion/react';
import { 
  Building,
  TrendingUp, 
  Coins, 
  Download, 
  Upload, 
  Plus, 
  Trash2, 
  Users, 
  FileText, 
  Calculator, 
  AlertCircle, 
  Calendar, 
  Printer, 
  FileSpreadsheet, 
  PiggyBank, 
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Edit2,
  Paperclip,
  Loader2,
  RefreshCw,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  FileDown
} from 'lucide-react';
import { Language, translations } from './translations';
import { OFFICIAL_PF_INTEREST_RATES } from '@/lib/pfInterestRatesData';
import PfRatesTab from './pf/PfRatesTab';
import PfSetupTab from './pf/PfSetupTab';
import PfWithdrawalsTab from './pf/PfWithdrawalsTab';
import PfSubscriptionsTab from './pf/PfSubscriptionsTab';
import PfReportsTab from './pf/PfReportsTab';
import { 
  InterestRate, 
  PfEmployee, 
  PfSubscription, 
  OfficePfSetup,
  formatDateLabel,
  formatMonthLabel,
  downloadElementAsPDF
} from './pf/PfUtils';

interface PfManagementViewProps {
  state: any;
  lang: Language;
  currentUser?: any;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
  theme?: string;
}

export default function PfManagementView({ state, lang, currentUser, onSaveCollection, theme }: PfManagementViewProps) {
  const shouldHideRates = currentUser?.roleId === 'ad' || currentUser?.roleId === 'eo' || currentUser?.roleId === 'zonal';

  // Tabs: rates, setup, withdrawals, subscriptions, reports, interest_received
  const [activeSubTab, setActiveSubTab] = useState<'rates' | 'setup' | 'withdrawals' | 'subscriptions' | 'reports' | 'interest_received'>(
    currentUser?.roleId === 'zonal' ? 'reports' : (currentUser?.roleId === 'ad' || currentUser?.roleId === 'eo') ? 'setup' : 'rates'
  );

  // Selector states for HOD/Zonal logins
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedTpId, setSelectedTpId] = useState<string>('');

  // Lock and sync activeSubTab for Zonal users
  useEffect(() => {
    if (currentUser?.roleId === 'zonal' && activeSubTab !== 'reports') {
      setActiveSubTab('reports');
    }
  }, [currentUser, activeSubTab]);

  useEffect(() => {
    if (shouldHideRates && activeSubTab === 'rates' && currentUser?.roleId !== 'zonal') {
      const timer = setTimeout(() => {
        setActiveSubTab('setup');
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [shouldHideRates, activeSubTab, currentUser]);

  // List of selectable Zones
  const selectableZones = useMemo(() => {
    if (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'zonal' || currentUser?.roleId === 'ad') {
      return (state?.zones || []).filter((z: any) => z.id === currentUser.scopeId);
    }
    return state?.zones || [];
  }, [state?.zones, currentUser]);

  // Handle initialization and sync of dropdowns
  useEffect(() => {
    if (selectableZones.length > 0 && !selectedZoneId) {
      // Initialize Zone
      const initZoneId = selectableZones[0]?.id || '';
      setSelectedZoneId(initZoneId);
      
      // Initialize District
      const dists = (state?.districts || []).filter((d: any) => d.zoneId === initZoneId);
      const initDistId = dists[0]?.id || '';
      setSelectedDistrictId(initDistId);

      // Initialize Town Panchayat
      const tps = (state?.townPanchayats || []).filter((tp: any) => tp.districtId === initDistId);
      const initTpId = tps[0]?.id || '';
      setSelectedTpId(initTpId);
    }
  }, [selectableZones, state?.districts, state?.townPanchayats, selectedZoneId]);

  // Handler for Zone change
  const handleZoneChange = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    const dists = (state?.districts || []).filter((d: any) => d.zoneId === zoneId);
    const nextDistId = dists[0]?.id || '';
    setSelectedDistrictId(nextDistId);

    const tps = (state?.townPanchayats || []).filter((tp: any) => tp.districtId === nextDistId);
    const nextTpId = tps[0]?.id || '';
    setSelectedTpId(nextTpId);
  };

  // Handler for District change
  const handleDistrictChange = (distId: string) => {
    setSelectedDistrictId(distId);
    const tps = (state?.townPanchayats || []).filter((tp: any) => tp.districtId === distId);
    const nextTpId = tps[0]?.id || '';
    setSelectedTpId(nextTpId);
  };


  const {
    employees = [],
    pfInterestRates = [],
    pfEmployees = [],
    pfSubscriptions = [],
    officePfSetup = [],
    pfChallans = [],
    townPanchayats = [],
    pfInterestReleases = []
  } = state || {};

  // Find office setup singleton
  const currentOfficeSetup = officePfSetup?.[0] || null;

  // ----------------------------------------
  // Form states - Interest Rates
  // ----------------------------------------
  const [rateFinancialYear, setRateFinancialYear] = useState<string>('');
  const [rateAuthority, setRateAuthority] = useState<string>('');
  const [rateCpsAuthority, setRateCpsAuthority] = useState<string>('');
  const [rateInput, setRateInput] = useState<string>('');
  const [rateToDate, setRateToDate] = useState<string>('');
  const [rateAttachmentName, setRateAttachmentName] = useState<string>('');
  const [rateAttachmentUrl, setRateAttachmentUrl] = useState<string>('');
  const [rateError, setRateError] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [rateSearchQuery, setRateSearchQuery] = useState<string>('');
  const [rateYearFilter, setRateYearFilter] = useState<string>('all');

  // Auto-sync rates if current list is legacy/truncated (< 80 entries)
  useEffect(() => {
    if (pfInterestRates && pfInterestRates.length < 80 && pfInterestRates.length > 0) {
      onSaveCollection('pfInterestRates', OFFICIAL_PF_INTEREST_RATES);
    }
  }, [pfInterestRates?.length]);

  // Editing Interest Rate states
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editFinancialYear, setEditFinancialYear] = useState<string>('');
  const [editFromDate, setEditFromDate] = useState<string>('');
  const [editToDate, setEditToDate] = useState<string>('');
  const [editRateVal, setEditRateVal] = useState<string>('');
  const [editAuthority, setEditAuthority] = useState<string>('');
  const [editCpsAuthority, setEditCpsAuthority] = useState<string>('');
  const [editAttachmentName, setEditAttachmentName] = useState<string>('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState<string>('');

  // ----------------------------------------
  // Form states - Office Setup & Breakups (Requirement 2)
  // ----------------------------------------
  const [officeOpeningDate, setOfficeOpeningDate] = useState<string>(() => currentOfficeSetup?.openingDate || '2023-04-01');
  const [officeOpeningBalance, setOfficeOpeningBalance] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.officeOpeningBalance || '') : '');
  const [retiredEmployeeAmount, setRetiredEmployeeAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.retiredEmployeeAmount || '0') : '0');
  const [deathEmployeeAmount, setDeathEmployeeAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.deathEmployeeAmount || '0') : '0');
  const [otherIneligibleAmount, setOtherIneligibleAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.otherIneligibleAmount || '0') : '0');
  
  // Breakup list builder
  const [breakupEmpId, setBreakupEmpId] = useState<string>('');
  const [breakupAmount, setBreakupAmount] = useState<string>('');
  const [officeBreakups, setOfficeBreakups] = useState<{ employeeId: string; amount: number }[]>(() => currentOfficeSetup?.breakups || []);
  
  const [setupError, setSetupError] = useState<string>('');
  const [setupSuccess, setSetupSuccess] = useState<string>('');

  // Render-phase sync for office setup prop updates
  const [prevOfficeSetup, setPrevOfficeSetup] = useState<any>(currentOfficeSetup);
  if (currentOfficeSetup !== prevOfficeSetup) {
    setPrevOfficeSetup(currentOfficeSetup);
    if (currentOfficeSetup) {
      setOfficeOpeningDate(currentOfficeSetup.openingDate || '2023-04-01');
      setOfficeOpeningBalance(String(currentOfficeSetup.officeOpeningBalance || ''));
      setRetiredEmployeeAmount(String(currentOfficeSetup.retiredEmployeeAmount || '0'));
      setDeathEmployeeAmount(String(currentOfficeSetup.deathEmployeeAmount || '0'));
      setOtherIneligibleAmount(String(currentOfficeSetup.otherIneligibleAmount || '0'));
      setOfficeBreakups(currentOfficeSetup.breakups || []);
    }
  }

  // Actual office eligible balance calculation
  const actualEligibleAmount = useMemo(() => {
    const ob = parseFloat(officeOpeningBalance) || 0;
    const retired = parseFloat(retiredEmployeeAmount) || 0;
    const death = parseFloat(deathEmployeeAmount) || 0;
    const other = parseFloat(otherIneligibleAmount) || 0;
    return Math.max(0, ob - retired - death - other);
  }, [officeOpeningBalance, retiredEmployeeAmount, deathEmployeeAmount, otherIneligibleAmount]);

  const totalBreakupAmount = useMemo(() => {
    return officeBreakups.reduce((sum, b) => sum + b.amount, 0);
  }, [officeBreakups]);

  const isBreakupTallied = useMemo(() => {
    return Math.abs(totalBreakupAmount - actualEligibleAmount) < 0.1 && actualEligibleAmount > 0;
  }, [totalBreakupAmount, actualEligibleAmount]);

  // ----------------------------------------
  // Withdrawal & Settlement Form states (Requirement 3)
  // ----------------------------------------
  const [empMgmtTab, setEmpMgmtTab] = useState<'withdrawal' | 'settlement' | 'interest_allocation'>('withdrawal');
  const [withdrawEmpId, setWithdrawEmpId] = useState<string>('');
  const [withdrawDate, setWithdrawDate] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [withdrawError, setWithdrawError] = useState<string>('');
  const [withdrawSuccess, setWithdrawSuccess] = useState<string>('');

  // Settlement Form states
  const [settleEmpId, setSettleEmpId] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>('');
  const [settleType, setSettleType] = useState<string>('Retirement');
  const [settleReason, setSettleReason] = useState<string>('');
  const [settleOrderNo, setSettleOrderNo] = useState<string>('');
  const [settleOrderDate, setSettleOrderDate] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleError, setSettleError] = useState<string>('');
  const [settleSuccess, setSettleSuccess] = useState<string>('');

  // ----------------------------------------
  // Subscription Wizard states (Requirement 4)
  // ----------------------------------------
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [challanNo, setChallanNo] = useState<string>('');
  const [challanDate, setChallanDate] = useState<string>('');
  const [challanAmount, setChallanAmount] = useState<string>('');
  const [challanAttachmentName, setChallanAttachmentName] = useState<string>('');
  const [challanAttachmentUrl, setChallanAttachmentUrl] = useState<string>('');
  const [challanIsUploading, setChallanIsUploading] = useState<boolean>(false);
  const [challanUploadError, setChallanUploadError] = useState<string>('');

  const [challanFromMonth, setChallanFromMonth] = useState<string>('');
  const [challanToMonth, setChallanToMonth] = useState<string>('');
  const [challanBreakups, setChallanBreakups] = useState<Record<string, { subscriptionAmount: number; pfLoanRecoveryAmount: number }>>({});
  const [selectedBreakupEmployeeIds, setSelectedBreakupEmployeeIds] = useState<string[]>([]);
  const [challanError, setChallanError] = useState<string>('');
  const [challanSuccess, setChallanSuccess] = useState<string>('');

  // Reports view states
  const [reportEmpId, setReportEmpId] = useState<string>(currentUser?.isEmployee ? currentUser?.employeeId || '' : 'all');
  const [reportFy, setReportFy] = useState<string>('2025-2026');
  const [reportsSubTab, setReportsSubTab] = useState<'employee_wise' | 'abstract' | 'account_slip'>(
    currentUser?.isEmployee ? 'account_slip' : 'employee_wise'
  );
  const [interestReportEmpId, setInterestReportEmpId] = useState<string>(currentUser?.isEmployee ? currentUser?.employeeId || '' : '');
  const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
  const [reportFilterTp, setReportFilterTp] = useState<string>('all');
  const [reportFilterDistrict, setReportFilterDistrict] = useState<string>('all');
  const [abstractYear, setAbstractYear] = useState<string>('2024-2025');
  const [interestReportFy, setInterestReportFy] = useState<string>('all');
  const [expandedFy, setExpandedFy] = useState<string | null>(null);
  const [expandedAbstractYrs, setExpandedAbstractYrs] = useState<Record<string, boolean>>({});

  // Interest Received Form States
  const [irGoNo, setIrGoNo] = useState('');
  const [irReleaseDate, setIrReleaseDate] = useState('2025-04-01');
  const [irTotalAmount, setIrTotalAmount] = useState('');
  const [irTownPanchayatId, setIrTownPanchayatId] = useState('all');
  const [irDistributions, setIrDistributions] = useState<Record<string, number>>({});
  const [irUptoMonth, setIrUptoMonth] = useState('');
  const [irSuccess, setIrSuccess] = useState('');
  const [irError, setIrError] = useState('');
  const [irSelectedEmpToAdd, setIrSelectedEmpToAdd] = useState('');
  const [irManualMode, setIrManualMode] = useState(false);
  const [irManualEmpId, setIrManualEmpId] = useState('');
  const [irManualName, setIrManualName] = useState('');
  const [irManualDesignation, setIrManualDesignation] = useState('');
  const [irManualTpId, setIrManualTpId] = useState('');
  const [reportFilterEmpId, setReportFilterEmpId] = useState<string>('all');
  const [expandedAccountSlipYears, setExpandedAccountSlipYears] = useState<string[]>([]);

  // Allowed Town Panchayats according to role-based scope access
  const allowedTownPanchayats = useMemo(() => {
    const isDtpAdmin = currentUser?.scopeType === 'HOD' || currentUser?.roleId === 'admin' || currentUser?.roleId === 'ad';
    const isZonalUser = currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'zonal';

    if (isDtpAdmin || isZonalUser) {
      if (selectedTpId) {
        return townPanchayats.filter((tp: any) => tp.id === selectedTpId);
      }
      if (isZonalUser) {
        const zoneDistricts = (state?.districts || []).filter((d: any) => d.zoneId === currentUser.scopeId).map((d: any) => d.id);
        return townPanchayats.filter((tp: any) => zoneDistricts.includes(tp.districtId));
      }
      return townPanchayats;
    } else { // TownPanchayat or EO
      return townPanchayats.filter((tp: any) => tp.id === currentUser.scopeId);
    }
  }, [townPanchayats, state?.districts, currentUser, selectedTpId]);

  // Active selected town panchayat for reports & interest release (auto-select if single town panchayat scope)
  const activeReportFilterTp = allowedTownPanchayats.length === 1 ? allowedTownPanchayats[0].id : reportFilterTp;
  const activeIrTownPanchayatId = allowedTownPanchayats.length === 1 ? allowedTownPanchayats[0].id : irTownPanchayatId;

  // Allowed Town Panchayat IDs
  const allowedTpIds = useMemo(() => allowedTownPanchayats.map((tp: any) => tp.id), [allowedTownPanchayats]);

  // Filter Employees based on user ownership & role scope - show all employees in user's allowed Town Panchayats
  const filteredEmployeesList = useMemo(() => {
    if (currentUser?.isEmployee) {
      return employees.filter((emp: any) => emp.employeeId === currentUser.employeeId);
    }
    // Show all employees belonging to the Town Panchayats that the current user has access to
    return employees.filter((emp: any) => allowedTpIds.includes(emp.townPanchayatId));
  }, [employees, currentUser, allowedTpIds]);

  // Filter Active Employees matching scope
  const activeEmployees = useMemo(() => {
    return filteredEmployeesList.filter((e: any) => e.status === 'Active' || !e.status);
  }, [filteredEmployeesList]);

  // Helper translations lookup
  const t = (key: string) => {
    return translations[lang][key as keyof typeof translations['en']] || key;
  };

  const getEmpName = (empId: string) => {
    const emp = employees.find((e: any) => e.employeeId === empId || e.id === empId);
    if (!emp) return empId;
    return lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn;
  };

  const getEmpDesignation = (emp: any) => {
    if (!emp) return '';
    if (emp.designation) return emp.designation;
    // Safely retrieve postId from posts
    const pst = (state?.posts || []).find((p: any) => p.id === emp.postId);
    if (pst) {
      return lang === 'ta' ? (pst.nameTa || pst.nameEn) : pst.nameEn;
    }
    return emp.postId || '';
  };

  const getTpName = (tpId: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    return tp ? (lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)) : tpId;
  };

  const getTpJurisdictionDetails = (tpId?: string) => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    const district = (state?.districts || []).find((d: any) => d.id === tp?.districtId);
    const zone = (state?.zones || []).find((z: any) => z.id === district?.zoneId);

    const tpName = tp ? (lang === 'ta' ? (tp.nameTa || tp.nameEn) : (tp.nameEn || tp.nameTa)) : (tpId || 'Thiruporur');
    const districtName = district ? (lang === 'ta' ? (district.nameTa || district.nameEn) : (district.nameEn || district.nameTa)) : 'Chengalpattu';
    const zoneName = zone ? (lang === 'ta' ? (zone.nameTa || zone.nameEn) : (zone.nameEn || zone.nameTa)) : 'Kanchipuram';

    return { 
      tpName, 
      districtName, 
      zoneName, 
      fullHeader: `${tpName} Town Panchayat | ${districtName} District | ${zoneName} Zone` 
    };
  };

  // Safe auto calculated starting from date for interest rates
  const calculatedNextFromDate = useMemo(() => {
    if (!pfInterestRates || pfInterestRates.length === 0) {
      return '1970-04-01';
    }
    const sortedRates = [...pfInterestRates].sort((a: InterestRate, b: InterestRate) => {
      return new Date(a.toDate).getTime() - new Date(b.toDate).getTime();
    });
    const lastRate = sortedRates[sortedRates.length - 1];
    const lastDate = new Date(lastRate.toDate);
    lastDate.setDate(lastDate.getDate() + 1);
    return lastDate.toISOString().split('T')[0];
  }, [pfInterestRates]);

  const filteredRates = useMemo(() => {
    if (!pfInterestRates) return [];
    let list = [...pfInterestRates].sort((a: InterestRate, b: InterestRate) => {
      return (b.sNo || 0) - (a.sNo || 0) || new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime();
    });

    if (rateYearFilter !== 'all') {
      if (rateYearFilter === '1970-1990') {
        list = list.filter(r => {
          const y = parseInt(r.fromDate.split('-')[0], 10);
          return y >= 1970 && y <= 1990;
        });
      } else if (rateYearFilter === '1991-2010') {
        list = list.filter(r => {
          const y = parseInt(r.fromDate.split('-')[0], 10);
          return y >= 1991 && y <= 2010;
        });
      } else if (rateYearFilter === '2011-2020') {
        list = list.filter(r => {
          const y = parseInt(r.fromDate.split('-')[0], 10);
          return y >= 2011 && y <= 2020;
        });
      } else if (rateYearFilter === '2021-2026') {
        list = list.filter(r => {
          const y = parseInt(r.fromDate.split('-')[0], 10);
          return y >= 2021;
        });
      }
    }

    if (rateSearchQuery.trim()) {
      const q = rateSearchQuery.trim().toLowerCase();
      list = list.filter(r => 
        (r.financialYear && r.financialYear.toLowerCase().includes(q)) ||
        (r.authority && r.authority.toLowerCase().includes(q)) ||
        (r.cpsAuthority && r.cpsAuthority.toLowerCase().includes(q)) ||
        r.fromDate.includes(q) ||
        r.toDate.includes(q) ||
        String(r.rate).includes(q) ||
        String(r.sNo).includes(q)
      );
    }

    return list;
  }, [pfInterestRates, rateYearFilter, rateSearchQuery]);

  // Auto-suggest subscription start month of last challan salary month or from opening balance date month (Requirement 4)
  const lastChallanMonthSuggested = useMemo(() => {
    if (pfSubscriptions && pfSubscriptions.length > 0) {
      const validSubs = pfSubscriptions.filter((s: any) => s && typeof s.yearMonth === 'string' && s.yearMonth.includes('-'));
      if (validSubs.length > 0) {
        const sorted = [...validSubs].sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
        const lastMonth = sorted[0].yearMonth;
        if (lastMonth) {
          const parts = lastMonth.split('-');
          const yr = parseInt(parts[0], 10);
          const mo = parseInt(parts[1], 10);
          if (!isNaN(yr) && !isNaN(mo)) {
            let nextMo = mo + 1;
            let nextYr = yr;
            if (nextMo > 12) {
              nextMo = 1;
              nextYr++;
            }
            return `${nextYr}-${String(nextMo).padStart(2, '0')}`;
          }
        }
      }
    }
    // Fallback to Office Opening Date Month
    return typeof officeOpeningDate === 'string' && officeOpeningDate.length >= 7 
      ? officeOpeningDate.substring(0, 7) 
      : '2023-04';
  }, [pfSubscriptions, officeOpeningDate]);

  // Render-phase sync for challanFromMonth default value
  const [prevLastChallanMonthSuggested, setPrevLastChallanMonthSuggested] = useState<string>('');
  if (lastChallanMonthSuggested !== prevLastChallanMonthSuggested) {
    setPrevLastChallanMonthSuggested(lastChallanMonthSuggested);
    if (!challanFromMonth) {
      setChallanFromMonth(lastChallanMonthSuggested);
    }
  }

  // Generate dynamic selected months list based on "From" and "To" Month inputs
  const selectedMonthsList = useMemo(() => {
    if (!challanFromMonth || typeof challanFromMonth !== 'string' || !challanFromMonth.includes('-')) return [];
    if (!challanToMonth || typeof challanToMonth !== 'string' || !challanToMonth.includes('-') || challanToMonth === challanFromMonth) {
      return [challanFromMonth];
    }

    const months: string[] = [];
    let [fromYr, fromMo] = challanFromMonth.split('-').map(Number);
    let [toYr, toMo] = challanToMonth.split('-').map(Number);

    if (isNaN(fromYr) || isNaN(fromMo) || isNaN(toYr) || isNaN(toMo)) {
      return [challanFromMonth];
    }

    let currYr = fromYr;
    let currMo = fromMo;

    // Boundary cap just in case to avoid infinite loops
    let iterations = 0;
    while ((currYr < toYr || (currYr === toYr && currMo <= toMo)) && iterations < 120) {
      months.push(`${currYr}-${String(currMo).padStart(2, '0')}`);
      currMo++;
      if (currMo > 12) {
        currMo = 1;
        currYr++;
      }
      iterations++;
    }
    return months;
  }, [challanFromMonth, challanToMonth]);

  // Total breakups sum inside Step 3 of Subscriptions Entry
  const totalChallanBreakupSum = useMemo(() => {
    return selectedBreakupEmployeeIds.reduce((sum: number, empId: string) => {
      const b = challanBreakups[empId];
      const sub = parseFloat(String(b?.subscriptionAmount || 0)) || 0;
      const rec = parseFloat(String(b?.pfLoanRecoveryAmount || 0)) || 0;
      return sum + sub + rec;
    }, 0);
  }, [challanBreakups, selectedBreakupEmployeeIds]);

  const isChallanTotalTallied = useMemo(() => {
    const targetAmt = parseFloat(challanAmount) || 0;
    return Math.abs(totalChallanBreakupSum - targetAmt) < 0.1 && targetAmt > 0;
  }, [totalChallanBreakupSum, challanAmount]);

  // ----------------------------------------
  // File Upload Handlers (Requirements 1 & 4)
  // ----------------------------------------
  const handleFileUpload = async (file: File, destination: string) => {
    if (!file) return;

    // File limit verification: Max 2MB
    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      const sizeErr = lang === 'ta' 
        ? 'கோப்பு அளவு 2MB க்கு குறைவாக இருக்க வேண்டும்.' 
        : 'File size must be strictly within 2MB.';
      if (destination === 'rate' || destination === 'edit-rate') setRateError(sizeErr);
      else setChallanUploadError(sizeErr);
      return;
    }

    // Format validation: pdf or jpg/jpeg
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      const formatErr = lang === 'ta'
        ? 'PDF அல்லது JPG/PNG வடிவ கோப்புகள் மட்டுமே அனுமதிக்கப்படும்.'
        : 'Only PDF or JPG/PNG image formats are supported.';
      if (destination === 'rate' || destination === 'edit-rate') setRateError(formatErr);
      else setChallanUploadError(formatErr);
      return;
    }

    if (destination === 'rate' || destination === 'edit-rate') {
      setIsUploading(true);
      setRateError('');
    } else {
      setChallanIsUploading(true);
      setChallanUploadError('');
    }

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('employeeId', currentUser?.employeeId || 'admin');
      formData.append('officeCategoryType', currentUser?.officeCategoryType || 'TP');
      formData.append('townPanchayatId', currentUser?.townPanchayatId || 'tp1');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const resJson = await res.json();
      
      if (resJson.success) {
        if (destination === 'rate') {
          setRateAttachmentName(resJson.fileName);
          setRateAttachmentUrl(resJson.url);
        } else if (destination === 'edit-rate') {
          setEditAttachmentName(resJson.fileName);
          setEditAttachmentUrl(resJson.url);
        } else {
          setChallanAttachmentName(resJson.fileName);
          setChallanAttachmentUrl(resJson.url);
        }
      } else {
        throw new Error(resJson.message || 'Server error during upload');
      }
    } catch (err: any) {
      console.error('File upload error:', err);
      const uploadErr = lang === 'ta' 
        ? 'கோப்பு பதிவேற்றத்தில் தோல்வி. மீண்டும் முயற்சிக்கவும்.' 
        : 'File upload failed. Please try again.';
      if (destination === 'rate' || destination === 'edit-rate') setRateError(uploadErr);
      else setChallanUploadError(uploadErr);
    } finally {
      setIsUploading(false);
      setChallanIsUploading(false);
    }
  };

  // ----------------------------------------
  // Action Handlers - Interest Rates (Requirement 1)
  // ----------------------------------------
  const handleAddInterestRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError('');

    const rate = parseFloat(rateInput);
    if (isNaN(rate) || rate <= 0 || rate > 30) {
      setRateError(lang === 'ta' ? 'முறையான வட்டி விகிதத்தை உள்ளிடவும் (0-30)' : 'Please enter a valid interest rate (0-30)');
      return;
    }

    if (!rateToDate) {
      setRateError(lang === 'ta' ? 'முடிவு தேதியைத் தேர்ந்தெடுக்கவும்' : 'Please select To Date');
      return;
    }

    if (new Date(rateToDate) < new Date(calculatedNextFromDate)) {
      setRateError(lang === 'ta' ? `முடிவு தேதி ${calculatedNextFromDate}க்கு பின் இருக்க வேண்டும்` : `To Date must be after ${calculatedNextFromDate}`);
      return;
    }

    const nextSNo = (pfInterestRates.length > 0 
      ? Math.max(...pfInterestRates.map((r: InterestRate) => r.sNo || 0)) + 1 
      : 1);

    const newRate: InterestRate = {
      id: `ir_${Date.now()}`,
      sNo: nextSNo,
      financialYear: rateFinancialYear || undefined,
      fromDate: calculatedNextFromDate,
      toDate: rateToDate,
      rate,
      authority: rateAuthority || undefined,
      cpsAuthority: rateCpsAuthority || undefined,
      attachmentName: rateAttachmentName || undefined,
      attachmentUrl: rateAttachmentUrl || undefined
    };

    const updatedRates = [...pfInterestRates, newRate];
    await onSaveCollection('pfInterestRates', updatedRates);
    setRateFinancialYear('');
    setRateAuthority('');
    setRateCpsAuthority('');
    setRateInput('');
    setRateToDate('');
    setRateAttachmentName('');
    setRateAttachmentUrl('');
  };

  const handleStartEditRate = (rate: InterestRate) => {
    setEditingRateId(rate.id);
    setEditFinancialYear(rate.financialYear || '');
    setEditFromDate(rate.fromDate);
    setEditToDate(rate.toDate);
    setEditRateVal(String(rate.rate));
    setEditAuthority(rate.authority || '');
    setEditCpsAuthority(rate.cpsAuthority || '');
    setEditAttachmentName(rate.attachmentName || '');
    setEditAttachmentUrl(rate.attachmentUrl || '');
  };

  const handleUpdateInterestRate = async (e: React.FormEvent) => {
    e.preventDefault();
    setRateError('');

    const rate = parseFloat(editRateVal);
    if (isNaN(rate) || rate <= 0 || rate > 30) {
      setRateError(lang === 'ta' ? 'முறையான வட்டி விகிதத்தை உள்ளிடவும் (0-30)' : 'Please enter a valid interest rate (0-30)');
      return;
    }

    if (!editToDate) {
      setRateError(lang === 'ta' ? 'முடிவு தேதியைத் தேர்ந்தெடுக்கவும்' : 'Please select To Date');
      return;
    }

    const updatedRates = pfInterestRates.map((r: InterestRate) => {
      if (r.id === editingRateId) {
        return {
          ...r,
          financialYear: editFinancialYear || undefined,
          fromDate: editFromDate,
          toDate: editToDate,
          rate,
          authority: editAuthority || undefined,
          cpsAuthority: editCpsAuthority || undefined,
          attachmentName: editAttachmentName || undefined,
          attachmentUrl: editAttachmentUrl || undefined
        };
      }
      return r;
    });

    await onSaveCollection('pfInterestRates', updatedRates);
    setEditingRateId(null);
    setEditFinancialYear('');
    setEditRateVal('');
    setEditToDate('');
    setEditFromDate('');
    setEditAuthority('');
    setEditCpsAuthority('');
    setEditAttachmentName('');
    setEditAttachmentUrl('');
  };

  const handleDeleteRate = async (id: string) => {
    const updatedRates = pfInterestRates.filter((r: InterestRate) => r.id !== id);
    await onSaveCollection('pfInterestRates', updatedRates);
  };

  const handleLoadOfficialRates = async () => {
    if (window.confirm(lang === 'ta' ? 'அரசாணைப்படி அதிகாரப்பூர்வ வட்டி விகிதங்களை (1970-71 முதல் 86 பதிவுகள்) புதுப்பிக்கவா?' : 'Reset to official Tamil Nadu Government GPF & CPS Interest Rates (86 periods from FY 1970-71 to 2026-27)?')) {
      await onSaveCollection('pfInterestRates', OFFICIAL_PF_INTEREST_RATES);
    }
  };

  const handleExportRatesExcel = () => {
    const dataToExport = filteredRates.length > 0 ? filteredRates : pfInterestRates;
    const rows = dataToExport.map((r: InterestRate, idx: number) => ({
      'S.No': r.sNo || idx + 1,
      'Financial Year / Period': r.financialYear || '',
      'From Date': r.fromDate,
      'To Date': r.toDate,
      'Rate of Interest (%)': r.rate,
      'Authority (G.O.) Finance Dept': r.authority || '',
      'Authority (G.O.) CPS': r.cpsAuthority || ''
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'GPF_CPS_Rates');
    XLSX.writeFile(wb, `TN_Govt_GPF_CPS_Interest_Rates_1970_to_2026.xlsx`);
  };

  const handleExportRatesPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(13);
    doc.text('Tamil Nadu Government Employees - GPF & CPS Rates of Interest (1970-71 onwards)', 14, 15);
    doc.setFontSize(9);
    doc.text(`Total Period Records: ${pfInterestRates.length} | Generated: ${new Date().toLocaleDateString()}`, 14, 21);

    const dataToExport = filteredRates.length > 0 ? filteredRates : pfInterestRates;
    const tableData = dataToExport.map((r: InterestRate, idx: number) => [
      r.sNo || idx + 1,
      r.financialYear || '-',
      formatDateLabel(r.fromDate),
      formatDateLabel(r.toDate),
      `${r.rate.toFixed(2)} %`,
      r.authority || '-',
      r.cpsAuthority || '-'
    ]);

    autoTable(doc, {
      head: [['S.No', 'Financial Year / Period', 'From Date', 'To Date', 'Rate (%)', 'Authority G.O. (Finance Dept)', 'Authority G.O. (CPS)']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`TN_Govt_GPF_CPS_Interest_Rates_1970_to_2026.pdf`);
  };

  // ----------------------------------------
  // Action Handlers - Office Setup & Breakups (Requirement 2)
  // ----------------------------------------
  const handleAddOfficeBreakup = (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');
    setSetupSuccess('');

    if (!breakupEmpId) {
      setSetupError(lang === 'ta' ? 'breakupக்கு ஒரு ஊழியரைத் தேர்ந்தெடுக்கவும்' : 'Please select an employee for breakup');
      return;
    }

    const amt = parseFloat(breakupAmount);
    if (isNaN(amt) || amt <= 0) {
      setSetupError(lang === 'ta' ? 'முறையான தொகையை உள்ளிடவும்' : 'Please enter a valid breakup amount');
      return;
    }

    // Check duplicates
    if (officeBreakups.some(b => b.employeeId === breakupEmpId)) {
      setSetupError(lang === 'ta' ? 'இந்த ஊழியர் ஏற்கனவே breakup பட்டியலில் உள்ளார்' : 'This employee already has a breakup entry');
      return;
    }

    setOfficeBreakups([...officeBreakups, { employeeId: breakupEmpId, amount: amt }]);
    setBreakupEmpId('');
    setBreakupAmount('');
  };

  const handleRemoveBreakup = (empId: string) => {
    setOfficeBreakups(officeBreakups.filter(b => b.employeeId !== empId));
  };

  const handleSaveOfficeSetup = async () => {
    setSetupError('');
    setSetupSuccess('');

    const ob = parseFloat(officeOpeningBalance);
    if (isNaN(ob) || ob < 0) {
      setSetupError(lang === 'ta' ? 'முறையான ஆரம்ப இருப்பை உள்ளிடவும்' : 'Please enter a valid office opening balance');
      return;
    }

    if (!isBreakupTallied) {
      setSetupError(lang === 'ta' ? 'breakup தொகையின் கூடுதல், கணக்கிடப்பட்ட தகுதியான தொகையுடன் சரியாகப் பொருந்த வேண்டும்!' : 'Total breakup must exactly tally with calculated Actual Eligible Amount!');
      return;
    }

    const setupObj: OfficePfSetup = {
      id: 'office_setup_central',
      openingDate: officeOpeningDate,
      officeOpeningBalance: ob,
      retiredEmployeeAmount: parseFloat(retiredEmployeeAmount) || 0,
      deathEmployeeAmount: parseFloat(deathEmployeeAmount) || 0,
      otherIneligibleAmount: parseFloat(otherIneligibleAmount) || 0,
      actualEligibleAmount,
      breakups: officeBreakups
    };

    // Save office central configuration
    await onSaveCollection('officePfSetup', [setupObj]);

    // Save individual employee opening balances in pfEmployees
    // Preserve existing withdrawals if any
    const updatedPfEmployees = pfEmployees.map((pe: any) => {
      const b = officeBreakups.find(item => item.employeeId === pe.employeeId);
      if (b) {
        return {
          ...pe,
          openingBalance: b.amount,
          openingDate: officeOpeningDate
        };
      }
      return pe;
    });

    const existingEmpIds = pfEmployees.map((pe: any) => pe.employeeId);
    const newPfEmployees = officeBreakups
      .filter(b => !existingEmpIds.includes(b.employeeId))
      .map(b => ({
        id: `pfe_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        employeeId: b.employeeId,
        openingBalance: b.amount,
        openingDate: officeOpeningDate,
        withdrawals: []
      }));

    const finalPfEmployees = [...updatedPfEmployees, ...newPfEmployees];
    await onSaveCollection('pfEmployees', finalPfEmployees);

    setSetupSuccess(lang === 'ta' 
      ? 'அலுவலக ஆரம்ப இருப்பு மற்றும் ஊழியர்களின் விபரங்கள் வெற்றிகரமாக சேமிக்கப்பட்டன!' 
      : 'Office central opening balance & employee breakup setup successfully saved!');
  };

  // ----------------------------------------
  // Action Handlers - Withdrawals (Requirement 3: New tab)
  // ----------------------------------------
  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    if (!withdrawEmpId) {
      setWithdrawError(lang === 'ta' ? 'ஊழியரைத் தேர்ந்தெடுக்கவும்' : 'Please select an employee');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError(lang === 'ta' ? 'முறையான தொகையை உள்ளிடவும்' : 'Please enter a valid withdrawal amount');
      return;
    }

    if (!withdrawDate) {
      setWithdrawError(lang === 'ta' ? 'தேதியைத் தேர்ந்தெடுக்கவும்' : 'Please select withdrawal date');
      return;
    }

    const employeeSetup = pfEmployees.find((e: PfEmployee) => e.employeeId === withdrawEmpId);
    if (!employeeSetup) {
      setWithdrawError(lang === 'ta' ? 'முதலில் இந்த ஊழியருக்கு ஆரம்ப இருப்பு setup செய்திருக்க வேண்டும்' : 'Employee has no opening balance setup. Configure office balance setup first.');
      return;
    }

    if (new Date(withdrawDate) < new Date(employeeSetup.openingDate)) {
      setWithdrawError(lang === 'ta' ? 'எடுத்த தேதி ஆரம்ப தேதிக்கு முன் இருக்கக் கூடாது' : 'Withdrawal date cannot be before the opening date');
      return;
    }

    const newWithdrawal = {
      id: `wd_${Date.now()}`,
      date: withdrawDate,
      amount,
      reason: withdrawReason || 'General withdrawal'
    };

    const updatedSetup = pfEmployees.map((emp: PfEmployee) => {
      if (emp.employeeId === withdrawEmpId) {
        return {
          ...emp,
          withdrawals: [...(emp.withdrawals || []), newWithdrawal]
        };
      }
      return emp;
    });

    await onSaveCollection('pfEmployees', updatedSetup);
    setWithdrawAmount('');
    setWithdrawDate('');
    setWithdrawReason('');
    setWithdrawSuccess(lang === 'ta' ? 'பணம் எடுத்த விவரம் வெற்றிகரமாகச் சேர்க்கப்பட்டது!' : 'Withdrawal recorded successfully!');
  };

  const handleDeleteWithdrawal = async (empId: string, wdId: string) => {
    const updatedSetup = pfEmployees.map((emp: PfEmployee) => {
      if (emp.employeeId === empId) {
        return {
          ...emp,
          withdrawals: (emp.withdrawals || []).filter(w => w.id !== wdId)
        };
      }
      return emp;
    });
    await onSaveCollection('pfEmployees', updatedSetup);
  };

  const handleSaveSettlement = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettleError('');
    setSettleSuccess('');

    if (!settleEmpId) {
      setSettleError(lang === 'ta' ? 'ஊழியரைத் தேர்ந்தெடுக்கவும்' : 'Please select an employee');
      return;
    }

    if (!settleDate) {
      setSettleError(lang === 'ta' ? 'தேதியைத் தேர்ந்தெடுக்கவும்' : 'Please select settlement date');
      return;
    }

    const employeeSetup = pfEmployees.find((e: PfEmployee) => e.employeeId === settleEmpId);
    if (!employeeSetup) {
      setSettleError(lang === 'ta' ? 'ஊழியருக்கு ஆரம்ப இருப்பு setup இல்லை' : 'Employee has no opening balance setup.');
      return;
    }

    const calculated = pfAuditTrail[settleEmpId];
    const finalCalculatedAmt = calculated ? calculated.currentBalance : 0;

    const amount = parseFloat(settleAmount) || finalCalculatedAmt;

    const settlement = {
      settlementDate: settleDate,
      settlementType: settleType,
      settlementReason: settleReason || 'Superannuation',
      finalAmount: amount,
      orderNo: settleOrderNo || 'N/A',
      orderDate: settleOrderDate || settleDate
    };

    const updatedSetup = pfEmployees.map((emp: PfEmployee) => {
      if (emp.employeeId === settleEmpId) {
        return {
          ...emp,
          settlement
        };
      }
      return emp;
    });

    await onSaveCollection('pfEmployees', updatedSetup);
    setSettleEmpId('');
    setSettleDate('');
    setSettleReason('');
    setSettleOrderNo('');
    setSettleOrderDate('');
    setSettleAmount('');
    setSettleSuccess(lang === 'ta' ? 'இறுதி தீர்வு வெற்றிகரமாக பதியப்பட்டது!' : 'Final settlement recorded successfully!');
  };

  const handleDeleteSettlement = async (empId: string) => {
    const updatedSetup = pfEmployees.map((emp: PfEmployee) => {
      if (emp.employeeId === empId) {
        const { settlement, ...rest } = emp;
        return rest;
      }
      return emp;
    });
    await onSaveCollection('pfEmployees', updatedSetup);
  };

  // ----------------------------------------
  // Action Handlers - Subscriptions Entry Wizard (Requirement 4)
  // ----------------------------------------
  const handleNextStep1 = () => {
    setChallanError('');
    if (!challanNo || !challanDate || !challanAmount || !challanAttachmentUrl) {
      setChallanError(lang === 'ta' ? 'தயவுசெய்து அனைத்து சலான் விவரங்களையும் பூர்த்தி செய்து கோப்பை பதிவேற்றவும்' : 'Please fill all challan details and upload the attachment file.');
      return;
    }
    setWizardStep(2);
  };

  const handleNextStep2 = () => {
    setChallanError('');
    if (!challanFromMonth) {
      setChallanError(lang === 'ta' ? 'தயவுசெய்து சம்பளக் குறைப்பு காலத்தைத் தேர்ந்தெடுக்கவும்' : 'Please select the salary deduction month period.');
      return;
    }
    
    // Auto-select employees that already have non-zero inputs, otherwise default to empty so they select
    const existing = Object.keys(challanBreakups).filter(empId => {
      const b = challanBreakups[empId];
      return (b?.subscriptionAmount || 0) > 0 || (b?.pfLoanRecoveryAmount || 0) > 0;
    });
    setSelectedBreakupEmployeeIds(existing);
    setWizardStep(3);
  };

  const handleBreakupChange = (empId: string, field: 'subscriptionAmount' | 'pfLoanRecoveryAmount', val: string) => {
    const num = parseFloat(val) || 0;
    setChallanBreakups(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: num
      }
    }));
  };

  const handleSaveChallanAndSubscriptions = async () => {
    setChallanError('');
    setChallanSuccess('');

    if (!isChallanTotalTallied) {
      setChallanError(lang === 'ta' ? 'அனைத்து ஊழியர்களின் கூடுதல் சலான் தொகையுடன் பொருந்தவில்லை' : 'The grand total of all employees must equal the Challan Amount.');
      return;
    }

    const chAmount = parseFloat(challanAmount) || 0;
    const newChallanObj = {
      id: `challan_${Date.now()}`,
      challanNo,
      challanDate,
      challanAmount: chAmount,
      attachmentName: challanAttachmentName,
      attachmentUrl: challanAttachmentUrl,
      fromMonth: challanFromMonth,
      toMonth: challanToMonth || challanFromMonth,
      months: selectedMonthsList,
      breakups: selectedBreakupEmployeeIds.map((empId: string) => {
        const b = challanBreakups[empId];
        return {
          employeeId: empId,
          subscriptionAmount: b?.subscriptionAmount || 0,
          pfLoanRecoveryAmount: b?.pfLoanRecoveryAmount || 0,
          total: (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0)
        };
      }).filter((b: any) => b.total > 0)
    };

    // Generate individual monthly subscription records in pfSubscriptions for EACH month selected (Requirement 4)
    // Updated: Create exactly ONE subscription record whose yearMonth is the challan date's month
    const chDate = new Date(challanDate);
    const challanMonth = `${chDate.getFullYear()}-${String(chDate.getMonth() + 1).padStart(2, '0')}`;

    const newSubscriptions: PfSubscription[] = [];
    newChallanObj.breakups.forEach(item => {
      newSubscriptions.push({
        id: `pfs_${Date.now()}_${item.employeeId}`,
        employeeId: item.employeeId,
        yearMonth: challanMonth,
        amount: item.total, // Sum represents the overall monthly balance increment in the challan's month
        subscriptionAmount: item.subscriptionAmount,
        loanRecovery: item.pfLoanRecoveryAmount,
        challanId: newChallanObj.id,
        challanNo: challanNo
      });
    });

    // Save both collections to DB
    const updatedChallans = [...pfChallans, newChallanObj];
    const updatedSubscriptions = [...pfSubscriptions, ...newSubscriptions];

    await onSaveCollection('pfChallans', updatedChallans);
    await onSaveCollection('pfSubscriptions', updatedSubscriptions);

    // Reset Wizard
    setChallanNo('');
    setChallanDate('');
    setChallanAmount('');
    setChallanAttachmentName('');
    setChallanAttachmentUrl('');
    setChallanFromMonth('');
    setChallanToMonth('');
    setChallanBreakups({});
    setSelectedBreakupEmployeeIds([]);
    setWizardStep(1);
    setChallanSuccess(lang === 'ta' 
      ? 'சலான் மற்றும் மாதாந்திர சந்தாக்கள் வெற்றிகரமாக கணினியில் பதிவேற்றப்பட்டன!' 
      : 'Challan and employee-wise subscription entries successfully saved.');
  };

  // ----------------------------------------
  // Dynamic Audit Trail Calculator (Compounded interest accruals with 3 Method variations)
  // ----------------------------------------
  const pfAuditTrail = useMemo(() => {
    const trailMap: Record<string, any> = {};

    employees.forEach((emp: any) => {
      const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === emp.employeeId);
      if (!pfSetup) return;

      const empSubs = pfSubscriptions.filter((s: PfSubscription) => s.employeeId === emp.employeeId);
      const empWds = pfSetup.withdrawals || [];

      // Determine calculation method for this employee's Town Panchayat
      const empTpId = emp.townPanchayatId || (currentUser?.scopeType === 'TownPanchayat' || currentUser?.scopeType === 'TP' ? currentUser.scopeId : null) || state?.townPanchayats?.[0]?.id;
      const empTp = (state?.townPanchayats || []).find((t: any) => t.id === empTpId);
      const calculationMethod: 'method1' | 'method2' | 'method3' = 
        empTp?.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[empTpId] || 'method1';

      // Sort chronological operations starting from openingDate
      const startDate = new Date(pfSetup.openingDate);
      const currentDate = new Date('2026-09-02'); // Current timeline ceiling context
      
      let balance = pfSetup.openingBalance;
      let interestAccruedCurrentFY = 0;
      let totalInterestCredited = 0;

      const monthlyHistory: any[] = [];
      let iterDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

      while (iterDate < endDate) {
        const yr = iterDate.getFullYear();
        const mo = String(iterDate.getMonth() + 1).padStart(2, '0');
        const keyYrMo = `${yr}-${mo}`;

        // Get monthly subscriptions whose effective payment month is keyYrMo (deferred interest if paid late)
        const monthlySubsList = empSubs.filter((s: any) => {
          const challan = pfChallans.find((c: any) => c.id === s.challanId);
          let effectiveMonth = s.yearMonth;
          if (challan && challan.challanDate) {
            const chDate = new Date(challan.challanDate);
            const paidMonth = `${chDate.getFullYear()}-${String(chDate.getMonth() + 1).padStart(2, '0')}`;
            if (paidMonth > s.yearMonth) {
              effectiveMonth = paidMonth;
            }
          }
          return effectiveMonth === keyYrMo;
        });

        const subAmt = monthlySubsList.reduce((sum: number, s: any) => sum + s.amount, 0);
        const subOnlyAmt = monthlySubsList.reduce((sum: number, s: any) => sum + (s.subscriptionAmount || s.amount || 0), 0);
        const loanRecAmt = monthlySubsList.reduce((sum: number, s: any) => sum + (s.loanRecovery || 0), 0);

        // Get unique deducted salary months for all subscriptions in this month
        const salaryMonthsList = monthlySubsList.map((s: any) => {
          const challan = pfChallans.find((c: any) => c.id === s.challanId);
          if (challan) {
            if (challan.fromMonth && challan.toMonth && challan.fromMonth !== challan.toMonth) {
              return `${formatMonthLabel(challan.fromMonth, lang)} - ${formatMonthLabel(challan.toMonth, lang)}`;
            } else if (challan.fromMonth) {
              return formatMonthLabel(challan.fromMonth, lang);
            }
          }
          return '';
        }).filter(Boolean);

        const salaryMonthRemarks = Array.from(new Set(salaryMonthsList)).join(', ');

        // Find distributed government interest releases posted in this month (keyYrMo)
        const irAmt = pfInterestReleases.reduce((sum: number, r: any) => {
          const targetYrMo = r.interestReceivedUptoMonth || (r.releaseDate ? `${new Date(r.releaseDate).getFullYear()}-${String(new Date(r.releaseDate).getMonth() + 1).padStart(2, '0')}` : '');
          
          if (targetYrMo === keyYrMo) {
            const dist = r.distributions?.find((d: any) => d.employeeId === emp.employeeId);
            if (dist) {
              return sum + (dist.amount || 0);
            }
          }
          return sum;
        }, 0);

        // Get withdrawals in this month
        const monthlyWds = empWds.filter((w: any) => {
          const wDate = new Date(w.date);
          return wDate.getFullYear() === yr && String(wDate.getMonth() + 1).padStart(2, '0') === mo;
        });
        const wdAmt = monthlyWds.reduce((sum: number, w: any) => sum + w.amount, 0);

        // Find active interest rate
        const dateMidMonth = new Date(yr, iterDate.getMonth(), 15);
        const rateObj = pfInterestRates.find((r: InterestRate) => {
          return dateMidMonth >= new Date(r.fromDate) && dateMidMonth <= new Date(r.toDate);
        });
        const currentRate = rateObj ? rateObj.rate : 7.1; // Fallback to 7.1%

        const openingMonthly = balance;
        const closingMonthly = openingMonthly + subAmt - wdAmt + irAmt;

        // Check if employee is settled in this month
        let isSettledThisMonth = false;
        let settlementObj = null;
        if (pfSetup.settlement) {
          const sDate = new Date(pfSetup.settlement.settlementDate);
          if (sDate.getFullYear() === yr && sDate.getMonth() === iterDate.getMonth()) {
            isSettledThisMonth = true;
            settlementObj = pfSetup.settlement;
          }
        }

        // Retirement rule:
        // In Method 1 & 2: interest stops after employee retirement date.
        // In Method 3: interest continues even for retired employees till final settlement!
        const isRetired = emp.retirementDate && new Date(emp.retirementDate) < iterDate;
        const shouldAccrueMonthlyInterest = calculationMethod === 'method3' || !isRetired;
        const monthlyInterest = shouldAccrueMonthlyInterest ? (closingMonthly * (currentRate / 100)) / 12 : 0;
        interestAccruedCurrentFY += monthlyInterest;

        monthlyHistory.push({
          yearMonth: keyYrMo,
          opening: openingMonthly,
          subscription: subAmt,
          subscriptionAmount: subOnlyAmt,
          loanRecovery: loanRecAmt,
          withdrawal: wdAmt,
          interestRelease: irAmt,
          closing: closingMonthly,
          rate: currentRate,
          interestEarned: monthlyInterest,
          deductedSalaryMonths: salaryMonthRemarks || '--',
          calculationMethod,
          isRetired
        });

        balance = closingMonthly;

        if (isSettledThisMonth && settlementObj) {
          // Add the accrued interest for current FY up to settlement month
          const finalSettleAmount = balance + interestAccruedCurrentFY;
          
          monthlyHistory.push({
            yearMonth: settlementObj.settlementDate,
            type: 'FINAL_SETTLEMENT',
            description: `Final Settlement (${settlementObj.settlementType}) - Order No: ${settlementObj.orderNo}`,
            opening: balance,
            subscription: 0,
            withdrawal: finalSettleAmount,
            closing: 0,
            rate: currentRate,
            interestEarned: interestAccruedCurrentFY,
            settlementDetails: settlementObj,
            calculationMethod
          });
          
          balance = 0;
          totalInterestCredited += interestAccruedCurrentFY;
          interestAccruedCurrentFY = 0;
          
          // Break out of the monthly loop as the account is closed!
          break;
        }

        // If March end, calculate accrued interest and apply compounding if Method 2 or Method 3
        if (iterDate.getMonth() === 2) { 
          totalInterestCredited += interestAccruedCurrentFY;

          if (calculationMethod === 'method2' || calculationMethod === 'method3') {
            // Annual Cumulative Compounding: interest is added to balance for the next year opening!
            balance += interestAccruedCurrentFY;
          }

          monthlyHistory.push({
            yearMonth: `${yr}-03-CREDIT`,
            type: 'INTEREST_CREDIT',
            description: calculationMethod === 'method1'
              ? `Accrued Interest for FY ${yr-1}-${yr} (Method 1: Non-compounding)`
              : calculationMethod === 'method2'
              ? `Accrued Interest for FY ${yr-1}-${yr} (Method 2: Annual Cumulative Compounded)`
              : `Accrued Interest for FY ${yr-1}-${yr} (Method 3: Full Ineligible + Cumulative + Post-Retire)`,
            amount: interestAccruedCurrentFY,
            newBalance: balance
          });

          interestAccruedCurrentFY = 0; // Reset
        }

        iterDate.setMonth(iterDate.getMonth() + 1);
      }

      trailMap[emp.employeeId] = {
        openingBalance: pfSetup.openingBalance,
        openingDate: pfSetup.openingDate,
        currentBalance: balance + interestAccruedCurrentFY,
        interestAccrued: interestAccruedCurrentFY,
        totalInterestCredited,
        calculationMethod,
        monthlyHistory
      };
    });

    return trailMap;
  }, [employees, pfEmployees, pfSubscriptions, pfInterestRates, pfInterestReleases, pfChallans, state?.townPanchayats, state?.settings?.pfCalculationMethods, currentUser]);

  const getAccumulatedInterestUptoMonth = (employeeId: string, uptoMonth: string) => {
    if (!uptoMonth) return 0;
    const trail = pfAuditTrail[employeeId];
    if (!trail || !trail.monthlyHistory) return 0;
    
    // Sum up all interest earned in months up to specified month
    const total = trail.monthlyHistory.reduce((sum: number, row: any) => {
      if (row.interestEarned && row.yearMonth && row.yearMonth <= uptoMonth) {
        return sum + row.interestEarned;
      }
      return sum;
    }, 0);
    
    return Math.round(total);
  };

  const handleAutoFillInterestDistributions = (month: string, tpId: string) => {
    if (!month) {
      setIrDistributions({});
      setIrTotalAmount('');
      return;
    }
    const candidates = employees.filter((emp: any) => {
      const hasSetup = pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId);
      if (!hasSetup) return false;
      if (tpId === 'all') return true;
      return emp.townPanchayatId === tpId;
    });

    const dists: Record<string, number> = {};
    let totalSum = 0;
    candidates.forEach((emp: any) => {
      const accumulated = getAccumulatedInterestUptoMonth(emp.employeeId, month);
      dists[emp.employeeId] = accumulated;
      totalSum += accumulated;
    });

    setIrDistributions(dists);
    setIrTotalAmount(totalSum > 0 ? totalSum.toString() : '');
  };

  const getEmployeeBalancesForFy = (employeeId: string, fy: string) => {
    const trail = pfAuditTrail[employeeId];
    if (!trail) {
      return { 
        openingBalance: 0, 
        subscriptionsPaid: 0, 
        withdrawals: 0, 
        interestCredited: 0, 
        calculatedInterest: 0,
        totalAccumulatedInterest: 0,
        closingBalance: 0, 
        closingBalanceWithAccruedInterest: 0,
        latestMonth: '',
        isCompletedMarch: false
      };
    }

    const history = trail.monthlyHistory || [];

    // If 'all', return cumulative up to date
    if (fy === 'all') {
      const subsSum = pfSubscriptions
        .filter((s: any) => s.employeeId === employeeId)
        .reduce((sum: number, s: any) => sum + s.amount, 0);
      const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === employeeId);
      const wdsSum = (pfSetup?.withdrawals || []).reduce((sum: number, w: any) => sum + w.amount, 0);
      
      const totalIntEarned = history.reduce((sum: number, h: any) => sum + (h.interestEarned || 0), 0);
      const totalIntReceived = history.reduce((sum: number, h: any) => sum + (h.interestRelease || 0), 0);
      const lastRow = history[history.length - 1];

      const calculationMethod = trail.calculationMethod || pfSetup?.settlement?.settlementType || (pfSetup as any)?.interestMethod || 'method1';

      let closingBalance = trail.openingBalance + subsSum - wdsSum + totalIntReceived;
      let closingBalanceWithAccruedInterest = trail.currentBalance;

      if (calculationMethod === 'method1') {
        closingBalance = trail.openingBalance + subsSum - wdsSum + totalIntReceived + totalIntEarned;
        closingBalanceWithAccruedInterest = trail.openingBalance + subsSum - wdsSum + totalIntReceived + totalIntEarned;
      } else if (calculationMethod === 'method2' || calculationMethod === 'method3') {
        closingBalance = trail.currentBalance;
        closingBalanceWithAccruedInterest = trail.currentBalance;
      }

      return {
        openingBalance: trail.openingBalance,
        subscriptionsPaid: subsSum,
        withdrawals: wdsSum,
        interestCredited: totalIntReceived,
        calculatedInterest: totalIntEarned,
        totalAccumulatedInterest: totalIntEarned,
        closingBalance: closingBalance,
        closingBalanceWithAccruedInterest: closingBalanceWithAccruedInterest,
        latestMonth: lastRow?.yearMonth || '',
        isCompletedMarch: lastRow ? lastRow.yearMonth.endsWith('-03') || lastRow.yearMonth.includes('-03-CREDIT') : false
      };
    }

    const [startYearStr, endYearStr] = fy.split('-');
    const startYear = parseInt(startYearStr, 10);
    const endYear = parseInt(endYearStr, 10);

    let opening = trail.openingBalance;
    let subsSum = 0;
    let wdsSum = 0;
    let interestReceived = 0;
    let calculatedInterest = 0;
    let accumulatedInterestUpToFy = 0;
    let closing = trail.openingBalance;
    let latestMonth = '';
    let isCompletedMarch = false;

    let hasFoundFyStart = false;

    history.forEach((h: any) => {
      const parts = h.yearMonth.split('-');
      const itemYear = parseInt(parts[0], 10);
      const itemMonth = parseInt(parts[1], 10);

      const isBeforeFy = (itemYear < startYear) || (itemYear === startYear && itemMonth < 4);
      const isInFy = (itemYear === startYear && itemMonth >= 4) || (itemYear === endYear && itemMonth <= 3);

      if (isBeforeFy) {
        if (h.type === 'INTEREST_CREDIT') {
          opening = h.newBalance;
        } else if (h.closing !== undefined) {
          opening = h.closing;
        }
        if (h.interestEarned) {
          accumulatedInterestUpToFy += h.interestEarned;
        }
      }

      if (isInFy) {
        if (h.type === 'INTEREST_CREDIT') {
          isCompletedMarch = true;
        } else if (h.type === 'FINAL_SETTLEMENT') {
          // Handled in monthly settlement
        } else {
          if (!hasFoundFyStart) {
            hasFoundFyStart = true;
            opening = h.opening;
          }
          subsSum += h.subscription || 0;
          wdsSum += h.withdrawal || 0;
          interestReceived += (h.interestRelease || 0);
          calculatedInterest += (h.interestEarned || 0);
          accumulatedInterestUpToFy += (h.interestEarned || 0);
          closing = h.closing;
          latestMonth = h.yearMonth;
          if (itemYear === endYear && itemMonth === 3) {
            isCompletedMarch = true;
          }
        }
      }
    });

    if (!hasFoundFyStart) {
      closing = opening;
    }

    const interestCredited = interestReceived;
    const finalClosing = opening + subsSum - wdsSum + interestCredited;
    const closingWithAccrued = finalClosing + (interestCredited === 0 ? calculatedInterest : 0);

    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === employeeId);
    const calculationMethod = trail.calculationMethod || pfSetup?.settlement?.settlementType || (pfSetup as any)?.interestMethod || 'method1';

    let closingBalance = finalClosing;
    let closingBalanceWithAccruedInterest = closingWithAccrued;
    if (calculationMethod === 'method1') {
      closingBalance = finalClosing + accumulatedInterestUpToFy;
      closingBalanceWithAccruedInterest = finalClosing + accumulatedInterestUpToFy;
    } else if (calculationMethod === 'method2' || calculationMethod === 'method3') {
      // Method 2: Add that FY interest to that year's opening balance + net transactions to arrive at the cumulative closing balance.
      // This cumulative closing balance becomes the subsequent financial year's opening balance.
      closingBalance = finalClosing + calculatedInterest;
      closingBalanceWithAccruedInterest = finalClosing + calculatedInterest;
    }

    return {
      openingBalance: opening,
      subscriptionsPaid: subsSum,
      withdrawals: wdsSum,
      interestCredited: interestCredited,
      calculatedInterest: calculatedInterest,
      totalAccumulatedInterest: accumulatedInterestUpToFy,
      closingBalance: closingBalance,
      closingBalanceWithAccruedInterest: closingBalanceWithAccruedInterest,
      latestMonth: latestMonth,
      isCompletedMarch: isCompletedMarch
    };
  };

  const getYearWiseSummary = (employeeId: string) => {
    const trail = pfAuditTrail[employeeId];
    if (!trail) return [];

    const history = trail.monthlyHistory || [];
    const yearsSet = new Set<string>();
    history.forEach((h: any) => {
      const parts = h.yearMonth.split('-');
      const yearVal = parseInt(parts[0], 10);
      const monthVal = parseInt(parts[1], 10);
      if (!isNaN(yearVal) && !isNaN(monthVal)) {
        let fy = '';
        if (monthVal >= 4) {
          fy = `${yearVal}-${yearVal + 1}`;
        } else {
          fy = `${yearVal - 1}-${yearVal}`;
        }
        yearsSet.add(fy);
      }
    });

    const yearsSorted = Array.from(yearsSet).sort();
    let runningAccumulatedInterest = 0;
    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === employeeId);
    const calculationMethod = trail.calculationMethod || pfSetup?.settlement?.settlementType || (pfSetup as any)?.interestMethod || 'method1';

    return yearsSorted.map((fy) => {
      const balances = getEmployeeBalancesForFy(employeeId, fy);
      runningAccumulatedInterest += balances.calculatedInterest;

      let closingBalance = balances.closingBalance;
      let closingBalanceWithAccruedInterest = balances.closingBalanceWithAccruedInterest;

      if (calculationMethod === 'method1') {
        // Method 1: Closing balance is Principal Balance (Opening + Subscriptions - Withdrawals + Interest Credited) + Total Accumulated Interest!
        // But next year opening remains strictly Principal Balance without Total Acc. Interest!
        const principalClosing = balances.openingBalance + balances.subscriptionsPaid - balances.withdrawals + balances.interestCredited;
        closingBalance = principalClosing + runningAccumulatedInterest;
        closingBalanceWithAccruedInterest = principalClosing + runningAccumulatedInterest;
      } else if (calculationMethod === 'method2' || calculationMethod === 'method3') {
        closingBalance = balances.closingBalance;
        closingBalanceWithAccruedInterest = balances.closingBalanceWithAccruedInterest;
      }
      
      const [startYStr, endYStr] = fy.split('-');
      const startY = parseInt(startYStr, 10);
      const endY = parseInt(endYStr, 10);
      
      const fyHistory = history.filter((h: any) => {
        const parts = h.yearMonth.split('-');
        const yrVal = parseInt(parts[0], 10);
        const moVal = parseInt(parts[1], 10);
        
        if (parts[2] === 'CREDIT') {
          return yrVal === endY && moVal === 3;
        }
        
        const isInFy = (yrVal === startY && moVal >= 4) || (yrVal === endY && moVal <= 3);
        return isInFy;
      });

      return {
        fy,
        ...balances,
        closingBalance,
        closingBalanceWithAccruedInterest,
        totalAccumulatedInterest: runningAccumulatedInterest,
        months: fyHistory
      };
    });
  };

  const getEmployeeSlipYears = (empId: string) => {
    if (!empId) {
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      let endFyYear = (currentMonth <= 3) ? (currentYear - 1) : currentYear;
      const defaultList: string[] = [];
      for (let y = 2018; y <= endFyYear; y++) {
        defaultList.push(`${y}-${y + 1}`);
      }
      return defaultList.reverse();
    }
    
    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === empId);
    const opDate = pfSetup?.openingDate || currentOfficeSetup?.openingDate || '2023-04-01';
    
    const parts = opDate.split('-');
    const startYear = parseInt(parts[0], 10);
    const startMonth = parseInt(parts[1], 10);
    let startFyYear = (startMonth <= 3) ? (startYear - 1) : startYear;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    let endFyYear = (currentMonth <= 3) ? (currentYear - 1) : currentYear;

    if (endFyYear < startFyYear) {
      endFyYear = startFyYear;
    }

    const list: string[] = [];
    for (let y = startFyYear; y <= endFyYear; y++) {
      list.push(`${y}-${y + 1}`);
    }
    return list.reverse();
  };

  const getAbstractYearsList = () => {
    const opDate = currentOfficeSetup?.openingDate || '2023-04-01';
    const parts = opDate.split('-');
    const startYear = parseInt(parts[0], 10);
    const startMonth = parseInt(parts[1], 10);
    let startFyYear = (startMonth <= 3) ? (startYear - 1) : startYear;

    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    let endFyYear = (currentMonth <= 3) ? (currentYear - 1) : currentYear;

    if (endFyYear < startFyYear) {
      endFyYear = startFyYear;
    }

    const list: string[] = [];
    for (let y = startFyYear; y <= endFyYear; y++) {
      list.push(`${y}-${y + 1}`);
    }
    return list;
  };

  const handlePrintSlip = () => {
    window.print();
  };

  // 3. Account Slip Exporters
  const handleDownloadAccountSlipPDF = async (empId: string, fy: string, printOnly: boolean = false) => {
    // When Tamil language is active, use high-resolution canvas capture to ensure 100% native Tamil font rendering
    if (lang === 'ta') {
      const elem = document.getElementById('pf-account-slip');
      if (elem) {
        if (fy === 'all') {
          const allYears = getEmployeeSlipYears(empId);
          setExpandedAccountSlipYears(allYears);
          await new Promise(r => setTimeout(r, 200));
        }
        const success = await downloadElementAsPDF('pf-account-slip', `PF-Account-Slip-${empId}-${fy}.pdf`, false);
        if (success) return;
      }
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    
    const emp = filteredEmployeesList.find((e: any) => e.employeeId === empId || e.id === empId);
    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === empId);
    const isSettled = pfSetup?.settlement;
    const jurisdiction = getTpJurisdictionDetails(emp?.townPanchayatId);

    const empSlipYears = getEmployeeSlipYears(empId);
    const yearsToPrint = fy === 'all' ? [...empSlipYears].reverse() : [fy];
    const allYearSummaries = getYearWiseSummary(empId);

    // ==========================================
    // PAGE 1: ABSTRACT OF TOTAL YEAR-WISE DATA
    // ==========================================
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('GOVERNMENT OF TAMIL NADU', 105, 12, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TOWN PANCHAYATS DEPARTMENT', 105, 17, { align: 'center' });
    
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // indigo
    doc.text(`${jurisdiction.tpName} Town Panchayat | ${jurisdiction.districtName} District | ${jurisdiction.zoneName} Zone`, 105, 23, { align: 'center' });
    
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text('PROVIDENT FUND CONSOLIDATED ACCOUNT ABSTRACT (YEAR-WISE)', 105, 28, { align: 'center' });
    
    // Subscriber Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, 32, 182, 28, 'FD');
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`Subscriber Name:`, 18, 38);
    doc.text(`Employee ID:`, 18, 44);
    doc.text(`Post / Designation:`, 18, 50);
    doc.text(`Town Panchayat:`, 18, 56);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`${emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A'}`, 55, 38);
    doc.text(`${empId}`, 55, 44);
    doc.text(`${getEmpDesignation(emp) || 'N/A'}`, 55, 50);
    doc.text(`${jurisdiction.tpName}`, 55, 56);

    doc.setFont('helvetica', 'bold');
    doc.text(`Account Status:`, 122, 38);
    doc.text(`Opening Date:`, 122, 44);
    doc.text(`Total Recorded FYs:`, 122, 50);
    doc.text(`District / Zone:`, 122, 56);
    
    doc.setFont('helvetica', 'normal');
    doc.text(isSettled ? `Settled (${pfSetup.settlement.settlementType})` : `Active`, 155, 38);
    doc.text(`${pfSetup?.openingDate || 'N/A'}`, 155, 44);
    doc.text(`${allYearSummaries.length} Financial Years`, 155, 50);
    doc.text(`${jurisdiction.districtName} / ${jurisdiction.zoneName}`, 155, 56);

    // Consolidated Year-Wise Abstract Table
    const abstractTableHeaders = [[
      'Financial Year', 
      'Opening Bal (Rs.)', 
      'Subscriptions (+)', 
      'Withdrawals (-)', 
      'Interest Credited (+)', 
      'Calculated Int (FY)', 
      'Total Acc. Int (Rs.)', 
      'Closing Bal (CB)'
    ]];

    const abstractTableRows = allYearSummaries.map((yrData) => [
      yrData.fy,
      Math.round(yrData.openingBalance).toLocaleString('en-IN'),
      Math.round(yrData.subscriptionsPaid).toLocaleString('en-IN'),
      Math.round(yrData.withdrawals).toLocaleString('en-IN'),
      yrData.interestCredited > 0 ? Math.round(yrData.interestCredited).toLocaleString('en-IN') : '0',
      Math.round(yrData.calculatedInterest).toLocaleString('en-IN'),
      Math.round(yrData.totalAccumulatedInterest).toLocaleString('en-IN'),
      Math.round(yrData.isCompletedMarch ? yrData.closingBalance : yrData.closingBalanceWithAccruedInterest).toLocaleString('en-IN')
    ]);

    const grandSub = allYearSummaries.reduce((sum, item) => sum + item.subscriptionsPaid, 0);
    const grandWd = allYearSummaries.reduce((sum, item) => sum + item.withdrawals, 0);
    const grandIntCredited = allYearSummaries.reduce((sum, item) => sum + item.interestCredited, 0);
    const grandCalcInt = allYearSummaries.reduce((sum, item) => sum + item.calculatedInterest, 0);
    const latestAccInt = allYearSummaries.length > 0 ? allYearSummaries[allYearSummaries.length - 1].totalAccumulatedInterest : 0;
    const finalCB = allYearSummaries.length > 0 
      ? (allYearSummaries[allYearSummaries.length - 1].isCompletedMarch 
          ? allYearSummaries[allYearSummaries.length - 1].closingBalance 
          : allYearSummaries[allYearSummaries.length - 1].closingBalanceWithAccruedInterest)
      : 0;

    autoTable(doc, {
      head: abstractTableHeaders,
      body: abstractTableRows,
      foot: [[
        'TOTAL / SUMMARY',
        '--',
        Math.round(grandSub).toLocaleString('en-IN'),
        Math.round(grandWd).toLocaleString('en-IN'),
        Math.round(grandIntCredited).toLocaleString('en-IN'),
        Math.round(grandCalcInt).toLocaleString('en-IN'),
        Math.round(latestAccInt).toLocaleString('en-IN'),
        '--'
      ]],
      startY: 64,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        7: { fontStyle: 'bold' }
      }
    });

    // ==========================================
    // SUBSEQUENT PAGES: INDIVIDUAL FINANCIAL YEARS
    // ==========================================
    yearsToPrint.forEach((currentFy) => {
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('GOVERNMENT OF TAMIL NADU', 105, 12, { align: 'center' });
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('TOWN PANCHAYATS DEPARTMENT', 105, 17, { align: 'center' });
      
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.text(`${jurisdiction.tpName} Town Panchayat | ${jurisdiction.districtName} District | ${jurisdiction.zoneName} Zone`, 105, 23, { align: 'center' });
      
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text(`PROVIDENT FUND ACCOUNT LEDGER SLIP`, 105, 28, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(`FINANCIAL YEAR: ${currentFy}`, 105, 33, { align: 'center' });
      
      // Subscriber Info Box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 247, 250);
      doc.rect(14, 37, 182, 28, 'FD');
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(`Subscriber Name:`, 18, 43);
      doc.text(`Employee ID:`, 18, 49);
      doc.text(`Post:`, 18, 55);
      doc.text(`Town Panchayat:`, 18, 61);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A'}`, 55, 43);
      doc.text(`${empId}`, 55, 49);
      doc.text(`${getEmpDesignation(emp) || 'N/A'}`, 55, 55);
      doc.text(`${jurisdiction.tpName}`, 55, 61);

      const fyBalances = getEmployeeBalancesForFy(empId, currentFy);

      doc.setFont('helvetica', 'bold');
      doc.text(`Account Status:`, 122, 43);
      doc.text(`Opening Balance:`, 122, 49);
      doc.text(`District / Zone:`, 122, 55);
      
      doc.setFont('helvetica', 'normal');
      doc.text(isSettled ? `Settled (${pfSetup.settlement.settlementType})` : `Active`, 155, 43);
      doc.text(`Rs. ${Math.round(fyBalances.openingBalance).toLocaleString('en-IN')}`, 155, 49);
      doc.text(`${jurisdiction.districtName} / ${jurisdiction.zoneName}`, 155, 55);

      const tableHeaders = [['Month', 'Opening (Rs.)', 'Subscription (Rs.)', 'Deducted Salary Month', 'Withdrawal (Rs.)', 'Closing (Rs.)', 'Rate', 'Int. Earned']];
      
      const trail = pfAuditTrail[empId];
      const monthlyHistory = trail ? trail.monthlyHistory : [];
      const [startYrStr, endYrStr] = currentFy.split('-');
      const startYr = parseInt(startYrStr, 10);
      const endYr = parseInt(endYrStr, 10);

      const fyMonthlyRows = monthlyHistory.filter((row: any) => {
        if (row.type === 'INTEREST_CREDIT') return false;
        const [yrStr, moStr] = row.yearMonth.split('-');
        const yr = parseInt(yrStr, 10);
        const mo = parseInt(moStr, 10);
        return (yr === startYr && mo >= 4) || (yr === endYr && mo <= 3);
      });

      const tableRows = fyMonthlyRows.map((row: any) => [
        formatMonthLabel(row.yearMonth, lang),
        Math.round(row.opening).toLocaleString('en-IN'),
        row.subscription.toLocaleString('en-IN'),
        row.deductedSalaryMonths || '--',
        row.withdrawal > 0 ? row.withdrawal.toLocaleString('en-IN') : '0',
        Math.round(row.closing).toLocaleString('en-IN'),
        `${row.rate}%`,
        row.interestEarned.toFixed(1)
      ]);
      
      // Final month / Current month closing balance row (without separate Interest Credit row)
      const isCompletedMarch = fyBalances.isCompletedMarch;
      const latestMonthStr = fyBalances.latestMonth ? formatMonthLabel(fyBalances.latestMonth, lang) : 'Current Month';

      if (isCompletedMarch) {
        tableRows.push([
          'CLOSING BALANCE (as on 31st March)',
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          `Rs. ${Math.round(fyBalances.closingBalance).toLocaleString('en-IN')}`
        ]);
      } else {
        tableRows.push([
          `CLOSING BALANCE (as on ${latestMonthStr})`,
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          `Rs. ${Math.round(fyBalances.closingBalanceWithAccruedInterest).toLocaleString('en-IN')}`
        ]);
      }

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 69,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.8 },
        headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' }
      });

      // Position abstract dynamically below the monthly table to avoid any overlap!
      const finalYMonthTable = (doc as any).lastAutoTable.finalY || 165;
      let abstractStartY = finalYMonthTable + 8;
      if (abstractStartY > 220) {
        doc.addPage();
        abstractStartY = 20;
      }

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(55, 65, 81);
      doc.text('ABSTRACT OF THE FINANCIAL YEAR DATA', 14, abstractStartY);

      const abstractHead = [[
        'Opening Balance (OB)', 
        'Total Subscriptions (+)', 
        'Total Withdrawals (-)', 
        'Interest Credited (+)', 
        'Calculated Int (FY)', 
        'Total Acc. Int', 
        'Closing Balance (CB)'
      ]];

      const effectiveClosing = isCompletedMarch ? fyBalances.closingBalance : fyBalances.closingBalanceWithAccruedInterest;

      autoTable(doc, {
        head: abstractHead,
        body: [[
          `Rs. ${Math.round(fyBalances.openingBalance).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(fyBalances.subscriptionsPaid).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(fyBalances.withdrawals).toLocaleString('en-IN')}`,
          fyBalances.interestCredited > 0 ? `Rs. ${Math.round(fyBalances.interestCredited).toLocaleString('en-IN')}` : '0',
          `Rs. ${Math.round(fyBalances.calculatedInterest).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(fyBalances.totalAccumulatedInterest).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(effectiveClosing).toLocaleString('en-IN')}`
        ]],
        startY: abstractStartY + 4,
        theme: 'grid',
        styles: { fontSize: 7.5, halign: 'center', cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          6: { fontStyle: 'bold' }
        }
      });

      const finalYAbstract = (doc as any).lastAutoTable.finalY || (abstractStartY + 25);
      
      if (isSettled) {
        const settledY = Math.min(finalYAbstract + 8, 275);
        doc.setDrawColor(220, 50, 50);
        doc.setFillColor(254, 242, 242);
        doc.rect(14, settledY, 182, 10, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(185, 28, 28);
        doc.text(`* ACCOUNT SETTLED: Net payable of Rs. ${Math.round(pfSetup.settlement.finalAmount).toLocaleString('en-IN')} paid on ${formatDateLabel(pfSetup.settlement.settlementDate)} under Order ${pfSetup.settlement.orderNo}.`, 16, settledY + 6);
      }
    });

    if (printOnly) {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } else {
      const filename = fy === 'all' ? `PF-Account-Slip-AllYears-${empId}.pdf` : `PF-Account-Slip-${empId}-${fy}.pdf`;
      doc.save(filename);
    }
  };

  const handleDownloadAccountSlipExcel = (empId: string, fy: string) => {
    const emp = filteredEmployeesList.find((e: any) => e.employeeId === empId || e.id === empId);
    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === empId);
    const isSettled = pfSetup?.settlement;
    const jurisdiction = getTpJurisdictionDetails(emp?.townPanchayatId);

    const wb = XLSX.utils.book_new();

    const empSlipYears = getEmployeeSlipYears(empId);
    const yearsToExport = fy === 'all' ? [...empSlipYears].reverse() : [fy];
    const allYearSummaries = getYearWiseSummary(empId);

    // Sheet 1: Consolidated Abstract Summary
    const abstractSheetRows: any[] = [];
    abstractSheetRows.push(['GOVERNMENT OF TAMIL NADU']);
    abstractSheetRows.push(['TOWN PANCHAYATS DEPARTMENT']);
    abstractSheetRows.push([`${jurisdiction.tpName} Town Panchayat, ${jurisdiction.districtName} District, ${jurisdiction.zoneName} Zone`]);
    abstractSheetRows.push(['PROVIDENT FUND CONSOLIDATED ACCOUNT ABSTRACT (YEAR-WISE)']);
    abstractSheetRows.push([]);

    abstractSheetRows.push(['Subscriber Name:', emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A', '', 'Account Status:', isSettled ? `Settled (${pfSetup.settlement.settlementType})` : 'Active']);
    abstractSheetRows.push(['Employee ID:', empId, '', 'Opening Date:', pfSetup?.openingDate || 'N/A']);
    abstractSheetRows.push(['Post:', getEmpDesignation(emp) || 'N/A', '', 'Town Panchayat:', jurisdiction.tpName]);
    abstractSheetRows.push(['District / Zone:', `${jurisdiction.districtName} / ${jurisdiction.zoneName}`, '', 'Total Recorded FYs:', allYearSummaries.length]);
    abstractSheetRows.push([]);

    abstractSheetRows.push([
      'Financial Year', 
      'Opening Balance (Rs.)', 
      'Subscriptions Paid (+)', 
      'Withdrawals (-)', 
      'Interest Credited (+)', 
      'Calculated Interest (FY)', 
      'Total Accumulated Interest', 
      'Closing Balance (CB)'
    ]);

    allYearSummaries.forEach((yr) => {
      abstractSheetRows.push([
        yr.fy,
        Math.round(yr.openingBalance),
        Math.round(yr.subscriptionsPaid),
        Math.round(yr.withdrawals),
        yr.interestCredited > 0 ? Math.round(yr.interestCredited) : 0,
        Math.round(yr.calculatedInterest),
        Math.round(yr.totalAccumulatedInterest),
        Math.round(yr.isCompletedMarch ? yr.closingBalance : yr.closingBalanceWithAccruedInterest)
      ]);
    });

    const grandSub = allYearSummaries.reduce((sum, item) => sum + item.subscriptionsPaid, 0);
    const grandWd = allYearSummaries.reduce((sum, item) => sum + item.withdrawals, 0);
    const grandIntCredited = allYearSummaries.reduce((sum, item) => sum + item.interestCredited, 0);
    const grandCalcInt = allYearSummaries.reduce((sum, item) => sum + item.calculatedInterest, 0);
    const latestAccInt = allYearSummaries.length > 0 ? allYearSummaries[allYearSummaries.length - 1].totalAccumulatedInterest : 0;
    const finalCB = allYearSummaries.length > 0 
      ? (allYearSummaries[allYearSummaries.length - 1].isCompletedMarch 
          ? allYearSummaries[allYearSummaries.length - 1].closingBalance 
          : allYearSummaries[allYearSummaries.length - 1].closingBalanceWithAccruedInterest)
      : 0;

    abstractSheetRows.push([
      'TOTAL / SUMMARY',
      '',
      Math.round(grandSub),
      Math.round(grandWd),
      Math.round(grandIntCredited),
      Math.round(grandCalcInt),
      Math.round(latestAccInt),
      ''
    ]);

    const wsAbstract = XLSX.utils.aoa_to_sheet(abstractSheetRows);
    wsAbstract['!cols'] = [
      { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAbstract, 'Year-Wise Abstract');

    // Individual FY sheets
    yearsToExport.forEach((currentFy) => {
      const sheetRows: any[] = [];

      sheetRows.push(['GOVERNMENT OF TAMIL NADU']);
      sheetRows.push(['TOWN PANCHAYATS DEPARTMENT']);
      sheetRows.push([`${jurisdiction.tpName} Town Panchayat, ${jurisdiction.districtName} District, ${jurisdiction.zoneName} Zone`]);
      sheetRows.push(['PROVIDENT FUND ANNUAL ACCOUNT SLIP']);
      sheetRows.push([`FINANCIAL YEAR: ${currentFy}`]);
      sheetRows.push([]);

      const fyBalances = getEmployeeBalancesForFy(empId, currentFy);

      sheetRows.push(['Subscriber Name:', emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A', '', 'Account Status:', isSettled ? `Settled (${pfSetup.settlement.settlementType})` : 'Active']);
      sheetRows.push(['Employee ID:', empId, '', 'Opening Balance:', Math.round(fyBalances.openingBalance)]);
      sheetRows.push(['Post:', getEmpDesignation(emp) || 'N/A', '', 'Town Panchayat:', jurisdiction.tpName]);
      sheetRows.push(['District / Zone:', `${jurisdiction.districtName} / ${jurisdiction.zoneName}`, '', '', '']);
      sheetRows.push([]);

      sheetRows.push(['Month', 'Opening Balance (Rs.)', 'Subscription Paid (Rs.)', 'Deducted Salary Month', 'Withdrawals (Rs.)', 'Closing Balance (Rs.)', 'Interest Rate', 'Interest Accrued (Rs.)']);

      const trail = pfAuditTrail[empId];
      const monthlyHistory = trail ? trail.monthlyHistory : [];
      const [startYrStr, endYrStr] = currentFy.split('-');
      const startYr = parseInt(startYrStr, 10);
      const endYr = parseInt(endYrStr, 10);
      
      const filteredRows = monthlyHistory.filter((row: any) => {
        if (row.type === 'INTEREST_CREDIT') return false;
        const [yrStr, moStr] = row.yearMonth.split('-');
        const yr = parseInt(yrStr, 10);
        const mo = parseInt(moStr, 10);
        return (yr === startYr && mo >= 4) || (yr === endYr && mo <= 3);
      });

      filteredRows.forEach((row: any) => {
        sheetRows.push([
          formatMonthLabel(row.yearMonth, lang),
          Math.round(row.opening),
          row.subscription,
          row.deductedSalaryMonths || '--',
          row.withdrawal > 0 ? row.withdrawal : 0,
          Math.round(row.closing),
          `${row.rate}%`,
          parseFloat(row.interestEarned.toFixed(2))
        ]);
      });

      const isCompletedMarch = fyBalances.isCompletedMarch;
      const latestMonthStr = fyBalances.latestMonth ? formatMonthLabel(fyBalances.latestMonth, lang) : 'Current Month';

      if (isCompletedMarch) {
        sheetRows.push([
          'CLOSING BALANCE (as on 31st March)',
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          Math.round(fyBalances.closingBalance)
        ]);
      } else {
        sheetRows.push([
          `CLOSING BALANCE (as on ${latestMonthStr})`,
          '--',
          '--',
          '--',
          '--',
          '--',
          '--',
          Math.round(fyBalances.closingBalanceWithAccruedInterest)
        ]);
      }

      sheetRows.push([]);

      sheetRows.push(['ABSTRACT OF THE FINANCIAL YEAR DATA']);
      sheetRows.push(['Opening Balance (OB)', 'Total Subscriptions (+)', 'Total Withdrawals (-)', 'Interest Credited (+)', 'Calculated Interest (FY)', 'Total Accumulated Interest', 'Closing Balance (CB)']);
      sheetRows.push([
        Math.round(fyBalances.openingBalance),
        Math.round(fyBalances.subscriptionsPaid),
        Math.round(fyBalances.withdrawals),
        fyBalances.interestCredited > 0 ? Math.round(fyBalances.interestCredited) : 0,
        Math.round(fyBalances.calculatedInterest),
        Math.round(fyBalances.totalAccumulatedInterest),
        Math.round(isCompletedMarch ? fyBalances.closingBalance : fyBalances.closingBalanceWithAccruedInterest)
      ]);

      if (isSettled) {
        sheetRows.push([]);
        sheetRows.push([`* ACCOUNT SETTLED: Net payable of Rs. ${Math.round(pfSetup.settlement.finalAmount).toLocaleString('en-IN')} paid on ${formatDateLabel(pfSetup.settlement.settlementDate)} under Order ${pfSetup.settlement.orderNo}.`]);
      }

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      ws['!cols'] = [
        { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 18 }, { wch: 22 }, { wch: 16 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, ws, `FY ${currentFy}`);
    });

    XLSX.writeFile(wb, `PF_Account_Slip_${empId}_${fy}.xlsx`);
  };

  // Active Town Panchayat calculation method for header display
  const activeTpId = (currentUser?.scopeType === 'TownPanchayat' || currentUser?.scopeType === 'TP' ? currentUser.scopeId : null) || (employees[0]?.townPanchayatId) || (state?.townPanchayats?.[0]?.id);
  const activeTp = (state?.townPanchayats || []).find((tp: any) => tp.id === activeTpId);
  const activeMethod: 'method1' | 'method2' | 'method3' = activeTp?.pfCalculationMethod || state?.settings?.pfCalculationMethods?.[activeTpId] || 'method1';

  // If user is employee, render ONLY their Account Slip!
  if (currentUser?.isEmployee) {
    const employeeSlipId = currentUser.employeeId || currentUser.username || (filteredEmployeesList[0]?.employeeId) || '';
    const empObj = employees.find((e: any) => e.employeeId === employeeSlipId || e.id === currentUser?.id);
    const empTp = (state?.townPanchayats || []).find((t: any) => t.id === empObj?.townPanchayatId);
    const empMethod = empObj ? (pfAuditTrail[employeeSlipId]?.calculationMethod || empTp?.pfCalculationMethod || 'method1') : 'method1';

    const summaries = getYearWiseSummary(employeeSlipId);
    const filteredSummaries = reportFy === 'all' 
      ? summaries 
      : summaries.filter(s => s.fy === reportFy);

    let statOpening = 0;
    let statSubs = 0;
    let statWds = 0;
    let statInt = 0;
    let statClosing = 0;

    if (filteredSummaries.length > 0) {
      statOpening = filteredSummaries[0].openingBalance;
      statSubs = filteredSummaries.reduce((sum, s) => sum + s.subscriptionsPaid, 0);
      statWds = filteredSummaries.reduce((sum, s) => sum + s.withdrawals, 0);
      statInt = filteredSummaries.reduce((sum, s) => sum + s.interestCredited, 0);
      statClosing = filteredSummaries[filteredSummaries.length - 1].closingBalance;
    }

    return (
      <div className="space-y-6">
        {/* Top Summary Banner */}
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <Calculator className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-gray-900">
                  {lang === 'ta' ? 'சேமநலநிதி (PF) வருடாந்திர கணக்குச் சீட்டு' : 'Provident Fund Annual Account Slip'}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  empMethod === 'method1' ? 'bg-amber-100 text-amber-800' :
                  empMethod === 'method2' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {empMethod === 'method1' ? (lang === 'ta' ? 'முறை 1: அரசு வழக்கம்' : 'Method 1 (Standard)') :
                   empMethod === 'method2' ? (lang === 'ta' ? 'முறை 2: ஆண்டு கூட்டு வட்டி' : 'Method 2 (Cumulative)') :
                   (lang === 'ta' ? 'முறை 3: முழு இருப்பு + கூட்டு வட்டி' : 'Method 3 (Full Gross + Cumulative)')}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {lang === 'ta' 
                  ? `சந்தாதாரர்: ${empObj ? (empObj.nameTa || empObj.nameEn) : employeeSlipId} (${employeeSlipId}) • ${empTp?.nameTa || empTp?.nameEn || 'பேரூராட்சி'}` 
                  : `Subscriber: ${empObj ? (empObj.nameEn || empObj.nameTa) : employeeSlipId} (${employeeSlipId}) • ${empTp?.nameEn || 'Town Panchayat'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-semibold text-gray-500">{lang === 'ta' ? 'நிதியாண்டு' : 'FY'}:</label>
              <select
                value={reportFy}
                onChange={(e) => setReportFy(e.target.value)}
                className="border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">{lang === 'ta' ? 'அனைத்து ஆண்டுகள்' : 'All Years'}</option>
                {getEmployeeSlipYears(employeeSlipId).map((y) => (
                  <option key={y} value={y}>{y.replace('-', ' - ')}</option>
                ))}
              </select>
            </div>

            <button
              onClick={() => handleDownloadAccountSlipExcel(employeeSlipId, reportFy)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => handleDownloadAccountSlipPDF(employeeSlipId, reportFy, false)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={() => handleDownloadAccountSlipPDF(employeeSlipId, reportFy, true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{lang === 'ta' ? 'அச்சிடுக' : 'Print Slip'}</span>
            </button>
          </div>
        </div>

        {/* Account Slip Sheet */}
        <div id="pf-account-slip" className="bg-white rounded-3xl border border-gray-100 p-8 space-y-8 max-w-4xl mx-auto shadow-xs relative overflow-hidden print:border-none print:shadow-none">
          <div className="flex justify-between items-start border-b border-gray-100 pb-6">
            <div>
              <h1 className="text-lg font-extrabold text-gray-900 tracking-tight uppercase">
                {lang === 'ta' ? 'பேரூராட்சிகள் துறை' : 'TOWN PANCHAYATS DEPARTMENT'}
              </h1>
              <p className="text-xs text-indigo-600 font-bold uppercase tracking-wide">
                {lang === 'ta' ? 'தமிழ்நாடு அரசு' : 'Government of Tamil Nadu'}
              </p>
              <p className="text-xs text-gray-500 font-semibold mt-1">
                {lang === 'ta' ? 'பேரூராட்சி பணியாளர்களுக்கான சேமநலநிதி கணக்குச் சீட்டு' : 'Provident Fund Account Balance Slip for Town Panchayat Employees'}
              </p>
            </div>
            <div className="text-right">
              <span className="inline-block bg-gray-100 text-gray-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide border border-gray-200 font-mono">
                FY {reportFy}
              </span>
              <p className="text-[10px] text-gray-400 font-mono mt-1">Generated: 2026-09-02</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-gray-50/70 p-6 rounded-2xl border border-gray-100 text-xs">
            <div className="space-y-2">
              <p className="text-gray-500 font-bold uppercase text-[9px] tracking-wide">Account Holder / சந்தாதாரர்</p>
              <p className="font-extrabold text-gray-900 text-sm">{getEmpName(employeeSlipId)}</p>
              <p className="font-mono text-gray-500">Employee ID: {employeeSlipId}</p>
            </div>
            <div className="space-y-2">
              <p className="text-gray-500 font-bold uppercase text-[9px] tracking-wide">Jurisdiction & Method</p>
              <p className="font-bold text-gray-800">{getTpName(empObj?.townPanchayatId) || 'Thiruporur'} Town Panchayat</p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  empMethod === 'method1' ? 'bg-amber-100 text-amber-800' :
                  empMethod === 'method2' ? 'bg-indigo-100 text-indigo-800' :
                  'bg-emerald-100 text-emerald-800'
                }`}>
                  {empMethod === 'method1' ? 'Method 1 (Standard Non-compounding)' :
                   empMethod === 'method2' ? 'Method 2 (Annual Cumulative Compounding)' :
                   'Method 3 (Full Gross + Cumulative + Post-Retire)'}
                </span>
              </div>
            </div>
          </div>

          {/* Financial Summary Box */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-center">
              <p className="text-gray-500 font-bold text-[9px] uppercase tracking-wider">{lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Balance'}</p>
              <p className="text-base font-extrabold text-gray-900 font-mono mt-1">
                ₹ {Math.round(statOpening).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-center">
              <p className="text-gray-500 font-bold text-[9px] uppercase tracking-wider">{lang === 'ta' ? 'மொத்த சந்தா' : 'Total Subscriptions'}</p>
              <p className="text-base font-extrabold text-emerald-600 font-mono mt-1">
                + ₹ {Math.round(statSubs).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl text-center">
              <p className="text-gray-500 font-bold text-[9px] uppercase tracking-wider">{lang === 'ta' ? 'முன்பணம் / எடுத்த தொகை' : 'Total Withdrawals'}</p>
              <p className="text-base font-extrabold text-rose-600 font-mono mt-1">
                - ₹ {Math.round(statWds).toLocaleString('en-IN')}
              </p>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl text-center">
              <p className="text-indigo-600 font-bold text-[9px] uppercase tracking-wider">{lang === 'ta' ? 'இறுதி இருப்பு' : 'Closing Balance'}</p>
              <p className="text-base font-extrabold text-indigo-700 font-mono mt-1">
                ₹ {Math.round(statClosing).toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Year-wise Accordions */}
          <div className="space-y-4">
            {filteredSummaries.length === 0 ? (
              <div className="p-8 text-center bg-gray-50 border border-gray-100 text-gray-400 italic rounded-2xl">
                No transaction history found for the selected criteria.
              </div>
            ) : (
              filteredSummaries.map((yr) => {
                const isExpanded = expandedAccountSlipYears.includes(yr.fy) || reportFy !== 'all';
                return (
                  <div key={yr.fy} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs transition-all hover:border-gray-300">
                    <div 
                      onClick={() => {
                        if (reportFy === 'all') {
                          setExpandedAccountSlipYears(prev => 
                            prev.includes(yr.fy) ? prev.filter(f => f !== yr.fy) : [...prev, yr.fy]
                          );
                        }
                      }}
                      className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 gap-4 cursor-pointer select-none transition ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-gray-50/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                          {yr.fy}
                        </div>
                        <div>
                          <p className="font-extrabold text-gray-800 text-sm">{lang === 'ta' ? `நிதியாண்டு ${yr.fy}` : `Financial Year ${yr.fy}`}</p>
                          <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">
                            Interest Rate: {(yr.months[0]?.rate || 7.1)}%
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-8 w-full sm:w-auto text-xs font-mono">
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase font-bold font-sans">OB</p>
                          <p className="font-bold text-gray-700 font-mono">₹{Math.round(yr.openingBalance).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase font-bold font-sans text-emerald-600">
                            {lang === 'ta' ? 'சந்தா' : 'Subscriptions'}
                          </p>
                          <p className="font-bold text-emerald-600 font-mono">+₹{Math.round(yr.subscriptionsPaid).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase font-bold font-sans text-rose-600">
                            {lang === 'ta' ? 'திரும்பப் பெற்றவை' : 'Withdrawals'}
                          </p>
                          <p className="font-bold text-rose-600 font-mono">-₹{Math.round(yr.withdrawals).toLocaleString('en-IN')}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 uppercase font-bold font-sans text-indigo-600">
                            {lang === 'ta' ? 'வரவு வட்டி' : 'Interest'}
                          </p>
                          <p className="font-bold text-indigo-600 font-mono">+₹{Math.round(yr.interestCredited).toLocaleString('en-IN')}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[9px] text-gray-400 uppercase font-bold font-sans">
                            {lang === 'ta' ? 'முடிவு இருப்பு' : 'CB'}
                          </p>
                          <p className="font-extrabold text-indigo-700 font-mono">₹{Math.round(yr.closingBalance).toLocaleString('en-IN')}</p>
                        </div>
                      </div>

                      {reportFy === 'all' && (
                        <div className="text-gray-400 shrink-0 self-center">
                          {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-500" /> : <ChevronDown className="w-5 h-5" />}
                        </div>
                      )}
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50/30 p-4">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-50 font-bold text-[9px] text-gray-500 uppercase tracking-wider border-b border-gray-200 font-sans">
                                <th className="p-4 font-sans">{lang === 'ta' ? 'மாதம்' : 'Month'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Balance'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'மாதாந்திர சந்தா' : 'Monthly Sub.'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'சம்பளம் பிடித்தம் செய்த மாதம்' : 'Deducted Salary Month'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'திரும்பப் பெறுதல்' : 'Withdrawal'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'முடிவு இருப்பு' : 'Closing Balance'}</th>
                                <th className="p-4 font-sans">{lang === 'ta' ? 'வட்டி விகிதம்' : 'PF Int. Rate'}</th>
                                <th className="p-4 text-right pr-6 font-sans">{lang === 'ta' ? 'ஈட்டிய வட்டி' : 'Int. Earned'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 font-mono text-gray-600">
                              {yr.months.map((row: any, idx: number) => {
                                if (row.type === 'INTEREST_CREDIT') {
                                  return null;
                                }
                                return (
                                  <tr key={idx} className="hover:bg-gray-50/30">
                                    <td className="p-4 font-bold">{formatMonthLabel(row.yearMonth, lang)}</td>
                                    <td className="p-4">₹ {Math.round(row.opening).toLocaleString('en-IN')}</td>
                                    <td className="p-4 text-emerald-600 font-bold">
                                      + ₹ {row.subscription.toLocaleString('en-IN')}
                                      {row.interestRelease > 0 && (
                                        <span className="block text-[9px] text-indigo-600 font-extrabold mt-1 uppercase tracking-wider bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-lg w-max font-sans">
                                          {lang === 'ta' ? `அரசு வட்டி: +₹${row.interestRelease.toLocaleString('en-IN')}` : `Govt Int: +₹${row.interestRelease.toLocaleString('en-IN')}`}
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-4 text-gray-500 font-medium">{row.deductedSalaryMonths || '--'}</td>
                                    <td className="p-4 text-rose-600 font-bold">{row.withdrawal > 0 ? `- ₹ ${row.withdrawal.toLocaleString('en-IN')}` : '-'}</td>
                                    <td className="p-4 font-bold">₹ {Math.round(row.closing).toLocaleString('en-IN')}</td>
                                    <td className="p-4 text-gray-500">{row.rate} %</td>
                                    <td className="p-4 text-right pr-6 font-bold text-gray-700">₹ {row.interestEarned.toFixed(1)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-center pt-8 border-t border-gray-100 text-[10px] text-gray-400 gap-4">
            <p>
              {lang === 'ta' 
                ? '*இது தமிழ்நாடு பேரூராட்சிகள் துறையின் கணினி வழி உருவாக்கப்பட்ட அறிக்கை.' 
                : '*This is a digitally generated statement from Tamil Nadu Town Panchayats Department.'}
            </p>
            <p className="font-mono text-gray-400">Ledger Code Hash Check: DTPPF_{employeeSlipId}_2026</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Zone, District, and Town Panchayat Selectors for HOD/Zonal logins */}
      {(currentUser?.roleId === 'ad' || currentUser?.roleId === 'admin' || currentUser?.roleId === 'zonal' || currentUser?.scopeType === 'HOD' || currentUser?.scopeType === 'Zone') && (
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
            <Building className="w-4 h-4 text-indigo-500" />
            {lang === 'ta' ? 'அதிகார வரம்பு வடிகட்டி (வட்டம் / மாவட்டம் / பேரூராட்சி)' : 'Jurisdiction Selector (Zone / District / Town Panchayat)'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Zone Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {lang === 'ta' ? 'வட்டம் (Zone)' : 'Zone'}
              </label>
              <select
                value={selectedZoneId}
                onChange={(e) => handleZoneChange(e.target.value)}
                disabled={currentUser?.roleId === 'zonal' || currentUser?.scopeType === 'Zone'}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400"
              >
                {selectableZones.map((z: any) => (
                  <option key={z.id} value={z.id}>
                    {lang === 'ta' ? (z.nameTa || z.nameEn) : z.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {/* District Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {lang === 'ta' ? 'மாவட்டம் (District)' : 'District'}
              </label>
              <select
                value={selectedDistrictId}
                onChange={(e) => handleDistrictChange(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {(state?.districts || [])
                  .filter((d: any) => d.zoneId === selectedZoneId)
                  .map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {lang === 'ta' ? (d.nameTa || d.nameEn) : d.nameEn}
                    </option>
                  ))}
              </select>
            </div>

            {/* Town Panchayat Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                {lang === 'ta' ? 'பேரூராட்சி (Town Panchayat)' : 'Town Panchayat'}
              </label>
              <select
                value={selectedTpId}
                onChange={(e) => setSelectedTpId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {(state?.townPanchayats || [])
                  .filter((tp: any) => tp.districtId === selectedDistrictId)
                  .map((tp: any) => (
                    <option key={tp.id} value={tp.id}>
                      {lang === 'ta' ? (tp.nameTa || tp.nameEn) : tp.nameEn}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Sub-Tab Navigation Bar matching Employee Management View */}
      {currentUser?.roleId !== 'zonal' ? (
        <div className="flex justify-start sm:justify-center overflow-x-auto scrollbar-custom whitespace-nowrap border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs">
          {!shouldHideRates && (
            <button 
              onClick={() => setActiveSubTab('rates')}
              className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeSubTab === 'rates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {lang === 'ta' ? '1. வட்டி விகிதங்கள்' : '1. Interest Rates'}
            </button>
          )}
          <button 
            onClick={() => setActiveSubTab('setup')}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeSubTab === 'setup' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {lang === 'ta' ? '2. ஆரம்ப இருப்பு உள்ளீடு' : '2. Opening Balance Entry'}
          </button>
          <button 
            onClick={() => setActiveSubTab('withdrawals')}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeSubTab === 'withdrawals' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {lang === 'ta' ? '3. சேமநலநிதி முன்பணம் & தீர்வு' : '3. PF Advance & Settlements'}
          </button>
          <button 
            onClick={() => setActiveSubTab('subscriptions')}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeSubTab === 'subscriptions' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {lang === 'ta' ? '4. சந்தா சலான் பதிவு' : '4. Subscriptions Entry'}
          </button>
          <button 
            onClick={() => setActiveSubTab('reports')}
            className={`pb-4 px-6 text-sm font-semibold border-b-2 transition shrink-0 ${activeSubTab === 'reports' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {lang === 'ta' ? '5. சேமநலநிதி அறிக்கைகள்' : '5. PF Reports & Slips'}
          </button>
        </div>
      ) : (
        <div className="flex justify-start sm:justify-center overflow-x-auto scrollbar-custom whitespace-nowrap border-b border-gray-100 bg-white px-6 pt-4 rounded-t-2xl shadow-xs">
          <button 
            onClick={() => setActiveSubTab('reports')}
            className="pb-4 px-6 text-sm font-semibold border-b-2 border-indigo-600 text-indigo-600 shrink-0 cursor-default"
          >
            {lang === 'ta' ? 'சேமநலநிதி அறிக்கைகள்' : 'PF Reports & Slips'}
          </button>
        </div>
      )}

      {/* SUB-TAB 1: INTEREST RATES */}
      {activeSubTab === 'rates' && (
        <PfRatesTab
          pfInterestRates={pfInterestRates}
          lang={lang}
          onSaveCollection={onSaveCollection}
          handleFileUpload={handleFileUpload}
          isUploading={isUploading}
          rateAttachmentName={rateAttachmentName}
          rateAttachmentUrl={rateAttachmentUrl}
          setRateAttachmentName={setRateAttachmentName}
          setRateAttachmentUrl={setRateAttachmentUrl}
        />
      )}

      {/* SUB-TAB 2: OFFICE OPENING BALANCE & EMPLOYEE BREAKUPS */}
      {activeSubTab === "setup" && (
        <PfSetupTab
          employees={filteredEmployeesList}
          pfEmployees={pfEmployees}
          currentOfficeSetup={currentOfficeSetup}
          lang={lang}
          onSaveCollection={onSaveCollection}
        />
      )}

      {/* SUB-TAB 3: RECORD WITHDRAWALS & SETTLEMENTS */}
      {activeSubTab === "withdrawals" && (
        <PfWithdrawalsTab
          employees={filteredEmployeesList}
          pfEmployees={pfEmployees}
          townPanchayats={townPanchayats}
          pfInterestReleases={pfInterestReleases}
          pfAuditTrail={pfAuditTrail}
          lang={lang}
          onSaveCollection={onSaveCollection}
        />
      )}

      {/* SUB-TAB 4: MONTHLY SUBSCRIPTIONS ENTRY */}
      {activeSubTab === "subscriptions" && (
        <PfSubscriptionsTab
          employees={filteredEmployeesList}
          pfEmployees={pfEmployees}
          pfSubscriptions={pfSubscriptions}
          pfChallans={pfChallans}
          officeOpeningDate={currentOfficeSetup?.openingDate || "2023-04-01"}
          lang={lang}
          onSaveCollection={onSaveCollection}
          handleFileUpload={handleFileUpload}
          isUploading={isUploading}
          challanAttachmentName={challanAttachmentName}
          challanAttachmentUrl={challanAttachmentUrl}
          setChallanAttachmentName={setChallanAttachmentName}
          setChallanAttachmentUrl={setChallanAttachmentUrl}
        />
      )}

      {/* SUB-TAB 6: PF REPORTS & LEDGER SLIPS */}
      {activeSubTab === "reports" && (
        <PfReportsTab
          employees={filteredEmployeesList}
          filteredEmployeesList={filteredEmployeesList}
          pfEmployees={pfEmployees}
          pfSubscriptions={pfSubscriptions}
          pfChallans={pfChallans}
          townPanchayats={townPanchayats}
          allowedTownPanchayats={allowedTownPanchayats}
          currentOfficeSetup={currentOfficeSetup}
          currentUser={currentUser}
          pfAuditTrail={pfAuditTrail}
          state={state}
          lang={lang}
        />
      )}
    </div>
  );
}