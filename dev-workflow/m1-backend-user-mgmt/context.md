# Context: UserModule — list/detail/xoá user + delete_jobs retry

- **Slug:** `m1-backend-user-mgmt`

## Quyết định kỹ thuật (Decision log)
- **2026-06-28** — Xoá user mặc định = **Tuya pre-delete** (`POST /v1.0/users/{uid}/actions/pre-delete`,
  ân hạn 7 ngày) + xoá business data Supabase. Hard delete (`DELETE /v1.0/iot-02/users/{uid}`) để dành tuỳ chọn.
- **2026-06-28** — Retry xoá: bảng **`delete_jobs`** (đã có ở schema C1) + **Vercel Cron** gọi
  endpoint nội bộ (guard `CRON_SECRET`). KHÔNG dùng `@nestjs/schedule` (serverless không chạy).
- **2026-06-28** — DTO validate bằng **class-validator/class-transformer** (Nest ValidationPipe đã bật).
- **2026-06-28** — `schema` (channel App SDK) cho list users → env `TUYA_APP_SCHEMA`.

## Bản đồ file/module
| File | Vai trò |
|---|---|
| `src/users/users.service.ts` | listUsers / getUser / deleteUser (orchestration) |
| `src/users/delete-jobs.service.ts` | enqueue / processOne / processPending (retry) |
| `src/users/users.controller.ts` | GET /users, GET /users/:uid, DELETE /users/:uid |
| `src/users/cron.controller.ts` | POST /internal/cron/process-delete-jobs (guard CRON_SECRET) |
| `src/users/dto/list-users.query.ts` | DTO phân trang |
| `src/users/tuya-user.types.ts` | type response Tuya |

## Phát hiện & cạm bẫy
- List = **`/v2.0/apps/{schema}/users`** (cần schema); detail = **`/v1.0/users/{uid}/infos`**;
  pre-delete = **`POST /v1.0/users/{uid}/actions/pre-delete`**; delete = **`DELETE /v1.0/iot-02/users/{uid}`**.
- `page_size` ≤ 100; phân trang theo `has_more`.
- Pre-delete ân hạn **7 ngày**.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Research: [docs/research/tuya-cloud-user-management.md](../../docs/research/tuya-cloud-user-management.md), [tuya-cloud-openapi-signing.md](../../docs/research/tuya-cloud-openapi-signing.md)
- Nền: [m1-backend-scaffold](../m1-backend-scaffold/) (TuyaCloudService + Prisma + DeleteJob model)

## Tóm tắt khi hoàn thành
Code C2 xong (B1–B3): UsersModule (GET /users list+phân trang+business; GET /users/:uid;
DELETE /users/:uid = Tuya pre-delete + Supabase cleanup + delete_jobs) + CronController
(GET /internal/cron/process-delete-jobs, Bearer CRON_SECRET) + vercel.json crons. Verify
offline: build/lint/unit 12/12/e2e pass. **Còn nợ:** live verify (gọi Tuya thật + DB thật)
chờ env; auth admin cho endpoint user thuộc C3.
