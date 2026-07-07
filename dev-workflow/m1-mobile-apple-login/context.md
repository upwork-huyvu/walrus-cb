# Context: Đăng nhập bằng Apple (Sign in with Apple) - mobile iOS

> File "trí nhớ" - giữ context xuyên suốt các phiên. Ghi mọi quyết định/phát hiện/cạm bẫy.

- **Slug:** `m1-mobile-apple-login`

## Quyết định kỹ thuật (Decision log)
- **2026-07-02** - Tách feature riêng, song song `m1-mobile-google-login`; scope **iOS-only** (Apple
  Sign In bản chất iOS; Android cần web-flow → out of scope M1). Lý do: user muốn test cả 2 cùng lúc.
- **2026-07-02** - Lib: `@invertase/react-native-apple-authentication` (chuẩn RN CLI cho Sign in with
  Apple). idToken cần từ native (build-time).
- **2026-07-02** - **iOS native `thirdLogin` phải implement** (đang stub) - đưa vào feature này (B4) vì
  Apple không chạy được nếu thiếu; đồng thời **unblock Google iOS**. Cần `/tuya-research` selector.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/appleAuth.ts` ✅ | (B2) `signInApple()`→`{identityToken,user,email,fullName}` + `appleAvailable` (iOS-only qua `authAvailable`) + `AppleSignInError` + mock |
| `apps/mobile/src/services/appleAuth.test.ts` ✅ | (B2) jest 5 case: mock/not-supported/success/cancel/no-token |
| `apps/mobile/src/services/auth.ts` ✅ | (B3) `thirdLogin(token,'ap',extra)` - build extraInfo JSON từ credential (userIdentifier/email/nickname/snsNickname) |
| `apps/mobile/src/screens/AuthScreen.tsx` ✅ | (B3) `doThird('ap')`→`signInApple()`→`thirdLogin(idToken,'ap',extra)`; run nuốt CANCELLED (Google+Apple) |
| `packages/tuya-react-native/ios/Auth/TuyaAuth.mm` ✅ | (B4) `thirdLogin`→`loginByAuth2WithType:` + `NSJSONSerialization` parse extraInfo→NSDictionary (bỏ stub; unblock Google iOS) |
| `packages/tuya-react-native/android/.../auth/TuyaAuthModule.kt` | (tham chiếu) `thirdLogin` pass-through - mẫu cho iOS |
| `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements` ✅ | (B5) `com.apple.developer.applesignin = [Default]` |
| `apps/mobile/APPLE_SIGNIN_SETUP.md` ✅ | (B5) checklist Xcode capability + App ID + Tuya + ai-làm-gì |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **iOS `thirdLogin` = TODO stub** (`TuyaAuth.mm:106` → `TuyaTODO`) → **Google + Apple trên iOS đều
  chưa chạy native**. Android `thirdLogin` OK (pass-through). Đây là prereq lớn nhất.
- **Chưa có entitlements iOS** (không file `.entitlements`, pbxproj không có `applesignin`).
- **Chưa có dep Apple** trong package.json.
- **Chưa có research note Apple** - chỉ có dòng Apple `ap` trong bảng provider
  [tuya-google-login.md](../../docs/research/tuya-google-login.md). Selector iOS + token type chưa chắc.
- `auth.ts.thirdLogin` dùng `DEFAULT_COUNTRY='49'` cứng + extraInfo `''` cho 'ap' - verify qua research.
- Không build iOS được ở môi trường này (cần Mac + pod) → B4/AC4 + AC6 chỉ code + review.

## Cập nhật research (2026-07-02) - B4 hết mù mờ
- ✅ Đã research: [tuya-ios-third-party-login.md](../../docs/research/tuya-ios-third-party-login.md).
  Chốt: iOS selector = **`loginByAuth2WithType:countryCode:accessToken:extraInfo:success:failure:`**
  (KHÔNG phải `thirdLogin`). Apple `type=@"ap"`, token=**identityToken** (JWT), `extraInfo`=**NSDictionary**
  `{userIdentifier,email,nickname,snsNickname}`. Google `type=@"gg"`, `@{@"pubVersion":@1}`.
- ⚠️ **iOS `extraInfo` = NSDictionary** (Android/JS truyền String) → bridge phải `NSJSONSerialization`
  parse String→NSDictionary. Đây là điểm phải cẩn thận ở B4.
- ⚠️ `accessToken:` có thể là NSString → convert `identityToken` (NSData) → NSString UTF8; verify header.
- ⚠️ Apple chỉ trả email/fullName **lần đầu** → appleAuth trả các field này → build extraInfo (chỉnh
  `auth.ts` cho 'ap' ở B5, cho phép truyền extraInfo động).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Research: [tuya-ios-third-party-login.md](../../docs/research/tuya-ios-third-party-login.md) ✅
- Feature liên quan: [[m1-mobile-google-login]] (chung prereq iOS thirdLogin) · [[m1-mobile-auth]]

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa hoàn thành>
