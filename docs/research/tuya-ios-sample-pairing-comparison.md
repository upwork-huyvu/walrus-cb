# Tuya Research: Sample iOS chính chủ xử lý pairing thế nào (đối chiếu với module mình)

- Ngày: 2026-07-10
- Nguồn: `tuya-home-ios-sdk-sample-objc-main` (sample ObjC chính chủ của Tuya, `ThingSmartHomeKit ~> 5.8.0`)
  - `TuyaAppSDKSample-iOS-ObjC/ViewController/Device Network Configuration/` (EZ · AP · Dual · BLE)
- Bối cảnh: nối tiếp `m1-fix-wifi-pairing` + vụ pair cảm biến Wi-Fi mãi không được.

---

## TL;DR

- ✅ **API pairing của mình KHỚP sample gần như verbatim** (getToken → startConfigWiFi EZ/AP → delegate).
  Không sai chỗ nào ở luồng cơ bản.
- 🔴 **Lỗ hổng thật, đáng nghi là thủ phạm cho cảm biến: mình THIẾU bước bắt tay "Security Level Device".**
  Sample bắt `activator:didPassWIFIToSecurityLevelDeviceWithUUID:` → hỏi user xác nhận →
  gọi `continueConfigSecurityLevelDevice`. **Module mình không implement** → với thiết bị an ninh
  (cảm biến, khoá, PIR…) pairing sẽ **treo tới timeout** vì SDK chờ mãi cái xác nhận không bao giờ tới.
- 🟡 Sample **route theo `deviceInfo.bleType`**: BLE thuần → "dùng BLE Mode", BLE+Wi-Fi → "dùng Dual Mode".
  Module mình vứt `bleType` (hardcode `deviceType=0`) → không route được, dễ chọn nhầm cách pair.
- ✅ **Sample cũng KHÔNG có entitlement multicast / không có Info.plist local-network.** Củng cố kết luận
  cũ: iOS EZ 14.5+ cần xin entitlement; sample chạy được là nhờ **AP mode**.
- 🟡 Sample dùng `timeout:100` (mình để 120) - vặt.

---

## 1. EZ / AP - khớp verbatim

Sample (`EZModeTableViewController.m` / `APModeTableViewController.m`):
```objc
[[ThingSmartActivator sharedInstance] getTokenWithHomeId:homeId success:^(NSString *result) {
    [[ThingSmartActivator sharedInstance] startConfigWiFi:ThingActivatorModeEZ   // hoặc ...ModeAP
        ssid:ssid password:password token:token timeout:100];
} failure:...];

- (void)activator:didReceiveDevice:(ThingSmartDeviceModel *)m error:(NSError *)e { ... }
```
→ **Y hệt** `TuyaPairing.mm` của mình (`startWifiPairingAuto` → `doWifiPairingMode`). Kết quả B1-B6 không bị
API sai. Khác biệt duy nhất: AP mode của sample lấy token **ngay `viewDidLoad`** (mình lấy lúc bấm Start) - vặt.

## 2. 🔴 Security Level Device - MÌNH THIẾU (thủ phạm số 1 cho cảm biến)

Sample - **chỉ ở AP mode** (`APModeTableViewController.m`):
```objc
// Only the Security Level Device Need this.
- (void)activator:(ThingSmartActivator *)activator didPassWIFIToSecurityLevelDeviceWithUUID:(NSString *)uuid {
    // hỏi user: "continue pair? (điện thoại phải cùng Wi-Fi vừa nhập)"
    // → nếu đồng ý:
    [[ThingSmartActivator sharedInstance] continueConfigSecurityLevelDevice];
}
```

**Đây là bắt tay 2 nhịp cho thiết bị an ninh.** Với thiết bị "security level" (cảm biến, khoá, PIR…), SDK
**tạm dừng** giữa chừng, gọi delegate này để chờ app **xác nhận** rồi mới đi tiếp. Nếu app không gọi
`continueConfigSecurityLevelDevice`, SDK **đứng im tới hết timeout**.

- Method này là `@optional` trong `ThingSmartActivatorDelegate` (đã thấy ở header:
  `activator:didPassWIFIToSecurityLevelDeviceWithUUID:`).
- **`TuyaPairing.mm` của mình KHÔNG implement** → grep `SecurityLevel|continueConfig|didPassWIFI` = rỗng.
- ⇒ **Nếu con cảm biến Wi-Fi là security-level device (rất thường gặp với sensor), pairing của app mình
  sẽ treo tới timeout mà không rõ lý do.** Rất khớp triệu chứng "mãi không được".
- Lưu ý: sample chỉ xử lý ở **AP mode** → thêm một lý do nữa để dùng **AP** cho nhóm thiết bị này.

## 2b. 🔑 Sample KHÔNG có màn "Auto Scan" gộp - nhưng scan của nó là UNIFIED

Đào hết `ViewController/` của sample: **không có** màn scan/discovery/auto nào. Chỉ có **4 màn mode THỦ CÔNG**
(EZ · AP · Dual · BLE) + SIGMesh + ThingLinkBind, user tự chọn mode. `DeviceListTableViewController` là để
**liệt kê thiết bị ĐÃ pair**, không phải discovery.

**NHƯNG** - điểm quan trọng cho flow "tìm→chạm→wifi": cả màn **BLE lẫn Dual đều gọi CÙNG một lệnh scan**
`[ThingSmartBLEManager.sharedInstance startListening:YES]`. Scan này **tìm ra TẤT CẢ thiết bị BLE mọi loại
cùng lúc**; rồi **mỗi màn tự lọc theo `deviceInfo.bleType`** và đẩy user sang mode đúng.

