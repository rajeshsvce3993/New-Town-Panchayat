# Architecture — Expo Town Panchayat EMS Mobile

## Why this shape

The Kotlin app is **not** a multi-module MVVM codebase. It is one `MainActivity` owning navigation, session, portal refresh, notification polling, and offline sync, plus Compose screens that talk to `ApiService` and `PreferencesManager`.

The Expo app mirrors that: a small **app context** (session + portal + theme) and **services** for API, queue, notifications, branding. No Redux. No extra nav library. No Room (Kotlin had none).

## Directory

```
mobile/
  app/
    _layout.tsx              # providers, fonts, splash, session bootstrap
    index.tsx                # gate: login vs tabs
    (auth)/login.tsx
    (tabs)/_layout.tsx       # 4 tabs
    (tabs)/index.tsx         # Dashboard
    (tabs)/add-work.tsx
    (tabs)/reports.tsx
    (tabs)/settings.tsx
    notifications.tsx        # stack screen, not a tab
  src/
    api/client.ts
    components/
    features/                # screen-sized feature modules if needed
    hooks/
    services/                # queueSync, notifications, branding, sessionWatch
    storage/preferences.ts
    theme/palettes.ts
    types/models.ts
    utils/
    constants/
    config/
  assets/
```

Kotlin `kotlin_app/` is **not deleted**.

## State

- **Auth + user + theme + language + portal + works**: React Context (`AppProvider`). This is the MainActivity state.
- **Form local state**: React `useState` in Add Work (same as Compose `remember`).
- **Sensitive**: `auth_token`, `saved_password` in **SecureStore**.
- **Everything else JSON**: AsyncStorage (`town_panchayat_prefs` equivalent).

Zustand was not added: one session tree is enough.

## Networking

Plain `fetch` with 30s timeout (OkHttp timeouts). Base URL from prefs, default `https://townpanchayat.com`. Multipart via `FormData`. No Axios.

## Background

| Kotlin | Expo |
|---|---|
| WorkManager unique work every 5 min | `expo-background-fetch` task `FiveMinuteScopeSync` |
| Foreground 15s offline upload | JS interval while `AppState === 'active'` |
| Foreground 2 min notification poll | JS interval while logged in |
| Foreground 10s session expiry | JS interval |

Background fetch is **best-effort** on both Android and iOS; the 15s foreground loop is the reliable path, matching how inspectors actually use the Kotlin app.

## Navigation

```
Login (if no user)
  └── Tabs
        Dashboard (index 0)
        Add Work (1)
        Reports (2)
        Settings (3)
      Notifications (4) — pushed from Dashboard bell / notification tap
```

Back: Expo Router back; on Dashboard root, Android hardware back shows exit dialog (Kotlin `finish()`).

## Security notes vs Kotlin

Kotlin stored username **and password** in SharedPreferences. Expo stores password and token in SecureStore. Session user JSON remains in AsyncStorage (same as SharedPreferences JSON of `AppUser`).
