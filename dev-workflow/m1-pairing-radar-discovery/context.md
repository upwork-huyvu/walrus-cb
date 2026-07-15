# Context: Radar auto-discovery cho màn pairing (giống Smart Life)

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-pairing-radar-discovery`

## Quyết định kỹ thuật (Decision log)

> Mỗi quyết định: chọn gì + vì sao + phương án đã loại.

- **2026-07-16 (revise #1 - client review sau khi B1-B5 chạy được)** - **Bỏ mode `auto`; còn 3 mode
  tường minh: Android EZ·AP·BLE, iOS AP·BLE. Default Android=EZ, iOS=AP.**
  Lý do: **yêu cầu đổi, không phải plan sai hay code lỗi.** `auto` là *suy luận thiết kế của tôi* -
  tôi cố mô phỏng UX "không hỏi mode" của Smart Life bằng cách chạy EZ ‖ BLE song song. Client xem
  bản chạy được rồi chọn hướng khác: cho user chọn mode tường minh.
  **Được:** rủi ro số 1 của plan (**EZ ‖ BLE có thể xung đột trong SDK** - không doc nào bảo đảm
  chạy song song là an toàn) **biến mất hoàn toàn**; `startScan()` mất hẳn nhánh "kênh này hỏng
  trong khi kênh kia còn sống" - nhánh khó test nhất.
  **Mất:** iOS không còn "vào màn là radar quay luôn" giống ảnh Smart Life (default AP cần nhập
  Wi-Fi trước). Client đã chốt - **không phải bug**.
  Ảnh hưởng: B1/B2/B4 **không đụng**; B3 viết lại, B5 sửa lại → tách thành B7/B8/B9.

- **2026-07-16 (revise #1)** - ~~AP: cấm prefill/scan Wi-Fi; bắt user tự nhập cả SSID lẫn password.~~
  → **SỬA LẠI ngay trong ngày (xem mục dưới): cấm *tự điền*, nhưng *quét* thì cho.**
  Phần vẫn đúng: lúc pair AP máy có thể đang nối **hotspot của thiết bị** ⇒ "Wi-Fi đang kết nối" =
  `SmartLife-xxxx`, trong khi SDK cần SSID/password **của ROUTER**; điền sai thì lỗi trả về không
  hé lộ gì về nguyên nhân. ⇒ Hành vi ô Wi-Fi **phải phụ thuộc mode**, không dùng chung một card.

- **2026-07-16 (client chỉ ra) - TÁCH `wifiInput` khỏi `prefillCurrentWifi`.** Client: *"chỗ chọn
  network name trong android nếu scan được thì cũng để dropdown"*. Đúng - **tôi đã gộp nhầm hai
  khái niệm khác hẳn nhau rồi cấm cả hai ở AP**:
  · `scanWifiNetworks()` trả về **mọi mạng xung quanh**, không liên quan tới việc đang nối mạng nào
    ⇒ **luôn an toàn**, kể cả khi máy đã ở hotspot thiết bị. Hơn nữa ở màn nhập thì máy **thường vẫn
    còn ở Wi-Fi nhà** - bước nối hotspot đứng SAU bước nhập trong hướng dẫn.
  · `getCurrentWifiSsid()` trả về **mạng đang nối** ⇒ đây mới là thứ nguy hiểm ở AP.
  ⇒ `wifiInput` giờ chỉ trả lời "quét được hay phải gõ tay" (**Android = dropdown cho cả EZ lẫn AP**;
  iOS = manual vì không có API liệt kê Wi-Fi), còn `prefillCurrentWifi` trả lời "có được tự điền
  không" (EZ true · AP false). Nút "Use the network I'm connected to" cũng gate theo cờ này.
  Thêm `wifiNotice` vào spec để cảnh báo AP hiện được ở **cả** dropdown lẫn manual (trước nó bị
  hard-code trong `wifiManualCard` nên bật dropdown là mất).
  📌 *Bài học: "an toàn" phải soi từng cơ chế một. Gộp 2 cơ chế vào 1 cờ rồi cấm cả cụm là cắt mất
  tính năng dùng được mà chẳng an toàn thêm tí nào.*

- **2026-07-16 (revise #1)** - **`channels: PairingChannel[]` → `channel: PairingChannel`; thêm cờ
  `wifiInput: 'dropdown'|'manual'|'none'`.** Lý do: mỗi mode giờ đúng 1 kênh - **kiểu dữ liệu phải
  nói lên điều đó**, để mảng là mời gọi người sau nhét thêm kênh rồi vô tình dựng lại đúng cái thiết
  kế song song vừa bỏ. `wifiInput` là dữ liệu chứ không phải logic ⇒ `PairingScreen` khỏi tự đoán
  bằng `if (mode.id === 'ap')` rải rác.

- **2026-07-15** - **Auto = EZ ‖ BLE song song; AP chỉ qua dropdown.** Lý do: AP đòi điện thoại
  nối hotspot của thiết bị, EZ đòi điện thoại đang ở Wi-Fi nhà 2.4GHz - một máy không ở hai mạng
  cùng lúc, nên EZ và AP **không thể** chạy song song. Đã cân nhắc & loại: chuỗi fallback tự động
  EZ→AP→BLE như client mô tả ban đầu (mỗi kênh timeout 120s ⇒ ~6 phút quay mù trước khi tới BLE,
  và vẫn phải bắt user tự đổi Wi-Fi ở giữa chừng ⇒ không tự động được).

- **2026-07-15** - **Radar đứng SAU bước xác nhận Wi-Fi**, không phải màn đầu tiên. Lý do: EZ phát
  mù (broadcast SSID/password/token qua multicast), **không có gì để dò trước** ⇒ muốn EZ tham gia
  radar thì phải có credentials trước. Đã cân nhắc & loại: radar làm màn đầu như Smart Life - chỉ
  hợp lệ nếu bỏ hẳn EZ khỏi discovery (chỉ còn BLE), mà client muốn ưu tiên EZ.
  Giảm đau: SSID prefill từ Wi-Fi đang nối + password đã nhớ ⇒ lần 2 trở đi chỉ bấm Continue.

- **2026-07-15** - **Blip EZ là hiển thị, không gate được bằng tap; chỉ blip BLE mới "chạm → pair".**
  Lý do: EZ chỉ lộ thiết bị qua `onStep(device_find)` giữa chừng, thời điểm đó SDK **đã tự bind**;
  không có API nào bảo nó "dừng lại chờ user chạm". Đây là khác biệt bản chất so với BLE
  (scan tách rời khỏi activate).

- **2026-07-15** - **Đi đường legacy API + route bằng cờ `isCombo` ở JS; KHÔNG wire unified
  `ActivatorService`.** Lý do: client chốt scope "chỉ JS, không rebuild native". Đã cân nhắc &
  loại: unified `ActivatorService` (`startSearch` nhận LIST type model → `didFindDevice` kèm
  `activatorType` → `startActive`) - **đây mới đúng là cách Smart Life không cần hỏi mode**, nhưng
  phải viết native cả 2 nền tảng + verify verbatim (note đã cảnh báo model iOS chưa mở hết field)
  + rebuild. Ghi nhận là **nợ kỹ thuật có chủ đích** (plan mục 5).

- **2026-07-15** - **Vẽ radar bằng `react-native-svg`** (đã có sẵn trong deps mobile). Lý do:
  không thêm dependency ⇒ giữ được cam kết "không rebuild native".

- **2026-07-16 (B5)** - **Kênh Wi-Fi hỏng KHÔNG giết cả màn khi BLE còn quét song song** (`auto`).
  Lý do: EZ fail (vd token hết hạn) không có nghĩa thiết bị không tồn tại - nó vẫn có thể hiện qua
  BLE. Reject của `pairWifi` chỉ được `logPairing('wifi.channel_failed')`; timeout tổng 120s mới kết
  luận. Chỉ khi mode **không** quét BLE (ez/ap đứng một mình) thì lỗi Wi-Fi mới `finishError` ngay.

- **2026-07-16 (B5)** - **Popup blip có 3 nhánh, không phải 1.** (a) pair được → "Add this device";
  (b) blip **EZ** → KHÔNG có nút thêm, nói thẳng "đang tự thêm rồi, khỏi làm gì" (SDK đã bind - bày
  nút giả ra là nói dối); (c) combo mà chưa có Wi-Fi → "Enter Wi-Fi details" đưa về intro (bản đầu
  chỉ `disabled` nút → user bấm không thấy gì xảy ra, không hiểu vì sao).

- **2026-07-16 (B3 revise, sau research)** - **iOS: bỏ hẳn EZ; `auto` trên iOS = BLE thuần
  (`needsWifi: false`); dropdown iOS chỉ còn `auto` + `ap`.** Lý do: client chốt "iOS để AP, EZ chưa
  support", và research xác nhận đây **đúng khuyến nghị chính chủ của Tuya**: *"For iOS 14.5 and
  later, we recommend that you use the AP mode instead of the Wi-Fi EZ mode."* Hệ quả **tốt ngoài dự
  kiến**: iOS `auto` không cần Wi-Fi nữa ⇒ **vào màn là radar quét luôn**, đúng y ảnh client gửi
  (ảnh đó chụp trên iPhone). Đã cân nhắc & loại: giữ `ble` thành mục riêng trên iOS - trên iOS
  `auto` ĐÃ là BLE, liệt kê cả hai thì hai dòng làm y hệt nhau, chỉ tổ làm user phân vân.

- **2026-07-16 (B3 revise)** - **Hướng dẫn AP tách theo nền tảng.** Lý do: doc Android nói *"the SDK
  automatically connects to the hotspot of the device within a certain period"*, còn doc iOS chỉ nói
  *"Guide the user to connect their phone to the AP emitted by the device"*. ⇒ Bảo user Android "ra
  Settings nối SmartLife…" là **hướng dẫn thừa và gây hoang mang**. Test khoá cứng cả 2 chiều.

- **2026-07-16 (B2)** - **Toạ độ blip sinh từ hash FNV-1a của `key`, không random.** Lý do: scan BLE
  bắn event **liên tục** cho cùng một thiết bị ⇒ nếu vị trí random thì mỗi event là một lần blip
  nhảy sang chỗ khác, user không tài nào chạm trúng. Hash ⇒ cùng thiết bị luôn đúng một chỗ, kể cả
  sau khi restart app. Kèm ràng buộc: bán kính ép vào [0.38, 0.86] để không đè lên icon tâm và
  không bị cắt ở mép. Đã cân nhắc & loại: xếp blip theo vòng tròn đều (đẹp hơn nhưng thiết bị mới
  chen vào là **cả vòng xáo lại chỗ** - hỏng đúng cái đang muốn tránh).

- **2026-07-16 (B2)** - **`upsertBlip` giữ nguyên toạ độ cũ khi cập nhật blip đã có.** Lý do: SDK
  có thể trả tên/field đầy đủ hơn ở event sau; nếu dựng lại blip từ đầu thì toạ độ vẫn đúng (hash
  theo key) nhưng để chắc chắn, hàm này copy lại angle/radius cũ - khoá bằng test.

- **2026-07-16 (B1)** - **`ensureBlePermissions` trả kết quả CÓ KIỂU thay vì boolean/throw.** Lý do:
  UI cần phân biệt `denied` (hỏi lại được → hiện nút "Try again") với `blocked` (never_ask_again →
  chỉ Settings mới gỡ) - boolean thì mất thông tin đó và lại đẩy user vào ngõ cụt im lặng, đúng cái
  bug đang sửa. Cùng pattern `CurrentWifiResult` của `wifiScanner.ts:89-91`.

- **2026-07-15** - **Giữ nguyên `AndroidManifest.xml`.** Lý do: sửa manifest (vd thêm
  `neverForLocation`) = phải rebuild native, phá cam kết scope. Bù lại: xin luôn
  `ACCESS_FINE_LOCATION` ở runtime - bắt buộc, vì `BLUETOOTH_SCAN` khai **không có**
  `neverForLocation` thì Android 12+ đòi có location mới trả kết quả scan.

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/screens/PairingScreen.tsx` | Màn pairing. **(B5 ✅ + B8/B9 ✅ sửa lại)** State machine `intro → searching → connecting → paired \| error` (**bỏ** `prepare` và `found`). `startScan()` = preflight → (nếu BLE) xin quyền → chạy **ĐÚNG 1 kênh** `mode.channel`. `modeDropdown()` · `stepsCard()` (hướng dẫn **đánh số**) · `wifiDropdownCard()` (EZ) / `wifiManualCard()` (AP) chọn qua `wifiCard()` theo `mode.wifiInput` · `blipPopup()` (Modal 3 nhánh) · `connectingOrb()`. Luôn vào `intro` trước (default 2 nền tảng đều cần Wi-Fi). |
| `apps/mobile/src/services/pairing.ts` | Adapter native ↔ JS + **mock layer** khi native vắng. `deviceNeedsWifi()` (dòng 90-97) route combo vs BLE thuần. `onBleScan`/`onPairingProgress` đã bọc log chẩn đoán. |
| `apps/mobile/src/services/pairingLog.ts` | Buffer chẩn đoán (redact password) → nút "Copy diagnostics". Có event `sdk.blescan` để soi scan có bắt được gì không. |
| `apps/mobile/src/services/wifiScanner.ts` | Quét/đọc Wi-Fi. **Mẫu tham chiếu cho B1**: `ensureAndroidLocationPermission()` dòng 46-58. |
| `apps/mobile/src/services/pairingPreflight.ts` | Chặn 5GHz/6GHz + SSID rỗng trước khi pair. |
| `apps/mobile/src/services/blePermissions.ts` | **(B1 ✅)** `ensureBlePermissions()` → `{ok}` \| `{ok:false, reason:'denied'\|'blocked'\|'unsupported', message}`. `blePermissionsFor(apiLevel)` quyết định bộ quyền. Gọi TRƯỚC mọi `startBleScan()` (B5 sẽ nối). |
| `apps/mobile/src/services/radarModel.ts` | **(B2 ✅)** `blipFromBleScan` / `blipFromEzStep` / `upsertBlip` / `blipPosition` (hash FNV-1a → tất định) / `isPairableBlip` (chỉ BLE) / `MAX_BLIPS=8`. Logic thuần, không import react-native. |
| `apps/mobile/src/services/pairingModes.ts` | **(B7 ✅ viết lại)** `pairingModesFor(platform)` - Android `[ez,ap,ble]` · iOS `[ap,ble]`; `defaultPairingMode` = phần tử đầu; `getPairingMode` · `modeNeedsWifi` · `modeNeedsBlePermission`. Mỗi mode: **`channel`** (số ít) · **`wifiInput`** (`dropdown\|manual\|none`) · **`steps: string[]`**. **`auto` đã bỏ.** |
| `apps/mobile/src/components/RadarView.tsx` | **(B4 ✅)** Radar SVG: vòng đồng tâm + tia quét xoay + blip `Pressable` (`testID=blip-<key>`). Vị trí blip lấy từ `radarModel`, **không** tự tính. |
| `packages/tuya-react-native/android/.../pairing/TuyaPairingModule.kt` | Native Android. `startBleScan` dùng `ScanType.SINGLE` + đọc `configType` → `isCombo` (dòng 133-162). Skeleton unified API reject `not_implemented`: dòng 253-308. **Không đụng ở feature này.** |
| `packages/tuya-react-native/ios/Pairing/TuyaPairing.mm` | Native iOS. Vừa sửa `startListening:YES` (commit 992e6c6). **Không đụng.** |

