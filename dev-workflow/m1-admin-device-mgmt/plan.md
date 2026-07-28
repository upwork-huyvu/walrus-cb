# Kế hoạch: Quản lý & điều khiển thiết bị cho Admin (qua Tuya Cloud OpenAPI)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-admin-device-mgmt`
- **Milestone:** M1·D (admin web) + C (backend)
- **Phần liên quan:** backend (NestJS) + admin (Next.js). **Không đụng mobile.**
- **Ngày tạo:** 2026-07-25
- **Cập nhật lần cuối:** 2026-07-25

## 1. Mục tiêu & phạm vi

Admin xem danh sách thiết bị (ice bath) của mọi user, xem trạng thái (online, nhiệt độ
hiện tại/mục tiêu, các DP), và **điều khiển trực tiếp qua Tuya Cloud OpenAPI** (server→cloud→
thiết bị): đặt nhiệt độ mục tiêu + bật/tắt nguồn/đèn/lọc. Mọi lệnh điều khiển đi qua **backend**
(giữ AppSecret ở server), admin web chỉ gọi backend đã có admin-auth.

**Trong phạm vi:**
- Backend endpoints (admin-guarded): list-all-devices, device detail (status+spec), send command.
- Codec DP phía cloud: decode status (nhiệt độ scale, raw word0), encode command (bool + raw base64).
- Admin: trang phẳng `/devices` (tất cả thiết bị) **và** vào từ user detail (`/users/[uid]`).
- Panel điều khiển: target temp ±, 3 công tắc; **có dialog xác nhận trước khi gửi**.

**Ngoài phạm vi (không làm trong feature này):**
- Realtime/push status (cloud là on-demand; dùng nút Refresh, không mở socket).
- Sửa/xoá thiết bị, đổi tên, OTA, hẹn giờ.
- Điều khiển từ mobile app (đã có, đi App SDK - không đụng).
- Sửa DP xả đá (`freeze`) - thiết bị không có DP này (xem research DP mapping).

## 2. Bối cảnh & ràng buộc

- **Đã có sẵn nền tảng cloud:** `apps/backend/src/tuya/TuyaCloudService.request()` ký HMAC-SHA256
  + access_token, gọi được **bất kỳ path OpenAPI**. Endpoint Western Europe qua env
  `TUYA_OPENAPI_ENDPOINT`. `GET /v1.0/users/{uid}/devices` **đã wired** (`users.service.getUserDevices`,
  controller `@Get(':uid/devices')`).
- **Ràng buộc region:** Data Center của Cloud Project phải khớp endpoint (Western Europe) - đã đúng
  vì users flow đang LIVE.
- **Bảo mật:** `TUYA_ACCESS_SECRET` chỉ ở backend, KHÔNG lộ ra admin bundle. Mọi lệnh qua backend
  admin-guarded (`AdminAuthGuard`). Admin không cầm secret Tuya.
- **DP mapping thiết bị thật (model g0cv1c):** currentTemp=DP101 (`sensor_1`, ÷10), targetTemp=DP115
  (`setting_temp`, raw, **word0**), tempRange=DP114 (`setting_temp_range`, raw → 2.0–15.0°C),
  power=DP121 (`setting_pwr`), light=DP124 (`setting_4`), purify=DP122 (`setting_clr`), fault=DP11.
- **⚠️ Khác biệt lớn App SDK vs Cloud:** DP raw qua **App SDK = hex**, qua **Cloud API = base64**
  (xác nhận: `{code:"phase_a", value:"COkAABUAAAU="}`). Backend phải tự viết codec base64 riêng,
  KHÔNG tái dùng được `apps/mobile/src/services/dp.ts` (khác encoding + khác project).
- **Link nghiên cứu:** [docs/research/tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md)
  (DP mapping) + [docs/research/tuya-cloud-openapi-signing.md](../../docs/research/tuya-cloud-openapi-signing.md)
  (ký request). **B1 sẽ tạo note mới** `docs/research/tuya-cloud-device-control.md` (endpoints + encoding).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.

