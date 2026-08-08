# Kế hoạch: Radar auto-discovery cho màn pairing (giống Smart Life)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-pairing-radar-discovery`
- **Milestone:** M1 · B (mobile - pairing UX)
- **Phần liên quan:** mobile (chỉ JS)
- **Ngày tạo:** 2026-07-15
- **Cập nhật lần cuối:** 2026-07-16 (**revise #1** sau review B1-B5 của client - xem mục 6)

## 1. Mục tiêu & phạm vi

Dựng lại màn pairing theo đúng UX Smart Life mà client đính ảnh ("Searching for nearby
devices…"): **một mặt radar quét, thiết bị nào phát hiện được thì hiện icon (blip) ngay trên
sóng, chạm vào → popup xác nhận → mới bắt đầu pair + authen cloud**.

**Mode chọn tường minh qua dropdown - KHÔNG có `auto`** (revise #1): Android **EZ · AP · BLE**,
iOS **AP · BLE** (EZ không chạy được trên iOS). Mỗi mode có **hướng dẫn từng bước đánh số**, đủ chi
tiết để user làm theo được (AP phải nêu rõ bước nối điện thoại vào Wi-Fi của chính thiết bị).

Đồng thời gỡ **blocker chặn toàn bộ đường BLE trên Android**: app chưa bao giờ xin quyền
`BLUETOOTH_SCAN` lúc runtime → `startLeScan` im lặng, radar quét vào hư không.

**Ngoài phạm vi (không làm trong feature này):**
- **KHÔNG** wire unified `ActivatorService` (thế hệ API mới của Tuya). Client chốt scope: đi
  đường legacy + tự route ở JS bằng cờ `isCombo` native đã đẩy lên (B8 của
  `m1-fix-wifi-pairing`). Xem mục 5 - đây là món nợ kỹ thuật có chủ đích.
- **KHÔNG** đụng native (Kotlin/ObjC) → không rebuild native, cài lại APK là test được.
- Không làm kênh discovery wired / QR / Zigbee sub-device (thuộc unified API).
- Không đụng iOS entitlement multicast (đang chờ Apple duyệt - `m1-fix-wifi-pairing` B5).

## 2. Bối cảnh & ràng buộc

**Ràng buộc vật lý - thiết kế phải tôn trọng (đã phân tích & chốt với client 2026-07-15):**

- **EZ không discovery được.** EZ phát mù SSID/password/token qua multicast; không có gì để dò
  trước. ⇒ Radar **phải đứng sau** bước xác nhận Wi-Fi. Không tồn tại "cứ quét là ra" cho EZ.
- **EZ và AP không chạy song song được.** AP đòi điện thoại rời Wi-Fi nhà để nối hotspot thiết
  bị; EZ đòi điện thoại **đang ở** Wi-Fi nhà 2.4GHz. Một máy không ở hai mạng cùng lúc.
  ⇒ **KHÔNG** làm chuỗi tự động EZ→AP→BLE (sẽ thành ~6 phút chờ mù).
  ⇒ **(revise #1)** Client bỏ `auto` ⇒ **mỗi mode chạy đúng 1 kênh, không còn chạy song song gì
  cả.** Ràng buộc này vẫn ghi ở đây để sau này không ai "tối ưu" bằng cách gộp EZ+AP lại.
- **Blip EZ không gate được bằng tap.** EZ chỉ báo thiết bị qua `onStep(device_find)` giữa
  chừng, và lúc đó SDK **đã tự bind rồi**. ⇒ blip EZ là **hiển thị trạng thái**, chạm vào chỉ
  xem thông tin. Chỉ **blip BLE** mới có "chạm → pair thật". (AP cũng vậy: không discovery.)
- **(revise #1) Ở AP mode TUYỆT ĐỐI không prefill/scan Wi-Fi.** Lúc pair AP, điện thoại đang nối
  vào **hotspot của thiết bị** ⇒ "Wi-Fi đang kết nối" = `SmartLife-xxxx`, trong khi SDK cần SSID +
  password **của ROUTER**. Prefill ở AP = điền sai gần như chắc chắn, và lỗi trả về **không nói gì**
  về nguyên nhân. Doc: *"the ssid and password respectively specify the hotspot name and password of
  the **router** rather than that of the device."*
- **(revise #1) EZ thì ngược lại: prefill/scan là đúng** - lúc pair EZ điện thoại **đang ở** đúng
  mạng nhà cần truyền cho thiết bị.

**Ràng buộc dự án:**
- Tuya Data Center của SDK phải trùng Data Center của Cloud Project (EU) - không đụng ở feature này.
- Tài khoản Tuya phải là **Owner** của Home.
- RN CLI (không Expo).
- Chỉ đụng JS → giữ được mục tiêu "không rebuild native".

**Link nghiên cứu liên quan (bắt buộc - feature đụng Tuya SDK):**
- [docs/research/tuya-auto-scan-discovery.md](../../docs/research/tuya-auto-scan-discovery.md) -
  sensor "Wi-Fi" thực ra là **combo device**; Auto Scan của Smart Life dò bằng **BLE advertising**.
- [docs/research/tuya-home-sdk-device-pairing.md](../../docs/research/tuya-home-sdk-device-pairing.md) -
  2 thế hệ API (dòng 12-19); bộ quyền BLE bắt buộc: `BLUETOOTH`, `BLUETOOTH_ADMIN`,
  `BLUETOOTH_SCAN`, `BLUETOOTH_CONNECT`, `ACCESS_FINE_LOCATION`; unified `ActivatorService`
  (`startSearch` nhận LIST type model → `didFindDevice` kèm `activatorType` → `startActive`) chính
  là cách Smart Life suy ra mode mà không hỏi.
- [docs/research/tuya-home-sdk-bluetooth.md](../../docs/research/tuya-home-sdk-bluetooth.md) - `ScanDeviceBean`, `configType`.
- [docs/research/tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md) - iOS EZ cần entitlement multicast.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)

> Kiểm chứng được. Đây là cái `/test` sẽ check.

- [ ] **AC1** - Android 12+: vào màn pairing → app **hỏi quyền Bluetooth** (`BLUETOOTH_SCAN` +
      `BLUETOOTH_CONNECT` + `ACCESS_FINE_LOCATION`). Từ chối → màn hiện **lý do cụ thể + nút mở
      Settings**, **không** quay radar 120s rồi báo "No Walrus devices found".
- [ ] **AC2** - Radar hiện **1 icon blip / thiết bị** tìm thấy; nhiều thiết bị = nhiều blip cùng
      lúc (không còn nhảy thẳng sang màn "found" ở thiết bị đầu tiên). Vị trí blip **ổn định**
      giữa các lần re-render (không nhảy loạn).
- [ ] **AC3** - Chạm blip → **popup xác nhận** (tên · ID · loại · nguồn phát hiện) → bấm Add →
      sang màn connecting → pair thật.
- [ ] **AC4** *(viết lại - revise #1)* - Dropdown có **đúng 3 mode trên Android** (EZ · AP · BLE)
      và **đúng 2 trên iOS** (AP · BLE). **KHÔNG có `auto`.** Default: Android = EZ, iOS = AP. Đổi
      lựa chọn → nội dung hướng dẫn + hành vi quét + ô nhập Wi-Fi đổi theo.
- [ ] **AC5** *(viết lại - revise #1)* - **Mỗi mode chạy đúng MỘT kênh** (không còn chạy song
      song). EZ/AP: blip đến từ `onStep(device_find)`. BLE: blip đến từ scan, chạm được → pair.
- [ ] **AC6** - `tsc` 0 lỗi · `eslint` 0 lỗi · `jest` xanh, có test mới cho `blePermissions`,
      `radarModel`, `pairingModes`.
- [ ] **AC8** *(mới - revise #1)* - **EZ: Network name là DROPDOWN.** Bấm → quét Wi-Fi + liệt kê;
      chọn một mạng → **thu lại (collapse)** và điền vào ô. Máy không quét được (iOS / thiếu quyền)
      → **prefill mạng đang kết nối**, vẫn gõ tay được.
- [ ] **AC9** *(mới - revise #1)* - **AP: network name + password TỰ NHẬP.** Không dropdown, không
      nút scan, **không prefill** - kể cả khi đọc được SSID hiện tại (vì lúc đó nó là hotspot
      `SmartLife…` của thiết bị, không phải router).
- [ ] **AC10** *(mới - revise #1)* - Mỗi mode hiện **hướng dẫn từng bước ĐÁNH SỐ** (không phải một
      đoạn văn), đủ chi tiết để làm theo. **AP phải có bước "nối điện thoại vào Wi-Fi của thiết
      bị"**; nội dung AP **khác nhau giữa iOS và Android** (Android SDK tự nối hotspot → không được
      bảo user ra Settings). Nội dung khớp `docs/research/tuya-ios-ap-mode-pairing.md`.
- [ ] **AC7** - Trên máy thật **SM-A325F**: sensor combo hiện blip trên radar và pair thành công
      (đây là AC duy nhất cần thiết bị thật).

## 4. Các bước thực hiện

1. **B1 - Permission gate BLE (blocker, làm trước tiên)**
   - Việc cần làm: tạo `services/blePermissions.ts`: hàm `ensureBlePermissions()` trả kết quả có
     kiểu (`{ok:true}` | `{ok:false, reason:'denied'|'blocked'|'unsupported', message}`).
     Android 12+ (API 31+) xin `BLUETOOTH_SCAN` + `BLUETOOTH_CONNECT` + `ACCESS_FINE_LOCATION`;
     Android ≤ 11 chỉ `ACCESS_FINE_LOCATION`; iOS no-op (`{ok:true}` - hệ thống tự prompt).
     Dùng `PermissionsAndroid` (đã có sẵn, cùng pattern `wifiScanner.ts:46-58`).
     ⚠️ Manifest khai `BLUETOOTH_SCAN` **không có** `neverForLocation` → **phải** grant cả
     `ACCESS_FINE_LOCATION` mới nhận được kết quả scan. Giữ nguyên manifest (đổi = phải rebuild).
   - File đụng tới: `apps/mobile/src/services/blePermissions.ts` (mới),
     `apps/mobile/src/services/blePermissions.test.ts` (mới).
   - Kiểm thử: unit test (mock `PermissionsAndroid` + `Platform.Version`) cho 4 nhánh: granted ·
     denied · never-ask-again · Android ≤ 11.

2. **B2 - Radar model (logic thuần, không UI)**
   - Việc cần làm: tạo `services/radarModel.ts`: gom blip từ **2 nguồn** (`onBleScan` và
     `onPairingProgress` step `device_find` của EZ) thành một danh sách:
     `{ key, label, source:'ble'|'ez', angle, radius, raw }`. Dedupe theo `uuid` (BLE) / `devId`
     (EZ). **Vị trí blip sinh từ hash của key** (angle + radius tất định) → không nhảy chỗ khi
     re-render. Cap số blip hiển thị (vd 8) để radar không rối.
   - File đụng tới: `apps/mobile/src/services/radarModel.ts` (mới), `radarModel.test.ts` (mới).
   - Kiểm thử: unit test - dedupe, vị trí tất định (gọi 2 lần cùng key → cùng toạ độ), cap, phân
     biệt source.

3. **B3 - Registry mode + nội dung dropdown**
   - Việc cần làm: tạo `services/pairingModes.ts`: định nghĩa 4 mode
     `auto | ez | ap | ble` (đúng thứ tự client yêu cầu, default `auto`), mỗi mode gồm:
     `label`, `needsWifi`, `channels: ('ez'|'ble'|'ap')[]`, `instructions` (nội dung riêng từng
     mode), `hint`. `auto.channels = ['ez','ble']`; `ap.channels=['ap']` + hướng dẫn "nối hotspot
     trước"; `ble.needsWifi=false` (cho phép bỏ qua bước Wi-Fi).
   - File đụng tới: `apps/mobile/src/services/pairingModes.ts` (mới), `pairingModes.test.ts` (mới).
   - Kiểm thử: unit test - mỗi mode có instructions riêng khác nhau; `auto` gồm đúng EZ+BLE và
     **không** chứa AP (ràng buộc song song).

4. **B4 - Component RadarView (SVG)**
   - Việc cần làm: tạo `components/RadarView.tsx` bằng `react-native-svg` (**đã có sẵn** trong
     deps, không thêm lib): vòng tròn đồng tâm + tia quét xoay + blip có icon, mỗi blip là
     `Pressable`, `onPressBlip(key)`. Tái dùng token màu từ `useTheme()` như `pairingOrb` hiện tại
     ([PairingScreen.tsx:724-789](../../apps/mobile/src/screens/PairingScreen.tsx#L724-L789)).
   - File đụng tới: `apps/mobile/src/components/RadarView.tsx` (mới).
   - Kiểm thử: render test (jest) - N blip → N phần tử chạm được; bấm blip → gọi callback đúng key.

5. **B5 - Ráp vào PairingScreen**
   - Việc cần làm: (a) bước xác nhận Wi-Fi (prefill SSID hiện tại + password đã nhớ - logic đã có
     ở [PairingScreen.tsx:123-139](../../apps/mobile/src/screens/PairingScreen.tsx#L123-L139)) +
     **dropdown mode** thay cặp nút EZ/AP hiện tại (dòng 915-946); (b) màn `searching` dùng
     `RadarView`, **bỏ** nhảy thẳng sang `found` ở thiết bị đầu tiên (dòng 161-168) → gom vào
     `radarModel`; (c) chạm blip → **Modal popup** xác nhận → `connectFound()`; (d) mode `auto` →
     gọi `pairWifi(EZ)` **và** `startBleScan()` song song; (e) gọi `ensureBlePermissions()` trước
     mọi lần quét, thất bại → hiện lý do thay vì quay mù.
   - File đụng tới: `apps/mobile/src/screens/PairingScreen.tsx` (sửa lớn),
     `apps/mobile/src/services/pairing.ts` (có thể thêm helper gom EZ+BLE).
   - Kiểm thử: `tsc` + `eslint` + `jest` (test màn hình hiện có phải còn xanh).

6. **B6 - Verify thiết bị thật (SM-A325F)** · **chạy CUỐI CÙNG, sau B7-B9**
   - Việc cần làm: cài lại APK (JS-only, **không** rebuild native), chạy checklist AC1/AC2/AC3/
     AC5/AC7 + AC8/AC9/AC10 trên sensor combo thật; xuất "Copy diagnostics" (`pairingLog`) đối chiếu
     `sdk.blescan`. **Test riêng ca token/AP** ở mục 5 nếu có máy iOS.
   - File đụng tới: không (chỉ ghi kết quả vào `progress.md`).
   - Kiểm thử: manual device checklist (do `/test` sinh).

---

### Bước bổ sung sau revise #1 (client review 2026-07-16)

7. **B7 - `pairingModes.ts`: bỏ `auto`, còn 3 mode, hướng dẫn thành DANH SÁCH BƯỚC**
   - Việc cần làm: xoá mode `auto`. Android `['ez','ap','ble']`, iOS `['ap','ble']`. Default =
     phần tử đầu (Android EZ · iOS AP) thay cho hằng `DEFAULT_PAIRING_MODE` cứng.
     Đổi `channels: PairingChannel[]` → **`channel: PairingChannel`** (mỗi mode đúng 1 kênh; kiểu dữ
     liệu phải nói lên điều đó, đừng để mảng mời gọi người sau nhét thêm).
     Đổi `instructions: string` → **`steps: string[]`** (đánh số khi render).
     Thêm cờ **`wifiInput: 'dropdown' | 'manual' | 'none'`** (EZ→dropdown · AP→manual · BLE→none)
     - đây là thứ B8 dựa vào; đừng để PairingScreen tự đoán bằng `if (mode.id === 'ap')`.
   - File: `apps/mobile/src/services/pairingModes.ts` + `pairingModes.test.ts` (viết lại).
   - Kiểm thử: unit test - danh sách theo nền tảng; `auto` biến mất hẳn; AP có bước "nối vào Wi-Fi
     thiết bị"; AP iOS ≠ AP Android; EZ nói đèn NHANH / AP nói đèn CHẬM; `wifiInput` đúng từng mode.

8. **B8 - Ô nhập Wi-Fi theo mode: dropdown (EZ) vs tự nhập (AP)**
   - Việc cần làm: tách `wifiCard()` hiện tại (đang là card scan+list+saved, **không** phải dropdown
     thu gọn) thành 2 dạng theo `mode.wifiInput`:
     · `dropdown` (EZ): ô Network name bấm vào → xổ danh sách (quét qua `scanWifiNetworks()`, kèm
       mạng đã lưu), chọn → **collapse** + tự điền password đã nhớ nếu có. Không quét được → prefill
       `getCurrentWifiSsid()` + cho gõ tay (giữ `detectCurrentWifiAndFill()` đang có).
     · `manual` (AP): 2 ô gõ tay, **không** scan, **không** prefill. Kèm 1 dòng cảnh báo ngắn: đây
       là Wi-Fi **của nhà**, không phải hotspot `SmartLife…`.
     · `none` (BLE): ẩn hẳn.
     ⚠️ Prefill lúc mở màn (`useEffect` dòng ~123-139) hiện điền SSID cho **mọi** mode → phải chặn
     khi mode là AP, nếu không AP sẽ mang sẵn SSID sai ngay từ đầu.
   - File: `apps/mobile/src/screens/PairingScreen.tsx` (có thể tách `components/WifiPicker.tsx` nếu
     `PairingScreen` phình quá).
   - Kiểm thử: `tsc`/`eslint`/`jest` + render test cho dropdown nếu tách được component.

9. **B9 - `PairingScreen`: bỏ nhánh chạy song song + hiện hướng dẫn đánh số**
   - Việc cần làm: `startScan()` rút gọn theo `mode.channel` (1 kênh) - **xoá** nhánh "kênh Wi-Fi
     hỏng nhưng BLE vẫn quét" và `wifiChannelOf()` (không còn nhiều kênh để chọn). Lỗi kênh Wi-Fi
     giờ `finishError` thẳng. Render `mode.steps` thành **checklist đánh số** (dùng lại kiểu ô số
     tròn của step `prepare` đã xoá ở B5 - xem git history nếu cần).
   - File: `apps/mobile/src/screens/PairingScreen.tsx`.
   - Kiểm thử: `tsc`/`eslint`/`jest` xanh; đọc lại `startScan` xem còn nhánh song song nào không.

## 5. Rủi ro & câu hỏi mở

- ✅ **(XOÁ 2026-07-16, revise #1)** ~~EZ ‖ BLE song song có thể xung đột trong SDK~~ → **hết rủi
  ro**: client bỏ `auto` ⇒ mỗi mode chỉ chạy 1 kênh, không còn chạy song song. Đây là **lợi ích phụ
  đáng kể** của revise này: rủi ro lớn nhất của plan tự biến mất, và `startScan()` bớt hẳn một nhánh
  khó test (kênh này hỏng trong khi kênh kia còn sống).
- ⚠️ **Blip EZ có thể vô danh**: `onStep` step values **chưa được Tuya document**
  ([research, dòng 530](../../docs/research/tuya-home-sdk-device-pairing.md)) → `dataJson` có thể
  không moi ra được devId/tên → giảm thiểu: blip EZ hiện nhãn generic "Device found (Wi-Fi)",
  vẫn đạt AC5. B6 log lại step thật để chốt.
- ⚠️ **Location services (GPS) tắt → BLE scan trả rỗng** dù đã grant đủ quyền. Không có API JS
  nào check trực tiếp (`react-native-wifi-reborn` chỉ ném code `locationServicesOff` lúc *quét
  Wi-Fi*, xem [wifiScanner.ts:137-146](../../apps/mobile/src/services/wifiScanner.ts#L137-L146)) →
  giảm thiểu: khi radar không thấy gì mà quyền đã đủ, nhắc "bật Location services". Thêm lib để
  check = phải rebuild native ⇒ ngoài scope.
- ✅ **(GỠ 2026-07-16)** ~~iOS: mode `auto` thực chất chỉ chạy được BLE~~ → **đã thành quyết định
  chính thức**: client chốt "iOS để AP, EZ chưa support"; research xác nhận đây đúng khuyến nghị
  Tuya, và **AP legacy không cần entitlement nào**. **(revise #1)** iOS dropdown = **AP · BLE**,
  default **AP**. Xem [tuya-ios-ap-mode-pairing.md](../../docs/research/tuya-ios-ap-mode-pairing.md).
- ⚠️ **(revise #1) iOS mất luồng "vào màn là radar quay luôn".** Default iOS giờ là **AP** (cần
  nhập Wi-Fi trước) chứ không phải BLE ⇒ trải nghiệm iOS **không còn giống ảnh Smart Life** client
  gửi ban đầu, trừ khi user tự chọn mode BLE. Đây là hệ quả trực tiếp của việc bỏ `auto` - **client
  đã chốt**, ghi lại để sau này không ai tưởng là bug.
- 🔴 **(MỚI 2026-07-16) iOS/AP có thể lấy pairing token KHI ĐÃ MẤT MẠNG.** Doc: token phải lấy *"in
  the networked state"*; nhưng luồng AP bắt user rời Wi-Fi nhà sang hotspot thiết bị (mất internet)
  **trước** khi bấm pair, mà `pairWifi()` đang dùng `startWifiPairingAuto` - **tự lấy token bên
  trong, ngay lúc chạy**. → Giảm thiểu: **B6 phải test riêng ca này**; nếu đúng thì đổi sang lấy
  token TRƯỚC (lúc còn Wi-Fi nhà) rồi mới `startWifiPairing()` (bản token thủ công) - lib **đã có
  sẵn** `getPairingToken()` + `startWifiPairing()` nên **không phải đụng native**.
- ⚠️ **AP không lên radar được** (giống EZ, không có discovery) → trên iOS, nếu sensor không có BLE
  thì radar sẽ trống và AP là đường duy nhất. Càng làm câu hỏi "sensor có BLE beacon không" quan trọng.
- ⚠️ **Nợ kỹ thuật có chủ đích:** đi đường legacy + route bằng `isCombo` ở JS là *mô phỏng* cái
  unified `ActivatorService` làm sẵn (trả `activatorType` kèm mỗi `didFindDevice`). Nếu sau này
  cần wired/QR/Zigbee discovery thì phải wire unified API và màn này sẽ phải viết lại phần nguồn
  blip (RadarView + popup giữ nguyên được).
- ❓ **Sensor của client có thật sự phát BLE beacon không?** Quyết định AC7. Test 30 giây: mở
  Smart Life vào đúng màn radar trong ảnh, **không** bấm "Add manually" - nếu sensor tự hiện →
  có BLE → blip chạy. Nếu không bao giờ hiện → Wi-Fi thuần → **không radar nào dò ra được nó**
  (kể cả Smart Life), lúc đó blip chỉ đến từ kênh EZ.
- ❓ Có cần giới hạn blip theo `productId` của bồn Walrus không (lọc bớt thiết bị Tuya lạ của hàng
  xóm), hay hiện hết? Hiện plan: hiện hết, `radarModel` có sẵn chỗ cắm filter.

---

## 6. Lịch sử revise

### revise #1 - 2026-07-16 (client review sau khi B1-B5 xong)

**Nguyên nhân:** KHÔNG phải plan sai kỹ thuật, cũng không phải code lỗi - **yêu cầu đổi sau khi
client xem bản chạy được**. Mode `auto` là *suy luận thiết kế của tôi* (mô phỏng UX "không hỏi mode"
của Smart Life); client xem xong thì chọn hướng khác: 3 mode tường minh, và đòi thêm hướng dẫn từng
bước chi tiết - phần plan cũ **thiếu hẳn**.

| | Trước (plan gốc) | Sau (revise #1) |
|---|---|---|
| Mode | **4**: auto · ez · ap · ble (iOS: auto · ap) | **3**: ez · ap · ble (**iOS: ap · ble**) |
| Default | `auto` cả 2 nền tảng | Android **EZ** · iOS **AP** |
| Chạy kênh | `auto` = **EZ ‖ BLE song song** | **1 mode = 1 kênh**, không song song |
| Ô nhập Wi-Fi | một `wifiCard()` chung cho mọi mode | **EZ = dropdown có scan** · **AP = tự nhập, cấm prefill** · BLE = ẩn |
| Hướng dẫn | 1 chuỗi `instructions` ngắn | **`steps: string[]`** đánh số, chi tiết, khác nhau theo mode **và** nền tảng |
| iOS `auto` | BLE thuần → vào màn radar quay luôn | **mất** (default AP cần nhập Wi-Fi trước) |

**Được:** rủi ro lớn nhất của plan (EZ ‖ BLE xung đột SDK - chưa doc nào bảo đảm an toàn) **biến mất
hoàn toàn**; `startScan()` bớt một nhánh khó test.
**Mất:** iOS không còn "vào màn là radar quay luôn" như ảnh Smart Life (trừ khi tự chọn mode BLE).

**Ảnh hưởng tới code đã xong:** B1 (`blePermissions`) · B2 (`radarModel`) · B4 (`RadarView`)
**không đụng tới** - vẫn dùng nguyên. Chỉ B3 (`pairingModes`) viết lại và B5 (`PairingScreen`) sửa
lại → tách thành **B7 · B8 · B9**.
