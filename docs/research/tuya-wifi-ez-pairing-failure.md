# Tuya Research: Vì sao pairing Wi-Fi EZ thất bại (iOS + Android) & có khắc phục được không

- Ngày: 2026-07-10
- Nguồn chính:
  - https://developer.tuya.com/en/docs/iot/oem-ez-privacy-apply?id=Kb8avep9c7wg6 (Request Multicast Entitlement to Enable Wi-Fi EZ Mode)
  - https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j (Wi-Fi EZ Mode - iOS)
  - https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9 (Wi-Fi EZ Mode - Android)
  - https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4 (Device Pairing - iOS)
  - https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha (Wi-Fi AP Mode)
  - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a (Error Codes)
- Bối cảnh: bug `m1-fix-wifi-pairing` - khách pair ice tub qua Wi-Fi EZ fail cả 2 nền tảng,
  màn lỗi chỉ hiện `[sdk:pairing_error] Unknown error.`

---

## TL;DR (cho người sắp code)

- 🔴 **iOS: ĐÃ TÌM RA NGUYÊN NHÂN CHẮC CHẮN.** Từ **iOS 14.5**, app **bắt buộc** có entitlement
  `com.apple.developer.networking.multicast` mới gửi được gói EZ. App của mình **không có** entitlement này
  → iOS **không thể** pair EZ, dù code đúng 100%. Tuya nói thẳng: *"the app built with Xcode 12.5 cannot send
  the EZ pairing data packets from iPhone that runs iOS 14.5 or later"*.
- ⚠️ **Entitlement này Apple phải duyệt** (form riêng, **3-5 ngày làm việc**). Không tự bật được.
- ✅ **Đường thoát chính thức của Tuya:** *"For iOS 14.5 and later, we recommend that you use the **AP mode**
  instead of the Wi-Fi EZ mode."* AP mode **không cần** entitlement, tỉ lệ thành công cao hơn, và
  **hỗ trợ router dual-band 2.4+5GHz**.
- 🟢 **Android: giả thuyết "thiếu `CHANGE_WIFI_MULTICAST_STATE`" là SAI** (tự bác bỏ, xem §6).
  Quyền này **đã có sẵn** trong merged manifest do AAR của Tuya tự khai. → Android fail vì lý do **khác**,
  chưa xác định được nếu không có log.
- 📌 Vì `Smart Life` pair được bằng EZ ⇒ Smart Life **có** entitlement multicast (app của Tuya, đã được duyệt).
  Đây chính là khác biệt giữa app mình và Smart Life. **Không phải lỗi phần cứng.**
- 🕐 Token pairing **sống 10 phút**, hết hạn ngay khi thiết bị pair xong. Timeout mặc định **100s**
  (code mình đang để 120s - chấp nhận được).

---

## Khái niệm & luồng

### EZ mode (SmartConfig) hoạt động thế nào
Điện thoại **phát gói UDP broadcast / multicast** chứa SSID + password + token ra không khí.
Chip Wi-Fi của thiết bị chạy ở chế độ **promiscuous** để bắt và giải mã gói đó.

