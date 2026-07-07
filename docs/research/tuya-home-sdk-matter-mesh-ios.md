# Tuya Research: Matter + BLE Mesh - **iOS verbatim** (bổ sung để wire TuyaMatter/TuyaMesh)

- **Ngày:** 2026-06-30 · **SDK:** iOS `ThingSmartHomeKit` ~7.5
- **Mục đích:** lấy **verbatim iOS** cho 2 module cuối (TuyaMatter, TuyaMesh) - phần Android đã có ở
  [device-pairing §5](./tuya-home-sdk-device-pairing.md) (Matter) + [bluetooth §7/§8](./tuya-home-sdk-bluetooth.md) (mesh).
- **Nguồn chính (đã WebFetch trực tiếp):**
  - Matter iOS - https://developer.tuya.com/en/docs/app-development/activator_matter_ios?id=Kcy5lrzc7s20k
  - SIG Mesh iOS - https://developer.tuya.com/en/docs/app-development/sigmesh?id=Ka5vdjp2tlb23
  - Tuya Mesh iOS - https://developer.tuya.com/en/docs/app-development/mesh?id=Ka5vdjp3ikagz
- **Độ tin cậy:** signature lấy verbatim từ trang doc (WebFetch model nhỏ tóm tắt) - **property của model** (vd `meshModel.meshId`)
  vẫn nên đối chiếu header khi build. Mục "Khác biệt" + "Spec-fit" là phần quan trọng nhất cho người wire.

---

## TL;DR (cho người sắp wire)
1. **iOS Matter ≠ Android Matter về SHAPE.** Android dùng API **dedicated** `getMatterDevActivatorInstance()` +
   `ConnectDeviceBuilder` → `commissionDevice` (parse → connect → commission, có `SetupPayload`/`ConnectResult` riêng).
   **iOS dùng API HỢP NHẤT** `ThingSmartActivatorDiscovery` (`registerWithActivatorList` → `startSearch:` → `startActive:deviceList:`),
   trong đó `parseSetupCode:` trả thẳng **`ThingSmartActivatorDeviceModel`** (KHÔNG phải payload version/vendorId/...).
2. **iOS Mesh tách 2 manager:** **SIG** = `ThingSmartSIGMeshManager`; **Tuya (private)** = `ThingBLEMeshManager`. Hai bộ method
   KHÁC nhau. Tạo mesh đều qua `ThingSmartBleMesh` (`createSIGMeshWithHomeId:` vs `createBleMeshWithMeshName:homeId:`),
   model chung `ThingSmartBleMeshModel`.
3. **Mesh instance cần `homeId`:** `+ [ThingSmartBleMesh bleMeshWithMeshId:homeId:]` → ⇒ **spec `TuyaMesh` hiện thiếu `homeId`**
   ở publishMeshDps/multicast/startMeshClient → cần thêm trước khi wire iOS.
4. **DP mesh:** SIG/Tuya control DP qua `publishNodeId:pcc:dps:success:failure:` + `multiPublishWithLocalId:pcc:dps:...`
   (trên mesh instance); DP-update về qua `ThingSmartHomeDelegate home:device:dpsUpdate:`.
5. **Matter prerequisites iOS:** `+ [<MatterClass> setMatterConfigKey:(NSString*)appGroupId]` (App Group) + entitlement
   `matter.allow-setup-payload` + Bonjour trong Info.plist (xem device-pairing §5).

---

## A. Matter iOS (verbatim - API hợp nhất)

```objc
// Cấu hình 1 lần (App Group ID)
+ (void)setMatterConfigKey:(NSString *)configKey;

// Token (ThingSmartActivator)
- (void)getTokenWithHomeId:(long long)homeId
                   success:(ThingSuccessString)success
                   failure:(ThingFailureError)failure;

// ThingSmartActivatorDiscovery (entry chính cho Matter iOS)
- (ThingSmartActivatorDeviceModel *)parseSetupCode:(NSString *)qrString;   // trả device model (hoặc nil)
- (void)registerWithActivatorList:(NSArray<ThingSmartActivatorTypeModel *> *)typeList;
- (void)setupDelegate:(id)delegate;
- (void)loadConfig;
- (void)startSearch:(NSArray<ThingSmartActivatorTypeModel *> *)typeList;
- (void)stopSearch:(NSArray<ThingSmartActivatorTypeModel *> *)typeList clearCache:(BOOL)clearCache;
- (void)startActive:(ThingSmartActivatorTypeModel *)type
         deviceList:(NSArray<ThingSmartActivatorDeviceModel *> *)deviceList;   // connect + commission
- (void)stopActive:(NSArray<ThingSmartActivatorTypeModel *> *)typeList clearCache:(BOOL)clearCache;
- (void)continueCommissionDevice:(ThingSmartActivatorDeviceModel *)deviceModel
                       typeModel:(ThingSmartActivatorTypeMatterModel *)typeModel;   // sau PASE
- (void)continueCommissioningDevice:(void *)device
           ignoreAttestationFailure:(BOOL)ignoreAttestationFailure
                              error:(NSError * __autoreleasing *)error;             // attestation
```