- [ ] **AC1** (research): có `docs/research/tuya-cloud-device-control.md` với 4 endpoint (status,
  specifications, functions, commands) + bảng encoding từng kiểu value + cách ghi raw setpoint, **có cite**.
- [ ] **AC2** (backend list): `GET /admin/devices` (admin-guarded) trả mảng thiết bị của **mọi user**,
  mỗi item: `{deviceId, name, ownerUid, ownerName?, online, productId}`. 401 nếu không có admin session.
- [ ] **AC3** (backend detail): `GET /admin/devices/:id` trả `{online, currentTemp, targetTemp, tempRange,
  power, light, purify, fault, raw: {...DP}}` - decode đúng từ status+spec (nhiệt độ đã ÷scale, target
  đọc word0 base64).
- [ ] **AC4** (backend command): `POST /admin/devices/:id/commands` nhận `{target?, power?, light?, purify?}`,
  build đúng payload cloud (bool passthrough; target = đọc raw hiện tại → ghi word0 → base64), gọi
  `POST /v1.0/devices/{id}/commands`. Thiếu DP tương ứng → 400, KHÔNG gửi bừa.
- [ ] **AC5** (codec unit test): base64 ↔ word16 big-endian; `setTargetTemp` giữ nguyên các word khác;
  decode `sensor_1`÷10; resolve DP theo `code` từ specification. Dùng đúng payload thật của bồn.
- [ ] **AC6** (admin flat): `/devices` liệt kê mọi thiết bị (owner · online · currentTemp · target),
  chỉ admin đăng nhập mới vào được (middleware admin hiện có).
- [ ] **AC7** (admin control): panel điều khiển đọc được status; đổi target ±/bật-tắt công tắc **hiện
  dialog xác nhận** → gửi qua backend → refresh lại status. Thiết bị offline → hiện rõ + chặn gửi.
- [ ] **AC8** (drill from user): trang `/users/[uid]` có link/nút vào panel điều khiển từng thiết bị.
- [ ] **AC9** (CI xanh): backend `tsc` + `jest` + `build` xanh; admin `tsc` + `next build` xanh; eslint 0 lỗi.

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test.

