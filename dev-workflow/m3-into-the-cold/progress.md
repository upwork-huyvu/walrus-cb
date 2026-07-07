# Progress: Into the cold - countdown + daily summary (m3-into-the-cold)

> File quản lý tiến trình. `/dev`, `/test`, `/fix-plan` đọc + cập nhật mỗi lượt.

- **Slug:** `m3-into-the-cold`
- **Phase hiện tại:** `TEST` (B1–B4 CODE XONG; chờ verify UI trên máy + commit)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-06

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**FEATURE CODE-COMPLETE (B1–B4, 2026-07-06).** Gate ① chốt: cả-2-mode + daily-summary màn riêng. Verify:
tsc0 · eslint0 · **mobile jest 101/101**. Còn: (1) verify UI trên máy (đếm ngược tự finish, daily bars, persist qua
restart); (2) **commit** (file mới: ritualStore, sessionTimer, DailySummaryScreen - nhớ `git add`). Không có blocker.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - `ritualStore.ts` (persist + summarizeDay/last7Days/toISODate) + nối useAppState (nạp lúc mở + ghi khi complete; fix bug state-mất-restart) · **done** (jest 7/7)
- [x] B2 - Đếm ngược SessionScreen: mode timed/open toggle + preset 1/2/3/5' + auto-finish; logic thuần `lib/sessionTimer.ts` · **done** (jest 4/4)
- [x] B3 - Tổng hợp theo ngày (Today: sessions/time/points + 7-day bars) · **done** → **2026-07-06 tái cấu trúc:** gộp thẳng vào `ProgressScreen` và biến ProgressScreen thành **bottom tab "Tracking"** (thay tab Reminder cũ đã vô dụng vì filter reminder đã chuyển sang Device Detail). Xoá `DailySummaryScreen.tsx` + route `daily-summary`. Thêm `IconTracking`.
- [x] B4 - Verify tổng · **done** (tsc0 · eslint0 · mobile jest **101/101**)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - Đếm ngược (preset → tới 0 tự finish) + giữ open · sessionTimer spec 4/4
- [x] AC2 - Persist qua restart (AsyncStorage) · ritualStore spec (round-trip) - ⏳ xác nhận trên máy
- [x] AC3 - Daily summary hôm nay + 7 ngày (đúng theo log) · summarizeDay/last7Days spec 7/7
- [x] AC4 - tsc/eslint/jest xanh · mobile jest 101/101

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-06 | REMOVE Breathwork + fix review | ✅ | **Bỏ hẳn Breathwork** (không có trong design gốc): xoá BreathworkScreen/BreathingCircle/techniques.ts, route `breathwork`, các nút ở Progress/Home/Dashboard, state+persist `completedBreathworks` (useAppState + ritualStore + test), ô stat BREATHWORK. **Workflow review đối kháng** (9 agent) trả 5 finding CONFIRMED → fix hết: (1) `navigate` closure cũ ở effect notification push nhầm 'splash' vào back-stack → thêm `screenRef`; (2/5) bottom bar lúc session ĐANG chạy → chạm nhầm tab mất phiên → ẩn bar khi `sessionActive` (vẫn hiện lúc setup/pause); (3) tab Tracking active bị `!isActive` chặn → bỏ guard, tap luôn về Progress root; (4) "Back to device" hard-code device-detail → `deviceConnected ? device-detail : device-list`. tsc0·eslint0·**jest 103/103**. |
| 2026-07-06 | FIX (3 bug UX) | ✅ | **Bug1** bottom bar mất khi vào "Into the cold" → thêm `session`/`breathwork`/`completion` vào TABBED='tracking' (giữ bottom bar suốt ritual). **Bug2** picker thời lượng → `DurationSlider` (PanResponder pure-JS, không native dep) kéo 1–10′ mặc định 3′; SessionScreen default 120s→180s; `sessionTimer` thêm minutesFromFraction/fractionOfMinutes/DURATION_MIN/MAX/DEFAULT, bỏ DURATION_PRESETS. **Bug4** back về màn TRƯỚC (không hard-code) → App.tsx thêm history back-stack + `goBack()` (navigate() đẩy stack; setScreen trực tiếp=transient KHÔNG đẩy); back-arrow Session/Breathwork gọi goBack; CTA terminal giữ tường minh. tsc0·eslint0·**jest 103/103**. Đang chạy workflow review đối kháng. |
| 2026-07-06 | FIX (UX) | ✅ | (1) Ritual back-nav: 4 màn (Progress/Session/Completion/Breathwork) đang `navigate('home')` → sửa về `device-detail` (ritual vào từ Device Detail), nhãn HOME→DEVICE. (2) Tab **Reminder → Tracking**: ProgressScreen thành bottom tab, gộp Today+7-day (từ DailySummaryScreen) vào, bỏ nút back, xoá DailySummaryScreen+route. tsc0·eslint0·**jest 101/101**. |
| 2026-07-06 | DEV B1–B4 | ✅ | Gate ① chốt (cả-2-mode + màn riêng). B1 ritualStore persist + useAppState (fix bug mất-state-restart) jest 7/7. B2 SessionScreen timed/open + preset + auto-finish, lib/sessionTimer jest 4/4. B3 DailySummaryScreen (Today + 7-day bars) + route + entry Progress. B4 verify: tsc0·eslint0·**mobile jest 101/101**. Feature code-complete. Còn: verify UI trên máy + commit. |
| 2026-07-06 | PLAN | ✅ | Khảo sát: SessionScreen=stopwatch đếm-lên; ProgressScreen=tổng lũy kế; useAppState IN-MEMORY (mất khi restart, không có log/ngày). Gate ① chốt. |

## Vấn đề đang chặn (Blockers)
- Không có (local-only, không phụ thuộc device/backend). Chỉ chờ Gate ①.
