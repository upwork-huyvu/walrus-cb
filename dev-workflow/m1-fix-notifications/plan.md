# Kế hoạch: Sửa quản lý thông báo (parse Hermes + read-state per-user + badge realtime)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-fix-notifications`
- **Milestone:** M1·B (mobile) - bug fix trên `m1-notification-history` + `m1-push-provider-fcm`
- **Phần liên quan:** mobile (chính) + backend (dọn file trùng; xác minh delivery)
- **Ngày tạo:** 2026-07-13
- **Cập nhật lần cuối:** 2026-07-13

## 1. Mục tiêu & phạm vi

Sửa 3 vấn đề khách báo ở màn thông báo (đã điều tra: [docs/audit/notifications-hien-trang.md](../../docs/audit/notifications-hien-trang.md)):
1. Vào màn không thấy thông báo mới.
2. Đã đọc → sau logout/login lại thành "mới".
3. Badge số ở tab Account không hiện / không nhảy khi nhận thông báo.

**Gốc rễ ĐÃ ĐIỀU TRA + PHẢN BIỆN** (workflow `notif-root-cause`, 10 agent, provider=FCM):

- ✅ **#3 [CONFIRMED]:** `onForegroundMessage` **KHÔNG** gọi `refreshUnread` → nhận push lúc app foreground thì
  badge không nhảy. FCM tính `ts` ĐÚNG (backend trả ISO) → chỉ dính lỗi thiếu-refresh này. **Đây là fix chắc ăn.**
- 🟠 **#1 [CONFIRMED, KHÔNG phải parse/uid]:** uid linkage **ĐÚNG theo thiết kế** (token-register / backend-log /
  GET-header cùng 1 Tuya uid, join thuần). Nguyên nhân #1 thật là **đường FCM-history rỗng**:
  - `notification_logs` **chỉ ghi khi FCM giao tới ≥1 token SỐNG** (`deliveredUids` không rỗng). Gửi lúc app
    chưa đăng ký token / token bị prune / FCM chưa cấu hình (`FIREBASE_MESSAGING=null`) → **không có log** → GET rỗng.
    (Lịch sử = "có token sống lúc gửi", KHÔNG phải bản ghi bền "đã gửi".)
  - **`PUSH_API_KEY` rỗng phía mobile** → `getFcmHistory` return `[]` **sớm, im lặng**; `.env.example` ship key rỗng.
  - Sai key → 401 → `getFcmHistory` nuốt lỗi → rỗng.
- 🔴 **#2 [KHÔNG có cơ chế xác định trong code - phản biện đã LOẠI 5/6 giả thuyết]:** với **cùng tài khoản + FCM**,
  KHÔNG có path nào làm noti đã-đọc thành chưa-đọc (lastReadAt đơn điệu tăng, không bị clear lúc logout, ts FCM cố định).
  Còn lại **1 khả năng tầng code (medium):** `setLastReadNow()` nuốt lỗi → **nếu AsyncStorage không persist trên
  device → lastReadAt kẹt=0 → MỌI noti FCM LUÔN unread** ("always-unread", dễ bị nhầm thành "read→unread"). Hoặc
  do **môi trường** (đổi tài khoản / storage bị wipe). ⇒ **#2 cần LOG trên device để chốt trước khi fix mù.**
- 🟡 **Parse Hermes [UNCERTAIN, DEMOTED]:** `new Date("YYYY-MM-DD HH:mm:ss")` → ts=0 **chỉ** ảnh hưởng item **Tuya
  Message Center** (kênh phụ dưới FCM: alarm/family/system), **KHÔNG** phải noti FCM chính. → giữ sửa (nợ kỹ thuật)
  nhưng **hạ ưu tiên**.
