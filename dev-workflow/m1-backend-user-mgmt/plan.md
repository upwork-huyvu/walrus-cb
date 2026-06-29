# Kế hoạch: UserModule — list/detail/xoá user (Tuya Cloud + Supabase) + delete_jobs retry

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-backend-user-mgmt`
- **Milestone:** M1 — Part C2
- **Phần liên quan:** backend (NestJS)
- **Ngày tạo:** 2026-06-28 · **Cập nhật:** 2026-06-28

## 1. Mục tiêu & phạm vi
Xây **UserModule** trên nền `m1-backend-scaffold`: API cho web admin **list / xem chi
tiết / xoá** end-user. List & detail đọc từ **Tuya Cloud OpenAPI** + ghép **business
data** ở Supabase. Xoá = **Tuya pre-delete** + xoá business data Supabase, có **bảng
`delete_jobs` + cron retry** (Vercel Cron) để 2 hệ thống hội tụ khi 1 bên lỗi tạm thời.

**Ngoài phạm vi:** auth admin (C3) — tạm thời để endpoint mở / guard CRON_SECRET cho cron;
UI admin (D); profile chi tiết.

## 2. Bối cảnh & ràng buộc
- ✅ Research: [docs/research/tuya-cloud-user-management.md](../../docs/research/tuya-cloud-user-management.md) (list `GET /v2.0/apps/{schema}/users`, info `GET /v1.0/users/{uid}/infos`, pre-delete `POST /v1.0/users/{uid}/actions/pre-delete`, delete `DELETE /v1.0/iot-02/users/{uid}`).
- Dựng trên `TuyaCloudService` (ký business + token) + `PrismaService` đã có.
- **`schema`** (channel App SDK) cần cho list → env `TUYA_APP_SCHEMA`. `page_size` ≤ 100.
- **Pre-delete có ân hạn 7 ngày** (huỷ được trong 7 ngày).
- **Cron: `@nestjs/schedule` KHÔNG chạy serverless** → dùng **Vercel Cron** gọi endpoint nội bộ (guard `CRON_SECRET`).
- Secret để env (chế độ "làm hết"): `TUYA_APP_SCHEMA`, `CRON_SECRET`.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `GET /users?page_no=&page_size=` trả list (Tuya + business data) có phân trang; `GET /users/:uid` trả chi tiết. (unit mock + build)
- [ ] AC2: `DELETE /users/:uid` chạy **pre-delete + xoá business data + ghi delete_jobs**; nếu 1 bước lỗi → job **pending** + `attempts++` + `lastError` (unit).
- [ ] AC3: Endpoint cron `POST /internal/cron/process-delete-jobs` **chặn nếu thiếu/ sai `CRON_SECRET`**; khi đúng → xử lý job pending (unit).
- [ ] AC4: build + lint + unit test pass; secret sweep sạch; `.env.example` có `TUYA_APP_SCHEMA` + `CRON_SECRET`.

## 4. Các bước thực hiện
1. **B1 — UserModule: list + detail**
   - DTO query (class-validator) + `UsersService.listUsers/getUser` gọi `TuyaCloudService` + ghép `device_mappings` (Prisma) + `UsersController` (GET /users, GET /users/:uid). Thêm env `TUYA_APP_SCHEMA`.
   - File: `src/users/{users.module,users.service,users.controller}.ts`, `src/users/dto/list-users.query.ts`, `src/users/tuya-user.types.ts`, `src/config/env.validation.ts`, `.env.example`.
   - Test: unit (mock TuyaCloudService/Prisma) map list+detail; build.
2. **B2 — Delete flow + delete_jobs**
   - `DeleteJobsService` (enqueue/processOne/processPending) + `UsersService.deleteUser` (pre-delete → Prisma cleanup → mark done; lỗi → pending+attempts). `DELETE /users/:uid`.
   - File: `src/users/delete-jobs.service.ts`, cập nhật `users.service.ts`/`users.controller.ts`.
   - Test: unit orchestration (success → done; Tuya lỗi → pending; Supabase lỗi → pending).
3. **B3 — Cron retry (Vercel Cron)**
   - `CronController` `POST /internal/cron/process-delete-jobs` (guard header `x-cron-secret` == `CRON_SECRET`) → `processPending`. Thêm env `CRON_SECRET` + `crons` trong `vercel.json`.
   - File: `src/users/cron.controller.ts`, `src/config/env.validation.ts`, `.env.example`, `apps/backend/vercel.json`.
   - Test: unit guard (sai secret → Unauthorized) + processPending gọi processOne cho job pending.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Endpoint cron chưa có auth admin (C3)** → tạm guard bằng `CRON_SECRET`; user-facing endpoints sẽ được bảo vệ ở C3.
- ⚠️ **Pre-delete ≠ xoá ngay (7 ngày)** → admin UI cần hiểu; có thể bổ sung hard-delete sau.
- ⚠️ Live verify (gọi Tuya thật, DB thật) cần env → hoãn; unit mock để đóng AC1–AC3 offline.
- ❓ Cần khi chạy thật: `TUYA_APP_SCHEMA`, creds Tuya Cloud, Supabase DB, `CRON_SECRET`.
