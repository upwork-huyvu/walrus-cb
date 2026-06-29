# Tuya Research: Smart Scenes (Ngữ cảnh thông minh) — tap-to-run + automation

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `thingsmart` **7.5.x** · iOS `ThingSmartHomeKit` **~7.5**
- **Nguồn chính:**
  - Smart Scenes (Android, Scene Manager) — https://developer.tuya.com/en/docs/app-development/smartscenemanager?id=Ka6ki8ldkrsbr
  - Smart Scenes (iOS) — https://developer.tuya.com/en/docs/app-development/smartscene?id=Ka5srtq859mp7
  - Create Scene (Condition/Action factory, iOS+Android) — https://developer.tuya.com/en/docs/app-development/core-linkage-builder?id=Kd0qp8q3ut3ca
  - Scene Creation (Android tutorial, Kotlin builders) — https://developer.tuya.com/en/docs/app-development/extension-sdk-tutorial-scene-create?id=Kd8k48qhwzsq0
  - Scene Creation (iOS tutorial) — https://developer.tuya.com/en/docs/app-development/extension-sdk-tutorial-ios-scene-create?id=Kd8kmqr7lh0zh
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. **Android** có 2 thế hệ API: (a) thế hệ mới `getSceneServiceInstance()` + `NormalScene`/`SavedScene` + **Builder** (`DeviceConditionBuilder`, `DeviceActionBuilder`…) — đây là API hiện hành trong doc 7.x; (b) thế hệ cũ `ThingSmartSceneConditionFactory`/`ThingSmartSceneActionFactory` (trang "Create Scene" gộp chung iOS+Android). **iOS** dùng `ThingSmartSceneManager` + `ThingSmartScene` + `*Factory`. Một số chữ ký iOS xác minh verbatim tốt; vài builder Android lấy được constructor nhưng **chưa thấy đầy đủ code lắp `NormalScene` + `saveSceneV2`** end-to-end → đánh dấu ở "Câu hỏi mở".

---

## TL;DR (cho người sắp code)
1. **2 loại scene chung 1 cơ chế lưu**, phân biệt bằng `ruleGenre`: **`1` = tap-to-run** (manual, người dùng bấm để chạy), **`2` = automation** (tự chạy khi điều kiện thoả). `getSimpleSceneAll`/`getSimpleSceneListWithHomeId` trả **cả hai** trong 1 request → lọc bằng `ruleGenre`.
2. **Entry khác nhau 2 nền tảng:** Android `ThingHomeSdk.getSceneServiceInstance()` chia làm `baseService()` (CRUD/list/detail) và `executeService()` (execute + MQTT listener). iOS: `ThingSmartSceneManager.sharedInstance()` (query/list/cities/device-list) + `ThingSmartScene` (1 instance/scene để add/modify/execute/enable/disable/delete).
3. **Một scene = conditions + actions + matchType + preConditions.** `matchType` = **1 (OR / match any)** hoặc **2 (AND / match all)** (iOS: `ThingSmartConditionMatchAny`/`ThingSmartConditionMatchAll`). Tap-to-run **không có condition** (chỉ actions); automation **bắt buộc có condition**.
4. **Condition types** (`entityType`): **device = 1**, **weather = 3**, **schedule/timer = 6**, **PIR = 7**, **geofence = 10**, **sunrise/sunset = 16** (iOS). **Action executor** (`actionExecutor`): `dpIssue` (điều khiển DP thiết bị), `deviceGroupDpIssue` (group), `delay` (trễ), `ruleTrigger` (chạy tap-to-run khác), `ruleEnable`/`ruleDisable` (bật/tắt automation khác), `appPushTrigger` (push), `smsSend`/`mobileVoiceSend` (SMS/voice).
5. **Tạo/sửa dùng cùng API** (`saveSceneV2`/`modifySceneV2` Android; `addNewSceneWithName`/`modifySceneWithName` iOS). `saveSceneV2` còn được dùng để **modify** scene đã có (truyền lại NormalScene đầy đủ).
6. **Execute tap-to-run** = Android `executeService().executeScene(sceneData, cb)` / iOS `[scene executeSceneWithSuccess:failure:]`. **Bật/tắt automation** = `enableAutomation`/`disableAutomation` (Android) hoặc `enableSceneWithSuccess`/`disableSceneWithSuccess` (iOS). Android còn có `enableAutomationWithTime(sceneId, time, cb)` (bật trong khoảng thời gian).
7. **MQTT listener** (Android) báo realtime khi scene bị thêm/sửa/xoá/bật/tắt từ thiết bị/app khác → cần re-fetch list. iOS dùng notification/refresh list.
8. **Với ice-bath:** dùng scene cho preset tap-to-run ("Cold plunge 8°C", "Recovery 12°C" = `dpIssue` set nhiệt độ + power) và automation theo lịch ("mỗi 6h sáng bật bồn") hoặc theo điều kiện (nhiệt độ nước > X → cảnh báo push). Geofence ("về gần nhà → bật làm lạnh trước") là điểm cộng UX.

