# Tuya Research: Device Pairing (nâng cao) — sub-device/gateway, QR, wired, multi-mode, Matter, search & retry

- **Ngày:** 2026-06-29 · **SDK tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x**; iOS `ThingSmartHomeKit` **~7.5**
- **Phạm vi note này:** các chế độ pairing **ngoài** Wi-Fi EZ/AP cơ bản (đã có ở note nền tảng `tuya-m1-sdk-foundation.md`). Đọc song song để tránh trùng EZ/AP, token cơ bản, BLE single-point.
- **Nguồn chính** (đầy đủ ở "## Nguồn"):
  - Sub-Device Pairing (Android) — https://developer.tuya.com/en/docs/app-development/sub-device-configuration?id=Kdljgoav49x55
  - Device Pairing — unified `ActivatorService` (iOS) — https://developer.tuya.com/en/docs/app-development/extension-activator?id=Kcy2dk3p3e3gn
  - Matter Device Pairing (Android+iOS) — https://developer.tuya.com/en/docs/app-development/matter_device_pair?id=Kcr7qt6rp3hi6 · iOS — https://developer.tuya.com/en/docs/app-development/activator_matter_ios?id=Kcy5lrzc7s20k
  - Scan QR Code on Device (Android) — https://developer.tuya.com/en/docs/app-development/Scan-the-QR-code-of-the-device-configuration?id=Kdljgqb401udm
  - Bluetooth Pairing — unified `ActivatorService` (Android) — https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z
  - iOS `ThingSmartActivator` API reference (verbatim) — https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/interface_thing_smart_activator.html
- **Lưu ý độ tin cậy:** Tuya hiện có **HAI thế hệ API pairing** chạy song song (xem mục dưới). Android lấy verbatim tốt cho thế hệ mới (`ActivatorService`) + Matter; iOS `ThingSmartActivator` legacy lấy verbatim từ API reference. Một số signature iOS thế hệ mới (`ThingSmartActivatorConfigProtocol`...) lấy được tên + protocol method nhưng model con (`ThingSmartActivatorTypeModel`...) chưa mở hết field — xem "Câu hỏi mở".

---

## TL;DR (cho người sắp code)
1. **CÓ 2 thế hệ API pairing — phải chọn 1 và nhất quán:**
   - **Legacy / "instance"** (giống note nền tảng): Android `ThingHomeSdk.getActivatorInstance()` + `ActivatorBuilder` + `newMultiActivator`; iOS `ThingSmartActivator` (singleton + delegate). Bao phủ EZ/AP/wired/QR/sub-device/gateway.
   - **Unified `ActivatorService`** (mới hơn): Android `ActivatorService.activator(ActivatorMode.X)` trả `IActivator` con (`BLEActivator`, `ZigbeeActivator`, `QRScanActivator`...) + `IActivatorListener` + `setParams(XxxActivatorParams)`; iOS `ThingSmartActivatorConfigProtocol`/`SearchProtocol`/`ActiveProtocol`. **Đây là hướng Tuya khuyến nghị cho app đa-chế-độ.**
   - **Matter** dùng API riêng (`getMatterDevActivatorInstance()` / `ThingSmartMatterActivator`) — không nằm trong 2 nhóm trên.
2. **Sub-device (Zigbee/BLE qua gateway):** gateway phải **online cloud** + sub-device đang ở **pairing mode**. Android: `ZigbeeActivator` + `ZigbeeActivatorParams(gwDeviceId, timeout)`; iOS: `[activator activeSubDeviceWithGwId:timeout:]`. **Không cần token** (gateway đã online làm trung gian).
3. **Wired pairing (thiết bị có dây):** thực chất là phát hiện thiết bị đã nối router rồi activate bằng token — iOS dùng `startConfigWiFiWithToken:timeout:` (KHÔNG có `ThingActivatorModeWired` riêng), thiết bị xuất hiện qua delegate. Android: pairing "wired/auto-scan" qua search activator + token.
4. **QR code trên thiết bị:** Android `QRScanActivator` + `QRScanActivatorParams(assetId, code)`; iOS `+[ThingSmartActivator parseQRCode:success:failure:]` → lấy UUID → `getTokenWithUUID:homeId:` → `startConfigWiFi:`. Áp dụng cho thiết bị **đã online internet** (GPRS/NB/IPC...).
5. **Multi-mode / dual-band (2.4+5GHz):** Tuya gọi là **multi-mode pairing**, dùng `newMultiActivator(builder)` (Android) — pairing **nhiều thiết bị** cùng lúc, mỗi device 1 callback `onActiveSuccess`. Tăng tỉ lệ thành công trên router dual-band so với EZ thuần.
6. **Matter** (Android verbatim đầy đủ): `parseSetupCode("MT:...")` → `getActivatorToken` → `connectDevice(ConnectDeviceBuilder)` → `commissionDevice(CommissioningParameters, MatterActivatorCallback)`; có auto-discovery (`startDiscovery`) và xử lý **attestation fail** cho thiết bị chưa cert. iOS cần thêm entitlement `matter.allow-setup-payload` + Bonjour trong Info.plist + `is_matter_support=true`.
7. **Search/stop activator + retry:** thế hệ mới có `IDiscovery`/`startDiscovery`/`stopDiscovery` (Android) và `startSearch:`/`stopSearch:clearCache:` (iOS) tách rời khỏi `startActive`/`stopActive`. **Luôn `stop()` + `destroy()`/`onDestroy()`** khi rời màn hình để tránh leak listener/cache.
8. **Token vẫn 10 phút, chết sau 1 device** (Matter cũng vậy) → lấy mới mỗi lần; sub-device qua gateway KHÔNG cần token.

