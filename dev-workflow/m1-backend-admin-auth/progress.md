# Progress: AdminAuthModule — auth admin (Supabase Auth) + guard /users/*

- **Slug:** `m1-backend-admin-auth`
- **Phase hiện tại:** `DEV` (B1–B3 code xong; chờ env để verify live)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Code B1–B3 XONG + verify offline** (build/unit 18/18/e2e/lint pass).
Để chạy thật: `SUPABASE_URL` + `SUPABASE_ANON_KEY` + seed 1 admin (tạo user Supabase + INSERT `admin_users`).
**Backend (C1–C3) coi như xong phần code.** Tiếp theo M1: **D `/plan m1-admin-web`** (Next.js: login + list + detail + xoá).

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 — AdminAuthService + env SUPABASE_ANON_KEY · **done** (login proxy + getAdminFromToken qua /auth/v1/user + allowlist)
- [x] B2 — Guard + controller + bọc /users/* · **done** (AdminAuthGuard, /admin/auth/login, /admin/me, @UseGuards trên UsersController)
- [x] B3 — Tests + README + secret sweep + state · **done**

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — Guard: 401 thiếu/sai · 403 không phải admin · pass admin (3 unit guard + 3 unit service)
- [x] AC2 — /users/* bọc AdminAuthGuard; /internal/cron/* vẫn CRON_SECRET; e2e /health 200 (không hồi quy)
- [x] AC3 — POST /admin/auth/login proxy + GET /admin/me (build/types OK; live chờ env)
- [x] AC4 — build/lint/unit(18)/e2e pass + secret sweep sạch + .env.example (SUPABASE_ANON_KEY) + README seed admin

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-29 | TEST B1–B3 | ✅ | `nest build` OK; jest **18/18** (+admin guard 3 +admin service 3); e2e /health OK; eslint 0; secret sweep sạch. |
| 2026-06-29 | DEV B1–B3 | ✅ | AdminAuthService (login + getAdminFromToken via /auth/v1/user + allowlist admin_users) + AdminAuthGuard + AdminAuthController + bọc UsersController; env SUPABASE_ANON_KEY; README admin+seed. |
| 2026-06-29 | PLAN | ✅ | plan/context/progress + INDEX (C3). |

## Vấn đề đang chặn (Blockers)
- Không chặn code. Live verify cần: `SUPABASE_URL` + `SUPABASE_ANON_KEY` + 1 admin seed (Supabase user + INSERT admin_users).
