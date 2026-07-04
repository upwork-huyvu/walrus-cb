# Kế hoạch: Admin gửi thông báo tới user qua Tuya Cloud App Push (Option A)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-admin-push`
- **Milestone:** M1 (backend M1·C + admin M1·D) — phần *giao push thật* phụ thuộc M3 (`m3-push-fcm`)
- **Phần liên quan:** backend (NestJS) + admin (Next.js)
- **Ngày tạo:** 2026-06-30
- **Cập nhật lần cuối:** 2026-06-30

## 1. Mục tiêu & phạm vi
Cho phép admin (web) gửi thông báo tới end-user qua **Tuya Cloud App Push API**, tái dùng
[`TuyaCloudService`](../../apps/backend/src/tuya/tuya-cloud.service.ts) đã ký sẵn — **không dựng Firebase riêng**.
Backend thêm module `notifications/` (gửi push + quản lý template); admin thêm trang gửi (chọn template đã
duyệt → điền biến `${var}` → chọn/nhập `uid` → gửi). Cơ chế **template-based** theo ràng buộc của Tuya.

**Ngoài phạm vi (không làm trong feature này):**
- Mobile **đăng ký push token** (FCM Android/APNs iOS) + module `TuyaPush` → thuộc **M3 / `m3-push-fcm`**.
- Việc vận hành/console: **subscribe gói "App Push Notification Service"**, cấu hình **FCM/APNs** trên Tuya
  console, **tạo & duyệt template thật** (≤2 ngày làm việc) → **điều kiện ngoài**, không phải code.
- **Broadcast hàng loạt / hàng đợi** (API chỉ nhận 1 `uid`/lần) — v1 chỉ gửi đơn lẻ; ghi ở rủi ro.
- Hiển thị **Message Center** trong app (đọc lịch sử) — không thuộc track admin/backend.

## 2. Bối cảnh & ràng buộc
- **Tuya Cloud OpenAPI**, Data Center **EU (`openapi.tuyaeu.com`)** phải khớp Cloud Project → đã cấu hình ở
  [`env.validation.ts`](../../apps/backend/src/config/env.validation.ts). Tái dùng `TuyaCloudService.request()`.
- **Secret server-only:** `TUYA_ACCESS_SECRET` không bao giờ vào admin bundle. Admin gọi **qua backend**
  (pattern proxy như `users/`), không gọi thẳng Tuya.
- **`biz_type`** = mã định danh app trong hệ Tuya (KHÔNG phải loại tin) → cần thêm config `TUYA_APP_BIZ_TYPE`.
- **Template-based + duyệt trước:** admin **không** gõ free-text gửi ngay; phải chọn template đã duyệt và điền
  biến. `type` template: `0` operations / `1` system. Giới hạn: name≤30, title≤40, content≤100, remark≤100.
- **Phụ thuộc điều kiện ngoài + M3:** chưa subscribe product / template chưa duyệt / app chưa đăng ký token →
  **không verify live được**. Giống các feature backend/admin khác trong INDEX: **code + unit test (mock) giờ,
  verify live defer** đến khi điều kiện sẵn sàng.
- **Link nghiên cứu:** [docs/research/tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md)
  (+ phía SDK nhận: [tuya-home-sdk-push-notifications.md](../../docs/research/tuya-home-sdk-push-notifications.md)).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] **AC1:** Backend có `POST /notifications/push` (bọc `AdminAuthGuard`) nhận `{uid, templateId, params?}`
      → gọi Tuya `POST /v1.0/iot-03/messages/app-notifications/actions/push` với `biz_type` từ config,
      `template_param = JSON.stringify(params)` → trả `{send_status}`. Unit test (mock `TuyaCloudService`) pass.
- [ ] **AC2:** Backend có quản lý template: `GET /notifications/templates`, `GET /notifications/templates/:id`,
      `POST /notifications/templates` — map đúng path Tuya `/v1.0/iot-03/msg-templates/app-notifications[...]`,
      bọc guard. Unit test (mock) pass.
