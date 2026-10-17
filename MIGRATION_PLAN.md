# Town Panchayat EMS — Kotlin → React Native (Expo) Migration Plan

Source of truth: `kotlin_app/` (package `com.tn.townpanchayat.ems`, version **2.0.0** / versionCode **100**).

The Kotlin app is a **single-activity Jetpack Compose** field inspection client. There are **no Fragments, Room, Retrofit interfaces, DataStore, Firebase/FCM (live), widgets, maps SDK, Bluetooth, microphone, or biometric prompts in UI**. Biometric is a Gradle dependency only. FCM registration is **commented out** in `MainActivity`.

Expo app location: `mobile/` (Kotlin and the Next.js web portal are preserved).

## Screen inventory

| # | Kotlin destination | Location | RN destination |
|---|-------------------|----------|----------------|
| 1 | Login | `LoginScreen.kt` | `app/(auth)/login.tsx` |
| 2 | Dashboard (nav 0) | `InspectionDashboardScreen.kt` | `app/(tabs)/index.tsx` |
| 3 | Add Work (nav 1) | `AddInspectionWorkScreen.kt` | `app/(tabs)/add-work.tsx` |
| 4 | Reports (nav 2) | `InspectionReportsScreen.kt` | `app/(tabs)/reports.tsx` |
| 5 | Settings (nav 3) | `SettingsScreen.kt` | `app/(tabs)/settings.tsx` |
| 6 | Notifications (nav 4, not in tab bar) | `NotificationsScreen.kt` | `app/notifications.tsx` |
| 7 | Force/soft update dialog | `MainActivity.kt` | `src/components/UpdateDialog.tsx` |
| 8 | Exit confirm dialog | `MainActivity.kt` | `src/hooks/useExitConfirm.ts` |
| 9 | Server URL dialog (5 taps on logo) | `LoginScreen.kt` | login screen modal |
| 10 | Report detail modal | `InspectionReportsScreen.kt` | `src/components/WorkDetailModal.tsx` |
| 11 | In-app media viewer | `NotificationsScreen.kt` | `src/components/InAppMediaViewer.tsx` |
| 12 | Profile photo source dialog | Dashboard + Settings | shared `PhotoSourceDialog` |

## Feature inventory

