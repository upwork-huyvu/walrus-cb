# Tuya Research: AP mode (hotspot) trên iOS - luồng đúng, và vì sao AP thoát được bế tắc EZ

- Ngày: 2026-07-16
- Nguồn chính:
  - https://developer.tuya.com/en/docs/app-development/iOS-network-host?id=Kaixw35qn5d1l (**doc client chỉ định** - AP Mode, iOS)
  - https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kaixvcn8gy8o0 (Wi-Fi EZ Mode, iOS)
  - https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kaixk6wxla1oy (AP Mode, **Android**)
  - https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk (SmartLife user manual - bước user-facing)
- Bối cảnh: client chốt "**iOS thì để AP, EZ chưa support**" + yêu cầu ghi rõ cách kết nối bằng AP.
  Phục vụ feature `m1-pairing-radar-discovery` (nội dung dropdown mode) và đóng lại nghi vấn treo từ
  `m1-fix-wifi-pairing` B5 (chờ Apple duyệt entitlement multicast).

---

## TL;DR (cho người sắp code)

- 🟢 **AP thường (legacy) KHÔNG cần entitlement nào của Apple.** Đây là phát hiện quan trọng nhất:
  hai điều kiện "bật **Hotspot** trên Apple Developer platform" + "tích hợp thư viện
  `ThingSmartHotspotCredentialKit`" **chỉ thuộc mục "New AP pairing process"** (tức **AP Plus**),
  **không** áp cho AP thường. Mục AP legacy **không liệt kê bất kỳ prerequisite/entitlement/thư viện
  nào**. ⇒ **Chọn AP trên iOS là thoát thật, không phải đổi bế tắc này lấy bế tắc khác.**
- ✅ **Chính Tuya khuyến nghị AP thay EZ trên iOS 14.5+** (nguyên văn bên dưới) - trùng khớp quyết
  định của client.
- 🔑 **iOS KHÔNG tự nối hotspot hộ user - Android thì CÓ.** Đây là khác biệt nền tảng lớn nhất và nó
  **đổi hẳn nội dung hướng dẫn**: iOS bắt user tự vào Settings chọn Wi-Fi `SmartLife…`; Android thì
  "SDK **tự động** nối vào hotspot của thiết bị".
- 🔴 **Đèn AP nháy CHẬM, đèn EZ nháy NHANH.** Nội dung hướng dẫn AP mình đang có trong
  `pairingModes.ts` **thiếu hẳn bước này** (bước vật lý quan trọng nhất) → phải sửa.
- ⏱️ Token: `getTokenWithHomeId:` - **sống 10 phút, chết ngay sau khi pair xong 1 lần**. Giống EZ.
- 📶 AP **"adapts to 2.4 GHz and 5 GHz dual-band routers"** nhưng user vẫn **phải tự đổi băng tần
  điện thoại**; user manual thì nói thẳng "phải nối 2.4 GHz". Xem mục "Câu hỏi mở" - hai câu này
  căng nhau, đừng hứa với user là AP chạy tẹt ga trên 5GHz.
- ✅ Code iOS mình **đã gọi đúng API** (`ThingActivatorModeAP` + `startConfigWiFi:` +
  `getTokenWithHomeId:`) ⇒ **không phải sửa native**, chỉ sửa UI/nội dung.

---

## Khái niệm & luồng