- [ ] **AC3:** DTO validate input theo pattern DTO hiện có: `uid` bắt buộc; create-template ràng buộc độ dài
      (name≤30/title≤40/content≤100/remark≤100) + `type ∈ {0,1}`. Có test cho việc serialize `template_param`.
- [ ] **AC4:** Admin có trang `/notifications` (sau auth, qua proxy): load template từ `GET list`, chọn template,
      nhập `uid` (hoặc chọn từ `/users`), **render input theo biến `${var}`** parse từ content, gửi → hiển thị
      `send_status`. Được proxy bảo vệ (chưa đăng nhập → `/login`).
- [ ] **AC5:** `tsc` + `jest` backend pass; `tsc`/`next build` admin pass *(được defer nếu thiếu node_modules —
      ghi rõ trong progress, như các feature khác)*.
- [ ] **AC6 (live — có thể BLOCKED):** với product đã subscribe + template đã duyệt + 1 user đã đăng ký token
      → admin gửi thật, user nhận push. **Chặn bởi điều kiện ngoài + M3.**

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test.

1. **B1 — Backend: config + DTO + types**
   - Thêm `TUYA_APP_BIZ_TYPE` vào [`env.validation.ts`](../../apps/backend/src/config/env.validation.ts) (optional ở dev).
   - Tạo DTO: `SendPushDto {uid, templateId, params?}`, `CreateTemplateDto {name,title,content,type,remark}`
     (validate theo pattern `ListUsersQueryDto`). Tạo types `notifications.types.ts` (`TuyaPushResult`,
     `TuyaTemplate`, `TuyaTemplateList`).
   - File: `apps/backend/src/notifications/dto/*.ts`, `notifications/notifications.types.ts`, `config/env.validation.ts`.
   - Kiểm thử: `tsc`.
2. **B2 — Backend: `NotificationsService`**
   - `sendPush(dto)` → build body `{uid, biz_type: config, template_id, template_param: JSON.stringify(params ?? {})}`
     → `TuyaCloudService.request(POST push)`. `listTemplates()` / `getTemplate(id)` / `createTemplate(dto)` map path.
   - File: `apps/backend/src/notifications/notifications.service.ts` (+ `notifications.service.spec.ts` mock TuyaCloudService).
   - Kiểm thử: `jest` — assert method/path/body + `template_param` serialize đúng chuỗi JSON escape.
3. **B3 — Backend: Controller + Module + wire AppModule**
   - `NotificationsController('notifications')` bọc `@UseGuards(AdminAuthGuard)`; routes push + templates.
   - `NotificationsModule` import `TuyaModule` + `AdminAuthModule`; thêm vào [`app.module.ts`](../../apps/backend/src/app.module.ts).
   - File: `notifications.controller.ts`, `notifications.module.ts`, `app.module.ts`.
   - Kiểm thử: `tsc` + (tuỳ) controller spec.
4. **B4 — Admin: server action gửi push**
   - `app/notifications/actions.ts`: `sendPush(uid, templateId, params)` → `apiFetch('/notifications/push', POST)`
     (reuse `@/lib/api`), xử lý 401/403 → `/login` như [users actions](../../apps/admin/app/users/[uid]/actions.ts).
   - File: `apps/admin/app/notifications/actions.ts`.
   - Kiểm thử: `tsc`/`next build`.
5. **B5 — Admin: trang `/notifications` (UI gửi)**
   - Server component load template (`apiGet('/notifications/templates')`); client `SendPushForm`: chọn template,
     nhập `uid`, **parse `${var}` từ content → render input động**, submit → action → hiện `send_status`.
   - Thêm nav link ([`layout.tsx`](../../apps/admin/app/layout.tsx)) + bảo vệ route trong [`proxy.ts`](../../apps/admin/proxy.ts) (matcher `/notifications/:path*`).
   - File: `apps/admin/app/notifications/page.tsx`, `apps/admin/components/SendPushForm.tsx`, `app/layout.tsx`, `proxy.ts`.
   - Kiểm thử: `next build`.
