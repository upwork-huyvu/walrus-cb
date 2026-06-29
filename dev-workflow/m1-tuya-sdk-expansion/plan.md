# Kế hoạch: Mở rộng thư viện Tuya SDK theo từng module (Home SDK full surface)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Nguồn sự thật về "định làm gì".

- **Slug:** `m1-tuya-sdk-expansion`
- **Milestone:** M1 — Nền tảng, Kết nối lõi & Quản lý User (Part A — mở rộng lib)
- **Phần liên quan:** mobile (thư viện `@jimmy-vu/react-native-turbo-tuya`)
- **Ngày tạo:** 2026-06-29
- **Tiền đề:** [m1-tuya-sdk-library](../m1-tuya-sdk-library/) (5 module cơ bản đã code) + research
  [docs/research/tuya-home-sdk-full-surface.md](../../docs/research/tuya-home-sdk-full-surface.md) (+ 11 note chi tiết).

## 1. Mục tiêu & phạm vi
Bổ sung các tính năng Home SDK còn thiếu (ngoài init/auth-cơ-bản/home-cơ-bản/pairing-Wi-Fi-BLE/DP) vào lib,
theo kiến trúc **multi-TurboModule tách theo tính năng** đã chốt. Mở rộng module hiện có + thêm module mới,
giữ facade `Tuya` tương thích.

**Trong phạm vi:** TuyaAuth (profile/tempUnit/session/reset/cancel), TuyaDevice (management + control nâng cao),
TuyaOta, TuyaHome (update/weather/listener), TuyaScene, TuyaTimer, TuyaMessage (push+message+DND), TuyaPairing
(combo + auto-token). **P3 (chỉ khi cần):** TuyaMember, pairing nâng cao (sub-device/gateway/QR/wired), TuyaMatter,
TuyaMesh/beacon.

**Ngoài phạm vi:** Widget (UI/extension OS — không hợp TurboModule thuần-logic; chỉ thêm `getSwitchDps`);
group/multi-control (mô hình 1 thiết bị/home); UI màn hình app (thuộc track mobile).

## 2. Bối cảnh & ràng buộc
- **Quy ước mỗi module:** spec TS `src/specs/NativeTuyaXxx.ts` + Kotlin `android/.../xxx/TuyaXxxModule.kt`
  (register trong `TurboTuyaPackage`) + iOS `ios/Xxx/TuyaXxx.{h,mm}` (`RCT_EXPORT_MODULE()`) + facade `src/index.tsx`.
- **Verify-first:** đối chiếu chữ ký native trên `tuya.github.io` API reference + header iOS TRƯỚC khi code
  (mỗi note có mục "Câu hỏi mở" liệt kê chỗ cần verify).
- **2 thế hệ API song song** ở nhiều mảng (legacy `getXxxInstance` vs unified `ActivatorService`/Biz/CoreKit) → chốt 1 bộ.
- **iOS chưa bắn event nào** (kể cả onDeviceStatus) → phải dựng `RCTEventEmitter` (bước C1) trước mọi module có event.
- **Lỗi:** reject theo shape chuẩn `{ code, message, domain:'sdk'|'cloud'|'network' }`, đừng nuốt code về -1.
- **Android trước** (build/test được khi có toolchain); iOS skeleton + selector từ note, hoàn thiện trên Mac.
- **publishDps.onSuccess = "đã gửi"** → xác nhận qua onDpUpdate / `publishDpsAwaitAck`. DP value-type là số.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1 (Prereq): `TuyaErrors` (JS) phân loại mã lỗi + helper reject chuẩn native; iOS `RCTEventEmitter` bắn được
      onDeviceStatus (regression test event cũ).
- [ ] AC2 (Đợt 1): TuyaAuth (profile/tempUnit/onSessionExpired/reset/cancel) + TuyaDevice (management+control nâng cao)
      + TuyaOta + TuyaHome.updateHome — spec/native compile; `tsc` pass; API verify trên reference.
