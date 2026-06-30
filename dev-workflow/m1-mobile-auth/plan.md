# Kế hoạch: Đăng nhập/đăng ký mobile (Tuya account + 3rd-party)

> `/plan` tạo, `/fix-plan` chỉnh. Nguồn sự thật "định làm gì".

- **Slug:** `m1-mobile-auth`
- **Milestone:** M1 — Part B2 (mobile)
- **Phần:** mobile (RN CLI `apps/mobile`) — dùng lib `@jimmy-vu/react-native-turbo-tuya` (Auth đã wired 2 nền tảng).
- **Ngày tạo:** 2026-06-30
- **Research:** [user-account](../../docs/research/tuya-home-sdk-user-account.md) · [third-party login](../../docs/research/tuya-cloud-user-management.md)

## 1. Mục tiêu & phạm vi
Màn **đăng nhập/đăng ký** thật cho app (hiện chưa có — onboarding chỉ thu email vào UI). Sau auth, user có
**Tuya account** (định danh sở hữu Home cho pairing/điều khiển). Gồm: email register (OTP) + email login,
nút Google/Apple (scaffold), **session gating** (splash → đã login? → home : auth), logout, xử lý hết hạn phiên.

**Trong phạm vi:**
- Adapter `services/auth.ts` (wrap Tuya Auth + mock fallback như pairing/tuya): sendEmailCode/registerEmail/loginEmail/loginEmailCode/thirdLogin/isLoggedIn/getCurrentUser/logout + onSessionExpired.
- `AuthScreen` (login ↔ register email, OTP cho register) + nút Google/Apple (scaffold) + lỗi qua TuyaErrors.
- Session gating ở `App.tsx` (splash check `isLoggedIn`; logout → auth; `onSessionExpired` → auth) + lưu current user vào state.

**Ngoài phạm vi:**
- **Reconcile Supabase** (app auth Email/Google/Apple) với Tuya account — quyết định kiến trúc (xem Rủi ro); M1 mobile dùng **Tuya account làm định danh thiết bị**, Supabase để backend/sau.
- Native Google/Apple SDK (lấy `idToken`) — build-time, deferred (scaffold thirdLogin).
- Reset password đầy đủ (lib có; làm sau nếu cần).

## 2. Bối cảnh & ràng buộc
- **Tuya account = chủ Home** (Owner) cho pairing/điều khiển (tuya-sdk checklist). Email type: 1 register, 2 login, 3 reset.
- thirdLogin: `gg`=Google/`ap`=Apple/`fb`=Facebook; Google cần `extraInfo='{"pubVersion":1}'`; token = `idToken` từ SDK Google/Apple.
- Data Center SDK = Cloud Project (Central/Western Europe) — cố định ở lib (native).
- `getEnforcing` crash khi chưa build native → adapter `require` try/catch + mock (UI auth chạy được trong Metro).
- RN CLI; router tự viết; không react-navigation.

## 3. Tiêu chí hoàn thành (AC)
- [ ] AC1: `services/auth.ts` expose sendEmailCode/registerEmail/loginEmail/loginEmailCode/thirdLogin/isLoggedIn/getCurrentUser/logout + `onSessionExpired` + mock fallback; `tsc`.
- [ ] AC2: `AuthScreen` — toggle **login ↔ register**; register: gửi OTP → `registerEmail`; login: `loginEmail` (password) hoặc `loginEmailCode`; lỗi hiển thị (TuyaErrors); routed; `tsc`/`jest`.
- [ ] AC3: **Session gating** — splash gọi `isLoggedIn()` → `home` nếu đã login, ngược lại `auth`; `logout` → `auth`; `onSessionExpired` → `auth` (kèm thông báo). `tsc`.
- [ ] AC4: nút **Google/Apple** gọi `thirdLogin(gg/ap, idToken)` — scaffold (idToken từ native SDK = TODO); reconcile-Supabase **documented**; `tsc`.
- [ ] AC5 (device/live): login/register thật trên thiết bị + Tuya account sở hữu Home → ⏳ deferred (build + account thật).

## 4. Các bước thực hiện
1. **B1 — Adapter `services/auth.ts`** (require + mock). Hàm: `sendEmailCode(email,country,type)`, `registerEmail(country,email,pwd,code)`, `loginEmail(country,email,pwd)`, `loginEmailCode(country,email,code)`, `thirdLogin(token,type)`, `isLoggedIn()`, `getCurrentUser()`, `logout()`, `onSessionExpired(cb)`, `describeError(e)`. Mock: `isLoggedIn=false`; login/register resolve user giả.
   - File: `apps/mobile/src/services/auth.ts`. Test: `tsc` + (jest mock-path).
2. **B2 — `AuthScreen` + router**. UI: tab login/register, fields email/password(/country/OTP); register gửi OTP rồi `registerEmail`; login `loginEmail`; nút Google/Apple (B4). `navigation.ts` +`'auth'`; `App.tsx` case; Welcome "Sign in/Get started" → `auth`.
   - File: `src/screens/AuthScreen.tsx`, `navigation.ts`, `App.tsx`, `OnboardWelcomeScreen.tsx`. Test: `tsc`/`jest`.
3. **B3 — Session gating + current user state**. `App.tsx` splash effect: `await isLoggedIn()` → set screen `home`|`auth`; `useAuth` (hoặc useAppState) giữ `user`; `logout()` → clear + `auth`; subscribe `onSessionExpired` → `auth`.
   - File: `App.tsx`, `src/state/useAuth.ts` (hoặc mở rộng useAppState). Test: `tsc`.
4. **B4 — Google/Apple thirdLogin (scaffold) + reconcile note**. Nút gọi `thirdLogin`; lấy `idToken` = TODO (cần `@react-native-google-signin` + Apple Auth, build-time). Ghi quyết định Supabase↔Tuya vào context.
   - File: `AuthScreen.tsx`, `auth.ts`, context. Test: `tsc`.

## 5. Rủi ro & câu hỏi mở
- ❓ **Định danh kép (Supabase vs Tuya):** ai sở hữu Home? **Chốt M1:** Tuya account (email/3rd-party) = định danh thiết bị; Supabase là app/backend (đã có ở track C) → có thể đồng bộ sau (cùng email / backend map uid↔tuyaUid). Cần xác nhận với client.
- ⚠️ **Google/Apple idToken** cần native SDK (`@react-native-google-signin/google-signin`, Apple Authentication) + cấu hình OAuth → build-time, deferred. B4 chỉ scaffold luồng thirdLogin.
- ⚠️ getEnforcing/mock + node_modules/registry 503 → AC1–AC4 verify `tsc`/`jest` khi có toolchain; AC5 device deferred.
- ❓ **Country code**: field nhập tay (default EU) hay picker — M1 để field default '49', cải tiến sau.
- ⚠️ Login email **password vs OTP**: lib có cả `loginEmail`(password) + `loginEmailCode`(OTP). M1 ưu tiên password; OTP login optional.
