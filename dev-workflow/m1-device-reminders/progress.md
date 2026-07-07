# Progress: Nhắc bảo trì theo thiết bị (m1-device-reminders)

> File quản lý tiến trình (state machine). `/dev`, `/test`, `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-device-reminders`
- **Phase hiện tại:** `TEST` (B1–B8 CODE XONG; chờ apply migration + E2E)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-06

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**FEATURE CODE-COMPLETE B1–B8 (2026-07-06).** Backend (model→service→countdown→auth→controller→cron) + mobile
(client + FilterReminderCard trên Device Detail). Verify: **backend jest 67/67 · mobile 90/90 · tsc0/eslint0**.
**Còn để CHẠY THẬT (không phải code):**
1. **Apply migration** `20260706130000_add_device_reminders` khi **DB thông** (phiên này P1001) - `prisma migrate deploy`.
2. **E2E:** deploy/run backend + điền `PUSH_API_KEY` mobile `config/api.ts` + rebuild → mở Device Detail thấy card
   thật (hiện đang chạy MOCK khi PUSH_API_KEY rỗng) → set lastReplacedAt tới hạn → cron gửi push (AC6).
3. (nhỏ) rework Reminder **tab** (đang dùng filterStore global cũ) thành tổng quan/gỡ - không chặn.
4. Gợi ý: chạy `/audit` trên scope reminders + mobile-auth.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Research + chốt auth mobile→backend · **done** (note [tuya-app-session-verification.md](../../docs/research/tuya-app-session-verification.md); **USER CHỐT: api-key + uid + ownership-check** - MVP, chấp nhận rủi ro khai-uid có mitigate). SHARED notification-history.
- [x] B2 - Prisma model DeviceReminder + migration · **done** (model `device_reminders` unique deviceId; migration file `20260706130000_add_device_reminders`; prisma generate OK. ⚠️ **apply DEFERRED** - DB P1001 phiên này)
- [x] B3 - RemindersService (CRUD + computeStage) · **done** (spec jest 8/8; AC1 upsert idempotent + AC2 countdown)
- [x] B4 - MobileAuthGuard (api-key+uid) + DeviceOwnershipGuard (deviceId∈uid qua Tuya Cloud) + MobileAuthModule · **done** (spec 6/6; AC3). `src/mobile-auth/*`
- [x] B5 - RemindersController (GET/PUT/mark-replaced/DELETE, bọc 2 guard) + DTO + RemindersModule + wire app.module · **done** (tsc0/eslint0; full backend jest 59/59)
- [x] B6 - Cron scanDue → push + bookkeeping · **done** (`scanDue`+`markNotified` (spec AC4 chống spam) + `RemindersCronService.processDue` (gửi qua NotificationRouterService, mark chỉ khi OK) + `RemindersCronController` GET /internal/cron/process-reminders (CRON_SECRET) + vercel.json cron `0 1 * * *`. jest cron 4/4, reminders 16/16)
- [x] B7 - Mobile client services/reminders.ts · **done** (get/save/markReplaced/delete → `/reminders/:deviceId` kèm x-api-key+x-tuya-uid; mock local khi PUSH_API_KEY rỗng. spec 7/7; mobile jest 90/90)
- [x] B8 - Mobile UI: FilterReminderCard trên Device Detail · **done** (`FilterReminderCard.tsx` - countdown + màu khẩn + progress + "Replaced now"/"Buy filters" + "Start tracking" khi chưa có; wire DashboardScreen + uid từ App auth. tsc0/eslint0, mobile jest 90/90). ⏳ *rework Reminder tab (global filterStore cũ) để sau - không chặn.*
- [ ] B9 - (OPTIONAL) Local notif fallback (notifee) · pending
- [ ] B10 - E2E push (BLOCKED: chờ template duyệt) · blocked

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - 1 reminder / device (unique + upsert)
- [ ] AC2 - Countdown đúng + markReplaced reset
- [x] AC3 - Authorize: chỉ CRUD device mình sở hữu (403 nếu không) · MobileAuthGuard+DeviceOwnershipGuard, spec 6/6
- [x] AC4 - Cron push 1 lần/mốc (chống spam bằng lastNotifiedStage) · scanDue + processDue spec (đã nhắc mốc → skip)
- [x] AC5 - Mobile UI per-device (màu khẩn + Replaced now + Buy) · FilterReminderCard trên Device Detail (mock chạy dev)
- [ ] AC6 - (BLOCKED) E2E nhận push thật (chờ template APPROVED + push token M3)

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-07 | DEBUG "chưa hoạt động" | ⚠️ | Chẩn 3 tầng gãy: (1) **backend chưa deploy** - mobile trỏ `walrus-cb-backend.vercel.app`=DEPLOYMENT_NOT_FOUND (admin dùng localhost:3006). (2) `reminders.ts` **thiếu check `isMockDevId`** → bồn giả gọi backend chết thay vì mock → **ĐÃ FIX** (`mockLocally()`). (3) DB **chưa có bảng DeviceReminder** → **ĐÃ apply** migration `20260706130000_add_device_reminders` + dọn 3 dir migration rác iCloud. User chọn dev qua LAN IP → mobile `API_BASE_URL`=`http://172.20.10.2:3006`. **CÒN THỦ CÔNG:** process backend đang chạy stale (Sun 05/07) → route /reminders=404 → **restart backend** (`npm run start:dev`). tsc0·eslint0·jest 7/7. |
| 2026-07-06 | DEV B8 | ✅ | `FilterReminderCard.tsx` (countdown + màu khẩn + progress bar + "Replaced now"/"Buy filters"/"Start tracking", đọc `services/reminders.ts`) + wire DashboardScreen (sau CleaningPanel) + `userUid` từ App auth. tsc0·eslint0·mobile jest 90/90. **Feature code-complete B1–B8.** AC5 đạt. |
| 2026-07-06 | DEV B6+B7 | ✅ | B6: `scanDue`(query enabled + computeStage, chỉ mốc đổi)+`markNotified` + `RemindersCronService.processDue`(gửi per-uid qua router, mark chỉ khi OK)+`RemindersCronController`(CRON_SECRET)+vercel.json `0 1 * * *`; export router từ NotificationsModule. B7: mobile `services/reminders.ts` (get/save/markReplaced/delete → /reminders/:deviceId + 2 header; mock khi PUSH_API_KEY rỗng). **Verify:** backend jest 67/67 · mobile jest 90/90 · tsc0/eslint0. AC4 (chống spam) covered. |
| 2026-07-06 | DEV B1+B4+B5 | ✅ | B1 research auth (note tuya-app-session-verification): Tuya không verify session được → **user chốt api-key+uid+ownership** (MVP). B4 `MobileAuthGuard`(api-key+uid)+`DeviceOwnershipGuard`(deviceId∈uid qua Tuya Cloud getUserDevices)+`MobileAuthModule`, spec 6/6. B5 `RemindersController` (GET/PUT/POST mark-replaced/DELETE, bọc 2 guard)+DTO+`RemindersModule`+wire app.module. **Verify:** tsc0·eslint0·full backend jest **59/59**. AC3 (chỉ CRUD device mình sở hữu) test-covered. |
| 2026-07-06 | DEV B2+B3 | ✅ | Gate ① duyệt (/dev-loop). B2: model `DeviceReminder` (unique deviceId) + migration `20260706130000_add_device_reminders` (**apply defer - DB P1001**) + generate OK. B3: `RemindersService` (get/upsert/markReplaced/delete) + `computeStage` thuần + types + spec. **Verify:** tsc0 · eslint0 · reminders jest 8/8 · full backend 53/53. AC1(upsert idempotent)+AC2(countdown/mốc) test-covered. **Kế:** B1 auth (blocker, shared) + apply migration khi DB thông. |
| 2026-07-06 | PLAN | ✅ | Tạo plan/context/progress từ khảo sát (schema, cron, notifications, ReminderScreen/filterStore, no mobile→backend client). Gate ① duyệt. |

## Vấn đề đang chặn (Blockers)
- **Auth mobile→backend** (B1): app chưa có kênh gọi backend có xác thực → chặn B4/B5/B7. Gỡ ở B1. **NỀN DÙNG CHUNG
  với `m1-notification-history`** - làm 1 lần, 2 feature xài.
- **DB P1001 (2026-07-06):** Supabase pooler `aws-1-eu-central-1.pooler.supabase.com:5432` không kết nối được lúc
  chạy dev-loop → migration `add_device_reminders` CHƯA apply (file đã có). Thử lại `prisma migrate deploy` khi DB thông.
- **Duyệt template Tuya** (≤2 ngày): chặn AC6 (push E2E), không chặn code/unit test.