- [ ] AC3 (Đợt 2): TuyaScene + TuyaTimer + TuyaMessage + TuyaHome weather/listener + TuyaPairing combo/auto-token.
- [ ] AC4 (Đợt 3, tùy chọn): TuyaMember + pairing nâng cao + TuyaMatter + TuyaMesh — chỉ khi xác nhận có nhu cầu/thiết bị.
- [ ] AC5: facade `Tuya` + export sub-module cập nhật; README cập nhật bảng tính năng; `tsc`/lint pass.
- [ ] AC6 (device): các luồng có-thiết-bị (OTA, scene preset nhiệt độ, timer, control await-ack) test trên thiết bị thật.

## 4. Các bước thực hiện
> Mỗi bước = 1 module, làm + review độc lập. `progress.md` tham chiếu B#. Thứ tự = ưu tiên.

### Prerequisites (làm trước Đợt 1 — chặn các bước khác)
1. **B1 — C0: `TuyaErrors` + error shape**
   - Việc: `src/errors.ts` (classify(code,domain)/isRetryable/describe từ bảng mã note error-codes) + helper reject
     `{code,message,domain}` ở Kotlin/ObjC; áp dụng dần cho các module.
   - Test: unit test classify; tsc pass.
2. **B2 — C1: iOS event infrastructure (`RCTEventEmitter`)**
   - Việc: chuyển module có event (Device/Pairing + module mới) sang RCTEventEmitter; supportedEvents; sendEventWithName.
   - Test: (Mac) onDeviceStatus bắn được — regression event đã có.

### Đợt 1 (P1 — thiết yếu)
3. **B3 — Mở rộng `TuyaAuth`** *(note: user-account)*
   - Việc: getCurrentUser/syncUserInfo, updateNickname/updateTempUnit(1|2)/updateTimeZone/updateAvatarByUrl,
     sendAccountVerifyCode/resetEmail|PhonePassword, cancelAccount, bindThirdParty/unbind/getLinked, event `onSessionExpired`.
   - Native: Android `getUserInstance()` + `setOnNeedLoginListener`; iOS `ThingSmartUser` + notification session-invalid.
   - Test: đổi tempUnit phản ánh getCurrentUser; onSessionExpired bắn khi hết phiên.
4. **B4 — Mở rộng `TuyaDevice`** *(notes: device-management, device-control)*
   - Việc: renameDevice/removeDevice/resetFactory, getDeviceDetail, getDeviceSnapshot(dps+schema+online), getWifiSignal,
     queryDp, isDeviceOnline/isCloudConnected, publishDpsWithMode, publishDpsAwaitAck, bleConnect/disconnect/isBleLocalOnline.
   - Native: Android `newDeviceInstance` + `DeviceBean.schema/dpCodes` + `getBleManager`; iOS `ThingSmartDevice` + delegate.
   - Test: snapshot trả schema; publishDpsAwaitAck resolve khi onDpUpdate khớp.
5. **B5 — `TuyaOta` (module mới)** *(note: device-management)*
   - Việc: checkFirmwareUpgrade, startFirmwareUpgrade(types), cancelFirmwareUpgrade, confirmWarningUpgrade,
     get/setAutoUpgradeSwitch; events onOtaProgress/onOtaStatusChanged/onOtaSuccess/onOtaFailure. (cần B2)
   - Native: Android `newOTAServiceInstance` + `IDevOTAListener`; iOS check/startFirmwareUpgrade + delegate progress.
   - Test: (device) progress chạy; 5005 → confirmWarningUpgrade tiếp tục.
6. **B6 — `TuyaHome.updateHome`** *(note: home-management)*
   - Việc: updateHome(name/geo/lat/lon/rooms), dismissHome.
   - Native: Android `IThingHome.updateHome/dismissHome`; iOS `updateHomeInfoWithName`/`dismissHome`.

