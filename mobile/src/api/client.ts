import * as FileSystem from 'expo-file-system/legacy';
import {
  APP_VERSION_CODE,
  APP_VERSION_NAME,
  BOOTSTRAP_API_TIMEOUT_MS,
  DEFAULT_SERVER_URL,
  FCM_APP_VERSION_LABEL,
  LOGIN_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  UPLOAD_TIMEOUT_MS,
} from '../constants/config';
import type {
  AppUser,
  ChangePasswordResponse,
  InspectionWork,
  LoginRequest,
  LoginResponse,
  NotificationItem,
  NotificationsListResponse,
  PortalState,
  ProfilePhotoUploadResponse,
  QueueEnqueueResponse,
  QueueStatusResponse,
  ScopeVersionResponse,
  SubmitWorkResponse,
  UserScopeResponse,
  VersionCheckResponse,
} from '../types/models';
import { activeNotifications, emptyPortal } from '../types/models';

let baseUrl = DEFAULT_SERVER_URL;
let appLanguageHeader = 'en';

export function setMobileApiLanguage(isTamil: boolean) {
  appLanguageHeader = isTamil ? 'ta' : 'en';
}

export function mobileClientHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'X-Client': 'mobile',
    'X-App-Version': APP_VERSION_NAME,
    'X-App-Build': String(APP_VERSION_CODE),
    'X-App-Language': appLanguageHeader,
    ...(extra || {}),
  };
}

