# Town Panchayat EMS — Expo (React Native)

Migrated from `kotlin_app/` (Jetpack Compose). Kotlin sources are unchanged.

## Run

```bash
cd mobile
npm install
npx expo start
```

Camera, GPS, notifications, and 5-minute background sync need a **development build**, not Expo Go:

```bash
npx expo run:android
```

Or EAS:

```bash
npx eas build -p android --profile preview
```

## Typecheck

```bash
npx tsc --noEmit
```

Default API: `https://townpanchayat.com`. On the login screen, tap the logo **five times** to set `http://HOST:5000`.
