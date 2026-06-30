# Kế hoạch: In-app pairing (Wi-Fi EZ/AP + Bluetooth) cho mobile

> File này do `/plan` tạo, `/fix-plan` chỉnh. Nguồn sự thật "định làm gì".

- **Slug:** `m1-mobile-pairing`
- **Milestone:** M1 — Part B4 (mobile)
- **Phần liên quan:** mobile (RN CLI `apps/mobile`) — dùng lib `@jimmy-vu/react-native-turbo-tuya` (đã nối ở B6).
- **Ngày tạo:** 2026-06-30
- **Research liên kết:** [device-pairing](../../docs/research/tuya-home-sdk-device-pairing.md) · [bluetooth](../../docs/research/tuya-home-sdk-bluetooth.md) · [foundation EZ/AP+token](../../docs/research/tuya-m1-sdk-foundation.md)

## 1. Mục tiêu & phạm vi
Màn **ghép nối thiết bị trong app**: chọn cách (Wi-Fi EZ/AP **hoặc** Bluetooth) → nhập/scan → hiển thị
**tiến trình + loading + lỗi** → thành công thì **lưu `devId`** để dashboard điều khiển. Lấp `DEVICE_ID=''`
placeholder mà B6 để lại (devId thật từ pairing).

**Trong phạm vi:**
- Adapter pairing (mở rộng `services/`): token, Wi-Fi EZ/AP (auto-token), BLE scan + pair, combo BLE+Wi-Fi, sự kiện tiến trình/scan — **có mock fallback** (chạy được trong Metro khi chưa build native).
- Lưu `devId` đã pair (AsyncStorage) → `useAppState` đọc lúc mở app.
- UI: `PairingScreen` (state machine: choose → form/scan → progress → success/error + retry) + nối router từ `OnboardDeviceScreen` "Pair now" và nút connect ở `HomeScreen`.

**Ngoài phạm vi:**
- Pairing nâng cao (sub-device/gateway/QR/wired/Matter/Mesh) — lib có nhưng không cần cho ice-bath.
- Đăng nhập thật (`m1-mobile-auth`) + tạo Home thật (`m1-mobile-home-setup`) — **là upstream**; plan này dùng `ensureHome()` tạm + giả định đã login (xem Rủi ro).
- Native build/permission BLE + verify trên thiết bị (toolchain) — hoãn.

## 2. Bối cảnh & ràng buộc
- **Tiền đề pairing (Tuya):** đã login + có `homeId` + tài khoản là **Owner** của Home. Token sống **10 phút, chết sau 1 device** → dùng method **auto-token** (`startWifiPairingAuto`/`startBleWifiPairing` tự lấy token).
- **Wi-Fi chỉ 2.4GHz** cho EZ/AP. **BLE** cần quyền (Android 12+ runtime + iOS Info.plist) — native, hoãn.
- **Data Center SDK = Cloud Project** (Central/Western Europe) — đã cố định ở lib (native config).
- **getEnforcing crash khi chưa build native** → adapter `require` try/catch + mock (như B6).
- RN CLI (không Expo); router tự viết (`navigation.ts`); không thêm react-navigation.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
- [ ] AC1: `services/pairing.ts` expose getPairingToken/startWifiPairing(+Auto)/stopWifiPairing/startBleScan/stopBleScan/startBlePairing/startBleWifiPairing/stopBleWifiPairing + `onPairingProgress`/`onBleScan` + `ensureHome()`; **mock fallback** khi native vắng; `tsc` pass.
- [ ] AC2: `services/deviceStore.ts` (AsyncStorage) lưu/đọc/xoá `devId`; `useAppState` đọc `devId` đã lưu lúc mount (thay const `DEVICE_ID=''`); `tsc` pass.
- [ ] AC3: `PairingScreen` chạy state machine **choose → (Wi-Fi form | BLE scan list) → progress → success/error + retry**; routed từ `OnboardDeviceScreen` "Pair now" + `HomeScreen` connect; `tsc`/`jest` pass.
- [ ] AC4: Pair thành công → lưu `devId` + `HomeScreen` hiển thị/điều khiển thiết bị vừa pair (currentTemp/target/light qua Tuya); lỗi → `TuyaErrors` phân loại + nút thử lại; `tsc` pass.
- [ ] AC5 (device): pair thật EZ + BLE trên thiết bị round-trip → ⏳ **chờ build native + thiết bị + Wi-Fi 2.4 + DP schema**.

