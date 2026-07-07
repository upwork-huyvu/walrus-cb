# Progress: Option gửi push qua FCM (m1-push-provider-fcm)

> File quản lý tiến trình (state machine). `/dev`, `/test`, `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-push-provider-fcm`
- **Phase hiện tại:** `DEV` (B1–B5 xong; B6 = config + device)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-06

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B1–B5 CODE XONG + verify xanh. CONFIG + MIGRATION ĐÃ CHẠY (2026-07-06):**
- ✅ `.env` đã thêm `NOTIFICATION_PROVIDER=fcm` + placeholder TRỐNG `PUSH_API_KEY/FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY` (user tự điền); `.env.example` thêm `NOTIFICATION_PROVIDER`.
- ✅ Dọn thư mục migration dupe iCloud (`* 2/`) + **`prisma migrate deploy` THÀNH CÔNG** - bảng `push_tokens` đã tạo lại (rows=0, "Database schema is up to date").

- ✅ **`.env` ĐÃ ĐIỀN ĐỦ (2026-07-06):** `PUSH_API_KEY` (gen random 64hex, ghi khớp cả mobile `config/api.ts`) +
  `FCM_PROJECT_ID=walrus-wellness-f1235` + `FCM_CLIENT_EMAIL` + `FCM_PRIVATE_KEY` (từ service account JSON).
  **Verify:** `firebase-admin` init OK (creds format hợp lệ). `.env` gitignored (không commit).

**Còn lại (user):**
1. Mobile `config/api.ts`: `PUSH_API_KEY` đã điền (khớp backend); chỉ cần chỉnh `API_BASE_URL` đúng (đang là
   `https://walrus-cb-backend.vercel.app`) → rebuild app.
2. Nếu backend deploy Vercel: set 4 biến (`NOTIFICATION_PROVIDER=fcm` + `PUSH_API_KEY` + 3 `FCM_*`) trong Vercel env.
3. Rebuild app (Android trước) → login → check token vào bảng `push_tokens` → admin gửi (`/notifications`, badge
   "Sending via: Firebase (FCM)") → nhận FCM push (B6/AC6).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Khôi phục hạ tầng FCM backend (src/push/* + PushToken + migration + firebase-admin) · **done** (git checkout f04373c; firebase-admin@14.1.0; migration recreate_push_tokens; wire app.module; backend jest 42/42)
- [x] B2 - Provider abstraction + ENV `NOTIFICATION_PROVIDER` switch · **done** (NotificationProvider + Tuya/Fcm provider + Router; env Zod enum default tuya; spec 3/3)
- [x] B3 - Route /notifications/send qua provider router + endpoint provider · **done** (controller /send→router; GET /provider; xoá PushController thừa)
- [x] B4 - Mobile: đăng ký token FCM với backend (+ giữ Tuya) · **done** (khôi phục api.ts/config; push.ts registerWithBackend dùng getFcmToken; useAuth truyền uid; push jest 18/18, mobile 83/83)
- [x] B5 - Admin: badge provider đang bật · **done** (notifications page fetch GET /provider + badge "Sending via: …")
- [ ] B6 - Verify E2E device (config env + apply migration + Android trước; iOS defer) · pending (cần cấu hình + build)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
> AC1–AC5 đã đạt ở mức **code + unit test** (verify lại 2026-07-06, xem run log). Bằng chứng thực-địa cuối cùng gộp vào AC6 E2E.
- [x] AC1 - ENV chọn provider (default tuya; lạ → fail) · env.validation Zod enum + notification-router.service.spec
- [x] AC2 - FcmProvider gửi mọi token/uid + prune token chết + shape {total,success,failed} · push.service.spec (mock firebase-admin)
- [x] AC3 - Mobile đăng ký/huỷ token với backend + Tuya, idempotent · push.test.ts 18/18
- [x] AC4 - /notifications/send cùng shape cho cả 2 provider · controller/router jest
- [x] AC5 - Admin hiện provider đang bật · badge fetch GET /notifications/provider (tsc0/eslint0)
- [ ] AC6 - (device) E2E nhận FCM push (Android; iOS defer Mac+APNs) · **BLOCKED: cần build thiết bị + deploy/run backend**

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-06 | TEST (re-verify B1–B5) | ✅ | **Verify độc lập lại toàn bộ** (né bẫy "progress claim ≠ đĩa"): file `src/push/*` + `providers/*` + mobile `services/api.ts`/`config/api.ts` **CÓ THẬT trên đĩa**. Chạy lại: backend `tsc` sạch + `jest 45/45`; mobile `tsc` sạch + `jest 83/83` (push 18/18); admin `tsc` sạch. DI wiring OK (PushModule export PushService → NotificationsModule import → FcmProvider+Router resolve; router đọc `NOTIFICATION_PROVIDER` default tuya). Migration `20260706120000_recreate_push_tokens` có trên đĩa. → AC1–AC5 đạt (code/unit). Còn AC6 device. |
| 2026-07-06 | DEV B1–B5 + config | ✅ | B1 khôi phục src/push/* + firebase-admin@14.1.0 + migration recreate + wire app.module. B2 provider abstraction (Tuya/Fcm/Router) + ENV enum. B3 /send→router + GET /provider + xoá PushController thừa. B4 mobile api client + push.ts đăng ký backend (getFcmToken) + useAuth uid. B5 admin badge. **Verify:** backend tsc0/jest 45/45 · mobile tsc0/eslint0/jest 83/83 · admin tsc0/eslint0. **Config:** .env +NOTIFICATION_PROVIDER=fcm+placeholder trống; **migrate deploy OK** (push_tokens tạo lại). |
| 2026-07-06 | PLAN | ✅ | Tạo plan/context/progress. Khảo sát: hạ tầng FCM khôi phục được từ `f04373c` (git cat-file); ENV FCM_* + PUSH_API_KEY đã có; PushToken model + mobile api client có sẵn; DB đã drop push_tokens (cần migration mới). Gate ① duyệt. |

## Vấn đề đang chặn (Blockers)
- **AC6 iOS**: chờ Mac build + upload APNs Auth Key lên Firebase + GoogleService-Info.plist. Android không chặn.
- **Data residency**: cần client xác nhận chấp nhận FCM (Google/US) trước khi bật `fcm` ở prod.
