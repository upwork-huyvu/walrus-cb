# Tuya Research: Home SDK — Error Codes + FAQ (login/pairing/device/BLE/network/account)

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `thingsmart` **7.5.x**, iOS ThingSmartHomeKit **~7.5** · **Data Center:** Central Europe
- **Liên quan:** mở rộng bảng lỗi rút gọn trong note nền tảng `docs/research/tuya-m1-sdk-foundation.md` (mục "Mã lỗi thường gặp").
- **Nguồn chính:**
  - Error Codes (Home SDK — networking/pairing/device/network) — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6o3bubtl735
  - Error Codes (IPC/P2P SDK — kênh MQTT/token/session dùng chung) — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
  - Global Error Codes (Cloud OpenAPI — backend/account) — https://developer.tuya.com/en/docs/iot/error-code?id=K989ruxx88swc
  - "Illegal client" sau khi cấu hình AppKey/Secret/security image — https://support.tuya.com/en/help/_detail/Kaw4qcrfm88po
  - FAQ on SmartLife App — https://developer.tuya.com/en/docs/iot/tuya-smart-app-smart-life-app-faq?id=K9kqi61prn3gr
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. Bảng "API Android" (mã 1xx/1xxx/10xxx/11xxx/12xxx/505xx) lấy **verbatim** từ trang `Ka6o3bubtl735`. Bảng token/MQTT (-33/-55..-66) lấy verbatim từ trang IPC/P2P `Ka6nxw2k97l8a` — **kênh MQTT/token dùng chung** cho mọi SDK nên áp dụng được cho Home SDK. **iOS** trả `NSError` (đọc `code`/`localizedDescription`), không có "bảng mã iOS riêng" trên doc → mã số **đối chiếu = cùng** với Android (cùng backend/protocol). "Illegal client" tổng hợp từ support + search (support page bị redirect loop khi fetch trực tiếp). Mục "Câu hỏi mở" liệt kê chỗ chưa verify tận chữ ký.

---

## Phạm vi
Tổng hợp **đầy đủ** mã lỗi Home SDK + cách xử lý, chia theo nhóm:
1. **Networking/SDK chung** (100–106) — lỗi mạng/JSON/SSL/session.
2. **Pairing/Activator** (1001–1007, token).
3. **Account/login** (1100–1102 phía SDK; 2xxx/1xxx phía cloud OpenAPI).
4. **Device control / DP** (10201–10203, 11001–11009, 12001–12004, -1400..-1402).
5. **Token / MQTT / kênh điều khiển** (-33, -55..-66, -60..-66).
6. **Network sâu** (50500–50516: SSL, timeout, DNS, 502/503...).
7. **BLE** (callback `onFailure(int code, ...)` — code đi qua bảng pairing/network).
8. **FAQ** init fail / "illegal client" / DC mismatch / permission / device không tìm thấy.

Mục tiêu: lib `@jimmy-vu/react-native-turbo-tuya` **chuẩn hoá lỗi** → JS nhận `{ code, message, domain }` ổn định cả 2 nền tảng.

---

## Khái niệm & luồng
- **Hai họ mã lỗi tách biệt:**
  - **(A) Lỗi SDK on-device** (cái app phải xử lý) — trả về trong callback `onError(String code, String error)` (Android) / `NSError` (iOS). Đây là các mã **100–106, 1001–1007, 1100–1102, 10201–10203, 11001–12004, 505xx** + nhóm token/MQTT âm (**-33, -55..-66**). Phần lớn là **số** (Android trả `String code` nhưng nội dung là số; iOS trả `NSError.code` Int).
  - **(B) Lỗi Cloud OpenAPI** (backend NestJS gọi Tuya Cloud) — mã **1001 "secret invalid", 1004 "sign invalid", 1010/1011 token, 1106 permission, 2006/2021/2023/2401 user...**. **KHÔNG phải** mã app SDK trả về, nhưng app **có thể** thấy biểu hiện gián tiếp (vd "illegal client" khi sai cấu hình ký).
