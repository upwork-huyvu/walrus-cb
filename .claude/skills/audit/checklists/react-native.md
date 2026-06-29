# Checklist — React Native (CLI) + Push (FCM)

Project uses **React Native CLI (not Expo)** because it needs native modules
(Tuya SDK). The Replit UI under `replit_generate/` is an Expo Snack prototype —
treat it as a design reference to be **migrated**, not shipped.

## Project / toolchain
- [ ] Project is RN CLI (has native `ios/` + `android/`), **not** Expo managed.
      No `expo` runtime deps leaking in. Any code ported from `replit_generate/`
      must drop `expo-*` imports (`expo-status-bar`, `expo-font`, `@expo/...`).
- [ ] Hermes enabled; New Architecture decision is explicit and consistent
      across iOS/Android with the Tuya SDK's support.
- [ ] Node/RN/Gradle/CocoaPods versions pinned; `.nvmrc` or `engines` set.
- [ ] Flipper / verbose dev logging disabled in release builds.

## Architecture & state
- [ ] Clear separation: UI components vs. native-bridge/service layer (Tuya,
      auth, FCM) vs. state. Native calls are not made straight from view code.
- [ ] One state approach (Context/Redux/Zustand/Query) used consistently; server
      state (device list/status) not duplicated into ad-hoc local state.
- [ ] Navigation typed; deep-link/back behaviour defined for notification taps.

## Performance
- [ ] Lists use `FlatList`/`FlashList` with `keyExtractor`, not `.map` over big
      arrays; stable keys (not array index).
- [ ] Expensive children memoized (`React.memo`, `useCallback`, `useMemo`) where
      it matters; no new inline objects/functions causing re-renders on
      high-frequency updates (e.g. live temperature).
- [ ] Device-status updates are throttled/debounced before hitting React state.
- [ ] Images sized/cached; no giant assets bundled.

## Reliability & UX
- [ ] Error boundaries around screens; crashes don't white-screen the app.
- [ ] Every async/native call has loading + error + empty states; user sees a
      real message on failure (and the SDK error code is logged).
- [ ] Offline handling: device control gracefully reports "không có kết nối"
      rather than hanging; retries are bounded.
- [ ] No unhandled promise rejections; timeouts on network/pairing operations.

## Permissions (RN CLI = you manage native manifests)
- [ ] iOS `Info.plist` + Android manifest declare only needed permissions with
      purpose strings: Location (required for Wi-Fi SSID/EZ pairing & BLE scan),
      Bluetooth, Local Network (iOS), notifications, Camera (if QR pairing).
- [ ] Runtime permission requests handled with rationale + denied/blocked paths;
      Android 12+ `BLUETOOTH_SCAN/CONNECT`, Android 13+ `POST_NOTIFICATIONS`.

## Secrets & config (see also security-secrets.md)
- [ ] No secrets in JS bundle. Only public keys client-side (Supabase **anon**
      key, Tuya **AppKey**). Tuya **AppSecret**, `service_role`, FCM server key
      are NEVER in the app.
- [ ] Env via `react-native-config`/native, not hardcoded; per-env (dev/prod)
      config separated.
- [ ] Sensitive at-rest data (tokens) in Keychain/Keystore, not AsyncStorage
      plaintext.

## Push notifications (FCM) — client side
- [ ] Uses a supported lib (`@react-native-firebase/messaging`) wired natively
      on both platforms; APNs configured for iOS.
- [ ] Token obtained, refresh (`onTokenRefresh`) handled, token sent to backend
      and updated; token removed on logout.
- [ ] Foreground / background / quit-state handlers all implemented; notification
      tap routes to the right screen.
- [ ] `POST_NOTIFICATIONS` (Android 13+) and iOS authorization requested with a
      graceful denied path.

## Build & release
- [ ] Release signing configured; keystore / provisioning **not** in repo.
- [ ] ProGuard/R8 rules keep Tuya SDK classes (SDKs often need keep rules).
- [ ] App icons/splash set; bundle id / package name final; version/build bump
      process defined.
