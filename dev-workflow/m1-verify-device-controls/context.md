# Context: Verify 4 tính năng điều khiển khách yêu cầu

- **Slug:** `m1-verify-device-controls`

## Quyết định kỹ thuật (Decision log)

- **2026-09-23** - **Xoá hẳn `renameDevice` trong `services/pairing.ts`**, mọi chỗ đổi tên dùng
  `services/tuya.ts#renameDevice`. Lý do: tồn tại 2 hàm cùng tên, bản ở `pairing.ts` **nuốt lỗi,
  không validate, không timeout, native vắng thì im lặng coi như thành công** - đúng thứ làm khách
  thấy "đổi tên lúc kết nối không ăn". Đã cân nhắc & loại: giữ cả hai + thêm comment cảnh báo (bản
  yếu vẫn ở đó, lần sau lại có người gọi nhầm).

- **2026-09-23** - Đổi tên lỗi **KHÔNG huỷ pairing**: thiết bị đã bind vào Home rồi, chặn lại là mất
  thành quả. Nhưng bắt buộc **Alert cho người dùng** + hiện **tên Tuya thật** (không phải tên vừa gõ)
  để Device List refetch xong không "trả tên cũ về" một cách khó hiểu.

- **2026-09-23** - Thêm action `controlError` vào reducer thay vì dùng lại `connectError`. Lý do:
  lệnh điều khiển trượt **không** có nghĩa là mất kết nối - đổi `status` sang `error` sẽ xoá nhiệt độ
  đang hiển thị và bắt người dùng bấm RETRY một cách vô lý.

- **2026-09-23** - Test hợp đồng điều khiển dựng trên **payload dump từ máy thật**, không phải dữ
  liệu bịa: sự cố 2026-07-24 (placeholder DP trùng id với DP khác nghĩa) chỉ lộ ra khi chạy đúng số
  liệu thật.

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/dp.ts` | Resolve DP theo **code thật** + codec DP raw (ghi 1 slot, giữ slot khác) |
| `apps/mobile/src/services/tuya.ts` | `readDevice` · `setTargetTemp` (ack + fallback) · `setLight/setPurify/setPower` · `renameDevice` |
| `apps/mobile/src/services/cleanCycle.ts` | Chu trình vệ sinh = DP 122 + **timer cloud** (chạy tay + lịch + lưới an toàn) |
| `apps/mobile/src/services/tuya.control.test.ts` | **(mới)** khoá hợp đồng 4 tính năng trên payload thật |
| `apps/mobile/src/state/useAppState.ts` | `toggleBool` (optimistic + revert + **báo lỗi**), `setTargetTemp` debounce |
| `apps/mobile/src/state/deviceMachine.ts` | Reducer + action **`controlError`** (mới) |
| `apps/mobile/src/screens/PairingScreen.tsx` | Bước đặt tên cuối luồng pair (`done()`) |
| `packages/tuya-react-native/ios/Device/TuyaDevice.mm` | `publishDpsAwaitAck` (wire ở `ebe5b13`) |
| `packages/tuya-react-native/ios/Timer/TuyaTimer.mm` | add/update/remove/getTimerList (wire đủ ở `101b17c`) |

## Phát hiện & cạm bẫy (Findings / Gotchas)

- **Bản 1.0.4 khách đang cầm KHÔNG chạy được 3/4 tính năng này.** Từ `5fa975c` (1.0.4) tới HEAD có
  **15 commit**, gồm cả native: trước `ebe5b13`, iOS `publishDpsAwaitAck` là **stub reject
  `ios_todo`** ⇒ mọi lệnh đổi nhiệt độ **chết tại chỗ**, không gói tin nào rời máy; module timer cũng
  chưa wire đủ ⇒ clean cycle không hẹn tắt được. ⇒ **Phải build 1.0.6.**
- **Hai hàm `renameDevice` trùng tên ở 2 service** - PairingScreen vớ nhầm bản yếu. Kiểu bug này
  không lộ ra ở test vì mỗi bản đều có test riêng và đều xanh.
- **Công tắc trượt thì im lặng**: `toggleLight/Power/Purify` chỉ revert optimistic, không hiện lý do.
  Người dùng thấy "bấm đèn nó nảy về" và không có gì để báo lại cho mình.
- **Bồn KHÔNG có DP chu trình vệ sinh** - "clean cycle" là app tự dựng: bật DP 122 + timer cloud hẹn
  tắt. Nên nếu timer không đặt được thì **không được phép bật** (ozone chạy vô hạn) - code đã theo
  đúng thứ tự "hẹn tắt trước, bật sau".
- **Android `actions` của timer chưa verify máy thật** (best-guess theo bean nội bộ) và
  `getTimerList` chưa wire ⇒ lịch vệ sinh trên Android còn rủi ro.
- **Timer Tuya chạy theo timezone THIẾT BỊ**, app sinh `HH:mm` theo giờ điện thoại ⇒ khác múi giờ là
  lệch. Chưa xác nhận trên máy thật.
- DP `105 sensor_f_1` là **cùng cảm biến ở °F** - đừng bao giờ để nó rơi vào `currentTemp` (bug cũ
  2026-07-24: hiện 43.0 khi nước 6.4 °C).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Research: [tuya-icebath-dp-mapping.md](../../docs/research/tuya-icebath-dp-mapping.md) ·
  [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)
- Feature liên quan: `m1-fix-device-connect-error` (kết nối/lỗi hiển thị) · `m1-clean-cycle` ·
  `m1-device-rename`

## Tóm tắt khi hoàn thành (điền lúc FINISH)
Rà xong 4 tính năng. 2/4 đã đúng sẵn ở HEAD (nhiệt độ, clean cycle - có test đầy đủ); 2/4 phải vá:
đổi tên lúc pair (dùng nhầm adapter yếu, nuốt lỗi) và đèn/công tắc (lỗi câm). Thêm
`tuya.control.test.ts` khoá hợp đồng DP trên payload thật. **Điều kiện tiên quyết để khách thấy
chúng chạy: build IPA 1.0.6** - bản 1.0.4 không thể chạy vì native còn stub.