- **Cùng `code` 1004 nhưng KHÁC ngữ cảnh:** SDK on-device `1004` = "Failed to get the pairing token" (lấy token pairing fail); Cloud OpenAPI `1004` = "sign invalid" (chữ ký request sai). **Phải phân biệt theo domain** khi map sang JS.
- **Luồng xử lý đề xuất:** mọi callback lỗi → đẩy lên JS dạng `{ code, message }`; lib **giữ nguyên code gốc** + gắn `domain` (`"sdk"` cho on-device, `"cloud"` cho OpenAPI). JS phân loại retry/expired/permission dựa trên bảng dưới.

---

## API Android (verbatim — trang `Ka6o3bubtl735`, Home SDK)

### Nhóm 1xx — Networking / SDK chung
| Code | Mô tả (verbatim) |
|---|---|
| `101` | A networking error has occurred while processing your request. |
| `102` | Failed to escape JSON data. |
| `103` | Failed to access the network due to a networking error. |
| `104` | The mobile phone clock is incorrect and causes the SSL certificate to expire. |
| `105` | **Session information is required for login.** (chưa login / session hết hạn) |
| `106` | An error has occurred while synchronizing input/output data. |

### Nhóm 1xxx — Pairing / Activator + account input
| Code | Mô tả (verbatim) |
|---|---|
| `1001` | A pairing network error has occurred while processing your request. |
| `1002` | Failed to pair and bind the gateway. |
| `1004` | **Failed to get the pairing token.** (lấy activator token fail) |
| `1005` | Failed to detect the online status of the device to be paired. |
| `1006` | **The pairing task timed out.** (timeout pairing) |
| `1007` | The list of devices that have pairing errors is returned. |
| `1100` | The mobile phone number is incorrect. |
| `1101` | **The verification code is incorrect.** (sai mã OTP) |
| `1102` | An update error has occurred while processing your request. |

### Nhóm 10xxx/11xxx/12xxx — Device control / DP / kênh dữ liệu
| Code | Mô tả (verbatim) |
|---|---|
| `10201` | The device is disconnected from the local area network (LAN). |
| `10202` | The device server is offline. |
| `10203` | **The device is offline.** |
| `11001` | The format of the sent command is incorrect. (sai format DP) |
| `11002` | The device has been removed. |
| `11004` | The signature is incorrect. |
| `11005` | Failed to send data. |
| `11009` | The sent data is empty. |
| `12001` | Failed to parse the data. |
| `12002` | The signature does not match. |
| `12003` | The data has expired. |
| `12004` | The protocol version number does not exist. |

### Nhóm 505xx — Network sâu (HTTP/SSL/DNS)
| Code | Message | Nguyên nhân (verbatim, rút gọn) |
|---|---|---|
| `50500` | Other errors | An unknown error has occurred. |
| `50501` | Unavailable network | Wi-Fi hoặc cellular bị tắt |
| `50408` | timeout | Request vượt giới hạn thời gian |
| `50502` | javax.net.ssl.SSLHandshakeException | Sai giờ máy / chứng chỉ hết hạn / thiếu Tuya CA root / chuỗi cert lỗi |
| `50503` | read timed out | Read vượt timeout |
| `50504` | unable to resolve host | Không có Internet (DNS fail) |
| `50505` | failed to connect to… | Không truy cập được mạng |
| `50506` | no route to host | Gửi gói thất bại |
| `50507` | connect timed out | Kết nối phản hồi chậm quá timeout |
| `50508` | ssl handshake timed out | SSL handshake quá timeout |
| `50509` | connection closed by peer | Request bị server từ chối |
| `50510` | stream was reset: protocol_error | HTTP stream bị reset bất ngờ |
| `50511` | canceled | Request mạng bị huỷ |
| `50512` | 502 | Gateway invalid do lỗi server |
| `50513` | 503 | Server chưa sẵn sàng nhận request |
| `50514` | json error | Lỗi parse JSON |
| `50515` | Hostname …not verified | SSL/TLS hostname mismatch |
| `50516` | certificate pinning failure | Cert server không khớp cert đã pin |

