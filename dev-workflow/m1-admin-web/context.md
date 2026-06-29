# Context: Web Admin (Next.js) — login + list/detail/xoá user

- **Slug:** `m1-admin-web`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** — Admin web **chỉ gọi REST NestJS** (login proxy `/admin/auth/login` + `/users/*`),
  KHÔNG dùng supabase-js ở frontend. Lý do: đúng brief "kết nối API NestJS qua REST", giảm phụ thuộc.
- **2026-06-29** — Token ở **httpOnly cookie** (`admin_token`); fetch ở **Server Components/Actions**
  (token không lộ ra browser JS) → chống XSS. Đã loại: localStorage + client fetch trực tiếp.
- **2026-06-29** — Next.js **App Router + TS**, no Tailwind (CSS tối giản), package độc lập (npm).

## Bản đồ file/module
| File | Vai trò |
|---|---|
| `apps/admin/lib/api.ts` | server fetch tới NestJS (Bearer từ cookie, 401→/login) |
| `apps/admin/lib/auth.ts` | get/set/clear cookie token |
| `apps/admin/app/login/{page,actions}.tsx` | đăng nhập (proxy NestJS) |
| `apps/admin/app/users/page.tsx` | list user + phân trang |
| `apps/admin/app/users/[uid]/page.tsx` | chi tiết + xoá |
| `apps/admin/middleware.ts` | chặn route khi chưa login |

## Phát hiện & cạm bẫy
- Next 15: `cookies()` là **async** (await). Server Action set cookie + `redirect`.
- Page fetch dùng cookies() → tự `dynamic`, `next build` không gọi API (an toàn build offline).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Backend phụ thuộc: [m1-backend-user-mgmt](../m1-backend-user-mgmt/) (C2), [m1-backend-admin-auth](../m1-backend-admin-auth/) (C3)

## Tóm tắt khi hoàn thành
Code D xong (B1–B4): Next.js 16 admin (`apps/admin`) — login (proxy NestJS + httpOnly cookie),
`/users` list+phân trang, `/users/[uid]` detail + Xoá (server action DELETE), `proxy.ts` chặn
route chưa đăng nhập. Chỉ gọi REST NestJS; token không lộ client. Verify offline: tsc/build/lint pass.
**Còn nợ:** live verify (chạy backend + admin seed + API_BASE_URL).

## Phát hiện thêm
- Next 16: `middleware.ts` deprecated → dùng **`proxy.ts`** (export `proxy`). `cookies()`/`params`/`searchParams` async.
- Bỏ `next/font/google` (Geist) để build không phụ thuộc mạng tải font.
- `next.config.ts` set `turbopack.root` vì monorepo nhiều lockfile.
