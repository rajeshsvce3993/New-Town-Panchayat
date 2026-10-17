# API Mapping — Kotlin `ApiService` → Expo `src/api/client.ts`

Default base URL: `https://townpanchayat.com` (overridable via 5-tap login logo → server config). Timeouts: **30s** connect/read/write.

Auth header: Kotlin **does not** send `Authorization` on any call (token is stored but unused on the wire). Expo matches that.

| Endpoint | Method | Authentication | Request | Response | Kotlin Location | RN Implementation |
|---|---|---|---|---|---|---|
| `/api/health` | GET | none | — | HTTP success | `testConnection` | `api.testConnection` |
| `/api/auth/login` | POST | none | `{ username, password }` | `LoginResponse` (user, token, userScope, scopeVersion, message) | `login` | `api.login` |
| `/api/auth/logout` | POST | none | `{ userId, username, reason }` | HTTP success | `logout` | `api.logout` |
| `/api/auth/change-password` | POST | none | `{ username, currentPassword, newPassword }` | `{ success, message }` | `changePassword` | `api.changePassword` |
| `/api/portal-state?username=` | GET | none | query username; `Cache-Control: no-cache, no-store` | `PortalState` | `getPortalState` | `api.getPortalState` |
| `/api/upload` | POST multipart | none | `file` + optional `workId,userId,zone,district,tp` | `{ success, url }` | `uploadFile` | `api.uploadFile` |
| `/api/inspection-works` | POST | none | `InspectionWork` JSON | `SubmitWorkResponse` | `submitInspectionWork` | `api.submitInspectionWork` |
| `/api/queue/enqueue` | POST | none | `InspectionWork` JSON | `{ success, jobId, status, queuePosition, message }` | `enqueueInspectionWork` | `api.enqueueInspectionWork` |
| `/api/queue/status?jobId=` | GET | none | jobId | `{ success, job, message }` | `getQueueJobStatus` | `api.getQueueJobStatus` |
| `/api/scope/version?clientVersion=` | GET | none | clientVersion | `{ success, scopeVersion, hasUpdate, updatedAt, message }` | `checkScopeVersion` | `api.checkScopeVersion` |
| `/api/scope/user?username=` | GET | none | username | `{ success, scopeVersion, scope, message }` | `getUserScope` | `api.getUserScope` |
| `/api/users/profile-photo` | POST multipart | none | `userId`, `username`, `file` | `{ success, profilePhotoUrl, message }` | `uploadProfilePhoto` | `api.uploadProfilePhoto` |
| `/api/mobile/version-check` | GET | none | — | `{ success, latestVersionCode, latestVersionName, minRequiredVersionCode, forceUpdate, apkDownloadUrl, releaseNotes }` | `checkAppVersion` | `api.checkAppVersion` |
| `/api/notifications?userId&zoneId&tpId` | GET | none | encoded query | `{ success, count, notifications }` | `getNotifications` | `api.getNotifications` |
| `/api/notifications/register-token` | POST | none | `{ token, userId, username, deviceModel, appVersion }` | HTTP success | `registerFcmToken` | `api.registerFcmToken` (not called; Kotlin disabled) |
| `/api/media?url=` | GET | none | encoded S3 URL | proxied image | Reports image resolve | `resolveMediaUrl` helper |

## Error behavior preserved

- Login: parse JSON even on HTTP error; HTML body → “webpage instead of data”; Connect/UnknownHost/Timeout messages mention Port 5000.
- Portal state: throw on non-success (caller falls back to cache).
- Upload: return `null` on failure (caller writes local file / base64).
- Submit: `{ success:false, message }` on HTTP/network error.
- Version check / notifications: empty/default on failure (never crash launch).

## Client app version reported

Kotlin FCM payload used `"appVersion": "2.4.0"` while `build.gradle.kts` is `2.0.0` / 100. Expo `registerFcmToken` uses the same **2.4.0** string if ever enabled, so the unused payload stays compatible.