- 🟡 **Defect thật (không gây #2):** read-state key **global không per-user** → đổi tài khoản cùng máy = kế thừa
  mốc đọc người trước (đánh dấu SAI thành đã đọc). `mergeMessages` **vứt** cờ `hasNotRead` thật của Tuya.
- 🟡 Native `getMessageHasNew` **đã wire mà không dùng** - badge chỉ dựa `getUnreadCount`.
- 🗑️ File iCloud `* 2.*` trùng (mobile + backend); `notificationsRead 2.ts` giống hệt bản gốc (không gây lệch module).

**Ngoài phạm vi:**
- Redesign UI màn Notifications (chỉ sửa logic + chấm unread + badge).
- Thêm cột read-state ở backend DB (backend `notification_logs` không có cột read; dùng local per-user làm nguồn).
- Realtime đẩy badge qua socket (chỉ refresh khi nhận FCM/foreground/mở màn - đủ cho yêu cầu).
- Sửa cơ chế gửi push của admin.

## 2. Bối cảnh & ràng buộc

- **Router remount:** `App.tsx` render bằng `switch(screen)` → mỗi lần vào Notifications = **remount** → `load()`
  chạy lại. ⇒ #1 **KHÔNG** phải do thiếu refetch-on-focus; trọng tâm là **parse + dữ liệu**.
- **Badge (BottomTabBar) luôn mounted** (sibling) → phải chủ động `refreshUnread` khi có event (nhận push).
- **Native `markMessagesRead(type, ids)`**: iOS có API thật, **Android best-effort** → không đảm bảo đồng bộ đa
  thiết bị. ⇒ **local per-user read-set là lớp tin cậy**; markRead server chỉ là best-effort (đồng bộ đẹp hơn).
- **Backend `notification_logs` không có cột read** → không đọc/ghi read-state FCM trên server (chỉ list + delete).
- Hermes bật (`android/gradle.properties: hermesEnabled=true`) - test phải mô phỏng chuỗi có dấu cách, đừng chỉ dựa V8.
- RN CLI (không Expo); AppSecret/service_role server-only.

- **Link liên quan:**
  - [docs/audit/notifications-hien-trang.md](../../docs/audit/notifications-hien-trang.md) (điều tra gốc)
  - [docs/research/tuya-home-sdk-message-management.md](../../docs/research/tuya-home-sdk-message-management.md)

## 3. Tiêu chí hoàn thành (Acceptance Criteria)

- [ ] **AC1:** Vào màn Notifications trên **thiết bị thật** → noti (Tuya + FCM) hiện **đúng thứ tự thời gian**;
      noti Tuya **không còn ts=0** (không bị dồn xuống đáy) và có `dateTime` đúng.
- [ ] **AC2:** Đọc noti → **logout → login lại cùng tài khoản** → **KHÔNG** biến thành unread lại.
- [ ] **AC3:** Badge số ở **tab Account** hiện đúng số chưa đọc, và **nhảy realtime khi nhận push lúc app đang mở**.
- [ ] **AC4:** Đăng nhập **tài khoản khác** trên cùng máy → read-state **không lẫn** (per-user).
- [ ] **AC5:** `whenToTs()`/parser mới **an toàn trên Hermes**: test có case chuỗi `"YYYY-MM-DD HH:mm:ss"` (dấu cách),
      ISO, và rác → ra epoch đúng / 0 hợp lý (giả lập hành vi Hermes, không chỉ V8).
- [ ] **AC6:** Mọi file `* 2.*` liên quan (mobile + backend) đã xoá; `tsc`/build 2 app vẫn xanh.
- [ ] **AC7:** `tsc` 0 · `eslint` 0 error · `jest` xanh (mobile) · backend `test`/`build` xanh.

## 4. Các bước thực hiện

> Đổi thứ tự sau điều tra: **#1 và #2 CHƯA chốt root cause → B1 diagnostic-first**; fix CHẮC ĂN (#3, read-set)
> trước; parse (chỉ kênh Tuya phụ) demote về sau.

1. **B1 - Diagnostic-first cho #1 & #2 (device log tạm, gỡ sau)**
   - Việc: thêm log dev tạm để chốt 2 root cause chưa xác định:
     - #2: log `getLastReadAt()` **trước và sau** `setLastReadNow()` + 1 chu kỳ logout→login → xác định
       AsyncStorage **có persist không** (nếu sau set vẫn ra giá trị cũ/0 → root cause = **mất persist**, không phải logic).
       Log kèm `uid` + `msgType`/`id` của item bị "nhảy mới" (để loại nhầm nguồn FCM vs Tuya).
     - #1: log HTTP status + số item của `getFcmHistory` + `PUSH_API_KEY` có rỗng không + `NOTIFICATION_PROVIDER`.
   - File: `services/notificationsRead.ts` · `messages.ts` (log tạm, `__DEV__`).
   - Kiểm thử: **device** - đọc log → chốt: #2 là mất-persist hay môi trường; #1 là empty-history vì token/key/config.

2. **B2 - Badge nhảy realtime khi nhận push (#3, CONFIRMED)**
   - Việc: gọi `refreshUnread` trong `onForegroundMessage` (nhận push lúc app mở). Giữ refresh ở mount /
     `RNAppState 'active'` / `onRead`. (Tap background/quit đã phủ gián tiếp - không cần thêm.)
   - File: `App.tsx` (push effect) · `services/push.ts` (nếu cần expose callback nhận-message).
   - Kiểm thử: device - gửi push lúc app foreground → badge +1 ngay (AC3).

3. **B3 - Read-state per-user + per-message (sửa per-user leak + always-unread + bỏ vứt hasNotRead Tuya)**
   - Việc: thay `notificationsRead.ts` (1 timestamp global) bằng **read-set theo uid**: key `walrus.notif.read.<uid>.v2`,
     lưu tập **id đã đọc** (cap ~500 id mới nhất). `mergeMessages`: `hasNotRead = !readSet.has(id)` **HOẶC** cờ Tuya
     `hasNotRead` (không vứt mù). Mở màn → thêm id đang hiển thị vào read-set. `getUnreadCount(uid)` theo uid.
     Migration v1→v2: lần đầu coi mọi id hiện có là **đã đọc** (tránh nổ badge 1 lần) - *chốt cách ở gate*.
   - File: `services/notificationsRead.ts` (viết lại → `readStore`) · `messages.ts` · `NotificationsScreen.tsx` ·
     `App.tsx` · test.
   - Kiểm thử: `jest` - đọc id A → bền qua reload; uid khác → read-set riêng; không persist (mô phỏng) → không nổ.

4. **B4 - #1: FCM-history bền + đảm bảo token/key (theo kết quả B1)**
   - Việc (tùy B1 chỉ ra điểm gãy nào):
     - Đảm bảo `PUSH_API_KEY` có trong build mobile (nếu rỗng là root cause → tài liệu/kiểm).
     - **Backend log bền hơn:** ghi `notification_logs` cho **các uid được nhắm** kể cả khi chưa có token sống lúc gửi
       (đánh dấu trạng thái), để lịch sử không phụ thuộc "token sống đúng lúc". *(Cân nhắc: đây là đổi hành vi backend
       → chốt ở gate.)*
     - Kiểm token registration chạy sau login (`syncPushToken`) + FCM cấu hình (`FIREBASE_MESSAGING`).
   - File: `apps/backend/src/notifications/*` · `apps/mobile/src/services/push.ts` · `config/api.ts`.
   - Kiểm thử: device - gửi push → vào màn thấy ngay (AC1); backend `test` xanh.

5. **B5 - Parse thời gian Hermes-safe (DEMOTED - chỉ kênh Tuya)**
   - Việc: parser tường minh `parseWhen(s)` nhận `"YYYY-MM-DD HH:mm[:ss]"` (regex) + ISO; thay `whenToTs`.
     Sửa sort + count cho item Tuya Message Center.
   - File: `apps/mobile/src/lib/time.ts` (mới) · `messages.ts` · `messages.test.ts`.
   - Kiểm thử: `jest` case chuỗi dấu cách + ISO + rác (mô phỏng Hermes). *(Test hiện chạy V8 nên phải test hàm parser
     tự viết, đừng dựa `new Date`.)*

6. **B6 - Dọn file iCloud `* 2.*` (mobile + backend)**
   - Việc: xoá mọi `* 2.*` liên quan; kiểm không import trỏ vào. Kiểm thử: backend `nest build`/`test` · mobile `tsc`/`jest` xanh.

7. **B7 - Verify end-to-end (device + CI)**
   - Việc: checklist device (AC1-AC4) + full `tsc`/`eslint`/`jest` mobile + backend `test`/`build`. Ghi kết quả.
   - Kiểm thử: checklist + CI xanh.

## 5. Rủi ro & câu hỏi mở

- ⚠️ **Hermes parse chưa xác nhận 100% trên device.** Độ tin cậy cao (V8 khác Hermes rõ ràng), nhưng B1 nên kèm
  1 dòng log `ts` lần đầu chạy device để chốt (rồi gỡ).
- ⚠️ **Format `dateTime` thật của Tuya** có thể là `"YYYY-MM-DD HH:mm:ss"` hoặc chỉ `"HH:mm"` cho hôm nay / khác
  locale → parser B1 phải chịu được nhiều dạng + fallback 0 an toàn. → xác minh chuỗi thật ở B4/B6.
- ⚠️ **markMessagesRead Android best-effort** → đừng phụ thuộc nó cho AC2; local per-user (B2) mới là bảo chứng.
- ⚠️ **Đổi key v1→v2**: user đang có `lastReadAt.v1` → sau update mọi noti cũ có thể thành unread **1 lần** (read-set
  rỗng). Chấp nhận (chỉ 1 lần) hoặc migrate: coi mọi id hiện có là đã đọc ở lần chạy đầu. → cân nhắc ở B2.
- ✅ **Provider = FCM** (user xác nhận 2026-07-13). ⇒ noti mới đi **backend log (ts ISO, parse ĐÚNG cả Hermes)**,
  KHÔNG qua Tuya center. **Đổi trọng tâm #1:** ít khả năng do parse Hermes; nhiều khả năng do **mắt xích uid /
  PUSH_API_KEY / deliveredUids rỗng** làm `/me/notifications` trả rỗng. Và **#2 dưới FCM khó giải hơn** (ts đúng +
  lastReadAt persist thì lẽ ra phải giữ read) → **đang chạy workflow điều tra `notif-root-cause`** để crack #2 +
  truy vết uid trước khi chốt lại thứ tự/ trọng tâm các bước. Bug parse Hermes vẫn giữ (B1) vì ảnh hưởng noti Tuya
  + là nợ kỹ thuật, nhưng có thể KHÔNG phải nguyên nhân chính của #1.
- ❓ **Badge có cần hiện khi guest / trước login?** (hiện đang 0 khi chưa login - giữ nguyên).