---

## Phạm vi
Ngữ cảnh thông minh của Home SDK: **tap-to-run (manual scene)** và **automation (tự động theo điều kiện)**. Bao gồm: tạo / sửa / xoá / list / lấy chi tiết / thực thi scene; xây **condition** (device DP, weather, time/schedule, geofence, sunrise-sunset); xây **action** (device dp, delay, notification/push, trigger scene khác, enable/disable automation khác); bật/tắt automation; lắng nghe thay đổi scene realtime. **Không** thuộc phạm vi: Scene UI BizBundle (UI dựng sẵn — dự án tự build UI), Scene Recommendation, IoT/SaaS SDK riêng.

## Khái niệm & luồng
**Mô hình dữ liệu:** một **Scene** = `{ name, ruleGenre, matchType, conditions[], actions[], preConditions[], enabled, displayColor, coverIcon }`.
- **Tap-to-run** (`ruleGenre=1`): chỉ có `actions`, không condition; chạy thủ công bằng `executeScene`.
- **Automation** (`ruleGenre=2`): có `conditions` (>=1) + `actions`; chạy tự động; có thể `enabled=true/false`; `preConditions` giới hạn khung giờ/ngày hiệu lực.
- **`matchType`**: 1 = OR (thoả **bất kỳ** condition), 2 = AND (thoả **tất cả**).

**Luồng tạo scene (chung 2 nền tảng):**
1. (Nếu cần weather/geofence) lấy **city** (`getCityListWithCountryCode` / `getCityInfoWithLatitude`).
2. Lấy **danh sách thiết bị hỗ trợ điều kiện** (`getConditionDeviceListWithHomeId`) và **thiết bị hỗ trợ action** (`getActionDeviceListWithHomeId`) → lấy DP/feature khả dụng.
3. Build **condition(s)** qua factory/builder; build **action(s)** qua factory/builder.
4. (Tuỳ chọn) build **preCondition** (khung giờ hiệu lực).
5. Gọi **add/save** (Android `saveSceneV2`, iOS `addNewSceneWithName…`).
6. List lại (`getSimpleSceneAll` / `getSimpleSceneListWithHomeId`) để refresh UI; lọc theo `ruleGenre`.

**Tiền đề:** đã `init SDK` → đã login → có `homeId` (giống M1). Mọi API scene lấy `homeId`/`relationId` (chính là homeId) làm tham số.

---

## API Android (verbatim)

### Entry & service
```kotlin
ThingHomeSdk.getSceneServiceInstance()            // service tổng
    .baseService()      // CRUD: list, detail, save, modify, enable/disable, delete
    .executeService()   // execute scene + MQTT change listener
```

### Query / list / detail
```kotlin
// List tất cả scene của home (tap-to-run + automation chung 1 list)
getSimpleSceneAll(relationId: Long, callback: IResultCallback<List<NormalScene>?>?)

// Detail
getSceneDetail(relationId: Long, sceneId: String, callback: IResultCallback<NormalScene?>?)
getSceneDetailV1(relationId: Long, sceneId: String, ruleGenre: Int?, homeModel: Boolean,
                 callback: IResultCallback<NormalScene?>?)
```
```kotlin
ThingHomeSdk.getSceneServiceInstance().baseService().getSimpleSceneAll(
    homeId,
    object : IResultCallback<List<NormalScene?>?>() {
        override fun onSuccess(result: List<NormalScene?>?) { /* lọc ruleGenre==1 vs ==2 */ }
        override fun onError(errorCode: String?, errorMessage: String?) { }
    })
```

### Create / modify (dùng chung API)
```kotlin
saveSceneV2(relationId: Long, sceneData: NormalScene, callback: IResultCallback<SavedScene?>?)
saveScene(relationId: Long, sceneData: NormalScene, callback: IResultCallback<NormalScene?>?)
modifySceneV2(relationId: Long, needCleanGidSid: Boolean?, sceneId: String,
              sceneData: NormalScene, callback: IResultCallback<SavedScene?>?)
modifyScene(sceneId: String, sceneData: NormalScene, callback: IResultCallback<NormalScene?>?)
```
```kotlin
ThingHomeSdk.getSceneServiceInstance().baseService().saveSceneV2(
    homeId, sceneData,
    object : IResultCallback<SavedScene?>() {
        override fun onSuccess(result: SavedScene?) { /* result.ruleId, name, ruleGenre */ }
        override fun onError(errorCode: String?, errorMessage: String?) { }
    })
```
> Lắp `NormalScene` trước khi save: set `name`, `ruleGenre` (1/2), `conditions` (List<SceneCondition>), `actions` (List<SceneAction>, >=1), `matchType` (1 OR / 2 AND), `enabled` (automation), `preConditions`, `displayColor`, `coverIcon`.

