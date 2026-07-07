# Research: Tuya SDK có "cấu hình sẵn" Google login không?

> Ngày: 2026-07-01 · Bối cảnh: test app thấy nút "Continue with Google" ném
> `REMOTE_API_RUN_UNKNOW_FAILED`. Câu hỏi: Tuya SDK có tự lo Google login không, hay app
> phải làm thêm?

## Kết luận ngắn

**Đúng một nửa.** Tuya SDK **CÓ sẵn method** đăng nhập Google (`thirdLogin(..., "gg", ...)`),
và code app HIỆN TẠI đã gọi đúng method đó. Nhưng Tuya **KHÔNG** tự lấy Google `idToken` hộ -
**app phải tự tích hợp Google Sign-In để lấy `idToken`**, rồi mới truyền vào Tuya. Ngoài ra
phải khai báo OAuth Client ID ở **cả Google Cloud lẫn Tuya console**.

→ Vì vậy nút Google hiện lỗi: app gọi `thirdLogin('', 'gg')` với **token rỗng** (chưa wire
Google Sign-In) → Tuya cloud từ chối.

## Tuya lo phần nào (phần "có sẵn")

- Method built-in trong SDK (Android, từ **v3.19.0**):
  `ThingHomeSdk.getUserInstance().thirdLogin(countryCode, token, "gg", "{\"pubVersion\":1}", ILoginCallback)`
  - `"gg"` = Google · `token` = **Google idToken** · extraInfo `{"pubVersion":1}` cho Google.
- Tuya cloud: nhận `idToken` → verify với Google → tạo/đăng nhập tài khoản Tuya tương ứng.
- Doc: *"After authorization is successful, you pass in the token (the Google idToken) and
  extraInfo ... to achieve Google login."* → tức **authorization (lấy idToken) là việc của app**.

Code app đã đúng phần này: `apps/mobile/src/services/auth.ts` → `lib.Tuya.thirdLogin(DEFAULT_COUNTRY, token, type, extraInfo)` với `extraInfo='{"pubVersion":1}'` cho `'gg'`.

## App phải tự làm (phần Tuya KHÔNG lo)

### 1. Lấy Google idToken (native Google Sign-In) - HIỆN CHƯA CÓ
- Cài `@react-native-google-signin/google-signin` (Tuya KHÔNG bundle Google Sign-In).
- `GoogleSignin.configure({ webClientId })` → `signIn()` → lấy `idToken`.
- Truyền `idToken` vào `thirdLogin(idToken, 'gg')` thay cho `''` hiện tại
  (code ghi rõ: *"B4 scaffold: idToken thật phải lấy từ native SDK - chưa wire"*).

