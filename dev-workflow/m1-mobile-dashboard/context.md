# Context: Mobile Dashboard — điều khiển bồn realtime

> File "trí nhớ" — giữ context xuyên suốt các phiên. Mọi quyết định, phát hiện, cạm bẫy ghi vào đây.
> Append theo thời gian, đừng xoá lịch sử (sai thì gạch đi + ghi lý do).

- **Slug:** `m1-mobile-dashboard`

## Quyết định kỹ thuật (Decision log)
- **2026-06-30 (PLAN → Gate ①)** — ~~Dashboard giữ trong HomeScreen~~ → **user chọn TÁCH `DashboardScreen`
  riêng**. Hệ quả: thêm `'dashboard'` vào `ScreenName` (`navigation.ts`) + route trong `App.tsx`; chuyển device
  control từ `HomeScreen` sang Dashboard, Home giữ summary gọn + nút "Open dashboard →". B5 phải test điều hướng.
- **2026-06-30 (Gate ①)** — Realtime **chỉ qua SDK MQTT** (`onDeviceStatus`), **không** backend. Cleaning
  scheduler **tách feature riêng** (giữ panel local hiện tại, không nối Tuya Timer trong feature này).
- **2026-06-30 (DEV) — SCALE:** giữ MỌI giá trị nhiệt ở **đơn vị RAW** trong state/clamp/publish (đồng nhất với dp
  value + `buildTempDps`), chỉ chia `10^scale` lúc **hiển thị** (`formatTemp`). Lý do: nếu chia scale sớm cho range
  nhưng dp value vẫn raw → lệch. `tempRange.{min,max,step}` = raw; `tempRange.scale/unit` = metadata hiển thị.
- **2026-06-30 (DEV) — B2 tái dùng:** `m1-mobile-pairing` đã tạo `services/deviceStore.ts` (AsyncStorage) + sửa
  `useAppState` đọc devId lúc mount. Dashboard **tái dùng nguyên** (không tạo store trùng) → B2 coi như xong.
- **2026-06-30 (DEV) — reducer init `status:'online'`:** giữ UX cũ của UI clone (mặc định coi như đã có thiết bị
  mock 12/6) → `deviceConnected = status!=='idle'` vẫn true lúc mount. Khi pair thật, connectDevice ghi đè bằng snapshot.
- **2026-06-30 (DEV B7) — TÁI DÙNG lib `TuyaErrors`:** lib đã export sẵn classifier `TuyaErrors` (classify/describe,
  message tiếng Việt + cờ retryable, bảng tĩnh JS-only). `services/tuyaError.ts` chỉ là **wrapper mỏng** (trích code từ
  reject + bỏ tiền tố `[domain:code]`), KHÔNG bịa bảng riêng. Lấy qua `require` try/catch (lib import tĩnh = crash JS-only);
  cho **inject classifier** để test (vì lib không load được trong jest/native vắng).
- **2026-06-30 (DEV B9) — M-3 chặn re-render tại NGUỒN, không memo:** thay vì `React.memo(DeviceCard)` (vô hiệu vì prop
  `state` đổi ref mỗi render — App spread `{...appState, isDark}`), cho `deviceReducer.dpPatch` **diff → trả CÙNG ref** khi
  echo không đổi → `useReducer` bỏ re-render ngay từ gốc. Đã loại memo (cần tách prop primitive cho cả app — over-scope).
- **2026-06-30 (FIX-PLAN sau audit)** — Thêm **B7–B9** vào plan từ finding audit (`docs/audit/2026-06-30-m1-mobile-dashboard.md`):
  B7 = error observability (H-1: bỏ empty-catch, log+map mã lỗi Tuya → thông điệp phân biệt); B8 = debounce publish target
  + timeout đọc snapshot (M-1/M-2); B9 = throttle DP patch + memo DeviceCard + clear setInterval CleaningPanel (M-3/M-4).
  +AC8/AC9. **Lý do:** code B1–B6 chạy nhưng audit lộ gap robustness/observability + 1 leak — sửa được ngay không cần
  thiết bị. **H-2 (DP schema thật) KHÔNG thành bước** (chờ client) — giữ ở Rủi ro. Nit L-1/L-2/L-3 đẩy backlog.