> Lỗi `104`/`50502` đều liên quan **giờ thiết bị sai** → SSL cert "hết hạn" giả → khuyên user chỉnh giờ tự động.

### Nhóm token / MQTT / session (verbatim — trang `Ka6nxw2k97l8a`, kênh dùng chung)
| Code | Mô tả (verbatim) | Nguyên nhân |
|---|---|---|
| `-1` | The SDK is uninitialized | chưa `init()` |
| `-3` | A connection timeout error has occurred. Try reconnection | — |
| `-5` | The parameter is invalid | sai tham số |
| `-33` | A timeout error has occurred while getting the token | lấy token timeout |
| `-55` | **The token has expired** | token >10 phút hoặc đã pair 1 device |
| `-56` | The token does not match | token sai homeId |
| `-57` | Token verification failed | verify token fail |
| `-58` | The MQTT message sending failed | — |
| `-60` | The operation failed (sending commands, subscribing...) | **MQTT channel not connected** |
| `-61` | Subscribing to MQTT topic failed | No permission to subscribe |
| `-62` | The MQTT command sending failed | Message encryption failed |
| `-63` | The MQTT command sending failed | Timed out in cloud |
| `-64` | The MQTT command sending failed | Topic not subscribed |
| `-65` | The MQTT command sending failed | Third-party service error |
| `-66` | Subscribing to MQTT topic failed | Third-party service error |
| `-1400` | The data point (DP) is not supported | Configure DP on Tuya Platform |
| `-1401` | The format of the DP sent is invalid | sai kiểu giá trị DP |
| `-1402` | The DP query timed out | — |
| `-10001` | The device is not connected | thao tác khi device offline |
| `-10006` | The device was offline | — |

---

## API iOS (verbatim/đối chiếu)
- **iOS KHÔNG có bảng mã riêng** trên doc. Mọi API trả lỗi qua **`NSError`** trong failure block:
```objc
// Email login (verbatim pattern)
[[ThingSmartUser sharedInstance] loginByEmail:countryCode email:email password:password
  success:^{ /* ... */ }
  failure:^(NSError *error) {
      NSLog(@"login fail code=%ld msg=%@", (long)error.code, error.localizedDescription);
  }];
```
- **Đọc lỗi:** `error.code` (Int — **đối chiếu cùng tập mã số với Android**, vì cùng backend/protocol), `error.localizedDescription` (chuỗi mô tả).
- **Pairing iOS** trả lỗi qua **`ThingSmartActivatorErrorModel`** (gói cả device model + `NSError`) trong delegate/callback khi task interrupted:
```objc
// Khi pairing fail/timeout → errorModel chứa .error (NSError) và device model liên quan
- (void)activator:(ThingSmartActivator *)activator
   didReceiveDevice:(ThingSmartDeviceModel *)deviceModel
              error:(NSError *)error;   // error != nil ⇒ thất bại; đọc error.code/localizedDescription
```
- **Register/login phone & email iOS:** `registerByPhone... / loginByPhone... / registerByEmail... / loginByEmail...` — đều `failure:^(NSError *error)`.
- ⇒ Lib **map `NSError.code` → cùng schema `{ code, message }`** như Android `onError(code, msg)`. Không cần bảng song song.

---

## Bean/Callback/Listener (nơi lỗi xuất hiện)
| Nơi | Android | iOS |
|---|---|---|
| Generic op | `IResultCallback.onError(String code, String error)` | `failure:^(NSError *error)` |
| Login | `ILoginCallback.onError(String code, String error)` | `loginBy...:failure:^(NSError *)` |
| Register | `IRegisterCallback.onError(String code, String error)` | `registerBy...:failure:^(NSError *)` |
| Reset pass | `IResetPasswordCallback.onError(...)` | `resetPassword...:failure:^(NSError *)` |
| Get token | `IThingActivatorGetToken.onFailure(String s, String s1)` | `getTokenWithHomeId:...failure:^(NSError *)` |
| Wi-Fi pairing | `IThingSmartActivatorListener.onError(String errorCode, String errorMsg)` | delegate + `ThingSmartActivatorErrorModel` |
| BLE pairing | `IBleActivatorListener.onFailure(int code, String msg, Object handle)` | delegate `NSError` |
| Device control | `IResultCallback.onError(String code, String error)` (từ `publishDps`) | `failure:^(NSError *)` |
| Device events | `IDevListener.onStatusChanged/onNetworkStatusChanged` (online state, không phải "lỗi") | `ThingSmartDeviceDelegate` |