| Kotlin Feature | Category | Kotlin Location | React Native Equivalent | Expo Package/API | Status | Notes |
|---|---|---|---|---|---|---|
| Single Activity + Compose nav index | Navigation | `MainActivity.kt` | Expo Router tabs + stack | `expo-router` | Migrated | Back stack matches `navBackStack` |
| Login (username/password, no demo users) | Authentication | `LoginScreen.kt`, `ApiService.login` | Login screen + `api.login` | `fetch` | Migrated | Role gate: inspection users or admin only |
| Saved credentials auto-fill | Authentication | `PreferencesManager` | SecureStore | `expo-secure-store` | Migrated | Password moved off plaintext prefs |
| Session restore | Authentication | `prefs.currentUser` | Auth bootstrap | SecureStore + AsyncStorage | Migrated | |
| End-of-day logout | Authentication | `MainActivity` 10s loop | `sessionWatch` | timers | Migrated | `loginDate` vs today |
| 1-hour inactivity logout | Authentication | `lastInteractionTime` | `sessionWatch` | timers | Migrated | 3600000 ms |
| Force logout / disabled account | Authentication | portal-state + worker | portal refresh | fetch | Migrated | Tamil toast preserved |
| Logout API | Authentication | `POST /api/auth/logout` | `api.logout` | fetch | Migrated | |
| Change password | Authentication | `SettingsScreen` | Settings | fetch | Migrated | min 6 chars, mismatch, same-as-current |
| Inspection-only login gate | Business logic | `MainActivity.onPerformLogin` | `authService` | — | Migrated | |
| Bottom tabs (4) | Navigation | `MainActivity` Scaffold | `(tabs)` | expo-router | Migrated | Notifications not a tab |
| Android back: stack then exit dialog | Navigation | `BackHandler` | `BackHandler` | `react-native` | Migrated | Dashboard asks exit |
| Notification tap → Notifications | Navigation | intent `OPEN_SCREEN` | Linking / lastNotificationResponse | `expo-notifications` | Migrated | |
| Work submit tap → Reports | Navigation | `OPEN_SCREEN=REPORTS` | notification data | expo-notifications | Migrated | |
| 18 color palettes + cycle on login | UI | `Theme.kt` | `palettes.ts` | — | Migrated | including gradients |
| Tamil / English toggle | UI | prefs `is_tamil` | i18n helpers | — | Migrated | strings inline like Kotlin |
| Dynamic login logo / app icon | UI | `LogoConfig.kt` | branding store | AsyncStorage | Migrated | local fallback + remote URL |
| Branding sync from portal-state | Networking | `LogoConfig.syncBrandingFromServer` | `syncBranding` | fetch | Migrated | |
| Dashboard KPIs, date filter today | UI | `InspectionDashboardScreen` | Dashboard | — | Migrated | |
| User-only works filter | Business logic | dashboard + reports | `workFilters.ts` | — | Migrated | |
| Subject/category/ward charts | UI | dashboard | simple bars | — | Migrated | no extra chart lib |
| Add Work 2-step form | UI | `AddInspectionWorkScreen` | Add Work | — | Migrated | Step 2 stays after + Add Work |
| Assigned subjects/categories/wards | Business logic | Add Work | `scope.ts` | — | Migrated | |
| Ward normalize (`01`/`Ward 1`) | Business logic | Add Work / Reports | `normalizeWard` | — | Migrated | |
| Street auto-select from Mongo wards | Business logic | Add Work | `scope.ts` | — | Migrated | fallback street list if empty |
| Scope download required (no fallback) | Business logic | `hasDownloadedScope` | same rules | — | Migrated | |
| Dynamic fields + skip_to_camera | Business logic | Add Work | `fieldVisibility.ts` | — | Migrated | |
| Server validationRules | Business logic | submit handler | `validateFields.ts` | — | Migrated | required, min/max, pattern, unique |
| Work ID `TP + dist2 + tp2 + ward2 + 5 serial` | Business logic | submit | `workId.ts` | — | Migrated | |
| GPS high-accuracy geotag | Device API | FusedLocationProvider | Expo Location | `expo-location` | Migrated | submit blocked without live GPS |
| Camera evidence (full-res file) | Device API | `TakePicture` FileProvider | ImagePicker camera | `expo-image-picker` | Migrated | EXIF rotate via manipulator |
| Document picker field | Device API | `GetContent` | DocumentPicker | `expo-document-picker` | Migrated | |
| Profile photo camera/gallery + S3 | Device API | Dashboard/Settings | ImagePicker | expo-image-picker | Migrated | persistent local copy |
| Image compress 400–500KB / max 1280 | Business logic | `ImageCompressionUtil` | `imageCompression.ts` | `expo-image-manipulator` | Migrated | |
| Offline image files | Storage | `filesDir/offline_images` | FileSystem | `expo-file-system` | Migrated | |
| Multipart upload `/api/upload` | Networking | `ApiService.uploadFile` | FormData fetch | fetch | Migrated | workId, userId, zone, district, tp |
| Submit `/api/inspection-works` | Networking | `submitInspectionWork` | fetch | fetch | Migrated | |
| Server FIFO `/api/queue/enqueue` + poll | Networking | submit + worker | `queueSync.ts` | fetch | Migrated | 45s poll / 20s foreground |
| Direct submit fallback | Networking | worker + submit | `queueSync.ts` | fetch | Migrated | |
| Offline works list | Storage | `offline_works` JSON | AsyncStorage | AsyncStorage | Migrated | |
| Local FIFO `work_queue_entries` | Storage | PreferencesManager | AsyncStorage | AsyncStorage | Migrated | statuses COMPRESSING/IN_QUEUE/PROCESSING/SUBMITTED/REJECTED_RETRY |
| WorkManager 5-min scope sync | Background processing | `TownPanchayatApp` + `InspectionSyncWorker` | BackgroundFetch | `expo-background-fetch`, `expo-task-manager` | Migrated | OS may delay; also 15s foreground poll |
| Foreground offline sync 15s | Background processing | `MainActivity` | AppState loop | timers | Migrated | |
| Notification poll 2 min | Notifications | `MainActivity` | foreground poll | expo-notifications | Migrated | skip already notified/read |
| Rich notifications + View in App | Notifications | `NotificationHelper` | local notifications | expo-notifications | Migrated | |
| Alert tones (5) | Notifications | channels | Android channel + iOS sound | expo-notifications | Partial iOS | iOS cannot recreate Android channels; vibrate-only approximated |
| Reports search/ward/street/date | UI | Reports | Reports | — | Migrated | default today |
| Queued works tab | UI | Reports tab 1 | Reports | — | Migrated | |
| Golden 3-row photo caption modal | UI | Reports dialog | WorkDetailModal | — | Migrated | Close / மூடு |
| S3 image via `/api/media?url=` | Networking | Reports | `resolveMediaUrl` | fetch | Migrated | |
| In-app PDF WebView (Google viewer) | UI | NotificationsScreen | WebView | `react-native-webview` | Migrated | JS enabled as original |
| File download | Device API | DownloadManager | Sharing / Linking | `expo-sharing`, Linking | Partial | Android DownloadManager not 1:1; open/share used |
| APK hard/soft update | Device API | DownloadManager + VIEW | Linking + IntentLauncher | `expo-intent-launcher` | Android-only | iOS opens URL |
| Version check | Networking | `/api/mobile/version-check` | launch effect | fetch | Migrated | versionCode 100 |
| Health test connection | Networking | `/api/health` | server dialog | fetch | Migrated | 30s timeout |
| Portal state | Networking | `/api/portal-state` | AppProvider | fetch | Migrated | Cache-Control: no-cache |
| Scope version + user scope | Networking | `/api/scope/*` | `scopeSync.ts` | fetch | Migrated | |
| Profile photo API | Networking | `/api/users/profile-photo` | FormData | fetch | Migrated | |
| Notifications list | Networking | `/api/notifications` | fetch | fetch | Migrated | |
| FCM register-token | Networking | commented in MainActivity | stub kept unused | — | Not enabled | Kotlin also disabled |
| Clear synced cache | Storage | Settings | FileSystem cleanup | expo-file-system | Migrated | keep unsynced paths |
| Camera/location/notification perms | Permissions | Manifest + launchers | Expo permissions | Location, ImagePicker, Notifications | Migrated | requested at launch |
| FileProvider | Device API | `file_paths.xml` | Expo handles camera files | expo-image-picker | Migrated | |
| Cleartext HTTP | Networking | `usesCleartextTraffic` | `NSAppTransport` + Android cleartext | `app.json` | Migrated | LAN `:5000` servers |
| Biometric library | Security | gradle only | none in UI | — | Not in product | No prompt in Kotlin UI |
| Coil image loading | UI | screens | `Image` | expo-image optional | Migrated | RN Image + File URIs |
| OkHttp 30s timeouts | Networking | ApiService | AbortController 30s | fetch | Migrated | |
| Gson models | State management | `Models.kt` | `src/types/models.ts` | — | Migrated | |
| SharedPreferences | Storage | `town_panchayat_prefs` | AsyncStorage + SecureStore | both | Migrated | |
| Logo prefs | Storage | `logo_prefs` | AsyncStorage | AsyncStorage | Migrated | |
| Tests | Other | none in kotlin_app | none added as Kotlin had none | — | N/A | |
| Localization XML | UI | `strings.xml` | constants + isTamil | — | Migrated | most strings were hardcoded in Compose |

## Architecture mapping

| Kotlin | RN |
|---|---|
| Activity | Expo Router screen |
| Compose screen | Screen component |
| PreferencesManager | `src/storage/preferences.ts` |
| ApiService | `src/api/client.ts` |
| InspectionSyncWorker | `src/services/queueSync.ts` + background task |
| NotificationHelper | `src/services/notifications.ts` |
| LogoConfig | `src/services/branding.ts` |
| ImageCompressionUtil | `src/utils/imageCompression.ts` |
| AppPalettes | `src/theme/palettes.ts` |

## Phases (execution)

1. Audit (this document)  
2. Docs: ARCHITECTURE, API_MAPPING, FEATURE_PARITY, LIMITATIONS  
3. Expo scaffold in `mobile/`  
4–10. Core services, auth, nav, screens, native, notifications  
11. `tsc --noEmit`  
12. Expo config / doctor  
13–15. Parity notes and remaining OS-level gaps documented, not silently dropped  
