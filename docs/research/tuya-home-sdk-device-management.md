# Tuya Research: Smart Life App SDK - Device Management (rename / remove / reset / OTA / group / room / Wi-Fi signal)

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x** · iOS `ThingSmartHomeKit` **~7.5**
- **Data Center:** Central Europe (theo cấu hình dự án).
- **Nguồn chính:**
  - Device Management (Android) - https://developer.tuya.com/en/docs/app-development/devicemanage?id=Ka6ki8r2rfiuu
  - Device Management (iOS) - https://developer.tuya.com/en/docs/app-development/device?id=Ka5cgmmjr46cp
  - Firmware Update (Android) - https://developer.tuya.com/en/docs/app-development/otaupdate?id=Ka6ki8la8wnr9
  - Firmware Update (chung Android+iOS) - https://developer.tuya.com/en/docs/app-development/otaupdate?id=Kceuh0g56a4nw
  - Firmware Update (iOS) - https://developer.tuya.com/en/docs/app-development/ios-device-firmware?id=Kaj1ck2g3jaqs
  - Group Management (Android) - https://developer.tuya.com/en/docs/app-development/group?id=Ka6ki8l6zjfhj
  - Group Management (iOS) - https://developer.tuya.com/en/docs/app-development/group?id=Ka5srtq1wirky
  - Room Device Management - https://developer.tuya.com/en/docs/app-development/extension-room-device?id=Kdq3sdupfn2me
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. API **Android** (device mgmt, OTA, group) lấy verbatim khá đầy đủ; **iOS** lấy được signature chính xác cho updateName/remove/resetFactory, OTA, group. Mục "Cạm bẫy" + "Câu hỏi mở" liệt kê chỗ cần xác minh tận chữ ký khi code.

---

## Phạm vi
Quản lý thiết bị **sau khi pair**:
1. **Rename** (đổi tên), đồng bộ multi-device.
2. **Remove** (gỡ khỏi home) vs **Factory reset** (khôi phục xuất xưởng, xoá dữ liệu) - khác nhau.
3. **Thông tin chi tiết**: các field của `DeviceBean` (Android) / `ThingSmartDeviceModel` (iOS).
4. **OTA firmware**: check version → start upgrade → progress listener → cancel → auto-upgrade switch.
5. **Gán phòng** (room assignment).
6. **Wi-Fi signal strength**.
7. **Query device / sub-device** (gateway → sub-device).
8. **Group** thiết bị: create / control (`publishDps` tới group) / rename / dismiss.

Brief ice-bath: 1 home/user, thường 1 thiết bị Wi-Fi → cần nhất **rename + remove/reset + OTA + Wi-Fi signal + device detail**. Group/room/sub-device là tuỳ chọn (ưu tiên thấp).

---

## Khái niệm & luồng
- **Entry instance:** mọi thao tác device đi qua `IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(devId)` (Android) / `ThingSmartDevice *device = [ThingSmartDevice deviceWithDeviceId:devId]` (iOS). Đây cùng instance dùng cho `publishDps` ở note nền tảng.
- **Listener pattern:** đăng ký `IDevListener` (Android) / set `delegate` (iOS) để nhận: DP update, info update (sau rename), removed, online/offline, network change, **và OTA status/progress** (iOS gộp OTA callback vào `ThingSmartDeviceDelegate`).
- **remove vs resetFactory:**
  - `removeDevice` / `remove` → gỡ thiết bị khỏi home; thiết bị quay về trạng thái chờ pair (Wi-Fi vào EZ mode mặc định). Dữ liệu cấu hình cloud bị xoá khỏi tài khoản.
  - `resetFactory` → khôi phục mặc định, **xoá sạch dữ liệu trên thiết bị** rồi vào trạng thái chờ pair. Mạnh hơn remove.
- **OTA luồng (mới, khuyến nghị):** `newOTAServiceInstance(devId)` → `getFirmwareUpgradeInfo` (trả `List<UpgradeInfoBean>`, mỗi bean là 1 "channel"/type: MCU, Wi-Fi, BT, Zigbee…) → lọc bean có `canUpgrade`/`upgradeStatus==1` → `registerDevOTAListener` → `startFirmwareUpgrade(list)` → nhận progress/success/failure qua listener. iOS: `checkFirmwareUpgrade` → `startFirmwareUpgrade:` → delegate progress.
- **Group:** chỉ gom thiết bị **cùng productId** (cùng loại). Tạo từ home instance → trả `groupId`/`ThingSmartGroup` → `publishDps` điều khiển cả nhóm cùng lúc. Ice-bath 1 device thường **không cần group**.
- **Room:** thiết bị được gán vào room thuộc home; dùng để tổ chức UI.

