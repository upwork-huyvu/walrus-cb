# Progress: Vai trò superadmin + quản lý admin

- **Slug:** `m1-admin-roles`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `code_done` - CI xanh, **migration ĐÃ CHẠY trên Supabase**, còn chạy thử trên UI
- **Cập nhật lần cuối:** 2026-09-28

## ▶ Hành động kế tiếp
Bật backend + admin, đăng nhập bằng `admin@admin.com` (superadmin) rồi rà AC2–AC5 trong `plan.md`:
thêm một admin thử → đăng nhập bằng tài khoản đó → xác nhận nó KHÔNG thấy nút Revoke / form Add
admin → tự đổi mật khẩu được. Xong thì commit + push.

## Checklist bước (đồng bộ plan mục 3)
- [x] B1 - enum + cột `role` + unique index một phần + seed `admin@admin.com` · **done, ĐÃ chạy trên Supabase**
- [x] B2 - service: `role` trong principal, `assertSuperadmin`, `createAdmin`, `changeOwnPassword`, `deleteAdmin` · **done**
- [x] B3 - routes `POST /admin/users` + `PATCH /admin/me/password` · **done**
- [x] B4 - UI: cột Role, ẩn/hiện theo vai trò, form đổi mật khẩu + form thêm admin · **done**
- [x] B5 - spec phân quyền + đổi mật khẩu + tạo admin · **done** (+13 test)

## Checklist AC (đồng bộ plan mục 4)
- [x] AC1 - `admin@admin.com` là superadmin, DB chặn superadmin thứ hai ✅ *(kiểm chứng thật trên Supabase: phong `admin@walrus.app` lên SUPERADMIN → Postgres `23505 Key (role)=(SUPERADMIN) already exists`, chạy trong transaction rồi rollback nên dữ liệu giữ nguyên)*
- [ ] AC2 - superadmin thêm được admin mới, admin đó đăng nhập được · *chờ chạy thật*
- [ ] AC3 - admin thường không thấy/không gọi được API quản lý admin · *logic đã có test, chờ chạy thật*
- [ ] AC4 - tự đổi mật khẩu được; sai mật khẩu hiện tại không bị đăng xuất · *chờ chạy thật*
- [ ] AC5 - không gỡ được superadmin · *logic đã có test, chờ chạy thật*
- [x] AC6 - backend tsc 0 · eslint 0 · **jest 128/128** (+16) · admin tsc 0 · eslint 0 · `next build` ✓

## Nhật ký chạy
| Thời gian | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-09-28 | TEST migration (thật) | ✅ | `prisma migrate deploy` trên Supabase (`aws-1-eu-central-1.pooler`, qua `DIRECT_URL`). Trước khi chạy: allowlist có sẵn `admin@walrus.app` + `admin@admin.com` ⇒ nhánh `ON CONFLICT DO UPDATE` chạy, không sinh dòng mới. Sau khi chạy: `admin@admin.com` = **SUPERADMIN**, `admin@walrus.app` = ADMIN. Index `admin_users_one_superadmin` có thật, và thử phong superadmin thứ hai bị chặn bằng `23505`. Cả 2 email **đã có tài khoản Supabase Auth + đã confirm** ⇒ đăng nhập được ngay. |
| 2026-09-28 | DEV B1–B5 + TEST tĩnh | ✅ | Thêm vai trò `SUPERADMIN`/`ADMIN` vào `admin_users`, ép "chỉ một superadmin" bằng unique index một phần ở Postgres. Backend: thêm admin (tạo tài khoản qua GoTrue Admin API bằng `service_role`, email đã tồn tại thì chỉ cấp quyền chứ không ghi đè mật khẩu), tự đổi mật khẩu (bắt nhập lại mật khẩu hiện tại, sai thì trả **400** để không bị hiểu nhầm là hết phiên rồi đá về `/login`), gỡ admin chuyển thành superadmin-only + không gỡ được superadmin. UI `/admins`: cột Role, ẩn nút Revoke với admin thường, 2 form mới. backend tsc 0 · eslint 0 · **jest 128/128** · admin tsc 0 · eslint 0 · `next build` ✓. **Migration CHƯA chạy** (DB dùng chung) và **chưa chạy thử thật**. |

## Blockers
- Không tự chạy E2E được: backend `localhost:3006` chưa bật, không có mật khẩu admin để đăng nhập.
