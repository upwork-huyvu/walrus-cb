# Context: Màn Device settings + đổi tên nhanh từ Device List

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc.

- **Slug:** `m1-device-settings-screen`

## Quyết định kỹ thuật (Decision log)

- **2026-09-23** - `⋮` chuyển hẳn sang **màn riêng** thay vì bottom sheet/menu. Lý do: yêu cầu là có chỗ hiện
  **thông tin thiết bị** chứ không chỉ 2 hành động - menu không chứa nổi; router của app cũng là switch tự
  viết nên thêm màn rẻ hơn dựng sheet.
- **2026-09-23** - Logic rename/remove **chuyển từ `DashboardScreen` sang `DeviceSettingsScreen`**.
  `DashboardScreen` chỉ còn điều hướng. Lý do: giữ một nơi duy nhất cho thao tác quản lý thiết bị; màn điều
  khiển đang dài sẵn (~390 dòng).
- **2026-09-23** - Giữ (long-press) ở Device List mở **thẳng modal đổi tên**, không mở màn settings. Lý do:
  yêu cầu là "giữ để sửa tên" - thêm một bước điều hướng là đi ngược ý đồ thao tác nhanh.
- **2026-09-23** - Thông tin thiết bị đọc từ `rawJson` của `getDeviceSnapshot` (đã có sẵn, không cần API
  mới) và parse ở JS để test được; field nào thiếu thì ẩn dòng.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/screens/DeviceSettingsScreen.tsx` | Màn mới: thông tin + đổi tên + xoá (confirm) |
| `apps/mobile/src/services/deviceInfo.ts` | Parse `rawJson` → các dòng thông tin hiển thị |
| `apps/mobile/src/services/tuya.ts` | `readDeviceRaw` (lấy `rawJson`), `renameDevice`, `removeDeviceOrConfirmAbsent` |
| `apps/mobile/src/components/RenameDeviceModal.tsx` | Dialog đổi tên (dùng lại ở cả 2 chỗ) |
| `apps/mobile/src/screens/DeviceListScreen.tsx` | Danh sách thiết bị - thêm long-press đổi tên |
| `apps/mobile/src/navigation.ts` · `App.tsx` | Router tự viết: thêm khoá `device-settings` + wiring |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- `App.tsx#handleDeviceRemoved` lọc `device-detail` khỏi back-stack sau khi xoá ⇒ **phải lọc cả
  `device-settings`**, không thì `goBack` quay về màn cài đặt của thiết bị vừa xoá.
- `rawJson` **khác nhau giữa iOS và Android** (iOS: `timezoneId`, `pv`, `bv`, `isCloudOnline`; Android:
  `uiType`, `ownerId`, `sharedTime`, `devAttribute`) ⇒ parser chỉ lấy field chung và bỏ field rỗng.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Feature trước đó về đổi tên: [m1-device-rename](../m1-device-rename/progress.md)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<2-4 câu>