## Phát hiện & cạm bẫy (Findings / Gotchas)

> Cái gì "đáng lẽ chạy mà không chạy", lỗi lạ, hành vi SDK bất ngờ, workaround.

- 🔴 **AP legacy trên iOS THIẾU bước `getDeviceSecurityConfigs` (đã sửa 2026-07-16).** Client yêu
  cầu thêm, và **đúng**: verify **header SDK thật** (`Pods/ThingSmartActivatorCoreKit/.../ThingSmartActivator.h:130-138`)
  cho thấy luồng AP legacy là **3 bước**: `getTokenWithHomeId:` → `getDeviceSecurityConfigs:` →
  `startConfigWiFi:...regInfo:timeout:`. Code cũ **bỏ bước 2** và gọi biến thể **không `regInfo`**.
  `regInfo` **nullable** ⇒ lookup hỏng vẫn pair tiếp với `nil` (không chặn luồng). **EZ giữ nguyên**
  biến thể không regInfo. ⚠️ **Đụng native ⇒ phải rebuild iOS**, phá cam kết "chỉ JS" của feature này.
  📌 *Bài học: tôi suýt kết luận `getDeviceSecurityConfigs` thuộc AP Plus vì heading doc **Android**
  xếp nó dưới "New process" - nhưng doc iOS xếp nó ở **Legacy**. Heading doc nền tảng này không suy
  ra được nền tảng kia. Có `Pods/` trên máy thì đọc header thật - 30 giây, chắc hơn mọi suy đoán.*

