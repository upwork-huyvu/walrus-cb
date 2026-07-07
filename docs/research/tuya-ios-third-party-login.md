# Tuya Research: Đăng nhập bên thứ ba trên iOS (Apple + Google) - `loginByAuth2WithType`

- Ngày: 2026-07-02 · Nguồn chính:
  [iOS Third-Party Login](https://developer.tuya.com/en/docs/app-development/iOS-user-thirdparty?id=Kaixu9bbogqxi) ·
  [Third-party Login (chung)](https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd)
- Bối cảnh: `TuyaAuth.mm` (`packages/tuya-react-native/ios`) có `thirdLogin` = **TODO stub** → Google
  lẫn Apple trên iOS đều chưa chạy. Cần selector iOS đúng để wire. Liên quan
  [[m1-mobile-apple-login]] · [[m1-mobile-google-login]] · [tuya-google-login.md](tuya-google-login.md).

## TL;DR (cho người sắp code)
- **iOS KHÔNG có `thirdLogin` như Android.** Selector iOS là:
  **`loginByAuth2WithType:countryCode:accessToken:extraInfo:success:failure:`** trên `ThingSmartUser`.
- **Apple:** `type = @"ap"` · `accessToken = identityToken` (JWT từ `ASAuthorizationAppleIDCredential`) ·
  `extraInfo` = **NSDictionary** `{userIdentifier, email, nickname, snsNickname}`. Min SDK **v3.14.0**.
- **Google:** `type = @"gg"` · `accessToken = idToken` (KHÔNG phải access token) ·
  `extraInfo = @{@"pubVersion": @1}`. Min SDK **v3.19.0**.
- **Khác Android mấu chốt:** `extraInfo` iOS là **NSDictionary**, còn Android/JS truyền **String JSON**
  → bridge iOS phải **`NSJSONSerialization` parse String → NSDictionary** trước khi gọi.
- **Precondition:** phải cấu hình **App ID + App Secret** ở mục *Third-Party Login Support* trên
  Tuya platform ([platform.tuya.com/oem/optional-sdk](https://platform.tuya.com/oem/optional-sdk)).

## API chính
| Platform | Class/Method | Params | Callback/Return | Ghi chú |
|---|---|---|---|---|
| **iOS** | `ThingSmartUser -loginByAuth2WithType:countryCode:accessToken:extraInfo:success:failure:` | `type`(NSString) · `countryCode`(NSString) · `accessToken`(NSString: idToken/identityToken) · `extraInfo`(**NSDictionary**) | `success:^{}` (user ở `[ThingSmartUser sharedInstance]`) · `failure:^(NSError*)` | 1 selector chung cho gg/ap/fb |
| **Android** | `ThingHomeSdk.getUserInstance().thirdLogin(...)` | `countryCode, accessToken, type, extraInfo`(**String**)`, ILoginCallback` | `onSuccess(User)` · `onError(code,msg)` | pass-through (đã impl trong `TuyaAuthModule.kt:114`) |

### Apple (iOS) - code official (verbatim)
```objc
ASAuthorizationAppleIDCredential *credential = authorization.credential;
[[ThingSmartUser sharedInstance]
   loginByAuth2WithType:@"ap"
            countryCode:@"your_country_code"
            accessToken:credential.identityToken            // xem "cạm bẫy": NSData vs NSString
              extraInfo:@{@"userIdentifier": credential.user,
                          @"email": credential.email,
                          @"nickname": credential.fullName.nickname,
                          @"snsNickname": credential.fullName.nickname}
                success:^{ NSLog(@"login success"); }
                failure:^(NSError *error) { NSLog(@"login failure: %@", error); }];
```
> Trang iOS-thirdparty còn ghi cách chuyển token: `[[NSString alloc] initWithData:appleIDCredential.identityToken encoding:NSUTF8StringEncoding]`.

### Google (iOS)
- `type=@"gg"` · `accessToken = <Google idToken>` · `extraInfo=@{@"pubVersion": @1}`.

## Khác biệt iOS vs Android
| | iOS | Android |
|---|---|---|
| Method | `loginByAuth2WithType:...` | `thirdLogin(...)` |
| `extraInfo` | **NSDictionary** | **String JSON** |
| Apple min SDK | v3.14.0 | (không nêu) |
| Google min SDK | v3.19.0 | v3.19.0 |
| Token Apple | `identityToken` (JWT) | không nêu rõ (suy ra identityToken) |

## Điều kiện tiên quyết & cấu hình
- **Tuya platform:** cấu hình App ID + App Secret ở *Third-Party Login Support* (OEM → Optional SDK).
  Với Google còn dán Web Client ID (đã làm ở [[m1-mobile-google-login]]).
- **Apple:** app cần capability **"Sign in with Apple"** (entitlement) + App ID bật trên Apple
  Developer portal. Lib RN: `@invertase/react-native-apple-authentication`.
- **Data Center** phải khớp Cloud Project (EU) - như mọi luồng Tuya.
- Google: user đăng ký ở **Trung Quốc đại lục** không dùng được (hạn chế triển khai).

## Cạm bẫy / lưu ý cho dự án
- ⚠️ **`extraInfo` iOS = NSDictionary**, JS/Android truyền String → **bridge `TuyaAuth.mm` phải
  `NSJSONSerialization JSONObjectWithData` parse** String→NSDictionary. Đây là điểm khác biệt gây
  fail nếu bê nguyên Android.
- ⚠️ **Kiểu `accessToken`**: selector là `accessToken:(NSString *)` nhưng ví dụ Apple lại truyền
  thẳng `credential.identityToken` (**NSData**). An toàn: **convert NSData→NSString UTF8** trước khi
  truyền (trang iOS-thirdparty hướng dẫn vậy). **Cần verify header SDK khi build.**
- ⚠️ **Apple chỉ trả `email`/`fullName` LẦN ĐẦU** authorize (các lần sau = nil) → JS phải lấy các
  field này ngay lần đầu và truyền vào extraInfo; nếu nil thì bỏ key đó (đừng nhét NSNull).
- Implement gợi ý cho `TuyaAuth.mm thirdLogin` (giữ nguyên chữ ký JS `thirdLogin(country,token,type,extraInfoString)`):
  ```objc
  NSDictionary *extra = nil;
  if (extraInfo.length) {
    extra = [NSJSONSerialization JSONObjectWithData:[extraInfo dataUsingEncoding:NSUTF8StringEncoding]
                                            options:0 error:nil];
  }
  [[ThingSmartUser sharedInstance] loginByAuth2WithType:type countryCode:countryCode
     accessToken:token extraInfo:extra
     success:^{ resolve(TuyaUserMap([ThingSmartUser sharedInstance])); }
     failure:^(NSError *e){ reject(@"third_login_error", e.localizedDescription, e); }];
  ```
- **Ảnh hưởng JS adapter:** `auth.ts.thirdLogin` hiện set `extraInfo='' cho 'ap'`. Muốn Apple điền
  profile → cần build extraInfo `{userIdentifier,email,nickname,snsNickname}` từ credential (appleAuth
  trả về các field này). → tinh chỉnh ở B2/B3/B5 của [[m1-mobile-apple-login]].

## Câu hỏi mở / cần xác minh trên thiết bị
- Kiểu chính xác của `accessToken:` (NSString vs NSData) - đọc `ThingSmartUser.h` khi build iOS.
- extraInfo Apple có **bắt buộc** không, hay identityToken (chứa `sub`/`email`) là đủ để Tuya tạo
  account? (Doc đưa đủ 4 key nhưng không nói field nào optional.)
- Với `nil` email/fullName (lần authorize thứ 2+) → truyền dict rỗng/bỏ key có OK không.

## Nguồn (đã đọc)
- iOS Third-Party Login: https://developer.tuya.com/en/docs/app-development/iOS-user-thirdparty?id=Kaixu9bbogqxi
- Third-party Login (chung, Android + iOS gap): https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd
- (tham chiếu) iOS Account tutorial: https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-account?id=Kalawg5deam3k
