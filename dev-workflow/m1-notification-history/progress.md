# Progress: Lịch sử notification per-user (m1-notification-history)

> File quản lý tiến trình (state machine). `/dev`, `/test`, `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-notification-history`
- **Phase hiện tại:** `TEST` (CODE-COMPLETE 2026-07-07; đang review đối kháng)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-07

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**ĐÃ IMPLEMENT** (khác plan gốc - dùng nền auth api-key+uid CÓ SẴN thay vì JWT; **chỉ log FCM**, Tuya lấy
qua Tuya Message Center để tránh trùng). Verify: backend jest 71/71 · mobile jest 109/109 · tsc0/eslint0 ·
/me/notifications end-to-end (insert→fetch→shape). Còn: (1) đợi review đối kháng + fix finding; (2) E2E máy
thật (gửi FCM → mở app thấy trong lịch sử + badge); (3) commit.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [ ] B1 - Research + chốt auth mobile→backend per-user (SHARED reminders) · pending (blocker)
- [ ] B2 - Implement MobileAuthModule (JWT + guard) (SHARED) · pending
- [ ] B3 - Prisma NotificationLog + migration · pending
- [ ] B4 - Ghi log khi gửi (cả 2 provider) · pending
- [ ] B5 - Endpoints /me/notifications (get/read/delete, MobileAuthGuard) · pending
- [ ] B6 - Mobile: NotificationsScreen đọc backend history · pending
- [ ] B7 - Verify + E2E device (defer) · pending

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - Backend ghi NotificationLog mỗi lần gửi (Tuya + FCM)
- [ ] AC2 - Auth per-user: A không đọc được history B (403)
- [ ] AC3 - GET /me/notifications paged, desc
- [ ] AC4 - Mark-read + xoá chỉ trên history mình
- [ ] AC5 - Mobile đọc backend history (FCM + Tuya) + refresh/load-more/xoá
- [ ] AC6 - (device) E2E gửi → hiện trong app

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-07 | Admin redesign (4 comment) | ✅ | (1) **Ẩn hẳn nav Templates khi fcm**: AdminShell nhận `hideTemplates`, tạo `AdminShellServer` (fetch provider) → 3 layout dùng nó. (2) Form gửi **full-width** (bỏ maxWidth 560). (3) Recipient picker = **bảng user có search** (avatar + email/username + Tuya ID; search theo email/username/uid; click hàng để chọn; select-all theo filter). (4) **Bỏ ô nhập UID thủ công**. admin tsc0/eslint0. |
| 2026-07-07 | FEAT xoá + FCM format | ✅ | **Xoá từ app:** thêm `DELETE /me/notifications/:id` (scope tuyaUid), `NotificationLogService.deleteForUid`; mobile `deleteMessages(ids, uid)` xoá FCM qua backend + Tuya qua SDK; mở lại ✕ cho mọi item. E2E insert→DELETE 204→gone. **FCM format:** payload thêm `image` (notification.imageUrl) + `data` (deeplink→data.screen); DTO `imageUrl`/`screen` + nới limit (title100/body500); controller map dto→SendInput. **Admin:** SendPushForm hiện Image URL + Deeplink (dropdown màn) khi provider=fcm; **templates page disable khi fcm** (Tuya-only). backend jest 74/74 · mobile jest 109/109 · admin tsc0/eslint0. |
| 2026-07-07 | REVIEW đối kháng + fix | ✅ | Workflow 11 agent → **4 CONFIRMED, 4 REFUTED** (finding Hermes date-parse bị bác: verifier chạy thật `new Date('YYYY-MM-DD HH:mm')` trên Hermes VM → OK). Fix cả 4: **#1** router `log.record` bọc try/catch (lỗi ghi log không làm hỏng send đã gửi → hết trùng/spam cron). **#2** log theo `deliveredUids` (PushService/SendOutcome trả uid THẬT SỰ nhận) thay vì input.uids → không ghi noti trượt; bỏ luôn `listAllUids` ở router. **#3** `getTuyaMessages` try/catch fail-soft (Tuya lỗi vẫn hiện FCM). **#4** ẩn ✕ cho item FCM (không xoá được → tránh "xoá xong hiện lại"). backend jest 73/73 · mobile jest 109/109 · tsc0/eslint0 · backend boot OK. |
| 2026-07-07 | DEV (implement) | ✅ | User yêu cầu: history 2 nhánh (tuya→Tuya center; fcm→combine tuya+fcm) + badge unread. **Backend:** model `NotificationLog`+migration (applied) · `NotificationLogService` (record/listForUid) · `GET /me/notifications` (MobileAuthGuard) · router log **CHỈ khi fcm** (all→listAllUids) · export PushTokensService · wire NotificationsModule (+MobileAuthModule). **Mobile:** `messages.ts` gộp Tuya MC + `/me/notifications`, read-state ĐỒNG NHẤT theo `lastReadAt` (`notificationsRead.ts`), `getUnreadCount`; NotificationsScreen mark-read khi mở; App unread + refresh (mount/foreground/onRead); badge tab Account + dòng Notifications (MeScreen). **Khác plan:** auth = api-key+uid có sẵn (không JWT); AC1 điều chỉnh "chỉ log fcm" (tuya đã ở Tuya center). tsc0·eslint0·backend jest 71/71·mobile jest 109/109·E2E /me/notifications OK. | Khảo sát: NotificationsScreen đọc Tuya MC (chỉ Tuya, FCM trống); backend chưa log; router là chỗ ghi log. User chốt scope user-app + backend per-user auth. Auth = nền chung với reminders. Chờ Gate ①. |

## Vấn đề đang chặn (Blockers)
- **Auth mobile→backend per-user** (B1/B2): chưa có kênh; đọc history cá nhân cần auth thật (không api-key). Gỡ ở B1.
  → **Nền này mở khoá luôn `m1-device-reminders`.**
