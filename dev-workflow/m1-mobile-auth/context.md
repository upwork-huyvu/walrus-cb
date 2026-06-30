# Context: Đăng nhập/đăng ký mobile — auth

- **Slug:** `m1-mobile-auth`
- **Liên kết → Research:** [user-account](../../docs/research/tuya-home-sdk-user-account.md) · [cloud user-management](../../docs/research/tuya-cloud-user-management.md)

## Quyết định kỹ thuật (Decision log)
- **2026-06-30** — **Tuya account là định danh thiết bị cho M1 mobile** (email register/login + thirdLogin gg/ap). Lý do: Tuya account phải là **Owner** của Home để pairing/điều khiển. Supabase (app auth track C) đồng bộ sau (cùng email / backend map uid). → gỡ giả định "đã login" của pairing (`ensureHome` vẫn cần homeId; home-setup là feature B3 riêng).
- **2026-06-30** — Adapter `services/auth.ts` theo pattern pairing/tuya: `require` try/catch + **mock fallback** (UI auth chạy trong Metro chưa build native; `isLoggedIn` mock=false để test luồng login).
- **2026-06-30** — Google/Apple: scaffold `thirdLogin(idToken, 'gg'|'ap')`; **idToken cần native SDK** (`@react-native-google-signin` + Apple Auth) → build-time, deferred.

## Bản đồ file/module (đã code B1–B4)
| File | Vai trò |
|---|---|
| `apps/mobile/src/services/auth.ts` ✅ | (B1) adapter Tuya Auth + mock + `onSessionExpired` + `describeError` |
| `apps/mobile/src/screens/AuthScreen.tsx` ✅ | (B2/B4) tab login↔register email (OTP) + nút Google/Apple (`doThird` scaffold) |
| `apps/mobile/src/state/useAuth.ts` ✅ | (B3) `useAuth`: user + status(checking/authed/guest) + bootstrap/onAuthed/signOut/reset |
| `apps/mobile/src/navigation.ts` ✅ | (B2) +`'auth'` |
| `apps/mobile/src/screens/SplashScreen.tsx` ✅ | (B3) Props đổi `navigate`→`onDone()` (gọi khi anim xong, guard `finished`) — App tự route |
| `apps/mobile/App.tsx` ✅ | (B2/B3) case `auth`; bootstrap + `onSessionExpired`→auth; routing 1-lần sau splash (`routed` ref); logout |
| `apps/mobile/src/screens/HomeScreen.tsx` ✅ | (B3) +prop `onSignOut` + nút "Sign out" (sau theme-switch) |
| `apps/mobile/src/screens/onboarding/OnboardWelcomeScreen.tsx` ✅ | (B2) 3 nút Google/Apple/email → `navigate('auth')` |

## Quyết định thêm (2026-06-30)
- **Gating không cắt splash, không race:** Splash phát `onDone` khi anim xong → App set `splashDone`; effect route **1 lần** (`routed` ref) khi `splashDone && status!=='checking'` → `home`(authed)/`onboard-welcome`(guest). Login/logout/expired sau đó route **tường minh** (không để effect status-watcher ghi đè).
- **OnboardEmailScreen** thành orphan (Welcome không trỏ nữa) nhưng để lại (không hại). Onboarding marketing (name/why/experience) vẫn ở giữa welcome→...; auth là hub riêng.

## Phát hiện & cạm bẫy
- App hiện **chưa có auth nào** (onboarding chỉ thu email string vào UI flow; không Supabase client).
- Lib Tuya Auth đã wired 2 nền tảng (loginByEmail/registerByEmail/sendVerifyCode/loginWithEmailCode/thirdLogin/isLoggedIn/getCurrentUser/logout/onSessionExpired).
- Tiền đề: Data Center đúng (lib native) + Tuya account = Owner Home.
- getEnforcing crash chưa build native → bắt buộc mock adapter.
