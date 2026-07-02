# Progress: Push Notification server→app qua Firebase FCM

> `/dev`, `/test`, `/fix-plan` đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m3-push-fcm`
- **Phase hiện tại:** `TEST` (code B1–B7 XONG; còn B8 device verify + native config thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
Code B1–B7 XONG + verify JS: backend `tsc`+`jest` 29/29+eslint clean; mobile `tsc`+`jest` **70/70**+eslint 0 err.
**Còn nợ (BLOCKED thiết bị/toolchain):** B5 native config thật (`google-services.json`/`GoogleService-Info.plist`,
gradle plugin, APNs .p8, pods — xem `apps/mobile/PUSH_SETUP.md`) + **B8** E2E device (fg/bg/quit + tap) trên
Android & iOS. Cần điền `API_BASE_URL`/`PUSH_API_KEY` (mobile) + `FCM_*`/`PUSH_API_KEY` (backend .env).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 — DB: model `PushToken` + migration Supabase · done (migration `20260702210736_add_push_tokens` ĐÃ apply, user confirm)
- [x] B2 — Backend: Firebase Admin init + env + `ApiKeyGuard` · done (firebase.provider modular import + api-key.guard timing-safe + env)
- [x] B3 — Backend: `push` module đăng ký/gỡ token · done (PushTokensController/Service + dto + upsert idempotent)
- [x] B4 — Backend: gửi FCM `sendToUid` + prune token chết · done (PushService multicast + prune + PushController admin-guard; spec 3/3)
- [~] B5 — Mobile: cài deps + wire native · deps CÀI XONG (@rnfirebase/app+messaging, @notifee) + gitignore google-services.json + `PUSH_SETUP.md`; **native config thật + APNs = BLOCKED device**
- [x] B6 — Mobile: `services/push.ts`+`api.ts` + wire useAuth · done (require-guard mock fallback; onAuthed→sync, signOut→remove, bootstrap→sync; api.test+push.test 9/9)
- [x] B7 — Mobile: handler foreground/background/quit + tap-routing · done (onMessage→Notifee; index.js setBackgroundMessageHandler; App onNotificationTap+getInitialRoute; `routeFromData` thuần test)
- [ ] B8 — E2E device verify (Android + iOS) · BLOCKED (thiết bị + google-services/plist thật + APNs .p8 + Mac)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 — login lấy token+POST; onTokenRefresh; logout DELETE · JS ✅ (push.ts+useAuth; test). Device: chờ B8.
- [x] AC2 — bảng `push_tokens` uid↔token↔platform, token unique, upsert idempotent · ✅ (migration applied + upsert)
- [x] AC3 — gửi tới mọi token của 1 uid + prune token chết · ✅ (PushService multicast+prune; spec 3/3)
- [~] AC4 — noti FOREGROUND (Notifee) · code ✅; **device verify chờ B8**
- [~] AC5 — noti BACKGROUND+QUIT · code ✅ (setBackgroundMessageHandler); **device verify chờ B8**
- [~] AC6 — tap noti → điều hướng · code ✅ (`routeFromData`+wire); **device verify chờ B8**
- [x] AC7 — secrets đúng chỗ; google-services.json + plist gitignored (git check-ignore ✅); FCM key server-only · ✅
- [x] AC8 — tsc+eslint+jest backend(29/29) & mobile(70/70) XANH · ✅

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-02 | TEST B5–B7 | ✅ | mobile `tsc` clean (fix u?.uid null) · `jest` **70/70** (api.test 3 + push.test 6 mới) · eslint 0 err. google-services.json gitignored + PUSH_SETUP.md. |
| 2026-07-02 | DEV B5–B7 | ✅ | cài @rnfirebase/app+messaging+@notifee. `services/api.ts`+`config/api.ts` (x-api-key). `services/push.ts` (require-guard: permission/getToken/sync/refresh/remove + displayNotification/onForegroundMessage/onNotificationTap/getInitialRoute + `routeFromData`). Wire useAuth (onAuthed/bootstrap→sync, signOut→remove). index.js setBackgroundMessageHandler. App onMessage+tap+initialRoute. |
| 2026-07-02 | TEST B2–B4 | ✅ | backend `tsc` clean · `jest` 29/29 (push spec 3/3) · `eslint` clean (prettier --fix). Fix: firebase-admin v14 dùng modular subpath import (`firebase-admin/app`+`/messaging`). |
| 2026-07-02 | DEV B2–B4 | ✅ | env FCM_*+PUSH_API_KEY · firebase.provider (init 1 lần, null khi thiếu creds) · ApiKeyGuard (timing-safe) · PushTokensService (upsert idempotent theo token unique + prune) · controllers (tokens: ApiKeyGuard; send: AdminAuthGuard) · PushModule vào app.module · .env.example. |
| 2026-07-02 | DEV/TEST B1 | ✅ | model `PushToken` (push_tokens, token unique, index tuyaUid) · migration `add_push_tokens` **ĐÃ apply lên Supabase** (user confirm; Central EU) · prisma generate · tsc clean. |
| 2026-07-02 | PLAN | ✅ | Tạo plan/context/progress. Chốt: API key+tin uid (MVP) · Android+iOS · kênh FCM tách m1-admin-push · Notifee foreground · firebase-admin. |

## Vấn đề đang chặn (Blockers)
- (tiềm ẩn) B5/B8 iOS: APNs .p8 + Apple Dev Program + Mac (như apple-login). B8 cần thiết bị thật + google-services/plist thật.
