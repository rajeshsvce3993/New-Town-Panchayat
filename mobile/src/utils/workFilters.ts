import type { AppUser, InspectionWork } from '../types/models';
import { endOfDayMs, parseInspectionDateMillis, startOfDayMs } from './dates';
import { workBelongsToUser } from './workIdentity';

function isFallbackInspectionWork(w: InspectionWork): boolean {
  const sName = String(w.subjectNameEn || '').trim().toLowerCase();
  const cName = String(w.categoryNameEn || '').trim().toLowerCase();
  const sId = String(w.subjectId || '').trim().toLowerCase();
  const cId = String(w.categoryId || '').trim().toLowerCase();
  return (
    sName === 'general inspection' ||
    sName === 'general' ||
    sName.includes('fallback') ||
    cName === 'field check' ||
    cName === 'general category' ||
    cName === 'general inspection' ||
    cName.includes('fallback') ||
    sId === 'subj_general' ||
    sId === 'general_inspection' ||
    cId === 'cat_field_check' ||
    cId === 'cat_general' ||
    cId === 'field_check'
  );
}


export function filterUserWorks(works: InspectionWork[], user: AppUser | null | undefined, _mode: 'dashboard' | 'reports'): InspectionWork[] {
  if (!user) return [];
  return works.filter((work) => !isFallbackInspectionWork(work) && workBelongsToUser(work, user));
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
    return String(b.workId || '').localeCompare(String(a.workId || ''));
  });
}
