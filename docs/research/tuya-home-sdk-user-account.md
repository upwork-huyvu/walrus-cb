# Tuya Research: Home SDK — User Account (nâng cao: profile, mật khẩu, huỷ tài khoản, third-party, region/timezone, session)

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `thingsmart` **7.5.x**; iOS ThingSmartHomeKit **~7.5**
- **Phạm vi nối tiếp:** note nền tảng đã phủ login email/thirdLogin/session cơ bản — note này đi sâu phần **quản lý tài khoản sau khi đã đăng nhập**.
- **Nguồn chính:**
  - User Account Management (overview) — https://developer.tuya.com/en/docs/app-development/usermanage?id=Ka69qtzy9l8nc
  - Manage User Accounts (Android) — https://developer.tuya.com/en/docs/app-development/android-account-information?id=Kaixm19qdk5yk
  - Manage User Accounts (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-user-infoupdate?id=Kaixuudvdx84h
  - iOS App: Implement User Account Features — https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-account?id=Kalawg5deam3k
  - Handling of Expired Session — https://developer.tuya.com/en/docs/app-development/usersession?id=Ka6a9oalhcyua
  - Multi-device Login Management — https://developer.tuya.com/en/docs/app-development/multi_login?id=Kf3zo4f1wpsel
  - User bean (API ref) — https://tuya.github.io/tuya-home-android-sdk-api-reference/com/thingclips/smart/android/user/bean/User.html
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. **Android** lấy verbatim khá đầy đủ (trang account-information + API index). **iOS** signature lấy được tốt từ trang account + class reference. Một số API (getThirdLoginInfo, getCountryList/getTimeZoneList trong SDK) **không tìm thấy tên verbatim** → xem "Câu hỏi mở".

---

## TL;DR (cho người sắp code)
1. **Profile đọc từ cache local, không cần call mạng:** `getUser()` (Android) / properties trên `[ThingSmartUser sharedInstance]` (iOS) trả về object `User` đã có sẵn `nickName`, `headPic`, `email`, `mobile`, `tempUnit`, `timezoneId`, `sid`, `uid`. Muốn **đồng bộ mới nhất từ server** → gọi `updateUserInfo()` (Android) trước rồi đọc lại.
2. **`tempUnit` là số: `1 = Celsius (°C)`, `2 = Fahrenheit (°F)`.** Đổi đơn vị: Android `setTempUnit(TempUnitEnum, cb)`, iOS `updateTempUnitWithTempUnit:` (truyền `NSInteger`). **Rất hợp ice-bath** — hiển thị nhiệt độ theo đơn vị user chọn.
3. **`uploadUserAvatar` (Android) / `updateHeadIcon:` (iOS) đã DEPRECATED** vì rủi ro compliance. Nên dùng avatar mặc định / chọn từ preset, **đừng cho upload ảnh tuỳ ý**. Có biến thể `updateAvatarWithImageUrl(url)` nhận URL thay vì file.
4. **Đổi nickname:** Android `updateNickName(name, IReNickNameCallback)` (alias cũ `reRickName`), iOS `updateNickname:success:failure:`. Lưu ý: nếu nickname mặc định lấy từ SNS (vd WeChat) thì **không sửa được**.
5. **Mật khẩu:** SDK chỉ phơi **reset qua verification code** (`resetEmailPassword` / `resetPhonePassword`), **KHÔNG có API "đổi mật khẩu khi đang đăng nhập" verbatim** trong doc Home SDK → luồng "change password" cũng đi qua reset (gửi code type `3` → đặt mật khẩu mới). Xem "Câu hỏi mở".
6. **Huỷ tài khoản:** `cancelAccount(cb)` (cả 2 nền tảng). **Có cửa sổ hoàn tác 7 ngày:** nếu user login lại trong 1 tuần thì lệnh xoá bị huỷ; quá hạn → xoá vĩnh viễn toàn bộ dữ liệu. Code gửi mã unregister là `type = 8`.
7. **Logout có 2 biến thể:** `logout(ILogoutCallback)` cho account thường, `touristLogOut(ILogoutCallback)` cho anonymous/tourist account. iOS: `loginOut:failure:`.
8. **Liên kết third-party (sau khi đã login):** Android `bindThirdPlatform(...)` với `IThirdBindCallback`. Type codes giống thirdLogin: `gg`=Google, `ap`=Apple, `fb`=Facebook. (iOS chưa lấy được signature verbatim cho bind — xem "Câu hỏi mở".)
9. **Session hết hạn:** Android `ThingHomeSdk.setOnNeedLoginListener(INeedLoginListener)` → `onNeedLogin(Context)`; iOS observe notification `ThingSmartUserNotificationUserSessionInvalid`. Trigger khi: không hoạt động lâu (~45 ngày), reset password, xoá account, hoặc bị **kick-off do login ở thiết bị khác**.
10. **Multi-device login (iOS có API rõ):** liệt kê phiên (`getLoginTerminalListWithSuccess:`), lấy logout code (`getLogoutCodeByAuthorizingAccount:`), kết thúc phiên khác (`terminateSessionOnDevice:logoutCode:`).

---

## Khái niệm & luồng

**Object `User` = bản chụp profile trong cache.** Sau login, SDK giữ một instance `User` (Android: `getUserInstance().getUser()`; iOS: singleton `[ThingSmartUser sharedInstance]`). Mọi field profile đọc trực tiếp từ đây — không tốn network. Khi user sửa profile trên thiết bị khác, **gọi `updateUserInfo()` (sync) rồi đọc lại** để có giá trị mới (doc: "if the user is logged in from multiple mobile phones … changes are synchronized … when the user information is checked").

**Luồng các tác vụ chính:**
- *Xem profile:* `getUser()` → đọc field → (tuỳ chọn `updateUserInfo()` để refresh).
- *Sửa nickname / temp unit / timezone:* gọi method tương ứng → trên `onSuccess`, SDK đã cập nhật cache, UI render lại.
- *Đổi mật khẩu:* gửi verify code (`type=3`) tới email/phone đang dùng → `resetEmailPassword/resetPhonePassword` với code + mật khẩu mới.
- *Liên kết third-party:* lấy idToken/accessToken từ provider (Google/Apple) → `bindThirdPlatform(...)`. Gỡ liên kết → (API gỡ chưa xác minh verbatim).
- *Huỷ tài khoản:* `cancelAccount(cb)` → app về màn login; nhắc user rằng có 7 ngày hoàn tác.
- *Session listener:* đăng ký **1 lần ở Application/AppDelegate**; khi trigger → điều hướng về Login, xoá state. **SDK < v5.1 trên iOS có thể bắn notification nhiều lần** → tự debounce bằng boolean/time-window.

**Entry instance:** Android tất cả qua `ThingHomeSdk.getUserInstance()` (interface `IThingUser`). iOS qua `[ThingSmartUser sharedInstance]`.

---

## API Android (verbatim)

### 1) Đọc & đồng bộ profile
```java
// Lấy object User (từ cache local)
User user = ThingHomeSdk.getUserInstance().getUser();
String sid   = user.getSid();
String uid   = user.getUid();
String nick  = user.getNickName();
int tempUnit = user.getTempUnit();      // 1 = Celsius, 2 = Fahrenheit
String tz    = user.getTimezoneId();    // vd "Asia/Shanghai"
String email = user.getEmail();
String pic   = user.getHeadPic();

// Đồng bộ profile mới nhất từ server rồi mới đọc lại
void updateUserInfo(IResultCallback callback);   // "Sync user information"
```

### 2) Cập nhật profile
```java
// Đổi nickname (alias cũ: reRickName)
void updateNickName(String name, IReNickNameCallback callback);
//   IReNickNameCallback: onSuccess() / onError(String code, String error)

// Đổi đơn vị nhiệt độ
void setTempUnit(TempUnitEnum unit, IResultCallback callback);
//   TempUnitEnum.Celsius / TempUnitEnum.Fahrenheit

// Đổi timezone
void updateTimeZone(String timezoneId, IResultCallback callback);   // "Asia/Shanghai"

// Avatar — DEPRECATED (rủi ro compliance), tránh dùng:
void uploadUserAvatar(File file, IBooleanCallback callback);
void updateAvatarWithImageUrl(String imageUrl, IBooleanCallback callback);
```

### 3) Mật khẩu (reset qua verification code)
```java
// Gửi mã: type 1=register, 2=login, 3=reset password, 8=unregister
void sendVerifyCodeWithUserName(String userName, String region,
        String countryCode, int type, IResultCallback callback);

// Đặt lại mật khẩu (email)
void resetEmailPassword(String countryCode, String email, String emailCode,
        String passwd, IResetPasswordCallback callback);

// Đặt lại mật khẩu (phone)
void resetPhonePassword(String countryCode, String phone, String verifyCode,
        String newPassword, IResetPasswordCallback callback);
```
> **Không có** `changePassword` riêng cho user đang login trong doc Home SDK → dùng luồng reset (gửi code type 3 đến chính email/phone của user).

### 4) Huỷ tài khoản & logout
```java
// Huỷ tài khoản — có cửa sổ hoàn tác 7 ngày
void cancelAccount(IResultCallback callback);

// Logout account thường
ThingHomeSdk.getUserInstance().logout(new ILogoutCallback() {
    @Override public void onSuccess() { }
    @Override public void onError(String errorCode, String errorMsg) { }
});

// Logout cho anonymous/tourist account
void touristLogOut(final ILogoutCallback callback);
```

### 5) Đổi/đính tài khoản & third-party binding
```java
// Đổi username (email/phone) đang gắn với tài khoản
void changeUserName(String countryCode, String code, String sId,
        String userName, IResultCallback callback);

// Gửi mã bind email + bind email
void sendBindVerifyCodeWithEmail(String countryCode, String email, IResultCallback callback);
void bindEmail(String countryCode, String email, String code, String sId, IResultCallback callback);

// Bind mobile
void bindMobile(String countryCode, String phone, String code, IResultCallback callback);
void sendBindVerifyCode(String countryCode, String phone, IResultCallback callback);

// Liên kết third-party vào tài khoản đang login
// chữ ký index: bindThirdPlatform(String,String,String,String,String,IThirdBindCallback)
void bindThirdPlatform(String type, String accessToken, String /*...*/ , String /*...*/ ,
        String /*extraInfo*/, IThirdBindCallback callback);
//   type: "gg"=Google, "ap"=Apple, "fb"=Facebook
```
> Chữ ký `bindThirdPlatform` lấy được từ **API index** (5 String + `IThirdBindCallback`) nhưng **thứ tự/ý nghĩa từng param chưa có doc giải thích** → mở trang IThingUser/đọc Javadoc khi code.

### 6) Session expired listener
```java
ThingHomeSdk.setOnNeedLoginListener(new INeedLoginListener() {
    @Override public void onNeedLogin(Context context) {
        // điều hướng về màn Login, xoá state
    }
});
```
> Đăng ký ở **Application** (1 lần). Trigger khi session hết hạn / reset password / xoá account / bị kick-off.

---

## API iOS (verbatim / đối chiếu)

### 1) Đọc profile — properties trên `[ThingSmartUser sharedInstance]`
```objc
@property (nonatomic, strong, readonly) NSString  *sid;            // Session ID
@property (nonatomic, strong, readonly) NSString  *uid;            // User ID
@property (nonatomic, strong, readonly) NSString  *headIconUrl;    // Avatar URL
@property (nonatomic, strong, readonly) NSString  *nickname;
@property (nonatomic, strong, readonly) NSString  *userName;
@property (nonatomic, strong, readonly) NSString  *phoneNumber;
@property (nonatomic, strong, readonly) NSString  *email;
@property (nonatomic, strong, readonly) NSString  *countryCode;
@property (nonatomic, strong, readonly) NSString  *regionCode;
@property (nonatomic, strong, readonly) NSString  *timezoneId;
@property (nonatomic, assign, readonly) NSInteger  tempUnit;       // 1=Celsius, 2=Fahrenheit
@property (nonatomic, strong, readonly) NSString  *snsNickname;
@property (nonatomic, strong, readonly) NSString  *partnerIdentity;
@property (nonatomic, strong, readonly) NSDictionary *domain;      // API domains
@property (nonatomic, assign, readonly) BOOL       isLogin;        // login status
```

### 2) Cập nhật profile
```objc
- (void)updateNickname:(NSString *)nickName
               success:(nullable ThingSuccessHandler)success
               failure:(nullable ThingFailureError)failure;

- (void)updateTempUnitWithTempUnit:(NSInteger)tempUnit        // 1=°C, 2=°F
                           success:(nullable ThingSuccessHandler)success
                           failure:(nullable ThingFailureError)failure;

- (void)updateTimeZoneWithTimeZoneId:(NSString *)timeZoneId
                             success:(nullable ThingSuccessHandler)success
                             failure:(nullable ThingFailureError)failure;

- (void)updateLatitude:(double)latitude longitude:(double)longitude;

// Avatar — DEPRECATED:
- (void)updateHeadIcon:(UIImage *)headIcon
               success:(nullable ThingSuccessHandler)success
               failure:(nullable ThingFailureError)failure;
- (void)updateAvatarWithImageUrl:(NSString *)imageUrl
                         success:(nullable ThingSuccessHandler)success
                         failure:(nullable ThingFailureError)failure;
```

### 3) Mật khẩu & đổi tài khoản
```objc
- (void)resetPasswordByEmail:(NSString *)email
                 newPassword:(NSString *)newPassword
                        code:(NSString *)code
                     success:(nullable ThingSuccessHandler)success
                     failure:(nullable ThingFailureError)failure;

- (void)resetPasswordByPhone:(NSString *)countryCode
                 phoneNumber:(NSString *)phone
                 newPassword:(NSString *)password
                        code:(NSString *)code
                     success:(nullable ThingSuccessBlock)success
                     failure:(nullable ThingFailureError)failure;

// gửi verify code (type: 1 reg, 2 login, 3 reset, 8 unregister)
- (void)sendVerifyCodeWithUserName:(NSString *)userName
                            region:(NSString *)region
                       countryCode:(NSString *)countryCode
                              type:(NSInteger)type
                           success:(nullable ThingSuccessBlock)success
                           failure:(nullable ThingFailureError)failure;

// đổi tài khoản đang gắn (email/phone)
- (void)changBindAccount:(NSString *)account
             countryCode:(NSString *)countryCode
                    code:(NSString *)code
                 success:(nullable ThingSuccessHandler)success
                 failure:(nullable ThingFailureError)failure;

// bind email vào tài khoản
- (void)bindEmail:(NSString *)account
  withCountryCode:(NSString *)countryCode
             code:(NSString *)code
              sId:(NSString *)sId
          success:(nullable ThingSuccessBlock)success
          failure:(nullable ThingFailureError)failure;
```

### 4) Huỷ tài khoản & logout
```objc
- (void)cancelAccount:(nullable ThingSuccessHandler)success
              failure:(nullable ThingFailureError)failure;

- (void)loginOut:(nullable ThingSuccessHandler)success
         failure:(nullable ThingFailureError)failure;
```

### 5) Session expired — Notification
```objc
[[NSNotificationCenter defaultCenter]
    addObserver:self
       selector:@selector(sessionInvalid)
           name:ThingSmartUserNotificationUserSessionInvalid
         object:nil];
```
> **SDK < v5.1**: notification có thể bắn **nhiều lần** → tự xử lý 1 lần bằng boolean / time-window.

### 6) Multi-device login (iOS có API rõ ràng)
```objc
// Liệt kê các phiên đăng nhập (trên các thiết bị)
- (void)getLoginTerminalListWithSuccess:(nonnull void(^)(NSArray<ThingSmartLoginTerminalModel *> * _Nullable))success
                                failure:(nullable ThingFailureError)failure;

// Lấy logout code (xác thực bằng code hoặc password)
- (void)getLogoutCodeByAuthorizingAccount:(ThingSmartAccountAuthenticationRequestModel *)requestModel
                                  success:(nullable void(^)(ThingSmartAccountAuthenticationModel *))success
                                  failure:(nullable ThingFailureError)failure;

// Kết thúc phiên trên thiết bị khác
- (void)terminateSessionOnDevice:(NSString *)terminalId
                      logoutCode:(NSString *)logoutCode
                         success:(nullable ThingSuccessBOOL)success
                         failure:(nullable ThingFailureError)failure;
```
> Thiết bị bị kết thúc phiên sẽ nhận `ThingSmartUserNotificationUserSessionInvalid`. **Tương đương Android chưa lấy được signature verbatim** (xem "Câu hỏi mở").

---

## Bean / Callback / Listener

### `User` bean (Android — verbatim từ API reference)
| Field | Type | Getter | Ghi chú |
|---|---|---|---|
| `nickName` | String | `getNickName()` | hiển thị |
| `headPic` | String | `getHeadPic()` | URL avatar |
| `username` | String | `getUsername()` | |
| `email` | String | `getEmail()` | |
| `mobile` | String | `getMobile()` | |
| `phoneCode` | String | `getPhoneCode()` | country/phone code |
| `timezoneId` | String | `getTimezoneId()` | vd `Asia/Shanghai` |
| `tempUnit` | int | `getTempUnit()` | **1=°C, 2=°F** |
| `sid` | String | `getSid()` | session id |
| `uid` | String | `getUid()` | user id |
| `ecode` | String | `getEcode()` | |
| `snsNickname` | String | `getSnsNickname()` | nickname từ SNS |
| `regFrom` | int | `getRegFrom()` | nguồn đăng ký |
| `userType` | int | `getUserType()` | |
| `domain` | Domain | `getDomain()` | API domains theo DC |
| `partnerIdentity` | String | `getPartnerIdentity()` | |
| `userAlias` | String | `getUserAlias()` | |
| `dataVersion` | int | `getDataVersion()` | |
| `extras` | Map<String,Object> | `getExtras()` | |
> **Không có field `regionCode`/`snsList`** trên Android `User` bean (regionCode nằm trong `Domain`). iOS `ThingSmartUser` thì **có** property `regionCode` + `countryCode` trực tiếp.

### Callback / Listener (Android)
| Tên | Method | Dùng cho |
|---|---|---|
| `IResultCallback` | `onSuccess()` / `onError(code, error)` | setTempUnit, updateTimeZone, updateUserInfo, cancelAccount, bind email/mobile, sendVerifyCode |
| `IReNickNameCallback` | `onSuccess()` / `onError(code, error)` | updateNickName |
| `IBooleanCallback` | `onSuccess(boolean)` / `onError(...)` | uploadUserAvatar, updateAvatarWithImageUrl |
| `IResetPasswordCallback` | success / error | resetEmailPassword, resetPhonePassword |
| `ILogoutCallback` | `onSuccess()` / `onError(errorCode, errorMsg)` | logout, touristLogOut |
| `IThirdBindCallback` | (success/error) | bindThirdPlatform |
| `INeedLoginListener` | `onNeedLogin(Context)` | session expired |

### Block / Model (iOS)
| Tên | Chữ ký | Dùng cho |
|---|---|---|
| `ThingSuccessHandler` / `ThingSuccessBlock` | `^(void)` | hầu hết update/cancel/logout |
| `ThingFailureError` | `^(NSError *error)` | mọi failure |
| `ThingSuccessBOOL` | `^(BOOL)` | terminateSessionOnDevice |
| `ThingSmartLoginTerminalModel` | `terminalId`, `platform`, `os`, `loginTime` | danh sách phiên login |
| `ThingSmartAccountAuthenticationRequestModel` / `…AuthenticationModel` | code/password (`ifencrypt=1`) | logout code |
| Notification `ThingSmartUserNotificationUserSessionInvalid` | NSNotification.Name | session expired/kicked-off |

---

## Mã lỗi liên quan
> Doc Home SDK **không liệt kê mã riêng cho từng tác vụ account**; lỗi trả về `(code, error)` là **business error code** (cloud), thường dạng số/chuỗi. Tham chiếu chung:
- Mã chung pairing/control: `-1` SDK chưa init, `-3` connection timeout, `-5` param invalid (xem note nền tảng).
- **Session expired** không trả qua callback bình thường mà qua `INeedLoginListener` / `ThingSmartUserNotificationUserSessionInvalid`.
- Account-specific (sai mật khẩu, account không tồn tại, code sai/hết hạn, account đang trong hạn xoá…) → message trong field `error`/`NSError`. **Cần đối chiếu Global Error Codes** (https://developer.tuya.com/en/docs/iot/error-code?id=K989ruxx88swc) khi gặp thực tế.

---

## Cạm bẫy
1. **`tempUnit` là int 1/2, không phải string/"C"/"F".** Map cẩn thận sang UI ice-bath; lưu cache để render trước khi sync xong.
2. **Avatar upload deprecated** — nếu vẫn gọi có thể bị từ chối/rủi ro compliance. Dùng preset avatar hoặc `updateAvatarWithImageUrl` với URL nội bộ kiểm soát được.
3. **Không có "change password" cho user đang login** trong Home SDK → phải đi qua luồng reset (gửi code type 3). UX cần giải thích là "đổi mật khẩu" nhưng dưới nền là reset bằng OTP.
4. **`cancelAccount` không xoá ngay** — có 7 ngày hoàn tác; **đừng hứa với user là "xoá vĩnh viễn ngay".** Sau cancel phải logout/clear state local và về Login.
5. **Session listener phải đăng ký 1 lần, sớm (Application/AppDelegate).** Nếu đăng ký muộn hoặc nhiều lần → miss event hoặc xử lý trùng. **iOS < v5.1 bắn nhiều lần → debounce.**
6. **`getUser()` là cache** — sau khi user đổi profile ở thiết bị khác, không gọi `updateUserInfo()` thì vẫn thấy giá trị cũ.
7. **Đổi nickname từ SNS bị chặn:** nếu nickname mặc định lấy từ tài khoản SNS (vd WeChat) thì `updateNickName` không có tác dụng.
8. **`bindThirdPlatform` thứ tự param chưa rõ** (5 String) — verify Javadoc/header trước khi tích hợp Google/Apple link.
9. **Region/DC bất biến theo account:** account đăng ký ở DC nào thì cố định ở đó. Đổi country/region của user **không** = di chuyển account sang DC khác (ràng buộc DC của dự án vẫn nguyên — xem note nền tảng).
10. **TurboModule + session:** `INeedLoginListener`/notification phải được bridge thành **event emitter** lên JS (`onSessionExpired`) để app điều hướng — không thể poll.

---

## Đề xuất API TurboModule

Mở rộng module **`TuyaAuth`** (đã có login/session) cho phần profile + mật khẩu + huỷ tài khoản + third-party bind; thêm **`TuyaCommon`** (mới) cho country/timezone nếu xác minh được API SDK; session expired đẩy qua **event emitter** trên `TuyaCore`/`TuyaAuth`.

```ts
// ===== TuyaAuth (mở rộng) — Profile =====
interface TuyaUserProfile {
  uid: string;
  sid: string;
  nickName: string;
  headPic: string;        // avatar URL (read-only thực dụng)
  email?: string;
  mobile?: string;
  phoneCode?: string;
  countryCode?: string;   // iOS có; Android suy từ Domain
  regionCode?: string;
  timezoneId: string;     // vd "Europe/Berlin"
  tempUnit: 1 | 2;        // 1=Celsius, 2=Fahrenheit
  snsNickname?: string;
}

// Đọc profile từ cache (không gọi mạng)
getCurrentUser(): Promise<TuyaUserProfile | null>;
// Đồng bộ profile mới nhất từ server rồi trả về
syncUserInfo(): Promise<TuyaUserProfile>;

// Cập nhật profile
updateNickname(nickName: string): Promise<void>;
updateTempUnit(unit: 1 | 2): Promise<void>;            // 1=°C, 2=°F
updateTimeZone(timezoneId: string): Promise<void>;     // IANA tz id
updateAvatarByUrl(imageUrl: string): Promise<void>;    // tránh upload file (deprecated)

// ===== TuyaAuth — Mật khẩu (reset qua OTP; dùng cho cả "đổi mật khẩu") =====
// type: 1 register, 2 login, 3 reset password, 8 unregister
sendAccountVerifyCode(userName: string, countryCode: string, type: 1|2|3|8): Promise<void>;
resetEmailPassword(countryCode: string, email: string, code: string, newPassword: string): Promise<void>;
resetPhonePassword(countryCode: string, phone: string, code: string, newPassword: string): Promise<void>;

// ===== TuyaAuth — Huỷ tài khoản & logout =====
cancelAccount(): Promise<void>;          // có 7 ngày hoàn tác; sau đó clear state + về Login
logout(): Promise<void>;                 // logout account thường

// ===== TuyaAuth — Third-party binding =====
type ThirdProvider = 'gg' | 'ap' | 'fb';
bindThirdParty(provider: ThirdProvider, token: string, extraInfo?: string): Promise<void>;
unbindThirdParty(provider: ThirdProvider): Promise<void>;   // CẦN verify API native tồn tại
getLinkedThirdParties(): Promise<ThirdProvider[]>;          // CẦN verify (getThirdLoginInfo?)

// ===== TuyaAuth — Session events (event emitter) =====
// emit khi INeedLoginListener.onNeedLogin (Android) / ThingSmartUserNotificationUserSessionInvalid (iOS)
addListener(eventName: 'onSessionExpired', cb: (reason?: string) => void): void;
removeListeners(count: number): void;

// ===== TuyaAuth — Multi-device login (iOS rõ; Android cần verify) =====
interface TuyaLoginTerminal { terminalId: string; platform: string; os: string; loginTime: number; }
getLoginTerminals(): Promise<TuyaLoginTerminal[]>;
terminateSession(terminalId: string, logoutCode: string): Promise<void>;

// ===== TuyaCommon (module MỚI đề xuất) — country / region / timezone =====
// Map qua requestWithApiName ("tuya.m.country.list", v.v.) nếu SDK không phơi helper trực tiếp
interface TuyaCountry { name: string; countryCode: string; abbreviation?: string; }
getCountryList(lang?: string): Promise<TuyaCountry[]>;
getTimeZoneList(): Promise<string[]>;                       // IANA tz ids
getDefaultRegion(countryCode: string): Promise<string>;    // iOS: getDefaultRegionWithCountryCode:
```

**Platform notes (cho spec):**
- `tempUnit`: thống nhất kiểu `1|2` cả 2 nền tảng (Android `TempUnitEnum`, iOS `NSInteger`).
- `updateAvatarByUrl` ưu tiên hơn upload-file vì API file đã deprecated.
- `onSessionExpired`: Android map từ `INeedLoginListener` (đăng ký ở `Application` trong native module init); iOS observe `ThingSmartUserNotificationUserSessionInvalid` (nhớ debounce cho SDK < v5.1).
- `bindThirdParty`: chữ ký native Android (`bindThirdPlatform`, 5 String) chưa rõ thứ tự param → khi implement phải đọc Javadoc. `unbind`/`getLinked` chưa xác minh API → giữ ở TS nhưng đánh dấu cần verify trước khi ship.
- `getCountryList`/`getTimeZoneList`: nếu SDK không có helper, fallback gọi server API qua `requestWithApiName:` (iOS) / `ApiParams`+`requestWithApiName` (Android).

---

## Câu hỏi mở / cần xác minh
- **Đổi mật khẩu khi đang login:** Home SDK có method riêng không, hay bắt buộc qua reset+OTP? (doc không có `changePassword` verbatim).
- **`getThirdLoginInfo` / query third-party đã liên kết:** không tìm thấy tên verbatim trong API index → đọc Javadoc `IThingUser` / header iOS để xác nhận tên thật + có method **unbind** third-party không.
- **`bindThirdPlatform(String×5, IThirdBindCallback)`** — ý nghĩa & thứ tự 5 tham số (type, token, ...?). Verify trước khi nối Google/Apple link.
- **Android multi-device login:** iOS có `getLoginTerminalList…`/`terminateSessionOnDevice…`; Android tương đương tên gì? (chưa lấy verbatim).
- **`getCountryList`/`getTimeZoneList` trong SDK:** doc gợi ý "SDK v5.2+ built-in" nhưng cũ thì gọi `requestWithApiName "tuya.m.country.list"`. Xác nhận có helper native trong 7.5.x không.
- **`tempUnit` mapping chắc chắn** 1=°C / 2=°F trên cả 2 nền tảng (đã thấy ở doc iOS + Android enum; verify runtime).
- **Mã lỗi cụ thể** cho sai mật khẩu / account không tồn tại / code hết hạn / account đang trong hạn xoá → đối chiếu Global Error Codes khi test thật.

---

## Nguồn (URL đã đọc)
- User Account Management (overview) — https://developer.tuya.com/en/docs/app-development/usermanage?id=Ka69qtzy9l8nc
- Manage User Accounts (Android) — https://developer.tuya.com/en/docs/app-development/android-account-information?id=Kaixm19qdk5yk
- Manage User Accounts (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-user-infoupdate?id=Kaixuudvdx84h
- iOS App: Implement User Account Features — https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-account?id=Kalawg5deam3k
- Android App: Implement User Account Features — https://developer.tuya.com/en/docs/app-development/tutorial-for-android-account?id=Kalfig5pub1uz
- Register/Login with Email (verify code type, reset password) — https://developer.tuya.com/en/docs/app-development/useremail?id=Ka6a99luv3tr1
- Login with Third-Party Account — https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd
- Handling of Expired Session — https://developer.tuya.com/en/docs/app-development/usersession?id=Ka6a9oalhcyua
- Multi-device Login Management — https://developer.tuya.com/en/docs/app-development/multi_login?id=Kf3zo4f1wpsel
- Account Logout — https://developer.tuya.com/en/docs/app-development/android-app-sdk/user-management/userlogout?id=Ka6a9oaty0kye
- Common API Methods (country list via requestWithApiName) — https://developer.tuya.com/en/docs/app-development/commoninterface?id=Ka5vc94pvqo8i
- User bean (API reference) — https://tuya.github.io/tuya-home-android-sdk-api-reference/com/thingclips/smart/android/user/bean/User.html
- ThingSmartUser class reference (iOS) — https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/
- API index (Android, B/U/S index methods) — https://tuya.github.io/tuya-home-android-sdk-api-reference/index-files/index-2.html , index-18.html , index-20.html
- Global Error Codes — https://developer.tuya.com/en/docs/iot/error-code?id=K989ruxx88swc
