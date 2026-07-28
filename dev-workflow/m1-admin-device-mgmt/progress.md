# Progress: Quản lý & điều khiển thiết bị cho Admin

> `/dev`, `/test`, `/fix-plan` đọc đầu vào và cập nhật cuối mỗi lượt.

- **Slug:** `m1-admin-device-mgmt`
- **Phase hiện tại:** `TEST` (code B1–B6 xong & CI xanh; B7 chờ device online)
- **Trạng thái:** `blocked` (B7 cần thiết bị ONLINE - hiện offline)
- **Cập nhật lần cuối:** 2026-07-28

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B1–B6 CODE XONG & CI XANH** (backend tsc0/eslint0/jest101/build0 · admin tsc0/eslint0/next build✓).
Còn **B7**: bật thiết bị ONLINE → verify admin đọc status khớp mobile + đổi target/công tắc → xác nhận
thiết bị đổi; chốt 4 câu hỏi mở (raw-in-status base64?, endpoint device-centric có cần authorize thêm).
Cần backend chạy (local/deploy) + admin trỏ tới.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Research note cloud device-control · **done** (docs/research/tuya-cloud-device-control.md)
- [x] B2 - Backend: DP codec base64 + mapping · **done** (device-dp.ts, jest 18)
- [x] B3 - Backend: DevicesModule (service+controller admin-guarded) · **done** (jest 7, build 0)
- [x] B4 - Admin: trang `/devices` phẳng · **done** (OnlineChip + nav + build ✓)
- [x] B5 - Admin: panel điều khiển + confirm dialog · **done** (DeviceControlPanel + action)
- [x] B6 - Drill từ user detail · **done** (cột Control → /devices/[id])
- [ ] B7 - Verify thật + siết (cần device online) · **blocked** (thiết bị offline)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - research note có 4 endpoint + bảng encoding + cite
- [x] AC2 - `GET /admin/devices` list mọi thiết bị + owner (guard `AdminAuthGuard`; test dựng)
- [x] AC3 - `GET /admin/devices/:id` decode đúng status+spec (jest getDevice)
- [x] AC4 - `POST /admin/devices/:id/commands` build đúng (bool + raw base64), thiếu DP → 400, offline → 409
- [x] AC5 - unit test codec + mapping (payload THẬT của bồn) - 25 test
- [x] AC6 - admin `/devices` phẳng (nav + build ✓; middleware admin bảo vệ route)
- [x] AC7 - panel điều khiển + confirm dialog + chặn khi offline (DeviceControlPanel)
- [x] AC8 - drill từ `/users/[uid]` (cột Control)
- [x] AC9 - CI xanh (backend tsc0/jest101/build0 · admin tsc0/next build✓ · eslint 0)
- [ ] **AC (device)** - verify điều khiển THẬT trên máy online (B7, blocked)

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-28 | DEV B4+B5+B6 | ✅ | Admin: nav Devices, `/devices` phẳng, `/devices/[id]` + DeviceControlPanel (target ± / 3 toggle / confirm dialog / chặn offline) + server action; cột Control ở user detail. tsc0/eslint0/next build ✓ |
| 2026-07-28 | DEV B3 | ✅ | DevicesModule: service (listAll/getDevice/sendCommand) + controller `admin/devices` (AdminAuthGuard) + DTO; wire app.module. jest **25** (devices), full backend **101**, build 0, eslint 0 |
| 2026-07-28 | DEV B2 | ✅ | device-dp.ts: codec base64↔word16, resolveMap theo code, decodeStatus, buildCommands (thiếu DP→throw). jest **18** với payload thật bồn. tsc0/eslint0 |
| 2026-07-25 | DEV B1 | ✅ | docs/research/tuya-cloud-device-control.md (4 endpoint + bảng encoding + raw setpoint base64 + 4 câu hỏi mở); sources.md. AC1 ✅ |
| 2026-07-25 | PLAN | ✅ | Lập plan; research nhanh endpoint + raw=base64 qua cloud; user chốt scope (cả 2 màn, điều khiển đầy đủ, có confirm) |

## Vấn đề đang chặn (Blockers)
- **B7 (verify thật)** chặn tới khi có thiết bị ONLINE (hiện offline). Không chặn B1–B6 (đã xong).
- Chưa xác minh trên máy: (Q1) raw-in-status base64 hay hex; (Q4) endpoint device-centric
  (`/v1.0/devices/{id}/*`) có cần authorize thêm API product vào Cloud Project không. Decoder đã
  chịu cả 2 (base64→hex) nên vẫn chạy; nhưng cần chốt.