### Execute tap-to-run
```kotlin
ThingHomeSdk.getSceneServiceInstance().executeService().executeScene(
    sceneData,
    object : IResultCallback() {
        override fun onSuccess() { }
        override fun onError(errorCode: String?, errorMessage: String?) { }
    })
```

### Enable / disable automation
```kotlin
enableAutomation(sceneId: String, callback: IResultCallback<Boolean>?)
disableAutomation(sceneId: String, callback: IResultCallback<Boolean>?)
enableAutomationWithTime(sceneId: String, time: Int, callback: IResultCallback<Boolean>?)  // bật theo khoảng thời gian
```

### Delete
```kotlin
deleteSceneWithHomeId(relationId: Long, sceneId: String, callback: IResultCallback<Boolean>?)
```

### MQTT change listener (realtime)
```kotlin
ThingHomeSdk.getSceneServiceInstance().executeService()
    .registerDeviceMqttListener(object : SceneChangeCallback {
        override fun onAddScene(sceneId: String) { }
        override fun onUpdateScene(sceneId: String) { }
        override fun onDeleteScene(sceneId: String) { }
        override fun onEnableScene(sceneId: String) { }
        override fun onDisableScene(sceneId: String) { }
    })
// gỡ:
ThingHomeSdk.getSceneServiceInstance().executeService().unRegisterDeviceMqttListener()         // gỡ hết
ThingHomeSdk.getSceneServiceInstance().executeService().unRegisterDeviceMqttListener(callback)  // gỡ 1
```

### Condition builders (Android, thế hệ mới — `ConditionBase`)
```kotlin
// Device condition (DP của thiết bị)
val builder = DeviceConditionBuilder(
    deviceId = deviceConditionData.deviceId,
    dpId = deviceConditionData.datapointId.toString(),
    entityType = deviceConditionData.entityType ?: CONDITION_TYPE_DEVICE,  // device = 1
    deviceConditionData = deviceConditionData,
    chooseValue = chooseValue
)
val conditionBase = builder.build() as ConditionBase
//   .setConvertTemp(tempMap).setTempUnit(..).setOriginTempUnit(..).setDpScale(..)  // chuyển đổi nhiệt độ
//   .setDelayTime(..)        // PIR
//   .setCalType(COND_TYPE_DURATION).setTimeWindow(..)  // điều kiện "DP giữ trong N giây"

// Weather condition (entityType = 3)
val weatherConditionBuilder = WeatherConditionBuilder(
    cityId = cityId, cityName = city, entityType = 3,
    weatherType = WeatherType.WEATHER_TYPE_TEMP,   // WEATHER_TYPE_WIND, ...
    operator = "<", chooseValue = chooseValue)
val conditionBase = weatherConditionBuilder.build() as ConditionBase

// Timer / schedule condition (entityType = 6)
val conditionBase = TimingConditionBuilder(timeZoneId, loops, time, date).build() as ConditionBase
//   loops = "1111111" (T2..CN), time = "20:30", date = "20231010"

// Sunrise/Sunset condition
val conditionBase = SunRiseSetConditionBuilder(cityId, SunSetRiseRule.SunType.SUNSET, 20).build() as ConditionBase

// Geofence condition (entityType = 10)
val conditionBase = GeofenceConditionBuilder(radius, latitude, longitude, address, geofenceType).build() as ConditionBase
```

### Action builders (Android, thế hệ mới — `ActionBase`)
```kotlin
// Device DP action (dpIssue)
val builder = DeviceActionBuilder(deviceId, deviceActionDetailBean, selDpValue, selDpDisplayValue ?: "")
val actionBase = builder.build() as ActionBase
//   group: DeviceActionBuilder(groupId.toString(), ...)
//   step DP: DeviceActionBuilder(.., isStep = true).apply { setType(DeviceStepType.HIGH) }

// Delay action
val actionBase = DelayActionBuilder(minutes, seconds).build() as ActionBase

// Notification action: ACTION_TYPE_MESSAGE (message center) / ACTION_TYPE_SMS / ACTION_TYPE_PHONE
val actionBase = NotifyActionBuilder(ACTION_TYPE_MESSAGE).build() as ActionBase

// Trigger scene / enable-disable automation khác (linkage rule)
val actionBase = LinkageRuleActionBuilder(checkedItem.id, ACTION_TYPE_TRIGGER).build() as ActionBase
//   ACTION_TYPE_ENABLE_AUTOMATION / ACTION_TYPE_DISABLE_AUTOMATION
```