> *"In EZ mode, the mobile app sends a UDP broadcast packet or a multicast packet containing the Wi-Fi username
> and password, which the Wi-Fi chip can receive and decrypt."*
> — [Request Multicast Entitlement](https://developer.tuya.com/en/docs/iot/oem-ez-privacy-apply?id=Kb8avep9c7wg6)

> *"The app encapsulates the pairing data into the specified section of an IEEE 802.11 packet."*
> — [Device Pairing (iOS)](https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4)

⇒ **Toàn bộ EZ phụ thuộc vào khả năng gửi broadcast/multicast.** Chặn cái đó = chặn EZ.

### AP mode (hotspot) hoạt động thế nào
Điện thoại đóng vai **STA nối vào hotspot do chính thiết bị phát ra**, rồi truyền credentials qua kết nối
Wi-Fi trực tiếp (không cần broadcast).

> *"After the mobile phone is connected to the Wi-Fi hotspot of the device to be paired, the app is paired and
> communicates with the device over Wi-Fi."*
> — [Wi-Fi AP Mode](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha)

⇒ **AP không dùng multicast/broadcast ⇒ không đụng entitlement của Apple.**

---

## 🔴 Nguyên nhân iOS (ĐÃ XÁC NHẬN)

### Entitlement multicast là bắt buộc

> *"Apple requires apps to be granted the multicast entitlement that improves app security. **Otherwise, the
> Wi-Fi EZ mode will be unavailable for the apps.**"*
> — [Request Multicast Entitlement](https://developer.tuya.com/en/docs/iot/oem-ez-privacy-apply?id=Kb8avep9c7wg6)

> *"the app built with Xcode 12.5 **cannot send the EZ pairing data packets** from iPhone that runs
> **iOS 14.5 or later**, and in this case, the permission `com.apple.developer.networking.multicast` must be
> enabled for the app."*
> — [Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j)

### Đối chiếu với repo (kiểm chứng trên đĩa)
`apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements` hiện có:
- ✅ `aps-environment`
- ✅ `com.apple.developer.applesignin`
- ✅ `com.apple.developer.networking.wifi-info`
- ❌ **THIẾU `com.apple.developer.networking.multicast`**

⇒ **iOS EZ chắc chắn không bao giờ chạy được với build hiện tại.** Đây là root cause phía iOS,
độc lập hoàn toàn với bug `Unknown error` (bug đó chỉ khiến ta **không nhìn thấy** lỗi thật).

### `NSLocalNetworkUsageDescription` KHÔNG cứu được
`Info.plist` đã có key này (tốt, vẫn cần) - nhưng Local Network permission chỉ phủ **unicast LAN + Bonjour**.
Multicast/broadcast tuỳ biến là **capability riêng** cần Apple duyệt. Hai thứ khác nhau, đừng nhầm.

Doc iOS cũng xác nhận quyền Local Network vẫn là điều kiện cần:
> *"Starting from iOS 14, when users implement device pairing or control over a local area network (LAN), the
> local network privacy setting dialog box is triggered."* … *"Apple doesn't provide APIs to manage this setting
> programmatically."*
> — [Device Pairing (iOS)](https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4)

⚠️ Hệ quả: nếu user từng bấm **Deny**, iOS **không hỏi lại** và app **im lặng fail mãi**.
Không có API nào để app tự mở lại → phải hướng dẫn user vào Settings.

### Quy trình xin entitlement (Apple)
| Bước | Nội dung |
|---|---|
| 1 | Nộp form: https://developer.apple.com/contact/request/networking-multicast |
| 2 | Điền: App Name · **Apple Store URL** (`https://apps.apple.com/app/id[Apple ID]`) · Apple ID of App (optional) · App Category · mục đích chính · giải thích nhu cầu multicast/broadcast |
| 3 | ❗ Phần giải thích **bắt buộc nhắc tới**: *"UDP ports **6666** and **6667** and TCP port **6668**"* |
| 4 | Chờ duyệt: *"It usually takes **3 to 5 workdays**"* |
| 5 | Sau khi duyệt: bật **"Multicast Networking"** trong *Additional Capabilities* của App Identifier → **tạo lại + rebuild certificate/provisioning profile** |

> ⚠️ **Cạm bẫy thực tế:** form đòi **App Store URL** → app chưa phát hành thì phần này gợn.
> Trường "Apple ID of App" ghi optional. **Chưa xác minh được** Apple có chấp nhận app chưa lên store hay không
> → cần thử nộp và xem phản hồi (xem §Câu hỏi mở).

### Đường thoát Tuya khuyến nghị
> *"**For iOS 14.5 and later, we recommend that you use the AP mode instead of the Wi-Fi EZ mode.**"*
> AP mode có *"higher success rate, optimal reliability, and fewer compatibility requirements."*
> — [Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j)

---

## 🟢 Nguyên nhân Android (giả thuyết cũ ĐÃ BỊ BÁC BỎ)

### Tự bác bỏ: `CHANGE_WIFI_MULTICAST_STATE` KHÔNG hề thiếu

Plan `m1-fix-wifi-pairing` ban đầu ghi Android *"thiếu `CHANGE_WIFI_MULTICAST_STATE`"* dựa trên việc grep
`apps/mobile/android/app/src/main/AndroidManifest.xml`. **Kết luận đó sai** vì bỏ qua **manifest merger**.

Kiểm chứng trên merged manifest thật (cái thực sự vào APK):
`apps/mobile/android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`

```
CHANGE_WIFI_MULTICAST_STATE   ← CÓ (1 khai báo, đến từ AAR của Tuya)
CHANGE_WIFI_STATE             ← CÓ
ACCESS_WIFI_STATE             ← CÓ
ACCESS_FINE_LOCATION          ← CÓ
ACCESS_COARSE_LOCATION        ← CÓ
NEARBY_WIFI_DEVICES           ← không có
```

⇒ AAR `thingsmart:7.5.6` **tự khai** `CHANGE_WIFI_MULTICAST_STATE`; manifest merger kéo vào app.
**App không cần khai lại.** Bài học: với permission, luôn đọc **merged manifest**, đừng grep manifest nguồn.

### `NEARBY_WIFI_DEVICES` - có cần không?
Repo đang `targetSdkVersion = 36` (≥ 33), nên trên Android 13+ một số Wi-Fi API cần
`NEARBY_WIFI_DEVICES` **hoặc** `ACCESS_FINE_LOCATION`. App **đã có** `ACCESS_FINE_LOCATION` và **đã xin runtime**
(`apps/mobile/src/services/wifiScanner.ts:23-24`) ⇒ nhiều khả năng **không phải blocker**.

> ⚠️ **Chưa xác minh trực tiếp từ doc Tuya.** Các trang doc đã fetch (Android EZ, Fast Integration,
> Device Pairing overview) **không liệt kê `<uses-permission>` nào cho EZ**. Chỉ trang
> [Bluetooth Pairing](https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z)
> liệt kê permission (và chỉ cho BLE). Không bịa.

### Vậy Android fail vì gì?
**Chưa biết** - và đó chính là lý do phải làm observability trước. Ứng viên còn lại, theo thứ tự khả năng:
1. **Wi-Fi 5GHz** (xem §Cạm bẫy) - đây là nguyên nhân **duy nhất giải thích được cả 2 nền tảng cùng fail**.
2. Location Services **tắt ở cấp hệ thống** (khác với permission đã cấp).
3. Thiết bị không thật sự ở EZ mode (đèn nháy nhanh) lúc bấm pair.
4. Token hết hạn (10 phút) hoặc DC mismatch.

---

## API chính

| Platform | Class/Method | Params | Callback/Return | Ghi chú |
|---|---|---|---|---|
| iOS | `-[ThingSmartActivator getTokenWithHomeId:success:failure:]` | `long long homeId` | `TYSuccessString` / `TYFailureError` | token sống **10 phút** |
| iOS | `-[ThingSmartActivator startConfigWiFi:ssid:password:token:timeout:]` | `TYActivatorMode mode` (`TYActivatorModeEZ`), ssid, password, token, `NSTimeInterval timeout` | (void) - kết quả về **delegate** | mode EZ |
| iOS | `-[ThingSmartActivator stopConfigWiFi]` | - | - | |
| iOS delegate | `activator:didReceiveDevice:error:` | `ThingSmartDeviceModel*`, `NSError*` | - | **`NSError.code` = mã Tuya thật** |
| Android | `ThingHomeSdk.getActivatorInstance().getActivatorToken(homeId, IThingActivatorGetToken)` | `long homeId` | `onSuccess(String token)` / `onFailure(code,error)` | |
| Android | `ActivatorBuilder().setSsid().setPassword().setContext().setActivatorModel(ActivatorModelEnum.TY_EZ).setTimeOut().setToken().setListener()` | - | - | ⚠️ SDK 7.5.6 đổi enum thành `THING_EZ`/`THING_AP` (đã note ở `tuya-android-sdk-missing-modules.md`) |
| Android | `getActivatorInstance().newMultiActivator(builder)` → `.start()` / `.stop()` / `.onDestroy()` | - | `IThingSmartActivatorListener`: `onActiveSuccess(DeviceBean)` · `onError(code,msg)` · `onStep(step, data)` | timeout mặc định **100s** |
| Android (AP) | `ActivatorModelEnum.TY_AP` | như trên | như trên | timeout mặc định 100s |

---

## Khác biệt iOS vs Android

| | iOS | Android |
|---|---|---|
| Gửi gói EZ | **Cần entitlement `networking.multicast`** (Apple duyệt) | Chỉ cần `CHANGE_WIFI_MULTICAST_STATE` - **AAR Tuya đã khai sẵn** |
| Quyền LAN | Local Network prompt (iOS 14+), **deny 1 lần là fail vĩnh viễn**, không có API mở lại | không có khái niệm tương đương |
| Đọc SSID | cần Location (iOS 13+), thiếu → BSSID trả `00:00:00:00:00:00` | cần `ACCESS_FINE_LOCATION` + **Location Services bật** |
| Kết quả pairing | qua **delegate** `activator:didReceiveDevice:error:` | qua **listener** `onActiveSuccess` / `onError` |
| Tiến trình | `ThingActivatorStep` (**enum số**) | `onStep(String step, Object data)` (**chuỗi**) |
| Khuyến nghị của Tuya cho 14.5+ | **dùng AP mode thay EZ** | EZ vẫn dùng được |

> 🔎 Đây là lý do `pairingStepLabel()` của app (khớp bằng **từ khoá chữ**) luôn trượt trên iOS -
> iOS emit số enum. Xem `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm:118`.

---

## Điều kiện tiên quyết & cấu hình

### iOS
- [ ] `com.apple.developer.networking.multicast` trong entitlements ← **ĐANG THIẾU** (Apple duyệt 3-5 ngày)
- [x] `NSLocalNetworkUsageDescription` trong `Info.plist` ← đã có
- [x] `NSLocationWhenInUseUsageDescription` ← đã có
- [ ] User **đã bấm Allow** cho Local Network (deny rồi thì phải vào Settings bật lại thủ công)
- [x] `com.apple.developer.networking.wifi-info` (để đọc SSID) ← đã có

### Android
- [x] `CHANGE_WIFI_MULTICAST_STATE` ← **AAR Tuya đã khai**, merged manifest có
- [x] `ACCESS_FINE_LOCATION` (+ xin runtime) ← đã có
- [ ] **Location Services bật ở cấp hệ thống** ← app chưa kiểm
- [ ] `NEARBY_WIFI_DEVICES` ← chưa có; **chưa chứng minh được là cần** (targetSdk 36)

### Chung
- Tuya **Data Center của SDK phải trùng Cloud Project** (dự án từng dính mismatch → Western Europe).
- Tài khoản phải là **Owner của Home**.
- Token pairing **10 phút**, hết hạn ngay sau khi pair xong.

---

## Mã lỗi thường gặp & cách xử lý

Từ [Error Codes](https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a):

| Code | Nghĩa | Xử lý |
|---|---|---|
| `-33` | timeout khi lấy token | lấy token mới, kiểm tra mạng/DC |
| `-55` | token đã hết hạn | lấy token mới (nhớ: sống 10 phút) |
| `-56` | token không khớp | lấy token mới |
| `-57` | verify token thất bại | kiểm tra DC/AppKey |
| `-3` | connection timeout | thử lại |
| `-1006` | thiết bị offline | kiểm tra nguồn/Wi-Fi thiết bị |
| `-1000` | tham số request không hợp lệ | kiểm tra ssid/password/homeId |
| `-1010` | tham số method không hợp lệ | |

> ⚠️ Bảng `SDK_CODES` trong `packages/tuya-react-native/src/errors.ts` đang map `1001..1007` (**số dương**)
> là `pairing_failed`/`pairing_timeout`. Doc chính chủ ở trên lại dùng **số âm** (`-1000`, `-1006`, `-1010`…).
> **Cần rà lại bảng này** - có thể đang map nhầm miền giá trị. Chưa xác minh được nguồn gốc dãy dương.

---

## Cạm bẫy / lưu ý cho dự án ice-bath

1. 🔴 **iOS EZ = bất khả thi nếu không có entitlement.** Mọi effort sửa code phía iOS EZ đều vô nghĩa
   cho tới khi có entitlement, HOẶC chuyển sang AP/BLE. Đừng debug code, hãy đổi đường.
2. 🟢 **AP mode hỗ trợ router dual-band.** Doc AP: *"supports routers that can process data using both
   2.4 GHz and 5 GHz frequencies."* Trong khi EZ *"has compatibility requirements for mobile phones and routers"*
   và tỉ lệ thành công **thấp hơn** hotspot pairing
   ([Android EZ doc](https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9)).
   ⇒ AP mode giải quyết **cùng lúc** cả vấn đề entitlement (iOS) lẫn nghi vấn 5GHz (cả 2 nền tảng).
3. ⚠️ **Băng tần Wi-Fi vẫn là ẩn số.** `wifiScanner.ts` **đã đọc sẵn `frequency`** (dòng 7) nhưng chưa dùng.
   Preflight chặn 5GHz gần như free: `frequency >= 5000` → chặn + hướng dẫn.
   *Lưu ý: doc Tuya (các trang đã fetch) **không phát biểu tường minh** "EZ chỉ 2.4GHz" - đây là kiến thức
   phổ biến + suy ra từ việc AP được quảng cáo là hỗ trợ 5GHz còn EZ thì không. Cần xác minh trên thiết bị.*
4. ⚠️ **Local Network deny = fail im lặng vĩnh viễn trên iOS.** Phải phát hiện + hướng dẫn vào Settings.
5. ⚠️ **Timeout mình để 120s, mặc định Tuya 100s.** Không sai, nhưng token chỉ sống 10 phút - đừng để user
   ngồi màn intro quá lâu sau khi `getActivatorToken` (app hiện lấy token **ngay trước** khi start → OK).
6. 🟡 **`ThingActivatorStep` enum vẫn chưa được doc hoá** (đã kiểm 3 trang, không trang nào liệt kê).
   Phải log giá trị thật từ thiết bị rồi mới map.
7. 🟡 **Bài học quy trình:** grep manifest nguồn ra kết luận sai. Với Android permission → luôn đọc
   `build/intermediates/merged_manifests/.../AndroidManifest.xml`.

---

## Câu hỏi mở / cần xác minh trên thiết bị

- ❓ **Apple có duyệt entitlement multicast cho app chưa lên App Store không?** Form đòi App Store URL.
  → Cần nộp thử. Nếu không được ⇒ **buộc phải** dùng AP/BLE cho tới khi app lên store.
- ❓ **Ice tub có hỗ trợ AP mode không?** (đèn nháy **chậm** = AP). Khách xác nhận EZ chạy trên Smart Life;
  chưa biết AP. → Thử trên Smart Life trước khi code.
- ❓ **Ice tub có BLE không?** Nếu có, combo BLE+Wi-Fi né được cả entitlement lẫn 5GHz → ứng viên tốt nhất.
  → `startBleScan()` xem có thấy bồn không.
- ❓ **Mạng "Can March" là băng tần gì?** Nếu dual-band chung SSID và điện thoại bám 5GHz → giải thích
  Android fail. → preflight `frequency`.
- ❓ **Dãy error code dương (`1001`-`1007`) trong `errors.ts` lấy từ đâu?** Doc chính chủ dùng số âm.
  → rà lại, có thể đang map nhầm.
- ❓ **Android fail ở step nào?** Không có log ⇒ không trả lời được. Đây là lý do B1-B3 (observability)
  phải làm trước.

---

## Nguồn (đầy đủ URL đã đọc)

1. [Request Multicast Entitlement to Enable Wi-Fi EZ Mode](https://developer.tuya.com/en/docs/iot/oem-ez-privacy-apply?id=Kb8avep9c7wg6) - entitlement, form Apple, ports 6666/6667/6668, 3-5 ngày
2. [Wi-Fi EZ Mode - iOS (Smart App SDK)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j) - Xcode 12.5/iOS 14.5 không gửi được gói; khuyến nghị AP mode; API signatures
3. [Wi-Fi EZ Mode - Android (Smart App SDK)](https://developer.tuya.com/en/docs/app-development/quick-connection-mode?id=Kaixju76a5iq9) - `ActivatorBuilder`, token 10 phút, timeout 100s, tỉ lệ thành công thấp hơn AP
4. [Device Pairing - iOS](https://developer.tuya.com/en/docs/app-development/activator?id=Ka5cgmlzpfig4) - Local Network prompt iOS 14+, Location cho SSID (iOS 13+), EZ vs AP
5. [Wi-Fi AP Mode](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kceugwuabayha) - hỗ trợ router 2.4+5GHz, `TY_AP`, timeout 100s, cần token
6. [Device Pairing overview - Android](https://developer.tuya.com/en/docs/app-development/wifinetwork?id=Ka6ki8lbwu82c) - EZ dùng promiscuous mode; AP dùng STA→hotspot
7. [Bluetooth Pairing](https://developer.tuya.com/en/docs/app-development/ble_activator?id=Kdljgsdlp1f7z) - **trang duy nhất** liệt kê `<uses-permission>` (và chỉ cho BLE)
8. [Error Codes](https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a) - `-33/-55/-56/-57/-3/-1006/-1000/-1010`
9. [Android Fast Integration](https://developer.tuya.com/en/docs/app-development/integrated?id=Ka69nt96cw0uj) - **không** liệt kê permission (đã kiểm)
10. [Apple - Multicast Networking Entitlement Request](https://developer.apple.com/contact/request/networking-multicast) - form nộp

**Nguồn tại chỗ (kiểm chứng trên repo, không phải doc):**
- `apps/mobile/android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`
  → chứng minh `CHANGE_WIFI_MULTICAST_STATE` đã được merge từ AAR Tuya.
- `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements` → thiếu `networking.multicast`.
- `apps/mobile/android/build.gradle:4-6` → `targetSdkVersion = 36`.