1. **B1 - Research note cloud device-control** (prerequisite)
   - Viết `docs/research/tuya-cloud-device-control.md`: 4 endpoint (path/method/params/response), bảng
     encoding value theo kiểu (bool/value/enum/string/**raw=base64**), cách đọc `setting_temp` từ status
     (raw trả về ở status là base64 hay hex? **cần xác minh**), mã lỗe thường gặp (device offline,
     no permission). Cập nhật `.claude/skills/tuya-research/sources.md`.
   - Test: đọc chéo - mỗi claim có URL cite; note nêu rõ điểm chưa xác minh trên thiết bị.
2. **B2 - Backend: DP codec + mapping cloud** (`apps/backend/src/devices/device-dp.ts` + test)
   - `resolveDpMap(specification)` (theo `code`, giống mobile nhưng độc lập), `decodeStatus(statusList)`
     → model, `buildCommands({target,power,light,purify}, map, kinds, currentRawB64)`.
   - Codec raw **base64**: `b64ToWords`/`wordsToB64` (16-bit big-endian, có dấu), `readWord0`,
     `writeWord0` (giữ nguyên word khác).
   - Test: unit thuần (không gọi mạng) với payload thật của bồn.
3. **B3 - Backend: DevicesModule (service + controller)** (`apps/backend/src/devices/*`)
   - `DevicesService`: `listAllDevices()` (duyệt users.listUsers → getUserDevices, gộp + owner),
     `getDevice(id)` (song song `GET .../status` + `.../specifications` → decode), `sendCommand(id, dto)`
     (đọc status raw nếu cần → buildCommands → `POST .../commands`).
   - `DevicesController` `@Controller('admin/devices')` `@UseGuards(AdminAuthGuard)`: `@Get()`,
     `@Get(':id')`, `@Post(':id/commands')` + DTO class-validator. Wire vào `app.module.ts`.
   - Test: jest mock `TuyaCloudService.request` → assert path/method/body đúng; guard chặn khi không auth.
4. **B4 - Admin: API client + trang `/devices` phẳng** (`apps/admin/lib/api.ts`, `apps/admin/app/devices/page.tsx`)
   - `apiGet('/admin/devices')`; bảng: tên · owner · online chip · currentTemp · target. `force-dynamic`.
   - Thêm mục "Devices" vào nav admin (nếu có shell nav).
   - Test: `next build` + `tsc`; kiểm thị bằng mock data khi backend chưa deploy.
5. **B5 - Admin: panel điều khiển + xác nhận** (`apps/admin/components/DeviceControlPanel.tsx` + route detail)
   - Đọc `/admin/devices/:id`; hiển thị status; nút target ± + 3 toggle; **mỗi lệnh → dialog xác nhận**
     → `POST /admin/devices/:id/commands` → refresh. Offline → disable + banner.
   - Route: `apps/admin/app/devices/[id]/page.tsx`.
   - Test: `next build`; click-through bằng mock (confirm dialog xuất hiện, offline khoá nút).
6. **B6 - Drill từ user detail** (`apps/admin/app/users/[uid]/page.tsx`)
   - Mỗi thiết bị trong user detail có link sang `/devices/[id]` (panel điều khiển).
   - Test: `next build`; link đúng id.
7. **B7 - Verify thật + siết** (device thật, cần máy ONLINE)
   - Bật thiết bị online → admin đọc status khớp mobile → đổi target/công tắc → xác nhận thiết bị đổi.
   - Chốt: status trả raw ở dạng gì (base64?), lệnh raw setpoint có ack không.
   - Test: checklist thủ công (device online); ghi kết quả vào progress.

## 5. Rủi ro & câu hỏi mở

- ⚠️ **Raw trong STATUS trả về format nào?** Command chắc chắn base64; nhưng `GET .../status` trả
  `setting_temp` có thể là base64 (khả năng cao) - **chưa xác minh**. → B1 research + B2 viết decoder
  chịu cả 2 (thử base64 trước, fallback hex), B7 chốt trên máy.
- ⚠️ **Thiết bị đang OFFLINE** (đã xác nhận `isOnline:false`). Cloud command tới máy offline sẽ **fail/queue**.
  → UI phải chặn gửi khi offline + báo rõ; B7 verify khi bật online.
- ⚠️ **Ghi raw setpoint cần payload hiện tại** để giữ các word khác. Nếu status không trả raw đọc được
  → không ghi được target an toàn. → decoder phải lấy được raw hiện tại; nếu không, chặn đổi target
  (chỉ cho công tắc). Fallback: đọc lại status ngay trước khi build command.
- ⚠️ **`GET /admin/devices` aggregate N users → N+1 call** (list users + mỗi user 1 call devices).
  Quy mô hiện tại nhỏ (vài user) nên OK; nếu lớn → cân nhắc cache/battch. Ghi nhận, chưa tối ưu vội.
- ⚠️ **Điều khiển bồn của người khác** (an toàn): mọi lệnh có dialog xác nhận (AC7); backend log lệnh
  (cân nhắc ghi `notification_logs`-style audit - có thể để sau).
- ❓ **Quyền cloud project với thiết bị:** thiết bị phải nằm dưới app account mà project quản lý. Users
  flow chạy được ⇒ khả năng cao devices cũng OK, nhưng `GET /v1.0/devices/{id}/*` (device-centric)
  có thể cần API product "Device Status Notification"/"IoT Core" đã authorize vào project - B1/B7 xác nhận.
- ❓ **DTO command:** cho gửi nhiều field 1 lần (`{target, power}`) hay từng lệnh? → mặc định gộp được,
  nhưng target (raw) cần đọc trước nên xử lý riêng trong service.
