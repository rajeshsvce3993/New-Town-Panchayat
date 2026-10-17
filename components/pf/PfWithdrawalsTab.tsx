'use client';

import React, { useState, useMemo } from 'react';
import { 
  Calculator, 
  AlertCircle, 
  CheckCircle, 
  Trash2, 
  Edit2, 
  Coins, 
  AlertTriangle,
  Plus 
} from 'lucide-react';
import { Language } from '../translations';
import { PfEmployee, formatDateLabel } from './PfUtils';

interface PfWithdrawalsTabProps {
  employees: any[];
  pfEmployees: PfEmployee[];
  townPanchayats: any[];
  pfInterestReleases: any[];
  pfAuditTrail: Record<string, any>;
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
}

export default function PfWithdrawalsTab({
  employees,
  pfEmployees,
  townPanchayats,
  pfInterestReleases,
  pfAuditTrail,
  lang,
  onSaveCollection
}: PfWithdrawalsTabProps) {
  // Sub-tabs: 'withdrawal' | 'settlement' | 'interest_allocation'
  const [empMgmtTab, setEmpMgmtTab] = useState<'withdrawal' | 'settlement' | 'interest_allocation'>('withdrawal');

  // 1. Advance Form states
  const [withdrawEmpId, setWithdrawEmpId] = useState<string>('');
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawDate, setWithdrawDate] = useState<string>('');
  const [withdrawReason, setWithdrawReason] = useState<string>('');
  const [withdrawRecoveries, setWithdrawRecoveries] = useState<string>('24');
  const [withdrawError, setWithdrawError] = useState<string>('');
  const [withdrawSuccess, setWithdrawSuccess] = useState<string>('');

  // 2. Settlement Form states
  const [settleEmpId, setSettleEmpId] = useState<string>('');
  const [settleType, setSettleType] = useState<string>('Retirement');
  const [settleDate, setSettleDate] = useState<string>('');
  const [settleOrderNo, setSettleOrderNo] = useState<string>('');
  const [settleOrderDate, setSettleOrderDate] = useState<string>('');
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleReason, setSettleReason] = useState<string>('');
  const [settleError, setSettleError] = useState<string>('');
  const [settleSuccess, setSettleSuccess] = useState<string>('');

  // 3. Interest Allocation states
  const [irGoNo, setIrGoNo] = useState<string>('');
  const [irReleaseDate, setIrReleaseDate] = useState<string>('');
  const [irUptoMonth, setIrUptoMonth] = useState<string>('');
  const [irTownPanchayatId, setIrTownPanchayatId] = useState<string>('all');
  const [activeIrTownPanchayatId, setActiveIrTownPanchayatId] = useState<string>('all');
  const [irTotalAmount, setIrTotalAmount] = useState<string>('');
  const [irDistributions, setIrDistributions] = useState<Record<string, number>>({});
  const [irSuccess, setIrSuccess] = useState<string>('');
  const [irError, setIrError] = useState<string>('');

  // Helpers
  const getEmpName = (empId: string): string => {
    const emp = employees.find((e: any) => e.employeeId === empId || e.id === empId);
    if (!emp) return empId;
    return lang === 'ta' ? (emp.nameTa || emp.nameEn) : (emp.nameEn || emp.nameTa);
  };

  const getTpName = (tpId: string): string => {
    const tp = townPanchayats.find((t: any) => t.id === tpId);
    if (!tp) return tpId;
    return lang === 'ta' ? tp.nameTa : tp.nameEn;
  };

  // Only show active subscribers (excluding those already settled)
  const filteredEmployeesList = useMemo(() => {
    return employees.filter((emp: any) => {
      // Check if employee has opening balance setup
      const hasSetup = pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId);
      if (!hasSetup) return false;
      // Check if settled
      const setup = pfEmployees.find((pe: PfEmployee) => pe.employeeId === emp.employeeId);
      return !setup?.settlement;
    });
  }, [employees, pfEmployees]);

  const allowedTownPanchayats = useMemo(() => {
    const ids = Array.from(new Set(employees.map(e => e.townPanchayatId).filter(Boolean)));
    return townPanchayats.filter(t => ids.includes(t.id));
  }, [employees, townPanchayats]);

  // Interest released and accumulated helper
  const getAccumulatedInterestUptoMonth = (employeeId: string, uptoMonth: string) => {
    if (!uptoMonth) return 0;
    const trail = pfAuditTrail[employeeId];
    if (!trail || !trail.monthlyHistory) return 0;
    
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

  // 1. Handlers - Advances (சேமநலநிதி முன்பணம்)
  const handleAddWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError('');
    setWithdrawSuccess('');

    if (!withdrawEmpId) {
      setWithdrawError(lang === 'ta' ? 'சந்தாதாரரைத் தேர்ந்தெடுக்கவும்' : 'Please select an employee / subscriber');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError(lang === 'ta' ? 'முறையான முன்பணத் தொகையை உள்ளிடவும்' : 'Please enter a valid advance amount');
      return;
    }

    if (!withdrawDate) {
      setWithdrawError(lang === 'ta' ? 'முன்பணம் பெற்ற தேதியைத் தேர்ந்தெடுக்கவும்' : 'Please select advance date');
      return;
    }

    const employeeSetup = pfEmployees.find((pe: PfEmployee) => pe.employeeId === withdrawEmpId);
    if (!employeeSetup) {
      setWithdrawError(lang === 'ta' ? 'முதலில் இந்த ஊழியருக்கு ஆரம்ப இருப்பு setup செய்திருக்க வேண்டும்' : 'Employee has no opening balance setup. Configure office balance setup first.');
      return;
    }

    if (new Date(withdrawDate) < new Date(employeeSetup.openingDate)) {
      setWithdrawError(lang === 'ta' ? 'முன்பணம் பெற்ற தேதி ஆரம்ப தேதிக்கு முன் இருக்கக் கூடாது' : 'Advance date cannot be before the opening date');
      return;
    }

    const recoveriesCount = parseInt(withdrawRecoveries, 10) || 0;

    const newWithdrawal = {
      id: `adv_${Date.now()}`,
      date: withdrawDate,
      amount,
      reason: withdrawReason || 'PF Advance',
      noOfRecoveries: recoveriesCount
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
    setWithdrawRecoveries('24');
    setWithdrawSuccess(lang === 'ta' ? 'சேமநலநிதி முன்பணம் வெற்றிகரமாகப் பதியப்பட்டது!' : 'PF Advance recorded successfully!');
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

  // 2. Handlers - Settlements
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

    const employeeSetup = pfEmployees.find((pe: PfEmployee) => pe.employeeId === settleEmpId);
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

  return (
    <div className="space-y-6">
      {/* Sub Tab Navigation */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button
          onClick={() => setEmpMgmtTab('withdrawal')}
          className={`pb-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            empMgmtTab === 'withdrawal'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}
        </button>
        <button
          onClick={() => setEmpMgmtTab('settlement')}
          className={`pb-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            empMgmtTab === 'settlement'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {lang === 'ta' ? 'இறுதி தீர்வுப் பதிவேடு' : 'Final Settlement Register'}
        </button>
        <button
          onClick={() => setEmpMgmtTab('interest_allocation')}
          className={`pb-3 px-6 text-xs font-bold uppercase tracking-wider border-b-2 transition-all whitespace-nowrap ${
            empMgmtTab === 'interest_allocation'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          {lang === 'ta' ? 'அரசு வட்டி ஒதுக்கீடு' : 'Govt Interest Allocation'}
        </button>
      </div>

      {empMgmtTab === 'withdrawal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Advance Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <Coins className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'ta' ? 'சேமநலநிதி முன்பணம் பதிவு' : 'Record PF Advance'}
              </h2>
            </div>

            {withdrawError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawError}</span>
              </div>
            )}

            {withdrawSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-100">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{withdrawSuccess}</span>
              </div>
            )}

            <form onSubmit={handleAddWithdrawal} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'சந்தாதாரர்' : 'Choose Subscriber'}</label>
                <select
                  required
                  value={withdrawEmpId}
                  onChange={(e) => setWithdrawEmpId(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                >
                  <option value="">{lang === 'ta' ? '-- சந்தாதாரரைத் தேர்ந்தெடு --' : '-- Choose Subscriber --'}</option>
                  {filteredEmployeesList.map((e: any) => (
                    <option key={e.id} value={e.employeeId}>
                      {e.employeeId} - {getEmpName(e.employeeId)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'முன்பணத் தொகை (₹)' : 'Advance Amount (₹)'}</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 15000"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'முன்பணம் பெற்ற தேதி' : 'Date of Advance'}</label>
                <input
                  type="date"
                  required
                  value={withdrawDate}
                  onChange={(e) => setWithdrawDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {lang === 'ta' ? 'வசூல் தவணைகள் எண்ணிக்கை (No. of Recoveries)' : 'No. of Recoveries (Installments)'}
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 24"
                  value={withdrawRecoveries}
                  onChange={(e) => setWithdrawRecoveries(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'காரணம் / ஆணை குறிப்பு' : 'Reason / Ref Order'}</label>
                <input
                  type="text"
                  placeholder="Medical, Education, Housing etc."
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow"
              >
                {lang === 'ta' ? 'முன்பணத்தைப் பதிவு செய்' : 'Log PF Advance'}
              </button>
            </form>
          </div>

          {/* Advances List Grid */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
                {lang === 'ta' ? 'சேமநலநிதி முன்பணம் பதிவேடு' : 'Subscribers PF Advance Register'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {lang === 'ta' 
                  ? 'வழங்கப்பட்ட சேமநலநிதி முன்பணங்கள் மற்றும் வசூல் தவணைகள் பதிவேடு.' 
                  : 'Audit log of all processed PF advances and recovery installments.'}
              </p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">{lang === 'ta' ? 'சந்தாதாரர் எண்' : 'Employee ID'}</th>
                    <th className="p-4">{lang === 'ta' ? 'பெயர்' : 'Employee Name'}</th>
                    <th className="p-4">{lang === 'ta' ? 'முன்பணம் தேதி' : 'Date'}</th>
                    <th className="p-4">{lang === 'ta' ? 'காரணம்' : 'Reason'}</th>
                    <th className="p-4 text-center">{lang === 'ta' ? 'வசூல் தவணைகள்' : 'Recoveries'}</th>
                    <th className="p-4 font-mono text-right">{lang === 'ta' ? 'முன்பணத் தொகை' : 'Advance Amount'}</th>
                    <th className="p-4 text-center">{lang === 'ta' ? 'செயல்' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pfEmployees.flatMap((pe: any) => (pe.withdrawals || []).map((w: any) => ({ ...w, employeeId: pe.employeeId }))).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        {lang === 'ta' ? 'இதுவரை எந்தவொரு முன்பணங்களும் பதியப்படவில்லை.' : 'No processed advances found in the system.'}
                      </td>
                    </tr>
                  ) : (
                    pfEmployees.flatMap((pe: any) => (pe.withdrawals || []).map((w: any) => ({ ...w, employeeId: pe.employeeId })))
                      .sort((a: any, b: any) => b.date.localeCompare(a.date))
                      .map((w: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-4 font-mono font-bold text-slate-700">{w.employeeId}</td>
                          <td className="p-4">{getEmpName(w.employeeId)}</td>
                          <td className="p-4 font-mono text-slate-600">{formatDateLabel(w.date)}</td>
                          <td className="p-4 text-slate-500 font-medium">{w.reason}</td>
                          <td className="p-4 text-center font-bold text-indigo-700 font-mono">
                            {w.noOfRecoveries ? `${w.noOfRecoveries} ${lang === 'ta' ? 'தவணைகள்' : 'inst.'}` : '--'}
                          </td>
                          <td className="p-4 font-mono text-right font-bold text-indigo-600">₹ {w.amount.toLocaleString('en-IN')}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteWithdrawal(w.employeeId, w.id)}
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
      )}

      {empMgmtTab === 'settlement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Settlement Form Card */}
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <CheckCircle className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'ta' ? 'இறுதி தீர்வுப் பதிவு' : 'Record Final Settlement'}
              </h2>
            </div>

            {settleError && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{settleError}</span>
              </div>
            )}

            {settleSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-100">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>{settleSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveSettlement} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஊழியர்' : 'Choose Employee'}</label>
                <select
                  required
                  value={settleEmpId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSettleEmpId(val);
                    const calculated = pfAuditTrail[val];
                    if (calculated) {
                      setSettleAmount(String(Math.round(calculated.currentBalance)));
                    } else {
                      setSettleAmount('');
                    }
                  }}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                >
                  <option value="">{lang === 'ta' ? '-- ஊழியரைத் தேர்ந்தெடு --' : '-- Choose Employee --'}</option>
                  {filteredEmployeesList.map((e: any) => (
                    <option key={e.id} value={e.employeeId}>
                      {e.employeeId} - {getEmpName(e.employeeId)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தீர்வு வகை' : 'Settlement Type'}</label>
                <select
                  required
                  value={settleType}
                  onChange={(e) => setSettleType(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                >
                  <option value="Retirement">{lang === 'ta' ? 'ஓய்வுபெறுதல்' : 'Retirement'}</option>
                  <option value="Resignation">{lang === 'ta' ? 'விலகல்' : 'Resignation'}</option>
                  <option value="Death">{lang === 'ta' ? 'மரணம்' : 'Death'}</option>
                  <option value="VRS">{lang === 'ta' ? 'விருப்ப ஓய்வு' : 'VRS'}</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தீர்வு தேதி' : 'Date of Settlement'}</label>
                <input
                  type="date"
                  required
                  value={settleDate}
                  onChange={(e) => setSettleDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஆணை எண்' : 'Order Number'}</label>
                <input
                  type="text"
                  placeholder="e.g. DTP/PF/2026/A1"
                  value={settleOrderNo}
                  onChange={(e) => setSettleOrderNo(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'ஆணை தேதி' : 'Order Date'}</label>
                <input
                  type="date"
                  value={settleOrderDate}
                  onChange={(e) => setSettleOrderDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
                />
              </div>

              {settleEmpId && pfAuditTrail[settleEmpId] && (
                <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-xl text-center space-y-0.5">
                  <span className="text-[9px] font-extrabold text-indigo-700 uppercase tracking-wider">Calculated Closing Balance</span>
                  <p className="text-base font-black text-indigo-900 font-mono">
                    ₹ {Math.round(pfAuditTrail[settleEmpId].currentBalance).toLocaleString('en-IN')}
                  </p>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'இறுதி தீர்வு தொகை (₹)' : 'Final Payable Amount (₹)'}</label>
                <input
                  type="number"
                  required
                  placeholder="Calculated amount automatically filled"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'காரணம் / விவரங்கள்' : 'Remarks / Reason'}</label>
                <input
                  type="text"
                  placeholder="Completed service, full settlement"
                  value={settleReason}
                  onChange={(e) => setSettleReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold uppercase tracking-wider shadow"
              >
                {lang === 'ta' ? 'இறுதி தீர்வைச் சேமி' : 'Save Final Settlement'}
              </button>
            </form>
          </div>

          {/* Settlements Register Table */}
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-50 pb-2">
                {lang === 'ta' ? 'இறுதி தீர்வு செய்யப்பட்டவர்கள் பதிவேடு' : 'Subscribers Final Settlement Register'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">Audit log of all settled accounts. Once settled, interest accrual ceases from that point forward.</p>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="p-4">Employee ID</th>
                    <th className="p-4">Employee Name</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Order Number</th>
                    <th className="p-4 font-mono text-right">Settlement Amount</th>
                    <th className="p-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pfEmployees.filter((pe: PfEmployee) => !!pe.settlement).length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400 font-medium">
                        {lang === 'ta' ? 'இதுவரை எந்தவொரு தீர்வுப் பதிவுகளும் இல்லை.' : 'No finalized settlements logged in the system.'}
                      </td>
                    </tr>
                  ) : (
                    pfEmployees.filter((pe: PfEmployee) => !!pe.settlement)
                      .map((pe: PfEmployee, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="p-4 font-mono font-bold text-slate-700">{pe.employeeId}</td>
                          <td className="p-4">{getEmpName(pe.employeeId)}</td>
                          <td className="p-4 font-mono text-slate-600">{formatDateLabel(pe.settlement?.settlementDate)}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                              pe.settlement?.settlementType === 'Retirement' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              pe.settlement?.settlementType === 'Death' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                              'bg-slate-100 text-slate-700'
                            }`}>
                              {pe.settlement?.settlementType}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500 font-medium font-mono">{pe.settlement?.orderNo}</td>
                          <td className="p-4 font-mono text-right font-bold text-indigo-600">₹ {Math.round(pe.settlement?.finalAmount || 0).toLocaleString('en-IN')}</td>
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleDeleteSettlement(pe.employeeId)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
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
      )}

      {empMgmtTab === 'interest_allocation' && (() => {
        // Find subscribers currently matching chosen town panchayat
        const irActiveSubscribers = employees.filter((emp: any) => {
          const hasSetup = pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId);
          if (!hasSetup) return false;
          if (activeIrTownPanchayatId === 'all') return true;
          return emp.townPanchayatId === activeIrTownPanchayatId;
        });

        // Compute running distributions sum
        const currentAllocatedSum = irActiveSubscribers.reduce((sum: number, emp: any) => {
          return sum + (irDistributions[emp.employeeId] || 0);
        }, 0);

        const irTargetAmt = parseFloat(irTotalAmount) || 0;

        // Check if any employee exceeds their accumulated interest up to the month
        let hasExceededError = false;
        irActiveSubscribers.forEach((emp: any) => {
          const accumulated = getAccumulatedInterestUptoMonth(emp.employeeId, irUptoMonth);
          const allocated = irDistributions[emp.employeeId] || 0;
          if (allocated > accumulated) {
            hasExceededError = true;
          }
        });

        // Check if the total allocated matches target and there is no individual excess
        const isTallied = Math.abs(irTargetAmt - currentAllocatedSum) < 0.05 && currentAllocatedSum > 0 && !hasExceededError;

        const handleSaveRelease = async () => {
          if (!irGoNo) {
            setIrError(lang === 'ta' ? 'அரசாணை எண் தேவை!' : 'Order G.O. No is required!');
            return;
          }
          if (!irUptoMonth) {
            setIrError(lang === 'ta' ? 'வட்டி பெறப்பட்ட மாதம் தேவை!' : 'Interest Received Upto Month is required!');
            return;
          }

          const distsList = irActiveSubscribers.map((emp: any) => ({
            employeeId: emp.employeeId,
            amount: irDistributions[emp.employeeId] || 0
          })).filter((d: any) => d.amount > 0);

          const newReleaseObj = {
            id: `ir_${Date.now()}`,
            goNo: irGoNo,
            releaseDate: irReleaseDate,
            totalAmount: irTargetAmt,
            townPanchayatId: irTownPanchayatId,
            interestReceivedUptoMonth: irUptoMonth,
            distributions: distsList
          };

          const updated = [...pfInterestReleases, newReleaseObj];
          await onSaveCollection('pfInterestReleases', updated);

          setIrSuccess(lang === 'ta' ? 'அரசு வட்டி ஒதுக்கீடு வெற்றிகரமாகப் பதியப்பட்டது!' : 'Interest Release posted and successfully distributed!');
          setIrGoNo('');
          setIrTotalAmount('');
          setIrUptoMonth('');
          setIrDistributions({});
          setIrError('');
        };

        const handleDeleteRelease = async (releaseId: string) => {
          if (confirm(lang === 'ta' ? 'இந்த ஒதுக்கீட்டை நீக்க விரும்புகிறீர்களா?' : 'Are you sure you want to delete and revert this interest distribution?')) {
            const updated = pfInterestReleases.filter((r: any) => r.id !== releaseId);
            await onSaveCollection('pfInterestReleases', updated);
          }
        };

        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Release Header Panel */}
              <div className="lg:col-span-1 bg-white rounded-3xl border border-slate-200 p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                  <Coins className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                    {lang === 'ta' ? 'அரசு வட்டி ஒதுக்கீடு படிவம்' : 'Government Interest Allocation'}
                  </h2>
                </div>

                {irSuccess && (
                  <div className="p-3 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-emerald-100">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{irSuccess}</span>
                  </div>
                )}

                {irError && (
                  <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{irError}</span>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'ta' ? 'அரசாணை எண்' : 'G.O. / Order Number'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. G.O.Ms.No 120 / 2024"
                      value={irGoNo}
                      onChange={(e) => setIrGoNo(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        {lang === 'ta' ? 'வெளியிடப்பட்ட தேதி' : 'Release Date'}
                      </label>
                      <input
                        type="date"
                        value={irReleaseDate}
                        onChange={(e) => setIrReleaseDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold text-slate-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1 whitespace-nowrap">
                        {lang === 'ta' ? 'வட்டி பெறப்பட்ட மாதம் வரை' : 'Interest Received Upto Month'}
                      </label>
                      <input
                        type="month"
                        value={irUptoMonth}
                        onChange={(e) => {
                          setIrUptoMonth(e.target.value);
                          handleAutoFillInterestDistributions(e.target.value, activeIrTownPanchayatId);
                        }}
                        className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-semibold text-slate-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat Scope'}
                    </label>
                    <select
                      value={activeIrTownPanchayatId}
                      onChange={(e) => {
                        setActiveIrTownPanchayatId(e.target.value);
                        setIrTownPanchayatId(e.target.value);
                        handleAutoFillInterestDistributions(irUptoMonth, e.target.value);
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-700 font-medium"
                    >
                      <option value="all">-- All Town Panchayats / அனைத்து பேரூராட்சிகளும் --</option>
                      {allowedTownPanchayats.map((tp: any) => (
                        <option key={tp.id} value={tp.id}>
                          {lang === 'ta' ? tp.nameTa : tp.nameEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                      {lang === 'ta' ? 'மொத்த வட்டி தொகை (₹)' : 'Total Received Amount (₹)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="e.g. 50000"
                      value={irTotalAmount}
                      onChange={(e) => setIrTotalAmount(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono font-bold text-indigo-700"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleSaveRelease}
                      disabled={!isTallied}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-[10px] font-extrabold rounded-xl transition uppercase tracking-wider disabled:cursor-not-allowed shadow-md hover:shadow-indigo-100"
                    >
                      {lang === 'ta' ? 'வட்டி ஒதுக்கீடு செய்க' : 'Post Interest Allocation'}
                    </button>
                    {!isTallied && irUptoMonth && (
                      <p className="text-[10px] text-rose-500 font-medium mt-2 text-center font-semibold">
                        {hasExceededError 
                          ? (lang === 'ta' ? 'ஒன்று அல்லது அதற்கு மேற்பட்ட ஊழியர் ஒதுக்கீடு சேர்ந்த வட்டி தொகையை விட அதிகமாக உள்ளது.' : "One or more employee allocations exceed their accumulated interest.")
                          : (lang === 'ta' ? `ஒதுக்கீட்டுத் தொகை (₹${currentAllocatedSum}) இலக்குடன் (₹${irTargetAmt}) பொருந்தவில்லை.` : `Allocation total (₹${currentAllocatedSum}) does not match target (₹${irTargetAmt}).`)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Subscriber Distributions Ledger */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                      {lang === 'ta' ? 'சந்தாதாரர் வாரியான ஒதுக்கீடு' : 'Subscriber Allocations'}
                    </h2>
                    <p className="text-slate-400 text-[10px] font-medium mt-0.5">
                      {lang === 'ta' ? 'குறிப்பிட்ட வட்டி பெறப்பட்ட மாதம் வரை சந்தாதாரர் வட்டி ஒதுக்கீட்டை வரையறுக்கவும்' : 'Define subscriber interest allocation up to specified interest received month'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Allocated</span>
                    <span className="text-xs font-mono font-extrabold text-indigo-700">₹ {currentAllocatedSum.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                        <th className="p-4 pl-6">{lang === 'ta' ? 'சந்தாதாரர் விவரங்கள்' : 'Subscriber Details'}</th>
                        <th className="p-4">{lang === 'ta' ? 'பேரூராட்சி' : 'Town Panchayat'}</th>
                        <th className="p-4 text-right">{lang === 'ta' ? 'சேர்ந்த வட்டி (₹)' : 'Accumulated Interest (₹)'}</th>
                        <th className="p-4 text-right pr-6">{lang === 'ta' ? 'ஒதுக்கீடு தொகை (₹)' : 'Allocated Amount (₹)'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {irActiveSubscribers.map((emp: any) => {
                        const tpName = getTpName(emp.townPanchayatId);
                        const accumulated = getAccumulatedInterestUptoMonth(emp.employeeId, irUptoMonth);
                        const allocated = irDistributions[emp.employeeId] || 0;
                        const isEmployeeTallied = Math.abs(allocated - accumulated) < 0.05;
                        const isExceeded = allocated > accumulated;

                        return (
                          <tr key={emp.employeeId} className="hover:bg-slate-50/50">
                            <td className="p-4 pl-6">
                              <div className="font-bold text-slate-800">{emp.nameEn}</div>
                              <div className="text-[10px] font-mono text-slate-400 font-bold">ID: {emp.employeeId}</div>
                            </td>
                            <td className="p-4 text-slate-600 font-medium">{tpName}</td>
                            <td className="p-4 text-right font-mono font-semibold text-slate-600">
                              {irUptoMonth ? `₹ ${accumulated.toLocaleString('en-IN')}` : '--'}
                            </td>
                            <td className="p-4 text-right pr-6">
                              <div className="flex items-center justify-end gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  disabled={!irUptoMonth}
                                  value={irDistributions[emp.employeeId] !== undefined ? irDistributions[emp.employeeId] : ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setIrDistributions(prev => ({
                                      ...prev,
                                      [emp.employeeId]: val
                                    }));
                                  }}
                                  className={`w-36 border rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 text-right font-mono font-bold ${
                                    isExceeded 
                                      ? 'border-rose-500 bg-rose-50 text-rose-700 focus:ring-rose-500' 
                                      : isEmployeeTallied 
                                        ? 'border-emerald-300 bg-emerald-50 text-emerald-700 focus:ring-emerald-500' 
                                        : 'border-slate-200 focus:ring-indigo-500 text-slate-700'
                                  }`}
                                />
                              </div>
                              {irUptoMonth && (
                                <div className="mt-1 text-[10px] text-right font-semibold">
                                  {isExceeded ? (
                                    <span className="text-rose-600">{lang === 'ta' ? '❌ சேர்ந்த தொகையை விட அதிகமிருக்கக் கூடாது' : '❌ Cannot exceed accumulated'}</span>
                                  ) : isEmployeeTallied ? (
                                    <span className="text-emerald-600">{lang === 'ta' ? '✅ கணக்கிடப்பட்ட தொகையுடன் பொருந்தியது' : '✅ Tallied with calculated'}</span>
                                  ) : (
                                    <span className="text-amber-600">{lang === 'ta' ? '⚠️ கணக்கிடப்பட்டதை விடக் குறைவு' : '⚠️ Less than calculated'}</span>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {irActiveSubscribers.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-slate-400 italic font-medium">No subscribers found matching chosen Scope Town Panchayat.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Past Interest Release orders */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4 shadow-sm">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {lang === 'ta' ? 'முந்தைய அரசு வட்டி ஒதுக்கீடுகள்' : 'Historical Interest Release Entries'}
                </h2>
                <p className="text-slate-400 text-[10px] font-medium mt-0.5 font-semibold">Audit log of historically posted Government interest release orders and employee allocations</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-100">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-100">
                      <th className="p-4 pl-6">Order G.O. No</th>
                      <th className="p-4">Release Date</th>
                      <th className="p-4">Upto Month</th>
                      <th className="p-4">TP Scope</th>
                      <th className="p-4">Distributed Scope</th>
                      <th className="p-4 text-right">Total Distributed (₹)</th>
                      <th className="p-4 text-center pr-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pfInterestReleases.map((release: any) => (
                      <tr key={release.id} className="hover:bg-slate-50/50">
                        <td className="p-4 pl-6 font-bold text-slate-800 font-mono">{release.goNo}</td>
                        <td className="p-4 font-mono text-slate-600">{release.releaseDate}</td>
                        <td className="p-4 font-mono text-slate-600">{release.interestReceivedUptoMonth || '--'}</td>
                        <td className="p-4 text-slate-600">{release.townPanchayatId === 'all' ? 'All Town Panchayats' : getTpName(release.townPanchayatId)}</td>
                        <td className="p-4 text-slate-500 font-semibold">{release.distributions?.length || 0} Employees</td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-700">₹ {release.totalAmount?.toLocaleString('en-IN')}</td>
                        <td className="p-4 text-center pr-6">
                          <button
                            type="button"
                            onClick={() => handleDeleteRelease(release.id)}
                            className="p-2 hover:bg-rose-50 text-rose-500 rounded-xl transition"
                            title="Delete and Revert Allocations"
                          >
                            <Trash2 className="w-4 h-4 mx-auto" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {pfInterestReleases.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-10 text-slate-400 italic font-medium">No historical interest release orders posted yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
