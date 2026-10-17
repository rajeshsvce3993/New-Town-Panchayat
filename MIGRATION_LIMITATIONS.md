# Migration Limitations

Nothing below was dropped silently. Each item is either approximated or documented.

## Requires a development / EAS build (not Expo Go)

- Local notifications with custom Android channels
- Background fetch (5-minute scope + FIFO)
- Foreground location
- Camera file URIs
- `expo-secure-store` on some Android variants
- APK install intents

## Android-only (Kotlin was Android-only)

- Hardware back → exit confirmation (`finish()`)
- DownloadManager APK install flow
- Notification channel importance / vibration patterns (`high_alert`, `vibrate`)
- `usesCleartextTraffic` for `http://IP:5000`

iOS: updates open `apkDownloadUrl` in the browser (cannot sideload APK). Exit dialog is unused without a hardware back button; users leave via the OS gesture.

## Cannot be 1:1 under Expo managed workflow

| Item | Why | What we did |
|---|---|---|
| WorkManager exact 5-minute cadence | iOS/Android OS batches `BackgroundFetch` | Same task + 15s foreground sync (Kotlin also had the 15s loop) |
| DownloadManager notification when APK finishes | No Expo API for DownloadManager | `Linking` / `IntentLauncher` VIEW of URL |
| Changing the **launcher icon** at runtime from `appIconUrl` | Android adaptive icons are compile-time | In-app header/login images update live (same as Compose `LogoConfig` UI), not the home-screen icon |
| FCM push | Kotlin registration is commented out | Same: poll `/api/notifications` every 2 minutes while logged in |
| `androidx.biometric` | Never used in UI | Not added |
| Missing `app_logo.png` / `app_icon.png` in repo | Drawables not committed | Remote branding URL + Expo default icon; Tamil Nadu logo URL used as Kotlin `DEFAULT_FALLBACK_URL` if remote empty |

## WebView PDF

Kotlin enables JavaScript on an in-app WebView loading Google Docs viewer. Expo uses `react-native-webview` the same way. Google viewer availability depends on network policy.

## User data migration from the Kotlin APK

Preferences live in Android SharedPreferences `town_panchayat_prefs`. The Expo app uses a **new** application storage namespace (`com.tn.townpanchayat.ems` vs debug suffix `.debug`). Existing Kotlin installs will **not** automatically import tokens into Expo. Users log in again. Offline queue JSON is not ported from the old app sandbox.

If a future native module must read the old SharedPreferences file, it would be custom Android code; not implemented.

## Kotlin code

`kotlin_app/` remains in the repository until product owners verify the Expo build and choose to retire the APK.
