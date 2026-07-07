# Context: Into the cold - countdown + daily summary (m3-into-the-cold)

> File "trí nhớ" - giữ context xuyên suốt các phiên.

- **Slug:** `m3-into-the-cold`

## Quyết định kỹ thuật (Decision log)
- **2026-07-06** - Local-only (AsyncStorage), KHÔNG đụng backend/auth - ritual là dữ liệu cá nhân nhẹ, đồng bộ đa
  thiết bị không cần cho M3. Persist vừa fix bug state-mất-khi-restart vừa mở đường daily summary.
- **2026-07-06 (Gate ① CHỐT)** - Timer: **cả 2** - 'Timed' (đếm ngược, chọn thời lượng) + 'Open' (đếm lên) qua
  toggle. Daily summary: **MÀN RIÊNG** `daily-summary` (không nhét vào ProgressScreen) - vào từ Progress/Home.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/ritualStore.ts` (mới) | Persist totals + session log; summarizeDay/last7Days (thuần) |
| `apps/mobile/src/state/useAppState.ts` | Nạp store lúc mở + ghi khi completeSession |
| `apps/mobile/src/screens/SessionScreen.tsx` | Thêm đếm ngược + chọn thời lượng (giữ open mode) |
| `apps/mobile/src/screens/ProgressScreen.tsx` | Thêm daily summary (Today + 7 ngày) |
| `apps/mobile/src/lib/*` | Hàm timer thuần (test được) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **State ritual IN-MEMORY** (useAppState) → mất khi restart; **không có log per-session** → daily summary bất khả
  nếu không thêm store. B1 giải cả 2.
- SessionScreen hiện là stopwatch đếm-lên; WaterCircle nhận `maxSeconds` (progress) - đếm ngược đảo chiều progress.
- AsyncStorage đã dùng ở deviceStore/filterStore (pattern try/catch no-op khi lỗi).
- `.gitignore` từng nuốt `src/lib/` (đã sửa) - file mới nhớ `git add`.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Feature liên quan: [m1-mobile-dashboard](../m1-mobile-dashboard/progress.md) (UI clone gốc), [m1-mobile-home-device-flow](../m1-mobile-home-device-flow/progress.md)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa xong>
