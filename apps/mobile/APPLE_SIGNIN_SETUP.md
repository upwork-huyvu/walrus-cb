# Sign in with Apple — setup checklist (mobile iOS)

> Để nút **"Continue with Apple"** đăng nhập được (qua Tuya `loginByAuth2WithType:@"ap"`).
> Research: [docs/research/tuya-ios-third-party-login.md](../../docs/research/tuya-ios-third-party-login.md).
> Code phía app + lib đã XONG (B1–B4). Còn lại = capability + việc console + build iOS (Mac).

## Nguyên tắc 1 phút
- Apple Sign In = **iOS 13+** (Android cần web-flow → **ngoài scope M1**).
- App lấy **`identityToken` (JWT)** từ `@invertase/react-native-apple-authentication` →
  truyền vào Tuya `thirdLogin(identityToken, 'ap', extraInfo)` (bridge iOS gọi
  `loginByAuth2WithType:@"ap" ...`, extraInfo = NSDictionary `{userIdentifier,email,nickname,snsNickname}`).
- Apple chỉ trả **email + fullName LẦN ĐẦU** user authorize → code đã lấy ngay và nhét vào extraInfo.

## 1) Xcode — bật capability "Sign in with Apple"  (dev, cần Mac)
- File entitlement đã tạo sẵn: [ios/CoolBathMobile/CoolBathMobile.entitlements](ios/CoolBathMobile/CoolBathMobile.entitlements)
  (`com.apple.developer.applesignin = [Default]`).
- Mở `ios/CoolBathMobile.xcodeproj` → target **CoolBathMobile** → **Signing & Capabilities** →
  **+ Capability** → **Sign in with Apple**. Thao tác này tự set `CODE_SIGN_ENTITLEMENTS` trỏ tới
  file entitlements trên (nếu làm tay: thêm `CODE_SIGN_ENTITLEMENTS = CoolBathMobile/CoolBathMobile.entitlements;`
  vào cả build config Debug **và** Release trong pbxproj).
- `pod install` trong `ios/` để autolink `RNAppleAuthentication`.

## 2) Apple Developer portal  (client — cần Apple Developer Program trả phí)
- **Certificates, Identifiers & Profiles → Identifiers → App ID `com.walrus.wellness`** → bật
  **Sign in with Apple** (Enable as a primary App ID).
- Tạo lại/để Xcode tự tạo **Provisioning Profile** có capability này.
- (Chỉ cần nếu sau này làm Android/web Apple: tạo **Services ID** + Return URL — hiện KHÔNG cần.)

## 3) Tuya Developer Platform
- OEM App → Optional Setting → **Third-Party Login Support** → cấu hình Apple (App ID/Team ID/Key
  theo yêu cầu Tuya). Data Center = Central Europe (khớp Cloud Project).

## 4) Verify (device — AC6, cần iPhone thật, iOS 13+)
- [ ] Bấm "Continue with Apple" → hiện Apple sheet (Face ID / mật khẩu Apple ID).
- [ ] Authorize → nhận `identityToken` → `thirdLogin('ap')` OK → vào **Home**.
- [ ] Tuya account sau login là **Owner** của Home (pairing chạy).
- [ ] Huỷ Apple sheet → KHÔNG hiện lỗi (im lặng — code nuốt `CANCELLED`).
- [ ] Kill app → mở lại → vẫn Home (phiên persist).

## Ai làm gì
| # | Việc | Ai |
|---|---|---|
| 1 | Bật capability "Sign in with Apple" trong Xcode + `pod install` | Dev (Mac) |
| 2 | Bật Sign in with Apple trên App ID `com.walrus.wellness` (Apple Developer Program) | Client |
| 3 | Cấu hình Apple ở Tuya Third-Party Login Support | Client |
| 4 | Build iOS + test thiết bị | Dev (Mac) |

## Lưu ý kỹ thuật (đã xử trong code)
- `services/appleAuth.ts`: `signInApple()` → `{identityToken,user,email,fullName}`; guard iOS-only
  (`appleAvailable`), mock trong Metro; lỗi có mã (`CANCELLED`/`NOT_SUPPORTED`/`NO_ID_TOKEN`).
- `services/auth.ts`: `thirdLogin(token,'ap',extra)` build extraInfo JSON từ credential.
- `packages/tuya-react-native/ios/Auth/TuyaAuth.mm`: `thirdLogin` → `loginByAuth2WithType:` +
  `NSJSONSerialization` parse extraInfo string → NSDictionary. **⚠️ verify chữ ký selector +
  kiểu accessToken trong `ThingSmartUser.h` khi build.**
