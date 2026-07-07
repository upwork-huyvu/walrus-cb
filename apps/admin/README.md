# cool-bath admin (Next.js)

Web quản trị: đăng nhập admin + danh sách / chi tiết / xoá user. Nói chuyện **chỉ
qua REST NestJS** (`apps/backend`). Token lưu **httpOnly cookie**, fetch ở Server
Components/Actions (token không lộ ra browser JS).

> Feature: `m1-admin-web` (D). Đăng nhập = Supabase Auth qua proxy NestJS `/admin/auth/login`.

## Cấu trúc
```
app/
  login/page.tsx        form đăng nhập (client) → server action login
  users/page.tsx        danh sách user + phân trang
  users/[uid]/page.tsx  chi tiết + nút Xoá
  users/[uid]/actions.ts server action deleteUser
lib/api.ts   fetch NestJS (Bearer từ cookie, 401/403 → /login)
lib/auth.ts  server actions login/logout (set/xoá httpOnly cookie)
proxy.ts     chặn /users/* khi chưa đăng nhập (Next 16 "proxy")
components/DeleteButton.tsx  nút xoá (client)
```

## Chạy local
```bash
npm install
cp .env.example .env.local   # set API_BASE_URL trỏ tới NestJS
npm run dev                  # http://localhost:3001 (đổi PORT nếu trùng backend 3000)
```
> Backend (`apps/backend`) phải chạy + đã **seed 1 admin** (xem README backend) thì mới đăng nhập được.
> Mặc định Next chạy cổng 3000 - trùng backend → chạy `PORT=3001 npm run dev` (hoặc đổi cổng backend).

## Env (xem `.env.example`)
- `API_BASE_URL` - base URL backend NestJS (local `http://localhost:3000` hoặc URL Vercel). Server-only.
- Không cần khoá Supabase ở frontend (đăng nhập đi qua proxy NestJS).

## Build / lint
```bash
npx tsc --noEmit
npm run build
npm run lint
```

## Deploy Vercel (KHÔNG tự deploy - cần xác nhận)
- Project root = `apps/admin`. Set env `API_BASE_URL` ở Vercel Project Settings.
- Cookie `admin_token` đặt `secure` ở production.
