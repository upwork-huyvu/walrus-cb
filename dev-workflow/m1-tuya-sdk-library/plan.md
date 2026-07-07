# Kế hoạch: Thư viện npm wrap Tuya Smart Life App SDK (TurboModule)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-tuya-sdk-library`
- **Milestone:** M1 - Nền tảng, Kết nối lõi & Quản lý User (Part A)
- **Phần liên quan:** mobile (thư viện native, dùng chung)
- **Ngày tạo:** 2026-06-28
- **Cập nhật lần cuối:** 2026-06-28 (refresh sau `/tuya-research` - sửa init signature, version, API names)

## 1. Mục tiêu & phạm vi
Xây **một thư viện npm độc lập** wrap Tuya Smart Life App SDK (Wi-Fi + Bluetooth)
bằng **TurboModule + Codegen, TypeScript**, target **RN 0.80+**. Đây là **nền
móng** của toàn bộ M1: mọi màn hình mobile (login, home, pairing, dashboard) đều
gọi qua lib này. Lib có **example app** để test thật trên cả Android + iOS, và
**không chứa business logic** của app bồn tắm (chỉ là wrapper SDK thuần).

Bề mặt API public (TurboModule spec) lib phải expose:
1. **Init SDK** - `initSdk()` (KHÔNG tham số data center; AppKey/AppSecret nạp native-only). Region đi theo countryCode lúc login + DC của AppKey.
2. **Login email** - `loginWithEmail`, `registerWithEmail`, `sendVerifyCode`.
3. **Third-party login** - `thirdLogin(type, idToken/code, ...)` (Google/Apple).
4. **Home management cơ bản** - tạo/list/lấy home hiện tại, `getHomeDetail`.
5. **Device pairing** - Wi-Fi **EZ + AP** (kèm lấy pairing token) + **Bluetooth**.
6. **Device control** - ghi **Data Points (DP)** `publishDps(json)` + đọc DP từ DeviceBean / `onDpUpdate`.
7. **Event emitter** - stream **device status** real-time (online/offline + DP).

**Ngoài phạm vi (không làm trong feature này):**
- Giao diện/màn hình app (thuộc `m1-mobile-auth`, `m1-mobile-pairing`, ...).
- Google/Apple **native sign-in UI** lấy idToken (làm ở `m1-mobile-auth`); lib chỉ
  nhận idToken/authCode rồi gọi `thirdLogin`.
- Backend NestJS / Tuya **Cloud OpenAPI** (đó là REST server-side - feature C).
- Home management nâng cao (multi-home, chia sẻ quyền, gán phòng) - M2.

## 2. Bối cảnh & ràng buộc
- ✅ **Đã research (2026-06-28):** [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md) - neo B2–B9 vào API thật (Android verbatim; iOS confirm tên class, vài signature cần mở trang khi code). Các ràng buộc dưới đây đã cập nhật theo doc.
- **KHÔNG có tham số "data center" trong init.** Region quyết bởi (a) **DC của Cloud Project/AppKey** (chọn lúc tạo App SDK trên console) + (b) **`countryCode`** lúc register/login. DC **cô lập** nhau ⇒ "SDK DC trùng Cloud Project" = **tạo AppKey đúng DC + login countryCode đúng vùng**.
- **EU = "Western Europe" DC** (ra mắt 2025-11-25). App tạo **trước** ngày này có thể ở **"Central Europe"** → **hỏi client AppKey thuộc DC nào**, đừng giả định.
- **AppKey/AppSecret + file bảo mật gắn package**: Android meta-data `THING_SMART_APPKEY`/`THING_SMART_SECRET` + **`security-algorithm.aar`** (libs/) + **SHA-256** fingerprint; iOS `startWithAppKey:secretKey:` + **`ios_core_sdk.tar.gz`**. Sai package/bundleId/SHA ⇒ init/login fail.
- **AppSecret + file bảo mật = native-only, KHÔNG vào JS/repo** (checklist security-secrets).
- Tài khoản link SDK phải là **Owner** (`HomeBean.role == 2`).
- **Version chốt:** `com.thingclips.smart:thingsmart:7.5.6`; Android **minSdk 24** (RN 0.80+), targetSdk 35; iOS pod min 11.0 nhưng RN cần ≥ 15.1 (OK). TurboModule chỉ là wrapper SDK native cổ điển; init chạy ở native startup hoặc trong `initSdk()`.
- **Pairing token sống 10 phút + chết sau 1 pair** → `getActivatorToken(homeId)` ngay trước mỗi lần pairing.
- **Link nghiên cứu liên quan:** [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] AC1: Lib scaffold bằng `create-react-native-library` (TurboModule + Codegen,
      TS) ở `packages/tuya-react-native/`; `tsc --noEmit` pass; Codegen build OK.
