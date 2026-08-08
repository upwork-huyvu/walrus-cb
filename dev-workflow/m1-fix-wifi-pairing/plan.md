# Kế hoạch: Fix pairing Wi-Fi (EZ) thất bại + lỗi không chi tiết

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-fix-wifi-pairing`
- **Milestone:** M1·B (mobile pairing) - bug fix trên `m1-mobile-pairing`
- **Phần liên quan:** mobile (app) + lib (`packages/tuya-react-native`, native iOS + Android)
- **Ngày tạo:** 2026-07-10
- **Cập nhật lần cuối:** 2026-07-10 (fix-plan: +B8 security-level & bleType, +B9 BLE-discovery-first UX)

## 1. Mục tiêu & phạm vi

Khách pair bồn **ice tub** qua **Wi-Fi EZ** thất bại trên **cả iOS lẫn Android**, và màn lỗi
chỉ hiện `[sdk:pairing_error] Unknown error.` - vô dụng để chẩn đoán.

Đã xác nhận: **app Smart Life chính chủ pair được con bồn này bằng EZ (đèn nháy nhanh)**
→ thiết bị CÓ hỗ trợ EZ, lỗi nằm ở **cách app mình gọi SDK + permission native còn thiếu**,
không phải phần cứng.

Hai mục tiêu:
1. **Pair thành công** qua Wi-Fi EZ trên cả 2 nền tảng với ice tub thật.
2. **Thông báo lỗi chi tiết**: mã lỗi Tuya thật + message native + log chẩn đoán copy được.

**Ngoài phạm vi (không làm trong feature này):**
- Pairing nâng cao: sub-device / gateway / QR / wired / Matter (đang TODO ở lib).
- Redesign UI màn pairing (chỉ thêm phần hiển thị lỗi + preflight + copy log).
- Sửa các module Tuya khác (device control, OTA, scene…).
- Đưa log chẩn đoán lên backend/telemetry (chỉ local + copy tay).

## 2. Bối cảnh & ràng buộc

### 2.1 Root cause ĐÃ XÁC ĐỊNH (đọc code, không đoán)

**(a) `[sdk:pairing_error] Unknown error.` - lỗi hiển thị.** Chuỗi tái hiện chính xác chữ trong ảnh:

1. `ios/Pairing/TuyaPairing.mm:104` - delegate lỗi reject bằng **chuỗi literal**, vứt mất `NSError.code` thật:
   ```objc
   self.wifiReject(@"pairing_error", error.localizedDescription, error);
   ```
2. `apps/mobile/src/services/pairing.ts:163-173` - `describeError()` đọc `e.code` (= `"pairing_error"`),
   thấy khác null nên gọi `TuyaErrors.describe("pairing_error")` và **vứt luôn `e.message`**.
3. `packages/tuya-react-native/src/errors.ts:133-146` - `categoryOf("pairing_error")` không khớp bảng
   `SDK_CODES`, `Number("pairing_error")` = NaN → `'unknown'`.
4. `errors.ts:198` - `describe()` trả `[${domain}:${code}] ${text[category]}` → **`[sdk:pairing_error] Unknown error.`** ✅ khớp ảnh.

Chính comment đầu `errors.ts` đã cảnh báo: *"All native modules SHOULD reject with the TuyaError shape
{ code, message, domain }… Never collapse codes"* - iOS Pairing **chưa** tuân thủ (helper `ios/Common/TuyaReject.h`
đã có sẵn nhưng không được dùng). Android (`TuyaPairingModule.kt:108`) truyền code thật nhưng
`describeError()` vẫn nuốt `msg` → cũng mất chi tiết.

**(b) iOS: THIẾU entitlement multicast → EZ *không thể* chạy.** ✅ **ĐÃ XÁC MINH BẰNG DOC CHÍNH CHỦ (2026-07-10)**
→ [docs/research/tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md)

> *"the app built with Xcode 12.5 **cannot send the EZ pairing data packets** from iPhone that runs **iOS 14.5
> or later**, and in this case, the permission `com.apple.developer.networking.multicast` must be enabled"*
> — [Tuya: Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j)

`CoolBathMobile.entitlements` hiện chỉ có `aps-environment` · `applesignin` · `networking.wifi-info` →
**thiếu `com.apple.developer.networking.multicast`**. `Info.plist` đã có `NSLocalNetworkUsageDescription`
(vẫn cần) nhưng nó chỉ phủ **unicast LAN + Bonjour**, **không** phủ multicast/broadcast.
⇒ **iOS EZ chắc chắn không bao giờ chạy với build hiện tại.** Smart Life pair được vì app của Tuya **đã có**
entitlement này. Apple phải duyệt (**3-5 ngày làm việc**).

**(b2) Android: giả thuyết permission ĐÃ BỊ BÁC BỎ.** ❌ ~~Thiếu `CHANGE_WIFI_MULTICAST_STATE`~~
Kết luận ban đầu **SAI** vì grep manifest **nguồn** thay vì **merged manifest**. Kiểm chứng lại
`app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml`:
**`CHANGE_WIFI_MULTICAST_STATE` ĐÃ CÓ SẴN** (AAR `thingsmart:7.5.6` tự khai, manifest merger kéo vào).
`ACCESS_FINE_LOCATION` cũng có + đã xin runtime ở `wifiScanner.ts:23-24`.
`NEARBY_WIFI_DEVICES` không có, nhưng **chưa chứng minh được là cần** (đã có FINE_LOCATION).

⇒ **Android fail vì lý do KHÁC, chưa xác định.** Ứng viên: **Wi-Fi 5GHz** (nguyên nhân duy nhất giải thích
được *cả 2 nền tảng cùng fail*) · Location Services tắt ở cấp hệ thống · thiết bị không ở EZ mode ·
token hết hạn/DC mismatch. **Không có log ⇒ không trả lời được** → càng củng cố việc làm B1-B3 trước.

**(b3) Đường thoát chính thức của Tuya: dùng AP mode.**
> *"For iOS 14.5 and later, we recommend that you use the **AP mode** instead of the Wi-Fi EZ mode."*
> AP mode: *"higher success rate, optimal reliability, and fewer compatibility requirements"* và
> *"supports routers that can process data using both 2.4 GHz and 5 GHz frequencies."*

AP mode nối điện thoại vào **hotspot của chính bồn** → **không dùng broadcast/multicast** → né được cả
entitlement (iOS) lẫn nghi vấn 5GHz (cả 2 nền tảng). Đây là **đường ngắn nhất tới "pair thành công"**.

**(c) Tiến trình pairing iOS vô nghĩa.** `TuyaPairing.mm:118` emit `step` = số enum `ThingActivatorStep`
(`"1"`, `"2"`…), trong khi `pairing.ts:149` `pairingStepLabel()` so khớp bằng **từ khoá chữ**
(`"start"`, `"bind_success"`…) → iOS luôn rơi vào nhánh mặc định. Android trả chuỗi thật
(`onStep(step: String)`). Research note đã ghi: *"step values … chưa liệt kê trong doc; cần log thực tế"*
(`docs/research/tuya-home-sdk-device-pairing.md:530`).

**(d) Không có log gì cả.** Không `console`, không buffer, không hiển thị raw error → không thể chẩn đoán từ xa.

### 2.2 Ràng buộc dự án
- Tuya **Data Center của SDK phải trùng Cloud Project**. Dự án đã từng dính mismatch
  (INDEX.md: App SDK route **Western Europe**). `getActivatorToken` chạy được ⇒ login/DC cơ bản OK,
  nhưng vẫn phải xác nhận lại DC lúc `initSdk`.
- Tài khoản Tuya phải là **Owner của Home** thì mới bind được thiết bị.
- **Wi-Fi EZ chỉ chạy trên 2.4GHz.** Băng tần mạng "Can March" hiện **chưa rõ** → phải tự phát hiện.
- RN CLI (không Expo); AppSecret/service_role không được lộ ra bundle.
- Lib native nằm ở `packages/tuya-react-native`, Metro đọc thẳng `src` qua export-condition.

- **Link nghiên cứu liên quan:**
  - ⭐ [docs/research/tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md)
    **(2026-07-10 - note quyết định hướng đi: entitlement multicast iOS + bác bỏ giả thuyết permission Android)**
  - [docs/research/tuya-home-sdk-device-pairing.md](../../docs/research/tuya-home-sdk-device-pairing.md)
  - [docs/research/tuya-home-sdk-error-codes.md](../../docs/research/tuya-home-sdk-error-codes.md)
  - [docs/research/tuya-home-sdk-bluetooth.md](../../docs/research/tuya-home-sdk-bluetooth.md)

## 3. Tiêu chí hoàn thành (Acceptance Criteria)

> Kiểm chứng được. Đây là cái `/test` sẽ check.

- [ ] **AC1:** Pair ice tub thật **thành công trên Android** (SM-A325F) qua **EZ hoặc AP** → hiện ở Device List.
- [ ] **AC2:** Pair ice tub thật **thành công trên iOS** (iPhone thật) qua **AP** (EZ chỉ khả thi sau khi Apple
      duyệt entitlement - xem B5; **không** đặt làm điều kiện hoàn thành).
- [ ] **AC3:** Khi pair fail, màn lỗi hiện **mã lỗi Tuya thật + message native** (ví dụ
      `[sdk:1006] Pairing timed out …` kèm mô tả gốc), **không còn** chuỗi `[sdk:pairing_error] Unknown error.`
- [ ] **AC4:** Có **log chẩn đoán copy được** từ màn lỗi, chứa: mode (EZ/AP), ssid, băng tần,
      homeId, token lấy được hay không, từng `onPairingProgress` step kèm timestamp, và raw error `{code, message, domain}`.
- [ ] **AC5:** **Preflight chặn sớm** kèm thông báo hành động được, cho các case: SSID rỗng ·
      mạng 5GHz · thiếu quyền Location/Local Network · chưa đăng nhập Tuya. Không để chạy 120s rồi báo lỗi rỗng.
- [ ] **AC6:** iOS emit step **có nghĩa** (chuỗi, không phải số enum) → checklist Connecting nhích đúng.
- [ ] **AC7:** `tsc` 0 lỗi · `eslint` 0 error · `jest` xanh (gồm test mới cho `describeError` + `pairingLog`) ·
      Android `compileDebugKotlin` BUILD SUCCESSFUL · iOS build xanh.
- [ ] **AC8:** Pair thiết bị **security-level** (cảm biến/`*Security`) **không còn treo tới timeout** - app tự
      `continueConfigSecurityLevelDevice`; diagnostics có `sdk.security_level_continue`. `bleType` thật xuất hiện trong log.
- [ ] **AC9:** Vào màn Add device → thiết bị **Wi-Fi combo tự hiện ra** (không cần nhập Wi-Fi trước) → chạm →
      nhập Wi-Fi → **pair thành công** (flow giống Smart Life). Fallback "Add manually" (EZ/AP) vẫn hoạt động.

## 4. Các bước thực hiện

> Mỗi bước nhỏ, làm được trong 1 lượt dev + test.
> **Thứ tự có chủ đích: B1→B3 (quan sát được) TRƯỚC B4→B5 (sửa nguyên nhân).**
> Không có log thì không thể xác nhận permission fix có ăn hay không.

1. **B1 - Native reject đúng chuẩn `{ code, message, domain }`**
   - Việc cần làm:
     - iOS: dùng sẵn `TuyaRejectWithDomain()` từ `ios/Common/TuyaReject.h`. Thay mọi literal
       (`@"pairing_error"`, `@"combo_pairing_error"`, `@"token_error"`) bằng **code số thật**
       `[@(error.code) stringValue]` + `error.localizedDescription`. Với `activeBLE`/`startConfigBLEWifi`
       (SDK chỉ trả `ThingFailureHandler` rỗng, không có `NSError`) → giữ code riêng nhưng message phải nói rõ
       "SDK không trả chi tiết".
     - Android: chuyển `promise.reject(code, msg)` → `TuyaReject.reject(promise, code, msg, "sdk")` để có `domain`.
   - File đụng tới: `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm` ·
     `packages/tuya-react-native/android/src/main/java/com/jimmyvu/turbotuya/pairing/TuyaPairingModule.kt`
   - Kiểm thử: iOS build xanh · `./gradlew :jimmy-vu_react-native-turbo-tuya:compileDebugKotlin` xanh.

2. **B2 - `describeError()` không nuốt message native**
   - Việc cần làm: sửa `describeError()` để **luôn** giữ message gốc + code + domain. Chỉ dùng
     `TuyaErrors.describe()` làm **phần diễn giải thêm**, không thay thế. Code không phải số
     (`"pairing_error"`, `"ble_scan_required"`) → không đẩy vào `classify()` nữa mà hiện thẳng message.
   - File đụng tới: `apps/mobile/src/services/pairing.ts` · thêm `apps/mobile/src/services/pairing.test.ts`
   - Kiểm thử: `jest` - case `{code:'1006'}` · `{code:'pairing_error', message:'...'}` · `{message}` trần ·
     assert **không bao giờ** trả ra chuỗi chứa `Unknown error` khi đã có message.

3. **B3 - Log chẩn đoán pairing (copy được) + step iOS có nghĩa**
   - Việc cần làm:
     - Thêm `pairingLog.ts`: ring buffer (~100 dòng) `{ts, level, event, data}`; API `log()`, `dump()`, `clear()`.
       Ghi: mode · ssid · băng tần · homeId · token OK/fail · từng step · raw error. **Không log password.**
     - `PairingScreen` màn `error`: hiện raw `{code,message,domain}` + nút **"Copy diagnostics"**.
     - iOS: map `ThingActivatorStep` enum → chuỗi có nghĩa trước khi emit (đối chiếu header SDK).
   - File đụng tới: `apps/mobile/src/services/pairingLog.ts` (mới) · `pairing.ts` ·
     `src/screens/PairingScreen.tsx` · `ios/Pairing/TuyaPairing.mm` · `pairingLog.test.ts` (mới)
   - Kiểm thử: `jest` (buffer + **redact password**) · manual: fail 1 lần → copy log → thấy đủ trường.

4. **B4 - AP mode thành đường pair CHÍNH (đường ngắn nhất tới "pair thành công")** ⭐ *đổi hướng sau research*
   - Lý do: AP không dùng broadcast/multicast → **né entitlement Apple** *và* **né nghi vấn 5GHz**.
     Tuya khuyến nghị chính thức cho iOS 14.5+. Native cho AP **đã wire sẵn** (`ThingActivatorModeAP` /
     `ActivatorModelEnum.THING_AP`) - chủ yếu là việc của UI + hướng dẫn user.
   - Việc cần làm:
     - Đổi mặc định `wifiMode` sang `AP` trên iOS (Android giữ EZ để so sánh, hoặc cũng AP nếu log cho thấy fail).
     - Màn `prepare` cho AP: hướng dẫn rõ 3 bước (reset tới **đèn nháy chậm** → vào Settings nối hotspot
       của bồn → quay lại bấm Start). Cân nhắc deep-link `App-Prefs:root=WIFI` (iOS) / `ACTION_WIFI_SETTINGS` (Android).
     - Kiểm tra: điện thoại **đang nối hotspot bồn** trước khi cho bấm Start (đọc SSID hiện tại).
   - File đụng tới: `src/screens/PairingScreen.tsx` · `src/services/pairing.ts` · `pairingPreflight.ts` (mới)
   - Kiểm thử: **device thật, cả 2 nền tảng**: pair AP thành công → thỏa AC1+AC2 (AC ghi "EZ **hoặc** AP").

5. **B5 - Xin entitlement multicast iOS (chạy SONG SONG, không chặn ai)** ⚠️ *phụ thuộc Apple*
   - Việc cần làm:
     - **Nộp đơn ngay** tại https://developer.apple.com/contact/request/networking-multicast
       (Apple duyệt **3-5 ngày làm việc**). Phần giải thích **bắt buộc nhắc**: *"UDP ports 6666 and 6667
       and TCP port 6668"* (yêu cầu nguyên văn của Tuya).
     - Sau khi duyệt: bật **Multicast Networking** trong Additional Capabilities của App Identifier →
       tạo lại provisioning profile → thêm `com.apple.developer.networking.multicast` vào entitlements → rebuild.
     - Xác nhận Local Network permission **được prompt và Allow** (đã Deny thì iOS không hỏi lại →
       phải hướng dẫn vào Settings; xử lý ở B6).
   - ⚠️ **Rủi ro đã biết:** form đòi **App Store URL** mà app chưa phát hành. Chưa xác minh Apple có chấp nhận
     app chưa lên store. Nếu bị từ chối ⇒ **AP/BLE là đường duy nhất** cho tới khi app lên store.
   - File đụng tới: `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements` · provisioning profile
   - Kiểm thử: device thật iOS pair **EZ** thành công (bonus, không phải điều kiện của AC1/AC2).

6. **B6 - Preflight chặn sớm + thông báo hành động được**
   - Việc cần làm: trước khi start pairing, kiểm và fail-fast với message rõ (thay vì chạy 120s rồi báo rỗng):
     - SSID rỗng · `homeId` không hợp lệ · chưa đăng nhập Tuya.
     - **Mạng 5GHz** - `wifiScanner.ts` **đã đọc sẵn `frequency`** (dòng 7), chỉ chưa dùng:
       `frequency >= 5000` → chặn EZ, hướng dẫn đổi sang 2.4GHz hoặc dùng AP.
     - **Android:** Location Services **bật ở cấp hệ thống** chưa (khác với permission đã cấp).
       Thêm `NEARBY_WIFI_DEVICES` **chỉ khi** log ở B3/B7 chứng minh là cần (targetSdk 36).
     - **iOS:** phát hiện Local Network bị **Deny** (iOS không hỏi lại, fail im lặng vĩnh viễn)
       → hướng dẫn mở Settings.
   - File đụng tới: `apps/mobile/src/services/pairingPreflight.ts` (mới) · `wifiScanner.ts` ·
     `src/screens/PairingScreen.tsx` · `pairingPreflight.test.ts` (mới) · (có điều kiện) `AndroidManifest.xml`
   - Kiểm thử: `jest` cho từng nhánh preflight · manual: nối 5GHz → phải bị chặn kèm message đúng.

7. **B7 - Verify end-to-end trên ice tub thật (2 nền tảng)**
   - Việc cần làm: pair EZ thật trên Android + iOS; lưu log thành công & thất bại vào `context.md`.
     Ghi lại **chuỗi step thật** của SDK (research note đang thiếu) → cập nhật `pairingStepLabel()`.
   - File đụng tới: `dev-workflow/m1-fix-wifi-pairing/context.md` ·
     `docs/research/tuya-home-sdk-device-pairing.md` (bổ sung bảng step) · `pairing.ts`
   - Kiểm thử: checklist device thật → AC1 + AC2.

8. **B8 - Native: security-level handshake + đẩy `bleType` thật lên JS** *(thêm 2026-07-10 sau research sample)*
   - Lý do: (a) so với sample chính chủ, module mình **thiếu** `didPassWIFIToSecurityLevelDeviceWithUUID:` →
     thiết bị an ninh (cảm biến/khoá/`*Security`) pair sẽ **treo tới timeout**. (b) BLE scan **hardcode
     `deviceType=0`, vứt `bleType`** → không route được combo vs BLE-thuần (cần cho B9).
     Nguồn: [tuya-ios-sample-pairing-comparison.md](../../docs/research/tuya-ios-sample-pairing-comparison.md).
   - Việc cần làm:
     - iOS `TuyaPairing.mm`: implement `activator:didPassWIFIToSecurityLevelDeviceWithUUID:` → **tự** gọi
       `[[ThingSmartActivator sharedInstance] continueConfigSecurityLevelDevice]` + emit progress
       `sdk.security_level_continue` (điều kiện "điện thoại cùng Wi-Fi" đã do preflight/prepare lo).
     - BLE scan (iOS + Android): emit **`bleType` thật** (thay `deviceType=0`). Thêm field vào
       `BleScanEvent`/`BleScanItem` + helper `isComboDevice(bleType)` theo bảng của sample
       (`BLEWifi*`/`BLELTESecurity` = combo cần Wi-Fi; còn lại = BLE-thuần).
   - File đụng tới: `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm` · `.../TuyaPairingModule.kt` ·
     `packages/tuya-react-native/src/index.tsx` · `apps/mobile/src/services/pairing.ts` (+ test)
   - Kiểm thử: iOS build xanh · Kotlin compile xanh · `jest` cho `isComboDevice` · **device thật:**
     pair cảm biến security-level không còn treo (AC8).

9. **B9 - UX: BLE-discovery-first làm luồng CHÍNH (giống Smart Life), EZ/AP thành "Add manually"**
   *(thêm 2026-07-10)*
   - Lý do: Smart Life "Auto Scan" = quét **BLE beacon**; thiết bị Tuya Wi-Fi đời mới là **combo** (phát BLE
     lúc pairing). Flow user muốn: tìm → chạm → nhập Wi-Fi → xong = đúng luồng BLE-discovery + combo mình
     **đã có native**, chỉ cần đảo UX. Nguồn:
     [tuya-auto-scan-discovery.md](../../docs/research/tuya-auto-scan-discovery.md).
   - Việc cần làm (`PairingScreen`):
     - Vào màn Add device → **tự `startBleScan` ngay** (bỏ ràng buộc "nhập Wi-Fi trước mới cho quét").
     - `onBleScan` → hiện thiết bị tìm được (đang có bước `found`; cho phép thấy >1, chọn 1).
     - Chạm 1 thiết bị → route theo `bleType`: **combo** → hỏi Wi-Fi (SSID/pwd) → `pairBleWifi`;
       **BLE-thuần** → pair thẳng (`startBlePairing`, khỏi Wi-Fi).
     - Giữ **EZ/AP hiện tại** làm lối **"Add manually"** (cho thiết bị Wi-Fi thuần không BLE / khi scan không thấy).
     - Preflight (B6): với đường combo/BLE cần **Bluetooth bật + quyền BLE**; thêm nhánh cảnh báo.
   - File đụng tới: `apps/mobile/src/screens/PairingScreen.tsx` · `src/services/pairing.ts` ·
     `src/services/pairingPreflight.ts`
   - Kiểm thử: `jest`/`tsc`/`eslint` xanh · **device thật:** mở Add device → thiết bị Wi-Fi combo **tự hiện** →
     chạm → nhập Wi-Fi → pair xong (AC9). Fallback "Add manually" vẫn pair được EZ/AP.

## 5. Rủi ro & câu hỏi mở

- ✅ **[ĐÃ GIẢI QUYẾT BẰNG RESEARCH]** ~~Chưa biết iOS EZ có cần entitlement multicast không~~ →
  **CÓ, bắt buộc, iOS 14.5+.** Doc Tuya nói thẳng. Kế hoạch đã đổi: **AP mode là đường chính (B4)**,
  entitlement chạy song song (B5) chứ không chặn.
- ❌ **[GIẢ THUYẾT ĐÃ BỊ BÁC BỎ]** ~~Android thiếu `CHANGE_WIFI_MULTICAST_STATE`~~ → **đã có sẵn** trong
  merged manifest (AAR Tuya khai). Bài học: **đọc merged manifest, đừng grep manifest nguồn.**
  ⇒ **Android vẫn chưa biết fail vì gì** - đây giờ là ẩn số lớn nhất, chỉ B3 (log) mới trả lời được.
- ⚠️ **Apple có thể từ chối entitlement vì app chưa lên App Store** (form đòi App Store URL).
  → Giảm thiểu: AC1/AC2 đã được viết lại để **không phụ thuộc EZ trên iOS**. AP mode phải chạy được.
- ⚠️ **Băng tần mạng vẫn chưa rõ.** Nếu "Can March" là dual-band chung SSID, điện thoại bám 5GHz →
  EZ fail dù code đúng, và giải thích được **cả Android**. → B6 preflight sẽ lộ ra ngay
  (`wifiScanner.ts` đã có sẵn `frequency`). AP mode thì **miễn nhiễm** (doc: hỗ trợ router 2.4+5GHz).
- ⚠️ **Bảng `SDK_CODES` trong `errors.ts` có thể sai miền giá trị**: đang map `1001..1007` (**dương**),
  doc chính chủ dùng **âm** (`-1000`, `-1006`, `-1010`, `-33`, `-55`…). → rà lại ở B2.
- ⚠️ **Data Center mismatch** từng xảy ra ở dự án này (App SDK route Western Europe).
  → B3 log phải in DC/endpoint lúc init để loại trừ dứt điểm.
- ⚠️ **Sửa `describeError()` có thể làm lộ message kỹ thuật cho end-user.** → tách 2 tầng:
  message thân thiện cho UI + raw block chỉ hiện ở khu "diagnostics"/`__DEV__`.
- ⚠️ **`ThingActivatorStep` enum chưa được doc hoá** (research note tự ghi nhận thiếu).
  → B3/B7 lấy giá trị thật từ thiết bị rồi mới map, không đoán.
- ✅ **[GIẢI QUYẾT BẰNG RESEARCH]** ~~Ice tub có BLE không?~~ → Thiết bị Tuya Wi-Fi đời mới **gần như luôn là
  combo (Wi-Fi + BLE beacon)**; đó là cách Smart Life "Auto Scan" tìm ra chúng. → B9 dựng BLE-discovery-first,
  EZ/AP làm fallback cho thiết bị Wi-Fi thuần (hiếm).
- ⚠️ **Thiết bị Wi-Fi THUẦN (không BLE)** không auto-scan được (không có gì để dò), iOS lại không quét được
  danh sách Wi-Fi → **bắt buộc giữ EZ/AP fallback** ("Add manually"). B9 không được bỏ đường này.
- ⚠️ **B9 phụ thuộc B8** (`bleType`): không có `bleType` thì không route được combo vs BLE-thuần. Làm B8 trước.
- ❓ **Scan type có bắt đủ loại combo không?** iOS đang `ThingBLEScanTypeNoraml`, sample dùng `startListening:YES`.
  → xác minh ở B8/B9 trên thiết bị thật; nếu thiếu loại thì chỉnh scan type.
- ❓ **Local Network permission đã từng bị user bấm "Deny" chưa?** iOS chỉ hỏi 1 lần; đã Deny thì
  im lặng fail mãi. → B6 phải tự phát hiện và hướng dẫn vào Settings bật lại.
