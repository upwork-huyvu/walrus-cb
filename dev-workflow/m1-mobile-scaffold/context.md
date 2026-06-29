# Context: Mobile scaffold — RN CLI app + link lib Tuya + port UI

- **Slug:** `m1-mobile-scaffold`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** — App = **RN CLI** (KHÔNG Expo), pin **RN 0.85** khớp lib `@cool-bath/tuya-react-native`
  (CRNL sinh lib ở RN 0.85) để link/autolink mượt.
- **2026-06-29** — `replit_generate/` chỉ dùng làm **tham chiếu UI/theme**; bỏ hết `expo-*`.

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
| `packages/tuya-react-native` | lib native được link (B2) |
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
