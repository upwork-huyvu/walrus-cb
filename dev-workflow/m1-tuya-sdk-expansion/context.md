# Context: Mở rộng thư viện Tuya SDK theo từng module

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định/phát hiện/cạm bẫy ghi vào đây.
> Append theo thời gian, đừng xoá lịch sử (sai thì gạch + ghi lý do).

- **Slug:** `m1-tuya-sdk-expansion`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** - Kế thừa kiến trúc **multi-TurboModule tách theo tính năng** từ [m1-tuya-sdk-library](../m1-tuya-sdk-library/):
  lib = `@jimmy-vu/react-native-turbo-tuya`, java `com.jimmyvu.turbotuya`, codegen `TurboTuyaSpec`, package `TurboTuyaPackage`.
- **2026-06-29** - Mở rộng = **mở rộng module hiện có** (TuyaAuth/TuyaHome/TuyaDevice/TuyaPairing) + **module mới**
  (TuyaOta/TuyaScene/TuyaTimer/TuyaMessage; P3: TuyaMember/TuyaMatter/TuyaMesh). Giữ facade `Tuya` tương thích.
- **2026-06-29** - **TuyaMessage gộp** push + message-center + DND (đề xuất, chờ chốt) thay vì tách TuyaPush riêng.
- **2026-06-29** - **Widget = NGOÀI phạm vi** (UI/extension OS); chỉ thêm `TuyaDevice.getSwitchDps`. Group/multi-control bỏ.
- **2026-06-29** - **Prerequisites** trước mọi thứ: C0 (TuyaErrors + error shape `{code,message,domain}`) + C1 (iOS RCTEventEmitter
  - vì iOS hiện CHƯA bắn event nào). Thứ tự làm = ưu tiên 3 đợt (P1→P3).
- **2026-06-29** - **TuyaScene:** condition/action serialize bằng **builder native trả JSON** (buildXxxCondition/buildXxxAction),
  KHÔNG model hoá trên spec TS (codegen + độ phức tạp).
- **2026-06-29 (B1 - TuyaErrors)** - `src/errors.ts` **thuần JS** (không import 'react-native') để test độc lập + tránh
  throw lúc import. `classify(code, domain='sdk')`; **mã 1004 phân biệt domain** (sdk=pairing_failed+needsNewToken /
  cloud=illegal_client); range 50500–50516 (50502=ssl_clock). **`describe` để SYNC trả `string`** - lệch đề xuất
  `Promise<string>` (không có việc async → sync gọn hơn). Native reject helper (`common/TuyaReject.kt` +
  `ios/Common/TuyaReject.h`) gắn `domain` vào userInfo; **chưa rewire module cũ** (áp dụng dần theo plan). Export
  `TuyaErrors` + types ở `index.tsx`. Unit test `src/__tests__/errors.test.ts` (chạy được khi có node_modules).
- **2026-06-29 (B2 - iOS event infra)** - Tạo lớp cơ sở `ios/Common/TuyaEventEmitter.{h,mm}` (`: RCTEventEmitter`):
  `supportedEvents` (subclass override), `startObserving/stopObserving` → cờ `_hasListeners`, `emit:body:` (chỉ gửi khi
  có listener). `TuyaDevice`/`TuyaPairing` đổi superclass `NSObject`→`TuyaEventEmitter`, **bỏ no-op addListener/
  removeListeners** (kế thừa từ RCTEventEmitter - khớp spec), thêm `supportedEvents` (Device=`onDeviceStatus`;
  Pairing=`onPairingProgress`/`onBleScan`). Giữ `RCT_EXPORT_MODULE()` + `getTurboModule:`. Android không đổi (đã emit
  qua RCTDeviceEventEmitter); JS `index.tsx` không đổi (deviceEmitter/pairingEmitter giữ nguyên). Các module event sau
  (Ota/Auth-session/Home-listener) chỉ cần subclass `TuyaEventEmitter`.
  **⚠️ VERIFY Xcode (new arch):** RCTEventEmitter + TurboModule cùng tồn tại - nếu event không tới JS ở bridgeless mode
  thì fallback sang **codegen EventEmitter type** trong spec.
