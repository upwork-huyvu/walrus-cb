# Context: Mobile scaffold — RN CLI app + link lib Tuya + port UI

- **Slug:** `m1-mobile-scaffold`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** — App = **RN CLI** (KHÔNG Expo), pin **RN 0.85** khớp lib `@cool-bath/tuya-react-native`
  (CRNL sinh lib ở RN 0.85) để link/autolink mượt.
- **2026-06-29** — `replit_generate/` chỉ dùng làm **tham chiếu UI/theme**; bỏ hết `expo-*`.
- **2026-06-30 (B6)** — Lib đổi tên **`@jimmy-vu/react-native-turbo-tuya`** (không còn `@cool-bath`). Repo **KHÔNG có
  root workspace** → app standalone → link bằng **`file:` dep** + metro `watchFolders`+`extraNodeModules`(dedupe React)+
  `unstable_enablePackageExports`/condition `react-native-turbo-tuya-source` (đọc `src` lib trực tiếp, khỏi `bob build`).
- **2026-06-30 (B6)** — **Adapter `src/services/tuya.ts` dùng `require` trong try/catch + mock fallback** thay vì import
  tĩnh: lib `index.tsx` gọi `getEnforcing`/`new NativeEventEmitter` NGAY lúc import → JS-only (Metro chưa build native)
  sẽ crash. Adapter cho UI clone chạy được khi chưa build native, tự chuyển sang SDK thật khi native có mặt.
- **2026-06-30 (B6)** — `useAppState` device-state nối Tuya qua adapter (initSdk/getDeviceSnapshot/publishDps/
  onDeviceStatus), **giữ NGUYÊN chữ ký return** (chỉ `connectDevice` thành async) → screens không phải sửa. DP-id ở
  `src/services/dp.ts` là **placeholder** (chưa có DP schema bồn thật). `devId` để rỗng → mock; pairing thật = feature sau.

## Bản đồ file/module
| File | Vai trò |
|---|---|
| `apps/mobile/` | ✅ app RN CLI (RN 0.85.0, scaffolded B1) — App.tsx, metro/babel, android/, ios/ |
| `apps/mobile/src/theme/` | (B3) design tokens + ThemeContext |
| `apps/mobile/src/state/` | (B3) levels/techniques/useAppState |
| `apps/mobile/src/components/` | (B3/B4) Breathing/Water circle, buttons, StatCard, ProgressDots |
| `apps/mobile/src/screens/` | (B4) Home/Breathwork/Session/Completion/Progress/Splash |
| `apps/mobile/src/screens/onboarding/` | (B5) Welcome/Email/Name/Why/Experience/Device |
| `apps/mobile/App.tsx` | (B5) router switch `navigate()` + ThemeProvider (đã bỏ Font.loadAsync) |
| `apps/mobile/src/navigation.ts` | (B4) ScreenName + Navigate type (router tự viết) |
| `apps/mobile/src/state/levels.test.ts` | (B5) unit test pure-logic (thay App.test boilerplate) |
| `apps/mobile/src/services/tuya.ts` | (B6) adapter Tuya: require try/catch + mock; initSdk/readDevice/setTargetTemp/setLight/listenDevice |
| `apps/mobile/src/services/dp.ts` (+`.test.ts`) | (B6) hằng DP-id (placeholder) + parse/build dps |
| `apps/mobile/metro.config.js` | (B6) watchFolders lib + dedupe React + package-exports condition |
| `apps/mobile/package.json` | (B6) +`file:` dep `@jimmy-vu/react-native-turbo-tuya` |
| `packages/tuya-react-native` | lib native được link qua `file:` dep (B6) |
| `replit_generate/` | UI prototype (Expo) — nguồn tham chiếu |

## Phát hiện & cạm bẫy
- Máy hiện tại KHÔNG có Android SDK/JDK17/Xcode → build native hoãn; verify ở mức `tsc` + cấu trúc.
- Lib là workspace yarn-berry riêng; app là npm → link bằng `file:` dep + có thể cần metro `watchFolders`.

## Quyết định/port (clone UI)
- **2026-06-29** — User chọn **full port → TS modules tách** + **bundle .otf**. Cấu trúc: `src/theme`,
  `src/state`, `src/lib`, `src/components`, `src/screens` (B4/B5).
- **Font:** tải 3 .otf từ Dropbox → `assets/fonts/` + `react-native.config.js` (link bằng `npx react-native-asset`).
  Tên fontFamily dùng theo filename (`SangBleuSunrise-Regular`...) — **cần verify tên thật trên máy** khi render.
- **Bỏ `expo-font`**: RN CLI không load font runtime; font có sẵn sau khi link. App.tsx sẽ không cần Font.loadAsync.
- **Router:** giữ router tự viết `navigate(screen, params)` của replit (KHÔNG thêm react-navigation).
- `state.isDark`: replit đọc `state.isDark` nhưng `useAppState` không trả → App.tsx sẽ bơm `isDark` vào state khi render screens (`AppState = ReturnType<useAppState> & { isDark }`).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Lib: [m1-tuya-sdk-library](../m1-tuya-sdk-library/) · Research: [tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md)

## Tóm tắt khi hoàn thành
_(chưa hoàn thành)_
