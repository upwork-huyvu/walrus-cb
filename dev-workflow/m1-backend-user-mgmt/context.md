# Context: UserModule - list/detail/xoá user + delete_jobs retry

- **Slug:** `m1-backend-user-mgmt`

## Quyết định kỹ thuật (Decision log)
- **2026-06-28** - Xoá user mặc định = **Tuya pre-delete** (`POST /v1.0/users/{uid}/actions/pre-delete`,
  ân hạn 7 ngày) + xoá business data Supabase. Hard delete (`DELETE /v1.0/iot-02/users/{uid}`) để dành tuỳ chọn.
- **2026-06-28** - Retry xoá: bảng **`delete_jobs`** (đã có ở schema C1) + **Vercel Cron** gọi
  endpoint nội bộ (guard `CRON_SECRET`). KHÔNG dùng `@nestjs/schedule` (serverless không chạy).
- **2026-06-28** - DTO validate bằng **class-validator/class-transformer** (Nest ValidationPipe đã bật).
- **2026-06-28** - `schema` (channel App SDK) cho list users → env `TUYA_APP_SCHEMA`.

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

## 🎯 LIVE VERIFY 2026-07-02 - vì sao `/users` = total:0 (đã mổ xẻ tận cùng)
- **Backend ĐÚNG 100%**, đừng sửa: credential = **project Cloud Authorization key** `v75ujhfs848hcc599gug`
  (KHÔNG phải **App Authorization key** `p37v9tnv..` - cái đó cho `1004 sign invalid`, chỉ để OAuth phía app,
  không mint token OpenAPI); ký HMAC-SHA256 OK; schema `walruswellnesscb`; probe 6 DC host → token OK.
- **3 credential Tuya khác nhau (đừng lẫn):** (1) Cloud key `v75ujhfs..` = OpenAPI server; (2) App Authorization
  `p37v9tnv..` = định danh app (SHA1+package) cho OAuth; (3) App SDK AppKey `n7ywy..` = init SDK mobile.
- **ROOT CAUSE = DATA CENTER MISMATCH:** account end-user đăng ký ở **Western Europe** (`openapi-weaz.tuyaeu.com`,
  zone Tuya tách ~2025-11-25) nhưng project ở **Central Europe** (`openapi.tuyaeu.com`) → cô lập → không thấy user.
  UID prefix `we...` = Western Europe. Probe: weaz báo `28841107 data center suspended` (project chưa bật WE DC).
- **Cơ chế DC (research 2026-07-02):** `zone = f(countryCode)` qua **bảng mapping country→DC của OEM app**
  (server quyết, client KHÔNG override - bridge không có region API là ĐÚNG). Mốc split theo **NGÀY TẠO APP**:
  app tạo **sau 2025-11-25** → **mọi nước EU (kể cả Đức 49) → Western Europe**. **KHÔNG có countryCode EU nào
  về Central Europe** cho app post-split → đổi `49` sang mã khác **vô ích**.
- **FIX = PORTAL, KHÔNG phải code mobile.** 2 đường: **(A, client chọn)** OEM App → Required Setting → Data
  Center → **Customize Rules** map EU→Central Europe → **launch (chỉ 1 LẦN/app)** → **rebuild app** → xoá user
  Western Europe cũ + re-register (account mới vào Central Europe). **(B, nhẹ hơn - client TỪ CHỐI)** dời project
  sang Western Europe (enable WE DC + backend trỏ `openapi-weaz.tuyaeu.com`), không rebuild/không xoá.
  Nguồn: [oem-app-data-center](https://developer.tuya.com/en/docs/iot/oem-app-data-center-distributed?id=Kafi0ku9l07qb) · [Confirm Mapping Rules](https://developer.tuya.com/en/docs/iot/Confirm_the_Mapping_Rules?id=Kawxbiqsv68ne).
- **🔒 CHỐT CUỐI (verify verbatim 2026-07-02) - đính chính Option A ở trên:** DC do **NGÀY TẠO appKey**
  quyết, KHÔNG phải countryCode. Bảng "Central Europe" và "Western Europe" liệt kê **CÙNG bộ nước** (Đức 49
  có trong cả hai); app tạo **trước** 25/11/2025 → Central, **sau** → Western. appKey `n7ywy..` đời 2026 →
  mọi nước EU về Western. **Không countryCode nào cứu.** Và **Customize Rules chỉ có ở OEM App, App SDK
  KHÔNG có** → **Option A bất khả thi self-serve.** Central Europe chỉ qua **ticket Tuya** (đổi mapping/dùng
  appKey pre-split). Thực tế nên đi **Option B** (project + backend → Western Europe `openapi-weaz`), khớp
  luôn nơi account tự route. Country code đã expose trên AuthScreen (chỉ để xem/thử, không đổi được DC).
- **Đã loại:** timing/propagation (user MỚI `showroom.imax@` tạo sau Link My App cũng total:0); schema; signing.
- **Link My App** (Devices tab) = cơ chế đúng để đưa app users vào tầm nhìn project (khác App Authorization);
  app đã link (Status "Building"). **UI xem user** (nếu account enterprise-verify): Operation → User Management,
  hoặc Data Center → App user. (Console này thiếu Operation→User Management vì account chưa verify - thứ yếu.)
- ⚠️ **DC account cố định lúc đăng ký đầu** → user cũ ở Western Europe không đổi DC được; phải tạo lại ở Central Europe.

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
