# Progress: Scaffold backend NestJS + Supabase + client Tuya Cloud OpenAPI

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-backend-scaffold`
- **Phase hiện tại:** `DEV` (B1–B5 code xong; chờ env để verify live AC3/AC4)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-28

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Code B1–B5 XONG + verify offline** (build/unit/e2e/lint/secret-sweep/env fail-fast đều pass).
Chế độ "làm hết": secret để ở `.env` (xem `.env.example`), điền sau.
Còn lại để **đóng AC3/AC4** (cần env thật, KHÔNG chặn sang C2):
1. Điền `.env` (DATABASE_URL/DIRECT_URL + TUYA_ACCESS_ID/SECRET + endpoint đúng DC).
2. `npm run db:migrate` (tạo bảng) → đóng AC3 (kết nối DB thật).
3. Gọi thử token Tuya (1 call qua TuyaTokenService) → đóng AC4 (token thật).
Có thể tiến hành song song: `/plan m1-backend-user-mgmt` (C2) dựng trên TuyaCloudService + Prisma sẵn có.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 — Init NestJS app `apps/backend` · **done** (Nest 11, /health, bỏ boilerplate)
- [x] B2 — ConfigModule + validate env (zod) + .env.example + .gitignore · **done** (fail-fast prod)
- [x] B3 — Prisma + Supabase Postgres · **done code** (schema + PrismaService + generate; connect thật chờ DATABASE_URL)
- [x] B4 — TuyaModule: signed client + token manager · **done code** (tuya-sign + Token/Cloud service + 6 unit test; token thật chờ creds)
- [x] B5 — Vercel handler + README + secret sweep · **done** (api/index.ts + vercel.json + README)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 — NestJS boot, TS strict, GET /health → 200 (e2e pass)
- [x] AC2 — Config validate env (prod fail-fast, dev boot, PORT sai → throw), .env.example đủ, grep sạch
- [~] AC3 — Prisma generate OK + structure; **kết nối DB thật chờ DATABASE_URL**
- [x] AC4 — Ký HMAC-SHA256 đúng (6 unit) + **LIVE: lấy `/v1.0/token` thật OK** (HTTP200/success, expire 7200) ở `openapi.tuyaeu.com` (Central Europe) với creds keys.txt ✅
- [x] AC5 — Cấu trúc module rõ (Tuya tách biệt) + build/lint pass + Vercel handler

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-06-29 | LIVE VERIFY | ✅ | Nhận SDK+keys (docs/sdk). **Sửa DC → Central Europe** (`openapi.tuyaeu.com`). Tạo `.env` (gitignored) + gọi `/v1.0/token` thật bằng code ký dist → **HTTP200 success, access_token + expire 7200**. Signing/token CHỨNG MINH chạy thật. Còn DB Supabase chưa có. |
| 2026-06-28 | TEST B1–B5 | ✅ | `nest build` OK; jest unit **6/6** (tuya-sign); e2e `/health` **200**; eslint 0 error; secret sweep sạch (không .env); env: prod thiếu→throw, dev boot, PORT sai→throw. |
| 2026-06-28 | DEV B4–B5 | ✅ | TuyaModule (tuya-sign HMAC + TuyaTokenService + TuyaCloudService) + unit test; Vercel `api/index.ts` + `vercel.json` + README + .gitignore. |
| 2026-06-28 | DEV B1–B3 | ✅ | `nest new apps/backend` (Nest 11, npm, strict); HealthModule; AppConfigModule (zod validate) + AppConfigService; PrismaModule/Service + schema (AdminUser/DeviceMapping/DeleteJob) + generate. Pin **Prisma v6** (v7 bỏ directUrl khỏi schema). |
| 2026-06-28 | RESEARCH | ✅ | `docs/research/tuya-cloud-openapi-signing.md` (signing + endpoints; EU Western=openapi-weaz.tuyaeu.com). |
| 2026-06-28 | PLAN | ✅ | Tạo plan/context/progress; đăng ký INDEX (Part C1 của M1). Gate ① DUYỆT (chế độ "làm hết", secret để env). |

## Vấn đề đang chặn (Blockers)
- ✅ Tuya Cloud: **xong** (creds keys.txt + DC Central Europe + token live-verified).
- ⏳ AC3 (DB thật): vẫn cần **Supabase** — `DATABASE_URL` (pooled `:6543?pgbouncer=true`) + `DIRECT_URL` (`:5432`) + `SUPABASE_SERVICE_ROLE_KEY` → rồi `npm run db:migrate`.
- ⏳ List users (C2) cần **`TUYA_APP_SCHEMA`** (channel App SDK) — không có trong keys.txt.