- 🐛 **Suýt tự tạo bug phân loại step:** step mới thoạt đầu tôi đặt là `sdk.security_configs_failed`
  → chứa **"fail"** → `isFailureStep()` (khớp lỏng theo chuỗi) xếp nhầm thành **LỖI**, dù đây là ca
  **lành tính vẫn pair tiếp**; và set `errorCode/errorMessage` sẽ kích `setStepError` ⇒ UI hiện lỗi
  đỏ cho thứ không phải lỗi, rồi nếu pair fail vì lý do KHÁC thì lại **đổ tội nhầm** chỗ này.
  → Đổi thành `sdk.security_configs_skipped` + nhét chi tiết vào `dataJson`, **không** set error*.
  Kèm theo: `pairing.ts` giờ **log cả `dataJson`** vào diagnostics (trước chỉ log step + error*, nên
  chi tiết của step-không-phải-lỗi sẽ mất trắng).

- ❌ **ĐÍNH CHÍNH (2026-07-16, client chỉ ra): "Android SDK tự nối hotspot" KHÔNG đáng tin.**
  Tôi từng viết hướng dẫn AP trên Android là *"khỏi rời app, SDK tự nối hotspot"*, dựa vào **một
  dòng** doc Android: *"the SDK automatically connects to the hotspot of the device within a certain
  period"*. Hai vấn đề: (1) nó **mâu thuẫn với SmartLife user manual** - manual mô tả **app chạy
  thật** và bảo user tự vào Wi-Fi settings chọn `SmartLife…`, không phân biệt nền tảng; (2) **nhiều
  khả năng lỗi thời** - từ **Android 10** app không tự join Wi-Fi ngầm được nữa (phải qua
  `WifiNetworkSpecifier` → hệ thống hiện dialog), mà app này `targetSdkVersion=36`.
  ⇒ Giờ **cả 2 nền tảng** đều hướng dẫn user tự nối hotspot: nếu SDK có tự nối thật thì user thấy
  nó đã nối sẵn (**không hại**); nếu không thì hướng dẫn cũ khiến pair fail mà không ai hiểu vì sao.
  🔴 **B6 phải xác nhận trên máy thật.** Xem [tuya-ios-ap-mode-pairing.md](../../docs/research/tuya-ios-ap-mode-pairing.md) mục "ĐÍNH CHÍNH".
  📌 *Bài học: một dòng doc mô tả hành vi nền tảng có thể lỗi thời nhiều năm. Khi nó mâu thuẫn với
  user manual của chính app đó → tin manual, hoặc tin thiết bị thật.*

