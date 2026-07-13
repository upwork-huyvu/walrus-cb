# Context: Fix pairing Wi-Fi (EZ) thất bại + lỗi không chi tiết

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-fix-wifi-pairing`

## Quyết định kỹ thuật (Decision log)

- **2026-07-10** - **Làm observability (B1-B3) TRƯỚC khi sửa nguyên nhân (B4-B5).**
  Lý do: hiện không có bất kỳ log nào; nếu thêm permission trước thì không có cách nào biết fix có ăn không,
  và mọi thất bại đều quy về cùng một chuỗi `Unknown error`. Đã cân nhắc & loại: nhảy thẳng vào thêm
  entitlement/permission (rủi ro "sửa mù", và entitlement iOS còn phải chờ Apple duyệt).

- **2026-07-10** - **Giữ `TuyaErrors.describe()` nhưng chỉ dùng làm phần diễn giải bổ sung**, không thay message native.
  Lý do: bảng `SDK_CODES` vẫn hữu ích để phân loại (retryable / needsNewToken / needsReLogin), nhưng nó
  **không được phép nuốt** `error.message` gốc. Đã cân nhắc & loại: bỏ hẳn `TuyaErrors` (mất luôn khả năng
  phân loại lỗi để auto-retry / re-login).

- **2026-07-10** - ~~**Ưu tiên sửa luồng EZ**~~ → **ĐẢO HƯỚNG sau research: AP mode là đường pair chính.**
  Lý do đảo: doc Tuya xác nhận iOS 14.5+ **không thể** gửi gói EZ nếu thiếu entitlement `networking.multicast`
  (Apple duyệt 3-5 ngày, form đòi App Store URL mà app chưa phát hành). Tuya **tự khuyến nghị dùng AP mode**.
  AP còn né luôn nghi vấn 5GHz. Đã cân nhắc & loại: (a) chờ Apple duyệt rồi mới làm gì (chặn tiến độ vô thời hạn);
  (b) sửa code EZ (vô nghĩa - vấn đề không nằm ở code).
  → Entitlement vẫn nộp **song song** (B5) để sau này có EZ, nhưng **không phải điều kiện hoàn thành**.

- **2026-07-10** - **AC1/AC2 viết lại thành "EZ hoặc AP"** thay vì bắt buộc EZ.
  Lý do: EZ trên iOS phụ thuộc Apple - một bên thứ ba mình không kiểm soát. Đặt AC phụ thuộc nó = tự khoá mình.

- **2026-07-10** - **Vẫn giữ Smart Life làm chứng cứ "phần cứng OK"**, nhưng không suy ra "app mình chỉ cần sửa code".
  Lý do: Smart Life pair EZ được vì **Tuya đã có entitlement**, không phải vì code họ đúng hơn.
  Đây là điểm tao suy luận sai ở vòng plan đầu.

- **2026-07-10 (B2)** - **`describeError()` ưu tiên `message` native, `TuyaErrors.describe()` chỉ là diễn giải THÊM
  và CHỈ áp cho mã số.** Lý do: mã phi-số (`pairing_error`, `ble_scan_required`) luôn rơi vào category `'unknown'`
  → sinh ra đúng chuỗi "Unknown error." trong ảnh của khách. Đã cân nhắc & loại: (a) bỏ hẳn `TuyaErrors`
  (mất khả năng phân loại retryable/needsNewToken/needsReLogin); (b) thêm mã phi-số vào bảng `SDK_CODES`
  (bảng là để tra **mã SDK**, nhét literal của mình vào là làm bẩn contract).

- **2026-07-10 (B2)** - **Chưa động vào bảng `SDK_CODES`** dù research nghi nó sai miền (dương vs âm).
  Lý do: sau B2, `message` native luôn được giữ ⇒ độ chính xác của bảng **không còn nằm trên đường tới hạn**.
  Sửa bảng mà không có ground truth = rủi ro map sai. Giữ làm câu hỏi mở, chờ log thật ở B3/B7.

- **2026-07-10 (B4)** - **iOS mặc định AP, Android giữ EZ** (không ép cả 2 về AP).
  Lý do: EZ trên iOS chắc chắn hỏng (thiếu entitlement) nên đổi là bắt buộc; còn Android **chưa chứng minh được**
  EZ hỏng vì gì → giữ EZ để B7 còn quan sát được nguyên nhân thật. Đổi cả 2 sang AP = **giấu mất bug Android**.

- **2026-07-10 (B5)** - **KHÔNG thêm `com.apple.developer.networking.multicast` vào entitlements ngay.**
  Lý do: provisioning profile chưa có quyền đó → **Xcode fail lúc ký** → phá build đang chạy được của dev,
  đổi lấy một capability chưa dùng được (Apple chưa duyệt). Viết `PAIRING_MULTICAST_SETUP.md` và gate sau bước duyệt.
  Đã cân nhắc & loại: thêm sẵn "cho đủ" (sai - biến một vấn đề runtime thành vấn đề build).

- **2026-07-10 (B6)** - **iOS: nói thẳng "không kiểm được băng tần" thay vì im lặng cho qua.**
  Lý do: `getFrequency()` là Android-only. Im lặng ⇒ user tưởng app đã kiểm và loại trừ 5GHz.
  Đã cân nhắc & loại: đoán băng tần từ tên SSID (bịa).

- **2026-07-10 (FIX-PLAN, +B8 +B9)** - **Thêm luồng BLE-discovery-first (giống Smart Life) + vá security-level/bleType.**
  Trigger: user muốn flow "tìm → chạm → nhập wifi → xong". Research (sample ObjC + Auto Scan doc) cho thấy:
  (1) Smart Life "Auto Scan" = quét **BLE beacon**; thiết bị Tuya Wi-Fi đời mới là **combo** (Wi-Fi + BLE) →
  đó là lý do sensor "không phải Bluetooth" vẫn bị tìm ra. (2) Sample route theo `bleType`; native mình **vứt**
  `bleType` (hardcode `deviceType=0`). (3) Sample có security-level handshake mình **thiếu**.
  → **B8** đẩy `bleType` thật + wire `continueConfigSecurityLevelDevice`; **B9** đảo UX sang BLE-discovery-first,
  giữ EZ/AP làm "Add manually" fallback. Đã cân nhắc & loại: (a) bỏ EZ/AP hẳn (thiết bị Wi-Fi thuần + iOS không
  quét được Wi-Fi list → phải giữ fallback); (b) viết lại native (không cần - `startBleScan`/`pairBleWifi` đã có,
  chỉ thiếu `bleType` + UX). **Thứ tự bắt buộc: B8 trước B9** (B9 route dựa vào `bleType` của B8).
  Đây là **mở rộng scope** (từ "sửa lỗi pairing" → "thêm luồng pairing kiểu Smart Life") - user đã duyệt.

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/screens/PairingScreen.tsx` | UI 5 màn (intro→prepare→searching→found→connecting→paired/error). Gọi `pairWifi`/`pairBleWifi`. Màn `error` hiện `describeError(e)` - chỗ chuỗi "Unknown error" lòi ra. |
| `apps/mobile/src/services/pairing.ts` | Adapter JS: `pairWifi` · `pairBleWifi` · `onPairingProgress` · `pairingStepLabel()` · **`describeError()` (BUG: nuốt message)**. Có mock layer khi native vắng. |
| `packages/tuya-react-native/src/errors.ts` | `TuyaErrors.classify/describe` - bảng code → category. `describe()` sinh chuỗi `[domain:code] text`. |
| `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm` | Native iOS. **BUG: reject bằng literal `@"pairing_error"`** (dòng ~104, ~183, ~158) thay vì `NSError.code`. Emit step = **số enum**. |
| `packages/tuya-react-native/android/.../pairing/TuyaPairingModule.kt` | Native Android. Truyền code thật nhưng **thiếu `domain`**; `onStep` trả chuỗi thật (khác iOS). |
| `packages/tuya-react-native/ios/Common/TuyaReject.h` | Helper `TuyaRejectWithDomain()` - **đã tồn tại nhưng Pairing iOS không dùng**. |
| `packages/tuya-react-native/android/.../common/TuyaReject.kt` | Helper Kotlin tương ứng - cũng chưa được Pairing dùng. |
| `apps/mobile/ios/CoolBathMobile/Info.plist` | ĐÃ có `NSLocalNetworkUsageDescription` + `NSLocationWhenInUseUsageDescription`. |
| `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements` | Có `networking.wifi-info`. **THIẾU `com.apple.developer.networking.multicast`**. |
| `apps/mobile/android/app/src/main/AndroidManifest.xml` | **THIẾU `CHANGE_WIFI_MULTICAST_STATE` + `NEARBY_WIFI_DEVICES`**. |
| `apps/mobile/src/services/wifiScanner.ts` | Scan/đọc SSID hiện tại. **B6 thêm** `bandOfFrequency()` + `getCurrentWifiBand()`. ⚠️ `getFrequency()` của wifi-reborn là **Android only** → iOS không đọc được băng tần. |
| `apps/mobile/src/services/pairingLog.ts` **(mới, B3)** | Ring buffer 120 event, **redact password/token**, `dumpPairingLog()` → chuỗi copy được (header platform + timeline tương đối). |
| `apps/mobile/src/services/pairingPreflight.ts` **(mới, B6)** | Chặn sớm: SSID rỗng · EZ trên 5GHz/6GHz. Cảnh báo: EZ trên iOS (entitlement) · không đọc được băng tần. |
| `apps/mobile/PAIRING_MULTICAST_SETUP.md` **(mới, B5)** | Hướng dẫn xin entitlement Apple. **Entitlement CỐ Ý chưa thêm vào repo** (xem decision log). |
| `pairing.ts` → `deviceNeedsWifi()` **(B8)** | Route combo vs BLE-thuần. iOS `bleType∈{4,6,7,9,11}` / Android `configType` chứa "wifi" / cờ `isCombo` native. Mặc định `true`. |
| `pairing.ts` → `pairBle()` **(B9)** | Pair BLE thuần (không Wi-Fi) - cho thiết bị `bleType` BLE/BLEPlus/... khi chạm ở luồng discovery. |
| `TuyaPairing.mm` → `didPassWIFIToSecurityLevelDeviceWithUUID:` **(B8)** | Auto `continueConfigSecurityLevelDevice` + emit `sdk.security_level_continue`. Thiết bị `*Security` hết treo. |
| `PairingScreen.tsx` **(B9)** | Initial `'searching'` + effect auto-scan. `found` route theo `deviceNeedsWifi` (combo hỏi Wi-Fi sau khi chạm). `intro`(EZ/AP) = "Add manually". |