---

## Khái niệm & luồng

### Hai thế hệ API — bảng tổng quan
| Chế độ | Legacy Android | Unified Android (`ActivatorService`) | iOS legacy (`ThingSmartActivator`) | iOS unified |
|---|---|---|---|---|
| EZ / AP Wi-Fi | `ActivatorBuilder` + `newMultiActivator` | (qua Wi-Fi params) | `startConfigWiFi:ssid:password:token:timeout:` mode EZ/AP | `ThingSmartActivatorActiveProtocol` |
| BLE single-point | `getActivator().newBleActivator()` | `activator(ActivatorMode.BLE)` → `BLEActivator` | `ThingSmartBLEManager` | `...Type Ble` |
| BLE+Wi-Fi combo | `BleWifiActivator` | qua `ActivatorMode` combo | `ThingSmartBLEWifiActivator` | — |
| Sub-device (Zigbee) | — | `activator(ActivatorMode.Zigbee)` → `ZigbeeActivator` | `activeSubDeviceWithGwId:timeout:` | `...Type SubDevice` |
| Gateway (cgw) | — | (qua activator gateway) | `activeGatewayDeviceWithGwId:productId:token:timeout:` | `...Type Router` |
| QR trên device | — | `activator(ActivatorMode.QRScan)` → `QRScanActivator` | `parseQRCode:` + `getTokenWithUUID:` | `...Type QRCode` |
| Wired | — | search + token | `startConfigWiFiWithToken:timeout:` | `...Type Wired` |
| Matter | `getMatterDevActivatorInstance()` | (API riêng) | `ThingSmartMatterActivator` | `...Type Matter` |

> Khuyến nghị cho dự án ice-bath: **chốt 1 thế hệ**. Thiết bị chính (bồn tắm đá) gần như chắc là **Wi-Fi/BLE single-point** ⇒ EZ/AP/BLE đã đủ (note nền tảng). Các phần dưới là dự phòng/mở rộng nếu sau này có gateway, sub-device, hoặc đổi sang Matter.

### Luồng sub-device (Zigbee qua gateway)
`gateway đã pair & online cloud` → đưa sub-device vào pairing mode (reset) → lấy `gwDeviceId` (devId của gateway) → tạo `ZigbeeActivator`/`activeSubDeviceWithGwId` với timeout → start → mỗi sub-device tìm thấy về qua `onSuccess`/`didReceiveDevice`. **Không cần activator token.**

### Luồng Matter
`parseSetupCode("MT:...")` → `SetupPayload` → `getActivatorToken(homeId)` → `connectDevice` (BLE/mDNS, callback `onFound`/`onConnected`) → `commissionDevice` (truyền `connectResult`, `setupPayload`, `token`, ssid/pwd) → `onActivatorSuccess(DeviceBean)`. Nếu `onDeviceAttestationFailed` → người dùng quyết định → `continueCommissioningDevice(..., ignoreAttestationFailure)`.

### Luồng QR-on-device
Quét QR (zxing) → chuỗi → Android `QRScanActivatorParams(assetId, code)`; iOS `parseQRCode:` → dict (uuid) → `getTokenWithUUID:homeId:` → `startConfigWiFi:`. Chỉ cho thiết bị **đã có internet**.

---

## API Android (verbatim)

### 1) Sub-device pairing — Zigbee qua gateway (unified `ActivatorService`)
```java
// Khởi tạo activator cho sub-device Zigbee
ZigbeeActivator zigbeeActivator =
    (ZigbeeActivator) ActivatorService.activator(ActivatorMode.Zigbee);

// Listener
zigbeeActivator.setListener(new IActivatorListener() {
    @Override public void onSuccess(@Nullable IDevice iDevice) {
        iDevice.getDeviceId();   // device id của sub-device
    }
    @Override public void onError(@NonNull String s, @NonNull String s1) { }
});

// Params: gwDeviceId = devId của gateway (phải online), timeout (ms)
ZigbeeActivatorParams zigbeeActivatorParams = new ZigbeeActivatorParams.Builder()
    .setGwDeviceId(gwDeviceId)
    .setTimeout(time)
    .build();
zigbeeActivator.setParams(zigbeeActivatorParams);

zigbeeActivator.start();
zigbeeActivator.stop();
```
> Yêu cầu: gateway **online cloud** + sub-device **đang ở pairing mode**. Không cần token.

