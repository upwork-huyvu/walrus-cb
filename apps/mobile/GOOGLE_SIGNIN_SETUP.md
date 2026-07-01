# Google Sign-In — setup checklist (mobile)

> Để nút **"Continue with Google"** đăng nhập được (qua Tuya `thirdLogin(idToken, 'gg')`).
> Nền tảng research: [docs/research/tuya-google-login.md](../../docs/research/tuya-google-login.md).
> Code phía app đã XONG (B1–B4). Còn lại = điền client id + việc console.

## Nguyên tắc 1 phút
- Tuya **không** tự lấy Google `idToken` — app tự lấy qua `@react-native-google-signin`, rồi
  truyền vào `thirdLogin(idToken, 'gg')`.
- `idToken` có **audience = Web Client ID** trên CẢ Android + iOS → 1 Web Client ID dùng chung,
  và cũng chính là cái dán vào Tuya console.
- OAuth **Client ID** là định danh **public** (không phải secret) → commit thẳng vào
  `src/config/google.ts`. Google Sign-In mobile **không dùng client secret**.

## 1) Google Cloud Console — 1 project, tạo 3 OAuth client
| Client | Định danh bằng | Dùng để |
|---|---|---|
| **Web** ⭐ | (không cần native) | `webClientId` — idToken audience; **dán vào Tuya** (cả 2 nền) |
| **Android** | package `com.walrus.wellnesscb` + **SHA-1** | Google verify app Android (KHÔNG điền vào code) |
| **iOS** | Bundle ID `com.walrus.wellness` | Google verify app iOS + reversed-id URL scheme |

- OAuth Consent Screen: user type **External**.
- SHA-1 (Android): debug + release — lấy trong [android/SIGNING.md](android/SIGNING.md).
  Phải **khớp** SHA đã đăng ký trên Tuya.

## 2) Điền client id (dev) — public, commit thẳng
Sửa [src/config/google.ts](src/config/google.ts):
```ts
export const GOOGLE_WEB_CLIENT_ID = '<web-id>.apps.googleusercontent.com'; // BẮT BUỘC type WEB
export const GOOGLE_IOS_CLIENT_ID = '<ios-id>.apps.googleusercontent.com';
```
> ⚠️ `GOOGLE_WEB_CLIENT_ID` sai type (không phải WEB) → `idToken = null` → lỗi `NO_ID_TOKEN`.
> Android client id **không** điền ở đây — Google tự khớp qua package + SHA-1.

## 3) iOS — URL scheme + openURL handler
- **URL scheme (đã có placeholder):** trong [ios/CoolBathMobile/Info.plist](ios/CoolBathMobile/Info.plist)
  thay `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID` bằng **reversed iOS client id** thật
  (đảo `GOOGLE_IOS_CLIENT_ID`: `com.googleusercontent.apps.<phần trước .apps...>`).
- **openURL handler (làm khi build trên Mac):** thêm vào `ios/CoolBathMobile/AppDelegate.swift`:
  ```swift
  import GoogleSignIn
  func application(_ app: UIApplication, open url: URL,
                   options: [UIApplication.OpenURLOptionsKey : Any] = [:]) -> Bool {
    return GIDSignIn.sharedInstance.handle(url)
  }
  ```
  (Chưa thêm sẵn vì import `GoogleSignIn` cần `pod install` mới compile được — làm lúc dựng iOS.)
- `pod install` trong `ios/` để autolink `RNGoogleSignin`.

## 4) Tuya Developer Platform — dán Web Client ID
App → OEM App → Optional Setting → Third-Party Integration → **Login Configuration**:
- **for Android** → Client ID for Google = **Web Client ID**
- **for iOS** → Client ID for Google = **Web Client ID** (GIỐNG hệt)

## 5) Verify (device — AC6)
- [ ] Bấm Google → hiện account picker → chọn → vào **Home**.
- [ ] Tuya account sau login là **Owner** của Home (pairing chạy).
- [ ] Client id trống/sai → báo lỗi rõ (`NO_CONFIG`/`NO_ID_TOKEN`/`DEVELOPER_ERROR`), không crash.

## Ai làm gì
| # | Việc | Ai |
|---|---|---|
| 1 | Tạo 3 OAuth client (Google Cloud) + SHA-1 | Client |
| 2 | Điền `src/config/google.ts` + reversed id vào Info.plist | Dev |
| 3 | Dán Web Client ID vào Tuya (Android + iOS) | Client |
| 4 | `AppDelegate` openURL + `pod install` + build iOS | Dev (trên Mac) |
