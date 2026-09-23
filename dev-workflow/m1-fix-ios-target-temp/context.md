# Context: Sửa lỗi không đổi được nhiệt độ mục tiêu trên iOS

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-fix-ios-target-temp`

## Quyết định kỹ thuật (Decision log)

- **2026-09-22** - Sửa ở CẢ native iOS lẫn JS. Native: viết thật `publishDpsAwaitAck` (mirror Android) để 2
  nền tảng cùng ngữ nghĩa "resolve khi thiết bị xác nhận". JS: nếu native reject `ios_todo`/`not_implemented`
  thì lùi về `publishDps` - chốt chặn cho mọi stub sau này. Lý do: bug gốc là JS coi "hàm tồn tại" = "đã
  implement" (`typeof === 'function'` luôn đúng với TurboModule, kể cả stub). Đã loại: (a) chỉ sửa JS dùng
  `publishDps` + chờ echo ở JS - vẫn phải build lại app mà để lib hứa một API không chạy trên iOS;
  (b) iOS dùng lại delegate của listener bền - phức tạp, phụ thuộc Dashboard đã register chưa.
- **2026-09-22** - iOS chờ ack trên instance `ThingSmartDevice` RIÊNG + đối tượng waiter làm delegate. Lý do:
  `delegate` là weak; mỗi instance tự nghe notification DP (xem Findings) nên không đụng listener bền.
  Mọi nhánh settle (ack / publish lỗi / timeout) chạy trên main queue ⇒ cờ `settled` không cần lock.
- **2026-09-22** - Gate ① coi như ĐÃ DUYỆT: user trả lời "ok, đồng ý, sửa theo ý mày đi" sau khi xem chẩn đoán
  + hướng sửa trong chat ⇒ làm PLAN → DEV → TEST liền trong một lượt.
- **2026-09-22** - Giữ nguyên chiến lược ghi CHỈ word0 (S1 °C). Không tự ghi word1 (S1 °F) khi chưa thấy echo
  thật - payload hiện tại word1 = 40 trùng số với °C, chưa biết MCU xử lý thế nào (AC7).
- **2026-09-22** - B3 sửa cả LOGIC dự phòng của `readRawTempRange` (mobile) / `readTempRange` (backend), không chỉ
  comment: bước nhảy 4 word/sensor, chỉ đọc cặp °C. Lý do: để comment đúng spec mà code vẫn quét theo layout cũ thì
  mâu thuẫn; nhánh dự phòng cũ lấy nhầm cặp °F của sensor 1 làm "sensor 2 °C". Bồn thật cho kết quả y hệt
  (2.0–15.0 °C) vì cặp °C của sensor 1 luôn có ⇒ không đổi hành vi với khách.
- **2026-09-22** - Test adapter tính message lỗi kỳ vọng qua chính `describeTuyaError` thay vì hardcode: phiên song
  song `m1-fix-device-connect-error` đang đổi bảng message (`LITERAL`), hardcode sẽ vỡ theo mỗi lần họ sửa câu chữ.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `packages/tuya-react-native/ios/Device/TuyaDevice.mm` | Bridge iOS: `publishDps`, `publishDpsAwaitAck` (B1), listener `onDeviceStatus` |
| `packages/tuya-react-native/android/.../device/TuyaDeviceModule.kt` | Bản Android `publishDpsAwaitAck` (mẫu để mirror) |
| `apps/mobile/src/services/tuya.ts` | Adapter: `setTargetTemp` → `publishAwaitingAck` + fallback (B2) |
| `apps/mobile/src/services/tuya.targetTemp.test.ts` | Test adapter: payload DP 115, fallback `ios_todo`/`not_implemented`, lỗi thật vẫn revert |
| `apps/mobile/src/services/dp.ts` | Codec DP (hex): `buildTempDps`, `readRawTempRange` (B3) |
| `apps/backend/src/devices/device-dp.ts` | Codec DP phía Cloud (base64) cho admin: `readTempRange` (B3) |
| `apps/mobile/src/state/useAppState.ts` + `state/deviceMachine.ts` | Optimistic target → `ackResolved`/`ackTimeout` (revert) |
| `docs/research/tuya-icebath-dp-mapping.md` | Nguồn giải mã DP của bồn g0cv1c (sửa layout ở B3) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **Chuỗi lỗi trên iOS (trước fix):** `+`/`−` → `setTargetOptimistic` → debounce 400ms →
  `tuya.ts#setTargetTemp` → `publishDpsAwaitAck` (iOS = `TuyaTODO`, reject `ios_todo`, KHÔNG publish) →
  `{ok:false}` → `ackTimeout` → target về số cũ + banner "Unknown error." (`ios_todo` không có trong bảng mã
  của `errors.ts` ⇒ category `unknown`). Khớp nguyên văn feedback khách.
