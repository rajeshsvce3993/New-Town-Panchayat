export type SlideLang = 'ta' | 'en';

export type SlidePhoto = { label: string; url: string };
export type SlideField = { label: string; value: string };

const TAMIL_RE = /[\u0B80-\u0BFF]/;

export function hasTamil(text: string): boolean {
  return TAMIL_RE.test(String(text || ''));
}

export function formatSlideIndianTime(dateStr: any): string {
  if (!dateStr) return '-';
  const s = String(dateStr).trim();
  const dmyMatch = s.match(
    /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([aApP][mM])?)?/
  );
  if (dmyMatch && dmyMatch[4]) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    let hours = parseInt(dmyMatch[4], 10);
    const minutes = dmyMatch[5].padStart(2, '0');
    let ampm = dmyMatch[7] ? dmyMatch[7].toUpperCase() : '';
    if (!ampm) {
      ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
    }
    return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const istDate = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const day = String(istDate.getDate()).padStart(2, '0');
      const month = String(istDate.getMonth() + 1).padStart(2, '0');
      const year = istDate.getFullYear();
      let hours = istDate.getHours();
      const minutes = String(istDate.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
  } catch {
    /* keep raw */
  }
  return s;
}

function normalizePhotoUrl(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('inspection/')) {
    return `https://tms-2026.s3.ap-south-1.amazonaws.com/${trimmed}`;
  }
  return trimmed;
}

function isPhotoValue(valStr: string, keyName: string, matchedField?: any): boolean {
  const valLower = valStr.toLowerCase();
  const keyLower = keyName.toLowerCase();
  const type = String(matchedField?.type || matchedField?.fieldType || '').toLowerCase();
  return (
    ['camera', 'image', 'image_upload'].includes(type) ||
    valStr.startsWith('http') ||
    valStr.startsWith('/uploads') ||
    valStr.startsWith('/api/media') ||
    valStr.startsWith('inspection/') ||
    valStr.startsWith('data:image') ||
    valLower.endsWith('.jpg') ||
    valLower.endsWith('.jpeg') ||
    valLower.endsWith('.png') ||
    valLower.endsWith('.webp') ||
    valLower.includes('s3.amazonaws.com') ||
    keyLower.includes('photo') ||
    keyLower.includes('camera') ||
    keyLower.includes('image')
  );
}

function fieldLabel(field: any, key: string, lang: SlideLang): string {
  if (field) {
    const label =
      lang === 'ta'
        ? field.nameTa || field.fieldNameTa || field.nameEn || field.fieldName || key
        : field.nameEn || field.fieldName || field.nameTa || key;
    return lang === 'en' ? String(label).toUpperCase() : String(label);
  }
  return lang === 'en' ? key.toUpperCase() : key;
}

function localizeYesNo(value: string, lang: SlideLang): string {
  const v = value.trim().toLowerCase();
  if (lang !== 'ta') return lang === 'en' ? value.toUpperCase() : value;
  if (v === 'yes' || v === 'y' || v === 'true') return 'ஆம்';
  if (v === 'no' || v === 'n' || v === 'false') return 'இல்லை';
  if (v === 'good') return 'நன்று';
  if (v === 'bad') return 'மோசம்';
  if (v === 'average') return 'சராசரி';
  if (v === 'completed') return 'முடிவடைந்தது';
  if (v === 'pending') return 'நிலுவையில்';
  return value;
}

export function extractSlidePhotos(work: any, inspectionFields: any[] = [], lang: SlideLang = 'en'): SlidePhoto[] {
  if (!work) return [];
  const photos: SlidePhoto[] = [];
  const fields = Array.isArray(inspectionFields) ? inspectionFields : [];

  if (work.fieldsData && typeof work.fieldsData === 'object') {
    Object.entries(work.fieldsData).forEach(([key, val]) => {
      if (typeof val !== 'string' || !val.trim()) return;
      const url = normalizePhotoUrl(val);
      const matched = fields.find((f: any) => f.id === key || f.fieldName === key);
      if (!isPhotoValue(url, key, matched)) return;
      if (!url || photos.some((p) => p.url === url)) return;
      photos.push({ label: fieldLabel(matched, key, lang), url });
    });
  }

  const extras = [work.imageUrl, work.photoUrl, work.image, work.photo];
  extras.forEach((raw) => {
    if (typeof raw !== 'string' || !raw.trim()) return;
    const url = normalizePhotoUrl(raw);
    if (!url || photos.some((p) => p.url === url)) return;
    photos.push({
      label: lang === 'ta' ? 'கள ஆய்வு புகைப்படம்' : 'INSPECTION PHOTO',
      url,
    });
  });

  if (Array.isArray(work.photos)) {
    work.photos.forEach((p: any, idx: number) => {
      const url = normalizePhotoUrl(typeof p === 'string' ? p : p?.url);
      if (!url || photos.some((item) => item.url === url)) return;
      const label =
        typeof p === 'object' && p.label
          ? p.label
          : lang === 'ta'
            ? `படம் ${idx + 1}`
            : `PHOTO ${idx + 1}`;
      photos.push({ label: lang === 'en' ? String(label).toUpperCase() : label, url });
    });
  }

  return photos.slice(0, 6);
}

