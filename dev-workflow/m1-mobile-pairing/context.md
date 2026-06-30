# Context: In-app pairing (Wi-Fi + Bluetooth) — mobile

- **Slug:** `m1-mobile-pairing`
- **Liên kết → Research:** [device-pairing](../../docs/research/tuya-home-sdk-device-pairing.md) · [bluetooth](../../docs/research/tuya-home-sdk-bluetooth.md) · [foundation](../../docs/research/tuya-m1-sdk-foundation.md)

## Quyết định kỹ thuật (Decision log)
- **2026-06-30** — Pairing dùng method **auto-token** (`startWifiPairingAuto`/`startBleWifiPairing`) để khỏi tự quản token 10 phút.
- **2026-06-30** — Adapter pairing theo cùng pattern B6: `require` try/catch + **mock fallback** (UI flow test được trong Metro chưa build native).
- **2026-06-30** — `devId` sau pair lưu **AsyncStorage** (`deviceStore`) → `useAppState` đọc lúc mount (lấp `DEVICE_ID=''` của B6).
- **2026-06-30** — Login/Home thật là **upstream** (auth/home-setup chưa làm) → tạm `ensureHome()` (getHomeList→createHome) + giả định đã login; thay khi có 2 feature kia.
- **2026-06-30 (B3/B4)** — `PairingScreen` thu `ssid`/`pwd` ở bước `choose` (cả Wi-Fi EZ lẫn combo BLE+Wi-Fi đều cần). Nhánh BLE = **combo** `pairBleWifi` (ice-bath nhiều khả năng dual-mode); single `startBlePairing` để dự phòng sau. `connectDevice(id?)` của `useAppState` nhận devId từ pairing (persist + set state + đọc snapshot + subscribe). Home/OnboardDevice nút connect → `navigate('pairing')` (không còn mock connect).

## Bản đồ file/module (sẽ thêm khi code)
| File | Vai trò |
|---|---|
| `apps/mobile/src/services/pairing.ts` | (B1) adapter pairing + ensureHome + mock |
| `apps/mobile/src/services/deviceStore.ts` | (B2) lưu/đọc devId (AsyncStorage) |
| `apps/mobile/src/screens/PairingScreen.tsx` | (B3) state machine choose→form/scan→progress→success/error |
| `apps/mobile/src/navigation.ts` | (B3) +`'pairing'` |
| `apps/mobile/App.tsx` | (B3) router case pairing |
| `apps/mobile/src/screens/onboarding/OnboardDeviceScreen.tsx` | (B3) "Pair now" → pairing |
| `apps/mobile/src/screens/HomeScreen.tsx` | (B3) connect → pairing |
| `apps/mobile/src/state/useAppState.ts` | (B2/B4) devId từ store + connect sau pair |
| `apps/mobile/src/services/tuya.ts` | (B6 đã có) device adapter — pairing dùng chung lib |

## Liên kết → Audit
- **2026-06-30** — [docs/audit/2026-06-30-mobile.md](../../docs/audit/2026-06-30-mobile.md): 🔴1 🟠3 🟡5 🔵2. Liên quan pairing:
  H-1 Android thiếu permission BLE/Location · H-2 iOS usage string Location rỗng + thiếu BLE/LocalNetwork · M-3 thiếu AP fallback
  · M-5 thiếu timeout JS pairing. (H-3 DP-id placeholder + C-1 secret là cross-feature.) → feed `/fix-plan` khi wire native.

## Phát hiện & cạm bẫy
- App standalone (không root workspace); lib nối qua `file:` dep + metro (B6).
- `getEnforcing` crash khi chưa build native → bắt buộc mock.
- Tiền đề Tuya: login + homeId + Owner + Wi-Fi 2.4GHz + token 10'; BLE cần permission native.
- DP schema bồn thật chưa có → sau pair, điều khiển dùng dp-id placeholder (`services/dp.ts`).
