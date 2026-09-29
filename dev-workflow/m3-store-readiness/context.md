# Context: m3-store-readiness

## Quyết định
- **Không làm màn quên mật khẩu riêng**: tái dùng `ChangePasswordScreen` vì Tuya App SDK chỉ có reset
  qua OTP email, và flow này vốn không cần phiên đăng nhập. Tránh hai bản copy của cùng một form.
- **Chính sách nằm trên website**, app chỉ mở link. Website đã có
  `https://www.walruswellness.com/privacy-policy` (200) và `/terms-and-condition` (200) - kiểm 2026-09-29.
- Xoá tài khoản ĐÃ có (Profile → DELETE ACCOUNT) → LegalScreen chỉ nhắc đường dẫn, không làm lại.

## Phát hiện
- ⚠️ Privacy policy trên website hiện viết cho **website** (đặt lịch, UK data protection), **không nhắc
  app**: dữ liệu thiết bị (Tuya), push notification, đăng nhập Google/Apple. Apple có thể từ chối nếu
  policy không mô tả dữ liệu app thu thập → **khách phải bổ sung nội dung**, không phải việc code.

## File map
- `src/config/legal.ts` - URL privacy / terms + email support (Help dùng chung).
- `src/screens/LegalScreen.tsx` - màn Privacy & terms.
- `src/screens/ChangePasswordScreen.tsx` - thêm `mode` + `onDone` (thay `onSignOut`).
- `src/screens/AuthScreen.tsx` - link Forgot password + dòng đồng ý điều khoản.
- `App.tsx`, `src/navigation.ts`, `src/screens/MeScreen.tsx`, `src/screens/HelpScreen.tsx`.
