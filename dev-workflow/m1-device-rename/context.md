# Context: Đổi tên thiết bị (m1-device-rename)

> File "trí nhớ" - giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.

- **Slug:** `m1-device-rename`

## Quyết định kỹ thuật (Decision log)
- **2026-09-22** - Đổi tên đi qua **App SDK** (`Tuya.renameDevice`), KHÔNG qua backend/Cloud OpenAPI. Lý do:
  app đã đăng nhập bằng tài khoản Tuya của chính user → SDK là đường ngắn nhất & đúng chủ sở hữu; backend
  cũng không lưu tên nào để phải đồng bộ.
- **2026-09-22** - Đặt adapter mới ở `services/tuya.ts` (nơi đang giữ `removeDevice`) thay vì tái dùng
  `services/pairing.ts#renameDevice`. Bản của pairing cố ý **no-op khi native vắng** và caller nuốt lỗi
  (không chặn hoàn tất pairing) - hành vi đó SAI cho luồng quản lý thiết bị (người dùng phải biết lưu hỏng).
  Giữ nguyên bản pairing để không đụng luồng pairing vừa fix xong.
- **2026-09-22** - UI dùng **modal tự dựng** (`RenameDeviceModal`) chứ không `Alert.prompt`: prompt chỉ có
  trên iOS, Android sẽ không có ô nhập nào.
- **2026-09-22** - `renameDevice` trả về **tên đã chuẩn hoá** để caller hiện đúng chuỗi vừa lưu (tránh UI
  hiện " Bồn   nhà " trong khi Tuya lưu "Bồn nhà").
- **2026-09-22** - Giới hạn độ dài phía app `DEVICE_NAME_MAX_LENGTH = 40` (chặn sớm cho UX). Tuya cloud có
  ràng buộc riêng; nếu server từ chối thì message nguyên văn của SDK vẫn được hiện, không nuốt.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `packages/tuya-react-native/src/specs/NativeTuyaDevice.ts` + `src/index.tsx` | Spec + facade `renameDevice` (**đã có sẵn**, không sửa) |
| `packages/.../android/.../device/TuyaDeviceModule.kt` · `ios/Device/TuyaDevice.mm` | Native rename (**đã có sẵn**): `renameDevice` / `updateName:` |
| `apps/mobile/src/services/tuya.ts` | **MỚI**: `renameDevice`, `normalizeDeviceName`, `DEVICE_NAME_MAX_LENGTH` |
| `apps/mobile/src/services/home.ts` | **MỚI**: `renameMockDevice` + `withMockName` (override tên bồn giả trong phiên) |
| `apps/mobile/src/components/RenameDeviceModal.tsx` | **MỚI**: dialog nhập tên (chạy cả Android/iOS) |
| `apps/mobile/src/screens/DashboardScreen.tsx` | Menu `⋮` = Rename / Remove; `runRename`; header cắt 1 dòng |
| `apps/mobile/App.tsx` | `handleDeviceRenamed` → `activeDevName` + `lastPairedDevice` |
| `apps/mobile/src/services/tuya.rename.test.ts` · `home.test.ts` | Test adapter + nhánh mock |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **Không cần rebuild native**: bridge rename đã có trong lib (kể cả `lib/module` đã build) từ thời
  `m1-mobile-home-device-flow` (B5 pairing đặt tên) ⇒ **cài lại bản JS/APK hiện tại là test được**.
- `services/pairing.ts#renameDevice` vẫn tồn tại song song (dùng ở bước "Paired" của pairing). Hai bản có
  chủ đích khác nhau - đừng gộp mà không xem lại xử lý lỗi của pairing.
- **`pairedDevice` cache ở App có thể chèn ngược tên cũ**: `DeviceListScreen.mergePairedDevice` đẩy thiết bị
  vừa pair lên đầu list bằng bản cache. Nếu không cập nhật `lastPairedDevice` sau rename thì list hiện lại
  tên cũ dù Tuya đã đổi. Đã xử lý trong `handleDeviceRenamed` (cùng lý do với tombstone của luồng remove).
- **Tên đổi từ app khác không tự cập nhật** khi màn detail đang mở: Android `onDevInfoUpdate(devId)` (listener
  trong `TuyaDeviceModule.kt`) đang **rỗng**, iOS `deviceInfoUpdate:` chỉ emit `isOnline` → không có tên trong
  event `onDeviceStatus`. Muốn live-sync phải sửa native + rebuild (**backlog**, không chặn feature này).
- Backend/DB **không lưu tên thiết bị** (`devices.service.ts` đọc live từ Tuya Cloud) ⇒ admin web tự thấy tên
  mới sau khi rename, không cần API/migration nào.

## Liên kết
- Research: [tuya-home-sdk-device-management.md](../../docs/research/tuya-home-sdk-device-management.md)
- Feature gốc của Device Detail/Device List: [[m1-mobile-home-device-flow]]
