# Kế hoạch: Màn Device settings + đổi tên nhanh từ Device List

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-device-settings-screen`
- **Milestone:** M1 · B (mobile)
- **Phần liên quan:** mobile (chỉ JS - không đụng native)
- **Ngày tạo:** 2026-09-23
- **Cập nhật lần cuối:** 2026-09-23

## 1. Mục tiêu & phạm vi
Yêu cầu của chủ dự án (2026-09-23):
1. Ở **Device List** (màn landing sau login), **giữ (long-press)** một thiết bị là đổi tên được ngay.
2. **Thiết kế lại nút `⋮`** trên Device Detail: thay vì `Alert` 3 lựa chọn như hiện tại, mở **một màn mới**
   (Device settings) gồm **thông tin thiết bị**, **đổi tên**, và **xoá có xác nhận**.

Hiện trạng: `⋮` gọi `Alert.alert` với 2 hành động (Rename / Remove) - không có chỗ để hiện thông tin, và
`DashboardScreen` đang ôm cả logic rename lẫn remove. Device List thì chỉ có tap để mở thiết bị.

**Ngoài phạm vi:**
- Không đổi luồng pairing, không đụng native (rename/remove đã có sẵn adapter).
- Không thêm chia sẻ thiết bị / đổi phòng / OTA - để feature riêng nếu khách cần.

## 2. Bối cảnh & ràng buộc
- Router tự viết (`src/navigation.ts` + `switch` trong `App.tsx`), **không phải react-navigation** ⇒ thêm
  màn = thêm khoá vào `ScreenName` + `case` trong App + truyền props.
- `App.tsx` đã có `handleDeviceRenamed` / `handleDeviceRemoved`; `handleDeviceRemoved` lọc `device-detail`
  khỏi back-stack ⇒ **phải lọc thêm `device-settings`**, không thì `goBack` quay về màn của thiết bị đã xoá.
- Thông tin thiết bị lấy từ `getDeviceSnapshot().rawJson` (iOS và Android trả **khác field**: iOS có
  `timezoneId/pv/bv`, Android có `uiType/ownerId/sharedTime`…) ⇒ parser phải bỏ qua field thiếu.
- Đổi tên đã có: `services/tuya.ts#renameDevice` (validate + chuẩn hoá + timeout) và `RenameDeviceModal`
  (tự dựng vì `Alert.prompt` chỉ có iOS).
- Xoá đã có: `removeDeviceOrConfirmAbsent` + `cleanupRemovedDeviceReminder`.
- **Link nghiên cứu:** [tuya-home-sdk-device-management.md](../../docs/research/tuya-home-sdk-device-management.md)

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: Device Detail `⋮` mở **màn Device settings**, không còn `Alert` menu.
- [ ] AC2: Màn mới hiện tên + trạng thái (Online/Offline, LAN hay cloud) + model/product id + firmware +
  MAC + device id; field nào thiết bị không trả thì **ẩn dòng đó**, không hiện "undefined".
- [ ] AC3: Đổi tên trong màn mới lưu qua Tuya; header Device Detail và Device List đổi theo ngay; lỗi thì
  giữ modal mở kèm message thật của SDK.
- [ ] AC4: Xoá trong màn mới **luôn hỏi xác nhận**; xoá xong về Device List và `goBack` không quay lại được
  màn settings của thiết bị đã xoá.
- [ ] AC5: Device List: **giữ** một thiết bị → modal đổi tên; lưu xong tên trong danh sách đổi ngay.
- [ ] AC6: `tsc` 0 lỗi · `eslint` 0 error · `jest` xanh (kèm test cho parser thông tin thiết bị).

## 4. Các bước thực hiện
1. **B1 - Thông tin thiết bị**
   - Việc: `tuya.ts#readDeviceRaw` (trả `rawJson`, mock → rỗng) + `services/deviceInfo.ts` parse thành các
     dòng hiển thị (bỏ field rỗng, chuẩn hoá online/LAN, MAC hoa-thường).
   - File: `apps/mobile/src/services/tuya.ts`, `services/deviceInfo.ts` (+ `deviceInfo.test.ts`)
   - Kiểm thử: jest (parser thuần).
2. **B2 - Màn Device settings + đổi `⋮`**
   - Việc: `screens/DeviceSettingsScreen.tsx` (thông tin + Rename + Remove-có-confirm); khoá
     `device-settings` trong `navigation.ts`; `case` trong `App.tsx` + lọc back-stack khi remove;
     `DashboardScreen` bỏ Alert menu, `⋮` chỉ `navigate('device-settings', {devId, devName})`.
   - File: `screens/DeviceSettingsScreen.tsx`, `navigation.ts`, `App.tsx`, `screens/DashboardScreen.tsx`
   - Kiểm thử: tsc/eslint + checklist máy thật.
3. **B3 - Giữ để đổi tên ở Device List**
   - Việc: `onLongPress` mở `RenameDeviceModal`; lưu xong cập nhật list tại chỗ + báo lên App.
   - File: `screens/DeviceListScreen.tsx`, `App.tsx` (truyền `onDeviceRenamed`)
   - Kiểm thử: tsc/eslint + checklist máy thật.
4. **B4 - Verify trên máy thật**
   - Việc: chạy checklist AC1–AC5 trên bồn thật (kèm ca lỗi: tắt mạng khi đổi tên).
   - Kiểm thử: manual ⏳.

## 5. Rủi ro & câu hỏi mở
- ⚠️ `rawJson` khác nhau giữa 2 nền tảng ⇒ parser phải "có gì hiện nấy"; test phải phủ cả hai dạng payload.
- ⚠️ Xoá xong mà back-stack còn `device-settings` ⇒ `goBack` rơi vào màn của thiết bị không còn tồn tại.
- ❓ Khách có muốn thêm gì nữa trong màn settings (chia sẻ thiết bị, đổi phòng, kiểm tra firmware)? Hiện chỉ
  làm đúng phạm vi được yêu cầu.
