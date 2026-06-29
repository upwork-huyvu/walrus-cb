# Kế hoạch: Mobile scaffold — RN CLI app + link lib Tuya + port UI

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-scaffold`
- **Milestone:** M1 — Part B1
- **Phần liên quan:** mobile (RN CLI)
- **Ngày tạo:** 2026-06-29 · **Cập nhật:** 2026-06-29

## 1. Mục tiêu & phạm vi
Khởi tạo app **React Native CLI** (KHÔNG Expo) ở `apps/mobile`, **link thư viện**
`@cool-bath/tuya-react-native`, **port UI tokens** từ `replit_generate/` (chỉ
layout/theme), dựng **app shell + navigation** (placeholder login/dashboard) để các
feature sau (auth/home/pairing/dashboard) cắm vào.

**Ngoài phạm vi:** logic login/pairing/dashboard thật (B2–B5 mobile); native build verify (cần Android SDK/Xcode + file bảo mật Tuya — xem `m1-tuya-sdk-library`).

## 2. Bối cảnh & ràng buộc
- **RN CLI, KHÔNG Expo** (cần native module Tuya). Pin **RN khớp lib = 0.85** để link mượt.
- `replit_generate/` là Expo Snack (expo ~54, RN 0.81.5) → **chỉ lấy UI/theme**, bỏ toàn bộ `expo-*`.
- Lib `@cool-bath/tuya-react-native` ở `packages/` → link qua **workspace / file dependency** + autolink.
- Máy hiện tại **không có Android SDK/JDK17/Xcode** → build native hoãn; verify ở mức cấu trúc + `tsc`.
- Secret: app chỉ giữ key public (Tuya AppKey ở native config, KHÔNG AppSecret trong JS/repo).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `apps/mobile` là app RN CLI (KHÔNG Expo), `tsc --noEmit` pass; cấu trúc chuẩn (metro/babel/index).
- [ ] AC2: Link `@cool-bath/tuya-react-native` — import `{ Tuya }` typecheck OK (autolink config sẵn).
- [ ] AC3: Clone đủ **12 screens + 6 components + theme** từ replit sang `src/` (TS), `tsc` pass; KHÔNG còn `expo-*`.
- [ ] AC4: Font brand bundle (`assets/fonts` + `react-native.config.js`); router `navigate()` + ThemeProvider chạy (tsc).
- [ ] AC5: (B6) Link `@cool-bath/tuya-react-native` + nối device state điểm "replaced by Tuya SDK later" (tsc).

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
6. **B6 — Link lib Tuya + nối device state**
   - `file:` dep `@cool-bath/tuya-react-native` + metro watchFolders; thay device state giả bằng `Tuya.*` (initSdk/publishDps/onDeviceStatus) ở chỗ đã đánh dấu "replaced by Tuya SDK later".
   - Test: `tsc`; (native build hoãn).

## 5. Rủi ro & câu hỏi mở
- ⚠️ Link lib local (workspace yarn-berry của lib vs npm app) → có thể cần `file:` dep + cấu hình metro watchFolders. Xử lý ở B2.
- ⚠️ Native build (Android/iOS) hoãn tới khi có toolchain + file bảo mật Tuya (lib A).
- ❓ Bộ điều hướng: react-navigation (mặc định) — chốt ở B4.
