# Kế hoạch: Option gửi push qua FCM (song song Tuya, chọn bằng ENV)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-push-provider-fcm`
- **Milestone:** M1 (mở rộng `m1-admin-push`; hồi sinh hạ tầng `m3-push-fcm` đã bị xoá ở REV 2)
- **Phần liên quan:** backend + mobile + admin (web)
- **Ngày tạo:** 2026-07-06
- **Cập nhật lần cuối:** 2026-07-06

## 1. Mục tiêu & phạm vi
Thêm **provider gửi thông báo qua FCM** (Firebase Cloud Messaging, iOS+Android) **song song** với Tuya App Push.
Backend có **1 biến ENV `NOTIFICATION_PROVIDER=tuya|fcm`** để chọn đường gửi. `/notifications/send` (admin) giữ
NGUYÊN UI + response, chỉ route provider khác nhau. Tận dụng **khôi phục hạ tầng FCM đã có** (commit `f04373c`,
feature cũ `m3-push-fcm`) - không làm lại từ đầu.

**Ngoài phạm vi:**
- Chọn provider per-message trên UI (provider là **cấu hình ENV**, không phải lựa chọn từng lần gửi).
- Đổi luồng Tuya push hiện có (giữ nguyên; chỉ bọc sau provider abstraction).
- Đăng ký/nhận push phía app iOS end-to-end (cần Mac build - để AC device).

## 2. Bối cảnh & ràng buộc
- **Hạ tầng FCM TỪNG TỒN TẠI, bị xoá ở REV 2** (commit xoá `8194316`; bản còn nguyên ở cha `f04373c`). Khôi phục:
  `apps/backend/src/push/*` (`firebase.provider.ts`, `push.service.ts` + `.spec.ts`, `push-tokens.controller.ts`,
  `push-tokens.service.ts`, `api-key.guard.ts`, `push.module.ts`, `push.controller.ts`, DTO register/unregister),
  model Prisma **`PushToken`** (tuyaUid, token unique, platform), mobile `src/config/api.ts` + `src/services/api.ts`.
  Lấy bằng `git cat-file -p <blob>` (git show `f04373c:path` bị lỗi path - dùng ls-tree lấy blob hash).
- **ENV FCM ĐÃ có sẵn** trong [env.validation.ts](../../apps/backend/src/config/env.validation.ts): `FCM_PROJECT_ID`,
  `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY` (SERVER-ONLY, `\n`-escaped), `PUSH_API_KEY`. Chỉ cần **thêm
  `NOTIFICATION_PROVIDER`**. User xác nhận **đã có mọi file cấu hình** (google-services.json Android,
  GoogleService-Info.plist iOS, service-account values cho firebase-admin).
- **Auth đăng ký token** dùng **API-KEY guard** (`PUSH_API_KEY`) - KHÔNG cần per-user auth (khác blocker của
  `m1-device-reminders`). Mobile→backend cho token registration là đường nhẹ, khả thi ngay.
- **Mobile hiện đăng ký token với Tuya** (`registerDevice(token,'fcm')`). Vì provider là config phía backend →
  mobile **đăng ký token với CẢ hai** (Tuya SDK + backend `POST /push/tokens`), idempotent, để provider nào bật
  cũng có token.
- **Migration**: DB đã apply `drop_push_tokens` → cần **migration MỚI tạo lại** bảng `push_tokens` (KHÔNG sửa
  migration drop cũ).
- **Ràng buộc**: `FCM_PRIVATE_KEY`/service-account = **secret server-only**; google-services.json/plist = public
  client config. **⚠️ Data residency**: FCM đi qua Google (US) → nội dung push rời EU (Tuya push thì ở EU) - ghi
  chú tuân thủ. RN CLI (không Expo).
- **Link liên quan:** [m1-admin-push](../m1-admin-push/progress.md) (Tuya push hiện tại + admin send UI),
  progress 2026-07-04 (google-services.json Android đã wire + FCM messaging native + `registerDevice`).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] **AC1** - ENV `NOTIFICATION_PROVIDER=tuya|fcm` chọn đúng đường gửi; default `tuya`; giá trị lạ → env
  validation fail (Zod). Có test router chọn provider theo config.
- [ ] **AC2** - FcmProvider gửi qua firebase-admin tới **mọi token** của 1 uid (iOS+Android), **prune token chết**;
  kết quả per-uid `{total,success,failed}` khớp shape admin UI. Có test (mock firebase-admin).
- [ ] **AC3** - Mobile đăng ký/huỷ token FCM với **backend** (`POST/DELETE /push/tokens`, api-key) + **vẫn** với
  Tuya; upsert idempotent theo `token` unique. Có test client.