- **2026-06-30 (B3 - TuyaAuth mở rộng)** - Code theo VERBATIM note user-account (đọc trực tiếp note thay vì đoán).
  Spec `NativeTuyaAuth`: UserResult giàu hơn (tempUnit 1/2, timezoneId, headPic, mobile, regionCode) + syncUserInfo/
  updateNickname/updateTempUnit/updateTimeZone/updateAvatarByUrl/cancelAccount/resetEmail+PhonePassword/bind*/
  getLoginTerminals/terminateSession + addListener/removeListeners (cho onSessionExpired) + type LoginTerminal.
  Android: wired bằng IResultCallback/IReNickNameCallback/IResetPasswordCallback/TempUnitEnum; session qua
  `ThingHomeSdk.setOnNeedLoginListener` → emit `onSessionExpired`. iOS: `TuyaAuth` đổi sang `TuyaEventEmitter`,
  wire profile/reset/cancel/logout/getLoginTerminals/terminateSession (ThingSmartUser) + observe notification
  `ThingSmartUserNotificationUserSessionInvalid`; login email vẫn TODO. **TODO-verify:** bind*/getLinked (chữ ký
  bindThirdPlatform 5-String chưa rõ), Android multi-device (không verbatim), updateAvatarByUrl (deprecated).
  ⚠️ Verify import Android: TempUnitEnum/IReNickNameCallback/IResetPasswordCallback/INeedLoginListener.
- **2026-06-30 (B4 - TuyaDevice mở rộng)** - Code theo verbatim device-control. Spec +DeviceSnapshot + 15 method.
  **Android wired:** rename/remove/reset (IThingDevice + IResultCallback), queryDp (getDp), getDeviceSnapshot
  (getDataInstance().getDeviceBean → dps/schema/dpCodes/isOnline/isLocalOnline), isDeviceOnline, isCloudConnected
  (getServerInstance().isServerConnect), publishDpsWithMode (ThingDevicePublishModeEnum), **publishDpsAwaitAck**
  (newDeviceInstance riêng + one-shot IDevListener resolve onDpUpdate đầu tiên + Handler timeout mặc định 8s, không
  clobber listener bền). **TODO-verify Android:** getWifiSignal (WifiSignalListener), publishDpsWithChannels
  (CommunicationEnum/orders), sendCacheDps, bleConnect/disconnect/isBleLocalOnline (getBleManager/BleConnectBuilder).
  **iOS:** TODO-reject toàn bộ method mới (giữ parity codegen; impl device-control iOS = effort riêng, selector đã có
  trong note). ⚠️ Verify import `com.thingclips.smart.sdk.enums.ThingDevicePublishModeEnum`. publishDpsAwaitAck hiện
  resolve ở onDpUpdate ĐẦU TIÊN sau publish (chưa match đúng dpId - tinh chỉnh sau nếu cần).
- **2026-06-30 (B5 - TuyaOta module mới + B6 - TuyaHome.updateHome)** - **TuyaOta:** spec `NativeTuyaOta` + Android
  `ota/TuyaOtaModule.kt` (cache IThingOTAService/devId + register IDevOTAListener 1 lần → emit onOtaProgress/
  onOtaStatusChanged/onOtaSuccess/onOtaFailure; checkFirmwareUpgrade→UpgradeInfo[]; startFirmwareUpgrade lọc bean theo
  type rồi gọi (void); cancel/confirmWarningUpgradeTask/get+setAutoUpgradeSwitch) + iOS `ios/Ota/` TODO-reject (subclass
  TuyaEventEmitter) + **register vào TurboTuyaPackage** (6 module). ⚠️ verify chữ ký IDevOTAListener/IGetOtaInfoCallback/
  UpgradeInfoBean (note ghi tên, tham số cần đối chiếu Javadoc). **TuyaHome.updateHome/dismissHome:** Android wired
  (IResultCallback), iOS TODO-reject. → **Đợt 1 (B1–B6) hoàn tất phần code.**
- **2026-06-30 (REVIEW Đợt 1 - workflow 4-agent + fixes)** - Review độc lập TS/Android/iOS/parity: **không blocker, parity
  3-mặt 100%, codegen sạch**. Đã sửa các lỗi đúng-đắn: (1) OTA listener leak → thêm `invalidate()` dọn IThingOTAService.onDestroy
  (Ota) + unRegisterDevListener/onDestroy (Device); (2) `registerDeviceListener` idempotent (unRegister trước khi register -
  tránh emit trùng); (3) `publishDpsAwaitAck` chỉ resolve khi onDpUpdate **chứa dpId vừa publish** (parse JSON, không resolve
  bởi DP lạ); (4) `syncUserInfo` reject `no_user` nếu user null; (5) BLE scan dùng `object : BleScanResponse` (verbatim note)
  thay trailing-lambda (bỏ rủi ro SAM-conversion nếu BleScanResponse không phải SAM); (6) comment 5→6 module.
  **Residual cần verify trên máy:** ⚠️ iOS RCTEventEmitter + TurboModule ở **bridgeless** (event có deliver tới JS?) - nếu
  không thì chuyển spec sang **codegen EventEmitter type**. Quality để ngỏ (ưu tiên thấp): UserResult thêm countryCode,
  getSdkVersion đọc version thật, dọn entry `react-native.config.js` trong package.json files[], cân nhắc jsSrcsDir=src/specs.
