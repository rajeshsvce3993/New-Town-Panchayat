# Mobile production release (login fix + OTA)

## 1. Deploy backend first

Deploy the portal API so `/api/auth/login`:

- Accepts `X-Client: mobile` and `client: "mobile"` in the JSON body.
- Enforces who may use the mobile app (`lib/mobileAppAuth.ts`).
- Returns `success: false` with a clear message when access is denied (no client-side crash).

## 2. APK already on devices (build 108)

Build **108** cannot load JS OTA (no `expo-updates` in that native binary) and may crash on login if it calls `isInspectionUser` without an import.

**One-time path:** ship a **2.0.9 (109)** APK that includes `expo-updates`, then use OTA for all future JS fixes.

## 3. Build 2.0.9 APK (once)

From `mobile/`:

```bash
npm install
eas build --profile production-apk --platform android
```

Host the APK via your existing `/api/mobile/download-zip` flow and bump version check if you use forced update.

## 4. Publish OTA updates (after 2.0.9 is live)

```bash
cd mobile
eas update --channel production-apk --message "Login: server-side access control, remove client crash"
```

Devices on 2.0.9 check for updates on app open and reload automatically.

## 5. Verify login

1. Deploy API to production.
2. Open app → login with a field inspection user → should succeed.
3. Login with a disallowed portal-only user → should show server `message`, no crash.
4. Confirm requests include `X-Client: mobile` in server logs.