### Condition expression (Android, thế hệ cũ — factory)
```java
// expr cho device value
ThingSmartSceneExprModel deviceValueExpr =
    ThingSmartSceneConditionExprBuilder.createValueExprWithType("1", "==", 1000, kExprTypeDevice);
ThingSmartSceneConditionModel cond =
    ThingSmartSceneConditionFactory.createDeviceCondition(deviceModel, dpModel, deviceValueExpr);
```

---

## API iOS (verbatim / đối chiếu)

### Entry
```objc
ThingSmartSceneManager *mgr = [ThingSmartSceneManager sharedInstance];   // query/list/cities/device-list
ThingSmartScene *scene = [ThingSmartScene sceneWithSceneId:@"your_scene_id"];  // thao tác 1 scene
// hoặc tạo từ model: [ThingSmartScene sceneWithSceneModel:sceneModel];
```

### Query / list
```objc
- (void)getSimpleSceneListWithHomeId:(long long)homeId
        success:(void(^)(NSArray<ThingSmartSceneModel *> *list))success
        failure:(TYFailureError)failure;

- (void)getSceneListWithHomeId:(long long)homeId
        success:(void(^)(NSArray<ThingSmartSceneModel *> *list))success
        failure:(TYFailureError)failure;
```

### City / device-list cho condition & action
```objc
- (void)getCityListWithCountryCode:(NSString *)countryCode
        success:(void(^)(NSArray<ThingSmartCityModel *> *list))success failure:(TYFailureError)failure;
- (void)getCityInfoWithLatitude:(NSString *)latitude longitude:(NSString *)longitude
        success:(void(^)(ThingSmartCityModel *model))success failure:(TYFailureError)failure;
- (void)getConditionDeviceListWithHomeId:(long long)homeId
        success:(void(^)(NSArray<ThingSmartDeviceModel *> *list))success failure:(TYFailureError)failure;
- (void)getActionDeviceListWithHomeId:(long long)homeId
        success:(void(^)(NSArray<ThingSmartDeviceModel *> *list))success failure:(TYFailureError)failure;
```

### Create / modify (dùng chung)
```objc
+ (void)addNewSceneWithName:(NSString *)name
                     homeId:(long long)homeId
                 background:(NSString *)background
              showFirstPage:(BOOL)showFirstPage
           preConditionList:(NSArray<ThingSmartScenePreConditionModel*> *)preConditionList
              conditionList:(NSArray<ThingSmartSceneConditionModel*> *)conditionList
                 actionList:(NSArray<ThingSmartSceneActionModel*> *)actionList
                  matchType:(ThingSmartConditionMatchType)matchType
                    success:(void (^)(ThingSmartSceneModel *sceneModel))success
                    failure:(TYFailureError)failure;

- (void)modifySceneWithName:(NSString *)name
                 background:(NSString *)background
              showFirstPage:(BOOL)showFirstPage
           preConditionList:(NSArray<ThingSmartScenePreConditionModel*> *)preConditionList
              conditionList:(NSArray<ThingSmartSceneConditionModel*> *)conditionList
                 actionList:(NSArray<ThingSmartSceneActionModel*> *)actionList
                  matchType:(ThingSmartConditionMatchType)matchType
                    success:(TYSuccessHandler)success
                    failure:(TYFailureError)failure;
```

### Execute / enable / disable / delete (trên instance `ThingSmartScene`)
```objc
- (void)executeSceneWithSuccess:(TYSuccessHandler)success failure:(TYFailureError)failure;  // tap-to-run
- (void)enableSceneWithSuccess:(TYSuccessHandler)success failure:(TYFailureError)failure;   // bật automation
- (void)disableSceneWithSuccess:(TYSuccessHandler)success failure:(TYFailureError)failure;  // tắt automation
- (void)deleteSceneWithHomeId:(long long)homeId success:(TYSuccessBOOL)success failure:(TYFailureError)failure;
```

### matchType enum
```objc
ThingSmartConditionMatchAny   // 1: thoả bất kỳ (OR)
ThingSmartConditionMatchAll   // 2: thoả tất cả (AND)
```

