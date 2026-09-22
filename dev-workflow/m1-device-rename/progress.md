# Progress: Đổi tên thiết bị (m1-device-rename)

> File quản lý tiến trình (state machine). `/dev`, `/test`, `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-device-rename`
- **Phase hiện tại:** `TEST` (B1–B7 code xong & CI xanh; còn B8 verify máy thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-22

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**CODE XONG B1–B7 (2026-09-22).** Chỉ JS ⇒ **không cần rebuild native** (bridge `renameDevice` đã có sẵn
trong lib từ trước) - cài lại bản hiện tại / reload Metro là test được.

Còn lại (B8 - chạy thật, không phải code):
1. Mở **Device Detail → `⋮` → Rename device** → đổi tên → Save.
2. Mở **Smart Life** (cùng tài khoản) xem **tên mới** → chứng minh đã đổi ở phía Tuya (AC8).
3. Mở **admin web → Devices** xem tên mới (admin đọc live từ Tuya Cloud).
4. Thử ca lỗi: tắt mạng → Save → phải thấy message lỗi thật, modal KHÔNG đóng, tên cũ giữ nguyên.
5. Quay lại **Device List** → tên mới (không bị `pairedDevice` cache chèn tên cũ).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Kiểm hiện trạng · **done** (native rename ĐÃ CÓ 2 nền tảng + lib build; app chưa có UI; backend không lưu tên)
- [x] B2 - `renameMockDevice` ở `services/home.ts` · **done** (override map + `withMockName` áp cho cả 2 nguồn list mock)
- [x] B3 - Adapter `renameDevice` ở `services/tuya.ts` · **done** (validate + normalize + `withTimeout` 15s + lỗi native giữ nguyên + nhánh mock)
- [x] B4 - `RenameDeviceModal.tsx` · **done** (Modal 2 nền tảng, autoFocus + counter + lỗi inline + spinner khi lưu; chạm ngoài để huỷ, khoá khi đang lưu)
- [x] B5 - Wire Device Detail · **done** (`⋮` → Rename/Remove/Cancel; `runRename`; `renamedName` local để header không nháy tên cũ; header `numberOfLines={1}`)
- [x] B6 - Wire App.tsx · **done** (`handleDeviceRenamed` → `activeDevName` + `lastPairedDevice`; truyền cho cả route `device-detail` và `dashboard`)
- [x] B7 - Test + CI · **done** (xem run log)
- [ ] B8 - Verify máy thật + đối chiếu Smart Life/admin · **pending**

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - Menu `⋮` có Rename device + modal prefill tên hiện tại
- [x] AC2 - Lưu qua SDK Tuya thật, UI chỉ đổi sau success
- [x] AC3 - Chuẩn hoá tên + chặn rỗng/quá dài (test)
- [x] AC4 - Lỗi → giữ modal + message thật của SDK, không đổi tên trong UI (test adapter giữ nguyên lỗi)
- [x] AC5 - Đồng bộ header + `pairedDevice` cache
- [x] AC6 - Mock/bồn giả đổi tên được (test)
- [x] AC7 - tsc 0 · eslint 0 error · jest 365/365
- [ ] AC8 - Verify máy thật (Smart Life + admin thấy tên mới) · **pending**

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-22 | TEST B7 | ✅ | `npx tsc --noEmit` **0 lỗi** · `npx eslint` (7 file đụng tới) **0 error** (chỉ warning inline-style theo convention repo) · `npx jest` **365/365** (trước feature: 354 - thêm 9 case `tuya.rename.test.ts` + 2 case mock rename ở `home.test.ts`). |
| 2026-09-22 | DEV B2–B6 | ✅ | `home.ts` (+`renameMockDevice`/`withMockName`) · `tuya.ts` (+`renameDevice`/`normalizeDeviceName`/`DEVICE_NAME_MAX_LENGTH=40`/`RENAME_TIMEOUT_MS=15s`) · `RenameDeviceModal.tsx` (mới) · `DashboardScreen.tsx` (menu Rename/Remove + `runRename` + header 1 dòng) · `App.tsx` (`handleDeviceRenamed`). |
| 2026-09-22 | B1 - kiểm hiện trạng | ✅ | **SDK: đã đủ** - `NativeTuyaDevice.renameDevice` + facade + Android `IThingDevice.renameDevice` + iOS `updateName:` (lib/module đã build) ⇒ **không cần rebuild native**. **App: thiếu** - chỉ có `pairing.ts#renameDevice` dùng lúc pair (no-op khi native vắng, nuốt lỗi), Device Detail `⋮` mới chỉ có Remove. **Backend: không lưu tên** (`devices.service.ts` đọc live Tuya Cloud) ⇒ không cần API/migration. |

## Vấn đề đang chặn (Blockers)
- Không có blocker code. Chỉ còn xác minh trên thiết bị thật (B8/AC8).
- Backlog (không chặn): live-sync khi tên bị đổi từ app khác - cần native đẩy tên trong
  `onDevInfoUpdate`/`deviceInfoUpdate:` rồi rebuild.
