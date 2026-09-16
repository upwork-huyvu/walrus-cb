# Walrus — QA Testing Guide

Everything a tester needs to verify the Walrus product without prior knowledge of it: what to
test, how to test it, and what result to expect.

**Version:** 1.0 · **Prepared:** 2026-08-13

> This guide was written by reading the actual codebase. It describes **only what is implemented
> today**. Where a screen exists but is not connected to real hardware, that is stated explicitly
> rather than glossed over.

---

## Contents

1. [Project Overview](#1-project-overview)
2. [Test Environment & Access](#2-test-environment--access)
3. [Testing Without a Physical Device](#3-testing-without-a-physical-device)
4. [Device-Dependent Testing](#4-device-dependent-testing)
5. [Remote Device Testing Procedure](#5-remote-device-testing-procedure)
6. [Detailed Test Scenarios](#6-detailed-test-scenarios)
7. [Admin Panel Testing](#7-admin-panel-testing)
8. [Mobile Compatibility](#8-mobile-compatibility)
9. [Bug Reporting Format](#9-bug-reporting-format)
10. [QA Sign-Off Checklist](#10-qa-sign-off-checklist)
11. [Known Limitations — do not report these as bugs](#11-known-limitations--do-not-report-these-as-bugs)

---

## 1. Project Overview

**Walrus** is a connected ice bath (cold plunge tub). The product has three parts:

| Part | What it does |
|---|---|
| **Mobile app** (iOS + Android) | The customer's remote control: sign up, pair a tub over Wi-Fi or Bluetooth, set the target temperature, switch power / light / disinfection, run a timed cold-plunge session, track their streak, and receive push notifications |
| **Admin dashboard** (web) | Internal staff tool: browse the customers who registered in the app, inspect one customer and their tubs, control a tub remotely, manage who has admin access, and push notifications to customers |
| **The tub itself** | A Tuya-based IoT appliance. It reports water temperature and accepts commands over Tuya's cloud and local protocols |

### User types

| Type | Where | How they get in |
|---|---|---|
| **Customer / end user** | Mobile app | Registers themselves with email, Google or Apple |
| **Administrator** | Admin dashboard | Created by a developer; needs both an auth account **and** an entry on an allowlist |

There is no in-app role system beyond this — every customer sees the same features, and every
administrator has the same powers.

### High-level flow

```
Customer's phone ─── Tuya SDK ────────────► Tuya Cloud ────► The tub
      │                                          ▲
      └── app backend (sessions, reminders,      │
          notification history)                  │
                                                 │
Admin browser ──► Next.js server ──► NestJS backend
```

Two things follow from this diagram and both matter when triaging bugs:

- The **mobile app talks to Tuya directly** through an embedded SDK. It does not go through our
  backend for pairing or device control.
- The **admin dashboard never talks to Tuya directly**. Everything goes through our backend, which
  calls Tuya's cloud API. So the same tub is reachable by two different routes, and one can fail
  while the other works.

---

## 2. Test Environment & Access

### Builds

| Platform | How to get it |
|---|---|
| **Android** | `<PLACEHOLDER — APK download link or Firebase App Distribution invite>` |
| **iOS** | `<PLACEHOLDER — TestFlight invitation link>` |

> **Ask the development team for a build with `MOCK_DEVICES=true`.** See
> [section 3.1](#31-the-simulated-tub--your-most-important-tool) — this is what lets you test the
> device screens without hardware. Confirm which mode your build is in before you start; the two
> behave differently and mixing them up will waste a day.

### Admin dashboard

| | |
|---|---|
| URL | `<PLACEHOLDER — e.g. https://<project>.vercel.app>` |
| Email | `<PLACEHOLDER>` |
| Password | `<PLACEHOLDER>` |

Ask for **two** admin accounts. Some tests revoke admin access, and with a single account you can
lock yourself out permanently.

### Test accounts you will need

| Account | Purpose |
|---|---|
| A fresh email you control | Registration and email-code tests. Use a new one per round — an address can only register once |
| A Google account | Google sign-in |
| An Apple ID | Apple sign-in (iOS only) |
| An account that already owns a paired tub | Device screens with real data. Coordinate with the device holder |

Never run destructive tests against a real customer's account.

### Permissions the app will request

| Permission | Platform | When | Why it matters |
|---|---|---|---|
| **Location** | Both | Pairing | Required to read the Wi-Fi name and to scan for Bluetooth. Denying it breaks pairing |
| **Local Network** | iOS | First pairing attempt | Required for Wi-Fi pairing (EZ **and** AP). **iOS asks only once ever** — if you tap Deny, you must re-enable it in Settings by hand |
| **Bluetooth** | Both | Bluetooth pairing | |
| **Notifications** | Both | After sign-in | Needed for push tests |

Test both the "allow" and the "deny" path for each of these.

### Network requirements

- A **2.4 GHz Wi-Fi** network and its password. The tub **cannot join 5 GHz** — this is a hardware
  limit, not a bug.
- If your router broadcasts one name for both bands, ask the network owner to split them or provide
  a 2.4 GHz-only guest network for testing.
- For pairing, the phone and the tub must be on the same network and physically close together.

### External services involved

Failures in any of these look like app bugs but are not:

| Service | Used for |
|---|---|
| **Tuya Cloud** | All account, pairing and device operations |
| **Firebase (FCM)** | Push notification delivery |
| **Google Sign-In** | Google login |
| **Apple Sign-In** | Apple login (iOS) |
| **Supabase** | Admin authentication and some app-side data |

---

## 3. Testing Without a Physical Device

Most of the product can be tested with no tub in the room. This section is the bulk of your work.

### 3.1 The simulated tub — your most important tool

The app has a built-in simulator. In a build where it is switched on, one or more **fake tubs
appear in the device list** alongside any real ones. A fake tub:

- has its own temperature that **drifts over time** — it cools toward the target when running and
  warms toward room temperature when off;
- responds to the **power, light and disinfection** toggles;
- accepts a **target temperature** and reflects it back;
- pushes state changes to the UI the same way a real tub does.

This means you can fully test the dashboard, the controls, the temperature gauge, the session
timer and the tracking screens **without hardware**.

**What the simulator cannot do:** it does not test real pairing, real radio behaviour, real
offline transitions, or anything about the physical appliance. Those are in
[section 4](#4-device-dependent-testing).

> ⚠️ Always state in your bug reports **whether the tub was simulated or real**. A defect that only
> appears on the simulator is usually not a customer-facing defect.

### 3.2 What you can test with no device at all

| Area | Testable without a tub? | Notes |
|---|---|---|
| Splash, intro, onboarding questions | ✅ Fully | |
| Registration by email + verification code | ✅ Fully | |
| Login by email and password | ✅ Fully | |
| Google sign-in | ✅ Fully | |
| Apple sign-in | ✅ Fully | iOS only |
| Session persistence, sign out, delete account | ✅ Fully | |
| Home creation and home management | ✅ Fully | A "home" is a Tuya grouping; no tub needed to create one |
| Profile: display name, temperature unit, time zone, dark mode | ✅ Fully | |
| Change password | ✅ Fully | |
| Navigation, tab bar, back behaviour | ✅ Fully | |
| Device list, dashboard, controls, temperature gauge | ✅ **With the simulator** | |
| Cold-plunge session timer and completion | ✅ Fully | Timer is app-side |
| Tracking / streak / points | ✅ Fully | Stored on the phone |
| Filter reminder | ✅ Fully | |
| Shop and Help screens | ✅ Fully | Informational screens |
| Push notifications | ✅ Fully | Sent from the admin panel |
| Notification history and unread badge | ✅ Fully | |
| Pairing **screens, validation, error paths** | ✅ Partially | You can test every field, warning and timeout. You cannot complete a pairing |
| Whole admin dashboard | ✅ Fully | Except controlling a real tub |

### 3.3 Detailed no-device scenarios

Full step-by-step cases are in the table in [section 6](#6-detailed-test-scenarios). Below are the
areas that need extra explanation.

#### Registration and the email code

**Preconditions:** an email address that has never registered.

**Steps:** open the app → *Continue with email* → enter the address → request the code → read the
code from the inbox → enter it → set a password → submit.

**Expected:** the account is created and you land inside the app.

**Edge cases to cover:** wrong code · expired code (wait, then submit) · requesting a second code ·
an address that is already registered · a password that is too short · an invalid email format ·
pressing submit twice quickly.

#### Sign-in with Google and Apple

**Expected:** the provider's own sheet appears, and after choosing an account you land inside the
app as a signed-in user.

**Important:** cancelling the provider sheet must return you quietly to the sign-in screen with
**no error alert**. An error popup after a deliberate cancel is a bug.

> Google sign-in on Android may currently fail with a developer configuration error. Check
> [section 11](#11-known-limitations--do-not-report-these-as-bugs) before filing it.

#### Password reset — read this before testing

The app has **no "Forgot password" link on the sign-in screen**. Changing a password is only
possible **from inside the app**, under Profile → Change password, which requires you to already
be signed in.

Test that flow (it sends a code to your email, then signs you out so you can sign in again with the
new password). Also note it as a product gap: a customer who forgets their password has no path to
recovery in the app.

#### Pairing screens without a tub

You can meaningfully test everything up to the point where a tub would have to answer:

- The mode selector offers **Wi-Fi (EZ)**, **Wi-Fi hotspot (AP)** and **Bluetooth**, and opens on
  **Wi-Fi (EZ)** on both platforms.
- On both EZ and AP the Wi-Fi name is **filled in from the network the phone is on** — on iOS only
  once Location is allowed. If it cannot be read, the field stays empty, a reason appears under it,
  and iOS shows a **Use the network I'm connected to** button (plus **Open Settings** after a Deny).
- On AP a warning tells you to enter your home router's network — not the tub's own hotspot.
- Switching EZ ↔ AP **keeps** whatever you typed (same router credentials). The field is cleared only
  if it holds the tub's own `SmartLife…` hotspot name.
- Starting a search with an empty network name is blocked, and so is a network name that looks like
  the tub's hotspot (`SmartLife-XXXX` / `SL-…-XXXX`) — in either mode.
- On Android, being on a 5 GHz network **blocks** EZ with a message naming the band. On iOS it can
  only warn, because iOS does not expose the band.
- With no tub in pairing mode, the search runs a visible countdown and then ends with a message
  telling you what to check — **it must not spin forever or crash**.

---

## 4. Device-Dependent Testing

> 🔧 Everything in this section is **PHYSICAL DEVICE REQUIRED**.

These need a real tub because they depend on radio behaviour, real hardware state, or physical
confirmation that something happened in the room.

### 4.1 Pairing — PHYSICAL DEVICE REQUIRED

| Mode | What the tub must be doing | Notes |
|---|---|---|
| **Wi-Fi (EZ)** | Reset until its indicator blinks **quickly** | Phone must be on the 2.4 GHz network |
| **Wi-Fi hotspot (AP)** | Reset until its indicator blinks **slowly** | The phone must join the tub's own `SmartLife…` hotspot partway through, then come back to the app. The hotspot disappears as soon as the tub has the Wi-Fi details — the phone should rejoin the home Wi-Fi by itself; rejoin it by hand if it does not |
| **Bluetooth** | In pairing mode | Bluetooth and Location on |

**In the app:** choose the mode, enter the Wi-Fi details, start searching, wait for the tub to
appear on the radar view, tap it.

**The device holder must confirm:** the indicator was in the right blink pattern before starting,
and that it changes to a steady/connected state after pairing.

**Expected:** the tub appears in the app's device list, and also appears in the admin dashboard
under Devices with the correct owner.

### 4.2 Device state and controls — PHYSICAL DEVICE REQUIRED for real confirmation

The app exposes exactly these controls, and only the ones the tub actually reports:

| Control | What it does |
|---|---|
| **Power** | Switches the tub (its chiller) on and off |
| **Light** | Switches the tub's light |
| **Disinfection** | Switches the tub's sanitising function |
| **Target temperature** | Sets the temperature the tub should reach, using +/− steps |

> The current tub model has **no separate "freeze"/cooling toggle** — power is the chiller on/off.
> Its absence from the UI is correct behaviour, not a missing feature.

The app only shows the controls the connected tub declares. If a different model exposes fewer
functions, fewer buttons appear.

**Coordination for each control:**

| QA does in the app | Device holder confirms in the room |
|---|---|
| Toggle power | The tub audibly starts/stops; its own display changes |
| Toggle light | The light physically turns on/off |
| Toggle disinfection | The tub's own indicator for that function changes |
| Raise/lower the target | The tub's own display shows the same target value |

**Expected in all cases:** the app's state matches the tub within roughly 10 seconds, without
needing a manual refresh.

### 4.3 Offline and recovery — PHYSICAL DEVICE REQUIRED

| Step | Expected |
|---|---|
| Device holder powers the tub off | The app shows it as offline and stops offering working controls |
| QA tries a control while it is offline | The action is refused or clearly disabled — the UI must **not** show a state the tub never reached |
| Device holder powers it back on | The app returns to online **without** restarting the app |

### 4.4 Cross-client synchronisation — PHYSICAL DEVICE REQUIRED

Change the target temperature from the **admin dashboard**, then watch the **mobile app** for the
same tub. Both are talking to the same appliance by different routes, so this catches a whole class
of integration bugs.

**Expected:** the app reflects the admin's change, and the tub's own display agrees with both.

### 4.5 What is NOT a device feature yet

The app has a **Cleaning** panel with a schedule and a "run clean cycle now" action, and a
**Filter reminder** card.

> ⚠️ **The cleaning panel and its schedule are not connected to the tub.** They are interface only:
> the countdown and the cycle run entirely inside the app and send nothing to the appliance. Test
> them as UI — that the schedule saves, the countdown displays, the confirmation steps work — but
> **do not expect the tub to do anything**, and do not file "cleaning did not start on the device"
> as a defect.

The **filter reminder** is a real feature but it tracks a date; it also does not command the tub.

There is **no scheduling of temperature or power** in the product today.

---

## 5. Remote Device Testing Procedure

When you do not hold the tub, every device-dependent case becomes a two-person test. Use this
procedure so results are trustworthy and reproducible.

### Roles

- **QA** — drives the app and the admin panel, records evidence, decides pass/fail.
- **Device holder** — is in the room with the tub, confirms physical behaviour, records evidence.

Agree a shared channel with instant messaging and, ideally, a live video call for timing-sensitive
cases.

### The loop

```
1. QA states the case out loud:      "TC-CTRL-03, setting target from 8 to 5"
2. Device holder reports the BEFORE: tub display + indicator state, with a photo
3. QA performs the action in the app and notes the exact time
4. QA reports:                        "sent at 14:32:10"
5. Device holder confirms the AFTER: what changed, when, with photo or video
6. QA checks the app UI updated and matches
7. QA records the result and attaches both sides' evidence
```

Run **one case at a time**. Batching several actions makes it impossible to tell which command
caused which physical change.

### Evidence to collect

| From | What |
|---|---|
| **QA** | Screenshot of the app before and after · screen recording for anything animated (pairing radar, temperature changing) · exact timestamp of the action · the app's error message verbatim if it fails |
| **Device holder** | Photo of the tub's display before and after · **video** for anything with timing (pairing sequence, indicator blink patterns, chiller starting) · description of any sound or physical change |
| **Both** | Time-of-day on every artefact so the two sides can be lined up |

For pairing specifically, the device holder should **film the indicator light** from before the
reset until the app reports a result. Blink speed is the single most common cause of a failed
pairing, and it cannot be verified after the fact.

### When something fails

Capture, in this order:

1. The exact error text shown in the app.
2. A screen recording of the reproduction.
3. What the tub was doing at that moment (online/offline, indicator state).
4. Whether the same action works from the **admin dashboard** — this tells the developers whether
   the problem is in the app or further down in the cloud.

### Practical notes

- Time zones: agree one clock. The app displays times in a fixed zone which may not be yours.
- The device holder does **not** need the app installed, but it helps if they do — it lets them
  confirm whether an issue is specific to your phone.
- If the device holder is unavailable, park the case as **Blocked**, never as Failed.

---

## 6. Detailed Test Scenarios

**Priority:** P1 blocks release · P2 must be fixed before handover · P3 cosmetic.
**Device:** `No` = testable alone · `Sim` = needs a simulator build · `Yes` = **PHYSICAL DEVICE REQUIRED**.

### Authentication & Registration

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| AUTH-01 | Registration | Register with email | Unused email | Continue with email → enter email → request code → enter code from inbox → set password → submit | Account created, lands in app | No | P1 | |
| AUTH-02 | Registration | Wrong verification code | Code requested | Enter an incorrect code | Clear error; no account created | No | P1 | |
| AUTH-03 | Registration | Resend code | Code requested | Request a second code, use the newest | Newest code works | No | P2 | |
| AUTH-04 | Registration | Email already registered | Email used before | Try to register it again | Clear message that it exists | No | P2 | |
| AUTH-05 | Registration | Weak / short password | On password step | Enter a very short password | Rejected with a readable reason | No | P2 | |
| AUTH-06 | Registration | Malformed email | On email step | Enter `abc@`, `abc`, empty | Rejected before any code is sent | No | P2 | |
| AUTH-07 | Login | Correct email + password | Registered account | Sign in | Enters the app | No | P1 | |
| AUTH-08 | Login | Wrong password | Registered account | Enter a wrong password | Readable error, not a raw error code | No | P1 | |
| AUTH-09 | Login | Unknown email | — | Sign in with an unregistered address | Readable error | No | P2 | |
| AUTH-10 | Google | Sign in with Google | Google account on device | Tap Sign in with Google → pick account | Enters the app | No | P1 | |
| AUTH-11 | Google | Cancel the Google sheet | — | Open the sheet, dismiss it | Returns quietly, **no error alert** | No | P2 | |
| AUTH-12 | Apple | Sign in with Apple | iOS, Apple ID | Tap Sign in with Apple → confirm | Enters the app | No | P1 | |
| AUTH-13 | Apple | Cancel the Apple sheet | iOS | Dismiss the sheet | Returns quietly, no error alert | No | P2 | |
| AUTH-14 | Session | Survives restart | Signed in | Force-quit the app, reopen | Still signed in | No | P1 | |
| AUTH-15 | Session | Sign out | Signed in | Profile → sign out | Returns to sign-in; reopening does not restore the session | No | P2 | |
| AUTH-16 | Password | Change password | Signed in | Profile → Change password → request code → enter code + new password | Succeeds; app signs you out; new password works, old one does not | No | P1 | |
| AUTH-17 | Password | No recovery when locked out | Signed out | Look for a "Forgot password" option on the sign-in screen | **None exists** — record as a product gap, not a crash | No | P2 | |
| AUTH-18 | Account | Delete account | A throwaway account | Profile → delete/cancel account → confirm | Account removed; it disappears from the admin user list | No | P2 | |
| AUTH-19 | Network | Sign in with no connectivity | Airplane mode | Attempt to sign in | Readable network error; no crash, no infinite spinner | No | P1 | |
| AUTH-20 | Loading | Double submit | On sign-in | Tap the button twice rapidly | Only one attempt; button disables while working | No | P2 | |

### Onboarding & Navigation

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| NAV-01 | Onboarding | First-run flow | Fresh install | Launch and walk the intro and onboarding questions through to the end | Every step advances; progress indicator matches | No | P2 | |
| NAV-02 | Onboarding | Back through the flow | Mid-onboarding | Go back a step | Previous answers are retained | No | P3 | |
| NAV-03 | Onboarding | Not shown twice | Completed once | Restart the app | Onboarding does not reappear | No | P2 | |
| NAV-04 | Home | Home is required | New account, no home | Proceed past sign-in | Prompted to create a home; creating one succeeds | No | P1 | |
| NAV-05 | Navigation | Bottom tabs | Signed in | Visit Device, Tracking, Shop, Help, Account | Each opens; the active tab is highlighted | No | P1 | |
| NAV-06 | Navigation | Back behaviour | On a sub-screen | Use the back control / Android back button | Returns one level; does not exit the app unexpectedly | No | P2 | |

### Profile & Account

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| PRO-01 | Profile | Change display name | Signed in | Profile → edit display name → save | Saved; visible after restart and in the admin user detail | No | P2 | |
| PRO-02 | Profile | Temperature unit | Signed in | Switch °C ↔ °F | Temperatures redisplay in the new unit across the app | Sim | P2 | |
| PRO-03 | Profile | Time zone | Signed in | Change time zone → save | Persists across restart | No | P2 | |
| PRO-04 | Profile | Dark mode | Signed in | Toggle the theme | Applies immediately and survives restart | No | P3 | |
| PRO-05 | Home | Home management | Signed in | Open home management; create and rename a home | Changes persist | No | P2 | |

### Device Pairing

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| PAIR-01 | Pairing | Default mode | Signed in | Open pairing | Opens on **Wi-Fi (EZ)** on both platforms | No | P1 | |
| PAIR-02 | Pairing | Wi-Fi pre-filled | Phone on 2.4 GHz | Open pairing in EZ | The network name is filled in automatically | No | P2 | |
| PAIR-03 | Pairing | AP clears the field | In EZ with a password typed | Switch to AP | Field cleared; warning to use the home router's network | No | P2 | |
| PAIR-04 | Pairing | Mode switch clears input | Any | EZ → AP → EZ | Fields cleared each time | No | P2 | |
| PAIR-05 | Pairing | Empty network blocked | In EZ | Clear the network name, start searching | Blocked with a prompt | No | P2 | |
| PAIR-06 | Pairing | 5 GHz refused | Android on 5 GHz | Start EZ | Blocked, message names the band | No | P2 | |
| PAIR-07 | Pairing | Timeout is graceful | No tub in pairing mode | Start EZ and wait it out | Countdown runs, then a message listing what to check. No crash, no endless spinner | No | P1 | |
| PAIR-08 | Pairing | iOS Local Network prompt | Fresh iOS install | Start pairing | iOS asks for Local Network permission; tap Allow | No | P1 | |
| PAIR-09 | Pairing | Location denied | Fresh install | Deny Location, attempt to pair | A clear explanation, not a silent failure | No | P2 | |
| PAIR-10 | Pairing | **EZ pairing succeeds — iOS** | Tub blinking **fast** | Enter Wi-Fi password, start searching, stay near the tub, tap it on the radar | Pairs within ~2 min; appears in the device list | **Yes** | P1 | |
| PAIR-11 | Pairing | **EZ pairing succeeds — Android** | Tub blinking **fast** | As above | Pairs successfully | **Yes** | P1 | |
| PAIR-12 | Pairing | **AP pairing** | Tub blinking **slow** | Switch to AP, check the pre-filled home Wi-Fi + password, join the `SmartLife…` hotspot, return, start searching | The `SmartLife…` hotspot disappears once the tub has the credentials; the phone is back on the home Wi-Fi (automatically, or rejoined by hand) and pairing completes | **Yes** | P1 | |
| PAIR-13 | Pairing | **Bluetooth pairing** | Tub in pairing mode, BT + Location on | Choose Bluetooth, start searching, tap the tub | Pairs without asking for Wi-Fi details | **Yes** | P2 | |
| PAIR-14 | Pairing | **Paired tub is visible everywhere** | Just paired | Check the app device list and the admin Devices page | Present in both, owner correct | **Yes** | P2 | |

### Device Control

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| CTRL-01 | Dashboard | Live values shown | A tub in the list | Open its dashboard | Current and target temperature displayed | Sim | P1 | |
| CTRL-02 | Control | Only supported controls appear | A tub | Inspect the control row | Shows exactly power / light / disinfection. **No freeze toggle** on this model | Sim | P1 | |
| CTRL-03 | Control | Power toggle | A tub | Toggle power | App state flips and holds | Sim | P1 | |
| CTRL-04 | Control | **Power reaches the tub** | Real tub | Toggle power | Device holder confirms the tub starts/stops; app agrees within ~10 s | **Yes** | P1 | |
| CTRL-05 | Control | Target temperature | A tub | Raise then lower the target | Value updates in the app | Sim | P1 | |
| CTRL-06 | Control | **Target reaches the tub** | Real tub | Change the target | Device holder confirms the tub's own display shows the same value | **Yes** | P1 | |
| CTRL-07 | Control | Target limits | A tub | Push the target past its maximum and minimum | Clamped at the device's real limits | Sim | P2 | |
| CTRL-08 | Control | Light | A tub | Toggle light | App reflects it | Sim | P2 | |
| CTRL-09 | Control | **Light reaches the tub** | Real tub | Toggle light | Device holder confirms the light physically changes | **Yes** | P2 | |
| CTRL-10 | Control | Disinfection | A tub | Toggle disinfection | App reflects it | Sim | P2 | |
| CTRL-11 | Control | **Disinfection reaches the tub** | Real tub | Toggle it | Device holder confirms | **Yes** | P2 | |
| CTRL-12 | Control | Temperature moves over time | Simulator | Set a lower target, wait | Current temperature drifts toward the target | Sim | P3 | |
| CTRL-13 | Offline | **Tub goes offline** | Real tub | Device holder powers it off | App shows offline; controls stop working | **Yes** | P1 | |
| CTRL-14 | Offline | **Failed command reverts** | Real tub going offline | Toggle something as it drops | The toggle snaps back — it must not display a state the tub never reached | **Yes** | P2 | |
| CTRL-15 | Offline | **Recovery** | Real tub | Power it back on | App returns to online without an app restart | **Yes** | P2 | |
| CTRL-16 | Sync | **Admin change appears in the app** | Real tub | Change the target from the admin panel | The app reflects it without a manual refresh | **Yes** | P2 | |
| CTRL-17 | Network | Phone loses connectivity | A tub | Enable airplane mode, try a control | Readable error or disabled controls; no crash | Sim | P2 | |

### Session, Tracking, Reminder

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| SES-01 | Session | Run a timed session | Signed in | Start a session, set a duration, let it run | Timer counts, completion screen appears at the end | No | P2 | |
| SES-02 | Session | Cancel mid-session | Session running | Leave or cancel | No crash; state is sane on return | No | P2 | |
| SES-03 | Tracking | Points and level update | A completed session | Open Tracking | Totals and level reflect the session | No | P2 | |
| SES-04 | Tracking | Survives restart | A completed session | Force-quit, reopen, open Tracking | History still present | No | P2 | |
| SES-05 | Tracking | Reinstall clears history | Any | Reinstall the app, sign in again | History is **empty** — it is stored on the phone, not the account. Expected, not a bug | No | P3 | |
| SES-06 | Reminder | Filter reminder | A tub selected | Open the filter reminder | Shows days remaining | No | P2 | |
| SES-07 | Reminder | Mark replaced | On the reminder | Mark the filter replaced | Countdown resets and persists | No | P2 | |
| SES-08 | Cleaning | Cleaning panel is UI only | A tub | Set a cleaning schedule, run a clean cycle | The UI progresses through its steps. **Nothing is expected to happen on the tub** | No | P3 | |

### Notifications

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| NOT-01 | Permission | Prompt appears | Fresh install | Sign in | The app requests notification permission | No | P2 | |
| NOT-02 | Push | Background delivery | Permission granted, app backgrounded | Send a notification from the admin panel to your account only | Notification arrives with the title and body sent | No | P1 | |
| NOT-03 | Push | Foreground delivery | App open | Send another | An in-app banner appears | No | P2 | |
| NOT-04 | Push | Tap routing from background | A notification with a deeplink | Tap it | The app opens on the targeted screen | No | P2 | |
| NOT-05 | Push | Tap routing from closed | App fully closed | Tap the notification | The app launches to the targeted screen | No | P2 | |
| NOT-06 | Badge | Unread count | A delivered notification | Look at the Account tab | The unread badge increases, and clears once read | No | P3 | |
| NOT-07 | History | History list | Notifications received | Open the notifications screen | Past messages are listed | No | P2 | |
| NOT-08 | Permission | Denied notifications | Permission denied | Send a notification | Nothing arrives; the app does not crash or claim success | No | P2 | |

### Error Handling & Resilience

| ID | Module | Scenario | Preconditions | Test Steps | Expected Result | Device | Pri | Result |
|---|---|---|---|---|---|---|---|---|
| ERR-01 | Network | Offline on launch | Airplane mode | Launch the app | Readable state; no crash, no permanent spinner | No | P1 | |
| ERR-02 | Network | Connection drops mid-action | Signed in | Turn off Wi-Fi during a save | Clear failure message; retry works when back online | No | P2 | |
| ERR-03 | Stability | Rapid navigation | Signed in | Move quickly between tabs and screens for a minute | No crash, no frozen screen | No | P2 | |
| ERR-04 | Stability | Background and return | Signed in | Background the app for 10 minutes, return | State is intact and refreshes | No | P2 | |
| ERR-05 | Stability | Rotate / resize | Signed in | Rotate the phone on several screens | Layout stays usable | No | P3 | |
| ERR-06 | Input | Very long input | Profile | Enter a very long display name | Handled gracefully — no overflow, no crash | No | P3 | |
| ERR-07 | Input | Special characters | Profile | Use emoji and non-Latin characters in the display name | Saved and displayed correctly | No | P3 | |

---

## 7. Admin Panel Testing

Open the dashboard URL in a desktop browser. It works on phones too — see
[section 8](#8-mobile-compatibility).

### 7.1 Signing in

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-01 | Valid sign-in | Enter admin email + password | Lands on the customer list with the sidebar visible | P1 |
| ADM-02 | Wrong password | Use a wrong password | Stays on sign-in with *"Incorrect email or password, or the account lacks admin access."* | P1 |
| ADM-03 | Non-admin account | Sign in with an account that has no admin access | **The same message as ADM-02** — it must not reveal that the account exists | P1 |
| ADM-04 | Deep link protection | Sign out, then open the customer list URL directly | Redirected to sign-in | P1 |
| ADM-05 | Sign out | Press Sign out | Back to sign-in; browser Back does not restore the dashboard | P2 |
| ADM-06 | Session expiry | Leave a session for over 8 hours, reload | Redirected to sign-in | P3 |

### 7.2 Dashboard

Shows three counters — customers, tubs (with how many are online), and administrators — plus
shortcuts.

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-10 | Counters load | Open Dashboard | Three numbers render | P2 |
| ADM-11 | One source failing | — | If a counter cannot load it shows **—** and *"Could not reach…"* while the others still render | P2 |

### 7.3 Customers (Tuya users)

The main screen. Columns: **User** (picture, name, customer ID), **Email**, **Devices**,
**Status**, **Registered**.

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-20 | List renders | Open Tuya users | One row per customer with all five columns | P1 |
| ADM-21 | Status is derived | Compare a customer with 0 tubs against one with tubs | `Inactive` and `Active`. Hovering explains it is derived from paired devices. **A new account showing `Inactive` is correct** | P2 |
| ADM-22 | Open a customer | Click anywhere on a row | Opens their detail page | P1 |
| ADM-23 | No delete in the list | Inspect the list | There is deliberately **no delete button** here | P2 |
| ADM-24 | Sort by sign-up | Click the *Registered* header twice | Order flips newest ↔ oldest | P2 |
| ADM-25 | Search by email | Type part of a visible email | List narrows; footer switches to *"Showing X of Y on this page"* | P2 |
| ADM-26 | Search by name and ID | Try both | Both match | P2 |
| ADM-27 | Search miss | Type `zzzzzz` | Empty-state message, **no error page** | P2 |
| ADM-28 | Rows per page | Use Filter or the footer dropdown to pick 20 / 50 / 100 | Row count changes and the address bar updates | P2 |
| ADM-29 | Paging | Step forward and back | Content changes; the first page disables the back arrow | P2 |
| ADM-30 | Shareable link | Copy the address on page 2, open it in a new tab | Same page and page size | P3 |

### 7.4 Customer detail

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-40 | Three blocks render | Open a customer | *Account Information*, *Summary*, *Tuya Info*, plus a Devices block | P1 |
| ADM-41 | User source is derived | Compare a Google-registered account with an email one | Shows `Google` / `Email / phone`. Derived from the account name prefix | P2 |
| ADM-42 | Copy buttons | Click the copy icons | Icon becomes a tick; the value is on the clipboard | P3 |
| ADM-43 | All devices | Open a customer with tubs → *View all devices* | Nine-column table; the Name / Product / Status headers sort; search matches name, ID and product | P2 |
| ADM-44 | Temperature unit follows the customer | A customer set to °F | Temperatures render in °F | P3 |
| ADM-45 🔴 | **Delete a customer (stage 1)** | Use a throwaway account: open detail → Delete user → confirm | Returns to the list; the customer **disappears from it**. **Never run against a real customer** | P1 |
| ADM-46 | **Deleted list** | Settings → *Open deleted users* | The account is listed with a `Grace period` badge and the date it was deleted | P1 |
| ADM-47 | **Restore** | On that page press **Restore** | The account returns to the customer list, unchanged; the deleted list no longer shows it | P1 |
| ADM-48 🔴 | **Delete forever (stage 2)** | Delete the throwaway account again, then on the deleted page press **Delete forever** and confirm | Row disappears; the account is gone for good and cannot be restored | P2 |
| ADM-49 | **Trash is not on the customer screen** | Look at the customer list header | There is deliberately **no** deleted-users link there — it lives under Settings | P3 |

### 7.5 Devices

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-50 | Device list | Open Devices | A row per tub, or *"No devices found on any user account."* when none are paired — that message is **normal**, not an error | P1 |
| ADM-51 | Device detail | Open a tub | Live status and the control panel | P1 |
| ADM-52 🔴 | **Remote control** | Change the target temperature | **Moves real hardware.** Coordinate with the device holder; see [section 5](#5-remote-device-testing-procedure) | P1 |
| ADM-53 | Offline tub | With the tub powered off | Shown as offline; controls blocked or clearly disabled | P2 |

### 7.6 Administrators

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-60 | List renders | Open Admins | Email and date added per administrator | P1 |
| ADM-61 🔴 | **Revoke access** | Using a spare admin account, signed in as a *different* admin, revoke it | The row disappears; that account can no longer sign in | P2 |
| ADM-62 | Self-revoke is not prevented | Observe whether the UI stops you revoking your own access | It currently does **not**. Record the behaviour; see [section 11](#11-known-limitations--do-not-report-these-as-bugs) | P2 |
| ADM-63 | Cannot add an admin | Look for an "add" control | There is none — by design | P3 |

### 7.7 Notifications

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-70 | Provider badge | Open Send notifications | A badge naming the delivery channel | P3 |
| ADM-71 | Required fields | Submit with the title empty, then the body empty | Blocked both times | P2 |
| ADM-72 | Recipient modes | Switch between choosing recipients and sending to all | The picker shows and hides | P2 |
| ADM-73 | Recipient search | Search by email, name or customer ID | The list narrows | P2 |
| ADM-74 🔴 | **Send to one recipient** | Select only your own test account, send | The notification arrives — cross-check with NOT-02. **Never use *Send to all* against production** | P1 |
| ADM-75 | Deeplink | Send with a screen target, tap the notification | The app opens that screen | P3 |

### 7.8 Settings

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-80 | Read-only | Open Settings | Signed-in account, delivery channel, access model. **No edit controls** — that is by design | P3 |

### 7.9 Shell

| ID | Scenario | Steps | Expected | Pri |
|---|---|---|---|---|
| ADM-90 | Sidebar stays put | On a long page, scroll to the bottom | The menu and Sign out stay in place | P2 |
| ADM-91 | Active item | Visit each menu entry | Exactly one item is highlighted and it matches the page | P3 |

---

## 8. Mobile Compatibility

Run the **core flow** — sign in → device list → dashboard → a control → Tracking → Account — on
each row below.

| Check | What to look for | Result |
|---|---|---|
| **Android phone** | Whole core flow works | |
| **iOS phone** | Whole core flow works | |
| **Small screen** (≈5", or the smallest device you have) | Nothing is cut off; buttons remain tappable; text is not clipped | |
| **Large screen** (tablet or a large phone) | Layout does not stretch into unusable emptiness | |
| **Keyboard** | The keyboard never covers the field being typed into; forms scroll into view; the keyboard dismisses cleanly | |
| **Scrolling** | Long screens scroll smoothly; nothing is unreachable behind the tab bar | |
| **Dialogs and modals** | Confirmations are fully visible and dismissible on small screens | |
| **Loading states** | Every action that waits shows a spinner or disabled state — nothing looks frozen | |
| **Dark / light mode** | Both are readable; no invisible text | |
| **Slow network** | On a throttled connection the app degrades gracefully rather than hanging | |
| **Offline** | Clear messaging; recovers when connectivity returns | |
| **Admin on desktop** | Sidebar pinned, tables fully visible | |
| **Admin on phone** | Menu collapses behind the ☰ button; opening a menu item closes it; wide tables scroll sideways **inside their own frame** while the page itself never slides sideways | |

---

## 9. Bug Reporting Format

Use this template for every issue. Reports missing steps or evidence usually come back with
questions and slow everyone down.

```
**Title:**            One line, specific. "Target temperature reverts to old value after 5s
                      on Android" — not "temperature bug"

**Environment:**      Production / Staging / Local · Admin panel or Mobile app
**Device/OS:**        e.g. Samsung Galaxy A32, Android 13 · iPhone 14, iOS 17.2
**Build Version:**    Build or version number from the app
**Tub:**              Real tub / Simulated tub / Not involved

**Preconditions:**    What had to be true first (signed in as X, tub paired and online, …)

**Steps to Reproduce:**
  1.
  2.
  3.

**Actual Result:**    What happened, including the exact error text
**Expected Result:**  What should have happened, and why you believe so (test case ID if there is one)

**Frequency:**        Always / Often / Rarely / Once (say how many attempts)

**Screenshot/Video:** Attach. Video for anything with timing or animation
**Logs/Error Message:** Exact text. For admin errors, include the reference number shown on the
                      error screen
**Test Case ID:**     e.g. CTRL-06, if it came from this document

**Severity:**         Critical / High / Medium / Low
```

### Severity

| Level | Meaning | Examples |
|---|---|---|
| **Critical** | Blocks core use, loses data, or is a safety concern | App crashes on launch · cannot sign in at all · a control does the opposite of what was asked · a tub cannot be switched off |
| **High** | A main feature is broken with no workaround | Pairing never completes · push notifications never arrive · admin cannot list customers |
| **Medium** | A feature is broken but has a workaround, or an edge case fails | Search misses a valid result · a state needs a manual refresh · a validation message is wrong |
| **Low** | Cosmetic or minor | Misalignment · a typo · an inconsistent icon |

Anything involving the tub **behaving physically differently from what the app requested** is at
least **High**, and Critical if it involves power or temperature.

---

## 10. QA Sign-Off Checklist

| # | Item | Done |
|---|---|---|
| 1 | Registration and email verification tested | ☐ |
| 2 | Email login tested | ☐ |
| 3 | Google sign-in tested | ☐ |
| 4 | Apple sign-in tested (iOS) | ☐ |
| 5 | Session persistence, sign out and account deletion tested | ☐ |
| 6 | Onboarding and navigation tested | ☐ |
| 7 | Profile and home management tested | ☐ |
| 8 | Device screens tested against the simulator | ☐ |
| 9 | Pairing screens, validation and timeout tested without a tub | ☐ |
| 10 | Session, tracking and reminder tested | ☐ |
| 11 | Push notifications tested end to end | ☐ |
| 12 | Error handling, offline and loading states tested | ☐ |
| 13 | Admin panel fully tested | ☐ |
| 13a | Customer delete → restore → delete forever verified | ☐ |
| 14 | All device-independent cases completed | ☐ |
| 15 | Device-dependent cases coordinated with the device holder | ☐ |
| 16 | Pairing verified on a real tub, both platforms | ☐ |
| 17 | Real device control verified with physical confirmation | ☐ |
| 18 | Android tested | ☐ |
| 19 | iOS tested | ☐ |
| 20 | Small and large screens checked | ☐ |
| 21 | Admin checked on desktop and phone | ☐ |
| 22 | All Critical and High bugs resolved and retested | ☐ |
| 23 | Regression pass completed after the final build | ☐ |
| 24 | Blocked cases listed with the reason | ☐ |

**Release criteria:** every **P1** case passes, and no **P2** case fails without a written waiver.

| | Name | Date | Signature |
|---|---|---|---|
| Tested by | | | |
| Approved by | | | |

---

## 11. Known Limitations — do not report these as bugs

Read this before filing. Each item is either deliberate or already known.

| # | Behaviour | Why |
|---|---|---|
| 1 | **The cleaning panel and its schedule do nothing to the tub** | Interface only; never connected to the appliance. Test it as UI |
| 2 | **There is no temperature or power scheduling** | Not implemented |
| 3 | **No "Forgot password" on the sign-in screen** | Password change only exists inside the app for a signed-in user. Worth raising as a product gap, but it is not a defect |
| 4 | **Google sign-in on Android may fail with a developer configuration error** | The Google project needs the app's package name and signing fingerprint registered. Confirm the current status with the developers before filing |
| 5 | **Tracking history disappears after a reinstall** | It is stored on the phone, not on the account |
| 6 | **The tub has no separate freeze/cooling toggle** | Power is the chiller on/off on this model. Its absence is correct |
| 7 | **A 5 GHz network cannot pair** | Hardware limit of the tub. Android blocks it with a message; iOS can only warn, because iOS does not expose the band |
| 8 | **iOS asks for Local Network permission only once** | If it was denied, it must be re-enabled in iOS Settings; the app cannot ask again |
| 9 | **Brand fonts fall back to the system font** | The font files were never linked into the native projects. Known cosmetic issue |
| 10 | **Admin search only filters the page you are on** | Tuya's API cannot search by email or customer ID. Raise rows-per-page to widen it |
| 11 | **Admin `Status` and `User source` are derived, not fetched** | Tuya provides neither. A brand-new account reads `Inactive` — correct |
| 12 | **Admin cannot add an administrator** | Requires a developer to act on the database |
| 13 | **Nothing stops an admin revoking their own access** | Known gap. Keep two admin accounts |
| 14 | **"No devices found on any user account."** | Correct whenever no customer has paired a tub |
| 15 | **The admin notification recipient picker lists at most 100 customers** | Beyond that, *Send to all* is the only option |
| 16 | **Admin errors show a blank page with a reference number** | The real cause is only in the server logs. Include that number in your report |

---

## Appendix — quick reference

**Device requirement at a glance**

| Can be tested alone | Needs the simulator build | Needs a real tub |
|---|---|---|
| Registration · login · Google · Apple · session · profile · home · onboarding · navigation · session timer · tracking · reminder · notifications · pairing screens & validation · the entire admin panel | Device list · dashboard · temperature gauge · power / light / disinfection toggles · target temperature · temperature drift | Real pairing (EZ / AP / Bluetooth) · commands actually reaching the tub · online↔offline transitions · admin-to-app synchronisation |

**Who to ask**

| Question | Ask |
|---|---|
| Build links, credentials, a simulator build | Development team |
| Whether a tub is powered / what its indicator is doing | Device holder |
| Whether a known limitation still applies | Development team |