### 2) QR code trên thiết bị (unified `ActivatorService`)
```java
QRScanActivator qrScanActivator =
    (QRScanActivator) ActivatorService.activator(ActivatorMode.QRScan);

// 'code' = chuỗi đọc được từ QR (vd qua com.journeyapps:zxing-android-embedded:3.6.0)
QRScanActivatorParams qrScanActivatorParams = new QRScanActivatorParams.Builder()
    .setAssetId("assetId")
    .setCode("code")
    .build();
qrScanActivator.setParams(qrScanActivatorParams);

qrScanActivator.setListener(new IActivatorListener() {
    @Override public void onSuccess(@Nullable IDevice iDevice) { }
    @Override public void onError(@NonNull String s, @NonNull String s1) { }
});

qrScanActivator.start();
qrScanActivator.stop();
```
> Chỉ áp dụng cho thiết bị **đã kết nối internet**.

### 3) BLE single-point (unified) + Discovery + retry/stop
```java
// Pairing
BLEActivator bleActivator = (BLEActivator) ActivatorService.activator(ActivatorMode.BLE);

BLEActivatorParams params = new BLEActivatorParams.Builder()
    .setAddress("address")
    .setAssetId("assetId")
    .setUuid("uuid")
    .setProductId("productId")
    .setTimeout(time)        // optional (ms)
    .build();
bleActivator.setParams(params);

bleActivator.setListener(new IActivatorListener() {
    @Override public void onSuccess(@Nullable IDevice iDevice) { }
    @Override public void onError(@NonNull String s, @NonNull String s1) { }
});

bleActivator.start();
bleActivator.stop();
bleActivator.destroy();   // giải phóng tài nguyên

// Search/Discovery (tách khỏi pairing)
IDiscovery iDiscovery = ActivatorService.discovery(DiscoveryMode.BLE);
DiscoveryParams discoveryParams = new DiscoveryParams(
    new DiscoveryParams.Builder().setTimeout(600_000));
iDiscovery.setParams(discoveryParams);
iDiscovery.startDiscovery();
iDiscovery.stopDiscovery();
```
> `BLEActivatorParams` fields: `address`, `assetId`, `uuid`, `productId`, `deviceType (Int, optional)`, `timeout (long, optional)`.
> Permissions: `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`.

### 4) Multi-mode / dual-band (legacy `newMultiActivator`)
```java
ActivatorBuilder builder = new ActivatorBuilder()
    .setSsid(ssid).setContext(context).setPassword(password)
    .setActivatorModel(ActivatorModelEnum.TY_EZ)   // hoặc TY_AP
    .setTimeOut(timeout).setToken(token)
    .setListener(new IThingSmartActivatorListener() {
        @Override public void onError(String errorCode, String errorMsg) { }
        @Override public void onActiveSuccess(DeviceBean devResp) { }   // 1 callback / device
        @Override public void onStep(String step, Object data) { }
    });

IThingActivator mThingActivator =
    ThingHomeSdk.getActivatorInstance().newMultiActivator(builder);
mThingActivator.start();
mThingActivator.stop();
mThingActivator.onDestroy();   // thoát màn hình → huỷ cache + listener
```
> `newMultiActivator`: "Multiple callbacks are required to pair multiple devices in the same call." ⇒ dùng cho multi-mode/dual-band, pairing đồng thời nhiều thiết bị; mỗi thiết bị thành công gọi `onActiveSuccess` riêng.

### 5) Matter (verbatim — API riêng)
```java
// 5.1 Parse setup code
private IMatterActivator mMatterDevActivatorInstance;
mMatterDevActivatorInstance = ThingHomeSdk.getMatterDevActivatorInstance();
SetupPayload setupPayload = mMatterDevActivatorInstance.parseSetupCode("MT:xxxxxxxxx");
// SetupPayload: version(int), vendorId(int), productId(int), setupPinCode(long), discriminator(Discriminator)

// 5.2 Token (10 phút, chết sau 1 device — như Wi-Fi)
ThingHomeSdk.getActivatorInstance().getActivatorToken(homeId, new IThingActivatorGetToken() {
    @Override public void onSuccess(String token) { }
    @Override public void onFailure(String s, String s1) { }
});

// 5.3 Connect (BLE / mDNS)
ConnectDeviceBuilder builder = new ConnectDeviceBuilder();
builder.setSetupPayload(setupPayload);
builder.setSpaceId(homeId);
builder.setTimeout(timeout);
builder.setConnectCallback(new IThingConnectDeviceCallback() {
    @Override public void onFound(boolean isThingMatter, MatterDeviceTypeEnum deviceType) { }
    @Override public void onConnected(ConnectResult connectResult) { }
    @Override public void onError(String errorCode, String errorMsg) { }
});
mMatterDevActivatorInstance.connectDevice(builder);
// ConnectResult: discoveryType(DiscoveryType BLE/mDNS), ipAddress, port, thingProductId,
//   accessType(0=Tuya,1=third-party), isThingMatter, nodeId(long), typeEnum, gwId

// 5.4 Commission
CommissioningParameters params = new CommissioningParameters.Builder()
    .connectDeviceResult(connectResult)
    .setupPayload(setupPayload)
    .spaceId(homeId)
    .token(token)
    .ssid(wifiSSId)
    .password(wifiPwd)
    .timeOut(timeout)
    .build();
mMatterDevActivatorInstance.commissionDevice(params, new MatterActivatorCallback() {
    @Override public void onActivatorSuccess(DeviceBean result) { }
    @Override public void onError(String errorCode, String errorMessage) { }
    @Override public void onDeviceAttestationFailed(long deviceControllerPtr, long devicePtr, int errorCode) { }
});

// 5.5 Auto-discovery
private IMatterDiscoveryActivator mDiscoveryActivatorInstance;
mDiscoveryActivatorInstance = ThingHomeSdk.getDiscoveryActivatorInstance();
mDiscoveryActivatorInstance.startDiscovery(new IDynamicDiscoveryListener() {
    @Override public void onFound(ThingMatterDiscovery discovery) { }
    @Override public void onError(String errorCode, String errorMsg) { }
});
mDiscoveryActivatorInstance.stopDiscovery();

// 5.6 Attestation / cancel
mMatterDevActivatorInstance.continueCommissioningDevice(
    deviceControllerPtr, devicePtr, ignoreAttestationFailure);
mMatterDevActivatorInstance.cancelActivator();
```