### Đợt 2 (P2 — theo tính năng app)
7. **B7 — `TuyaScene` (module mới — LỚN)** *(note: smart-scenes)*
   - Việc: getSceneList/getSceneDetail, saveScene/modifyScene/deleteScene, executeScene, enable/disableAutomation(+WithTime),
     buildXxxCondition/buildXxxAction→JSON, helper device/city list, event onSceneChange.
   - Native: Android `getSceneServiceInstance()` + builder; iOS `ThingSmartSceneManager`/`ThingSmartScene` + factory. **Verify nặng.**
   - Test: (device) tap-to-run preset nhiệt độ + 1 automation theo lịch chạy.
8. **B8 — `TuyaTimer` (module mới)** *(note: device-control)*
   - Việc: addTimer/updateTimer/removeTimer/getTimerList/updateTimerStatus (lịch cloud).
   - Native: Android `getTimerInstance()`+`ThingTimerBuilder`; iOS `ThingSmartTimer` (bizId/bizType).
9. **B9 — `TuyaMessage` (module mới: push+message+DND)** *(notes: push-notifications, message-management)*
   - Việc: registerDevice(token,'fcm'|'apns')/unregisterDevice, get/setPushStatus(+ByType), DND CRUD,
     message getList/ByType/DetailList/markRead/delete/hasNew.
   - Native: Android `getPushInstance()`+`getMessageInstance()`; iOS `ThingSmartSDK.deviceToken`+`ThingSmartMessage`+Setting.
   - Test: token đăng ký OK; toggle push theo loại; list message phân trang.
10. **B10 — `TuyaHome` weather + listeners** *(note: home-management)* (cần B2)
    - Việc: getHomeWeatherSketch/Detail; startHomeChangeListener/startHomeStatusListener → event onHomeChange.
11. **B11 — `TuyaPairing` combo + auto-token** *(notes: bluetooth, error-codes)*
    - Việc: startBleWifiPairing (combo BLE+Wi-Fi), startPairingWithAutoToken (retry khi -55/-56/-57/-33/1004).
    - Native: Android `newMultiModeActivator`; iOS `ThingSmartBLEWifiActivator`.
    - Test: (device) combo pair thành công; auto-token retry khi token hết hạn.

### Đợt 3 (P3 — chỉ khi xác nhận có nhu cầu/thiết bị)
12. **B12 — `TuyaMember` (module mới)** *(note: home-management)* — query/add/update/remove member + invitation.
13. **B13 — `TuyaPairing` nâng cao** *(note: device-pairing)* — sub-device/gateway/QR/wired/discovery.
14. **B14 — `TuyaMatter` (module mới)** *(note: device-pairing)* — parse/connect/commission + discovery + attestation.
15. **B15 — `TuyaMesh`/beacon (module mới)** *(note: bluetooth)* — SIG/Tuya mesh + beacon. Chỉ khi có thiết bị.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **dpId/schema thật của bồn tắm đá** (power/nhiệt độ/UV/defrost/countdown) — cần thiết bị thật + productId;
  chặn AC của B4 (snapshot)/B7 (scene)/B8 (timer). → xin client product schema sớm.
- ⚠️ **2 thế hệ API song song** — phải chốt 1 bộ mỗi mảng; tên một số class/selector iOS chưa verbatim (xem "Câu hỏi mở" từng note).
- ⚠️ **iOS không công bố bảng mã lỗi số** → log `error.code` thật khi test để khớp tập số Android.
- ⚠️ **Build/test** cần JDK17 + Android SDK (Android) / Mac + Xcode (iOS) + thiết bị thật — máy hiện tại chưa có.
- ⚠️ **TuyaScene** condition/action JSON phức tạp → dùng builder native trả JSON, không model hoá trên spec TS.
- ❓ Chốt với client: app có cần member/room/transfer, scene automation, push không → quyết định làm Đợt 2/3 tới đâu.
- ❓ `TuyaMessage`: gộp push+message+DND vào 1 module (đề xuất) hay tách `TuyaPush`+`TuyaMessage`?