- 🐛 **`Animated.loop` vô hạn + `act()` = jest TREO IM** (không fail, không log, không timeout - chỉ
  đứng). Gặp ở `RadarView.test.tsx` - **test component đầu tiên của repo** nên chưa ai đụng phải.
  Cách gỡ: `jest.useFakeTimers()` ở đầu file test. Tia quét dùng `useNativeDriver:false` (SVG không
  chạy được native driver) nên animation đi qua timer JS → act chờ flush mãi.
  📌 *Ai viết test component có animation sau này: nhớ fake timers, đừng ngồi đoán vì sao CI đứng.*

- 🐛 **`findAllByType(Pressable)` trả RỖNG với react-test-renderer + preset RN** → test lọc theo
  cách đó **pass rỗng** (vòng lặp assert không chạy lần nào, vẫn xanh). Đã đổi sang lọc `testID` +
  `onPress`. 📌 *Test "xanh" mà không assert gì còn tệ hơn không có test.*

- 🟢 **AP thường (legacy) trên iOS KHÔNG cần entitlement nào của Apple** (research 2026-07-16, doc
  client chỉ định). Hai điều kiện "bật **Hotspot** trên Apple Developer platform" + "tích hợp
  `ThingSmartHotspotCredentialKit`" **chỉ thuộc mục "New AP pairing process"** = **AP Plus**; mục AP
  legacy **không liệt kê prerequisite nào**. ⇒ Chọn AP trên iOS là **thoát thật**, không phải đổi bế
  tắc entitlement này lấy bế tắc kia. Đây là chỗ **cực dễ đọc nhầm** - đã fetch riêng để xác minh vị
  trí 2 dòng đó nằm dưới heading nào.