---

## API iOS (verbatim / đối chiếu)

### 1) `ThingSmartActivator` (legacy) — verbatim từ API reference
```objc
+ (nullable instancetype)sharedInstance;
@property (readwrite, nonatomic, weak) id<ThingSmartActivatorDelegate> delegate;

// Token
- (void)getTokenWithHomeId:(long long)homeId
                   success:(ThingSuccessString)success
                   failure:(ThingFailureError)failure;
- (void)getTokenWithUUID:(NSString *)uuid
                  homeId:(long long)homeId
                 success:(ThingSuccessString)success
                 failure:(ThingFailureError)failure;            // dùng cho QR
- (void)getTokenWithProductKey:(NSString *)productKey
                        homeId:(long long)homeId
                       success:(ThingSuccessString)success
                       failure:(ThingFailureError)failure;

// Wi-Fi (EZ/AP) + Wired (qua token, không có mode Wired riêng)
- (void)startConfigWiFi:(ThingActivatorMode)mode
                   ssid:(NSString *)ssid
               password:(NSString *)password
                  token:(NSString *)token
                timeout:(NSTimeInterval)timeout;
- (void)startConfigWiFi:(ThingActivatorMode)mode
                   ssid:(NSString *)ssid
               password:(NSString *)password
                  token:(NSString *)token
                regInfo:(nullable NSDictionary *)regInfo
                timeout:(NSTimeInterval)timeout;
- (void)startConfigWiFiWithToken:(NSString *)token
                         timeout:(NSTimeInterval)timeout;       // WIRED & các mode chỉ-token
- (void)startConfigWiFiWithToken:(NSString *)token
                       productId:(NSString *)productId
                         timeout:(NSTimeInterval)timeout;
- (void)stopConfigWiFi;

// QR code
+ (void)parseQRCode:(NSString *)content
            success:(ThingSuccessID)success
            failure:(ThingFailureError)failure;

// Gateway + Sub-device
- (void)activeGatewayDeviceWithGwId:(NSString *)gwId
                          productId:(NSString *)productId
                              token:(NSString *)token
                            timeout:(NSTimeInterval)timeout;
- (void)activeSubDeviceWithGwId:(NSString *)gwId timeout:(NSTimeInterval)timeout;
- (void)activeSubDeviceWithGwId:(NSString *)gwId
                        timeout:(NSTimeInterval)timeout
                     extensions:(nullable NSDictionary *)extensions;
- (void)activeSubDeviceWithGwId:(NSString *)gwId
                            mac:(NSString *)mac
                    installCode:(NSString *)installCode
                        timeout:(NSTimeInterval)timeout;
- (void)activeSubDeviceWithGwId:(NSString *)gwId
                   installCodes:(NSArray<NSDictionary *> *)installCodes
                        timeout:(NSTimeInterval)timeout;
- (void)stopActiveSubDeviceWithGwId:(NSString *)gwId;
```

### 2) `ThingSmartActivatorDelegate` (verbatim)
```objc
// Required
- (void)activator:(ThingSmartActivator *)activator
   didReceiveDevice:(nullable ThingSmartDeviceModel *)deviceModel
              error:(nullable NSError *)error;

// Optional
- (void)activator:(ThingSmartActivator *)activator
didDiscoverWifiList:(nullable NSArray *)wifiList
              error:(nullable NSError *)error;
- (void)activator:(ThingSmartActivator *)activator
didFindGatewayWithDeviceId:(nullable NSString *)deviceId
           productId:(nullable NSString *)productId;
- (void)activator:(ThingSmartActivator *)activator
   didReceiveDevice:(nullable ThingSmartDeviceModel *)deviceModel
               step:(ThingActivatorStep)step
              error:(nullable NSError *)error;
- (void)activator:(ThingSmartActivator *)activator
didPassWIFIToSecurityLevelDeviceWithUUID:(NSString *)uuid;
- (long long)activatorGetHomeId:(ThingSmartActivator *)activator;
- (void)deviceStateError:(NSError *)error;
```

