# Context: Mở rộng thư viện Tuya SDK theo từng module

> File "trí nhớ" — giữ context xuyên suốt các phiên. Mọi quyết định/phát hiện/cạm bẫy ghi vào đây.
> Append theo thời gian, đừng xoá lịch sử (sai thì gạch + ghi lý do).

- **Slug:** `m1-tuya-sdk-expansion`

## Quyết định kỹ thuật (Decision log)
- **2026-06-29** — Kế thừa kiến trúc **multi-TurboModule tách theo tính năng** từ [m1-tuya-sdk-library](../m1-tuya-sdk-library/):
  lib = `@jimmy-vu/react-native-turbo-tuya`, java `com.jimmyvu.turbotuya`, codegen `TurboTuyaSpec`, package `TurboTuyaPackage`.
- **2026-06-29** — Mở rộng = **mở rộng module hiện có** (TuyaAuth/TuyaHome/TuyaDevice/TuyaPairing) + **module mới**
  (TuyaOta/TuyaScene/TuyaTimer/TuyaMessage; P3: TuyaMember/TuyaMatter/TuyaMesh). Giữ facade `Tuya` tương thích.
- **2026-06-29** — **TuyaMessage gộp** push + message-center + DND (đề xuất, chờ chốt) thay vì tách TuyaPush riêng.
- **2026-06-29** — **Widget = NGOÀI phạm vi** (UI/extension OS); chỉ thêm `TuyaDevice.getSwitchDps`. Group/multi-control bỏ.
- **2026-06-29** — **Prerequisites** trước mọi thứ: C0 (TuyaErrors + error shape `{code,message,domain}`) + C1 (iOS RCTEventEmitter
  — vì iOS hiện CHƯA bắn event nào). Thứ tự làm = ưu tiên 3 đợt (P1→P3).
- **2026-06-29** — **TuyaScene:** condition/action serialize bằng **builder native trả JSON** (buildXxxCondition/buildXxxAction),
  KHÔNG model hoá trên spec TS (codegen + độ phức tạp).
- **2026-06-29 (B1 — TuyaErrors)** — `src/errors.ts` **thuần JS** (không import 'react-native') để test độc lập + tránh
  throw lúc import. `classify(code, domain='sdk')`; **mã 1004 phân biệt domain** (sdk=pairing_failed+needsNewToken /
  cloud=illegal_client); range 50500–50516 (50502=ssl_clock). **`describe` để SYNC trả `string`** — lệch đề xuất
  `Promise<string>` (không có việc async → sync gọn hơn). Native reject helper (`common/TuyaReject.kt` +
  `ios/Common/TuyaReject.h`) gắn `domain` vào userInfo; **chưa rewire module cũ** (áp dụng dần theo plan). Export
  `TuyaErrors` + types ở `index.tsx`. Unit test `src/__tests__/errors.test.ts` (chạy được khi có node_modules).
- **2026-06-29 (B2 — iOS event infra)** — Tạo lớp cơ sở `ios/Common/TuyaEventEmitter.{h,mm}` (`: RCTEventEmitter`):
  `supportedEvents` (subclass override), `startObserving/stopObserving` → cờ `_hasListeners`, `emit:body:` (chỉ gửi khi
  có listener). `TuyaDevice`/`TuyaPairing` đổi superclass `NSObject`→`TuyaEventEmitter`, **bỏ no-op addListener/
  removeListeners** (kế thừa từ RCTEventEmitter — khớp spec), thêm `supportedEvents` (Device=`onDeviceStatus`;
  Pairing=`onPairingProgress`/`onBleScan`). Giữ `RCT_EXPORT_MODULE()` + `getTurboModule:`. Android không đổi (đã emit
  qua RCTDeviceEventEmitter); JS `index.tsx` không đổi (deviceEmitter/pairingEmitter giữ nguyên). Các module event sau
  (Ota/Auth-session/Home-listener) chỉ cần subclass `TuyaEventEmitter`.
  **⚠️ VERIFY Xcode (new arch):** RCTEventEmitter + TurboModule cùng tồn tại — nếu event không tới JS ở bridgeless mode
  thì fallback sang **codegen EventEmitter type** trong spec.

## Bản đồ file/module (sẽ thêm khi code)
| File / Module | Vai trò |
|---|---|
| `src/errors.ts` (+ `__tests__/errors.test.ts`) | ✅ (B1) TuyaErrors classify/isRetryable/describe + types |
| `common/TuyaReject.kt` · `ios/Common/TuyaReject.h` | ✅ (B1) helper reject `{code,message,domain}` (dùng dần) |
| `ios/Common/TuyaEventEmitter.{h,mm}` | ✅ (B2) base RCTEventEmitter (emit/supportedEvents); Device+Pairing subclass |
| mở rộng `TuyaAuth`/`TuyaDevice`/`TuyaHome`/`TuyaPairing` | (B3/B4/B6/B10/B11) |
| `src/specs/NativeTuyaOta.ts` + `android/.../ota/` + `ios/Ota/` | (B5) module mới TuyaOta |
| `src/specs/NativeTuyaScene.ts` + native | (B7) module mới TuyaScene |
| `src/specs/NativeTuyaTimer.ts` + native | (B8) module mới TuyaTimer |
| `src/specs/NativeTuyaMessage.ts` + native | (B9) module mới TuyaMessage |
| (P3) NativeTuyaMember/Matter/Mesh + native | (B12–B15) |

## Phát hiện & cạm bẫy (Findings / Gotchas)
> Chi tiết + trích dẫn: [docs/research/tuya-home-sdk-full-surface.md](../../docs/research/tuya-home-sdk-full-surface.md) + 11 note.
- **2 thế hệ API song song** (legacy `getXxxInstance`/iOS singleton+delegate vs unified `ActivatorService`/Biz/CoreKit)
  ở Pairing/BLE/Scene/Member → chốt 1 bộ; verify chữ ký trên `tuya.github.io` + header iOS.
- **iOS chưa bắn event** → onDeviceStatus/onPairingProgress/onBleScan im trên iOS; phải dựng RCTEventEmitter (B2).
- **iOS không công bố bảng mã lỗi số** → log error.code thật khi test.
- **dpId/schema bồn tắm đá chưa biết** → cần thiết bị thật + productId (chặn snapshot/scene/timer).
- **publishDps.onSuccess = đã gửi** → publishDpsAwaitAck / nghe onDpUpdate.
- Pairing token 10 phút + chết sau 1 pair → auto-token retry khi -55/-56/-57/-33/1004 (B11).

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Tiền đề: [m1-tuya-sdk-library](../m1-tuya-sdk-library/)
- Research: [tuya-home-sdk-full-surface.md](../../docs/research/tuya-home-sdk-full-surface.md) + `docs/research/tuya-home-sdk-*.md`

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
