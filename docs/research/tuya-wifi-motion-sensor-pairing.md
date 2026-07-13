# Tuya Research: Vì sao pair cảm biến chuyển động (motion sensor) mãi không được

- Ngày: 2026-07-10
- Nguồn chính:
  - https://developer.tuya.com/en/docs/connect-subdevices-to-gateways/tuya-pir-sensor?id=K9ik6zvn49x5m (PIR sensor = Zigbee sub-device)
  - https://developer.tuya.com/en/docs/iot/wifi-module-mcu-development-overview?id=K9eor8kzjbrrn (Wi-Fi Low-Power Device Solution)
  - https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9 (EZ mode)
  - https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha (AP mode)
- Bối cảnh: nối tiếp bug `m1-fix-wifi-pairing`. Đây là **thiết bị khác** con ice tub - cần biết trước
  khi đổ công vào debug: có khi app **về bản chất chưa pair được** loại này.

---

## TL;DR (đọc cái này trước)

- 🔴 **Câu hỏi sống-còn: cảm biến của mày là Zigbee hay Wi-Fi thật?** Rất nhiều "motion sensor"
  bán ngoài chợ **KHÔNG phải Wi-Fi** - chúng là **Zigbee, bắt buộc phải có gateway (hub) Tuya**.
  Con PIR tham chiếu của Tuya (**TS0202**) chính là Zigbee sub-device. Nếu của mày là loại này thì:
  - Nó **KHÔNG bao giờ** hiện ra trong luồng pair Wi-Fi (EZ/AP) - sai giao thức.
  - App mình **hiện chưa hỗ trợ** pair sub-device: `startSubDevicePairing` trong lib đang là
    `not_implemented` (cả iOS lẫn Android). ⇒ **về bản chất chưa pair được bằng app này.**
- 🟡 **Nếu là Wi-Fi low-power thật** (PIR chạy pin, quảng cáo "Wi-Fi"): nó pair được bằng EZ/AP,
  **nhưng** có cạm bẫy riêng: **tự ngủ sau 3 phút** nếu chưa lên cloud → phải giữ nó thức + pair nhanh.
- 🔴 **Nếu mày test trên iOS bằng EZ:** dính **đúng** vấn đề entitlement multicast của con ice tub -
  cảm biến cũng sẽ fail. → dùng **AP mode**.
- ✅ **Việc nên làm NGAY (sau khi đã có bản build B1-B6):** thử lại, fail thì bấm **"Copy diagnostics"**.
  Giờ lỗi đã hiện mã Tuya thật thay vì "Unknown error" → nhìn mã là biết đang chết ở đâu.

---

## Cây quyết định (làm theo thứ tự)

```
Cảm biến của mày...
│
├─ Vỏ hộp / app Smart Life ghi cần "hub" / "gateway" / "Zigbee"?
│     └─ CÓ  → là Zigbee sub-device.  ❌ App mình chưa làm được (xem §Zigbee).
│                                        Phải pair qua gateway - tính năng chưa wire.
│
├─ Pin (battery) và quảng cáo "Wi-Fi" trực tiếp (không cần hub)?
│     └─ CÓ  → Wi-Fi low-power.  ⚠️ Pair được nhưng khó (xem §Wi-Fi low-power).
│
└─ KHÔNG chắc  → Thử pair bằng app Smart Life CHÍNH CHỦ:
      ├─ Smart Life bắt "thêm gateway trước"     → Zigbee.
      ├─ Smart Life pair thẳng, chọn Wi-Fi 2.4G  → Wi-Fi low-power.
      └─ Smart Life cũng KHÔNG pair được         → lỗi phần cứng/sensor, không phải app.
```

---

## §Zigbee sub-device (khả năng cao nhất với "motion sensor")

Con PIR tham chiếu chính thức của Tuya là **Zigbee**, không phải Wi-Fi:

