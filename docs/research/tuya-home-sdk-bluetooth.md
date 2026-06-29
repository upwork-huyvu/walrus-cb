# Tuya Research: Bluetooth Series — single BLE / dual-mode / Beacon / BLE Mesh (SIG) / Tuya Mesh / sub-device qua BLE gateway

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x**; iOS ThingSmartHomeKit **~7.5**
- **Phạm vi note này:** toàn bộ chuỗi Bluetooth của Home SDK. **Tham chiếu (không lặp lại)** phần BLE scan + single pairing cơ bản đã ghi ở
  [`tuya-m1-sdk-foundation.md`](./tuya-m1-sdk-foundation.md) mục "5) Pairing Bluetooth (BLE single-point)". Note này bổ sung **dual-mode, beacon, SIG mesh, Tuya mesh,
  sub-device qua BLE gateway, connect/disconnect, DP control qua BLE, OTA qua BLE, listener trạng thái BLE** + **đối chiếu iOS verbatim**.
- **Nguồn chính:** Bluetooth Series overview (`BLE?id=Kam87dyaa70gf`), Bluetooth LE Devices Android (`android-bluetooth-ble?id=Karv7r2ju4c21`),
  Bluetooth Pairing (`ble_activator?id=Kdljgsdlp1f7z`), Combo Pairing (`ble_wifi_activator?id=Kdljgw7d8fqjd`), SIG Mesh (`meshsig?id=Ka6km4aeuygxr`),
  Tuya Mesh (`meshtuya?id=Ka6km4aengrvp`), iOS Pairing (`activator_ble_ios?id=Kcy2u7zj5hwkf`), iOS Composite Scan (`activator_multScan_ios?id=Kcy5yxmgx0isv`),
  iOS BLE Devices (`ble?id=Ka5vcxzbglphd`), iOS API reference header `ThingSmartBLEManager.h`.
- **Lưu ý độ tin cậy:** Tuya có **HAI bộ API song song** cho pairing/scan:
  (a) **API cũ/cổ điển** — `ThingHomeSdk.getBleOperator()/getBleManager()/getActivator()` (Android), `ThingSmartBLEManager`/`ThingSmartActivator` (iOS) — vẫn còn nhiều trong doc;
  (b) **API hợp nhất mới** — `ActivatorService` + `ThingSmartActivatorDiscovery` (composite scan/active, gom mọi loại Bluetooth + Wi-Fi + sub-device + Matter vào 1 chỗ).
  Note ghi **cả hai**; khuyến nghị dùng (b) cho lib mới vì gom đẹp hơn, nhưng (a) ổn định/đủ tài liệu hơn cho từng case. Một số signature iOS SIG/Tuya mesh chỉ confirm tên class
  (xem "Câu hỏi mở").

---

## TL;DR (cho người sắp code)
1. **3 dòng công nghệ Bluetooth của Tuya** (quyết định luồng API):
   - **Bluetooth LE single-point**: point-to-point 1 phone ↔ 1 device (khóa, cân, tracker). Pair = scan → `BleActivator`.
   - **Combo / dual-mode (BLE + Wi-Fi)**: device có cả 2 ngăn xếp; pair qua BLE rồi đẩy Wi-Fi creds (như gateway, IPC). Pair = `MultiModeActivator` / `ThingSmartBLEWifiActivator`.
   - **Mesh** (m:m): **Bluetooth SIG Mesh** (chuẩn SIG) **và** **Tuya Mesh** (private, cũ hơn). Mỗi mesh có 1 **node làm proxy** mà phone connect tới rồi điều khiển cả lưới.
   - **Beacon**: dòng con của BLE, **không kết nối GATT bền** — điều khiển bằng **broadcast/advertising** (remote, công tắc beacon). Pair có thể **batch nhiều device 1 lần**.
