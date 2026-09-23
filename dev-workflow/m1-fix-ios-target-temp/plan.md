# Kế hoạch: Sửa lỗi không đổi được nhiệt độ mục tiêu trên iOS

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-fix-ios-target-temp`
- **Milestone:** M1 · B (mobile) + A (lib native `@jimmy-vu/react-native-turbo-tuya`)
- **Phần liên quan:** mobile + lib native iOS (backend: chỉ codec layout DP 114)
- **Ngày tạo:** 2026-09-22
- **Cập nhật lần cuối:** 2026-09-22

## 1. Mục tiêu & phạm vi
Khách test trên **iPhone** (feedback 2026-09-22): nguồn / đèn / khử trùng (nút lá) chạy, đọc nhiệt độ
nước đúng, nhưng **không đổi được nhiệt độ mục tiêu** - bấm +/- xong số nhảy về. Nguyên nhân (đã truy
vết): `tuya.ts#setTargetTemp` gọi `publishDpsAwaitAck`, mà trên iOS hàm này chỉ là stub `TuyaTODO` →
reject `ios_todo` ngay, **không gửi lệnh nào** → reducer `ackTimeout` revert + banner "Unknown error.".
Công tắc chạy được vì chúng đi `publishDps` thường (iOS đã wire).

Mục tiêu: lệnh đặt nhiệt độ tới được bồn trên iOS, có xác nhận (ack) giống Android; JS không bao giờ để
một method native chưa wire chặn lệnh âm thầm nữa. Kèm theo: sửa mô tả layout DP 114/115 cho đúng
spec Tuya khách vừa gửi (mapping DP vẫn đúng, chỉ phần giải thích layout bị đọc sai).

**Ngoài phạm vi (không làm trong feature này):**
- Nút "Run clean cycle now" + lịch vệ sinh: máy **không có DP chu trình**, chỉ có `setting_clr` (bool) -
  chờ khách/hãng trả lời chu trình là gì (feature riêng).
- Ghi thêm word1 (S1 °F) khi đặt nhiệt độ - chờ quan sát echo thật (AC7) rồi mới quyết.
- Các stub iOS khác (`queryDp`, BLE, `sendCacheDps`…) - màn điều khiển không dùng.

## 2. Bối cảnh & ràng buộc
- **Mapping DP đã đúng** (đối chiếu bảng thuộc tính model g0cv1c khách gửi 2026-09-22): 115
  `setting_temp` (raw) · 114 `setting_temp_range` (raw) · 101 `sensor_1` · 121 `setting_pwr` · 122
  `setting_clr` · 124 `setting_4`. Lỗi nằm ở bridge, không ở map.
- `publishDps` success chỉ = "đã gửi"; xác nhận thật = `dpsUpdate` (docs Tuya, đã ghi ở research).
- `ThingSmartDevice.delegate` là **weak** (header `ThingSmartDevice.h` trong Pods) ⇒ phải tự giữ
  instance + delegate sống tới khi có ack.
- Mỗi `ThingSmartDevice` tự observe notification DP của SDK (binary `ThingSmartDeviceCoreKit` có
  `-[ThingSmartDevice deviceDpsUpdate:]`, `kNotificationDeviceDpsUpdate`, ivar `_shouldRemoveNotifications`)
  ⇒ tạo instance RIÊNG để chờ ack vẫn nhận update mà không đè delegate của listener bền - y như Android
  dùng `newDeviceInstance` riêng.
- Repo nằm trong `~/Documents` (iCloud) ⇒ build iOS local hỏng ở bước codesign; compile-check native có
  thể phải làm kiểu syntax-only, build TestFlight làm ở đường dẫn ngoài iCloud.
- **Link nghiên cứu liên quan:** [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md),
  [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] AC1: (iPhone thật) bấm +/- ở Device Detail → số mới giữ nguyên, **không** còn banner "Unknown error.";
  mặt máy / Smart Life thấy nhiệt độ mục tiêu mới.
- [ ] AC2: iOS `publishDpsAwaitAck` resolve khi `dpsUpdate` chứa dpId vừa gửi; quá timeout (mặc định
  8000ms như Android) → reject `ack_timeout`; publish lỗi → reject `publish_dps_error` kèm message SDK.
