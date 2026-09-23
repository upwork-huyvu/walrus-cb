# Context: Chu trình vệ sinh thật (Run clean cycle + lịch)

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.

- **Slug:** `m1-clean-cycle`

## Quyết định kỹ thuật (Decision log)

- **2026-09-23** - Lệnh TẮT giao cho **timer cloud của Tuya**, không phải `setTimeout` trong app. Lý do: iOS
  treo app vài giây sau khi ra nền và kill hẳn khi hết bộ nhớ ⇒ hẹn tắt bằng JS sẽ không bao giờ chạy ⇒ ozone
  chạy vô hạn (lỗi nguy hiểm nhất của tính năng này). Đã cân nhắc & loại: (a) `setTimeout` trong app;
  (b) scene tap-to-run có action delay - cloud chạy được nhưng **không huỷ giữa chừng được**, mà Stop là yêu cầu
  thật; (c) cron ở backend Vercel + Tuya Cloud OpenAPI - thêm một chặng phụ thuộc + phải tự xác thực quyền sở hữu
  thiết bị, trong khi SDK đã có timer per-device.
- **2026-09-23** - Thao tác timer theo **task name** (`walrus_clean_once`, `walrus_clean_sched`), không theo
  timerId. Lý do: iOS chỉ xoá được theo task (`removeTimerWithTask`, bridge đã wire) còn Android xoá theo
  timerId (phải list trước, mà `getTimerList` Android chưa wire) ⇒ task name là mẫu số chung, đỡ phải lưu id.
- **2026-09-23** - Thứ tự **hẹn tắt trước, bật sau**. Tạo timer lỗi thì không bật. Lý do: bật trước mà hẹn tắt
  lỗi mạng = ozone chạy mãi; ngược lại (có timer mà chưa bật) chỉ là một lệnh tắt thừa, vô hại.