### Condition factory (iOS)
```objc
+ (ThingSmartSceneConditionModel *)createDeviceConditionWithDevice:(ThingSmartDeviceModel *)device
                                                          dpModel:(ThingSmartSceneDPModel *)dpModel
                                                        exprModel:(ThingSmartSceneExprModel *)exprModel;

+ (ThingSmartSceneConditionModel *)createWhetherConditionWithCity:(ThingSmartCityModel *)city
                                                         dpModel:(ThingSmartSceneDPModel *)dpModel
                                                       exprModel:(ThingSmartSceneExprModel *)exprModel;

+ (ThingSmartSceneConditionModel *)createTimerConditionWithExprModel:(ThingSmartSceneExprModel *)exprModel;

+ (ThingSmartSceneConditionModel *)createGeoFenceConditionWithGeoType:(GeoFenceType)type   // .reach / .exit
                                                             geoLati:(CGFloat)latitude
                                                            geoLonti:(CGFloat)longitude
                                                           geoRadius:(CGFloat)radius
                                                            geoTitle:(NSString *)geoTitle;
```
```swift
// timer expr builder (Swift)
let timeExpr = ThingSmartSceneConditionExprBuilder.createTimerExpr(
    withTimeZoneId: NSTimeZone.default.identifier, loops: "1111111", date: "20231010", time: "20:30")
ThingSmartSceneConditionFactory.createTimerCondition(with: timeExpr)
```

### Action factory (iOS)
```objc
+ (ThingSmartSceneActionModel *)deviceActionWithFeature:(ThingSmartSceneCoreFeatureModel *)feature
                                                 devId:(NSString *)devId
                                            deviceName:(NSString *)deviceName;      // dpIssue

+ (ThingSmartSceneActionModel *)createDelayActionWithHours:(NSString *)hours
                                                  minutes:(NSString *)minutes
                                                  seconds:(NSString *)seconds;      // delay

+ (ThingSmartSceneActionModel *)createTriggerSceneActionWithSceneId:(NSString *)sceneId
                                                          sceneName:(NSString *)sceneName;  // ruleTrigger

+ (ThingSmartSceneActionModel *)createSendNotificationAction;                       // appPushTrigger
```

### PreCondition (khung giờ hiệu lực — iOS)
```swift
let precondParam = TSmartScenePreconditionParam()
precondParam.sceneID = currentPrecondition?.scenarioId ?? ""
precondParam.preconditionType = .custom
precondParam.cityId = "5621253"
precondParam.timeZoneId = TimeZone.current.identifier
precondParam.beginDate = "07:00"
precondParam.endDate = "20:00"
ThingSmartScenePreConditionFactory.scenePrecondition(with: precondParam)
```

---

## Bean / Callback / Listener

### Android
| Tên | Vai trò | Field/Method chính |
|---|---|---|
| `NormalScene` | bean scene chính (create/detail) | `id`, `name`, `conditions:List<SceneCondition>`, `actions:List<SceneAction>`, `enabled`, `ruleGenre` (1 tap-to-run / 2 automation), `matchType` (1 OR / 2 AND), `preConditions`, `displayColor`, `coverIcon` |
| `SavedScene` | response khi save | `ruleId`, `name`, `ruleGenre` |
| `SceneCondition` | 1 điều kiện | `entityId` (devId/cityId/"timer"), `entitySubIds` (dpId / "temp"/"humidity"/"condition"/"sunsetrise"), `entityType` (1 device / 3 weather / 6 schedule), `expr` (List/Map), `entityName`, `condType` (1 expr-match / 2 simple) |
| `SceneAction` | 1 hành động | `entityId` (devId/groupId/sceneId/"delay"), `actionExecutor` ("dpIssue"/"deviceGroupDpIssue"/"ruleTrigger"/"ruleEnable"/"ruleDisable"/"delay"/"appPushTrigger"/"smsSend"/"mobileVoiceSend"), `executorProperty:Map`, `actionDisplayNew:Map` |
| `ConditionBase`/`ActionBase` | output của Builder | nạp vào `conditions`/`actions` của NormalScene |
| `SceneChangeCallback` | MQTT realtime | `onAddScene/onUpdateScene/onDeleteScene/onEnableScene/onDisableScene(sceneId)` |
| `IResultCallback<T>` | callback chung | `onSuccess(result:T)`, `onError(errorCode, errorMessage)` |

**Builder Android:** `DeviceConditionBuilder`, `WeatherConditionBuilder`, `TimingConditionBuilder`, `SunRiseSetConditionBuilder`, `GeofenceConditionBuilder` → `.build() as ConditionBase`; `DeviceActionBuilder`, `DelayActionBuilder`, `NotifyActionBuilder`, `LinkageRuleActionBuilder` → `.build() as ActionBase`.
**Hằng số:** `CONDITION_TYPE_DEVICE`=1, `entityType` weather=3, schedule=6; action `ACTION_TYPE_MESSAGE/SMS/PHONE`, `ACTION_TYPE_TRIGGER`, `ACTION_TYPE_ENABLE_AUTOMATION/DISABLE_AUTOMATION`.

