# Tuya Home SDK — Toàn bộ bề mặt tính năng & kế hoạch mở rộng lib

> Tổng hợp 11 note research (2026-06-29) về CÁC tính năng Home SDK ngoài phần cơ bản đã làm,
> + đề xuất API TurboModule để bổ sung vào `@jimmy-vu/react-native-turbo-tuya`.
> Mỗi mảng có note chi tiết riêng (cited Android + iOS). Đây là bản đồ + ưu tiên.

- **Cập nhật:** 2026-06-29
- **Nguồn:** developer.tuya.com (Smart Life App SDK) + API reference (tuya.github.io). Trích dẫn đầy đủ trong từng note.
- **Bối cảnh:** app bồn tắm đá — gần như **1 thiết bị Wi-Fi/combo / 1 home / 1 user**, DP nhiệt độ dạng số.

## 1. Bản đồ tính năng → đã có / cần bổ sung

| Mảng | Note | Lib hiện tại | Đề xuất | Ưu tiên (ice-bath) |
|---|---|---|---|---|
| Init | (đã có) | ✅ `TuyaCore` | — | — |
| Auth cơ bản + session | (đã có) | ✅ `TuyaAuth` | mở rộng (dưới) | — |
| Home create/list/detail | (đã có) | ✅ `TuyaHome` | mở rộng | — |
| Pairing Wi-Fi EZ/AP + BLE | (đã có) | ✅ `TuyaPairing` | mở rộng | — |
| Device DP control + status | (đã có) | ✅ `TuyaDevice` | mở rộng | — |
| **User Account nâng cao** | [user-account](tuya-home-sdk-user-account.md) | một phần | **mở rộng `TuyaAuth`** + event onSessionExpired | **P1** |
| **Device Management** | [device-management](tuya-home-sdk-device-management.md) | ❌ | **mở rộng `TuyaDevice`** + module mới **`TuyaOta`** | **P1** (rename/remove/reset/detail/OTA) |
| **Device Control nâng cao** | [device-control](tuya-home-sdk-device-control.md) | một phần | **mở rộng `TuyaDevice`** + **`TuyaTimer`** | **P1** (queryDp/snapshot+schema/online/await-ack) · P2 (timer) |
| **Smart Scenes** | [smart-scenes](tuya-home-sdk-smart-scenes.md) | ❌ | module mới **`TuyaScene`** | **P2** (preset nhiệt độ + automation lịch) |
| **Push Notifications** | [push-notifications](tuya-home-sdk-push-notifications.md) | ❌ | module mới **`TuyaMessage`** (gộp push) | **P2** |
| **Message Management** | [message-management](tuya-home-sdk-message-management.md) | ❌ | module mới **`TuyaMessage`** (list + push + DND) | **P2** |
| **Home Management nâng cao** | [home-management](tuya-home-sdk-home-management.md) | một phần | mở rộng `TuyaHome` + module **`TuyaMember`** | **P2** updateHome/weather/listener · P3 member/room/transfer |
| **Bluetooth Series** | [bluetooth](tuya-home-sdk-bluetooth.md) | BLE đơn ✅ | mở rộng `TuyaPairing`/`TuyaDevice` (combo BLE+Wi-Fi, bleConnect, OTA) · **`TuyaMesh`** | **P2** combo+bleConnect · P3 mesh/beacon |
| **Device Pairing nâng cao** | [device-pairing](tuya-home-sdk-device-pairing.md) | EZ/AP/BLE ✅ | mở rộng `TuyaPairing` · module **`TuyaMatter`** | **P3** (sub-device/gateway/QR/wired/Matter) |
| **Error Codes + FAQ** | [error-codes](tuya-home-sdk-error-codes.md) | bảng rút gọn | module **`TuyaErrors`** (JS) + chuẩn hoá shape lỗi | **P1** (shape lỗi) |
| **Configure Widget Project** | [widget-project](tuya-home-sdk-widget-project.md) | — | **NGOÀI phạm vi** (UI/extension) — chỉ thêm `getSwitchDps` | — |

## 2. Kiến trúc lib sau khi mở rộng

**Mở rộng module hiện có:**
- **`TuyaAuth`** — getCurrentUser/syncUserInfo, updateNickname/**updateTempUnit(1=°C/2=°F)**/updateTimeZone/updateAvatarByUrl, sendAccountVerifyCode/resetEmail|PhonePassword, cancelAccount, bindThirdParty/unbind/getLinked, getLoginTerminals/terminateSession; **event `onSessionExpired`** (bridge INeedLoginListener / ThingSmartUserNotificationUserSessionInvalid).
- **`TuyaHome`** — updateHome, dismissHome, getHomeWeatherSketch/Detail, transferHomeOwner, addRoom/updateRoom/removeRoom/sortRooms, addDeviceToRoom/removeDeviceFromRoom/getDeviceRoom; **listeners** home-change + home-status (event `onHomeChange`).
- **`TuyaDevice`** — renameDevice/removeDevice/resetFactory, getDeviceDetail, **getDeviceSnapshot (dps+schema+online)**, getWifiSignal, **queryDp**, isDeviceOnline/isCloudConnected, publishDpsWithMode/WithChannels, sendCacheDps, **publishDpsAwaitAck** (resolve khi onDpUpdate khớp), bleConnect/bleDisconnect/isBleLocalOnline, getSubDeviceList, getSwitchDps.
- **`TuyaPairing`** — startSubDevicePairing/Gateway/QR/Wired/MultiMode, startDeviceDiscovery, **startBleWifiPairing (combo)**, beacon scan/pair, destroyActivator; **startPairingWithAutoToken** (tự lấy token mới khi -55/-56/-57/-33/1004 rồi retry).