- **2026-06-30 (B7 - TuyaScene, bắt đầu Đợt 2)** - Module mới, lớn nhất. **Spec đầy đủ 26 method + facade + event onSceneChange
  + đăng ký (7 module).** Quyết định codegen quan trọng: (a) **bỏ union type** (`value: string|number|boolean` → `value: string`,
  caller stringify); (b) **object param → JSON string** (`saveScene(homeId, paramsJson)` thay vì object) cho gọn iOS struct;
  (c) đổi tên param **`operator` → `op`** (keyword C++/ObjC++ sẽ vỡ selector). **Native = SKELETON có chủ đích** (Android+iOS
  TODO-reject) - KHÁC B3–B6 (đã wire): vì **scene SDK mới** (`getSceneServiceInstance`/`NormalScene`/`SceneCondition`/
  `SceneAction`/builder `DeviceConditionBuilder…`/`SceneChangeCallback`/generic `IResultCallback`) có **package + cách lắp
  NormalScene CHƯA verbatim** (note "Câu hỏi mở"). Không import blind để khỏi vỡ compile cả module; mỗi method ghi
  **intended-call** từ note để wire trên SDK thật. Builder condition/action → JSON; create truyền paramsJson.
  **Cần wire khi có SDK:** toàn bộ TuyaScene native (cả 2 nền tảng).
- **2026-06-30 (B8 - TuyaTimer)** - Module mới (lịch cloud, KHÔNG event). Spec: `inputJson` string (tránh object param) +
  TimerItem; 5 method. **Android WIRED:** addTimer/updateTimer (ThingTimerBuilder dựng từ inputJson - setTaskName/setDevId/
  setDeviceType/setActions/setLoops/setStatus/setIsAppPush/setAliasName), removeTimer + updateTimerStatus
  (getTimerInstance().updateTimerStatus + TimerUpdateEnum.DELETE/OPEN/CLOSE). **getTimerList TODO** (bean TimerTask chưa rõ).
  iOS TODO-reject (đăng ký 8 module). ⚠️ Verify: package timer (ThingTimerBuilder/TimerDeviceTypeEnum/TimerUpdateEnum -
  guess com.thingclips.smart.home.sdk.builder/.sdk.enums) + **format setActions** (ThingTimerBuilder không có setTime → time
  nằm trong actions; hiện best-guess `[{"time","dps"}]`) + setTimerId cho updateTimer.
- **2026-06-30 (B9 - TuyaMessage)** - Module mới gộp push + message-center + DND (KHÔNG event). Spec 21 method; đổi param
  `id`→`dndId` (keyword ObjC). **Android WIRED:** registerDevice (getPushInstance().registerDevice(token,provider,IResultCallback)),
  setPushStatus, get/setDndStatus (getDeviceDNDSetting/setDeviceDNDSetting), addDnd/addOnceDnd (IThingDataCallback Long),
  modifyDnd/removeDnd (Boolean), deleteMessages (IBooleanCallback); `devIds`→JSON `{allDevIds,devIds:[]}`; markMessagesRead
  no-op (Android không có API public). **TODO** (cần enum MessageType/PushType + bean MessageListBean/MessageHasNew/
  PushStatusBean/DeviceAlarmNotDisturbVO verbatim): message-list/byType/detail, getMessageHasNew, getPushStatus,
  push-by-type, getDnd/OnceDndList, unregisterDevice. iOS TODO-reject (đăng ký 9 module). ⚠️ verify thứ tự bit `loops` (CN-first vs Mon-first).
