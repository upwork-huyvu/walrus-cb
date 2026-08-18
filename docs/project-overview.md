# Walrus — Product Overview

What this project is, what it does, and everything it can do today.

Written for anyone who needs to understand the product without reading code: a new team member, a
stakeholder, a designer, or the client.

**Version:** 1.0 · **Written:** 2026-08-13

---

## Contents

1. [The product in one page](#1-the-product-in-one-page)
2. [Who uses it](#2-who-uses-it)
3. [What a customer can do — the mobile app](#3-what-a-customer-can-do--the-mobile-app)
4. [What staff can do — the admin dashboard](#4-what-staff-can-do--the-admin-dashboard)
5. [How the pieces fit together](#5-how-the-pieces-fit-together)
6. [Feature status at a glance](#6-feature-status-at-a-glance)
7. [What is not included](#7-what-is-not-included)
8. [Things worth knowing](#8-things-worth-knowing)

---

## 1. The product in one page

**Walrus sells a connected ice bath** — a cold plunge tub with a chiller, a light and a sanitising
function. The tub is built on **Tuya**, an IoT platform that supplies the hardware module and the
cloud behind it.

Every Tuya device can already be controlled through **Smart Life**, Tuya's own generic app. But
Smart Life is not a Walrus product: it carries Tuya's branding, lists hundreds of unrelated device
types, and has nothing to do with cold plunging as a habit.

**This project replaces Smart Life with two things:**

| | |
|---|---|
| **A branded Walrus mobile app** | The customer's own app. Pair the tub, set the temperature, run a timed plunge, build a streak |
| **An internal admin dashboard** | The company's own tool. See who is using the product, support them, control a tub remotely, message customers |

The value is not "we built an IoT system" — Tuya already provides that. The value is a focused,
branded experience around one product, plus the internal tooling to run it as a business.

### The customer's journey

```
Buys a tub  →  installs the Walrus app  →  creates an account
            →  pairs the tub over Wi-Fi or Bluetooth
            →  sets a target temperature and waits for it to chill
            →  runs a timed cold plunge, tracked as a daily habit
            →  gets reminders when the filter needs changing
```

---

## 2. Who uses it

| User | Tool | How they get access |
|---|---|---|
| **Customer** | Mobile app (iOS + Android) | Signs up themselves with email, Google or Apple |
| **Walrus staff** | Admin dashboard (web) | An account created for them by the development team |

There are no roles beyond this. Every customer sees the same app; every administrator has the same
powers.

---

## 3. What a customer can do — the mobile app

### Getting started

**Create an account** using an email address, a **Google** account, or **Apple** (on iPhone). Email
sign-up sends a verification code before the account is created.

**A short onboarding** introduces the product and asks a few questions — name, why they are cold
plunging, how experienced they are, and whether they already have a tub.

The session is remembered, so the app does not ask them to sign in again every time.

### Connecting the tub

The app walks the customer through **pairing** — connecting the tub to their home Wi-Fi. There are
three ways, and the app explains which to use with numbered, step-by-step instructions:

| Method | When to use it |
|---|---|
| **Wi-Fi (EZ)** | The normal route. The tub's indicator blinks quickly |
| **Wi-Fi hotspot (AP)** | The fallback when EZ fails. The tub's indicator blinks slowly, and the phone briefly joins a hotspot the tub creates |
| **Bluetooth** | No Wi-Fi details needed at all |

While searching, the app shows a **radar sweep** and the tub appears on it as a blip the customer
taps to connect — the same interaction people know from Smart Life.

The app also tries to prevent failures before they happen: it fills in the Wi-Fi name
automatically, warns when the phone is on a network the tub cannot join, blocks a search with no
network name, and shows a countdown rather than spinning forever. If pairing does fail, there is a
**"copy diagnostics"** action so the customer can send something useful to support.

### Controlling the tub

The main screen shows the **current water temperature** and the **target**, with a circular gauge.

The customer can:

- **set a target temperature** with plus/minus steps, limited to what the tub actually supports
- **turn the tub on and off**
- **turn the light on and off**
- **turn disinfection on and off**

The app only shows the controls the connected tub actually reports — a different model with fewer
functions would show fewer buttons.

Changes appear immediately and are confirmed by the tub. If the tub does not confirm a command, the
control reverts rather than showing a state the tub never reached. When the tub is offline the app
says so and stops pretending the controls work.

### The plunge itself

A **timed session**: the customer picks a duration, starts it, and gets a countdown with a water
animation. At the end, a completion screen.

Sessions feed a **tracking tab**: points, levels, a streak, a summary of today and the past week.
This is the "habit" layer of the product — the part Smart Life could never provide.

### Staying on top of maintenance

- **Filter reminder** — shows how many days until the filter should be changed, with a button to
  mark it replaced and reset the countdown.
- **Cleaning panel** — a schedule and a "run clean cycle" action.
  See [section 7](#7-what-is-not-included) about its current state.

### Notifications

The customer receives **push notifications** sent by Walrus staff — maintenance reminders, status
messages, announcements. Tapping one can open a specific screen in the app.

There is a **notification history** in the app and an unread badge on the account tab.

### Account and preferences

| | |
|---|---|
| **Display name** | Editable |
| **Temperature unit** | °C or °F — changes how temperatures read throughout the app |
| **Time zone** | Editable |
| **Dark mode** | Toggle |
| **Change password** | Sends a code by email, then asks the customer to sign in again |
| **Delete account** | Removes the account |
| **Homes** | A "home" groups the customer's devices; they can create and rename one |

### Extras

**Shop** points to filters, accessories and parts. **Help** carries a FAQ.

---

## 4. What staff can do — the admin dashboard

A web dashboard, dark themed, usable on a computer or a phone.

![The customer list](images/admin/03-users.png)

### See the customer base

The **Tuya users** screen lists everyone who has registered through the app: their name, email,
how many tubs they own, and when they signed up. It can be searched, sorted by sign-up date, and
paged.

![A customer's detail page](images/admin/04-user-detail.png)

Opening a customer shows their full profile — contact details, country, time zone, the temperature
unit they use, when they registered and when they last changed anything — alongside a summary of
their tubs (how many, how many online) and how they registered (Google, Apple or email).

Their tubs are listed as cards showing current and target temperature, and there is a **full device
table** for customers who own several.

Staff can also **delete a customer account** from this page.

### See and control the tubs

The **Devices** screen lists every tub across every customer, with its owner, whether it is online,
and its current and target temperature.

Opening a tub gives a **control panel**: staff can change the target temperature and toggle
functions remotely — useful when supporting a customer who cannot get something working.

### Message customers

**Send notifications** composes a push message — title, body, an optional image, and optionally a
screen to open when tapped — and sends it either to **selected customers** or to **everyone**.

### Manage access

**Admins** lists who can enter the dashboard, and allows revoking access.

**Settings** shows how the instance is configured, read-only.

**Dashboard** gives an at-a-glance count of customers, tubs (and how many are online), and
administrators.

---

## 5. How the pieces fit together

Three parts, plus Tuya's platform underneath:

```
   Customer's phone ──────────────► Tuya Cloud ◄──────► The tub
      (Walrus app)                       ▲
                                         │
   Staff browser ──► Walrus backend ─────┘
   (admin dashboard)        │
                            └──► Walrus database
```

**The mobile app talks to Tuya directly.** Pairing and device control are handled by Tuya's own
mobile SDK, embedded in the app. This is why pairing works even on the local network, and why the
app can respond to the tub instantly.

**The admin dashboard goes through the Walrus backend**, which calls Tuya's cloud on the server
side. It also holds the things Tuya does not provide: administrator accounts, notification history
and filter reminders.

The practical consequence: **the same tub is reachable two different ways**. That is why a support
person can change a customer's temperature from the dashboard and the customer sees it change in
their app moments later.

---

## 6. Feature status at a glance

| Area | Feature | Status |
|---|---|---|
| **Accounts** | Email sign-up with verification code | ✅ Built |
| | Sign in with Google | ✅ Built |
| | Sign in with Apple (iOS) | ✅ Built |
| | Stay signed in across restarts | ✅ Built |
| | Change password (from inside the app) | ✅ Built |
| | Delete account | ✅ Built |
| **Onboarding** | Intro and questionnaire | ✅ Built |
| | Home creation | ✅ Built |
| **Pairing** | Wi-Fi EZ · Wi-Fi AP · Bluetooth | ✅ Built |
| | Radar discovery view | ✅ Built |
| | Pre-checks, countdown, diagnostics | ✅ Built |
| **Device control** | Current and target temperature | ✅ Built |
| | Power, light, disinfection | ✅ Built |
| | Live updates and offline handling | ✅ Built |
| **The ritual** | Timed session with countdown | ✅ Built |
| | Tracking: points, levels, streak, weekly summary | ✅ Built |
| **Maintenance** | Filter reminder with reset | ✅ Built |
| | Cleaning schedule and clean cycle | ⚠️ Interface only — see below |
| **Notifications** | Push delivery, tap-to-open, history, unread badge | ✅ Built |
| **Preferences** | Name, temperature unit, time zone, dark mode | ✅ Built |
| **Content** | Shop and Help screens | ✅ Built |
| **Admin** | Customer list, search, sort, paging | ✅ Built |
| | Customer detail and their devices | ✅ Built |
| | Delete a customer | ✅ Built |
| | Device list and remote control | ✅ Built |
| | Send notifications to some or all customers | ✅ Built |
| | Administrator access management | ✅ Built |
| | Works on desktop and phone | ✅ Built |

---

## 7. What is not included

Stated plainly so nobody promises these by accident.

| Feature | Status |
|---|---|
| **Cleaning schedule and "run clean cycle"** | The screen exists and works as an interface, but it **does not command the tub**. It is a placeholder for a feature that has not been connected to the hardware |
| **Scheduling temperature or power** | Not implemented. A customer cannot say "chill to 5° every morning at 6" |
| **Password recovery when locked out** | A customer who forgets their password has no way to reset it from the sign-in screen. Changing a password only works from inside the app, while signed in |
| **Adding an administrator from the dashboard** | Requires the development team |
| **A record of notifications already sent** | The dashboard can send messages but does not list what was sent previously |
| **Rooms and per-device permissions** | Was in the original plan; not built |
| **Brand fonts in the app** | The app currently renders in the phone's system font rather than the Walrus typeface |

---

## 8. Things worth knowing

Behaviours that surprise people but are working as intended.

| | |
|---|---|
| **The tub needs 2.4 GHz Wi-Fi** | It cannot join a 5 GHz network. This is a limit of the hardware, and a common cause of failed pairing. On Android the app detects and blocks it; on iPhone it can only warn, because iOS does not let apps read the network band |
| **iPhone asks for "Local Network" once** | If the customer declines, pairing will not work and the app cannot ask again — they have to re-enable it in iPhone Settings |
| **This tub has no separate "cooling" switch** | Turning the tub **on** is what starts the chiller. There is deliberately no extra freeze button |
| **Tracking history lives on the phone** | Streaks and points are stored on the device, not the account. Reinstalling the app clears them |
| **A customer marked "Inactive" in the dashboard is not blocked** | It simply means they have not paired a tub yet. Tuya does not provide an account status, so the dashboard works it out from whether they own a device |
| **Support can change a customer's tub** | Remote control from the dashboard affects real hardware in the customer's home. It should only be used while helping that customer, with their knowledge |

---

## Related documents

| Document | For |
|---|---|
| `admin-user-guide.md` | Step-by-step manual for staff using the dashboard |
| `admin-website.md` | Technical reference for the dashboard |
| `qa-testing-guide.md` | Full testing guide, including how to test without a tub |
| `developer-onboarding.md` | For developers joining the codebase |
