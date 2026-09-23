# Progress: Fix "Unknown error" + mất kết nối khi vừa pair xong

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-fix-device-connect-error`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-22 (B1-B6 xong & CI xanh; chỉ còn B7 verify máy thật)

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B7 - verify trên iPhone thật** (không tự chạy được, cần bồn + máy khách). Chỉ JS ⇒ **không phải
rebuild IPA**, cài lại bản JS/bundle là test được. Checklist ở mục B7 của [plan.md](plan.md).
Nếu máy thật vẫn ra lỗi → đọc **mã lỗi mới hiện trên banner** (giờ đã có nội dung thật) rồi `/fix-plan`.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Sửa `services/tuyaError.ts` (hết "Unknown error.") · done
- [x] B2 - `withTimeout` có `code: 'timeout'` + `warmHomeCache()` · done
- [x] B3 - `services/deviceConnect.ts` (warm-cache + backoff) · done
- [x] B4 - Wire `useAppState` + `DashboardScreen` + `PairingScreen` · done
- [x] B5 - `deviceMachine`: không lật `error`→`online`, xoá nhiệt độ giả (+ B5b `connectSeq`) · done
- [x] B6 - Chạy tsc + eslint + jest · done
- [ ] B7 - Verify máy thật (iPhone) · pending

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - code phi-số không còn ra "Unknown error."
- [x] AC2 - timeout có `code: 'timeout'`, không cào nhầm số dương
- [x] AC3 - retry + warm cache đúng thứ tự/đúng số lượt
- [ ] AC4 - pair xong vào detail ngay: không ERROR (máy thật)
- [x] AC5 - self-heal bằng đọc lại snapshot, không lật pill suông
- [x] AC6 - lúc error: gauge `-`, không hiện 12°/6° giả
- [x] AC7 - tsc 0 · eslint 0 · jest xanh + test mới
- [ ] AC8 - verify máy thật, lỗi hiện có nội dung
- [x] AC9 - đăng ký lại listener realtime sau mỗi connect thành công

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-22 | DEV B1-B6 | ✅ | `tsc --noEmit` 0 lỗi · `eslint src` **0 error** (935 warning = baseline cũ) · `jest` **395/395** (baseline 365 ⇒ **+30 test mới**: 9 `deviceConnect`, 10 `tuyaError`, 3 `home.warmHomeCache`, 3 `deviceMachine`, còn lại từ suite sẵn có). File mới: `services/deviceConnect.ts` + test. |
| 2026-09-22 | DEV B5b (phát sinh) | ✅ | Đọc native mới phát hiện iOS `registerDeviceListener` **return im lặng khi `deviceWithDeviceId` nil** ⇒ listener đăng ký lúc cache lạnh là listener CHẾT (realtime im vĩnh viễn dù sau đó đọc OK). Thêm `connectSeq` vào reducer + deps effect để đăng ký lại. → AC9. |
| 2026-09-22 | PLAN | ✅ | Điều tra từ ảnh chụp của khách → truy ra `no_device` (cache SDK chưa warm) + bug bảng mã phi-số ở `tuyaError.ts`. Plan 7 bước, 8 AC (sau thành 9). |

## Vấn đề đang chặn (Blockers)
- Trống. B7 cần bồn thật + iPhone của khách.

## Ghi chú cho phiên sau
- Trong working tree còn **thay đổi chưa commit của việc khác** (không thuộc feature này):
  `packages/tuya-react-native/ios/Device/TuyaDevice.mm` (wire `publishDpsAwaitAck` cho iOS),
  `apps/mobile/src/services/dp.ts` + `apps/backend/src/devices/device-dp.ts` (sửa layout DP raw
  xen kẽ °C/°F), `docs/research/tuya-icebath-dp-mapping.md`. **Đừng gộp chung khi commit feature này.**