6. **B6 — (tuỳ) Admin: quản lý template**
   - Trang tạo template (`POST`) + xem **trạng thái duyệt** (`GET detail`). Có thể làm sau / tách nếu hết thời gian.
   - File: `apps/admin/app/notifications/templates/*`.
   - Kiểm thử: `next build`.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Verify live bị chặn** đến khi: subscribe product + template duyệt xong + app đăng ký token (M3). → Làm
  code + unit test (mock) trước, đánh dấu AC6 BLOCKED.
- ⚠️ **Template phải duyệt ≤2 ngày**, không free-text gửi-ngay → UI theo hướng *chọn template + điền biến*. Nếu
  cần "thông báo chung tự do" thì phải tạo trước template có biến `${message}` (❓nội dung biến có bị review từng
  lần không — cần xác minh).
- ⚠️ **Gửi 1 `uid`/lần** → broadcast = loop N lần; v1 không làm hàng loạt/hàng đợi (rate limit chưa rõ).
- ⚠️ **Chi phí gói "App Push Notification Service"** chưa rõ → ảnh hưởng ngân sách M1 (đang ET lại). Cần xác nhận.
- ❓ **Giá trị `biz_type` thật** của app (lấy từ Cloud Platform sau khi subscribe) — cần để gửi.
- ❓ **Cú pháp/ràng buộc biến `${var}`** cho free-template app-notification (có phải khai báo biến khi tạo template?).
- ❓ **Backend có dùng `class-validator`** cho DTO không (xác nhận khi đụng `ListUsersQueryDto` ở B1) để chọn cách validate.
</content>
---

## Rev 2 (2026-07-03) — OPTION A: thuần Tuya App Push, bỏ kênh FCM trực tiếp

> Nguồn: research 4 doc API (Send Push `571df1f27e` · Add template `db8cac79e4` · Template detail
> `9dc9d8c906` · Template list `d42a2cefb7`) + Get App Details `0ebeab240f`. User chốt Option A.
> Phán quyết: **biz_type KHÔNG cần env** — query `GET /v1.0/apps/{schema}` → `app_biz_type`
> (⚠️ example doc ghi camelCase `appBizType` → parse cả hai). Template quản lý full qua API
> (status 0 đang duyệt / 1 pass / 2 fail + `verify_reason`).
> Trade-off chấp nhận: mất deep-link data tap-routing (App Push không có custom data field);
> mọi tin qua template đã duyệt. Tuya = sender đẩy banner qua cert FCM/APNs đã up console;
> app CHỈ đăng ký token với Tuya (`registerDevice(token,'fcm')` — bridge đã wire).

### Các bước Rev 2
1. **B1' — Backend: runtime biz_type** — `src/tuya/app-info.service.ts` (`getBizType()`: env override
   `TUYA_APP_BIZ_TYPE` → nếu không, GET `/v1.0/apps/{schema}` parse `app_biz_type ?? appBizType`,
   memoize); wire `tuya.module`; `notifications.service` dùng nó; env thành optional.
2. **B2' — Backend: templates pagination + types** — `listTemplates({page_no,page_size=50,sort=1})`;
   `TuyaTemplate.status: 0|1|2` + `verify_code/verify_reason`; `has_more`.
3. **B3' — Backend: XOÁ kênh FCM trực tiếp** — xoá `src/push/*`, gỡ `PushModule` khỏi `app.module`,
   drop model `PushToken` + prisma migration, gỡ dep `firebase-admin`.
4. **B4' — Mobile: token → Tuya** — `services/push.ts`: `syncPushToken` → `Tuya.registerDevice(token,'fcm')`
   (bỏ gọi backend /push-tokens); logout → `messaging().deleteToken()` (bridge `unregisterDevice` đang stub);
   tap-routing mặc định về tab `notifications` (không còn data payload). Giữ Notifee foreground.
5. **B5' — Admin UI** — badge trạng thái duyệt (0/1/2 + verify_reason khi fail); form gửi chỉ list
   template `status===1`.
6. **B6' — Verify** — backend jest (mock AppInfo: 2 casing + cache) + mobile tsc/eslint/jest.
7. **B7' — Live (chờ console/duyệt)** — curl Get App Details xác nhận casing; tạo template → duyệt;
   gửi thật → banner + message center. Console: authorize API product vào project (App Push + nhóm
   App Management) — thiếu → `28841105/1106`.
