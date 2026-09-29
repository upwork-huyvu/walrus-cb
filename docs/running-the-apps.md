# Walrus — Running the Apps

How to set up, run, test and build each app in this repository: the **backend**, the **admin
dashboard** and the **mobile app**. Start with the backend — the other two depend on it.

**Written:** 2026-09-29

---

## Contents

1. [Prerequisites](#1-prerequisites)
2. [Files you must add before anything runs](#2-files-you-must-add-before-anything-runs)
3. [Backend (NestJS)](#3-backend-nestjs)
4. [Admin dashboard (Next.js)](#4-admin-dashboard-nextjs)
5. [Mobile app (React Native)](#5-mobile-app-react-native)
6. [Running everything together](#6-running-everything-together)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| Node.js | **22.11 or newer** | All three apps |
| npm | Comes with Node | All three apps (each app has its own `package-lock.json`) |
| Xcode | Recent, with iOS 15.1+ SDK | iOS build (macOS only) |
| CocoaPods | Recent | iOS dependencies |
| JDK | 17 | Android build |
| Android Studio + SDK | Recent, API 24+ | Android build |

> **Do not keep the repository in an iCloud-synced folder** (for example `~/Documents` or
> `~/Desktop` with iCloud Drive on). iCloud creates `file 2.ext` copies that break the Android
> build with duplicate-class errors and the iOS build with code-signing errors.

There is **no root workspace**: every app is installed and run from its own folder.

---

## 2. Files you must add before anything runs

Secrets and per-app files are not in Git. Get them from the project owner (see the handover
document) and put them at these exact paths:

| File | App | Template in the repo |
|---|---|---|
| `apps/backend/.env` | Backend | `apps/backend/.env.example` |
| `apps/admin/.env.local` | Admin | `apps/admin/.env.example` |
| `apps/mobile/.env` | Mobile | `apps/mobile/.env.example` |
| `apps/mobile/ios/secrets.xcconfig` | Mobile (iOS) — Tuya iOS keys | `apps/mobile/ios/secrets.xcconfig.example` |
| `apps/mobile/ios/GoogleService-Info.plist` | Mobile (iOS) — Firebase | — |
| `apps/mobile/ios/ios_core_sdk/` | Mobile (iOS) — Tuya security SDK | — (download from Tuya console) |
| `apps/mobile/android/secrets.properties` | Mobile (Android) — Tuya keys + release signing | `apps/mobile/android/secrets.properties.example` |
| `apps/mobile/android/app/google-services.json` | Mobile (Android) — Firebase | — |
| `apps/mobile/android/app/libs/security-algorithm-*.aar` | Mobile (Android) — Tuya security SDK | — (download from Tuya console) |
| `apps/mobile/android/app/walrus-release.keystore` | Mobile (Android) — release builds only | — |

The Tuya security SDK files are generated per app identity (iOS bundle ID, Android package name
+ signing SHA-256). Files from another app will not work.

---

## 3. Backend (NestJS)

**Folder:** `apps/backend` · **Local URL:** `http://localhost:3006` · **Production:**
https://walrus-backend.vercel.app

### Setup

```bash
cd apps/backend
cp .env.example .env        # then fill in the real values
npm install                 # also runs `prisma generate`
```

In `.env`, set **`PORT=3006`** — the admin and mobile app expect the backend there, and the admin
itself uses port 3000.

The backend needs, at minimum, the Supabase variables (`DATABASE_URL`, `DIRECT_URL`,
`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and the Tuya Cloud variables
(`TUYA_OPENAPI_ENDPOINT`, `TUYA_ACCESS_ID`, `TUYA_ACCESS_SECRET`, `TUYA_APP_SCHEMA`). Every variable
is explained in `.env.example`.

### Run

| Command | What it does |
|---|---|
| `npm run start:dev` | Run with auto-reload on file changes (**use this for development**) |
| `npm run start` | Run once, no reload |
| `npm run build` then `npm run start:prod` | Run the compiled build from `dist/` |

Check it is up: open `http://localhost:3006` — any response (even a 404 JSON) means it is running.

### Database (Prisma + Supabase)

| Command | When |
|---|---|
| `npm run db:generate` | After changing `prisma/schema.prisma` (runs automatically on `npm install`) |
| `npm run db:migrate` | Create and apply a new migration while developing |
| `npm run db:deploy` | Apply existing migrations to a database (for example production) |
| `npm run db:studio` | Browse the database in a local web UI |

> The local `.env` usually points at the **real Supabase project**. `db:migrate` and `db:deploy`
> then change the shared database — double-check before running them.

### Checks

```bash
npx tsc --noEmit
npm test             # unit tests (Jest)
npm run lint         # ESLint (auto-fixes)
```

### Production (Vercel)

- Vercel runs the backend as a serverless function from `api/index.ts`, configured by
  `vercel.json`. It does **not** use `npm run start`.
- Production reads **Vercel's environment variables**, not `.env`. After changing a variable on
  Vercel you **must redeploy**.
- Two scheduled jobs run through Vercel Cron (`vercel.json`): `process-delete-jobs` at 00:00 UTC and
  `process-reminders` at 01:00 UTC. They do **not** run locally; call them by hand with the
  `x-cron-secret` header if you need to test them.
- New database migrations are **not** applied by a deploy. Run `npm run db:deploy` against the
  production database yourself.

---

## 4. Admin dashboard (Next.js)

**Folder:** `apps/admin` · **Local URL:** `http://localhost:3000` · **Production:**
https://walrus-cb.vercel.app

### Setup

```bash
cd apps/admin
cp .env.example .env.local
npm install
```

`.env.local` needs a single variable:

```bash
API_BASE_URL=http://localhost:3006     # local backend
# API_BASE_URL=https://walrus-backend.vercel.app   # or the production backend
```

`API_BASE_URL` is read on the server only; the browser never calls the backend directly.

### Run

| Command | What it does |
|---|---|
| `npm run dev` | Development server with hot reload at `http://localhost:3000` |
| `npm run build` then `npm run start` | Production build, served locally |

Sign in with an admin account (email + password). The account must exist in Supabase Auth **and**
be on the admin allowlist — see `docs/admin-website.md`.

### Checks

```bash
npx tsc --noEmit
npm run lint
npm run build        # catches errors only the production build finds
```

There are no unit tests for the admin; verify changes in the browser.

### Production (Vercel)

A separate Vercel project from the backend. Set `API_BASE_URL=https://walrus-backend.vercel.app`
in its environment variables and redeploy after any change.

---

## 5. Mobile app (React Native)

**Folder:** `apps/mobile` · **Platforms:** iOS 15.1+, Android 8+ (API 24)

The app talks to Tuya **directly** through the native library
[`@jimmy2k/react-native-turbo-tuya`](https://www.npmjs.com/package/@jimmy2k/react-native-turbo-tuya),
installed from npm. It only calls our backend for push-notification registration.

### Setup

```bash
cd apps/mobile
cp .env.example .env
npm install
```

`.env`:

| Variable | Value |
|---|---|
| `API_BASE_URL` | Local: `http://<your-Mac-IP>:3006` (find the IP with `ipconfig getifaddr en0`; `localhost` does not work from a phone) · Production: `https://walrus-backend.vercel.app` |
| `PUSH_API_KEY` | Same value as the backend's `PUSH_API_KEY`. Leave empty to skip push registration |
| `MOCK_DEVICES` | `true` shows a simulated tub for UI work without hardware. **Must be `false` for real use and store builds** |

> `.env` values are **baked into the JavaScript bundle at build time**. After changing `.env`,
> restart Metro with a clean cache: `npx react-native start --reset-cache`.

Then add the native files from [section 2](#2-files-you-must-add-before-anything-runs).

### Run on iOS

```bash
cd apps/mobile/ios
LANG=en_US.UTF-8 pod install          # first time, and after any native dependency change
cd ..
npm start                             # Metro bundler, keep it running
npm run ios                           # in a second terminal — simulator
```

To run on a **real iPhone** (needed for pairing, Bluetooth and push), open
`ios/CoolBathMobile.xcworkspace` in Xcode — the **.xcworkspace**, not the `.xcodeproj` — pick
your device, check signing under *Signing & Capabilities* (Team `P75YBWTFK4`), and press Run.

### Run on Android

```bash
cd apps/mobile
npm start                             # Metro bundler, keep it running
npm run android                       # in a second terminal — emulator or USB-connected phone
```

### What works where

| Feature | Simulator / emulator | Real phone |
|---|---|---|
| Sign in, onboarding, UI | ✅ | ✅ |
| Device screens with `MOCK_DEVICES=true` | ✅ | ✅ |
| Pairing a real tub (Wi-Fi / Bluetooth) | ❌ | ✅ — **2.4 GHz Wi-Fi only** |
| Push notifications | ❌ (iOS simulator) | ✅ |

### Checks

```bash
npx tsc --noEmit
npm test             # Jest
npm run lint
```

### Release builds

**Android** — needs `walrus-release.keystore` and the `WALRUS_RELEASE_*` values in
`secrets.properties` (without them, release builds silently fall back to the debug key, which the
Play Store will reject):

```bash
cd apps/mobile/android
./gradlew bundleRelease       # .aab for Google Play → app/build/outputs/bundle/release/
./gradlew assembleRelease     # .apk for direct install → app/build/outputs/apk/release/
```

Raise `versionCode` (and `versionName`) in `android/app/build.gradle` before every Play upload.

**iOS** — in Xcode: select *Any iOS Device*, then *Product → Archive*, then *Distribute App* to
upload to App Store Connect / TestFlight. Raise the **Build** number (and Version if needed) under
the target's *General* tab before every upload.

---

## 6. Running everything together

Three terminals for a full local setup:

```bash
# 1 — backend on :3006
cd apps/backend && npm run start:dev

# 2 — admin on :3000
cd apps/admin && npm run dev

# 3 — mobile (Metro), then launch the app from another terminal or Xcode
cd apps/mobile && npm start
```

The phone and the Mac must be on the **same network** for the app to reach the local backend.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Admin shows empty customer/device lists, no error | Tuya Data Center mismatch — the Tuya Cloud Project and `TUYA_OPENAPI_ENDPOINT` must both be **Central Europe** |
| Admin page shows a blank screen with a number | A server error hidden by Next.js in production. The number is a digest; the cause is in the server/Vercel log |
| App fails at startup / Tuya init rejected | Missing or wrong Tuya keys (`secrets.xcconfig` / `secrets.properties`), or security SDK files from a different app identity |
| `pod install` fails with an encoding error | Run it as `LANG=en_US.UTF-8 pod install` |
| Android build: duplicate class errors | iCloud created `name 2.ext` copies. Move the repo out of iCloud, delete the copies, clean the build (`cd android && ./gradlew clean`) |
| Changed `.env` but the app still uses the old value | Restart Metro with `--reset-cache` and rebuild |
| Google sign-in on Android fails with `DEVELOPER_ERROR` | The Google OAuth client does not have this build's SHA-1 (debug and release keys differ) |
| Pairing never finds the tub | Phone on a 5 GHz network, or (iOS) Local Network permission declined — re-enable it in Settings |

More background on each of these: `docs/developer-onboarding.md`, section 12.