- 🔴 **Nội dung hướng dẫn AP bản đầu của `pairingModes.ts` THIẾU bước quan trọng nhất**: đèn phải
  **nháy CHẬM** (AP) - EZ mới là nháy **NHANH**. Tôi viết bản đầu theo hiểu biết chung, không có
  nguồn; user manual nói rõ *"enable the indicator to blink slowly"*. Đã sửa + test khoá.
  📌 *Bài học: nội dung user-facing về phần cứng phải lấy từ doc, đừng viết theo trí nhớ.*

- 🔑 **`ssid`/`password` truyền vào AP là của ROUTER, không phải của hotspot thiết bị**
  (*"the ssid and password respectively specify the hotspot name and password of the router rather
  than that of the device"*). User gõ nhầm mật khẩu hotspot `SmartLife…` vào = fail 100%, và lỗi trả
  về **không nói gì** về nguyên nhân ⇒ hướng dẫn phải nói thẳng, đã đưa vào instructions + test.

- ⚠️ **RỦI RO CHƯA GỠ - token có thể bị lấy khi đã mất mạng (iOS/AP).** Doc: token phải lấy *"in the
  networked state"*, mà luồng AP trên iOS bắt user **rời Wi-Fi nhà** sang hotspot thiết bị (mất
  internet) trước khi bấm pair. Hiện `pairWifi()` gọi `startWifiPairingAuto` - **tự lấy token BÊN
  TRONG, ngay trước khi chạy** ⇒ trên iOS/AP có thể lấy token lúc **đã mất mạng** ⇒ fail.
  **Chưa verify trên máy thật.** Nếu đúng: thứ tự phải là lấy token TRƯỚC (khi còn Wi-Fi nhà) →
  user đổi Wi-Fi → mới `startConfigWiFi:`. Lib **đã có sẵn** `getPairingToken()` + `startWifiPairing()`
  (bản token thủ công) nên gỡ được mà không phải đụng native. → Ghi vào plan mục 5 nếu B6 xác nhận.

