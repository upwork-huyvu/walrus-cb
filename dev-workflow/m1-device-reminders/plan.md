# Kế hoạch: Nhắc bảo trì theo thiết bị (filter reminder - backend source-of-truth + Tuya server push)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-device-reminders`
- **Milestone:** M1 (mở rộng feature `m1-mobile-home-device-flow` - Reminder tab cũ là local+global)
- **Phần liên quan:** mobile + backend (+ DB migration, Vercel cron)
- **Ngày tạo:** 2026-07-06
- **Cập nhật lần cuối:** 2026-07-06

## 1. Mục tiêu & phạm vi
Chuyển "Filter reminder" từ **local + global** (AsyncStorage, 1 cái chung) sang **backend source-of-truth,
theo từng thiết bị**: mỗi thiết bị tạo được **đúng 1 reminder** (unique theo `deviceId`), có **countdown**
(mặc định 90 ngày, "Replaced now" reset về 90) và **nhắc bằng Tuya App Push** (backend cron quét reminder
tới hạn → push per-uid). App đọc/ghi reminder qua backend.

**Ngoài phạm vi (không làm trong feature này):**
- Nhiều LOẠI reminder khác ngoài `filter` (model để sẵn cột `type` nhưng chỉ dùng `filter`).
- Local notification (notifee) - chỉ làm nếu server push kẹt lâu vì template chưa duyệt (đưa vào B9 optional).
- Đổi cơ chế auth chính của app (Tuya vẫn là định danh; chỉ thêm cách cho request mobile→backend được authorize).

## 2. Bối cảnh & ràng buộc
- **App CHƯA có kênh gọi backend** (`services/api.ts` xoá ở REV 2). App auth = **Tuya (uid)**, backend auth =
  **Supabase (AdminAuthGuard)**. → Phải dựng kênh mobile→backend + cách **authorize request theo uid Tuya**.
  Đây là **blocker chính** (B1 research + B4 guard).
- **Server push phụ thuộc Tuya App Push template ĐANG CHỜ DUYỆT (≤2 ngày làm việc)** - xem
  [tuya-push-template-approval.md](../../docs/research/tuya-push-template-approval.md) +
  [tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md). Push **E2E bị chặn tới khi APPROVED**;
  các bước code/không-push vẫn làm được và test bằng mock.
- **Vercel serverless**: KHÔNG dùng `@nestjs/schedule`. Cron = **Vercel Cron** gọi `GET /internal/cron/...`
  kèm `CRON_SECRET` (pattern có sẵn: [CronController](../../apps/backend/src/users/cron.controller.ts) +
  `processPendingDeletions`). Thêm 1 entry vào [vercel.json](../../apps/backend/vercel.json) crons.
- **DB**: Prisma/Postgres (Supabase). Đã có model `DeviceMapping (tuyaUid+deviceId unique)`. Thêm model
  `DeviceReminder` (unique theo `deviceId`).
- **Secrets server-only** (service_role, Tuya AppSecret) - reminder logic + push chạy ở backend, client chỉ
  gọi API. Data residency EU (project Western Europe - khớp `m1-backend-user-mgmt`).
- **notifications.service** đã có `sendPush({uids/all, templateId, params})` + `sendAppPush` free-form
  (dùng `TUYA_APP_TEMPLATE_ID`) - tái dùng cho bước push.
- **Link nghiên cứu liên quan:** [tuya-push-template-approval.md], [tuya-cloud-app-push.md],
  [tuya-cloud-user-management.md] (endpoint `GET /v1.0/users/{uid}/devices` để verify ownership).
  **Cần research mới:** App SDK session có verify server-side được không (B1).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] **AC1** - 1 reminder / device: tạo lần 2 cho cùng `deviceId` → **update** cùng bản ghi, KHÔNG tạo trùng
  (unique constraint + upsert). Có test.
- [ ] **AC2** - Countdown đúng: `daysRemaining = intervalDays − floor((now − lastReplacedAt)/1 ngày)`;
  `markReplaced` đặt `lastReplacedAt=now` → daysRemaining về `intervalDays`. Có unit test (pure).
