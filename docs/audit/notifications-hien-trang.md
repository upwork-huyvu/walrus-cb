# Hiện trạng: Quản lý thông báo (notifications) - phân tích 3 vấn đề

> ⚠️ **CẬP NHẬT 2026-07-13 sau điều tra sâu (workflow `notif-root-cause`, provider=FCM đã xác nhận):**
> phần "gốc rễ parse Hermes" bên dưới **bị hạ cấp** - nó chỉ ảnh hưởng kênh **Tuya Message Center phụ**, KHÔNG
> phải noti FCM chính. Chẩn đoán đã-phản-biện: **#1 = FCM-history rỗng** (token/`PUSH_API_KEY`/FCM config, KHÔNG
> phải parse/uid); **#2 = không có cơ chế xác định trong code** (nghi AsyncStorage mất persist / môi trường → cần
> device-log); **#3 = thiếu `refreshUnread` on foreground receive (CONFIRMED)**. Chi tiết đầy đủ:
> [dev-workflow/m1-fix-notifications/context.md](../../dev-workflow/m1-fix-notifications/context.md).

- Ngày: 2026-07-13 · Loại: điều tra hiện trạng (read-only, chưa sửa)
- Phạm vi: `apps/mobile` (NotificationsScreen · services/messages · notificationsRead · App.tsx · push) +
  `apps/backend/src/notifications`

## Kiến trúc hiện tại (đã đối chiếu code)

- **2 nguồn thông báo, gộp lại** (`services/messages.ts` `getMessages`):
  1. **Tuya Message Center** - native `getMessageList(offset,limit)` (device/system + Tuya App Push).
  2. **Backend FCM log** - `GET /me/notifications` (bảng `notification_logs`, ghi khi gửi qua provider FCM).
- **Read-state = MỘT timestamp `lastReadAt`** lưu AsyncStorage, key **`walrus.notif.lastReadAt.v1` (GLOBAL, không per-user)**
  (`services/notificationsRead.ts`).
- **unread = `ts > lastReadAt`** áp cho **cả 2 nguồn** (`mergeMessages`, dòng 123). ⚠️ **Cờ `hasNotRead` thật của
  Tuya bị GHI ĐÈ/bỏ đi** - read-state hoàn toàn dựa vào timestamp local.
- **Mở màn Notifications** → `getMessages` (đọc lastReadAt cũ) → `setLastReadNow()` (lastReadAt=now) → badge về 0.
- **Badge số** (`MeScreen` dòng 77-91 + `BottomTabBar` dòng 52-70): **UI + wiring ĐÃ CÓ**
  (`getUnreadCount` → `setUnread`). Refresh khi: app mount · app về foreground (`RNAppState 'active'`) · mở màn
  Notifications (`onRead`). **KHÔNG refresh khi nhận push lúc app đang mở.**
- **App dùng Hermes** (`android/gradle.properties: hermesEnabled=true`).

---

## 🔴 Phát hiện gốc (xuyên suốt cả 3 vấn đề): parse thời gian hỏng trên Hermes

`whenToTs(s) = new Date(s).getTime()` (`messages.ts:33`). Tuya trả `dateTime` dạng
**`"2026-07-13 17:00:00"` (có DẤU CÁCH, không timezone)** - KHÔNG phải ISO 8601.

| Engine | `new Date("2026-07-13 17:00:00")` |
|---|---|
| **V8** (Node/jest) | parse OK (coi là local) → ts đúng |
| **Hermes** (app thật) | **Invalid Date → `getTime()` = NaN → `whenToTs` = 0** |

⇒ Trên máy thật, **mọi thông báo nguồn Tuya có `ts = 0`**. Hệ quả dây chuyền:
- Sort `b.ts - a.ts` → noti Tuya luôn bị đẩy xuống **đáy** danh sách.
- `hasNotRead = 0 > lastReadAt` → khi đã từng mở màn (lastReadAt>0) → **luôn = read** (badge bỏ sót);
  khi chưa mở lần nào (lastReadAt=0) → **luôn = unread**.
- FCM thì dùng `dateTime` **ISO** (`sentAt.toISOString()`) → Hermes parse ĐÚNG → ts đúng. Chỉ Tuya hỏng.

**Đây là lý do bug KHÔNG lộ ở jest/CI** (V8 parse đúng) mà chỉ lộ trên thiết bị (Hermes).
*Cần xác nhận bằng 1 dòng log `ts` trên device - nhưng độ tin cậy CAO.*

Kể cả nếu Hermes parse được: chuỗi **không có timezone** so với `Date.now()` (UTC epoch) → lệch đúng bằng
offset local (VN +7h) → so sánh `ts > lastReadAt` vẫn sai.

---

## Vấn đề 1: Vào màn không thấy thông báo mới

