# Progress: Mobile scaffold — RN CLI app + link lib Tuya + port UI

- **Slug:** `m1-mobile-scaffold`
- **Phase hiện tại:** `DEV` (đang clone UI — B2+B3 xong; B4/B5 screens tiếp)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Clone UI XONG (B1–B5)** — 12 screens + router + theme + fonts; `tsc` pass + jest 4/4.
**Tiếp `/dev` B6** — link `@cool-bath/tuya-react-native` (file: dep + metro `watchFolders`) + thay device
state giả (`useAppState`: currentTemp/targetTemp/lightOn/connectDevice) bằng `Tuya.*`
(initSdk/getDps/publishDps/onDeviceStatus) ở chỗ "replaced by Tuya SDK later".
⚠️ Render thật + native build vẫn cần toolchain (Android SDK/JDK17/Xcode) + file bảo mật Tuya → hoãn.

## Checklist các bước (đồng bộ plan mục 4 — fix-plan UI clone)
- [x] B1 — Init RN CLI app `apps/mobile` · **done** (RN 0.85.0, TS, no Expo)
- [x] B2 — Deps UI + bundle fonts + bỏ expo · **done** (react-native-svg; 3 .otf → assets/fonts + react-native.config.js)
- [x] B3 — Foundation: theme + state + components · **done** (theme/levels/techniques/useAppState/format + 5 components; tsc pass)
- [x] B4 — Port 6 screen chính · **done** (Home/Breathwork/Session/Completion/Progress/Splash + ProgressDots; tsc pass)
- [x] B5 — Onboarding (6) + App.tsx (router + ThemeProvider) · **done** (bỏ Font.loadAsync; jest 4/4 + tsc pass)
- [ ] B6 — Link lib Tuya + nối device state · pending

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — RN CLI app (no Expo), tsc pass, cấu trúc chuẩn (RN 0.85.0)
- [x] AC3 — Clone đủ 12 screens + 6 components + theme (tsc pass); không expo-*
- [x] AC4 — Font bundle (assets/fonts + react-native.config.js) + router `navigate()` + ThemeProvider (tsc pass)
- [ ] AC5 — (B6) Link lib `@cool-bath/tuya-react-native` + nối device state

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-29 | DEV B5 | ✅ | Port 6 onboarding (Welcome/Email/Name/Why/Experience/Device) + `App.tsx` (router switch `navigate()` + ThemeProvider, bơm isDark, bỏ Font.loadAsync). Thay test boilerplate bằng `levels.test.ts`. `tsc` pass + `jest` 4/4. **Clone UI hoàn tất 12 screens.** |
| 2026-06-29 | DEV B4 | ✅ | Port 6 screen chính + ProgressDots + navigation.ts (ScreenName/Navigate) vào `src/screens`+`src/components`. Faithful 1:1 từ replit, TS hoá (nullable temp guards, exhaustive fallbacks, timer null-guards). `npx tsc --noEmit` pass. |
| 2026-06-29 | DEV B2+B3 | ✅ | Clone UI nền: tải 3 font .otf (SangBleu/Suisse) → assets/fonts + react-native.config.js; `npm i react-native-svg`; port `src/theme`, `src/state` (levels/techniques/useAppState), `src/lib/format`, `src/components` (BreathingCircle/WaterCircle/PrimaryButton/GhostButton/StatCard). `tsc` pass. |
| 2026-06-29 | DEV B1 | ✅ | `@react-native-community/cli init` → `apps/mobile` (RN 0.85.0, TS, npm, --install-pods false, --skip-git-init). Không còn `expo-*`. `npx tsc --noEmit` pass. Native build hoãn (không có Android SDK/JDK17/Xcode). |
| 2026-06-29 | PLAN | ✅ | Tạo plan/context/progress + INDEX (B1 mobile). |

## Vấn đề đang chặn (Blockers)
- Build native hoãn (không có Android SDK/JDK17/Xcode + file bảo mật Tuya). Verify B1 ở mức tsc + cấu trúc.