- [ ] AC2: Tuya native SDK tích hợp xong - Android `com.thingclips.smart:thingsmart`
      (Gradle + R8 keep rules + security image), iOS pods (CocoaPods + security
      file + Info.plist perms BLE/Local Network). **Example app build được cả 2 nền tảng**.
- [ ] AC3: TurboModule spec khai báo **đủ 7 nhóm API** ở mục 1, và native impl
      compile được trên cả 2 nền tảng (ít nhất binding + callback resolve/reject).
- [ ] AC4: Trong example app: `initSdk()` **trả về success** (không tham số DC); và
      `sendVerifyCode` với **countryCode EU** trả `onSuccess` (gián tiếp chứng minh
      account đi đúng Data Center). AppSecret + file bảo mật **không có trong JS/repo** (grep sạch).
- [ ] AC5: Smoke test luồng có thật-không-cần-thiết-bị: gọi `sendVerifyCode` hoặc
      `getCurrentUser` (nil khi chưa login) trả kết quả hợp lệ (không crash).
- [ ] AC6: `README.md` của lib mô tả **API TS public + cách cấu hình** (Data Center,
      vị trí AppKey/AppSecret/security image, yêu cầu Owner) + `.env.example`/sample config.

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test. `progress.md` tham chiếu B#.

1. **B1 - Scaffold thư viện**
   - Việc: `npx create-react-native-library@latest tuya-react-native` (chọn
     *Turbo module*, *Backward compat*, Kotlin/Swift, TS); đặt ở `packages/tuya-react-native/`.
   - File: `packages/tuya-react-native/{src,android,ios,example}`, `package.json`, `tsconfig.json`.
   - Test: `tsc --noEmit` pass; `example` build rỗng (Android assembleDebug).
2. **B2 - Định nghĩa TurboModule spec + types** *(cần research B1 ở trên)*
   - Việc: viết spec Codegen cho 7 nhóm API; types cho `DataCenter`, `LoginResult`,
     `Home`, `Device`, `DpValue`, `PairingConfig`, `DeviceStatusEvent`.
   - File: `src/NativeTuyaCore.ts` (+ `NativeTuyaPairing.ts` nếu tách), `src/types.ts`, `src/index.ts`.
   - Test: Codegen generate không lỗi; `tsc --noEmit` pass; example import được types.
3. **B3 - Android: thêm Tuya SDK deps + cấu hình** *(research §1)*
   - Việc: maven repos `maven-other.tuya.com/.../maven-releases` + `.../maven-commercial-releases`;
     `implementation 'com.thingclips.smart:thingsmart:7.5.6'` + `fileTree('*.aar', dir:'libs')`;
     đặt **`security-algorithm.aar`** vào `libs/`; AppKey/Secret qua manifest meta-data
     `THING_SMART_APPKEY`/`THING_SMART_SECRET`; R8 keep (`com.thingclips.**`, FastJSON, MQTT,
     OkHttp3/OkIO); **minSdk 24**/targetSdk 35; quyền (INTERNET, FINE_LOCATION, WIFI_STATE, BLUETOOTH_SCAN/CONNECT).
   - File: `android/build.gradle`, `android/src/main/AndroidManifest.xml`, `android/proguard-rules.pro`, `libs/security-algorithm.aar` (gitignored).
   - Test: `example` Android `assembleDebug` link thành công.
4. **B4 - iOS: thêm Tuya pods + cấu hình** *(research §1)*
   - Việc: Podfile `source tuya-pod-specs`, pods `ThingSmartCryption (:path=>'./')` +
     `ThingSmartHomeKit` + `ThingSmartBusinessExtensionKit`; giải nén **`ios_core_sdk.tar.gz`**
     → `Build/` + `ThingSmartCryption.podspec` ngang cấp Podfile; Info.plist (Bluetooth/Local
     Network/Location usage strings) + Privacy Manifest.
   - File: `tuya-react-native.podspec`, `example/ios/Podfile`, `example/ios/.../Info.plist`, `ios/Build/` (gitignored).
   - Test: `pod install` OK; example iOS build (nếu có Mac); nếu không → checklist thủ công.
5. **B5 - Impl `initSdk()` 2 nền tảng + smoke**
   - Việc: init SDK sớm; Android `ThingHomeSdk.init(context)` (đọc key từ manifest), iOS
     `[[ThingSmartSDK sharedInstance] startWithAppKey:secretKey:]` + `setupConfig`; expose
     `initSdk()` **KHÔNG tham số DC** + `onDestroy`.
   - File: `android/.../TuyaCoreModule.kt`, `ios/TuyaCore.swift`, `src/index.ts`.
   - Test: example gọi `initSdk()` resolve success; `sendVerifyCode(EU countryCode)` onSuccess (AC4).
