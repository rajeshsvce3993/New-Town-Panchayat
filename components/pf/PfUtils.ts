'use client';

import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { Language } from '../translations';

export interface InterestRate {
  id: string;
  sNo?: number;
  financialYear?: string;
  fromDate: string;
  toDate: string;
  rate: number;
  authority?: string;
  cpsAuthority?: string;
  attachmentName?: string;
  attachmentUrl?: string;
}

export interface IneligibleReferenceDetail {
  id: string;
  name: string;
  designation: string;
  amount: number;
  interest: number;
}

export interface PfEmployee {
  id: string;
  employeeId: string;
  openingBalance: number;
  openingDate: string;
  withdrawals: {
    id: string;
    date: string;
    amount: number;
    reason: string;
    noOfRecoveries?: number;
  }[];
  settlement?: {
    settlementDate: string;
    settlementType: string;
    settlementReason: string;
    finalAmount: number;
    orderNo: string;
    orderDate: string;
  };
}

export interface PfSubscription {
  id: string;
  employeeId: string;
  yearMonth: string; // YYYY-MM
  amount: number;
  subscriptionAmount?: number;
  loanRecovery?: number;
  challanId?: string;
  challanNo?: string;
}

export interface OfficePfSetup {
  id: string;
  openingDate: string;
  officeOpeningBalance: number;
  retiredEmployeeAmount: number;
  deathEmployeeAmount: number;
  otherIneligibleAmount: number;
  actualEligibleAmount: number;
  retiredEmployeeDetails?: IneligibleReferenceDetail[];
  deathEmployeeDetails?: IneligibleReferenceDetail[];
  otherIneligibleDetails?: IneligibleReferenceDetail[];
  breakups: {
    employeeId: string;
    amount: number;
  }[];
}

export const formatDateLabel = (dateInput: any): string => {
  if (!dateInput) return '';
  const dateStr = typeof dateInput === 'string' ? dateInput.trim() : String(dateInput);
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    return dateStr;
  }
  if (/^\d{2}-\d{2}-\d{4}$/.test(dateStr)) {
    return dateStr.replace(/-/g, '/');
  }
  
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    const parts = dateStr.substring(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch (e) {
    // ignore
  }
  return dateStr;
};

export const formatMonthLabel = (yearMonth: string, lang: Language): string => {
  if (!yearMonth || !yearMonth.includes('-')) return yearMonth;
  const parts = yearMonth.split('-');
  const yr = parts[0];
  const mo = parts[1];
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  const monthNamesTa = [
    'ஜன', 'பிப்', 'மார்', 'ஏப்', 'மே', 'ஜூன்',
    'ஜூலை', 'ஆக', 'செப்', 'அக்', 'நவ', 'டிச'
  ];
  const mIdx = parseInt(mo, 10) - 1;
  if (mIdx < 0 || mIdx > 11) return yearMonth;
  const name = lang === 'ta' ? monthNamesTa[mIdx] : monthNames[mIdx];
  return `${name}-${yr}`;
};

export const downloadElementAsPDF = async (elementId: string, filename: string, landscape: boolean = false) => {
  const elem = document.getElementById(elementId);
  if (!elem) return false;

  try {
    const canvas = await html2canvas(elem, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const orientation = landscape ? 'l' : 'p';
    const pdf = new jsPDF(orientation, 'mm', 'a4');
    const pageWidth = landscape ? 297 : 210;
    const pageHeight = landscape ? 210 : 297;
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Error in downloadElementAsPDF:', error);
    return false;
  }
};

export const calculatePfAuditTrail = (
  employees: any[],
  pfEmployees: PfEmployee[],
  pfSubscriptions: PfSubscription[],
  pfInterestRates: InterestRate[],
  pfInterestReleases: any[],
  pfChallans: any[],
  currentUser?: any,
  state?: any,
  lang: Language = 'en'
) => {
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
      // In Method 2, Govt interest received entry is strictly for reference purpose and not minused or altered
      const closingMonthly = calculationMethod === 'method2'
        ? openingMonthly + subAmt - wdAmt
        : openingMonthly + subAmt - wdAmt + irAmt;

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

      // Retirement rule
      const isRetired = emp.retirementDate && new Date(emp.retirementDate) < iterDate;
      const shouldAccrueMonthlyInterest = calculationMethod === 'method3' || !isRetired;
      const monthlyInterest = shouldAccrueMonthlyInterest ? Math.round((closingMonthly * (currentRate / 100)) / 12) : 0;
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
        break;
      }

      // If March end, calculate accrued interest and apply compounding if Method 2 or Method 3
      if (iterDate.getMonth() === 2) { 
        totalInterestCredited += interestAccruedCurrentFY;

        if (calculationMethod === 'method2' || calculationMethod === 'method3') {
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

        interestAccruedCurrentFY = 0;
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
};

export const getAccumulatedInterestUptoMonth = (pfAuditTrail: Record<string, any>, employeeId: string, uptoMonth: string) => {
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

export const getEmployeeBalancesForFy = (
  pfAuditTrail: Record<string, any>,
  pfSubscriptions: PfSubscription[],
  pfEmployees: PfEmployee[],
  employeeId: string,
  fy: string
) => {
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
  const closingWithAccrued = finalClosing + calculatedInterest;

  const pfSetup = pfEmployees.find((p: PfEmployee) => p.employeeId === employeeId);
  const calculationMethod = trail.calculationMethod || pfSetup?.settlement?.settlementType || (pfSetup as any)?.interestMethod || 'method1';

  let closingBalance = finalClosing;
  let closingBalanceWithAccruedInterest = closingWithAccrued;

  if (calculationMethod === 'method1') {
    // Method 1: Closing Balance for each financial year is shown added with accumulated interest,
    // while the subsequent financial year opening balance is shown purely as the principal without interest.
    closingBalance = finalClosing + accumulatedInterestUpToFy;
    closingBalanceWithAccruedInterest = finalClosing + accumulatedInterestUpToFy;
  } else if (calculationMethod === 'method2') {
    // Method 2: No need to minus interest after Govt interest received entry is done; Govt interest is for reference only
    const principalClosing = opening + subsSum - wdsSum;
    closingBalance = principalClosing + calculatedInterest;
    closingBalanceWithAccruedInterest = principalClosing + calculatedInterest;
  } else if (calculationMethod === 'method3') {
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

export const getYearWiseSummary = (
  pfAuditTrail: Record<string, any>,
  pfSubscriptions: PfSubscription[],
  pfEmployees: PfEmployee[],
  employeeId: string
) => {
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
    const balances = getEmployeeBalancesForFy(pfAuditTrail, pfSubscriptions, pfEmployees, employeeId, fy);
    runningAccumulatedInterest += balances.calculatedInterest;

    let closingBalance = balances.closingBalance;
    let closingBalanceWithAccruedInterest = balances.closingBalanceWithAccruedInterest;

    if (calculationMethod === 'method1') {
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

export const getEmployeeSlipYears = (
  pfEmployees: PfEmployee[],
  empId: string,
  currentOfficeSetupOpeningDate: string
) => {
  const pfSetup = empId ? pfEmployees.find((p: PfEmployee) => p.employeeId === empId) : null;
  const opDate = pfSetup?.openingDate || currentOfficeSetupOpeningDate || '2023-04-01';
  
  const parts = opDate.split('-');
  const startYear = parseInt(parts[0], 10) || 2023;
  const startMonth = parseInt(parts[1], 10) || 4;
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

export const getAbstractYearsList = (currentOfficeSetupOpeningDate: string) => {
  const opDate = currentOfficeSetupOpeningDate || '2023-04-01';
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