- [ ] **AC4** - `/notifications/send` trả **cùng shape** dù provider nào; admin UI gửi hiện tại chạy với cả 2 mà
  không sửa form. Có test.
- [ ] **AC5** - Admin `/notifications` hiện **provider đang bật** (badge "Sending via: FCM/Tuya") đọc từ backend.
- [ ] **AC6 (device)** - E2E: `NOTIFICATION_PROVIDER=fcm` → admin gửi → thiết bị **nhận FCM push** (Android trước,
  iOS sau khi build Mac + APNs key trên Firebase). Chặn bởi build thiết bị.

## 4. Các bước thực hiện
1. **B1 - Khôi phục hạ tầng FCM backend** từ `f04373c`
   - Việc: restore `src/push/*` + model `PushToken` + **migration mới tạo lại `push_tokens`** + dep `firebase-admin`
     (package.json). Chỉnh import/API nếu drift so với code hiện tại.
   - File: `apps/backend/src/push/*`, `prisma/schema.prisma`, `prisma/migrations/*_recreate_push_tokens/`, `package.json`.
   - Test: `prisma generate` OK; `tsc` sạch; `jest` chạy `push.service.spec.ts` khôi phục.

2. **B2 - Provider abstraction + ENV switch**
   - Việc: interface `NotificationProvider { sendToUser(uid, {title,body}): Promise<PerUidResult> }`; `TuyaProvider`
     (bọc `NotificationsService` gửi Tuya hiện có) + `FcmProvider` (bọc `PushService`). Thêm `NOTIFICATION_PROVIDER`
     (`z.enum(['tuya','fcm']).default('tuya')`) vào env.validation. Router chọn provider theo config.
   - File: `src/notifications/providers/*`, `src/config/env.validation.ts`, `notifications.module.ts`.
   - Test: jest - config `fcm` → FcmProvider được gọi; `tuya` → TuyaProvider; default `tuya`.

3. **B3 - Route `/notifications/send` qua provider router**
   - Việc: `NotificationsService.send*` gọi router thay vì gọi Tuya trực tiếp; giữ response `{total,success,failed}`.
     Endpoint `GET /notifications/provider` trả provider đang bật (cho admin badge).
   - File: `notifications.controller.ts`, `notifications.service.ts`.
   - Test: jest - send route đúng provider; endpoint provider trả đúng.

4. **B4 - Mobile: đăng ký token FCM với backend (+ giữ Tuya)**
   - Việc: khôi phục `config/api.ts` (API_BASE public) + `services/api.ts` (client + `x-api-key`), thích ứng.
     `push.ts`: sau khi có FCM token → `registerDevice` (Tuya, giữ) **và** `POST /push/tokens` (backend). Logout →
     `DELETE /push/tokens` + `deleteToken` Tuya. Wire `useAuth`.
   - File: `apps/mobile/src/services/api.ts`, `config/api.ts`, `services/push.ts`, `state/useAuth.ts`.
   - Test: jest - build request đăng ký/huỷ đúng path+header; nhánh mock (native/API vắng).

5. **B5 - Admin: hiện provider đang bật**
   - Việc: `/notifications` page fetch `GET /notifications/provider` → badge "Sending via: FCM/Tuya".
   - File: `apps/admin/app/notifications/page.tsx` (+ component badge).
   - Test: tsc/eslint; render badge.

6. **B6 - Verify E2E (device, một phần BLOCKED)**
   - Việc: set `NOTIFICATION_PROVIDER=fcm`, đăng ký token thật, admin gửi → nhận trên Android; iOS sau khi build Mac
     + upload APNs key lên Firebase. Ghi kết quả progress.
   - Test: manual device checklist.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **iOS FCM** cần: GoogleService-Info.plist trong app + **APNs Auth Key upload lên Firebase** + Push capability +
  Background Modes (remote notif) + Mac build. Android google-services.json đã wire (07-04). → AC6 iOS defer.
- ⚠️ **Data residency EU**: FCM = Google (US) → nội dung push rời EU. Nếu client cần EU-only thì FCM chỉ dùng khi
  chấp nhận điều đó; Tuya push giữ EU. **Cần xác nhận với client** trước khi bật `fcm` ở prod.
- ⚠️ **Migration**: tạo migration MỚI `recreate_push_tokens` (đừng sửa `drop_push_tokens`); apply lên DB đã drop.
- ⚠️ **firebase-admin trên Vercel serverless**: init lazy + reuse (cold start); `FCM_PRIVATE_KEY` un-escape `\n`.
- ⚠️ **Token registration = API-KEY** (không per-user) → chấp nhận cho token reg (ít nhạy cảm); rate limit.
- ❓ **Provider mobile không biết** → đăng ký token cả 2 (đã chốt trong context). Xác nhận lại nếu muốn app đọc
  provider từ backend để chỉ đăng ký 1.
