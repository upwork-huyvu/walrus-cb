# Progress: Mobile scaffold — RN CLI app + link lib Tuya + port UI

- **Slug:** `m1-mobile-scaffold`
- **Phase hiện tại:** `DEV` (B1–B6 code XONG — clone UI + nối lib Tuya; AC6 device-verify deferred)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **B1–B6 XONG code** — clone UI 12 screens + **B6 nối lib Tuya** (adapter `tuya.ts` require+mock, `dp.ts` DP-id, `useAppState` device→Tuya). Type-review OK; `tsc`/`jest` deferred (no node_modules + registry 503).
**Feature gần như done** — chỉ còn:
1. ⏳ **AC6 device round-trip** (set temp/light thật) — chờ `yarn install` + build native (JDK17+SDK/Xcode) + thiết bị + **DP schema thật** (đổi placeholder ở `src/services/dp.ts`).
2. **Tiếp track mobile** (feature mới, dùng lib đã nối): `m1-mobile-pairing` (lấy `devId` thật → bỏ placeholder rỗng) → `m1-mobile-dashboard` (UI điều khiển realtime).
⚠️ Khi có mạng: `yarn install` ở `apps/mobile` (kéo `file:` dep) → chạy `tsc`+`jest` xác nhận B6.

## Checklist các bước (đồng bộ plan mục 4 — fix-plan UI clone)
- [x] B1 — Init RN CLI app `apps/mobile` · **done** (RN 0.85.0, TS, no Expo)
- [x] B2 — Deps UI + bundle fonts + bỏ expo · **done** (react-native-svg; 3 .otf → assets/fonts + react-native.config.js)
- [x] B3 — Foundation: theme + state + components · **done** (theme/levels/techniques/useAppState/format + 5 components; tsc pass)
- [x] B4 — Port 6 screen chính · **done** (Home/Breathwork/Session/Completion/Progress/Splash + ProgressDots; tsc pass)
- [x] B5 — Onboarding (6) + App.tsx (router + ThemeProvider) · **done** (bỏ Font.loadAsync; jest 4/4 + tsc pass)
- [x] B6 — Link lib Tuya + nối device state · **code XONG** (tsc/jest deferred — no node_modules + registry 503)
  - [x] B6.1 `file:` dep + metro (watchFolders/dedupe/exports) · [x] B6.2 adapter `tuya.ts` (require try/catch + mock) · [x] B6.3 `dp.ts` DP-id consts (+test) · [x] B6.4 `useAppState` device→adapter (giữ chữ ký) · [x] B6.5 dọn (no `@cool-bath` ref) + type-review

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — RN CLI app (no Expo), tsc pass, cấu trúc chuẩn (RN 0.85.0)
- [x] AC3 — Clone đủ 12 screens + 6 components + theme (tsc pass); không expo-*
- [x] AC4 — Font bundle (assets/fonts + react-native.config.js) + router `navigate()` + ThemeProvider (tsc pass)
- [◑] AC5 — (B6) Link lib `@jimmy-vu/react-native-turbo-tuya` + nối device state · **code XONG** (AC5a–e); `tsc`/`jest` deferred (no node_modules + registry 503)
- [ ] AC6 — device round-trip thật (set temp/light → bồn đổi) · ⏳ chờ build native + thiết bị + DP schema

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-30 | DEV+TEST B6 (nối lib Tuya) | ✅ code / ⏳ verify | **B6.1** `apps/mobile/package.json` +`file:` dep `@jimmy-vu/react-native-turbo-tuya` + `metro.config.js` watchFolders(lib)+extraNodeModules(dedupe react/RN)+enablePackageExports+condition `react-native-turbo-tuya-source`. **B6.2** `src/services/tuya.ts`: `require` lib trong try/catch → native vắng dùng **mock** (vì lib import gọi getEnforcing → JS-only crash); export initSdk/readDevice/setTargetTemp/setLight/listenDevice + `tuyaAvailable`. **B6.3** `src/services/dp.ts` (+`.test.ts`): DP-id placeholder (targetTemp '104', current '105', light '101' — ⚠️ cần schema thật) + parse/build. **B6.4** `useAppState` device-state → adapter (connectDevice async: initSdk+readDevice; toggleLight/setTargetTemp optimistic+publishDps; useEffect listenDevice→onDeviceStatus), **giữ chữ ký return** (screens không sửa). **B6.5** không còn ref `@cool-bath`; type-review OK. **TEST:** `tsc`/`jest` KHÔNG chạy được (apps/mobile chưa `npm i` + nexus 503) → type-review thủ công. ⚠️ verify: metro resolve src lib + `require` typing + DP schema thật. |
| 2026-06-29 | DEV B5 | ✅ | Port 6 onboarding (Welcome/Email/Name/Why/Experience/Device) + `App.tsx` (router switch `navigate()` + ThemeProvider, bơm isDark, bỏ Font.loadAsync). Thay test boilerplate bằng `levels.test.ts`. `tsc` pass + `jest` 4/4. **Clone UI hoàn tất 12 screens.** |
| 2026-06-29 | DEV B4 | ✅ | Port 6 screen chính + ProgressDots + navigation.ts (ScreenName/Navigate) vào `src/screens`+`src/components`. Faithful 1:1 từ replit, TS hoá (nullable temp guards, exhaustive fallbacks, timer null-guards). `npx tsc --noEmit` pass. |
| 2026-06-29 | DEV B2+B3 | ✅ | Clone UI nền: tải 3 font .otf (SangBleu/Suisse) → assets/fonts + react-native.config.js; `npm i react-native-svg`; port `src/theme`, `src/state` (levels/techniques/useAppState), `src/lib/format`, `src/components` (BreathingCircle/WaterCircle/PrimaryButton/GhostButton/StatCard). `tsc` pass. |
| 2026-06-29 | DEV B1 | ✅ | `@react-native-community/cli init` → `apps/mobile` (RN 0.85.0, TS, npm, --install-pods false, --skip-git-init). Không còn `expo-*`. `npx tsc --noEmit` pass. Native build hoãn (không có Android SDK/JDK17/Xcode). |
| 2026-06-29 | PLAN | ✅ | Tạo plan/context/progress + INDEX (B1 mobile). |

## Vấn đề đang chặn (Blockers)
- Build native hoãn (không có Android SDK/JDK17/Xcode + file bảo mật Tuya). Verify B1 ở mức tsc + cấu trúc.