export function setApiBaseUrl(url: string) {
  baseUrl = url.trim().replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return baseUrl;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toUploadFileUri(uri: string) {
  const s = String(uri || '').trim();
  if (!s) return s;
  if (s.startsWith('file:') || s.startsWith('content:')) return s;
  if (s.startsWith('/')) return `file://${s}`;
  return s;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function isLoginTransportError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /abort|timeout|cancel/i.test(msg) || /failed to fetch|network request failed|unreachable/i.test(msg);
}

function loginNetworkError(e: unknown): LoginResponse {
  const msg = e instanceof Error ? e.message : String(e);
  if (/cancel/i.test(msg)) {
    return {
      success: false,
      token: null,
      user: null,
      message:
        'Network error: request was interrupted (poor signal or server busy). Wait a moment and tap Sign in again.',
    };
  }
  if (/abort|timeout/i.test(msg)) {
    return {
      success: false,
      token: null,
      user: null,
      message: `Network error: Connection timed out (${baseUrl}). Please check server status on port 5000.`,
    };
  }
  if (/failed to fetch|network request failed|unreachable/i.test(msg)) {
    return {
      success: false,
      token: null,
      user: null,
      message: `Network error: Unable to connect to server (${baseUrl}). Please tap 'Configure Server' above to check IP and Port 5000.`,
    };
  }
  return {
    success: false,
    token: null,
    user: null,
    message: `Network error: ${msg || `Unable to connect to server (${baseUrl})`}`,
  };
}

export const api = {
  async isReachable(): Promise<boolean> {
    try {
      const resp = await fetchWithTimeout(`${baseUrl}/api/health`, { method: 'GET' }, 4000);
      return resp.ok;
    } catch {
      return false;
    }
  },

  async testConnection(testUrl: string): Promise<[boolean, string]> {
    const clean = testUrl.trim().replace(/\/$/, '');
    try {
      const resp = await fetchWithTimeout(`${clean}/api/health`);
      if (resp.ok) return [true, `Connected successfully to EMS Server (HTTP ${resp.status})`];
      return [false, `Server responded with HTTP ${resp.status}`];
    } catch (e) {
      return [false, e instanceof Error ? e.message : 'Connection failed'];
    }
  },

  async login(req: LoginRequest): Promise<LoginResponse> {
    const attempt = async (retry: boolean): Promise<LoginResponse> => {
      try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/auth/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...mobileClientHeaders() },
          body: JSON.stringify({ ...req, client: 'mobile' }),
        },
        LOGIN_TIMEOUT_MS,
      );
      const resBody = await response.text();
      const parse = (): LoginResponse | null => {
        try {
          return JSON.parse(resBody) as LoginResponse;
        } catch {
          return null;
        }
      };
      if (response.ok) {
        return (
          parse() || {
            success: false,
            token: null,
            user: null,
            message:
              'Error: Invalid response from server. The server URL might be protected by a secure cookie/login wall (like Google AI Studio preview auth), or returned HTML instead of JSON.',
          }
        );
      }
      const errorResp = parse();
      if (errorResp) return errorResp;
      if (resBody.trim().startsWith('<') || resBody.trim().toLowerCase().startsWith('html')) {
        return {
          success: false,
          token: null,
          user: null,
          message: 'Error: Server returned a webpage (HTML) instead of data. The URL may be protected by a preview security lock.',
        };
      }
      return {
        success: false,
        token: null,
        user: null,
        message: `Authentication failed (Status ${response.status}): ${resBody.slice(0, 100)}`,
      };
      } catch (e) {
        if (!retry && isLoginTransportError(e)) {
          await delay(900);
          return attempt(true);
        }
        return loginNetworkError(e);
      }
    };
    return attempt(false);
  },

  /** @deprecated Server returns 410. Use bootstrapProductionPortal. */
  async getPortalState(username?: string | null): Promise<PortalState> {
    return this.bootstrapProductionPortal(username || '');
  },

  /** Login refresh path: geo/me + masters/scope + scoped works (no portal-state). */
  async bootstrapProductionPortal(
    username: string,
    user?: AppUser | null,
    opts?: { worksLimit?: number },
  ): Promise<PortalState> {
    const worksLimit = Math.min(Math.max(opts?.worksLimit ?? 80, 20), 200);
    const u = String(username || '').trim();
    if (!u) throw new Error('username required');

    const [scopeRes, geoRes, settings, config, worksRes] = await Promise.all([
      fetchWithTimeout(`${baseUrl}/api/masters/scope?username=${encodeURIComponent(u)}`, {
        headers: mobileClientHeaders(),
      }, BOOTSTRAP_API_TIMEOUT_MS),
      fetchWithTimeout(`${baseUrl}/api/geo/me?username=${encodeURIComponent(u)}`, {
        headers: mobileClientHeaders(),
      }, BOOTSTRAP_API_TIMEOUT_MS),
      this.getAppSettings(),
      this.getMobileConfig(),
      fetchWithTimeout(
        `${baseUrl}/api/inspection-works?username=${encodeURIComponent(u)}&lite=1&limit=${worksLimit}`,
        { headers: { ...mobileClientHeaders(), 'Cache-Control': 'no-cache' } },
        BOOTSTRAP_API_TIMEOUT_MS,
      ),
    ]);

    const scopeJson = (await scopeRes.json().catch(() => ({}))) as UserScopeResponse;
    const geoJson = (await geoRes.json().catch(() => ({}))) as {
      success?: boolean;
      geo?: {
        zoneId?: string;
        zoneNameEn?: string;
        zoneNameTa?: string;
        districtId?: string;
        districtNameEn?: string;
        districtNameTa?: string;
        tpId?: string;
        tpNameEn?: string;
        tpNameTa?: string;
      };
      zones?: PortalState['zones'];
      districts?: PortalState['districts'];
      townPanchayats?: PortalState['townPanchayats'];
      username?: string;
    };
    const worksJson = (await worksRes.json().catch(() => ({}))) as { works?: InspectionWork[]; success?: boolean };

    let scope = scopeJson.scope;
    if (scope && !scope.fields?.length) {
      const scopeFallback = await this.getUserScope(u);
      if (scopeFallback.success && scopeFallback.scope?.fields?.length) {
        scope = { ...scope, ...scopeFallback.scope, fields: scopeFallback.scope.fields };
      }
    }
    const geo = geoJson.geo;
    const districts: PortalState['districts'] =
      geoJson.districts?.length
        ? geoJson.districts
        : geo?.districtId
          ? [
              {
                id: geo.districtId,
                nameEn: geo.districtNameEn || '',
                nameTa: geo.districtNameTa || '',
                zoneId: geo.zoneId || '',
              },
            ]
          : [];
    const townPanchayats: PortalState['townPanchayats'] =
      geoJson.townPanchayats?.length
        ? geoJson.townPanchayats
        : geo?.tpId
          ? [
              {
                id: geo.tpId,
                nameEn: geo.tpNameEn || '',
                nameTa: geo.tpNameTa || '',
                districtId: geo.districtId || '',
                zoneId: geo.zoneId || '',
              },
            ]
          : scope?.townPanchayat?.id
            ? [
                {
                  id: scope.townPanchayat.id,
                  nameEn: scope.townPanchayat.nameEn,
                  nameTa: scope.townPanchayat.nameTa,
                  districtId: scope.townPanchayat.districtId || '',
                },
              ]
            : [];

  return {
      districts,
      townPanchayats,
      zones: geoJson.zones?.length
        ? geoJson.zones
        : geo?.zoneId
          ? [{ id: geo.zoneId, nameEn: geo.zoneNameEn || '', nameTa: geo.zoneNameTa || '' }]
          : [],
      inspectionSubjects: scope?.subjects || [],
      inspectionCategories: scope?.categories || [],
      inspectionFields: scope?.fields || [],
      wardsAndStreets: scope?.wardsAndStreets || [],
      subjects: scope?.subjects || [],
      categories: scope?.categories || [],
      fields: scope?.fields || [],
      inspectionWorks: worksJson.works || [],
      works: worksJson.works || [],
      user: user ?? null,
      appIconUrl: config?.appIconUrl || null,
      loginLogoUrl: config?.loginLogoUrl || null,
      settings,
    };
  },

  async getAppSettings(): Promise<Record<string, unknown>> {
    try {
      const live = await fetchWithTimeout(
        `${baseUrl}/api/mobile/report-share`,
        { headers: mobileClientHeaders({ 'Cache-Control': 'no-cache, no-store' }) },
        BOOTSTRAP_API_TIMEOUT_MS,
      );
      if (live.ok) {
        const json = (await live.json().catch(() => ({}))) as {
          success?: boolean;
          reportShare?: Record<string, unknown>;
          theme?: unknown;
          customColors?: unknown;
          googleMapsApiKey?: unknown;
        };
        if (json?.success && json.reportShare) {
          const out: Record<string, unknown> = { reportShare: json.reportShare };
          if (json.theme != null) out.theme = json.theme;
          if (json.customColors != null) out.customColors = json.customColors;
          if (json.googleMapsApiKey != null) out.googleMapsApiKey = json.googleMapsApiKey;
          return out;
        }
      }
    } catch {
      /* fall through to /api/state */
    }
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/state?key=settings`,
        { headers: mobileClientHeaders({ 'Cache-Control': 'no-cache, no-store' }) },
        BOOTSTRAP_API_TIMEOUT_MS,
      );
      if (!response.ok) return {};
      const json = (await response.json()) as { data?: Record<string, unknown> };
      return json?.data && typeof json.data === 'object' && !Array.isArray(json.data) ? json.data : {};
    } catch {
      return {};
    }
  },

  async uploadFile(opts: {
    uri: string;
    fileName: string;
    mimeType: string;
    workId?: string | null;
    userId?: string | null;
    username?: string | null;
    zone?: string | null;
    district?: string | null;
    tp?: string | null;
  }): Promise<string | null> {
    const fileUri = toUploadFileUri(opts.uri);
    const parameters: Record<string, string> = {};
    if (opts.workId) parameters.workId = String(opts.workId);
    if (opts.userId) parameters.userId = String(opts.userId);
    if (opts.username) parameters.username = String(opts.username);
    if (opts.zone) parameters.zone = String(opts.zone);
    if (opts.district) parameters.district = String(opts.district);
    if (opts.tp) parameters.tp = String(opts.tp);

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await FileSystem.uploadAsync(`${baseUrl}/api/upload`, fileUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: opts.mimeType || 'image/jpeg',
          parameters,
        });
        if (result.status >= 200 && result.status < 300 && result.body) {
          const json = JSON.parse(result.body) as { success?: boolean; url?: string; permanentUrl?: string };
          const url = json.permanentUrl || json.url;
          if (json.success && url) return url;
        }
      } catch {
        /* retry */
      }
      if (attempt < 3) await delay(400 * attempt);
    }
    return null;
  },

  /** Online Add Work photo — never used by offline save or queue sync. */
  async uploadPhotoOnlineApi(opts: {
    uri: string;
    fileName: string;
    mimeType: string;
    workId?: string | null;
    userId?: string | null;
    username?: string | null;
    zone?: string | null;
    district?: string | null;
    tp?: string | null;
  }): Promise<string | null> {
    return this.uploadFile(opts);
  },

  /** Queue-sync photo — never used by the online Add Work button. */
  async uploadQueuedPhotoApi(opts: {
    uri: string;
    fileName: string;
    mimeType: string;
    workId?: string | null;
    userId?: string | null;
    username?: string | null;
    zone?: string | null;
    district?: string | null;
    tp?: string | null;
  }): Promise<string | null> {
    return this.uploadFile(opts);
  },

  async postInspectionWork(work: InspectionWork): Promise<SubmitWorkResponse> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/inspection-works`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(work),
        },
        UPLOAD_TIMEOUT_MS
      );
      const resBody = await response.text();
      if (response.ok) {
        try {
          return JSON.parse(resBody) as SubmitWorkResponse;
        } catch {
          return { success: false, message: 'Parsing failed' };
        }
      }
      return { success: false, message: `Server error (${response.status})` };
    } catch (e) {
      return { success: false, message: `Network error: ${e instanceof Error ? e.message : 'Connection failed'}` };
    }
  },

  async lookupInspectionWork(clientId: string): Promise<InspectionWork | null> {
    const id = String(clientId || '').trim();
    if (!id) return null;
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/inspection-works?lookupId=${encodeURIComponent(id)}`,
        { headers: { 'Cache-Control': 'no-cache, no-store' } },
        REQUEST_TIMEOUT_MS
      );
      const json = (await response.json().catch(() => null)) as {
        work?: InspectionWork;
        works?: unknown;
      } | null;
      if (!json?.work || Array.isArray(json.works)) return null;
      if (!/^WRK-/i.test(String(json.work.workId || '').trim())) return null;
      return json.work;
    } catch {
      return null;
    }
  },

  /** Add Work while online — never used by the offline queue. */
  async submitWorkOnlineApi(work: InspectionWork): Promise<SubmitWorkResponse> {
    return this.postInspectionWork({ ...work, workId: '' });
  },

  /** Queue sync only — never used by the Add Work online button. */
  async submitWorkFromQueueApi(work: InspectionWork): Promise<SubmitWorkResponse> {
    return this.postInspectionWork({ ...work, workId: '' });
  },

  async submitInspectionWork(work: InspectionWork): Promise<SubmitWorkResponse> {
    return this.submitWorkOnlineApi(work);
  },

  async enqueueInspectionWork(work: InspectionWork): Promise<QueueEnqueueResponse> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/queue/enqueue`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(work),
        },
        UPLOAD_TIMEOUT_MS
      );
      const resBody = await response.text();
      if (response.ok) {
        try {
          return JSON.parse(resBody) as QueueEnqueueResponse;
        } catch {
          return { success: false, message: 'Failed to parse queue response' };
        }
      }
      return { success: false, message: `Server queue rejected request (${response.status})` };
    } catch (e) {
      return { success: false, message: `Queue network error: ${e instanceof Error ? e.message : 'Connection failed'}` };
    }
  },

  async getQueueJobStatus(jobId: string): Promise<QueueStatusResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/queue/status?jobId=${encodeURIComponent(jobId)}`);
      const resBody = await response.text();
      if (response.ok) {
        try {
          return JSON.parse(resBody) as QueueStatusResponse;
        } catch {
          return { success: false, message: 'Failed to parse status' };
        }
      }
      return { success: false, message: `Server returned ${response.status}` };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Network error checking job status' };
    }
  },

  async changePassword(username: string, currentPassword: string, newPassword: string): Promise<ChangePasswordResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, currentPassword, newPassword }),
      });
      const resBody = await response.text();
      if (resBody) {
        try {
          return JSON.parse(resBody) as ChangePasswordResponse;
        } catch {
          return { success: false, message: 'Invalid response format from server' };
        }
      }
      return { success: false, message: `Server error (${response.status})` };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Failed to connect to server' };
    }
  },

  async checkScopeVersion(clientVersion = 0): Promise<ScopeVersionResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/scope/version?clientVersion=${clientVersion}`, {
        headers: mobileClientHeaders(),
      });
      const resBody = await response.text();
      if (response.ok && resBody) return JSON.parse(resBody) as ScopeVersionResponse;
      return { success: false, scopeVersion: clientVersion, hasUpdate: false, message: `Server returned ${response.status}` };
    } catch (e) {
      return {
        success: false,
        scopeVersion: clientVersion,
        hasUpdate: false,
        message: e instanceof Error ? e.message : 'Network error checking scope version',
      };
    }
  },

  /** Live inspection scope from Mongo via GET /api/masters/scope (not user_scope_cache). */
  async getUserScope(userIdOrUsername: string): Promise<UserScopeResponse> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/masters/scope?username=${encodeURIComponent(userIdOrUsername)}`,
        { headers: mobileClientHeaders() },
      );
      const resBody = await response.text();
      if (response.ok && resBody) {
        const json = JSON.parse(resBody) as {
          success?: boolean;
          scope?: UserScopeResponse['scope'];
          scopeVersion?: number;
          updatedAt?: string;
          message?: string;
        };
        return {
          success: !!json.success,
          scope: json.scope ?? null,
          scopeVersion: json.scopeVersion ?? 1,
          updatedAt: json.updatedAt,
          message: json.message,
        };
      }
      return { success: false, scopeVersion: 1, message: `Server returned ${response.status}` };
    } catch (e) {
      return { success: false, scopeVersion: 1, message: e instanceof Error ? e.message : 'Network error fetching user scope' };
    }
  },

  async uploadProfilePhoto(userId: string, username: string, uri: string): Promise<ProfilePhotoUploadResponse> {
    const fileUri = toUploadFileUri(uri);
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await FileSystem.uploadAsync(`${baseUrl}/api/users/profile-photo`, fileUri, {
          httpMethod: 'POST',
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: 'file',
          mimeType: 'image/jpeg',
          parameters: { userId: String(userId || ''), username: String(username || '') },
        });
        if (result.status >= 200 && result.status < 300 && result.body) {
          const json = JSON.parse(result.body) as ProfilePhotoUploadResponse;
          if (json.success) return json;
          return { success: false, message: json.message || `Upload failed with status ${result.status}` };
        }
        if (attempt === 3) return { success: false, message: `Upload failed with status ${result.status}` };
      } catch (e) {
        if (attempt === 3) {
          return { success: false, message: e instanceof Error ? e.message : 'Failed to upload profile photo to S3' };
        }
      }
      await delay(400 * attempt);
    }
    return { success: false, message: 'Failed to upload profile photo to S3' };
  },

  async checkAppVersion(): Promise<VersionCheckResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/mobile/version-check`, {}, BOOTSTRAP_API_TIMEOUT_MS);
      const resBody = await response.text();
      if (response.ok && resBody) return JSON.parse(resBody) as VersionCheckResponse;
      return {};
    } catch {
      return {};
    }
  },

  async getNotifications(userId?: string | null, zoneId?: string | null, tpId?: string | null): Promise<NotificationItem[] | null> {
    try {
      const params: string[] = [];
      if (userId) params.push(`userId=${encodeURIComponent(userId)}`);
      if (zoneId) params.push(`zoneId=${encodeURIComponent(zoneId)}`);
      if (tpId) params.push(`tpId=${encodeURIComponent(tpId)}`);
      const qs = params.length ? `?${params.join('&')}` : '';
      const response = await fetchWithTimeout(`${baseUrl}/api/notifications${qs}`);
      const resBody = await response.text();
      if (response.ok && resBody) {
        const parsed = JSON.parse(resBody) as NotificationsListResponse;
        return activeNotifications(parsed.notifications);
      }
      return null;
    } catch {
      return null;
    }
  },

  async registerFcmToken(token: string, userId?: string | null, username?: string | null): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/notifications/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          userId: userId || '',
          username: username || '',
          deviceModel: 'Expo',
          appVersion: FCM_APP_VERSION_LABEL,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  },

  async getMobileProfile(username: string): Promise<{
    success: boolean;
    profilePhotoUrl?: string | null;
    profile?: Record<string, unknown>;
    userId?: string;
    message?: string;
  }> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/mobile/profile?username=${encodeURIComponent(username)}`,
        { headers: { ...mobileClientHeaders(), 'Cache-Control': 'no-cache' } },
        BOOTSTRAP_API_TIMEOUT_MS,
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return { success: false, message: body?.message || `HTTP ${response.status}` };
      return body as {
        success: boolean;
        profilePhotoUrl?: string | null;
        profile?: Record<string, unknown>;
        userId?: string;
      };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Network error' };
    }
  },

  async getMobileConfig(): Promise<{ appIconUrl?: string; loginLogoUrl?: string } | null> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/mobile/config`, {}, BOOTSTRAP_API_TIMEOUT_MS);
      if (!response.ok) return null;
      const json = (await response.json()) as {
        config?: { app_icon_url?: string; login_logo_url?: string };
      };
      return {
        appIconUrl: json.config?.app_icon_url,
        loginLogoUrl: json.config?.login_logo_url,
      };
    } catch {
      return null;
    }
  },

  async logout(userId?: string | null, username?: string | null): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/auth/logout`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: userId || '',
            username: username || '',
            reason: 'User clicked logout in mobile app',
          }),
        },
        4000
      );
      return response.ok;
    } catch {
      return false;
    }
  },
};

function mediaProxyUrl(s3KeyOrUrl: string, slug: string) {
  const key = s3KeyOrUrl.startsWith('http') ? '' : s3KeyOrUrl.replace(/^\/+/, '');
  const params = [`k=${encodeURIComponent(slug)}`];
  if (key) params.push(`key=${encodeURIComponent(key)}`);
  else params.push(`url=${encodeURIComponent(s3KeyOrUrl)}`);
  return `${baseUrl}/api/media?${params.join('&')}#${encodeURIComponent(slug)}`;
}