### iOS
| Tên | Vai trò | Field/Method chính |
|---|---|---|
| `ThingSmartSceneManager` (sharedInstance) | query/list/cities/device-list | `getSimpleSceneListWithHomeId`, `getSceneListWithHomeId`, `getConditionDeviceListWithHomeId`, `getActionDeviceListWithHomeId`, `getCityListWithCountryCode`, `getCityInfoWithLatitude` |
| `ThingSmartScene` | thao tác 1 scene | `+sceneWithSceneId:`, `+sceneWithSceneModel:`, `+addNewSceneWithName:…`, `-modifySceneWithName:…`, `-executeSceneWithSuccess:`, `-enableSceneWithSuccess:`, `-disableSceneWithSuccess:`, `-deleteSceneWithHomeId:` |
| `ThingSmartSceneModel` | bean scene | `sceneId`, `name`, `enabled`, `conditions`, `actions`, `preConditions`, `matchType` |
| `ThingSmartSceneConditionModel` | 1 điều kiện | `conditionId`, `entityId`, `entityName`, `entityType` (1 device / 3 weather / 6 schedule / 7 PIR / 10 geofence / 16 sunset-rise), `entitySubIds`, `expr`, `exprDisplay`, `iconUrl`, `extraInfo` (city/tempUnit/delayTime/geofence) |
| `ThingSmartSceneActionModel` | 1 hành động | `actionId`, `entityId`, `entityName`, `actionDisplay`, `actionExecutor` (dpIssue/deviceGroupDpIssue/ruleTrigger/ruleEnable/ruleDisable/delay/appPushTrigger), `executorProperty`, `extraProperty` |
| `ThingSmartScenePreConditionModel` | khung giờ hiệu lực | tạo qua `ThingSmartScenePreConditionFactory.scenePrecondition(with:)` |
| `ThingSmartSceneConditionFactory` / `ThingSmartSceneActionFactory` | factory build condition/action | (xem trên) |
| `ThingSmartSceneConditionExprBuilder` | build expr (value/enum/timer) | `createTimerExpr(withTimeZoneId:loops:date:time:)` … |
| `ThingSmartCityModel`, `ThingSmartSceneDPModel`, `ThingSmartSceneExprModel`, `ThingSmartSceneCoreFeatureModel`, `ThingSmartDeviceModel` | model phụ trợ | — |

**Callback types iOS:** `TYSuccessHandler` (void), `TYSuccessBOOL` (BOOL), `TYFailureError` (NSError), `void(^)(NSArray<ThingSmartSceneModel*>*)` cho list.

---

## Mã lỗi liên quan
- **Trang Error Codes chung KHÔNG có nhóm mã riêng cho scene/automation** (chỉ có P2P/IPC/Cloud `-60000`/`-60001`). Lỗi scene trả về qua `onError(errorCode, errorMessage)` dạng **cloud error string** (vd `"FAILURE"`, mã HTTP-like, hoặc message từ server). → Khi code phải **log nguyên `errorCode`+`errorMessage`** vì không có bảng tra cố định.
- Lỗi điều khiển DP bên trong action (khi automation chạy) sẽ rơi vào nhóm device-control của note nền tảng (`-1400` DP không hỗ trợ, `-10001` device offline…). Một automation `enabled=true` nhưng thiết bị offline → action `dpIssue` lặng lẽ không chạy (không có callback về client).
- `executeScene.onSuccess` chỉ nghĩa **đã gửi lệnh chạy scene lên cloud**, không đảm bảo từng action DP đã tới thiết bị (giống `publishDps.onSuccess` ≠ `onDpUpdate`).

## Cạm bẫy
1. **Hai thế hệ API Android** (factory cũ `ThingSmartSceneConditionFactory` vs builder mới `DeviceConditionBuilder`). Doc 7.x ưu tiên **builder + `getSceneServiceInstance()`**; đừng trộn 2 kiểu. Khi viết native module, chốt 1 thế hệ và kiểm tra class tồn tại trong `thingsmart 7.5.x` thực tế.
2. **`ruleGenre` quyết định loại scene** — quên set ⇒ tạo nhầm. Tap-to-run (1): KHÔNG kèm condition; Automation (2): PHẢI có >=1 condition, và `enabled` mới có tác dụng.
3. **`matchType` 1=OR / 2=AND** dễ nhầm. iOS dùng enum `ThingSmartConditionMatchAny`(1)/`MatchAll`(2). Khi map qua JS phải thống nhất số.
4. **`saveSceneV2`/`modifySceneV2` cần NormalScene ĐẦY ĐỦ** (conditions+actions). Khi modify, nếu chỉ truyền field thay đổi sẽ mất phần còn lại → luôn fetch detail, sửa, rồi save lại toàn bộ. `modifySceneV2` có cờ `needCleanGidSid`.
5. **Weather/geofence cần cityId/toạ độ hợp lệ.** Lấy city qua `getCityInfoWithLatitude`/`getCityListWithCountryCode` trước; sai city ⇒ điều kiện không kích hoạt. Geofence cần **quyền vị trị nền** (iOS Always, Android background location) — đây là quyền nhạy cảm, cân nhắc UX.
6. **Timer/schedule** dùng `loops="1111111"` (7 ngày, T2→CN), `time="HH:mm"`, cần `timeZoneId` đúng — sai TZ ⇒ chạy lệch giờ.
7. **MQTT listener (Android)** chỉ báo "có thay đổi" kèm `sceneId`, KHÔNG kèm dữ liệu mới → phải **re-fetch** detail/list. Nhớ `unRegisterDeviceMqttListener` khi rời màn để tránh leak.
8. **Action `appPushTrigger`/notification** phụ thuộc cấu hình message/FCM phía cloud + quyền thông báo; trên iOS cần entitlement push. Không có push nếu app/cloud chưa bật message center.
9. **Execute scene khi thiết bị offline**: action không tới thiết bị nhưng cloud vẫn báo success → UI phải dựa thêm `onDpUpdate`/device status để xác nhận thực tế (đặc biệt quan trọng cho preset nhiệt độ ice-bath).
10. **iOS create là class method** (`+addNewSceneWithName…`) nhưng modify/execute/enable/disable là **instance method** trên `ThingSmartScene` → phải giữ instance (tạo từ `sceneWithSceneId:`/`sceneWithSceneModel:`).
11. **Số lượng condition/action có giới hạn** theo phía cloud (thường tối đa ~N action/scene) — chưa thấy con số verbatim trong doc, cần test thực tế.