---

## API Android (verbatim)

### 1) Khởi tạo & listener
```java
IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(String devId);

mDevice.registerDevListener(new IDevListener() {
    @Override public void onDpUpdate(String devId, String dpStr) {}
    @Override public void onRemoved(String devId) {}                       // sau removeDevice/resetFactory
    @Override public void onStatusChanged(String devId, boolean online) {} // online/offline
    @Override public void onNetworkStatusChanged(String devId, boolean status) {}
    @Override public void onDevInfoUpdate(String devId) {}                 // sau renameDevice
});

mDevice.unRegisterDevListener();
mDevice.onDestroy();   // giải phóng khi rời màn hình
```

### 2) Rename / Remove / Factory reset
```java
// Đổi tên (đồng bộ multi-device); sau khi đổi, IDevListener.onDevInfoUpdate() được gọi
mDevice.renameDevice(String name, IResultCallback callback);

// Gỡ thiết bị khỏi home (về trạng thái chờ pair; Wi-Fi -> EZ)
mDevice.removeDevice(IResultCallback callback);

// Khôi phục xuất xưởng (xoá data trên device rồi chờ pair)
mDevice.resetFactory(IResultCallback callback);
```
`IResultCallback`: `onSuccess()` / `onError(String code, String error)`.

### 3) Query DP & Wi-Fi signal
```java
// Lấy giá trị 1 DP (chủ động query từ device)
mDevice.getDp(String dpId, IResultCallback callback);

// Cường độ sóng Wi-Fi (RSSI)
mDevice.requestWifiSignal(new WifiSignalListener() {
    @Override public void onSignalValueFind(String signal) {}      // ví dụ "-50" dBm
    @Override public void onError(String errorCode, String errorMsg) {}
});
```

### 4) Sub-device (gateway → sub-device)
- Lấy danh sách sub-device dưới 1 gateway: `IThingDevice` của gateway có `getSubDevList` / `requestSubDeviceList` (qua cloud). Brief ice-bath nhiều khả năng **không có gateway/sub-device** → ưu tiên thấp; xác minh chữ ký verbatim khi cần (xem Câu hỏi mở).

### 5) OTA firmware (Android, verbatim)
```java
// Service mới (khuyến nghị)
IThingOTAService iThingOTAService = ThingHomeSdk.newOTAServiceInstance(String devId);

// Lấy thông tin firmware có thể nâng cấp (mỗi UpgradeInfoBean = 1 channel/type)
iThingOTAService.getFirmwareUpgradeInfo(new IGetOtaInfoCallback() {
    // onSuccess(List<UpgradeInfoBean> list) / onError(String code, String error)
});

// Đăng ký listener trạng thái + tiến độ
iThingOTAService.registerDevOTAListener(new IDevOTAListener() {
    // onStatusChanged(...), onProgress(...), onSuccess(...), onFailure(...), onTimeout(...)
});

// Bắt đầu nâng cấp (truyền list bean cần update)
iThingOTAService.startFirmwareUpgrade(List<UpgradeInfoBean> upgradeInfoBeans);

// Tiến độ (query chủ động)
iThingOTAService.getUpgradeProgress(IOtaProgressCallback callback);

// Huỷ (thiết bị low-power đang chờ wake)
iThingOTAService.cancelFirmwareUpgrade(int otaType, IResultCallback callback);

// Xác nhận tiếp tục khi cảnh báo (vd sóng yếu, error 5005)
iThingOTAService.confirmWarningUpgradeTask(String devId, boolean isContinue);

// Công tắc tự nâng cấp
iThingOTAService.getAutoUpgradeSwitchState(IThingDataCallback<Integer> callback);
iThingOTAService.changeAutoUpgradeSwitchState(int state, IResultCallback callback);

iThingOTAService.onDestroy();
```
> API cũ (deprecated): `IThingOta ota = ThingHomeSdk.newOTAInstance(devId)` → `ota.getOtaInfo(...)` + `ota.setOtaListener(IOtaListener)` (`onSuccess(int otaType)`, `onFailure(...)`, `onProgress(int otaType, int progress)`, `onTimeout(int otaType)`) → `ota.startOta()`. **Dùng `IThingOTAService` mới.**