> **Lưu ý kiểu:** Android `onError` đa số `String code` (giá trị là số dạng chuỗi, vd `"1006"`); BLE `onFailure` là `int code`. iOS `NSError.code` là `NSInteger`. Lib nên **normalize về string** khi đẩy JS để tránh lệch kiểu.

---

## Mã lỗi liên quan (bảng tổng hợp + phân loại để xử lý)
| Nhóm | Mã | Hành động đề xuất (JS) |
|---|---|---|
| **SDK chưa init** | `-1` | đảm bảo `initSdk()` chạy trước; báo bug nội bộ |
| **Chưa login/session** | `105` | điều hướng về màn login, refresh session |
| **Param sai** | `-5`, `11001`, `1101`, `1100` | validate input (countryCode, OTP, DP type) trước khi gọi |
| **Token pairing** | `1004`(get token fail), `-33`(timeout), `-55`(expired), `-56`/`-57`(mismatch/verify) | `getActivatorToken(homeId)` **mới** rồi retry pairing |
| **Pairing fail/timeout** | `1001`,`1002`,`1005`,`1006`,`1007` | gợi ý đổi EZ↔AP, reset thiết bị, kiểm tra Wi-Fi 2.4GHz |
| **DP không hỗ trợ / sai** | `-1400`,`-1401`,`-1402`,`11001` | kiểm tra dpId/kiểu giá trị theo product schema |
| **MQTT/kênh** | `-60..-66` | chờ MQTT reconnect / kiểm tra mạng / device encryption |
| **Device offline** | `10201`,`10202`,`10203`,`-10001`,`-10006`,`11002` | hiển thị trạng thái offline; không cho điều khiển |
| **Network** | `101`,`103`,`50408`,`50501`,`50503..50514` | retry + báo "kiểm tra mạng"; backoff |
| **SSL/giờ máy** | `104`,`50502`,`50515`,`50516` | nhắc user chỉnh giờ tự động; cert pinning fail → có thể MITM/proxy |
| **Account (cloud)** | `2006`(user not exist),`2021`(illegal email),`2023`(user exist),`2401`(wrong pass) | map sang thông báo UI thân thiện |
| **Auth cloud (backend)** | `1001`(secret invalid),`1004`(sign invalid),`1005`(clientId),`1010/1011`(token),`1106`(permission) | lỗi cấu hình/ký phía server, không phải input user |

---

## Cạm bẫy
1. **`1004` hai nghĩa:** on-device = "lấy pairing token fail"; cloud = "sign invalid". **Đừng** map chung một message. Gắn `domain` để phân biệt.
2. **`105 = chưa login`** rất hay gặp khi gọi `queryHomeList`/`getActivatorToken` trước khi session sẵn sàng (vd sau cold-start mà chưa restore session). Luôn check login state trước.
3. **DC mismatch KHÔNG có mã lỗi riêng.** Biểu hiện: login OK nhưng `queryHomeList` rỗng / pairing không thấy device / "illegal client". → xác minh AppKey & countryCode cùng **Central Europe**.
4. **"Illegal client" / `ILLEGAL_CLIENT_ID`** (xem FAQ) thường là **cấu hình ký**, không phải sai mật khẩu — đừng hiển thị "sai tài khoản".
5. **`104`/`50502` = giờ máy sai**, không phải lỗi server. Nhiều support ticket "login fail" thực ra do clock lệch.
6. **`-55` token expired** xảy ra **ngay sau khi pair xong 1 device** (không chỉ sau 10 phút). Pair device thứ 2 phải lấy token mới.
7. **`publishDps` onSuccess ≠ điều khiển xong**; lỗi thật có thể về sau qua kênh MQTT (`-60..-66`) hoặc không có `onDpUpdate`. Theo dõi cả hai.
8. **iOS dùng `NSError`** — đừng giả định có "enum mã iOS". Map `NSError.code` về cùng tập số Android. `localizedDescription` đã địa phương hoá → nếu muốn message ổn định, map theo `code` thay vì hiển thị thẳng.
9. **BLE `onFailure(int code, ...)`** trả `int`, khác `String code` của Wi-Fi → normalize kiểu khi bridge.
10. **Cert pinning failure (`50516`)** = client phát hiện cert server không khớp → có thể do proxy/VPN/MITM của user; không retry vô ích, hướng dẫn tắt proxy.

