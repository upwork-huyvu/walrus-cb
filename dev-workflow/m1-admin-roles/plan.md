# Plan: Vai trò superadmin + quản lý admin từ màn Admins

- **Slug:** `m1-admin-roles`
- **Phần:** backend (NestJS + Supabase) + admin (Next.js)
- **Ngày:** 2026-09-28

## 1. Yêu cầu (nguyên văn người dùng)
> "Trong màn Admins tao muốn có tính năng đổi mật khẩu cho admin, superadmin hiện tại và thêm mới
> admin khác, tạo ra 1 role superadmin để có thể xoá admin và để admin@admin.com là superadmin
> nhé. Chỉ có 1 super admin thôi."

## 2. Hiện trạng trước khi làm
- `admin_users` chỉ có `id / email / createdAt` - **không có vai trò**.
- Màn `/admins` chỉ **liệt kê + gỡ**; text trên trang ghi thẳng "muốn thêm admin thì seed qua
  Supabase/DB, ngoài UI này".
- `deleteAdmin` chặn duy nhất một thứ: tự gỡ chính mình ⇒ **admin nào cũng gỡ được admin khác**.
- Không có đường nào đổi mật khẩu từ dashboard.
- Hai tầng tách bạch (quan trọng, đừng lẫn): **Supabase Auth** giữ tài khoản + mật khẩu;
  **`admin_users`** chỉ là allowlist QUYỀN.

## 3. Cách làm
- **B1 - DB:** thêm enum `admin_role` + cột `role` (mặc định `ADMIN`) vào `admin_users`;
  **unique index một phần** ép chỉ tồn tại một `SUPERADMIN`; migration set/insert
  `admin@admin.com` = `SUPERADMIN`.
- **B2 - Backend service:** `AdminPrincipal` mang thêm `role`; `assertSuperadmin()`;
  `createAdmin()` (tạo tài khoản Supabase qua Admin API + cấp quyền);
  `changeOwnPassword()` (bắt nhập lại mật khẩu hiện tại); `deleteAdmin()` ⇒ superadmin-only +
  không gỡ được superadmin.
- **B3 - Backend routes:** `POST /admin/users`, `PATCH /admin/me/password`;
  `GET /admin/me` nay trả kèm `role`.
- **B4 - Admin UI:** cột **Role** (badge) + nút Revoke chỉ hiện với superadmin và không hiện ở
  dòng superadmin; form **Change your password** (mọi admin) + form **Add admin** (superadmin).
- **B5 - Test:** spec cho phân quyền + đổi mật khẩu + tạo admin.

## 4. Tiêu chí nghiệm thu (AC)
- AC1 - `admin@admin.com` là superadmin; DB **không cho** tồn tại superadmin thứ hai.
- AC2 - Superadmin thêm được admin mới (đăng nhập được ngay bằng mật khẩu vừa đặt).
- AC3 - Admin thường: **không** thấy nút Revoke / form Add admin; gọi thẳng API cũng bị 403.
- AC4 - Mọi admin tự đổi được mật khẩu của mình; sai mật khẩu hiện tại thì báo lỗi **và không bị
  đăng xuất**.
- AC5 - Không ai gỡ được superadmin (kể cả chính superadmin).
- AC6 - backend `tsc`/`eslint`/`jest` xanh · admin `tsc`/`eslint`/`next build` xanh.
