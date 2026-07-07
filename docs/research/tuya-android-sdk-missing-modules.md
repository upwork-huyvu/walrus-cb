# Research: Build native Tuya Android FAIL - KHÔNG phải thiếu module, mà SAI import + API drift

> Ngày: 2026-06-30 · Bối cảnh: lần đầu `gradlew assembleDebug` thật cho `apps/mobile`
> (trước đó máy dev tưởng không có JDK17+Android SDK nên chưa từng build-verify code native).

## ⚠️ ĐÍNH CHÍNH (kết luận cũ của chính note này là SAI)

Bản đầu của note (cùng ngày) kết luận: 7/13 module fail vì Tuya SDK 7.5.6 **thiếu các
sub-module** Activator/Push/Timer/OTA/Member → cần client vào Tuya IoT Developer Platform
tab **Get SDK** lấy thêm artifact. **Kết luận đó SAI.** Lần quét artifact đầu (dùng `unzip`
per-aar, bị timeout/sót) đã KHÔNG quét hết → tưởng class không tồn tại.

Quét lại **đầy đủ 55 artifact** `com.thingclips.smart:*` resolve trong
`debugRuntimeClasspath` (Python `zipfile`, mở cả `classes.jar` lồng trong aar - 9.179 class):
**TẤT CẢ class "thiếu" đều CÓ MẶT** trong `thingsmart:7.5.6`. Vấn đề thật:

1. **8 import sai package** (class có thật nhưng code import nhầm đường dẫn).
2. **API drift**: vài method/enum/constructor/getter đổi tên hoặc đổi chữ ký giữa bản
   SDK mà code được viết theo (research note cũ / iOS) và bản Android 7.5.6 thực tế.

→ Sửa hoàn toàn trong code, **KHÔNG cần thêm dependency, KHÔNG cần console Tuya.**
Sau khi sửa: `:jimmy-vu_react-native-turbo-tuya:compileDebugKotlin` **BUILD SUCCESSFUL**,
`:app:assembleDebug` **BUILD SUCCESSFUL** (APK `app-debug.apk` 156 MB).

## Phương pháp xác minh (tái lập được)

1. Liệt kê artifact: `find ~/.gradle/caches/modules-2 -path '*com.thingclips*' \( -name '*.aar' -o -name '*.jar' \)`.
2. Giải nén mọi `classes.jar` → 1 thư mục jar → classpath cho `javap`.
3. Với mỗi symbol nghi ngờ: `javap -classpath "$CP" -p <FQCN>` để lấy **đúng** package,
   enum constant, chữ ký method, getter. (Đây là nguồn sự thật, không đoán theo doc.)

## Fix 1 - 8 import sai package

| File | Class | Import SAI (cũ) | Import ĐÚNG (7.5.6) |
|---|---|---|---|
| Pairing | `ActivatorBuilder` | `com.thingclips.smart.sdk.bean` | `com.thingclips.smart.home.sdk.builder` |
| Timer | `ThingTimerBuilder` | `...home.sdk.builder` | `com.thingclips.smart.android.device.builder` |
| Timer | `TimerDeviceTypeEnum` | `...sdk.enums` | `com.thingclips.smart.android.device.enums` |
| Timer | `TimerUpdateEnum` | `...sdk.enums` | `com.thingclips.smart.home.sdk.constant` |
| Ota | `UpgradeInfoBean` | `...sdk.bean` | `com.thingclips.smart.android.device.bean` |
| Auth | `TempUnitEnum` | `...android.user.api` | `com.thingclips.smart.sdk.enums` |
| Auth | `INeedLoginListener` | `...home.sdk.api` | `com.thingclips.smart.sdk.api` |
| Home | `GroupBean` | `...sdk.bean.group.bean` | `com.thingclips.smart.sdk.bean` |

## Fix 2 - API drift (method/enum/chữ ký đổi)