- **2026-06-30 (PLAN)** — Tiêu thụ `devId` từ **`services/deviceStore.ts` (seam)** thay vì hardcode `''` trong
  `useAppState`. Lý do: tách dashboard khỏi pairing — pairing (`m1-mobile-pairing`) sẽ điền store; dashboard chạy
  mock khi store rỗng. Đã loại: chờ pairing xong mới làm dashboard (block không cần thiết).
- **2026-06-30 (PLAN) — ĐIỀU PHỐI:** `m1-mobile-pairing` vừa được plan song song, **lưu `devId` vào AsyncStorage**
  (B2 của pairing). ⇒ `deviceStore.ts` của dashboard phải **đọc/ghi cùng key AsyncStorage đó** (không tạo nguồn
  trùng). Khi `/dev` B2: kiểm tra plan/context của `m1-mobile-pairing` để dùng đúng tên key + chữ ký; deviceStore
  chỉ là lớp subscribe/cache mỏng quanh key chung. Nếu pairing chưa định nghĩa key → dashboard định nghĩa và pairing dùng lại.
- **2026-06-30 (PLAN)** — Tách **reducer thuần `state/deviceMachine.ts`** (ConnStatus + reconcile) để **test bằng
  jest** không cần native/thiết bị. Lý do: máy đang bị chặn build native → pure-logic là cách duy nhất verify được.
- **2026-06-30 (PLAN)** — Set nhiệt dùng **`publishDpsAwaitAck`** (lib đã có) thay `publishDps` fire-and-forget, để
  hiện **pending → confirmed** đúng cạm bẫy Tuya "`onSuccess` ≠ đổi xong". Revert nếu không ack trong timeout.
