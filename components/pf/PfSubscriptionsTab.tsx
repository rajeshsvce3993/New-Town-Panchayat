'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  AlertCircle, 
  CheckCircle, 
  Upload, 
  ArrowRight, 
  ArrowLeft, 
  Trash2, 
  Loader2, 
  AlertTriangle,
  Eye,
  Edit,
  X,
  FileText,
  Plus
} from 'lucide-react';
import { Language } from '../translations';
import { PfEmployee, PfSubscription } from './PfUtils';

interface PfSubscriptionsTabProps {
  employees: any[];
  pfEmployees: PfEmployee[];
  pfSubscriptions: PfSubscription[];
  pfChallans: any[];
  officeOpeningDate: string;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
  handleFileUpload: (file: File, type: string) => Promise<void>;
  isUploading: boolean;
  challanAttachmentName: string;
  challanAttachmentUrl: string;
  setChallanAttachmentName: (val: string) => void;
  setChallanAttachmentUrl: (val: string) => void;
}

export default function PfSubscriptionsTab({
  employees,
  pfEmployees,
  pfSubscriptions,
  pfChallans,
  officeOpeningDate,
  lang,
  onSaveCollection,
  handleFileUpload,
  isUploading,
  challanAttachmentName,
  challanAttachmentUrl,
  setChallanAttachmentName,
  setChallanAttachmentUrl
}: PfSubscriptionsTabProps) {
  // Wizard steps: 1, 2, 3
  const [wizardStep, setWizardStep] = useState<number>(1);

  const [subTab, setSubTab] = useState<'create' | 'view'>('create');
  
  // For viewing/editing
  const [viewingChallan, setViewingChallan] = useState<any | null>(null);
  const [editingChallan, setEditingChallan] = useState<any | null>(null);

  // Form states for edit mode
  const [editChallanNo, setEditChallanNo] = useState<string>('');
  const [editChallanDate, setEditChallanDate] = useState<string>('');
  const [editChallanAmount, setEditChallanAmount] = useState<string>('');
  const [editChallanAttachmentName, setEditChallanAttachmentName] = useState<string>('');
  const [editChallanAttachmentUrl, setEditChallanAttachmentUrl] = useState<string>('');
  const [editChallanFromMonth, setEditChallanFromMonth] = useState<string>('');
  const [editChallanToMonth, setEditChallanToMonth] = useState<string>('');
  const [editChallanBreakups, setEditChallanBreakups] = useState<Record<string, { subscriptionAmount: number; pfLoanRecoveryAmount: number }>>({});
  const [editSelectedEmployeeIds, setEditSelectedEmployeeIds] = useState<string[]>([]);

  // Form states - Subscriptions Wizard
  const [challanNo, setChallanNo] = useState<string>('');
  const [challanDate, setChallanDate] = useState<string>('');
  const [challanAmount, setChallanAmount] = useState<string>('');
  const [challanFromMonth, setChallanFromMonth] = useState<string>('');
  const [challanToMonth, setChallanToMonth] = useState<string>('');
  
  const [challanBreakups, setChallanBreakups] = useState<Record<string, { subscriptionAmount: number; pfLoanRecoveryAmount: number }>>({});
  const [selectedBreakupEmployeeIds, setSelectedBreakupEmployeeIds] = useState<string[]>([]);

  const [challanError, setChallanError] = useState<string>('');
  const [challanSuccess, setChallanSuccess] = useState<string>('');
  const [challanUploadError, setChallanUploadError] = useState<string>('');

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

  if (lastChallanMonthSuggested && !challanFromMonth) {
    setChallanFromMonth(lastChallanMonthSuggested);
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

  // Filter only active employees (who have setup in pfEmployees and have NOT settled)
  const activeEmployees = useMemo(() => {
    return employees.filter((emp: any) => {
      const pe = pfEmployees.find((p: PfEmployee) => p.employeeId === emp.employeeId);
      return pe && !pe.settlement;
    });
  }, [employees, pfEmployees]);

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

  const getEmpName = (empId: string): string => {
    const emp = employees.find((e: any) => e.employeeId === empId || e.id === empId);
    if (!emp) return empId;
    return lang === 'ta' ? (emp.nameTa || emp.nameEn) : (emp.nameEn || emp.nameTa);
  };

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

    // Create exactly ONE subscription record whose yearMonth is the challan date's month
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

  const handleEditChallanClick = (ch: any) => {
    setEditingChallan(ch);
    setEditChallanNo(ch.challanNo || '');
    setEditChallanDate(ch.challanDate || '');
    setEditChallanAmount(String(ch.challanAmount || ''));
    setEditChallanAttachmentName(ch.attachmentName || '');
    setEditChallanAttachmentUrl(ch.attachmentUrl || '');
    setEditChallanFromMonth(ch.fromMonth || '');
    setEditChallanToMonth(ch.toMonth || '');
    
    // Populate breakups
    const breakupsObj: Record<string, { subscriptionAmount: number; pfLoanRecoveryAmount: number }> = {};
    const selectedIds: string[] = [];
    if (Array.isArray(ch.breakups)) {
      ch.breakups.forEach((b: any) => {
        breakupsObj[b.employeeId] = {
          subscriptionAmount: b.subscriptionAmount || 0,
          pfLoanRecoveryAmount: b.pfLoanRecoveryAmount || 0
        };
        selectedIds.push(b.employeeId);
      });
    }
    setEditChallanBreakups(breakupsObj);
    setEditSelectedEmployeeIds(selectedIds);
  };

  const handleEditBreakupChange = (empId: string, field: 'subscriptionAmount' | 'pfLoanRecoveryAmount', val: string) => {
    const num = parseFloat(val) || 0;
    setEditChallanBreakups(prev => ({
      ...prev,
      [empId]: {
        ...prev[empId],
        [field]: num
      }
    }));
  };

  const handleSaveEditedChallan = async () => {
    if (!editingChallan) return;
    const chAmount = parseFloat(editChallanAmount) || 0;
    
    // Calculate edited total sum
    const editTotalSum = editSelectedEmployeeIds.reduce((sum: number, empId: string) => {
      const b = editChallanBreakups[empId];
      return sum + (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0);
    }, 0);

    if (Math.abs(editTotalSum - chAmount) > 0.1) {
      alert(lang === 'ta' ? 'அனைத்து ஊழியர்களின் கூடுதல் சலான் தொகையுடன் பொருந்தவில்லை' : 'The grand total of all employees must equal the Challan Amount.');
      return;
    }

    const updatedChallanObj = {
      ...editingChallan,
      challanNo: editChallanNo,
      challanDate: editChallanDate,
      challanAmount: chAmount,
      attachmentName: editChallanAttachmentName,
      attachmentUrl: editChallanAttachmentUrl,
      fromMonth: editChallanFromMonth,
      toMonth: editChallanToMonth || editChallanFromMonth,
      breakups: editSelectedEmployeeIds.map((empId: string) => {
        const b = editChallanBreakups[empId];
        return {
          employeeId: empId,
          subscriptionAmount: b?.subscriptionAmount || 0,
          pfLoanRecoveryAmount: b?.pfLoanRecoveryAmount || 0,
          total: (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0)
        };
      }).filter((b: any) => b.total > 0)
    };

    // Generate new subscriptions for this edited challan
    const chDate = new Date(editChallanDate);
    const challanMonth = `${chDate.getFullYear()}-${String(chDate.getMonth() + 1).padStart(2, '0')}`;

    const newSubscriptions: PfSubscription[] = [];
    updatedChallanObj.breakups.forEach((item: any) => {
      newSubscriptions.push({
        id: `pfs_${Date.now()}_${item.employeeId}`,
        employeeId: item.employeeId,
        yearMonth: challanMonth,
        amount: item.total,
        subscriptionAmount: item.subscriptionAmount,
        loanRecovery: item.pfLoanRecoveryAmount,
        challanId: editingChallan.id,
        challanNo: editChallanNo
      });
    });

    const updatedChallans = pfChallans.map(ch => ch.id === editingChallan.id ? updatedChallanObj : ch);
    const filteredSubscriptions = pfSubscriptions.filter(s => s.challanId !== editingChallan.id);
    const updatedSubscriptions = [...filteredSubscriptions, ...newSubscriptions];

    await onSaveCollection('pfChallans', updatedChallans);
    await onSaveCollection('pfSubscriptions', updatedSubscriptions);

    setEditingChallan(null);
    alert(lang === 'ta' ? 'சலான் விவரங்கள் வெற்றிகரமாக புதுப்பிக்கப்பட்டன!' : 'Challan and associated subscriptions updated successfully.');
  };

  const handleDeleteChallan = async (challanId: string) => {
    if (!window.confirm(lang === 'ta' ? 'இந்த சலானையும் அதனுடன் தொடர்புடைய அனைத்து ஊழியர் சந்தாக்களையும் நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to delete this challan and all associated employee subscription entries?')) {
      return;
    }
    const updatedChallans = pfChallans.filter(ch => ch.id !== challanId);
    const updatedSubscriptions = pfSubscriptions.filter(s => s.challanId !== challanId);

    await onSaveCollection('pfChallans', updatedChallans);
    await onSaveCollection('pfSubscriptions', updatedSubscriptions);

    alert(lang === 'ta' ? 'சலான் வெற்றிகரமாக நீக்கப்பட்டது!' : 'Challan deleted successfully.');
  };

  return (
    <div className="space-y-6">
      {/* View Toggle subtabs */}
      <div className="flex border-b border-slate-100 bg-white p-2 rounded-2xl shadow-xs gap-2">
        <button
          type="button"
          onClick={() => setSubTab('create')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === 'create'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          {lang === 'ta' ? 'புதிய சந்தா பதிவேற்றம்' : 'Post New Subscriptions'}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('view')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            subTab === 'view'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          {lang === 'ta' ? 'பதிவேற்றப்பட்ட சந்தாக்கள் காண்க/திருத்துக' : 'View & Edit Uploaded Subscriptions'}
        </button>
      </div>

      {subTab === 'create' && (
        <div className="space-y-6">
      {/* Step Progress bar */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6">
        <div className="flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex flex-col items-center space-y-1 relative">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              wizardStep >= 1 ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-100 text-slate-400'
            }`}>
              1
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Challan Details</span>
          </div>
          <div className="flex-1 h-[2px] bg-slate-100 mx-4 relative">
            <div className="h-full bg-indigo-600 transition-all duration-350" style={{ width: wizardStep >= 2 ? '100%' : '0%' }}></div>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              wizardStep >= 2 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              2
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Salary Month</span>
          </div>
          <div className="flex-1 h-[2px] bg-slate-100 mx-4 relative">
            <div className="h-full bg-indigo-600 transition-all duration-350" style={{ width: wizardStep >= 3 ? '100%' : '0%' }}></div>
          </div>

          <div className="flex flex-col items-center space-y-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              wizardStep >= 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              3
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Breakup Ledger</span>
          </div>
        </div>
      </div>

      {challanError && (
        <div className="p-4 bg-rose-50 text-rose-700 text-xs font-bold rounded-2xl border border-rose-100 flex items-center gap-2 max-w-4xl mx-auto">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{challanError}</span>
        </div>
      )}

      {challanSuccess && (
        <div className="p-4 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-2xl border border-emerald-100 flex items-center gap-2 max-w-4xl mx-auto">
          <CheckCircle className="w-5 h-5 shrink-0" />
          <span>{challanSuccess}</span>
        </div>
      )}

      {/* STEP 1: CHALLAN DETAILS */}
      {wizardStep === 1 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-xl mx-auto space-y-5">
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
            {lang === 'ta' ? 'சலான் விவரங்களை உள்ளிடவும்' : 'Step 1: Enter Challan Specifications'}
          </h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan Number</label>
              <input
                type="text"
                required
                placeholder="e.g. CHN-2026/894"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan Date</label>
              <input
                type="date"
                required
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan Amount (₹)</label>
              <input
                type="number"
                required
                placeholder="e.g. 12000"
                value={challanAmount}
                onChange={(e) => setChallanAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-black text-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {lang === 'ta' ? 'சலான் கோப்பு இணைப்பு (அதிகபட்சம் 2MB)' : 'Challan File Attachment (PDF, JPG/PNG - Max 2MB)'}
              </label>
              {challanUploadError && <p className="text-[10px] text-rose-600 font-bold mb-1">{challanUploadError}</p>}
              
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:bg-slate-50/50 transition relative">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'challan');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isUploading ? (
                  <div className="space-y-2">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">{lang === 'ta' ? 'பதிவேற்றப்படுகிறது...' : 'Uploading...'}</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">
                      {challanAttachmentName ? challanAttachmentName : (lang === 'ta' ? 'சலான் பதிவேற்ற கிளிக் செய்யவும்' : 'Drag & Drop Challan file or browse')}
                    </p>
                    {challanAttachmentUrl && (
                      <span className="inline-block bg-emerald-50 text-emerald-700 text-[9px] px-2.5 py-0.5 rounded-full font-bold">
                        Uploaded Successfully
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={handleNextStep1}
              disabled={!challanNo || !challanDate || !challanAmount || !challanAttachmentUrl || isUploading}
              className={`w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow flex items-center justify-center gap-2 transition-all ${
                challanNo && challanDate && challanAmount && challanAttachmentUrl && !isUploading
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer font-bold'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>{lang === 'ta' ? 'அடுத்த கட்டம்' : 'Next Step'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: DEDUCTED SALARY MONTH PERIOD */}
      {wizardStep === 2 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-8 max-w-xl mx-auto space-y-6">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
              {lang === 'ta' ? 'சம்பளம் பிடிக்கப்பட்ட காலம்' : 'Step 2: Choose Salary Deduction Period'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Select salary months linked with this challan deposit sheet.</p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Salary Month From</label>
                <input
                  type="month"
                  required
                  value={challanFromMonth}
                  onChange={(e) => setChallanFromMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Salary Month To (Optional)</label>
                <input
                  type="month"
                  value={challanToMonth}
                  onChange={(e) => setChallanToMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
                <span className="text-[9px] text-slate-400">*Leave empty to post as single month.</span>
              </div>
            </div>

            {/* Selected months summary indicator card */}
            <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-2xl">
              <span className="text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Computed Months for Postings</span>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedMonthsList.map((m, idx) => (
                  <span key={idx} className="bg-white border border-indigo-100 text-indigo-800 font-mono font-bold text-[10px] px-2.5 py-1 rounded-lg">
                    {m}
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-slate-500 mt-2 font-semibold">
                Subscriptions will be registered for {selectedMonthsList.length} month(s) in individual databases.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNextStep2}
                className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-1.5 shadow"
              >
                <span>Next</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: EMPLOYEE BREAKUPS CONTRIBUTION */}
      {wizardStep === 3 && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6 max-w-4xl mx-auto">
          <div>
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
              {lang === 'ta' ? 'ஊழியர் சந்தா விவரங்கள்' : 'Step 3: Employee-wise Contribution breakups'}
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Choose an employee to add contribution breakup values. Either Subscription or PF Loan Recovery value must be filled.
            </p>
          </div>

          {/* Selection Dropdown section */}
          <div className="flex flex-col sm:flex-row items-end gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex-1 w-full">
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                {lang === 'ta' ? 'ஊழியரைத் தேர்ந்தெடுக்கவும்' : 'Select Employee'}
              </label>
              <select
                onChange={(e) => {
                  const empId = e.target.value;
                  if (empId && !selectedBreakupEmployeeIds.includes(empId)) {
                    setSelectedBreakupEmployeeIds(prev => [...prev, empId]);
                    if (!challanBreakups[empId]) {
                      setChallanBreakups(prev => ({
                        ...prev,
                        [empId]: { subscriptionAmount: 0, pfLoanRecoveryAmount: 0 }
                      }));
                    }
                  }
                  e.target.value = ""; // Reset dropdown
                }}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs focus:ring-1 focus:ring-indigo-300 outline-none font-medium"
                defaultValue=""
              >
                <option value="" disabled>
                  {lang === 'ta' ? '-- ஊழியா்களைத் தேர்ந்தெடு --' : '-- Choose employee to add... --'}
                </option>
                {activeEmployees
                  .filter((emp: any) => !selectedBreakupEmployeeIds.includes(emp.employeeId))
                  .map((emp: any) => (
                    <option key={emp.employeeId} value={emp.employeeId}>
                      {emp.employeeId} - {getEmpName(emp.employeeId)}
                    </option>
                  ))
                }
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                const remaining = activeEmployees
                  .map((e: any) => e.employeeId)
                  .filter((id: string) => !selectedBreakupEmployeeIds.includes(id));
                if (remaining.length > 0) {
                  setSelectedBreakupEmployeeIds(prev => [...prev, ...remaining]);
                  setChallanBreakups(prev => {
                    const updated = { ...prev };
                    remaining.forEach((id: string) => {
                      if (!updated[id]) {
                        updated[id] = { subscriptionAmount: 0, pfLoanRecoveryAmount: 0 };
                      }
                    });
                    return updated;
                  });
                }
              }}
              className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all shrink-0 w-full sm:w-auto"
            >
              {lang === 'ta' ? 'அனைத்து ஊழியர்களையும் சேர்க்கவும்' : 'Add All Active Employees'}
            </button>
          </div>

          {/* Breakup Tally warning/success check */}
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-bold ${
            isChallanTotalTallied 
              ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
              : 'bg-amber-50 border-amber-100 text-amber-800'
          }`}>
            <div className="flex items-center gap-2">
              {isChallanTotalTallied ? <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}
              <span>
                {isChallanTotalTallied 
                  ? (lang === 'ta' ? 'சலான் தொகை ஊழியர்களின் கூட்டுடன் சரியாக ஒத்துப்போகிறது!' : 'Breakup Grand Total completely Tallied with Challan Amount!')
                  : (lang === 'ta' ? `கூடுதல் சரியாக அமையவில்லை. இன்னும் விடுபட்டது: ₹ ${Math.abs(parseFloat(challanAmount) - totalChallanBreakupSum).toLocaleString('en-IN')}` : `Breakups do not match! Difference: ₹ ${Math.abs(parseFloat(challanAmount) - totalChallanBreakupSum).toLocaleString('en-IN')}`)
                }
              </span>
            </div>
            <div className="font-mono text-[11px] font-black">
              Grand Total: ₹ {totalChallanBreakupSum.toLocaleString('en-IN')} / ₹ {parseFloat(challanAmount).toLocaleString('en-IN')}
            </div>
          </div>

          {selectedBreakupEmployeeIds.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-200 rounded-3xl bg-slate-50/50 space-y-2">
              <p className="text-sm font-bold text-slate-600">No Employees Selected</p>
              <p className="text-xs text-slate-400">Please select an employee from the dropdown above to start entering contribution breakups.</p>
            </div>
          ) : (
            /* Grid ledger inputs table */
            <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[400px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100 z-10 shadow-xs">
                  <tr>
                    <th className="p-4">Employee</th>
                    <th className="p-4">Subscription Amt (₹)</th>
                    <th className="p-4">PF Loan Recovery (₹)</th>
                    <th className="p-4 text-right">Individual Total</th>
                    <th className="p-4 text-center w-16">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBreakupEmployeeIds.map((empId) => {
                    const b = challanBreakups[empId];
                    const totalIndiv = (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0);

                    return (
                      <tr key={empId} className="hover:bg-slate-50/50">
                        <td className="p-4">
                          <p className="font-bold text-slate-800">{getEmpName(empId)}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{empId}</span>
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            placeholder="0"
                            value={b?.subscriptionAmount || ''}
                            onChange={(e) => handleBreakupChange(empId, 'subscriptionAmount', e.target.value)}
                            className="border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-300 outline-none w-32 font-mono text-slate-800 font-bold"
                          />
                        </td>
                        <td className="p-4">
                          <input
                            type="number"
                            placeholder="0"
                            value={b?.pfLoanRecoveryAmount || ''}
                            onChange={(e) => handleBreakupChange(empId, 'pfLoanRecoveryAmount', e.target.value)}
                            className="border border-slate-200 bg-white rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-300 outline-none w-32 font-mono text-slate-800 font-bold"
                          />
                        </td>
                        <td className="p-4 text-right font-bold text-indigo-700 font-mono text-sm">
                          ₹ {totalIndiv.toLocaleString('en-IN')}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBreakupEmployeeIds(prev => prev.filter(id => id !== empId));
                              setChallanBreakups(prev => {
                                const updated = { ...prev };
                                delete updated[empId];
                                return updated;
                              });
                            }}
                            className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition"
                            title="Remove employee"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Wizard Nav buttons */}
          <div className="flex gap-2 justify-between border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setWizardStep(2)}
              className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleSaveChallanAndSubscriptions}
              disabled={!isChallanTotalTallied}
              className={`px-6 py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow flex items-center gap-2 transition-all ${
                isChallanTotalTallied
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer font-bold'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Save & Post Subscriptions</span>
            </button>
          </div>
        </div>
      )}
        </div>
      )}

      {subTab === 'view' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {lang === 'ta' ? 'பதிவேற்றப்பட்ட சலான் & சந்தாக்கள் பட்டியல்' : 'Uploaded Challans & Subscriptions Registry'}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {lang === 'ta' ? 'பதிவேற்றப்பட்ட அனைத்து சலான் விவரங்கள் மற்றும் ஊழியர்களின் மாதாந்திர சந்தாக்களை பார்வையிடலாம் அல்லது திருத்தலாம்.' : 'Browse, view breakups, or edit uploaded challans and associated monthly postings.'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto scrollbar-custom w-full">
              <table className="w-full min-w-[850px] text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 pl-6">Challan No / Date</th>
                    <th className="p-4">Salary Period</th>
                    <th className="p-4">Challan Amount (₹)</th>
                    <th className="p-4">Breakups Match</th>
                    <th className="p-4">Attachment</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-600">
                  {pfChallans.map((ch) => {
                    const totalBreakups = Array.isArray(ch.breakups) 
                      ? ch.breakups.reduce((sum: number, b: any) => sum + (b.subscriptionAmount || 0) + (b.pfLoanRecoveryAmount || 0), 0) 
                      : 0;
                    const matches = Math.abs(totalBreakups - ch.challanAmount) < 0.1;

                    return (
                      <tr key={ch.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 pl-6">
                          <p className="font-bold text-slate-800 font-mono">{ch.challanNo}</p>
                          <span className="text-[10px] text-slate-400 font-mono">{ch.challanDate}</span>
                        </td>
                        <td className="p-4 font-mono font-semibold text-slate-700">
                          {ch.fromMonth} {ch.toMonth && ch.toMonth !== ch.fromMonth ? `to ${ch.toMonth}` : ''}
                        </td>
                        <td className="p-4 font-black text-slate-900 font-mono text-sm">
                          ₹ {ch.challanAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            matches 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-150' 
                              : 'bg-rose-50 text-rose-700 border border-rose-150'
                          }`}>
                            {matches ? 'Tallied' : 'Mismatched'}
                          </span>
                        </td>
                        <td className="p-4">
                          {ch.attachmentUrl ? (
                            <a
                              href={ch.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline font-bold text-[10px] flex items-center gap-1"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span className="max-w-[120px] truncate">{ch.attachmentName || 'View File'}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 font-medium">None</span>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex justify-end gap-1.5 items-center">
                            <button
                              type="button"
                              onClick={() => setViewingChallan(ch)}
                              className="p-1.5 hover:bg-slate-100 text-slate-500 hover:text-slate-700 rounded-lg transition"
                              title="View Breakups"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEditChallanClick(ch)}
                              className="p-1.5 hover:bg-indigo-50 text-indigo-500 hover:text-indigo-600 rounded-lg transition"
                              title="Edit Entries"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteChallan(ch.id)}
                              className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-600 rounded-lg transition"
                              title="Delete Challan"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pfChallans.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-slate-400 italic">
                        {lang === 'ta' ? 'சலான்கள் ஏதும் இல்லை' : 'No uploaded challans found.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW BREAKUPS MODAL */}
      {viewingChallan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl border border-slate-150 max-w-2xl w-full shadow-2xl p-6 space-y-6 max-h-[90vh] overflow-y-auto scrollbar-custom">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {lang === 'ta' ? 'சலான் பங்களிப்பு முறிவு விவரம்' : 'Challan Contribution Breakup'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider font-mono mt-0.5">
                    {viewingChallan.challanNo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingChallan(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block mb-0.5">Challan Date</span>
                <span className="font-bold text-slate-800 font-mono">{viewingChallan.challanDate}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block mb-0.5">Salary Period</span>
                <span className="font-bold text-slate-800 font-mono">{viewingChallan.fromMonth} {viewingChallan.toMonth && viewingChallan.toMonth !== viewingChallan.fromMonth ? `to ${viewingChallan.toMonth}` : ''}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl col-span-2 sm:col-span-1">
                <span className="text-slate-400 block mb-0.5">Challan Amount</span>
                <span className="font-black text-indigo-700 font-mono text-sm">₹ {viewingChallan.challanAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Subscription Amount</th>
                    <th className="p-3">PF Loan Recovery</th>
                    <th className="p-3 text-right">Total Contribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(viewingChallan.breakups || []).map((b: any) => (
                    <tr key={b.employeeId} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <p className="font-bold text-slate-800">{getEmpName(b.employeeId)}</p>
                        <span className="text-[9px] text-slate-400 font-mono font-bold">{b.employeeId}</span>
                      </td>
                      <td className="p-3 font-mono font-medium text-slate-600">₹ {(b.subscriptionAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 font-mono font-medium text-slate-600">₹ {(b.pfLoanRecoveryAmount || 0).toLocaleString('en-IN')}</td>
                      <td className="p-3 text-right font-bold text-slate-800 font-mono">₹ {(b.total || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingChallan(null)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition shadow"
              >
                {lang === 'ta' ? 'மூடு' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT CHALLAN & SUBSCRIPTIONS MODAL */}
      {editingChallan && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-3xl border border-slate-150 max-w-3xl w-full shadow-2xl p-6 space-y-5 max-h-[95vh] overflow-y-auto scrollbar-custom">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {lang === 'ta' ? 'சலான் & சந்தாக்கள் திருத்துதல்' : 'Edit Challan & Monthly Subscriptions'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                    {lang === 'ta' ? 'விவரங்களை திருத்தவும்' : 'Update parameters and contributor breakups'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingChallan(null)}
                className="text-slate-400 hover:text-slate-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan No</label>
                <input
                  type="text"
                  required
                  value={editChallanNo}
                  onChange={(e) => setEditChallanNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none font-mono font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan Date</label>
                <input
                  type="date"
                  required
                  value={editChallanDate}
                  onChange={(e) => setEditChallanDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none font-mono font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Challan Amount (₹)</label>
                <input
                  type="number"
                  required
                  value={editChallanAmount}
                  onChange={(e) => setEditChallanAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none font-mono font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Salary From</label>
                <input
                  type="month"
                  required
                  value={editChallanFromMonth}
                  onChange={(e) => setEditChallanFromMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Salary To (Optional)</label>
                <input
                  type="month"
                  value={editChallanToMonth}
                  onChange={(e) => setEditChallanToMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs outline-none font-mono text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Attachment</label>
                <label className="flex items-center justify-center gap-2 border border-dashed border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-indigo-600 cursor-pointer p-2.5 transition">
                  <Upload className="w-4 h-4" />
                  {isUploading ? (lang === 'ta' ? 'பதிவேற்றப்படுகிறது...' : 'Uploading...') : (editChallanAttachmentName ? 'Change File' : 'Upload File')}
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'challan');
                    }}
                    disabled={isUploading}
                    className="hidden"
                  />
                </label>
                {editChallanAttachmentName && (
                  <p className="text-[9px] text-slate-400 font-medium truncate mt-1">Attached: {editChallanAttachmentName}</p>
                )}
              </div>
            </div>

            {/* Breakups edit section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Contributor Breakup Adjustments</h4>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <select
                    onChange={(e) => {
                      const empId = e.target.value;
                      if (empId && !editSelectedEmployeeIds.includes(empId)) {
                        setEditSelectedEmployeeIds(prev => [...prev, empId]);
                        if (!editChallanBreakups[empId]) {
                          setEditChallanBreakups(prev => ({
                            ...prev,
                            [empId]: { subscriptionAmount: 0, pfLoanRecoveryAmount: 0 }
                          }));
                        }
                      }
                      e.target.value = "";
                    }}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>-- Add Contributor... --</option>
                    {activeEmployees
                      .filter((emp: any) => !editSelectedEmployeeIds.includes(emp.employeeId))
                      .map((emp: any) => (
                        <option key={emp.employeeId} value={emp.employeeId}>
                          {emp.employeeId} - {getEmpName(emp.employeeId)}
                        </option>
                      ))
                    }
                  </select>
                </div>
              </div>

              {/* Tally warning/success for edits */}
              {(() => {
                const editSum = editSelectedEmployeeIds.reduce((sum: number, empId: string) => {
                  const b = editChallanBreakups[empId];
                  return sum + (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0);
                }, 0);
                const isTallied = Math.abs(editSum - (parseFloat(editChallanAmount) || 0)) < 0.1;

                return (
                  <div className={`p-3 rounded-xl border flex justify-between items-center text-xs font-bold ${
                    isTallied ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-amber-50 border-amber-100 text-amber-800'
                  }`}>
                    <span>
                      {isTallied 
                        ? 'Breakup grand total matches Challan Amount!' 
                        : `Breakup mismatch! Difference: ₹ ${Math.abs(editSum - (parseFloat(editChallanAmount) || 0)).toLocaleString('en-IN')}`
                      }
                    </span>
                    <span className="font-mono text-[10px]">
                      Sum: ₹ {editSum.toLocaleString('en-IN')} / ₹ {(parseFloat(editChallanAmount) || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                );
              })()}

              <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[250px] overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100 z-10 shadow-xs">
                    <tr>
                      <th className="p-3">Employee</th>
                      <th className="p-3">Subscription Amount (₹)</th>
                      <th className="p-3">PF Loan Recovery (₹)</th>
                      <th className="p-3 text-right">Total</th>
                      <th className="p-3 text-center w-12">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {editSelectedEmployeeIds.map((empId) => {
                      const b = editChallanBreakups[empId];
                      const rowTotal = (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0);

                      return (
                        <tr key={empId} className="hover:bg-slate-50/50">
                          <td className="p-3 font-medium text-slate-800">
                            <p className="font-bold">{getEmpName(empId)}</p>
                            <span className="text-[10px] text-slate-400 font-mono">{empId}</span>
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={b?.subscriptionAmount || ''}
                              onChange={(e) => handleEditBreakupChange(empId, 'subscriptionAmount', e.target.value)}
                              className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs outline-none w-28 font-mono text-slate-800"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="number"
                              value={b?.pfLoanRecoveryAmount || ''}
                              onChange={(e) => handleEditBreakupChange(empId, 'pfLoanRecoveryAmount', e.target.value)}
                              className="border border-slate-200 bg-white rounded-lg px-2 py-1 text-xs outline-none w-28 font-mono text-slate-800"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3 text-right font-bold text-slate-800 font-mono">
                            ₹ {rowTotal.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditSelectedEmployeeIds(prev => prev.filter(id => id !== empId));
                                setEditChallanBreakups(prev => {
                                  const updated = { ...prev };
                                  delete updated[empId];
                                  return updated;
                                });
                              }}
                              className="p-1 hover:bg-rose-50 text-rose-500 rounded-lg transition"
                              title="Remove Employee"
                            >
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEditingChallan(null)}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
              >
                {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSaveEditedChallan}
                disabled={isUploading}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition"
              >
                {lang === 'ta' ? 'சேமி' : 'Save Updates'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
