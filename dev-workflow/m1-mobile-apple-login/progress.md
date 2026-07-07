# Progress: Đăng nhập bằng Apple (Sign in with Apple) - mobile iOS

> State machine của feature. `/dev` `/test` `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-mobile-apple-login`
- **Phase hiện tại:** `TEST` (code B1–B5 done; B6/AC6 device deferred)
- **Trạng thái:** `in_progress` (code_done - chờ Mac build + console)
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B1–B5 code XONG + verified** (tsc 0 · eslint 0 err · jest 44/44 · plist OK · TuyaAuth.mm cân đối,
stub→`loginByAuth2WithType`). Còn **B6/AC6 device**: (1) Xcode bật capability "Sign in with Apple" +
`pod install`; (2) client bật App ID capability (Apple Dev Program) + Tuya Third-Party Login Support;
(3) build iOS trên Mac + chạy checklist AC6. → **Đề xuất commit** (nhớ `git add` appleAuth.ts + test +
entitlements + APPLE_SIGNIN_SETUP.md). **B4 cũng unblock Google iOS.**

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Install `@invertase/react-native-apple-authentication@2.5.1` · **done** (autolink iOS+Android, tsc clean; npm treo → kill, package đầy đủ)
- [x] B2 - Helper `services/appleAuth.ts` (`signInApple`→identityToken+fields) · **done** (jest 5/5; +sửa tsc module-scope googleAuth.test)
- [x] B3 - Nối `AuthScreen.doThird('ap')` + `auth.ts` extraInfo Apple · **done** (run nuốt CANCELLED)
- [x] B4 - iOS native `thirdLogin` (`loginByAuth2WithType:` + JSON→NSDictionary) · **done** (build iOS deferred)
- [x] B5 - Entitlement Sign in with Apple + `APPLE_SIGNIN_SETUP.md` · **done** (plist lint OK)
- [ ] B6 - E2E device (deferred) · blocked

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - apple-auth lib install + autolink OK ✅
- [x] AC2 - `appleAuth.ts` + jest (mock/not-supported/success/cancel/no-token) ✅ 5/5
- [x] AC3 - `doThird('ap')` dùng identityToken thật; mock/dev chạy; huỷ im lặng ✅
- [x] AC4 - iOS `TuyaAuth.mm` thirdLogin implement (bỏ TuyaTODO) ✅ *(compile iOS deferred)*
- [x] AC5 - entitlement Sign in with Apple + doc portal + extraInfo đúng ✅
- [ ] AC6 - device: Apple → Home; Tuya account = Owner *(deferred - BLOCKED Apple Dev Program + Mac)*

## Checklist thiết bị (AC6 - chạy khi có build + capability) ⏳
- [ ] Bấm "Continue with Apple" → hiện Apple sheet (Face ID/password).
- [ ] Authorize → nhận identityToken → `thirdLogin('ap')` OK → vào **Home**.
- [ ] Tuya account sau login là **Owner** của Home (pairing chạy).
- [ ] Huỷ Apple sheet → không hiện lỗi (im lặng).
- [ ] Kill app → mở lại → vẫn Home (phiên persist).

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-02 | DEV+TEST B1–B5 | ✅ | B1 install `@invertase/react-native-apple-authentication@2.5.1` (npm treo network→kill, package đầy đủ/sạch, autolink iOS+Android, tsc 0). B2 `appleAuth.ts` (`signInApple`→{identityToken,user,email,fullName}, guard iOS-only qua `authAvailable`, mock; jest 5/5) + sửa tsc module-scope 2 test file. B3 `doThird('ap')`→`signInApple`→`thirdLogin(idToken,'ap',extra)` + `auth.ts` build extraInfo Apple; run nuốt CANCELLED. B4 `TuyaAuth.mm thirdLogin`→`loginByAuth2WithType:` + `NSJSONSerialization` parse extraInfo→NSDictionary (bỏ stub; unblock Google iOS). B5 entitlement `com.apple.developer.applesignin` + `APPLE_SIGNIN_SETUP.md`. **tsc 0 · eslint 0 err · jest 44/44 · plist OK.** |
| 2026-07-02 | RESEARCH | ✅ | `/tuya-research` → [tuya-ios-third-party-login.md](../../docs/research/tuya-ios-third-party-login.md). Chốt selector iOS `loginByAuth2WithType:countryCode:accessToken:extraInfo:success:failure:` (Apple `ap`/identityToken/**NSDictionary** extraInfo{userIdentifier,email,nickname,snsNickname}; Google `gg`/`@{pubVersion:@1}`). **B4 hết blocker.** Cạm bẫy: extraInfo iOS=NSDictionary (phải JSON-parse ở bridge). |
| 2026-07-02 | PLAN | ✅ | Tạo plan/context/progress + đăng ký INDEX. 6 bước. **Phát hiện: iOS `thirdLogin` = stub** → cả Google+Apple iOS chưa chạy native (B4 fix, unblock cả 2). Chưa có dep/entitlement/research Apple. Chờ Gate ① + đề xuất `/tuya-research`. |

## Vấn đề đang chặn (Blockers)
- **AC6/B6 BLOCKED** - client bật "Sign in with Apple" trên App ID (Apple Developer Program trả phí) +
  build iOS trên Mac (`pod install`).
- **B4 phụ thuộc `/tuya-research`** - selector third-login iOS của Tuya chưa xác nhận.
