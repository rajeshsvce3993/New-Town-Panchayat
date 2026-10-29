/** Stable S3 object key from a stored URL, presigned URL, or media token. */
export function extractS3ObjectKey(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';

  if (!s.includes('/') && !s.includes('.') && !s.startsWith('http')) {
    try {
      const decoded = Buffer.from(s, 'base64').toString('utf-8');
      if (decoded && (decoded.includes('/') || decoded.startsWith('http') || decoded.includes('.'))) {
        s = decoded;
      }
    } catch {
      /* keep original */
    }
  }

  s = s.split('#')[0];

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      s = decodeURIComponent(u.pathname.replace(/^\//, ''));
      const host = u.hostname.toLowerCase();
      if (host.startsWith('s3.') || host.startsWith('s3-')) {
        const slash = s.indexOf('/');
        if (slash > 0) s = s.slice(slash + 1);
      }
    } catch {
      s = s.replace(/^https?:\/\/[^/]+\//i, '').split('?')[0];
    }
  }

  s = decodeURIComponent(s.split('?')[0]).replace(/\+/g, ' ').replace(/^\/+/, '');

  const inspectionAt = s.indexOf('inspection/');
  if (inspectionAt >= 0) s = s.slice(inspectionAt);
  else {
    const profilesAt = s.indexOf('profiles/');
    if (profilesAt >= 0) s = s.slice(profilesAt);
    else {
      const apkAt = s.indexOf('apk/');
      if (apkAt >= 0) s = s.slice(apkAt);
    }
  }

  return s;
}

export function toMediaProxyPath(rawUrlOrKey: string): string {
  if (!rawUrlOrKey || typeof rawUrlOrKey !== 'string') return '';
  if (rawUrlOrKey.startsWith('data:image') || rawUrlOrKey.startsWith('blob:')) return rawUrlOrKey;
  if (rawUrlOrKey.startsWith('/api/media')) return rawUrlOrKey;
  if (rawUrlOrKey.startsWith('/uploads')) return rawUrlOrKey;

  const key = extractS3ObjectKey(rawUrlOrKey);
  if (!key) return '';
  if (
    !key.startsWith('inspection/') &&
    !key.startsWith('profiles/') &&
    !key.startsWith('apk/') &&
    !key.startsWith('uploads/')
  ) {
    return rawUrlOrKey;
  }
  const token = Buffer.from(key, 'utf-8').toString('base64');
  return `/api/media?token=${encodeURIComponent(token)}`;
}

export function rewriteWorkMediaFields(work: any): any {
  if (!work || typeof work !== 'object') return work;
  const next = { ...work };
  if (typeof next.imageUrl === 'string' && next.imageUrl) {
    next.imageUrl = toMediaProxyPath(next.imageUrl) || next.imageUrl;
  }
  if (next.fieldsData && typeof next.fieldsData === 'object') {
    const fields = { ...next.fieldsData };
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v === 'string' && (v.includes('s3.') || v.includes('inspection/') || v.includes('X-Amz-Signature'))) {
        fields[k] = toMediaProxyPath(v) || v;
      }
    }
    next.fieldsData = fields;
  }
  return next;
}