- [ ] **AC3** - Authorize: mobile chỉ CRUD được reminder của **thiết bị nó sở hữu**; gọi với device không thuộc
  uid → 403. Có test guard.
- [ ] **AC4** - Cron quét reminder tới hạn → gửi Tuya push **1 lần / mốc** (warn7 / due / overdue) nhờ
  `lastNotifiedStage`, không spam khi cron chạy lại. Có test scan (mock push).
- [ ] **AC5** - Mobile UI theo từng thiết bị: hiện trạng filter (màu theo mức khẩn: >21 xám · ≤21 vàng · ≤7 đỏ ·
  quá hạn đỏ) + nút "Replaced now" (reset) + "Buy filters" (mở shop). tsc/eslint/jest xanh.
- [ ] **AC6 (BLOCKED)** - E2E: đổi `lastReplacedAt` cho tới hạn → cron chạy → thiết bị **nhận push thật**.
  Chặn tới khi **template APPROVED** + có thiết bị đăng ký push token (M3).

## 4. Các bước thực hiện

1. **B1 - Research: auth mobile→backend** *(gỡ blocker)*
   - Việc: `/tuya-research` xem App SDK (iOS `ThingSmartUser`/Android) có **session token verify được server-side**
     qua Tuya Cloud OpenAPI không. Nếu **không** → chốt phương án fallback: guard verify `deviceId ∈ uid` qua
     `GET /v1.0/users/{uid}/devices` + rate limit (rủi ro spoof uid = thấp vì filter reminder ít nhạy cảm).
   - File: `docs/research/tuya-app-session-verification.md` (mới); ghi quyết định vào `context.md`.
   - Test: N/A (research note có cite).

2. **B2 - Prisma model `DeviceReminder` + migration**
   - Việc: thêm model (unique `deviceId`, `tuyaUid`, `type='filter'`, `intervalDays=90`, `lastReplacedAt`,
     `enabled=true`, `lastNotifiedStage String?`, timestamps, index `tuyaUid`). Tạo migration.
   - File: [schema.prisma](../../apps/backend/prisma/schema.prisma) + `prisma/migrations/*`.
   - Test: `prisma migrate` chạy sạch (hoặc `migrate diff`), `prisma generate` OK.

3. **B3 - Backend `RemindersService` (CRUD + tính toán)**
   - Việc: `getForDevice/upsertForDevice/markReplaced/deleteForDevice` + hàm thuần `computeStage(reminder, now)`
     → `{ daysRemaining, stage: 'ok'|'warn'|'soon'|'overdue' }`. `markReplaced` reset `lastNotifiedStage=null`.
   - File: `src/reminders/reminders.service.ts` (+ `.spec.ts`), `reminders.types.ts`.
   - Test: jest - upsert idempotent (AC1), computeStage các mốc (AC2), markReplaced reset.

4. **B4 - `MobileDeviceGuard` (authorize theo uid + ownership)**
   - Việc: guard đọc `x-tuya-uid` + param `deviceId`, xác thực theo quyết định B1 (verify token, hoặc ownership
     qua Tuya Cloud). Cache ownership ngắn để đỡ gọi Tuya mỗi request.
   - File: `src/mobile-auth/mobile-device.guard.ts` (+ `.spec.ts`).
   - Test: jest - uid sở hữu device → pass; không sở hữu → 403 (mock Tuya).

5. **B5 - `RemindersController` (mobile CRUD) + wire module**
   - Việc: `GET /reminders/:deviceId`, `PUT /reminders/:deviceId` (upsert enabled/intervalDays),
     `POST /reminders/:deviceId/mark-replaced`, `DELETE /reminders/:deviceId` - bọc `MobileDeviceGuard`.
     Đăng ký `RemindersModule` vào `app.module`.
   - File: `src/reminders/reminders.controller.ts`, `reminders.module.ts`, [app.module.ts](../../apps/backend/src/app.module.ts).
   - Test: jest controller (guard áp đúng, service được gọi đúng tham số).

