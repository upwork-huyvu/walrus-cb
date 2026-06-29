# Tuya Research: Smart Life App SDK — nền tảng Milestone 1 (init, login, home, pairing, DP control)

- **Ngày:** 2026-06-28 · **SDK version tham chiếu:** Android `thingsmart` **7.5.6**
- **Nguồn chính:**
  - Android Fast Integration — https://developer.tuya.com/en/docs/app-development/integrated?id=Ka69nt96cw0uj
  - iOS Fast Integration — https://developer.tuya.com/en/docs/app-development/integrate-sdk?id=Ka5d52ewngdoi
  - Preparation (tạo App SDK trên console) — https://developer.tuya.com/en/docs/app-development/preparation?id=Ka69nt983bhh5
  - Mappings App account ↔ Data Center — https://developer.tuya.com/en/docs/iot/oem-app-data-center-distributed?id=Kafi0ku9l07qb
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ → API **Android** lấy được verbatim khá đầy đủ; nhiều trang **iOS** chỉ confirm được tên class/method (signature chi tiết phải mở trang trực tiếp khi code). Mục "Câu hỏi mở" liệt kê những chỗ chưa xác minh tận chữ ký.

---

## TL;DR (cho người sắp code)
1. **Không có tham số "data center" trong init.** Region được quyết bởi (a) **Data Center của Cloud Project/AppKey** (chọn lúc tạo App SDK trên console) và (b) **`countryCode`/`region`** dùng khi register/login. Các DC **cô lập nhau** — account đăng ký ở DC này không dùng được ở DC khác. ⇒ Ràng buộc "SDK DC phải trùng Cloud Project DC" thực chất = **tạo App SDK đúng DC + login bằng countryCode đúng vùng**.
2. **EU = "Western Europe" Data Center** (ra mắt **2025-11-25**), gồm France, Spain, **Germany**, Poland, Netherlands, Belgium, Austria, Italy, Greece... App tạo **trước** 2025-11-25 có thể nằm ở **Central Europe** (giữ allocation cũ) → **phải xác minh DC thực tế của AppKey với client.**
3. **Init đọc AppKey/AppSecret từ native config**, KHÔNG cần truyền từ JS: Android lấy từ `AndroidManifest` meta-data (`THING_SMART_APPKEY`/`THING_SMART_SECRET`) + `security-algorithm.aar`; iOS lấy từ `startWithAppKey:secretKey:` + file bảo mật `ios_core_sdk.tar.gz`. ⇒ Bề mặt TurboModule nên là `initSdk()` (không tham số DC), AppSecret nằm native-only.
4. **Pairing token sống 10 phút** và **hết hạn ngay sau khi 1 thiết bị pair xong** → phải `getActivatorToken(homeId)` **ngay trước mỗi lần pairing**. Cần đã login + có ≥1 home.
5. **EZ Wi-Fi tỉ lệ thành công thấp hơn AP**; cả 2 chỉ chạy **Wi-Fi 2.4GHz**. BLE cần quyền runtime (Android 12+: `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`/`ACCESS_FINE_LOCATION`).
6. **Điều khiển DP**: `publishDps(json)` rồi **chỉ coi là xong khi `onDpUpdate` callback về**; value-type là **số** (`{"104":20}`) không phải string.
7. **thirdLogin**: type `"gg"` (Google, dùng **idToken** + `extraInfo {"pubVersion":1}`), `"ap"` (Apple), `"fb"` (Facebook). Google cần SDK ≥ v3.19.0, Apple ≥ v3.14.0 (7.5.6 thừa sức).

---

## Khái niệm & luồng
**Thứ tự bắt buộc:** `init SDK` → `login` (email/third, với `countryCode` đúng vùng) → `createHome`/`queryHomeList` (lấy `homeId`) → `getActivatorToken(homeId)` → `pairing` (EZ/AP/BLE) → `newDeviceInstance(devId)` → `publishDps` + `registerDevListener`. Token và pairing đều **bắt buộc có homeId** và **đang đăng nhập**.

**Entry instance (Android):** mọi thứ đi qua `ThingHomeSdk`:
`getUserInstance()` (IThingUser), `getHomeManagerInstance()` (IThingHomeManager), `getActivatorInstance()`, `newHomeInstance(homeId)`, `newDeviceInstance(devId)`, `getBleOperator()`, `getActivator()`.