## Phát hiện & cạm bẫy (Findings / Gotchas)

### 🔴 Chuỗi sinh ra `[sdk:pairing_error] Unknown error.` (đã truy vết đủ 4 mắt xích)
1. `TuyaPairing.mm:104` → `self.wifiReject(@"pairing_error", error.localizedDescription, error)`
   - RN đặt `e.code = "pairing_error"`; **`NSError.code` thật (mã Tuya) bị vứt**.
2. `pairing.ts:164` → `const code = e?.code ?? e?.userInfo?.code` → `"pairing_error"` (khác null).
3. `pairing.ts:167` → `return lib.TuyaErrors.describe(code)` → **`e.message` bị bỏ hoàn toàn**.
4. `errors.ts:145` → `"pairing_error"` không có trong `SDK_CODES`, `Number(...)` = NaN → category `'unknown'`
   → `errors.ts:198` → `` `[sdk:pairing_error] Unknown error.` `` ✅ khớp ảnh chụp của khách.

> Trớ trêu: comment đầu `errors.ts` viết sẵn *"All native modules SHOULD reject with the TuyaError shape
> { code, message, domain } … Never collapse codes to '-1'"* - và helper `TuyaReject.h`/`.kt` đã có sẵn,
> chỉ là module Pairing **chưa hề dùng**.

