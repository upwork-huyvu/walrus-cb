# Progress: Thư viện npm wrap Tuya Smart Life App SDK (TurboModule)

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-tuya-sdk-library`
- **Phase hiện tại:** `DEV` (B1–B9 đã viết code; **native CHƯA build-verify** + iOS/BLE còn TODO)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ Đã viết **toàn bộ code A (B3–B9)** theo chế độ "làm hết" (secret để env/native config, placeholder).
⚠️ **KHÔNG build-verify được trên máy này** (thiếu Android SDK/JDK17/Xcode + file bảo mật). Cần làm trên máy thật:
1. Theo **[SETUP.md](../../packages/tuya-react-native/SETUP.md)**: drop `security-algorithm.aar` (Android) + `ios_core_sdk.tar.gz` (iOS), điền AppKey/Secret (gradle.properties / Info.plist), thêm repo Maven Tuya + pod `ThingSmartCryption`.
2. Build example → sửa import/getter Android nếu lệch; **implement nốt iOS** (auth/home/pairing/DP) + **Android `startBlePairing`** (đang TODO).
3. Test thiết bị thật cho pairing/DP.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 — Scaffold thư viện · **done**
- [x] B2 — TurboModule spec + types · **done**
- [x] B3 — Android deps + cấu hình · **done** (gradle thingsmart 7.5.6 + repos + consumer proguard + manifest perms)
- [x] B4 — iOS pods + cấu hình · **done** (podspec ThingSmartHomeKit/BizExt; ThingSmartCryption + Info.plist ở app — SETUP.md)
- [x] B5 — Impl initSdk() · **done** (Android `ThingHomeSdk.init`; iOS `startWithAppKey` đọc Info.plist) — *chưa build-verify*
- [x] B6 — Auth email + thirdLogin · **done Android**; ⚠️ **iOS TODO-reject** (chỉ isLoggedIn wire)
- [x] B7 — Home management · **done Android**; ⚠️ **iOS TODO-reject**
- [x] B8 — Pairing Wi-Fi (EZ/AP) + token · **done Android**; ⚠️ **iOS TODO-reject**; cần thiết bị thật
- [~] B9 — BLE + DP + status emitter · **DP + events + BLE-scan done Android**; ⚠️ **Android `startBlePairing` TODO** + **iOS TODO-reject**
- [~] B10 — Secret sweep + docs · **SETUP.md + .gitignore + gradle.properties.example done**; README API chi tiết để sau

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 — Scaffold TurboModule+Codegen TS, tsc pass, bob build OK
- [~] AC2 — Native deps tích hợp (config xong 2 nền tảng); **example build CHƯA verify** (thiếu toolchain + file bảo mật)
- [~] AC3 — Spec đủ 7 nhóm API + native impl: **Android gần đủ** (trừ BLE pairing), **iOS init + skeleton**; compile chưa verify
- [ ] AC4 — initSdk() success + sendVerifyCode(EU) onSuccess — chờ build + creds
- [ ] AC5 — Smoke không crash — chờ build
- [x] AC6 — Setup doc (SETUP.md) + sample config (gradle.properties.example); .gitignore phủ secret

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
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
Còn lại để chạy thật trên thiết bị — **chỉ user + máy build làm được:**
1. **applicationId/bundleId TRÙNG package đăng ký Console** (example Android = `coolbath.tuyareactnative.example`) + **add keystore SHA-256** lên Console (sai → "illegal client").
2. **Toolchain:** JDK 17 + Android SDK (Android) · macOS + Xcode + CocoaPods (iOS).
3. **Thiết bị thật** cho pairing/BLE/DP (B8–B9). Bỏ file `t_s.bmp` nếu có.

## Việc còn lại sau khi build (known TODO trong code)
- **iOS:** implement auth/home/pairing/BLE/DP (hiện TODO-reject; init+isLoggedIn đã wire).
- **Android:** `startBlePairing` (BleActivatorBean + newBleActivator) — đang TODO.
- Rà lại import `com.thingclips.*` + getter bean Android khi build lần đầu (có thể lệch theo SDK).
- example app/`apps/mobile`: thêm repo Maven Tuya + manifestPlaceholders + pod ThingSmartCryption (SETUP.md).
