/** Client-safe calendar date extraction (YYYY-MM-DD, Asia/Kolkata). */
export function extractCalendarDateYMD(dateVal: any): string | null {
  if (!dateVal) return null;

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dateVal);
  }

  if (typeof dateVal === 'number' || /^\d{10,13}$/.test(String(dateVal).trim())) {
    try {
      const num = typeof dateVal === 'number' ? dateVal : parseInt(String(dateVal).trim(), 10);
      const ms = num < 1e11 ? num * 1000 : num;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(d);
      }
    } catch (_) {}
  }

  const s = String(dateVal).trim();
  if (!s) return null;

  const dmyMatch = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = dmyMatch[3];
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  const ymdMatch = s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    if (s.includes('T') || s.includes('Z') || s.includes(':')) {
      try {
        const d = new Date(s.replace(' ', 'T'));
        if (!isNaN(d.getTime())) {
          return new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Kolkata',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(d);
        }
      } catch (_) {}
    }
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d);
    }
  } catch (_) {}

  return null;
}

/** Milliseconds for newest-first sort. Understands DD-MM-YYYY h:mm AM/PM from the field app. */
export function extractInspectionDateMs(dateVal: any): number {
  if (!dateVal) return 0;
  if (dateVal instanceof Date) {
    const t = dateVal.getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  if (typeof dateVal === 'number' || /^\d{10,13}$/.test(String(dateVal).trim())) {
    const num = typeof dateVal === 'number' ? dateVal : parseInt(String(dateVal).trim(), 10);
    const ms = num < 1e11 ? num * 1000 : num;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }
  const s = String(dateVal).trim();
  const dmy = s.match(
    /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP][mM])?)?/
  );
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    let hour = dmy[4] ? parseInt(dmy[4], 10) : 0;
    const min = dmy[5] ? parseInt(dmy[5], 10) : 0;
    const sec = dmy[6] ? parseInt(dmy[6], 10) : 0;
    const ampm = dmy[7];
    if (ampm) {
      if (ampm.toLowerCase() === 'pm' && hour < 12) hour += 12;
      else if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
    }
    const parsed = new Date(year, month, day, hour, min, sec);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }
  const standard = new Date(s);
  return Number.isNaN(standard.getTime()) ? 0 : standard.getTime();
}