### 🔴 iOS: THIẾU entitlement multicast → EZ *không thể* chạy (✅ XÁC MINH BẰNG DOC, 2026-07-10)
`CoolBathMobile.entitlements` chỉ có `aps-environment` · `applesignin` · `networking.wifi-info`,
**thiếu `com.apple.developer.networking.multicast`**.

> *"the app built with Xcode 12.5 cannot send the EZ pairing data packets from iPhone that runs iOS 14.5
> or later, and in this case, the permission `com.apple.developer.networking.multicast` must be enabled"*
> — [Tuya: Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j)

`NSLocalNetworkUsageDescription` (đã có) chỉ phủ **unicast LAN + Bonjour**, **không** phủ multicast/broadcast.
Hai thứ khác nhau - đừng nhầm. Entitlement **phải xin Apple duyệt, 3-5 ngày làm việc**, form đòi App Store URL.
⇒ **Smart Life pair được vì Tuya đã có entitlement này.** Đây chính xác là khác biệt.

### ❌ Android: giả thuyết permission ĐÃ BỊ TAO BÁC BỎ (2026-07-10)
~~`AndroidManifest.xml` thiếu `CHANGE_WIFI_MULTICAST_STATE`~~ - **SAI**. Tao grep **manifest nguồn**,
quên mất **manifest merger**. Đọc lại
`app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`:

