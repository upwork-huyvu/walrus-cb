# Checklist - Tuya Smart Life App SDK integration

The core risk surface of this project. Native SDK (iOS/Android) bridged to RN.
When a finding here is uncertain, cross-check with a `/tuya-research` note and
cite the official doc. Docs: developer.tuya.com → app-development (Home SDK).

## Initialization & credentials (🔴 highest risk)
- [ ] **Data Center / region of the SDK init matches the Tuya Cloud Project's
      Data Center** (project requires e.g. Europe). Mismatch = devices "not
      found" / pairing fails. This is the #1 documented footgun - verify it's not
      hardcoded to the wrong region.
- [ ] `AppKey` is configured; **`AppSecret` is NOT in the JS layer / repo** - it
      lives in native secure config and ideally is git-ignored. (see
      security-secrets.md)
- [ ] SDK initialized once, early (before any account/home/device call); init
      failure is handled, not ignored.
- [ ] Security/`assets` files the SDK needs are present per platform and not
      committed if sensitive.

## Account & session
- [ ] Login flow uses the SDK's account APIs correctly (email/phone), and the
      app's own auth (Supabase: Email/Google/Apple) is reconciled with the Tuya
      account model - it's clear which identity owns the Tuya Home.
- [ ] Session expiration handled (re-login / refresh), not a silent dead state.
- [ ] Logout clears SDK caches/session and unregisters listeners.

## Home & room management
- [ ] A Home exists/created before pairing; device operations target the right
      Home/room.
- [ ] **The account used for SDK linking is the Owner of the Home** - required
      for linking (documented). Shared/member accounts can't do owner-only ops;
      code handles the permission error.
- [ ] Home/device list is fetched from SDK and is the source of truth (not a
      stale local copy).

## Device pairing (Wi-Fi + Bluetooth)
- [ ] Pairing **token** is fetched fresh and its expiry/timeout is respected
      (tokens are short-lived); UI shows progress + timeout.
- [ ] Wi-Fi pairing: EZ mode implemented, **AP mode fallback** offered when EZ
      fails; SSID/password captured (2.4GHz constraint surfaced to user).
- [ ] Bluetooth (BLE / dual-mode) pairing path implemented; BLE scan permissions
      handled; combo (BLE-assisted Wi-Fi) considered if device supports it.
- [ ] All pairing callbacks handled: success, failure (with SDK error code shown
      to user), and timeout; no path leaves the UI spinning forever.
- [ ] Pairing listeners/resources are stopped/released when the screen unmounts
      or pairing ends.

## Device control & status (DP / data points)
- [ ] Ice-bath functions map to the device's actual DP IDs and types
      (current temp, target temp, light, UV sterilize, defrost, power) - verified
      against the real product's DP schema, not guessed.
- [ ] Commands sent with correct DP value types (bool/enum/value/string); value
      ranges/steps respected (e.g. target-temp min/max).
- [ ] Rapid control input (e.g. temp slider) is debounced before publishing.
- [ ] Device status listener registered to update UI live, and **unregistered**
      on unmount (leak risk); offline/`isOnline` state reflected in UI.
- [ ] Optimistic UI (if used) reconciles with the real DP echo; failed commands
      revert the UI and inform the user.

## OTA / firmware (if in scope)
- [ ] Firmware-update check + progress + failure handling implemented; user not
      allowed to brick via interrupted updates where avoidable.

## Threading, lifecycle, cleanup
- [ ] SDK callbacks marshalled to the correct thread before touching UI (native
      side) / JS bridge handled safely; no blocking the main thread on SDK calls.
- [ ] Listeners (device, pairing, status, account) all have matching
      register/unregister; no duplicate registrations on screen re-entry.
- [ ] App background/foreground transitions re-establish device connections /
      refresh status as needed.

## Error handling & observability
- [ ] SDK error codes are surfaced (logged + user-facing message), never
      swallowed with an empty catch.
- [ ] Distinct, actionable messages for the common failures: wrong region, not
      Home owner, token expired, device offline, wrong Wi-Fi band.
