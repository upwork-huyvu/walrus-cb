# Kế hoạch: Chu trình vệ sinh thật (Run clean cycle + lịch) qua Tuya timer

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-clean-cycle`
- **Milestone:** M1 · B (mobile) + A (lib native)
- **Phần liên quan:** mobile + lib native (iOS trước, Android sau)
- **Ngày tạo:** 2026-09-23
- **Cập nhật lần cuối:** 2026-09-23

## 1. Mục tiêu & phạm vi
Khách báo (2026-09-22): nút **"Run clean cycle now"** không làm gì - đúng, vì card CLEANING xưa nay chỉ là
UI (đếm lùi 30s giả, `CleaningPanel.tsx`). Bồn **không có DP chu trình**, chỉ có `setting_clr` (DP 122,
bool "Disinfection") - chính là nút lá. Nên "chu trình" = **bật `setting_clr`, N phút sau tắt**.

Điểm cốt tử: **lệnh tắt KHÔNG được do app hẹn** (iOS treo app vài giây sau khi ra nền, app bị kill thì
không chạy gì) ⇒ tắt phải do **timer trên Tuya cloud**, chạy độc lập với điện thoại. Mục tiêu: "Run clean
cycle now" và lịch vệ sinh điều khiển bồn thật, trạng thái hiển thị theo DP 122 thật, và **không bao giờ
có trạng thái "đã bật mà không có hẹn tắt"**.

**Ngoài phạm vi:**
- Đổi nghĩa nút lá (vẫn là bật/tắt thủ công).
- Chu trình nhiều giai đoạn (bơm → ozone → xả…): bồn không expose DP nào cho việc đó.
- "Every X days": timer Tuya chỉ lặp theo **thứ trong tuần** ⇒ đổi sang chọn thứ (đã báo khách).

## 2. Bối cảnh & ràng buộc
- `ThingSmartTimer` (iOS) có đủ thứ cần: `addTimerWithTask:loops:bizId:bizType:time:dps:status:isAppPush:aliasName:`,
  `getTimerListWithTask:`, `removeTimerWithTask:`, `removeTimerWithTimerId:`. **Tối đa 30 timer/thiết bị**,
  `time` = `"HH:mm"` (chính xác tới phút), `loops` = 7 ký tự (`"0000000"` = chạy một lần).
- **Trạng thái bridge hiện tại (quyết định thiết kế):**
  | | iOS | Android |
  |---|---|---|
  | `addTimer` | ❌ stub `TuyaTODO` → **B1 wire** | ✅ (format `actions` "best-guess", chưa verify) |
  | `getTimerList` | ✅ | ❌ `not_implemented` → B2 |
  | `removeTimer` | ✅ theo **task** (bỏ qua timerIds) | ✅ theo **timerIds** (cần list trước) |
  ⇒ JS phải thao tác theo **task name**, không theo timerId (mẫu số chung của 2 nền tảng).
- Khách dùng **iPhone** ⇒ iOS là đường phải chạy được; Android làm sau, JS phải chịu được khi API timer
  chưa wire (báo lỗi rõ, không crash card).
- `dps` của timer dùng **dpId** như `publishDps`: `{"122": false}`.
- Múi giờ: timer chạy theo giờ thiết bị (`timezoneId` của bồn = Europe/Madrid). Cần verify khi test thật.
- **Link nghiên cứu:** [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)
  (mục 6 - timer, verbatim header iOS + Android), [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md) (DP 122).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: Bấm "Run clean cycle now" (iPhone, bồn thật) → bồn bật khử trùng, app hiện "Cleaning… until HH:mm"
  lấy từ DP 122 thật + giờ hẹn tắt.
- [ ] AC2: **Tắt app / khoá máy / kill app** → tới giờ bồn **vẫn tự tắt** (timer cloud chạy, không phụ thuộc app).
- [ ] AC3: Thứ tự an toàn: tạo hẹn tắt TRƯỚC, bật sau. Tạo timer lỗi ⇒ **không bật** + báo lỗi (unit test).
- [ ] AC4: "Stop" giữa chừng → xoá timer hẹn tắt **và** tắt DP 122 (không để timer mồ côi tắt nhầm lần bật tay sau).
- [ ] AC5: Lịch Daily / chọn thứ → đúng 2 timer lặp (bật HH:mm, tắt HH:mm + N) trong task lịch; sửa lịch =
  xoá task cũ rồi tạo lại; tắt lịch = xoá task.
- [ ] AC6: Lưới an toàn: mở lại app thấy DP 122 đang bật mà chu trình đã quá giờ (không còn timer) → app gửi tắt.
- [ ] AC7: Native iOS `addTimer` resolve/reject đúng (lỗi SDK giữ nguyên message), compile sạch.
- [ ] AC8: tsc 0 · eslint 0 lỗi · jest xanh (test cho phần thuần: giờ tắt, loops, payload, thứ tự gọi).

## 4. Các bước thực hiện
1. **B1 - iOS native `addTimer`**
   - Việc: thay stub bằng `addTimerWithTask:loops:bizId:bizType:time:dps:status:isAppPush:aliasName:`,
     parse `inputJson` như spec đã khai; giữ nguyên `getTimerList`/`removeTimer`.
   - File: `packages/tuya-react-native/ios/Timer/TuyaTimer.mm`
   - Kiểm thử: build pod `TurboTuya` cho simulator (như `m1-fix-ios-target-temp`).
2. **B2 - Android cho đủ đôi (best effort)**
   - Việc: wire `getTimerList` (map bean `TimerTask`) + xoá theo task (`updateCategoryTimerStatus`) để
     2 nền tảng cùng hợp đồng; verify format `actions` của `ThingTimerBuilder`.
   - File: `packages/tuya-react-native/android/.../timer/TuyaTimerModule.kt`
   - Kiểm thử: `compileDebugKotlin` + test trên máy Android của dev (không chặn iOS).
3. **B3 - Service `services/cleanCycle.ts`**
   - Việc: task name cố định (`walrus_clean_once` / `walrus_clean_sched`); `startCleanCycle` (hẹn tắt
     trước → bật sau), `stopCleanCycle`, `readCleanCycle`, `setCleanSchedule`, `readCleanSchedule`,
     `reconcileCleanCycle` (lưới an toàn AC6, mốc kết thúc lưu local); nhánh mock khi native vắng.
   - File: `apps/mobile/src/services/cleanCycle.ts` (+ `cleanCycle.test.ts`)
   - Kiểm thử: jest (giờ tắt, loops, payload, thứ tự gọi, ca lỗi) + tsc + eslint.
4. **B4 - Nối `CleaningPanel` vào service**
   - Việc: bỏ đếm lùi giả; trạng thái theo DP 122 + giờ hẹn tắt; nút Run/Stop; chọn thời lượng
     (15/30/60 phút, mặc định 30 - chốt lại theo trả lời của khách); editor lịch Daily/chọn thứ; hiện lỗi thật.
   - File: `apps/mobile/src/components/CleaningPanel.tsx`, `screens/DashboardScreen.tsx` (truyền devId/purifyOn)
   - Kiểm thử: jest component (nếu hợp lý) + tsc/eslint; còn lại là test máy thật.
5. **B5 - Verify máy thật (iPhone khách)**
   - Việc: build iOS (gom chung với `m1-fix-ios-target-temp`) → checklist AC1/AC2/AC4/AC6.
   - Kiểm thử: manual ⏳.

## 5. Rủi ro & câu hỏi mở
- ❓ **Chờ khách trả lời 3 câu** (đã gửi): (1) bật nút lá thì bồn có TỰ tắt sau một lúc không, bao lâu?
  (2) một chu trình nên dài bao lâu, có cho chọn không? (3) có phải chặn khi đang ngâm / khi tắt nguồn không?
  → Chỉ ảnh hưởng **mặc định + copy**, không ảnh hưởng kiến trúc ⇒ code trước, chốt số sau.
- ⚠️ Nếu firmware tự chạy chu trình dài hơn N ⇒ hẹn tắt của app **cắt ngang** chu trình máy. Chốt N theo câu (1).
- ⚠️ Máy offline đúng giờ hẹn ⇒ cloud không gửi được lệnh tắt → lưới an toàn AC6 gánh.
- ⚠️ Format `actions` của `ThingTimerBuilder` (Android) chưa verify ⇒ B2 có thể phải sửa theo SDK thật.
- ⚠️ Timer chạy theo giờ của bồn (Europe/Madrid); khách ở cùng múi giờ nên ít rủi ro, vẫn phải verify ở B5.
