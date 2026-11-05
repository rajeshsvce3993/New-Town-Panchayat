'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Coins, 
  AlertCircle, 
  CheckCircle, 
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
      <div className="portal-wt-grid">
      <div className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>
              <span className="portal-dash-icon">
                <Coins className="h-3 w-3" />
              </span>
              {lang === 'ta' ? 'அலுவலக ஆரம்ப இருப்பு' : 'Office Opening Balance'}
            </h3>
          </div>
        </div>
        <div className="portal-dash-body portal-wt-form">

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

        <div>
          <label>{lang === 'ta' ? 'தொடக்க தேதி' : 'Opening Date'}</label>
          <input
            type="date"
            required
            value={officeOpeningDate}
            onChange={(e) => setOfficeOpeningDate(e.target.value)}
          />
        </div>
        <div>
          <label>{lang === 'ta' ? 'மொத்த ஆரம்ப இருப்பு (₹)' : 'Total Office Opening Balance (₹)'}</label>
          <input
            type="number"
            required
            placeholder="e.g. 500000"
            value={officeOpeningBalance}
            onChange={(e) => setOfficeOpeningBalance(e.target.value)}
          />
        </div>
        <div>
          <label>
            {lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் தொகை (₹)' : 'Retired Employee Amount (₹)'}
            {retiredDetails.length > 0 && (
              <span className="portal-dash-status is-resolved" style={{ marginLeft: '0.4rem' }}>
                {retiredDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g. 100000"
              value={derivedRetiredAmount}
              onChange={(e) => setRetiredEmployeeAmount(e.target.value)}
              readOnly={retiredDetails.length > 0}
              title={retiredDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
            />
            <button
              type="button"
              onClick={() => handleOpenDetails('retired')}
              className="portal-dash-head-action"
              title={lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் விவரங்கள்' : 'Retired employee details'}
            >
              <FileText className="h-3 w-3" />
              {lang === 'ta' ? 'விவரங்கள்' : 'Details'}
            </button>
          </div>
        </div>
        <div>
          <label>
            {lang === 'ta' ? 'மரணித்த ஊழியர் தொகை (₹)' : 'Death Employee Amount (₹)'}
            {deathDetails.length > 0 && (
              <span className="portal-dash-status is-resolved" style={{ marginLeft: '0.4rem' }}>
                {deathDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g. 50000"
              value={derivedDeathAmount}
              onChange={(e) => setDeathEmployeeAmount(e.target.value)}
              readOnly={deathDetails.length > 0}
              title={deathDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
            />
            <button
              type="button"
              onClick={() => handleOpenDetails('death')}
              className="portal-dash-head-action"
              title={lang === 'ta' ? 'மரணித்த ஊழியர் விவரங்கள்' : 'Death employee details'}
            >
              <FileText className="h-3 w-3" />
              {lang === 'ta' ? 'விவரங்கள்' : 'Details'}
            </button>
          </div>
        </div>
        <div>
          <label>
            {lang === 'ta' ? 'தகுதியற்ற இதர தொகை (₹)' : 'Other Ineligible Amount (₹)'}
            {otherDetails.length > 0 && (
              <span className="portal-dash-status is-resolved" style={{ marginLeft: '0.4rem' }}>
                {otherDetails.length} {lang === 'ta' ? 'நபர்கள்' : 'records'}
              </span>
            )}
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="e.g. 20000"
              value={derivedOtherAmount}
              onChange={(e) => setOtherIneligibleAmount(e.target.value)}
              readOnly={otherDetails.length > 0}
              title={otherDetails.length > 0 ? (lang === 'ta' ? 'விவரங்களின் அடிப்படையில் தானாகவே கணக்கிடப்படுகிறது' : 'Automatically calculated from details') : undefined}
            />
            <button
              type="button"
              onClick={() => handleOpenDetails('other')}
              className="portal-dash-head-action"
              title={lang === 'ta' ? 'இதர தகுதியற்ற விவரங்கள்' : 'Other ineligible details'}
            >
              <FileText className="h-3 w-3" />
              {lang === 'ta' ? 'விவரங்கள்' : 'Details'}
            </button>
          </div>
        </div>
        <div className="portal-wt-section">
          <p className="portal-wt-section-title">{lang === 'ta' ? 'தகுதியான தொகை' : 'Actual eligible amount'}</p>
          <p className="portal-dash-num">₹ {actualEligibleAmount.toLocaleString('en-IN')}</p>
          <p className="portal-switch-hint">After deducting retired, death, and other ineligible amounts.</p>
        </div>
        <button type="submit" onClick={handleSaveOfficeSetup} disabled={!isBreakupTallied}>
          {lang === 'ta' ? 'அலுவலக அமைப்பை சேமி' : 'Save Office Setup'}
        </button>
        </div>
      </div>

      <div className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>{lang === 'ta' ? 'ஊழியர் வாரியான ஒதுக்கீடு' : 'Employee-wise Breakup Entry'}</h3>
            <p>Add individual employee opening balances against the actual eligible amount.</p>
          </div>
        </div>
        <div className="portal-dash-body">
        <form onSubmit={handleAddOfficeBreakup} className="portal-dash-fields" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 0.9fr) auto' }}>
          <div>
            <label>{lang === 'ta' ? 'ஊழியர்' : 'Choose Employee'}</label>
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
          <div>
            <label>{lang === 'ta' ? 'தொகை (₹)' : 'Eligible Balance Amount (₹)'}</label>
            <input
              type="number"
              placeholder="e.g. 50000"
              value={breakupAmount}
              onChange={(e) => setBreakupAmount(e.target.value)}
            />
          </div>
          <div>
            <label>&nbsp;</label>
            <button type="submit" className="portal-dash-head-action">
              {lang === 'ta' ? 'பட்டியலில் சேர்' : 'Add to List'}
            </button>
          </div>
        </form>

        <div className={`portal-wt-note ${isBreakupTallied ? '' : ''}`} style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`portal-dash-status ${isBreakupTallied ? 'is-resolved' : 'is-pending'}`}>
            {isBreakupTallied
              ? (lang === 'ta' ? 'ஒதுக்கீடு தாள்களுடன் சரியாக பொருந்தியது!' : 'Breakup tallied with eligible amount')
              : (lang === 'ta' ? `வித்தியாசம்: ₹${Math.abs(actualEligibleAmount - totalBreakupAmount).toLocaleString('en-IN')}` : `Difference: ₹${Math.abs(actualEligibleAmount - totalBreakupAmount).toLocaleString('en-IN')}`)}
          </span>
          <span className="portal-dash-num">₹ {totalBreakupAmount.toLocaleString('en-IN')} / ₹ {actualEligibleAmount.toLocaleString('en-IN')}</span>
        </div>

        <div className="portal-dash-table overflow-x-auto" style={{ marginTop: '0.75rem' }}>
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Eligible Balance</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {officeBreakups.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    {lang === 'ta' ? 'இதுவரை எந்தவொரு ஊழியர் ஒதுக்கீடுகளும் இல்லை.' : 'No employee breakups added yet.'}
                  </td>
                </tr>
              ) : (
                officeBreakups.map((item, idx) => (
                  <tr key={idx}>
                    <td><span className="portal-dash-id">{item.employeeId}</span></td>
                    <td>{getEmpName(item.employeeId)}</td>
                    <td className="portal-dash-num">₹ {item.amount.toLocaleString('en-IN')}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setBreakupEmpId(item.employeeId);
                            setBreakupAmount(String(item.amount));
                            handleRemoveBreakup(item.employeeId);
                          }}
                          className="portal-fis-icon-btn"
                          title={lang === 'ta' ? 'திருத்து' : 'Edit'}
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveBreakup(item.employeeId)}
                          className="portal-fis-icon-btn is-danger"
                          title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        </div>
      </div>
    </div>

      {activeDetailsCategory && (
        <div className="portal-modal-overlay">
          <div className="portal-modal max-w-2xl w-full">
            <div className="portal-dash-head">
              <div>
                <h3>
                  {activeDetailsCategory === 'retired' && (lang === 'ta' ? 'ஓய்வுபெற்ற ஊழியர் விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Retired Employee Details (Reference Only)')}
                  {activeDetailsCategory === 'death' && (lang === 'ta' ? 'மரணித்த ஊழியர் விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Death Employee Details (Reference Only)')}
                  {activeDetailsCategory === 'other' && (lang === 'ta' ? 'இதர தகுதியற்ற விவரங்கள் (குறிப்புக்காக மட்டும்)' : 'Other Ineligible Details (Reference Only)')}
                </h3>
                <p>
                  {lang === 'ta' 
                    ? 'இவ்விவரங்கள் குறிப்பு நோக்கத்திற்காக மட்டுமே; புதிய ஊழியர் சுயவிவரங்கள் உருவாக்கப்படாது.' 
                    : 'These details are for reference only; no new employee accounts will be created.'}
                </p>
              </div>
              <button type="button" onClick={() => setActiveDetailsCategory(null)} className="portal-dash-head-action">
                <X className="h-3 w-3" />
                {lang === 'ta' ? 'முடிந்தது' : 'Done'}
              </button>
            </div>
            <div className="portal-dash-body overflow-y-auto">
              {detailError && (
                <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{detailError}</span>
                </div>
              )}

              <form onSubmit={handleAddDetail} className="portal-dash-fields" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                <div>
                  <label>{lang === 'ta' ? 'பெயர்' : 'Employee Name'} *</label>
                  <input
                    type="text"
                    required
                    placeholder={lang === 'ta' ? 'பெயர் உள்ளிடவும்' : 'e.g. S. Murugan'}
                    value={detailName}
                    onChange={(e) => setDetailName(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'பதவி' : 'Designation'}</label>
                  <input
                    type="text"
                    placeholder={lang === 'ta' ? 'பதவி உள்ளிடவும்' : 'e.g. Assistant Engineer'}
                    value={detailDesignation}
                    onChange={(e) => setDetailDesignation(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'தொகை (₹)' : 'Principal Amount (₹)'} *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="e.g. 25000"
                    value={detailAmount}
                    onChange={(e) => setDetailAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'வட்டி (₹)' : 'Interest (₹)'}</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 1500"
                    value={detailInterest}
                    onChange={(e) => setDetailInterest(e.target.value)}
                  />
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <button type="submit" className="portal-dash-head-action">
                    <Plus className="h-3 w-3" />
                    {lang === 'ta' ? 'சேர்' : 'Add Detail'}
                  </button>
                </div>
              </form>

              <div className="portal-dash-head" style={{ padding: '0.65rem 0 0.4rem', marginTop: '0.55rem' }}>
                <div>
                  <h3>{lang === 'ta' ? 'பதிவு செய்யப்பட்ட விவரங்கள்' : 'Entered Reference Records'}</h3>
                  <p>
                    {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length} {lang === 'ta' ? 'பதிவுகள்' : 'entries'}
                  </p>
                </div>
              </div>
              <div className="portal-dash-table overflow-x-auto" style={{ maxHeight: '15rem', overflowY: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{lang === 'ta' ? 'பெயர்' : 'Name'}</th>
                        <th>{lang === 'ta' ? 'பதவி' : 'Designation'}</th>
                        <th>{lang === 'ta' ? 'தொகை (₹)' : 'Amount (₹)'}</th>
                        <th>{lang === 'ta' ? 'வட்டி (₹)' : 'Interest (₹)'}</th>
                        <th>{lang === 'ta' ? 'மொத்தம் (₹)' : 'Total (₹)'}</th>
                        <th>{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length === 0 ? (
                        <tr>
                          <td colSpan={7}>
                            {lang === 'ta' ? 'இன்னும் எந்த விவரங்களும் சேர்க்கப்படவில்லை.' : 'No reference details added yet.'}
                          </td>
                        </tr>
                      ) : (
                        ((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).map((rec, idx) => (
                          <tr key={rec.id}>
                            <td>{idx + 1}</td>
                            <td>{rec.name}</td>
                            <td>{rec.designation}</td>
                            <td className="portal-dash-num">₹ {rec.amount.toLocaleString('en-IN')}</td>
                            <td className="portal-dash-num">₹ {(rec.interest || 0).toLocaleString('en-IN')}</td>
                            <td className="portal-dash-num">₹ {(rec.amount + (rec.interest || 0)).toLocaleString('en-IN')}</td>
                            <td>
                              <button
                                type="button"
                                onClick={() => handleDeleteDetail(activeDetailsCategory, rec.id)}
                                className="portal-fis-icon-btn is-danger"
                                title={lang === 'ta' ? 'நீக்கு' : 'Delete'}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).length > 0 && (
                      <tfoot>
                        <tr>
                          <td colSpan={3}>{lang === 'ta' ? 'மொத்தம்' : 'Total'}</td>
                          <td className="portal-dash-num">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + i.amount, 0).toLocaleString('en-IN')}
                          </td>
                          <td className="portal-dash-num">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + (i.interest || 0), 0).toLocaleString('en-IN')}
                          </td>
                          <td className="portal-dash-num">
                            ₹ {((activeDetailsCategory === 'retired' ? retiredDetails : activeDetailsCategory === 'death' ? deathDetails : otherDetails) || []).reduce((s, i) => s + i.amount + (i.interest || 0), 0).toLocaleString('en-IN')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
              </div>
              <p className="portal-switch-hint" style={{ marginTop: '0.55rem' }}>
                {lang === 'ta' ? 'தொகை தானாகவே படிவத்தில் புதுப்பிக்கப்பட்டது.' : 'Amount is automatically updated in the setup form.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
