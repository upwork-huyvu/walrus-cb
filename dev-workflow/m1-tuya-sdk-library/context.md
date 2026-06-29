# Context: Thư viện npm wrap Tuya Smart Life App SDK (TurboModule)

> File "trí nhớ" — giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-tuya-sdk-library`

## Quyết định kỹ thuật (Decision log)
> Kế thừa từ `m1-scaffold-and-tuya-init` (đã superseded).

- **2026-06-28** — **Wrap Tuya SDK thành thư viện npm riêng** (`packages/tuya-react-native`),
  scaffold bằng `create-react-native-library` (**TurboModule + Codegen, TS**, target
  RN 0.80+), thay vì nhúng native deps trực tiếp vào app hay dùng package community
  cũ. Lý do: tách bạch, tái dùng, không lỗi thời, hợp new-arch. Đã loại: package
  cộng đồng cũ; bridge rời rạc trong app.
- **2026-06-28** — Lib **không chứa business logic** bồn tắm; chỉ là wrapper SDK
  thuần (init/login/home/pairing/DP/status). Business logic ở `apps/mobile`.
- **2026-06-28** — `thirdLogin`: lib **chỉ nhận idToken/authCode** rồi gọi SDK;
  việc lấy idToken (Google/Apple native UI) thuộc `m1-mobile-auth`.
- **2026-06-28** — Monorepo: lib ở `packages/`, app `apps/mobile` consume qua npm
  workspace (wiring làm ở `m1-mobile-scaffold`).
- **2026-06-28** — Mobile = **RN CLI**, KHÔNG Expo (cần native module). `replit_generate/`
  (Expo Snack) chỉ là tham chiếu thiết kế.
- **2026-06-28 (sau /tuya-research)** — Bề mặt init = **`initSdk()` KHÔNG tham số data center**.
  Lý do: SDK Tuya không nhận tham số DC; region đi theo (a) DC của Cloud Project/AppKey +
  (b) `countryCode` lúc login. Đã loại: API `initSdk(dataCenter, appKey)` (sai — không tồn tại).
- **2026-06-28 (sau /tuya-research)** — Pin version: `thingsmart 7.5.6`, Android minSdk **24**
  (thay vì 23 của Tuya, vì RN 0.80+), targetSdk 35. File bảo mật: Android `security-algorithm.aar`,
  iOS `ios_core_sdk.tar.gz` (khác nhau 2 nền tảng).
- **2026-06-28 (B1 scaffold)** — Native = **kotlin-objc** (iOS = Obj-C++ `.mm`), KHÔNG kotlin-swift
  như brief gợi ý. Lý do: SDK iOS của Tuya là Obj-C → import/gọi từ Obj-C++ mượt nhất, khỏi cầu nối
  Swift. Đã loại: kotlin-swift (thêm bridging phức tạp khi gọi SDK Obj-C).
- **2026-06-28 (B1)** — `create-react-native-library@0.63` sinh: **RN 0.85.0**, **yarn 4.11 (berry,
  bundled trong `.yarn/`)**, typescript 6, package `@cool-bath/tuya-react-native`, codegenConfig
  name `TuyaReactNativeSpec`, java package `com.coolbath.tuyareactnative`, example **vanilla** (RN CLI).
  Đã gỡ nested `.git` để sau này gộp vào monorepo root.
- **2026-06-28 (B2)** — Event device-status/pairing/BLE dùng **`addListener`/`removeListeners` +
  `NativeEventEmitter`** (KHÔNG dùng codegen `EventEmitter` type). Lý do: ổn định, tránh rắc rối
  type của strict-api. Object type cho codegen khai báo **inline trong file spec** (codegen không
  follow import chéo file).
- **2026-06-29 (audit 5-agent + build-readiness)** — Sau workflow đối chiếu developer.tuya.com:
  (a) **API native Android xác nhận ĐÚNG** (imports `com.thingclips.*`, signatures, listeners, parity JS↔native 26/26)
  → KHÔNG sửa SDK surface; (b) **`:app` phải TỰ khai repo Maven Tuya** vì transitive `thingsmart` KHÔNG kế thừa
  repositories của lib module (đặc tính Gradle) → thêm `allprojects.repositories` ở `example/android/build.gradle`;
  (c) **`example/android/gradle.properties`** vừa là file build BẮT BUỘC (`newArchEnabled`/`hermesEnabled`) vừa chứa
  Tuya key — gitignored nên phải tạo lại mỗi máy (đã tạo, mirror `apps/mobile`); (d) Android **`startBlePairing`** đã
  implement (`BleActivatorBean(scan)` + `getActivator().newBleActivator()`); (e) iOS **`RCT_EXPORT_MODULE()`** đã thêm
  (thiếu macro → module không đăng ký, `getEnforcing` throw lúc import). Toolchain chốt: **JDK17 + Gradle 9.3.1 +
  AGP 8.12 + compileSdk/buildTools 36 + NDK 27.1.12297006** (LÀ 36, không phải 35 như note research cũ).
- **2026-06-29 (REFACTOR: tách 5 TurboModule theo folder)** — Theo yêu cầu user ("chia tính năng theo folder,
  đừng 1 file"). Bỏ module gộp `TuyaReactNative` → **5 TurboModule độc lập**: `TuyaCore` (init/version/destroy),
  `TuyaAuth` (email+third+session), `TuyaHome`, `TuyaPairing` (wifi EZ/AP + BLE + token; phát onPairingProgress/
  onBleScan), `TuyaDevice` (DP + listeners; phát onDeviceStatus). Codegen VẪN 1 lib (`codegenConfig.name=
  TuyaReactNativeSpec`, `jsSrcsDir=src` quét đệ quy `src/specs/*`). Native theo folder: Android packages
  `com.coolbath.tuyareactnative.{core,auth,home,pairing,device}` (1 `TuyaReactNativePackage` đăng ký cả 5); iOS
  `ios/{Core,Auth,Home,Pairing,Device}` mỗi class có `RCT_EXPORT_MODULE()` + getTurboModule riêng (podspec glob
  `ios/**` đã phủ). `index.tsx` giữ **facade phẳng `Tuya`** (tương thích `Tuya.<method>()`) + export sub-module.
  `addListener/removeListeners` chỉ ở Pairing+Device (2 module phát event). Đã XOÁ: `src/NativeTuyaReactNative.ts`,
  `TuyaReactNativeModule.kt`, `ios/TuyaReactNative.{h,mm}`. Lý do chọn multi-module (không phải 1 module + handler):
  tách thật, độc lập test/maintain; đánh đổi = nhiều boilerplate (5 spec + 5 register).
- **2026-06-29 (RENAME lib — bỏ @cool-bath)** — Theo yêu cầu user: npm `@cool-bath/tuya-react-native` →
  **`@jimmy-vu/react-native-turbo-tuya`**; pod/podspec `TuyaReactNative` → **`TurboTuya`** (file `TurboTuya.podspec`);
  codegen `TuyaReactNativeSpec` → **`TurboTuyaSpec`**; java package `com.coolbath.tuyareactnative` →
  **`com.jimmyvu.turbotuya`** (đã di chuyển cây thư mục Android); package class `TuyaReactNativePackage` →
  **`TurboTuyaPackage`**; source export condition `cool-bath-tuya-react-native-source` → **`react-native-turbo-tuya-source`**
  (đồng bộ ở package.json/tsconfig/metro/vite). **Tên 5 module JS GIỮ nguyên** (TuyaCore/Auth/Home/Pairing/Device) —
  rename chỉ ở cấp package/lib, KHÔNG ở module. **App ví dụ GIỮ identity cũ** (`TuyaReactNativeExample`, applicationId
  `coolbath.tuyareactnative.example`) vì gắn đăng ký Tuya console + đổi pbxproj iOS rủi ro. ⚠️ Nếu muốn rebrand app
  ví dụ thì làm TRƯỚC khi đăng ký console (đỡ phải đăng ký lại). Thư mục `packages/tuya-react-native/` giữ nguyên tên.
- **2026-06-29 (RESEARCH toàn bộ Home SDK surface)** — Workflow 11 agent research các tính năng Home SDK còn lại
  (Android+iOS, cited) → 11 note + overview ở `docs/research/tuya-home-sdk-*.md` (index: `tuya-home-sdk-full-surface.md`).
  **Kế hoạch mở rộng lib (đề xuất, CHƯA implement):** mở rộng TuyaAuth (profile/tempUnit/onSessionExpired/reset/cancel),
  TuyaHome (updateHome/weather/transfer/room/listener), TuyaDevice (rename/remove/reset/detail/snapshot+schema/queryDp/
  publishDpsAwaitAck/bleConnect/online), TuyaPairing (combo BLE+Wi-Fi/sub-device/QR/wired/auto-token); module MỚI:
  **TuyaOta, TuyaScene, TuyaMessage (push+message+DND), TuyaTimer, TuyaErrors** (P1-P2); TuyaMatter/TuyaMesh/TuyaMember
  (P3); Widget = NGOÀI phạm vi (UI/extension, chỉ thêm getSwitchDps). Ưu tiên P1: Auth profile, Device mgmt+OTA,
  control nâng cao, error shape. Triển khai theo 3 đợt — xem mục 3 của overview. Lưu ý chung: nhiều mảng có 2 thế hệ
  API (legacy vs unified/Biz) phải chốt 1 bộ khi code; iOS không công bố bảng mã số; dpId/schema ice-bath cần thiết bị thật.

## Bản đồ file/module
| File / Module | Vai trò |
|---|---|
| `packages/tuya-react-native/` | ✅ thư viện wrap Tuya SDK (scaffolded B1) |
| `packages/tuya-react-native/src/specs/NativeTuya{Core,Auth,Home,Pairing,Device}.ts` | ✅ 5 Codegen spec (tách theo tính năng); object type inline |
| `packages/tuya-react-native/src/index.tsx` | ✅ facade phẳng `Tuya` + export sub-module + `onDeviceStatus/onPairingProgress/onBleScan` |
| `packages/tuya-react-native/android/.../{core,auth,home,pairing,device}/Tuya*Module.kt` | ✅ 5 module Kotlin (đủ API; BLE pairing done) |
| `packages/tuya-react-native/android/.../TuyaReactNativePackage.kt` | ✅ đăng ký cả 5 module |
| `packages/tuya-react-native/ios/{Core,Auth,Home,Pairing,Device}/Tuya*.{h,mm}` | ✅ 5 module ObjC++ (Core init+setupConfig, Auth isLoggedIn wired; còn lại TODO-reject) |
| `packages/tuya-react-native/example/src/App.tsx` | ✅ demo nút Init SDK (B2) |
| `packages/tuya-react-native/example/` | example vanilla RN CLI — test 2 nền tảng |
| `replit_generate/` | UI prototype (Expo) — tham chiếu thiết kế (cho mobile, không cho lib) |
| `docs/research/` | (sẽ có) note Tuya SDK — neo các bước B2+ |

## Phát hiện & cạm bẫy (Findings / Gotchas)
> Chi tiết + trích dẫn: [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md).
- **DC không phải tham số init.** Region = DC của AppKey (chọn lúc tạo App SDK) + `countryCode`
  lúc login. DC **cô lập** → account đăng ký ở DC này không dùng được ở DC khác; sai DC = login
  fail / không thấy thiết bị (KHÔNG có error code riêng — cạm bẫy lớn nhất).
- **EU = "Western Europe" DC** (ra mắt 2025-11-25). App tạo **trước** ngày này có thể ở
  **Central Europe** → phải hỏi client AppKey thuộc DC nào.
- account link SDK phải là **Owner** = `HomeBean.role == 2`.
- AppKey/AppSecret + file bảo mật gắn applicationId (Android, kèm **SHA-256**) / bundleId (iOS)
  — đăng ký sai ⇒ init/login fail.
- **Pairing token sống 10 phút + chết sau 1 device pair** → lấy lại mỗi lần (`-55` = hết hạn).
- **`publishDps.onSuccess` chỉ là "đã gửi"** — điều khiển coi như xong khi `onDpUpdate` về.
  value-type DP là **số** (`{"104":20}`), sai kiểu → `-1400`.
- **dpId thực tế của ice-bath chưa biết** → cần đọc DP schema từ thiết bị thật + productId.
- **iOS signature** (ThingSmartUser/Activator/BLEWifiActivator) mới confirm tên class, chưa
  verify verbatim → mở trang iOS khi code (URL trong research note).
- `replit_generate/package.json`: expo ~54, react 19.1, RN 0.81.5 → app mobile sẽ
  map sang RN CLI tương thích (việc của `m1-mobile-scaffold`), không ảnh hưởng lib.
- **(B1) Có yarn project ở `~` (home dir)** → yarn berry báo lỗi "not part of project". Fix:
  thêm **`yarn.lock` rỗng** trong `packages/tuya-react-native/` để tách project.
- **(B1) Máy dev hiện tại KHÔNG có Android SDK + JDK 11** (`assembleDebug` chưa chạy được;
  RN 0.85/AGP cần **JDK 17**). Build native sẽ test trên máy có SDK/JDK17 hoặc CI.
- **(B2) NativeEventEmitter (strict-api)** type listener là `(...args: Object[])` → phải cast
  `event as unknown as <T>` trong helper `on*`.
- **(B2) `getEnforcing` trong spec** → import `index` lúc chưa có native sẽ throw; example chỉ
  gọi trong handler. Chưa launch example (native hoãn tới B3–B5).
- **(B3–B9) Viết code native "làm hết" nhưng KHÔNG build-verify** (máy thiếu Android SDK/JDK17/Xcode
  + file bảo mật). Rủi ro: import `com.thingclips.*` / getter bean Android có thể lệch theo SDK 7.5.6.
- **(B5) Nạp AppKey/Secret:** Android từ AndroidManifest meta-data (`ThingHomeSdk.init(app)` tự đọc);
  iOS từ **Info.plist** (`ThingSmartAppKey`/`ThingSmartAppSecret`) → `startWithAppKey:secretKey:`.
- **(B9) Android `startBlePairing` TODO** (chữ ký BleActivatorBean chưa chắc); BLE-scan/DP/events đã viết.
- **(iOS) auth/home/pairing/DP để TODO-reject** (skeleton compile, selector đúng codegen) — không đoán
  bừa selector Tuya ObjC; implement trên Xcode với header thật. init + isLoggedIn đã wire.
- **File bảo mật là binary** (`security-algorithm.aar` / `ios_core_sdk.tar.gz`) → KHÔNG để env; drop tay
  theo [README.md](../../packages/tuya-react-native/README.md). `getSdkVersion` trả hằng (Tuya không expose API version ổn định).
  **(2026-06-29) Doc đã GỘP hết vào `README.md` (tiếng Anh, single source) — `SETUP.md` đã xoá.**
- **(2026-06-29) File SDK đã có ở `docs/sdk/`** (client cấp): `Android_SDK/security-algorithm.tar.gz` → giải nén ra
  `security-algorithm-1.0.0-beta.aar` (đã đặt vào `example/android/app/libs/`); `iOS_SDK.zip` → `ios_core_sdk.tar.gz`
  **thực ra là ZIP** chứa `ThingSmartCryption.xcframework` + `ThingSmartCryption.podspec` (đã giải nén → `example/ios/`).
  Lưu ý: file SDK là **v7.5.0** (Android lib pin Maven 7.5.6 — aar bảo mật độc lập version). `keys.txt`: Android & iOS
  AppKey/Secret RIÊNG + Cloud client id/secret + **DC = Central Europe**.
- **(2026-06-29 audit) iOS còn 17 method TODO-reject** (auth/home/pairing/BLE/DP/getCurrentUser/logout/getDps) + module
  **chưa kế thừa RCTEventEmitter** (event onDeviceStatus/onPairingProgress/onBleScan KHÔNG bắn trên iOS) + `initSdk`
  thiếu `[ThingSmartBusinessExtensionConfig setupConfig]`. Selector iOS đúng đã nằm trong kết quả audit (ThingSmartUser/
  ThingSmartHomeManager/ThingSmartActivator/ThingSmartBLEManager/ThingSmartDevice) — implement trên Mac.
- **(2026-06-29 audit) `:app` resolve thingsmart bằng repos của CHÍNH `:app`** (không phải của lib) → đã thêm allprojects
  Maven Tuya. Nếu build đầu vẫn báo "Could not find thingsmart" thì kiểm tra lại block này / mode repositories.
- 🔴 **(2026-06-29) SECRET LEAK:** `docs/sdk/keys.txt` (Android+iOS **AppSecret** + **Cloud client secret**) đã commit
  ("fix" `259b37a`) + **push lên `origin/main`** GitHub (`upwork-huyvu/walrus-cb`); root `.gitignore` bị comment dòng
  bảo vệ `docs/sdk`. User chọn **"để yên tính sau"**. Khuyến nghị khi xử: rotate keys trên Tuya console + bật lại
  `.gitignore` + `git rm --cached docs/sdk` + purge history + force-push. (AppKey public OK; AppSecret/Cloud secret thì KHÔNG.)

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: ✅ [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md) (2026-06-28)
- Báo cáo audit liên quan: _chưa có_
- Feature tiền nhiệm (superseded): [../m1-scaffold-and-tuya-init/](../m1-scaffold-and-tuya-init/)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
_(chưa hoàn thành)_
