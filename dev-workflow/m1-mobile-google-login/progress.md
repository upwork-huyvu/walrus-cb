# Progress: Đăng nhập bằng Google (wire idToken thật) — mobile

> State machine của feature. `/dev` `/test` `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.
> Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-mobile-google-login`
- **Phase hiện tại:** `TEST` (code B1–B4 done; B5/AC6 device deferred)
- **Trạng thái:** `in_progress` (code_done — chờ commit + device)
- **Cập nhật lần cuối:** 2026-07-01

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B1–B4 code XONG + config ĐÃ ĐIỀN** (google.ts WEB=`rh83..`/iOS=`vnig..`; Info.plist reversed id) ·
verified tsc 0 · jest 39/39 · plist OK. Còn **B5/AC6 device**: (1) xác nhận **Tuya console** dán Web id
`rh83..` (không phải `vkcr..`); (2) iOS `AppDelegate` openURL + `pod install` + build (Mac); (3) chạy
checklist AC6. → **Đề xuất commit** (nhớ `git add` googleAuth.ts + test + GOOGLE_SIGNIN_SETUP.md).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 — Install + link native package · **done** (v16.1.2, autolink OK, tsc clean)
- [x] B2 — Helper `services/googleAuth.ts` (`configureGoogle` + `signInGoogle`) · **done** (jest 5/5)
- [x] B3 — Nối `AuthScreen.doThird('gg')` → idToken thật · **done** (run nuốt CANCELLED; 'ap' vẫn scaffold)
- [x] B4 — Cấu hình native (iOS URL scheme + doc console) · **done** (Info.plist CFBundleURLTypes + GOOGLE_SIGNIN_SETUP.md; plist lint OK)
- [ ] B5 — E2E thật (deferred — chờ client + build) · blocked
- [ ] B5 — E2E thật (deferred — chờ client + build) · blocked

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 — install + autolink OK (`tsc` resolve, `rn config` thấy module) ✅
- [x] AC2 — helper `googleAuth.ts` (`configureGoogle` + `signInGoogle`→idToken) ✅
- [x] AC3 — `doThird('gg')` dùng idToken thật (không còn `''`); mock/dev vẫn chạy ✅ *(round-trip thật chờ AC6)*
- [x] AC4 — client ID rỗng → lỗi rõ (NO_CONFIG), không crash; `tsc`/`jest`/`eslint` sạch ✅ *(device chờ AC6)*
- [x] AC5 — iOS URL scheme + doc setup console đầy đủ ✅ (Info.plist + GOOGLE_SIGNIN_SETUP.md)
- [ ] AC6 — device: Google → Home; Tuya account = Owner Home *(deferred — BLOCKED chờ client console + build)*

## Checklist thiết bị (AC6 — chạy khi có build + client ID + console) ⏳
- [ ] Bấm "Continue with Google" → hiện account picker Google.
- [ ] Chọn account → nhận idToken → `thirdLogin` OK → vào **Home**.
- [ ] Tuya account sau login là **Owner** của Home (pairing hoạt động).
- [ ] Client ID trống/sai → báo lỗi rõ (không crash trần).
- [ ] Kill app → mở lại → vẫn Home (phiên persist).

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-02 | config fill + secret-hygiene | ✅ | Client bỏ file OAuth vào `assets/google/`. Rút id public → điền `google.ts` (WEB=`rh83..` **sửa lỗi điền nhầm `vkcr..`=Desktop**, iOS=`vnig..`) + Info.plist reversed id. **XOÁ 3 file raw** (1 file `web` có `client_secret` — untracked nên sạch, không cần rotate) + gitignore `**/client_secret*.json`. tsc 0 · jest 39/39 · plist OK. **Cần xác nhận Tuya console dùng Web id `rh83..`.** |
| 2026-07-01 | DEV+TEST B4 | ✅ | Info.plist +`CFBundleURLTypes` (reversed iOS client id placeholder) · tạo `apps/mobile/GOOGLE_SIGNIN_SETUP.md` (Google Cloud 3 client + fill google.ts + iOS URL scheme/openURL + Tuya console + ai-làm-gì). `plutil -lint` OK. AppDelegate openURL để làm lúc build iOS (cần pod). → AC5 đạt. **B1–B4 code XONG.** |
| 2026-07-01 | env-config audit | 📋 | Workflow map toàn bộ env: mobile KHÔNG có `.env`; config = TS const public + secrets.properties/xcconfig native. **Lòi LEAK:** `docs/sdk/keys.txt` track trong git (secret thật) → user hoãn ("tự lo"), ghi memory [[keys-txt-leak-deferred]]. Ghi context. |
| 2026-07-01 | DEV+TEST B3 | ✅ | `AuthScreen`: import `signInGoogle`; `doThird('gg')`→`signInGoogle()`→`thirdLogin(idToken,'gg')` (thay `''`); `run` nuốt `GoogleSignInError.CANCELLED` + dùng `.message` cho lỗi Google (không mangle qua TuyaErrors). Apple vẫn scaffold. `tsc` 0 · `eslint` 0 err (warn no-inline-styles pre-existing) · `jest` 39/39. → AC3 đạt. |
| 2026-07-01 | DEV+TEST B2 | ✅ | Viết `services/googleAuth.ts` (`configureGoogle`+`signInGoogle`+`signOutGoogle`+`GoogleSignInError`) theo pattern require try/catch của auth.ts. Nối `configureGoogle()` vào `App.tsx` cạnh `initSdk()`. `tsc` 0 · `eslint` 0 err (2 warn cosmetic) · viết `googleAuth.test.ts` **jest 5/5** · full suite **39/39**. → AC2+AC4 đạt. |
| 2026-07-01 | FIX node_modules | 🔧 | **Chệch khỏi plan:** `node_modules/@react-native-google-signin` sót rác/đệ quy từ thời "503/Nexus" (thư mục lồng RN-app, `du` treo, cài lại bất nhất). Fix: `npm install` (884 pkg) ghi đè sạch → `require.resolve` OK, 16 `.d.ts` thật, tsc resolve. Quirk `du` treo còn nhưng `find`/resolve/tsc đều xanh → không phải blocker. |
| 2026-07-01 | DEV+TEST B1 | ✅ | `npm install` → added 5 packages, google-signin **16.1.2** vào node_modules. `npx react-native config` thấy module (android sourceDir + ios present). `tsc --noEmit` exit 0. Warn `EBADENGINE` (node v20.20.2 < required 22.11) — non-fatal. → **AC1 đạt.** |
| 2026-07-01 | PLAN | ✅ | Tạo plan/context/progress + đăng ký INDEX. 5 bước (B1–B5). Đầu vào: dep có nhưng chưa install, client ID trống, `doThird` còn `''`. Chờ Gate ①. |

## Vấn đề đang chặn (Blockers)
- **AC6/B5 BLOCKED** — chờ **client** tạo OAuth client (Google Cloud) + dán Web Client ID vào
  Tuya console (Android + iOS) + SHA-1 khớp; và cần build native (Mac cho iOS). B1–B4 không bị chặn.