### 3) Unified pairing protocols (iOS thế hệ mới)
```objc
@protocol ThingSmartActivatorConfigProtocol <NSObject>
- (void)loadConfig;
- (void)registerWithActivatorList:(NSArray<ThingSmartActivatorTypeModel *>*)typeList;
- (void)setupDelegate:(nullable id)delegate;
- (void)removeDelegate:(nullable id)delegate;
@end

@protocol ThingSmartActivatorSearchProtocol <NSObject>
- (void)startSearch:(NSArray<ThingSmartActivatorTypeModel *>*)typeList;
- (void)stopSearch:(NSArray<ThingSmartActivatorTypeModel *>*)typeList clearCache:(BOOL)clearCache;
@end

@protocol ThingSmartActivatorActiveProtocol <NSObject>
- (void)startActive:(ThingSmartActivatorTypeModel *)type
         deviceList:(NSArray<ThingSmartActivatorDeviceModel *>*)deviceList;
- (void)stopActive:(NSArray<ThingSmartActivatorTypeModel *>*)typeList clearCache:(BOOL)clearCache;
@end
```

**`ThingSmartActivatorType` (NS_OPTIONS, verbatim — đủ mode):**
```objc
typedef NS_OPTIONS(NSInteger, ThingSmartActivatorType) {
    ThingSmartActivatorTypeDefault     = 0,
    ThingSmartActivatorTypeWired       = 1 << 0,
    ThingSmartActivatorTypeBle         = 1 << 1,
    ThingSmartActivatorTypeBleMesh     = 1 << 2,
    ThingSmartActivatorTypeSigMesh     = 1 << 3,
    ThingSmartActivatorTypeSubDevice   = 1 << 4,
    ThingSmartActivatorTypeEZSearch    = 1 << 5,
    ThingSmartActivatorTypeAuto        = 1 << 6,
    ThingSmartActivatorTypeHomeKit     = 1 << 7,
    ThingSmartActivatorTypeRouter      = 1 << 8,
    ThingSmartActivatorTypePegasus     = 1 << 9,
    ThingSmartActivatorTypeAP          = 1 << 10,
    ThingSmartActivatorTypeQRCode      = 1 << 11,
    ThingSmartActivatorTypeBroadband   = 1 << 12,
    ThingSmartActivatorTypeMatter      = 1 << 13,
    ThingSmartActivatorTypeNB          = 1 << 14,
    ThingSmartActivatorTypeApDirectly  = 1 << 15,
    ThingSmartActivatorTypeThingLink   = 1 << 16,
    ThingSmartActivatorTypeVirtual     = 1 << 17,
    ThingSmartActivatorTypeMQTTDirectly= 1 << 18,
    ThingSmartActivatorTypeInstallCode = 1 << 19,
    ThingSmartActivatorTypeBeacon      = 1 << 20,
    ThingSmartActivatorTypeEnd         = 1 << 21,
};
```

### 4) Matter iOS (đối chiếu — tên class/method)
```objc
// ThingSmartMatterActivator
- (void)getTokenWithHomeId:success:failure:        // token 10 phút
- (id /*ThingSmartActivatorDeviceModel*/)parseSetupCode:(NSString *)code;   // QR/manual → model hoặc nil

// ThingSmartMatterActivatorConfig
- (void)setMatterConfigKey:(NSString *)appGroupId; // init Matter module bằng App Group ID

// ThingSmartActivatorDiscovery
- (void)registerWithActivatorList:(NSArray *)list;
- (void)startSearch:(NSArray *)list;
- (void)stopSearch:(NSArray *)list clearCache:(BOOL)clearCache;
- (void)startActive:(id)type deviceList:(NSArray *)deviceList;
- (void)stopActive:(NSArray *)list clearCache:(BOOL)clearCache;
- (void)continueCommissionDevice:typeModel:;                       // CASE session sau PASE
- (void)continueCommissioningDevice:ignoreAttestationFailure:error:; // thiết bị chưa cert

// Delegate
// ThingSmartActivatorSearchDelegate:  activatorService:activatorType:didFindDevice:error:
// ThingSmartActivatorActiveDelegate:  activatorService:activatorType:didReceiveDevices:error:
// ThingSmartActivatorDeviceExpandDelegate:
//   matterDeviceDiscoveryed:
//   matterCommissioningSessionEstablishmentComplete:
//   matterDeviceAttestation:error:
```
> iOS Matter prerequisites: entitlement `matter.allow-setup-payload`, cấu hình Bonjour service trong `Info.plist`, và `is_matter_support=true` trong `thing_custom_config.json`.

---

