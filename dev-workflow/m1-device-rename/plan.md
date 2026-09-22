# Kế hoạch: Đổi tên thiết bị (rename qua Tuya SDK)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-device-rename`
- **Milestone:** M1·B (mobile - mở rộng `m1-mobile-home-device-flow`, cùng nhóm với luồng remove device)
- **Phần liên quan:** mobile (chỉ JS - **không đụng native**)
- **Ngày tạo:** 2026-09-22
- **Cập nhật lần cuối:** 2026-09-22

## 1. Mục tiêu & phạm vi
Khách yêu cầu: **đổi tên thiết bị ngay trong app**, và tên mới phải **đổi cả phía Tuya** (không chỉ là
nhãn hiển thị local) → Smart Life, admin web (đọc tên qua Tuya Cloud) và các máy khác cùng tài khoản đều
thấy tên mới.

Trong phạm vi:
- Adapter `renameDevice` ở `services/tuya.ts` (gọi SDK thật + nhánh mock + validate + timeout + lỗi thật).
- UI đổi tên trên **Device Detail** (menu `⋮` hiện có của luồng remove) bằng **modal tự dựng**.
- Đồng bộ tên mới sang header màn detail + cache `pairedDevice` ở App (Device List không chèn tên cũ).

Ngoài phạm vi:
- Đổi tên **phòng/nhà** (home/room) - Tuya có API riêng, khách chưa yêu cầu.
- Live-sync khi tên bị đổi từ **app khác** (Smart Life) lúc màn detail đang mở - cần sửa native
  (`onDevInfoUpdate` / `deviceInfoUpdate:` hiện không đẩy tên lên JS) ⇒ phải rebuild native. Ghi backlog.

## 2. Bối cảnh & ràng buộc
- **Native ĐÃ CÓ SẴN rename** (không cần rebuild APK/IPA): `renameDevice(devId, name)` có trong
  `specs/NativeTuyaDevice.ts` + facade `index.tsx` (+ `lib/module` đã build) →
  Android `IThingDevice.renameDevice(name, IResultCallback)` · iOS `[ThingSmartDevice updateName:...]`.
  Xem [tuya-home-sdk-device-management.md](../../docs/research/tuya-home-sdk-device-management.md) §Rename.
- **Đã có 1 chỗ gọi rename**: `services/pairing.ts#renameDevice` - chỉ dùng ở bước đặt tên sau khi pair,
  native vắng → **no-op**, lỗi bị nuốt (cố ý: không chặn hoàn tất pairing). **Không tái dùng** cho feature
  này vì luồng quản lý thiết bị cần: validate, mock, và lỗi phải nổi lên cho người dùng.
- **Không có backend/DB nào lưu tên thiết bị** (`apps/backend/src/devices/*` đọc tên **live** từ Tuya Cloud;
  `device_reminders` chỉ lưu `deviceId`) ⇒ rename qua SDK là đủ, **không cần migration / API mới**.
- **Alert.prompt CHỈ có trên iOS** → phải tự dựng modal nhập tên cho chạy được cả Android.
- Giữ nguyên quy ước repo: artifact tiếng Việt, code/UI tiếng Anh; `withTimeout` cho mọi call native;
  KHÔNG nuốt message lỗi của SDK.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [x] **AC1** - Device Detail → `⋮` có **Rename device** (bên cạnh Remove device); mở modal có sẵn tên hiện tại.
- [x] **AC2** - Lưu tên → gọi **SDK Tuya thật**; chỉ cập nhật UI **sau khi** SDK báo success.
- [x] **AC3** - Tên được chuẩn hoá (trim + gộp khoảng trắng), chặn rỗng và chặn quá `DEVICE_NAME_MAX_LENGTH`.
- [x] **AC4** - Lỗi (mất mạng / cloud từ chối / build native cũ) → modal **giữ nguyên** + hiện message thật
  của SDK; tên cũ không bị đổi trong UI.
- [x] **AC5** - Tên mới đồng bộ ngay: header detail + `pairedDevice` cache; quay lại Device List thấy tên mới.
- [x] **AC6** - Bồn giả / native vắng → đổi tên chạy được trên mock (test UI không cần bồn thật).
- [x] **AC7** - `tsc` 0 · `eslint` 0 error · `jest` xanh (thêm test cho adapter + mock).
- [ ] **AC8** - Verify trên **máy thật**: đổi tên → mở **Smart Life** thấy tên mới (chứng minh đổi ở Tuya,
  không chỉ local) → mở **admin web** thấy tên mới.

## 4. Các bước thực hiện
1. **B1 - Kiểm hiện trạng** (SDK/native/app/backend) · done
2. **B2 - `renameMockDevice` ở `services/home.ts`** (override tên bồn giả trong phiên) · done
3. **B3 - Adapter `renameDevice` + `normalizeDeviceName` + `DEVICE_NAME_MAX_LENGTH` ở `services/tuya.ts`** · done
4. **B4 - `components/RenameDeviceModal.tsx`** (modal 2 nền tảng, ô nhập + counter + lỗi + trạng thái lưu) · done
5. **B5 - Wire Device Detail**: menu `⋮` tách `Rename device` / `Remove device`; `runRename`; header `numberOfLines` · done
6. **B6 - Wire App.tsx**: `onDeviceRenamed` → cập nhật `activeDevName` + `lastPairedDevice` · done
7. **B7 - Test**: `tuya.rename.test.ts` (9 case) + 2 case mock ở `home.test.ts`; chạy tsc/eslint/jest · done
8. **B8 - Verify máy thật** (AC8) · pending
