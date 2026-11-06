'use client';

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { repeatingAutotableHeader } from '@/lib/inspectionReportExport';
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
  AlertCircle,
  X
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
    if (window.confirm(lang === 'ta' ? 'அரசாணைப்படி அதிகாரப்பூர்வ வட்டி விகிதங்களை (1970-71 முதல் 86 பதிவுகள்) புதுப்பிக்கவா?' : 'Reset to official GPF & CPS Interest Rates (86 periods from FY 1970-71 to 2026-27)?')) {
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
    doc.text('GPF & CPS Rates of Interest (1970-71 onwards)', 14, 15);
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
      ...repeatingAutotableHeader(doc, 'GPF & CPS Rates of Interest (1970-71 onwards)', 'en', true),
      head: [['S.No', 'Financial Year / Period', 'From Date', 'To Date', 'Rate (%)', 'Authority G.O. (Finance Dept)', 'Authority G.O. (CPS)']],
      body: tableData,
      startY: 25,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`TN_Govt_GPF_CPS_Interest_Rates_1970_to_2026.pdf`);
  };

  return (
    <div className="portal-wt-grid">
      <div className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>
              <span className="portal-dash-icon">
                <TrendingUp className="h-3 w-3" />
              </span>
              {editingRateId
                ? (lang === 'ta' ? 'வட்டி விகிதத்தை திருத்து' : 'Edit Interest Rate Period')
                : (lang === 'ta' ? 'வட்டி விகிதத்தைச் சேர்க்கவும்' : 'Add Interest Rate Period')}
            </h3>
          </div>
          {editingRateId && (
            <button type="button" onClick={() => setEditingRateId(null)} className="portal-dash-head-action">
              <X className="h-3 w-3" />
              {lang === 'ta' ? 'ரத்து' : 'Cancel'}
            </button>
          )}
        </div>
        <div className="portal-dash-body portal-wt-form">
          {rateError && (
            <div className="p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl flex items-center gap-2 border border-rose-100">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{rateError}</span>
            </div>
          )}

          {editingRateId ? (
            <form onSubmit={handleUpdateInterestRate} className="space-y-3">
                <div>
                  <label>{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'Financial Year / Period'}</label>
                  <input
                    type="text"
                    placeholder="e.g. 1970-71 or 04/2016-06/2016"
                    value={editFinancialYear}
                    onChange={(e) => setEditFinancialYear(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label>{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</label>
                    <input
                      type="date"
                      required
                      value={editFromDate}
                      onChange={(e) => setEditFromDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <label>{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</label>
                    <input
                      type="date"
                      required
                      value={editToDate}
                      onChange={(e) => setEditToDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label>{lang === 'ta' ? 'வட்டி விகிதம் (%)' : 'Interest Rate (%)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 7.1"
                    value={editRateVal}
                    onChange={(e) => setEditRateVal(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. Authority (Finance Dept)'}</label>
                  <input
                    type="text"
                    placeholder="e.g. 1217, 07.10.1970"
                    value={editAuthority}
                    onChange={(e) => setEditAuthority(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. Authority (CPS)'}</label>
                  <input
                    type="text"
                    placeholder="e.g. 222, 03.06.2008"
                    value={editCpsAuthority}
                    onChange={(e) => setEditCpsAuthority(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை இணைப்பு (விருப்பம்)' : 'GO/Circular Attachment (Optional)'}</label>
                  <div className="portal-file-pick">
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
                    <label htmlFor="edit-rate-file-input" className="portal-wt-link inline-flex items-center gap-1.5 cursor-pointer">
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                      <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
                    </label>
                    {editAttachmentName && (
                      <span className="truncate font-mono text-[11px] text-slate-500">{editAttachmentName}</span>
                    )}
                  </div>
                </div>
              <button type="submit">
                {lang === 'ta' ? 'விகிதத்தை மாற்று' : 'Update Rate'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddInterestRate} className="space-y-3">
                <div>
                  <label>{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'Financial Year / Period'}</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-27 or 10/2026-03/2027"
                    value={rateFinancialYear}
                    onChange={(e) => setRateFinancialYear(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label>{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</label>
                    <input
                      type="date"
                      readOnly
                      value={calculatedNextFromDate}
                      aria-label={lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}
                    />
                    <p className="portal-switch-hint">Continues from the last saved period.</p>
                  </div>
                  <div>
                    <label>{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</label>
                    <input
                      type="date"
                      required
                      value={rateToDate}
                      min={calculatedNextFromDate}
                      onChange={(e) => setRateToDate(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label>{lang === 'ta' ? 'வட்டி விகிதம் (%)' : 'Interest Rate (%)'}</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 7.1"
                    value={rateInput}
                    onChange={(e) => setRateInput(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. Authority (Finance Dept)'}</label>
                  <input
                    type="text"
                    placeholder="e.g. 145, 24.07.2026"
                    value={rateAuthority}
                    onChange={(e) => setRateAuthority(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. Authority (CPS)'}</label>
                  <input
                    type="text"
                    placeholder="e.g. G.O. Ms. No."
                    value={rateCpsAuthority}
                    onChange={(e) => setRateCpsAuthority(e.target.value)}
                  />
                </div>
                <div>
                  <label>{lang === 'ta' ? 'அரசாணை இணைப்பு (விருப்பம்)' : 'GO/Circular Attachment (Optional)'}</label>
                  <div className="portal-file-pick">
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
                    <label htmlFor="rate-file-input" className="portal-wt-link inline-flex items-center gap-1.5 cursor-pointer">
                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                      <span>{isUploading ? 'Uploading...' : 'Choose File'}</span>
                    </label>
                    {rateAttachmentName && (
                      <span className="truncate font-mono text-[11px] text-slate-500">{rateAttachmentName}</span>
                    )}
                  </div>
                </div>
              <button type="submit">
                {lang === 'ta' ? 'விகிதத்தை சேமி' : 'Save Rate Period'}
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="portal-dashboard-panel">
        <div className="portal-dash-head">
          <div>
            <h3>
              <span className="portal-dash-icon">
                <Calendar className="h-3 w-3" />
              </span>
              {lang === 'ta' ? 'GPF & CPS வட்டி விகிதங்கள் (1970-71 முதல்)' : 'GPF & CPS Interest Rates (FY 1970-71 Onwards)'}
            </h3>
            <p>
              {lang === 'ta'
                ? `மொத்தம் ${pfInterestRates.length} காலங்கள் பதிவு செய்யப்பட்டுள்ளன.`
                : `Comprehensive audit history covering ${pfInterestRates.length} continuous periods.`}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleLoadOfficialRates}
              className="portal-dash-head-action"
              title="Reload official Tamil Nadu government interest rates from 1970-71"
            >
              <RefreshCw className="h-3 w-3" />
              {lang === 'ta' ? 'அரசாணை வட்டி ஏற்றுக' : 'Reload GO Rates'}
            </button>
            <button type="button" onClick={handleExportRatesExcel} className="portal-dash-head-action" title="Export to Excel">
              <FileSpreadsheet className="h-3 w-3" />
              Excel
            </button>
            <button type="button" onClick={handleExportRatesPdf} className="portal-dash-head-action" title="Export to PDF">
              <FileDown className="h-3 w-3" />
              PDF
            </button>
          </div>
        </div>
        <div className="portal-dash-body">
          <div className="portal-fis-search">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={rateSearchQuery}
                onChange={(e) => setRateSearchQuery(e.target.value)}
                placeholder={lang === 'ta' ? 'நிதியாண்டு (1970...), வட்டி அல்லது அரசாணை எண் தேடுக...' : 'Search by FY (e.g. 1970, 2024), rate, or G.O. number...'}
              />
            </div>
          </div>
          <div className="portal-dash-toolbar" style={{ margin: '0.55rem 0' }}>
            <div className="portal-dash-pills">
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
                  className={`portal-dash-pill ${rateYearFilter === f.id ? 'is-active' : ''}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="portal-dash-table overflow-x-auto" style={{ maxHeight: '580px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>{lang === 'ta' ? 'நிதியாண்டு / காலம்' : 'FY / Period'}</th>
                  <th>{lang === 'ta' ? 'தொடக்க தேதி' : 'From Date'}</th>
                  <th>{lang === 'ta' ? 'முடிவு தேதி' : 'To Date'}</th>
                  <th>{lang === 'ta' ? 'வட்டி விகிதம்' : 'Rate (%)'}</th>
                  <th>{lang === 'ta' ? 'அரசாணை (நிதித் துறை)' : 'G.O. (Finance)'}</th>
                  <th>{lang === 'ta' ? 'அரசாணை (CPS)' : 'G.O. (CPS)'}</th>
                  <th>{lang === 'ta' ? 'ஆவணம்' : 'Attachment'}</th>
                  <th>{lang === 'ta' ? 'செயல்பாடு' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="portal-wt-empty is-center">
                      {lang === 'ta' ? 'பதிவுகள் இல்லை.' : 'No rate periods match your search/filter.'}
                    </td>
                  </tr>
                ) : (
                  filteredRates.map((rate: InterestRate) => (
                    <tr key={rate.id}>
                      <td className="portal-dash-id">{rate.sNo || '-'}</td>
                      <td>{rate.financialYear || '-'}</td>
                      <td>{formatDateLabel(rate.fromDate)}</td>
                      <td>{formatDateLabel(rate.toDate)}</td>
                      <td>
                        <span className="portal-dash-status is-resolved">{rate.rate.toFixed(2)} %</span>
                      </td>
                      <td className="max-w-[140px] truncate" title={rate.authority || ''}>{rate.authority || '-'}</td>
                      <td className="max-w-[140px] truncate" title={rate.cpsAuthority || ''}>{rate.cpsAuthority || '-'}</td>
                      <td>
                        {rate.attachmentUrl ? (
                          <button
                            type="button"
                            onClick={() => window.open(rate.attachmentUrl, '_blank')}
                            className="portal-wt-link inline-flex items-center gap-1"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[100px]">{rate.attachmentName || 'View GO'}</span>
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleStartEditRate(rate)}
                          className="portal-fis-icon-btn"
                          title="Edit Rate Period"
                        >
                          <Edit2 className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRate(rate.id)}
                          className="portal-fis-icon-btn is-danger"
                          title="Delete Rate Period"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="portal-wt-note" style={{ marginTop: '0.55rem' }}>
            {lang === 'ta'
              ? `காட்டப்படுவது: ${filteredRates.length} / ${pfInterestRates.length} காலங்கள் • அரசாணைபடி 1970-71 முதல் 2026-27 வரை`
              : `Showing ${filteredRates.length} of ${pfInterestRates.length} rate periods • Official TN GO Periods: 1970-71 to 2026-27`}
          </p>
        </div>
      </div>
    </div>
  );
}
