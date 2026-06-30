# Kế hoạch: Mobile scaffold — RN CLI app + link lib Tuya + port UI

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-scaffold`
- **Milestone:** M1 — Part B1
- **Phần liên quan:** mobile (RN CLI)
- **Ngày tạo:** 2026-06-29 · **Cập nhật:** 2026-06-30 (refresh B6)

## 1. Mục tiêu & phạm vi
Khởi tạo app **React Native CLI** (KHÔNG Expo) ở `apps/mobile`, **link thư viện**
`@jimmy-vu/react-native-turbo-tuya`, **port UI tokens** từ `replit_generate/` (chỉ
layout/theme), dựng **app shell + navigation** (placeholder login/dashboard) để các
feature sau (auth/home/pairing/dashboard) cắm vào.

**Ngoài phạm vi:** logic login/pairing/dashboard thật (B2–B5 mobile); native build verify (cần Android SDK/Xcode + file bảo mật Tuya — xem `m1-tuya-sdk-library`).

## 2. Bối cảnh & ràng buộc
- **RN CLI, KHÔNG Expo** (cần native module Tuya). Pin **RN khớp lib = 0.85** để link mượt.
- `replit_generate/` là Expo Snack (expo ~54, RN 0.81.5) → **chỉ lấy UI/theme**, bỏ toàn bộ `expo-*`.
- Lib **`@jimmy-vu/react-native-turbo-tuya`** ở `packages/tuya-react-native` → link qua **`file:` dependency** + autolink.
  ⚠️ **KHÔNG có root `package.json`/workspace** → app standalone (`CoolBathMobile`), phải tự cấu hình metro + `file:` dep.
- Máy hiện tại **không có Android SDK/JDK17/Xcode** → build native hoãn; verify ở mức cấu trúc + `tsc`.
- Secret: app chỉ giữ key public (Tuya AppKey ở native config, KHÔNG AppSecret trong JS/repo).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `apps/mobile` là app RN CLI (KHÔNG Expo), `tsc --noEmit` pass; cấu trúc chuẩn (metro/babel/index).
- [x] AC2: Link `@jimmy-vu/react-native-turbo-tuya` — import `{ Tuya }` typecheck OK (AC5 thực hiện).
- [x] AC3: Clone đủ **12 screens + 6 components + theme** từ replit sang `src/` (TS), `tsc` pass; KHÔNG còn `expo-*`.
- [x] AC4: Font brand bundle (`assets/fonts` + `react-native.config.js`); router `navigate()` + ThemeProvider chạy (tsc).
- [ ] **AC5 (B6) — Link lib + nối device state qua Tuya**, chia nhỏ:
  - [ ] AC5a: `apps/mobile/package.json` có `"@jimmy-vu/react-native-turbo-tuya": "file:../../packages/tuya-react-native"`; `metro.config.js` có `watchFolders` + resolve lib → `tsc` import `{ Tuya }` OK.
  - [ ] AC5b: Có **adapter `src/services/tuya.ts`**: `require` lib trong `try/catch`, native vắng → **fallback mock** (UI clone vẫn chạy trong Metro không cần build native).
  - [ ] AC5c: Hằng **DP-id tập trung** (`src/services/dp.ts`) — `currentTemp`/`targetTemp`/`light` (placeholder vì chưa có DP schema thật).
  - [ ] AC5d: `useAppState` phần device (currentTemp/targetTemp/lightOn/connectDevice/toggleLight/setTargetTemp) chạy qua adapter (`initSdk`/`getDeviceSnapshot`/`publishDps`/`registerDeviceListener`+`onDeviceStatus`), giữ NGUYÊN chữ ký để screens không phải sửa nhiều.
  - [ ] AC5e: `tsc` pass + `jest` pass (giữ 4 test cũ + 1 test adapter-fallback); không vỡ session/streak logic.
  - [ ] AC6 (device): control round-trip thật (set temp/light → thiết bị đổi) — ⏳ **chờ build native + thiết bị + DP schema**.

## 4. Các bước thực hiện
> **fix-plan 2026-06-29:** user chọn **clone full UI từ `replit_generate/App.js` (2311 dòng, 12 screens)**
> → tách **TS modules** + **bundle font .otf**. Đẩy "link lib Tuya" xuống cuối (B6).
1. **B1 — Init RN CLI app `apps/mobile`** · ✅ done (RN 0.85, TS, no Expo).
2. **B2 — Deps UI + bundle fonts + bỏ expo**
   - Cài `react-native-svg`; tải 3 font (SangBleu Regular/Medium, Suisse Regular) → `apps/mobile/assets/fonts/`; `react-native.config.js` khai báo fonts; bỏ `expo-font` (load qua RN).
   - File: `apps/mobile/package.json`, `assets/fonts/*`, `react-native.config.js`.
   - Test: `tsc`; font file có mặt (link native verify trên máy thật).
3. **B3 — Port nền: theme + state + components dùng chung**
   - `src/theme/` (DARK/LIGHT tokens + ThemeContext + F fonts), `src/state/` (useAppState + level system), `src/components/` (BreathingCircle, WaterCircle, PrimaryButton, GhostButton, StatCard, ProgressDots).
   - Test: `tsc`.
4. **B4 — Port screens chính (6)**
   - `src/screens/`: Splash, Home, Breathwork, Session, Completion, Progress.
   - Test: `tsc`.
5. **B5 — Port onboarding (6) + App.tsx (router + theme provider + load fonts)**
   - `src/screens/onboarding/*` (Welcome/Email/Name/Why/Experience/Device); `App.tsx` router `navigate()` + ThemeProvider.
   - Test: `tsc` toàn app pass; (render device hoãn).
6. **B6 — Link lib Tuya + nối device state** (chi tiết, refresh 2026-06-30):
   - **B6.1 — Link lib (non-monorepo).** Thêm `"@jimmy-vu/react-native-turbo-tuya": "file:../../packages/tuya-react-native"` vào `apps/mobile/package.json`; sửa `metro.config.js`: `watchFolders=[<repo>/packages/tuya-react-native]` + `resolver.nodeModulesPaths`/`extraNodeModules` để dedupe `react`/`react-native` (tránh 2 bản React) + bật `unstable_enablePackageExports` cho export-condition của lib.
     - File: `apps/mobile/package.json`, `apps/mobile/metro.config.js`.
     - Test: `tsc` resolve được `import { Tuya } from '@jimmy-vu/react-native-turbo-tuya'`.
   - **B6.2 — Adapter an toàn `src/services/tuya.ts`.** `let lib; try { lib = require('@jimmy-vu/react-native-turbo-tuya'); } catch { lib = null; }`; export `tuyaAvailable` + wrapper gọi `lib.Tuya.*`/`onDeviceStatus`, native vắng → **mock** (giữ giá trị giả hiện tại). Lý do: `index.tsx` của lib gọi `getEnforcing` lúc import → JS-only (Metro chưa build native) sẽ crash nếu import tĩnh.
     - File: `apps/mobile/src/services/tuya.ts`.
     - Test: `jest` — mock path trả giá trị fallback, không throw.
   - **B6.3 — Hằng DP-id `src/services/dp.ts`.** `DP = { currentTemp:'?', targetTemp:'104', light:'?' }` (placeholder — ⚠️ cần DP schema thật của bồn). Helper parse `dpsJson` → {currentTemp,targetTemp,lightOn} + build dps để publish.
     - File: `apps/mobile/src/services/dp.ts`.
   - **B6.4 — Nối `useAppState` device → adapter.** Thay 4 state giả + `connectDevice/disconnectDevice/toggleLight/setTargetTemp`: `initSdk` (1 lần, App.tsx hoặc provider); `connectDevice` = chọn/đọc `devId` đã lưu → `getDeviceSnapshot`; `toggleLight`/`setTargetTemp` → `publishDps(DP.*)`; `currentTemp`/`lightOn` cập nhật realtime qua `registerDeviceListener`+`onDeviceStatus`. **Giữ nguyên chữ ký return** để screens (Home...) không phải sửa. (Pairing thật = feature `m1-mobile-pairing` sau; B6 chỉ giả định đã có `devId`.)
     - File: `apps/mobile/src/state/useAppState.ts` (hoặc tách `useDevice.ts`), `apps/mobile/App.tsx`.
     - Test: `tsc` + `jest`.
   - **B6.5 — Dọn + verify.** Đổi mọi ref tên cũ `@cool-bath/...`; chạy `tsc` + `jest` toàn app. Render thật/native build vẫn **hoãn** (toolchain).

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Không có root workspace** → `file:` dep + metro `watchFolders`/dedupe React là điểm dễ vỡ nhất (B6.1). Nếu metro không resolve được `src` lib qua export-condition → fallback: consume bản build `lib/` (`bob build` của lib) thay vì `src`.
- ⚠️ **`getEnforcing` crash khi import lib lúc CHƯA build native** → bắt buộc adapter `require` trong try/catch + mock (B6.2); KHÔNG import tĩnh `{ Tuya }` ở screens.
- ⚠️ **Codegen TurboModule** cho app (Android/iOS) cần autolink đọc `codegenConfig` từ `file:` dep — chỉ verify được khi build native (hoãn).
- ❓ **DP schema thật của bồn tắm đá** (dp-id current/target temp, light, UV, defrost, filter) — CHƯA có từ client → B6 dùng placeholder; nối đúng chức năng cần bảng DP thật (chặn nội dung, chung cho M2/M3).
- ⚠️ Native build (Android/iOS) + thiết bị thật hoãn tới khi có toolchain + file bảo mật Tuya (lib A) → AC6 device-test deferred.
- ❓ Bộ điều hướng: router `navigate()` tự viết (B5 đã xong) — không dùng react-navigation.