2. **Bồn tắm đá rất có thể là Wi-Fi hoặc combo (dual-mode)**, KHÔNG phải mesh/beacon. ⇒ ưu tiên hoàn thiện **single BLE + combo (BLE+Wi-Fi)**; mesh/beacon là "nice-to-have" để lib tổng quát.
3. **Combo (dual-mode) pairing cần đủ:** `uuid` + `deviceType` (từ scan) + `ssid`/`pwd` (Wi-Fi 2.4GHz) + `token` (activator token, **vẫn 10 phút, chết sau 1 device** — đọc note nền tảng) + `homeId`.
4. **DP control qua BLE khác Wi-Fi**: device single-BLE/mesh **chỉ online khi phone đang trong tầm & đã connect GATT**. Phải `connectBleDevice(...)` trước; gửi DP qua **kênh BLE local** (không qua MQTT cloud). Mesh dùng `publishDps(nodeId,pcc,dps)` / `multicastDps(...)`.
5. **OTA qua BLE**: lấy info `requestUpgradeInfo` → `startBleOta(...)` (single) hoặc `ThingBlueMeshOtaBuilder.startOta()` (mesh); progress về qua `OnBleUpgradeListener.onUpgrade(percent)`. **Giữ kết nối + không khóa màn hình** suốt OTA.
6. **Listener trạng thái BLE**: single dùng `IDevListener` (như Wi-Fi) **+ trạng thái local-online** `getBleManager().isBleLocalOnline(devId)`; mesh dùng `IMeshDevListener` (có `onStatusChanged(online,offline,gwId)`).
7. **Quyền**: Android 12+ cần `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, **và `BLUETOOTH_ADVERTISE` cho beacon/combo**, + `ACCESS_FINE_LOCATION`. iOS: `NSBluetoothAlwaysUsageDescription` (+ Local Network cho combo Wi-Fi).

---

## Phạm vi
| Hạng mục | Có trong note |
|---|---|
| Single BLE (scan/pair) | tham chiếu note nền tảng + bổ sung connect/disconnect/control/OTA |
| Dual-mode (BLE + Wi-Fi combo) | đầy đủ (Android `MultiModeActivator`/`BLEWIFIActivator`, iOS `ThingSmartBLEWifiActivator`) |
| Beacon | scan + batch pair qua composite scan; lưu ý điều khiển broadcast |
| BLE Mesh (SIG / Sigmesh) | tạo mesh, scan/active sub-device, connect, DP control, listener, OTA, group |
| Tuya Mesh (private) | tương tự SIG, API `BlueMesh*` |
| Sub-device qua BLE gateway | qua combo gateway pairing (`setVersion("2.2")`, `setWifiSsid/Password`) + sub-device activator |
| Connect / disconnect | `BleConnectBuilder` (Android), `connectBLEWithUUID`/`disconnectBLEWithUUID` (iOS) |
| DP control qua BLE | local channel; mesh `publishDps/multicastDps` |
| OTA qua BLE | single + mesh |
| Listener trạng thái BLE | `IDevListener` + `isBleLocalOnline` + `IMeshDevListener` |

---

## Khái niệm & luồng

**Luồng single BLE (point-to-point):**
`scan (getBleOperator/ActivatorService)` → chọn `ScanDeviceBean` (chưa bind) → `getActivatorToken(homeId)` (combo cần token; single thuần BLE không cần creds Wi-Fi) →
`BleActivator.startActivator(BleActivatorBean)` → `onSuccess(DeviceBean)` → `newDeviceInstance(devId)` → **connect** (`connectBleDevice`) → `publishDps` + `registerDevListener`.

**Luồng combo / dual-mode (BLE + Wi-Fi):**
`scan` → `ScanDeviceBean` (configType có cờ wifi) → `getActivatorToken(homeId)` → `MultiModeActivator.startActivator(MultiModeActivatorBean{uuid,deviceType,ssid,pwd,token,homeId})`
→ qua nhiều **stage** (`onActivatorStatePauseCallback`/`onActivatorStatePauseCallback(uuid, configStage, status)`: 0 activation, 1 delegation, 2 network, 3 cloud activation) → `onSuccess(DeviceBean)`.
Sau pair device chạy như Wi-Fi (MQTT) nhưng vẫn fallback BLE khi mất mạng.

**Luồng mesh (SIG / Tuya):**
`createSigMesh(...)`/`createBlueMesh(...)` (1 lần/home) → `startClient(SigMeshBean/BlueMeshBean)` (connect proxy) → `startSearch()` + `SearchBuilder`/`IThingBlueMeshSearchListener.onSearched` →
`ThingSigMeshActivatorBuilder`/`ThingBlueMeshActivatorBuilder.startActivator()` (active từng sub-device, có thể batch) → `onSuccess(mac, DeviceBean)` →
`newSigMeshDeviceInstance(meshId)` → `publishDps(nodeId,pcc,dps)` / `multicastDps(...)` → `registerMeshDevListener(IMeshDevListener)`.

**Luồng beacon:** dùng composite scan (`ActivatorTypeBeaconModel`); discover nhiều beacon → `startActive(...)` batch. Điều khiển = **advertising/broadcast** (không giữ GATT); beacon remote hỗ trợ group control.

**Sub-device qua BLE gateway:** pair gateway (combo, `setVersion("2.2")`) trước; sub-device add qua sub-device activator của gateway đó (Android `ActivatorTypeSubDeviceModel.gwDevId` / iOS `ThingSmartActivatorTypeSubDeviceModel.gwDevId`).

---

## API Android

### 1) Scan BLE (cổ điển) — bổ sung field ScanDeviceBean
```java
LeScanSetting scanSetting = new LeScanSetting.Builder()
    .setTimeout(60000)
    .addScanType(ScanType.SINGLE)   // SINGLE | SIG_MESH | TUYA_MESH | BEACON ...
    .setRepeatFilter(true)
    .build();
ThingHomeSdk.getBleOperator().startLeScan(scanSetting, new BleScanResponse() {
    @Override public void onResult(ScanDeviceBean bean) { /* xem field bên dưới */ }
});
ThingHomeSdk.getBleOperator().stopLeScan();
```
- **ScanDeviceBean fields (verbatim):** `id, name, providerName, data, configType, productId, uuid, mac, isbind, flag, address, deviceType`.
- Query info device chưa bind:
```java
ThingHomeSdk.getActivatorInstance().getActivatorDeviceInfo(productId, uuid, mac,
    new IThingDataCallback<ConfigProductInfoBean>() { /* onSuccess / onError */ });