---

## API iOS (verbatim / đối chiếu)

### 1) Khởi tạo & delegate
```objc
ThingSmartDevice *device = [ThingSmartDevice deviceWithDeviceId:devId];
device.delegate = self;

// ThingSmartDeviceDelegate
- (void)device:(ThingSmartDevice *)device dpsUpdate:(NSDictionary *)dps;
- (void)deviceInfoUpdate:(ThingSmartDevice *)device;                 // sau updateName
- (void)deviceRemoved:(ThingSmartDevice *)device;                    // sau remove/resetFactory
- (void)device:(ThingSmartDevice *)device signal:(NSString *)signal; // Wi-Fi RSSI
// OTA (gộp trong cùng delegate):
- (void)device:(ThingSmartDevice *)device otaUpdateStatusChanged:(ThingSmartFirmwareUpgradeStatusModel *)statusModel;
- (void)device:(ThingSmartDevice *)device firmwareUpgradeProgress:(NSInteger)type progress:(double)progress;
```

### 2) Rename / Remove / Factory reset / Wi-Fi signal
```objc
- (void)updateName:(NSString *)name
           success:(nullable ThingSuccessHandler)success
           failure:(nullable ThingFailureError)failure;

- (void)remove:(nullable ThingSuccessHandler)success
       failure:(nullable ThingFailureError)failure;

- (void)resetFactory:(nullable ThingSuccessHandler)success
             failure:(nullable ThingFailureError)failure;

- (void)getWifiSignalStrengthWithSuccess:(nullable ThingSuccessHandler)success
                                 failure:(nullable ThingFailureError)failure;
// -> kết quả RSSI trả qua delegate device:signal:

// Sub-device dưới gateway:
- (void)getSubDeviceListFromCloudWithSuccess:(nullable void (^)(NSArray<ThingSmartDeviceModel *> *subDeviceList))success
                                     failure:(nullable ThingFailureError)failure;
```

### 3) OTA firmware (iOS, verbatim)
```objc
- (void)checkFirmwareUpgrade:(void (^)(NSArray<ThingSmartFirmwareUpgradeModel *> *firmwares))success
                     failure:(nullable ThingFailureError)failure;

- (void)startFirmwareUpgrade:(NSArray<ThingSmartFirmwareUpgradeModel *> *)firmwares;

- (void)cancelFirmwareUpgrade:(ThingSuccessHandler)success
                      failure:(nullable ThingFailureError)failure;
// progress/status -> ThingSmartDeviceDelegate (firmwareUpgradeProgress / otaUpdateStatusChanged)
```

### 4) Group (iOS, verbatim)
```objc
+ (void)createGroupWithName:(NSString *)name
                  productId:(NSString *)productId
                     homeId:(long long)homeId
                  devIdList:(NSArray<NSString *> *)devIdList
                    success:(nullable void (^)(ThingSmartGroup *group))success
                    failure:(nullable ThingFailureError)failure;

+ (void)getDevList:(NSString *)productId homeId:(long long)homeId
           success:(nullable void(^)(NSArray<ThingSmartGroupDevListModel *> *list))success
           failure:(nullable ThingFailureError)failure;

- (void)updateGroupName:(NSString *)name success:(nullable ThingSuccessHandler)success failure:(nullable ThingFailureError)failure;
- (void)dismissGroup:(nullable ThingSuccessHandler)success failure:(nullable ThingFailureError)failure;
- (void)publishDps:(NSDictionary *)dps success:(nullable ThingSuccessHandler)success failure:(nullable ThingFailureError)failure;
- (void)updateGroupRelations:(NSArray<NSString *> *)devList success:(nullable ThingSuccessHandler)success failure:(nullable ThingFailureError)failure;
// delegate: - (void)group:(ThingSmartGroup *)group dpsUpdate:(NSDictionary *)dps;
```

### 5) Gán phòng (Room - iOS, verbatim · `ThingSmartRoomBiz`)
```objc
- (void)addDeviceWithDeviceId:(NSString *)deviceId roomId:(long long)roomId homeId:(long long)homeId
                      success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
- (void)removeDeviceWithDeviceId:(NSString *)deviceId roomId:(long long)roomId homeId:(long long)homeId
                         success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
- (void)saveBatchRoomRelationWithDeviceGroupList:(NSArray<NSString *> *)deviceGroupList
                                          roomId:(long long)roomId homeId:(long long)homeId
                                         success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
```