> *"ModelIdentifier … **TS0202**, used for connection to Tuya-enabled **Zigbee gateways**"* ·
> Profile ID `0x0104`, Device ID `0x0402`, cluster IAS Zone.
> — [Motion Sensor - Gateway Connectivity](https://developer.tuya.com/en/docs/connect-subdevices-to-gateways/tuya-pir-sensor?id=K9ik6zvn49x5m)

**Hệ quả cho dự án:**
- Zigbee sensor **không có Wi-Fi** → không bao giờ nghe được gói EZ/AP → luồng pair Wi-Fi của app
  **không thể** thấy nó. Không phải bug, là sai giao thức.
- Muốn pair phải qua **gateway đã online cloud** + đưa sub-device vào pairing mode. API Tuya:
  Android `ZigbeeActivator` / `ActivatorMode.Zigbee`; iOS `activeSubDeviceWithGwId:timeout:`.
  **Không cần token** (gateway làm trung gian). Xem [tuya-home-sdk-device-pairing.md](tuya-home-sdk-device-pairing.md) §sub-device.
- **App mình CHƯA wire cái này.** Trong lib:
  - iOS `TuyaPairing.mm` → `startSubDevicePairing:` là hàm rỗng `{}`.
  - Android `TuyaPairingModule.kt` → `startSubDevicePairing` emit `subdevice_error` + `todoPairing` trả
    `not_implemented`.
  ⇒ Nếu sensor là Zigbee, phải **quyết định có làm gateway/sub-device pairing không** (mở feature mới)
  hoặc chấp nhận **ngoài phạm vi** (dự án đang tập trung con ice tub Wi-Fi/BLE single-point).

---

## §Wi-Fi low-power thật (nếu đúng là PIR chạy pin + Wi-Fi)

Tuya có hẳn giải pháp riêng cho nhóm này (cảm biến an ninh chạy pin, tương tác yếu):

> *"Many battery-powered products in the market, such as security sensors, feature low power, small size,
> and weak interaction. Wi-Fi low power solution is designed for this product category."*
> — [Wi-Fi Low-Power Device Solution](https://developer.tuya.com/en/docs/iot/wifi-module-mcu-development-overview?id=K9eor8kzjbrrn)

### Cạm bẫy đặc thù (đây là lý do "mãi không được")

1. 🔴 **Tự ngủ sau 3 phút.** *"during network configuration, if the module does not connect to the cloud
   within 3 minutes, it will automatically enter low power mode"* → module gửi lệnh rồi **ngủ (status 0x05)**.
   ⇒ Loay hoay chọn mạng/gõ mật khẩu quá lâu là nó ngủ mất. **Chuẩn bị sẵn SSID + mật khẩu, pair thật nhanh.**
   *(Ghi chú: timeout của app mình để 120s < 3 phút → an toàn, nhưng đừng để user cà kê ở màn intro.)*
2. ⚠️ **Phải giữ thiết bị THỨC.** Nhiều PIR pin chỉ thức khi có chuyển động / khi vừa bấm reset.
   Reset xong pair ngay; nếu cần, quơ tay trước cảm biến để giữ nó thức.
3. ⚠️ **Sau khi pair xong có thể hiện offline** cho tới lần chuyển động kế (bản chất low-power: gửi xong
   là ngắt module). Đừng tưởng pair hỏng.
4. 🔴 **iOS + EZ = dính entitlement multicast** y hệt con ice tub (xem
   [tuya-wifi-ez-pairing-failure.md](tuya-wifi-ez-pairing-failure.md)). → trên iOS **dùng AP mode**.

### EZ vs AP (nhận biết bằng đèn) - áp dụng cho mọi thiết bị Wi-Fi Tuya

> *"The module supports two network configuration modes, EZ and AP. The LED **flickers quickly in EZ mode
> and slowly in AP mode**."*
> — [Wi-Fi Low-Power Device Solution](https://developer.tuya.com/en/docs/iot/wifi-module-mcu-development-overview?id=K9eor8kzjbrrn)

Reset thường **đổi qua lại EZ ↔ AP**. Nếu EZ mãi không được (nhất là iOS) → reset cho đèn **nháy chậm** = AP.

### Nguyên nhân fail phổ biến (troubleshooting chính chủ)
> *"Weak signal strength of the module might cause pairing to fail. If the hardware is tested to be normal,
> but the pairing process still failed, try the Wi-Fi Easy Connect (EZ) mode, compatibility mode, and AP or
> hotspot mode."* Cuối cùng: gửi ticket kèm **PID + video đèn báo + video thao tác điện thoại**.
> — [Troubleshooting](https://developer.tuya.com/en/docs/iot/product-troubleshooting-guide?id=K9s9rhio9x4xf)

Ngoài ra như con ice tub: **EZ chỉ 2.4GHz**, token sống 10 phút, cần Location + (Android) Location Services bật.

---

## Khác biệt so với con ice tub (điều chỉnh kỳ vọng)

| | Ice tub (Wi-Fi/BLE always-on) | Motion sensor |
|---|---|---|
| Giao thức | Wi-Fi (EZ/AP) + có thể BLE | **Zigbee (cần gateway)** *hoặc* Wi-Fi low-power |
| Nguồn | cắm điện, luôn thức | **pin, hay ngủ** |
| App mình hỗ trợ? | ✅ (đang fix) | Zigbee: **❌ chưa wire** · Wi-Fi low-power: ✅ (cùng luồng, khó hơn) |
| Cạm bẫy riêng | entitlement iOS · 5GHz | **tự ngủ 3 phút** · phải giữ thức · offline sau pair |

---

## Việc nên làm (ứng dụng ngay code vừa sửa)

1. **Xác định loại** bằng cây quyết định ở trên (thử trên **Smart Life** là nhanh nhất).
2. **Nếu Wi-Fi low-power:** cài bản build có B1-B6, pair bằng **AP mode** (nhất là iOS), reset cho đèn nháy
   **chậm**, chuẩn bị sẵn mật khẩu, pair trong <3 phút. Fail → **Copy diagnostics**, đọc mã (giờ đã có mã thật).
3. **Nếu Zigbee:** dừng thử luồng Wi-Fi (vô ích). Quyết định với khách: có mở feature **gateway + sub-device
   pairing** không (một milestone riêng), hay để **ngoài phạm vi**.

---

## Câu hỏi mở / cần xác minh

- ❓ **Model/PID chính xác của cảm biến?** Có PID là tra được ngay giao thức trên Tuya IoT Platform
  (đỡ phải đoán Zigbee vs Wi-Fi).
- ❓ **Trên app Smart Life nó pair kiểu gì?** (đòi hub trước = Zigbee; chọn Wi-Fi 2.4G = Wi-Fi low-power).
- ❓ Nếu Wi-Fi low-power: bấm **Copy diagnostics** khi fail → mã lỗi là gì? (`-1006` offline · timeout · token).
- ❓ Đây có phải **yêu cầu thật của khách** (dự án cần hỗ trợ cảm biến) hay chỉ là **thiết bị test tình cờ**?
  Nếu là yêu cầu thật và là Zigbee → cần plan riêng cho gateway/sub-device.

---

## Nguồn (đầy đủ URL đã đọc)

1. [PIR Motion Sensor - Gateway Connectivity (TS0202, Zigbee, Profile 0x0104)](https://developer.tuya.com/en/docs/connect-subdevices-to-gateways/tuya-pir-sensor?id=K9ik6zvn49x5m)
2. [Wi-Fi Low-Power Device Solution (auto-sleep 3 phút, EZ/AP, LED nhanh/chậm)](https://developer.tuya.com/en/docs/iot/wifi-module-mcu-development-overview?id=K9eor8kzjbrrn)
3. [Wi-Fi EZ Mode (Smart App SDK)](https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9)
4. [Wi-Fi AP Mode (Smart App SDK)](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha)
5. [Product Troubleshooting Guide (weak signal, thử EZ/compatibility/AP, gửi PID+video)](https://developer.tuya.com/en/docs/iot/product-troubleshooting-guide?id=K9s9rhio9x4xf)
6. [Why isn't the indicator on after powering on the PIR sensor](https://support.tuya.com/en/help/_detail/K9hw4epk3a634)
7. Liên quan: [tuya-wifi-ez-pairing-failure.md](tuya-wifi-ez-pairing-failure.md) · [tuya-home-sdk-device-pairing.md](tuya-home-sdk-device-pairing.md) (§sub-device/gateway)