## 4. Các bước thực hiện
1. **B1 — Adapter pairing + ensureHome** (`services/pairing.ts`, có thể `services/home.ts`)
   - Wrap `Tuya.getPairingToken/startWifiPairing/startWifiPairingAuto/stopWifiPairing/startBleScan/stopBleScan/startBlePairing/startBleWifiPairing/stopBleWifiPairing` + `onPairingProgress`/`onBleScan`; `ensureHome()` = `getHomeList()` → `createHome()` nếu rỗng → trả `homeId`.
   - **Mock fallback:** native vắng → `ensureHome` trả homeId giả; `startWifiPairingAuto` resolve `DeviceResult` giả sau ~1.5s; `startBleScan` emit 1 thiết bị giả qua callback. (để UI test được trong Metro).
   - File: `apps/mobile/src/services/pairing.ts` (+ `home.ts` nếu tách).
   - Test: `tsc`; jest mock-path (deferred env).
2. **B2 — Lưu devId (AsyncStorage)** + nối `useAppState`
   - Thêm dep `@react-native-async-storage/async-storage`; `services/deviceStore.ts` (`getDevId/setDevId/clearDevId`); `useAppState`: bỏ const `DEVICE_ID=''`, đọc `devId` từ store (state) lúc mount, `connectDevice` dùng devId đó.
   - File: `apps/mobile/package.json`, `src/services/deviceStore.ts`, `src/state/useAppState.ts`.
   - Test: `tsc`.
3. **B3 — PairingScreen + router**
   - `src/screens/PairingScreen.tsx`: step `choose` (Wi-Fi/BLE) → `wifi` (form ssid/pwd, gọi `startWifiPairingAuto`) | `ble` (nút scan → list `onBleScan` → chọn → `startBleWifiPairing`/`startBlePairing`) → `progress` (lắng `onPairingProgress`) → `success`/`error`. Dùng components sẵn (PrimaryButton/GhostButton) + theme.
   - `navigation.ts` +`'pairing'`; `App.tsx` thêm case + truyền `state`; `OnboardDeviceScreen` "Pair now" → `navigate('pairing')`; `HomeScreen` connect → `navigate('pairing')`.
   - File: `PairingScreen.tsx`, `navigation.ts`, `App.tsx`, `OnboardDeviceScreen.tsx`, `HomeScreen.tsx`.
   - Test: `tsc` + `jest`.
4. **B4 — Success → state + dashboard + lỗi**
   - Pair OK → `setDevId(result.devId)` (store) + `state.connectDevice()` (đọc snapshot + listen) → quay `home`. Lỗi → `TuyaErrors.describe(code)` + "Thử lại". Cleanup listener `onPairingProgress/onBleScan` + `stop*Pairing` khi rời màn.
   - File: `PairingScreen.tsx`, `useAppState.ts`.
   - Test: `tsc` + `jest`.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Upstream chưa có:** login thật (`m1-mobile-auth`) + Home thật (`m1-mobile-home-setup`). Plan dùng `ensureHome()` tạm + **giả định đã login**; nếu chưa login → pairing sẽ lỗi (Tuya reject) → hiển thị lỗi + gợi ý onboarding. Khi làm auth/home thì thay `ensureHome` bằng homeId thật.
- ⚠️ **Token 10' + 2.4GHz + BLE permission + getEnforcing** → method auto-token; mock cho dev; permission + build native hoãn.
- ⚠️ **AsyncStorage** = native dep (autolink) → verify khi build.
- ❓ **BLE pairing dùng combo hay single?** Ice-bath nhiều khả năng Wi-Fi hoặc combo BLE+Wi-Fi → ưu tiên `startBleWifiPairing` (cần ssid/pwd) cho nhánh BLE; `startBlePairing` (single, không Wi-Fi) để dự phòng. Chốt khi có thiết bị thật.
- ❓ **DP schema thật** (đã nêu ở B6) — sau pair, dashboard cần dp-id đúng để điều khiển.
- ⚠️ Native build/verify hoãn (toolchain) → AC5 deferred; các AC khác = `tsc`/`jest` (chạy khi có node_modules + mạng).
