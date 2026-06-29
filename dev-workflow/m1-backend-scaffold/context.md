# Context: Scaffold backend NestJS + Supabase + client Tuya Cloud OpenAPI

> File "trí nhớ" — giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-backend-scaffold`

## Quyết định kỹ thuật (Decision log)
- **2026-06-28** — Backend = **NestJS + Supabase (Postgres) + Vercel** (kế thừa quyết định
  dự án). NestJS REST API; Supabase chỉ làm DB (+ Auth cho admin ở C3).
- **2026-06-28** — ORM = **Prisma** (typed client + migrations). Đã loại: TypeORM; dùng
  `@supabase/supabase-js` thuần (kém typed cho domain phức tạp).
- **2026-06-28** — `apps/backend` là **project npm độc lập**, KHÔNG gộp vào yarn-berry của
  `packages/tuya-react-native`. Lý do: toolchain Nest (npm) vs RN lib (yarn4) khác hẳn; gộp
  workspace gây rắc rối (đã gặp lỗi yarn project ở `~`). Monorepo = cấu trúc thư mục, không
  ép 1 package manager.
- **2026-06-28** — Tuya Cloud OpenAPI dùng **Access ID/Access Secret của Cloud Project**
  (KHÁC AppKey/AppSecret của App SDK mobile). Endpoint EU `openapi.tuyaeu.com`.
- **2026-06-28** — Validate env bằng **zod** (fail-fast lúc boot). Secret là optional ở dev
  (boot được khi chưa điền), **bắt buộc ở `NODE_ENV=production`** (fail-fast).
- **2026-06-28 (B1)** — `nest new` → **NestJS 11**, npm, TS strict. Bỏ boilerplate `AppController/Service`.
- **2026-06-28 (B3)** — **Pin Prisma v6** (`6.19.3`). Lý do: Prisma **7** bỏ `directUrl` khỏi
  `schema.prisma` (chuyển sang `prisma.config.ts`) → v6 giữ `url`+`directUrl` quen thuộc, ít xáo trộn.
- **2026-06-28 (B4)** — HTTP client dùng **`fetch` built-in (Node 20)** + `node:crypto`
  (HMAC/SHA/randomUUID) → KHÔNG cần axios/uuid. zod là **v4**.
- **2026-06-28 (B5)** — Vercel handler dùng **express** (ExpressAdapter) cache giữa invocation;
  thêm dep `express`. `nest build` cũng compile `api/index.ts` (typecheck luôn).

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/backend/` | ✅ NestJS app (scaffolded B1) |
| `apps/backend/src/health/` | `/health` endpoint |
| `apps/backend/src/config/` | ConfigModule + env validation (zod) |
| `apps/backend/src/prisma/` | PrismaModule/PrismaService |
| `apps/backend/prisma/schema.prisma` | datasource Postgres (Supabase) |
| `apps/backend/src/tuya/` | **TuyaModule**: signed Cloud OpenAPI client + token manager |
| `apps/backend/api/index.ts` | Vercel serverless handler wrap Nest |
| `docs/research/tuya-cloud-openapi-signing.md` | (cần tạo) note signing Cloud OpenAPI cho B4 |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **Tuya Cloud OpenAPI ≠ App SDK** — credentials khác (Access ID/Secret vs AppKey/Secret),
  signing khác (HMAC-SHA256 với token-sign/business-sign), endpoint theo vùng.
- **Vercel serverless + `@nestjs/schedule`**: cron in-process KHÔNG chạy ổn (no long-lived
  process) → `delete_jobs` retry ở C2 phải dùng **Vercel Cron** hoặc worker riêng. Quyết định
  cuối để ở C2; ghi nhớ tại đây.
- **Prisma + Supabase**: runtime dùng **pooled** connection (pgbouncer `:6543?pgbouncer=true`),
  migrate dùng **direct** (`:5432`). Connection limit + cold start cần lưu ý.
- **(B3) Prisma 7 breaking:** bỏ `directUrl` khỏi schema → đã **pin v6**. `PrismaService.onModuleInit`
  **guard**: chưa có `DATABASE_URL` thì skip `$connect()` (cho phép boot dev không cần DB).
- **(B1) `nest build` xuất ra `dist/src/...` và `dist/api/...`** (không phải `dist/...` phẳng).
- **(B4 test) supertest `res.body` là `any`** → eslint `no-unsafe-member-access`; cast
  `res.body as { status?: string }` trong e2e.
- **EU Western Europe endpoint = `openapi-weaz.tuyaeu.com`** (Central Europe = `openapi.tuyaeu.com`)
  — để ở env `TUYA_OPENAPI_ENDPOINT`, mặc định Western Europe.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: App SDK [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md); Cloud OpenAPI signing ✅ [docs/research/tuya-cloud-openapi-signing.md](../../docs/research/tuya-cloud-openapi-signing.md).
- Báo cáo audit liên quan: _chưa có_
- Feature liên quan: [m1-backend-user-mgmt] (C2, sau), [m1-tuya-sdk-library](../m1-tuya-sdk-library/) (mobile, độc lập backend)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
