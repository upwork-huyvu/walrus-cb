# Progress: Fix pairing Wi-Fi (EZ) thất bại + lỗi không chi tiết

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-fix-wifi-pairing`
- **Phase hiện tại:** `DEV` (B1–B4 + B6 ✅ · B8 + B9 mới thêm, chưa code · B5 + B7 cần người thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-10

## 📋 Checklist B7 - test trên thiết bị thật (không tự động hoá được)

> Mọi lần fail: bấm **"Copy diagnostics"** ở màn lỗi → dán vào `context.md`. Log **không chứa password**.

**Android (SM-A325F) - đường EZ:**
- [ ] Bồn ở EZ mode (đèn nháy **nhanh**). Điện thoại nối Wi-Fi **2.4GHz**.
- [ ] Mở pairing → SSID tự điền → Continue with EZ → Start pairing.
- [ ] Nếu điện thoại đang ở 5GHz: preflight phải **chặn** kèm message có số MHz. ← AC5
- [ ] Pair thành công → thiết bị hiện ở Device List. ← AC1

**iOS (iPhone thật) - đường AP (mặc định):**
- [ ] Mode mặc định phải là **AP · recommended**. ← B4
- [ ] Reset bồn tới **đèn nháy chậm** → Settings → nối hotspot của bồn → quay lại → Start pairing.
- [ ] Pair thành công. ← AC2
- [ ] Thử EZ trên iOS: kỳ vọng **fail** (chưa có entitlement) nhưng phải hiện **mã lỗi + message thật**,
      **không** phải `[sdk:pairing_error] Unknown error.` ← AC3

**BLE discovery-first (B9 · AC9) - QUAN TRỌNG:**
- [ ] Bật **Bluetooth** + cấp **quyền Bluetooth** cho app. Vào Add device → **KHÔNG** phải nhập Wi-Fi trước;
      màn "Searching…" tự chạy.
- [ ] Thiết bị Tuya Wi-Fi (combo) **tự hiện ra** (giống Smart Life) → chạm → hiện ô nhập Wi-Fi → nhập → Connect → pair xong. ← AC9
- [ ] Diagnostics có `bleType`/`configType` thật + `isCombo` (không còn `deviceType:0`). ← AC8
- [ ] Không thấy thiết bị nào → sau timeout có nút **"Add manually with Wi-Fi"** → về luồng EZ/AP cũ, vẫn pair được.
- [ ] (nếu có thiết bị BLE-thuần) chạm → pair **không** hỏi Wi-Fi.

**Security-level (B8 · AC8):**
- [ ] Pair thiết bị an ninh/cảm biến `*Security` → **không còn treo tới timeout**; diagnostics có `sdk.security_level_continue`.

**Chung:**
- [ ] Ép fail (tắt nguồn bồn) → màn lỗi hiện mã Tuya thật; nếu SDK báo giữa chừng thì có khối **"SDK REPORTED"**. ← AC3
- [ ] Bấm "Copy diagnostics" → có `ui.attempt` · `sdk.step` · `wifi.error` + platform. Password **không** xuất hiện. ← AC4
- [ ] Khi timeout: checklist Connecting **KHÔNG** nhích tiếp (nhãn "Pairing timed out"). ← AC6
- [ ] **Ghi lại chuỗi `sdk.step` THẬT của Android** (doc Tuya không liệt kê) → cập nhật `pairingStepLabel()`
      + bổ sung vào `docs/research/tuya-home-sdk-device-pairing.md`.
- [ ] **Đối chiếu mã lỗi thật với bảng `SDK_CODES`** (`errors.ts`) - research nghi nó map sai miền
      (bảng dùng số **dương** `1001..1007`, doc chính chủ dùng **âm** `-1000/-1006/-33/-55`). Có mã thật rồi mới sửa.

## ▶ Hành động kế tiếp (đọc cái này trước tiên)

**Việc ngoài code, làm NGAY (không chặn ai, mất 3-5 ngày chờ Apple):**
nộp đơn xin entitlement multicast tại https://developer.apple.com/contact/request/networking-multicast
- phần giải thích **bắt buộc nhắc**: *"UDP ports 6666 and 6667 and TCP port 6668"*.

**TOÀN BỘ PHẦN CODE (B1-B4, B6, B8, B9) XONG & verify xanh.** Còn lại đều cần **người thật** - chạy song song:
1. **Checklist B7 + AC8/AC9 trên thiết bị thật** (dưới đây). Đây là thứ duy nhất xác nhận: BLE discovery tự
   hiện thiết bị? combo route đúng? security-level hết treo? Android fail vì gì?
2. **Nộp đơn entitlement Apple** → [`apps/mobile/PAIRING_MULTICAST_SETUP.md`](../../apps/mobile/PAIRING_MULTICAST_SETUP.md) (chỉ để mở lại EZ trên iOS).

⚠️ **Rebuild app cần thiết**: B8/B9 đụng **native** (`TuyaPairing.mm`, `TuyaPairingModule.kt`) → phải build lại
app (không chỉ reload JS) mới test được trên máy.

⚠️ **Chưa `git add`**: `pairingLog.ts` · `pairingPreflight.ts` + 3 file test mới · `PAIRING_MULTICAST_SETUP.md`
+ 3 research note mới (`tuya-wifi-ez-pairing-failure` · `tuya-wifi-motion-sensor-pairing` · `tuya-ios-sample-pairing-comparison` · `tuya-auto-scan-discovery`)
(nhắc lại cạm bẫy `.gitignore` cũ ở INDEX: file mới không commit thì biến mất giữa các session).

## Checklist các bước (đồng bộ với plan.md mục 4)

- [x] B1 - Native reject đúng chuẩn `{code, message, domain}` (iOS + Android) · **done** (Kotlin ✅ · iOS ✅)
- [x] B2 - `describeError()` không nuốt message native (+ test) · **done** (jest 123/123 · tsc 0 · eslint 0)
- [x] B3 - Log chẩn đoán + **surface `error` của step callback** + step iOS có nghĩa · **done**
- [x] B4 - ⭐ **AP mode thành đường pair chính trên iOS** (né entitlement + né 5GHz) · **done**
- [ ] B5 - Xin entitlement multicast iOS · **blocked - việc của người** (nộp đơn Apple, 3-5 ngày).
      Entitlement **CỐ Ý chưa thêm vào repo**: thêm trước khi Apple duyệt → provisioning profile thiếu quyền →
      **Xcode fail lúc ký**, hỏng build đang chạy được. Hướng dẫn: [`apps/mobile/PAIRING_MULTICAST_SETUP.md`](../../apps/mobile/PAIRING_MULTICAST_SETUP.md)
- [x] B6 - Preflight chặn sớm (SSID rỗng · 5GHz/6GHz · cảnh báo iOS-EZ · không đọc được băng tần) · **done**
- [ ] B7 - Verify end-to-end trên ice tub thật (Android + iOS) · **blocked - cần thiết bị thật** (checklist bên dưới)
- [x] B8 - Native: security-level handshake + đẩy `bleType`/`configType`/`isCombo` lên JS · **done (code)** - AC8 chờ device
- [x] B9 - UX: BLE-discovery-first làm luồng chính, EZ/AP thành "Add manually" · **done (code)** - AC9 chờ device

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)

- [ ] AC1 - Pair thành công trên **Android** thiết bị thật (EZ **hoặc** AP)
- [ ] AC2 - Pair thành công trên **iOS** thiết bị thật (**AP**; EZ chờ Apple duyệt entitlement)
- [ ] AC3 - Lỗi hiện **mã Tuya thật + message native** (hết `[sdk:pairing_error] Unknown error.`)
- [ ] AC4 - Log chẩn đoán copy được (mode · ssid · băng tần · homeId · token · steps · raw error)
- [ ] AC5 - Preflight chặn sớm kèm thông báo hành động được
- [ ] AC6 - iOS emit step có nghĩa → checklist Connecting nhích đúng
- [ ] AC7 - `tsc` 0 · `eslint` 0 · `jest` xanh · `compileDebugKotlin` xanh · iOS build xanh
- [ ] AC8 - Pair thiết bị security-level không treo (auto continue) + `bleType` thật trong log
- [ ] AC9 - Add device → thiết bị Wi-Fi combo TỰ HIỆN → chạm → nhập Wi-Fi → pair xong (giống Smart Life); fallback EZ/AP còn chạy

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-10 | TEST B8+B9 | ✅ | `tsc` 0 · `eslint` 0 error (134 warning `no-inline-styles` sẵn có) · `jest` **178/178** (+5 test `deviceNeedsWifi`) · `compileDebugKotlin` **BUILD SUCCESSFUL** · iOS `xcodebuild TurboTuya` **BUILD SUCCEEDED**. *(Kotlin build đầu fail vì gradle daemon cũ mất PATH `node` - `./gradlew --stop` rồi build lại xanh; KHÔNG phải lỗi code.)* AC8/AC9 chờ thiết bị thật. |
| 2026-07-10 | DEV B9 | ✅ | `PairingScreen`: initial step `'searching'` + effect **tự `startAutoScan`** khi vào màn (BLE discovery-first, KHÔNG bắt nhập Wi-Fi trước). `found` route theo `deviceNeedsWifi`: **combo → hỏi Wi-Fi (wifiCard) SAU khi chạm → `pairBleWifi`**; BLE thuần → `pairBle` thẳng. EZ/AP (`intro`) thành lối **"Add manually with Wi-Fi"** (link ở màn searching + error). `connectFound` route + `pairBle` wrapper mới trong `pairing.ts`. |
| 2026-07-10 | DEV B8 | ✅ | iOS `TuyaPairing.mm`: implement `didPassWIFIToSecurityLevelDeviceWithUUID:` → auto `continueConfigSecurityLevelDevice` + emit `sdk.security_level_continue`. BLE scan emit **`bleType`(int)+`isCombo`** (iOS, thay `deviceType=0`) / **`configType`+`providerName`+`isCombo`** (Android). Enum `ThingSmartBLEType` + Android `config_type_*` lấy **verbatim** (header SDK + `javap` trên thingsmart 7.5.6). Helper `deviceNeedsWifi()` + type mở rộng ở `index.tsx`/`pairing.ts`. |
| 2026-07-10 | FIX-PLAN | ✅ | **+B8 +B9** (user duyệt). Research sample ObjC + Auto Scan doc → 4 note (`tuya-wifi-motion-sensor-pairing`, `tuya-ios-sample-pairing-comparison`, `tuya-auto-scan-discovery`, +cũ). Phát hiện: Smart Life "Auto Scan" = **BLE beacon**; thiết bị Tuya Wi-Fi là **combo**; sample **route theo `bleType`** (mình vứt); sample có **security-level handshake** (mình thiếu). → B8 (bleType + continueConfigSecurityLevelDevice), B9 (BLE-discovery-first UX, EZ/AP fallback). +AC8 +AC9. **Mở rộng scope**: từ "fix lỗi pairing" → "thêm luồng pairing kiểu Smart Life". |
| 2026-07-10 | TEST B3+B4+B6 | ✅ | `tsc` 0 · `eslint` 0 error · `jest` **173/173** (18 suite, +50 test mới) · iOS `xcodebuild TurboTuya` **BUILD SUCCEEDED**. Lib `tsc` báo 1 lỗi ở `example/src/sections/AdvancedSection.tsx` - **xác minh là có SẴN từ trước** (stash bản sửa `index.tsx` → lỗi vẫn còn; file không hề dùng `PairingProgressEvent`), không phải do thay đổi này. |
| 2026-07-10 | DEV B5 | ⏸️ | **CỐ Ý không thêm entitlement vào repo.** Thêm `com.apple.developer.networking.multicast` trước khi Apple duyệt → provisioning profile thiếu quyền → **Xcode fail lúc ký**, phá build đang chạy được, đổi lấy một thứ chưa dùng được. Thay vào đó viết `apps/mobile/PAIRING_MULTICAST_SETUP.md` (form + bắt buộc nhắc UDP 6666/6667 + TCP 6668 + rủi ro App Store URL). Không chặn ai vì iOS đã pair được bằng AP (B4). |
| 2026-07-10 | DEV B6 | ✅ | `pairingPreflight.ts` (mới) + `wifiScanner.ts`: `bandOfFrequency()` / `getCurrentWifiBand()`. Chặn: SSID rỗng · EZ trên **5GHz/6GHz** (message nêu rõ số MHz + lối thoát AP). Cảnh báo: EZ trên iOS (entitlement) · không đọc được băng tần. **Phát hiện:** `getFrequency()` của wifi-reborn là **Android only** → iOS **không thể** kiểm băng tần; code nói thật thay vì giả vờ đã kiểm. `wifiScanner.ts` vốn đã đọc `frequency` nhưng chưa dùng. |
| 2026-07-10 | DEV B4 | ✅ | iOS mặc định **AP mode** (`+ · recommended`), Android giữ EZ. Preflight chặn ở cả `Continue` lẫn `Start pairing`; banner đỏ (chặn) / vàng (cảnh báo); banner tự xoá khi đổi ssid/mode. |
| 2026-07-10 | DEV B3 | ✅ | `pairingLog.ts` (ring buffer 120, **redact password/token**, `dumpPairingLog()` có header platform + timeline tương đối) + nút **"Copy diagnostics"** (dùng `Share` của RN core - repo chưa có lib clipboard). **Sửa 3 bug iOS:** step callback giờ đẩy `errorCode/errorMessage/errorDomain` lên JS (trước bị vứt); enum → tên (`device_found/registered/initialized/timeout`); `deviceStateError:` đã implement; `isFailureStep()` chặn UI nhích checklist khi timeout. |
| 2026-07-10 | TEST B1+B2 | ✅ | `compileDebugKotlin` **BUILD SUCCESSFUL** · `xcodebuild -target TurboTuya -sdk iphoneos` **BUILD SUCCEEDED** (log xác nhận compile đúng `packages/.../TuyaPairing.mm` qua symlink, cùng inode) · `tsc` 0 lỗi · `eslint` 0 error · `jest` **123/123** (15 suite), riêng `pairing.test.ts` **21/21** gồm test **hồi quy** chốt không bao giờ trả lại chuỗi `Unknown error` khi native đã có message. |
| 2026-07-10 | DEV B2 | ✅ | `pairing.ts`: thêm `errorDetail()` + viết lại `describeError()`. Message native **luôn thắng**; `TuyaErrors.describe()` chỉ dùng cho **mã số** (mã phi-số chính là nguồn `'unknown'`); `domain` đọc từ `userInfo`. Bổ sung 15 test vào `pairing.test.ts` (giữ nguyên test cũ, dùng lại helper `load()`, thêm `loadModule()` để bơm `TuyaErrors` giả). |
| 2026-07-10 | DEV B1 | ✅ | `TuyaPairing.mm`: mọi `reject` đi qua `TuyaReject.h` (helper **có sẵn mà chưa module nào dùng** - dead code). Thêm `TuyaRejectNSError()` → dùng **`NSError.code` thật** + `localizedDescription`. `TuyaPairingModule.kt`: mọi `promise.reject` → `TuyaReject.reject(..., "sdk")`, không nuốt `msg`. Grep xác nhận **0 reject thô còn sót** ở cả 2 file. **Phát hiện thêm** (đẩy sang B3): `ThingActivatorStep` enum thật (4 = **TimeOut**), step callback **vứt mất tham số `error`**, `deviceStateError:` chưa implement. |
| 2026-07-10 | RESEARCH | ✅ | `/tuya-research` → [tuya-wifi-ez-pairing-failure.md](../../docs/research/tuya-wifi-ez-pairing-failure.md). **(1) iOS root cause XÁC NHẬN:** doc Tuya nói rõ iOS 14.5+ **không gửi được gói EZ** nếu thiếu entitlement `com.apple.developer.networking.multicast` (Apple duyệt 3-5 ngày; form đòi App Store URL; phải nhắc UDP 6666/6667 + TCP 6668). **(2) ❌ TỰ BÁC BỎ giả thuyết Android:** `CHANGE_WIFI_MULTICAST_STATE` **đã có sẵn** trong merged manifest (AAR Tuya khai) - lần trước grep nhầm manifest nguồn. ⇒ Android vẫn **chưa rõ** nguyên nhân. **(3) ĐỔI HƯỚNG:** Tuya khuyến nghị **AP mode** thay EZ cho iOS 14.5+; AP né cả entitlement lẫn 5GHz → B4 thành đường chính, AC1/AC2 viết lại "EZ hoặc AP". **(4)** Nghi `errors.ts` map sai miền mã lỗi (dương vs âm). |
| 2026-07-10 | PLAN | ✅ | Truy vết đủ root cause `[sdk:pairing_error] Unknown error.` (4 mắt xích: `TuyaPairing.mm:104` → `pairing.ts:164-167` → `errors.ts:145` → `errors.ts:198`). User xác nhận Smart Life pair được bằng **EZ**. Băng tần Wi-Fi chưa rõ. ⚠️ *Kết luận permission Android ở lượt này SAI, đã sửa ở lượt RESEARCH.* |

## Vấn đề đang chặn (Blockers)

- 🔴 **B7 cần thiết bị thật** (ice tub + iPhone + Android). Không tự động hoá được. Checklist ở trên.
- 🔴 **B5 cần Apple duyệt** (3-5 ngày). Form đòi **App Store URL** mà app **chưa phát hành** → chưa rõ Apple có nhận.
  **Đã de-risk:** AC1/AC2 không phụ thuộc EZ trên iOS; AP mode (B4) là đường chính và chạy được ngay.
- ❓ **Android fail vì gì? - VẪN CHƯA BIẾT.** Giả thuyết permission đã bị bác bỏ (quyền có sẵn trong merged manifest).
  Ứng viên số 1: **Wi-Fi 5GHz**. B6 preflight giờ sẽ **chặn và nói rõ** nếu đúng vậy. B3 log sẽ trả lời nếu không.
- ❓ **Ice tub có hỗ trợ AP mode không?** (đèn nháy **chậm**). Khách mới chỉ xác nhận EZ chạy trên Smart Life.
  → **Nhờ khách thử pair bằng AP trên Smart Life.** Nếu bồn KHÔNG hỗ trợ AP thì iOS buộc phải chờ Apple duyệt
  (hoặc dùng combo BLE+Wi-Fi nếu bồn có BLE) → sẽ cần `/fix-plan`.
- ❓ Chưa biết **ice tub có BLE hay không** (phương án dự phòng thứ 2). Xác nhận ở B7 bằng `startBleScan()`.
