# cool-bath backend (NestJS)

Backend trung gian: NestJS REST API (Vercel) + Supabase (Postgres qua Prisma) +
client gọi **Tuya Cloud OpenAPI**. Phục vụ web admin (list/xem/xoá user) ở các
feature sau (C2/C3/D).

> Feature hiện tại: `m1-backend-scaffold` (C1) — scaffold + TuyaModule (ký + token).
> User endpoints + delete_jobs cron = C2; admin auth = C3.

## Cấu trúc
```
src/
  config/   ConfigModule + validate env (zod) + AppConfigService
  prisma/   PrismaModule + PrismaService (Postgres/Supabase)
  tuya/     TuyaModule: tuya-sign (HMAC-SHA256) · TuyaTokenService · TuyaCloudService
  health/   GET /health
api/index.ts  Vercel serverless handler (bọc Nest trên Express)
prisma/schema.prisma
```

## Chạy local
```bash
npm install
cp .env.example .env   # rồi điền giá trị thật (xem bên dưới)
npm run db:generate    # prisma generate
npm run start:dev      # http://localhost:3000/health
```
App **boot được khi chưa điền secret** (dev): chưa có `DATABASE_URL` → bỏ qua kết nối
DB; gọi Tuya khi chưa có Access ID/Secret sẽ báo lỗi rõ ràng. Điền `.env` để bật đầy đủ.

## Biến môi trường (xem `.env.example`)
- `DATABASE_URL` (pooled pgbouncer `:6543`), `DIRECT_URL` (direct `:5432` cho migrate),
  `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (**server-only**).
- `TUYA_OPENAPI_ENDPOINT` (mặc định Western Europe `openapi-weaz.tuyaeu.com` — **phải khớp
  Data Center của Cloud Project**), `TUYA_ACCESS_ID` (client_id), `TUYA_ACCESS_SECRET`
  (**server-only**). Đây là credentials **Cloud Project**, KHÁC AppKey/AppSecret App SDK mobile.
- Ở `NODE_ENV=production`, thiếu `DATABASE_URL`/`TUYA_ACCESS_ID`/`TUYA_ACCESS_SECRET` → boot fail (fail-fast).

## Database (Prisma + Supabase)
```bash
npm run db:migrate     # tạo migration (cần DIRECT_URL)
npm run db:deploy      # áp migration ở CI/prod
```
- Runtime serverless dùng **pooled** (pgbouncer), migrate dùng **direct**.

## Tuya Cloud OpenAPI
- Ký HMAC-SHA256 theo [docs/research/tuya-cloud-openapi-signing.md](../../docs/research/tuya-cloud-openapi-signing.md).
- `TuyaTokenService.getAccessToken()` lấy/cache/refresh token; `TuyaCloudService.request()`
  gọi business API (ký kèm access_token). Unit test ký: `src/tuya/tuya-sign.spec.ts`.

## Admin auth (Supabase Auth)
Admin tách biệt hoàn toàn end-user (end-user do Tuya quản lý). Admin = **Supabase Auth user**
**AND** có trong allowlist bảng `admin_users`.
- `POST /admin/auth/login` `{email,password}` → proxy Supabase password grant, trả session (chỉ khi là admin).
- `GET /admin/me` (Bearer) → thông tin admin hiện tại.
- `GET|DELETE /users/*` được bọc `AdminAuthGuard` (verify token qua `GET /auth/v1/user` + allowlist).
- `GET /internal/cron/*` KHÔNG dùng admin guard — vẫn `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron).

**Seed admin đầu tiên:**
1. Tạo user trên Supabase Auth (Dashboard hoặc `POST /auth/v1/signup`).
2. Thêm email vào allowlist:
   ```sql
   insert into admin_users (id, email) values (gen_random_uuid(), 'admin@example.com');
   ```
   (hoặc `prisma studio`). Thiếu bước này → token hợp lệ vẫn bị **403**.

## Test / build
```bash
npm test         # unit (gồm test ký Tuya)
npm run test:e2e # e2e: GET /health
npm run build    # nest build
npm run lint
```

## Deploy Vercel (KHÔNG tự deploy — cần xác nhận)
- `api/index.ts` = serverless entry; `vercel.json` rewrite mọi route về `/api`.
- ⚠️ **Cron in-process (`@nestjs/schedule`) KHÔNG chạy trên serverless.** `delete_jobs`
  retry (C2) sẽ dùng **Vercel Cron** hoặc worker riêng.
- Set env trên Vercel Project Settings (không commit secret).