- [ ] AC3: JS `setTargetTemp`: native reject `ios_todo` / `not_implemented` → tự gửi lại bằng
  `publishDps` (thành công khi publish ok); lỗi khác (`ack_timeout`, offline…) giữ hành vi cũ
  `{ok:false}` → UI revert + hiện lỗi. Có unit test.
- [ ] AC4: Payload DP 115 chỉ đổi word0, giữ nguyên mọi word khác (test cũ vẫn xanh + test adapter mới).
- [ ] AC5: Comment `dp.ts` / backend `device-dp.ts` + research doc mô tả đúng layout theo spec (xen kẽ theo
  sensor: 114 = `[°C trên, °C dưới, °F trên, °F dưới] × 4`; 115 = `[°C, °F] × 4`);
  `readRawTempRange` (mobile) / `readTempRange` (backend) **không bao giờ** lấy cặp °F làm biên °C. Có unit test.
- [ ] AC6: mobile `tsc` 0 lỗi · `eslint` 0 lỗi · `jest` xanh; backend `jest` (device-dp) xanh.
- [ ] AC7: (iPhone thật) sau lần ghi đầu, đọc lại DP 115 (qua Tuya Cloud status - log `[DP]` chỉ có ở bản dev,
  TestFlight không in) → ghi vào context: word1 (S1 °F) được MCU tự cập nhật hay giữ nguyên.

## 4. Các bước thực hiện
1. **B1 - iOS native `publishDpsAwaitAck`**
   - Việc cần làm: thay stub `TuyaTODO` bằng bản thật mirror Android: instance `ThingSmartDevice` riêng +
     waiter (delegate) một-lần, khớp dpId, timeout, gỡ delegate khi xong; mọi nhánh settle trên main queue.
   - File/Module: `packages/tuya-react-native/ios/Device/TuyaDevice.mm`
   - Cách kiểm thử: compile-check Obj-C (xcodebuild simulator hoặc clang syntax-only) + checklist máy thật
     (AC1, AC2, AC7).
2. **B2 - JS fallback khi native chưa wire**
   - Việc cần làm: `setTargetTemp` → helper `publishAwaitingAck`: native reject `ios_todo`/`not_implemented`
     → `publishDps`; log dev khi phải fallback.
   - File/Module: `apps/mobile/src/services/tuya.ts`, test mới `apps/mobile/src/services/tuya.targetTemp.test.ts`
   - Cách kiểm thử: jest + tsc + eslint.
3. **B3 - Sửa layout DP 114/115 theo spec**
   - Việc cần làm: sửa comment + `readRawTempRange` (mobile) & `readTempRange` (backend) đi theo 4 word/sensor;
     cập nhật test; sửa research doc (mục giải mã 114/115 + câu hỏi mở Q2/Q3).
   - File/Module: `apps/mobile/src/services/dp.ts`, `dp.test.ts`, `deviceSchema.test.ts`;
     `apps/backend/src/devices/device-dp.ts`, `device-dp.spec.ts`; `docs/research/tuya-icebath-dp-mapping.md`
   - Cách kiểm thử: jest mobile + backend (bồn thật cho kết quả y như cũ: 2.0–15.0 °C).
4. **B4 - Verify trên iPhone của khách (TestFlight)**
   - Việc cần làm: build iOS mới (có đụng native) ở đường dẫn ngoài iCloud → gửi khách checklist AC1/AC7.
   - Cách kiểm thử: manual checklist ⏳.

## 5. Rủi ro & câu hỏi mở
- ⚠️ MCU không echo DP 115 sau khi ghi → cả iOS lẫn Android timeout 8s → UI revert + báo lỗi dù bồn có
  thể đã đổi. Giảm thiểu: listener bền vẫn nhận echo muộn và cập nhật target; nếu gặp thật thì `/fix-plan`
  (coi publish-ok là đủ).
- ⚠️ Ghi word0 mà giữ word1 (S1 °F) cũ: chưa rõ MCU chấp nhận / tự đồng bộ không → AC7 quan sát.
- ⚠️ Bấm + ở biên trên / − ở biên dưới → gửi lại đúng giá trị cũ; nếu SDK/MCU không echo giá trị không đổi
  thì timeout → quan sát khi test máy thật.
- ❓ Build iOS local vướng iCloud (codesign) → B4 cần build ở máy/đường dẫn ngoài iCloud.