---

## API chính

### 1) Init & tích hợp native
| Platform | Class/Method | Tham số | Ghi chú |
|---|---|---|---|
| Android | `ThingHomeSdk.init(application)` | đọc AppKey/Secret từ Manifest | gọi trong `Application.onCreate`; biến thể `init(app, appkey, appsecret)` nếu muốn nạp tay |
| Android | `ThingHomeSdk.onDestroy()` | — | gọi khi thoát app |
| iOS | `[[ThingSmartSDK sharedInstance] startWithAppKey:secretKey:]` + `[ThingSmartBusinessExtensionConfig setupConfig]` | appKey, secretKey | gọi trong `application:didFinishLaunchingWithOptions:` |

**Android — Gradle (verbatim):**
```gradle
// repositories
maven { url 'https://maven-other.tuya.com/repository/maven-releases/' }
maven { url "https://maven-other.tuya.com/repository/maven-commercial-releases/" }
// dependency
implementation 'com.thingclips.smart:thingsmart:7.5.6'
implementation fileTree(include: ['*.aar'], dir: 'libs')   // cho security-algorithm.aar
```
- File bảo mật: **`security-algorithm.aar`** đặt trong thư mục **`libs/`**.
- AppKey/Secret (verbatim):
```xml
<meta-data android:name="THING_SMART_APPKEY" android:value="AppKey" />
<meta-data android:name="THING_SMART_SECRET" android:value="AppSecret" />
```
- `minSdkVersion 23`, `targetSdkVersion 35`. **Bắt buộc add SHA-256 fingerprint** lên console (từ v3.29.5+). **Package name phải trùng** console.
- ProGuard/R8: keep `com.thingclips.**`, FastJSON, MQTT (`org.eclipse.paho`), OkHttp3, OkIO; không obfuscate Matter SDK & Mini SDK.

**iOS — Podfile (verbatim):**
```ruby
source 'https://github.com/tuya/tuya-pod-specs.git'
platform :ios, '11.0'
target 'Your_Project_Name' do
  pod "ThingSmartCryption", :path => './'
  pod "ThingSmartHomeKit"
  pod "ThingSmartBusinessExtensionKit"
end
```
- File bảo mật: giải nén **`ios_core_sdk.tar.gz`** → có **`Build/`** + **`ThingSmartCryption.podspec`**, đặt **ngang cấp `Podfile`** (giữ bí mật, không commit).
- Import: `#import <ThingSmartHomeKit/ThingSmartKit.h>`. **Bundle ID phải trùng** console.

### 2) Login (email + third-party)
| Platform | Class/Method | Tham số | Ghi chú |
|---|---|---|---|
| Android | `getUserInstance().sendVerifyCodeWithUserName(userName, region, countryCode, type, IResultCallback)` | `type`: 1 register, 2 login, 3 reset, 8 unregister; `region` mặc định "" | gửi mã xác thực |
| Android | `getUserInstance().registerAccountWithEmail(countryCode, email, passwd, code, IRegisterCallback)` | | đăng ký email |
| Android | `getUserInstance().loginWithEmail(countryCode, email, passwd, ILoginCallback)` | | login email+pass |
| Android | `getUserInstance().loginWithEmailCode(countryCode, email, code, ILoginCallback)` | | login email+OTP |
| Android | `getUserInstance().thirdLogin(countryCode, token, type, extraInfo, ILoginCallback)` | type `"gg"`/`"ap"`/`"fb"` | xem dưới |
| iOS | `ThingSmartUser sharedInstance` (login email / thirdLogin) | — | tên class confirm; **signature chưa verify verbatim** |

**thirdLogin (Android, verbatim):**
```java
ThingHomeSdk.getUserInstance().thirdLogin(countryNumberCode, token, "gg",
  "{\"pubVersion\":1}", new ILoginCallback() {
    @Override public void onSuccess(User user) { }
    @Override public void onError(String code, String error) { }
  });
```
- **Google** `"gg"`: truyền **idToken** của Google (không phải accessToken) + `extraInfo {"pubVersion":1}`. SDK ≥ v3.19.0.
- **Apple** `"ap"`: truyền token Apple. SDK ≥ v3.14.0.
- **Facebook** `"fb"`: accessToken (ngoài scope M1).
- App lấy idToken qua `@react-native-google-signin/google-signin` (Google) và `@invertase/react-native-apple-authentication` (Apple) rồi đưa vào lib gọi `thirdLogin` — đúng như brief.

