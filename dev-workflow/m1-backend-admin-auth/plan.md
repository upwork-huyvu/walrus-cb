# Kế hoạch: AdminAuthModule - auth admin (Supabase Auth) + guard cho /users/*

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-backend-admin-auth`
- **Milestone:** M1 - Part C3
- **Phần liên quan:** backend (NestJS)
- **Ngày tạo:** 2026-06-29 · **Cập nhật:** 2026-06-29

## 1. Mục tiêu & phạm vi
Auth **admin** tách biệt hoàn toàn end-user (end-user do Tuya quản lý). Admin =
**Supabase Auth** user **và** phải nằm trong allowlist bảng `admin_users`. Backend
**verify token Supabase** + chặn `/users/*` bằng `AdminAuthGuard`. Có login proxy
để web admin (D) đăng nhập qua REST nếu muốn.

**Ngoài phạm vi:** UI admin (D); phân quyền chi tiết (RBAC) ngoài "là admin"; reset password.

## 2. Bối cảnh & ràng buộc
- **Supabase Auth (GoTrue)** - KHÔNG phải Tuya (không cần `/tuya-research`).
- Verify token bằng **gọi `GET {SUPABASE_URL}/auth/v1/user`** (header `apikey` + `Bearer`) -
  **algorithm-agnostic** (chịu được Supabase đổi HS256 ↔ JWT signing keys). Cân nhắc cache ngắn.
- Admin phải có trong **`admin_users`** (đã có ở schema C1) → "tách biệt end-user".
- `/internal/cron/*` vẫn dùng **CRON_SECRET** (Vercel Cron), KHÔNG đổi sang admin guard.
- Secret/khoá để env: `SUPABASE_URL` (có), **`SUPABASE_ANON_KEY`** (mới), `SUPABASE_SERVICE_ROLE_KEY` (có).
- Seed admin đầu tiên: tạo user trên Supabase Auth + INSERT email vào `admin_users` (tài liệu hoá).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `AdminAuthGuard` - thiếu/sai Bearer → **401**; token hợp lệ nhưng không trong `admin_users` → **403**; admin hợp lệ → pass + gắn `req.admin` (unit).
- [ ] AC2: `/users/*` được bọc `@UseGuards(AdminAuthGuard)`; `/internal/cron/*` vẫn CRON_SECRET (không hồi quy - e2e /health vẫn 200).
- [ ] AC3: `POST /admin/auth/login` proxy Supabase password grant (trả session); `GET /admin/me` (protected) trả admin (unit/build).
- [ ] AC4: build + lint + unit pass; secret sweep sạch; `.env.example` có `SUPABASE_ANON_KEY`; README mô tả seed admin.

## 4. Các bước thực hiện
1. **B1 - AdminAuthService + env**
   - `AdminAuthService`: `login(email,pw)` (proxy GoTrue), `getAdminFromToken(token)` (verify `/auth/v1/user` + allowlist `admin_users`). Thêm env `SUPABASE_ANON_KEY`.
   - File: `src/admin-auth/admin-auth.service.ts`, `src/config/env.validation.ts`, `.env.example`.
   - Test: unit (mock fetch + prisma) - ok admin / not-admin → 403 / token sai → 401.
2. **B2 - Guard + controller + bọc /users/***
   - `AdminAuthGuard` (CanActivate), `AdminAuthController` (`POST /admin/auth/login`, `GET /admin/me`), `LoginDto`. `@UseGuards(AdminAuthGuard)` trên `UsersController`. Wire `AdminAuthModule` (export guard+service); `UsersModule` import nó; `app.module` import.
   - File: `src/admin-auth/{admin-auth.guard,admin-auth.controller,admin-auth.module}.ts`, `src/admin-auth/dto/login.dto.ts`, cập nhật `users.controller.ts`/`users.module.ts`/`app.module.ts`.
   - Test: guard unit (401/403/pass).
3. **B3 - Tests + README + secret sweep + state**
   - Hoàn thiện unit; README mục Admin Auth + seed; grep secret.
   - Test: build + lint + unit + e2e pass; grep sạch.

## 5. Rủi ro & câu hỏi mở
- ⚠️ Verify qua network `/auth/v1/user` mỗi request → cache ngắn (admin traffic thấp, chấp nhận). Thay thế: verify HS256 bằng `SUPABASE_JWT_SECRET` (nhanh nhưng phụ thuộc thuật toán).
- ⚠️ Live verify cần Supabase project + admin seed → hoãn; unit mock fetch để đóng AC offline.
- ❓ Cần khi chạy thật: `SUPABASE_URL` + `SUPABASE_ANON_KEY`, 1 user admin trên Supabase + INSERT vào `admin_users`.
