import type { AppUser, InspectionWork } from '../types/models';
import { endOfDayMs, parseInspectionDateMillis, startOfDayMs } from './dates';

export function filterUserWorks(works: InspectionWork[], user: AppUser | null | undefined, mode: 'dashboard' | 'reports'): InspectionWork[] {
  if (!user) {
    return mode === 'dashboard' ? works.filter((w) => w.workId) : [];
  }
  const uId = user.id.trim().toLowerCase();
  const uName = user.username.trim().toLowerCase();
  const uDisplayName = (user.name || '').trim().toLowerCase();
  const uEmpId = (user.employeeId || '').trim().toLowerCase();

  return works.filter((work) => {
    if (!work.workId) return false;
    const subId = (work.submittedByUserId || '').trim().toLowerCase();
    const subName = (work.submittedByUserName || '').trim().toLowerCase();
    const workId = work.workId.trim().toLowerCase();
    if (mode === 'dashboard') {
      return (
        (!!uId && subId === uId) ||
        (!!uName && (subName === uName || subName.includes(uName))) ||
        (!!uDisplayName && (subName === uDisplayName || subName.includes(uDisplayName)))
      );
    }
    const matchesId = !!uId && (subId === uId || subId === `user_${uId}` || uId === `user_${subId}`);
    const matchesEmpId = !!uEmpId && (subId === uEmpId || subName === uEmpId);
    const matchesUsername =
      !!uName &&
      (subId === uName ||
        subName === uName ||
        workId.includes(`-${uName}-`) ||
        workId.includes(`-${uName}`) ||
        workId.endsWith(`-${uName}`));
    const matchesName = !!uDisplayName && subName === uDisplayName;
    return matchesId || matchesEmpId || matchesUsername || matchesName;
  });
}

export function filterByDateRange(works: InspectionWork[], fromDateStr: string, toDateStr: string): InspectionWork[] {
  const fromMillis = fromDateStr ? startOfDayMs(fromDateStr) : null;
  const toMillis = toDateStr ? endOfDayMs(toDateStr) : null;
  return works.filter((work) => {
    const workTime = parseInspectionDateMillis(work.submittedAt);
    if (workTime <= 0) return !fromDateStr && !toDateStr;
    const afterFrom = fromMillis == null || workTime >= fromMillis;
    const beforeTo = toMillis == null || workTime <= toMillis;
    return afterFrom && beforeTo;
  });
}

export function sortRecentFirst(works: InspectionWork[]): InspectionWork[] {
  return [...works].sort((a, b) => {
    const diff = parseInspectionDateMillis(b.submittedAt) - parseInspectionDateMillis(a.submittedAt);
    if (diff !== 0) return diff;
    return b.workId.localeCompare(a.workId);
  });
}