### FAQ rút gọn (init / illegal client / DC / permission)
- **Init fail / app crash khi init:** thiếu **security file** (`security-algorithm.aar` trong `libs/` Android; `ios_core_sdk.tar.gz` giải nén ngang `Podfile` iOS) hoặc **package name/Bundle ID** không khớp console → init không lấy được key.
- **"Illegal client" / `ILLEGAL_CLIENT_ID` khi register/login dù đã có AppKey/Secret/security image:** nguyên nhân theo thứ tự ưu tiên:
  1. **SHA256 chưa add lên console** (bắt buộc từ SDK Android **v3.29.5+**) — thêm SHA256 của keystore (debug + release) vào App SDK trên Tuya Developer Platform; cấu hình `signingConfigs` trong `app/build.gradle` trước khi login.
  2. **Package name (Android) / Bundle ID (iOS) ≠ console** (từ Android **v4.0.0**, lệch package → trả `ILLEGAL_CLIENT_ID`).
  3. **Sai security file** hoặc file của AppKey khác.
  4. **Data Center của AppKey ≠ countryCode/region** đang dùng.
- **Sai chữ ký phía cloud (`1004 sign invalid`/`1001 secret invalid`):** lỗi backend khi gọi OpenAPI — kiểm tra thuật toán ký (HMAC-SHA256), timestamp (`1013 request time invalid`), `client_id`/`secret`.
- **Device không tìm thấy sau pairing:** thường **DC mismatch** hoặc device đã bind tài khoản khác (`2056 device has bind or not active` phía cloud). Unbind ở app Smart Life trước.
- **Permission deny (`1106` cloud / `105` chưa login on-device):** user chưa đủ quyền/role hoặc chưa login. Nhớ ràng buộc dự án: account phải là **Owner (role==2)** của Home.

---

## Đề xuất API TurboModule
Lỗi không cần module riêng — nên **chuẩn hoá tại tầng native** rồi reject Promise/emit event với shape ổn định. Đề xuất thêm **module mới `TuyaErrors`** (tiện ích) + quy ước reject thống nhất cho mọi module hiện có.

**Quy ước reject (áp cho TuyaCore/TuyaAuth/TuyaHome/TuyaPairing/TuyaDevice):**
Mọi Promise reject mang `code` (string), `message`, và `userInfo.domain` (`"sdk" | "cloud" | "network"`). Native map `onError(code,msg)` / `NSError` → đúng shape này; với BLE int code thì `String(code)`.