```

### 2) Single BLE pairing (cổ điển) — *(tham chiếu note nền tảng; bổ sung field)*
```java
BleActivatorBean bleActivatorBean = new BleActivatorBean(scanDeviceBean);
bleActivatorBean.homeId = 123456;
bleActivatorBean.uuid = mScanDeviceBean.getUuid();
bleActivatorBean.deviceType = mScanDeviceBean.getDeviceType();
ThingHomeSdk.getActivator().newBleActivator().startActivator(bleActivatorBean,
    new IBleActivatorListener() {
        @Override public void onSuccess(DeviceBean deviceBean) { }
        @Override public void onFailure(int code, String msg, Object handle) { }
    });
ThingHomeSdk.getBleManager().stopBleConfig("uuid");   // stop
```

### 3) Combo / dual-mode (BLE + Wi-Fi) pairing — cổ điển (verbatim)
```java
MultiModeActivatorBean bean = new MultiModeActivatorBean(scanDeviceBean);
bean.deviceType = mScanDeviceBean.getDeviceType();
bean.uuid       = mScanDeviceBean.getUuid();
bean.ssid       = "WIFI_SSID";
bean.pwd        = "WIFI_PASSWORD";
bean.token      = "token_value";      // getActivatorToken(homeId)
bean.homeId     = homeId;
ThingHomeSdk.getActivator().newMultiModeActivator().startActivator(bean,
    new IMultiModeActivatorListener() {
        @Override public void onSuccess(DeviceBean deviceBean) { }
        @Override public void onFailure(int code, String msg, Object handle) { }
        @Override public void onActivatorStatePauseCallback(PauseStateData stateData) { }
    });
ThingHomeSdk.getActivator().newMultiModeActivator().stopActivator(uuid);  // stop
```

### 4) Connect / disconnect BLE (cổ điển, verbatim)
```java
List<BleConnectBuilder> builderList = new ArrayList<>();
BleConnectBuilder builder = new BleConnectBuilder()
    .setDevId(devId)
    .setDirectConnect(true)
    .setScanTimeout(5000)
    .setLevel(BleConnectBuilder.Level.NORMAL);
builderList.add(builder);
ThingHomeSdk.getBleManager().connectBleDevice(builderList);
ThingHomeSdk.getBleManager().disconnectBleDevice(builderList);

// trạng thái:
boolean online      = ThingHomeSdk.getDataInstance().getDeviceBean(devId).getIsOnline();
boolean localOnline = ThingHomeSdk.getBleManager().isBleLocalOnline(devId);   // online qua BLE local
```

### 5) DP control qua BLE
- **Single/combo**: dùng chung `IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(devId); mDevice.publishDps("{\"104\":20}", IResultCallback)` (xem note nền tảng).
  SDK tự chọn kênh **BLE local** khi device chỉ online qua BLE (phải đã `connectBleDevice`), hoặc **MQTT** khi combo đang online Wi-Fi.
- **Mesh** (xem mục mesh): `IThingBlueMeshDevice.publishDps(nodeId, pcc, dps, IResultCallback)` / `multicastDps(localId, pcc, dps, IResultCallback)`.

### 6) OTA qua BLE (cổ điển, verbatim)
```java
// single BLE / combo:
ThingHomeSdk.getMeshInstance().requestUpgradeInfo(mDevID, new IRequestUpgradeInfoCallback() {
    @Override public void onSuccess(ArrayList<BLEUpgradeBean> beans) { }
    @Override public void onError(String errorCode, String errorMsg) { }
});
ThingHomeSdk.getBleManager().startBleOta(uuid, type, version, binPackagePath,
    new OnBleUpgradeListener() {
        @Override public void onUpgrade(int percent) { }
        @Override public void onSuccess() { }
        @Override public void onFail(String errorCode, String errorMsg) { }
    });
```
- **Mesh OTA:** `IThingBlueMeshOta.startOta()` cấu hình qua `ThingBlueMeshOtaBuilder`; info qua cùng `requestUpgradeInfo`.

### 7) BLE Mesh (SIG / Sigmesh) — Android (verbatim)
```java
// tạo mesh (1 lần/home)
ThingHomeSdk.newHomeInstance(homeId).createSigMesh(new IThingResultCallback<SigMeshBean>() { });
ThingHomeSdk.getSigMeshInstance().getSigMeshList();             // list mesh
ThingHomeSdk.newSigMeshDeviceInstance(meshId).removeMesh(IResultCallback);

// kết nối proxy
ThingHomeSdk.getThingSigMeshClient().initMesh(meshId);
ThingHomeSdk.getThingSigMeshClient().startClient(SigMeshBean);          // hoặc startClient(SigMeshBean, searchTime)
ThingHomeSdk.getThingSigMeshClient().stopClient();
ThingHomeSdk.getThingSigMeshClient().startSearch();                     // tìm sub-device chưa pair
ThingHomeSdk.getThingSigMeshClient().stopSearch();
ThingHomeSdk.getThingSigMeshClient().destroyMesh();

// scan sub-device
SearchBuilder searchBuilder = new SearchBuilder()
    .setServiceUUIDs(...)
    .setTimeOut(60)
    .setThingBlueMeshSearchListener(new IThingBlueMeshSearchListener() {
        @Override public void onSearched(SearchDeviceBean deviceBean) { }
        @Override public void onSearchFinish() { }
    });

// active sub-device (có thể batch nhiều SearchDeviceBean)
ThingSigMeshActivatorBuilder activatorBuilder = new ThingSigMeshActivatorBuilder()
    .setSearchDeviceBeans(list)
    .setSigMeshBean(sigMeshBean)
    .setTimeOut(60)
    .setThingBlueMeshActivatorListener(new IThingBlueMeshActivatorListener() {
        @Override public void onSuccess(String mac, DeviceBean deviceBean) { }
        @Override public void onError(String mac, String errorCode, String errorMsg) { }
        @Override public void onFinish() { }
    });

