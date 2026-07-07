# Kế hoạch: Push Notification server→app qua Firebase FCM (+ map token ↔ Tuya uid)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m3-push-fcm`
- **Milestone:** M3 (Thông báo đẩy qua Firebase - docs/TÀI-LIỆU-2 dòng 35)
- **Phần liên quan:** mobile (RN CLI) + backend (NestJS) + DB (Supabase/Prisma)
- **Ngày tạo:** 2026-07-02
- **Cập nhật lần cuối:** 2026-07-02

## 1. Mục tiêu & phạm vi
Dựng đường ống đẩy thông báo **từ server (NestJS) → app RN qua Firebase FCM**:
hiển thị noti khi app **foreground**, **background** và **quit**; kèm cơ chế
**lưu FCM device token map với Tuya user id** (đăng ký lúc login, cập nhật
`onTokenRefresh`, gỡ khi logout), lưu ở Supabase. Backend gửi qua **Firebase
Admin SDK** (service account server-only). Hỗ trợ **Android + iOS (APNs)**.

**Quyết định chốt với user (2026-07-02):**
- Endpoint đăng ký token bảo vệ bằng **API key dùng chung + tin `tuyaUid` từ app (MVP)**.
  Ghi nhận rủi ro spoof uid → siết sau (verify phiên Tuya / Supabase JWT). KHÔNG chặn M3.
- Làm **cả Android + iOS ngay** (iOS cần APNs .p8 + Apple Developer Program + build Mac).

**Ngoài phạm vi (không làm trong feature này):**
- **Nội dung & trigger** noti cụ thể (nhắc dọn bộ lọc, cảnh báo trạng thái, daily summary)
  → thuộc `m3-filter-reminder` / `m3-into-the-cold` / logic nghiệp vụ riêng. Feature này chỉ dựng
  **đường ống + hiển thị + map token** (gửi được 1 noti test tới đúng user là đạt).
- Push qua **Tuya Cloud App Push** (kênh khác) → đã có ở `m1-admin-push`. Đây là kênh FCM độc lập.
- Siết bảo mật endpoint (verify session thật) → follow-up sau MVP.

## 2. Bối cảnh & ràng buộc
- **Chưa có kênh mobile→backend:** mobile không có API client/base URL; mọi endpoint backend
  hiện chỉ `AdminAuthGuard` (Supabase admin). → feature này thêm `services/api.ts` (mobile) +
  `ApiKeyGuard` (backend) cho endpoint user-facing.
- **Định danh:** `AuthUser.uid` = Tuya uid ([apps/mobile/src/services/auth.ts](../../apps/mobile/src/services/auth.ts)).
  Map dựa trên uid này. Tuya = identity (M1) - không dùng Supabase session ở mobile.
- **RN CLI (không Expo):** dùng `@react-native-firebase/app`+`messaging` (wire native 2 nền tảng) +
  `@notifee/react-native` để **hiển thị foreground** (FCM messaging KHÔNG tự hiện noti khi app đang mở).
- **Secrets (ràng buộc cứng):** Firebase **service account JSON / private key** + **PUSH_API_KEY**
  chỉ ở **server/native**, KHÔNG trong JS bundle/repo. `google-services.json` (Android) &
  `GoogleService-Info.plist` (iOS) là app-config → **gitignore** (per security-secrets checklist).
  Dùng **FCM HTTP v1 / firebase-admin** (server key legacy đã khai tử).
- **DB Supabase** dùng Prisma ([apps/backend/prisma/schema.prisma](../../apps/backend/prisma/schema.prisma)) - migration
  trên DB dùng chung → **xác nhận trước khi apply** (project convention).
- FCM độc lập với Tuya DC (Central/Western EU) → không dính bug DC; nhưng uid map phải là uid Tuya
  thật (login thật), không phải mock.
- **Không đụng Tuya SDK** → không cần `/tuya-research`. Tham chiếu docs chính thức RN Firebase + Notifee khi code.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] **AC1** - Khi login: app xin quyền noti (iOS + Android 13+), lấy FCM token, **POST lên backend**
  `{tuyaUid, token, platform}`; `onTokenRefresh` → cập nhật; logout → **DELETE** token. (verify: jest mock messaging+api; log/DB.)
- [ ] **AC2** - Bảng Supabase `push_tokens` map `tuyaUid ↔ token ↔ platform`, `token` unique, upsert idempotent
  (đăng ký lại không nhân bản). (verify: migration applied + jest service upsert.)
- [ ] **AC3** - Backend gửi qua `firebase-admin` tới **tất cả token của 1 tuyaUid**; token chết (`messaging/registration-token-not-registered`) bị **prune** khỏi DB. (verify: jest với firebase-admin mock.)
- [ ] **AC4** - Noti **hiển thị khi app FOREGROUND** (Notifee) trên **Android + iOS**. (verify: device checklist.)
- [ ] **AC5** - Noti **hiển thị khi app BACKGROUND và QUIT** trên **Android + iOS**. (verify: device checklist.)
- [ ] **AC6** - **Tap noti → điều hướng** đúng màn (vd device-detail / màn thông báo). (verify: handler unit + device.)
- [ ] **AC7** - Secrets đúng chỗ: service account/private key + PUSH_API_KEY chỉ server/native; `google-services.json`
  + `GoogleService-Info.plist` **gitignored**; grep repo sạch. (verify: `git check-ignore` + grep.)
- [ ] **AC8** - `tsc`+`eslint`+`jest` của backend & mobile XANH. (verify: chạy thật.)