**Delegate:**
```objc
// ThingSmartActivatorSearchDelegate
- (void)activatorService:(id<ThingSmartActivatorSearchProtocol>)service
           activatorType:(ThingSmartActivatorTypeModel *)type
            didFindDevice:(nullable ThingSmartActivatorDeviceModel *)device
                    error:(nullable ThingSmartActivatorErrorModel *)errorModel;
// ThingSmartActivatorActiveDelegate
- (void)activatorService:(id<ThingSmartActivatorActiveProtocol>)service
           activatorType:(ThingSmartActivatorTypeModel *)type
       didReceiveDevices:(nullable NSArray<ThingSmartActivatorDeviceModel *> *)devices
                   error:(nullable ThingSmartActivatorErrorModel *)errorModel;
// ThingSmartActivatorDeviceExpandDelegate
- (void)matterDeviceDiscoveryed:(ThingMatterDeviceDiscoveriedType *)typeModel;
- (void)matterCommissioningSessionEstablishmentComplete:(ThingSmartActivatorDeviceModel *)deviceModel;
- (void)matterDeviceAttestation:(void *)device error:(NSError *)error;
```

**Model:**
- `ThingSmartActivatorTypeMatterModel`: `type, typeName, timeout, spaceId, token, ssid, password, gwDevId`
- `ThingSmartActivatorDeviceModel`: `uniqueID, name, deviceModelType`
- `ThingSmartActivatorErrorModel`: `deviceModel, error`

---

## B. SIG Mesh iOS (verbatim)

```objc
// Tạo mesh + list (ThingSmartBleMesh / ThingSmartHome)
+ (void)createSIGMeshWithHomeId:(long long)homeId
                        success:(void(^)(ThingSmartBleMeshModel *meshModel))success
                        failure:(ThingFailureError)failure;
- (void)getSIGMeshListWithSuccess:(void(^)(NSArray<ThingSmartBleMeshModel *> *list))success
                          failure:(ThingFailureError)failure;
+ (instancetype)bleMeshWithMeshId:(NSString *)meshId homeId:(long long)homeId;

// Manager: ThingSmartSIGMeshManager
+ (ThingSmartSIGMeshManager * _Nullable)initSIGMeshManager:(ThingSmartBleMeshModel *)meshModel
                                                       ttl:(NSInteger)ttl
                                                   nodeIds:(NSArray * _Nullable)nodeIds;
+ (ThingSmartSIGMeshManager * _Nullable)getSIGMeshManager:(NSString *)meshId;
- (void)startSearch;
- (void)stopActiveDevice;
- (void)startActive:(NSArray<ThingSmartSIGMeshDiscoverDeviceInfo *> *)devList;

// Delegate: ThingSmartSIGMeshManagerDelegate
- (void)sigMeshManager:(ThingSmartSIGMeshManager *)manager
       didScanedDevice:(ThingSmartSIGMeshDiscoverDeviceInfo *)device;
- (void)sigMeshManager:(ThingSmartSIGMeshManager *)manager
    didActiveSubDevice:(ThingSmartSIGMeshDiscoverDeviceInfo *)device
                 devId:(NSString *)devId error:(NSError *)error;
- (void)sigMeshManager:(ThingSmartSIGMeshManager *)manager
 didFailToActiveDevice:(ThingSmartSIGMeshDiscoverDeviceInfo *)device error:(NSError *)error;

// DP control: trên ThingSmartDevice / ThingSmartBleMeshGroup
- (void)publishDps:(NSDictionary *)dps success:(nullable ThingSuccessHandler)success failure:(nullable ThingFailureError)failure;
```
> ⚠️ Trang KHÔNG ghi rõ delegate dp-update/online cho SIG (chỉ pairing callback) - DP-update mesh đọc qua `ThingSmartHomeDelegate` (mục C).

---

## C. Tuya Mesh (private) iOS (verbatim)

```objc
// Tạo mesh + list
+ (void)createBleMeshWithMeshName:(NSString *)meshName homeId:(long long)homeId
                          success:(void(^)(ThingSmartBleMeshModel *meshModel))success
                          failure:(ThingFailureError)failure;
- (void)getMeshListWithSuccess:(void(^)(NSArray<ThingSmartBleMeshModel *> *list))success
                       failure:(ThingFailureError)failure;     // trên ThingSmartHome
+ (instancetype)bleMeshWithMeshId:(NSString *)meshId homeId:(long long)homeId;

// Manager: ThingBLEMeshManager (singleton)
- (void)startScanWithName:(NSString *)name pwd:(NSString *)pwd active:(BOOL)active
              wifiAddress:(uint32_t)wifiAddress otaAddress:(uint32_t)otaAddress;
- (void)activeMeshDevice:(ThingBleMeshDeviceModel *)deviceModel;
- (void)activeMeshDeviceIncludeGateway:(BOOL)includeGateway;

// Delegate: ThingBLEMeshManagerDelegate
- (void)bleMeshManager:(ThingBLEMeshManager *)manager didScanedDevice:(ThingBleMeshDeviceModel *)device;
- (void)activeDeviceSuccessWithName:(NSString *)name deviceId:(NSString *)deviceId error:(NSError *)error;

// DP control (trên mesh instance bleMeshWithMeshId:homeId:)
- (void)publishNodeId:(NSString *)nodeId pcc:(NSString *)pcc dps:(NSDictionary *)dps
              success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
- (void)multiPublishWithLocalId:(NSString *)localId pcc:(NSString *)pcc dps:(NSDictionary *)dps
                        success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
- (void)publishRawDataWithRaw:(NSData *)raw pcc:(NSString *)pcc success:... failure:...;

// DP-update: ThingSmartHomeDelegate
- (void)home:(ThingSmartHome *)home device:(ThingSmartDeviceModel *)device dpsUpdate:(NSDictionary *)dps;
```

