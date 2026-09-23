# Progress: Màn Device settings + đổi tên nhanh từ Device List

- **Slug:** `m1-device-settings-screen`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-23

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B4 - cần người:** chỉ JS nên **cài lại bản build hiện có là test được** (Android: APK cũ + reload JS;
iOS: bản TestFlight tới). Checklist:
1. Device List: **giữ** một thiết bị → modal đổi tên hiện ra, đổi tên → tên trong danh sách đổi ngay,
   mở Device Detail thấy tên mới (AC5, AC3).
2. Device Detail → `⋮` → vào màn **Device settings**, không còn Alert menu (AC1).
3. Màn settings hiện: Status/Connection/Model/Firmware/MAC/Device ID (bồn thật) - field nào SDK không
   trả thì **không có dòng đó** (AC2). Tắt mạng → phần thông tin hiện lỗi + nút RETRY, phần tên/hành động
   vẫn dùng được.
4. Rename trong màn settings → back ra Device Detail phải thấy tên mới trên header (AC3).
5. Remove → phải hỏi xác nhận; xoá xong về Device List, bấm back **không** quay lại màn settings của bồn
   đã xoá (AC4).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Thông tin thiết bị (`readDeviceRaw` + `deviceInfo.ts`)  · done (8 test)
- [x] B2 - Màn Device settings + đổi `⋮`  · done
- [x] B3 - Giữ để đổi tên ở Device List  · done
- [ ] B4 - Verify trên máy thật  · pending (cần người)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - `⋮` mở màn Device settings, không còn Alert menu · code xong, ⏳ chờ test máy
- [ ] AC2 - Hiện đủ thông tin, field thiếu thì ẩn dòng · parser có test, ⏳ chờ payload máy thật
- [ ] AC3 - Đổi tên lưu qua Tuya + đồng bộ header/list, lỗi giữ modal · ⏳
- [ ] AC4 - Xoá có confirm + back-stack sạch · ⏳
- [ ] AC5 - Long-press ở Device List đổi tên được · ⏳
- [x] AC6 - tsc 0 · eslint 0 error · jest **31/31 suite, 424/424**

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-23 | TEST B1–B3 | ✅ | `npx tsc --noEmit` exit 0 · `npx eslint` 8 file đụng tới: **0 error** (chỉ warning `no-inline-styles` như toàn repo) · `npx jest` **31/31 suite, 424/424 test** (+8 test `deviceInfo`). |
| 2026-09-23 | DEV B3 | ✅ | `DeviceListScreen`: `onLongPress` (350ms) mở `RenameDeviceModal`, lưu xong sửa nhãn tại chỗ + `onDeviceRenamed` lên App; thêm dòng gợi ý "Hold a device to rename it." vì long-press không tự lộ ra được. |
| 2026-09-23 | DEV B2 | ✅ | `DeviceSettingsScreen` (tên + trạng thái + Rename + INFORMATION + Remove đỏ có confirm); khoá `device-settings` + `case` trong App (nhận `goBack`); `handleDeviceRemoved` lọc thêm `device-settings` khỏi back-stack; `DashboardScreen` bỏ Alert menu + toàn bộ logic rename/remove (ngắn đi ~90 dòng), `⋮` chỉ điều hướng. |
| 2026-09-23 | DEV B1 | ✅ | `tuya.ts#readDeviceRaw` (rawJson, mock → rỗng) + `services/deviceInfo.ts` parse thành dòng hiển thị (Status/Connection/Model/Firmware/MAC/Time zone/Device ID/Sharing), MAC tự chèn dấu hai chấm; 8 test phủ payload iOS, Android, rỗng/hỏng. |
| 2026-09-23 | PLAN | ✅ | Plan 4 bước / 6 AC từ yêu cầu trực tiếp. Chỉ JS, không đụng native. |

## Vấn đề đang chặn (Blockers)
- Không có. B4 cần bồn thật (hoặc bồn giả để xem UI).