- **2026-06-30 (B10 - TuyaHome weather + listeners)** - Mở rộng module có sẵn (KHÔNG thêm module). **TuyaHome trở thành
  event-emitter** (`onHomeChange`): iOS đổi base NSObject→TuyaEventEmitter + supportedEvents; Android emit qua
  RCTDeviceEventEmitter. Spec +WeatherSketch; getHomeWeatherSketch(homeId,lon,lat) - iOS dùng homeId (ThingSmartHome tự
  lấy toạ độ), Android dùng lon/lat truyền tay. **Android WIRED:** weather sketch + 2 listener (IThingHomeChangeListener cấp
  manager: home add/remove/invite/info/shared; IThingHomeStatusListener cấp home: device/group/mesh) + invalidate() gỡ
  listener. **getHomeWeatherDetail TODO** (DashBoardBean field chưa verbatim). iOS stubs TODO-reject. Event payload chuẩn hoá
  {type, homeId?, homeName?, devId?, groupId?, meshId?, devIds?}. ⚠️ Verify package: WeatherBean/IIGetHomeWetherSketchCallBack,
  IThingHomeChange/StatusListener, unRegisterHomeStatusListener, GroupBean path; + iOS bridgeless event (Home = emitter thứ 6).
- **2026-06-30 (B11 - TuyaPairing combo + auto-token)** - Mở rộng module có sẵn (HẾT Đợt 2). Chọn **classic API** (getActivator()/
  newMultiModeActivator) cho nhất quán với BLE single + EZ/AP sẵn có (note khuyến nghị classic cho M1). Spec +startBleWifiPairing/
  stopBleWifiPairing/startWifiPairingAuto. **Android WIRED:** startBleWifiPairing dùng lại `scannedBle` cache (uuid→ScanDeviceBean)
  → **auto** getActivatorToken(homeId) → MultiModeActivatorBean(scan){uuid,deviceType,ssid,pwd,token,homeId,timeout} →
  newMultiModeActivator().startActivator + IMultiModeActivatorListener (onSuccess/onFailure(int,String,Object)/
  onActivatorStatePauseCallback(PauseStateData)→emit onPairingProgress step='combo_stage'); stopBleWifiPairing=stopActivator(uuid);
  startWifiPairingAuto refactor `doWifiPairing` dùng chung. **invalidate()** dọn wifiActivator+scan (trước đó module chưa có).
  iOS stubs TODO-reject (combo=ThingSmartBLEWifiActivator; auto-token=getTokenWithHomeId+startConfigWiFi). ⚠️ Verify package
  MultiModeActivatorBean/IMultiModeActivatorListener/PauseStateData + PauseStateData getters (hiện toString) + field `timeout`/`pwd`.
- **2026-06-30 (B12 - TuyaMember, P3)** - Module mới (thành viên+lời mời+chuyển chủ, KHÔNG event). Spec Member/InvitationResult +
  11 method. **Android WIRED:** queryMembers (queryMemberList+IThingGetMemberListCallback→MemberBean map), updateMember (overload
  memberId/name/admin - không đổi role), removeMember, cancelInvitation (cancelMemberInvitationCode), updateInvitedMember,
  joinHomeByCode (joinHomeByInviteCode), processInvitation. **TODO:** addMember (MemberWrapperBean construction chưa verbatim),
  createInvitation+getInvitationList (InvitationMessageBean field chưa rõ), transferHomeOwner (Biz FamilyManagerCoreKit package
  chưa verbatim → TODO thay vì đoán sai import). iOS TODO-reject (ThingSmartHome member API + transferHomeWithMemberId).
  ⚠️ Verify MemberBean getters (getName/getDealStatus/getInvitationCode...) + IThingGetMemberListCallback package.
- **2026-06-30 (B13 - Pairing nâng cao, P3)** - Mở rộng TuyaPairing +6 method (startSubDevicePairing/stop/startGatewayPairing/
  startQrPairing/startWiredPairing/destroyActivator). **Native = SKELETON có chủ đích** (giống B7 Scene): các flow này thuộc
  **unified ActivatorService** (ActivatorMode.Zigbee/QRScan, ZigbeeActivatorParams/QRScanActivatorParams, IActivatorListener,
  IDevice, IDiscovery) - package CHƯA verbatim VÀ note device-pairing cảnh báo KHÔNG trộn classic (đang dùng) với unified.
  → Android TODO-reject (Promise) / no-op+emit error (void) kèm intended-call; iOS stubs. KHÔNG event mới (dùng onPairingProgress
  step='subdevice_found/error'). destroyActivator tạm dọn wifiActivator+scan. **Cần wire khi quyết định dùng unified API.**
