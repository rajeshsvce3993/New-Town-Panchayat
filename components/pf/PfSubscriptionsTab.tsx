'use client';
import ThemeSelect from '../ThemeSelect';

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
    <div className="space-y-3">
      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <button
            type="button"
            onClick={() => setSubTab('create')}
            className={`portal-dash-pill ${subTab === 'create' ? 'is-active' : ''}`}
          >
            {lang === 'ta' ? 'புதிய சந்தா பதிவேற்றம்' : 'Post New Subscriptions'}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('view')}
            className={`portal-dash-pill ${subTab === 'view' ? 'is-active' : ''}`}
          >
            {lang === 'ta' ? 'பதிவேற்றப்பட்ட சந்தாக்கள் காண்க/திருத்துக' : 'View & Edit Uploaded Subscriptions'}
          </button>
        </div>
      </div>

      {subTab === 'create' && (
        <div className="space-y-3">
      <div className="portal-dash-toolbar">
        <div className="portal-dash-pills">
          <span className={`portal-dash-pill ${wizardStep === 1 ? 'is-active' : ''}`}>1. {lang === 'ta' ? 'சலான்' : 'Challan'}</span>
          <span className={`portal-dash-pill ${wizardStep === 2 ? 'is-active' : ''}`}>2. {lang === 'ta' ? 'சம்பள மாதம்' : 'Salary month'}</span>
          <span className={`portal-dash-pill ${wizardStep === 3 ? 'is-active' : ''}`}>3. {lang === 'ta' ? 'பிரிப்பு' : 'Breakup'}</span>
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

      {wizardStep === 1 && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>{lang === 'ta' ? 'சலான் விவரங்களை உள்ளிடவும்' : 'Step 1: Challan details'}</h3>
            </div>
          </div>
          <div className="portal-dash-body portal-wt-form">
            <div>
              <label>Challan Number</label>
              <input
                type="text"
                required
                placeholder="e.g. CHN-2026/894"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
              />
            </div>
            <div>
              <label>Challan Date</label>
              <input
                type="date"
                required
                value={challanDate}
                onChange={(e) => setChallanDate(e.target.value)}
              />
            </div>
            <div>
              <label>Challan Amount (₹)</label>
              <input
                type="number"
                required
                placeholder="e.g. 12000"
                value={challanAmount}
                onChange={(e) => setChallanAmount(e.target.value)}
              />
            </div>

            <div>
              <label>
                {lang === 'ta' ? 'சலான் கோப்பு இணைப்பு (அதிகபட்சம் 2MB)' : 'Challan file (PDF, JPG/PNG — max 2MB)'}
              </label>
              {challanUploadError && <p className="text-[10px] text-rose-600 font-bold mb-1">{challanUploadError}</p>}
              <div className="portal-file-pick" style={{ position: 'relative' }}>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'challan');
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span>{challanAttachmentName || (lang === 'ta' ? 'கோப்பைத் தேர்வு' : 'Choose file')}</span>
                {challanAttachmentUrl && <span className="portal-dash-status is-resolved">Uploaded</span>}
              </div>
            </div>

            <button
              type="submit"
              onClick={handleNextStep1}
              disabled={!challanNo || !challanDate || !challanAmount || !challanAttachmentUrl || isUploading}
            >
              {lang === 'ta' ? 'அடுத்த கட்டம்' : 'Next Step'}
            </button>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>{lang === 'ta' ? 'சம்பளம் பிடிக்கப்பட்ட காலம்' : 'Step 2: Salary deduction period'}</h3>
              <p>Select salary months linked with this challan.</p>
            </div>
          </div>
          <div className="portal-dash-body portal-wt-form">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label>Salary Month From</label>
                <input
                  type="month"
                  required
                  value={challanFromMonth}
                  onChange={(e) => setChallanFromMonth(e.target.value)}
                />
              </div>
              <div>
                <label>Salary Month To (Optional)</label>
                <input
                  type="month"
                  value={challanToMonth}
                  onChange={(e) => setChallanToMonth(e.target.value)}
                />
                <p className="portal-switch-hint">Leave empty to post as a single month.</p>
              </div>
            </div>
            <div className="portal-wt-section">
              <div className="portal-wt-section-title">Computed months</div>
              <div className="portal-wt-chips">
                {selectedMonthsList.map((m, idx) => (
                  <span key={idx} className="portal-wt-chip">{m}</span>
                ))}
              </div>
              <p className="portal-switch-hint" style={{ marginTop: '0.35rem' }}>
                Subscriptions will be registered for {selectedMonthsList.length} month(s).
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setWizardStep(1)} className="portal-wt-link">
                Back
              </button>
              <button type="submit" onClick={handleNextStep2}>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>{lang === 'ta' ? 'ஊழியர் சந்தா விவரங்கள்' : 'Step 3: Employee-wise contribution breakups'}</h3>
              <p>Choose employees and enter subscription or PF loan recovery amounts.</p>
            </div>
          </div>
          <div className="portal-dash-body portal-wt-form">
          <div className="portal-dash-fields" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
            <div>
              <label>{lang === 'ta' ? 'ஊழியரைத் தேர்ந்தெடுக்கவும்' : 'Select Employee'}</label>
              <ThemeSelect
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
                  e.target.value = "";
                }}
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
              </ThemeSelect>
            </div>
            <div>
              <label>&nbsp;</label>
              <button
                type="button"
                className="portal-dash-head-action"
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
              >
                {lang === 'ta' ? 'அனைத்து ஊழியர்களையும் சேர்க்கவும்' : 'Add All Active Employees'}
              </button>
            </div>
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
            <p className="portal-wt-note">No employees selected. Choose an employee above to enter contribution breakups.</p>
          ) : (
            <div className="portal-dash-table overflow-x-auto" style={{ maxHeight: '400px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Subscription Amt (₹)</th>
                    <th>PF Loan Recovery (₹)</th>
                    <th>Individual Total</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedBreakupEmployeeIds.map((empId) => {
                    const b = challanBreakups[empId];
                    const totalIndiv = (b?.subscriptionAmount || 0) + (b?.pfLoanRecoveryAmount || 0);

                    return (
                      <tr key={empId}>
                        <td>
                          <div className="portal-user-identity">
                            <strong>{getEmpName(empId)}</strong>
                            <span className="portal-dash-id">{empId}</span>
                          </div>
                        </td>
                        <td>
                          <input
                            type="number"
                            placeholder="0"
                            value={b?.subscriptionAmount || ''}
                            onChange={(e) => handleBreakupChange(empId, 'subscriptionAmount', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            placeholder="0"
                            value={b?.pfLoanRecoveryAmount || ''}
                            onChange={(e) => handleBreakupChange(empId, 'pfLoanRecoveryAmount', e.target.value)}
                          />
                        </td>
                        <td className="portal-dash-num">₹ {totalIndiv.toLocaleString('en-IN')}</td>
                        <td>
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
                            className="portal-fis-icon-btn is-danger"
                            title="Remove employee"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2">
            <button type="button" onClick={() => setWizardStep(2)} className="portal-wt-link">
              Back
            </button>
            <button
              type="submit"
              onClick={handleSaveChallanAndSubscriptions}
              disabled={!isChallanTotalTallied}
            >
              Save & Post Subscriptions
            </button>
          </div>
          </div>
        </div>
      )}
        </div>
      )}

      {subTab === 'view' && (
        <div className="portal-dashboard-panel">
          <div className="portal-dash-head">
            <div>
              <h3>{lang === 'ta' ? 'பதிவேற்றப்பட்ட சலான் & சந்தாக்கள் பட்டியல்' : 'Uploaded Challans & Subscriptions Registry'}</h3>
              <p>{lang === 'ta' ? 'பதிவேற்றப்பட்ட அனைத்து சலான் விவரங்கள் மற்றும் ஊழியர்களின் மாதாந்திர சந்தாக்களை பார்வையிடலாம் அல்லது திருத்தலாம்.' : 'Browse, view breakups, or edit uploaded challans and associated monthly postings.'}</p>
            </div>
          </div>
          <div className="portal-dash-body">
          <div className="portal-dash-table overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Challan No / Date</th>
                    <th>Salary Period</th>
                    <th>Challan Amount (₹)</th>
                    <th>Breakups Match</th>
                    <th>Attachment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pfChallans.map((ch) => {
                    const totalBreakups = Array.isArray(ch.breakups) 
                      ? ch.breakups.reduce((sum: number, b: any) => sum + (b.subscriptionAmount || 0) + (b.pfLoanRecoveryAmount || 0), 0) 
                      : 0;
                    const matches = Math.abs(totalBreakups - ch.challanAmount) < 0.1;

                    return (
                      <tr key={ch.id}>
                        <td>
                          <div className="portal-user-identity">
                            <strong>{ch.challanNo}</strong>
                            <span className="portal-dash-id">{ch.challanDate}</span>
                          </div>
                        </td>
                        <td>
                          {ch.fromMonth} {ch.toMonth && ch.toMonth !== ch.fromMonth ? `to ${ch.toMonth}` : ''}
                        </td>
                        <td className="portal-dash-num">₹ {ch.challanAmount.toLocaleString('en-IN')}</td>
                        <td>
                          <span className={`portal-dash-status ${matches ? 'is-resolved' : 'is-pending'}`}>
                            {matches ? 'Tallied' : 'Mismatched'}
                          </span>
                        </td>
                        <td>
                          {ch.attachmentUrl ? (
                            <a href={ch.attachmentUrl} target="_blank" rel="noreferrer" className="portal-wt-link">
                              {ch.attachmentName || 'View File'}
                            </a>
                          ) : (
                            <span className="portal-wt-meta">None</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => setViewingChallan(ch)} className="portal-fis-icon-btn" title="View Breakups">
                              <Eye className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => handleEditChallanClick(ch)} className="portal-fis-icon-btn" title="Edit Entries">
                              <Edit className="h-3 w-3" />
                            </button>
                            <button type="button" onClick={() => handleDeleteChallan(ch.id)} className="portal-fis-icon-btn is-danger" title="Delete Challan">
                              <Trash2 className="h-3 w-3" />
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

      {viewingChallan && (
        <div className="portal-modal-overlay is-top">
          <div className="portal-modal max-w-2xl w-full overflow-y-auto">
            <div className="portal-dash-head">
              <div>
                <h3>{lang === 'ta' ? 'சலான் பங்களிப்பு முறிவு விவரம்' : 'Challan Contribution Breakup'}</h3>
                <p>{viewingChallan.challanNo}</p>
              </div>
              <button type="button" onClick={() => setViewingChallan(null)} className="portal-dash-head-action">
                <X className="h-3 w-3" />
                {lang === 'ta' ? 'மூடு' : 'Close'}
              </button>
            </div>
            <div className="portal-dash-body">

            <div className="portal-dash-fields" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginBottom: '0.75rem' }}>
              <div>
                <label>Challan Date</label>
                <p className="portal-dash-id">{viewingChallan.challanDate}</p>
              </div>
              <div>
                <label>Salary Period</label>
                <p className="portal-dash-id">{viewingChallan.fromMonth} {viewingChallan.toMonth && viewingChallan.toMonth !== viewingChallan.fromMonth ? `to ${viewingChallan.toMonth}` : ''}</p>
              </div>
              <div>
                <label>Challan Amount</label>
                <p className="portal-dash-num">₹ {viewingChallan.challanAmount.toLocaleString('en-IN')}</p>
              </div>
            </div>

            <div className="portal-dash-table overflow-x-auto">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Subscription Amount</th>
                    <th>PF Loan Recovery</th>
                    <th>Total Contribution</th>
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
            </div>
          </div>
        </div>
      )}

      {editingChallan && (
        <div className="portal-modal-overlay is-top">
          <div className="portal-modal max-w-3xl w-full overflow-y-auto">
            <div className="portal-dash-head">
              <div>
                <h3>{lang === 'ta' ? 'சலான் & சந்தாக்கள் திருத்துதல்' : 'Edit Challan & Monthly Subscriptions'}</h3>
                <p>{lang === 'ta' ? 'விவரங்களை திருத்தவும்' : 'Update parameters and contributor breakups'}</p>
              </div>
              <button type="button" onClick={() => setEditingChallan(null)} className="portal-dash-head-action">
                <X className="h-3 w-3" />
                {lang === 'ta' ? 'ரத்து' : 'Cancel'}
              </button>
            </div>
            <div className="portal-dash-body portal-wt-form">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label>Challan No</label>
                <input type="text" required value={editChallanNo} onChange={(e) => setEditChallanNo(e.target.value)} />
              </div>
              <div>
                <label>Challan Date</label>
                <input type="date" required value={editChallanDate} onChange={(e) => setEditChallanDate(e.target.value)} />
              </div>
              <div>
                <label>Challan Amount (₹)</label>
                <input type="number" required value={editChallanAmount} onChange={(e) => setEditChallanAmount(e.target.value)} />
              </div>
              <div>
                <label>Salary From</label>
                <input type="month" required value={editChallanFromMonth} onChange={(e) => setEditChallanFromMonth(e.target.value)} />
              </div>
              <div>
                <label>Salary To (Optional)</label>
                <input type="month" value={editChallanToMonth} onChange={(e) => setEditChallanToMonth(e.target.value)} />
              </div>
              <div>
                <label>Attachment</label>
                <div className="portal-file-pick">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file, 'challan');
                    }}
                    disabled={isUploading}
                    className="hidden"
                    id="edit-challan-file-input"
                  />
                  <label htmlFor="edit-challan-file-input" className="portal-wt-link inline-flex items-center gap-1.5 cursor-pointer">
                    {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    <span>{isUploading ? (lang === 'ta' ? 'பதிவேற்றப்படுகிறது...' : 'Uploading...') : (editChallanAttachmentName ? 'Change File' : 'Upload File')}</span>
                  </label>
                  {editChallanAttachmentName && (
                    <span className="truncate font-mono text-[11px] text-slate-500">{editChallanAttachmentName}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Breakups edit section */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Contributor Breakup Adjustments</h4>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <ThemeSelect
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
                  </ThemeSelect>
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

              <div className="portal-dash-table overflow-x-auto" style={{ maxHeight: '250px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Subscription Amount (₹)</th>
                      <th>PF Loan Recovery (₹)</th>
                      <th>Total</th>
                      <th>Action</th>
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

            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingChallan(null)} className="portal-wt-link">
                {lang === 'ta' ? 'ரத்து செய்' : 'Cancel'}
              </button>
              <button type="submit" onClick={handleSaveEditedChallan} disabled={isUploading}>
                {lang === 'ta' ? 'சேமி' : 'Save Updates'}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
