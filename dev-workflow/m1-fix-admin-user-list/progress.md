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
| 2026-09-28 | FIX B6 | ✅ | **Khách báo: thiết bị ONLINE mà mở trang chi tiết ra thì trắng** ("Couldn't load this device from Tuya", `/devices/9b03cd2fe5ac1235d3eab1`). Truy ra: `getDevice()` gọi 3 endpoint song song nhưng **chỉ `/status` là KHÔNG có `.catch()`**. Probe thật con đó: `/v1.0/devices/{id}` ✅ `online=true`, `/v1.0/devices/{id}/status` ❌ **`2003 function not support`**, `/specifications` ❌ `2009 not support this device`, nhưng **`/v1.0/iot-03/devices/{id}/status` ✅** và `/iot-03/.../specification` ✅ ⇒ chỉ mỗi lời gọi không bắt lỗi kia làm sập cả trang. **Sửa:** gom thành `readDeviceState()` dùng chung cho `getDevice` + `sendCommand`; status/spec **tự lùi sang bản `iot-03`**, cả hai hỏng thì coi như rỗng; **không đọc nổi `detail` → 404** thay vì trả vỏ rỗng `name:''/online:false`. `sendCommand` hết 500 khi status hỏng (ra 400/409 đúng nghĩa). jest **114/114** (+2 test dựng theo payload lỗi ĐO ĐƯỢC). Verify thật: `9b03cd2…` ✅ "Walrus amara" online · `9b58227…` ✅ "PIR Test jimmy" online · `9beceda…` ❌ 404 đúng. ❌ **Kết luận "không máy nào là bồn đá" ở bước này là SAI** - xem FIX B7. |
| 2026-09-28 | FIX B7 | ✅ | **ĐÍNH CHÍNH B6 + sửa tiếp 2 bug.** Khách hỏi lại: trang chi tiết hết lỗi nhưng **không hiện gì**, trong khi `/v2.0/cloud/thing/{id}/shadow/properties` có đủ giá trị. Đúng: **`9b03cd2fe5ac1235d3eab1` CHÍNH LÀ bồn đá**, model **`g0cv1c`** - đúng model repo đã tài liệu hoá (`device-dp.ts:9`). Category `sgbj`/"Audible alarm" chỉ là **nhãn sản phẩm Tuya đặt sai**, không liên quan tới DP thật. Thiết bị có đủ 12 DP: `sensor_1`(101) `sensor_f_1`(105) `setting_temp_range`(114) `setting_temp`(115) `setting_pwr`(121) `setting_clr`(122) `setting_4`(124)… **Bug 1 - nguồn dữ liệu:** `/v1.0/.../status` trả `2003`, `/specifications` trả `2009`, `/iot-03/.../status` trả **mảng rỗng**; chỉ bộ **v2.0 cloud/thing** (`shadow/properties` + `model`) có dữ liệu ⇒ thêm 2 endpoint này làm nguồn dự phòng, kèm `thingModelToSpec()` quy đổi thing model → hình dạng specification (**tên kiểu chữ thường → chữ hoa**: `raw`→`Raw`, nếu không `setting_temp` mất nhánh decode raw). **Bug 2 - codec sai quy ước dấu:** `toSigned` dùng **bù 2**, nhưng mô tả DP của Tuya cho **cả 114 lẫn 115** ghi rõ *"高位bit赋值0表示正数，赋值1表示负数"* (**bit cao = dấu**, 15 bit = độ lớn) ⇒ giới hạn dưới thật `0x803C` đọc ra **-3270.8°C** thay vì **-6.0°C**; `writeTargetWord` cũng mã hoá sai setpoint ÂM. Đã sửa cả 2 chiều + `toWord()`. Test cũ "nhiệt độ âm dùng int16 bù 2" khoá nhầm giả định → viết lại theo payload THẬT. jest **116/116**. ✅ Verify thật: `currentTemp=10.1 targetTemp=8 tempRange={min:-6,max:15} power=true light=true purify=false`. 🔴 **`apps/mobile/src/services/dp.ts:159,176` có Y HỆT bug dấu** - chưa sửa (khác scope, cần bundle/build mới). |
| 2026-09-28 | TEST B5 | ✅ | **Verify THẬT** (boot Nest context với `.env` production, gọi thẳng service): `GET /users` **total=2 → 6** (Sam · Christopher `devices=1` · Tobias · Azmat · **Huy Quốc `devices=1`** · Huy), `GET /admin/devices` **1 → 2** (`Walrus amara`/Christopher + `PIR Test jimmy`/Huy Quốc, cả hai ONLINE). 4 uid tháng 7 bị loại đúng như thiết kế. CI: backend tsc **0** · eslint **0** (trên file đã sửa) · jest **112/112** (+9 test mới) · admin tsc **0** · eslint **0** · `next build` ✓ (14 route). |
| 2026-09-28 | DEV B2-B4 | ✅ | Backend: `loadRoster()` public (Tuya ∪ `push_tokens` ∪ `device_reminders`, enrich `/infos` + `/devices`, `mapLimit` 8 luồng, trần 500), `listUsers` phân trang tại chỗ + `deviceCount: number\|null`, `getUser` bỏ `business.deviceMappings`, xoá `enrichInfos`/`deviceCounts`. Devices: `listAllDevices()` đọc roster ⇒ hết gọi `/users/{uid}/devices` lần hai. Admin: `UsersBrowser` cột Devices `—` + badge **"Unknown"** khi `null`; bỏ dòng "Device mappings" ở user detail. |
| 2026-09-28 | PLAN B1 | ✅ | Probe thật: Tuya list `total=2` trong khi `push_tokens` có **11 uid**. Loại trừ schema (khách xác nhận chỉ 1 app, đúng cái đang cấu hình), data center (CE `28841107 suspended`), phân trang (`page_size=200` vẫn 2), kiểu đăng nhập. **Khác biệt duy nhất = ngày tạo**, mốc cắt giữa 17/08 và 31/08 ⇒ Tuya bỏ sót, lỗi phía Tuya. Phát hiện thêm **lỗi 2**: `device_mappings` `count=0` và grep cả repo **không có `create`/`upsert`** nào ⇒ cột Devices + badge Status xưa nay luôn sai. |

## Vấn đề đang chặn (Blockers)

Không có blocker cho phần code. Hai việc cần người:

1. **4 uid tháng 7** (`we1784616116281A0VxT`, `we17831755711425l85B`, `we178297522620935amb`,
   `we1782962675373ARo2g`) thuộc app SDK cũ (trước 28/07) → Tuya `1106 permission deny`,
   code không cứu được. Cần xác nhận đó là tài khoản test hay khách thật.
   Bồn `9beceda61448a0fdd54w73` của `we178297522620935amb` vẫn nằm trong nhóm này nên không đọc
   được; nhưng bồn `9b03cd2fe5ac1235d3eab1` (Christopher) thì **đọc và điều khiển được bình thường**.

3. 🔴 **`apps/mobile/src/services/dp.ts` dính CÙNG bug quy ước dấu** đã sửa ở backend
   (`toSigned` dòng 159 dùng bù 2, `writeTargetWord` dòng 176 mã hoá `& 0xffff`). Hệ quả trên app
   khách: giới hạn dưới hiện sai bét và **đặt nhiệt độ ÂM sẽ gửi giá trị hỏng**. Chưa sửa vì khác
   scope và cần bundle/build mới - cần quyết định riêng.
2. **Nên mở ticket Tuya** về việc `/v2.0/apps/{schema}/users` trả thiếu user. Fix hiện tại
   là đường vòng qua uid backend tự lưu, không phải chữa gốc.

**Chưa commit.**