- **2026-06-30 (B14 - TuyaMatter, P3)** - Module mới (skeleton có chủ đích). **Quyết định thiết kế: luồng STATEFUL, native GIỮ
  SetupPayload/ConnectResult giữa các call - KHÔNG round-trip object native qua JS** (parse→connect→commission gọi tuần tự;
  connect/commission dùng object đã lưu, JS chỉ truyền homeId/token/ssid/pwd/timeout). Lý do: SetupPayload/ConnectResult không
  có public constructor để dựng lại từ field bên JS. Spec 3 type (chỉ field đọc được) + 7 method + 3 event. Native TODO-reject +
  intended-call (Matter API riêng getMatterDevActivatorInstance + entitlement iOS + KHÔNG obfuscate - chưa verbatim package).
  iOS event-emitter (3 event). **Cần wire khi xác nhận có thiết bị Matter** (ít khả năng với ice-bath).
- **2026-06-30 (B15 - TuyaMesh, P3)** - Module mới (skeleton có chủ đích, **12 module** - HẾT 15 bước). Spec SIG+Tuya mesh:
  create/list + client lifecycle (startMeshClient connect proxy) + search/activateSubDevice + publish/multicast DP (nodeId/localId,
  pcc, dps) + 3 type + 3 event. STATEFUL: native giữ mesh client + device instance. **Native SKELETON**: mesh subsystem lớn +
  iOS SIG/Tuya mesh signature CHƯA verbatim (note Câu hỏi mở) + note "chỉ làm nếu có thiết bị mesh" → TODO-reject + intended-call
  §7/§8; iOS event-emitter (3 event). Beacon bỏ (note ghi ít dùng + điều khiển qua broadcast riêng). **Cần wire nếu có mesh thật.**

## Bản đồ file/module (sẽ thêm khi code)
| File / Module | Vai trò |
|---|---|
| `src/errors.ts` (+ `__tests__/errors.test.ts`) | ✅ (B1) TuyaErrors classify/isRetryable/describe + types |
| `common/TuyaReject.kt` · `ios/Common/TuyaReject.h` | ✅ (B1) helper reject `{code,message,domain}` (dùng dần) |
| `ios/Common/TuyaEventEmitter.{h,mm}` | ✅ (B2) base RCTEventEmitter (emit/supportedEvents); Device+Pairing subclass |
| mở rộng `TuyaAuth`/`TuyaDevice`/`TuyaHome`/`TuyaPairing` | (B3/B4/B6/B10/B11) |
| `src/specs/NativeTuyaOta.ts` + `android/.../ota/` + `ios/Ota/` | (B5) module mới TuyaOta |
| `src/specs/NativeTuyaScene.ts` + native | (B7) module mới TuyaScene |
| `src/specs/NativeTuyaOta.ts` + `ota/TuyaOtaModule.kt` + `ios/Ota/` | ✅ (B5) module mới TuyaOta (Android wired; iOS TODO) |
| `src/specs/NativeTuyaTimer.ts` + native | (B8) module mới TuyaTimer |
| `src/specs/NativeTuyaMessage.ts` + native | (B9) module mới TuyaMessage |
| (P3) NativeTuyaMember/Matter/Mesh + native | (B12–B15) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
> Chi tiết + trích dẫn: [docs/research/tuya-home-sdk-full-surface.md](../../docs/research/tuya-home-sdk-full-surface.md) + 11 note.
- **2 thế hệ API song song** (legacy `getXxxInstance`/iOS singleton+delegate vs unified `ActivatorService`/Biz/CoreKit)
  ở Pairing/BLE/Scene/Member → chốt 1 bộ; verify chữ ký trên `tuya.github.io` + header iOS.
- **iOS chưa bắn event** → onDeviceStatus/onPairingProgress/onBleScan im trên iOS; phải dựng RCTEventEmitter (B2).
- **iOS không công bố bảng mã lỗi số** → log error.code thật khi test.
- **dpId/schema bồn tắm đá chưa biết** → cần thiết bị thật + productId (chặn snapshot/scene/timer).
- **publishDps.onSuccess = đã gửi** → publishDpsAwaitAck / nghe onDpUpdate.
- Pairing token 10 phút + chết sau 1 pair → auto-token retry khi -55/-56/-57/-33/1004 (B11).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Tiền đề: [m1-tuya-sdk-library](../m1-tuya-sdk-library/)
- Research: [tuya-home-sdk-full-surface.md](../../docs/research/tuya-home-sdk-full-surface.md) + `docs/research/tuya-home-sdk-*.md`

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