### 2. Google Cloud Console (OAuth) - CHƯA CÓ
- **OAuth Consent Screen**: user type = External.
- **Android OAuth client ID**: Package Name = `com.walrus.wellnesscb` + **SHA-1** =
  SHA-1 keystore (debug: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`;
  release: lấy từ walrus-release.keystore) - **phải khớp SHA-1 đã đăng ký trên Tuya**.
- **Web application OAuth client ID**: tạo và copy `Client ID` → dùng làm `webClientId` cho
  Google Sign-In (để nhận idToken) **và** dán vào Tuya console.

### 3. Tuya Developer Platform - CHƯA CÓ
- Dán Google **Client ID** vào:
  **App → OEM App → Optional Setting → Third-Party Integration → Login Configuration for
  Android → Client ID for Google** (và tab iOS nếu làm iOS).

## Việc cần làm để Google login chạy (checklist)

| # | Việc | Ai làm |
|---|---|---|
| 1 | Cài `@react-native-google-signin/google-signin` + wire `signIn()`→idToken→`thirdLogin` | Dev (em) |
| 2 | Tạo Android + Web OAuth client trong Google Cloud (package + SHA-1) | Client (console Google) |
| 3 | Dán Web Client ID vào Tuya Third-Party Integration (Android) | Client (console Tuya) |
| 4 | Đảm bảo SHA-1 khớp giữa Google ↔ Tuya | Client |

## Xác nhận (research thêm trên mạng, 2026-07-01)

**Tuya Android tutorial (nguyên văn code + prerequisite):**
```java
TuyaHomeSdk.getUserInstance().thirdLogin(countryNumberCode, token, "gg", "{\"pubVersion\":1}", ILoginCallback);
// token = Google ID Token (obtained from Google Sign-In)
// Prerequisites: 1) Configure Google Sign-In on Google Developers Console
//                2) Enter the Client ID in the Tuya Developer Platform
//                3) Integrate Google Sign-In SDK in your Android project to obtain the ID token
```
→ Tuya nói THẲNG: *"Standard Google Sign-In SDK integration is required to obtain this token
before calling thirdLogin."* Không có đường tắt "SDK tự lo".

**react-native-google-signin (cách lấy idToken):**
```js
GoogleSignin.configure({
  webClientId: '<WEB_CLIENT_ID>',   // BẮT BUỘC type WEB, nếu không idToken = null
  offlineAccess: true,
});
const res = await GoogleSignin.signIn();
const idToken = res.data.idToken;   // truyền vào thirdLogin(idToken, 'gg')
```
- `idToken` chỉ khác null khi có `webClientId` hợp lệ (type **WEB**) - đây là chi tiết hay bị bỏ sót.

**Ghi chú quan trọng:** repo demo RN chính thức của Tuya (`TuyaInc/tuyasmart-home-sdk-react-native`)
đã **ngừng bảo trì**; Tuya khuyến nghị **tự tạo project RN + bridge sang native SDK** - đúng
hướng dự án đang làm (`@jimmy-vu/react-native-turbo-tuya`). → cách tiếp cận của mình chuẩn.

## Cross-platform (Android + iOS cùng login Google) - 2026-07-01

**Nguyên tắc mấu chốt: `idToken` có `audience` = WEB Client ID trên CẢ 2 nền.** Vì thế 1 Web
Client ID dùng chung khắp nơi; client Android/iOS chỉ để Google xác thực danh tính app theo nền.

**Google Cloud - 1 project, tạo 3 OAuth client:**
| Client | Định danh bằng | Dùng để |
|---|---|---|
| **Android** | package `com.walrus.wellnesscb` + **SHA-1** (debug `5E:8F:16:06:...`; release riêng) | Google verify app Android (KHÔNG dán vào Tuya) |
| **iOS** | Bundle ID `com.walrus.wellness` | Google verify app iOS + URL scheme (reversed client id) |
| **Web** | (server) | **`webClientId`** - idToken audience = cái này, dùng CHUNG |

**react-native-google-signin - 1 config JS chung:**
```js
GoogleSignin.configure({
  webClientId: '<WEB_CLIENT_ID>',  // GIỐNG nhau Android+iOS → idToken aud = web client
  iosClientId: '<IOS_CLIENT_ID>',  // iOS (hoặc auto từ GoogleService-Info.plist)
  offlineAccess: true,
});
```
- Android: web client id auto từ `google-services.json`. iOS: phải thêm `WEB_CLIENT_ID` vào
  `GoogleService-Info.plist` (iOS không tự có).

**Tuya console - dán CÙNG một Web Client ID vào cả 2 mục:**
- Login Configuration for **Android** → Client ID for Google = **Web Client ID**
- Login Configuration for **iOS** → Client ID for Google = **Web Client ID** (GIỐNG hệt)

→ Code `thirdLogin(idToken, 'gg')` **không đổi** giữa 2 nền - lib lo khác biệt native, idToken
trả về cùng audience nên Tuya verify được cho cả hai.

## Doc chuyên third-party login (userthirdlogin) - xác nhận lại, 2026-07-01

Trang `userthirdlogin?id=Ka6a9oalounvd` (chuyên về đăng nhập bên thứ ba) **nói y hệt**: app
tự lấy token từ SDK của provider **trước**, rồi mới gọi API Tuya. Nguyên văn: *developers must
"get the login code" and "call the login API method provided by Tuya SmartLife App SDK"* →
app lấy token độc lập từ native SDK của từng provider.

**Method chung (Android):**
```java
void thirdLogin(String countryCode, String accessToken, String type, String extraInfo, ILoginCallback callback)
```

**Bảng provider Tuya hỗ trợ:**
| Provider | type | Token truyền vào | Nguồn token | Method |
|---|---|---|---|---|
| Google | `gg` | **idToken** | Google Sign-In | `thirdLogin(..., "gg", "{\"pubVersion\":1}", cb)` |
| Apple | `ap` | accessToken | Apple | `thirdLogin(..., "ap", ...)` |
| Facebook | `fb` | accessToken | Facebook SDK | `thirdLogin(..., "fb", ...)` |
| WeChat | - | code | WeChat SDK | `loginByWechat(countryCode, code, cb)` |
| Tencent QQ | - | userId+accessToken | QQ SDK | `loginByQQ(countryCode, userId, accessToken, cb)` |

→ Google/Apple/Facebook dùng chung `thirdLogin`; WeChat/QQ có method riêng. Không provider nào
được Tuya "lo hộ" phần lấy token - luôn cần SDK của provider. Điều này khớp 100% code app hiện
tại (`thirdLogin` với `'gg'`/`'ap'`), chỉ thiếu bước lấy token thật.

## Liên kết (nguồn)
- Configure Google Sign-In (console): https://developer.tuya.com/en/docs/iot/google-login?id=Ka4p2ztytbtpr
- Third-party Login System (SDK): https://developer.tuya.com/en/docs/app-development/RegisterAndLoginWithThird?id=Kamplctfgj2mk
- Login with Third-Party Account: https://developer.tuya.com/en/docs/app-development/iOS-user-thirdparty?id=Kaixu9bbogqxi
- Research liên quan: [tuya-android-sdk-missing-modules.md](tuya-android-sdk-missing-modules.md)