// điều khiển mesh device
IThingBlueMeshDevice meshDev = ThingHomeSdk.newSigMeshDeviceInstance(meshId);
meshDev.publishDps(nodeId, pcc, dps, IResultCallback);       // 1 node
meshDev.multicastDps(localId, pcc, dps, IResultCallback);    // broadcast / group
meshDev.registerMeshDevListener(new IMeshDevListener() { /* xem Listener */ });
```

### 8) Tuya Mesh (private) — Android (verbatim)
```java
IThingHome home = ThingHomeSdk.newHomeInstance(homeId);
home.createBlueMesh(String meshName, IThingResultCallback<BlueMeshBean> callback);
// home.getHomeBean().getMeshList()

IThingBlueMeshClient client = ThingHomeSdk.getThingBlueMeshClient();
client.initMesh(meshId); client.destroyMesh();
client.startClient(blueMeshBean); client.stopClient();
client.startSearch(); client.stopSearch();

SearchBuilder sb = new SearchBuilder()
    .setMeshName(meshName).setTimeOut(60)
    .setThingBlueMeshSearchListener(new IThingBlueMeshSearchListener() {
        @Override public void onSearched(SearchDeviceBean deviceBean) { }
        @Override public void onSearchFinish() { }
    });

ThingBlueMeshActivatorBuilder ab = new ThingBlueMeshActivatorBuilder()
    .setSearchDeviceBeans(list)
    .setVersion("1.0")               // "1.0" device thường, "2.2" gateway
    .setBlueMeshBean(blueMeshBean)
    .setTimeOut(60)
    // gateway pairing (sub-device qua gateway):
    .setWifiSsid(ssid).setWifiPassword(pwd).setHomeId(String.valueOf(homeId))
    .setThingBlueMeshActivatorListener(new IThingBlueMeshActivatorListener() {
        @Override public void onSuccess(DeviceBean deviceBean) { }
        @Override public void onError(String errorCode, String errorMsg) { }
        @Override public void onFinish() { }
    });

IThingBlueMeshDevice md = ThingHomeSdk.newBlueMeshDeviceInstance(meshId);
md.publishDps(nodeId, pcc, dps, IResultCallback);
md.multicastDps(localId, pcc, dps, IResultCallback);
md.querySubDevStatusByLocal(pcc, nodeId, IResultCallback);
md.getMeshSubDevList();                          // List<DeviceBean>
md.getMeshSubDevBeanByNodeId(nodeId);            // DeviceBean
md.renameMeshSubDev(devId, name, IResultCallback);
md.removeMeshSubDev(devId, IResultCallback);
md.registerMeshDevListener(IMeshDevListener);

// group mesh
IThingGroup g = ThingHomeSdk.newBlueMeshGroupInstance(groupId);
g.addGroup(name, pcc, localId, IAddGroupCallback);   // onSuccess(long groupId)/onError
g.addDevice(devId, IResultCallback);
g.removeDevice(devId, IResultCallback);
g.dismissGroup(IResultCallback);
g.renameGroup(groupName, IResultCallback);
```

### 9) API hợp nhất mới — `ActivatorService` (Android)
Gom mọi loại vào 1 luồng `discovery → activator`:
```java
// discovery
IDiscovery iDiscovery = ActivatorService.discovery(DiscoveryMode.BLE);        // BLE | BLE_WIFI | ...
iDiscovery.setParams(DiscoveryParams);   // setListener(IDiscoveryListener); startDiscovery()/stopDiscovery()
// IBluetoothDevice: getId/getName/getData/getAddress/getDeviceType/getUUID/getMAC/getProductId/isBind/getFlag/getConfigType (config_type_single|config_type_wifi)

// single BLE activator
BLEActivator bleActivator = (BLEActivator) ActivatorService.activator(ActivatorMode.BLE);
BLEActivatorParams params = new BLEActivatorParams.Builder()
    .setAddress(address).setAssetId(homeId).setDeviceType(deviceType)
    .setUuid(uuid).setProductId(productId).setTimeout(120000).build();
bleActivator.setParams(params);
bleActivator.setListener(new IActivatorListener() {
    @Override public void onSuccess(@Nullable IDevice iDevice) { }
    @Override public void onError(@NonNull String s, @NonNull String s1) { }
});
bleActivator.start(); bleActivator.stop(); bleActivator.destroy();

// combo BLE+Wi-Fi activator
BLEWIFIActivator comboActivator = (BLEWIFIActivator) ActivatorService.activator(ActivatorMode.BLE_WIFI);
BLEWIFIActivatorParams comboParams = new BLEWIFIActivatorParams.Builder()
    .setAddress(address).setAssetId(homeId).setToken(token)
    .setSsid(ssid).setPwd(pwd).setUuid(uuid).setMac(mac).setTimeout(120000).build();