export function isLocalPhotoPath(raw?: string | null): boolean {
  if (!raw) return false;
  const s = raw.trim().toLowerCase();
  return (
    s.startsWith('file:') ||
    s.startsWith('content:') ||
    s.includes('user_profile_photo.jpg') ||
    s.startsWith('/data/') ||
    s.startsWith('/storage/') ||
    s.includes('offline_images')
  );
}

export function isRemotePhotoUrl(raw?: string | null): boolean {
  if (!raw?.trim() || isLocalPhotoPath(raw)) return false;
  const s = raw.trim();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/uploads') ||
    s.startsWith('/api') ||
    s.startsWith('profiles/') ||
    s.includes('amazonaws.com') ||
    s.includes('s3.')
  );
}

export function resolveMediaUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('http') && (rawUrl.includes('amazonaws.com') || rawUrl.includes('s3.'))) {
    let slug = 'img';
    let key = '';
    try {
      const parsed = new URL(rawUrl);
      const parts = parsed.pathname.replace(/^\//, '').split('/').filter(Boolean);
      slug = parts.pop() || 'img';
      key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    } catch {
      /* keep default slug */
    }
    if (key.startsWith('profiles/') || key.startsWith('inspection/')) {
      return mediaProxyUrl(key, slug);
    }
    return mediaProxyUrl(rawUrl, slug);
  }
  if (rawUrl.startsWith('profiles/') || rawUrl.startsWith('inspection/')) {
    const slug = rawUrl.split('/').filter(Boolean).pop() || 'img';
    return mediaProxyUrl(rawUrl, slug);
  }
  if (rawUrl.includes('/api/media')) {
    const abs = rawUrl.startsWith('http') ? rawUrl : `${baseUrl}${rawUrl.startsWith('/') ? rawUrl : `/${rawUrl}`}`;
    try {
      const parsed = new URL(abs);
      const slug =
        parsed.searchParams.get('k') ||
        parsed.searchParams.get('token')?.slice(0, 24) ||
        parsed.searchParams.get('url')?.split('/').pop() ||
        'img';
      if (!parsed.searchParams.get('k')) parsed.searchParams.set('k', slug);
      return `${parsed.toString()}#${encodeURIComponent(slug)}`;
    } catch {
      return abs;
    }
  }
  if (rawUrl.startsWith('/uploads')) return `${baseUrl}${rawUrl}`;
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('/data') && !rawUrl.startsWith('/storage')) {
    return `${baseUrl}${rawUrl}`;
  }
  return rawUrl;
}

export function resolveProfilePhotoUrl(raw?: string | null): string | null {
  if (!raw?.trim()) return null;
  const s = raw.trim();
  if (isLocalPhotoPath(s)) {
    if (s.startsWith('file:') || s.startsWith('content:')) return s;
    if (s.startsWith('/')) return `file://${s}`;
    return s;
  }
  return resolveMediaUrl(s) || null;
}

export { emptyPortal };
