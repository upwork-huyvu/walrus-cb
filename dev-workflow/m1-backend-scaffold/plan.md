# Kế hoạch: Scaffold backend NestJS + Supabase + client Tuya Cloud OpenAPI

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-backend-scaffold`
- **Milestone:** M1 — Nền tảng, Kết nối lõi & Quản lý User (Part C1)
- **Phần liên quan:** backend (NestJS + Supabase)
- **Ngày tạo:** 2026-06-28
- **Cập nhật lần cuối:** 2026-06-28

## 1. Mục tiêu & phạm vi
Dựng nền **backend NestJS** (`apps/backend`) chạy trên **Vercel** + **Supabase
(Postgres qua Prisma)**, với: `ConfigModule` (validate env, secret server-only),
`PrismaModule` (kết nối Postgres), và **`TuyaModule`** cung cấp **client gọi Tuya
Cloud OpenAPI** (ký **HMAC-SHA256** + quản lý `access_token`). Đây là nền cho
`UserModule` (C2) và `AdminAuthModule` (C3). Có endpoint `/health`. Tôn trọng
**EU data residency**.

**Ngoài phạm vi (không làm trong feature này):**
- API list/detail/**xoá user** + bảng `delete_jobs` + cron retry → `m1-backend-user-mgmt` (C2).
- Auth admin (Supabase Auth) → `m1-backend-admin-auth` (C3).
- Web admin (Next.js) → `m1-admin-web` (D).
- **Deploy thật lên Vercel** (hành động outward — chỉ chuẩn bị cấu hình, KHÔNG deploy).

## 2. Bối cảnh & ràng buộc
- **Tuya Cloud OpenAPI ≠ App SDK.** Backend dùng **Access ID + Access Secret** của
  **Cloud Project** (KHÁC `AppKey/AppSecret` của App SDK mobile ở `m1-tuya-sdk-library`).
  Endpoint theo vùng — EU = `https://openapi.tuyaeu.com`. DC phải **khớp** phần còn lại (EU).
- **BẮT BUỘC research trước khi code B4** (đụng Tuya). Note App SDK đã có nhưng
  **chưa có note cho Cloud OpenAPI signing** → chạy
  **`/tuya-research Tuya Cloud OpenAPI: HMAC-SHA256 request signing (token-sign vs business-sign, SHA256 body, header order) + token management /v1.0/token + regional endpoints`**
  rồi link vào "Link nghiên cứu". (Thuật toán dưới mục Rủi ro là *tạm thời*, phải verify.)
- **Secret server-only, KHÔNG vào repo/bundle:** Supabase **service_role**, Tuya Cloud
  **Access Secret**, (sau này) FCM server key. Chỉ ở env trên server.
- **EU data residency:** Supabase project region EU; Tuya endpoint EU.
- **Serverless caveat:** NestJS trên Vercel chạy serverless (cold start). **`@nestjs/schedule`
  cron (cho `delete_jobs` ở C2) KHÔNG chạy ổn trên serverless** → C2 sẽ cần Vercel Cron
  hoặc worker riêng. (Flag sớm, không xử lý ở C1.)
- **Monorepo:** `apps/backend` là **project npm độc lập** (KHÔNG gộp vào yarn-berry của lib
  `packages/tuya-react-native` — toolchain khác hẳn).
- **Link nghiên cứu liên quan:** App SDK: [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md); Cloud OpenAPI: _chưa có_ (cần cho B4).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] AC1: `apps/backend` NestJS boot được (`npm run build` + start), **TS strict**;
      `GET /health` → 200 `{status:"ok"}`.
- [ ] AC2: `ConfigModule` **validate env, thiếu key → fail fast**; `.env.example` đủ key;
      `.gitignore` phủ `.env*`; grep secret sạch.
- [ ] AC3: Prisma: `schema.prisma` (datasource postgres) + `PrismaService`; `prisma generate`
      OK; có script `migrate`. Khi có `DATABASE_URL` → kết nối + 1 query chạy; nếu chưa có URL
      → unit/structure pass + đánh dấu cần URL.
- [ ] AC4: `TuyaModule` **ký HMAC-SHA256 đúng** (unit test theo vector trong research) + lấy
      `access_token` từ Tuya Cloud EU khi có Access ID/Secret (integration; blocked nếu chưa có creds).
