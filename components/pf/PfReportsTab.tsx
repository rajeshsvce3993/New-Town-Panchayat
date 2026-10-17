'use client';

import React, { useState, useMemo } from 'react';
import { Download, Printer, ChevronDown, ChevronUp } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Language } from '../translations';
import { 
  PfEmployee, 
  PfSubscription, 
  formatDateLabel, 
  formatMonthLabel, 
  getEmployeeSlipYears, 
  getYearWiseSummary, 
  getAbstractYearsList, 
  getEmployeeBalancesForFy, 
  downloadElementAsPDF 
} from './PfUtils';

interface PfReportsTabProps {
  employees: any[];
  filteredEmployeesList: any[];
  pfEmployees: PfEmployee[];
  pfSubscriptions: PfSubscription[];
  pfChallans: any[];
  townPanchayats: any[];
  allowedTownPanchayats: any[];
  currentOfficeSetup: any;
  currentUser: any;
  pfAuditTrail: Record<string, any>;
  state: any;
  lang: Language;
}

export default function PfReportsTab({
  employees,
  filteredEmployeesList,
  pfEmployees,
  pfSubscriptions,
  pfChallans,
  townPanchayats,
  allowedTownPanchayats,
  currentOfficeSetup,
  currentUser,
  pfAuditTrail,
  state,
  lang,
}: PfReportsTabProps) {
  const pfInterestReleases = state?.pfInterestReleases || [];
  // State variables for reports filters
  const [employeeWiseFy, setEmployeeWiseFy] = useState<string>('2025-2026');
  const [pfReportFy, setPfReportFy] = useState<string>('all');
  const [accountSlipFy, setAccountSlipFy] = useState<string>('all');
  const [reportsSubTab, setReportsSubTab] = useState<'employee_wise' | 'pf_report' | 'account_slip'>('employee_wise');
  const [reportFilterDistrict, setReportFilterDistrict] = useState<string>('all');
  const [reportFilterTp, setReportFilterTp] = useState<string>('all');
  const [reportFilterEmpId, setReportFilterEmpId] = useState<string>('all');
  const [reportEmpId, setReportEmpId] = useState<string>('all');
  const [expandedPfReportYrs, setExpandedPfReportYrs] = useState<Record<string, boolean>>({});
  const [expandedAccountSlipYears, setExpandedAccountSlipYears] = useState<string[]>([]);

  const activeReportFilterTp = allowedTownPanchayats.length === 1 ? allowedTownPanchayats[0].id : reportFilterTp;

  // Helpers
  const getEmpName = (empId: string) => {
    const emp = employees.find((e: any) => e.employeeId === empId || e.id === empId);
    if (!emp) return empId;
    return lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn;
  };

  const getEmpDesignation = (emp: any) => {
    if (!emp) return '';
    if (emp.designation) return emp.designation;
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

  const getInterestBreakdown = (employeeId: string) => {
    const trail = pfAuditTrail[employeeId];
    if (!trail || !trail.monthlyHistory) return [];

    const yearsMap: Record<string, {
      fy: string;
      rate: number;
      openingBalance: number;
      subscriptions: number;
      withdrawals: number;
      interestRelease: number;
      interestEarned: number;
      closingBalanceBeforeInterest: number;
      closingBalanceWithInterest: number;
    }> = {};

    trail.monthlyHistory.forEach((row: any) => {
      if (row.type === 'INTEREST_CREDIT') {
        return;
      }

      const [yrStr, moStr] = row.yearMonth.split('-');
      const yr = parseInt(yrStr, 10);
      const mo = parseInt(moStr, 10);

      let fy = '';
      if (mo <= 3) {
        fy = `${yr - 1}-${yr}`;
      } else {
        fy = `${yr}-${yr + 1}`;
      }

      if (!yearsMap[fy]) {
        yearsMap[fy] = {
          fy,
          rate: row.rate,
          openingBalance: row.opening,
          subscriptions: 0,
          withdrawals: 0,
          interestRelease: 0,
          interestEarned: 0,
          closingBalanceBeforeInterest: 0,
          closingBalanceWithInterest: 0,
        };
      }

      yearsMap[fy].subscriptions += row.subscription;
      yearsMap[fy].withdrawals += row.withdrawal;
      yearsMap[fy].interestRelease += (row.interestRelease || 0);
      yearsMap[fy].interestEarned += row.interestEarned;
      yearsMap[fy].closingBalanceBeforeInterest = row.closing;
      yearsMap[fy].rate = row.rate;
    });

    const sortedBreakdowns = Object.values(yearsMap).sort((a, b) => a.fy.localeCompare(b.fy));

    const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === employeeId);
    const calculationMethod = trail.calculationMethod || pfSetup?.settlement?.settlementType || (pfSetup as any)?.interestMethod || 'method1';

    let runningOpening = trail.openingBalance;
    let runningAccumulatedInterest = 0;
    sortedBreakdowns.forEach((breakdown) => {
      breakdown.openingBalance = runningOpening;
      breakdown.closingBalanceBeforeInterest = runningOpening + breakdown.subscriptions - breakdown.withdrawals + breakdown.interestRelease;
      runningAccumulatedInterest += breakdown.interestEarned;

      if (calculationMethod === 'method1') {
        // Method 1: Closing Balance is shown added with accumulated interest,
        // while next year opening balance remains purely principal (without interest).
        breakdown.closingBalanceWithInterest = breakdown.closingBalanceBeforeInterest + runningAccumulatedInterest;
        runningOpening = breakdown.closingBalanceBeforeInterest;
      } else {
        // Method 2 & 3: That FY interest is added to closing balance,
        // and this cumulative closing balance becomes next year's opening balance.
        breakdown.closingBalanceWithInterest = breakdown.closingBalanceBeforeInterest + breakdown.interestEarned;
        runningOpening = breakdown.closingBalanceWithInterest;
      }
    });

    return sortedBreakdowns;
  };

  const reportsFilteredTownPanchayats = useMemo(() => {
    let list = allowedTownPanchayats;
    if (reportFilterDistrict !== 'all' && (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad')) {
      list = list.filter((tp: any) => tp.districtId === reportFilterDistrict);
    }
    return list;
  }, [allowedTownPanchayats, reportFilterDistrict, currentUser]);

  const getAbstractReportData = () => {
    const yearsList = getAbstractYearsList(currentOfficeSetup?.openingDate || '2023-04-01');

    const setupOb = currentOfficeSetup?.officeOpeningBalance || 0;
    const setupRetired = currentOfficeSetup?.retiredEmployeeAmount || 0;
    const setupDeath = currentOfficeSetup?.deathEmployeeAmount || 0;
    const setupOther = currentOfficeSetup?.otherIneligibleAmount || 0;
    const ineligibleAmt = setupRetired + setupDeath + setupOther;

    const officeSetupYear = currentOfficeSetup?.openingDate ? currentOfficeSetup.openingDate.split('-')[0] : '2023';
    const officeSetupMonth = currentOfficeSetup?.openingDate ? currentOfficeSetup.openingDate.split('-')[1] : '04';
    const officeSetupFy = (parseInt(officeSetupMonth, 10) <= 3) 
      ? `${parseInt(officeSetupYear, 10) - 1}-${officeSetupYear}` 
      : `${officeSetupYear}-${parseInt(officeSetupYear, 10) + 1}`;

    let runningAccumulatedInterest = 0;

    const rawYears = yearsList.map((fy) => {
      let subscribersCount = 0;
      let totalOB = 0;
      let totalSub = 0;
      let totalWd = 0;
      let totalIntRelease = 0;
      let totalIntAccrued = 0;
      let totalCB = 0;

      const monthsMap: Record<string, {
        yearMonth: string;
        opening: number;
        subscription: number;
        withdrawal: number;
        interestRelease: number;
        interestEarned: number;
        closing: number;
        challansList: { no: string; date: string; deductedSalaryMonths?: string }[];
      }> = {};

      const [startYrStr, endYrStr] = fy.split('-');
      const startYr = parseInt(startYrStr, 10);
      const endYr = parseInt(endYrStr, 10);
      const monthsOrder = [
        `${startYr}-04`, `${startYr}-05`, `${startYr}-06`, `${startYr}-07`, `${startYr}-08`, `${startYr}-09`,
        `${startYr}-10`, `${startYr}-11`, `${startYr}-12`, `${endYr}-01`, `${endYr}-02`, `${endYr}-03`
      ];

      monthsOrder.forEach(ym => {
        monthsMap[ym] = {
          yearMonth: ym,
          opening: 0,
          subscription: 0,
          withdrawal: 0,
          interestRelease: 0,
          interestEarned: 0,
          closing: 0,
          challansList: []
        };
      });

      filteredEmployeesList.forEach((emp: any) => {
        const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === emp.employeeId);
        if (!pfSetup) return;

        // Filter by scope Town Panchayat/District if active
        if (reportFilterDistrict !== 'all') {
          const tp = townPanchayats.find((t: any) => t.id === emp.townPanchayatId);
          if (!tp || tp.districtId !== reportFilterDistrict) return;
        }
        if (activeReportFilterTp !== 'all' && emp.townPanchayatId !== activeReportFilterTp) {
          return;
        }

        const breakdowns = getInterestBreakdown(emp.employeeId);
        const fyBreakdown = breakdowns.find((b: any) => b.fy === fy);
        if (fyBreakdown) {
          subscribersCount += 1;
          totalOB += fyBreakdown.openingBalance;
          totalSub += fyBreakdown.subscriptions;
          totalWd += fyBreakdown.withdrawals;
          totalIntRelease += fyBreakdown.interestRelease;
          totalIntAccrued += fyBreakdown.interestEarned;
          totalCB += fyBreakdown.closingBalanceWithInterest;

          const trail = pfAuditTrail[emp.employeeId];
          if (trail && trail.monthlyHistory) {
            trail.monthlyHistory.forEach((row: any) => {
              if (row.type === 'INTEREST_CREDIT') return;
              if (monthsMap[row.yearMonth]) {
                monthsMap[row.yearMonth].opening += row.opening;
                monthsMap[row.yearMonth].subscription += row.subscription;
                monthsMap[row.yearMonth].withdrawal += row.withdrawal;
                monthsMap[row.yearMonth].interestRelease += (row.interestRelease || 0);
                monthsMap[row.yearMonth].interestEarned += row.interestEarned;
                monthsMap[row.yearMonth].closing += row.closing;

                // Collect unique challans for this employee's subscriptions in this yearMonth
                const empSubs = pfSubscriptions.filter((s: any) => s.employeeId === emp.employeeId && s.yearMonth === row.yearMonth);
                empSubs.forEach((s: any) => {
                  const challan = pfChallans.find((c: any) => c.id === s.challanId);
                  if (challan && challan.challanNo) {
                    const alreadyAdded = monthsMap[row.yearMonth].challansList.some((ch: any) => ch.no === challan.challanNo);
                    if (!alreadyAdded) {
                      const rangeLabel = (challan.fromMonth && challan.toMonth && challan.fromMonth !== challan.toMonth)
                        ? `${formatMonthLabel(challan.fromMonth, lang)} - ${formatMonthLabel(challan.toMonth, lang)}`
                        : (challan.fromMonth ? formatMonthLabel(challan.fromMonth, lang) : '');
                      monthsMap[row.yearMonth].challansList.push({
                        no: challan.challanNo,
                        date: challan.challanDate || '',
                        deductedSalaryMonths: rangeLabel || '--'
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });

      // Adjust values for office ineligible amount starting from the setup year
      const isAtOrAfterSetup = fy >= officeSetupFy;
      let adjustedOB = totalOB;

      if (isAtOrAfterSetup && ineligibleAmt > 0) {
        adjustedOB += ineligibleAmt;
      }

      runningAccumulatedInterest += totalIntAccrued;
      const currentTotalAccInt = runningAccumulatedInterest;

      // Closing balance is opening balance (adjusted) + Subscriptions - Withdrawals + Interest Release + Total Acc. Interest!
      const principalClosing = adjustedOB + totalSub - totalWd + totalIntRelease;
      const adjustedCB = principalClosing + currentTotalAccInt;

      return {
        fy,
        subscribersCount,
        totalOB: adjustedOB,
        totalSub,
        totalWd,
        totalIntRelease,
        totalIntAccrued,
        totalAccumulatedInt: currentTotalAccInt,
        totalCB: adjustedCB,
        ineligibleAmt: isAtOrAfterSetup ? ineligibleAmt : 0,
        months: monthsOrder.map(ym => {
          const moData = monthsMap[ym];
          let adjMoOpening = moData.opening;
          let adjMoClosing = moData.closing;
          if (isAtOrAfterSetup && ineligibleAmt > 0) {
            adjMoOpening += ineligibleAmt;
            adjMoClosing += ineligibleAmt;
          }
          return {
            ...moData,
            opening: adjMoOpening,
            closing: adjMoClosing,
            monthLabel: formatMonthLabel(ym, lang)
          };
        })
      };
    }).filter(y => y.subscribersCount > 0);

    let runningAccumulatedInt = 0;
    return rawYears.map((yr) => {
      runningAccumulatedInt += yr.totalIntAccrued;
      return {
        ...yr,
        totalAccumulatedInt: runningAccumulatedInt
      };
    });
  };

  const filteredEmployees = useMemo(() => {
    return filteredEmployeesList
      .filter((emp: any) => pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId))
      .filter((emp: any) => {
        if (activeReportFilterTp !== 'all' && emp.townPanchayatId !== activeReportFilterTp) return false;
        if (reportFilterDistrict !== 'all' && (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad')) {
          const tp = townPanchayats.find((t: any) => t.id === emp.townPanchayatId);
          if (!tp || tp.districtId !== reportFilterDistrict) return false;
        }
        if (reportFilterEmpId !== 'all' && emp.employeeId !== reportFilterEmpId) {
          return false;
        }
        return true;
      });
  }, [filteredEmployeesList, pfEmployees, activeReportFilterTp, reportFilterDistrict, reportFilterEmpId, currentUser, townPanchayats]);

  // 1. Employee-wise Exporters
  const handleDownloadEmployeeWiseReport = () => {
    const wb = XLSX.utils.book_new();
    const years = employeeWiseFy === 'all' ? getAbstractYearsList(currentOfficeSetup?.openingDate || '2023-04-01') : [employeeWiseFy];

    years.forEach((fy) => {
      const sheetRows: any[] = [];
      sheetRows.push([`TOWN PANCHAYATS DEPARTMENT, TAMIL NADU`]);
      sheetRows.push([`EMPLOYEE-WISE PROVIDENT FUND BALANCE SHEET`]);
      sheetRows.push([`Financial Year: ${fy}`]);
      sheetRows.push([]); 

      sheetRows.push(['Employee ID', 'Name', 'Town Panchayat', 'Opening Bal', 'Paid Sub', 'PF Advance', 'Interest', 'Closing Bal']);

      filteredEmployees.forEach((emp: any) => {
        const balances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, fy);
        sheetRows.push([
          emp.employeeId,
          emp.nameEn,
          getTpName(emp.townPanchayatId),
          Math.round(balances.openingBalance),
          Math.round(balances.subscriptionsPaid),
          Math.round(balances.withdrawals),
          Math.round(balances.interestCredited),
          Math.round(balances.closingBalance)
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, ws, `FY ${fy}`);
    });

    XLSX.writeFile(wb, `Employee_Wise_PF_Report_${employeeWiseFy}.xlsx`);
  };

  const handleDownloadEmployeeWisePDF = async () => {
    if (lang === 'ta') {
      const elem = document.getElementById('pf-employee-wise-report-table');
      if (elem) {
        const success = await downloadElementAsPDF('pf-employee-wise-report-table', `PF-Employee-Wise-Report-${employeeWiseFy}.pdf`, false);
        if (success) return;
      }
    }

    const doc = new jsPDF('p', 'mm', 'a4');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOWN PANCHAYATS DEPARTMENT, TAMIL NADU', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`EMPLOYEE-WISE PROVIDENT FUND LEDGER ABSTRACT`, 105, 21, { align: 'center' });
    doc.text(`Financial Year: ${employeeWiseFy} | Generated: ${formatDateLabel(new Date().toISOString())}`, 105, 26, { align: 'center' });

    const tableHeaders = [['Employee ID', 'Employee Name', 'Town Panchayat', 'Opening Bal', 'Subscriptions', 'PF Advance', 'Int. Credited', 'Closing Bal']];
    const tableRows = filteredEmployees.map((emp: any) => {
      const balances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return [
        emp.employeeId,
        emp.nameEn,
        getTpName(emp.townPanchayatId),
        `Rs. ${Math.round(balances.openingBalance).toLocaleString('en-IN')}`,
        `Rs. ${Math.round(balances.subscriptionsPaid).toLocaleString('en-IN')}`,
        `Rs. ${Math.round(balances.withdrawals).toLocaleString('en-IN')}`,
        balances.interestCredited > 0 ? `Rs. ${Math.round(balances.interestCredited).toLocaleString('en-IN')}` : '0',
        `Rs. ${Math.round(balances.closingBalance).toLocaleString('en-IN')}`
      ];
    });

    const totalOB = filteredEmployees.reduce((sum, emp) => {
      const b = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return sum + b.openingBalance;
    }, 0);
    const totalSub = filteredEmployees.reduce((sum, emp) => {
      const b = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return sum + b.subscriptionsPaid;
    }, 0);
    const totalWd = filteredEmployees.reduce((sum, emp) => {
      const b = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return sum + b.withdrawals;
    }, 0);
    const totalInt = filteredEmployees.reduce((sum, emp) => {
      const b = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return sum + b.interestCredited;
    }, 0);
    const totalCB = filteredEmployees.reduce((sum, emp) => {
      const b = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
      return sum + b.closingBalance;
    }, 0);

    tableRows.push([
      'TOTALS',
      '--',
      '--',
      `Rs. ${Math.round(totalOB).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(totalSub).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(totalWd).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(totalInt).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(totalCB).toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 32,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fontStyle: 'bold', fillColor: [243, 244, 246] }
    });

    doc.save(`Employee-wise-PF-Report-${employeeWiseFy}.pdf`);
  };

  // 2. PF Report Exporters
  const handleDownloadPfReportExcel = () => {
    const data = getAbstractReportData(); // This is the consolidated years data for all filtered employees
    const wb = XLSX.utils.book_new();

    // Sheet 1: Consolidated Year-Wise Abstract
    const abstractSheetRows: any[] = [];
    abstractSheetRows.push(['GOVERNMENT OF TAMIL NADU']);
    abstractSheetRows.push(['TOWN PANCHAYATS DEPARTMENT']);
    abstractSheetRows.push(['PROVIDENT FUND CONSOLIDATED ACCOUNT ABSTRACT (ALL EMPLOYEES)']);
    abstractSheetRows.push([]);

    abstractSheetRows.push([
      'Financial Year', 
      'Subscribers Count',
      'Opening Balance (Rs.)', 
      'Subscriptions Paid (+)', 
      'PF Advance (-)', 
      'Interest Credited (+)', 
      'Calculated Interest (FY)', 
      'Total Accumulated Interest', 
      'Closing Balance (CB)'
    ]);

    data.forEach((yr) => {
      abstractSheetRows.push([
        yr.fy,
        yr.subscribersCount,
        Math.round(yr.totalOB),
        Math.round(yr.totalSub),
        Math.round(yr.totalWd),
        yr.totalIntRelease > 0 ? Math.round(yr.totalIntRelease) : 0,
        Math.round(yr.totalIntAccrued),
        Math.round(yr.totalAccumulatedInt || 0),
        Math.round(yr.totalCB)
      ]);
    });

    const grandSub = data.reduce((sum, item) => sum + item.totalSub, 0);
    const grandWd = data.reduce((sum, item) => sum + item.totalWd, 0);
    const grandIntCredited = data.reduce((sum, item) => sum + item.totalIntRelease, 0);
    const grandCalcInt = data.reduce((sum, item) => sum + item.totalIntAccrued, 0);
    const latestAccInt = data.length > 0 ? (data[data.length - 1].totalAccumulatedInt || 0) : 0;

    abstractSheetRows.push([
      'TOTAL / SUMMARY',
      '',
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
      { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 26 }, { wch: 22 }
    ];
    XLSX.utils.book_append_sheet(wb, wsAbstract, 'Consolidated Abstract');

    // Subsequent Sheets: Month-wise details for each FY
    const yearsToExport = pfReportFy === 'all' ? data.map(d => d.fy) : [pfReportFy];
    
    data.filter(d => yearsToExport.includes(d.fy)).forEach((yrData) => {
      const sheetRows: any[] = [];
      sheetRows.push(['GOVERNMENT OF TAMIL NADU']);
      sheetRows.push(['TOWN PANCHAYATS DEPARTMENT']);
      sheetRows.push([`PROVIDENT FUND ANNUAL CONSOLIDATED REPORT - FINANCIAL YEAR: ${yrData.fy}`]);
      sheetRows.push([]);

      sheetRows.push(['Subscribers Count:', yrData.subscribersCount, '', 'Opening Balance:', Math.round(yrData.totalOB)]);
      sheetRows.push([]);

      sheetRows.push([
        'Month', 
        'Opening Balance (Rs.)', 
        'Subscription Paid (Rs.)', 
        'PF Advance (Rs.)', 
        'Govt Int Release (Rs.)',
        'Interest Accrued (Rs.)',
        'Closing Balance (Rs.)'
      ]);

      yrData.months.forEach((row: any) => {
        sheetRows.push([
          row.monthLabel,
          Math.round(row.opening),
          Math.round(row.subscription),
          Math.round(row.withdrawal),
          row.interestRelease > 0 ? Math.round(row.interestRelease) : 0,
          Math.round(row.interestEarned),
          Math.round(row.closing)
        ]);
      });

      sheetRows.push([]);
      sheetRows.push([
        'YEAR END CREDITS',
        '--',
        '--',
        '--',
        '--',
        Math.round(yrData.totalIntAccrued),
        Math.round(yrData.totalCB)
      ]);

      const wsYear = XLSX.utils.aoa_to_sheet(sheetRows);
      wsYear['!cols'] = [
        { wch: 18 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }
      ];
      XLSX.utils.book_append_sheet(wb, wsYear, `FY ${yrData.fy} Details`);
    });

    XLSX.writeFile(wb, `Consolidated_PF_Report_${pfReportFy}.xlsx`);
  };

  const handleDownloadPfReportPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const data = getAbstractReportData(); // List of consolidated year-wise data

    const yearsToPrint = pfReportFy === 'all' ? data.map(d => d.fy) : [pfReportFy];

    // PAGE 1: ABSTRACT OF TOTAL YEAR-WISE DATA FOR ALL EMPLOYEES
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('GOVERNMENT OF TAMIL NADU', 105, 12, { align: 'center' });
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('TOWN PANCHAYATS DEPARTMENT', 105, 17, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(67, 56, 202); // indigo
    doc.text(`PROVIDENT FUND CONSOLIDATED SUMMARY ABSTRACT (ALL EMPLOYEES)`, 105, 23, { align: 'center' });
    
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 50);
    doc.text(`Generated: ${formatDateLabel(new Date().toISOString())}`, 105, 28, { align: 'center' });
    
    // Subscriber Summary Box
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, 32, 182, 22, 'FD');
    
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(50, 50, 50);
    doc.text(`Report Type:`, 18, 38);
    doc.text(`Scope / Filter:`, 18, 44);
    doc.text(`Total Subscribers:`, 18, 50);
    
    doc.setFont('helvetica', 'normal');
    doc.text(`Consolidated Year-Wise PF Ledger Abstract (All Employees)`, 55, 38);
    doc.text(`District: ${reportFilterDistrict === 'all' ? 'All' : reportFilterDistrict} | TP: ${activeReportFilterTp === 'all' ? 'All' : getTpName(activeReportFilterTp)}`, 55, 44);
    doc.text(`${filteredEmployeesList.length} Employees found`, 55, 50);

    // Consolidated Year-Wise Abstract Table
    const abstractTableHeaders = [[
      'Financial Year', 
      'Subscribers',
      'Opening Bal (Rs.)', 
      'Subscriptions (+)', 
      'Withdrawals (-)', 
      'Govt Int Release (+)', 
      'Accrued Interest (FY)', 
      'Total Acc. Int (Rs.)', 
      'Closing Bal (CB)'
    ]];

    const abstractTableRows = data.map((yrData) => [
      yrData.fy,
      yrData.subscribersCount,
      Math.round(yrData.totalOB).toLocaleString('en-IN'),
      Math.round(yrData.totalSub).toLocaleString('en-IN'),
      Math.round(yrData.totalWd).toLocaleString('en-IN'),
      yrData.totalIntRelease > 0 ? Math.round(yrData.totalIntRelease).toLocaleString('en-IN') : '0',
      Math.round(yrData.totalIntAccrued).toLocaleString('en-IN'),
      Math.round(yrData.totalAccumulatedInt || 0).toLocaleString('en-IN'),
      Math.round(yrData.totalCB).toLocaleString('en-IN')
    ]);

    const grandSub = data.reduce((sum, item) => sum + item.totalSub, 0);
    const grandWd = data.reduce((sum, item) => sum + item.totalWd, 0);
    const grandIntCredited = data.reduce((sum, item) => sum + item.totalIntRelease, 0);
    const grandCalcInt = data.reduce((sum, item) => sum + item.totalIntAccrued, 0);
    const latestAccInt = data.length > 0 ? (data[data.length - 1].totalAccumulatedInt || 0) : 0;

    autoTable(doc, {
      head: abstractTableHeaders,
      body: abstractTableRows,
      foot: [[
        'TOTAL / SUMMARY',
        '',
        '--',
        Math.round(grandSub).toLocaleString('en-IN'),
        Math.round(grandWd).toLocaleString('en-IN'),
        Math.round(grandIntCredited).toLocaleString('en-IN'),
        Math.round(grandCalcInt).toLocaleString('en-IN'),
        Math.round(latestAccInt).toLocaleString('en-IN'),
        '--'
      ]],
      startY: 58,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, halign: 'center' },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [243, 244, 246], textColor: [17, 24, 39], fontStyle: 'bold' },
      columnStyles: {
        0: { halign: 'left', fontStyle: 'bold' },
        8: { fontStyle: 'bold' }
      }
    });

    // SUBSEQUENT PAGES: INDIVIDUAL FINANCIAL YEARS BREAKDOWN
    data.filter(d => yearsToPrint.includes(d.fy)).forEach((yrData) => {
      doc.addPage();
      
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('GOVERNMENT OF TAMIL NADU', 105, 12, { align: 'center' });
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text('TOWN PANCHAYATS DEPARTMENT', 105, 17, { align: 'center' });
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.text(`CONSOLIDATED PROVIDENT FUND ACCOUNT SLIP`, 105, 23, { align: 'center' });
      
      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(`FINANCIAL YEAR: ${yrData.fy}`, 105, 28, { align: 'center' });
      
      // Box
      doc.setDrawColor(200, 200, 200);
      doc.setFillColor(245, 247, 250);
      doc.rect(14, 32, 182, 22, 'FD');
      
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(50, 50, 50);
      doc.text(`Year:`, 18, 38);
      doc.text(`Active Subscribers:`, 18, 44);
      doc.text(`Opening Balance:`, 122, 38);
      doc.text(`District / TP:`, 122, 44);
      
      doc.setFont('helvetica', 'normal');
      doc.text(`${yrData.fy}`, 55, 38);
      doc.text(`${yrData.subscribersCount} Employees`, 55, 44);
      doc.text(`Rs. ${Math.round(yrData.totalOB).toLocaleString('en-IN')}`, 155, 38);
      doc.text(`${reportFilterDistrict === 'all' ? 'All' : reportFilterDistrict} / ${activeReportFilterTp === 'all' ? 'All' : getTpName(activeReportFilterTp)}`, 155, 44);

      const tableHeaders = [['Month', 'Opening (Rs.)', 'Subscription (Rs.)', 'PF Advance (Rs.)', 'Govt Int Release (Rs.)', 'Closing (Rs.)', 'Interest Accrued (Rs.)']];
      
      const tableRows = yrData.months.map((row: any) => [
        row.monthLabel,
        Math.round(row.opening).toLocaleString('en-IN'),
        Math.round(row.subscription).toLocaleString('en-IN'),
        Math.round(row.withdrawal).toLocaleString('en-IN'),
        row.interestRelease > 0 ? Math.round(row.interestRelease).toLocaleString('en-IN') : '0',
        Math.round(row.closing).toLocaleString('en-IN'),
        Math.round(row.interestEarned).toLocaleString('en-IN')
      ]);
      
      tableRows.push([
        `Accrued Interest for FY ${yrData.fy}`,
        '--',
        '--',
        '--',
        '--',
        '--',
        `+ Rs. ${Math.round(yrData.totalIntAccrued).toLocaleString('en-IN')}`
      ]);
      tableRows.push([
        'CLOSING BALANCE',
        '--',
        '--',
        '--',
        '--',
        '--',
        `Rs. ${Math.round(yrData.totalCB).toLocaleString('en-IN')}`
      ]);

      autoTable(doc, {
        head: tableHeaders,
        body: tableRows,
        startY: 58,
        theme: 'grid',
        styles: { fontSize: 7.5, cellPadding: 1.8, halign: 'center' },
        headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold' }
        }
      });

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
        'Total PF Advance (-)', 
        'Govt Int Release (+)', 
        'Calculated Interest (FY)', 
        'Total Acc. Int', 
        'Closing Balance (CB)'
      ]];

      autoTable(doc, {
        head: abstractHead,
        body: [[
          `Rs. ${Math.round(yrData.totalOB).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(yrData.totalSub).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(yrData.totalWd).toLocaleString('en-IN')}`,
          yrData.totalIntRelease > 0 ? `Rs. ${Math.round(yrData.totalIntRelease).toLocaleString('en-IN')}` : '0',
          `Rs. ${Math.round(yrData.totalIntAccrued).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(yrData.totalAccumulatedInt || 0).toLocaleString('en-IN')}`,
          `Rs. ${Math.round(yrData.totalCB).toLocaleString('en-IN')}`
        ]],
        startY: abstractStartY + 4,
        theme: 'grid',
        styles: { fontSize: 7.5, halign: 'center', cellPadding: 2 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          6: { fontStyle: 'bold' }
        }
      });
    });

    doc.save(`Consolidated-PF-Report-${pfReportFy}.pdf`);
  };

  // 3. Interest Report Exporters
  const handleDownloadInterestReportPDF = (empId: string) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TOWN PANCHAYATS DEPARTMENT, TAMIL NADU', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text('YEAR-WISE ACCRUED INTEREST STATEMENT', 105, 21, { align: 'center' });
    
    const emp = filteredEmployeesList.find((e: any) => e.employeeId === empId);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`Subscriber Name: ${emp ? emp.nameEn : 'N/A'} (ID: ${empId})`, 14, 28);
    doc.text(`Town Panchayat: ${emp ? getTpName(emp.townPanchayatId) : 'N/A'}`, 14, 33);
    
    const tableHeaders = [['Financial Year', 'Rate', 'Opening Bal', 'Subscriptions', 'PF Advance', 'Closing (Pre-Int)', 'Interest', 'Closing Bal']];
    const breakdown = getInterestBreakdown(empId);
    const tableRows = breakdown.map((b: any) => [
      b.fy,
      `${b.rate}%`,
      `Rs. ${Math.round(b.openingBalance).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(b.subscriptions).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(b.withdrawals).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(b.closingBalanceBeforeInterest).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(b.interestEarned).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(b.closingBalanceWithInterest).toLocaleString('en-IN')}`
    ]);
    
    const totalSub = breakdown.reduce((sum, b) => sum + b.subscriptions, 0);
    const totalWd = breakdown.reduce((sum, b) => sum + b.withdrawals, 0);
    const totalInt = breakdown.reduce((sum, b) => sum + b.interestEarned, 0);
    const finalCB = breakdown[breakdown.length - 1]?.closingBalanceWithInterest || 0;
    
    tableRows.push([
      'GRAND TOTALS',
      '--',
      '--',
      `Rs. ${Math.round(totalSub).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(totalWd).toLocaleString('en-IN')}`,
      '--',
      `Rs. ${Math.round(totalInt).toLocaleString('en-IN')}`,
      `Rs. ${Math.round(finalCB).toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      head: tableHeaders,
      body: tableRows,
      startY: 38,
      theme: 'grid',
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold' }
    });

    doc.save(`PF-Interest-Report-${empId}.pdf`);
  };

  const handleDownloadInterestReportExcel = (empId: string) => {
    const breakdown = getInterestBreakdown(empId);
    const emp = filteredEmployeesList.find((e: any) => e.employeeId === empId);

    const wb = XLSX.utils.book_new();

    // 1. Overall Accrued Interest Summary Sheet
    const summaryRows: any[] = [];
    summaryRows.push(['TOWN PANCHAYATS DEPARTMENT, TAMIL NADU']);
    summaryRows.push(['YEAR-WISE ACCRUED INTEREST STATEMENT']);
    summaryRows.push([]);
    summaryRows.push([`Subscriber Name: ${emp ? emp.nameEn : 'N/A'} (ID: ${empId})`]);
    summaryRows.push([`Town Panchayat: ${emp ? getTpName(emp.townPanchayatId) : 'N/A'}`]);
    summaryRows.push([]);

    const headers = ['Financial Year', 'Rate', 'Opening Bal', 'Subscriptions', 'PF Advance', 'Closing (Pre-Int)', 'Interest', 'Closing Bal'];
    summaryRows.push(headers);

    breakdown.forEach((b: any) => {
      summaryRows.push([
        b.fy,
        `${b.rate}%`,
        Math.round(b.openingBalance),
        Math.round(b.subscriptions),
        Math.round(b.withdrawals),
        Math.round(b.closingBalanceBeforeInterest),
        Math.round(b.interestEarned),
        Math.round(b.closingBalanceWithInterest)
      ]);
    });

    const totalSub = breakdown.reduce((sum, b) => sum + b.subscriptions, 0);
    const totalWd = breakdown.reduce((sum, b) => sum + b.withdrawals, 0);
    const totalInt = breakdown.reduce((sum, b) => sum + b.interestEarned, 0);
    const finalCB = breakdown[breakdown.length - 1]?.closingBalanceWithInterest || 0;

    summaryRows.push([]);
    summaryRows.push([
      'GRAND TOTALS',
      '--',
      '--',
      Math.round(totalSub),
      Math.round(totalWd),
      '--',
      Math.round(totalInt),
      Math.round(finalCB)
    ]);

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Monthly details for each year in separate sheets
    breakdown.forEach((b: any) => {
      const sheetRows: any[] = [];
      sheetRows.push([`TOWN PANCHAYATS DEPARTMENT, TAMIL NADU`]);
      sheetRows.push([`MONTHLY ACCRUED INTEREST CALCULATION DETAIL - FY ${b.fy}`]);
      sheetRows.push([]);
      sheetRows.push([`Subscriber Name: ${emp ? emp.nameEn : 'N/A'} (ID: ${empId})`]);
      sheetRows.push([`Interest Rate: ${b.rate}%`]);
      sheetRows.push([]);

      sheetRows.push(['Month', 'Opening Balance (Rs.)', 'Monthly Subscription (Rs.)', 'PF Advance (Rs.)', 'Closing Balance (Rs.)', 'Interest Earned (Rs.)']);

      // Get monthly history for this specific year
      const trail = pfAuditTrail[empId];
      const monthlyHistory = trail ? trail.monthlyHistory : [];
      const filteredRows = monthlyHistory.filter((row: any) => {
        if (row.type === 'INTEREST_CREDIT') return false;
        const [yrStr, moStr] = row.yearMonth.split('-');
        const yr = parseInt(yrStr, 10);
        const mo = parseInt(moStr, 10);
        let rowFy = (mo <= 3) ? `${yr - 1}-${yr}` : `${yr}-${yr + 1}`;
        return rowFy === b.fy;
      });

      filteredRows.forEach((row: any) => {
        sheetRows.push([
          formatMonthLabel(row.yearMonth, lang),
          Math.round(row.opening),
          row.subscription,
          row.withdrawal > 0 ? row.withdrawal : 0,
          Math.round(row.closing),
          Math.round(row.interestEarned)
        ]);
      });

      sheetRows.push([]);
      sheetRows.push([
        'YEAR END CREDITS',
        '--',
        '--',
        '--',
        '--',
        Math.round(b.interestEarned)
      ]);
      sheetRows.push([
        'CLOSING BALANCE',
        '--',
        '--',
        '--',
        '--',
        Math.round(b.closingBalanceWithInterest)
      ]);

      const wsYear = XLSX.utils.aoa_to_sheet(sheetRows);
      XLSX.utils.book_append_sheet(wb, wsYear, `FY ${b.fy} Details`);
    });

    XLSX.writeFile(wb, `PF_Interest_Report_${empId}.xlsx`);
  };

  // Account slip generation and exporters
  const handleDownloadAccountSlipPDF = async (empId: string, fy: string, printOnly: boolean = false) => {
    if (lang === 'ta') {
      const elem = document.getElementById('pf-account-slip');
      if (elem) {
        if (fy === 'all') {
          const allYears = getEmployeeSlipYears(pfEmployees, empId, currentOfficeSetup?.openingDate || '2023-04-01');
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

    const empSlipYears = getEmployeeSlipYears(pfEmployees, empId, currentOfficeSetup?.openingDate || '2023-04-01');
    const yearsToPrint = fy === 'all' ? [...empSlipYears].reverse() : [fy];
    const allYearSummaries = getYearWiseSummary(pfAuditTrail, pfSubscriptions, pfEmployees, empId);

    // PAGE 1: ABSTRACT OF TOTAL YEAR-WISE DATA
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
    doc.text(pfSetup?.settlement ? `Settled (${pfSetup.settlement.settlementType})` : `Active`, 155, 38);
    doc.text(`${pfSetup?.openingDate || 'N/A'}`, 155, 44);
    doc.text(`${allYearSummaries.length} Financial Years`, 155, 50);
    doc.text(`${jurisdiction.districtName} / ${jurisdiction.zoneName}`, 155, 56);

    // Consolidated Year-Wise Abstract Table
    const abstractTableHeaders = [[
      'Financial Year', 
      'Opening Bal (Rs.)', 
      'Subscriptions (+)', 
      'PF Advance (-)', 
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

    // SUBSEQUENT PAGES: INDIVIDUAL FINANCIAL YEARS
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

      const fyBalances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, empId, currentFy);

      doc.setFont('helvetica', 'bold');
      doc.text(`Account Status:`, 122, 43);
      doc.text(`Opening Balance:`, 122, 49);
      doc.text(`District / Zone:`, 122, 55);
      
      doc.setFont('helvetica', 'normal');
      doc.text(pfSetup?.settlement ? `Settled (${pfSetup.settlement.settlementType})` : `Active`, 155, 43);
      doc.text(`Rs. ${Math.round(fyBalances.openingBalance).toLocaleString('en-IN')}`, 155, 49);
      doc.text(`${jurisdiction.districtName} / ${jurisdiction.zoneName}`, 155, 55);

      const tableHeaders = [['Month', 'Opening (Rs.)', 'Subscription (Rs.)', 'Deducted Salary Month', 'PF Advance (Rs.)', 'Closing (Rs.)', 'Rate', 'Int. Earned']];
      
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
        Math.round(row.interestEarned).toLocaleString('en-IN')
      ]);
      
      const isCompletedMarch = fyBalances.isCompletedMarch;
      const latestMonthStr = fyBalances.latestMonth ? formatMonthLabel(fyBalances.latestMonth, lang) : 'Current Month';

      if (isCompletedMarch) {
        if (fyBalances.calculatedInterest > 0) {
          tableRows.push([
            `Accrued Interest for FY ${currentFy}`,
            '--',
            '--',
            '--',
            '--',
            '--',
            '--',
            `+ Rs. ${Math.round(fyBalances.calculatedInterest).toLocaleString('en-IN')}`
          ]);
        }
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
        'Total PF Advance (-)', 
        'Interest Credited (+)', 
        'Calculated Interest (FY)', 
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
      
      if (pfSetup?.settlement) {
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

    const empSlipYears = getEmployeeSlipYears(pfEmployees, empId, currentOfficeSetup?.openingDate || '2023-04-01');
    const yearsToExport = fy === 'all' ? [...empSlipYears].reverse() : [fy];
    const allYearSummaries = getYearWiseSummary(pfAuditTrail, pfSubscriptions, pfEmployees, empId);

    // Sheet 1: Consolidated Abstract Summary
    const abstractSheetRows: any[] = [];
    abstractSheetRows.push(['GOVERNMENT OF TAMIL NADU']);
    abstractSheetRows.push(['TOWN PANCHAYATS DEPARTMENT']);
    abstractSheetRows.push([`${jurisdiction.tpName} Town Panchayat, ${jurisdiction.districtName} District, ${jurisdiction.zoneName} Zone`]);
    abstractSheetRows.push(['PROVIDENT FUND CONSOLIDATED ACCOUNT ABSTRACT (YEAR-WISE)']);
    abstractSheetRows.push([]);

    abstractSheetRows.push(['Subscriber Name:', emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A', '', 'Account Status:', pfSetup?.settlement ? `Settled (${pfSetup.settlement.settlementType})` : 'Active']);
    abstractSheetRows.push(['Employee ID:', empId, '', 'Opening Date:', pfSetup?.openingDate || 'N/A']);
    abstractSheetRows.push(['Post:', getEmpDesignation(emp) || 'N/A', '', 'Town Panchayat:', jurisdiction.tpName]);
    abstractSheetRows.push(['District / Zone:', `${jurisdiction.districtName} / ${jurisdiction.zoneName}`, '', 'Total Recorded FYs:', allYearSummaries.length]);
    abstractSheetRows.push([]);

    abstractSheetRows.push([
      'Financial Year', 
      'Opening Balance (Rs.)', 
      'Subscriptions Paid (+)', 
      'PF Advance (-)', 
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

      const fyBalances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, empId, currentFy);

      sheetRows.push(['Subscriber Name:', emp ? (lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn) : 'N/A', '', 'Account Status:', pfSetup?.settlement ? `Settled (${pfSetup.settlement.settlementType})` : 'Active']);
      sheetRows.push(['Employee ID:', empId, '', 'Opening Balance:', Math.round(fyBalances.openingBalance)]);
      sheetRows.push(['Post:', getEmpDesignation(emp) || 'N/A', '', 'Town Panchayat:', jurisdiction.tpName]);
      sheetRows.push(['District / Zone:', `${jurisdiction.districtName} / ${jurisdiction.zoneName}`, '', '', '']);
      sheetRows.push([]);

      sheetRows.push(['Month', 'Opening Balance (Rs.)', 'Subscription Paid (Rs.)', 'Deducted Salary Month', 'PF Advance (Rs.)', 'Closing Balance (Rs.)', 'Interest Rate', 'Interest Accrued (Rs.)']);

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
          Math.round(row.interestEarned)
        ]);
      });

      const isCompletedMarch = fyBalances.isCompletedMarch;
      const latestMonthStr = fyBalances.latestMonth ? formatMonthLabel(fyBalances.latestMonth, lang) : 'Current Month';

      if (isCompletedMarch) {
        if (fyBalances.calculatedInterest > 0) {
          sheetRows.push([
            `Accrued Interest for FY ${currentFy}`,
            '--',
            '--',
            '--',
            '--',
            '--',
            '--',
            Math.round(fyBalances.calculatedInterest)
          ]);
        }
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
      sheetRows.push(['Opening Balance (OB)', 'Total Subscriptions (+)', 'Total PF Advance (-)', 'Interest Credited (+)', 'Calculated Interest (FY)', 'Total Accumulated Interest', 'Closing Balance (CB)']);
      sheetRows.push([
        Math.round(fyBalances.openingBalance),
        Math.round(fyBalances.subscriptionsPaid),
        Math.round(fyBalances.withdrawals),
        fyBalances.interestCredited > 0 ? Math.round(fyBalances.interestCredited) : 0,
        Math.round(fyBalances.calculatedInterest),
        Math.round(fyBalances.totalAccumulatedInterest),
        Math.round(isCompletedMarch ? fyBalances.closingBalance : fyBalances.closingBalanceWithAccruedInterest)
      ]);

      if (pfSetup?.settlement) {
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

  const handlePrintSlip = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Report Tabs Bar */}
      <div className="flex flex-wrap border-b border-slate-200 gap-1 bg-white p-2 rounded-2xl border border-slate-100">
        <button
          onClick={() => setReportsSubTab('employee_wise')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${reportsSubTab === 'employee_wise' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {lang === 'ta' ? 'ஊழியர் வாரியான அறிக்கை' : '1. Employee-wise Report'}
        </button>
        <button
          onClick={() => setReportsSubTab('pf_report')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${reportsSubTab === 'pf_report' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {lang === 'ta' ? '2. பி.எஃப் அறிக்கை' : '2. PF Report'}
        </button>
        <button
          onClick={() => setReportsSubTab('account_slip')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${reportsSubTab === 'account_slip' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'}`}
        >
          {lang === 'ta' ? 'கணக்கு சீட்டு' : '3. Account Slip'}
        </button>
      </div>

      {/* Subtab Contents */}
      {reportsSubTab === 'employee_wise' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                {lang === 'ta' ? 'ஊழியர் வாரியான பி.எஃப் இருப்பு அறிக்கை' : 'Employee-wise PF Balance Sheet'}
              </h2>
              <p className="text-slate-400 text-[11px] font-medium mt-0.5">Comprehensive audit list of all registered PF subscribers</p>
            </div>
            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={handleDownloadEmployeeWiseReport}
                className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ta' ? 'எக்செல் பதிவிறக்கம்' : 'Export Excel'}</span>
              </button>
              <button
                onClick={handleDownloadEmployeeWisePDF}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase tracking-wider rounded-xl border border-indigo-200 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ta' ? 'PDF பதிவிறக்கம்' : 'Export PDF'}</span>
              </button>
              <button
                onClick={handlePrintSlip}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ta' ? 'அச்சிடு' : 'Print List'}</span>
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className={`grid grid-cols-1 ${currentUser?.scopeType === 'HOD' || currentUser?.roleId === 'admin' || currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {lang === 'ta' ? 'சந்தாதாரர் / பணியாளர்' : 'Subscriber / Employee'}
              </label>
              <select
                value={reportFilterEmpId}
                onChange={(e) => setReportFilterEmpId(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
              >
                <option value="all">
                  {lang === 'ta' ? 'அனைத்து சந்தாதாரர்கள்' : 'All Subscribers'}
                </option>
                {filteredEmployeesList.filter((emp: any) => {
                  const matchesTp = activeReportFilterTp === 'all' || emp.townPanchayatId === activeReportFilterTp;
                  return matchesTp && pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId);
                }).map((e: any) => (
                  <option key={e.id || e.employeeId} value={e.employeeId}>
                    {e.employeeId} - {lang === 'ta' ? (e.nameTa || e.nameEn) : e.nameEn}
                  </option>
                ))}
              </select>
            </div>

            {(currentUser?.scopeType === 'HOD' || currentUser?.roleId === 'admin' || currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad') && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'மாவட்ட வரம்பு' : 'District Scope'}
                </label>
                <select
                  value={reportFilterDistrict}
                  onChange={(e) => {
                    setReportFilterDistrict(e.target.value);
                    setReportFilterTp('all');
                  }}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
                >
                  <option value="all">
                    {lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}
                  </option>
                  {(state?.districts || [])
                    .filter((d: any) => {
                      if (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad') {
                        return d.zoneId === currentUser.scopeId;
                      }
                      return true;
                    })
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>{lang === 'ta' ? (d.nameTa || d.nameEn) : d.nameEn}</option>
                    ))}
                </select>
              </div>
            )}

            {allowedTownPanchayats.length > 1 && (
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'பேரூராட்சி வரம்பு' : 'Town Panchayat Scope'}
                </label>
                <select
                  value={reportFilterTp}
                  onChange={(e) => setReportFilterTp(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
                >
                  <option value="all">
                    {lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'}
                  </option>
                  {reportsFilteredTownPanchayats.map((tp: any) => (
                    <option key={tp.id} value={tp.id}>{lang === 'ta' ? (tp.nameTa || tp.nameEn) : tp.nameEn}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                {lang === 'ta' ? 'நிதியாண்டு' : 'Financial Year'}
              </label>
              <select
                value={employeeWiseFy}
                onChange={(e) => setEmployeeWiseFy(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
              >
                <option value="all">
                  {lang === 'ta' ? 'அனைத்து ஆண்டுகள்' : 'All Years'}
                </option>
                {getEmployeeSlipYears(pfEmployees, '', currentOfficeSetup?.openingDate || '2023-04-01').map((y) => (
                  <option key={y} value={y}>{y.replace('-', ' - ')}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div id="pf-employee-wise-report-table" className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4 pl-6">Subscriber ID</th>
                  <th className="p-4">Name / Post</th>
                  <th className="p-4">Town Panchayat</th>
                  <th className="p-4 text-right">Opening Bal</th>
                  <th className="p-4 text-right text-emerald-600">Subscriptions</th>
                  <th className="p-4 text-right text-rose-600 font-bold">{lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}</th>
                  <th className="p-4 text-right text-indigo-600">Int. Credited</th>
                  <th className="p-4 text-right pr-6 font-bold">Closing Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-600 font-mono">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400 italic font-sans bg-slate-50/50">
                      No active subscribers match the selected search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp: any) => {
                    const balances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, emp.employeeId, employeeWiseFy);
                    return (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/30">
                        <td className="p-4 pl-6 font-bold">{emp.employeeId}</td>
                        <td className="p-4 font-sans text-slate-800">
                          <p className="font-extrabold text-slate-900">{lang === 'ta' ? (emp.nameTa || emp.nameEn) : emp.nameEn}</p>
                          <p className="text-[10px] text-slate-400 font-medium mt-0.5">{getEmpDesignation(emp)}</p>
                        </td>
                        <td className="p-4 font-sans text-slate-600 font-semibold">{getTpName(emp.townPanchayatId)}</td>
                        <td className="p-4 text-right">₹ {Math.round(balances.openingBalance).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right text-emerald-600 font-bold">+ ₹ {Math.round(balances.subscriptionsPaid).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right text-rose-600 font-bold">- ₹ {Math.round(balances.withdrawals).toLocaleString('en-IN')}</td>
                        <td className="p-4 text-right text-indigo-600 font-bold">
                          {balances.interestCredited > 0 ? `+ ₹ ${Math.round(balances.interestCredited).toLocaleString('en-IN')}` : '₹ 0'}
                        </td>
                        <td className="p-4 text-right pr-6 font-extrabold text-indigo-700">₹ {Math.round(balances.closingBalance).toLocaleString('en-IN')}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportsSubTab === 'pf_report' && (() => {
        const abstractData = getAbstractReportData();
        return (
          <div className="bg-white rounded-3xl border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                  {lang === 'ta' ? 'வருங்கால வைப்பு நிதி அறிக்கை (பி.எஃப் அறிக்கை)' : 'Provident Fund Report (PF Report)'}
                </h2>
                <p className="text-slate-400 text-[11px] font-medium mt-0.5">Financial year-wise details of all subscribers with monthly breakups</p>
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <button
                  onClick={handleDownloadPfReportExcel}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'ta' ? 'எக்செல் பதிவிறக்கம்' : 'Export Excel'}</span>
                </button>
                <button
                  onClick={handleDownloadPfReportPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{lang === 'ta' ? 'PDF பதிவிறக்கம்' : 'Export PDF'}</span>
                </button>
              </div>
            </div>

            {/* PF Report Scope Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {(currentUser?.scopeType === 'HOD' || currentUser?.roleId === 'admin' || currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad') && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {lang === 'ta' ? 'மாவட்ட வரம்பு' : 'District Scope'}
                  </label>
                  <select
                    value={reportFilterDistrict}
                    onChange={(e) => {
                      setReportFilterDistrict(e.target.value);
                      setReportFilterTp('all');
                    }}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
                  >
                    <option value="all">
                      {lang === 'ta' ? 'அனைத்து மாவட்டங்கள்' : 'All Districts'}
                    </option>
                    {(state?.districts || [])
                      .filter((d: any) => {
                        if (currentUser?.scopeType === 'Zone' || currentUser?.roleId === 'ad') {
                          return d.zoneId === currentUser.scopeId;
                        }
                        return true;
                      })
                      .map((d: any) => (
                        <option key={d.id} value={d.id}>{lang === 'ta' ? (d.nameTa || d.nameEn) : d.nameEn}</option>
                      ))}
                  </select>
                </div>
              )}

              {allowedTownPanchayats.length > 1 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                    {lang === 'ta' ? 'பேரூராட்சி வரம்பு' : 'Town Panchayat Scope'}
                  </label>
                  <select
                    value={reportFilterTp}
                    onChange={(e) => setReportFilterTp(e.target.value)}
                    className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
                  >
                    <option value="all">
                      {lang === 'ta' ? 'அனைத்து பேரூராட்சிகள்' : 'All Town Panchayats'}
                    </option>
                    {reportsFilteredTownPanchayats.map((tp: any) => (
                      <option key={tp.id} value={tp.id}>{lang === 'ta' ? (tp.nameTa || tp.nameEn) : tp.nameEn}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'நிதியாண்டு' : 'Financial Year'}
                </label>
                <select
                  value={pfReportFy}
                  onChange={(e) => setPfReportFy(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-xs outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium text-slate-700"
                >
                  <option value="all">
                    {lang === 'ta' ? 'அனைத்து ஆண்டுகள்' : 'All Years'}
                  </option>
                  {getEmployeeSlipYears(pfEmployees, '', currentOfficeSetup?.openingDate || '2023-04-01').map((y) => (
                    <option key={y} value={y}>{y.replace('-', ' - ')}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* PF Report Table with Year-wise Expansions */}
            <div id="pf-report-abstract" className="space-y-4">
              {abstractData.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 text-slate-400 italic rounded-3xl border border-slate-100 font-medium">
                  {lang === 'ta' 
                    ? 'தேர்ந்தெடுக்கப்பட்ட வரம்பிற்குள் ஒருங்கிணைக்கப்பட்ட பரிவர்த்தனைகள் எதுவும் இல்லை.'
                    : 'No consolidated transactions found for the selected scope.'}
                </div>
              ) : (
                abstractData
                  .filter(row => pfReportFy === 'all' || row.fy === pfReportFy)
                  .map((row) => (
                    <div key={row.fy} className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* Year Row Header */}
                      <div 
                        onClick={() => setExpandedPfReportYrs(prev => ({ ...prev, [row.fy]: !prev[row.fy] }))}
                        className="bg-slate-50 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer select-none hover:bg-slate-100/70 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 text-xs font-mono font-bold">
                            {expandedPfReportYrs[row.fy] ? '▼' : '▶'}
                          </span>
                          <div>
                            <p className="font-extrabold text-slate-900 text-sm">
                              {lang === 'ta' ? `நிதியாண்டு ${row.fy}` : `Financial Year ${row.fy}`}
                            </p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                              {row.subscribersCount} {lang === 'ta' ? 'செயலில் உள்ள சந்தாதாரர்கள்' : 'Active Subscribers'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3 text-xs font-mono w-full md:w-auto">
                          <div>
                            <p className="text-[9px] text-slate-400 uppercase font-bold font-sans">{lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening'}</p>
                            <p className="font-bold text-slate-700">₹{Math.round(row.totalOB).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-emerald-600 uppercase font-bold font-sans">{lang === 'ta' ? 'சந்தாக்கள்' : 'Subscriptions'}</p>
                            <p className="font-bold text-emerald-600">+₹{Math.round(row.totalSub).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-rose-600 uppercase font-bold font-sans">{lang === 'ta' ? 'முன்பணம்' : 'Advance'}</p>
                            <p className="font-bold text-rose-600">-₹{Math.round(row.totalWd).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-indigo-600 uppercase font-bold font-sans">{lang === 'ta' ? 'வட்டி ஒதுக்கீடு' : 'Govt Int Release'}</p>
                            <p className="font-bold text-indigo-600">
                              {row.totalIntRelease > 0 ? `+₹${Math.round(row.totalIntRelease).toLocaleString('en-IN')}` : '₹0'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[9px] text-amber-600 uppercase font-bold font-sans">{lang === 'ta' ? 'வருட வட்டி' : 'Accrued Int (FY)'}</p>
                            <p className="font-bold text-amber-600">+₹{Math.round(row.totalIntAccrued).toLocaleString('en-IN')}</p>
                          </div>
                          <div>
                            <p className="text-[9px] text-slate-500 uppercase font-bold font-sans">{lang === 'ta' ? 'மொத்த வட்டி' : 'Total Acc. Int'}</p>
                            <p className="font-bold text-slate-600">₹{Math.round(row.totalAccumulatedInt || 0).toLocaleString('en-IN')}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] text-indigo-900 uppercase font-bold font-sans">{lang === 'ta' ? 'முடிவு இருப்பு' : 'Closing'}</p>
                            <p className="font-extrabold text-indigo-800">₹{Math.round(row.totalCB).toLocaleString('en-IN')}</p>
                          </div>
                        </div>
                      </div>

                      {/* Month wise expansion */}
                      {expandedPfReportYrs[row.fy] && (
                        <div className="border-t border-slate-100 bg-white p-4 overflow-x-auto">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className="bg-slate-50 font-bold text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="p-3">{lang === 'ta' ? 'காலம்' : 'Period'}</th>
                                <th className="p-3 text-right">{lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Bal'}</th>
                                <th className="p-3 text-right text-emerald-600">{lang === 'ta' ? 'சந்தாக்கள்' : 'Subscriptions'}</th>
                                <th className="p-3">{lang === 'ta' ? 'சம்பளம் பிடித்தம் செய்த மாதம் / சலான் குறிப்புகள்' : 'Salary Deducted Month / Challan References'}</th>
                                <th className="p-3 text-right text-rose-600">{lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}</th>
                                <th className="p-3 text-right text-indigo-600">{lang === 'ta' ? 'அரசு வட்டி ஒதுக்கீடு' : 'Govt Int Release'}</th>
                                <th className="p-3 text-right text-slate-500">{lang === 'ta' ? 'திரண்ட வட்டி' : 'Accrued Interest'}</th>
                                <th className="p-3 text-right pr-6 font-bold text-indigo-900">{lang === 'ta' ? 'முடிவு இருப்பு' : 'Closing Bal'}</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                              {row.months.map((mo) => (
                                <tr key={mo.yearMonth} className="hover:bg-slate-50/40">
                                  <td className="p-3 font-sans font-extrabold text-slate-900">{formatMonthLabel(mo.yearMonth, lang)}</td>
                                  <td className="p-3 text-right">₹ {Math.round(mo.opening).toLocaleString('en-IN')}</td>
                                  <td className="p-3 text-right text-emerald-600 font-bold">+ ₹ {Math.round(mo.subscription).toLocaleString('en-IN')}</td>
                                  <td className="p-3 font-sans">
                                    {mo.challansList.length === 0 ? (
                                      <span className="text-slate-400 italic">{lang === 'ta' ? 'நடவடிக்கை இல்லை' : 'No activity'}</span>
                                    ) : (
                                      <div className="space-y-1">
                                        {mo.challansList.map((ch: any, cidx: number) => (
                                          <div key={cidx} className="text-[10px] font-medium text-slate-700 flex flex-wrap gap-x-1.5 items-center">
                                            <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-bold font-mono">
                                              {lang === 'ta' ? 'சலான்:' : 'Challan:'} {ch.no}
                                            </span>
                                            <span className="text-slate-400">({formatDateLabel(ch.date)})</span>
                                            {ch.deductedSalaryMonths && (
                                              <span className="text-indigo-600 font-bold">{lang === 'ta' ? 'சம்பளம்:' : 'Salary:'} {ch.deductedSalaryMonths}</span>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-right text-rose-600 font-bold">
                                    {mo.withdrawal > 0 ? `- ₹ ${Math.round(mo.withdrawal).toLocaleString('en-IN')}` : '--'}
                                  </td>
                                  <td className="p-3 text-right text-indigo-600 font-bold">
                                    {mo.interestRelease > 0 ? `+ ₹ ${Math.round(mo.interestRelease).toLocaleString('en-IN')}` : '--'}
                                  </td>
                                  <td className="p-3 text-right text-slate-500 font-bold">₹ {Math.round(mo.interestEarned).toLocaleString('en-IN')}</td>
                                  <td className="p-3 text-right pr-6 font-extrabold text-indigo-900">₹ {Math.round(mo.closing).toLocaleString('en-IN')}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  ))
              )}
            </div>
          </div>
        );
      })()}

      {reportsSubTab === 'account_slip' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto items-center">
              <div className="w-full sm:w-64">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'சந்தாதாரரைத் தேர்ந்தெடுக்கவும்' : 'Choose Employee'}
                </label>
                <select
                  value={reportEmpId === 'all' ? '' : reportEmpId}
                  onChange={(e) => setReportEmpId(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium"
                >
                  <option value="">
                    {lang === 'ta' ? '-- சந்தாதாரரைத் தேர்ந்தெடுக்கவும் --' : '-- Select Subscriber --'}
                  </option>
                  {filteredEmployeesList.filter((emp: any) => pfEmployees.some((pe: PfEmployee) => pe.employeeId === emp.employeeId)).map((e: any) => (
                    <option key={e.id || e.employeeId} value={e.employeeId}>{e.employeeId} - {getEmpName(e.employeeId)}</option>
                  ))}
                </select>
              </div>

              <div className="w-full sm:w-48">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  {lang === 'ta' ? 'நிதியாண்டு' : 'Financial Year'}
                </label>
                <select
                  value={accountSlipFy}
                  onChange={(e) => setAccountSlipFy(e.target.value)}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm outline-none bg-white focus:ring-2 focus:ring-indigo-100 font-medium"
                >
                  <option value="all">
                    {lang === 'ta' ? 'அனைத்து ஆண்டுகள்' : 'All Years'}
                  </option>
                  {getEmployeeSlipYears(pfEmployees, reportEmpId, currentOfficeSetup?.openingDate || '2023-04-01').map((y) => (
                    <option key={y} value={y}>{y.replace('-', ' - ')}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              <button
                onClick={() => handleDownloadAccountSlipExcel(reportEmpId, accountSlipFy)}
                disabled={!reportEmpId || reportEmpId === 'all'}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  reportEmpId && reportEmpId !== 'all'
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ta' ? 'எக்செல் பதிவிறக்கம்' : 'Export Excel'}</span>
              </button>
              <button
                onClick={() => handleDownloadAccountSlipPDF(reportEmpId, accountSlipFy, false)}
                disabled={!reportEmpId || reportEmpId === 'all'}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
                  reportEmpId && reportEmpId !== 'all'
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' 
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                }`}
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'ta' ? 'PDF பதிவிறக்கம்' : 'Export PDF'}</span>
              </button>
              <button
                onClick={() => handleDownloadAccountSlipPDF(reportEmpId, accountSlipFy, true)}
                disabled={!reportEmpId || reportEmpId === 'all'}
                className={`flex items-center gap-2 px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-xl shadow transition-all cursor-pointer ${
                  reportEmpId && reportEmpId !== 'all'
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Printer className="w-4 h-4" />
                <span>{lang === 'ta' ? 'அச்சிடு' : 'Print Slip'}</span>
              </button>
            </div>
          </div>

          {!reportEmpId || reportEmpId === 'all' ? (
            <div className="bg-slate-50 rounded-3xl border border-slate-100 p-12 text-center text-slate-500 italic">
              {lang === 'ta' 
                ? 'தனிப்பட்ட கணக்கு ஏட்டைக் காண மற்றும் அச்சிட கீழ்தோன்றும் பட்டியலில் இருந்து பணியாளர் சந்தாதாரரைத் தேர்ந்தெடுக்கவும்.'
                : 'Please select an employee subscriber from the dropdown to display and print their individual account ledger slip.'}
            </div>
          ) : (
            <div id="pf-account-slip" className="bg-white rounded-3xl border border-slate-200 p-8 space-y-8 max-w-4xl mx-auto shadow-sm relative overflow-hidden print:border-none print:shadow-none">
              {(() => {
                const empObj = employees.find((e: any) => e.employeeId === reportEmpId);
                const jurisdiction = getTpJurisdictionDetails(empObj?.townPanchayatId);
                return (
                  <div className="flex justify-between items-start border-b border-slate-200 pb-6">
                    <div>
                      <h1 className="text-lg font-extrabold text-slate-900 tracking-tight uppercase">
                        {lang === 'ta' ? 'தமிழ்நாடு அரசு' : 'GOVERNMENT OF TAMIL NADU'}
                      </h1>
                      <h2 className="text-sm font-bold text-slate-700 tracking-tight uppercase">
                        {lang === 'ta' ? 'பேரூராட்சிகள் துறை' : 'TOWN PANCHAYATS DEPARTMENT'}
                      </h2>
                      <p className="text-sm text-indigo-700 font-bold uppercase tracking-wide mt-0.5">
                        {lang === 'ta'
                          ? `${jurisdiction.tpName} பேரூராட்சி | ${jurisdiction.districtName} மாவட்டம் | ${jurisdiction.zoneName} மண்டலம்`
                          : `${jurisdiction.tpName} Town Panchayat | ${jurisdiction.districtName} District | ${jurisdiction.zoneName} Zone`}
                      </p>
                      <p className="text-xs text-slate-500 font-semibold mt-1">
                        {lang === 'ta' ? 'வருங்கால வைப்பு நிதி கணக்கு விவர ஏடு' : 'Provident Fund Account Ledger Slip'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide border border-slate-200 font-mono">
                        {lang === 'ta' ? `நிதியாண்டு ${accountSlipFy}` : `FY ${accountSlipFy}`}
                      </span>
                      <p className="text-[10px] text-slate-400 font-mono mt-1">
                        {lang === 'ta' ? 'தேதி:' : 'Date:'} {new Date().toISOString().split('T')[0]}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {(() => {
                const empObj = employees.find((e: any) => e.employeeId === reportEmpId);
                const jurisdiction = getTpJurisdictionDetails(empObj?.townPanchayatId);
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-2xl border border-slate-100 text-xs">
                    <div className="space-y-2">
                      <p className="text-slate-500 font-bold uppercase text-[9px] tracking-wide">
                        {lang === 'ta' ? 'கணக்கு வைத்திருப்பவர்' : 'Account Holder'}
                      </p>
                      <p className="font-extrabold text-slate-900 text-sm">{getEmpName(reportEmpId)}</p>
                      <p className="font-mono text-slate-500">
                        {lang === 'ta' ? 'பணியாளர் எண்:' : 'Employee ID:'} {reportEmpId}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-slate-500 font-bold uppercase text-[9px] tracking-wide">
                        {lang === 'ta' ? 'அதிகார வரம்பு விவரங்கள்' : 'Jurisdiction Details'}
                      </p>
                      <p className="font-bold text-slate-800">
                        {lang === 'ta' ? `${jurisdiction.tpName} பேரூராட்சி` : `${jurisdiction.tpName} Town Panchayat`}
                      </p>
                      <p className="text-slate-500">
                        {lang === 'ta'
                          ? `${jurisdiction.districtName} மாவட்டம் | ${jurisdiction.zoneName} மண்டலம்`
                          : `${jurisdiction.districtName} District | ${jurisdiction.zoneName} Zone`}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Year summaries computation */}
              {(() => {
                const summaries = getYearWiseSummary(pfAuditTrail, pfSubscriptions, pfEmployees, reportEmpId);
                const filteredSummaries = accountSlipFy === 'all' 
                  ? summaries 
                  : summaries.filter(s => s.fy === accountSlipFy);

                let statOpening = 0;
                let statSubs = 0;
                let statWds = 0;
                let statIntCredited = 0;
                let statAccInt = 0;
                let statClosing = 0;

                if (filteredSummaries.length > 0) {
                  statOpening = filteredSummaries[0].openingBalance;
                  statSubs = filteredSummaries.reduce((sum, s) => sum + s.subscriptionsPaid, 0);
                  statWds = filteredSummaries.reduce((sum, s) => sum + s.withdrawals, 0);
                  statIntCredited = filteredSummaries.reduce((sum, s) => sum + s.interestCredited, 0);
                  statAccInt = filteredSummaries[filteredSummaries.length - 1].totalAccumulatedInterest;
                  const lastSummary = filteredSummaries[filteredSummaries.length - 1];
                  statClosing = lastSummary.isCompletedMarch ? lastSummary.closingBalance : lastSummary.closingBalanceWithAccruedInterest;
                }

                return (
                  <>
                    {/* Financial Summary Box */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                        <p className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Bal'}
                        </p>
                        <p className="text-sm font-extrabold text-slate-900 font-mono mt-1">
                          ₹ {Math.round(statOpening).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                        <p className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'செலுத்திய சந்தா' : 'Subscriptions'}
                        </p>
                        <p className="text-sm font-extrabold text-emerald-600 font-mono mt-1">
                          + ₹ {Math.round(statSubs).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                        <p className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}
                        </p>
                        <p className="text-sm font-extrabold text-rose-600 font-mono mt-1">
                          - ₹ {Math.round(statWds).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl text-center">
                        <p className="text-slate-500 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'அரசு வரவு வட்டி' : 'Interest Credited'}
                        </p>
                        <p className="text-sm font-extrabold text-indigo-600 font-mono mt-1">
                          {statIntCredited > 0 ? `+ ₹ ${Math.round(statIntCredited).toLocaleString('en-IN')}` : '₹ 0'}
                        </p>
                      </div>
                      <div className="bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl text-center">
                        <p className="text-indigo-700 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'மொத்த திரண்ட வட்டி' : 'Total Acc. Interest'}
                        </p>
                        <p className="text-sm font-extrabold text-indigo-800 font-mono mt-1">
                          ₹ {Math.round(statAccInt).toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-xl text-center">
                        <p className="text-indigo-700 font-bold text-[9px] uppercase tracking-wider">
                          {lang === 'ta' ? 'முடிவு இருப்பு' : 'Closing Balance'}
                        </p>
                        <p className="text-sm font-extrabold text-indigo-700 font-mono mt-1">
                          ₹ {Math.round(statClosing).toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>

                    {/* Year-wise Abstract list */}
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                          {lang === 'ta' ? 'ஆண்டு வாரியான சுருக்கம் (கிளிக் செய்து விரிவுபடுத்தவும்)' : 'Year-wise Abstract (Click row to expand Monthly Activity)'}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {accountSlipFy === 'all' 
                            ? 'Showing abstract for all years. Click any year row to inspect month-wise subscriptions and interest details.' 
                            : `Showing abstract for selected year ${accountSlipFy}.`}
                        </p>
                      </div>

                      <div className="space-y-4">
                        {filteredSummaries.length === 0 ? (
                          <div className="p-8 text-center bg-slate-50 border border-slate-100 text-slate-400 italic rounded-2xl">
                            No transaction history found for the selected criteria.
                          </div>
                        ) : (
                          filteredSummaries.map((yr) => {
                            const isExpanded = expandedAccountSlipYears.includes(yr.fy) || accountSlipFy !== 'all';
                            const effectiveClosingBalance = yr.isCompletedMarch ? yr.closingBalance : yr.closingBalanceWithAccruedInterest;
                            return (
                              <div key={yr.fy} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm transition-all hover:border-slate-300">
                                {/* Header Accordion Bar */}
                                <div 
                                  onClick={() => {
                                    if (accountSlipFy === 'all') {
                                      setExpandedAccountSlipYears(prev => 
                                        prev.includes(yr.fy) ? prev.filter(f => f !== yr.fy) : [...prev, yr.fy]
                                      );
                                    }
                                  }}
                                  className={`flex flex-col sm:flex-row justify-between items-start sm:items-center p-5 gap-4 cursor-pointer select-none transition ${isExpanded ? 'bg-indigo-50/20' : 'hover:bg-slate-50/50'}`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 font-mono">
                                      {yr.fy}
                                    </div>
                                    <div>
                                      <p className="font-extrabold text-slate-800 text-sm">{lang === 'ta' ? `நிதியாண்டு ${yr.fy}` : `Financial Year ${yr.fy}`}</p>
                                      <p className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider">
                                        Interest Rate: {(yr.months[0]?.rate || 7.1)}%
                                      </p>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-6 gap-3 md:gap-5 w-full sm:w-auto text-xs font-mono">
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans">
                                        {lang === 'ta' ? 'தொடக்க இருப்பு' : 'OB'}
                                      </p>
                                      <p className="font-bold text-slate-700 font-mono">₹{Math.round(yr.openingBalance).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans text-emerald-600">
                                        {lang === 'ta' ? 'சந்தா' : 'Subscriptions'}
                                      </p>
                                      <p className="font-bold text-emerald-600 font-mono">+₹{Math.round(yr.subscriptionsPaid).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans text-rose-600">
                                        {lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}
                                      </p>
                                      <p className="font-bold text-rose-600 font-mono">-₹{Math.round(yr.withdrawals).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans text-indigo-600">Int. Credited</p>
                                      <p className="font-bold text-indigo-600 font-mono">
                                        {yr.interestCredited > 0 ? `+₹${Math.round(yr.interestCredited).toLocaleString('en-IN')}` : '₹0'}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans text-indigo-800">
                                        {lang === 'ta' ? 'மொத்த திரண்ட வட்டி' : 'Total Acc. Int'}
                                      </p>
                                      <p className="font-bold text-indigo-800 font-mono">₹{Math.round(yr.totalAccumulatedInterest).toLocaleString('en-IN')}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-[9px] text-slate-400 uppercase font-bold font-sans">
                                        {lang === 'ta' ? 'முடிவு இருப்பு' : 'CB'}
                                      </p>
                                      <p className="font-extrabold text-indigo-700 font-mono">₹{Math.round(effectiveClosingBalance).toLocaleString('en-IN')}</p>
                                    </div>
                                  </div>

                                  {accountSlipFy === 'all' && (
                                    <div className="text-slate-400 shrink-0 self-center">
                                      {isExpanded ? <ChevronUp className="w-5 h-5 text-indigo-500" /> : <ChevronDown className="w-5 h-5" />}
                                    </div>
                                  )}
                                </div>

                                {/* Monthly History Sub-table */}
                                {isExpanded && (
                                  <div className="border-t border-slate-100 bg-slate-50/30 p-4 space-y-6">
                                    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                                      <table className="w-full text-left border-collapse text-xs">
                                        <thead>
                                          <tr className="bg-slate-50 font-bold text-[9px] text-slate-500 uppercase tracking-wider border-b border-slate-200 font-sans">
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'மாதம்' : 'Month'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'தொடக்க இருப்பு' : 'Opening Balance'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'மாதாந்திர சந்தா' : 'Monthly Sub.'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'சம்பளம் பிடித்தம் செய்த மாதம்' : 'Deducted Salary Month'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'சேமநலநிதி முன்பணம்' : 'PF Advance'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'முடிவு இருப்பு' : 'Closing Balance'}</th>
                                            <th className="p-4 font-sans">{lang === 'ta' ? 'வட்டி விகிதம்' : 'PF Int. Rate'}</th>
                                            <th className="p-4 text-right pr-6 font-sans">{lang === 'ta' ? 'ஈட்டிய வட்டி' : 'Int. Earned'}</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-mono text-slate-600">
                                          {yr.months.map((row: any, idx: number) => {
                                            if (row.type === 'INTEREST_CREDIT') {
                                              return (
                                                <tr key={idx} className="bg-emerald-50/40 text-emerald-800 font-sans">
                                                  <td colSpan={7} className="p-4 font-bold text-[11px]">{row.description}</td>
                                                  <td className="p-4 text-right pr-6 font-extrabold font-mono">+ ₹ {Math.round(row.amount).toLocaleString('en-IN')}</td>
                                                </tr>
                                              );
                                            }
                                            return (
                                              <tr key={idx} className="hover:bg-slate-50/30">
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
                                                <td className="p-4 text-slate-500 font-medium">{row.deductedSalaryMonths || '--'}</td>
                                                <td className="p-4 text-rose-600 font-bold">{row.withdrawal > 0 ? `- ₹ ${row.withdrawal.toLocaleString('en-IN')}` : '-'}</td>
                                                <td className="p-4 font-bold">₹ {Math.round(row.closing).toLocaleString('en-IN')}</td>
                                                <td className="p-4 text-slate-500">{row.rate} %</td>
                                                <td className="p-4 text-right pr-6 font-bold text-slate-700">₹ {Math.round(row.interestEarned).toLocaleString('en-IN')}</td>
                                              </tr>
                                            );
                                          })}
                                          {yr.isCompletedMarch ? (
                                            <tr className="bg-indigo-100/70 font-extrabold text-indigo-950">
                                              <td colSpan={7} className="p-4 font-sans uppercase tracking-wider text-xs">
                                                {lang === 'ta' ? 'முடிவு இருப்பு (மார்ச் 31 நிலவரப்படி)' : 'CLOSING BALANCE (as on 31st March)'}
                                              </td>
                                              <td className="p-4 text-right pr-6 font-extrabold font-mono text-indigo-800 text-sm">
                                                ₹ {Math.round(yr.closingBalance).toLocaleString('en-IN')}
                                              </td>
                                            </tr>
                                          ) : (
                                            <tr className="bg-indigo-50 font-extrabold text-indigo-950">
                                              <td colSpan={7} className="p-4 font-sans uppercase tracking-wider text-xs">
                                                {lang === 'ta' 
                                                  ? `முடிவு இருப்பு (${formatMonthLabel(yr.latestMonth, lang)} நிலவரப்படி)` 
                                                  : `CLOSING BALANCE (as on ${formatMonthLabel(yr.latestMonth, lang)})`}
                                              </td>
                                              <td className="p-4 text-right pr-6 font-extrabold font-mono text-indigo-800 text-sm">
                                                ₹ {Math.round(yr.closingBalanceWithAccruedInterest).toLocaleString('en-IN')}
                                              </td>
                                            </tr>
                                          )}
                                        </tbody>
                                      </table>
                                    </div>

                                    {/* ABSTRACT OF THE FINANCIAL YEAR DATA */}
                                    <div className="bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 rounded-2xl border border-indigo-100 p-5 space-y-3">
                                      <div className="flex justify-between items-center border-b border-indigo-100 pb-2">
                                        <p className="font-extrabold text-xs text-indigo-900 uppercase tracking-wider">
                                          {lang === 'ta' ? `நிதியாண்டு சுருக்க விவரம் (${yr.fy})` : `ABSTRACT OF THE FINANCIAL YEAR DATA (${yr.fy})`}
                                        </p>
                                        <span className="text-[10px] font-bold text-indigo-600 bg-white border border-indigo-200 px-2 py-0.5 rounded-full font-mono">
                                          {yr.isCompletedMarch 
                                            ? (lang === 'ta' ? 'முடிவடைந்த நிதியாண்டு' : 'Completed FY') 
                                            : (lang === 'ta' ? `நடப்பு (${formatMonthLabel(yr.latestMonth, lang)})` : `Ongoing as on ${yr.latestMonth}`)}
                                        </span>
                                      </div>
                                      <div className="overflow-x-auto">
                                        <table className="w-full text-center text-xs font-mono">
                                          <thead>
                                            <tr className="text-[9px] uppercase tracking-wider text-slate-500 font-sans border-b border-slate-200">
                                              <th className="p-2">{lang === 'ta' ? 'தொடக்க இருப்பு (OB)' : 'Opening Bal (OB)'}</th>
                                              <th className="p-2 text-emerald-600">{lang === 'ta' ? 'சந்தா (+)' : 'Subscriptions (+)'}</th>
                                              <th className="p-2 text-rose-600">{lang === 'ta' ? 'சேமநலநிதி முன்பணம் (-)' : 'PF Advance (-)'}</th>
                                              <th className="p-2 text-indigo-600">{lang === 'ta' ? 'வரவு வட்டி (+)' : 'Interest Credited (+)'}</th>
                                              <th className="p-2 text-indigo-700">{lang === 'ta' ? 'கணக்கிடப்பட்ட வட்டி' : 'Calculated Int (FY)'}</th>
                                              <th className="p-2 text-indigo-800">{lang === 'ta' ? 'மொத்த திரண்ட வட்டி' : 'Total Acc. Interest'}</th>
                                              <th className="p-2 text-indigo-900">{lang === 'ta' ? 'முடிவு இருப்பு (CB)' : 'Closing Bal (CB)'}</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            <tr className="font-bold text-slate-800">
                                              <td className="p-2.5 font-mono">₹ {Math.round(yr.openingBalance).toLocaleString('en-IN')}</td>
                                              <td className="p-2.5 font-mono text-emerald-600">+ ₹ {Math.round(yr.subscriptionsPaid).toLocaleString('en-IN')}</td>
                                              <td className="p-2.5 font-mono text-rose-600">- ₹ {Math.round(yr.withdrawals).toLocaleString('en-IN')}</td>
                                              <td className="p-2.5 font-mono text-indigo-600">
                                                {yr.interestCredited > 0 ? `+ ₹ ${Math.round(yr.interestCredited).toLocaleString('en-IN')}` : '₹ 0'}
                                              </td>
                                              <td className="p-2.5 font-mono text-indigo-700">₹ {Math.round(yr.calculatedInterest).toLocaleString('en-IN')}</td>
                                              <td className="p-2.5 font-mono text-indigo-800 font-extrabold">₹ {Math.round(yr.totalAccumulatedInterest).toLocaleString('en-IN')}</td>
                                              <td className="p-2.5 font-mono text-indigo-900 font-extrabold text-sm">₹ {Math.round(effectiveClosingBalance).toLocaleString('en-IN')}</td>
                                            </tr>
                                          </tbody>
                                        </table>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              <div className="pt-6 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-400 gap-4">
                  <p>
                    {lang === 'ta' 
                      ? '*இது தமிழ்நாடு பேரூராட்சிகள் துறையின் கணினி வழி உருவாக்கப்பட்ட அறிக்கை.' 
                      : '*This is a digitally generated statement from Tamil Nadu Town Panchayats Department.'}
                  </p>
                  <p className="font-mono text-slate-400">Ledger Code Hash Check: DTPPF_{reportEmpId}_2026</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