## 4. Các bước thực hiện
1. **B1 - DB: model `PushToken` + migration Supabase**
   - Việc: thêm `model PushToken { id, tuyaUid, token @unique, platform, createdAt, updatedAt }` (`@@map("push_tokens")`);
     tạo migration; **xác nhận trước khi apply** lên DB chung.
   - File: `apps/backend/prisma/schema.prisma`, `prisma/migrations/*`.
   - Test: `prisma validate` + `prisma migrate` (hoặc SQL apply) - confirm.

2. **B2 - Backend: Firebase Admin init + env + `ApiKeyGuard`**
   - Việc: thêm env `FCM_PROJECT_ID/FCM_CLIENT_EMAIL/FCM_PRIVATE_KEY` (hoặc `FCM_SERVICE_ACCOUNT_JSON`) + `PUSH_API_KEY`
     vào [env.validation.ts](../../apps/backend/src/config/env.validation.ts); provider khởi tạo `firebase-admin` 1 lần;
     `ApiKeyGuard` so header `x-api-key` với `PUSH_API_KEY`.
   - File: `config/env.validation.ts`, `push/firebase.provider.ts`, `push/api-key.guard.ts`, cài `firebase-admin`.
   - Test: jest boot provider (mock) + guard 401/200.

3. **B3 - Backend: `push` module - đăng ký/gỡ token**
   - Việc: `PushTokensController` (POST `/push/tokens`, DELETE `/push/tokens`) dùng `ApiKeyGuard`;
     `PushTokensService` upsert theo `token` (unique) + xoá + `listByUid` qua Prisma.
   - File: `push/push.module.ts`, `push/push-tokens.controller.ts`, `push/push-tokens.service.ts`, `push/dto/*`.
   - Test: jest service upsert idempotent + delete; controller guard.

4. **B4 - Backend: gửi FCM (`PushService.sendToUid`) + prune token chết**
   - Việc: `sendToUid(uid, {title,body,data})` → lấy tokens → `admin.messaging().sendEachForMulticast` →
     prune token lỗi not-registered; endpoint gửi (dùng `AdminAuthGuard`) để admin/web test gửi tới 1 uid.
   - File: `push/push.service.ts`, `push/push.controller.ts` (send, admin-guard), spec.
   - Test: jest với firebase-admin mock (multicast + prune); guard.

5. **B5 - Mobile: cài deps + wire native (Android + iOS)**
   - Việc: cài `@react-native-firebase/app`,`@react-native-firebase/messaging`,`@notifee/react-native`;
     Android `google-services.json` + gradle plugin; iOS `GoogleService-Info.plist` + `AppDelegate` + **APNs .p8** +
     pods; quyền `POST_NOTIFICATIONS` (Android 13+), iOS `UIBackgroundModes: remote-notification`. Gitignore plist/json.
   - File: `apps/mobile/android/*`, `apps/mobile/ios/*`, `package.json`, `.gitignore`, `PUSH_SETUP.md`.
   - Test: `tsc`; build (có thể BLOCKED thiếu Mac/APNs → đánh dấu deferred); `git check-ignore`.

6. **B6 - Mobile: `services/push.ts` + `services/api.ts` + wire useAuth**
   - Việc: `api.ts` (POST/DELETE tới backend kèm `x-api-key`, base URL từ config); `push.ts`
     (`requestPermission`, `getToken`, `onTokenRefresh`, `registerToken(uid)`, `unregisterToken()`);
     nối `useAuth.onAuthed → registerToken(uid)`, `signOut → unregisterToken()`. Mock fallback khi native vắng.
   - File: `apps/mobile/src/services/{push,api}.ts`(+test), `src/state/useAuth.ts`, `src/config/*`.
   - Test: jest mock messaging + fetch (register/refresh/unregister); `tsc`.

7. **B7 - Mobile: handler foreground/background/quit + tap-routing**
   - Việc: foreground `messaging().onMessage → notifee.displayNotification`; background/quit
     `messaging().setBackgroundMessageHandler` (đăng ký trong `index.js`) + `notifee` background event;
     `getInitialNotification` + `onNotificationOpenedApp` → `navigate(...)` theo `data`.
   - File: `apps/mobile/index.js`, `src/services/push.ts`, `App.tsx` (route theo initial noti).
   - Test: jest logic handler (map data→screen); device checklist ở B8.

8. **B8 - E2E device verify (Android + iOS)**
   - Việc: gửi từ backend → xác nhận hiển thị ở foreground/background/quit + tap điều hướng, cả 2 nền tảng.
   - Test: **manual device checklist** (BLOCKED: cần thiết bị thật, google-services/plist thật, APNs .p8, Mac cho iOS).

## 5. Rủi ro & câu hỏi mở
- ⚠️ **iOS APNs BLOCKED tiềm tàng:** cần Apple Developer Program + APNs auth key `.p8` + build Mac (đang là
  blocker ở `m1-mobile-apple-login`). → làm code + Android verify trước; iOS đánh dấu deferred cho tới khi có.
- ⚠️ **Foreground Android** phải dùng Notifee để hiện noti (messaging không tự hiện) - nhớ tạo channel.
- ⚠️ **API key dùng chung tin uid** → ai có key mạo được uid (poison mapping / spam noti). Đã chấp nhận MVP;
  follow-up: verify phiên Tuya server-side hoặc Supabase JWT.
- ⚠️ **Migration Supabase dùng chung** → confirm trước khi apply (đừng reset).
- ❓ **Nguồn trigger noti** (cron nhắc dọn? admin thủ công? sự kiện thiết bị?) - ngoài phạm vi; chốt ở feature nội dung.
- ❓ Có tái dùng UI/flow của `m1-admin-push` (admin gửi) cho kênh FCM không, hay tách riêng? (đề xuất: tách; admin-push=Tuya Cloud, cái này=FCM.)
