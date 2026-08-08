# Context: Quản lý & điều khiển thiết bị cho Admin

> File "trí nhớ" - giữ context xuyên suốt các phiên. Append theo thời gian, đừng xoá lịch sử.

- **Slug:** `m1-admin-device-mgmt`

## Quyết định kỹ thuật (Decision log)

- **2026-07-25** - Điều khiển đi qua **Tuya Cloud OpenAPI ở backend**, KHÔNG qua App SDK. Lý do:
  App SDK là client-only (chỉ chạy trên máy đã login tài khoản Tuya + có thiết bị trong home); admin
  web/server không có SDK. Backend đã có `TuyaCloudService` ký request. Đã loại: gọi Tuya từ admin
  trực tiếp (lộ AppSecret), hoặc dựng cầu từ mobile (vô lý cho admin).
- **2026-07-25** - **Scope (user chốt):** list **cả 2** (trang phẳng `/devices` + drill từ user detail);
  điều khiển **đầy đủ** (target temp + power/light/purify); **có dialog xác nhận** mỗi lệnh.
- **2026-07-25** - Codec DP phía backend **viết mới, độc lập** với `apps/mobile/src/services/dp.ts`.
  Lý do: raw qua cloud = **base64**, qua App SDK = **hex** ⇒ encoding khác; hai project tách biệt
  (không share code). Giữ cùng *logic* (word0, giữ nguyên word khác) nhưng khác lớp mã hoá.

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/backend/src/tuya/tuya-cloud.service.ts` | (đã có) `request()` ký + access_token, gọi mọi OpenAPI path |
| `apps/backend/src/tuya/token.service.ts` | (đã có) cache access_token, endpoint theo env |
| `apps/backend/src/users/users.service.ts` | (đã có) `getUserDevices(uid)` = `GET /v1.0/users/{uid}/devices`; `listUsers()` |
| `apps/backend/src/admin-auth/admin-auth.guard.ts` | (đã có) `AdminAuthGuard` - guard mọi endpoint admin |
| `apps/backend/src/devices/device-dp.ts` | **(mới, B2)** codec base64/word16 + resolveDpMap + decode/build |
| `apps/backend/src/devices/devices.service.ts` | **(mới, B3)** listAll/getDevice/sendCommand qua cloud |
| `apps/backend/src/devices/devices.controller.ts` | **(mới, B3)** `admin/devices` GET/GET:id/POST:id/commands |
| `apps/admin/lib/api.ts` | (đã có) `apiGet` - thêm call devices |
| `apps/admin/app/devices/page.tsx` | **(mới, B4)** trang phẳng tất cả thiết bị |
| `apps/admin/app/devices/[id]/page.tsx` | **(mới, B5)** trang detail + control |
| `apps/admin/components/DeviceControlPanel.tsx` | **(mới, B5)** panel điều khiển + confirm dialog |
| `apps/admin/app/users/[uid]/page.tsx` | (đã có, B6) thêm link sang panel điều khiển |

## Phát hiện & cạm bẫy (Findings / Gotchas)

- **Raw DP: Cloud = base64, App SDK = hex.** Xác nhận qua docs Tuya (`{code:"phase_a",
  value:"COkAABUAAAU="}`). Cạm bẫy chết người nếu bê nguyên logic hex từ mobile sang.
- **Endpoint device-centric** (`GET /v1.0/devices/{id}/status|specifications|commands`) khác endpoint
  user-centric (`/v1.0/users/{uid}/devices`) đã dùng. Có thể cần authorize thêm API product vào project
  (IoT Core / Device Status) - xác minh ở B1/B7.
- **Thiết bị hiện OFFLINE** (`isOnline:false`) ⇒ B7 (verify điều khiển thật) bị chặn tới khi bật máy.
- **`GET /v1.0/devices/{id}/specifications`** trả cả instruction set + status set kèm `type`/`values`
  (min/max/scale) ⇒ đây là nguồn resolve DP code + kiểu, tương đương `schemaJson` bên mobile.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md) ·
  [tuya-cloud-openapi-signing.md](../../docs/research/tuya-cloud-openapi-signing.md) ·
  **tuya-cloud-device-control.md** (sẽ tạo ở B1)

## Cập nhật DEV (2026-07-28)

- **B2 codec** (`device-dp.ts`): base64↔word16 big-endian có dấu; `parseSpecification` (functions[]+status[]
  → map theo code + kiểu + biên, `values` parse 2 lần vì là chuỗi JSON); `decodeStatus` (temp ÷scale,
  target đọc word0, tempRange từ DP raw → đơn vị hiển thị); `buildCommands` (bool thẳng, target Raw =
  đọc raw hiện tại → ghi word0 → base64; thiếu DP → `MissingDpError`). `rawToWords` auto base64→hex
  (Q1 chưa chốt). 18 test dùng payload THẬT của bồn.
- **B3 module**: `DevicesService.listAllDevices` (duyệt `users.listUsers` page_size 100 → `getUserDevices`,
  dedupe theo id, temp decode nhanh giả định scale 1); `getDevice` (song song status+spec+detail);
  `sendCommand` (offline→409 Conflict, thiếu DP→400 Bad, POST commands). Controller `admin/devices`
  bọc `AdminAuthGuard`. 7 test mock cloud+users.
- **B4/B5/B6 admin**: nav "Devices"; `/devices` phẳng (owner link, OnlineChip, current/target);
  `/devices/[id]` + `DeviceControlPanel` (client, target ± theo tempRange.step, 3 toggle chỉ hiện DP
  thiết bị có, **confirm dialog** trước khi gửi, chặn khi offline, banner lỗi/ok, `router.refresh()`
  sau lệnh); server action `sendDeviceCommand` (trả `{ok,error}`, redirect /login khi auth-fail);
  cột "Control" ở user detail.

## Findings thêm

- **`GET /v1.0/users/{uid}/devices` có thể trả `status` inline** ⇒ list decode temp không cần gọi
  status riêng (rẻ). Nhưng KHÔNG có scale ⇒ giả định scale 1 cho list; trang detail mới chính xác (spec).
- **eslint backend chặt:** async arrow không có await = lỗi (`require-await`); mock jest phải trả
  `Promise.resolve(...)` chứ không `async () =>` (service dùng `.catch` nên cần promise thật).
- Nhánh raw-in-status base64/hex CHƯA chốt (Q1) - decoder auto-detect tạm; B7 xác nhận trên máy.

## Tóm tắt khi hoàn thành (điền lúc FINISH)
Code B1–B6 xong & CI xanh: backend endpoints (list-all/detail/command) qua Tuya Cloud OpenAPI +
codec base64 riêng cho DP raw; admin có trang thiết bị phẳng + panel điều khiển (confirm dialog,
chặn offline) + drill từ user. **Còn nợ B7**: verify điều khiển thật trên máy ONLINE (hiện offline)
và chốt 2 câu hỏi (raw-in-status encoding, quyền endpoint device-centric). Chưa commit.
