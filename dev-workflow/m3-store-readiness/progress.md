# Progress: Sẵn sàng lên store - Forgot password + Privacy & terms

- **Slug:** `m3-store-readiness`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `code_done` - CI xanh, chờ chạy thử trên máy thật
- **Cập nhật lần cuối:** 2026-09-29

## ▶ Hành động kế tiếp
Build lên iPhone/Android, rà AC1–AC4 trong `plan.md` bằng một tài khoản email thật (AC1 cần hộp thư
nhận code). Nhắc khách bổ sung phần app vào privacy policy trên website trước khi submit.

## Checklist bước
- [x] B1 - forgot-password · **done**
- [x] B2 - legal screen + dòng đồng ý · **done**
- [x] B3 - FAQ + docs · **done**

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