- **Android không lộ lỗi** vì `TuyaDeviceModule.kt#publishDpsAwaitAck` có code thật - máy test của dev là
  Android nên bug chỉ thấy khi khách chạy iPhone.
- **SDK iOS:** `@property (weak) id<ThingSmartDeviceDelegate> delegate` - không giữ strong thì waiter chết
  ngay, không bao giờ nhận ack. `device:dpsUpdate:dpsTime:` nếu được implement sẽ CHẶN `device:dpsUpdate:`
  (ghi chú trong header) ⇒ waiter chỉ implement `device:dpsUpdate:`.
- **Mỗi `ThingSmartDevice` tự observe DP update:** binary `ThingSmartDeviceCoreKit` có
  `-[ThingSmartDevice deviceDpsUpdate:]` (handler 1 tham số = NSNotification), `kNotificationDeviceDpsUpdate`,
  `-[ThingSmartDevice dealloc]` + ivar `_shouldRemoveNotifications` ⇒ nhiều instance cùng devId đều nhận update.
- **Layout DP 114/115 bị đọc sai trong comment/doc cũ** (mapping + word0 vẫn đúng): spec chi tiết (property
  JSON khách gửi 2026-09-22) xếp XEN KẼ theo sensor - 115 = `[S1 °C, S1 °F, S2 °C, S2 °F, …]`,
  114 = `[S1 °C trên, S1 °C dưới, S1 °F trên, S1 °F dưới, S2 …]`. Doc cũ ghi "4 word °C rồi 4 word °F".
  Payload thật `115 = 0028 0028 ffff…` ⇒ S1 °C = 4.0, **word1 = S1 °F** (đang = 40, trùng số °C), S2–S4 ẩn.
- **Compile-check native chạy được dù repo nằm trong iCloud:** build riêng scheme pod `TurboTuya` cho simulator,
  `CODE_SIGNING_ALLOWED=NO`, DerivedData để ngoài repo (scratchpad) ⇒ không đụng bước codesign/embed hỏng vì
  iCloud. Lần đầu có thể fail ở `ReactCodegen` ("Build input file cannot be found … -generated.mm") do script
  codegen sinh file song song với bước compile - chạy lại lần 2 là qua.
- **Làm song song với `m1-fix-device-connect-error`** (phiên khác, cùng ngày): họ sửa `tuyaError.ts` (bảng `LITERAL`
  cho mã phi-số, `extractCode` thôi cào số dương), `tuya.ts#withTimeout` (`timeoutError` có `code: 'timeout'`),
  `home.ts`, sắp tới `useAppState`/`DashboardScreen`/`deviceMachine`. Feature này chỉ đụng `tuya.ts#setTargetTemp`
  (+ helper ngay trên) ⇒ không chồng vùng sửa. `LITERAL` của họ đã có `ios_todo`/`not_implemented`/`ack_timeout`
  ⇒ lỗi hiện ra giờ có câu tiếng Anh thay vì "Unknown error.". Commit phải TÁCH theo feature.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md),
  [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)
- Báo cáo audit liên quan: -

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<2-4 câu: feature làm được gì, còn nợ gì, cần theo dõi gì về sau.>
