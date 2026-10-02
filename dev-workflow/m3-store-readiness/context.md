# Context: m3-store-readiness

## Quyết định
- **Không làm màn quên mật khẩu riêng**: tái dùng `ChangePasswordScreen` vì Tuya App SDK chỉ có reset
  qua OTP email, và flow này vốn không cần phiên đăng nhập. Tránh hai bản copy của cùng một form.
- **Chính sách nằm trên website**, app chỉ mở link. Website đã có
  `https://www.walruswellness.com/privacy-policy` (200) và `/terms-and-condition` (200) - kiểm 2026-09-29.
- **(2026-10-02) Thêm trang pháp lý RIÊNG CHO APP trên admin web** (public, không đăng nhập):
  `/privacy`, `/terms`, `/delete-account` (Google Play bắt buộc), `/support` (App Store bắt buộc).
  Lý do: privacy policy website chỉ viết cho website. Nội dung bám đúng code (Tuya/Google/Apple
  sign-in, FCM, quyền Bluetooth/Location/Local network, AsyncStorage, bảng Prisma). Pháp nhân lấy từ
  website: Walrus Wellness Limited, công ty số 16403960, Louth LN11 0ZW, luật England & Wales.
- Xoá tài khoản ĐÃ có (Profile → DELETE ACCOUNT) → LegalScreen chỉ nhắc đường dẫn, không làm lại.

## Phát hiện
- ⚠️ Privacy policy trên website hiện viết cho **website** (đặt lịch, UK data protection), **không nhắc
  app**: dữ liệu thiết bị (Tuya), push notification, đăng nhập Google/Apple. Apple có thể từ chối nếu
  policy không mô tả dữ liệu app thu thập → **khách phải bổ sung nội dung**, không phải việc code.
  → Đã giải quyết bằng trang `/privacy` trên admin (2026-10-02).
- ⚠️ Xoá tài khoản từ app chỉ gọi Tuya `cancelAccount` + gỡ push token; backend KHÔNG biết →
  `device_reminders`, `notification_logs` của uid đó còn nằm lại. Admin purge cũng chỉ xoá
  `device_mappings` + `delete_jobs`. Trang `/privacy` + `/delete-account` hứa xoá trong 30 ngày.

## File map
- `apps/admin/app/(legal)/` - layout + 4 trang public (route group, không vào URL).
- `apps/admin/lib/legal.ts` - pháp nhân, email, ngày cập nhật `LEGAL_UPDATED`, danh sách trang.
- `apps/admin/components/LegalDoc.tsx` (khung + mục lục) · `LegalNav.tsx` (tab) · CSS `.legal-*` cuối `globals.css`.
- `src/config/legal.ts` - URL privacy / terms + email support (Help dùng chung).
- `src/screens/LegalScreen.tsx` - màn Privacy & terms.
- `src/screens/ChangePasswordScreen.tsx` - thêm `mode` + `onDone` (thay `onSignOut`).
- `src/screens/AuthScreen.tsx` - link Forgot password + dòng đồng ý điều khoản.
- `App.tsx`, `src/navigation.ts`, `src/screens/MeScreen.tsx`, `src/screens/HelpScreen.tsx`.
