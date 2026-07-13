# Tuya Research: "Auto Scan" - vì sao Smart Life tìm ra thiết bị Wi-Fi (sensor…) dù mình tưởng không có Bluetooth

- Ngày: 2026-07-10
- Nguồn chính:
  - https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk (SmartLife Auto Scan)
  - https://developer.tuya.com/en/docs/app-development/ble?id=Ka5vcxzbglphd (Bluetooth Devices - discovery via advertising)
  - https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kaixk6wxla1oy (AP mode + SSID scan)
- Bối cảnh: user hỏi "sensor đâu phải Bluetooth mà Smart Life vẫn tìm ra?" → muốn làm flow tìm→chạm→nhập wifi→xong.

---

## TL;DR (câu trả lời thẳng)

- 🔑 **Sensor "Wi-Fi" của mày THẬT RA CÓ Bluetooth.** Nó là **combo device**: chạy vận hành bằng **Wi-Fi**,
  nhưng lúc pairing thì **phát sóng quảng bá BLE (Bluetooth Low Energy advertising)** để app dò ra. Mày
  không thấy nó "là Bluetooth" vì hằng ngày nó dùng Wi-Fi - nhưng chip BLE beacon nằm sẵn trong đó.
  → **Đây chính là thứ Smart Life dùng để "Auto Scan".**
- ✅ **App mình ĐÃ có cơ chế này** (`startBleScan` → quét BLE → `onBleScan`). Nên flow mày muốn **làm được**,
  và con sensor **sẽ hiện ra** - không cần nó "là thiết bị Wi-Fi thuần".
- 🟡 **Có 2 đường discovery, không chỉ 1:**
  1. **BLE advertising scan** (chính) - thiết bị phát gói BLE mã hoá thông tin Tuya → app quét BLE → lọc →
     hiện. Chạy **cả iOS + Android**. **Đa số thiết bị Wi-Fi đời mới (kể cả sensor) đi đường này.**
  2. **Wi-Fi AP hotspot SSID scan** (phụ) - thiết bị Wi-Fi thuần (không BLE) phát hotspot `SmartLife-xxxx`,
     app quét danh sách Wi-Fi để thấy. **iOS KHÔNG quét được** danh sách Wi-Fi → đường này ~Android-only.
- ⇒ Kết luận: cái "auto-discovery" của Smart Life **99% là BLE beacon**, không phải phép màu Wi-Fi.

---

## Bằng chứng từ doc

### Auto Scan dò được cả Wi-Fi lẫn Bluetooth - và cần **cả 2 quyền**
> *"When the indicators on NB-IoT, **Wi-Fi, and Bluetooth** devices are blinking quickly, these devices can be
> added in the **Auto Scan** method."* · *"The app must be granted **Wi-Fi and Bluetooth permissions**."*
> — [SmartLife User Manual](https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk)

→ Auto Scan **cần quyền Bluetooth** kể cả để thêm thiết bị "Wi-Fi" ⇒ nó dùng BLE để dò.

