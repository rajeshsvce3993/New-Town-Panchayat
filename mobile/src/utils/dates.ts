export function todayDdMmYyyy(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

export function todayYyyyMmDd(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function now12Hr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${dd}-${mm}-${d.getFullYear()} ${String(h).padStart(2, '0')}:${min} ${ampm}`;
}

export function parseInspectionDateMillis(dateStr?: string | null): number {
  if (!dateStr || !dateStr.trim()) return 0;
  const s = dateStr.trim();
  const epoch = Number(s);
  if (!Number.isNaN(epoch) && epoch > 1000000000) return epoch;

  const regex =
    /^(\d{1,2})[-/\s.]+(\d{1,2})[-/\s.]+(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM|am|pm))?)?/;
  const match = s.match(regex);
  if (match) {
    const d = Number(match[1]);
    const m = Number(match[2]) - 1;
    let y = Number(match[3]);
    if (y < 100) y += 2000;
    let hr = match[4] ? Number(match[4]) : 0;
    const min = match[5] ? Number(match[5]) : 0;
    const sec = match[6] ? Number(match[6]) : 0;
    const ampm = (match[7] || '').toUpperCase();
    if (ampm === 'PM' && hr < 12) hr += 12;
    if (ampm === 'AM' && hr === 12) hr = 0;
    return new Date(y, m, d, hr, min, sec, 0).getTime();
  }

  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function formatTo12Hr(dateStr: string): string {
  if (!dateStr) return '';
  const ms = parseInspectionDateMillis(dateStr);
  if (!ms) return dateStr;
  const d = new Date(ms);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  let h = d.getHours();
  const min = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${dd}-${mm}-${d.getFullYear()} ${String(h).padStart(2, '0')}:${min} ${ampm}`;
}

export function startOfDayMs(ddMmYyyy: string): number | null {
  const ms = parseInspectionDateMillis(ddMmYyyy);
  if (!ms) return null;
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDayMs(ddMmYyyy: string): number | null {
  const ms = parseInspectionDateMillis(ddMmYyyy);
  if (!ms) return null;
  const d = new Date(ms);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
