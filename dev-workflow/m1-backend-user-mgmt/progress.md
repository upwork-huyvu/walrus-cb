# Progress: UserModule — list/detail/xoá user + delete_jobs retry

- **Slug:** `m1-backend-user-mgmt`
- **Phase hiện tại:** `DEV` (B1–B3 code xong; chờ env để verify live)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-28

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Code B1–B3 XONG + verify offline** (build/unit 12/12/e2e/lint pass).
Để chạy thật cần env: `TUYA_APP_SCHEMA`, Tuya Cloud creds, Supabase `DATABASE_URL`, `CRON_SECRET`.
Sau đó: `npm run db:migrate` (tạo bảng delete_jobs/...) + gọi thử `GET /users` & `DELETE /users/:uid`.
Tiếp theo trong M1: **C3 `/plan m1-backend-admin-auth`** (bảo vệ các endpoint user) rồi **D `m1-admin-web`**.

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 — UserModule: list + detail · **done** (UsersService/Controller + DTO + types + env TUYA_APP_SCHEMA)
- [x] B2 — Delete flow + delete_jobs · **done** (DeleteJobsService + executeJob: pre-delete + cleanup + retry)
- [x] B3 — Cron retry (Vercel Cron) · **done** (CronController GET + Bearer CRON_SECRET + crons trong vercel.json)

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — GET /users (list+business+phân trang) + GET /users/:uid (build/types OK; live verify chờ env)
- [x] AC2 — DELETE /users/:uid: pre-delete + cleanup + delete_jobs (3 unit test pass)
- [x] AC3 — Cron endpoint chặn CRON_SECRET + xử lý pending (3 unit test pass)
- [x] AC4 — build/lint/unit(12)/e2e pass + secret sweep + .env.example đủ (TUYA_APP_SCHEMA, CRON_SECRET)

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-28 | TEST B1–B3 | ✅ | `nest build` OK; jest **12/12** (tuya-sign 6 + users.service 3 + cron 3); e2e `/health` OK; eslint 0 error. |
| 2026-06-28 | DEV B1–B3 | ✅ | UsersModule (list/detail/delete + cron) + DeleteJobsService; env TUYA_APP_SCHEMA/CRON_SECRET; vercel.json crons (0 * * * *); class-validator/transformer. |
| 2026-06-28 | RESEARCH+PLAN | ✅ | `docs/research/tuya-cloud-user-management.md`; plan/context/progress; INDEX. |

## Vấn đề đang chặn (Blockers)
- Không chặn code. Live verify cần env: `TUYA_APP_SCHEMA`, Tuya Cloud `TUYA_ACCESS_ID/SECRET`, Supabase `DATABASE_URL`/`DIRECT_URL`, `CRON_SECRET`.
- Endpoint user hiện **chưa có auth admin** → C3 (`m1-backend-admin-auth`) sẽ bảo vệ.