### Group (Android, verbatim)
```java
// Tạo group (Wi-Fi)
ThingHomeSdk.newHomeInstance(homeId).createGroup(productId, name, selectedDeviceIds,
    new IThingResultCallback<Long>() {
        @Override public void onSuccess(Long groupId) {}
        @Override public void onError(String errorCode, String errorMsg) {}
    });

// Thiết bị có thể thêm vào group
ThingHomeSdk.newHomeInstance(homeId).queryDeviceListToAddGroup(groupId, productId,
    new IThingResultCallback<List<GroupDeviceBean>>() {});

// Instance group để điều khiển
IThingGroup mGroup = ThingHomeSdk.newGroupInstance(groupId);
mGroup.publishDps(String command, IResultCallback listener);   // điều khiển cả nhóm
mGroup.renameGroup(String titleName, IResultCallback callback);
mGroup.dismissGroup(IResultCallback callback);
mGroup.registerGroupListener(IGroupListener listener);
mGroup.onDestroy();
```

### Room (Android)
```java
IThingRoom room = ThingHomeSdk.newRoomInstance(long roomId);
// room.addDevice(devId, IResultCallback) / room.removeDevice(...) - chữ ký verbatim cần mở trang khi code
```

---

## Bean / Callback / Listener

### DeviceBean (Android) - field chính
| Field | Ý nghĩa |
|---|---|
| `devId` | Device ID |
| `name` | Tên hiển thị |
| `dps` (`Map<String,Object>`) | Giá trị DP hiện tại |
| `dpCodes` | DP dạng code-value (standard) |
| `getIsOnline()` | Online (LAN hoặc cloud) |
| `isLocalOnline` | Online qua LAN |
| `verSw` | Phiên bản firmware hiện tại |
| `productId` | Product ID (cần khi tạo group) |
| `iconUrl` | Icon |

### ThingSmartDeviceModel (iOS) - field chính
| Field | Ý nghĩa |
|---|---|
| `devId` | Device ID |
| `name` | Tên |
| `dps` / `dpCodes` | DP value / code-value |
| `schemaArray` | Mảng rule DP (schema) |
| `productId` | Product ID |
| `isOnline` | Online (Wi-Fi/LAN/BT) |
| `isCloudOnline` / `isLocalOnline` | Online cloud / LAN |
| `localKey` | Khoá mã hoá giao tiếp |
| `uuid` | UUID |
| `homeId` / `roomId` | Home / Room liên kết |
| `capability` / `deviceType` | Năng lực / phân loại |
| `iconUrl` | Icon |

### UpgradeInfoBean (Android) / ThingSmartFirmwareUpgradeModel (iOS) - OTA
| Field | Ý nghĩa |
|---|---|
| `currentVersion` | Version đang chạy |
| `version` | Version mục tiêu |
| `upgradeStatus` | `0`=không có update · `1`=có update · `2`=đang update · `5`=chờ thiết bị wake |
| `upgradeType` | `0`=app nhắc · `2`=bắt buộc (forced) · `3`=tự dò |
| `type` / `typeDesc` | Channel firmware: `0`=main(Wi-Fi/BT) · `1`=BT · `3`=Zigbee · `9`=MCU… |
| `url` / `fileSize` / `md5` | Gói firmware (BT) |
| `controlType` | Có điều khiển được device khi đang update không |
| `desc` / `waitingDesc` / `upgradingDesc` | Mô tả hiển thị |
| `canUpgrade` / `remind` | Có thể nâng cấp / nhắc |

### Listener/Delegate tóm tắt
- **Android device:** `IDevListener` (5 callback: `onDpUpdate`, `onRemoved`, `onStatusChanged`, `onNetworkStatusChanged`, `onDevInfoUpdate`).
- **Android OTA:** `IDevOTAListener` (status/progress/success/failure/timeout); `IGetOtaInfoCallback` (list bean); `IOtaProgressCallback`.
- **iOS:** `ThingSmartDeviceDelegate` gộp device + OTA (`dpsUpdate`, `deviceInfoUpdate`, `deviceRemoved`, `device:signal:`, `otaUpdateStatusChanged`, `firmwareUpgradeProgress`).

---