comboActivator.setParams(comboParams);
comboActivator.setListener(new IExtMultiModeActivatorListener() {   // listener mở rộng có stage
    @Override public void onActivatorStatePauseCallback(String uuid, int configStage, int status) { }
    @Override public void onSuccess(IDevice device) { }
    @Override public void onError(String code, String msg) { }
});  // configStage: 0 activation, 1 delegation, 2 network, 3 cloud activation
comboActivator.start();
```

---

## API iOS (verbatim / đối chiếu)

### 1) Scan + single BLE pairing — `ThingSmartBLEManager` (verbatim)
```objc
// scan
- (void)startListening:(BOOL)clearCache;
- (void)startListeningWithType:(ThingBLEScanType)scanType cacheStatu:(BOOL)clearCache;  // single/mesh/beacon
- (void)stopListening:(BOOL)clearCache;

// delegate
@protocol ThingSmartBLEManagerDelegate
- (void)didDiscoveryDeviceWithDeviceInfo:(ThingBLEAdvModel *)deviceInfo;
- (void)bluetoothDidUpdateState:(BOOL)isPoweredOn;
- (void)onCentralDidDisconnectFromDevice:(NSString *)devId error:(NSError *)error;
@end

// model: ThingBLEAdvModel { uuid, productId, mac, isActive, isSupport5G, bleProtocolV, bleType }

// single pairing (new)
- (void)activeBLE:(ThingBLEAdvModel *)deviceInfo
           homeId:(long long)homeId
          success:(void(^)(ThingSmartDeviceModel *deviceModel))success
          failure:(ThingFailureHandler)failure;
// deprecated: activeBLEWithUUID:homeId:productKey:success:failure:
```

### 2) Combo / dual-mode (BLE + Wi-Fi) — `ThingSmartBLEWifiActivator` (verbatim)
```objc
- (void)startConfigBLEWifiDeviceWithUUID:(NSString *)UUID
                                  homeId:(long long)homeId
                               productId:(NSString *)productId
                                    ssid:(NSString *)ssid
                                password:(NSString *)password
                                 timeout:(NSTimeInterval)timeout
                                 success:(ThingSuccessHandler)success
                                 failure:(ThingFailureHandler)failure;

// delegate
- (void)bleWifiActivator:(ThingSmartBLEWifiActivator *)activator
   didReceiveBLEWifiConfigDevice:(ThingSmartDeviceModel *)deviceModel
                           error:(NSError *)error;
```

### 3) Connect / disconnect / status — `ThingSmartBLEManager` (verbatim)
```objc
- (BOOL)deviceStatueWithUUID:(NSString *)uuid;            // online qua BLE
- (void)connectBLEWithUUID:(NSString *)uuid
                productKey:(NSString *)productKey
                   success:(ThingSuccessHandler)success
                   failure:(ThingFailureHandler)failure;
- (void)disconnectBLEWithUUID:(NSString *)uuid
                      success:(ThingSuccessHandler)success
                      failure:(ThingFailureError)failure;
```

### 4) OTA qua BLE — iOS (verbatim)
```objc
- (void)sendOTAPack:(NSData *)otaData
        deviceModel:(ThingSmartDeviceModel *)deviceModel
       upgradeModel:(ThingSmartFirmwareUpgradeModel *)upgradeModel
            success:(ThingSuccessHandler)success
            failure:(ThingFailureError)failure;
// deprecated: sendOTAPack:otaData:success:failure:  (thay bằng bản có deviceModel/upgradeModel)
```
> DP control qua BLE trên iOS: device đã connect dùng `ThingSmartDevice publishDps:success:failure:` (như Wi-Fi); SDK tự chọn kênh BLE local khi chỉ online qua BLE.

### 5) Composite scan / unified activator — `ThingSmartActivatorDiscovery` (verbatim) — bao trùm Beacon + SIG mesh + sub-device
```objc
- (void)registerWithActivatorList:(NSArray<ThingSmartActivatorTypeModel *>*)typeList;
- (void)startSearch:(NSArray<ThingSmartActivatorTypeModel *>*)typeList;
- (void)stopSearch:(NSArray<ThingSmartActivatorTypeModel *>*)typeList clearCache:(BOOL)clearCache;
- (void)setupDelegate:(id<ThingSmartActivatorSearchDelegate>)delegate;
- (void)loadConfig;

// active
- (void)startActive:(ThingSmartActivatorTypeModel *)type deviceList:(NSArray<ThingSmartActivatorDeviceModel *>*)deviceList;
- (void)stopActive:(NSArray<ThingSmartActivatorTypeModel *>*)typeList clearCache:(BOOL)clearCache;

// search delegate
- (void)activatorService:(id<ThingSmartActivatorSearchProtocol>)service
           activatorType:(ThingSmartActivatorTypeModel *)type
            didFindDevice:(nullable ThingSmartActivatorDeviceModel *)device
                    error:(nullable ThingSmartActivatorErrorModel *)errorModel;
- (void)activatorService:(id<ThingSmartActivatorSearchProtocol>)service
           activatorType:(ThingSmartActivatorTypeModel *)type
          didUpdateDevice:(ThingSmartActivatorDeviceModel *)device;

// active delegate
- (void)activatorService:(id<ThingSmartActivatorActiveProtocol>)service
           activatorType:(ThingSmartActivatorTypeModel *)type
       didReceiveDevices:(nullable NSArray<ThingSmartActivatorDeviceModel *> *)devices
                   error:(nullable ThingSmartActivatorErrorModel *)errorModel;