- [ ] AC5: Cấu trúc module rõ (`TuyaModule` tách biệt, sẵn chỗ `UserModule`/`AdminAuthModule`);
      build + lint pass; có **Vercel handler** (`api/index.ts`) — chưa deploy.

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test. `progress.md` tham chiếu B#.

1. **B1 — Init NestJS app `apps/backend`**
   - Việc: tạo project NestJS (npm), TS strict, eslint/prettier; `AppModule` + `HealthController` (`GET /health`).
   - File: `apps/backend/{package.json,tsconfig.json,nest-cli.json,src/main.ts,src/app.module.ts,src/health/health.controller.ts}`.
   - Test: `npm run build` OK; start + `curl /health` → 200.
2. **B2 — ConfigModule + validate env + .env.example**
   - Việc: `@nestjs/config` global + schema validate (zod) — thiếu env → throw lúc boot; tạo `.env.example` + `.gitignore` phủ `.env*`.
   - File: `src/config/{config.module.ts,env.validation.ts}`, `apps/backend/.env.example`, `apps/backend/.gitignore`.
   - Test: bỏ 1 env → boot fail rõ ràng; `.env.example` đủ key; `grep` secret sạch.
3. **B3 — Prisma + Supabase Postgres**
   - Việc: cài `prisma`/`@prisma/client`; `schema.prisma` (datasource postgres, generator); `PrismaModule`/`PrismaService` (onModuleInit connect); lưu ý **pgbouncer** (pooled `:6543?pgbouncer=true` cho runtime + direct `:5432` cho migrate); script `db:migrate`/`db:generate`.
   - File: `prisma/schema.prisma`, `src/prisma/{prisma.module.ts,prisma.service.ts}`, `package.json` scripts.
   - Test: `prisma generate` OK; nếu có `DATABASE_URL` → connect + `SELECT 1`; nếu không → structure/unit pass, mark cần URL.
4. **B4 — TuyaModule: signed client + token manager** *(cần `/tuya-research` Cloud OpenAPI trước)*
   - Việc: HTTP client (axios/undici) + interceptor **ký HMAC-SHA256** theo spec Cloud OpenAPI; `TokenService` lấy/cache/refresh `access_token` (`GET /v1.0/token?grant_type=1`); config endpoint EU; `TuyaModule` export service.
   - File: `src/tuya/{tuya.module.ts,tuya-cloud.service.ts,tuya-sign.ts,token.service.ts}`, `src/tuya/__tests__/tuya-sign.spec.ts`.
   - Test: **unit test ký** theo vector trong research; integration lấy token (cần Access ID/Secret → blocked nếu thiếu).
5. **B5 — Vercel handler + README + secret sweep**
   - Việc: `api/index.ts` wrap Nest app (serverless), `vercel.json`; `README.md` (run/env/deploy + caveat cron serverless); rà secret.
   - File: `apps/backend/{api/index.ts,vercel.json,README.md}`.
   - Test: `npm run build` cho serverless OK; `grep` secret sạch; README đủ mục.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Signing Cloud OpenAPI dễ sai** (token-sign vs business-sign, `SHA256(body)`, thứ tự header `client_id/sign/t/sign_method/nonce/access_token`). *Tạm thời (PHẢI verify qua research):* `sign = upper(HMAC_SHA256(client_id + [access_token] + t + nonce + stringToSign, secret))`, `stringToSign = METHOD\n SHA256(body)\n signHeaders\n path`. Endpoint EU `openapi.tuyaeu.com`. → research + unit vector.
- ⚠️ **Cron serverless:** `@nestjs/schedule` cho `delete_jobs` (C2) không hợp Vercel serverless → C2 dùng Vercel Cron / worker. Flag sớm.
- ⚠️ **Prisma + Supabase serverless:** dùng pooled (pgbouncer) cho runtime, direct cho migrate; coi chừng connection limit + cold start.
- ⚠️ **Secret server-only + EU residency:** service_role/Access Secret chỉ ở env server; Supabase region EU; Tuya endpoint EU.
- ❓ Cần user cung cấp: **Supabase** project (URL + `DATABASE_URL` pooled & direct + **service_role** key, region EU); **Tuya Cloud Access ID + Access Secret** (+ confirm endpoint EU). (Chặn B3 chạy DB thật + B4 integration; KHÔNG chặn B1–B2.)
- ❓ ORM: **Prisma** (typed + migrations) — chốt; đã loại TypeORM / Supabase-js client thuần.
