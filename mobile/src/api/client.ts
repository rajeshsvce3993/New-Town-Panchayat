import { DEFAULT_SERVER_URL, FCM_APP_VERSION_LABEL, REQUEST_TIMEOUT_MS } from '../constants/config';
import type {
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

export function setApiBaseUrl(url: string) {
  baseUrl = url.trim().replace(/\/$/, '');
}

export function getApiBaseUrl() {
  return baseUrl;
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

function loginNetworkError(e: unknown): LoginResponse {
  const msg = e instanceof Error ? e.message : String(e);
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
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
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
      return loginNetworkError(e);
    }
  },

  async getPortalState(username?: string | null): Promise<PortalState> {
    const url = username ? `${baseUrl}/api/portal-state?username=${encodeURIComponent(username)}` : `${baseUrl}/api/portal-state`;
    const response = await fetchWithTimeout(url, { headers: { 'Cache-Control': 'no-cache, no-store' } });
    if (!response.ok) throw new Error(`Server returned non-successful response: ${response.status}`);
    return (await response.json()) as PortalState;
  },

  async uploadFile(opts: {
    uri: string;
    fileName: string;
    mimeType: string;
    workId?: string | null;
    userId?: string | null;
    zone?: string | null;
    district?: string | null;
    tp?: string | null;
  }): Promise<string | null> {
    try {
      const form = new FormData();
      form.append('file', { uri: opts.uri, name: opts.fileName, type: opts.mimeType } as unknown as Blob);
      if (opts.workId) form.append('workId', opts.workId);
      if (opts.userId) form.append('userId', opts.userId);
      if (opts.zone) form.append('zone', opts.zone);
      if (opts.district) form.append('district', opts.district);
      if (opts.tp) form.append('tp', opts.tp);
      const response = await fetchWithTimeout(`${baseUrl}/api/upload`, { method: 'POST', body: form });
      if (!response.ok) return null;
      const json = await response.json();
      return json.success ? json.url : null;
    } catch {
      return null;
    }
  },

  async submitInspectionWork(work: InspectionWork): Promise<SubmitWorkResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/inspection-works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(work),
      });
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

  async enqueueInspectionWork(work: InspectionWork): Promise<QueueEnqueueResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/queue/enqueue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(work),
      });
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
      const response = await fetchWithTimeout(`${baseUrl}/api/scope/version?clientVersion=${clientVersion}`);
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

  async getUserScope(userIdOrUsername: string): Promise<UserScopeResponse> {
    try {
      const response = await fetchWithTimeout(
        `${baseUrl}/api/scope/user?username=${encodeURIComponent(userIdOrUsername)}`
      );
      const resBody = await response.text();
      if (response.ok && resBody) return JSON.parse(resBody) as UserScopeResponse;
      return { success: false, scopeVersion: 1, message: `Server returned ${response.status}` };
    } catch (e) {
      return { success: false, scopeVersion: 1, message: e instanceof Error ? e.message : 'Network error fetching user scope' };
    }
  },

  async uploadProfilePhoto(userId: string, username: string, uri: string): Promise<ProfilePhotoUploadResponse> {
    try {
      const form = new FormData();
      form.append('userId', userId);
      form.append('username', username);
      form.append('file', { uri, name: `profile_${Date.now()}.jpg`, type: 'image/jpeg' } as unknown as Blob);
      const response = await fetchWithTimeout(`${baseUrl}/api/users/profile-photo`, { method: 'POST', body: form });
      const resBody = await response.text();
      if (response.ok && resBody) return JSON.parse(resBody) as ProfilePhotoUploadResponse;
      return { success: false, message: `Upload failed with status ${response.status}` };
    } catch (e) {
      return { success: false, message: e instanceof Error ? e.message : 'Failed to upload profile photo to S3' };
    }
  },

  async checkAppVersion(): Promise<VersionCheckResponse> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/mobile/version-check`);
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

  async getMobileConfig(): Promise<{ appIconUrl?: string; loginLogoUrl?: string } | null> {
    try {
      const response = await fetchWithTimeout(`${baseUrl}/api/mobile/config`);
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

export function resolveMediaUrl(rawUrl: string): string {
  if (rawUrl.startsWith('http') && (rawUrl.includes('amazonaws.com') || rawUrl.includes('s3.'))) {
    let slug = 'img';
    try {
      slug = new URL(rawUrl).pathname.replace(/^\//, '').split('/').filter(Boolean).pop() || 'img';
    } catch {
      /* keep default slug */
    }
    // Put the unique filename first so Android/Fresco cache keys cannot collide
    // when long presigned URLs are truncated after `/api/media`.
    return `${baseUrl}/api/media?k=${encodeURIComponent(slug)}&url=${encodeURIComponent(rawUrl)}#${encodeURIComponent(slug)}`;
  }
  if (rawUrl.startsWith('/uploads')) return `${baseUrl}${rawUrl}`;
  if (rawUrl.startsWith('/') && !rawUrl.startsWith('/data') && !rawUrl.startsWith('/storage')) {
    return `${baseUrl}${rawUrl}`;
  }
  return rawUrl;
}

export { emptyPortal };
