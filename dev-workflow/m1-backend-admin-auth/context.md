# Context: AdminAuthModule — auth admin (Supabase Auth) + guard /users/*

- **Slug:** `m1-backend-admin-auth`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** — Verify admin token bằng **gọi `GET {SUPABASE_URL}/auth/v1/user`** (apikey + Bearer),
  algorithm-agnostic (chịu được Supabase đổi HS256 ↔ asymmetric JWT signing keys). Đã cân nhắc &
  loại (tạm): verify HS256 local bằng `SUPABASE_JWT_SECRET` (nhanh nhưng phụ thuộc thuật toán + secret legacy).
- **2026-06-29** — Admin = Supabase Auth user **AND** có trong allowlist `admin_users` → tách biệt
  hoàn toàn end-user (Tuya). Seed admin: tạo trên Supabase + INSERT email vào `admin_users`.
- **2026-06-29** — `/internal/cron/*` giữ **CRON_SECRET** (Vercel Cron), không dùng admin guard.
- **2026-06-29** — Có **login proxy** `POST /admin/auth/login` để web admin đi qua REST NestJS;
  web admin (D) cũng có thể dùng supabase-js trực tiếp rồi gửi Bearer.

## Bản đồ file/module
| File | Vai trò |
|---|---|
| `src/admin-auth/admin-auth.service.ts` | login proxy + getAdminFromToken (verify + allowlist) |
| `src/admin-auth/admin-auth.guard.ts` | CanActivate cho /users/* + /admin/me |
| `src/admin-auth/admin-auth.controller.ts` | POST /admin/auth/login, GET /admin/me |
| `src/admin-auth/dto/login.dto.ts` | DTO login |

## Phát hiện & cạm bẫy
- GoTrue endpoints: login `POST /auth/v1/token?grant_type=password` (header `apikey`), verify `GET /auth/v1/user` (header `apikey` + `Authorization: Bearer`).
- `AdminAuthGuard` cần `AdminAuthModule` được import ở `UsersModule` (DI cho guard ở UsersController).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Nền: [m1-backend-scaffold](../m1-backend-scaffold/) (Prisma admin_users + config), [m1-backend-user-mgmt](../m1-backend-user-mgmt/) (UsersController được bọc guard)

## Tóm tắt khi hoàn thành
Code C3 xong (B1–B3): AdminAuthService (login proxy + getAdminFromToken qua Supabase
`/auth/v1/user` + allowlist `admin_users`), AdminAuthGuard bọc `/users/*`, AdminAuthController
(`POST /admin/auth/login`, `GET /admin/me`). Verify offline: build/lint/unit 18/18/e2e pass.
**Còn nợ:** live verify (Supabase thật + admin seed) chờ env. Cron giữ CRON_SECRET (không đổi).