export function extractSlideFields(work: any, inspectionFields: any[] = [], lang: SlideLang = 'en'): SlideField[] {
  if (!work?.fieldsData || typeof work.fieldsData !== 'object') return [];
  const fieldsData = work.fieldsData;
  const data: SlideField[] = [];
  const processed = new Set<string>();
  const allMaster = (inspectionFields || []).slice().sort((a: any, b: any) => {
    const orderA = typeof a.order === 'number' ? a.order : typeof a.sequence === 'number' ? a.sequence : 999;
    const orderB = typeof b.order === 'number' ? b.order : typeof b.sequence === 'number' ? b.sequence : 999;
    return orderA - orderB;
  });
  const catId = String(work.categoryId || '').trim();
  const catFields = catId
    ? allMaster.filter((f: any) => String(f.categoryId || '').trim() === catId)
    : allMaster;
  const ordered = catFields.length ? catFields : allMaster;

  const pushField = (key: string, val: any, matched?: any) => {
    if (processed.has(key) || val === undefined || val === null) return;
    const valStr = String(val).trim();
    if (!valStr) return;
    processed.add(key);
    if (isPhotoValue(valStr, key, matched)) return;
    data.push({
      label: fieldLabel(matched, key, lang),
      value: localizeYesNo(valStr, lang),
    });
  };

  ordered.forEach((f: any) => {
    const keys = [f.id, f.fieldName, f.key, f.nameEn, f.nameTa].filter(Boolean);
    for (const k of keys) {
      if (fieldsData[k] !== undefined && fieldsData[k] !== null && String(fieldsData[k]).trim()) {
        pushField(k, fieldsData[k], f);
        return;
      }
    }
  });

  Object.entries(fieldsData).forEach(([key, val]) => {
    const matched = allMaster.find((f: any) => f.id === key || f.fieldName === key);
    pushField(key, val, matched);
  });

  return data.slice(0, 18);
}

export function slideHeadline(work: any, lang: SlideLang) {
  const subject =
    lang === 'ta'
      ? work.subjectNameTa || work.subjectNameEn || 'ஆய்வுப் பிரிவு'
      : String(work.subjectNameEn || work.subjectNameTa || 'SUBJECT').toUpperCase();
  const category =
    lang === 'ta'
      ? work.categoryNameTa || work.categoryNameEn || 'ஆய்வு வகை'
      : String(work.categoryNameEn || work.categoryNameTa || 'CATEGORY').toUpperCase();
  const tp =
    lang === 'ta'
      ? work.tpNameTa || work.tpNameEn || 'பேரூராட்சி'
      : String(work.tpNameEn || work.tpNameTa || 'TOWN PANCHAYAT').toUpperCase();
  const ward = work.wardNumber || work.wardNo || '-';
  const street =
    lang === 'ta'
      ? work.streetNameTa || work.streetNameEn || work.streetName || work.street || '-'
      : String(work.streetNameEn || work.streetNameTa || work.streetName || work.street || '-').toUpperCase();
  const inspector =
    lang === 'ta'
      ? work.submittedByNameTa || work.submittedByName || work.submittedByUserName || 'கள ஆய்வாளர்'
      : String(
          work.submittedByNameEn || work.submittedByName || work.submittedByUserName || 'FIELD INSPECTOR'
        ).toUpperCase();
  const designation =
    work.submittedByUserDesignation || work.designation || work.userDesignation || (lang === 'ta' ? 'கள ஆய்வாளர்' : 'Field Inspector');
  const gps =
    work.latitude && work.longitude
      ? `${Number(work.latitude).toFixed(5)}, ${Number(work.longitude).toFixed(5)}`
      : '';
  const time = formatSlideIndianTime(work.submittedAt);
  return {
    subject,
    category,
    tp,
    ward: lang === 'ta' ? `வார்டு ${ward}` : `WARD ${ward}`,
    street,
    inspector,
    designation,
    gps,
    time: lang === 'ta' ? time.replace('AM', 'மு.ப').replace('PM', 'பி.ப') : time.toUpperCase(),
    workId: String(work.workId || work.id || ''),
  };
}