### 3) Home management
| Platform | Class/Method | Tham số | Ghi chú |
|---|---|---|---|
| Android | `getHomeManagerInstance()` → `IThingHomeManager` | — | quản lý home |
| Android | `createHome(String name, double lon, double lat, String geoName, List<String> rooms, IThingHomeResultCallback)` | | tạo home → trả `HomeBean` (có `homeId`) |
| Android | `queryHomeList(IThingGetHomeListCallback)` | | list home; rỗng nếu chưa có |
| Android | `newHomeInstance(homeId).getHomeDetail(callback)` | | device/group/room của home |

**Owner / role:** `HomeBean.role` — **`2` = home owner**, `1` = admin, `0` = member, `-1` = custom, `-999` = invalid; thêm field `admin` (boolean). ⇒ Ràng buộc dự án "account phải là Owner" = `role == 2`. App của ta **1 home/user**: sau login nếu `queryHomeList` rỗng thì `createHome`, dùng `homeId` đó cho mọi pairing/control.

### 4) Pairing Wi-Fi (EZ + AP) + token
**Token (Android, verbatim):**
```java
ThingHomeSdk.getActivatorInstance().getActivatorToken(homeId,
  new IThingActivatorGetToken() {
    @Override public void onSuccess(String token) { }
    @Override public void onFailure(String s, String s1) { }
  });
```
> Token **valid 10 phút**, hết hạn ngay sau khi 1 device pair xong → lấy mới mỗi lần.

**EZ (Android, verbatim):**
```java
ActivatorBuilder builder = new ActivatorBuilder()
    .setSsid(ssid).setPassword(password).setContext(context)
    .setActivatorModel(ActivatorModelEnum.TY_EZ)   // AP: ActivatorModelEnum.TY_AP
    .setTimeOut(timeout).setToken(token)
    .setListener(new IThingSmartActivatorListener() {
        @Override public void onActiveSuccess(DeviceBean devResp) { }
        @Override public void onError(String errorCode, String errorMsg) { }
        @Override public void onStep(String step, Object data) { }
    });
IThingActivator activator = ThingHomeSdk.getActivatorInstance().newMultiActivator(builder);
activator.start();   // activator.stop(); activator.onDestroy();
```
- **AP fallback** = đổi `setActivatorModel(ActivatorModelEnum.TY_AP)` (phone nối hotspot của thiết bị). EZ tỉ lệ thấp hơn AP.
- **Chỉ Wi-Fi 2.4GHz.**

**iOS (tên API confirm, signature mở trang khi code):** `ThingSmartActivator` — `getTokenWithHomeId:success:failure:`, `startConfigWiFi:ssid:password:token:timeout:` với mode `ThingActivatorModeEZ` / `ThingActivatorModeAP`, delegate nhận device, `stopConfigWiFi`.

### 5) Pairing Bluetooth (BLE single-point)
**Android (verbatim):**
```java
LeScanSetting setting = new LeScanSetting.Builder()
    .setTimeout(60000).addScanType(ScanType.SINGLE).build();
ThingHomeSdk.getBleOperator().startLeScan(setting, new BleScanResponse() {
    @Override public void onResult(ScanDeviceBean bean) { /* id,name,productId,uuid,mac,address,deviceType,isbind */ }
});

BleActivatorBean bean = new BleActivatorBean(scanDeviceBean);
bean.homeId = homeId;
ThingHomeSdk.getActivator().newBleActivator().startActivator(bean, new IBleActivatorListener() {
    @Override public void onSuccess(DeviceBean deviceBean) { }
    @Override public void onFailure(int code, String msg, Object handle) { }
});
// stop: ThingHomeSdk.getBleManager().stopBleConfig(uuid);
```
- Quyền Android 12+: `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION` (phải xin runtime trước khi scan).
- **iOS:** classes `ThingSmartBLEManager`, `ThingSmartBLEWifiActivator` (combo BLE+Wi-Fi). Signature mở trang khi code.