```ts
// Shape lỗi thống nhất khi reject (RN bridge tự đính kèm)
export interface TuyaError {
  code: string;        // vd "1006", "-55", "50502" (đã normalize về string)
  message: string;     // mô tả gốc / localizedDescription
  domain: 'sdk' | 'cloud' | 'network';
}

// Module mới: TuyaErrors — phân loại + tra cứu phía JS, không gọi native nặng
export type TuyaErrorCategory =
  | 'not_initialized' | 'not_logged_in' | 'invalid_param'
  | 'token_expired' | 'pairing_failed' | 'pairing_timeout'
  | 'dp_unsupported' | 'mqtt' | 'device_offline'
  | 'network' | 'ssl_clock' | 'account' | 'illegal_client' | 'permission'
  | 'unknown';

export interface TuyaErrorInfo {
  code: string;
  category: TuyaErrorCategory;
  retryable: boolean;          // network/timeout/mqtt = true
  needsNewToken: boolean;      // -55/-56/-57/-33/1004
  needsReLogin: boolean;       // 105 / cloud 1010/1011/1106
  userMessageKey: string;      // key i18n để hiển thị
}

export interface TuyaErrorsModule {
  // tra cứu thuần JS (bundle bảng mã ở trên), không cần gọi native
  classify(code: string, domain?: 'sdk' | 'cloud' | 'network'): TuyaErrorInfo;
  isRetryable(code: string): boolean;
  // (tuỳ chọn) lấy mô tả gốc từ SDK nếu native cung cấp helper
  describe(code: string): Promise<string>;
}

// Mở rộng module pairing: phân biệt token-expired để tự lấy token mới rồi retry
export interface TuyaPairingExtensions {
  // wrapper: tự getActivatorToken khi gặp -55/-56/-57/1004 rồi retry 1 lần
  startPairingWithAutoToken(params: PairingParams): Promise<DeviceResult>;
}

// Mở rộng device: phân biệt "đã gửi" vs "đã xác nhận qua onDpUpdate"
export interface TuyaDeviceExtensions {
  // resolve chỉ khi onDpUpdate khớp dp đã gửi hoặc timeout → reject {code,domain:'sdk'}
  publishDpsAwaitAck(devId: string, dps: string, timeoutMs?: number): Promise<void>;
}
```

**Khuyến nghị triển khai:**
- Đặt **bảng mã (above)** thành JSON tĩnh trong lib (`error-codes.ts`) để `classify()` chạy offline, không phụ thuộc network.
- Native chỉ cần đảm bảo **forward đúng `code` gốc** + gắn `domain`. Tránh "nuốt" code (đừng map tất cả về `-1`).
- Map riêng `domain:'cloud'` cho lỗi backend OpenAPI (NestJS) — app chỉ thấy gián tiếp qua "illegal client".

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **Mã iOS có 100% trùng số với Android không?** Doc xác nhận iOS trả `NSError` nhưng không công bố bảng số iOS → cần log `error.code` thực tế khi test pairing/login trên iOS để đối chiếu.
- **`ILLEGAL_CLIENT_ID`** trả về dưới dạng `code` chuỗi hay số khi qua callback SDK? (search xác nhận tên hằng; cần verify giá trị `code` thật trong `onError`).
- **BLE `onFailure(int code)`** dùng tập mã nào (network 505xx? hay tập riêng)? Cần log code thật khi BLE pairing fail.
- **Pairing `onError` (Wi-Fi)** trả `errorCode` dạng `"1006"`/`"1001"` hay tập khác — verify trên device thật.
- **DC thực tế của AppKey** client cấp (Central Europe theo brief) — xác nhận để loại trừ "illegal client"/device-not-found do DC.

## Nguồn
- Error Codes (Home SDK) — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6o3bubtl735
- Error Codes (IPC/P2P — token/MQTT dùng chung) — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
- Global Error Codes (Cloud OpenAPI) — https://developer.tuya.com/en/docs/iot/error-code?id=K989ruxx88swc
- "Illegal client" sau khi cấu hình AppKey/Secret/security image — https://support.tuya.com/en/help/_detail/Kaw4qcrfm88po
- FAQ on SmartLife App — https://developer.tuya.com/en/docs/iot/tuya-smart-app-smart-life-app-faq?id=K9kqi61prn3gr
- Fast Integration Android (SHA256/package name → illegal client) — https://developer.tuya.com/en/docs/app-development/integrated?id=Ka69nt96cw0uj
- Device Pairing (iOS — ThingSmartActivatorErrorModel/NSError) — https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4
- iOS Account Features — https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-account?id=Kalawg5deam3k
- Android Account Features — https://developer.tuya.com/en/docs/app-development/tutorial-for-android-account?id=Kalfig5pub1uz
