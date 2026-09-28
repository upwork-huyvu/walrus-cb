# Progress - m1-fix-admin-user-list

- **Phase hiện tại:** TEST (code xong, CI xanh, đã verify trên dữ liệu thật)
- **Hành động tiếp theo:** khách mở admin web xem lại danh sách khách hàng + trang Devices.
  Sau đó quyết định có commit / deploy backend không.

## Checklist các bước (đồng bộ plan.md mục 4)

- [x] B1 - Probe Tuya + Supabase, khoanh vùng nguyên nhân · **done**
- [x] B2 - Backend `loadRoster()` + `listUsers` phân trang tại chỗ + deviceCount từ Tuya · **done**
- [x] B3 - `listAllDevices()` dùng chung roster (bỏ N+1) · **done**
- [x] B4 - Admin FE chịu được `deviceCount = null`; bỏ dòng "Device mappings" · **done**
- [x] B5 - Test + verify thật · **done**

## Checklist tiêu chí hoàn thành (đồng bộ plan.md mục 3)

- [x] AC1 - `/users` trả đủ user còn sống (2 → **6**)
- [x] AC2 - `deviceCount` từ Tuya, không từ `device_mappings`
- [x] AC3 - đếm hụt → `null` → UI hiện `—` + "Unknown"
- [x] AC4 - uid `1106` bị loại khỏi danh sách
- [x] AC5 - `total`/`has_more` khớp số dòng thật
- [x] AC6 - `/admin/devices` 1 → **2** thiết bị, không N+1
- [x] AC7 - danh sách app lỗi vẫn dựng được roster từ DB (có test)
- [x] AC8 - CI xanh
- [x] AC9 - verify trên Tuya + Supabase thật

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-28 | FIX B6 | ✅ | **Khách báo: thiết bị ONLINE mà mở trang chi tiết ra thì trắng** ("Couldn't load this device from Tuya", `/devices/9b03cd2fe5ac1235d3eab1`). Truy ra: `getDevice()` gọi 3 endpoint song song nhưng **chỉ `/status` là KHÔNG có `.catch()`**. Probe thật con đó: `/v1.0/devices/{id}` ✅ `online=true`, `/v1.0/devices/{id}/status` ❌ **`2003 function not support`**, `/specifications` ❌ `2009 not support this device`, nhưng **`/v1.0/iot-03/devices/{id}/status` ✅** và `/iot-03/.../specification` ✅ ⇒ chỉ mỗi lời gọi không bắt lỗi kia làm sập cả trang. **Sửa:** gom thành `readDeviceState()` dùng chung cho `getDevice` + `sendCommand`; status/spec **tự lùi sang bản `iot-03`**, cả hai hỏng thì coi như rỗng; **không đọc nổi `detail` → 404** thay vì trả vỏ rỗng `name:''/online:false`. `sendCommand` hết 500 khi status hỏng (ra 400/409 đúng nghĩa). jest **114/114** (+2 test dựng theo payload lỗi ĐO ĐƯỢC). Verify thật: `9b03cd2…` ✅ "Walrus amara" online · `9b58227…` ✅ "PIR Test jimmy" online · `9beceda…` ❌ 404 đúng. ⚠️ **Phát hiện kèm: KHÔNG thiết bị nào trong 2 tài khoản đọc được là bồn đá** - `9b03cd2…` là **còi báo** (`sgbj`, "Audible alarm"), `9b58227…` là **cảm biến PIR**. Bồn thật `9beceda61448a0fdd54w73` thuộc uid `we178297522620935amb` (1 trong 4 tài khoản app SDK cũ) ⇒ **mọi endpoint `1106 permission deny`**. Panel điều khiển trống với 2 máy kia là ĐÚNG, không phải lỗi. |
| 2026-09-28 | TEST B5 | ✅ | **Verify THẬT** (boot Nest context với `.env` production, gọi thẳng service): `GET /users` **total=2 → 6** (Sam · Christopher `devices=1` · Tobias · Azmat · **Huy Quốc `devices=1`** · Huy), `GET /admin/devices` **1 → 2** (`Walrus amara`/Christopher + `PIR Test jimmy`/Huy Quốc, cả hai ONLINE). 4 uid tháng 7 bị loại đúng như thiết kế. CI: backend tsc **0** · eslint **0** (trên file đã sửa) · jest **112/112** (+9 test mới) · admin tsc **0** · eslint **0** · `next build` ✓ (14 route). |
| 2026-09-28 | DEV B2-B4 | ✅ | Backend: `loadRoster()` public (Tuya ∪ `push_tokens` ∪ `device_reminders`, enrich `/infos` + `/devices`, `mapLimit` 8 luồng, trần 500), `listUsers` phân trang tại chỗ + `deviceCount: number\|null`, `getUser` bỏ `business.deviceMappings`, xoá `enrichInfos`/`deviceCounts`. Devices: `listAllDevices()` đọc roster ⇒ hết gọi `/users/{uid}/devices` lần hai. Admin: `UsersBrowser` cột Devices `—` + badge **"Unknown"** khi `null`; bỏ dòng "Device mappings" ở user detail. |
| 2026-09-28 | PLAN B1 | ✅ | Probe thật: Tuya list `total=2` trong khi `push_tokens` có **11 uid**. Loại trừ schema (khách xác nhận chỉ 1 app, đúng cái đang cấu hình), data center (CE `28841107 suspended`), phân trang (`page_size=200` vẫn 2), kiểu đăng nhập. **Khác biệt duy nhất = ngày tạo**, mốc cắt giữa 17/08 và 31/08 ⇒ Tuya bỏ sót, lỗi phía Tuya. Phát hiện thêm **lỗi 2**: `device_mappings` `count=0` và grep cả repo **không có `create`/`upsert`** nào ⇒ cột Devices + badge Status xưa nay luôn sai. |

## Vấn đề đang chặn (Blockers)

Không có blocker cho phần code. Hai việc cần người:

1. **4 uid tháng 7** (`we1784616116281A0VxT`, `we17831755711425l85B`, `we178297522620935amb`,
   `we1782962675373ARo2g`) thuộc app SDK cũ (trước 28/07) → Tuya `1106 permission deny`,
   code không cứu được. Cần xác nhận đó là tài khoản test hay khách thật.
   🔴 **Việc này giờ quan trọng hơn hẳn:** con **bồn đá thật duy nhất** biết được
   (`9beceda61448a0fdd54w73`) lại thuộc `we178297522620935amb` trong nhóm đó ⇒ admin **không
   điều khiển được bồn nào cả**. Hai thiết bị đang đọc được chỉ là **còi báo** và **cảm biến PIR**.
2. **Nên mở ticket Tuya** về việc `/v2.0/apps/{schema}/users` trả thiếu user. Fix hiện tại
   là đường vòng qua uid backend tự lưu, không phải chữa gốc.

**Chưa commit.**
