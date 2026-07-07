# Context: Push Notification server→app qua Firebase FCM

> File "trí nhớ" - giữ context xuyên suốt các phiên. Append theo thời gian.

- **Slug:** `m3-push-fcm`

## Quyết định kỹ thuật (Decision log)
- **2026-07-02** - Endpoint đăng ký token bảo vệ bằng **API key dùng chung + tin `tuyaUid` từ app (MVP)**.
  Lý do: mobile không có phiên Supabase, chỉ có phiên Tuya SDK; verify phiên Tuya server-side phức tạp +
  dính bug DC. Đã cân nhắc & loại: verify Tuya session (chậm/phức tạp), Supabase Auth cho mobile (mở scope,
  trái "Tuya=identity M1"). Rủi ro: spoof uid → siết sau.
- **2026-07-02** - Làm **cả Android + iOS** ngay (user chọn). iOS cần APNs .p8 + Apple Dev Program + Mac →
  có thể deferred phần device verify.
- **2026-07-02** - Kênh FCM **tách riêng** khỏi `m1-admin-push` (Tuya Cloud App Push). Lý do: 2 cơ chế khác nhau.
- **2026-07-02** - Hiển thị foreground dùng **@notifee/react-native** (FCM messaging không tự hiện noti khi app mở);
  gửi server dùng **firebase-admin** (HTTP v1, không dùng server key legacy).

## Bản đồ file/module (dự kiến)
| File / Module | Vai trò |
|---|---|
| `apps/backend/prisma/schema.prisma` | +model `PushToken` (@@map push_tokens) |
| `apps/backend/src/push/firebase.provider.ts` | Init firebase-admin 1 lần từ service account (env) |
| `apps/backend/src/push/api-key.guard.ts` | Guard `x-api-key` == PUSH_API_KEY (endpoint user-facing) |
| `apps/backend/src/push/push-tokens.controller.ts` | POST/DELETE `/push/tokens` (ApiKeyGuard) |
| `apps/backend/src/push/push-tokens.service.ts` | upsert/remove/listByUid qua Prisma |
| `apps/backend/src/push/push.service.ts` | `sendToUid` qua firebase-admin + prune token chết |
| `apps/backend/src/push/push.controller.ts` | Endpoint gửi (AdminAuthGuard) để test |
| `apps/backend/src/config/env.validation.ts` | +FCM_* + PUSH_API_KEY |
| `apps/mobile/src/services/push.ts` | permission/getToken/onTokenRefresh/register/unregister + mock |
| `apps/mobile/src/services/api.ts` | client mobile→backend (x-api-key) |
| `apps/mobile/index.js` | setBackgroundMessageHandler (quit/background) |
| `apps/mobile/src/state/useAuth.ts` | onAuthed→register, signOut→unregister |
| `apps/mobile/android/*`, `apps/mobile/ios/*` | google-services.json/plist, gradle plugin, APNs, permissions |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- Backend hiện **chỉ có `AdminAuthGuard`** (Supabase admin) - không có guard user-facing → phải thêm `ApiKeyGuard`.
- Mobile **chưa có** bất kỳ API client / base URL nào tới backend → dựng mới `services/api.ts`.
- Mobile **chưa có** dep firebase/messaging/notifee.
- `AuthUser.uid` = Tuya uid (auth.ts:23 mapUser). Mock uid='mock-uid' khi native vắng → map dev không dùng để gửi thật.
- Prisma đã có `DeviceMapping(tuyaUid,...)` → theo cùng convention đặt `tuyaUid String` (không FK sang bảng user vì user ở Tuya, không ở DB).
- FCM độc lập Tuya DC → không dính bug Central/Western EU [[tuya-dc-mismatch-central-vs-western-eu]]. Nhưng uid map phải là uid thật.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Research liên quan: - (không đụng Tuya SDK; tham chiếu docs RN Firebase + Notifee official)
- Feature liên quan: `m1-admin-push` (Tuya Cloud push - kênh khác), `m1-mobile-auth` (uid), `m3-filter-reminder`/`m3-into-the-cold` (nội dung noti)

## Findings phát sinh (khi code)
- **firebase-admin v14** dùng **modular subpath import** (`firebase-admin/app`, `firebase-admin/messaging`);
  namespace import `import * as admin` KHÔNG có `.messaging/.apps/.credential` → tsc fail. Đã đổi sang
  `initializeApp/cert/getApps` + `getMessaging`.
- `getCurrentUser()` trả `AuthUser | null` → guard `u?.uid` trước `syncPushToken`.
- Mobile jest full **70/70** (appleAuth.test giờ pass - dep đã có sau các commit pull/`npm install`).
- Chốt API_BASE_URL tạm `https://walrus-cb-backend.vercel.app` (cần xác nhận URL deploy thật) + PUSH_API_KEY để trống (điền khi có).

## Tóm tắt khi hoàn thành (điền lúc FINISH)
Đường ống FCM XONG ở lớp code + verify JS. Backend: bảng `push_tokens` (Supabase, đã migrate) + module `push`
(đăng ký/gỡ token qua `ApiKeyGuard`, gửi `sendToUid` qua firebase-admin + prune token chết, endpoint send admin-guard).
Mobile: `services/push.ts`+`api.ts` (require-guard mock fallback), wire `useAuth` (login→register, logout→unregister,
onTokenRefresh), handler foreground(Notifee)/background/quit(index.js) + tap-routing (`routeFromData`). Verify:
backend jest 29/29, mobile jest 70/70, tsc+eslint sạch cả 2. **Còn nợ (BLOCKED device/toolchain):** native config thật
(google-services.json/plist, gradle plugin, APNs .p8, pods - `PUSH_SETUP.md`) + B8 E2E trên Android/iOS + điền env thật.
Rủi ro đã ghi: API key tin uid (spoof) - siết sau.