| Nguyên nhân | Tin cậy | Chi tiết |
|---|---|---|
| Parse Hermes → `ts=0` cho noti Tuya | **CAO** | Noti Tuya chìm đáy + read/unread sai → "như không thấy mới". |
| `NotificationsScreen` chỉ `load()` lúc **mount** | TB | `useEffect(load)` - không refetch on-focus. Quay lại màn (không remount) hoặc push tới khi đang mở → không cập nhật. Chỉ pull-to-refresh mới nạp lại. |
| Provider routing | TB | `NOTIFICATION_PROVIDER` (default **tuya**). Nếu tuya → noti mới vào **Tuya center** (dính bug parse). Nếu fcm → vào backend log (record ĐÃ wire, ISO ts đúng) - cần verify `x-tuya-uid` khớp uid đăng nhập. |

## Vấn đề 2: Đã đọc → sau logout/login thành "mới" lại

| Nguyên nhân | Tin cậy | Chi tiết |
|---|---|---|
| ~~logout xoá lastReadAt~~ | **LOẠI** | Đã kiểm: `logout()` chỉ gọi `lib.Tuya.logout()`, **KHÔNG** clear AsyncStorage; không có `AsyncStorage.clear()` ở đâu. lastReadAt **sống sót** qua logout. |
| Read-state chỉ là **1 timestamp local, không lưu server** | **CAO** | App **không** gọi Tuya `markMessageRead`; `hasNotRead` server bị bỏ. Read-state sống trên **đúng 1 máy**. Reinstall / máy khác / xoá app data = mọi thứ unread lại. |
| Parse/timezone không ổn định | **CAO** | Nếu `ts` bị lệch (NaN→0 xen kẽ, hoặc local↔UTC) thì `ts > lastReadAt` cho kết quả **không nhất quán** giữa các lần fetch/login → thông báo "nhảy" về unread. |
| Key **GLOBAL, không per-user** | Chắc | `walrus.notif.lastReadAt.v1` dùng chung mọi tài khoản → đăng nhập tài khoản khác trên cùng máy = kế thừa mốc đọc của người trước (sai per-user). |

## Vấn đề 3: Badge số ở tab Account (1,2,3…)

| Tình trạng | Chi tiết |
|---|---|
| **UI + wiring ĐÃ CÓ** | `MeScreen`/`BottomTabBar` render badge khi `unread>0` (đã có sẵn `9+`). `getUnreadCount`→`setUnread` đã nối. **Không phải làm mới từ đầu.** |
| ❌ Không live-update khi **nhận push lúc app mở** | **CAO** | `onForegroundMessage()` (App.tsx:141) chỉ show banner Notifee, **KHÔNG gọi `refreshUnread`** → nhận noti mà app đang foreground thì **số không nhảy** tới khi app đi nền rồi active lại / mở màn Notifications. Đúng "khi nhận thì số phải show". |
| ❌ Số tính **sai** do parse | **CAO** | Noti Tuya `ts=0` → thường bị coi là read → badge **bỏ sót/luôn 0** → user "không bao giờ thấy số". |

---

## Bonus - bug chắc chắn, đáng dọn

- 🗑️ **File iCloud `* 2.*` trùng** (do đồng bộ iCloud, cạm bẫy đã ghi ở INDEX):
  - mobile: `services/messages.test 2.ts`, `services/notificationsRead 2.ts`
  - backend: `notifications-history.controller 2.ts`, `notification-log.service 2.ts`, `notification-log.service.spec 2.ts`
  - ⚠️ Backend NestJS: file controller/service trùng nếu bị compile/scan có thể **đăng ký route/provider trùng** hoặc lỗi build. **Cần xoá.**

---

## Đề xuất hướng sửa (chưa làm - chờ chốt)

1. **Sửa parse thời gian (gốc rễ):** thay `new Date(spaceString)` bằng parser tường minh
   `"YYYY-MM-DD HH:mm:ss"` → epoch (định rõ tz), an toàn trên Hermes. Thêm test Hermes-realistic (chuỗi có dấu cách).
2. **Read-state per-user + per-message:** lưu tập id đã đọc theo `uid` (key `...read.<uid>`), thay vì 1 timestamp
   global; lý tưởng **markRead lên Tuya + backend** để đồng bộ đa thiết bị. Bỏ việc ghi đè `hasNotRead` của Tuya.
3. **Refresh đúng lúc:** refetch notifications **on-focus**; gọi `refreshUnread` trong `onForegroundMessage`
   (kèm khi tap/nhận background) để badge nhảy realtime.
4. **Dọn file `* 2.*`** (mobile + backend).

## Nguồn (file đã đọc)
- `apps/mobile/src/services/messages.ts` · `notificationsRead.ts` · `screens/NotificationsScreen.tsx` ·
  `screens/MeScreen.tsx` · `components/BottomTabBar.tsx` · `App.tsx` · `state/useAuth.ts` · `services/auth.ts`
- `apps/backend/src/notifications/` (`notification-log.service.ts` · `notifications-history.controller.ts` ·
  `providers/notification-router.service.ts`)
- `apps/mobile/android/gradle.properties` (hermesEnabled=true)
