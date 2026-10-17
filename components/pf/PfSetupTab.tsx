'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coins, 
  AlertCircle, 
  CheckCircle, 
  Check, 
  AlertTriangle, 
  Edit2, 
  Trash2,
  FileText,
  Plus,
  X
} from 'lucide-react';
import { Language } from '../translations';
import { PfEmployee, OfficePfSetup, IneligibleReferenceDetail } from './PfUtils';

interface PfSetupTabProps {
  employees: any[];
  pfEmployees: PfEmployee[];
  currentOfficeSetup: OfficePfSetup | null;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function PfSetupTab({
  employees,
  pfEmployees,
  currentOfficeSetup,
  lang,
  onSaveCollection
}: PfSetupTabProps) {
  const [officeOpeningDate, setOfficeOpeningDate] = useState<string>(() => currentOfficeSetup?.openingDate || '2023-04-01');
  const [officeOpeningBalance, setOfficeOpeningBalance] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.officeOpeningBalance || '') : '');
  const [retiredEmployeeAmount, setRetiredEmployeeAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.retiredEmployeeAmount || '0') : '0');
  const [deathEmployeeAmount, setDeathEmployeeAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.deathEmployeeAmount || '0') : '0');
  const [otherIneligibleAmount, setOtherIneligibleAmount] = useState<string>(() => currentOfficeSetup ? String(currentOfficeSetup.otherIneligibleAmount || '0') : '0');
  
  // Reference-only details arrays
  const [retiredDetails, setRetiredDetails] = useState<IneligibleReferenceDetail[]>(() => currentOfficeSetup?.retiredEmployeeDetails || []);
  const [deathDetails, setDeathDetails] = useState<IneligibleReferenceDetail[]>(() => currentOfficeSetup?.deathEmployeeDetails || []);
  const [otherDetails, setOtherDetails] = useState<IneligibleReferenceDetail[]>(() => currentOfficeSetup?.otherIneligibleDetails || []);

  // Modal states for Reference Details
  const [activeDetailsCategory, setActiveDetailsCategory] = useState<'retired' | 'death' | 'other' | null>(null);
  const [detailName, setDetailName] = useState<string>('');
  const [detailDesignation, setDetailDesignation] = useState<string>('');
  const [detailAmount, setDetailAmount] = useState<string>('');
  const [detailInterest, setDetailInterest] = useState<string>('');
  const [detailError, setDetailError] = useState<string>('');

  const [breakupEmpId, setBreakupEmpId] = useState<string>('');
  const [breakupAmount, setBreakupAmount] = useState<string>('');
  const [officeBreakups, setOfficeBreakups] = useState<{ employeeId: string; amount: number }[]>(() => currentOfficeSetup?.breakups || []);

  const [setupError, setSetupError] = useState<string>('');
  const [setupSuccess, setSetupSuccess] = useState<string>('');

  const [prevOfficeSetup, setPrevOfficeSetup] = useState<any>(currentOfficeSetup);

  if (currentOfficeSetup !== prevOfficeSetup) {
    setPrevOfficeSetup(currentOfficeSetup);
    setOfficeOpeningDate(currentOfficeSetup?.openingDate || '2023-04-01');
    setOfficeOpeningBalance(currentOfficeSetup ? String(currentOfficeSetup.officeOpeningBalance || '') : '');
    setRetiredEmployeeAmount(currentOfficeSetup ? String(currentOfficeSetup.retiredEmployeeAmount || '0') : '0');
    setDeathEmployeeAmount(currentOfficeSetup ? String(currentOfficeSetup.deathEmployeeAmount || '0') : '0');
    setOtherIneligibleAmount(currentOfficeSetup ? String(currentOfficeSetup.otherIneligibleAmount || '0') : '0');
    setRetiredDetails(currentOfficeSetup?.retiredEmployeeDetails || []);
    setDeathDetails(currentOfficeSetup?.deathEmployeeDetails || []);
    setOtherDetails(currentOfficeSetup?.otherIneligibleDetails || []);
    setOfficeBreakups(currentOfficeSetup?.breakups || []);
  }

  // Derive amounts based on entered details if present, or fallback to manual state
  const derivedRetiredAmount = useMemo(() => {
    if (retiredDetails.length > 0) {
      return String(retiredDetails.reduce((s, i) => s + i.amount + (i.interest || 0), 0));
    }
    return retiredEmployeeAmount;
  }, [retiredDetails, retiredEmployeeAmount]);

  const derivedDeathAmount = useMemo(() => {
    if (deathDetails.length > 0) {
      return String(deathDetails.reduce((s, i) => s + i.amount + (i.interest || 0), 0));
    }
    return deathEmployeeAmount;
  }, [deathDetails, deathEmployeeAmount]);

  const derivedOtherAmount = useMemo(() => {
    if (otherDetails.length > 0) {
      return String(otherDetails.reduce((s, i) => s + i.amount + (i.interest || 0), 0));
    }
    return otherIneligibleAmount;
  }, [otherDetails, otherIneligibleAmount]);

  // Actual eligible amount = opening balance - deductions
  const actualEligibleAmount = useMemo(() => {
    const ob = parseFloat(officeOpeningBalance) || 0;
    const ret = parseFloat(derivedRetiredAmount) || 0;
    const dth = parseFloat(derivedDeathAmount) || 0;
    const inel = parseFloat(derivedOtherAmount) || 0;
    return Math.max(0, ob - ret - dth - inel);
  }, [officeOpeningBalance, derivedRetiredAmount, derivedDeathAmount, derivedOtherAmount]);

  const totalBreakupAmount = useMemo(() => {
    return officeBreakups.reduce((sum, item) => sum + item.amount, 0);
  }, [officeBreakups]);

  const isBreakupTallied = useMemo(() => {
    return Math.abs(actualEligibleAmount - totalBreakupAmount) < 0.01;
  }, [actualEligibleAmount, totalBreakupAmount]);

  const getEmpName = (empId: string): string => {
    const emp = employees.find((e: any) => e.employeeId === empId || e.id === empId);
    if (!emp) return empId;
    return lang === 'ta' ? (emp.nameTa || emp.nameEn) : (emp.nameEn || emp.nameTa);
  };

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

  const handleOpenDetails = (category: 'retired' | 'death' | 'other') => {
    setActiveDetailsCategory(category);
    setDetailName('');
    setDetailDesignation('');
    setDetailAmount('');
    setDetailInterest('');
    setDetailError('');
  };

  const handleAddDetail = (e: React.FormEvent) => {
    e.preventDefault();
    setDetailError('');
    if (!detailName.trim()) {
      setDetailError(lang === 'ta' ? 'பெயரை உள்ளிடவும்' : 'Please enter name');
      return;
    }
    const amt = parseFloat(detailAmount);
    if (isNaN(amt) || amt < 0) {
      setDetailError(lang === 'ta' ? 'முறையான தொகையை உள்ளிடவும்' : 'Please enter a valid amount');
      return;
    }
    const intAmt = parseFloat(detailInterest) || 0;

    const newRecord: IneligibleReferenceDetail = {
      id: `det_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: detailName.trim(),
      designation: detailDesignation.trim() || '--',
      amount: amt,
      interest: intAmt
    };

    if (activeDetailsCategory === 'retired') {
      const next = [...retiredDetails, newRecord];
      setRetiredDetails(next);
      setRetiredEmployeeAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    } else if (activeDetailsCategory === 'death') {
      const next = [...deathDetails, newRecord];
      setDeathDetails(next);
      setDeathEmployeeAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    } else if (activeDetailsCategory === 'other') {
      const next = [...otherDetails, newRecord];
      setOtherDetails(next);
      setOtherIneligibleAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    }

    setDetailName('');
    setDetailDesignation('');
    setDetailAmount('');
    setDetailInterest('');
  };

  const handleDeleteDetail = (category: 'retired' | 'death' | 'other', id: string) => {
    if (category === 'retired') {
      const next = retiredDetails.filter(d => d.id !== id);
      setRetiredDetails(next);
      setRetiredEmployeeAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    } else if (category === 'death') {
      const next = deathDetails.filter(d => d.id !== id);
      setDeathDetails(next);
      setDeathEmployeeAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    } else if (category === 'other') {
      const next = otherDetails.filter(d => d.id !== id);
      setOtherDetails(next);
      setOtherIneligibleAmount(String(next.reduce((s, i) => s + i.amount, 0)));
    }
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
      retiredEmployeeAmount: parseFloat(derivedRetiredAmount) || 0,
      deathEmployeeAmount: parseFloat(derivedDeathAmount) || 0,
      otherIneligibleAmount: parseFloat(derivedOtherAmount) || 0,
      actualEligibleAmount,
      retiredEmployeeDetails: retiredDetails,
      deathEmployeeDetails: deathDetails,
      otherIneligibleDetails: otherDetails,
      breakups: officeBreakups
    };

    // Save office central configuration
    await onSaveCollection('officePfSetup', [setupObj]);

    // Save individual employee opening balances in pfEmployees
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

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Office Setup Form Container */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <Coins className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {lang === 'ta' ? 'அலுவலக ஆரம்ப இருப்பு' : 'Office Opening Balance'}
          </h2>
        </div>

        {setupError && (
          <div className="p-3.5 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{setupError}</span>
          </div>
        )}

        {setupSuccess && (
          <div className="p-3.5 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-100">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{setupSuccess}</span>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தொடக்க தேதி' : 'Opening Date'}</label>
            <input
              type="date"
              required
              value={officeOpeningDate}
              onChange={(e) => setOfficeOpeningDate(e.target.value)}
              className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'மொத்த ஆரம்ப இருப்பு (₹)' : 'Total Office Opening Balance (₹)'}</label>
            <input
              type="number"
              required
              placeholder="e.g. 500000"
              value={officeOpeningBalance}
              onChange={(e) => setOfficeOpeningBalance(e.target.value)}
              className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் தொகை (₹)' : 'Retired Employee Amount (₹)'}</label>
              {retiredDetails.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {retiredDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="e.g. 100000"
                value={derivedRetiredAmount}
                onChange={(e) => setRetiredEmployeeAmount(e.target.value)}
                readOnly={retiredDetails.length > 0}
                className={`w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono ${retiredDetails.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed font-bold' : ''}`}
                title={retiredDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
              />
              <button
                type="button"
                onClick={() => handleOpenDetails('retired')}
                className="px-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-xs"
                title={lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் விவரங்கள்' : 'Retired employee details'}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>{lang === 'ta' ? 'விவரங்கள்' : 'Enter Details'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'மரணித்த ஊழியர் தொகை (₹)' : 'Death Employee Amount (₹)'}</label>
              {deathDetails.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {deathDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="e.g. 50000"
                value={derivedDeathAmount}
                onChange={(e) => setDeathEmployeeAmount(e.target.value)}
                readOnly={deathDetails.length > 0}
                className={`w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono ${deathDetails.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed font-bold' : ''}`}
                title={deathDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
              />
              <button
                type="button"
                onClick={() => handleOpenDetails('death')}
                className="px-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-xs"
                title={lang === 'ta' ? 'மரணித்த ஊழியர் விவரங்கள்' : 'Death employee details'}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>{lang === 'ta' ? 'விவரங்கள்' : 'Enter Details'}</span>
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தகுதியற்ற இதர தொகை (₹)' : 'Other Ineligible Amount (₹)'}</label>
              {otherDetails.length > 0 && (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                  {otherDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="e.g. 20000"
                value={derivedOtherAmount}
                onChange={(e) => setOtherIneligibleAmount(e.target.value)}
                readOnly={otherDetails.length > 0}
                className={`w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono ${otherDetails.length > 0 ? 'bg-slate-50 text-slate-500 cursor-not-allowed font-bold' : ''}`}
                title={otherDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
              />
              <button
                type="button"
                onClick={() => handleOpenDetails('other')}
                className="px-3 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 border border-slate-200 rounded-2xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 shadow-xs"
                title={lang === 'ta' ? 'இதர தகுதியற்ற விவரங்கள்' : 'Other ineligible details'}
              >
                <FileText className="w-3.5 h-3.5 text-indigo-500" />
                <span>{lang === 'ta' ? 'விவரங்கள்' : 'Enter Details'}</span>
              </button>
            </div>
          </div>

          {/* Dynamic Auto Calculated Eligible Amount Card */}
          <div className="bg-indigo-50/70 border border-indigo-100 p-4 rounded-2xl space-y-1 text-center">
            <span className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider">Actual Eligible Amount for Interest Calculation</span>
            <p className="text-xl font-black text-indigo-900 font-mono">
              ₹ {actualEligibleAmount.toLocaleString('en-IN')}
            </p>
            <p className="text-[10px] text-slate-400 font-medium">Calculated after deducting Retired, Death & Ineligible amounts.</p>
          </div>

          <button
            type="button"
            onClick={handleSaveOfficeSetup}
            disabled={!isBreakupTallied}
            className={`w-full py-3.5 rounded-2xl text-xs font-bold uppercase tracking-wider shadow transition-all ${
              isBreakupTallied 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer' 
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {lang === 'ta' ? 'அலுவலக அமைப்பை சேமி' : 'Save Office Setup'}
          </button>
        </div>
      </div>

      {/* Employee-wise Breakup Section */}
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
        <div>
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
            {lang === 'ta' ? 'ஊழியர் வாரியான ஒதுக்கீடு' : 'Employee-wise Breakup Entry'}
          </h3>
          <p className="text-xs text-slate-500 mt-1">Add individual employee opening balances to map against the Actual Eligible Amount.</p>
        </div>

        {/* Quick adding breakup item */}
        <form onSubmit={handleAddOfficeBreakup} className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஊழியர்' : 'Choose Employee'}</label>
            <select
              value={breakupEmpId}
              onChange={(e) => {
                const empId = e.target.value;
                setBreakupEmpId(empId);
                if (empId) {
                  const remaining = Math.max(0, actualEligibleAmount - totalBreakupAmount);
                  setBreakupAmount(String(remaining > 0 ? remaining : ''));
                } else {
                  setBreakupAmount('');
                }
              }}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-300 outline-none"
            >
              <option value="">{lang === 'ta' ? '-- தேர்ந்தெடு --' : '-- Choose Employee --'}</option>
              {employees
                .filter((e: any) => !officeBreakups.some((ob) => ob.employeeId === e.employeeId))
                .map((e: any) => (
                  <option key={e.id} value={e.employeeId}>
                    {e.employeeId} - {getEmpName(e.employeeId)}
                  </option>
                ))
              }
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தொகை (₹)' : 'Eligible Balance Amount (₹)'}</label>
            <input
              type="number"
              placeholder="e.g. 50000"
              value={breakupAmount}
              onChange={(e) => setBreakupAmount(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-300 outline-none font-mono"
            />
          </div>

          <button
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase rounded-xl py-2 self-end shadow-sm"
          >
            {lang === 'ta' ? 'பட்டியலில் சேர்' : 'Add to List'}
          </button>
        </form>

        {/* Tally Verification Banner */}
        <div className={`p-4 rounded-2xl border flex items-center justify-between text-xs font-semibold ${
          isBreakupTallied 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-amber-50 border-amber-100 text-amber-800'
        }`}>
          <div className="flex items-center gap-2">
            {isBreakupTallied ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />}
            <span>
              {isBreakupTallied 
                ? (lang === 'ta' ? 'ஒதுக்கீடு தாள்களுடன் சரியாக பொருந்தியது!' : 'Breakup completely tallied with Actual Eligible Amount!')
                : (lang === 'ta' ? `தவறான ஒதுக்கீடு! வித்தியாசம்: ₹${Math.abs(actualEligibleAmount - totalBreakupAmount).toLocaleString('en-IN')}` : `Breakup does not match! Difference: ₹${Math.abs(actualEligibleAmount - totalBreakupAmount).toLocaleString('en-IN')}`)
              }
            </span>
          </div>
          <div className="text-right font-mono text-[11px] font-bold">
            Total entered: ₹ {totalBreakupAmount.toLocaleString('en-IN')} / ₹ {actualEligibleAmount.toLocaleString('en-IN')}
          </div>
        </div>

        {/* Breakups List Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-100">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="p-4">Employee ID</th>
                <th className="p-4">Employee Name</th>
                <th className="p-4 font-mono text-right">Eligible Balance</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {officeBreakups.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-slate-400 font-medium">
                    {lang === 'ta' ? 'இதுவரை எந்தவொரு ஊழியர் ஒதுக்கீடுகளும் இல்லை.' : 'No employee breakups added yet.'}
                  </td>
                </tr>
              ) : (
                officeBreakups.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-4 font-mono font-bold text-slate-700">{item.employeeId}</td>
                    <td className="p-4">{getEmpName(item.employeeId)}</td>
                    <td className="p-4 font-mono text-right font-bold text-indigo-700">₹ {item.amount.toLocaleString('en-IN')}</td>
                    <td className="p-4 text-center flex items-center justify-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setBreakupEmpId(item.employeeId);
                          setBreakupAmount(String(item.amount));
                          handleRemoveBreakup(item.employeeId);
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveBreakup(item.employeeId)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>

      {/* Reference Details Modal for Retired / Death / Other Ineligible */}
      {activeDetailsCategory && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">
                    {activeDetailsCategory === 'retired' && (lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Retired Employee Details (Reference Only)')}
                    {activeDetailsCategory === 'death' && (lang === 'ta' ? 'மரணித்த ஊழியர் விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Death Employee Details (Reference Only)')}
                    {activeDetailsCategory === 'other' && (lang === 'ta' ? 'இதர தகுதியற்ற விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Other Ineligible Details (Reference Only)')}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {lang === 'ta' 
                      ? 'இவ்விவரங்கள் குறிப்பு நோக்கத்திற்காக மட்டுமே; புதிய ஊழியர் சுயவிவரங்கள் உருவாக்கப்படாது.' 
                      : 'These details are for reference only; no new employee accounts will be created.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDetailsCategory(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-200 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {detailError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              {/* Add form */}
              <form onSubmit={handleAddDetail} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'பெயர்' : 'Employee Name'} *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === 'ta' ? 'பெயர் உள்ளிடவும்' : 'e.g. S. Murugan'}
                      value={detailName}
                      onChange={(e) => setDetailName(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'பதவி' : 'Designation'}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === 'ta' ? 'பதவி உள்ளிடவும்' : 'e.g. Assistant Engineer'}
                      value={detailDesignation}
                      onChange={(e) => setDetailDesignation(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'தொகை (₹)' : 'Principal Amount (₹)'} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 25000"
                      value={detailAmount}
                      onChange={(e) => setDetailAmount(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold"
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {lang === 'ta' ? 'வட்டி (₹)' : 'Interest (₹)'}
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1500"
                      value={detailInterest}
                      onChange={(e) => setDetailInterest(e.target.value)}
                      className="w-full border border-slate-200 bg-white rounded-xl p-2.5 text-xs focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                    />
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider shadow-xs transition flex items-center justify-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{lang === 'ta' ? 'சேர்' : 'Add Detail'}</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Records Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    {lang === 'ta' ? 'பதிவு செய்யப்பட்ட விவரங்கள்' : 'Entered Reference Records'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length} {lang === 'ta' ? 'பதிவுகள்' : 'entries'}
                  </span>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200 sticky top-0 bg-white">
                        <th className="p-3">#</th>
                        <th className="p-3">{lang === 'ta' ? 'பெயர்' : 'Name'}</th>
                        <th className="p-3">{lang === 'ta' ? 'பதவி' : 'Designation'}</th>
                        <th className="p-3 font-mono text-right">{lang === 'ta' ? 'தொகை (₹)' : 'Amount (₹)'}</th>
                        <th className="p-3 font-mono text-right">{lang === 'ta' ? 'வட்டி (₹)' : 'Interest (₹)'}</th>
                        <th className="p-3 font-mono text-right">{lang === 'ta' ? 'மொத்தம் (₹)' : 'Total (₹)'}</th>
                        <th className="p-3 text-center">{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                            {lang === 'ta' ? 'இன்னும் எந்த விவரங்களும் சேர்க்கப்படவில்லை.' : 'No reference details added yet.'}
                          </td>
                        </tr>
                      ) : (
                        ((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).map((rec, idx) => (
                          <tr key={rec.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                            <td className="p-3 font-semibold text-slate-800">{rec.name}</td>
                            <td className="p-3 text-slate-500">{rec.designation}</td>
                            <td className="p-3 font-mono text-right font-bold text-slate-700">₹ {rec.amount.toLocaleString('en-IN')}</td>
                            <td className="p-3 font-mono text-right text-emerald-600">₹ {(rec.interest || 0).toLocaleString('en-IN')}</td>
                            <td className="p-3 font-mono text-right font-bold text-indigo-900">₹ {(rec.amount + (rec.interest || 0)).toLocaleString('en-IN')}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteDetail(activeDetailsCategory, rec.id)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                                title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length > 0 && (
                      <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="p-3 text-right uppercase text-[10px] text-slate-600">
                            {lang === 'ta' ? 'மொத்தம்' : 'Total'}
                          </td>
                          <td className="p-3 font-mono text-right text-indigo-700">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 font-mono text-right text-emerald-700">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + (i.interest || 0), 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 font-mono text-right text-indigo-950 font-black">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + i.amount + (i.interest || 0), 0).toLocaleString('en-IN')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {lang === 'ta' ? 'தொகை தானாகவே படிவத்தில் புதுப்பிக்கப்பட்டது.' : 'Amount is automatically updated in the setup form.'}
              </span>
              <button
                type="button"
                onClick={() => setActiveDetailsCategory(null)}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                {lang === 'ta' ? 'முடிந்தது' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