| File | Cũ (không tồn tại ở 7.5.6) | Đúng (7.5.6) |
|---|---|---|
| Pairing | `ActivatorModelEnum.TY_AP/TY_EZ` | `THING_AP` / `THING_EZ` |
| Pairing | `IMultiModeActivatorListener.onActivatorStatePauseCallback(...)` | KHÔNG có → bỏ override (interface chỉ còn `onSuccess`/`onFailure`) |
| Timer | `ThingTimerBuilder().setTaskName()...` | `ThingTimerBuilder.Builder().taskName()...build()` (builder lồng) |
| Ota | `IDevOTAListener{onStatusChanged/onProgress/onSuccess/onFailure/onTimeout}` | gộp 1 callback `firmwareUpgradeStatus(ThingDevUpgradeStatusBean)` → tự map `DevUpgradeStatusEnum` → event cũ |
| Ota | `IGetOtaInfoCallback.onError(...)` | `onFailure(String, String)` |
| Ota | `UpgradeInfoBean.fileSize` (tưởng String) | `getFileSize(): long` → putDouble |
| Ota | `UpgradeInfoBean.isCanUpgrade` | `getCanUpgrade(): Boolean?` → `canUpgrade ?: false` |
| Home | `getHomeManagerInstance().getHomeWeatherSketch(...)` | nằm ở `newHomeInstance(homeId).getHomeWeatherSketch(lon, lat, cb)` |
| Home | `updateHome(name,lon,lat,geo,rooms,cb)` | overload đúng có thêm `overWriteRoom: Boolean` |
| Member | `MemberBean.name / .dealStatus / .mobile / .invitationCode` | `getNickName()` / `getMemberStatus()`; **không có** mobile/invitationCode (thay bằng `uid`) |
| Member | `IThingHomeMember.joinHomeByInviteCode(code, cb)` | KHÔNG có 1-bước → luồng 2 bước `getInvitationFamilyInfo` → `processInvitation` (stub: bean chưa verbatim) |
| Message | `IThingPush.getDeviceDNDSetting/setDeviceDNDSetting/addDNDWithStartTime/addOnceDNDWithStartTime/modifyDNDWithTimerId/removeDNDWithTimerId` | **KHÔNG tồn tại trên Android `IThingPush` 7.5.6** (chỉ có ở iOS/bản khác) → stub `not_implemented` toàn bộ nhóm DND |

## Trạng thái module sau fix

- **Compile sạch + functional**: Core, Device, Scene, Matter, Mesh (vốn đã sạch) +
  Auth, Home, Pairing (EZ/AP/BLE/combo), Timer, OTA, Member (query/update/remove/invitation).
- **Compile sạch nhưng có method stub `not_implemented`** (API Android 7.5.6 không có/đổi
  cơ chế, cần verify thêm khi chạy thiết bị thật):
  - Message: toàn bộ nhóm **DND** + một số list/push-by-type cần enum/bean chưa verbatim.
  - Member: `joinHomeByCode`, `addMember` (MemberWrapperBean), `createInvitation`/`getInvitationList` (bean chưa rõ), `transferHomeOwner`.
  - Pairing: nhóm nâng cao unified `ActivatorService` (subdevice/gateway/QR/wired).
  - Timer: `getTimerList` (bean `TimerTask` chưa rõ field).
  - Home: `getHomeWeatherDetail` (`DashBoardBean` chưa rõ field).

## Việc còn lại (không chặn build)

- Chạy thiết bị thật để verify runtime + hoàn thiện các stub trên (cần token/devId thật).
- Tuya SDK init runtime cần **package name + keystore SHA-256 đăng ký trong Cloud Project**
  cho AppKey (`docs/sdk/keys.txt`) - đây mới là bước cần console, nhưng KHÔNG chặn build APK.

## Liên kết
- Research liên quan: [tuya-home-sdk-device-pairing.md](tuya-home-sdk-device-pairing.md),
  [tuya-home-sdk-message-management.md](tuya-home-sdk-message-management.md),
  [tuya-m1-sdk-foundation.md](tuya-m1-sdk-foundation.md)
- Feature: `m1-tuya-sdk-expansion` (xem `dev-workflow/m1-tuya-sdk-expansion/`)
