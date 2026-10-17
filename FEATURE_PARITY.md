# Feature Parity — Kotlin vs React Native (Expo)

Verified column: **Code-complete** means implemented against Kotlin source. **Device-verified** requires a signed APK/IPA on hardware; not claimed here.

| Feature | Kotlin Behavior | React Native Behavior | Verified |
|---|---|---|---|
| App launch | MainActivity + permission request | Expo root + permission request | Code-complete |
| Login validation | Username+password required | Same | Code-complete |
| Login role gate | Inspection or admin only | Same messages EN/TA | Code-complete |
| Credential save | SharedPreferences | SecureStore password + AsyncStorage username | Code-complete |
| Theme cycle on login | Next palette in `allPalettes` | Same 18 palettes | Code-complete |
| Language on login | தமிழ் / English chips | Same | Code-complete |
| Hidden server config | 5 taps on logo | Same | Code-complete |
| Test connection | GET /api/health | Same | Code-complete |
| Dashboard first after login | nav 0 | tabs index | Code-complete |
| Scope hydrate on login | userScope → PortalState | Same | Code-complete |
| Background scope version check | if newer, GET user scope | Same | Code-complete |
| Session EOD logout | loginDate != today | Same | Code-complete |
| Idle 1h logout | lastInteraction 3600000 | Same | Code-complete |
| Disabled/forceLoggedOut | clear session + Tamil toast | Same | Code-complete |
| Dashboard date default today | dd-MM-yyyy | Same | Code-complete |
| Dashboard user works only | id/username/name match | Same | Code-complete |
| KPI cards + charts | subject/category/ward | Same grouping | Code-complete |
| Add Work CTA | navigates tab 1 | router | Code-complete |
| Bell unread badge | cached + fetch | Same | Code-complete |
| Add Work 2 steps | Subject/Ward → Work Detail | Same | Code-complete |
| Back on step 2 | to step 1 | Same | Code-complete |
| Scope missing banner | download button | Same | Code-complete |
| GPS on open | high accuracy + toast | expo-location | Code-complete |
| Submit without GPS | blocked | Same errors | Code-complete |
| Dynamic fields + camera skip | skip_to_camera / dependsOn | Same | Code-complete |
| Unique field vs existing works | category + value | Same | Code-complete |
| Work ID format | TP + 2+2+2 + 5 serial | Same | Code-complete |
| Online submit via queue then direct | 20 polls then POST works | Same | Code-complete |
| Offline queue + WorkManager | FIFO retry end of queue | BackgroundFetch + 15s loop | Code-complete (OS timing differs) |
| Success: + Add Work stays step 2 | currentStep=2 | Same | Code-complete |
| Success: Done → step 1 | currentStep=1 | Same | Code-complete |
| Reports filters | ward/street/search/dates | Same | Code-complete |
| Report golden caption | 3 amber rows | Same | Code-complete |
| Close / மூடு | text button | Same | Code-complete |
| Settings profile photo | camera/gallery + S3 | Same | Code-complete |
| Change password rules | 6 chars, match, different | Same | Code-complete |
| Alert tones | 5 options + channels | Android channels; iOS category | Partial iOS |
| Clear cache | skip unsynced paths | Same | Code-complete |
| Logout | API then logoutClear (keep theme/lang/server) | Same | Code-complete |
| Version card | name/code/package | expo-application | Code-complete |
| Notifications list/read/all-read | prefs sets | Same | Code-complete |
| In-app PDF/image | WebView google viewer | Same | Code-complete |
| Hard/soft update dialog | force vs later | Same copy | Code-complete |
| APK download | DownloadManager + VIEW | Android intent / Linking | Android-only install |
| Exit dialog | finish() | BackHandler exitApp | Android; iOS no hardware back |
| FCM | commented out | not called | Parity with Kotlin |
| Biometric | unused | unused | Parity with Kotlin |
| Launcher branding files | drawable missing in repo | Expo icon + remote URL | Asset gap in source repo |

Device/OS testing (camera, GPS, background fetch, notifications) must be run on a development build (`npx expo run:android`), not Expo Go, because background fetch, notifications channels, and FileSystem directories need a native build.