## Bean / Callback / Listener (tổng hợp)

**Android (unified `ActivatorService`):**
- `ActivatorService.activator(ActivatorMode mode)` → `IActivator` (con: `BLEActivator`, `ZigbeeActivator`, `QRScanActivator`, ...). `ActivatorMode`: `BLE`, `Zigbee`, `QRScan`, ... (enum). Mỗi activator: `setParams(...)`, `setListener(IActivatorListener)`, `start()`, `stop()`, `destroy()`.
- `IActivatorListener`: `onSuccess(@Nullable IDevice iDevice)`, `onError(@NonNull String code, @NonNull String msg)`. `IDevice.getDeviceId()`.
- Params (builder): `ZigbeeActivatorParams(gwDeviceId, timeout)`, `QRScanActivatorParams(assetId, code)`, `BLEActivatorParams(address, assetId, uuid, productId, deviceType?, timeout?)`.
- Discovery: `ActivatorService.discovery(DiscoveryMode mode)` → `IDiscovery` với `setParams(DiscoveryParams)`, `startDiscovery()`, `stopDiscovery()`. `DiscoveryParams.Builder().setTimeout(ms)`.

**Android (legacy):** `IThingActivator` (từ `getActivatorInstance().newMultiActivator(builder)`): `start()`, `stop()`, `onDestroy()`. `IThingSmartActivatorListener`: `onActiveSuccess(DeviceBean)`, `onError(String,String)`, `onStep(String,Object)`. `ActivatorBuilder` setters: `setSsid/setPassword/setContext/setActivatorModel(ActivatorModelEnum)/setTimeOut/setToken/setListener`.

**Android Matter:** `IMatterActivator`, `IMatterDiscoveryActivator`; beans `SetupPayload`, `ConnectDeviceBuilder`, `ConnectResult`, `CommissioningParameters`; callbacks `IThingConnectDeviceCallback(onFound/onConnected/onError)`, `MatterActivatorCallback(onActivatorSuccess/onError/onDeviceAttestationFailed)`, `IDynamicDiscoveryListener(onFound(ThingMatterDiscovery)/onError)`. Enum `MatterDeviceTypeEnum`, `DiscoveryType` (BLE/mDNS).

**iOS:** `ThingSmartActivator` (singleton + `ThingSmartActivatorDelegate`); model trả về `ThingSmartDeviceModel`. Unified: `ThingSmartActivatorTypeModel`, `ThingSmartActivatorDeviceModel`, `ThingSmartActivatorErrorModel(deviceModel, error)`. Matter: `ThingSmartMatterActivator`, `ThingSmartActivatorTypeMatterModel(token, spaceId, timeout, ssid, password, gwDevId)`, `ThingMatterDeviceDiscoveriedType(wifi/thread)`.

---