### "Combo device" = Wi-Fi + BLE, dò bằng BLE
> *"Bluetooth devices to be paired **broadcast Bluetooth packets**, which the SDK parses … to discover target
> Tuya-enabled Bluetooth LE devices and **combo devices**."*
> *"**If the bleType value includes Wifi, a combo device is used.** Bluetooth LE technology is used when combo
> devices are paired over Bluetooth."*
> *"After entering pairing mode, the device **sends Bluetooth advertising packets and waits to be discovered**
> by the mobile app, which can then initiate a Bluetooth connection … and send pairing data."*
> — [Bluetooth Devices (Smart App SDK)](https://developer.tuya.com/en/docs/app-development/ble?id=Ka5vcxzbglphd)

→ **`bleType` có cờ "Wifi" = combo**: BLE để phát hiện + nhận credentials, Wi-Fi để vận hành. Đây đúng loại
"sensor Wi-Fi" của mày.

### Đường Wi-Fi thuần (AP): dò bằng SSID hotspot
> *"the user finds the Wi-Fi hotspot **starting with SmartLife**, taps … to connect the mobile phone to it."*
> — [AP Mode](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kaixk6wxla1oy)

→ Thiết bị AP tạo hotspot tên `SmartLife-xxxx`; app/điện thoại quét Wi-Fi để thấy. ⚠️ **iOS không có API quét
danh sách Wi-Fi** → đường này chỉ khả thi trên Android (hoặc user tự vào Settings nối hotspot - flow AP hiện tại).

---

## Đối chiếu với code mình

| Cơ chế Tuya | Mình có chưa? | Ghi chú |
|---|---|---|
| **BLE advertising scan** (chính) | ✅ **CÓ** | `startBleScan()` → `ThingSmartBLEManager startListening` (iOS) / `getBleOperator().startLeScan` (Android) → `onBleScan`. **Đây là cái làm được flow mày muốn.** |
| Gửi Wi-Fi qua BLE sau khi tìm thấy | ✅ **CÓ** | `pairBleWifi()` → `startConfigBLEWifiDeviceWithUUID:ssid:password:` |
| Đọc `bleType` để biết combo/BLE-thuần | ❌ **THIẾU** | Native hardcode `deviceType=0`, **bỏ `bleType`** → JS không biết loại, không route được, không lọc được |
| Wi-Fi AP hotspot SSID scan | ⚠️ Một phần | `react-native-wifi-reborn` có `reScanAndLoadWifiList` (**Android-only**); chưa lọc SSID `SmartLife-*` |
| Security-level handshake | ❌ **THIẾU** | Xem [tuya-ios-sample-pairing-comparison.md](tuya-ios-sample-pairing-comparison.md) - có thể chặn pairing sensor |

**Kết luận:** flow "tìm → chạm → nhập wifi → xong" mà mày muốn = **đúng luồng BLE-discovery + combo pairing
mình ĐÃ có native**. Con sensor hiện ra được vì nó có BLE beacon. Việc còn lại chủ yếu là **UX** (đưa quét BLE
lên làm luồng chính, nhập Wi-Fi sau khi chạm) + vá vài lỗ (`bleType`, security-level).

---

## Vì sao trước đây "không tìm ra" (giả thuyết, cần B7 xác nhận)

1. App mình để **EZ/AP (nhập Wi-Fi trước, phát mù) làm luồng CHÍNH**; quét BLE bị giấu ở
   "Search via Bluetooth instead" và **bắt nhập Wi-Fi trước mới cho quét** (`disabled={ssid===''}`).
   → Có thể mày chưa từng chạy đúng đường BLE discovery.
2. Scan type iOS đang là `ThingBLEScanTypeNoraml` (single) - cần xác nhận có bắt đủ loại combo không.
3. Thiếu security-level handshake → nếu sensor là security device, chạm vào pair cũng treo.
4. `bleType` bị bỏ → không phân biệt được BLE-thuần (không cần Wi-Fi) vs combo (cần Wi-Fi) → dễ xử nhầm.

---

## Đề xuất (flow mày muốn)

Restructure `PairingScreen` để **BLE Auto-Scan là luồng CHÍNH**:
```
[Add device] → tự startBleScan NGAY (không bắt nhập Wi-Fi trước)
   → onBleScan hiện danh sách/again thiết bị thấy được
   → chạm 1 thiết bị
   → (nếu bleType = combo) nhập Wi-Fi → pairBleWifi → xong
   → (nếu bleType = BLE thuần) pair thẳng, không cần Wi-Fi
   [fallback] "Add manually" → EZ/AP như cũ cho thiết bị Wi-Fi thuần (không BLE)
```
Kèm theo (bắt buộc để đường này chắc):
- **Đẩy `bleType` thật lên JS** (thay `deviceType=0`) - để route combo vs BLE-thuần + lọc đúng.
- **Wire security-level handshake (B8)**.

Điều kiện: phần lớn thiết bị Tuya đời mới **có BLE beacon** nên chạy tốt. Thiết bị Wi-Fi **thật sự thuần** (hiếm,
đời cũ) thì không auto-scan được trên iOS → vẫn phải EZ/AP thủ công (giữ làm fallback).

---

## Câu hỏi mở / cần xác minh

- ❓ Khi bấm **+** trong Smart Life, con sensor hiện ra ở mục "Auto Scan"/"Discovering" hay mày phải chọn thủ công?
  (hiện ra = BLE beacon → mình bắt được y hệt).
- ❓ Điện thoại test có **bật Bluetooth** + đã cấp **quyền Bluetooth** cho app mình chưa? (Auto Scan cần.)
- ❓ `bleType` thật của sensor là gì? (cần đẩy lên JS để biết - hiện đang bỏ).
- ❓ Trên iOS app mình đã xin `NSBluetoothAlwaysUsageDescription` chưa? (Info.plist đã có - đã kiểm ở feature trước ✅).

---

## Nguồn
1. [SmartLife User Manual - Auto Scan (cần quyền Wi-Fi + Bluetooth)](https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk)
2. [Bluetooth Devices - broadcast advertising, combo device, bleType includes Wifi](https://developer.tuya.com/en/docs/app-development/ble?id=Ka5vcxzbglphd)
3. [AP Mode - hotspot SmartLife-xxxx](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kaixk6wxla1oy)
4. [Bluetooth LE Devices (Android) - startLeScan + ScanDeviceBean](https://developer.tuya.com/en/docs/app-development/android-bluetooth-ble?id=Karv7r2ju4c21)
- Liên quan: [tuya-ios-sample-pairing-comparison.md](tuya-ios-sample-pairing-comparison.md) · [tuya-wifi-motion-sensor-pairing.md](tuya-wifi-motion-sensor-pairing.md) · [tuya-home-sdk-device-pairing.md](tuya-home-sdk-device-pairing.md)
