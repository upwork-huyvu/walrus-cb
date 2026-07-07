# Tuya Research: Device Control (nâng cao) - query DP, standard instruction set, group, multi-control, timer/schedule, publish có option

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x** · iOS `ThingSmartHomeKit` **~7.5** · Data Center: **Central Europe**
- **Quan hệ với note nền tảng:** Bổ sung cho `docs/research/tuya-m1-sdk-foundation.md` (đã có `publishDps(json)` cơ bản + `registerDevListener`/`onDpUpdate`). **Note này KHÔNG lặp publishDps cơ bản**, mà phủ: query 1 DP không tự báo, bộ lệnh chuẩn (standard instruction set / dpCodes / schema), publish có option (mode + thứ tự kênh), điều khiển nhóm (group publishDps), multi-control linkage, hẹn giờ/lịch (cloud timer), đọc trạng thái online + sub-device.
- **Nguồn chính:**
  - Device Control (Android) - https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y
  - Device Control (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-device-control?id=Kaiyeu0xukcuc
  - Device Management (Android) - https://developer.tuya.com/en/docs/app-development/devicemanage?id=Ka6ki8r2rfiuu
  - Group Management - https://developer.tuya.com/en/docs/app-development/group?id=Ka6ki8l6zjfhj
  - Multi-Control Linkage - https://developer.tuya.com/en/docs/app-development/devicemulticontrol?id=Ka6ki8l92gduk
  - Scheduled Tasks (timer) - https://developer.tuya.com/en/docs/app-development/timer?id=Ka6ki8l85zpcu
  - Device Schedule (extension) - https://developer.tuya.com/en/docs/app-development/extension-device-timer?id=Kcy2jpy6859p1
  - Standard Instruction Set - https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq
  - Change Control Instruction Mode - https://developer.tuya.com/en/docs/iot/change-control-instruction-mode?id=Kcbz8lahbg5st
  - iOS Device DP Parser - https://developer.tuya.com/en/docs/app-development/ios_device_control?id=Kcxopr96vsl0f
  - iOS ThingSmartTimer header (API ref) - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/ios-arm64_2_thing_smart_timer_kit_8framework_2_headers_2_thing_smart_timer_8h_source.html
- **Độ tin cậy:** Android lấy verbatim khá đầy đủ. iOS `ThingSmartDevice`/`ThingSmartTimer`/`ThingSmartMultiControl` verbatim tốt; `ThingSmartGroup` (bản Smart App SDK chuẩn, không phải Commercial Lighting) chỉ confirm được tên method, **signature đầy đủ cần mở header iOS khi code**. Mục "Câu hỏi mở" liệt kê chỗ chưa verify tận chữ ký.

---

## Phạm vi
1. **Query DP** - đọc 1 DP không tự báo (vd countdown/timer info) bằng `getDp`; đọc snapshot toàn bộ DP từ `DeviceBean.getDps()`.
2. **Bộ lệnh chuẩn (Standard Instruction Set / DP schema)** - phân biệt **standard instruction (code-based)** vs **DP instruction (id-based)**; đọc schema/dpCodes để map dpId ↔ code.
3. **Publish có option** - `publishDps` với **mode** (LAN/Internet/Auto) và với **orders** (thứ tự ưu tiên kênh BLE/cloud); `sendCacheDps` cho thiết bị low-power.
4. **Điều khiển nhóm** - tạo group Wi-Fi/Zigbee, `IThingGroup.publishDps` / `ThingSmartGroup`.
5. **Multi-control / linkage** - liên kết DP công tắc giữa nhiều thiết bị.
6. **Hẹn giờ / lịch (cloud timer)** - add/update/query/delete timer cho device & group.
7. **Trạng thái online / sub-device** - `getIsOnline`/`isLocalOnline`, listener `onStatusChanged`, field gateway/sub-device.

---

## Khái niệm & luồng

**Hai chế độ "lệnh điều khiển" (rất quan trọng cho dự án):**
- **Standard instruction mode (code-based):** lệnh dạng `{"code":"switch","value":true}` - Tuya tự ánh xạ code chuẩn của **category** sang DP thiết bị. Cùng category chỉ cần tích hợp 1 bộ code. Category dùng abbreviation (vd `dj` đèn, `kt` điều hoà, `wk` bộ điều nhiệt…); ice-bath có thể là thiết bị custom.
- **DP instruction mode (id-based):** lệnh dạng `{"104":20}` - đúng cái `publishDps` đang dùng ở M1. Đây là kênh **chắc ăn nhất** vì map trực tiếp dpId.
- **Đổi mode** ở Tuya Developer Platform (device management). Lưu ý: thay đổi áp dụng ngay ở China DC, **các DC khác mất ~4 giờ** để propagate. ⇒ Với ice-bath ở **Central/Western Europe**, nếu đổi mode phải chờ propagate.
- **Schema** = định nghĩa kiểu của từng DP (bool/value/enum/string/raw) + ràng buộc (min/max/step/scale/unit/range). Đọc schema để render UI + validate trước khi publish.

**Query DP:** `getDp(dpId)` chỉ dùng cho DP **không chủ động phát dữ liệu** (vd query countdown). Kết quả **KHÔNG trả trong callback của getDp** mà về qua `IDevListener.onDpUpdate` (Android) / delegate `device:dpsUpdate:` (iOS). DP thông thường: đọc snapshot từ `DeviceBean.getDps()` / `ThingSmartDeviceModel.dps`.

**Quy tắc bất biến (từ M1, vẫn áp dụng):** callback `onSuccess` của mọi `publishDps`/group/timer chỉ nghĩa là **"đã gửi lên cloud"**, chưa phải "thiết bị đã đổi trạng thái". Phải đợi `onDpUpdate`/`dpsUpdate` mới update UI.

**Tiên quyết:** trước khi điều khiển device/group phải init home (`getHomeDetail()` hoặc `getHomeLocalCache()`) để SDK có cache thiết bị + MQTT connect.

---

## API Android (verbatim)

### 1) Publish có option (mode + thứ tự kênh) + low-power cache
```java
// Auto (khuyến nghị) - đã có ở M1
IThingDevice.publishDps(dps, IResultCallback callback);

// Chỉ định kênh bằng enum
IThingDevice.publishDps(dps, ThingDevicePublishModeEnum mode, IResultCallback callback);
//   ThingDevicePublishModeEnum.ThingDevicePublishModeLocal     -> chỉ LAN
//   ThingDevicePublishModeEnum.ThingDevicePublishModeInternet  -> chỉ cloud
//   ThingDevicePublishModeEnum.ThingDevicePublishModeAuto      -> tự chọn

// Chỉ định THỨ TỰ ưu tiên kênh
IThingDevice.publishDps(dps, orders, IResultCallback callback);
//   orders: mảng theo enum CommunicationEnum.
//   Ví dụ [3, 1] = ưu tiên Bluetooth, nếu BLE không có thì dùng cloud.

// Low-power device: gửi DP vào cache, chờ thiết bị wake-up
void sendCacheDps(String devId, String dps, long validity, int dpCacheType,
                  IThingDataCallback<Boolean> listener);
//   validity: 1..172800 giây ; dpCacheType: 0 = device pull, 1 = cloud push
```
> `dps` luôn là JSON string; value-type là **số** (`{"104":20}`), không phải string (đã chốt ở M1).

### 2) Query DP + đọc snapshot/schema
```java
IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(devId);

// Query 1 DP không tự báo (kết quả về qua onDpUpdate, KHÔNG qua callback này)
mDevice.getDp(String dpId, IResultCallback callback);

// Đọc snapshot toàn bộ DP hiện tại (Map<dpId, value>)
DeviceBean bean = ThingHomeSdk.getDataInstance().getDeviceBean(devId);
Map<String, Object> dps = bean.getDps();
```

**`DeviceBean` (field liên quan, verbatim):**
- `devId` (String), `productId` (String)
- `dps` : `Map` DP hiện tại (key = dpId, value = dpValue)
- `schema` : định nghĩa kiểu DP · `schemaMap` : cache schema
- `dpCodes` : `Map<String, Object>` - ánh xạ **dp code (standard) ↔ value** (dùng cho standard instruction mode)
- `dpName` : `Map<String, String>` - tên DP đa ngôn ngữ
- `getIsOnline()` : `boolean` - online (LAN **hoặc** cloud)
- `isLocalOnline` : `boolean` - chỉ LAN
- Sub-device/gateway: `parentId`/`parentDevId` (gateway cha), `nodeId` (địa chỉ ngắn sub-device), `meshId`

**`ProductBean`:** `category` (abbreviation loại thiết bị), `capability` (Wi-Fi/BLE/Zigbee…).

### 3) Trạng thái online + listener (mở rộng M1)
```java
mDevice.registerDevListener(new IDevListener() {
    @Override public void onDpUpdate(String devId, String dpStr) { }        // kết quả publish/getDp
    @Override public void onStatusChanged(String devId, boolean online) { } // online/offline
    @Override public void onNetworkStatusChanged(String devId, boolean status) { }
    @Override public void onRemoved(String devId) { }
    @Override public void onDevInfoUpdate(String devId) { }
});
mDevice.unRegisterDevListener();

// MQTT (cloud) đã kết nối chưa
boolean connected = ThingHomeSdk.getServerInstance().isServerConnect();
```

### 4) Điều khiển nhóm (Group)
```java
// Tạo group Wi-Fi
ThingHomeSdk.newHomeInstance(homeId).queryDeviceListToAddGroup(groupId, productId,
    new IThingResultCallback<List<GroupDeviceBean>>() { /* onSuccess/onError */ });
ThingHomeSdk.newHomeInstance(homeId).createGroup(productId, name, selectedDeviceIds,
    new IThingResultCallback<Long>() { /* onSuccess(Long groupId) */ });

// Tạo group Zigbee
ThingHomeSdk.newHomeInstance(homeId).queryZigbeeDeviceListToAddGroup(groupId, productId, meshId, cb);
ThingHomeSdk.newHomeInstance(homeId).createZigbeeGroup(productId, meshId, name,
    new IThingResultCallback<CloudZigbeeGroupCreateBean>() { ... });

// Điều khiển nhóm
IThingGroup mIThingGroup = ThingHomeSdk.newGroupInstance(groupId);
mIThingGroup.publishDps(String command, IResultCallback listener);   // command = JSON DP
mIThingGroup.renameGroup(titleName, IResultCallback);
mIThingGroup.dismissGroup(IResultCallback);

mIThingGroup.registerGroupListener(new IGroupListener() {
    @Override public void onDpUpdate(long groupId, String dps) { }
    @Override public void onGroupInfoUpdate(long groupId) { }
    @Override public void onGroupRemoved(long groupId) { }
});
mIThingGroup.unRegisterGroupListener();
mIThingGroup.onDestroy();

// Đọc dữ liệu group
GroupBean gb = ThingHomeSdk.getDataInstance().getGroupBean(long groupId);
List<DeviceBean> list = ThingHomeSdk.getDataInstance().getGroupDeviceList(long groupId);
```

### 5) Multi-control linkage
```java
IThingDeviceMultiControl mc = ThingHomeSdk.getDeviceMultiControlInstance();

mc.getDeviceDpInfoList(String devId, IThingDataCallback<ArrayList<DeviceDpInfoBean>> cb);
mc.queryLinkInfoByDp(String devId, String dpId, IThingDataCallback<MultiControlLinkBean> cb);
mc.saveDeviceMultiControl(long homeId, MultiControlBean bean, IThingResultCallback<MultiControlBean> cb);
mc.saveDeviceMultiControl(long homeId, String json,           IThingResultCallback<MultiControlBean> cb);
mc.enableMultiControl(long multiControlId,  IThingResultCallback<Boolean> cb);
mc.disableMultiControl(long multiControlId, IThingResultCallback<Boolean> cb);
mc.getMultiControlDeviceList(long homeId, IThingDataCallback<ArrayList<MultiControlDevInfoBean>> cb);
mc.getDeviceDpLinkRelation(String devId, IThingDataCallback<DeviceMultiControlRelationBean> cb);
```
> **Ràng buộc:** chỉ hỗ trợ DP dạng `switch_number` và `sub_switch_number` (công tắc); hỗ trợ sub-device Zigbee và Bluetooth mesh. **Không áp dụng cho DP nhiệt độ value** của ice-bath.

### 6) Hẹn giờ / lịch (cloud timer)
```java
// SDK >= 3.18.0 dùng getTimerInstance() (cũ: getTimerManagerInstance())
IThingCommonTimer timer = ThingHomeSdk.getTimerInstance();

// Thêm timer
ThingTimerBuilder builder = new ThingTimerBuilder()
    .setTaskName(taskName)          // nhóm timer (1 timer thuộc tối đa 1 group)
    .setDevId(devIdOrGroupId)
    .setDeviceType(TimerDeviceTypeEnum.DEVICE)   // hoặc GROUP
    .setActions(actionsJson)        // DP + time "HH:mm"
    .setLoops("1100011")            // 7 ký tự: 1=bật ngày đó; "0000000"=một lần; "1111111"=hằng ngày
    .setStatus(1)                   // 1=enabled, 0=disabled
    .setIsAppPush(true)
    .setAliasName(alias);
timer.addTimer(builder, IResultCallback callback);

timer.updateTimer(ThingTimerBuilder builder, IResultCallback callback);

timer.updateTimerStatus(String devId, TimerDeviceTypeEnum type,
                        List<String> ids, TimerUpdateEnum op, IResultCallback cb);
//   TimerUpdateEnum: OPEN / CLOSE / DELETE

timer.getTimerList(String taskName, String devId, TimerDeviceTypeEnum type,
                   IThingDataCallback<TimerTask> callback);
timer.getAllTimerList(String devId, TimerDeviceTypeEnum type,
                      IThingDataCallback<List<TimerTask>> callback);
timer.updateCategoryTimerStatus(String taskName, String devId,
                      TimerDeviceTypeEnum type, TimerUpdateEnum op, IResultCallback cb);
```

**Biến thể "Device Schedule" extension (ThingDeviceDetailKit, builder-based) - verbatim:**
```java
HashMap<String, Object> dps = new HashMap<>();
dps.put("1", true);
TimerManagerBuilder builder = new TimerManagerBuilder.Builder()
    .setDeviceId("xxxx")            // hoặc .setGroupId(long)
    .setCategory("test")            // taskName
    .setTime("08:00")
    .setDps(dps)
    .setLoops("1100011")
    .setAliasName("Test")
    .isOpen(true)
    .isAppPush(true)
    .setCallback(new IThingTimerCallBack() {
        @Override public void successful(List<? extends AlarmTimerBean> list) {}
        @Override public void fail(int errorCode, String errorMsg) {}
    })
    .build();
ThingDeviceDetailKit.getInstance().getDeviceTimerManager().addTimer(builder);
// editTimer / deleteTimer / getTimerList / updateTimerStatus cùng builder
```

---

## API iOS (verbatim / đối chiếu)

### 1) Publish có option + low-power
```objc
+ (instancetype)deviceWithDeviceId:(NSString *)deviceId;

- (void)publishDps:(NSDictionary *)dps
           success:(ThingSuccessID)success
           failure:(ThingFailureError)failure;

- (void)publishDps:(NSDictionary *)dps
              mode:(ThingDevicePublishMode)mode      // ...Auto / ...Local / ...Internet
           success:(ThingSuccessID)success
           failure:(ThingFailureError)failure;

- (void)sendCacheDps:(NSDictionary *)dps
            validity:(NSUInteger)validity
         dpCacheType:(NSUInteger)dpCacheType
             success:(ThingSuccessID)success
             failure:(ThingFailureError)failure;
```
`ThingDevicePublishMode`: `ThingDevicePublishModeAuto` / `ThingDevicePublishModeLocal` / `ThingDevicePublishModeInternet`.
DP value (Obj-C): bool `@{@"1": @(YES)}`, string `@{@"4": @"ff5500"}`, enum `@{@"5": @"2"}`, value `@{@"6": @(20)}`, raw `@{@"15": @"1122"}`.

### 2) Snapshot/schema/online (ThingSmartDeviceModel)
- `dps` (NSDictionary) - DP hiện tại
- `productId` (NSString)
- `schemaArray` (NSArray) - định nghĩa schema DP
- `isOnline` (BOOL)
> iOS không có `getDp` riêng nổi bật như Android; query DP thường thực hiện qua publish DP "query type" hoặc đọc `dps`. Cần verify `getDp` trên header iOS khi code.

### 3) DP Parser / schema (chuẩn hoá UI từ schema)
```objc
// ThingSmartDpParser: parse DP theo schema cho device hoặc group
+ (instancetype)createWithTargetInfo:(id)targetInfo;   // ThingSmartDevice/Model/Group/GroupModel

@property (nonatomic, strong) ThingSmartSchemaModel *schemaModel; // range/min/max/step/scale/unit
- (nullable __kindof ThingSmartDp *)smartDpWithDpId:(NSInteger)dpId quickOp:(BOOL)quickOp;
- (NSString *)valueStatusWithDpValue:(id)dpValue;       // text hiển thị
- (nullable NSDictionary *)publishCommands:(id)newDpValue; // tạo lệnh publish hợp lệ từ schema
// nhóm: displayDp / operableDp / switchDp / allDp
// ThingSmartDp: dpId, name, titleStatus, valueStatus, curDpValue, unit
```

### 4) Điều khiển nhóm
```objc
+ (instancetype)groupWithGroupId:(NSString *)groupId;

- (void)publishDps:(NSDictionary *)dps
           success:(nullable ThingSuccessHandler)success
           failure:(nullable ThingFailureError)failure;
// addZigbeeDeviceWithNodeList: / removeZigbeeDeviceWithNodeList: (Zigbee)
// groupModel (ThingSmartGroupModel) -> deviceList
// DP update group về qua ThingSmartHomeDelegate (group dps update)
```
> Signature `addDevice`/`removeDevice`/`dismissGroup`/delegate `ThingSmartGroupDelegate` của **Smart App SDK chuẩn** chỉ confirm tên - mở header iOS khi code (Commercial Lighting có thêm `publishSwitchStatus`/`publishBrightPercent`… nhưng đó là SDK khác, đừng nhầm).

### 5) Multi-control linkage (ThingSmartMultiControl) - verbatim
```objc
- (void)getDeviceDpInfoWithDevId:(NSString *)devId
                         success:(void (^)(NSArray<ThingSmartMultiControlDatapointModel *> *))success
                         failure:(ThingFailureError)failure;

- (void)queryDeviceLinkInfoWithDevId:(NSString *)devId dpId:(NSString *)dpId
                             success:(void (^)(ThingSmartMultiControlLinkModel *))success
                             failure:(ThingFailureError)failure;

- (void)addMultiControlWithDevId:(NSString *)devId groupName:(NSString *)groupName
                     groupDetail:(NSArray<ThingSmartMultiControlDetailModel *> *)groupDetail
                         success:(void (^)(ThingSmartMultiControlModel *))success
                         failure:(ThingFailureError)failure;

- (void)updateMultiControlWithDevId:(NSString *)devId
                  multiControlModel:(ThingSmartMultiControlModel *)model
                            success:(void (^)(ThingSmartMultiControlModel *))success
                            failure:(ThingFailureError)failure;

- (void)enableMultiControlWithMultiControlId:(NSString *)multiControlId enable:(BOOL)enable
                                     success:(ThingSuccessBOOL)success failure:(ThingFailureError)failure;

- (void)getMultiControlDeviceListWithHomeId:(long long)homeId
                                    success:(void (^)(NSArray<ThingSmartMultiControlDeviceModel *> *))success
                                    failure:(ThingFailureError)failure;

- (void)queryDeviceDpRelationWithDevId:(NSString *)devId
                               success:(void (^)(ThingSmartMultiControlDpRelationModel *))success
                               failure:(ThingFailureError)failure;
```

### 6) Hẹn giờ / lịch (ThingSmartTimer) - verbatim từ header iOS
```objc
- (void)addTimerWithTask:(NSString *)task loops:(NSString *)loops
                   bizId:(NSString *)bizId bizType:(NSUInteger)bizType
                    time:(NSString *)time dps:(NSDictionary *)dps
                  status:(BOOL)status isAppPush:(BOOL)isAppPush aliasName:(NSString *)aliasName
                 success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;

- (void)getTimerListWithTask:(NSString *)task bizId:(NSString *)bizId bizType:(NSUInteger)bizType
                     success:(void(^)(NSArray<ThingTimerModel *> *list))success failure:(ThingFailureError)failure;

- (void)updateTimerStatusWithTask:(NSString *)task bizId:(NSString *)bizId bizType:(NSUInteger)bizType
                           status:(BOOL)status success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;

- (void)removeTimerWithTask:(NSString *)task bizId:(NSString *)bizId bizType:(NSUInteger)bizType
                    success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
```
> Từ SDK 3.18.0 các API timer cũ dùng `devId` đã **deprecated**, thay bằng `bizId` + `bizType` (device hay group). `bizType` là `NSUInteger` (device/group).

---

## Bean / Callback / Listener

| Tên | Nền tảng | Vai trò / field chính |
|---|---|---|
| `DeviceBean` | Android | `devId, productId, dps(Map), schema, schemaMap, dpCodes(Map), dpName(Map), getIsOnline(), isLocalOnline, parentId/parentDevId, nodeId, meshId` |
| `ThingSmartDeviceModel` | iOS | `dps, productId, schemaArray, isOnline` |
| `ProductBean` | Android | `category, capability` |
| `ThingDevicePublishModeEnum` | Android | `ThingDevicePublishModeLocal / ...Internet / ...Auto` |
| `ThingDevicePublishMode` | iOS | `ThingDevicePublishModeLocal / ...Internet / ...Auto` |
| `CommunicationEnum` | Android | mã kênh dùng cho `orders` (vd `[3,1]`= BLE→cloud) |
| `IDevListener` | Android | `onDpUpdate, onStatusChanged, onNetworkStatusChanged, onRemoved, onDevInfoUpdate` |
| `IThingGroup` / `IGroupListener` | Android | `publishDps, registerGroupListener`; listener: `onDpUpdate(long,String), onGroupInfoUpdate(long), onGroupRemoved(long)` |
| `GroupBean` / `GroupDeviceBean` | Android | model group / device khi tạo group |
| `IThingDeviceMultiControl` | Android | entry multi-control |
| `DeviceDpInfoBean` | Android | DP có thể link của 1 device |
| `MultiControlLinkBean` | Android | `multiGroup(MultiGroupBean), parentRules(List<ParentRulesBean>)`; `MultiGroupBean{uid, groupName, groupType, multiRuleId, id, ownerId, enabled, status, groupDetail}`; `GroupDetailBean{devId, dpName, multiControlId, dpId, devName, enabled, status, datapoints}` |
| `MultiControlBean` | Android | `groupName, groupType(=1 bắt buộc), groupDetail, id` |
| `MultiControlDevInfoBean` | Android | `productId, devId, iconUrl, name, roomName, inRule, datapoints` |
| `ThingSmartMultiControl*Model` | iOS | `MultiControlModel{multiControlId, groupName, groupType, groupDetail}`, `DetailModel{detailId, devId, dpId, enable}`, `DeviceModel{devId, productId, name, iconUrl, roomName, inRule, datapoints, multiControlIds}`, `DatapointModel{dpId, name, code, schemaId}` |
| `IThingCommonTimer` / `ThingTimerBuilder` / `TimerTask` | Android | timer; builder: `taskName, devId, deviceType, actions, loops, status, appPush, aliasName` |
| `TimerManagerBuilder` / `AlarmTimerBean` / `IThingTimerCallBack` | Android | device-schedule extension; `AlarmTimerBean{groupId, timezoneId, status, loops, time, value, isAppPush, aliasName}` |
| `TimerDeviceTypeEnum` / `TimerUpdateEnum` | Android | `DEVICE/GROUP` · `OPEN/CLOSE/DELETE` |
| `ThingSmartTimer` / `ThingTimerModel` | iOS | timer; `bizId + bizType` thay `devId` |
| `ThingSmartDpParser` / `ThingSmartSchemaModel` / `ThingSmartDp` | iOS | parse DP theo schema để render UI/validate |

---

## Mã lỗi liên quan
(Bổ sung cho bảng ở note nền tảng - các code điều khiển hay gặp.)

| Code | Ý nghĩa | Xử lý |
|---|---|---|
| `-1` | SDK chưa init | đảm bảo `initSdk()` chạy trước |
| `-5` | Param invalid | sai kiểu dps / dpId / loops / time |
| `-60` | MQTT chưa kết nối | chờ `getServerInstance().isServerConnect()` true |
| `-62` | MQTT mã hoá fail | kiểm tra device encryption |
| `-1400` | DP không hỗ trợ | dpId không có trong schema / sai kiểu value |
| `-1402` | Query DP timeout | thử lại; kiểm tra online |
| `-10001` | Device không kết nối | kiểm tra online state trước khi publish |
| Device Schedule extension | `1`=device offline, `2`=execution failure, `3`=device info unavailable, `4`=timeout, `5`=device exception | xử lý theo `IThingTimerCallBack.fail(errorCode, errorMsg)` |
> Standard vs DP instruction mode mismatch **không** có error code riêng - biểu hiện là publish "thành công" nhưng DP không đổi. Đây là cạm bẫy với standard mode.

---

## Cạm bẫy
1. **`onSuccess` ≠ điều khiển xong** (lặp lại từ M1 vì cực quan trọng): mọi `publishDps`/group/timer - chỉ update UI khi `onDpUpdate`/`dpsUpdate` về.
2. **`getDp` không trả qua callback của nó** mà qua `onDpUpdate` → đăng ký listener trước khi gọi `getDp`.
3. **Standard vs DP instruction mode**: dự án nên dùng **DP id-based** (`{"104":20}`) cho ice-bath để chắc ăn; chỉ dùng code-based nếu thiết bị đã map standard category. Đổi mode mất **~4h propagate** ở DC ngoài China → đừng test ngay sau khi đổi.
4. **Multi-control chỉ cho DP `switch_number`/`sub_switch_number`** → **không** dùng được cho nhiệt độ value của ice-bath. Tính năng này nhiều khả năng **ngoài scope** dự án 1-thiết-bị.
5. **Group**: phải `init home` (getHomeDetail) trước; group có productId - chỉ gom **cùng product**. Dự án 1 ice-bath/home → group/multi-control hầu như **không cần** (cân nhắc cắt khỏi MVP).
6. **Timer API mới vs cũ**: Android dùng `getTimerInstance()` (>=3.18.0), iOS dùng `bizId/bizType` (devId-based đã deprecated). Đừng dùng API cũ.
7. **`loops` format**: chuỗi 7 ký tự bắt đầu từ một thứ cố định (`"0000000"`=một lần, `"1111111"`=hằng ngày). Sai độ dài → `-5`. `time` = `"HH:mm"`. Cần truyền `timezone` đúng để lịch chạy đúng giờ thiết bị.
8. **`sendCacheDps`** chỉ cho thiết bị low-power (battery); ice-bath cắm điện thường online → dùng publish thường.
9. **`publishDps(dps, mode)`**: ép `Local` mà phone không cùng LAN với thiết bị → fail; `Auto` an toàn nhất. `orders` (BLE-first) hữu ích nếu ice-bath có BLE và muốn điều khiển khi mất Wi-Fi.
10. **Online 2 mức**: `getIsOnline()` (LAN||cloud) vs `isLocalOnline` (chỉ LAN). UI nên hiển thị theo `getIsOnline()`; chọn channel theo `isLocalOnline`.

---

## Đề xuất API TurboModule

Map vào lib `@jimmy-vu/react-native-turbo-tuya`. Ưu tiên mở rộng **`TuyaDevice`** (đã có publishDps/getDps/listener). Tạo **`TuyaTimer`** (module mới) cho hẹn giờ. **`TuyaGroup`**/**`TuyaMultiControl`** đề xuất nhưng **để sau / có thể bỏ** cho dự án 1-thiết-bị.

### TuyaDevice (mở rộng - nên làm cho ice-bath)
```ts
// Query 1 DP không tự báo; kết quả vẫn về qua onDeviceStatus(onDpUpdate)
queryDp(devId: string, dpId: string): Promise<void>;

// Publish có option kênh
type PublishMode = 'auto' | 'local' | 'internet';
publishDpsWithMode(devId: string, dpsJson: string, mode: PublishMode): Promise<void>;

// Publish theo thứ tự ưu tiên kênh (vd ['ble','cloud']); map sang CommunicationEnum/orders
publishDpsWithChannels(devId: string, dpsJson: string, channels: Array<'lan'|'ble'|'cloud'>): Promise<void>;

// Đọc snapshot + schema để render UI/validate
getDeviceSnapshot(devId: string): Promise<{
  devId: string; productId: string; dpsJson: string;
  isOnline: boolean; isLocalOnline: boolean;
  schemaJson: string;            // map từ DeviceBean.schema / schemaArray
  dpCodesJson?: string;          // map dpId<->code (standard instruction set)
}>;

// Trạng thái online + MQTT
isDeviceOnline(devId: string): Promise<boolean>;
isCloudConnected(): Promise<boolean>;   // getServerInstance().isServerConnect()

// Low-power cache (ít dùng cho ice-bath, giữ optional)
sendCacheDps(devId: string, dpsJson: string, validitySec: number, dpCacheType: 0|1): Promise<boolean>;
```

### TuyaTimer (module mới - nếu cần lịch warm-up/auto-off cho ice-bath)
```ts
interface TimerInput {
  taskName: string;        // group timer
  bizId: string;           // devId hoặc groupId
  bizType: 'device' | 'group';
  time: string;            // "HH:mm"
  loops: string;           // 7 ký tự, vd "1111100"
  dpsJson: string;         // {"1":true}
  status: boolean;
  appPush?: boolean;
  aliasName?: string;
  timezone?: string;
}
interface TimerItem {
  timerId: string; time: string; loops: string;
  status: boolean; dpsJson: string; aliasName?: string;
}
addTimer(input: TimerInput): Promise<TimerItem>;
updateTimer(input: TimerInput & { timerId: string }): Promise<TimerItem>;
removeTimer(taskName: string, bizId: string, bizType: 'device'|'group', timerIds: string[]): Promise<void>;
getTimerList(taskName: string, bizId: string, bizType: 'device'|'group'): Promise<TimerItem[]>;
updateTimerStatus(taskName: string, bizId: string, bizType: 'device'|'group',
                  timerIds: string[], op: 'open'|'close'|'delete'): Promise<void>;
```
**Platform notes:** Android `ThingHomeSdk.getTimerInstance()` + `ThingTimerBuilder` (devId + deviceType); iOS `ThingSmartTimer` + `bizId/bizType`. Lib chuẩn hoá `bizType` 2 bên (Android map sang `TimerDeviceTypeEnum`).

### TuyaGroup (đề xuất - để sau, có thể cắt khỏi MVP)
```ts
createGroup(homeId: number, productId: string, name: string, devIds: string[]): Promise<number>; // groupId
groupPublishDps(groupId: number, dpsJson: string): Promise<void>;
renameGroup(groupId: number, name: string): Promise<void>;
dismissGroup(groupId: number): Promise<void>;
// event 'onGroupStatus' (onDpUpdate/onGroupInfoUpdate/onGroupRemoved)
```
**Platform notes:** Android `newGroupInstance(groupId).publishDps` + `IGroupListener`; iOS `groupWithGroupId:` + `ThingSmartGroupDelegate`. Chỉ gom thiết bị **cùng productId**.

### TuyaMultiControl (đề xuất - KHÔNG khuyến nghị cho ice-bath)
Chỉ hỗ trợ DP `switch_number`/`sub_switch_number` ⇒ không hợp với DP nhiệt độ value. Bỏ qua trừ khi sau này có nhiều công tắc liên động.

> **Khuyến nghị cho dự án (1 ice-bath/home):** Bắt buộc làm `TuyaDevice` mở rộng (queryDp, publishDpsWithMode, getDeviceSnapshot+schema, isDeviceOnline). Cân nhắc làm `TuyaTimer` nếu UX cần đặt lịch bật/tắt. **Bỏ** group + multi-control khỏi MVP (không phù hợp mô hình 1 thiết bị + DP value).

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **Ice-bath dùng standard hay DP instruction mode?** Đọc schema/dpCodes thiết bị thật để biết có code chuẩn không; mặc định dùng DP id-based.
- **iOS `getDp` query DP** verbatim: header iOS `ThingSmartDevice` (trang DP parser confirm parser nhưng chưa thấy `getDp` rõ) - mở header khi code.
- **iOS `ThingSmartGroup` (Smart App SDK chuẩn)**: signature `addDevice/removeDevice/dismissGroup` + delegate `ThingSmartGroupDelegate` - mở header (đừng dùng API Commercial Lighting `publishBrightPercent`…).
- **`CommunicationEnum` giá trị cụ thể** (LAN/MQTT/BLE/HTTP = số mấy) - mở API reference Android khi code `publishDps(dps, orders, cb)`.
- **`actions` JSON format** của `ThingTimerBuilder.setActions` (Android timer chuẩn) vs `setDps(Map)` của extension - verify khi code.
- **Timer có chạy khi thiết bị offline?** (cloud timer vs device-local timer) - cần test trên ice-bath thật.

---

## Nguồn (URL đã đọc)
- Device Control (Android) - https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y
- Device Control (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-device-control?id=Kaiyeu0xukcuc
- Device Management (Android) - https://developer.tuya.com/en/docs/app-development/devicemanage?id=Ka6ki8r2rfiuu
- Group Management - https://developer.tuya.com/en/docs/app-development/group?id=Ka6ki8l6zjfhj
- Multi-Control Linkage - https://developer.tuya.com/en/docs/app-development/devicemulticontrol?id=Ka6ki8l92gduk
- Scheduled Tasks (timer) - https://developer.tuya.com/en/docs/app-development/timer?id=Ka6ki8l85zpcu
- Device Schedule (extension) - https://developer.tuya.com/en/docs/app-development/extension-device-timer?id=Kcy2jpy6859p1
- Standard Instruction Set - https://developer.tuya.com/en/docs/iot/standarddescription?id=K9i5ql6waswzq
- Change Control Instruction Mode - https://developer.tuya.com/en/docs/iot/change-control-instruction-mode?id=Kcbz8lahbg5st
- iOS Device DP Parser - https://developer.tuya.com/en/docs/app-development/ios_device_control?id=Kcxopr96vsl0f
- iOS ThingSmartTimer header (API ref) - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/ios-arm64_2_thing_smart_timer_kit_8framework_2_headers_2_thing_smart_timer_8h_source.html
- iOS Group Control (đối chiếu) - https://developer.tuya.com/en/docs/app-development/ios-saas-commercial-lighting-group-control?id=Kdbcsfpp7bpcz
- Device Control intro - https://developer.tuya.com/en/docs/app-development/device-control-intro?id=Kat5r2cqw9ypu