```
CHANGE_WIFI_MULTICAST_STATE   ← CÓ (AAR thingsmart:7.5.6 tự khai)
CHANGE_WIFI_STATE / ACCESS_WIFI_STATE / ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION  ← CÓ
NEARBY_WIFI_DEVICES           ← không có (nhưng CHƯA chứng minh được là cần)
```

`ACCESS_FINE_LOCATION` cũng **đã xin runtime** ở `wifiScanner.ts:23-24`. `targetSdkVersion = 36`.

⇒ **Android fail vì lý do KHÁC, chưa xác định.** Ứng viên: **Wi-Fi 5GHz** (thứ duy nhất giải thích được
*cả 2 nền tảng cùng fail*) · Location Services tắt cấp hệ thống · bồn không ở EZ mode · token/DC.

> 📌 **Bài học quy trình:** với Android permission, **luôn đọc merged manifest**, đừng grep manifest nguồn.

### 🟢 AP mode là đường thoát chính thức (Tuya khuyến nghị)
> *"For iOS 14.5 and later, we recommend that you use the **AP mode** instead of the Wi-Fi EZ mode."*
> AP: *"higher success rate, optimal reliability, fewer compatibility requirements"* ·
> *"supports routers that can process data using both 2.4 GHz and 5 GHz frequencies."*

AP nối điện thoại vào **hotspot của bồn** → **không dùng broadcast/multicast** → né **cả** entitlement (iOS)
**lẫn** nghi vấn 5GHz (2 nền tảng). Native AP **đã wire sẵn** (`ThingActivatorModeAP` / `THING_AP`).

### 🟡 `errors.ts` có thể map sai miền mã lỗi
`SDK_CODES` đang map `1001..1007` (**số dương**) = `pairing_failed`/`pairing_timeout`. Nhưng
[doc Error Codes](https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a) chính chủ
dùng **số âm**: `-33` token timeout · `-55` token hết hạn · `-56` token không khớp · `-57` verify fail ·
`-1006` device offline · `-1000`/`-1010` param invalid. **Chưa tìm được nguồn của dãy dương** → rà lại ở B2.

### 🔵 `ThingActivatorStep` - GIÁ TRỊ THẬT (lấy từ header SDK trên đĩa, 2026-07-10 · B1)
Research note ghi "doc Tuya không liệt kê". **Header thì có.** Nguồn:
`ios/Pods/ThingSmartPairingCoreKit/.../ThingSmartPairingHeader.h`

```objc
typedef NS_ENUM(NSUInteger, ThingActivatorStep) {
    ThingActivatorStepFound        = 1,  ///< device found
    ThingActivatorStepRegisted     = 2,  ///< device registered
    ThingActivatorStepIntialized   = 3,  ///< device initialized
    ThingActivatorStepTimeOut      = 4,  ///< device config timeout   ← LỖI, KHÔNG PHẢI TIẾN TRÌNH
    ThingActivatorStepStartDialUp  = 41, ///< 4G gateway start dialing
    ThingActivatorStepConnectSuccess = 42,
};
```

