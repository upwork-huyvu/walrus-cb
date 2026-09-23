# Progress: Chu trình vệ sinh thật (Run clean cycle + lịch)

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-clean-cycle`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-23

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B5 - cần người:** build iOS mới (gom chung với `m1-fix-ios-target-temp`, làm ở đường dẫn ngoài iCloud) →
khách chạy checklist dưới. **Android giờ cũng chạy được** (B2 xong, chỉ cần cài lại APK) ⇒ dev tự test trước
trên SM-A325F với bồn giả/bồn thật nếu tiện. Song song chờ khách trả lời 3 câu để chốt thời lượng mặc định.

**Checklist cho khách (iPhone, bồn thật):**
1. Vào Device Detail → card CLEANING → **Run clean cycle now** → xác nhận 2 lần.
2. Bồn phải bật khử trùng (nút lá sáng), card hiện "Cleaning… until HH:mm" (AC1).
3. **Thoát app hẳn (vuốt kill), khoá máy.** Tới giờ đó bồn phải **tự tắt** khử trùng (AC2).
4. Chạy lại chu trình rồi bấm **Stop cleaning** → bồn tắt ngay, và sau đó **không** tự tắt/bật lần nữa (AC4).
5. EDIT → WEEKLY, chọn 1 thứ, giờ gần hiện tại vài phút, Save → tới giờ bồn tự bật, sau `CYCLE LENGTH` tự tắt (AC5).
   ⚠️ Nếu bật đúng **thứ khác** so với thứ đã chọn ⇒ `loops` lệch mốc ngày, sửa `loopsFrom` trong `cleanCycle.ts`.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - iOS native `addTimer`  · done (compile ✓)
- [x] B2 - Android `getTimerList` + xoá theo task  · done (javap verify + compileDebugKotlin ✓)
- [x] B3 - Service `services/cleanCycle.ts` + test  · done (20 test)
- [x] B4 - Nối `CleaningPanel` vào service  · done
- [ ] B5 - Verify máy thật (iPhone khách)  · blocked (cần build iOS + bồn thật)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - Run cycle → bồn bật, app hiện "Cleaning… until HH:mm" theo DP 122 thật
- [ ] AC2 - Tắt/kill app → tới giờ bồn vẫn tự tắt
- [ ] AC3 - Hẹn tắt trước, bật sau; hẹn lỗi ⇒ không bật (unit test)
- [ ] AC4 - Stop = xoá timer + tắt DP 122
- [ ] AC5 - Lịch Daily/chọn thứ = 2 timer lặp đúng task
- [ ] AC6 - Lưới an toàn khi máy offline lúc hẹn tắt
- [ ] AC7 - iOS `addTimer` đúng + compile sạch
- [ ] AC8 - tsc 0 · eslint 0 · jest xanh

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-23 | DEV+TEST B2 | ✅ | Android wire nốt: `getTimerList` (map `TimerTask.timerList` → `TimerItem`, dựng `dpsJson` từ `dpId`+`value`), xoá/bật-tắt **theo cả task** bằng `updateCategoryTimerStatus` khi JS không truyền timerIds (khớp iOS), `updateTimer` gắn `timerId`, `status` dùng hằng `ThingTimerBuilder.STATUS_OPEN/CLOSE`. Chữ ký + format `actions` **verify bằng javap** trên `thingsmart:7.5.6` (xem context). `./gradlew :jimmy-vu_react-native-turbo-tuya:compileDebugKotlin` → **BUILD SUCCESSFUL, 0 warning**. Kèm theo phía JS: `dpBoolOf` chịu được dps kiểu `true` / `"true"` / `1` (iOS lấy nguyên từ cloud, Android dựng từ `value` chuỗi) - không thì "có lịch mà app báo chưa đặt". Chạy lại: tsc 0 · eslint sạch · jest **416/416**. |
| 2026-09-23 | TEST B1/B3/B4 | ✅ | **native:** `xcodebuild -scheme TurboTuya -sdk iphonesimulator` → **BUILD SUCCEEDED**, `TuyaTimer.mm` 0 warning. **mobile:** `npx tsc --noEmit` exit 0 · `npx eslint` 4 file: **0 error** (chỉ warning `no-inline-styles` như toàn repo) · `npx jest` **30/30 suite, 415/415 test** (+20 test mới của `cleanCycle`). Chưa chạy trên bồn thật. |
| 2026-09-23 | DEV B4 | ✅ | `CleaningPanel` bỏ đếm lùi giả: trạng thái theo DP 122 (`purifyOn` truyền từ Dashboard) + mốc hẹn tắt; Run/Stop; chọn CYCLE LENGTH 15/30/60; lịch OFF/DAILY/WEEKLY (chọn nhiều thứ, bỏ "every X days"); lỗi hiện tại chỗ. |
| 2026-09-23 | DEV B3 | ✅ | `services/cleanCycle.ts`: task `walrus_clean_once`/`walrus_clean_sched`, `startCleanCycle` (hẹn tắt trước - bật sau), `stopCleanCycle` (tắt trước - xoá hẹn sau), `readCleanCycleEnd`, `reconcileCleanCycle`, `setCleanSchedule`/`readCleanSchedule` + helper thuần (giờ, loops, wrap nửa đêm). 20 test. |
| 2026-09-23 | DEV B1 | ✅ | `TuyaTimer.mm`: `addTimer` thật (`addTimerWithTask:…`), validate thiếu field trước khi gọi SDK; tiện tay sửa `bizType` (trước đó `"group"` cũng ra 0 vì dùng `integerValue`). |
| 2026-09-23 | PLAN | ✅ | Plan 5 bước / 8 AC. Chốt kiến trúc: tắt bằng timer cloud, thao tác theo task name, hẹn tắt trước-bật sau. Đang chờ khách trả lời 3 câu (chỉ ảnh hưởng mặc định, không chặn code). |

## Vấn đề đang chặn (Blockers)
- Không chặn code. Chờ khách trả lời: máy có tự tắt khử trùng không (và bao lâu) · thời lượng chu trình mặc định ·
  có chặn khi đang ngâm / tắt nguồn không. B5 cần build iOS + bồn thật.