## Mã lỗi liên quan
| Code | Ý nghĩa | Xử lý |
|---|---|---|
| `5005` | Sóng yếu khi OTA (weak signal warning) | gọi `confirmWarningUpgradeTask(devId, true)` để tiếp tục |
| `5012` | Thiết bị offline khi OTA | chờ device online lại |
| `5013` | Pre-validation OTA fail | thử lại / kiểm tra firmware |
| `5015` | Không lấy được firmware list | thử lại `getFirmwareUpgradeInfo` |
| `-1` | SDK chưa init | đảm bảo `initSdk()` chạy trước |
| `-10001` | Device không kết nối | kiểm tra online state trước rename/remove/OTA |
> Mã lỗi chung xem thêm note nền tảng (`-1`, `-3`, `-5`, `-1400`…). OTA dùng dải `50xx` riêng.

---

## Cạm bẫy
1. **remove ≠ resetFactory.** UI cần phân biệt rõ: "Gỡ thiết bị" (remove, có thể pair lại nhanh) vs "Khôi phục xuất xưởng" (reset, xoá data). Cả hai đều khiến device về trạng thái chờ pair → callback `onRemoved`/`deviceRemoved` → app phải điều hướng khỏi màn hình device.
2. **rename không tự cập nhật UI** - phải đợi `onDevInfoUpdate` (Android) / `deviceInfoUpdate:` (iOS) rồi đọc lại `name` từ bean/model. Đừng optimistic-update mà không reconcile.
3. **OTA là quá trình dài + rủi ro brick** nếu mất nguồn/mất mạng giữa chừng. Phải: kiểm `upgradeStatus`/`canUpgrade` trước, hiển thị progress, cảnh báo người dùng giữ nguồn, xử lý `5005` (sóng yếu). Với ice-bath, nên cảnh báo "không tắt máy khi đang cập nhật".
4. **`getFirmwareUpgradeInfo` trả LIST nhiều bean** (mỗi module = 1 type). Phải lọc bean cần nâng (vd `upgradeStatus==1`) rồi truyền vào `startFirmwareUpgrade(list)` - không truyền list rỗng.
5. **Wi-Fi signal trả về bất đồng bộ qua callback/delegate** (`onSignalValueFind` / `device:signal:`), không phải return trực tiếp. iOS đặc biệt: gọi `getWifiSignalStrengthWithSuccess` nhưng **giá trị RSSI về qua delegate `device:signal:`**, success block chỉ báo "đã gửi request".
6. **Group chỉ gom cùng `productId`.** Cần đọc `productId` từ bean. Ice-bath 1 device → thường bỏ qua group.
7. **iOS gộp OTA callback vào `ThingSmartDeviceDelegate`** trong khi Android tách `IDevOTAListener` riêng → khi bridge sang TurboModule phải map về **một bộ event chung** (vd `onOtaProgress`, `onOtaStatusChanged`).
8. **`onDestroy()` (Android) / huỷ delegate (iOS)** khi rời màn hình để tránh leak listener; OTA service cũng cần `onDestroy`.
9. **`startFirmwareUpgrade` không có callback trực tiếp** (Android void, iOS không success block) → kết quả phải đọc qua listener/delegate. Đừng coi gọi xong là thành công.

---

## Đề xuất API TurboModule (map vào lib)
Mở rộng **`TuyaDevice`** (đã có `publishDps`/`getDps`/listener) và thêm **module mới `TuyaOta`**. Group/room đưa vào `TuyaHome` (ưu tiên thấp). Bề mặt TS chung, native impl 2 nền tảng khác nhau như đã nêu.

### Mở rộng `TuyaDevice`
```ts
// Quản lý vòng đời thiết bị
renameDevice(devId: string, name: string): Promise<void>;          // -> onDevInfoUpdate, đọc lại name
removeDevice(devId: string): Promise<void>;                        // gỡ khỏi home
resetFactory(devId: string): Promise<void>;                       // khôi phục xuất xưởng

// Thông tin & tín hiệu
getDeviceDetail(devId: string): Promise<DeviceDetail>;            // map DeviceBean/ThingSmartDeviceModel
getWifiSignal(devId: string): Promise<number>;                    // RSSI dBm (resolve khi callback/delegate về)
querySingleDp(devId: string, dpId: string): Promise<void>;       // trigger getDp, value về qua onDeviceStatus

// Sub-device (ưu tiên thấp)
getSubDeviceList(gatewayDevId: string): Promise<DeviceDetail[]>;

// Event bổ sung (mở rộng onDeviceStatus hiện có)
// emit: 'onDeviceRemoved' { devId }, 'onDeviceInfoUpdate' { devId, name }
```
`DeviceDetail` đề xuất: `{ devId, name, online, isLocalOnline, productId, verSw, dps, dpCodes, iconUrl, homeId, roomId }`.

