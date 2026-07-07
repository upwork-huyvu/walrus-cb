# Context: Option gửi push qua FCM (m1-push-provider-fcm)

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.

- **Slug:** `m1-push-provider-fcm`

## Quyết định kỹ thuật (Decision log)
- **2026-07-06** - Thêm FCM là provider THỨ HAI, chọn bằng ENV `NOTIFICATION_PROVIDER=tuya|fcm` (default tuya).
  Lý do: user muốn đường push không phụ thuộc duyệt template Tuya. Không làm chọn-provider-per-message (giữ đơn giản).
- **2026-07-06** - **Khôi phục** hạ tầng FCM đã xoá (feature `m3-push-fcm`, commit `f04373c`) thay vì viết lại:
  tiết kiệm + đã có test cũ. Bọc sau abstraction `NotificationProvider` để Tuya/FCM dùng chung interface.
- **2026-07-06** - Mobile **đăng ký token cả Tuya lẫn backend** (provider là config server, app không biết) -
  idempotent theo `token` unique. Loại phương án "app đọc provider từ backend rồi chỉ đăng ký 1" (thêm round-trip,
  phức tạp; đăng ký cả 2 rẻ hơn).
- **2026-07-06** - Token registration dùng **API-KEY guard** (`PUSH_API_KEY`), KHÔNG per-user auth - chấp nhận vì
  token reg ít nhạy cảm (khác `m1-device-reminders` cần per-user authorize).

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/backend/src/push/*` (khôi phục f04373c) | firebase-admin provider + gửi FCM per-uid + token register + api-key guard |
| `apps/backend/prisma` → model `PushToken` + migration recreate | Lưu FCM token per uid (token unique, platform) |
| `apps/backend/src/notifications/providers/*` | `NotificationProvider` interface + TuyaProvider + FcmProvider + router theo ENV |
| `apps/backend/src/config/env.validation.ts` | Thêm `NOTIFICATION_PROVIDER`; FCM_* + PUSH_API_KEY đã có sẵn |
| `apps/mobile/src/services/api.ts` + `config/api.ts` (khôi phục) | Client backend đăng ký/huỷ token |
| `apps/mobile/src/services/push.ts` + `state/useAuth.ts` | Đăng ký token với CẢ Tuya + backend; huỷ khi logout |
| `apps/admin/app/notifications/page.tsx` | Badge "Sending via: FCM/Tuya" (đọc `GET /notifications/provider`) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **Khôi phục code**: `git show f04373c:path` bị lỗi "path exists on disk but not in commit" → dùng
  `git ls-tree -r f04373c -- <path>` lấy blob hash rồi `git cat-file -p <blob>`. Đã verify push.service.ts đọc được.
- **ENV FCM đã có** trong env.validation (FCM_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY + PUSH_API_KEY) - không phải thêm.
- **DB đã drop push_tokens** (migration `drop_push_tokens` đã apply) → phải tạo migration MỚI để tạo lại (đừng sửa
  migration drop).
- `.gitignore` từng nuốt `apps/mobile/src/lib/` & `apps/admin/lib/` (đã sửa) - file mới trong `src/` nhớ `git add`.
- Android FCM native đã wire (progress m1-admin-push 2026-07-04: google-services.json + firebase-messaging +
  ensureNotificationChannel + registerDevice). iOS chưa (chờ Mac build + APNs key Firebase).

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md) (provider Tuya) ·
  [tuya-home-sdk-push-notifications.md](../../docs/research/tuya-home-sdk-push-notifications.md)
- Feature liên quan: [m1-admin-push](../m1-admin-push/progress.md) (Tuya push + admin UI), `m3-push-fcm` (commit `f04373c` - hạ tầng gốc)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa xong>
