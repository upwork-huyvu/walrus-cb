# Progress: Admin gửi thông báo tới user qua Tuya Cloud App Push (Option A)

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-admin-push`
- **Phase hiện tại:** `TEST` (code xong + jest 8/8; console ĐÃ cấu hình - còn biz_type env + template duyệt + gửi thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-03

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**CONSOLE ĐÃ CẤU HÌNH (user xác nhận 2026-07-03):** subscribe **App Push Notification** + upload push
credential **CẢ iOS (APNs) + Android (FCM)** lên Tuya console. Mobile cũng ĐÃ có màn nhận
(NotificationsScreen đọc Message Center per-user - xem [[m1-mobile-home-device-flow]] B14). Còn lại theo thứ tự:
1. **`TUYA_APP_BIZ_TYPE` CHƯA có trong `apps/backend/.env`** → lấy số biz_type từ trang service vừa
   subscribe trên console (định danh app, integer) → điền env → restart backend. Thiếu nó `sendPush` throw.
2. **Template:** check trạng thái qua admin web `/notifications/templates` (hoặc `GET /notifications/templates`);
   chưa có → tạo → **chờ Tuya duyệt ≤2 ngày** (chỉ template APPROVED gửi được).
3. **Gửi thật E2E:** admin `/notifications` → chọn user (vd `imax.dev.sn@`, uid `we...`) → gửi → mở app
   **Account → Notifications** xem tin hiện (in-app KHÔNG cần FCM - tin lưu Message Center).
4. **(M3 `m3-push-fcm`) System push ngoài màn hình:** console ĐÃ up FCM/APNs cert; còn PHÍA APP:
   tích `google-services.json` + `firebase-messaging` + gọi `registerDevice(token,'fcm')` (bridge đã wire) + rebuild.
⚠️ Backend đang chạy DC **Western Europe** (`openapi-weaz.tuyaeu.com`) - subscribe/authorize service phải
trên đúng project walrus + DC này.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Backend: config + DTO + types · done (code; tsc defer)
- [x] B2 - Backend: `NotificationsService` (sendPush + template) · done (code + spec; jest defer)
- [x] B3 - Backend: Controller + Module + wire AppModule · done (code; tsc defer)
- [x] B4 - Admin: server action gửi push · done (`lib/api.ts` tự tạo + `notifications/actions.ts`)
- [x] B5 - Admin: trang `/notifications` (UI gửi + parse `${var}`) · done (page+SendPushForm+layout+proxy+nav)
- [x] B6 - Admin: quản lý template · done (templates page+CreateTemplateForm+actions+nav)
- [x] B+ - (ngoài plan) `lib/auth.ts` (login/logout) - vá blocker `m1-admin-web` theo yêu cầu user

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [~] AC1 - `POST /notifications/push` gọi Tuya push + biz_type config · code+spec xong; **chạy jest defer**
- [~] AC2 - quản lý template (list/detail/create) map đúng path · code+spec xong; **chạy jest defer**
- [~] AC3 - DTO validate + serialize `template_param` · code+spec xong (test serialize có); **chạy jest defer**
- [~] AC4 - Admin `/notifications`: chọn template + điền `${var}` + gửi + hiện send_status; proxy bảo vệ · **code xong**; build defer
- [ ] AC5 - `tsc`+`jest` backend pass; `tsc`/`next build` admin pass - **defer (no node_modules + E503)**; admin còn chặn bởi `@/lib/auth` thiếu
- [ ] AC6 - (live, **BLOCKED**) gửi thật, user nhận push - chờ điều kiện ngoài + M3

## Nhật ký chạy (Run log) - mới nhất ở trên
> Mỗi lần DEV/TEST/FIX-PLAN ghi 1 dòng: thời gian · bước · kết quả · ghi chú.

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
| 2026-07-04 | **FIREBASE WIRED + APK BUILD XANH** | ✅ | User đưa `google-services.json` (project `walrus-wellness-f1235`, package khớp) → copy `android/app/` (gitignored; bản gốc `docs/fire-base/`). Wire plugin `com.google.gms:google-services:4.4.2` (root classpath + app apply). Fix: (1) manifest merger conflict meta-data `default_notification_channel_id` với lib messaging → `tools:replace`; (2) +`POST_NOTIFICATIONS` permission; (3) `ensureNotificationChannel()` lúc boot + wire `listenTokenRefresh` vào App (trước đó quên). `npm install` firebase deps (2/2). ⚠️ iCloud dupes lần này **66 file** (cả trong `node_modules/*/android/build/`) → purge toàn repo `find . -name "* 2.*" -delete`. **`assembleDebug` BUILD SUCCESSFUL** (APK 167MB, 14:30). CÒN: cài máy (device rớt kết nối) → login → verify logcat `registerDevice` token với Tuya → chờ template duyệt → gửi E2E. |
| 2026-07-03 | **REV 2 (OPTION A) IMPLEMENT XONG** | ✅ | User chốt Option A sau research 4 doc API. **B1'** [app-info.service.ts](../../apps/backend/src/tuya/app-info.service.ts): `getBizType()` - env override → `GET /v1.0/apps/{schema}` parse `app_biz_type ?? appBizType` + memoize (không cache lỗi); `notifications.service` dùng thay `config.require`. **B2'** `listTemplates` phân trang (default 50, sort desc - Tuya default 10 làm mất template 11+) + DTO query + types `status: 0|1|2` + `verify_code/verify_reason` + `has_more`. **B3'** XOÁ kênh FCM trực tiếp: `src/push/*` + `PushModule` + model `PushToken` + **migration `drop_push_tokens` (đã apply DB)** + gỡ dep `firebase-admin`. **B4'** mobile [push.ts](../../apps/mobile/src/services/push.ts): token đăng ký với **Tuya** `registerDevice(token,'fcm')` (SDK map user đang login - bỏ uid param), logout = `deleteToken()` local; xoá `services/api.ts`+`config/api.ts` (client backend push-tokens); tap-route mặc định → tab `notifications` (Tuya push không có custom data); `useAuth` cập nhật. **B5'** admin templates page: badge Pending/Approved/Rejected + verify_reason. **B6'** verify: backend tsc 0 · **jest 34/34** (spec AppInfo mới: 2 casing + cache + env override + không cache lỗi) · mobile tsc 0 · eslint 0 · **jest 61/61** (push.test viết lại) · admin tsc 0. **CÒN ĐỂ CHẠY THẬT:** (a) `google-services.json` CHƯA có + plugin `com.google.gms.google-services` CHƯA wire build.gradle → Firebase native chưa init (code no-op an toàn) → cần file từ Firebase console + wire + REBUILD APK; (b) template tạo + Tuya duyệt; (c) gửi thật E2E. |
| 2026-07-03 | **CONSOLE CONFIGURED + đầu-nhận mobile XONG** | 🟡 | User xác nhận đã cấu hình Tuya console: **subscribe App Push Notification + upload cert push iOS (APNs) + Android (FCM)**. Backend jest notifications **8/8 PASS** (verify lại). Mobile đầu-nhận đã build ([[m1-mobile-home-device-flow]] B14): native `getMessageList` wired + NotificationsScreen đọc Message Center per-user - kiến trúc: admin chọn uid → backend push per-uid → Tuya Message Center per-user → app đọc SDK. **CÒN THIẾU:** (1) `TUYA_APP_BIZ_TYPE` chưa có trong `.env` (user lấy từ console); (2) template tạo + Tuya duyệt; (3) gửi thật E2E; (4) FCM phía APP (google-services + firebase-messaging + registerDevice) = M3. Phiên dừng NGAY TRƯỚC bước check `GET /notifications/templates` (user interrupt) - resume từ đó. |
|---|---|---|---|
| 2026-06-30 08:50 | DEV B6+lib/auth | ✅ | User chốt vá+làm. `lib/auth.ts` (login set cookie admin_token + logout) khớp backend `/admin/auth/login`. B6: `templates/page.tsx`+`actions.ts`+`CreateTemplateForm.tsx`+nav. **Grep xác nhận mọi import `@/...` đều resolve** → hết blocker module |
| 2026-06-30 08:35 | TEST B4–B5 | ⏸️ defer | Admin không build tại chỗ (E503 + **thiếu `@/lib/auth`** - divergence). Review tay: action signature khớp `useActionState`, parse `${var}` đúng, proxy+nav OK |
| 2026-06-30 08:33 | DEV B4+B5 | ✅ | **Divergence:** tự tạo `lib/api.ts` (plan giả định reuse nhưng thiếu). +`notifications/actions.ts`,`page.tsx`,`layout.tsx`,`SendPushForm.tsx`; sửa `proxy.ts`+`users/layout.tsx` |
| 2026-06-30 08:20 | TEST B1–B3 | ⏸️ defer | `npm install` backend → **E503** `nexus.digital.vn` (zod tgz). Không chạy được tsc/jest → review tay: import value/type, module wiring, serialize template_param đều đúng |
| 2026-06-30 08:18 | DEV B2+B3 | ✅ | service+spec (5 case: sendPush path/body/biz_type/template_param, no-params→`{}`, throw; templates list/detail/create) · controller(guard)+module+app.module |
| 2026-06-30 08:15 | DEV B1 | ✅ | `TUYA_APP_BIZ_TYPE` env · `SendPushDto`/`CreateTemplateDto` (class-validator, Length 30/40/100/100, type∈{0,1}) · `notifications.types.ts` |
| 2026-06-30 | PLAN | ✅ | Tạo plan/context/progress từ research `tuya-cloud-app-push.md`; Gate ① duyệt |

## Vấn đề đang chặn (Blockers)
- **AC6 (live)** chặn bởi **điều kiện ngoài**: chưa subscribe gói "App Push Notification Service" + chưa cấu hình
  FCM/APNs console + template chưa tạo/duyệt (≤2 ngày), và **phụ thuộc M3** (mobile chưa đăng ký push token).
  Code + unit test (mock) **không** bị chặn → đã làm.
- **Build admin (AC5)** chỉ còn chặn bởi **E503 Nexus** → không cài được node_modules để chạy `next build`/`tsc`.
  ~~Thiếu `@/lib/auth`~~ → **ĐÃ GỠ** (tạo `lib/auth.ts` theo yêu cầu user); `lib/api.ts` cũng đã tạo. Mọi import
  `@/...` đã resolve (grep xác nhận). Khi có registry là build được.
</content>
