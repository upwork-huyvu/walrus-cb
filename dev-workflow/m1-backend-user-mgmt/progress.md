# Progress: UserModule — list/detail/xoá user + delete_jobs retry

- **Slug:** `m1-backend-user-mgmt`
- **Phase hiện tại:** `DEV` (code xong; **live verify 2026-07-02 → BLOCKED bởi Tuya platform, KHÔNG phải code**)
- **Trạng thái:** `blocked_external` (backend đúng; `/users` trả rỗng do app chưa release + account chưa enterprise-verify)
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
⚠️ **LIVE VERIFY 2026-07-02: backend ĐÚNG nhưng `GET /users` = `total:0`.** Đã chứng minh backend chuẩn
(project Cloud key `v75ujhfs..` + ký HMAC OK + schema `walruswellnesscb` + DC Central Europe — probe token OK
mọi host). App **đã Link My App** vào project (Devices tab) nhưng **Status "Building"**. Tạo **user MỚI sau
link** (`showroom.imax@`) → **vẫn total:0** ⇒ không phải timing/code. → **Gate Tuya platform:** app chưa
release (Building) + account chưa **enterprise verify** (UI Operation→User Management cũng thiếu, cùng gốc).
**Việc client:** release App SDK / hoàn tất enterprise verification / ticket Tuya. Chi tiết → context.md.
(App-auth key `p37v9tnv..` **KHÔNG** dùng cho OpenAPI — cho `1004 sign invalid`; giữ project key.)

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
| 2026-07-02 | **LIVE VERIFY /users (device + cloud)** | ⚠️ blocked | Backend **ĐÚNG hết**: credential = project Cloud key `v75ujhfs..` (App-auth key `p37v9tnv..` sai loại → `1004 sign invalid`, không mint token); ký HMAC OK; schema `walruswellnesscb`; DC Central Europe (probe 6 host: token OK EU/US, các DC khác "suspended" vì project chưa bật). `GET /v2.0/apps/{schema}/users` → **`total:0`** với **CẢ** user cũ (`imax.dev.sn@`) LẪN user **MỚI tạo sau khi Link My App** (`showroom.imax@`) → **loại timing/propagation**. App **đã Link My App** (Devices tab, project walrus, Central Europe) nhưng **Status = "Building"**, Linked Devices 0. Console **Operation → User Management KHÔNG có** (account chưa enterprise-verify). ⇒ **Gate Tuya platform** (app chưa release + account chưa verify), KHÔNG phải code. Fix = release App SDK / enterprise verification / ticket Tuya. Research: workflow (App Authorization ≠ OpenAPI cred; Link My App là cơ chế đúng; UI xem user = Operation→User Management / Data Center→App user). |
| 2026-06-28 | TEST B1–B3 | ✅ | `nest build` OK; jest **12/12** (tuya-sign 6 + users.service 3 + cron 3); e2e `/health` OK; eslint 0 error. |
| 2026-06-28 | DEV B1–B3 | ✅ | UsersModule (list/detail/delete + cron) + DeleteJobsService; env TUYA_APP_SCHEMA/CRON_SECRET; vercel.json crons (0 * * * *); class-validator/transformer. |
| 2026-06-28 | RESEARCH+PLAN | ✅ | `docs/research/tuya-cloud-user-management.md`; plan/context/progress; INDEX. |

## Vấn đề đang chặn (Blockers)
- Không chặn code. Live verify cần env: `TUYA_APP_SCHEMA`, Tuya Cloud `TUYA_ACCESS_ID/SECRET`, Supabase `DATABASE_URL`/`DIRECT_URL`, `CRON_SECRET`.
- Endpoint user hiện **chưa có auth admin** → C3 (`m1-backend-admin-auth`) sẽ bảo vệ.
