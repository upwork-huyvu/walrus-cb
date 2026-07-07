# Kế hoạch: Lịch sử notification per-user (app đọc từ backend)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-notification-history`
- **Milestone:** M1 (mở rộng notifications; nối tiếp `m1-push-provider-fcm` + `m1-admin-push`)
- **Phần liên quan:** backend + mobile (KHÔNG làm admin UI - user chốt scope "chỉ user (app)")
- **Ngày tạo:** 2026-07-06
- **Cập nhật lần cuối:** 2026-07-06

## 1. Mục tiêu & phạm vi
Mỗi user xem được **lịch sử notification của mình** trong app - chạy cho **cả FCM lẫn Tuya** (hiện FCM không có
message center → màn Notifications trống khi gửi FCM). Backend **lưu log mọi tin gửi** (source of truth), app
**đọc lịch sử của chính mình qua kênh có xác thực uid**.

**Ngoài phạm vi:**
- Admin UI xem lịch sử (user chốt "chỉ user app").
- Gộp Tuya device-alarm/family (Message Center native) vào history - mặc định history = tin gửi qua backend;
  merge Tuya MC là open question (mục 5).

## 2. Bối cảnh & ràng buộc
- **App đọc history per-user ⇒ cần auth mobile→backend theo uid** - đây là **BLOCKER chính** và **DÙNG CHUNG với
  `m1-device-reminders`** (cùng cần kênh này). App auth bằng Tuya (uid), backend bằng Supabase (AdminAuthGuard);
  chưa có cách để backend biết request đúng là của uid X. **api-key (như /push/tokens) KHÔNG dùng được** vì đọc
  history là dữ liệu cá nhân → ai có key + uid sẽ đọc trộm được. Phải auth THẬT per-user.
- Hiện tại: [NotificationsScreen](../../apps/mobile/src/screens/NotificationsScreen.tsx) đọc **Tuya Message Center**
  ([services/messages.ts](../../apps/mobile/src/services/messages.ts) → `getMessageList`) - chỉ có tin Tuya, không có FCM.
- Backend **chưa log** notification (models: AdminUser/DeviceMapping/DeleteJob/PushToken). Gửi đi qua
  `NotificationRouterService` (Tuya|Fcm) - chỗ tốt để ghi log.
- **Ràng buộc**: privacy (history cá nhân) → auth real; EU data residency; secrets server-only; RN CLI.
- **Link nghiên cứu:** cần note mới `tuya-app-session-verification.md` (B1). Liên quan:
  [m1-push-provider-fcm](../m1-push-provider-fcm/progress.md), [m1-device-reminders](../m1-device-reminders/plan.md) (chung auth).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] **AC1** - Backend ghi 1 `NotificationLog` cho mỗi uid mỗi lần gửi (Tuya + FCM): title/body/provider/status/sentAt.
  Có test (send → có bản ghi).
- [ ] **AC2** - Auth per-user: request đọc/sửa history phải chứng thực uid; uid A **không** đọc được history uid B (403).
  Có test guard.
- [ ] **AC3** - `GET /me/notifications` trả history của đúng user, phân trang, mới nhất trước. Có test.
- [ ] **AC4** - Mark-read + xoá per-item, chỉ trên history của mình. Có test.
- [ ] **AC5** - Mobile NotificationsScreen đọc backend history → hiện tin **cả FCM lẫn Tuya**; unread/read; refresh +
  load-more + xoá. tsc/eslint/jest xanh.
- [ ] **AC6 (device)** - E2E: admin gửi (FCM) → app hiện tin trong Notifications. Chặn bởi build + auth thật.

## 4. Các bước thực hiện
1. **B1 - Research + CHỐT auth mobile→backend per-user** *(blocker; DÙNG CHUNG reminders)*
   - Việc: `/tuya-research` xem App SDK có token verify server-side qua Tuya Cloud không. Nếu **không** → chốt
     phương án: **backend-issued JWT** - app đổi chứng-cứ-Tuya lấy JWT ngắn hạn của backend (ký bằng secret backend),
     dùng làm bearer cho `/me/*`. Verify chứng-cứ-Tuya bằng cách khả thi nhất tìm được (session token / re-login
     check). Ghi quyết định vào context.
   - File: `docs/research/tuya-app-session-verification.md` (mới).
   - Test: N/A (research có cite).

2. **B2 - Implement auth mobile→backend (`MobileAuthModule`)** *(DÙNG CHUNG reminders)*
   - Việc: endpoint đổi token (`POST /mobile-auth/session`) → trả JWT; `MobileAuthGuard` verify JWT → gắn `req.uid`.
   - File: `apps/backend/src/mobile-auth/*` (module + guard + service).
   - Test: jest - token hợp lệ → pass + đúng uid; sai/hết hạn → 401.

3. **B3 - Prisma `NotificationLog` + migration**
   - Việc: model (id, tuyaUid, title, body, provider `tuya|fcm`, status, sentAt, readAt?, index tuyaUid+sentAt).
   - File: `prisma/schema.prisma`, migration mới.
   - Test: `prisma generate` OK.

4. **B4 - Ghi log khi gửi (cả 2 provider)**
   - Việc: sau khi router gửi, ghi `NotificationLog` per-uid (title/body/provider/status). Đặt ở
     `NotificationRouterService` hoặc service bọc → không lặp ở từng provider.
   - File: `src/notifications/providers/notification-router.service.ts` (+ service log), `notifications.module.ts`.
   - Test: jest - gửi tuya/fcm → tạo bản ghi đúng provider + status per uid.

5. **B5 - Endpoints per-user (bọc MobileAuthGuard)**
   - Việc: `GET /me/notifications?page` (paged, desc), `POST /me/notifications/:id/read`, `DELETE /me/notifications/:id`.
     Chỉ thao tác trên bản ghi có `tuyaUid == req.uid`.
   - File: `src/notifications/me-notifications.controller.ts` (+ service).
   - Test: jest - trả đúng history mình; 404/403 khi đụng bản ghi người khác.

6. **B6 - Mobile: đọc backend history**
   - Việc: client `services/messages.ts` (hoặc mới) đọc `/me/notifications` (kèm JWT từ B2); NotificationsScreen giữ UI,
     đổi nguồn; giữ mock cho dev. Read/delete gọi backend.
   - File: `apps/mobile/src/services/messages.ts`, `services/api.ts`/mobile-auth client, `screens/NotificationsScreen.tsx`.
   - Test: jest - map response; read/delete gọi đúng path; nhánh mock.

7. **B7 - Verify + E2E (device defer)** - tsc/eslint/jest cả backend+mobile; E2E gửi→hiện chờ build+auth thật.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Auth mobile→backend per-user = crux + chưa chắc** (Tuya session verify server-side). Nếu bất khả → JWT
  backend-issued qua exchange, nhưng vẫn cần điểm tin cậy ban đầu để verify Tuya. **B1 quyết**. → Nền này **mở khoá
  luôn `m1-device-reminders`**.
- ⚠️ **History chỉ có tin gửi QUA BACKEND.** Tuya device-alarm/family (Message Center) không qua backend → inbox sẽ
  thiếu mấy loại đó. ❓Có cần merge Tuya MC vào không (giữ getMessageList + gộp)? → xác nhận lúc B6.
- ⚠️ **Privacy**: history cá nhân → auth phải thật (không api-key chung). Log body ở DB = dữ liệu người dùng ở EU.
- ⚠️ **Ghi log khi gửi ALL**: gửi "tất cả" = N bản ghi/lần → cân nhắc batch insert (`createMany`).
- ⚠️ Ràng buộc dự án: EU residency, secret server-only, RN CLI.
