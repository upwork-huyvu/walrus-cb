# Progress: UserModule - list/detail/xoá user + delete_jobs retry

- **Slug:** `m1-backend-user-mgmt`
- **Phase hiện tại:** `DEV` (code xong; **`/users` LIVE ✅ 2026-07-02 - Option B: project + backend → Western Europe**)
- **Trạng thái:** `live` (GET /users ra **3 user thật** trên `openapi-weaz.tuyaeu.com` + hiển thị trên admin web)
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
🎯 **ROOT CAUSE XÁC NHẬN (client soi console 2026-07-02): DATA CENTER MISMATCH.**
Cloud Project = **Central Europe** (`openapi.tuyaeu.com`) nhưng account end-user đăng ký lại rơi vào
**Western Europe** (zone Tuya tách ~2025-11-25, `openapi-weaz.tuyaeu.com` - cô lập). DC lệch → project
Central Europe **không bao giờ thấy** user Western Europe → `GET /v2.0/apps/{schema}/users` = `total:0`.
Nguyên nhân: mobile `thirdLogin` truyền **`countryCode='49'` cứng** → route account sang Western Europe.
**Fix nằm ở MOBILE (feature [[m1-mobile-google-login]]/auth), không phải backend:** cho account đăng ký
đúng **Central Europe** (+ show/pick zone lúc register). Backend đã đúng 100% - **giữ nguyên**.
> ⚠️ Giả thuyết cũ "Status Building / enterprise-verify" (2026-07-02, ~70% conf) **bị SUPERSEDE** bởi DC
> mismatch - đó mới là gốc thật. (App-auth key `p37v9tnv..` KHÔNG dùng cho OpenAPI - `1004 sign invalid`.)

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 - UserModule: list + detail · **done** (UsersService/Controller + DTO + types + env TUYA_APP_SCHEMA)
- [x] B2 - Delete flow + delete_jobs · **done** (DeleteJobsService + executeJob: pre-delete + cleanup + retry)
- [x] B3 - Cron retry (Vercel Cron) · **done** (CronController GET + Bearer CRON_SECRET + crons trong vercel.json)

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 - GET /users (list+business+phân trang) + GET /users/:uid (build/types OK; live verify chờ env)
- [x] AC2 - DELETE /users/:uid: pre-delete + cleanup + delete_jobs (3 unit test pass)
- [x] AC3 - Cron endpoint chặn CRON_SECRET + xử lý pending (3 unit test pass)
- [x] AC4 - build/lint/unit(12)/e2e pass + secret sweep + .env.example đủ (TUYA_APP_SCHEMA, CRON_SECRET)

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-07-02 | **OPTION B LIVE - `/users` RA USER** | ✅🟢 | Client chuyển Cloud Project sang **Western Europe DC**; backend đổi `TUYA_OPENAPI_ENDPOINT=openapi-weaz.tuyaeu.com` (`.env`, gitignored). `GET /users` → **`total:3`**: `imax.dev.sn@` (`we1782962675373ARo2g`), `showroom.imax@` (`we1782974802601uN5i0`), `huyquoc.vq@` (`we178297522620935amb`) - đều country 49, username `gg-<sub>`. **Admin web `/users` hiển thị đủ 3** (ảnh admin-users-western-europe.png). → Pipeline quản lý user Tuya **chạy end-to-end**. Backend code KHÔNG đổi (chỉ endpoint). |
| 2026-07-02 | **ROOT CAUSE = DC MISMATCH (client confirm)** | 🎯 | Client soi Tuya console: account đăng ký ở **Western Europe DC**, project ở **Central Europe DC** → lệch → project không thấy user → `total:0`. Khớp probe hôm nay (query `openapi-weaz.tuyaeu.com` bị "data center suspended" vì project chỉ bật Central Europe). Nguồn lệch: mobile `thirdLogin(countryCode='49')` cứng → route Western Europe. **SUPERSEDE** giả thuyết "Building/enterprise-verify" bên dưới. Fix ở **mobile** (đăng ký đúng Central Europe + show zone); backend giữ nguyên. Đang research cơ chế DC + mapping country (workflow). |
| 2026-07-02 | **LIVE VERIFY /users (device + cloud)** | ⚠️ blocked | Backend **ĐÚNG hết**: credential = project Cloud key `v75ujhfs..` (App-auth key `p37v9tnv..` sai loại → `1004 sign invalid`, không mint token); ký HMAC OK; schema `walruswellnesscb`; DC Central Europe (probe 6 host: token OK EU/US, các DC khác "suspended" vì project chưa bật). `GET /v2.0/apps/{schema}/users` → **`total:0`** với **CẢ** user cũ (`imax.dev.sn@`) LẪN user **MỚI tạo sau khi Link My App** (`showroom.imax@`) → **loại timing/propagation**. App **đã Link My App** (Devices tab, project walrus, Central Europe) nhưng **Status = "Building"**, Linked Devices 0. Console **Operation → User Management KHÔNG có** (account chưa enterprise-verify). ⇒ **Gate Tuya platform** (app chưa release + account chưa verify), KHÔNG phải code. Fix = release App SDK / enterprise verification / ticket Tuya. Research: workflow (App Authorization ≠ OpenAPI cred; Link My App là cơ chế đúng; UI xem user = Operation→User Management / Data Center→App user). |
| 2026-06-28 | TEST B1–B3 | ✅ | `nest build` OK; jest **12/12** (tuya-sign 6 + users.service 3 + cron 3); e2e `/health` OK; eslint 0 error. |
| 2026-06-28 | DEV B1–B3 | ✅ | UsersModule (list/detail/delete + cron) + DeleteJobsService; env TUYA_APP_SCHEMA/CRON_SECRET; vercel.json crons (0 * * * *); class-validator/transformer. |
| 2026-06-28 | RESEARCH+PLAN | ✅ | `docs/research/tuya-cloud-user-management.md`; plan/context/progress; INDEX. |

## Vấn đề đang chặn (Blockers)
- 🎯 **`/users` = total:0 vì DC MISMATCH (KHÔNG phải backend):** account ở **Western Europe**, project ở
  **Central Europe**. Fix ở **mobile** (đăng ký account đúng Central Europe - sửa `thirdLogin` countryCode/zone;
  xem [[m1-mobile-google-login]]). ⚠️ DC account **cố định lúc đăng ký đầu** → user cũ (imax/showroom ở Western
  Europe) có thể phải **tạo lại** ở Central Europe. Backend `/users` sẽ tự chạy khi account về đúng DC.
- Endpoint user đã có auth admin (C3 done). Live verify env đủ (đã chạy thật 2026-07-02).
