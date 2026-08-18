# Walrus — Developer Onboarding

Read this first if you have just joined. It explains what this project is, what has actually been
built, what has deliberately **not** been built, and the handful of constraints that will waste
your week if nobody tells you about them.

**Version:** 1.0 · **Written:** 2026-08-13

> Written from the codebase, not from the original brief. Where the two disagree, this document
> follows the code.

---

## Contents

1. [What this project is](#1-what-this-project-is)
2. [Commercial scope](#2-commercial-scope)
3. [The four codebases](#3-the-four-codebases)
4. [How the pieces talk to each other](#4-how-the-pieces-talk-to-each-other)
5. [Feature inventory — mobile app](#5-feature-inventory--mobile-app)
6. [Feature inventory — admin dashboard](#6-feature-inventory--admin-dashboard)
7. [Feature inventory — backend](#7-feature-inventory--backend)
8. [What is NOT built](#8-what-is-not-built)
9. [Constraints that will bite you](#9-constraints-that-will-bite-you)
10. [Running it locally](#10-running-it-locally)
11. [Where the project's state lives](#11-where-the-projects-state-lives)
12. [Landmines already stepped on](#12-landmines-already-stepped-on)

---

## 1. What this project is

**Walrus** sells a connected ice bath — a cold plunge tub with a chiller, a light and a sanitising
function. The tub is built on **Tuya**, a Chinese IoT platform that supplies the hardware module,
the cloud, and a generic consumer app called **Smart Life**.

Out of the box, a Walrus customer would have to control their expensive tub through Smart Life —
a generic app with Tuya's branding and hundreds of unrelated device types in it.

**This project replaces Smart Life with a branded Walrus app**, plus an internal admin dashboard
for the company to see its customers and support them.

So the job is not "build an IoT platform". Tuya already is the platform. The job is:

- wrap Tuya's mobile SDK in something a React Native app can use,
- build a focused, well-designed app on top of it,
- and add the pieces Tuya does not provide: a customer-facing brand, an internal admin tool, push
  notifications, and habit tracking.

### Who uses what

| User | Uses | Gets in by |
|---|---|---|
| **Customer** | The mobile app | Registering themselves with email, Google or Apple |
| **Walrus staff** | The admin dashboard | An account created by a developer, plus an entry on an allowlist |

---

## 2. Commercial scope

The work is contracted in three milestones, **$700 total**.

| Milestone | Budget | Delivers |
|---|---|---|
| **M1 — Foundation & Core Control** | $250 | React Native CLI set up with the Tuya SDK · login and Tuya "home" setup · in-app pairing over Wi-Fi and Bluetooth · a basic dashboard showing real temperature and letting the user change the target |
| **M2 — UI Completion & Backend** | $280 | The full designed UI · backend on Supabase + Vercel for user profiles and device mapping · home/room management · the admin panel |
| **M3 — Advanced Features & Delivery** | $170 | The "Into the Cold" countdown and daily summary · Firebase push notifications · the filter reminder · testing, fixes, handover |

⚠️ **M1's scope was widened partway through** (2026-06-28): the npm Tuya library, the NestJS
backend and the admin web — originally M2 — were pulled into M1. The $250 figure predates that
change and was flagged as needing re-estimation. Worth knowing before you read old planning notes
and wonder why M1 contains so much.

---

## 3. The four codebases

```
cool-bath/
├── apps/
│   ├── mobile/     React Native CLI app (iOS + Android)   ← the customer's app
│   ├── backend/    NestJS API on Vercel                   ← admin's data source
│   └── admin/      Next.js dashboard                       ← internal staff tool
├── packages/
│   └── tuya-react-native/   Custom native module wrapping Tuya's SDK
├── docs/           Research notes, guides, this file
├── dev-workflow/   Per-feature planning and status
└── CLAUDE.md       Project rules and conventions
```

### `packages/tuya-react-native` — the piece people underestimate

Published as `@jimmy-vu/react-native-turbo-tuya`, this is **written for this project**, not an
off-the-shelf dependency. It is a React Native **TurboModule** bridge over Tuya's native Smart Life
SDK for both platforms, in Kotlin and Objective-C++.

It exposes twelve modules:

`Auth` · `Core` · `Device` · `Home` · `Matter` · `Member` · `Mesh` · `Message` · `Ota` ·
`Pairing` · `Scene` · `Timer`

Not all of them are wired into the app — the app currently uses Core, Auth, Home, Pairing, Device
and Message. The rest were built out while mapping the SDK's surface.

**Why this matters to you:** anything touching pairing, device control or Tuya login goes through
native code in this package. Changing it means rebuilding the app, not just reloading JavaScript.
A large amount of the project's difficulty lives here.

---

## 4. How the pieces talk to each other

```
                    ┌──────────────────────────────┐
   Customer's phone │  Mobile app                  │
                    │  └─ tuya-react-native (native SDK)
                    └──────────┬───────────────────┘
                               │  direct
                               ▼
                        ┌─────────────┐        ┌──────────┐
                        │ Tuya Cloud  │◄──────►│ The tub  │
                        └─────▲───────┘        └──────────┘
                              │  server-to-server
                    ┌─────────┴───────┐
   Staff browser ──►│ Next.js (admin) │──► NestJS backend ──► Supabase (Postgres)
                    └─────────────────┘
```

Two facts follow, and both explain most confusing bugs:

**1. The app talks to Tuya directly.** Pairing and device control never touch our backend. The app
embeds Tuya's SDK and speaks to Tuya's cloud (and, on the local network, to the tub itself).

**2. The admin never talks to Tuya directly.** Every admin screen goes through our NestJS backend,
which calls Tuya's *cloud API* — a completely different interface from the mobile SDK, with
different auth, different data shapes, and different failure modes.

So the same tub is reachable by **two independent routes**. One can be broken while the other
works, and "it works in the app but not in admin" is a normal, expected class of bug rather than a
contradiction.

One concrete consequence: raw device values come back **base64-encoded through the cloud API** but
**hex-encoded through the mobile SDK**. The backend has its own codec because of this.

---

## 5. Feature inventory — mobile app

Everything below exists in the code today.

### Accounts

| Feature | Notes |
|---|---|
| Register with email | Email + verification code + password |
| Sign in with email | |
| Sign in with **Google** | Feeds a Google token into Tuya's third-party login |
| Sign in with **Apple** | iOS |
| Session persists across restarts | |
| Change password | Sends a code, then signs you out to sign in again |
| Delete account | |

The identity of record is the **Tuya account**, not ours. Supabase holds admin accounts and some
business data, not customer logins.

### Onboarding

Splash → intro slides → a short questionnaire (email, name, why, experience, device) → home setup.
A Tuya **"home"** must exist before a tub can be paired; the app creates one automatically if
needed.

### Pairing

Three modes, each using exactly one radio channel:

| Mode | How it works | Tub indicator |
|---|---|---|
| **Wi-Fi (EZ)** | Phone broadcasts the Wi-Fi credentials; the tub listens | Blinks **fast** |
| **Wi-Fi hotspot (AP)** | Phone joins a hotspot the tub creates, hands over credentials | Blinks **slow** |
| **Bluetooth** | Direct BLE pairing, no Wi-Fi details needed | — |

The UI shows a radar sweep with discovered devices as blips. There is a preflight check that blocks
obviously doomed attempts (empty network name, 5 GHz on Android), a visible countdown, and a
"copy diagnostics" action on failure.

> Modes deliberately do **not** run in parallel. AP requires the phone to leave the home Wi-Fi and
> join the tub's hotspot; EZ requires it to stay on the home Wi-Fi. One phone cannot be on two
> networks, so an earlier "try everything at once" design was removed.

### Device control

The dashboard shows current and target temperature and offers **only the controls the connected tub
actually reports**: power, light, disinfection, and target temperature.

The current tub model has **no separate freeze/cooling toggle** — power *is* the chiller.

State updates arrive in real time; commands are optimistic and revert if the tub does not confirm.

### The ritual

A timed cold-plunge session with a countdown, a completion screen, and a tracking tab with points,
levels and a streak. **This is stored on the phone**, not on the account — a reinstall clears it.

### Support features

| Feature | Backed by |
|---|---|
| Filter reminder (days until the next change, mark replaced) | Our backend, with a local fallback |
| Notification history and unread badge | Our backend |
| Push notifications | Firebase (FCM), sent from the admin panel |
| Shop and Help screens | Static content |
| Profile: display name, temperature unit, time zone, dark mode | Tuya + local |
| Home management | Tuya |

### A simulator worth knowing about

A build flag (`MOCK_DEVICES`) injects fake tubs into the device list with their own drifting
temperature and working toggles. It **does not** replace the Tuya SDK — real tubs keep working
normally alongside the fakes. It exists so the device UI can be developed and tested without
hardware, and it is what makes QA possible without a tub in the room.

---

## 6. Feature inventory — admin dashboard

A Next.js app using Server Components, no UI framework, plain CSS. Dark "gilded noir" theme.

| Screen | What it does |
|---|---|
| **Dashboard** | Three counters: customers, tubs (with online count), administrators |
| **Tuya users** | Every customer, with search, sorting and paging |
| **User detail** | Account information, a device/activity summary, Tuya metadata, and the customer's tubs |
| **User's devices** | Full nine-column table of one customer's tubs |
| **Devices** | Every tub across all customers, with remote control |
| **Device detail** | Live status and a control panel that sends real commands |
| **Admins** | The access allowlist, with revoke |
| **Send notifications** | Compose and push to selected customers or everyone |
| **Settings** | Read-only view of how the instance is wired |

Admin access requires **both** an auth account and an allowlist entry — having one without the
other gets you rejected.

Two values on the user screens are **derived, not fetched**, because Tuya does not provide them:
`Status` (from whether the customer has paired anything) and `User source` (from the account-name
prefix). Both say so in a tooltip.

---

## 7. Feature inventory — backend

NestJS, deployed on Vercel, Prisma against Supabase Postgres.

| Module | Responsibility |
|---|---|
| `admin-auth` | Admin sign-in and the guard protecting every admin route |
| `users` | Customer list and detail from Tuya, deletion (with a retry queue) |
| `devices` | Tub list, detail and commands **via Tuya's cloud API** |
| `notifications` | Sending pushes, provider selection, templates |
| `push` | Device token registration from the app |
| `reminders` | Filter reminder state per tub |
| `mobile-auth` | App-side auth support |
| `tuya` | Signed HTTP client for Tuya's cloud API |
| `prisma` · `config` · `health` | Infrastructure |

Push delivery can run through **Firebase** or **Tuya's own push**, selected by configuration. It is
currently on Firebase, which is why the Tuya-only "templates" screen is hidden in the admin.

---

## 8. What is NOT built

Read this before promising anything to the client.

| Thing | Reality |
|---|---|
| **Cleaning schedule / "run clean cycle"** | The screen exists and animates, but it is **interface only** — it sends nothing to the tub. The code says so explicitly |
| **Temperature or power scheduling** | Not implemented at all |
| **Forgot password** | There is no recovery path from the sign-in screen. Password change only works from *inside* the app, for an already signed-in user |
| **Adding an admin from the UI** | Requires a manual database insert |
| **Notification history in admin** | Sent messages are not listed anywhere in the dashboard |
| **Rooms / device permissions** | In the M2 brief; not in the app |
| **Brand fonts** | The font files exist in the repo but were never linked into either native project, so everything renders in the system font |

`CLAUDE.md` mentions a `replit_generate/` folder — an Expo prototype kept as a **design reference
only**. It is no longer present in the repository; if it reappears, do not ship from it.

---

## 9. Constraints that will bite you

These are not preferences. Violating them produces failures that look like unrelated bugs.

### Tuya data center must match

The Tuya **account** and the **cloud project** must live in the same data center. This project runs
in **Western Europe** (`openapi-weaz.tuyaeu.com`).

The data center an account lands in is decided by **the date the app key was created** — no country
code at sign-up can override it. When this was wrong, the admin's customer list came back **empty**
with no error at all. It cost real time to find.

### The Tuya account must own the Home

SDK linking only works if the account is the **Owner** of the Tuya home, not a member.

### The security SDK is bound to your app identity

Tuya issues a per-app security library, generated on their console for a specific:

- **iOS bundle identifier**, and
- **Android package name + signing certificate SHA-256**.

Change any of those and the SDK rejects the app at startup. If you rename the app, you must
regenerate the security library on the Tuya console and get new app keys. This has already broken
the project once.

### Wi-Fi is 2.4 GHz only

The tub cannot join 5 GHz. Android can detect the band and block the attempt; **iOS cannot read it
at all** and can only warn.

### iOS needs Apple's multicast entitlement for EZ pairing

Since iOS 14.5, sending the broadcast packets EZ pairing depends on requires
`com.apple.developer.networking.multicast`, which Apple must approve. It **has** been approved for
this app. If you create a new App ID, you must apply again — the entitlement is tied to a specific
App ID.

Also: iOS asks for **Local Network** permission exactly once, ever. A user who declines must
re-enable it in Settings by hand.

### Secrets stay server-side

Tuya app secret, Supabase service role key, FCM credentials and signing keys are **server or native
only**. Clients hold only public keys. Environment files are gitignored — the backend reads
Vercel's environment, not the repo, and **changing a variable there requires a redeploy**.

---

## 10. Running it locally

```bash
# Backend — http://localhost:3006
cd apps/backend && npm install && npm run start

# Admin — http://localhost:3000  (needs the backend running)
cd apps/admin && npm install && npm run dev

# Mobile
cd apps/mobile && npm install
npx react-native run-android      # or run-ios
```

Each app has its own `.env` (gitignored). Ask a teammate for the values; they are not derivable
from the repo.

### Checks before you commit

| App | Command |
|---|---|
| mobile | `npx tsc --noEmit` · `npx jest` (~311 tests) · `npx eslint .` |
| backend | `npx tsc --noEmit` · `npx jest` (~101 tests) |
| admin | `npx tsc --noEmit` · `npx eslint .` |

The admin has **no unit tests**; it is verified by typecheck, lint and manual/browser testing.

### iOS notes

`ios/` needs `pod install` after dependency changes, and a `secrets.xcconfig` holding the Tuya
iOS keys. The security library lives in `ios/ios_core_sdk/` and is downloaded from Tuya's console —
it is not on any package registry.

---

## 11. Where the project's state lives

| Location | Contains |
|---|---|
| `CLAUDE.md` | Project rules, stack decisions, hard constraints |
| `dev-workflow/INDEX.md` | **The single answer to "where is the project?"** — one row per feature with its phase and status |
| `dev-workflow/<feature>/` | Per-feature `plan.md`, `context.md` (decisions and findings) and `progress.md` (run log) |
| `docs/research/` | Deep notes on Tuya's SDK and cloud API, with citations. Read the relevant one **before** touching pairing, device control or push |
| `docs/audit/` | Code-quality reviews |

`docs/research/` is unusually valuable here. Tuya's documentation is thin and occasionally wrong;
these notes record what was verified against the real SDK and the real cloud, including places
where the official docs contradict observed behaviour.

### The other documents in `docs/`

| File | For |
|---|---|
| `project-overview.md` | This file — orientation |
| `admin-website.md` | Admin technical reference: architecture, APIs, triage |
| `admin-user-guide.md` | Admin manual for non-technical operators |
| `qa-testing-guide.md` | Full QA guide, including testing without a physical tub |

Planning artefacts under `dev-workflow/` are written in Vietnamese; code and the documents above
are in English.

---

## 12. Landmines already stepped on

Each of these cost hours. They are all still live conditions, not history.

| # | What happened | What to remember |
|---|---|---|
| 1 | The admin's customer list was **empty with no error** | Tuya data center mismatch. Always check the data center first when Tuya returns nothing |
| 2 | Renaming the app broke everything | The Tuya security library and the Google OAuth client are both bound to the bundle id / package name + signing fingerprint. Renaming means regenerating both |
| 3 | Users and Devices both went blank at once | The admin's device list internally walks the user list, so one Tuya permission failure takes down both screens. Do not debug them as separate problems |
| 4 | Admin pages showed a blank screen with a number | Next.js hides real errors in production. That number is a digest; the actual cause is only in the server log |
| 5 | Source files kept "disappearing" | A `.gitignore` rule of `**/lib/` — meant for a build directory — was swallowing two real source folders. Fixed, but a good reminder to check gitignore when a file mysteriously never survives |
| 6 | Builds failed with duplicate-class errors | iCloud syncs the repo folder and creates `filename 2.ext` copies of build output, which the Android toolchain then sees as duplicates. Keep the repo out of an iCloud-synced folder |
| 7 | Search in the admin threw HTTP 500 on every keystroke | Tuya's `username` parameter is an exact lookup that **errors** on a miss instead of returning an empty list. Search is now done client-side |
| 8 | Android permissions looked missing but were not | Tuya's AAR declares permissions that only appear in the **merged** manifest. Never conclude a permission is missing from the source manifest alone |

---

## Where to start reading

If you are joining as a developer, in this order:

1. `CLAUDE.md` — the rules
2. This file
3. `dev-workflow/INDEX.md` — what is in flight right now
4. The `docs/research/` note for whatever area you are about to touch
5. The code for that area

If you are joining to test, go straight to `docs/qa-testing-guide.md`.
