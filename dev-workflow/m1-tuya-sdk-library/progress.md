# Progress: Thư viện npm wrap Tuya Smart Life App SDK (TurboModule)

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-tuya-sdk-library`
- **Phase hiện tại:** `DEV` (B1–B9 đã viết code; **native CHƯA build-verify** + iOS/BLE còn TODO)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **(2026-06-29) Audit đa-agent + wire build-readiness Android XONG** (đối chiếu docs Tuya: API native Android
gần như đúng hết - không có landmine sai package/method). Đã làm trên repo này:
- Giải nén & đặt **`security-algorithm-1.0.0-beta.aar`** → `example/android/app/libs/` (từ `docs/sdk`).
- Giải nén **iOS xcframework** → `example/ios/{Build,ThingSmartCryption.podspec}` (stage cho Mac).
- Tạo **`example/android/gradle.properties`** (RN props + Tuya AppKey/Secret, gitignored).
- Thêm **repo Maven Tuya** vào `example/android/build.gradle` (`allprojects` - fix transitive resolve thingsmart).
- Implement **Android `startBlePairing`** (BleActivatorBean + newBleActivator, research §5) + cache ScanDeviceBean.
- Fix **iOS `RCT_EXPORT_MODULE()`** trong `.mm` (thiếu → getEnforcing throw lúc import trên iOS).

⛔ **Còn lại = CHỈ máy build + console (không code được trên máy này):**
1. **Toolchain Android (Windows):** cài **JDK 17** (đang JDK 8) + **Android SDK** (chưa có) - platform-36,
   build-tools 36.0.0, ndk 27.1.12297006. Rồi `corepack enable` → `yarn install` → `yarn prepare` →
   `example/android/gradlew.bat assembleDebug`. (Playbook chi tiết: xem run log + chat 2026-06-29.)
2. **Tuya console:** applicationId `coolbath.tuyareactnative.example` phải TRÙNG package đăng ký + **add SHA-256**
   của `example/android/app/debug.keystore` + **xác minh DC = Central Europe** khớp Cloud Project.
3. **iOS (cần Mac):** còn **17 method TODO-reject** (auth/home/pairing/BLE/DP) + module chưa là RCTEventEmitter
   (event không bắn) + `initSdk` thiếu `ThingSmartBusinessExtensionConfig setupConfig`.
4. **Thiết bị thật** cho pairing/BLE/DP.

🔴 **Bảo mật (user defer "tính sau" 2026-06-29):** `docs/sdk/keys.txt` (AppSecret + Cloud secret) **đã push lên
`origin/main`** GitHub → keys coi như lộ; nên rotate + dọn git history. Xem context.md.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Scaffold thư viện · **done**
- [x] B2 - TurboModule spec + types · **done**
- [x] B3 - Android deps + cấu hình · **done** (gradle thingsmart 7.5.6 + repos + consumer proguard + manifest perms)
- [x] B4 - iOS pods + cấu hình · **done** (podspec ThingSmartHomeKit/BizExt; ThingSmartCryption + Info.plist ở app - SETUP.md)
- [x] B5 - Impl initSdk() · **done** (Android `ThingHomeSdk.init`; iOS `startWithAppKey` đọc Info.plist) - *chưa build-verify*
- [x] B6 - Auth email + thirdLogin · **done Android**; ⚠️ **iOS TODO-reject** (chỉ isLoggedIn wire)
- [x] B7 - Home management · **done Android**; ⚠️ **iOS TODO-reject**
- [x] B8 - Pairing Wi-Fi (EZ/AP) + token · **done Android**; ⚠️ **iOS TODO-reject**; cần thiết bị thật
- [x] B9 - BLE + DP + status emitter · **done Android** (DP + events + BLE scan **+ pairing**); ⚠️ **iOS TODO-reject**
- [~] B10 - Secret sweep + docs · **SETUP.md + .gitignore + gradle.properties.example done**; README API chi tiết để sau

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 - Scaffold TurboModule+Codegen TS, tsc pass, bob build OK
- [~] AC2 - Native deps tích hợp (config xong 2 nền tảng); **example build CHƯA verify** (thiếu toolchain + file bảo mật)
- [~] AC3 - Spec đủ 7 nhóm API + native impl: **Android gần đủ** (trừ BLE pairing), **iOS init + skeleton**; compile chưa verify
- [ ] AC4 - initSdk() success + sendVerifyCode(EU) onSuccess - chờ build + creds
- [ ] AC5 - Smoke không crash - chờ build
- [x] AC6 - Setup doc (SETUP.md) + sample config (gradle.properties.example); .gitignore phủ secret

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-06-29 | RESEARCH (full surface) | ✅ | Workflow 11 agent research toàn bộ Home SDK còn lại (Android+iOS, cited) → 11 note `docs/research/tuya-home-sdk-*.md` + overview `tuya-home-sdk-full-surface.md` (bản đồ + đề xuất API + ưu tiên 3 đợt). Đề xuất module mới: TuyaOta/TuyaScene/TuyaMessage/TuyaTimer/TuyaErrors (P1-P2), TuyaMatter/TuyaMesh/TuyaMember (P3); Widget ngoài phạm vi. **Mới là RESEARCH+đề xuất - CHƯA implement native.** |
| 2026-06-29 | DOCS | ✅ | Gộp toàn bộ hướng dẫn (config AppKey/Secret/id + Android/iOS + usage + kiến trúc) vào **README.md tiếng Anh** (single source), xoá `SETUP.md`; sửa ref trong .gitignore/build.gradle/podspec/TuyaCore.mm → README. |
| 2026-06-29 | RENAME | ✅ code-only | Đổi tên lib → **`@jimmy-vu/react-native-turbo-tuya`** (pod/codegen `TurboTuya`/`TurboTuyaSpec`, java `com.jimmyvu.turbotuya`, class `TurboTuyaPackage`, condition `react-native-turbo-tuya-source`). Sửa package.json/tsconfig/podspec(đổi tên file)/metro/vite/imports/docs; di chuyển cây Kotlin. Module JS giữ nguyên. App ví dụ giữ identity cũ (console-tied). |
| 2026-06-29 | REFACTOR | ✅ code-only | Tách module gộp → **5 TurboModule theo folder** (Core/Auth/Home/Pairing/Device) theo yêu cầu user. TS: `src/specs/*` (5 spec) + `index.tsx` facade phẳng `Tuya` + export sub-module. Android: 5 package `…{core,auth,home,pairing,device}` + 1 Package đăng ký. iOS: `ios/{Core,Auth,Home,Pairing,Device}` mỗi class `RCT_EXPORT_MODULE()`. Xoá monolith cũ. Codegen vẫn 1 lib. **Chưa typecheck** (đang yarn install). |
| 2026-06-29 | AUDIT + WIRE | ✅ | Workflow 5-agent audit native+build (đối chiếu developer.tuya.com): **Android API đúng**, parity JS↔native sạch (26/26), toolchain versions tương thích (Gradle 9.3.1/AGP 8.12/JDK17/SDK36/NDK27.1). Wire build-ready: aar→libs, iOS xcframework→example/ios, tạo gradle.properties, +Maven Tuya (allprojects), impl `startBlePairing`+cache scan, fix iOS `RCT_EXPORT_MODULE()`. Còn: cài JDK17+Android SDK + console (applicationId/SHA-256/DC) + iOS 17 method. |
| 2026-06-29 | DEV B3–B9 | ⚠️ code-only | Viết native: Android `TuyaReactNativeModule.kt` (init/auth/home/wifi-pairing/DP/events/ble-scan; BLE-pairing TODO) + gradle/manifest/proguard; iOS `.mm` (init+isLoggedIn real; còn lại TODO-reject) + podspec; SETUP.md + gradle.properties.example + .gitignore secret. **Lib `tsc` vẫn pass.** Native CHƯA build-verify (thiếu Android SDK/JDK17/Xcode + file bảo mật). |
| 2026-06-28 | DEV+TEST B2 | ✅ | TurboModule spec đủ 7 nhóm API (init/auth/home/pairing WiFi+BLE/DP/events) + `src/index.tsx` (Tuya + on*). Bỏ `multiply`. `yarn typecheck` exit 0, jest pass, bob build pass. Codegen native gen hoãn tới B3 (chưa có Android SDK/JDK17). |
| 2026-06-28 | DEV+TEST B1 | ✅ | `create-react-native-library` → `packages/tuya-react-native` (turbo-module, kotlin-objc Obj-C++, RN 0.85.0, yarn4 berry, example vanilla). Gỡ nested `.git`; thêm `yarn.lock` rỗng (do có yarn project ở ~). `yarn install` OK, typecheck/jest/bob pass. Android `assembleDebug` HOÃN (máy này không có Android SDK + JDK 11<17). |
| 2026-06-29 | WIRE SDK | ✅ | Nhận SDK+keys (docs/sdk). Đặt `security-algorithm-1.0.0-beta.aar`→example android libs; giải nén `ios_core_sdk`→example/ios (Build+podspec); wire keys (gradle.properties + Info.plist) + manifest meta-data + app/build.gradle fileTree + Podfile (ThingSmartCryption). Build native vẫn cần console package/SHA-256 + toolchain. |
| 2026-06-28 | RESEARCH+FIX-PLAN | ✅ | `/tuya-research` xong → `docs/research/tuya-m1-sdk-foundation.md` (16 trang doc, cited). Sửa plan: bỏ tham số DC ở `initSdk()`, pin thingsmart 7.5.6 / minSdk 24, đổi AC4, neo B3–B9 vào API thật. |
| 2026-06-28 | PLAN | ✅ | **Gate ① DUYỆT** (user chọn "research trước, rồi B1"). Bước kế: `/tuya-research`. |
| 2026-06-28 | PLAN | ✅ | Tạo plan/context/progress; đăng ký INDEX (Part A của M1 mở rộng). Chờ Gate ① + `/tuya-research`. |

## Vấn đề đang chặn (Blockers)
✅ **Đã có & wire sẵn (2026-06-29 từ docs/sdk):** security `.aar` (Android) + `ios_core_sdk` (iOS)
đặt vào example; AppKey/Secret (Android→gradle.properties, iOS→Info.plist); **DC = Central Europe**.
Còn lại để chạy thật trên thiết bị - **chỉ user + máy build làm được:**
1. **applicationId/bundleId TRÙNG package đăng ký Console** (example Android = `coolbath.tuyareactnative.example`) + **add keystore SHA-256** lên Console (sai → "illegal client").
2. **Toolchain:** JDK 17 + Android SDK (Android) · macOS + Xcode + CocoaPods (iOS).
3. **Thiết bị thật** cho pairing/BLE/DP (B8–B9). Bỏ file `t_s.bmp` nếu có.

## Việc còn lại sau khi build (known TODO trong code)
- **iOS:** implement auth/home/pairing/BLE/DP (hiện TODO-reject; init+isLoggedIn đã wire).
- **Android:** `startBlePairing` (BleActivatorBean + newBleActivator) - đang TODO.
- Rà lại import `com.thingclips.*` + getter bean Android khi build lần đầu (có thể lệch theo SDK).
- example app/`apps/mobile`: thêm repo Maven Tuya + manifestPlaceholders + pod ThingSmartCryption (SETUP.md).