- ✅ **Native iOS không phải sửa cho AP:** `TuyaPairing.mm:113` đã map `mode=="AP"` →
  `ThingActivatorModeAP`, dùng `startConfigWiFi:` + `getTokenWithHomeId:` - khớp doc verbatim.

- ⚠️ **Android dùng `THING_AP`, doc ghi `TY_AP`** (`TuyaPairingModule.kt:101`). Không phải bug -
  Tuya đổi tên thương hiệu `Tuya*` → `Thing*`, và Kotlin compile ✅ nên enum tồn tại thật trên SDK
  7.5.6. Đừng "sửa" theo doc.

- 🔴 **BLOCKER (2026-07-15): Android chưa bao giờ xin `BLUETOOTH_SCAN` runtime.** Manifest
  `apps/mobile/android/app/src/main/AndroidManifest.xml:18-19` **có khai**
  `BLUETOOTH_SCAN`/`BLUETOOTH_CONNECT`, nhưng **không chỗ nào** trong repo gọi
  `PermissionsAndroid.request()` cho chúng - cả codebase chỉ xin `ACCESS_FINE_LOCATION`, và chỉ
  trong `wifiScanner.ts:48-57` phục vụ việc **quét danh sách Wi-Fi** (không dính màn pairing).
  Với `targetSdkVersion=36` (`apps/mobile/android/build.gradle:6`), Android 12+ coi
  `BLUETOOTH_SCAN` là **runtime permission** ⇒ `startLeScan` **im lặng không trả kết quả** (không
  crash, không lỗi) ⇒ radar quay 120s rồi báo "No Walrus devices found nearby".
  **Đây nhiều khả năng là lý do luồng BLE-discovery-first (B9 của `m1-fix-wifi-pairing`) chưa bao
  giờ được thấy chạy.** Doc Tuya liệt kê đúng bộ quyền: `BLUETOOTH`, `BLUETOOTH_ADMIN`,
  `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`.

