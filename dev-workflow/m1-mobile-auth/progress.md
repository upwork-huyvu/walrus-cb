# Progress: Đăng nhập/đăng ký mobile — auth

> State machine của feature. `/dev` `/test` `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-mobile-auth`
- **Phase hiện tại:** `TEST` (deferred)
- **Trạng thái:** `code_done` — B1–B4 xong; verify `tsc`/`jest` + device chờ toolchain
- **Cập nhật lần cuối:** 2026-06-30

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
B1–B4 **code XONG**. `tsc`/`jest` **deferred** (no node_modules + registry 503) → đã type-review thủ công.
→ **Đề xuất:** commit feature này → khi có toolchain chạy `tsc`/`jest` → chạy **checklist thiết bị** (AC5) bên dưới.
⚠️ Google/Apple = scaffold (idToken cần native SDK build-time). Tuya account = định danh M1 (Supabase đồng bộ sau).

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 — Adapter `services/auth.ts` + mock
- [x] B2 — `AuthScreen` (login/register email) + router (`'auth'`) + Welcome wire → auth
- [x] B3 — Session gating (splash `onDone`→route theo `isLoggedIn`, logout→auth, `onSessionExpired`→auth) + `useAuth`
- [x] B4 — Google/Apple `thirdLogin` scaffold (nút trong AuthScreen) + reconcile-Supabase note (context)

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — auth adapter + mock *(tsc deferred)*
- [x] AC2 — AuthScreen login/register + lỗi (TuyaErrors) *(tsc/jest deferred)*
- [x] AC3 — session gating (bootstrap/logout/onSessionExpired) *(tsc deferred)*
- [x] AC4 — Google/Apple scaffold + reconcile note *(tsc deferred)*
- [ ] AC5 — login/register thật trên thiết bị · ⏳ deferred (build + Tuya account)

## Checklist thiết bị (AC5 — chạy khi có build) ⏳
- [ ] Register email: nhận OTP → tạo account → vào Home.
- [ ] Login email + password → Home.
- [ ] Phiên persist: kill app → mở lại → vẫn Home (isLoggedIn=true, bỏ splash→onboarding).
- [ ] Logout (Home → "Sign out") → về AuthScreen.
- [ ] Phiên hết hạn (đổi pwd ở nơi khác / xoá account) → app tự về AuthScreen.
- [ ] Google/Apple: sau khi wire native SDK (idToken) → thirdLogin → Home.
- [ ] Tuya account sau login là **Owner** của Home (pairing hoạt động).

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-30 | TEST B1–B4 | ⏳ | `tsc`/`jest` deferred (no node_modules+503). Type-review thủ công: import resolve, type khớp. Device checklist chờ build. |
| 2026-06-30 | DEV B1–B4 | ✅ | auth.ts adapter+mock · AuthScreen login/register+social · navigation `'auth'` · SplashScreen `onDone` · useAuth · App gating+onSessionExpired+logout · HomeScreen "Sign out" · Welcome→auth. |
| 2026-06-30 | PLAN | ✅ | Tạo plan/context/progress + INDEX. App chưa có auth; lib Auth đã wired 2 nền tảng. 4 bước. |

## Vấn đề đang chặn (Blockers)
- Định danh kép Supabase↔Tuya: chốt M1 = Tuya account; đồng bộ sau (cần xác nhận client).
- Google/Apple idToken cần native SDK (`@react-native-google-signin` + Apple Auth, build-time) → B4 scaffold.
- node_modules + registry 503 + build native → `tsc`/`jest` + AC5 device deferred.
