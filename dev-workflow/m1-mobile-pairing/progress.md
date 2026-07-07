# Progress: In-app pairing (Wi-Fi + Bluetooth) - mobile

> State machine của feature. `/dev` `/test` `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.

- **Slug:** `m1-mobile-pairing`
- **Phase hiện tại:** `DEV` (B1–B4 code XONG)
- **Trạng thái:** `in_progress` (code-complete; AC5 device deferred)
- **Cập nhật lần cuối:** 2026-06-30

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **B1–B4 code XONG** - pairing adapter + deviceStore + PairingScreen + router + success→dashboard. Type-review OK;
`tsc`/`jest` **deferred** (apps/mobile chưa `npm i` + nexus 503).
**Còn lại:**
1. ⏳ **AC5 device round-trip** (pair EZ/BLE thật) - chờ `yarn install` (lib + AsyncStorage) + build native + thiết bị + Wi-Fi 2.4 + DP schema.
2. **Upstream** thay `ensureHome()` tạm bằng homeId thật khi có `m1-mobile-auth` + `m1-mobile-home-setup`.
3. Track mobile tiếp: `m1-mobile-dashboard` (đã có plan) tiêu thụ devId đã pair.
⚠️ Khi có mạng: `yarn install` ở apps/mobile → `tsc`+`jest` xác nhận.

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 - Adapter pairing + ensureHome (`services/pairing.ts`) + mock · **done**
- [x] B2 - Lưu devId AsyncStorage (`deviceStore.ts`) + nối `useAppState` (devId state + connectDevice(id?)) · **done**
- [x] B3 - `PairingScreen` (state machine choose→wifi/ble→progress→success/error) + router (navigation/App/OnboardDevice/Home) · **done**
- [x] B4 - Success → `connectDevice(devId)` + lỗi `describeError` (TuyaErrors lib) + cleanup sub/stop · **done**

## Checklist AC (đồng bộ plan mục 3)
- [◑] AC1 - adapter pairing + events + ensureHome + mock · code XONG (tsc deferred)
- [◑] AC2 - deviceStore lưu devId + useAppState đọc · code XONG (tsc deferred)
- [◑] AC3 - PairingScreen flow + router · code XONG (tsc/jest deferred)
- [◑] AC4 - success→dashboard + lỗi phân loại · code XONG (tsc deferred)
- [ ] AC5 - device round-trip thật (EZ+BLE) · ⏳ deferred (build+thiết bị+DP schema)

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-30 | DEV+TEST B1–B4 | ✅ code / ⏳ verify | **B1** `services/pairing.ts` (require try/catch + **mock**: ensureHome/pairWifi(EZ auto-token)/startBleScan/pairBleWifi/stop*/onPairingProgress/onBleScan/describeError; mock emit progress+BLE để UI test). **B2** `services/deviceStore.ts` (AsyncStorage get/set/clear, try/catch) + dep `@react-native-async-storage/async-storage` + `useAppState`: bỏ const DEVICE_ID, thêm `devId` state + load lúc mount + `connectDevice(id?)` persist, toggleLight/setTargetTemp/listener dùng devId, expose `devId`. **B3** `PairingScreen.tsx` (choose[ssid/pwd] → Wi-Fi EZ / BLE scan list → progress → success/error + retry) + router (`navigation.ts` +'pairing', `App.tsx` case, OnboardDevice "Pair now"→pairing, Home connect→pairing). **B4** success→`state.connectDevice(devId)`→home; lỗi→`describeError` (TuyaErrors lib); cleanup sub+stop khi unmount. **TEST:** `tsc`/`jest` deferred (apps/mobile chưa npm i + nexus 503) → type-review OK. ⚠️ verify: AsyncStorage/lib resolve khi install; BLE combo vs single; DP schema. |
| 2026-06-30 | PLAN | ✅ | Tạo plan/context/progress + INDEX. Dựa research device-pairing/bluetooth/foundation + lib pairing surface (đã có) + adapter B6. 4 bước. Chưa code. |

## Vấn đề đang chặn (Blockers)
- Upstream: login + Home thật chưa có → tạm `ensureHome` + giả định login.
- Native build (JDK17+SDK/Xcode) + thiết bị + Wi-Fi 2.4 + DP schema → AC5 deferred.
- node_modules + registry (nexus 503) → `tsc`/`jest` chạy khi có mạng.
