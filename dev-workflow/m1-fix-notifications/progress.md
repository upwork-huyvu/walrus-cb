# Progress: Sửa quản lý thông báo

> `/dev`, `/test`, `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt. Giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-fix-notifications`
- **Phase hiện tại:** `TEST` (B1-B7 code xong & CI xanh; còn device checklist + log #1/#2)
- **Trạng thái:** `in_progress` (chờ user test device + đọc log `[NOTIF-DIAG]`)
- **Cập nhật lần cuối:** 2026-07-13

## ▶ Hành động kế tiếp (đọc cái này trước tiên)

✅ **B1-B7 CODE XONG & CI XANH** (mobile tsc0/jest196/eslint0 · backend jest76/build0). Gate ① đã duyệt;
quyết định: migration coi noti cũ = đã đọc · backend log durable cho mọi uid nhắm.

**Còn lại = test thiết bị thật (user):**
1. **Deploy backend mới** (Vercel) - B4 durable log ở backend, cần có mặt để #1 hết rỗng.
2. Chạy app: mở Notifications → **logout→login lại** → mở lại · gửi 1 push admin lúc app foreground (badge phải nhảy).
3. **Đọc log `[NOTIF-DIAG]`** (adb logcat / Xcode console) gửi tao → chốt #2 (`markRead persistOk`) + #1 (`fcm.ok count`/`fcm.skip`).
4. Kiểm AC1-AC4 (checklist dưới). Xong → tao **gỡ toàn bộ `[NOTIF-DIAG]`** (đánh dấu `// B1 DIAGNOSTIC - gỡ sau`).

## Checklist các bước (đồng bộ plan.md mục 4)

- [x] B1 - **Diagnostic-first** #1 & #2 (device log: persist lastReadAt · FCM-history status/count/key) · **code done, chờ log device**
- [x] B2 - Badge realtime khi nhận push (#3) · **done** (unit xanh; AC3 đầy đủ chờ device)
- [x] B3 - Read-state **per-user + per-message** (readStore theo uid, migration coi cũ=đã đọc) · **done** (jest)
- [x] B4 - #1: backend log **DURABLE** cho mọi uid nhắm (kể cả chưa có token) · **done** (backend jest 76/76 + build)
- [x] B5 - Parse Hermes-safe (`lib/time.ts` `parseWhen`) · **done** (jest)
- [x] B6 - Dọn file `* 2.*` (**18 file** mobile+backend) · **done**. ⚠️ **ĐÍNH CHÍNH:** glob lỡ xoá cả `apps/admin/components/AdminShellServer 2.tsx` (ngoài scope) → **đã git restore** (admin về đúng HEAD, `tsc` 0). Đó là dupe IDENTICAL, KHÔNG đụng UI send (`SendPushForm.tsx` nguyên vẹn).
- [x] B7 - Verify CI · **done** (mobile tsc0/jest196/eslint0 · backend jest76/build0). **Device checklist còn lại.**
- [x] B8 - **[admin] fallback provider = fcm + fix swallow-redirect** · **done** (admin tsc0 · next build 0)

## Checklist tiêu chí hoàn thành (đồng bộ plan.md mục 3)

- [ ] AC1 - Vào màn: noti đúng thứ tự thời gian, Tuya không còn ts=0 (device)
- [ ] AC2 - Đọc → logout/login lại → không thành unread (device)
- [ ] AC3 - Badge Account đúng số + nhảy realtime khi nhận push lúc app mở (device)
- [ ] AC4 - Đổi tài khoản cùng máy → read-state không lẫn (per-user)
- [ ] AC5 - Parser an toàn Hermes (test dấu cách + ISO + rác)
- [ ] AC6 - File `* 2.*` đã xoá; 2 app build xanh
- [ ] AC7 - `tsc` 0 · `eslint` 0 · `jest` xanh (mobile) · backend test/build xanh

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-13 | DEV+TEST B8 (admin) | ✅ | **Triệu chứng user:** admin hiện "UI Tuya" dù `NOTIFICATION_PROVIDER=fcm`. **Chẩn đoán:** backend TRẢ fcm (confirmed: cwd đúng, `.env` load qua `validateEnv`, build hiện tại); nhưng admin `AdminShellServer`+`notifications/page`+`templates/page` gọi `/notifications/provider` trong `try/catch` **nuốt cả `redirect('/login')`** → token hết hạn → 401 → âm thầm fallback **'tuya'** + ở lại trang. **Fix:** thêm `lib/api.ts getActiveProvider()` (fallback **'fcm'** + `unstable_rethrow` để auth-fail redirect THẬT); thay 3 chỗ dùng nó; `/users` + `/templates` catch cũng `unstable_rethrow`. Xoá orphan `AdminShellServer 2.tsx`. **Verify:** admin `tsc` 0 · `next build` 0 · dev 3001 ok. → user chỉ cần **re-login** thấy FCM. |
| 2026-07-13 | TEST B3-B7 | ✅ (CI) | **Mobile** tsc 0 · eslint 0 · jest **196/196** (20 suite). **Backend** jest **76/76** (13 suite) · `nest build` 0. **B3** `notificationsRead.ts` → readStore per-uid (getReadState/markRead, cap 500) + `messages.mergeMessages(readIds:Set)` + migration; `NotificationsScreen` markRead ids; +test `notificationsRead.test.ts` (per-user, cap). **B4** router log durable cho mọi `input.uids` (fallback deliveredUids khi `all`); spec cập nhật (5 test). **B5** `lib/time.ts` `parseWhen` (Hermes-safe) thay `whenToTs`; +7 test. **B6** `git rm` **19 file `* 2.*`** (mobile+backend+admin, đã xác nhận không import + là bản cũ stale). |
| 2026-07-13 | DEV+TEST B2 | ✅ (code) | #3 fix: `onForegroundMessage(onReceive?)` gọi `onReceive` khi nhận push; `App.tsx` truyền `refreshUnreadRef.current()` (ref tránh **stale closure** - push effect deps [] capture lúc mount thì uid undefined). +3 test push (`onMessage` mock). `tsc` 0 · `eslint` 0 · `jest` **181/181**. AC3 đầy đủ (badge nhảy) chờ device. |
| 2026-07-13 | DEV B1 | ✅ (code) | Thêm `notifDiag.ts` + instrument `notificationsRead.ts` (persist check: đọc lại sau `setItem`) + `messages.ts` (`fcm.enter/skip/httpError/ok`, `getMessages` sample). `tsc` 0 · `eslint` 0 · `jest` 178/178. **Chờ user chạy device đọc log `[NOTIF-DIAG]`** (adb logcat / Xcode console) → chốt: #2 persistOk? · #1 fcm count/status/apiKeySet. Gate ① đã duyệt; quyết định: backend log MỌI uid nhắm; migration coi noti cũ = đã đọc. |
| 2026-07-13 | INVESTIGATE (workflow) | ✅ | Workflow `notif-root-cause` (10 agent, provider=FCM, có phản biện). **KẾT QUẢ ĐỔI CHẨN ĐOÁN:** #1 KHÔNG do parse/uid (uid linkage ĐÚNG theo thiết kế) → **FCM-history rỗng** khi token chưa đăng ký/prune/`PUSH_API_KEY` rỗng/FCM chưa config. #2 **không có cơ chế xác định trong code** (loại 5/6 giả thuyết: lastReadAt không bị clear, đơn điệu tăng, ts FCM đúng, dupe file giống hệt) → còn lại nghi **AsyncStorage mất persist → always-unread** hoặc môi trường → **cần device-log**. #3 CONFIRMED thiếu `refreshUnread` on foreground receive. Parse Hermes DEMOTED (chỉ kênh Tuya phụ). Bonus: `getMessageHasNew` native wire mà không dùng. → plan revise: B1 diagnostic-first, reorder. |
| 2026-07-13 | PLAN | ✅ | Điều tra xong ([docs/audit/notifications-hien-trang.md](../../docs/audit/notifications-hien-trang.md)). Gốc rễ: **parse `new Date(spaceString)` hỏng trên Hermes → ts=0** (V8/jest đúng nên bug ẩn); read-state 1 timestamp global không per-user/server; `onForegroundMessage` không refresh badge; file `* 2.*` trùng. Xác minh: native có `markMessagesRead` (Android best-effort); router remount → #1 không phải on-focus. 6 bước B1-B6. |

## 📋 Checklist device (AC1-AC4) - user chạy

> Deploy backend mới trước (B4). Mọi bug: đọc log `[NOTIF-DIAG]` gửi kèm.
- [ ] **AC1** gửi push admin → vào Notifications → **thấy ngay** (log `fcm.ok count>0`). ← #1
- [ ] **AC2** đọc noti → **logout→login lại** → **KHÔNG** thành unread lại (log `markRead persistOk:true`). ← #2
- [ ] **AC3** push tới lúc app **foreground** → **badge Account nhảy +1 ngay**. ← #3
- [ ] **AC4** đổi **tài khoản khác** cùng máy → read-state không lẫn (key `...read.<uid>.v2`). ← per-user
- [ ] Migration: lần đầu update → noti cũ = đã đọc (badge không nổ).
- [ ] Item Tuya (nếu có) không còn tụt đáy do ts=0 (parse fixed).

## Vấn đề đang chặn (Blockers)

- 🔴 **AC1-AC4 cần thiết bị thật + backend deploy mới** (Hermes parse · push · logout/login · durable log không mô phỏng đủ bằng jest/CI).
- 🔴 **Root cause #1/#2 vẫn chưa CHỐT bằng dữ liệu thật** - fix hiện là "đúng regardless" + diagnostic. Log `[NOTIF-DIAG]` sẽ xác nhận.
