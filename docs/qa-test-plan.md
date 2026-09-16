# Walrus — QA Test Plan

Manual test cases for the Walrus ice bath product: the admin dashboard, the mobile app, and
control of a real tub. Written to be executed by hand, one row at a time, by someone who did not
build the software.

**Version:** 1.0 · **Last updated:** 2026-08-10

---

## How to use this document

Each case has a stable ID (`TC-<AREA>-<n>`). Quote that ID in bug reports and in the sign-off
sheet — never "the login one".

| Field | Meaning |
|---|---|
| **Pri** | **P1** blocks release · **P2** must fix before handover · **P3** cosmetic / nice to have |
| **Pre** | Must already be true before you start. If you cannot satisfy it, mark the case *Blocked*, not *Fail* |
| **Steps** | Do exactly these, in order |
| **Expect** | What must happen. Anything else is a Fail |

Record one of: **Pass** · **Fail** · **Blocked** · **N/A** (with a reason).

> ⚠️ Read [Known limitations](#known-limitations--do-not-log-these-as-bugs) **before** filing
> anything. Several surprising behaviours are deliberate and are already documented.

> 🔴 Cases marked **DESTRUCTIVE** change real data or reach real users. Do not run them against
> production unless that is explicitly the point of the session.

Mobile UI labels below are described by function (e.g. "the power toggle") rather than exact
wording, because wording may drift. If a label differs from this document but behaviour matches,
that is a Pass — raise a doc-update note, not a bug.

---

## 1. Environments

| Env | Admin web | Backend | Use for |
|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3006` | Feature testing, debugging |
| Production | `https://walrus-cb.vercel.app` | `https://walrus-backend.vercel.app` | Release verification |

Local requires both servers running: `npm run start` in `apps/backend`, `npm run dev` in
`apps/admin`.

### Devices needed

- One **iPhone** (iOS 15.1+) and one **Android** phone (Android 8+ / API 24+).
- One **real Walrus tub**, powered, resettable.
- A **2.4 GHz Wi-Fi** network you can join, and its password. A 5 GHz-only network will fail
  pairing by design — see `TC-PAIR-10`.

---

## 2. Test accounts and data

| What | Value |
|---|---|
| Admin dashboard | `admin@admin.com` / `admin123` |
| Second admin (do not revoke both) | `admin@walrus.app` |
| Mobile end-user | Register a fresh one per test round |

Do not reuse a real customer account for destructive cases.

---

## 3. Pre-flight — verify before any test round

Failing any of these invalidates whole suites, so check them first.

| ID | Pri | Check | Expect |
|---|---|---|---|
| **TC-PRE-01** | P1 | `GET {backend}/health` | 200 |
| **TC-PRE-02** | P1 | Log into admin, open **Tuya users** | Table renders, no "This page couldn't load" |
| **TC-PRE-03** | P1 | Open the mobile app, wait for the home screen | App does not crash on launch |
| **TC-PRE-04** | P2 | Admin → **Settings** → *Push provider* | Matches the provider you intend to test |

If **TC-PRE-02** fails, stop and check `TUYA_APP_SCHEMA` and the Tuya Cloud project's API
permissions — see [§10](#10-triage-guide).

---

## 4. ADM — Admin dashboard

### Authentication

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-01** | P1 | **Valid login.** Pre: none. Steps: open `/login`, enter admin email + password, Sign in. Expect: lands on `/users`, sidebar visible. |
| **TC-ADM-02** | P1 | **Wrong password rejected.** Steps: same, with a wrong password. Expect: stays on `/login`, message *"Incorrect email or password, or the account lacks admin access."* |
| **TC-ADM-03** | P1 | **Supabase account without allowlist is rejected.** Pre: a Supabase user NOT in `admin_users`. Steps: log in with it. Expect: rejected with the **same** message as TC-ADM-02 — it must not reveal that the account exists. |
| **TC-ADM-04** | P1 | **Deep link requires auth.** Pre: signed out. Steps: open `/users` directly. Expect: redirected to `/login`. |
| **TC-ADM-05** | P2 | **Sign out.** Steps: click Sign out. Expect: back to `/login`; pressing browser Back does not show the dashboard. |
| **TC-ADM-06** | P3 | **Session expiry.** Pre: session older than 8 h. Steps: reload any page. Expect: redirected to `/login`. |

### Tuya users

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-10** | P1 | **List renders.** Steps: open `/users`. Expect: one row per user, with columns User (avatar, display name, uid), Email, Devices, Status, Registered (date + time). |
| **TC-ADM-11** | P2 | **Status is derived, not fetched.** Steps: find a user with 0 devices and one with ≥1. Expect: `Inactive` and `Active` respectively; hovering the badge explains it is derived from paired devices. A brand-new account reading `Inactive` is **correct**, not a defect. |
| **TC-ADM-11b** | P2 | **Sort by registration.** Steps: click the *Registered* header twice. Expect: order flips newest-first ↔ oldest-first. |
| **TC-ADM-11c** | P1 | **Row opens detail.** Steps: click anywhere on a row. Expect: navigates to that user's detail page. There is deliberately **no Delete button in the list**. |
| **TC-ADM-12** | P2 | **Search by email.** Steps: type part of a visible user's email. Expect: table narrows to matching rows; footer switches to *"Showing X of Y on this page"*. |
| **TC-ADM-13** | P2 | **Search by uid and by username.** Expect: both match. |
| **TC-ADM-14** | P2 | **Search miss.** Steps: type `zzzzzz`. Expect: empty-state message, **no error page** and no HTTP 500. |
| **TC-ADM-15** | P3 | **Copy uid.** Steps: click the copy icon. Expect: icon becomes a tick ~1.5 s; clipboard holds the uid. |
| **TC-ADM-16** | P2 | **Rows per page.** Steps: set 20 / 50 / 100 via the footer dropdown. Expect: row count and the URL `?size=` both change. |
| **TC-ADM-17** | P2 | **Paging.** Pre: more users than one page. Steps: click ›, then ‹. Expect: content changes; ‹ disabled on page 1; › disabled on the last page. |
| **TC-ADM-18** | P2 | **Shareable URL.** Steps: copy the URL while on page 2 at size 50, open in a new tab. Expect: same page and page size. |
| **TC-ADM-19** | P1 | **User detail.** Steps: open a user. Expect three blocks — *Account Information* (uid, username, nickname, email, mobile, country, time zone, temperature unit, created, last profile update), *Summary* (total / online / offline devices, device mappings), *Tuya Info* (user source, temperature unit, time zone) — plus a Devices block. |
| **TC-ADM-19b** | P2 | **User source is derived.** Expect: a Google-registered account shows `Google`, an Apple one `Apple`, an email one `Email / phone`. Derived from the username prefix — Tuya has no such field. |
| **TC-ADM-19c** | P2 | **All devices of a user.** Pre: a user with ≥1 device. Steps: open the user, click *View all devices →*. Expect: table with Device Name, Device ID, Product, Status, Current Temp., Target Temp., Time Zone, Created At, Updated At; the three sortable headers reorder; search matches name / ID / product. |
| **TC-ADM-19d** | P3 | **Temperature unit follows the user.** Pre: a user whose app is set to °F. Expect: temperatures on the detail and all-devices screens render in °F, not °C. |
| **TC-ADM-20** | P1 🔴 | **DESTRUCTIVE — Delete user.** Pre: a throwaway account you own. Steps: open detail → *Delete user* → confirm. Expect: returns to `/users`; the user is gone after reload. **Never run against a real customer.** |

### Devices

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-30** | P1 | **Device list.** Steps: open `/devices`. Expect: a row per tub (Device, Owner, Status, Current, Target), or the empty state *"No devices found on any user account."* |
| **TC-ADM-31** | P1 | **Device detail.** Pre: at least one paired tub. Steps: open a device. Expect: live status and the control panel. |
| **TC-ADM-32** | P1 🔴 | **DESTRUCTIVE — Remote control.** Steps: change the target temperature from the panel. Expect: command accepted; within ~30 s the mobile app and the tub display show the same target. **This moves real hardware.** |
| **TC-ADM-33** | P2 | **Offline device.** Pre: tub powered off. Expect: status shows offline and controls are blocked or clearly disabled. |

### Admins

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-40** | P1 | **Allowlist renders.** Steps: open `/admins`. Expect: email + added-on per admin. |
| **TC-ADM-41** | P2 🔴 | **DESTRUCTIVE — Revoke.** Pre: a spare admin account, and you are signed in as a *different* admin. Steps: Revoke it. Expect: row disappears; that account can no longer log in; its Supabase account still exists. |
| **TC-ADM-42** | P2 | **Self-revoke hazard.** Steps: observe whether the UI prevents revoking the account you are signed in as. Expect: *currently it does not* — record the actual behaviour; see [Known limitations](#known-limitations--do-not-log-these-as-bugs) #5. |

### Notifications

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-50** | P2 | **Provider badge.** Steps: open `/notifications`. Expect: badge naming the active provider; matches Settings. |
| **TC-ADM-51** | P2 | **Required fields.** Steps: submit with Title empty. Expect: browser validation blocks submit. Repeat for Description. |
| **TC-ADM-52** | P2 | **Recipient modes.** Steps: toggle *Choose recipients* ↔ *Send to all*. Expect: the user picker shows/hides accordingly. |
| **TC-ADM-53** | P2 | **Recipient search.** Steps: search by email / username / Tuya ID. Expect: list narrows. |
| **TC-ADM-54** | P1 🔴 | **DESTRUCTIVE — Send to one device.** Pre: your own test phone registered. Steps: pick only that user, send. Expect: push arrives; see `TC-NOTIF-01`. **Never use *Send to all* on production.** |
| **TC-ADM-55** | P3 | **Deeplink.** Steps: send with *Device detail*, tap the notification. Expect: app opens on that screen — cross-check `TC-NOTIF-04`. |

### Settings & layout

| ID | Pri | Case |
|---|---|---|
| **TC-ADM-60** | P3 | **Settings.** Expect: signed-in email, push provider, admin access model. Read-only, no edit controls. |
| **TC-ADM-61** | P2 | **Sidebar stays pinned.** Steps: on a page long enough to scroll, scroll to the bottom. Expect: sidebar and Sign out stay in place. |
| **TC-ADM-62** | P3 | **Active item.** Steps: visit each nav entry. Expect: exactly one item highlighted, matching the page. |

---

## 5. AUTH — Mobile sign-up and sign-in

| ID | Pri | Case |
|---|---|---|
| **TC-AUTH-01** | P1 | **Register with email.** Steps: sign up with a fresh address, request the code, enter it, set a password. Expect: account created, lands in the app. |
| **TC-AUTH-02** | P1 | **Verification code is enforced.** Steps: enter a wrong code. Expect: clear error, no account created. |
| **TC-AUTH-03** | P1 | **Login with email + password.** Expect: success. |
| **TC-AUTH-04** | P2 | **Wrong password.** Expect: readable error, not a raw SDK code. |
| **TC-AUTH-05** | P2 | **Password reset.** Steps: request reset, use the emailed code, set a new password, log in with it. Expect: success; old password rejected. |
| **TC-AUTH-06** | P1 | **Google sign-in — Android.** Expect: account picker appears, sign-in completes. See Known limitation #1 before failing this. |
| **TC-AUTH-07** | P1 | **Google sign-in — iOS.** Expect: as above. |
| **TC-AUTH-08** | P2 | **Apple sign-in — iOS.** Expect: Apple sheet appears, sign-in completes. |
| **TC-AUTH-09** | P2 | **Cancelling social sign-in.** Steps: open the Google/Apple sheet and dismiss it. Expect: returns quietly to the auth screen — **no error alert**. |
| **TC-AUTH-10** | P2 | **Logout.** Expect: returns to the auth screen; relaunching the app does not restore the session. |
| **TC-AUTH-11** | P2 | **Session persists across restart.** Steps: log in, force-quit, reopen. Expect: still logged in. |
| **TC-AUTH-12** | P3 🔴 | **DESTRUCTIVE — Delete account.** Steps: use account cancellation in the app. Expect: account removed; it no longer appears in admin → Tuya users. |

---

## 6. PAIR — Pairing a tub

The single most failure-prone area. Run the whole suite on **both** platforms.

| ID | Pri | Case |
|---|---|---|
| **TC-PAIR-01** | P1 | **Default mode is EZ.** Steps: open pairing. Expect: mode selector defaults to **Wi-Fi (EZ)** on iOS *and* Android. |
| **TC-PAIR-02** | P1 | **Wi-Fi name is pre-filled.** Pre: phone on a 2.4 GHz network. Expect: the network name is filled in automatically. On iOS this is typed, not a dropdown — that is correct. |
| **TC-PAIR-03** | P1 | **iOS grants Local Network.** Pre: app freshly installed on iOS. Steps: start pairing. Expect: iOS asks for Local Network permission → **Allow**. iOS asks only once ever. |
| **TC-PAIR-04** | P1 | **EZ pairing succeeds — iOS.** Pre: tub reset until its indicator blinks **quickly**. Steps: enter Wi-Fi password, Start searching, stay near the tub. Expect: tub appears on the radar within ~2 min; tapping it completes pairing. |
| **TC-PAIR-05** | P1 | **EZ pairing succeeds — Android.** Expect: as above; the Wi-Fi field is a scanned dropdown here. |
| **TC-PAIR-06** | P1 | **AP mode.** Pre: tub reset until its indicator blinks **slowly**. Steps: switch to *Wi-Fi hotspot (AP)*, check the pre-filled **home router** Wi-Fi (not the tub's own hotspot) and enter its password, follow the on-screen steps to join the `SmartLife…` hotspot, return, Start searching. Expect: the `SmartLife…` hotspot disappears once the tub has the credentials; the phone is back on the home Wi-Fi (automatically, or rejoined by hand) and pairing completes. |
| **TC-PAIR-07** | P2 | **AP pre-fills and rejects the hotspot name.** Steps: switch EZ → AP. Expect: the Wi-Fi field **keeps** the home network (pre-filled from the phone's current Wi-Fi), and a warning says to enter the home network, not the device hotspot. Then type `SmartLife-BEEC` and Start searching. Expect: blocked with a message naming the Walrus hotspot. |
| **TC-PAIR-08** | P2 | **Bluetooth mode.** Pre: Bluetooth + Location on. Steps: choose Bluetooth. Expect: no Wi-Fi fields; tub appears on the radar; tapping it pairs. |
| **TC-PAIR-09** | P2 | **Mode switch clears fields.** Steps: type a password in EZ, switch to AP, switch back. Expect: fields cleared on each switch — stale values must not carry over. |
| **TC-PAIR-10** | P2 | **5 GHz is refused (Android).** Pre: phone on 5 GHz. Steps: try EZ. Expect: blocked before searching, with a message naming the band. On iOS this is only a warning — the band cannot be read there. |
| **TC-PAIR-11** | P2 | **Empty Wi-Fi name blocked.** Steps: clear the network field, Start searching. Expect: blocked with a prompt to enter it. |
| **TC-PAIR-12** | P2 | **Timeout is graceful.** Pre: tub NOT in pairing mode. Steps: start EZ and wait out the scan. Expect: a countdown runs, then a message naming what to check. No crash, no infinite spinner. |
| **TC-PAIR-13** | P3 | **Paired tub appears everywhere.** Steps: after pairing, check the app device list **and** admin → Devices. Expect: present in both; the owner is correct. |

---

## 7. CTRL — Device control

Pre for the whole suite: one paired tub, powered and online.

| ID | Pri | Case |
|---|---|---|
| **TC-CTRL-01** | P1 | **Dashboard shows live values.** Expect: current temperature and target reflect the tub. |
| **TC-CTRL-02** | P1 | **Power toggle.** Steps: toggle power. Expect: the tub reacts; the app state matches within ~10 s. |
| **TC-CTRL-03** | P1 | **Target temperature.** Steps: raise then lower the target. Expect: the tub's own display shows the same value. |
| **TC-CTRL-04** | P2 | **Target limits.** Steps: push the target past its maximum and minimum. Expect: clamped at the device's real limits — no out-of-range value is sent. |
| **TC-CTRL-05** | P2 | **Light toggle.** Expect: the tub's light responds. |
| **TC-CTRL-06** | P2 | **Disinfection toggle.** Expect: the tub responds. |
| **TC-CTRL-07** | P1 | **Only supported controls are shown.** Expect: the dashboard shows exactly the functions this tub reports. The current model has **no separate freeze control** — its absence is correct, not a bug. |
| **TC-CTRL-08** | P1 | **Offline handling.** Steps: power the tub off, wait, watch the app. Expect: it goes offline and controls stop pretending to work. |
| **TC-CTRL-09** | P2 | **Recovery.** Steps: power the tub back on. Expect: the app returns to online without a restart. |
| **TC-CTRL-10** | P2 | **Failed command reverts.** Steps: toggle something as the tub goes offline. Expect: the toggle snaps back — it must not stay in a state the tub never reached. |
| **TC-CTRL-11** | P2 | **Cross-client sync.** Steps: change the target from admin (`TC-ADM-32`). Expect: the app reflects it without a manual refresh. |
| **TC-CTRL-12** | P3 | **Temperature unit.** Steps: switch °C ↔ °F in profile. Expect: displayed values convert; the tub is unchanged. |

---

## 8. NOTIF — Push notifications

| ID | Pri | Case |
|---|---|---|
| **TC-NOTIF-01** | P1 | **Background delivery.** Pre: app installed, permission granted, app backgrounded. Steps: send from admin (`TC-ADM-54`). Expect: a system notification with the title and body sent. |
| **TC-NOTIF-02** | P2 | **Foreground delivery.** Steps: send with the app open. Expect: an in-app banner. |
| **TC-NOTIF-03** | P2 | **Permission prompt.** Pre: fresh install on Android 13+ / iOS. Expect: the app requests notification permission. |
| **TC-NOTIF-04** | P2 | **Tap routing.** Steps: send with a deeplink, tap the notification. Expect: the app opens the targeted screen — from background *and* from fully closed. |
| **TC-NOTIF-05** | P3 | **Unread badge.** Expect: the account/notifications badge increases, and clears once read. |
| **TC-NOTIF-06** | P3 | **History.** Steps: open the notifications screen. Expect: past messages listed. |

---

## 9. ACC — Profile, home, secondary screens

| ID | Pri | Case |
|---|---|---|
| **TC-ACC-01** | P2 | **Edit nickname.** Expect: saved; visible in admin → user detail after refresh. |
| **TC-ACC-02** | P2 | **Change time zone.** Expect: saved and persists across app restart. |
| **TC-ACC-03** | P2 | **Change password.** Expect: succeeds; new password works, old one does not. |
| **TC-ACC-04** | P2 | **Home management.** Steps: create a home, rename it. Expect: changes persist. |
| **TC-ACC-05** | P3 | **Filter reminder.** Expect: shows days until the next change; marking it replaced resets the countdown. |
| **TC-ACC-06** | P3 | **Tracking / progress.** Expect: level and points update after a session. |
| **TC-ACC-07** | P3 | **Shop and Help.** Expect: open without crashing; links work. |
| **TC-ACC-08** | P3 | **Fonts.** Expect: brand typography. See Known limitation #6 — currently the system font is used on both platforms. |

---

## 10. Triage guide

Before filing, spend two minutes here — it usually names the cause.

**Admin shows "This page couldn't load" / `ERROR <number>`**

Next.js hides the real message in production. This almost always means the **backend** failed,
not the UI. Call the backend directly:

```bash
TOKEN=$(curl -s -X POST "$API/admin/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@admin.com","password":"admin123"}' | jq -r .access_token)
curl -s "$API/users?page_no=1&page_size=20" -H "Authorization: Bearer $TOKEN"
```

A 500 means the backend log holds the real reason, printed as
`Tuya API lỗi [GET …]: code=… msg=…`.

| Tuya code | Meaning | Usual cause |
|---|---|---|
| `1106` | permission deny | Wrong `TUYA_APP_SCHEMA`, or the Cloud project's API authorisation expired |
| `2006` | user not exist | An exact-match username lookup missed — normal, not a fault |

**Mobile app crashes on launch** — most often the Tuya security SDK rejecting the app identity.
It is generated per app and bound to the iOS **bundle ID** / Android **package name + signing
SHA-256**. If either changed, the SDK must be regenerated on the Tuya console.

**Attach to every bug report:** platform + OS version, build number, account used, the test case
ID, steps, expected vs actual, and — for mobile — `adb logcat` output or the iOS device log.

---

## Known limitations — do NOT log these as bugs

| # | Behaviour | Why |
|---|---|---|
| 1 | Google sign-in on Android fails with `DEVELOPER_ERROR` | The Android OAuth client needs the current package name **and** the signing SHA-1. Debug and release builds have different SHA-1s. Verify the console entry before failing `TC-AUTH-06` |
| 2 | Admin search only filters the page you are on | Tuya's user API matches usernames exactly and cannot search email or uid. Raise rows-per-page to widen the net |
| 3 | The `Status` column and `User source` row are **derived**, not fetched | Tuya exposes no account status; source is read off the username prefix. A new account with no device shows `Inactive` — that is correct |
| 4 | Admin cannot add a new admin | By design — create the Supabase user and insert into `admin_users` |
| 5 | Nothing stops you revoking your own admin access | Known gap. Revoking every admin locks everyone out permanently |
| 6 | Brand fonts fall back to the system font | The `.otf` files were never linked into either native project |
| 7 | Admin dashboard is unusable on a phone | Desktop-only layout; the sidebar does not collapse |
| 8 | Notification recipient picker lists at most 100 users | Use *Send to all* beyond that |
| 9 | Templates missing from the admin menu | Tuya-only feature, hidden while the provider is FCM |
| 10 | "No devices found" on admin → Devices | Correct when no tub is paired to any account |

---

## Sign-off

| Suite | Cases | Pass | Fail | Blocked | Tester | Date |
|---|---|---|---|---|---|---|
| PRE — Pre-flight | 4 | | | | | |
| ADM — Admin dashboard | 38 | | | | | |
| AUTH — Mobile auth | 12 | | | | | |
| PAIR — Pairing | 13 | | | | | |
| CTRL — Device control | 12 | | | | | |
| NOTIF — Notifications | 6 | | | | | |
| ACC — Profile & secondary | 8 | | | | | |

**Release criteria:** every **P1** passes, and no **P2** fails without a written waiver.

| | Name | Date | Signature |
|---|---|---|---|
| Tested by | | | |
| Approved by | | | |