- **2026-09-23** - Giữ nút lá (DP 122) nguyên nghĩa bật/tắt tay. Chu trình là lớp trên, không đổi hành vi cũ.
- **2026-09-23 (B6)** - Đặt lịch chuyển sang **bottom-sheet riêng** (`CleanScheduleSheet`) với **bánh xe
  HH:mm** kiểu Smart Life, thay vì editor nhúng trong card. Lý do: (a) bánh xe là ScrollView dọc, nhét vào
  ScrollView dọc của Device Detail thì Android tranh cử chỉ; (b) editor cũ **giấu khối giờ** cho tới khi chọn
  DAILY/WEEKLY nên nhìn như không có chỗ chọn giờ - đúng cái chủ dự án phàn nàn. Bỏ luôn 3 chip OFF/DAILY/WEEKLY:
  REPEAT = "EVERY DAY" + 7 chip thứ, còn tắt lịch là hành động riêng ("Turn schedule off").

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `packages/tuya-react-native/ios/Timer/TuyaTimer.mm` | Bridge iOS: `addTimer` (B1), `getTimerList`, `removeTimer` theo task |
| `packages/tuya-react-native/android/.../timer/TuyaTimerModule.kt` | Bridge Android: `addTimer` ✓, `getTimerList` ❌ (B2) |
| `packages/tuya-react-native/src/specs/NativeTuyaTimer.ts` | Hợp đồng JS của timer (inputJson, TimerItem) |
| `apps/mobile/src/services/cleanCycle.ts` | Service chu trình + lịch (B3) |
| `apps/mobile/src/components/CleaningPanel.tsx` | Card CLEANING: tóm tắt lịch + Run/Stop (B4) |
| `apps/mobile/src/components/CleanScheduleSheet.tsx` | Sheet đặt lịch: bánh xe HH:mm + thứ + độ dài (B6) |
| `apps/mobile/src/services/tuya.ts` | `setPurify` (DP 122) - dùng lại cho bật/tắt |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **`loops` bắt đầu từ CHỦ NHẬT - đã xác minh bằng doc (2026-09-23).** Hai trang doc nói nguyên văn *"The
  digits represent Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, and Saturday sequentially from left
  to right"* ([Scheduled Tasks](https://developer.tuya.com/en/docs/app-development/timer?id=Ka5srtq1mj67w),
  [Device Schedule](https://developer.tuya.com/en/docs/app-development/extension-device-timer?id=Kcy2vuod948de))
  ⇒ `loopsFrom` (index 0 = CN, khớp `Date.getDay()`) đúng; comment "T2..CN" trong `NativeTuyaTimer.ts` là SAI,
  đã sửa. Cùng nguồn: `time` **chính xác tới phút** ("18:00"), `status` = bật/tắt timer **không cần xoá**,
  `isAppPush` = bắn push khi timer chạy, **tối đa 30 timer/thiết bị**, `updateType` 0=tắt/1=bật/2=xoá.
- **Giới hạn phút :00/:30 là do UI cũ tự đặt**, không phải ràng buộc của Tuya - bánh xe mới cho chọn mọi phút.
- **Chưa dùng `status`/`isAppPush`:** tắt lịch hiện tại = **xoá cả task**. Bridge cho `op:'close'` **đã đủ cả 2
  nền tảng** (B7) nên đổi được bất cứ lúc nào, nhưng phải kèm: `CleanSchedule` mang thêm cờ `enabled`,
  `readCleanSchedule` đọc `t.status` (hiện đang bỏ qua ⇒ lịch đã tắt vẫn hiện như đang bật) và UI phân biệt
  On/Off. Tức là một bước riêng, không phải chỉ đổi lời gọi. Push khi chu trình chạy cũng chỉ là bật cờ `appPush` trong
  `timerInput` - để dành, chờ chủ dự án quyết có muốn thông báo không.
- **Bồn không có DP chu trình.** Bảng thuộc tính g0cv1c chỉ có `setting_clr` (122, bool). Mọi khái niệm
  "cycle / staged cleaning" phải do app + timer cloud dựng nên.
- **Bridge timer giờ ĐỦ CẢ 5 HÀM trên cả 2 nền tảng** (B7, 2026-09-23): iOS wire nốt `updateTimer` +
  `updateTimerStatus` (trước là stub `TuyaTODO`). Chữ ký lấy verbatim từ **header SDK trong Pods**
  (`apps/mobile/ios/Pods/ThingSmartTimerKit/Build/ThingSmartTimerKit.xcframework/ios-arm64/…/Headers/ThingSmartTimer.h`)
  - đây là nguồn chuẩn nhất, đúng bản SDK dự án đang dùng, hơn cả trang doc:
  - `updateTimerWithTimerId:loops:bizId:bizType:time:dps:status:isAppPush:aliasName:success:failure:`
  - `updateTimerStatusWithTimerIds:bizId:bizType:updateType:(int)…` (có id) và
    `updateTimerTaskStatusWithTask:bizId:bizType:updateType:(NSUInteger)…` (rỗng = cả task, khớp
    `updateCategoryTimerStatus` của Android) ⇒ hợp đồng "timerIds rỗng = cả task" giữ nguyên.
  - `updateType`: **0 = tắt, 1 = bật, 2 = xoá** ⇔ JS `close` / `open` / `delete`. Op lạ → DELETE (như Android).
  - ⚠️ Còn một chỗ lệch có chủ ý: `removeTimer` trên iOS **bỏ qua `timerIds`** (luôn xoá cả task); Android
    xoá đúng id nếu có. JS hiện chỉ gọi dạng cả-task nên chưa lộ.
  - Header SDK cũng xác nhận lần thứ ba thứ tự `loops`: *"Sunday, Monday, … Saturday"*, ví dụ nguyên văn
    *"`0100000` means every Monday"*.
- (lịch sử) Bridge từng lệch nhau: iOS thiếu `addTimer`, Android thiếu `getTimerList`. Đây là lý do JS đi
  theo task name - vẫn giữ vì nó không phụ thuộc timerId.
- **Timer Tuya chỉ lặp theo tuần** (`loops` 7 ký tự) ⇒ "every X days" trong design cũ không biểu diễn được.
- **`time` chỉ tới phút** ⇒ "bây giờ + N phút" phải làm tròn lên phút, sai số ±1 phút là chấp nhận được.
- Giới hạn **30 timer/thiết bị** - dùng task riêng + xoá trước khi tạo lại nên không đụng trần.

- **Android đã wire đủ (2026-09-23, B2)** - chữ ký lấy bằng `javap` trên `thingsmart:7.5.6` (giải nén
  `classes.jar` của mọi aar trong `~/.gradle/caches/modules-2` rồi `javap -classpath`):
  - **`actions` của `ThingTimerBuilder` = `[{"time":"HH:mm","dps":{"<dpId>":<value>}}]`** (trước đây là
    best-guess). Căn cứ: bean nội bộ `com.thingclips.sdk.timer.bean.DpTimerPointBean { String time;
    JSONObject dps; }` + API cũ `IThingTimer.addTimerWithTask(task, devId, time, Map<String,Object> dps, …)`.
  - `IThingCommonTimer` có **`updateCategoryTimerStatus(task, devId, type, op, cb)`** ⇒ xoá/bật-tắt theo CẢ
    TASK, đúng cái iOS làm được ⇒ hợp đồng "timerIds rỗng = cả task" hiện thực được ở cả hai nền tảng.
  - `TimerTask.getTimerList()` → `ArrayList<Timer>`; `Timer{timerId, time, loops, status, dpId, value,
    remark, date}`. Android trả **dpId + value RỜI** (value là chuỗi "true"/"false"/"40"), iOS trả sẵn `dps`
    ⇒ bridge Android tự dựng lại `{dpId: value}` và ép kiểu (bool/số) cho khớp.
  - `Timer.dpId`/`value` bị SDK đánh **@Deprecated mà không có field thay thế** trong bean ⇒ giữ nguyên +
    `@Suppress("DEPRECATION")`; timer của app luôn chỉ mang 1 DP nên không mất dữ liệu.
  - ⚠️ Vẫn là suy luận từ bean, **chưa chạy thật**: lần test đầu trên máy Android phải xem timer có vào
    Smart Life không.
- **`bizType` trên iOS từng sai** với group: `removeTimer`/`getTimerList` map bằng `bizType.integerValue` nên
  `"group"` ra 0 (= device). Đã thay bằng `TuyaBizType()`. Dự án chỉ dùng device nên chưa lộ.
- **Mặc định 30 phút/chu trình** (`DEFAULT_CLEAN_MINUTES`) là **số tạm** - chờ khách xác nhận chu trình thật của
  máy rồi chỉnh; UI cho chọn 15/30/60.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research: [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md) ·
  [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md)
- Feature liên quan: [m1-fix-ios-target-temp](../m1-fix-ios-target-temp/progress.md) (gom chung build iOS)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<2-4 câu: feature làm được gì, còn nợ gì, cần theo dõi gì về sau.>
