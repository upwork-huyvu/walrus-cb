# Context: Sửa quản lý thông báo

> File "trí nhớ" - giữ context xuyên suốt các phiên. Ghi quyết định, phát hiện, cạm bẫy.

- **Slug:** `m1-fix-notifications`

## Quyết định kỹ thuật (Decision log)

- **2026-07-13** - **Local per-user read-set là nguồn read-state chính; markRead server chỉ best-effort.**
  Lý do: native `markMessagesRead` iOS thật nhưng **Android best-effort**, và backend `notification_logs`
  **không có cột read** → không thể dựa server. Đã cân nhắc & loại: (a) dựa hoàn toàn `hasNotRead` của Tuya
  (Android không đáng tin + FCM không vào Tuya center); (b) thêm cột read ở backend (ngoài scope, DB migration).

- **2026-07-13** - **Bỏ read-model timestamp, chuyển sang tập id đã đọc.** Lý do: timestamp `ts > lastReadAt`
  giòn (phụ thuộc parse thời gian đúng - mà Hermes làm hỏng) và không phân biệt được từng noti. Tập id ổn định,
  không phụ thuộc parse. Đã cân nhắc & loại: giữ timestamp nhưng sửa parse (vẫn giòn với noti cùng-phút, và không
  giải quyết #2 per-user).

- **2026-07-13** - **#1 không sửa bằng refetch-on-focus.** Lý do: router `switch(screen)` **remount** màn mỗi lần
  vào → `load()` đã chạy lại. Trọng tâm #1 = parse (ts=0) + xác minh delivery, không phải on-focus.

- **2026-07-13 (sau workflow)** - **ĐỔI chẩn đoán + reorder plan.** Workflow phản biện đã LOẠI 2 giả thuyết gốc của tao:
  (1) #1 KHÔNG do parse Hermes (noti FCM ts đúng) mà do **FCM-history rỗng** (token/key/config); (2) #2 KHÔNG có cơ
  chế xác định trong code cho cùng-tài-khoản → **diagnostic-first (B1) trước khi fix**. → parse demote (B5, chỉ Tuya
  channel); badge-refresh (#3) + read-set (per-user) là fix chắc ăn; thêm B1 device-log. **Bài học: đừng khoá root
  cause khi chưa loại hết giả thuyết - suýt fix #1 bằng parse (sai) và fix #2 mù.**

## 🔬 Kết quả workflow điều tra `notif-root-cause` (2026-07-13, provider=FCM, 10 agent + phản biện)

**#1 [CONFIRMED] KHÔNG do parse/uid.** uid linkage ĐÚNG: token-register (`push.ts` → `POST /push/tokens` body.tuyaUid)
= backend log (`notification_logs.tuyaUid`) = GET header (`x-tuya-uid` = `auth.user.uid`), join thuần, không transform.
Nguyên nhân #1 thật = **FCM-history rỗng**:
- `notification-router.service.ts:46` chỉ `record()` khi `provider==='fcm' && deliveredUids.length`;
  `push.service.ts:101` chỉ push uid vào `deliveredUids` khi `res.sent>0` (có ≥1 token sống). ⇒ gửi lúc chưa có
  token / token prune (`push.service.ts:79`) / FCM chưa config (`FIREBASE_MESSAGING=null` → sent=0) → **không log** → GET rỗng.
- `messages.ts:93` `getFcmHistory`: `PUSH_API_KEY` rỗng → return `[]` sớm (`.env.example` ship rỗng); sai key → 401 → nuốt lỗi → rỗng.

**#2 [không có cơ chế xác định trong code - phản biện LOẠI 5/6 giả thuyết]:** cùng tài khoản + FCM KHÔNG thể read→unread:
- (a) `lastReadAt` KHÔNG bị clear ở signOut/reset/bootstrap; toàn app không có `AsyncStorage.clear()/multiRemove`
  (`removeItem` duy nhất = `deviceStore.ts:25` key `'tuya.devId'`).
- (b) writer duy nhất `setLastReadNow()` (`NotificationsScreen.tsx:37`, không tham số → `Date.now()`) → đơn điệu tăng; refresh/getUnread chỉ đọc.
- (c) dupe `notificationsRead 2.ts` **giống hệt** (cùng KEY); Metro resolve `./notificationsRead` về bản gốc → không lệch module.
- (e) `m.ts > lastReadAt` đúng; (f) ts FCM từ ISO thô đúng cả Hermes.
- **(d) [medium - khả năng CÒN LẠI tầng code]:** `setLastReadNow()` **nuốt lỗi** setItem → nếu device không persist
  → `lastReadAt` kẹt 0 → **MỌI FCM luôn unread** ("always-unread", KHÔNG phải "read→unread"). Hoặc do **môi trường**
  (đổi tài khoản / storage wipe). ⇒ **B1 log device để chốt.**

**#3 [CONFIRMED]:** `App.tsx:141` `onForegroundMessage` chỉ hiện Notifee, **không** `refreshUnread` → nhận push
foreground badge không nhảy. FCM ts đúng → chỉ dính lỗi này. Tap background/quit phủ gián tiếp (AppState active).
`getMessageHasNew` (native) **wire mà không dùng**. `mergeMessages` **vứt** `hasNotRead` thật của Tuya.

**Parse Hermes [DEMOTED]:** blast radius = **chỉ item Tuya Message Center** (`mapItem` đẩy chuỗi dấu-cách → ts=0);
noti FCM (kênh chính dưới provider=FCM) KHÔNG dính. Không chỗ nào khác trong `src` dùng `new Date(spaceString)`.

**Defect thật (không gây #2):** key global không-per-user → đổi tài khoản cùng máy = kế thừa mốc đọc (đánh dấu SAI thành đã đọc).

> 📁 Full: `subagents/workflows/wf_1ca9e2ca-c31/journal.jsonl` (10 result); tóm tắt `/tmp/wf_summary.txt`.

## Quyết định của user tại Gate ① (2026-07-13)
- ✅ **Duyệt plan revise**, làm **B1 diagnostic-first** trước.
- ✅ **Backend log bền:** ghi `notification_logs` cho **MỌI uid được nhắm**, kể cả chưa có token sống lúc gửi (B4).
- ✅ **Migration read v1→v2:** lần đầu chạy bản mới → coi **mọi noti hiện có là ĐÃ ĐỌC** (badge không nổ 1 lần).

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/messages.ts` | Gộp Tuya + FCM; `whenToTs` (**BUG parse**), `mergeMessages` (**ghi đè hasNotRead theo ts**), `getMessages`, `getUnreadCount`, `deleteMessages`. |
| `apps/mobile/src/services/notificationsRead.ts` | Read-state: **1 timestamp global** `walrus.notif.lastReadAt.v1`. → viết lại thành read-set per-user (B2). |
| `apps/mobile/src/screens/NotificationsScreen.tsx` | Màn list; `load()` mỗi lần mount; `setLastReadNow()` khi mở; xoá optimistic. |
| `apps/mobile/src/screens/MeScreen.tsx` | Badge Account (dòng 77-91) - **UI đã có**, đọc prop `unread`. |
| `apps/mobile/src/components/BottomTabBar.tsx` | Badge tab account (dòng 52-70) - **UI đã có**, luôn mounted. |
| `apps/mobile/App.tsx` | `refreshUnread` (mount + `RNAppState active` + `onRead`); **`onForegroundMessage` KHÔNG refresh badge**. |
| `apps/mobile/src/services/push.ts` | FCM foreground/tap/token. |
| `apps/backend/src/notifications/notification-log.service.ts` | `record()` (ghi khi gửi FCM) · `listForUid` (GET /me/notifications) · `deleteForUid`. **Không có read.** |
| `packages/tuya-react-native` → `markMessagesRead(type, ids)` | iOS thật · **Android best-effort**. |

## Phát hiện & cạm bẫy (Findings / Gotchas)

### 🔴 Parse thời gian hỏng trên Hermes (gốc rễ, xác minh bằng test)
`new Date("2026-07-13 17:00:00")`: **V8 (Node/jest) OK** nhưng **Hermes → Invalid Date → ts=0**. App bật Hermes
(`gradle.properties`). ⇒ mọi noti Tuya `ts=0` → sort dồn đáy + read/unread sai. **Bug không lộ ở jest vì jest chạy V8.**
FCM dùng `dateTime` ISO (`sentAt.toISOString()`) → parse đúng, chỉ Tuya hỏng.

### 🔴 Read-state: 1 timestamp global, không server
`walrus.notif.lastReadAt.v1` (không per-user). `mergeMessages` **ghi đè** `hasNotRead` bằng `ts > lastReadAt`
→ cờ Tuya thật bị bỏ, app không `markMessagesRead`. Logout **KHÔNG** clear key (đã kiểm - chỉ `Tuya.logout()`),
nên #2 không do mất key mà do: read-state chỉ sống 1 máy/1 phiên + ts giòn + key không per-user.

### 🔴 Badge không nhảy khi nhận push foreground
`onForegroundMessage()` (App.tsx:141) chỉ show Notifee, **không** gọi `refreshUnread`. Badge chỉ cập nhật ở
mount / `RNAppState 'active'` / mở màn Notifications.

### 🟡 Router remount → #1 không phải on-focus
`switch(screen)` swap → vào màn = remount = `load()` chạy lại. Nên #1 là parse + delivery, không phải thiếu refetch.

### 🗑️ File iCloud `* 2.*` trùng
mobile: `messages.test 2.ts`, `notificationsRead 2.ts`. backend: `notifications-history.controller 2.ts`,
`notification-log.service 2.ts`, `notification-log.service.spec 2.ts`. Backend NestJS quét trúng controller trùng
có thể đăng ký route trùng / lỗi build.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Điều tra gốc: [../../docs/audit/notifications-hien-trang.md](../../docs/audit/notifications-hien-trang.md)
- Research: [../../docs/research/tuya-home-sdk-message-management.md](../../docs/research/tuya-home-sdk-message-management.md)
- Feature liên quan: `m1-notification-history`, `m1-push-provider-fcm`

## File mới/đổi (B1-B7)
| File | Việc |
|---|---|
| `apps/mobile/src/lib/time.ts` **(mới, B5)** | `parseWhen()` Hermes-safe (chuỗi dấu-cách ghép bằng constructor số; ISO dùng Date). |
| `apps/mobile/src/services/notifDiag.ts` **(mới, B1)** | `notifDiag()` log `[NOTIF-DIAG]` khi `__DEV__` - **GỠ sau khi chốt #1/#2**. |
| `apps/mobile/src/services/notificationsRead.ts` **(viết lại, B3)** | `getReadState(uid)`/`markRead(uid,ids)` - read-set per-uid `...read.<uid>.v2`, cap 500. |
| `apps/mobile/src/services/messages.ts` **(B3+B5)** | `mergeMessages(...,readIds:Set)` theo id; `getMessages` migration; `whenToTs=parseWhen`; diag. |
| `apps/mobile/src/screens/NotificationsScreen.tsx` **(B3)** | `markRead(uid, ids)` thay `setLastReadNow`. |
| `apps/mobile/src/services/push.ts` + `App.tsx` **(B2)** | `onForegroundMessage(onReceive)` → `refreshUnreadRef.current()` (tránh stale-closure). |
| `apps/backend/.../notification-router.service.ts` **(B4)** | log durable cho `input.uids` (fallback deliveredUids khi `all`). |
| Tests mới | `lib/time.test.ts`, `notificationsRead.test.ts`, +cases `messages.test.ts`, `push.test.ts`, `notification-router.service.spec.ts`. |
| **B6 xoá 19 file** | `git rm` mọi `* 2.*` (mobile+backend+admin) - đã commit nhầm, stale, không import. |

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa hoàn thành - còn device test AC1-4 + đọc log chốt root cause #1/#2>