## Mã lỗi liên quan
| Code | Ý nghĩa | Áp dụng |
|---|---|---|
| `-33` | Timeout khi lấy token | mọi pairing cần token (Wi-Fi/QR/Matter/gateway) |
| `-55` | Token đã hết hạn | lấy `getActivatorToken` mới (>10') hoặc đã pair 1 device |
| `-56` | Token không khớp | lấy token mới, kiểm tra homeId |
| `-57` | Token verify fail | lấy token mới |
| `-1373` | `parentId` sub-device không khớp `devId` của main/NVR | kiểm tra đúng gateway |
| `-1374` | `nodeId` của sub-device rỗng | sub-device không vào pairing mode đúng |
| `-1375` | Kênh sub-device chưa liên kết IPC SDK | (camera/NVR) |
| `-10001` | Device không kết nối | gateway/thiết bị offline |
> Sub-device qua gateway: lỗi thường là **gateway offline** hoặc **sub-device chưa vào pairing mode** (về qua `onError` với chuỗi message, không phải code chuẩn). Matter: lỗi attestation báo qua `onDeviceAttestationFailed`/`matterDeviceAttestation:error:` (không phải error code thường). Trang error code chính thiên về IPC/P2P — nhiều lỗi pairing chỉ trả message string ⇒ surface nguyên `code+message` lên JS.

---

## Cạm bẫy
1. **Trộn 2 thế hệ API** (legacy `getActivatorInstance` vs unified `ActivatorService`) trong cùng module → khó maintain. Chốt 1 và document rõ trong lib.
2. **Sub-device cần gateway ONLINE** + sub-device ở pairing mode; nếu gateway vừa pair xong chưa kịp online cloud sẽ fail. Kiểm tra trạng thái online gateway trước khi start.
3. **Sub-device KHÔNG dùng activator token** (khác Wi-Fi/Matter) — đừng gọi `getActivatorToken` rồi truyền nhầm.
4. **QR-on-device chỉ cho thiết bị đã có internet** (GPRS/NB/IPC) — không phải để cấu hình Wi-Fi cho thiết bị mới. Đừng nhầm với QR-mode "thiết bị quét QR trên màn hình app".
5. **Matter iOS** thiếu entitlement `matter.allow-setup-payload`/Bonjour/`is_matter_support` → parse setup code hoặc discovery sẽ im lặng fail. Matter Android cần khởi tạo Matter SDK riêng (đừng obfuscate Matter SDK — đã note ở ProGuard nền tảng).
6. **Attestation fail** (`onDeviceAttestationFailed`/`matterDeviceAttestation:error:`) với thiết bị chưa cert → phải hỏi người dùng rồi `continueCommissioningDevice(..., ignoreAttestationFailure=true)`; bỏ qua bước này = treo luồng commission.
7. **Token 10 phút vẫn áp cho Matter & Wi-Fi/QR** — chết sau 1 device; lấy mới mỗi lần.
8. **Không `stop()` + `destroy()/onDestroy()`** khi rời màn hình → leak listener, scan chạy nền tốn pin (đặc biệt BLE/discovery timeout 600s).
9. **`onSuccess`/`didReceiveDevice` ≠ thiết bị sẵn sàng điều khiển** — vẫn nên `newDeviceInstance` + chờ online như luồng control nền tảng.
10. **Multi-mode `newMultiActivator` trả nhiều callback** — UI phải xử lý danh sách, không giả định 1 device/lần.
11. **Permissions BLE** (Android 12+ runtime, iOS Info.plist) áp cho mọi luồng có quét BLE/discovery, kể cả Matter (BLE commissioning) và sub-device BLE-gateway.

---

## Đề xuất API TurboModule

Mở rộng **`TuyaPairing`** (đã có EZ/AP/BLE) bằng các method nâng cao, và tách **`TuyaMatter`** thành module riêng (vì dùng API/entitlement riêng, có thể lazy-load). Giữ pattern "promise + event emitter cho thiết bị tìm được" như EZ/AP hiện tại.

```ts
// ===== Mở rộng TuyaPairing =====
export interface PairedDevice { devId: string; name?: string; productId?: string; }

// Sub-device qua gateway (Zigbee/BLE gateway). Gateway phải online; KHÔNG cần token.
export function startSubDevicePairing(
  gatewayDevId: string,
  timeoutMs: number
): Promise<void>;                                  // kết quả từng device qua event 'onDeviceFound'
export function stopSubDevicePairing(gatewayDevId: string): Promise<void>;

// Pair chính gateway (cgw) — Wi-Fi gateway cần token+productId (iOS activeGatewayDeviceWithGwId)
export function startGatewayPairing(
  gatewayDevId: string,
  productId: string,
  token: string,
  timeoutMs: number
): Promise<void>;

// QR code IN thiết bị (thiết bị đã online internet)
export function parseDeviceQRCode(content: string): Promise<{ uuid?: string; [k: string]: any }>;
export function startQRCodePairing(
  params: { assetId?: string; code: string; homeId: number; timeoutMs: number }
): Promise<PairedDevice>;

// Wired pairing (thiết bị nối dây/router) — phát hiện rồi activate bằng token
export function startWiredPairing(homeId: number, token: string, timeoutMs: number): Promise<void>;

// Multi-mode / dual-band: pair NHIỀU thiết bị 1 lần (mỗi device 1 event 'onDeviceFound')
export function startMultiModePairing(
  params: { ssid: string; password: string; token: string; mode: 'EZ' | 'AP'; timeoutMs: number }
): Promise<void>;
export function stopMultiModePairing(): Promise<void>;

// Search/discovery tách rời (BLE/EZ search) — kết quả qua event 'onSearchDeviceFound'
export function startDeviceDiscovery(mode: 'BLE' | 'EZ', timeoutMs: number): Promise<void>;
export function stopDeviceDiscovery(): Promise<void>;

// Lifecycle chung — gọi khi rời màn hình pairing
export function destroyActivator(): Promise<void>;

// Events (NativeEventEmitter):
//  'onDeviceFound'        -> { devId, name?, productId? }
//  'onSearchDeviceFound'  -> { uuid, address, productId, name?, isBind }
//  'onPairingStep'        -> { step: string, data?: any }      // map onStep / didReceiveDevice:step:
//  'onPairingError'       -> { code: string, message: string } // surface nguyên code+message

// ===== Module mới: TuyaMatter =====
export interface MatterSetupPayload {
  version: number; vendorId: number; productId: number; setupPinCode: number; discriminator: number;
}
export interface MatterConnectResult {
  discoveryType: 'BLE' | 'mDNS'; ipAddress?: string; port?: number; thingProductId?: string;
  accessType: 0 | 1; isThingMatter: boolean; nodeId: number; gwId?: string;
}
export function parseMatterSetupCode(code: string): Promise<MatterSetupPayload>;     // "MT:..."
export function connectMatterDevice(
  payload: MatterSetupPayload, homeId: number, timeoutMs: number
): Promise<MatterConnectResult>;
export function commissionMatterDevice(
  params: {
    connectResult: MatterConnectResult; payload: MatterSetupPayload;
    homeId: number; token: string; ssid: string; password: string; timeoutMs: number;
  }
): Promise<PairedDevice>;                                                            // onActivatorSuccess
// Auto-discovery Matter (event 'onMatterDeviceFound')
export function startMatterDiscovery(): Promise<void>;
export function stopMatterDiscovery(): Promise<void>;
// Attestation cho thiết bị chưa cert
export function continueMatterCommissioning(ignoreAttestationFailure: boolean): Promise<void>;
export function cancelMatterActivator(): Promise<void>;

// Events: 'onMatterDeviceFound', 'onMatterAttestationRequired' -> { errorCode }, 'onMatterError'
```

**platformNotes (gói gọn cho spec):**
- **Sub-device:** Android `ActivatorService.activator(ActivatorMode.Zigbee)` + `ZigbeeActivatorParams(gwDeviceId,timeout)`; iOS `[[ThingSmartActivator sharedInstance] activeSubDeviceWithGwId:timeout:]` + delegate `didReceiveDevice:error:`. Không token.
- **Gateway (cgw):** iOS `activeGatewayDeviceWithGwId:productId:token:timeout:` (cần token+productId); Android tương ứng qua activator gateway/token.
- **QR-on-device:** Android `QRScanActivator`+`QRScanActivatorParams(assetId,code)`; iOS `+parseQRCode:` → `getTokenWithUUID:homeId:` → `startConfigWiFi:`.
- **Wired:** iOS dùng `startConfigWiFiWithToken:timeout:` (không có mode Wired riêng), thiết bị về qua delegate; Android qua search+token.
- **Multi-mode:** Android legacy `newMultiActivator` (nhiều callback `onActiveSuccess`); cân nhắc giữ trong TuyaPairing với mode flag.
- **Matter:** Android `getMatterDevActivatorInstance()` (parse/connect/commission/discovery/attestation); iOS `ThingSmartMatterActivator` + entitlement `matter.allow-setup-payload` + Bonjour + `is_matter_support=true`.

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **Thiết bị ice-bath có cần chế độ nào ngoài EZ/AP/BLE?** Nếu là Wi-Fi/BLE single-point thuần thì các module nâng cao (sub-device/gateway/Matter) là **dự phòng**, không ưu tiên M1.
- **`ActivatorMode` enum đầy đủ (Android)** — mới confirm `BLE`, `Zigbee`, `QRScan`; cần mở API reference Android để liệt kê hết (Wired/Auto/...). 
- **`ThingSmartActivatorTypeModel` field đầy đủ (iOS unified)** — cần mở reference để lấy verbatim (token, spaceId, timeout, ssid, password, gwDevId... — hiện suy từ Matter model).
- **Wired pairing Android** — chưa thấy class verbatim riêng; nhiều khả năng nằm trong `ActivatorMode.Auto`/search + token. Cần verify.
- **`ThingActivatorStep` / `onStep` step values** — chuỗi step cụ thể (vd "device_find", "device_bind_success") chưa liệt kê trong doc; cần log thực tế.
- **iOS Matter signature verbatim đầy đủ** (`connectDevice`, `commissionDevice` tương đương Android) — reference iOS Matter chưa mở hết; hiện đối chiếu được tên method + delegate.
- **Mã lỗi pairing chuẩn** cho sub-device/gateway/BLE — trang error code thiên về IPC/P2P; phần lớn lỗi pairing trả message string → cần thu thập thực tế.

## Nguồn (URL đã đọc)
- Sub-Device Pairing (Android) — https://developer.tuya.com/en/docs/app-development/sub-device-configuration?id=Kdljgoav49x55
- Device Pairing — unified protocols (iOS) — https://developer.tuya.com/en/docs/app-development/extension-activator?id=Kcy2dk3p3e3gn
- Device Pairing (iOS, tổng quan) — https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4
- Scan QR Code on Device (Android) — https://developer.tuya.com/en/docs/app-development/Scan-the-QR-code-of-the-device-configuration?id=Kdljgqb401udm
- Pair with QR Code on Device (iOS) — https://developer.tuya.com/en/docs/app-development/qrcode?id=Kcrt7fq8jgeh6
- Bluetooth Pairing — unified `ActivatorService` (Android) — https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z
- Wi-Fi EZ Mode (multi-mode `newMultiActivator`) — https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9
- Matter Device Pairing (Android+iOS) — https://developer.tuya.com/en/docs/app-development/matter_device_pair?id=Kcr7qt6rp3hi6
- Matter Device Pairing (iOS) — https://developer.tuya.com/en/docs/app-development/activator_matter_ios?id=Kcy5lrzc7s20k
- Wired Mode (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-network-wired?id=Kaixx5v2vnxhd
- Sub-Device Control Through Zigbee Gateway — https://developer.tuya.com/en/docs/app-development/gateway?id=Ka6ki8l5e3rjo
- ThingSmartActivator Class Reference (iOS, verbatim) — https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/interface_thing_smart_activator.html
- ThingSmartActivatorDelegate Protocol Reference (iOS, verbatim) — https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/protocol_thing_smart_activator_delegate-p.html
- Error Codes — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
