# Kế hoạch: Web Admin (Next.js) - login + list/detail/xoá user

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-admin-web`
- **Milestone:** M1 - Part D
- **Phần liên quan:** admin (Next.js web)
- **Ngày tạo:** 2026-06-29 · **Cập nhật:** 2026-06-29

## 1. Mục tiêu & phạm vi
Web admin **Next.js** (App Router, TS) cho admin: **đăng nhập** + **danh sách user** +
**chi tiết user** + **xoá user**. Nói chuyện **chỉ qua REST NestJS** (login proxy C3 +
users C2). Token lưu **httpOnly cookie** (server-side), fetch ở Server Components/Actions
(không lộ token ra browser JS). Deploy được Vercel.

**Ngoài phạm vi:** trạng thái thiết bị/usage (M2 admin); CRUD admin; UI design cầu kỳ.

## 2. Bối cảnh & ràng buộc
- Backend C2/C3 đã có: `POST /admin/auth/login`, `GET /admin/me`, `GET /users`, `GET /users/:uid`,
  `DELETE /users/:uid` (bọc AdminAuthGuard). Admin web gửi **Bearer** (từ cookie) tới các endpoint này.
- **Đăng nhập = Supabase Auth** (qua proxy NestJS `/admin/auth/login`) → admin web chỉ phụ thuộc REST NestJS (đúng brief).
- Secret/cấu hình để env: **`API_BASE_URL`** (server-only). Không nhúng token/secret vào client bundle.
- Token ở **httpOnly cookie** (`admin_token`) - chống XSS đọc token.
- Next.js: page fetch dùng **`cookies()` (async, Next 15)** → tự `dynamic`; build không gọi API.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `apps/admin` build (`next build`) + `tsc` + `eslint` pass.
- [ ] AC2: `/login` POST `API/admin/auth/login`; thành công → set httpOnly cookie + redirect `/users`; sai → hiện lỗi. Logout xoá cookie.
- [ ] AC3: `/users` đọc `API/users` (Bearer từ cookie, server-side) + **phân trang**; 401 → redirect `/login`.
- [ ] AC4: `/users/[uid]` hiện chi tiết + nút **Xoá** → server action `DELETE API/users/:uid` → quay lại list.
- [ ] AC5: grep secret sạch; `.env.example` có `API_BASE_URL`; token KHÔNG xuất hiện trong client component/bundle.

## 4. Các bước thực hiện
1. **B1 - Scaffold Next.js + API helper + env**
   - `create-next-app apps/admin` (TS, App Router, eslint, no-tailwind, alias @/*); `lib/api.ts` (server fetch: gắn Bearer từ cookie, 401 → redirect /login); env `API_BASE_URL`.
   - File: `apps/admin/*`, `apps/admin/lib/api.ts`, `apps/admin/.env.example`, `.gitignore`.
   - Test: `tsc`/`next build` pass.
2. **B2 - Auth (login/cookie/logout)**
   - `app/login/page.tsx` (form client) + `app/login/actions.ts` (server action gọi NestJS login → set cookie → redirect); `app/logout` action; middleware/redirect khi chưa login.
   - File: `app/login/{page.tsx,actions.ts}`, `lib/auth.ts`, `middleware.ts`.
   - Test: build; (live login chờ API+admin seed).
3. **B3 - Users list + detail + delete + styling**
   - `app/users/page.tsx` (table + pagination), `app/users/[uid]/page.tsx` (detail + DeleteButton client → server action delete), `app/page.tsx` redirect → /users; CSS tối giản `app/globals.css`.
   - File: `app/users/*`, `app/users/[uid]/*`, components.
   - Test: build; (live data chờ API).
4. **B4 - typecheck/build/lint + README + secret sweep + state**
   - README (run/env/deploy); grep secret.
   - Test: `tsc` + `next build` + `eslint` pass; grep sạch.

## 5. Rủi ro & câu hỏi mở
- ⚠️ Live verify (login/list/xoá thật) cần **backend chạy + admin seed + creds** → hoãn; build/lint/tsc để đóng AC offline.
- ⚠️ Next 15 `cookies()` async + Server Actions - cẩn thận `await`. Page fetch để `dynamic` (cookies() tự opt-out static) nên `next build` không gọi API.
- ❓ Cần khi chạy thật: `API_BASE_URL` trỏ tới NestJS (local `http://localhost:3000` hoặc URL Vercel) + admin đã seed (C3).