```
**ActivatorTypeModel (base) properties:** `timeout`(ms), `type`, `typeName`, `action`, `extensions`, `spaceId`(homeId).
**Subclasses:** `ThingSmartActivatorTypeWiredModel`, `ThingSmartActivatorTypeBleModel`(+`scanType`), `ThingSmartActivatorTypeSigMeshModel`,
`ThingSmartActivatorTypeBeaconModel`, `ThingSmartActivatorTypeSubDeviceModel`(+`gwDevId`), `ThingSmartActivatorTypeEZModel`(+`ssid`,`password`,`token`),
`ThingSmartActivatorTypeRouterModel`, `ThingSmartActivatorTypePegasusModel`, `ThingSmartActivatorTypeMatterModel`.
**ThingSmartActivatorErrorModel:** `@property ThingSmartActivatorDeviceModel *deviceModel; @property NSError *error;`

### 6) SIG / Tuya mesh — iOS (đối chiếu, tên class)
- SIG mesh: `ThingSmartSIGMeshManager` / `ThingSmartSIGMeshDevice` (tạo mesh qua `ThingSmartHome createSIGMesh...`, control `publishDps:`); Tuya mesh: `ThingSmartBleMesh` family.
  **Signature chi tiết chưa verify verbatim** (doc iOS SIG mesh chỉ link "next doc"); xem "Câu hỏi mở" — map đúng trang khi code.

---

## Bean / Callback / Listener

| Tên | Platform | Vai trò / field chính |
|---|---|---|
| `ScanDeviceBean` | Android | scan result: `id, name, providerName, data, configType, productId, uuid, mac, isbind, flag, address, deviceType` |
| `BleActivatorBean` | Android | input single pair: `homeId, uuid, deviceType` (từ `ScanDeviceBean`) |
| `MultiModeActivatorBean` | Android | input combo pair: `uuid, deviceType, ssid, pwd, token, homeId` |
| `BLEActivatorParams` / `BLEWIFIActivatorParams` | Android (unified) | builder: `address, assetId, uuid, productId, deviceType, token, ssid, pwd, mac, timeout` |
| `BleConnectBuilder` | Android | `setDevId, setDirectConnect, setScanTimeout, setLevel(Level.NORMAL)` |
| `PauseStateData` / `IExtMultiModeActivatorListener` | Android | combo stage: configStage 0 activation,1 delegation,2 network,3 cloud |
| `SigMeshBean` / `BlueMeshBean` | Android | model mesh (SIG / Tuya) |
| `SearchDeviceBean` | Android | sub-device tìm thấy trong mesh scan |
| `IThingBlueMeshSearchListener` | Android | `onSearched(SearchDeviceBean)`, `onSearchFinish()` |
| `IThingBlueMeshActivatorListener` | Android | SIG: `onSuccess(mac, DeviceBean)`, `onError(mac, code, msg)`, `onFinish()` · Tuya: `onSuccess(DeviceBean)`, `onError(code,msg)`, `onFinish()` |
| `IMeshDevListener` | Android | `onDpUpdate(nodeId, dps, isFromLocal)`, `onStatusChanged(List online, List offline, gwId)`, `onNetworkStatusChanged(devId, status)`, `onRawDataUpdate(byte[])`, `onDevInfoUpdate(devId)`, `onRemoved(devId)` |
| `IBleActivatorListener` | Android | `onSuccess(DeviceBean)`, `onFailure(int code, String msg, Object handle)` |
| `OnBleUpgradeListener` | Android | `onUpgrade(int percent)`, `onSuccess()`, `onFail(code, msg)` |
| `BLEUpgradeBean` / `IRequestUpgradeInfoCallback` | Android | info OTA |
| `DeviceBean` (BLE-related getters) | Android | `isBlueMesh()`, `isBlueMeshWifi()`, `getIsOnline()`, `getIsLocalOnline()`, `isCloudOnline()`, `getNodeId()`, `getCategory()`, `getParentId()` |
| `ThingBLEAdvModel` | iOS | scan result: `uuid, productId, mac, isActive, isSupport5G, bleProtocolV, bleType` |
| `ThingSmartBLEManagerDelegate` | iOS | `didDiscoveryDeviceWithDeviceInfo:`, `bluetoothDidUpdateState:`, `onCentralDidDisconnectFromDevice:error:` |
| `ThingSmartActivatorTypeModel` (+subclasses) | iOS | composite scan/active type descriptor |
| `ThingSmartActivatorDeviceModel` | iOS | device tìm thấy/active trong composite flow |
| `ThingSmartActivatorErrorModel` | iOS | `deviceModel`, `error` |
| `ThingSmartFirmwareUpgradeModel` | iOS | model OTA |

---

## Mã lỗi liên quan (BLE)
| Code | Ý nghĩa | Xử lý |
|---|---|---|
| `101` | Bluetooth connection error | bật lại BLE, kiểm tra quyền/khoảng cách |
| `106` | Pairing/scan timeout | thử lại, đưa device gần phone |
| `117` | OTA failed (iOS) | giữ kết nối, không khóa màn hình, retry |
| `148` | Pairing timeout — device connection issue (iOS) | reset device về pairing mode |
| `207001` | Service unsupported | device firmware không hỗ trợ thao tác |
| `207206` | Unknown device status | re-scan / reconnect |
| `207220` | Pairing timeout | lấy token mới (combo), thử lại |
| `207221` | BLE connection failure | kiểm tra quyền `BLUETOOTH_CONNECT`, GATT bận |
| `-55 / -56 / -57` | Token expired / mismatch (combo dùng token) | `getActivatorToken(homeId)` mới (xem note nền tảng) |
> Combo pairing dùng activator token nên dính nguyên bộ lỗi token của Wi-Fi pairing (note nền tảng). Single BLE thuần không cần token nên không dính `-55..-57`.

---

## Cạm bẫy
1. **Chọn đúng dòng công nghệ.** Bồn tắm đá gần như chắc là **Wi-Fi/combo**, không phải mesh/beacon → đừng over-engineer mesh trước. Xác minh `configType`/`bleType` từ scan + productId thật.
2. **Combo cần token, single không.** Quên token ở combo → `-55/-57`. Token vẫn **10 phút + chết sau 1 device** (note nền tảng) — lấy ngay trước `startActivator`.
3. **DP qua BLE ≠ DP qua MQTT.** Device single-BLE chỉ điều khiển được khi **phone trong tầm + đã `connectBleDevice`**; rời tầm = offline (`isBleLocalOnline=false`). UI phải phản ánh "cần ở gần".
4. **Combo fallback BLE khi mất Wi-Fi**: app nên thử BLE local nếu MQTT offline — nhưng vẫn cần đã connect BLE. Đừng giả định "đã pair = luôn điều khiển được từ xa".
5. **Mesh phải `startClient` trước khi điều khiển.** Quên connect proxy → publishDps fail im lặng. `multicastDps` không có ACK chắc chắn từng node → đừng dựa vào nó để xác nhận trạng thái; đọc lại qua `onDpUpdate`/`querySubDevStatusByLocal`.
6. **Beacon không giữ GATT** → điều khiển bằng broadcast, không có "online/offline" như BLE thường; trạng thái không tin cậy realtime. Pair được **batch** nhưng mỗi device vẫn cần ở gần.
7. **OTA BLE rất nhạy kết nối**: rớt BLE giữa chừng = hỏng/treo. Giữ foreground, chặn sleep, cảnh báo user không tắt Bluetooth; xử lý `onFail` để cho retry.
8. **Quyền Android 12+**: thiếu `BLUETOOTH_ADVERTISE` → beacon/combo có thể fail; thiếu `BLUETOOTH_SCAN`+`neverForLocation` cấu hình sai → scan trống. iOS thiếu Local Network usage string → combo Wi-Fi config fail.
9. **Hai bộ API song song**: đừng trộn `ActivatorService` (mới) với `getActivator()/getBleManager()` (cũ) cho cùng 1 device trong 1 phiên — chọn 1 bộ. Lib nên ẩn lựa chọn này sau 1 bề mặt TS.
10. **iOS deprecated**: `activeBLEWithUUID:...` và `sendOTAPack:otaData:...` đã deprecated → dùng bản mới (`activeBLE:homeId:...`, `sendOTAPack:deviceModel:upgradeModel:...`).
11. **Sub-device qua BLE gateway**: pair gateway combo trước (`setVersion("2.2")` ở Tuya mesh, hoặc `ActivatorTypeSubDeviceModel.gwDevId`); sub-device không tự pair thẳng tới phone.

---

## Đề xuất API TurboModule

Map vào lib `@jimmy-vu/react-native-turbo-tuya`. Phần single BLE scan/pair đã có trong **TuyaPairing** (note nền tảng) — bổ sung combo + connect/control BLE + OTA + (tùy chọn) mesh/beacon. Trạng thái/scan/OTA progress đẩy qua **event emitter**.

**Mở rộng `TuyaPairing`** (đã có BLE scan + single pair):
```ts
// Combo / dual-mode (BLE + Wi-Fi)
startBleWifiPairing(params: {
  uuid: string; deviceType: number; productId?: string;
  ssid: string; password: string; token: string; homeId: number; timeout?: number;
}): Promise<TuyaDevice>;
stopBleWifiPairing(uuid: string): Promise<void>;
// emit: 'onBleWifiStage' { uuid, configStage: 0|1|2|3, status }

