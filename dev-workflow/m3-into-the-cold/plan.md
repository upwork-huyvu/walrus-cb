# Kế hoạch: Into the cold - đồng hồ đếm ngược + daily summary

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m3-into-the-cold`
- **Milestone:** M3 (backlog) · mobile-only
- **Phần liên quan:** mobile (SessionScreen, ProgressScreen, useAppState, store mới)
- **Ngày tạo:** 2026-07-06
- **Cập nhật lần cuối:** 2026-07-06

## 1. Mục tiêu & phạm vi
Nâng ritual "Into the cold": (1) thêm **đồng hồ ĐẾM NGƯỢC** (chọn thời lượng → đếm ngược → tự kết thúc ở 0), giữ
cả chế độ đếm-lên (open) hiện có; (2) **PERSIST** dữ liệu ritual (AsyncStorage) để không mất khi restart; (3)
**daily summary** - hôm nay tắm mấy lần / bao lâu / điểm, + lịch sử vài ngày.

**Ngoài phạm vi:**
- Đồng bộ ritual lên backend/đa thiết bị (local-only, đúng bản chất - không đụng auth mobile→backend).
- Âm thanh/haptic phức tạp (chỉ notif/haptic tối thiểu khi hết giờ, nếu có sẵn lib).
- Đổi hệ điểm/level (giữ nguyên levels hiện có).

## 2. Bối cảnh & ràng buộc
- **Đã có:** [SessionScreen](../../apps/mobile/src/screens/SessionScreen.tsx) - stopwatch đếm-lên, tap-to-begin,
  pause/resume/reset, finish → completion (WaterCircle, `maxSeconds=180`). [CompletionScreen] tổng kết 1 phiên.
  [ProgressScreen] tổng lũy kế (sessions/streak/minutes/level). [useAppState](../../apps/mobile/src/state/useAppState.ts)
  giữ `totalSessions/totalMinutes/streak/ritualPoints/lastDate/completedBreathworks/lastSessionPoints` +
  `completeSession(seconds)`.
- **Cạm bẫy CHÍNH:** state ritual **IN-MEMORY**, KHÔNG persist → mất hết khi restart app; và **không có log
  per-session theo ngày** → không làm daily summary được nếu không thêm lưu trữ. → B1 giải cả 2.
- **Ràng buộc:** RN CLI (không Expo); AsyncStorage đã có (dùng ở deviceStore/filterStore). Artifacts VN, code EN.
- **Link:** feature gốc UI clone [m1-mobile-dashboard], [m1-mobile-home-device-flow] (ritual gộp vào Device Detail).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] **AC1** - Chế độ đếm ngược: chọn thời lượng (preset) → đếm ngược mỗi giây → tới 0 **tự kết thúc** (vẫn
  "finish sớm" được); vẫn có chế độ Open (đếm lên) như cũ. Logic đếm ngược có unit test.
- [ ] **AC2** - Persist: totals + session log lưu AsyncStorage; restart app → dữ liệu còn nguyên. Store có test.
- [ ] **AC3** - Daily summary: "Today" = số phiên + tổng thời gian + điểm HÔM NAY (đúng theo log, đổi ngày → reset)
  + lịch sử 7 ngày. Hàm tổng hợp theo ngày có unit test.
- [ ] **AC4** - tsc 0 · eslint 0 · jest xanh; UI chạy được bằng mock/dev.

## 4. Các bước thực hiện
1. **B1 - `ritualStore.ts` (persist) + nối useAppState**
   - Việc: store AsyncStorage lưu `{ totals, sessions: {date, seconds, points}[] }`; `recordSession()` append + cập
     nhật totals/streak; load lúc app mở → seed useAppState. Hàm thuần `summarizeDay(sessions, dayISO)` +
     `last7Days(sessions)`.
   - File: `apps/mobile/src/services/ritualStore.ts` (+ test), `state/useAppState.ts` (nạp + ghi khi completeSession).
   - Test: jest - record→load round-trip; summarizeDay/last7Days đúng; streak logic.

2. **B2 - Đếm ngược trong SessionScreen**
   - Việc: thêm chọn thời lượng (preset 1/2/3/5 phút + "Open"); state `mode: 'timed'|'open'` + `remaining`. Timed →
     đếm ngược, tới 0 → tự `handleFinish`. Open giữ đếm-lên. WaterCircle progress theo mode. Tách logic đếm (thuần)
     ra `lib/timer` để test.
   - File: `screens/SessionScreen.tsx`, `lib/` (hàm timer thuần) (+ test).
   - Test: jest logic (remaining giảm, tới 0 → done); UI verify tay.

3. **B3 - Daily summary UI**
   - Việc: card "TODAY" (phiên/thời gian/điểm hôm nay) + dải 7 ngày (bar mini) trên ProgressScreen (hoặc section
     mới). Dùng `summarizeDay`/`last7Days` từ B1.
   - File: `screens/ProgressScreen.tsx` (+ component nếu cần).
   - Test: tsc/eslint; verify tay.

4. **B4 - Verify tổng** - tsc/eslint/jest cả app; chạy thử luồng session→completion→progress (mock).

## 5. Rủi ro & câu hỏi mở
- ❓ **Chế độ timer:** làm CẢ đếm ngược (timed) + đếm lên (open) qua toggle - hay chỉ đếm ngược? (đề xuất: cả 2).
- ❓ **Daily summary đặt đâu:** card "Today" trên ProgressScreen + 7 ngày (đề xuất) - hay màn/section riêng?
- ⚠️ Persist đổi hành vi hiện tại (giờ mất khi restart) → cần migrate nhẹ (chưa có dữ liệu cũ nên an toàn).
- ⚠️ Haptic/notif khi hết giờ: dùng notifee (đã có) hiện local notif nếu app nền; foreground chỉ cần đổi UI. Giữ tối thiểu.
