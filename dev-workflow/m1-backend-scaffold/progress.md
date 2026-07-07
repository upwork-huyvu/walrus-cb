# Progress: Scaffold backend NestJS + Supabase + client Tuya Cloud OpenAPI

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-backend-scaffold`
- **Phase hiện tại:** `DEV` (B1–B5 code xong; **AC3+AC4 LIVE ✅** - DB Supabase nối + baseline migration xong)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Code B1–B5 XONG + verify LIVE** (2026-07-02): user điền `.env` thật → `npm run start:dev` boot OK,
`/health` 200, **Prisma nối Supabase thành công**. AC3+AC4 đóng.
⚠️ **PHÁT HIỆN divergence (2026-07-02):** DB Supabase THỰC RA đã được provision từ trước (session nào đó chạy
`prisma db push` KHÔNG ghi lại) - 3 bảng `admin_users`/`device_mappings`/`delete_jobs` đã tồn tại, `admin_users`
**đã có 1 row `admin@walrus.app`** (seed 2026-06-30), nhưng KHÔNG có `_prisma_migrations`. `migrate dev` đòi
**RESET (mất data)** → KHÔNG chạy. Thay bằng **baseline** (`migrate diff --from-empty` → `0_init` → `migrate
resolve --applied 0_init`) → history khớp DB, `Database schema is up to date!`, giữ nguyên admin row.
✅ **HẾT BLOCKER env (2026-07-02):**
1. `TUYA_APP_SCHEMA` đã điền + **verify LIVE**: gọi `UsersService.listUsers` qua Nest context → Tuya trả `success:true`, `total:0` (schema hợp lệ, chưa user nào đăng ký qua app custom - app chưa release). `TuyaCloudService` throw khi `success:false` nên empty = OK thật.
2. Login admin web: `admin@walrus.app` đã có trong **Supabase Auth** (confirmed) + allowlist + đã sign-in 2026-07-01 → thông.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Init NestJS app `apps/backend` · **done** (Nest 11, /health, bỏ boilerplate)
- [x] B2 - ConfigModule + validate env (zod) + .env.example + .gitignore · **done** (fail-fast prod)
- [x] B3 - Prisma + Supabase Postgres · **done code** (schema + PrismaService + generate; connect thật chờ DATABASE_URL)
- [x] B4 - TuyaModule: signed client + token manager · **done code** (tuya-sign + Token/Cloud service + 6 unit test; token thật chờ creds)
- [x] B5 - Vercel handler + README + secret sweep · **done** (api/index.ts + vercel.json + README)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - NestJS boot, TS strict, GET /health → 200 (e2e pass)
- [x] AC2 - Config validate env (prod fail-fast, dev boot, PORT sai → throw), .env.example đủ, grep sạch
- [x] AC3 - **LIVE 2026-07-02:** Prisma `$connect()` Supabase OK khi boot; baseline migration `0_init` marked applied (`migrate status` = up to date). Bảng đã có sẵn (db push trước đó) + 1 admin row.
- [x] AC4 - Ký HMAC-SHA256 đúng (6 unit) + **LIVE: lấy `/v1.0/token` thật OK** (HTTP200/success, expire 7200) ở `openapi.tuyaeu.com` (Central Europe) với creds keys.txt ✅
- [x] AC5 - Cấu trúc module rõ (Tuya tách biệt) + build/lint pass + Vercel handler

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-02 | LIVE RUN + baseline | ✅ | User điền `.env`. `start:dev` boot OK, `/health` 200, Prisma nối Supabase. Phát hiện DB đã provision sẵn (db push cũ, không có `_prisma_migrations`) + 1 admin `admin@walrus.app`. `migrate dev` đòi RESET → tránh; **baseline** `0_init` (diff→resolve --applied) → up to date, giữ data. AC3 đóng. Admin web boot 3001 OK (`/login` 200). |
| 2026-06-29 | LIVE VERIFY | ✅ | Nhận SDK+keys (docs/sdk). **Sửa DC → Central Europe** (`openapi.tuyaeu.com`). Tạo `.env` (gitignored) + gọi `/v1.0/token` thật bằng code ký dist → **HTTP200 success, access_token + expire 7200**. Signing/token CHỨNG MINH chạy thật. Còn DB Supabase chưa có. |
| 2026-06-28 | TEST B1–B5 | ✅ | `nest build` OK; jest unit **6/6** (tuya-sign); e2e `/health` **200**; eslint 0 error; secret sweep sạch (không .env); env: prod thiếu→throw, dev boot, PORT sai→throw. |
| 2026-06-28 | DEV B4–B5 | ✅ | TuyaModule (tuya-sign HMAC + TuyaTokenService + TuyaCloudService) + unit test; Vercel `api/index.ts` + `vercel.json` + README + .gitignore. |
| 2026-06-28 | DEV B1–B3 | ✅ | `nest new apps/backend` (Nest 11, npm, strict); HealthModule; AppConfigModule (zod validate) + AppConfigService; PrismaModule/Service + schema (AdminUser/DeviceMapping/DeleteJob) + generate. Pin **Prisma v6** (v7 bỏ directUrl khỏi schema). |
| 2026-06-28 | RESEARCH | ✅ | `docs/research/tuya-cloud-openapi-signing.md` (signing + endpoints; EU Western=openapi-weaz.tuyaeu.com). |
| 2026-06-28 | PLAN | ✅ | Tạo plan/context/progress; đăng ký INDEX (Part C1 của M1). Gate ① DUYỆT (chế độ "làm hết", secret để env). |

## Vấn đề đang chặn (Blockers)
- ✅ Tuya Cloud: **xong** (creds keys.txt + DC Central Europe + token live-verified).
- ✅ AC3 (DB thật): **xong 2026-07-02** - `.env` đã điền, Prisma nối Supabase, baseline `0_init` applied. (Lưu ý: dùng **baseline** chứ KHÔNG `migrate dev` vì DB đã có sẵn bảng+data; `migrate dev` sẽ đòi reset.)
- ✅ List users (C2): **`TUYA_APP_SCHEMA` đã điền + verify LIVE 2026-07-02** (Tuya `success:true`, list rỗng vì chưa user qua app custom). Không có trong keys.txt - user lấy từ Tuya console.
- ✅ Login admin web: `admin@walrus.app` đã có trong Supabase Auth (confirmed) + allowlist + đã sign-in.
