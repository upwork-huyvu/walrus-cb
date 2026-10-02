# Progress: Sẵn sàng lên store - Forgot password + Privacy & terms

- **Slug:** `m3-store-readiness`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `code_done` - CI xanh, chờ chạy thử trên máy thật
- **Cập nhật lần cuối:** 2026-10-02

## ▶ Hành động kế tiếp
1. Deploy admin (Vercel) → điền URL public vào store: App Store Connect (Privacy Policy URL =
   `/privacy`, Support URL = `/support`, EULA = `/terms`) · Google Play (Privacy policy = `/privacy`,
   Delete account URL = `/delete-account`). Domain: https://walrus-admin-web.vercel.app
2. Khách duyệt nội dung pháp lý (giới hạn trách nhiệm £100, tuổi tối thiểu 18, email liên hệ).
3. ⚠️ Backend chưa dọn `device_reminders` + `notification_logs` khi user tự xoá tài khoản trong app
   (chỉ Tuya `cancelAccount`) - policy hứa xoá trong 30 ngày → cần job dọn theo uid.
4. Cân nhắc trỏ `apps/mobile/src/config/legal.ts` sang trang mới (cần build app mới).
5. Build lên iPhone/Android, rà AC1–AC4 bằng tài khoản email thật (AC1 cần hộp thư nhận code).

## Checklist bước
- [x] B1 - forgot-password · **done**
- [x] B2 - legal screen + dòng đồng ý · **done**
- [x] B3 - FAQ + docs · **done**
- [x] B4 - trang public trên admin: /privacy · /terms · /delete-account · /support · **done**

## Checklist AC
- [ ] AC1 - quên mật khẩu khi đã đăng xuất · *chờ chạy thật*
- [ ] AC2 - change password khi đăng nhập không đổi hành vi · *chờ chạy thật*
- [ ] AC3 - Privacy & terms mở đúng link · *chờ chạy thật*
- [ ] AC4 - dòng đồng ý ở landing + đăng ký · *chờ chạy thật*
- [x] AC5 - tsc 0 · eslint 0 lỗi (129 warning inline-style sẵn có) · jest 438/438 · bundle iOS release ✓

## Nhật ký chạy
| Thời gian | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-09-29 | B1–B3 | ✅ | tsc 0 · jest 438/438 · eslint 0 lỗi · bundle iOS release chứa màn mới |
| 2026-10-02 | B4 | ✅ | admin: tsc 0 · eslint 0 · `next build` 4 route static · soát UI 1440px + 390px (không cuộn ngang) |