### 🔵 Enum route bleType - GIÁ TRỊ THẬT (B8, lấy verbatim từ SDK trên đĩa)
**iOS `ThingSmartBLEType`** (header `ThingBLEAdvModel.h`): `Unknow=1, BLE=2, BLEPlus=3, BLEWifi=4,
BLESecurity=5, BLEWifiSecurity=6, BLEWifiPlugPlay=7, BLEZigbee=8, BLELTESecurity=9, BLEBeacon=10, BLEWifiPriorBLE=11`.
→ **Combo (cần Wi-Fi) = {4,6,7,9,11}**.
**Android `ScanDeviceBean.getConfigType()`** (javap trên `thingsmart-bluetooth-business-api-7.5.6`): các hằng
`config_type_single/wifi/wifi_p/beacon/beacon_mesh/together/together_sig/cat/zigbee`.
→ **Combo = configType chứa "wifi"** (`config_type_wifi`, `config_type_wifi_p`). Bean còn có `getProviderName()`,
`getDeviceType():int`, `getFlag():int`.
⚠️ 2 nền tảng biểu diễn KHÁC nhau (iOS int enum vs Android string) → native mỗi bên tự tính `isCombo` + đẩy raw;
JS `deviceNeedsWifi()` nhận cả 3 (isCombo ưu tiên → bleType → configType → default true).

### 🔴 3 bug MỚI ở step callback iOS (phát hiện khi làm B1 - để B3 xử lý)
Protocol thật (`Pods/ThingSmartActivatorCoreKit/.../ThingSmartActivator.h`):
`activator:didReceiveDevice:step:error:` là **@optional** và **CÓ được gọi**
*(tao từng nghi nó là dead code - **sai**, grep hụt vì header PairingCoreKit có protocol khác)*.

1. **`error` của step callback bị VỨT HOÀN TOÀN.** Signature có `error:` nhưng
   `TuyaPairing.mm:118` chỉ emit `step`, bỏ qua `error`. Header SDK ghi rõ SDK báo lỗi **qua đường này**:
   > *"If this callback is received, the step is `ThingActivatorStepFound`, and
   > `ThingSmartPairingConnectWiFiFailedErrorDomain` is returned."*

   ⇒ Lỗi "thiết bị không join được Wi-Fi" đến qua đây và **app im lặng nuốt**. Đây là nguồn "lỗi không chi tiết" thứ 2,
   độc lập với bug `describeError`.

2. **`step == 4` là TIMEOUT nhưng UI coi như tiến bộ.** `PairingScreen.tsx:126` làm
   `setConnectIdx(i => Math.min(i + 1, 2))` ở **mọi** progress event → checklist "Authenticating → Syncing → Finalizing"
   **nhích lên khi thật ra đã timeout**. UX nói dối.

3. **`deviceStateError:` (@optional) chưa được implement** → thêm một kênh lỗi nữa bị bỏ.

### 🔴 THIẾU bắt tay "Security Level Device" (phát hiện từ sample chính chủ, 2026-07-10)
So `TuyaPairing.mm` với sample ObjC chính chủ (`tuya-home-ios-sdk-sample-objc-main`, `ThingSmartHomeKit 5.8.0`):
API EZ/AP/combo/BLE **khớp verbatim**, NHƯNG sample có 1 nhịp mình thiếu — chỉ ở **AP mode**:

```objc
// Only the Security Level Device Need this.
- (void)activator:didPassWIFIToSecurityLevelDeviceWithUUID:(NSString *)uuid {
    // xác nhận (điện thoại cùng Wi-Fi vừa nhập) → rồi:
    [[ThingSmartActivator sharedInstance] continueConfigSecurityLevelDevice];
}
```