- **2026-06-30 (PLAN)** — UI giới hạn target theo **schema (min/max/step/scale/unit)** parse từ `schemaJson` của
  snapshot, **fallback** range mặc định (-3..12) khi thiếu schema. Lý do: tránh hardcode biên sai khi có thiết bị thật.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/tuya.ts` | Adapter Tuya (require+mock). **Sửa:** `readDevice` trả thêm `isOnline`+`tempRange`; `listenDevice` forward `isOnline`; `setTargetTemp` dùng `publishDpsAwaitAck` |
| `apps/mobile/src/services/dp.ts` | Hằng DP-id (placeholder) + parse/build dps — tái dùng |
| `apps/mobile/src/services/deviceSchema.ts` | **MỚI (B1)** parse `schemaJson` → `tempRange{min,max,step,scale,unit}` + kiểu DP |
| `apps/mobile/src/services/deviceStore.ts` | **MỚI (B2)** nguồn `devId` dùng chung (get/set/subscribe); pairing điền sau |
| `apps/mobile/src/state/deviceMachine.ts` | **MỚI (B3/B4/B9)** reducer thuần: ConnStatus + loading/error + reconcile optimistic/ack + dpPatch diff |
| `apps/mobile/src/services/tuyaError.ts` | **MỚI (B7)** wrapper quanh `TuyaErrors` lib → mã lỗi + message phân biệt (tiếng Việt) |
| `apps/mobile/src/lib/debounce.ts` | **MỚI (B8)** debounce trailing thuần (gộp publish target) |
| `apps/mobile/src/state/useAppState.ts` | **Sửa:** đọc devId từ store; nối deviceMachine; vẫn giữ chữ ký return cho screens |
| `apps/mobile/src/components/DeviceCard.tsx` | **MỚI (B5)** card thiết bị + status/loading/error/bounds (đặt trong DashboardScreen) |
| `apps/mobile/src/components/StatusPill.tsx` | **MỚI (B5)** chip online/offline/connecting/error |
| `apps/mobile/src/components/CleaningPanel.tsx` | **MỚI (B5)** panel lịch vệ sinh local (chuyển nguyên từ Home; chưa nối Tuya Timer — feature riêng) |
| `apps/mobile/src/screens/DashboardScreen.tsx` | **MỚI (B5)** màn dashboard riêng — chứa DeviceCard + cleaning panel chuyển từ Home |
| `apps/mobile/src/navigation.ts` | **Sửa (B5):** thêm `'dashboard'` vào `ScreenName` |
| `apps/mobile/App.tsx` | **Sửa (B5):** thêm route `dashboard` vào router switch |
| `apps/mobile/src/screens/HomeScreen.tsx` | **Sửa (B5):** chuyển device control sang Dashboard; giữ summary gọn + nút "Open dashboard →" |
| `packages/tuya-react-native/src/specs/NativeTuyaDevice.ts` | (chỉ đọc) nguồn sự thật API: snapshot+schema+ack |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- Lib **đã có đủ** API cần: `getDeviceSnapshot` (kèm `isOnline`/`isLocalOnline`/`schemaJson`/`dpCodesJson`),
  `isDeviceOnline`, `isCloudConnected`, `publishDpsAwaitAck`. Event `onDeviceStatus{devId,isOnline?,dpsJson?}`
  mang **cả** online/offline lẫn DP update → 1 listener đủ cho cả status + realtime DP.
- Adapter app hiện tại **bỏ phí** `isOnline`/`schemaJson` (chỉ đọc `dpsJson`) và publish fire-and-forget → đây là
  phần chính cần nâng.
- **Cạm bẫy Tuya:** `onSuccess` của publish chỉ = "đã gửi lên cloud", **chưa** đổi DP → chỉ confirm khi
  `onDpUpdate`/event echo về. Dùng `publishDpsAwaitAck` + reconcile timeout.
- **Online 2 mức:** `isOnline` = LAN **hoặc** cloud; `isLocalOnline` = chỉ LAN. UI hiển thị theo `isOnline`.
- **DP id/scale placeholder** ở `dp.ts` — chưa có schema thật của bồn; B1 viết schema-driven, AC6 cần schema thật.
- ✅ **(ĐÃ GỠ)** module `apps/mobile/src/lib/format` từng **thiếu trên đĩa** (Read/Glob/Grep xác nhận; `apps/mobile`
  untracked nên không restore từ git) → App + Home/Splash/OnboardWelcome/Session không compile. **Đã khôi phục nguyên
  bản** từ `replit_generate/App.js`: `LOGO_URI`/`LOGO_URI_LIGHT` (Dropbox ?dl=1) + `formatTime(s)='mm:ss'`. KHÔNG do dashboard.
- **readDevice rethrow:** chỉ MOCK khi native vắng/devId rỗng; lỗi đọc THẬT thì throw → `connectError` (cho AC3).
  `setTargetTemp` trả `boolean` (ack) thay vì void → reducer ackResolved/ackTimeout.

## Audit (2026-06-30)
- Báo cáo: [docs/audit/2026-06-30-m1-mobile-dashboard.md](../../docs/audit/2026-06-30-m1-mobile-dashboard.md) — 🔴0 🟠2 🟡4 🔵3.
- **Follow-up (feed `/fix-plan`):** H-1 adapter log+map error code (lib `errors.ts`) + thông báo phân biệt region/owner/offline;
  H-2 cắm DP schema thật (chờ client); M-1 debounce publish target +/-; M-2 timeout `readDevice`; M-3 throttle DP patch +
  memo DeviceCard; M-4 clear `setInterval` CleaningPanel khi unmount. ĐẠT: optimistic-reconcile, listener cleanup, không secret.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Research: [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md) ·
  [tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md)
- Feature liền kề: [m1-mobile-scaffold](../m1-mobile-scaffold/) (đã nối lib, B6) ·
  `m1-mobile-pairing` (chưa plan — sẽ cấp `devId` thật cho deviceStore)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
