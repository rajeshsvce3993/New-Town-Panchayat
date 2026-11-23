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

/** Web-safe `/api/media?…` — fixes `/1/api/media`, `api/media` (no slash), and bad full URLs. */
export function rootMediaProxyUrl(raw: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (val.startsWith('data:') || val.startsWith('blob:')) return val;
  if (val.startsWith('/uploads')) return val;

  const pickProxy = (pathAndQuery: string) => {
    const p = pathAndQuery.replace(/^\/+\d+\//, '/');
    if (p.startsWith('/api/media')) return p.split('#')[0];
    return '';
  };

  if (val.startsWith('/api/media')) return val.split('#')[0];
  if (val.startsWith('api/media')) return `/${val.split('#')[0]}`;

  const fromPath = val.match(/(\/+\d+\/api\/media\?[^#\s]*)|(\/api\/media\?[^#\s]*)/i);
  if (fromPath) {
    const hit = fromPath[1] || fromPath[2];
    const fixed = pickProxy(hit.startsWith('/') ? hit : `/${hit}`);
    if (fixed) return fixed;
  }

  if (/^https?:\/\//i.test(val)) {
    try {
      const u = new URL(val);
      const fixed = pickProxy(`${u.pathname}${u.search}`);
      if (fixed) return fixed;
    } catch {
      /* fall through */
    }
  }

  return '';
}

export function toMediaProxyPath(rawUrlOrKey: string): string {
  if (!rawUrlOrKey || typeof rawUrlOrKey !== 'string') return '';
  const rooted = rootMediaProxyUrl(rawUrlOrKey);
  if (rooted) return rooted;
  if (rawUrlOrKey.startsWith('data:image') || rawUrlOrKey.startsWith('blob:')) return rawUrlOrKey;
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

function isClientLocalMediaPath(val: string): boolean {
  const s = val.toLowerCase();
  return (
    s.startsWith('/data/') ||
    s.startsWith('data/') ||
    s.startsWith('/storage/') ||
    s.includes('offline_images') ||
    s.includes('raw_uploads') ||
    s.includes('com.tn.townpanchayat.ems')
  );
}

/** Normalize one image field for API/mobile (proxy paths, strip invalid local paths). */
export function normalizePortalMediaValue(raw: string, origin?: string): string {
  const val = String(raw || '').trim();
  if (!val) return '';
  if (isClientLocalMediaPath(val)) return '';
  if (val.startsWith('data:')) return '';
  if (val.startsWith('/uploads')) {
    return origin ? `${origin}${val}` : val;
  }
  const rooted = rootMediaProxyUrl(val);
  if (rooted) return origin ? `${origin}${rooted}` : rooted;

  const proxied = toMediaProxyPath(val);
  if (proxied) {
    if (origin && proxied.startsWith('/')) return `${origin}${proxied}`;
    return proxied;
  }
  if (val.startsWith('inspection/') || val.startsWith('profiles/')) {
    const p = toMediaProxyPath(val);
    if (origin && p.startsWith('/')) return `${origin}${p}`;
    return p;
  }
  return val;
}

function asFieldsDataObject(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
    return {};
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
  return {};
}

export function rewriteWorkMediaFields(work: any, origin?: string): any {
  if (!work || typeof work !== 'object') return work;
  const next = { ...work };
  if (typeof next.imageUrl === 'string' && next.imageUrl) {
    next.imageUrl = normalizePortalMediaValue(next.imageUrl, origin);
  }
  if (next.fieldsData) {
    const fields = asFieldsDataObject(next.fieldsData);
    for (const [k, v] of Object.entries(fields)) {
      if (typeof v !== 'string') continue;
      if (
        v.includes('s3.') ||
        v.includes('amazonaws.com') ||
        v.includes('/api/media') ||
        v.includes('inspection/') ||
        v.includes('profiles/') ||
        v.includes('X-Amz-Signature') ||
        v.startsWith('/uploads')
      ) {
        fields[k] = normalizePortalMediaValue(v, origin);
      } else if (isClientLocalMediaPath(v) || v.startsWith('data:')) {
        fields[k] = '';
      }
    }
    next.fieldsData = fields;
  }
  return next;
}