---

## Đề xuất API TurboModule

**Tạo module mới `TuyaScene`** (CRUD + execute + automation enable/disable + listener). Vì JSON condition/action rất phức tạp và 2 thế hệ API native khác nhau, đề xuất **truyền condition/action dưới dạng JSON string đã chuẩn hoá** (native parse → build bean/factory tương ứng), thay vì model hoá toàn bộ trên spec TS — giảm bề mặt và dễ tiến hoá. Listener đẩy qua **event emitter** (giống `onDeviceStatus`).

```ts
// === Module mới: TuyaScene ===

// --- Types ---
type SceneRuleGenre = 1 | 2;            // 1 = tap-to-run, 2 = automation
type SceneMatchType = 1 | 2;            // 1 = OR (any), 2 = AND (all)

interface SceneSummary {
  sceneId: string;
  name: string;
  ruleGenre: SceneRuleGenre;
  enabled: boolean;                      // chỉ ý nghĩa với automation
  matchType?: SceneMatchType;
  displayColor?: string;
  coverIcon?: string;
}

interface SceneDetail extends SceneSummary {
  conditionsJson: string;               // JSON array các condition (raw từ SDK)
  actionsJson: string;                  // JSON array các action (raw từ SDK)
  preConditionsJson?: string;
}

interface SaveSceneResult { sceneId: string; name: string; ruleGenre: SceneRuleGenre; }

// --- List / detail ---
getSceneList(homeId: number): Promise<SceneSummary[]>;            // getSimpleSceneAll / getSimpleSceneListWithHomeId
getSceneDetail(homeId: number, sceneId: string): Promise<SceneDetail>;

// --- Create / modify (conditions/actions là JSON đã build sẵn) ---
saveScene(homeId: number, params: {
  name: string;
  ruleGenre: SceneRuleGenre;
  matchType?: SceneMatchType;           // mặc định 2 (AND) cho automation
  background?: string;                  // ảnh nền (iOS background / Android coverIcon)
  showFirstPage?: boolean;              // iOS showFirstPage; Android map displayColor/coverIcon
  conditionsJson?: string;              // bắt buộc khi ruleGenre=2
  actionsJson: string;                  // >=1 action
  preConditionsJson?: string;
}): Promise<SaveSceneResult>;

modifyScene(homeId: number, sceneId: string, params: { /* như saveScene */ }): Promise<SaveSceneResult>;
deleteScene(homeId: number, sceneId: string): Promise<boolean>;

// --- Execute / automation control ---
executeScene(homeId: number, sceneId: string): Promise<void>;            // tap-to-run
enableAutomation(sceneId: string): Promise<boolean>;
disableAutomation(sceneId: string): Promise<boolean>;
enableAutomationWithTime(sceneId: string, durationMs: number): Promise<boolean>;  // Android-only; iOS reject NOT_SUPPORTED

// --- Builders (native build condition/action → trả JSON nạp vào saveScene) ---
buildDeviceCondition(p: { devId: string; dpId: string; operator: string; value: string | number | boolean }): Promise<string>;
buildWeatherCondition(p: { cityId: string; cityName: string; weatherType: string; operator: string; value: string }): Promise<string>;
buildTimerCondition(p: { timeZoneId: string; loops: string; time: string; date?: string }): Promise<string>;
buildGeofenceCondition(p: { type: 'reach' | 'exit'; latitude: number; longitude: number; radius: number; title: string }): Promise<string>;

buildDeviceAction(p: { devId: string; dpId: string; value: string | number | boolean }): Promise<string>;  // dpIssue
buildDelayAction(p: { hours?: number; minutes: number; seconds: number }): Promise<string>;
buildTriggerSceneAction(p: { sceneId: string; sceneName?: string }): Promise<string>;                       // ruleTrigger
buildAutomationToggleAction(p: { sceneId: string; enable: boolean }): Promise<string>;                      // ruleEnable/ruleDisable
buildNotificationAction(p?: { channel?: 'message' | 'sms' | 'phone' }): Promise<string>;                    // appPushTrigger / smsSend / mobileVoiceSend

// --- Helpers cho UI tạo scene ---
getConditionDeviceList(homeId: number): Promise<Array<{ devId: string; name: string }>>;
getActionDeviceList(homeId: number): Promise<Array<{ devId: string; name: string }>>;
getCityListByCountryCode(countryCode: string): Promise<Array<{ cityId: string; cityName: string }>>;
getCityByLocation(latitude: number, longitude: number): Promise<{ cityId: string; cityName: string }>;

// --- Realtime listener (Android MQTT; iOS map qua refresh/notification) ---
registerSceneChangeListener(homeId: number): void;
unregisterSceneChangeListener(homeId: number): void;
// event 'onSceneChange': { type: 'add'|'update'|'delete'|'enable'|'disable'; sceneId: string }
```