### 6) Device control (DP) + status listener
**Android (verbatim):**
```java
IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(devId);

mDevice.publishDps("{\"104\": 20}", new IResultCallback() {  // value-type là SỐ
    @Override public void onError(String code, String error) { }
    @Override public void onSuccess() { }   // mới chỉ là "đã gửi"
});

mDevice.registerDevListener(new IDevListener() {
    @Override public void onDpUpdate(String devId, String dpStr) { }       // <-- xác nhận điều khiển thật
    @Override public void onStatusChanged(String devId, boolean online) { }
    @Override public void onNetworkStatusChanged(String devId, boolean status) { }
    @Override public void onRemoved(String devId) { }
    @Override public void onDevInfoUpdate(String devId) { }
});
// mDevice.unregisterDevListener();
```
- Định dạng DP: bool `{"101":true}`, value `{"104":20}`, enum `{"103":"2"}`, string `{"102":"ff5500"}`, raw-hex `{"105":"1122"}`, nhiều DP `{"101":true,"102":"ff5500"}`.
- Kênh: LAN / **MQTT** (hay dùng) / HTTPS.
- **DP của ice-bath (nhiệt độ hiện tại / mục tiêu / power / UV / defrost)**: dpId **chưa biết**, phải đọc từ product/DP schema của thiết bị thật (xem "Câu hỏi mở").

---

## Khác biệt iOS vs Android (ảnh hưởng RN bridge)
| Khía cạnh | Android | iOS |
|---|---|---|
| Tích hợp | Gradle + `security-algorithm.aar` (libs/) | CocoaPods + `ios_core_sdk.tar.gz` (Build/ + ThingSmartCryption) |
| AppKey/Secret | Manifest meta-data | tham số `startWithAppKey:secretKey:` |
| Entry | `ThingHomeSdk.*` | `ThingSmartSDK` / `ThingSmartUser` / `ThingSmartActivator` / `ThingSmartDevice` |
| Init điểm | `Application.onCreate` | `didFinishLaunchingWithOptions` |
| BLE perms | runtime Android 12+ (SCAN/CONNECT/FINE_LOCATION) | Info.plist usage strings (Bluetooth/Local Network) |
| Pairing API | builder + `IThingSmartActivatorListener` | `ThingSmartActivator` + delegate |

⇒ TurboModule nên trừu tượng hoá thành **1 bề mặt TS chung**, native impl khác nhau 2 bên. `initSdk()` ở Android chỉ cần gọi `ThingHomeSdk.init(context)`; ở iOS gọi `startWithAppKey:secretKey:` (đọc key từ plist/native config).

## Điều kiện tiên quyết & cấu hình
- **Console:** tạo **App SDK** với **Bundle ID (iOS)** + **Package Name (Android)** đúng, add **SHA-256** (Android), lấy **AppKey/AppSecret** + tải **file bảo mật** (2 nền tảng khác nhau). **Chọn Data Center = Western Europe** (EU).
- **Region/DC khớp:** dùng **countryCode EU** khi register/login; Cloud Project phục vụ admin (Milestone C) cũng phải **cùng DC**.
- **Quyền:** Android — INTERNET, ACCESS_FINE_LOCATION, ACCESS_WIFI_STATE, CHANGE_WIFI_STATE, BLUETOOTH_SCAN/CONNECT (12+). iOS — NSBluetoothAlwaysUsageDescription, NSLocalNetworkUsageDescription, NSLocationWhenInUseUsageDescription + Privacy Manifest (xem PrivacyInfo doc).
- **Phiên bản:** Android minSdk 23 (dùng **24** cho RN 0.80+), targetSdk 35, `thingsmart 7.5.6`; iOS Tuya min 11.0 nhưng RN 0.80+ cần ≥ iOS 15.1 (cao hơn → OK).

## Mã lỗi thường gặp & cách xử lý
| Code | Ý nghĩa | Xử lý |
|---|---|---|
| `-1` | SDK chưa init | đảm bảo `initSdk()` chạy trước mọi call |
| `-3` | Connection timeout | thử lại |
| `-5` | Param invalid | kiểm tra tham số (countryCode, dps type...) |
| `-33` | Lấy token timeout | lấy lại token |
| `-55` | **Token hết hạn** | `getActivatorToken` mới (>10 phút hoặc đã pair 1 device) |
| `-56` / `-57` | Token mismatch / verify fail | lấy token mới, kiểm tra homeId |
| `-60` | MQTT chưa kết nối | chờ kết nối / kiểm tra mạng |
| `-62` | MQTT mã hoá fail | kiểm tra device encryption |
| `-1400` / `-1402` | DP không hỗ trợ / query timeout | kiểm tra dpId đúng schema |
| `-10001` | Device không kết nối | kiểm tra online state |
> Doc **không có code riêng cho "sai Data Center"** — biểu hiện qua **login fail / không thấy thiết bị**. Đây chính là cạm bẫy lớn nhất của dự án.