// Beacon (batch) — dùng composite scan
startBeaconScan(homeId: number, timeout?: number): Promise<void>;   // emit 'onBeaconFound' { uuid, productId, mac }
stopBeaconScan(): Promise<void>;
startBeaconPairing(homeId: number, uuids: string[], timeout?: number): Promise<TuyaDevice[]>;
```

**Mở rộng `TuyaDevice`** (đã có publishDps/getDps/listener):
```ts
// kết nối BLE local trước khi điều khiển device single-BLE
bleConnect(devId: string, opts?: { directConnect?: boolean; scanTimeoutMs?: number }): Promise<void>;
bleDisconnect(devId: string): Promise<void>;
isBleLocalOnline(devId: string): Promise<boolean>;   // map getBleManager().isBleLocalOnline / deviceStatueWithUUID:
// publishDps/getDps dùng lại — SDK tự chọn kênh BLE local vs MQTT
```

**Module mới `TuyaOta`** (OTA dùng chung cho BLE/Wi-Fi/mesh):
```ts
getUpgradeInfo(devId: string): Promise<Array<{ type: number; version: string; desc?: string; upgradeStatus: number }>>;
startBleOta(params: { uuid: string; type: number; version: string; binPath: string }): Promise<void>;
// emit: 'onOtaProgress' { uuid, percent } | 'onOtaSuccess' { uuid } | 'onOtaError' { uuid, code, msg }
```

**Module mới `TuyaMesh`** (chỉ làm nếu thực sự có thiết bị mesh — bồn tắm đá nhiều khả năng không cần):
```ts
createSigMesh(homeId: number, name?: string): Promise<{ meshId: string }>;
createTuyaMesh(homeId: number, name: string): Promise<{ meshId: string }>;
getMeshList(homeId: number): Promise<Array<{ meshId: string; name: string; type: 'sig' | 'tuya' }>>;
startMeshClient(meshId: string, searchTimeMs?: number): Promise<void>;
stopMeshClient(meshId: string): Promise<void>;
searchMeshSubDevices(meshId: string, timeoutSec?: number): Promise<void>;  // emit 'onMeshDeviceFound'
activateMeshSubDevices(meshId: string, devices: Array<{ mac: string }>, timeoutSec?: number): Promise<TuyaDevice[]>;
publishMeshDps(meshId: string, nodeId: string, pcc: string, dpsJson: string): Promise<void>;
multicastMeshDps(meshId: string, localId: string, pcc: string, dpsJson: string): Promise<void>;
// emit: 'onMeshDpUpdate' { nodeId, dps, isFromLocal } | 'onMeshStatusChanged' { online: string[], offline: string[], gwId }
```

**Khuyến nghị triển khai (native):** dùng **bộ API cũ ổn định** (`getActivator()`/`getBleManager()` Android, `ThingSmartBLEManager`/`ThingSmartBLEWifiActivator` iOS) cho M1
vì tài liệu đầy đủ + signature verbatim chắc chắn; cân nhắc chuyển sang `ActivatorService`/`ThingSmartActivatorDiscovery` nếu sau này cần composite scan nhiều loại.
Ưu tiên build **combo (BLE+Wi-Fi)** + **bleConnect/isBleLocalOnline** + **TuyaOta** trước; **TuyaMesh/beacon** chỉ làm khi xác nhận thiết bị thực dùng mesh.

---

## Câu hỏi mở / cần xác minh trên thiết bị
- **Bồn tắm đá dùng dòng nào?** Wi-Fi thuần, combo (BLE+Wi-Fi), hay có DP điều khiển qua BLE local? → đọc `configType`/`bleType`/`flag` từ scan + productId thật. Quyết định có cần combo/`bleConnect` hay không.
- **iOS SIG/Tuya mesh signature verbatim**: `ThingSmartSIGMeshManager`/`ThingSmartSIGMeshDevice`/`ThingSmartBleMesh` — mở đúng trang iOS mesh (link "next doc" trong doc SIG) khi code module `TuyaMesh`.
- **`pcc` (product config code) cho `publishDps` mesh** lấy từ đâu (từ `DeviceBean.getCategory()`/schema?) — xác minh khi có device mesh thật.
- **OTA `type` & `version`** chính xác cho `startBleOta` (lấy từ `BLEUpgradeBean`/`getUpgradeInfo`) — verify field mapping trên device thật.
- **Beacon control**: API gửi lệnh qua broadcast cho beacon remote/switch (group control `tal_ble_beacon_remoter_group_*` là phía firmware/TuyaOS) — phía App SDK điều khiển beacon qua DP thường hay cơ chế riêng? Cần xác minh nếu dự án dùng beacon.
- **`getActivatorDeviceInfo` ConfigProductInfoBean fields** (productId/uuid/mac → info) — verify đầy đủ khi cần hiển thị tên/ảnh device trước pair.

---

## Nguồn (URL đã đọc)
- Bluetooth Series (overview) — https://developer.tuya.com/en/docs/app-development/BLE?id=Kam87dyaa70gf
- Bluetooth Devices (overview) — https://developer.tuya.com/en/docs/app-development/ble?id=Ka6km4855a1pa
- Bluetooth LE Devices (Android) — https://developer.tuya.com/en/docs/app-development/android-bluetooth-ble?id=Karv7r2ju4c21
- Bluetooth Pairing (Android, unified ActivatorService) — https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z
- Wi-Fi and Bluetooth Combo Pairing — https://developer.tuya.com/en/docs/app-development/ble_wifi_activator?id=Kdljgw7d8fqjd
- Bluetooth Mesh (SIG) — https://developer.tuya.com/en/docs/app-development/meshsig?id=Ka6km4aeuygxr
- Tuya Mesh (private) — https://developer.tuya.com/en/docs/app-development/meshtuya?id=Ka6km4aengrvp
- Bluetooth Device Pairing (iOS) — https://developer.tuya.com/en/docs/app-development/activator_ble_ios?id=Kcy2u7zj5hwkf
- Composite Scan (iOS) — https://developer.tuya.com/en/docs/app-development/activator_multScan_ios?id=Kcy5yxmgx0isv
- Bluetooth Devices (iOS) — https://developer.tuya.com/en/docs/app-development/ble?id=Ka5vcxzbglphd
- iOS API reference — ThingSmartBLEManager.h — https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/x86__64-simulator_2_thing_smart_b_l_e_core_kit_8framework_2_headers_2_thing_smart_b_l_e_manager_8h_source.html
- Extended Support for Bluetooth Beacon Remotes — https://developer.tuya.com/en/docs/iot/beacon-remote?id=Kcyvzvvk9yw58
