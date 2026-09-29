# Plan: Sẵn sàng lên store - Forgot password + Privacy & terms

- **Slug:** `m3-store-readiness` · **Milestone:** M3 (go-live) · **Phần:** mobile
- **Lý do:** chuẩn bị submit App Store / Google Play. Reviewer hay đòi: khôi phục mật khẩu khi đã
  đăng xuất, và privacy policy mở được **từ trong app** (Apple 5.1.1). Xoá tài khoản đã có sẵn.

## 1. Mục tiêu
1. **Forgot password** từ màn Sign in (email) - không cần đăng nhập.
2. **Privacy & terms**: màn trong tab Account + dòng đồng ý điều khoản ở landing / đăng ký.

## 2. Thiết kế
- Forgot password dùng LẠI `ChangePasswordScreen` (thêm `mode: 'forgot'`): flow Tuya
  `sendVerifyCode(type 3)` → `resetEmailPassword` KHÔNG cần phiên đăng nhập. Xong → về `auth`
  (không sign out vì chưa có phiên). Route mới `forgot-password`.
- Privacy/Terms trỏ tới website Walrus (`/privacy-policy`, `/terms-and-condition`) qua
  `src/config/legal.ts` - không nhúng bản sao, đổi chính sách không cần build lại. Route mới `legal`.

## 3. Các bước
- B1 - `forgot-password`: mode trong `ChangePasswordScreen` + link "Forgot password?" ở email sign-in + route App.
- B2 - `legal`: `config/legal.ts` + `LegalScreen` + menu Account + dòng đồng ý ở AuthScreen.
- B3 - FAQ Help thêm câu "quên mật khẩu"; cập nhật docs (overview, QA guide, onboarding).

## 4. Tiêu chí chấp nhận
- AC1 - Đã đăng xuất: Sign in with email → Forgot password? → code → mật khẩu mới → đăng nhập được bằng mật khẩu mới.
- AC2 - Change password khi đang đăng nhập vẫn chạy như cũ (xong thì sign out).
- AC3 - Account → Privacy & terms mở đúng 2 trang website + mail support.
- AC4 - Landing và màn đăng ký có dòng "By continuing, you agree to…" với 2 link bấm được.
- AC5 - tsc 0 · eslint 0 lỗi · jest xanh.