## Cạm bẫy / lưu ý cho dự án ice-bath
1. **DC mismatch = bug "ẩn"**: không có error code rõ; thiết bị pair ở app Smart Life (DC khác) sẽ **không hiện** trong app ta nếu AppKey ở DC khác. → chốt EU (Western Europe) cho cả AppKey + Cloud Project + countryCode.
2. **App SDK tạo trước 2025-11-25** có thể đang ở **Central Europe** → hỏi client AppKey thuộc DC nào (đừng giả định).
3. **Token 10 phút + chết sau 1 pair** → trong UI pairing phải lấy token ngay trước khi start, và lấy lại khi pair thiết bị thứ 2.
4. **EZ hay fail** → luôn có nút chuyển **AP mode**; chỉ 2.4GHz.
5. **`publishDps.onSuccess` ≠ điều khiển xong** → phải đợi `onDpUpdate` mới update UI nhiệt độ.
6. **value-type DP là số**, sai kiểu → `-1400`/không ăn.
7. **AppSecret + file bảo mật native-only** — không vào JS/repo (đúng ràng buộc dự án).
8. **TurboModule wrap SDK native cổ điển**: init phải chạy ở `MainApplication`/`AppDelegate` (hoặc lib tự gọi `ThingHomeSdk.init(context)` trong `initSdk()`); device status đẩy lên JS qua **event emitter** map từ `IDevListener.onDpUpdate`.

## Câu hỏi mở / cần xác minh trên thiết bị
- **dpId thực tế của ice-bath** (nhiệt độ hiện tại, nhiệt độ mục tiêu, power, UV, defrost, filter) — đọc từ product/DP schema thiết bị thật (cần 1 device + productId).
- **iOS signature verbatim**: `ThingSmartUser` (email/thirdLogin), `ThingSmartActivator` (EZ/AP/token), `ThingSmartBLEWifiActivator` — mở đúng trang iOS khi code B4/B6/B8/B9 (đã có URL trong Nguồn).
- **DC thực tế của AppKey** client cung cấp (Western Europe hay Central Europe?).
- **thirdLogin trên iOS**: cùng type `"gg"/"ap"` và idToken? (Android confirm; iOS suy luận, cần verify).
- **countryCode chuẩn** cho thị trường mục tiêu (Đức = 49? danh sách country code: cloud doc).

## Nguồn (URL đã đọc)
- Android Fast Integration — https://developer.tuya.com/en/docs/app-development/integrated?id=Ka69nt96cw0uj
- iOS Fast Integration — https://developer.tuya.com/en/docs/app-development/integrate-sdk?id=Ka5d52ewngdoi
- Preparation — https://developer.tuya.com/en/docs/app-development/preparation?id=Ka69nt983bhh5
- Quick Start Android — https://developer.tuya.com/en/docs/app-development/tutorial-for-android-final?id=Kapicb0k79vrg
- Quick Start iOS — https://developer.tuya.com/en/docs/app-development/tutorial-for-ios-final?id=Kaohsbl43lxjb
- Mappings App account ↔ Data Center — https://developer.tuya.com/en/docs/iot/oem-app-data-center-distributed?id=Kafi0ku9l07qb
- Login with Third-Party Account — https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd
- Register/Login with Email — https://developer.tuya.com/en/docs/app-development/useremail?id=Ka6a99luv3tr1
- Home Information Management — https://developer.tuya.com/en/docs/app-development/familyrelations?id=Ka6ki8h2c2yo5
- Wi-Fi EZ Mode — https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9
- Wi-Fi AP Mode — https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha
- Device Pairing (iOS) — https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4
- Bluetooth LE Devices (Android) — https://developer.tuya.com/en/docs/app-development/android-bluetooth-ble?id=Karv7r2ju4c21
- Bluetooth Pairing — https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z
- Device Control (Android) — https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y
- Error Codes — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
- Privacy Manifest (iOS) — https://developer.tuya.com/en/docs/app-development/PrivacyInfo?id=Kdgwv9p6ual8m