---

## Khác biệt iOS vs Android (cốt lõi để bridge)
| Khía cạnh | Android | iOS |
|---|---|---|
| Matter entry | `getMatterDevActivatorInstance()` (dedicated) | `ThingSmartActivatorDiscovery` (unified) |
| Matter parse | `parseSetupCode` → `SetupPayload {version,vendorId,productId,setupPinCode,discriminator}` | `parseSetupCode:` → `ThingSmartActivatorDeviceModel {uniqueID,name,deviceModelType}` |
| Matter connect/commission | `connectDevice(ConnectDeviceBuilder)` → `commissionDevice(CommissioningParameters)` (2 bước) | `startActive:deviceList:` (gộp) + delegate `…SessionEstablishmentComplete:` |
| Mesh manager | `getThingSigMeshClient()` / `getThingBlueMeshClient()` | `ThingSmartSIGMeshManager` / `ThingBLEMeshManager` (2 lớp khác hẳn) |
| Mesh DP | `IThingBlueMeshDevice.publishDps(nodeId,pcc,dps,cb)` | `publishNodeId:pcc:dps:…` (cần instance `bleMeshWithMeshId:homeId:`) |

## Spec-fit: cần chỉnh `TuyaMatter`/`TuyaMesh` trước khi wire sạch
1. **TuyaMesh thiếu `homeId`** ở `publishMeshDps`/`multicastMeshDps`/`startMeshClient`/`searchSubDevices`/`activateSubDevice`
   → iOS `bleMeshWithMeshId:homeId:` bắt buộc homeId. **Đề xuất:** thêm `homeId: number` vào các method mesh (hoặc cache
   `meshId→homeId` từ create/getList). Cũng cần phân biệt **meshType ('sig'|'tuya')** để chọn đúng manager.
2. **TuyaMatter shape lệch iOS:** spec hiện `parseSetupCode→MatterSetupPayload`, `connectDevice→MatterConnectResult`,
   `commissionDevice`. iOS không có "connect" tách rời - là `startSearch`/`startActive`. **Đề xuất:** giữ spec thiên-Android
   (Android map tốt) + iOS implement loose: `parseSetupCode` lưu `ThingSmartActivatorDeviceModel`, `connectDevice` = no-op/store,
   `commissionDevice` = `startActive:deviceList:` (dựng `ThingSmartActivatorTypeMatterModel` token/ssid/password). Hoặc thêm
   method iOS-friendly. **Khuyến nghị:** ice-bath gần như KHÔNG dùng Matter/Mesh → để spec-rework là việc tùy chọn về sau.

## Điều kiện tiên quyết
- Matter iOS: entitlement `matter.allow-setup-payload`, Bonjour service trong Info.plist, App Group (`setMatterConfigKey:`),
  `is_matter_support=true` (thing_custom_config). Mesh/BLE: `NSBluetoothAlwaysUsageDescription` + Local Network.
- Cả 2: phải login + đúng Data Center + đã `getHomeData` (home cache) trước.

## Câu hỏi mở / cần xác minh trên máy
- Property `ThingSmartBleMeshModel.meshId`, `ThingSmartActivatorDeviceModel.deviceModelType`, type-name của mesh model (sig vs tuya).
- `ThingSmartActivatorTypeMatterModel` dựng thế nào (factory? alloc init + set field?) - trang chỉ liệt kê property.
- SIG mesh: cách lấy `ThingSmartSIGMeshDiscoverDeviceInfo` → truyền vào `startActive:` (giữ từ delegate `didScanedDevice:`).
- Tuya mesh `startScanWithName:pwd:` - `name`/`pwd` lấy từ đâu (meshModel?), `wifiAddress`/`otaAddress` ý nghĩa.

## Nguồn (URL đã đọc)
- Matter iOS - https://developer.tuya.com/en/docs/app-development/activator_matter_ios?id=Kcy5lrzc7s20k
- SIG Mesh iOS - https://developer.tuya.com/en/docs/app-development/sigmesh?id=Ka5vdjp2tlb23
- Tuya Mesh iOS - https://developer.tuya.com/en/docs/app-development/mesh?id=Ka5vdjp3ikagz
- Matter overview (Android) - https://developer.tuya.com/en/docs/app-development/matter_device_pair?id=Kcr7qt6rp3hi6
- (Android verbatim đã có: device-pairing §5, bluetooth §7/§8)