6. **B6 - Impl auth: email + thirdLogin** *(research §2)*
   - Việc: `sendVerifyCodeWithUserName(user, region, countryCode, type)`, `registerAccountWithEmail`,
     `loginWithEmail` / `loginWithEmailCode`, `thirdLogin(countryCode, token, type, extraInfo)`
     (Google `"gg"`+idToken+`{"pubVersion":1}`, Apple `"ap"`); `getCurrentUser`, `logout`.
   - File: `android/.../TuyaAuthModule.kt`, `ios/TuyaAuth.swift`, `src/index.ts`.
   - Test: smoke `getCurrentUser`=nil khi chưa login (AC5); login email manual checklist (cần account test).
7. **B7 - Impl home management cơ bản**
   - Việc: `createHome`, `getHomeList`, `getCurrentHome`, `getHomeDetail`.
   - File: `android/.../TuyaHomeModule.kt`, `ios/TuyaHome.swift`, `src/index.ts`.
   - Test: manual checklist (cần login) - tạo + list home.
8. **B8 - Impl pairing Wi-Fi (EZ + AP) + token** *(research §4)*
   - Việc: `getActivatorInstance().getActivatorToken(homeId)` **ngay trước mỗi lần pair** (token 10 phút);
     `ActivatorBuilder` mode `TY_EZ` / `TY_AP` (ssid/pwd/token/timeout) + `IThingSmartActivatorListener`
     (onActiveSuccess/onError/onStep); `newMultiActivator().start()/stop()/onDestroy()`. Chỉ 2.4GHz.
   - File: `android/.../TuyaPairingModule.kt`, `ios/TuyaPairing.swift`, `src/index.ts`.
   - Test: **device test checklist** (thiết bị thật) - pair EZ, fallback AP.
9. **B9 - Impl pairing BLE + control DP + status emitter** *(research §5, §6)*
   - Việc: BLE scan `getBleOperator().startLeScan(LeScanSetting SINGLE)` → `BleActivatorBean(+homeId)`
     → `newBleActivator().startActivator(IBleActivatorListener)`; control `newDeviceInstance(devId).publishDps(json)`
     (value-type là SỐ); event emitter map từ `IDevListener.onDpUpdate/onStatusChanged` + register/unregister.
   - File: `android/.../TuyaBleModule.kt`/`TuyaDeviceModule.kt`, `ios/*.swift`, `src/index.ts`, `src/events.ts`.
   - Test: shape event (unit); **device checklist**: đọc DP nhiệt độ (dpId thật lấy từ thiết bị), set DP, nhận `onDpUpdate`.
10. **B10 - Quét secret + README/API docs + sample config**
    - Việc: `.gitignore` phủ security image/keystore/gradle.properties/plist secret;
      `README.md` (API + setup + Data Center + Owner); `.env.example`/sample.
    - File: `packages/tuya-react-native/{README.md,.gitignore,example/.env.example}`.
    - Test: `grep -rin "appsecret\|secret" --exclude-dir=node_modules` sạch; README có đủ mục (AC6).

## 5. Rủi ro & câu hỏi mở
- ⚠️ **DC mismatch = bug ẩn** (không có error code riêng; biểu hiện = login fail / không thấy thiết bị). → chốt **Western Europe** cho AppKey + Cloud Project + countryCode EU. **Xác minh DC thực tế của AppKey** (app tạo trước 2025-11-25 có thể ở Central Europe).
- ⚠️ **Pairing token 10 phút + chết sau 1 pair** → lấy token mỗi lần pair (code `-55` = hết hạn).
- ⚠️ **EZ tỉ lệ thấp** → luôn có nút AP fallback; chỉ Wi-Fi 2.4GHz.
- ⚠️ **`publishDps.onSuccess` ≠ điều khiển xong** → update UI khi `onDpUpdate` về; value-type DP phải đúng kiểu số (sai → `-1400`).
- ⚠️ **dpId của ice-bath chưa biết** (nhiệt độ hiện tại/mục tiêu/power/UV/defrost) → đọc DP schema từ **thiết bị thật + productId** ở B9.
- ⚠️ **iOS signature** (ThingSmartUser/Activator/BLEWifiActivator) mới confirm tên class → mở trang iOS khi code (URL trong research note).
- ⚠️ **thirdLogin Google/Apple** cần bật kênh trên Tuya Console + đúng `type` (`"gg"`/`"ap"`).
- ⚠️ Pairing/BLE cần **quyền runtime** (location, BLE) + **thiết bị thật** để test B8–B9 (simulator không pair được).
- ❓ Cần user cung cấp: **AppKey + AppSecret + 2 file bảo mật** (Android `.aar` / iOS `.tar.gz`), **DC của AppKey (EU?)**, **applicationId + SHA-256 (Android) + bundleId (iOS)** đã đăng ký, xác nhận **Owner**.
- ❓ Vị trí lib: `packages/tuya-react-native` (monorepo workspace) - app `apps/mobile` consume ở `m1-mobile-scaffold`. (Chốt: monorepo.)
