# Context: Nhắc bảo trì theo thiết bị (m1-device-reminders)

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.

- **Slug:** `m1-device-reminders`

## Quyết định kỹ thuật (Decision log)
- **2026-07-06** - Chọn **backend source-of-truth + Tuya server push** (user chốt qua 2 câu hỏi), thay vì
  app-local + local notification. Lý do: user muốn admin/hệ thống nắm được trạng thái filter + nhắc từ server.
  Đã cân nhắc & loại: (a) app-local + notifee (nhanh, offline, không cần duyệt template - nhưng không có
  source-of-truth ở server); (b) hybrid phased.
- **2026-07-06** - Reminder **theo `deviceId`, unique** (mỗi thiết bị 1 cái) - enforce bằng `@unique` +
  upsert. Countdown suy từ `lastReplacedAt + intervalDays` (không lưu số ngày trực tiếp → không lệch theo thời
  gian). Chống spam push bằng `lastNotifiedStage`.
- **2026-07-06 (B1 research xong)** - Auth mobile→backend: **Tuya KHÔNG có cách cho backend verify session của app
  đã login** (note [tuya-app-session-verification.md](../../docs/research/tuya-app-session-verification.md)). OAuth code = web-consent (không im lặng), UID-login = đập lại kiến trúc.
  → phải **tự dựng lớp auth**. **USER CHỐT (2026-07-06): api-key + uid + ownership-check** (workaround MVP) - loại
  🅰 Supabase Auth + 🅱 OAuth consent (nặng hơn). Cụ thể: `MobileAuthGuard` so `x-api-key`==PUSH_API_KEY + lấy uid từ
  `x-tuya-uid` → req.uid; `DeviceOwnershipGuard` verify `deviceId∈uid` qua Tuya Cloud `getUserDevices` (siết cho
  endpoint device-scoped). **Rủi ro chấp nhận:** api-key trong bundle → khai-uid được nếu biết uid; mitigate = uid mờ
  + ownership + rate-limit; TODO nâng cấp Supabase/OAuth sau. **Nền này DÙNG CHUNG `m1-notification-history`** (nhưng
  /me/* không có deviceId nên chỉ có api-key+uid, yếu hơn - cân nhắc riêng khi làm feature đó).

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/backend/prisma/schema.prisma` → `DeviceReminder` | Model reminder per-device (unique deviceId) |
| `apps/backend/src/reminders/*` | Module mới: service (CRUD + computeStage + scanDue) + controller + cron |
| `apps/backend/src/mobile-auth/mobile-device.guard.ts` | Guard authorize request mobile theo uid + ownership |
| `apps/backend/src/notifications/notifications.service.ts` | Tái dùng `sendPush`/`sendAppPush` cho bước push |
| `apps/backend/vercel.json` | Thêm cron `process-reminders` |
| `apps/mobile/src/services/reminders.ts` + `config/api.ts` | Client backend (mới) - app đọc/ghi reminder |
| `apps/mobile/src/components/FilterReminderCard.tsx` | Card filter trên Device Detail |
| `apps/mobile/src/screens/ReminderScreen.tsx` + `services/filterStore.ts` | Rework tab thành tổng quan; store cũ giữ/gỡ |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- App **không còn** client backend (services/api.ts xoá REV 2) → phải dựng lại `config/api.ts` + `services/reminders.ts`.
  ⚠️ `.gitignore` từng nuốt `apps/mobile/src/lib/` & `apps/admin/lib/` (rule `**/lib/`, đã sửa thành `packages/*/lib/`)
  - file mới trong `src/` nhớ `git add`, đừng để lặp lại lỗi "thiếu file trên đĩa".
- Vercel serverless: cron KHÔNG chạy `@nestjs/schedule` → dùng Vercel Cron + `CRON_SECRET` (pattern có sẵn).
- Server push chặn bởi **duyệt template Tuya (≤2 ngày)** - code + unit test (mock) không bị chặn.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-push-template-approval.md](../../docs/research/tuya-push-template-approval.md) ·
  [tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md) ·
  (B1 sẽ thêm) `tuya-app-session-verification.md`
- Feature gốc (Reminder tab local): [m1-mobile-home-device-flow](../m1-mobile-home-device-flow/progress.md)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa xong>