6. **B6 - Cron `scanDue` → Tuya push + bookkeeping**
   - Việc: `RemindersService.scanDue()` - quét reminder `enabled`, tính `stage`; nếu `stage` là mốc-nhắc
     (warn/soon/overdue) và **khác `lastNotifiedStage`** → gọi `notifications.sendPush`/`sendAppPush` cho `uid` +
     set `lastNotifiedStage=stage`. Endpoint `GET /internal/cron/process-reminders` (CRON_SECRET). Thêm cron
     vào `vercel.json`.
   - File: `reminders.service.ts`, `src/reminders/reminders-cron.controller.ts`, [vercel.json](../../apps/backend/vercel.json).
   - Test: jest - 1 reminder tới mốc → push gọi 1 lần + set stage; chạy lại cùng mốc → KHÔNG push lại (AC4).

7. **B7 - Mobile client `services/reminders.ts` + config API_BASE**
   - Việc: dựng lại client backend tối thiểu (fetch `API_BASE` + header `x-tuya-uid` từ user Tuya hiện tại).
     Hàm `getReminder(deviceId)/saveReminder/markReplaced/deleteReminder`. Mock khi native/API vắng (dev UI).
   - File: `src/services/reminders.ts` (+ test), `src/config/api.ts` (mới - public base url, KHÔNG secret).
   - Test: jest - build request đúng path+header; parse response; nhánh mock.

8. **B8 - Mobile UI per-device: card Filter reminder trên Device Detail**
   - Việc: thêm card "Filter reminder" vào [DashboardScreen](../../apps/mobile/src/screens/DashboardScreen.tsx)
     (giống card Cleaning): trạng thái + màu khẩn + "Replaced now" + "Buy filters". Repurpose Reminder **tab**
     thành **tổng quan filter mọi thiết bị** (đọc list device + reminder từng cái). filterStore cũ giữ làm cache
     offline hoặc gỡ (chốt ở B8).
   - File: `DashboardScreen.tsx`, `components/FilterReminderCard.tsx` (mới), `screens/ReminderScreen.tsx` (rework),
     `services/filterStore.ts` (giữ/gỡ).
   - Test: tsc/eslint/jest; verify UI trên máy (device checklist).

9. **B9 - (OPTIONAL) Local notif fallback (notifee)** - chỉ làm nếu template duyệt lâu: app tự lên lịch nhắc
   local từ `daysRemaining` để không phụ thuộc server push. File: `services/push.ts`/reminders. Test: manual.

10. **B10 - E2E push (BLOCKED)** - khi template APPROVED + có push token: set lastReplacedAt tới hạn → chạy cron
    → nhận push. Ghi kết quả vào progress.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Auth mobile→backend**: nếu App SDK không có token verify được → dùng ownership-check (verify `deviceId∈uid`
  qua Tuya Cloud). Rủi ro: kẻ biết cặp (uid, deviceId) của nạn nhân có thể sửa reminder filter của họ (impact
  thấp). Giảm thiểu: rate limit + coi là interim, TODO token exchange đúng nghĩa. → **B1 quyết định.**
- ⚠️ **Server push chặn bởi duyệt template** (≤2 ngày) → AC6 defer; các bước khác không chặn. Cân nhắc B9 (local
  notif) nếu cần nhắc trước khi template duyệt.
- ⚠️ **Cron serverless**: `scanDue` phải **idempotent + nhanh + batch**; Tuya push 1 uid/lần → loop, cần rate limit
  nếu nhiều reminder cùng tới hạn.
- ❓ **UI home**: card trên Device Detail (chính) + Reminder tab làm tổng quan - xác nhận lại lúc B8 nếu client
  muốn khác.
- ⚠️ **Ràng buộc dự án**: giữ service_role/AppSecret server-only; DC EU khớp project; RN CLI (không Expo).