**Module MỚI đề xuất:**
- **`TuyaOta`** — checkFirmwareUpgrade, startFirmwareUpgrade(types), cancelFirmwareUpgrade, confirmWarningUpgrade, get/setAutoUpgradeSwitch; events onOtaProgress/onOtaStatusChanged/onOtaSuccess/onOtaFailure. (gộp luôn BLE OTA)
- **`TuyaScene`** — getSceneList/getSceneDetail, saveScene/modifyScene/deleteScene, executeScene, enable/disableAutomation(+WithTime), **buildXxxCondition/buildXxxAction → trả JSON** (tránh model hoá condition/action phức tạp trên spec TS), helper device/city list; event onSceneChange.
- **`TuyaMessage`** (gộp message + push + DND) — getMessageList/ByType/DetailList, getMessageHasNew, markMessagesRead, deleteMessages; registerDevice(token,'fcm'|'apns')/unregisterDevice, get/setPushStatus(+ByType), DND add/modify/remove/list.
- **`TuyaTimer`** — addTimer/updateTimer/removeTimer/getTimerList/updateTimerStatus (lịch cloud, bizType device|group).
- **`TuyaErrors`** (JS thuần) — classify(code,domain)/isRetryable/describe từ bảng mã tĩnh; + **quy ước reject chuẩn** `{ code, message, domain:'sdk'|'cloud'|'network' }` cho MỌI module (đừng nuốt code về -1).
- **`TuyaMatter`** (P3) — parse/connect/commission + discovery + attestation. Chỉ khi có thiết bị Matter.
- **`TuyaMesh`** (P3) — SIG/Tuya mesh: create/startClient/search/active/publish/multicast. Chỉ khi có thiết bị mesh.
- **`TuyaMember`** (P3) — query/add/update/remove member + invitation. Chỉ khi cần chia sẻ nhà.
- (P3, có thể bỏ) `TuyaGroup`, `TuyaMultiControl`, `TuyaCommon` (country/timezone) — ít hợp mô hình 1 thiết bị.

## 3. Khuyến nghị triển khai theo đợt

- **Đợt 1 (P1 — thiết yếu UX):** mở rộng `TuyaAuth` (profile + tempUnit + onSessionExpired + reset/cancel) · mở rộng `TuyaDevice` (rename/remove/reset/detail/snapshot+schema/online/queryDp/publishDpsAwaitAck) · module `TuyaOta` · `TuyaHome.updateHome` · `TuyaErrors` + chuẩn shape lỗi.
- **Đợt 2 (P2 — theo tính năng app):** `TuyaScene` (preset + automation) · `TuyaTimer` · `TuyaMessage` (push/notification) · `TuyaHome` weather+listener · `TuyaPairing` combo BLE+Wi-Fi + auto-token.
- **Đợt 3 (P3 — chỉ khi xác nhận có nhu cầu/thiết bị):** members/rooms/transfer · sub-device/gateway/QR/wired · Matter · mesh/beacon · group/multi-control.
- **Ngoài phạm vi:** Widget (UI/extension OS — không có JS runtime; chỉ reuse publishDps + getSwitchDps).

## 4. Điểm CHUNG cần xác minh khi implement (mọi mảng)

- **Hai thế hệ API song song** ở nhiều mảng (Pairing/BLE/Scene/Member): legacy (`ThingHomeSdk.getXxxInstance` / iOS singleton+delegate) vs unified/Biz (`ActivatorService` / CoreKit / Biz). → Chốt 1 bộ khi code, verify chữ ký trên `tuya.github.io` API reference + header iOS.
- **iOS không công bố bảng mã lỗi số** — trả `NSError`; cần log `error.code` thật khi test để khớp tập số Android.
- **DP value-type là số**; `publishDps.onSuccess` = "đã gửi" → dùng `publishDpsAwaitAck` / nghe onDpUpdate để xác nhận thật.
- **dpId/schema thực tế của bồn tắm đá** (nhiệt độ hiện tại/mục tiêu/power/UV/defrost/countdown) — phải đọc từ thiết bị thật + productId (chặn nhiều mảng: control/scene/timer/widget).
- **Quyền runtime**: BLE (SCAN/CONNECT/FINE_LOCATION), geofence (background location) — app side xin trước khi gọi.

## 5. Liên kết note chi tiết
- [User Account](tuya-home-sdk-user-account.md) · [Home Management](tuya-home-sdk-home-management.md) · [Device Pairing](tuya-home-sdk-device-pairing.md) · [Bluetooth](tuya-home-sdk-bluetooth.md) · [Device Management](tuya-home-sdk-device-management.md)
- [Device Control](tuya-home-sdk-device-control.md) · [Smart Scenes](tuya-home-sdk-smart-scenes.md) · [Push Notifications](tuya-home-sdk-push-notifications.md) · [Message Management](tuya-home-sdk-message-management.md) · [Widget Project](tuya-home-sdk-widget-project.md) · [Error Codes](tuya-home-sdk-error-codes.md)
- Nền tảng (đã có): [tuya-m1-sdk-foundation.md](tuya-m1-sdk-foundation.md)