- ⚠️ **`BLUETOOTH_SCAN` khai không có `usesPermissionFlags="neverForLocation"`** → Android 12+
  **bắt buộc** `ACCESS_FINE_LOCATION` đã grant thì mới trả kết quả scan. Và **location service
  (nút GPS) phải BẬT** - cạm bẫy kinh điển của BLE scan Android: đủ quyền nhưng GPS tắt vẫn ra
  0 kết quả, im lặng.

- 💡 **Vì sao Smart Life không hỏi mode** (chốt từ doc, 2026-07-15): nó dùng **unified
  `ActivatorService`** - discovery tách khỏi activation. `startSearch:` nhận **một LIST** type
  model (`...TypeBleModel`, `...TypeWiredModel`, `...TypeSubDeviceModel`, `...TypeEZModel`,
  `...TypeBeaconModel`, `...TypeMatterModel`…) → quét mọi kênh song song → mỗi hit gọi
  `didFindDevice` **kèm `activatorType`** (= "thiết bị này do kênh nào tìm ra") → chạm thì
  `startActive:` với đúng type đó. ⇒ **Mode không biến mất, nó được SUY RA chứ không hỏi.**
  App mình đang ở **thế hệ cũ**: mỗi mode một hàm riêng ⇒ buộc phải hỏi.

- 💡 **`ThingSmartActivatorTypeEZModel` đòi kèm sẵn `ssid`+`password`+`token`** ⇒ ngay cả Smart
  Life cũng chỉ đưa EZ vào auto-scan **khi đã có mật khẩu Wi-Fi**. Xác nhận: không có phép màu
  "quét ra thiết bị EZ" mà không cần credentials.

- 💡 Ảnh client gửi (màn "Searching for nearby devices…") là **iPhone**. iOS **không có API quét
  danh sách Wi-Fi** ⇒ đường AP-hotspot-SSID-scan bất khả thi trên iOS ⇒ radar trong ảnh đó **chỉ
  có thể là BLE**. Củng cố kết luận "sensor Wi-Fi = combo device có BLE beacon".

- ⚠️ `onStep` step values **chưa được Tuya document** (research `tuya-home-sdk-device-pairing.md`
  dòng 530: "chuỗi step cụ thể (vd `device_find`, `device_bind_success`) chưa liệt kê trong doc;
  cần log thực tế"). ⇒ Không tin chắc moi được devId/tên từ `dataJson` cho blip EZ. B6 phải log lại.

- ⚠️ `pairing.ts` có **mock layer** khi native vắng (`pairingAvailable === false`) - Metro chạy
  không có native vẫn giả lập được scan/pair. `MOCK_BLE.isCombo = true`. Test UI dựa vào cái này.

## Liên kết

- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan:
  [**tuya-ios-ap-mode-pairing.md**](../../docs/research/tuya-ios-ap-mode-pairing.md) (2026-07-16 - AP
  legacy **không cần entitlement**; iOS **không** tự nối hotspot còn Android **có**; đèn AP chậm/EZ
  nhanh; ssid = của router) ·
  [tuya-auto-scan-discovery.md](../../docs/research/tuya-auto-scan-discovery.md) ·
  [tuya-home-sdk-device-pairing.md](../../docs/research/tuya-home-sdk-device-pairing.md) ·
  [tuya-home-sdk-bluetooth.md](../../docs/research/tuya-home-sdk-bluetooth.md) ·
  [tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md)
- Feature liên quan: `m1-fix-wifi-pairing` (B8 đẩy `isCombo`/`bleType`/`configType` lên JS - feature
  này **ăn theo**; B9 đảo UX sang BLE-discovery-first - feature này **làm tiếp**).

## Tóm tắt khi hoàn thành (điền lúc FINISH)

<2-4 câu: feature làm được gì, còn nợ gì, cần theo dõi gì về sau.>