**AP mode (hotspot mode)** = điện thoại đóng vai **station (STA)**, nối vào **hotspot do chính thiết
bị phát ra**, hai bên dựng socket rồi trao đổi dữ liệu qua cổng quy định.
> *"Also known as the hotspot mode. A mobile phone acts as a station (STA) and connects to the
> hotspot of a smart device. Then, both devices are paired to establish a socket connection between
> them and exchange data through the specified ports."*
> — [Device Pairing](https://developer.tuya.com/en/docs/app-development/wifinetwork?id=Ka6ki8lbwu82c)

Khác biệt bản chất với EZ: EZ **phát mù** gói multicast qua router (nên mới cần entitlement
multicast của Apple, và nên mới **không discovery được**); AP thì **nối thẳng** vào thiết bị nên
không đụng gì tới multicast.

### Luồng theo doc iOS (nguyên văn từng bước)

> 1. *"Guide the user to reset the device to Wi-Fi AP mode, typically identified by a **slow-blinking**
>    Wi-Fi indicator."*
> 2. *"Guide the user to connect their phone to a Wi-Fi network, usually a 2.4 GHz Wi-Fi network."*
> 3. *"Guide the user to connect their phone to the AP emitted by the device."*
> 4. App gọi hàm pairing kèm credentials + token.
> 5. *"The device automatically turns off the AP. The app receives a callback from the SDK and
>    finishes the pairing process."*
> — [AP Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-host?id=Kaixw35qn5d1l)

⚠️ Chú ý bước 2 **và** bước 3: user phải nối Wi-Fi nhà **trước** (để app biết SSID/password truyền
cho thiết bị), rồi **mới** đổi sang hotspot của thiết bị. `ssid`/`password` truyền vào API là **của
router**, KHÔNG phải của hotspot thiết bị:
> *"The ssid and password respectively specify the hotspot name and password of the **router** rather
> than that of the device."* — [Wi-Fi AP Mode (iOS)](https://developer.tuya.com/en/docs/app-development/activator_wifiAp_ios?id=Kcy2tw5udfv32)

### Bước user-facing (nguyên văn từ SmartLife user manual)

> 1. *"follow the instructions to enable the indicator to **blink slowly**, select **Confirm the
>    indicator is blinking slowly**, and then tap **Next**"*
> 2. *"on the Wi-Fi setting page of the mobile phone, find the Wi-Fi hotspot **starting with
>    `SmartLife`**"*
> 3. *"Tap the **Wi-Fi** hotspot to connect the mobile phone to it"*
> 4. *"After a successful connection, **go back to the app** to start pairing"*
> 5. *"After the device is added, the user can **customize the device name** and specify the room…"*
>
> *"The mobile phone must be connected to a **2.4 GHz** Wi-Fi network."*
> — [SmartLife user manual](https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk)

**Đèn: AP = nháy CHẬM · EZ = nháy NHANH** (user manual, nguyên văn: *"enable the indicator to blink
slowly"* cho AP vs *"enable the indicator to blink quickly"* cho EZ).

---

## API chính

| Platform | Class/Method | Params | Callback/Return | Ghi chú |
|---|---|---|---|---|
| iOS | `-[ThingSmartActivator getTokenWithHomeId:success:failure:]` | `long long homeId` | `ThingSuccessString` / `ThingFailureError` | Token **10 phút**, chết sau 1 lần pair |
| iOS | `-[ThingSmartActivator startConfigWiFi:ssid:password:token:timeout:]` | `ThingActivatorMode mode` = **`ThingActivatorModeAP`** · ssid/password **của router** · token · timeout | qua delegate | Y hệt EZ, **chỉ đổi mode** |
| iOS | `-[ThingSmartActivator startConfigWiFi:ssid:password:token:regInfo:timeout:]` | thêm `nullable NSDictionary *regInfo` | qua delegate | Biến thể có regInfo |
| iOS | `-[ThingSmartActivator stopConfigWiFi]` | - | - | **Bắt buộc gọi** khi rời màn/cancel |
| iOS | delegate `-activator:didReceiveDevice:error:` | `ThingSmartDeviceModel *` · `NSError *` | - | Kênh trả kết quả |
| Android | `ActivatorBuilder().setActivatorModel(ActivatorModelEnum.TY_AP)` + `newActivator(builder)` | ssid/password/token/timeout/listener | `IThingSmartActivatorListener` | Doc dùng `TY_AP` (code mình dùng `THING_AP` - xem Cạm bẫy) |

**iOS - nguyên văn signature:**
```objc
- (void)getTokenWithHomeId:(long long)homeId
                   success:(ThingSuccessString)success
                   failure:(ThingFailureError)failure;

- (void)startConfigWiFi:(ThingActivatorMode)mode
                   ssid:(NSString *)ssid
               password:(NSString *)password
                  token:(NSString *)token
                regInfo:(nullable NSDictionary *)regInfo
                timeout:(NSTimeInterval)timeout;

- (void)stopConfigWiFi;

- (void)activator:(ThingSmartActivator *)activator
    didReceiveDevice:(ThingSmartDeviceModel *)deviceModel
               error:(NSError *)error;
```

> *"The AP mode is similar to the EZ mode, except that the first parameter of
> `[self.apActivator startConfigWiFi:ssid:password:token:timeout:]` is set to `ThingActivatorModeAP`
> for the AP mode."* — [Wi-Fi AP Mode (iOS)](https://developer.tuya.com/en/docs/app-development/activator_wifiAp_ios?id=Kcy2tw5udfv32)

### AP Plus (`ThingActivatorModeAPPlus`) - thế hệ mới, KHÔNG dùng ở dự án này
```objc
- (void)connectDeviceAndQueryWifiListWithTimeout:(NSTimeInterval)timeout;
- (void)resumeAPPlusWithSSID:(NSString *)ssid password:(NSString *)password
                       token:(NSString *)token timeout:(NSTimeInterval)timeout
                         reg:(NSDictionary *)reg;
```
Cho phép **thiết bị quét hộ danh sách Wi-Fi** rồi user chọn (tự lọc bỏ 5GHz không hỗ trợ). Nhưng
**3 điều kiện tiên quyết** (xem mục dưới) khiến nó ngoài tầm hiện tại.

---

## ❌ ĐÍNH CHÍNH (2026-07-16) - "Android SDK tự nối hotspot" KHÔNG đáng tin

Bảng dưới ghi khác biệt "Android tự nối hotspot / iOS thì không", lấy từ **một dòng** trong doc
Android: *"During the pairing process, the SDK automatically connects to the hotspot of the device
within a certain period."* **Client phản hồi rằng AP phải hướng dẫn user tự nối vào Wi-Fi của thiết
bị** - và xét lại thì client đúng, dòng doc đó có ít nhất **hai vấn đề**:

1. **Nó mâu thuẫn với chính SmartLife user manual** (nguồn 5) - manual mô tả **app chạy thật** và
   bảo user *"on the Wi-Fi setting page of the mobile phone, find the Wi-Fi hotspot starting with
   `SmartLife`"*. Manual không hề phân biệt iOS/Android ở bước này.
2. **Nhiều khả năng lỗi thời:** từ **Android 10 (API 29)** Google đã bỏ khả năng app tự bật/nối
   Wi-Fi ngầm (`WifiManager.enableNetwork` bị vô hiệu hoá cho app thường); muốn nối phải qua
   `WifiNetworkSpecifier` → **hệ thống hiện dialog hỏi user**, không còn "tự động" theo nghĩa im
   lặng. App này `targetSdkVersion=36` ⇒ chắc chắn dính ràng buộc đó.

⇒ **Quyết định:** hướng dẫn AP trên **cả 2 nền tảng** đều bảo user **tự nối vào hotspot
`SmartLife…`**. Nếu SDK/hệ thống có tự nối thật thì user chỉ thấy nó đã nối sẵn - **không hại gì**;
còn nếu không tự nối (giả thuyết đang nghiêng về) thì hướng dẫn cũ sẽ khiến pair **fail mà user
không hiểu vì sao**. Chọn hướng an toàn hai chiều.

🔴 **Cần B6 xác nhận trên máy thật:** trên SM-A325F, chạy AP mà **không** tự nối hotspot - SDK có tự
nối không? Có hiện dialog hệ thống không? Kết quả ghi lại đây và sửa bảng dưới cho đúng.

📌 *Bài học: một dòng doc mô tả hành vi nền tảng có thể đã lỗi thời nhiều năm. Khi nó **mâu thuẫn
với user manual của chính app đó**, tin manual - hoặc tin thiết bị thật.*

---

## Khác biệt iOS vs Android (quan trọng cho RN bridge)

> ⚠️ Dòng "tự nối hotspot" trong bảng này **đã bị đính chính** - xem mục ngay trên.

| | iOS | Android |
|---|---|---|
| **Tự nối hotspot thiết bị?** | ❌ **KHÔNG.** Doc chỉ nói *"Guide the user to connect their phone to the AP emitted by the device"* ⇒ user **tự vào Settings**. | ✅ **CÓ.** *"During the pairing process, the SDK **automatically connects to the hotspot of the device** within a certain period."* |
| **Hệ quả UX** | Phải có màn hướng dẫn "ra Settings nối `SmartLife…` rồi quay lại" | Bấm là chạy, không cần rời app |
| **EZ dùng được?** | ⚠️ iOS 14.5+ **cần entitlement multicast** (Apple duyệt) | ✅ Không vướng |
| **Enum AP** | `ThingActivatorModeAP` | `ActivatorModelEnum.TY_AP` |

⚠️ **Tuya docs KHÔNG hề nhắc `NEHotspotConfiguration`** (API iOS cho phép app tự join Wi-Fi). Không
có nguồn chính thống nào nói SDK dùng nó ⇒ **không được giả định iOS tự nối được**. Nếu sau này muốn
tự động hoá bước này thì phải tự wire `NEHotspotConfiguration` + capability **Hotspot Configuration**
của Apple → **ngoài scope hiện tại**, và cần research riêng.

---

## Điều kiện tiên quyết & cấu hình

### AP thường (legacy) - cái mình dùng
**KHÔNG có prerequisite nào.** Đã kiểm tra có chủ đích: mục AP legacy trong doc iOS **không liệt kê**
entitlement, capability, thư viện thêm, hay yêu cầu firmware tối thiểu.

### AP Plus - KHÔNG dùng
3 điều kiện (nguyên văn, thuộc mục **"New AP pairing process"**):
> - *"Log in to the Apple Developer platform and enable **Hotspot**."*
> - *"Integrate the **`ThingSmartHotspotCredentialKit`** library into your project."*
> - *"The TuyaOS version of the firmware built into the target device must be **v3.6.1 or later**."*

📌 **Đây chính là chỗ dễ đọc nhầm thành "AP cũng cần Apple duyệt".** Không phải. Đã fetch riêng để
xác minh vị trí của 2 dòng này: chúng nằm dưới heading **"New AP pairing process"**, không phải
prerequisite chung của trang.

### EZ trên iOS - vì sao bỏ
> *"The app built with Xcode 12.5 cannot send the EZ pairing data packets from iPhone that runs
> **iOS 14.5 or later**. In this case, the permission `com.apple.developer.networking.multicast`
> must be enabled for the app."* — [Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kaixvcn8gy8o0)

> *"For iOS 14.5 and later, **we recommend that you use the AP mode instead of the Wi-Fi EZ mode**."*
> — cùng nguồn

⇒ Quyết định của client ("iOS để AP, EZ chưa support") **khớp đúng khuyến nghị chính chủ của Tuya**.

---

## Mã lỗi thường gặp & cách xử lý

Doc AP iOS có mục **"Error codes"** nhưng WebFetch không bóc được bảng chi tiết → **chưa verify**.
Mã đã biết từ note cũ, còn hiệu lực:
- `-55` - token hết hạn (quá 10 phút hoặc đã dùng để pair 1 lần) → lấy token mới trước **mỗi** lần pair.
- `65` (iOS `NSError.code`, message `"Timeout"`) - activator timeout → đã map sang `pairing_timeout`
  trong `packages/tuya-react-native/src/errors.ts` (commit 992e6c6).
- Xem thêm [tuya-home-sdk-error-codes.md](tuya-home-sdk-error-codes.md).

---

## ✅ Verbatim từ HEADER SDK THẬT (2026-07-16) - `getDeviceSecurityConfigs` thuộc AP **legacy**

Ban đầu tôi nghi `getDeviceSecurityConfigs` thuộc **AP Plus** (vì heading doc Android xếp "Get list of
security configurations" dưới mục "New process"). **Sai.** Fetch lại trang iOS + đọc **header SDK
thật** trong `Pods/` xác nhận nó thuộc **Legacy pairing process**:

```objc
// Pods/ThingSmartActivatorCoreKit/.../Headers/ThingSmartActivator.h:130-138 (nguyên văn)
- (void)getDeviceSecurityConfigs:(ThingSuccessDict)success
                         failure:(ThingFailureError)failure;

- (void)startConfigWiFi:(ThingActivatorMode)mode
                   ssid:(NSString *)ssid
               password:(NSString *)password
                  token:(NSString *)token
                regInfo:(nullable NSDictionary *)regInfo
                timeout:(NSTimeInterval)timeout;
```

⇒ **Luồng AP legacy đúng là 3 bước:** `getTokenWithHomeId:` → `getDeviceSecurityConfigs:` →
`startConfigWiFi:...regInfo:timeout:`. Code mình **đang thiếu bước 2** và gọi biến thể **không có
`regInfo`** ⇒ đã sửa (xem `TuyaPairing.mm`, `doWifiPairingMode:`).

- `regInfo` doc chỉ mô tả *"The security configuration information"*, **không nói nội dung** - lấy
  nguyên dict từ `getDeviceSecurityConfigs` truyền thẳng vào.
- `regInfo` là **`nullable`** ⇒ lookup hỏng thì vẫn pair được với `nil`, **không** chặn luồng.
- **EZ giữ nguyên** biến thể không `regInfo` (doc EZ chỉ dùng biến thể đó).

📌 *Bài học: heading của doc Android không suy ra được cấu trúc doc iOS. Có `Pods/` trên máy thì đọc
header thật - 30 giây, và chắc chắn hơn mọi suy đoán.*

---

## Cạm bẫy / lưu ý cho dự án ice-bath

1. 🔴 **Nội dung hướng dẫn AP hiện tại trong `apps/mobile/src/services/pairingModes.ts` SAI/THIẾU:**
   nó bảo user "join network starting with SmartLife" nhưng **bỏ mất bước đèn nháy CHẬM** - bước vật
   lý đầu tiên và quan trọng nhất. Phải viết lại theo 5 bước user manual ở trên. (Đây đúng là lý do
   client bảo "ghi rõ làm sao để kết nối được với AP".)
2. 🟡 **Hướng dẫn AP phải KHÁC NHAU theo nền tảng.** Android SDK tự nối hotspot ⇒ bảo user "ra
   Settings nối SmartLife…" trên Android là **hướng dẫn thừa và gây hoang mang**. iOS mới cần.
3. ✅ **Native iOS không phải sửa:** `TuyaPairing.mm:113` đã chọn đúng
   `ThingActivatorModeAP` khi `mode == "AP"`, và dùng `startConfigWiFi:` + `getTokenWithHomeId:`
   (đã verify header, xem comment dòng 9 của file). Việc còn lại thuần UI.
4. ⚠️ **`ssid`/`password` là của ROUTER, không phải của hotspot thiết bị.** Nếu UI để user hiểu nhầm
   mà gõ mật khẩu hotspot `SmartLife…` vào thì pair fail 100% - và lỗi trả về sẽ không nói gì về
   nguyên nhân này.
5. ⚠️ **Android dùng `THING_AP`, doc ghi `TY_AP`.** Code mình (`TuyaPairingModule.kt:101`) dùng
   `ActivatorModelEnum.THING_AP` và **compile Kotlin ✅** ⇒ enum tồn tại thật trên SDK 7.5.6 (đây là
   đợt Tuya đổi tên thương hiệu `Tuya*` → `Thing*`). **Không phải bug**, nhưng đừng hoang mang khi
   đọc doc thấy khác code.
6. ⚠️ **AP không có discovery**, giống EZ. Nó **không** đưa được blip lên radar. Đúng như thiết kế
   `m1-pairing-radar-discovery` đã chốt: AP chỉ nằm trong dropdown, không nằm trong `auto`.
7. 📌 **Nghi vấn citation ở note cũ:** [tuya-auto-scan-discovery.md](tuya-auto-scan-discovery.md)
   gán câu *"the user finds the Wi-Fi hotspot starting with SmartLife"* cho trang **AP Mode**
   (`hotspot-mode?id=Kaixk6wxla1oy`). Fetch lại có chủ đích trang đó **không tìm thấy** chuỗi
   "SmartLife" (đã hỏi thẳng, model trả "NO SSID NAME ON PAGE", và list heading không có mục nào về
   tên hotspot). Nguồn **chắc chắn** của câu đó là **SmartLife user manual** (đã fetch, khớp nguyên
   văn). Chưa đủ căn cứ khẳng định note cũ sai (trang có thể đã đổi, hoặc WebFetch bỏ sót) → **dùng
   user manual làm nguồn khi trích câu này.**

---

## Câu hỏi mở / cần xác minh trên thiết bị

- ❓ **AP có thật sự chạy khi điện thoại ở băng 5GHz không?** Hai câu doc căng nhau:
  *"adapts to 2.4 GHz and 5 GHz dual-band routers. However, users need to manually switch between the
  Wi-Fi bands connected to the mobile phone"* (AP doc) vs *"The mobile phone must be connected to a
  2.4 GHz Wi-Fi network"* (user manual). Đọc hợp lý nhất: **router** dual-band thì OK, nhưng **SSID
  truyền cho thiết bị vẫn phải là mạng 2.4GHz** (bản thân thiết bị chỉ có radio 2.4GHz). ⇒ **Giữ
  nguyên preflight chặn 5GHz** (`pairingPreflight.ts`) cho tới khi có bằng chứng ngược lại;
  **không** nới lỏng chỉ vì đọc được chữ "adapts to … 5 GHz".
- ❓ Bảng **Error codes** của trang AP iOS chưa bóc được → khi có lỗi AP thật trên máy, đọc lại trang
  và bổ sung vào [tuya-home-sdk-error-codes.md](tuya-home-sdk-error-codes.md).
- ❓ Firmware của bồn Walrus có ≥ TuyaOS v3.6.1 không (mở đường cho AP Plus sau này, đỡ được bước bắt
  user tự đổi Wi-Fi)? Cần hỏi nhà sản xuất - **chưa cần cho scope hiện tại**.
- ❓ Trên iOS, sau khi user nối vào hotspot `SmartLife…` thì điện thoại **mất internet** → có ảnh
  hưởng bước lấy token không? Doc nói lấy token *"in the networked state"* ⇒ **phải lấy token TRƯỚC
  khi rời Wi-Fi nhà**. Cần verify trên máy thật; nếu đúng thì thứ tự gọi trong app phải là
  token → (user đổi Wi-Fi) → `startConfigWiFi:`, **không** phải auto-token ngay lúc bấm Start.
  ⚠️ Hiện `pairWifi()` dùng `startWifiPairingAuto` (**tự lấy token bên trong**, ngay trước khi chạy)
  → trên iOS/AP điều này có thể lấy token **khi đã mất mạng** ⇒ fail. **Đây là rủi ro thật, cần test.**

---

## Nguồn (đầy đủ URL đã đọc)

1. [AP Mode (iOS) - doc client chỉ định](https://developer.tuya.com/en/docs/app-development/iOS-network-host?id=Kaixw35qn5d1l) - luồng 5 bước · `startConfigWiFi:...regInfo:timeout:` · `getTokenWithHomeId:` · token 10 phút · AP Plus prerequisites (Hotspot capability + `ThingSmartHotspotCredentialKit` + TuyaOS ≥3.6.1) · AP legacy **không** prerequisite
2. [Wi-Fi AP Mode (iOS)](https://developer.tuya.com/en/docs/app-development/activator_wifiAp_ios?id=Kcy2tw5udfv32) - "chỉ đổi tham số đầu thành `ThingActivatorModeAP`" · ssid/password là **của router** · "adapts to 2.4/5 GHz dual-band"
3. [Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kaixvcn8gy8o0) - entitlement `com.apple.developer.networking.multicast` cho iOS 14.5+ · **"we recommend that you use the AP mode instead"** · EZ 2.4GHz
4. [AP Mode (Android)](https://developer.tuya.com/en/docs/app-development/hotspot-mode?id=Kaixk6wxla1oy) - **"the SDK automatically connects to the hotspot of the device"** · `ActivatorModelEnum.TY_AP` · code sample
5. [SmartLife user manual](https://developer.tuya.com/en/docs/iot/user-manual-for-tuya-smart-v3177?id=K9obrofrfk4sk) - 5 bước user-facing · hotspot **"starting with `SmartLife`"** · đèn AP **chậm** / EZ **nhanh** · "must be connected to a 2.4 GHz Wi-Fi network"
6. [Device Pairing (overview)](https://developer.tuya.com/en/docs/app-development/wifinetwork?id=Ka6ki8lbwu82c) - định nghĩa AP = điện thoại làm STA nối hotspot thiết bị

- Liên quan: [tuya-wifi-ez-pairing-failure.md](tuya-wifi-ez-pairing-failure.md) · [tuya-auto-scan-discovery.md](tuya-auto-scan-discovery.md) · [tuya-home-sdk-device-pairing.md](tuya-home-sdk-device-pairing.md) · [tuya-home-sdk-error-codes.md](tuya-home-sdk-error-codes.md)