### Module mới `TuyaOta`
```ts
checkFirmwareUpgrade(devId: string): Promise<UpgradeInfo[]>;       // map UpgradeInfoBean / ThingSmartFirmwareUpgradeModel
startFirmwareUpgrade(devId: string, types: number[]): Promise<void>; // truyền type cần nâng; kết quả qua event
cancelFirmwareUpgrade(devId: string, otaType: number): Promise<void>;
confirmWarningUpgrade(devId: string, isContinue: boolean): Promise<void>; // xử lý 5005
getAutoUpgradeSwitch(devId: string): Promise<number>;
setAutoUpgradeSwitch(devId: string, state: number): Promise<void>;
// Events: 'onOtaProgress' { devId, type, progress },
//         'onOtaStatusChanged' { devId, type, status },
//         'onOtaSuccess' { devId, type }, 'onOtaFailure' { devId, code, message }
```
`UpgradeInfo` đề xuất: `{ type, typeDesc, currentVersion, version, upgradeStatus, upgradeType, fileSize, controlType, canUpgrade, desc }`.

### `TuyaHome` (group + room - ưu tiên thấp, chỉ nếu cần)
```ts
createGroup(homeId: number, productId: string, name: string, devIds: string[]): Promise<number>; // groupId
publishGroupDps(groupId: number, dpsJson: string): Promise<void>;
renameGroup(groupId: number, name: string): Promise<void>;
dismissGroup(groupId: number): Promise<void>;
assignDeviceToRoom(homeId: number, roomId: number, devId: string): Promise<void>;
```

**Khuyến nghị MVP ice-bath:** ưu tiên `renameDevice`, `removeDevice`, `resetFactory`, `getDeviceDetail`, `getWifiSignal` + toàn bộ `TuyaOta`. Group/room/sub-device để giai đoạn sau (1 device/home).

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **Chữ ký verbatim Android còn thiếu:** `IGetOtaInfoCallback`, `IDevOTAListener`, `IOtaProgressCallback` (tên tham số chính xác); `IThingRoom.addDevice/removeDevice`; `getSubDevList` của gateway. Mở trang Android trực tiếp khi code.
- **iOS `getWifiSignalStrengthWithSuccess`**: success block có trả RSSI trực tiếp hay luôn qua `device:signal:`? Cần verify khi code (note giả định về qua delegate).
- **OTA của ice-bath có những `type` nào** (MCU / Wi-Fi module / BT) - đọc từ `checkFirmwareUpgrade` trên thiết bị thật để biết cần nâng channel nào.
- **`upgradeStatus`/`upgradeType` mapping** cần khớp đúng với firmware thực tế của sản phẩm (giá trị có thể khác theo product).
- **Ice-bath có gateway/sub-device không?** Nếu là Wi-Fi standalone thì bỏ toàn bộ sub-device/group/room.
- **`controlType`** ý nghĩa boolean lúc đang OTA (có cho điều khiển không) - xác minh hành vi UI khi update.

---

## Nguồn (URL đã đọc)
- Device Management (Android) - https://developer.tuya.com/en/docs/app-development/devicemanage?id=Ka6ki8r2rfiuu
- Device Management (iOS) - https://developer.tuya.com/en/docs/app-development/device?id=Ka5cgmmjr46cp
- Device Service (core) - https://developer.tuya.com/en/docs/app-development/iot_app_sdk_core_device?id=Kdljiad0alpw5
- Firmware Update (Android) - https://developer.tuya.com/en/docs/app-development/otaupdate?id=Ka6ki8la8wnr9
- Firmware Update (Android+iOS) - https://developer.tuya.com/en/docs/app-development/otaupdate?id=Kceuh0g56a4nw
- Firmware Update (iOS) - https://developer.tuya.com/en/docs/app-development/ios-device-firmware?id=Kaj1ck2g3jaqs
- Group Management (Android) - https://developer.tuya.com/en/docs/app-development/group?id=Ka6ki8l6zjfhj
- Group Management (iOS) - https://developer.tuya.com/en/docs/app-development/group?id=Ka5srtq1wirky
- Room Device Management - https://developer.tuya.com/en/docs/app-development/extension-room-device?id=Kdq3sdupfn2me
- Home Information Management - https://developer.tuya.com/en/docs/app-development/familyrelations?id=Ka6ki8h2c2yo5
- Error Codes - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