**Ghi chú nền tảng (platformNotes):**
- `enableAutomationWithTime` chỉ có trên Android → iOS reject `NOT_SUPPORTED`.
- iOS create/modify nhận `background`+`showFirstPage`; Android map sang `displayColor`/`coverIcon` của `NormalScene`.
- `build*` chạy native: Android dùng builder mới (`DeviceConditionBuilder`…/`DeviceActionBuilder`…) hoặc factory cũ; iOS dùng `ThingSmartSceneConditionFactory`/`ThingSmartSceneActionFactory`. Output normalize về JSON để JS gộp vào `conditionsJson`/`actionsJson`.
- `registerSceneChangeListener`: Android `registerDeviceMqttListener(SceneChangeCallback)`; iOS chưa có listener tương đương rõ ràng → có thể poll/refresh list sau thao tác (đánh dấu cần verify).

---

## Câu hỏi mở / cần xác minh
- **Android lắp `NormalScene` + gọi `saveSceneV2` end-to-end**: doc cho builder rời rạc nhưng chưa thấy code gắn `conditionBase`/`actionBase` vào `NormalScene` (setter chính xác: `setConditions`/`setActions`/`setMatchType`/`setRuleGenre`?). Cần đọc API reference (tuya.github.io) hoặc test với SDK thật.
- **iOS scene change listener realtime** (tương đương `SceneChangeCallback` Android) — có notification name nào không? Cần mở iOS API reference.
- **Giới hạn số condition/action mỗi scene** và **giới hạn số scene mỗi home** (con số cụ thể).
- **`operator` hợp lệ** cho device/weather condition ("==", "<", ">", "<=", ">=") và format `expr` chính xác (value vs enum vs range).
- **DP của ice-bath dùng làm condition/action**: cần dpId thực tế (nhiệt độ mục tiêu/hiện tại, power) — phụ thuộc product schema (đã ghi ở note nền tảng).
- **`extraInfo`/`executorProperty` schema** chi tiết (vd geofence lưu gì, delay lưu gì) để serialize đúng qua JSON bridge.
- **Quyền background location** cho geofence trên cả 2 nền tảng (iOS Always Authorization; Android `ACCESS_BACKGROUND_LOCATION`).

## Nguồn (URL đã đọc)
- Smart Scenes (Android Scene Manager) — https://developer.tuya.com/en/docs/app-development/smartscenemanager?id=Ka6ki8ldkrsbr
- Smart Scenes (iOS) — https://developer.tuya.com/en/docs/app-development/smartscene?id=Ka5srtq859mp7
- Create Scene (Condition/Action factory) — https://developer.tuya.com/en/docs/app-development/core-linkage-builder?id=Kd0qp8q3ut3ca
- Scene Creation (Android tutorial, Kotlin builders) — https://developer.tuya.com/en/docs/app-development/extension-sdk-tutorial-scene-create?id=Kd8k48qhwzsq0
- Scene Creation (iOS tutorial) — https://developer.tuya.com/en/docs/app-development/extension-sdk-tutorial-ios-scene-create?id=Kd8kmqr7lh0zh
- Smart Home App SDK overview — https://developer.tuya.com/en/docs/app-development/app-sdk-smart-home?id=Kaq6lep0vc16u
- Error Codes — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
