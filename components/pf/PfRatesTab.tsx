'use client';

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, 
  Calendar, 
  RefreshCw, 
  FileSpreadsheet, 
  FileDown, 
  Search, 
  Paperclip, 
  Edit2, 
  Trash2, 
  Loader2, 
  AlertCircle 
} from 'lucide-react';
import { Language } from '../translations';
import { 
  InterestRate, 
  formatDateLabel, 
  formatMonthLabel 
} from './PfUtils';
import { OFFICIAL_PF_INTEREST_RATES } from '@/lib/pfInterestRatesData';

interface PfRatesTabProps {
  pfInterestRates: InterestRate[];
  lang: Language;
  onSaveCollection: (key: string, data: any[]) => Promise<void>;
  handleFileUpload: (file: File, type: string) => Promise<void>;
  isUploading: boolean;
  rateAttachmentName: string;
  rateAttachmentUrl: string;
  setRateAttachmentName: (val: string) => void;
  setRateAttachmentUrl: (val: string) => void;
}

export default function PfRatesTab({
  pfInterestRates,
  lang,
  onSaveCollection,
  handleFileUpload,
  isUploading,
  rateAttachmentName,
  rateAttachmentUrl,
  setRateAttachmentName,
  setRateAttachmentUrl,
}: PfRatesTabProps) {
  // Form states - Interest Rates
  const [rateFinancialYear, setRateFinancialYear] = useState<string>('');
  const [rateAuthority, setRateAuthority] = useState<string>('');
  const [rateCpsAuthority, setRateCpsAuthority] = useState<string>('');
  const [rateInput, setRateInput] = useState<string>('');
  const [rateToDate, setRateToDate] = useState<string>('');
  const [rateError, setRateError] = useState<string>('');
  const [rateSearchQuery, setRateSearchQuery] = useState<string>('');
  const [rateYearFilter, setRateYearFilter] = useState<string>('all');

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
        (String(r.rate).includes(q))
      );
    }

    return list;
  }, [pfInterestRates, rateYearFilter, rateSearchQuery]);

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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Rate Editor Panel */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
          <TrendingUp className="w-5 h-5 text-indigo-600" />
          <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
            {editingRateId 
              ? (lang === 'ta' ? 'வட்டி விகிதத்தை திருத்து' : 'Edit Interest Rate Period')
              : (lang === 'ta' ? 'வட்டி விகிதத்தைச் சேர்க்கவும்' : 'Add Interest Rate Period')
            }
          </h2>
        </div>

        {rateError && (
          <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{rateError}</span>
          </div>
        )}

        {editingRateId ? (
          <form onSubmit={handleUpdateInterestRate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'Financial Year / Period'}</label>
              <input
                type="text"
                placeholder="e.g. 1970-71 or 04/2016-06/2016"
                value={editFinancialYear}
                onChange={(e) => setEditFinancialYear(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</label>
                <input
                  type="date"
                  required
                  value={editFromDate}
                  onChange={(e) => setEditFromDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</label>
                <input
                  type="date"
                  required
                  value={editToDate}
                  onChange={(e) => setEditToDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'வட்டி விகிதம் (%)' : 'Interest Rate (%)'}</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 7.1"
                value={editRateVal}
                onChange={(e) => setEditRateVal(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-150 outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. Authority (Finance Dept)'}</label>
              <input
                type="text"
                placeholder="e.g. 1217, 07.10.1970"
                value={editAuthority}
                onChange={(e) => setEditAuthority(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. Authority (CPS)'}</label>
              <input
                type="text"
                placeholder="e.g. 222, 03.06.2008"
                value={editCpsAuthority}
                onChange={(e) => setEditCpsAuthority(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {lang === 'ta' ? 'அரசாணை இணைப்பு (விருப்பம்)' : 'GO/Circular Attachment (Optional)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'edit-rate');
                  }}
                  className="hidden"
                  id="edit-rate-file-input"
                />
                <label
                  htmlFor="edit-rate-file-input"
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Paperclip className="w-4 h-4 text-slate-400" />}
                  <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
                </label>
                {editAttachmentName && (
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-[150px]">
                    {editAttachmentName}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow"
              >
                {lang === 'ta' ? 'விகிதத்தை மாற்று' : 'Update Rate'}
              </button>
              <button
                type="button"
                onClick={() => setEditingRateId(null)}
                className="px-4 py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider"
              >
                {lang === 'ta' ? 'ரத்து' : 'Cancel'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleAddInterestRate} className="space-y-3">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'Financial Year / Period'}</label>
              <input
                type="text"
                placeholder="e.g. 2026-27 or 10/2026-03/2027"
                value={rateFinancialYear}
                onChange={(e) => setRateFinancialYear(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</label>
                <div className="w-full border border-slate-200 bg-slate-50 rounded-2xl p-3 text-xs font-mono text-slate-600 truncate">
                  {calculatedNextFromDate}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</label>
                <input
                  type="date"
                  required
                  value={rateToDate}
                  min={calculatedNextFromDate}
                  onChange={(e) => setRateToDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'வட்டி விகிதம் (%)' : 'Interest Rate (%)'}</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 7.1"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. Authority (Finance Dept)'}</label>
              <input
                type="text"
                placeholder="e.g. 145, 24.07.2026"
                value={rateAuthority}
                onChange={(e) => setRateAuthority(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. Authority (CPS)'}</label>
              <input
                type="text"
                placeholder="e.g. G.O. Ms. No."
                value={rateCpsAuthority}
                onChange={(e) => setRateCpsAuthority(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl p-3 text-sm focus:ring-2 focus:ring-indigo-100 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {lang === 'ta' ? 'அரசாணை இணைப்பு (விருப்பம்)' : 'GO/Circular Attachment (Optional)'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file, 'rate');
                  }}
                  className="hidden"
                  id="rate-file-input"
                />
                <label
                  htmlFor="rate-file-input"
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer transition-all"
                >
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-600" /> : <Paperclip className="w-4 h-4 text-slate-400" />}
                  <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
                </label>
                {rateAttachmentName && (
                  <span className="text-[11px] text-slate-500 font-mono truncate max-w-[150px]">
                    {rateAttachmentName}
                  </span>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-50 hover:to-violet-50 text-white text-xs font-bold uppercase tracking-wider shadow"
            >
              {lang === 'ta' ? 'விகிதத்தை சேமி' : 'Save Rate Period'}
            </button>
          </form>
        )}
      </div>

      {/* Historical Interest Rates Table */}
      <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'ta' ? 'தமிழ்நாடு அரசு GPF & CPS வட்டி விகிதங்கள் (1970-71 முதல்)' : 'Tamil Nadu GPF & CPS Interest Rates (FY 1970-71 Onwards)'}
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {lang === 'ta' 
                ? `மொத்தம் ${pfInterestRates.length} காலங்கள் பதிவு செய்யப்பட்டுள்ளன.` 
                : `Comprehensive audit history covering ${pfInterestRates.length} continuous periods.`}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleLoadOfficialRates}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition border border-slate-200"
              title="Reload official Tamil Nadu government interest rates from 1970-71"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{lang === 'ta' ? 'அரசாணை வட்டி ஏற்றுக' : 'Reload GO Rates'}</span>
            </button>
            <button
              type="button"
              onClick={handleExportRatesExcel}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-200"
              title="Export to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={handleExportRatesPdf}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition border border-indigo-200"
              title="Export to PDF"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Search & Era Filter Tabs */}
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rateSearchQuery}
              onChange={(e) => setRateSearchQuery(e.target.value)}
              placeholder={lang === 'ta' ? 'நிதியாண்டு (1970...), வட்டி அல்லது அரசாணை எண் தேடுக...' : 'Search by FY (e.g. 1970, 2024), rate, or G.O. number...'}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'all', label: `All (${pfInterestRates.length})` },
              { id: '1970-1990', label: '1970-1990' },
              { id: '1991-2010', label: '1991-2010' },
              { id: '2011-2020', label: '2011-2020' },
              { id: '2021-2026', label: '2021-2026+' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRateYearFilter(f.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg whitespace-nowrap transition ${
                  rateYearFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100 max-h-[580px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="p-3">S.No</th>
                <th className="p-3">{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'FY / Period'}</th>
                <th className="p-3">{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</th>
                <th className="p-3">{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</th>
                <th className="p-3">{lang === 'ta' ? 'வட்டி விகிதம்' : 'Rate (%)'}</th>
                <th className="p-3">{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. (Finance)'}</th>
                <th className="p-3">{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. (CPS)'}</th>
                <th className="p-3">{lang === 'ta' ? 'ஆவணம்' : 'Attachment'}</th>
                <th className="p-3 text-right">{lang === 'ta' ? 'செயல்பாடு' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRates.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                    {lang === 'ta' ? 'பதிவுகள் இல்லை.' : 'No rate periods match your search/filter.'}
                  </td>
                </tr>
              ) : (
                filteredRates.map((rate: InterestRate) => (
                  <tr key={rate.id} className="hover:bg-indigo-50/30 transition">
                    <td className="p-3 font-mono text-slate-500 font-bold">{rate.sNo || '-'}</td>
                    <td className="p-3 font-medium text-slate-800 whitespace-nowrap">
                      {rate.financialYear || '-'}
                    </td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{formatDateLabel(rate.fromDate)}</td>
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">{formatDateLabel(rate.toDate)}</td>
                    <td className="p-3">
                      <span className="bg-emerald-50 border border-emerald-200 text-emerald-700 font-mono font-bold px-2 py-0.5 rounded-md text-xs whitespace-nowrap">
                        {rate.rate.toFixed(2)} %
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px] max-w-[140px] truncate" title={rate.authority || ''}>
                      {rate.authority || '-'}
                    </td>
                    <td className="p-3 text-slate-600 font-mono text-[11px] max-w-[140px] truncate" title={rate.cpsAuthority || ''}>
                      {rate.cpsAuthority || '-'}
                    </td>
                    <td className="p-3">
                      {rate.attachmentUrl ? (
                        <button
                          onClick={() => window.open(rate.attachmentUrl, '_blank')}
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:underline"
                        >
                          <Paperclip className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px]">{rate.attachmentName || 'View GO'}</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px]">-</span>
                      )}
                    </td>
                    <td className="p-3 text-right space-x-1 whitespace-nowrap">
                      <button
                        onClick={() => handleStartEditRate(rate)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                        title="Edit Rate Period"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDeleteRate(rate.id)}
                        className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                        title="Delete Rate Period"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between items-center text-[11px] text-slate-500 pt-2 px-1">
          <span>
            {lang === 'ta' 
              ? `காட்டப்படுவது: ${filteredRates.length} / ${pfInterestRates.length} காலங்கள்`
              : `Showing ${filteredRates.length} of ${pfInterestRates.length} rate periods`}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {lang === 'ta' ? 'அரசாணைபடி 1970-71 முதல் 2026-27 வரை' : 'Official TN GO Periods: 1970-71 to 2026-27'}
          </span>
        </div>
      </div>
    </div>
  );
}