⇒ **Auto-scan gộp là LÀM ĐƯỢC:** chỉ cần **1 lần `startListening`**, nhận thiết bị kèm `bleType`, rồi
**route theo `bleType`** sang đúng cách pair. Sample tách 2 màn chỉ để demo cho rõ; hạ tầng scan là một.

## 3. 🟡 Route theo bleType - BẢNG CHIẾN LƯỢC (spec cho flow gộp)

Từ 2 màn BLE/Dual, suy ra bảng `bleType → cách pair` (đây chính là "bộ định tuyến" mà flow tìm→chạm cần):

| `ThingSmartBLEType` | Loại | Cách pair đúng | Cần Wi-Fi? |
|---|---|---|---|
| `BLE`, `BLEPlus`, `BLESecurity`, `BLEZigbee`, `BLEBeacon`, `Unknow` | BLE thuần | `activeBLE:homeId:` (màn **BLE**) | ❌ Không |
| `BLEWifi`, `BLEWifiSecurity`, `BLEWifiPlugPlay`, `BLEWifiPriorBLE`, `BLELTESecurity` | **Combo (Wi-Fi)** | `startConfigBLEWifiDeviceWithUUID:…ssid:password:` (màn **Dual**) | ✅ **Có** |

→ Đây đúng cái flow mày muốn: chạm thiết bị → nếu `bleType` là nhóm **Combo** thì **mới** hỏi Wi-Fi; nhóm
BLE-thuần thì pair thẳng. Có cả các biến thể `*Security` (thiết bị an ninh) → khớp §2 (cần continue-handshake).

⚠️ **Module mình vứt `bleType`** (`didDiscoveryDeviceWithDeviceInfo` emit `deviceType:@0`, bỏ `bleType`) →
**không route được**. Muốn làm flow gộp thì **bắt buộc đẩy `bleType` thật lên JS**.

Sample kiểm `deviceInfo.bleType` để **đẩy user sang đúng cách pair**:
- `BLEModelViewController.m`: nếu type là `BLEWifi/BLEWifiSecurity/BLEWifiPlugPlay/BLEWifiPriorBLE/BLELTESecurity`
  → *"Please use Dual Mode"*.
- `DualModelTableViewController.m`: nếu type là `BLE/BLEPlus/BLESecurity/BLEZigbee/BLEBeacon`
  → *"Please use BLE Mode"*.
- Có cả `ThingSmartBLETypeBLEWifiSecurity` / `ThingSmartBLETypeBLELTESecurity` → **khái niệm "security" cũng có ở tầng BLE**.

Module mình: `didDiscoveryDeviceWithDeviceInfo` emit `deviceType:@0` **hardcode**, **bỏ `bleType`**
→ JS không biết thiết bị thuộc loại nào → không route được, dễ chọn nhầm (vd bấm combo cho thiết bị BLE thuần).

## 4. ✅ Combo & BLE - khớp

`DualModelTableViewController.m`: `ThingSmartBLEManager startListening` → `didDiscoveryDeviceWithDeviceInfo`
→ `ThingSmartBLEWifiActivator startConfigBLEWifiDeviceWithUUID:homeId:productId:ssid:password:timeout:success:failure:`
→ delegate `bleWifiActivator:didReceiveBLEWifiConfigDevice:error:`. **Khớp `startBleWifiPairing` của mình.**
`BLEModelViewController.m`: `activeBLE:homeId:success:failure:` - khớp `startBlePairing`.

## 5. ✅ Entitlement - sample cũng không có

`find *.entitlements` = rỗng; Info.plist không có `multicast`/`NSLocalNetworkUsageDescription`/Bonjour.
→ Sample **không** ship entitlement multicast → trên iOS 14.5+ EZ của **chính sample** cũng sẽ fail nếu build
lên máy thật. Nó dựa vào **AP mode**. Khớp hoàn toàn note [tuya-wifi-ez-pairing-failure.md](tuya-wifi-ez-pairing-failure.md).

---

## Việc nên làm (đề xuất)

1. 🔴 **Wire `didPassWIFIToSecurityLevelDeviceWithUUID:` + `continueConfigSecurityLevelDevice`** vào
   `TuyaPairing.mm` (và tương đương Android nếu có). Thấp rủi ro, và là **ứng viên số 1** giải thích tại sao
   cảm biến (security-level) pair không được. → gợi ý `/fix-plan` thêm bước **B8** vào `m1-fix-wifi-pairing`.
   - Cách xử UX tối giản: mặc định **tự** `continueConfigSecurityLevelDevice` (không popup), + log
     `sdk.security_level_continue` để diagnostics thấy. Điều kiện SDK yêu cầu (điện thoại cùng Wi-Fi) thì
     preflight/prepare đã lo. *(Sample popup xác nhận; app mình có thể auto để bớt ma sát, hoặc popup như sample.)*
2. 🟡 **Đẩy `bleType` thật lên JS** (thay `deviceType=0`) để route đúng BLE vs Dual - cải thiện, không gấp.
3. ✅ Giữ nguyên EZ/AP/combo - đã khớp sample.

---

## Nguồn
- Sample: `~/Downloads/tuya-home-ios-sdk-sample-objc-main/TuyaAppSDKSample-iOS-ObjC/ViewController/Device Network Configuration/`
  (`EZModeTableViewController.m` · `APModeTableViewController.m` · `DualModelTableViewController.m` · `BLEModelViewController.m`)
- Podfile: `ThingSmartHomeKit ~> 5.8.0`, `ThingSmartCryption :path => ./ios_core_sdk`
- Đối chiếu: `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm`
- Liên quan: [tuya-wifi-ez-pairing-failure.md](tuya-wifi-ez-pairing-failure.md) · [tuya-wifi-motion-sensor-pairing.md](tuya-wifi-motion-sensor-pairing.md)
