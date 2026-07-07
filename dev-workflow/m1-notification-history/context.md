# Context: Lịch sử notification per-user (m1-notification-history)

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.

- **Slug:** `m1-notification-history`

## Quyết định kỹ thuật (Decision log)
- **2026-07-06** - Scope = **CHỈ user (app)** + đọc từ **backend (per-user auth)** (user chốt qua 2 câu hỏi).
  Loại: admin-only (không cần), local-only (mất khi cài lại/logout), Tuya-MC+local-FCM (2 nguồn rời rạc).
- **2026-07-06** - Backend là **source of truth**: ghi `NotificationLog` khi gửi (cả Tuya lẫn FCM ở
  `NotificationRouterService`), app đọc lịch sử của mình. → chạy được cho FCM (thứ hiện không có message center).
- **2026-07-06** - Auth per-user **KHÔNG dùng api-key** (như /push/tokens) vì history là dữ liệu cá nhân → phải
  auth thật. Hướng: **JWT backend-issued** sau khi verify chứng-cứ Tuya (B1 research feasibility). **Nền auth này
  DÙNG CHUNG với `m1-device-reminders`** - làm 1 lần, 2 feature xài.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/backend/src/mobile-auth/*` | Kênh auth mobile→backend per-uid (JWT + guard) - SHARED với reminders |
| `apps/backend/prisma` → `NotificationLog` | Log mọi tin gửi (uid/title/body/provider/status/sentAt/readAt) |
| `apps/backend/src/notifications/providers/notification-router.service.ts` | Ghi log khi gửi (cả 2 provider) |
| `apps/backend/src/notifications/me-notifications.controller.ts` | GET/read/delete history của chính user (MobileAuthGuard) |
| `apps/mobile/src/services/messages.ts` | Đổi nguồn: đọc `/me/notifications` (kèm JWT) thay/bổ sung Tuya MC |
| `apps/mobile/src/screens/NotificationsScreen.tsx` | Giữ UI, đổi nguồn dữ liệu |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- FCM = fire-and-forget, KHÔNG có message center → phải tự lưu history ở backend mới xem lại được.
- NotificationsScreen hiện đọc Tuya `getMessageList` (chỉ tin Tuya + device alarm/family). Đổi sang backend sẽ mất
  mấy tin native đó trừ khi merge - cần chốt ở B6.
- Gửi "tất cả" → nhiều bản ghi/lần → dùng `createMany` (batch).
- `.gitignore` từng nuốt `src/lib/` (đã sửa) - file mới trong `src/` nhớ `git add`.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: (B1 tạo) `tuya-app-session-verification.md`; [tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md)
- Feature liên quan: [m1-push-provider-fcm](../m1-push-provider-fcm/progress.md) · [m1-device-reminders](../m1-device-reminders/plan.md) (chung auth) · [m1-admin-push](../m1-admin-push/progress.md)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa xong>