Với **thiết bị an ninh (cảm biến, khoá, PIR…)** SDK **tạm dừng giữa chừng**, gọi delegate này chờ app xác nhận,
rồi mới đi tiếp. Không gọi `continueConfigSecurityLevelDevice` → SDK **đứng tới hết timeout**.
Module mình **không implement** (`grep SecurityLevel|continueConfig|didPassWIFI` = rỗng) → **ứng viên số 1**
giải thích "pair cảm biến Wi-Fi mãi không được". Method là `@optional` của `ThingSmartActivatorDelegate`.
→ Chi tiết: [docs/research/tuya-ios-sample-pairing-comparison.md](../../docs/research/tuya-ios-sample-pairing-comparison.md).
→ **Đề xuất B8** (chờ user duyệt): wire delegate này + auto-continue + log `sdk.security_level_continue`.

Phụ: sample route theo `deviceInfo.bleType` (mình hardcode `deviceType=0`, bỏ `bleType`) → không route được
BLE-thuần vs Dual. Và sample **cũng không có entitlement multicast** → củng cố kết luận EZ-iOS.

### 🟡 Token & timeout
Token pairing **sống 10 phút**, hết hạn ngay sau khi thiết bị pair xong. Timeout mặc định Tuya = **100s**
(app đang để 120s - chấp nhận được). App lấy token **ngay trước** khi start → không lo hết hạn.

### 🟠 Tiến trình pairing iOS vô nghĩa
`TuyaPairing.mm:118` emit `step` = `[NSString stringWithFormat:@"%ld", (long)step]` → `"1"`, `"2"`…
Trong khi `pairing.ts:149 pairingStepLabel()` so khớp bằng **từ khoá chữ** (`"start"`, `"bind_success"`…)
→ iOS luôn rơi nhánh mặc định `'Pairing…'`. Android `onStep(step: String)` trả chuỗi thật → lệch hành vi 2 nền tảng.
Research note tự ghi nhận thiếu: `docs/research/tuya-home-sdk-device-pairing.md:530`
*"step values (vd 'device_find', 'device_bind_success') chưa liệt kê trong doc; cần log thực tế."*

### 🟠 Không có log nào
Không `console`, không buffer, không hiển thị raw error. Không thể chẩn đoán từ xa cho khách.
`PairingScreen` chỉ render `errMsg = describeError(e)` - tức đúng cái chuỗi đã bị nuốt ở trên.

### 🟡 Bối cảnh từ user (2026-07-10)
- **Smart Life chính chủ pair được ice tub bằng EZ (đèn nháy nhanh)** → phần cứng OK, EZ khả thi.
  ⇒ Loại bỏ giả thuyết "thiết bị không hỗ trợ EZ". Lỗi ở app mình.
- **Băng tần Wi-Fi "Can March" chưa rõ** → chưa loại được giả thuyết 5GHz. B6 sẽ tự phát hiện.

### 🟡 Nợ cũ liên quan (từ INDEX.md)
- Dự án từng dính **Data Center mismatch** (App SDK route **Western Europe**, project ở Central Europe → list rỗng).
  `getActivatorToken` chạy được ⇒ login/DC cơ bản OK, nhưng B3 vẫn nên log DC/endpoint để loại trừ dứt điểm.
- iCloud hay tạo file `* 2.*` trong `android/build/` gây fail build → dọn bằng `find … -delete`.
  (Thấy rõ trong lần grep: `TuyaPairingModule 2.class`, `TuyaReject 2.class`…)

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Feature gốc: [../m1-mobile-pairing/progress.md](../m1-mobile-pairing/progress.md)
- Research liên quan:
  - ⭐ [tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md) -
    **note quyết định hướng đi** (2026-07-10): entitlement multicast iOS · bác bỏ giả thuyết permission Android · AP mode
  - [tuya-home-sdk-device-pairing.md](../../docs/research/tuya-home-sdk-device-pairing.md)
  - [tuya-home-sdk-error-codes.md](../../docs/research/tuya-home-sdk-error-codes.md)
  - [tuya-home-sdk-bluetooth.md](../../docs/research/tuya-home-sdk-bluetooth.md)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<chưa hoàn thành>
