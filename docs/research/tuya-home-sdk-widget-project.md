# Tuya Research: Configure Widget Project (home-screen widget) - Smart Life App SDK

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** iOS ThingSmartHomeKit ~7.5 · Android `thingsmart` 7.5.x
- **Nguồn chính:**
  - Configure Widget Project (bản mới, `ThingSmartSDK`) - https://developer.tuya.com/en/docs/app-development/widget?id=Ka5vcs3e885yv
  - Configure Widget Project (bản cũ, `TuyaSmartSDK`) - https://developer.tuya.com/en/docs/app-development/widget?id=Kceuglgiah0qx
  - Widget Access (dịch vụ value-added trên IoT Platform) - https://developer.tuya.com/en/docs/iot/widget?id=K9j6yqpfsf22c
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. Code iOS (`appGroupId`, `startWithAppKey`, `publishDps`/`switchDps`) lấy được verbatim. **Không có trang Android riêng** cho widget project trong App SDK docs - Android widget đi qua **dịch vụ Widget Access** do Tuya tích hợp giúp (xem "Cạm bẫy"). Mục "Câu hỏi mở" liệt kê chỗ chưa xác minh tận chữ ký.

---

## TL;DR (cho người quyết định scope)
1. **"Configure Widget Project" KHÔNG phải device panel/UI BizBundle.** Đây là **home-screen widget / quick-control widget** của hệ điều hành: **iOS WidgetKit extension** (và trên Android là **App Widget** màn hình chính). Mục tiêu: bật/tắt nhanh thiết bị **không cần mở app**.
2. **Bản chất iOS = một WidgetExtension target riêng** trong Xcode, chia sẻ dữ liệu với app chính qua **App Group**. SDK được init lại trong extension với **`appGroupId`** trùng app chính để đọc session/home đã đăng nhập.
3. **Đây là tính năng UI + cấu hình native (App Group, mobileprovision, WidgetKit), KHÔNG phải logic SDK thuần.** Một TurboModule thuần-logic **không** chứa và **không nên** chứa widget. ⇒ **Ngoài phạm vi lib** của chúng ta.
4. **Android widget cần "Widget Access" - dịch vụ trả phí**: sau khi đăng ký, **Tuya tích hợp** khả năng widget vào app Android của bạn (không phải code SDK tự làm). iOS cũng cần đăng ký + nộp `.mobileprovision` cho widget. Free developer account **không** debug được widget (App Group cần tài khoản trả phí).
5. **Phần "logic" duy nhất widget dùng lại** là API điều khiển DP đã có trong lib: `publishDps` + đọc `deviceModel.switchDps` để biết DP bật/tắt nhanh. Lib **đã** expose `publishDps`; chỉ cần bổ sung getter `switchDps`/`switchDp` nếu sau này muốn (xem "Đề xuất").

---

## Phạm vi
Câu hỏi cần trả lời: **Widget/Panel project là gì** (UI BizBundle? device panel? RN/web panel? home-screen widget?), **cách cấu hình**, và **có nên đưa vào TurboModule thuần-logic không**.

Kết luận phạm vi: tài liệu **"Configure Widget Project"** nói về **home-screen widget của OS** (iOS WidgetKit / Android App Widget). Cần phân biệt rõ với 2 khái niệm "widget/panel" dễ nhầm khác trên docs Tuya (xem bảng dưới). Cả ba đều là **UI**, nên **không thuộc** một wrapper logic.

| Khái niệm | Là gì | UI? | Đường dẫn doc |
|---|---|---|---|
| **Configure Widget Project** (đề tài này) | **Home-screen / notification-center widget** của OS (iOS WidgetKit, Android App Widget) để quick-control | Có (OS widget) | `app-development/widget?id=Ka5vcs3e885yv` |
| **Device Control / Details UI BizBundle** | **Device panel** dựng sẵn (RN Panel v0.59.10 hoặc MiniApp Panel), Tuya host UI, mở bằng 1 API | Có (panel native) | `app-development/devicecontrol`, `.../devicedetails` |
| **Widget** (miniapp) | Component/dialog **trong miniapp** (`ThingMiniAppClient.widgetClient`) | Có (miniapp UI) | `app-development/mini-app-sdk-widget?id=Kcwzmcikx1xee` |

⇒ **Cả ba đều ngoài phạm vi lib logic.** Note này tập trung vào loại 1; nhắc loại 2/3 để tránh nhầm khi đọc docs.

## Khái niệm & luồng
**Mục đích:** cho phép người dùng đặt một ô widget lên màn hình chính (Android) / notification center hoặc home screen (iOS) để **bật/tắt nhanh** thiết bị (ví dụ bật/tắt bồn tắm đá) mà không mở app.

**Luồng iOS (WidgetKit):**
1. Tạo **WidgetExtension target** (WidgetKit) trong Xcode - là target **riêng**, process riêng.
2. Bật **App Groups** ở **cả** WidgetExtension **và** App chính; `APP_GROUP_NAME` phải **trùng nhau** (để extension đọc được session/user info app đã ghi).
3. Trong WidgetExtension, **init lại SDK**: set `appGroupId` **trước** `startWithAppKey:secretKey:`.
4. App chính **set `homeId` hiện tại** vào nơi shared (qua App Group) để widget biết home nào.
5. Widget đọc danh sách thiết bị của home → check `deviceModel.switchDp(s)` (DP bật/tắt nhanh) → render nút → khi bấm gọi `publishDps`.
6. Refresh dữ liệu theo lifecycle (`viewWillAppear`) khi tài khoản/room đổi.

**Luồng Android (App Widget):** **không có code mẫu trong App SDK docs.** Khả năng widget Android được cấp qua **dịch vụ Widget Access** (trả phí): "After you subscribe to this service for your Android app, Tuya will integrate the widget capability with your Android app." Tức là Tuya làm phần tích hợp widget, không phải developer tự viết bằng Home SDK.

---

## API Android (verbatim)
**Không có** trang "Configure Widget Project" cho Android trong App SDK docs. Android home-screen widget = **Widget Access service** (Tuya tích hợp hộ). Phần điều khiển nếu tự render widget sẽ dùng lại API Home SDK đã biết (đã ghi ở note nền tảng `tuya-m1-sdk-foundation.md`):

```java
// Lấy device list theo home (đọc trong widget context):
ThingHomeSdk.newHomeInstance(homeId).getHomeDetail(callback); // -> HomeBean.getDeviceList()

// Bật/tắt nhanh: publishDps DP bật/tắt
IThingDevice mDevice = ThingHomeSdk.newDeviceInstance(devId);
mDevice.publishDps("{\"1\": true}", new IResultCallback() {
    @Override public void onSuccess() { }
    @Override public void onError(String code, String error) { }
});
```
> DP bật/tắt nhanh (switch DP) trên Android: đọc từ schema (`DeviceBean.getSchemaMap()` / product config). Docs Android **không** có thuộc tính `switchDps` tương đương iOS ở trang widget.

## API iOS (verbatim / đối chiếu)
**Init trong WidgetExtension (verbatim - bản mới `ThingSmartSDK`):**
```objc
[ThingSmartSDK sharedInstance].appGroupId = APP_GROUP_NAME;
[[ThingSmartSDK sharedInstance] startWithAppKey:SDK_APPKEY secretKey:SDK_APPSECRET];
```

**Init (verbatim - bản cũ `TuyaSmartSDK`, cùng ý):**
```objc
[TuyaSmartSDK sharedInstance].appGroupId = APP_GROUP_NAME;
[[TuyaSmartSDK sharedInstance] startWithAppKey:SDK_APPKEY secretKey:SDK_APPSECRET];
```

**Podfile (verbatim - cho WidgetExtension target dùng SDK):**
```ruby
post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['APPLICATION_EXTENSION_API_ONLY'] = 'NO'
    end
  end
end
```

**Điều khiển thiết bị trong widget (verbatim - Swift):**
```swift
let smartDevice = ThingSmartDevice(deviceId: devId)
if let switchStatus {
    let status = !switchStatus
    var dps: [String: Any] = [:]
    smartDevice?.deviceModel.switchDps?.forEach({ dpId in
        dps[dpId.stringValue] = status
    })
    smartDevice?.publishDps(dps, mode: ThingDevicePublishModeInternet) {
        continuation.resume()
    } failure: { error in
        continuation.resume()
    }
}
```

**Yêu cầu/cấu hình iOS (verbatim ý):**
- Bật **App Groups** ở cả WidgetExtension và App; `APP_GROUP_NAME` phải khớp.
- **Set `homeId`** ở project App chính (widget đọc qua App Group).
- Dùng `ThingSmartDeviceModel.switchDp(s)` để kiểm tra thiết bị có hỗ trợ **quick switch** không.
- Refresh dữ liệu khi account/room đổi qua `viewWillAppear`.
- Bản cũ docs đề cập **chỉ hỗ trợ Widget project dựa trên WidgetKit** từ **Xcode 16 (iOS 18 SDK)**; SDK Demo viết bằng WidgetKit. (Bản mới không nêu version cụ thể.)

> **Đối chiếu device panel (KHÁC widget, để tránh nhầm) - iOS BizBundle:**
> ```objc
> id<ThingPanelProtocol> impl = [[ThingSmartBizCore sharedInstance] serviceOfProtocol:@protocol(ThingPanelProtocol)];
> [impl gotoPanelViewControllerWithDevice:deviceModel group:nil initialProps:nil contextProps:nil completion:^(...) { }];
> ```
> Đây là **device panel BizBundle** (UI dựng sẵn), không phải home-screen widget. Android tương đương dùng `AbsPanelCallerService.goPanelWithCheckAndTip(activity, devId)` / `UrlRouter` + `extra_panel_dev_id`.

## Bean/Callback/Listener
- **iOS:**
  - `ThingSmartSDK` / `TuyaSmartSDK` - thuộc tính `appGroupId` (set trước init).
  - `ThingSmartDevice` - `init(deviceId:)`, `publishDps(_:mode:success:failure:)`, enum `ThingDevicePublishModeInternet`.
  - `ThingSmartDeviceModel` - `switchDps` (mảng dpId bật/tắt nhanh) / `switchDp`.
- **Android (dùng lại Home SDK):** `IThingDevice.publishDps(json, IResultCallback)`; `DeviceBean` (schema để tìm switch DP); `HomeBean.getDeviceList()`.
- **Không có listener riêng cho widget** - widget vẽ snapshot, refresh theo timeline/lifecycle; điều khiển vẫn qua `publishDps` (kênh Internet/MQTT).

## Mã lỗi liên quan
- **Không có error code riêng** cho widget. Lỗi điều khiển = lỗi `publishDps` thông thường (xem note nền tảng): `-1` SDK chưa init (widget extension phải init lại có `appGroupId`), `-60` MQTT chưa kết nối, `-1400` DP không hỗ trợ, `-10001` device offline.
- **Lỗi cấu hình hay gặp (không phải code SDK):** App Group ID lệch → widget không đọc được session → coi như chưa login; thiếu `.mobileprovision` cho widget; dùng free account (không được cấp App Group).

## Cạm bẫy
1. **Đừng nhầm 3 loại "widget/panel".** Đề tài này = **home-screen widget OS**; còn có **Device Panel BizBundle** (RN/MiniApp panel) và **miniapp widget**. Tất cả đều là **UI**.
2. **Là feature của App, không phải của lib logic.** Cần WidgetExtension target, App Group, mobileprovision riêng, WidgetKit code - toàn bộ nằm ở tầng app RN/native, **không** thuộc TurboModule wrapper.
3. **Widget Access là dịch vụ trả phí.** iOS: đăng ký → cấu hình Apple Developer → tải `.mobileprovision` cho widget → gửi Tuya. Android: đăng ký → **Tuya tích hợp giúp**. **Free account không debug được** (App Group cần tài khoản trả phí).
4. **Phải init SDK lại trong extension** với `appGroupId` đúng - extension là process riêng, không share runtime với app.
5. **`APPLICATION_EXTENSION_API_ONLY=NO`** cần set qua Podfile post_install, nếu không build extension với SDK sẽ fail.
6. **Android không có hướng dẫn DIY** trong App SDK docs → nếu client muốn widget Android, đây là **hạng mục thương mại với Tuya**, không phải task code thuần.
7. **Bồn tắm đá**: nếu sau này muốn widget bật/tắt nhanh, cần biết **switch DP** (DP power) của thiết bị thật - vẫn là câu hỏi mở dpId như note nền tảng.

## Đề xuất API TurboModule
**Khuyến nghị: KHÔNG đưa "Configure Widget Project" vào lib.** Lý do: (a) là **UI + cấu hình native target** (WidgetExtension/App Widget, App Group, mobileprovision), không phải logic SDK; (b) phụ thuộc **dịch vụ trả phí Widget Access**; (c) bề mặt JS không gọi được vào WidgetKit extension (extension chạy process riêng, không có JS runtime của RN). ⇒ Đây là việc của **tầng app native**, làm sau, nếu thực sự cần, như một feature riêng - **không** thuộc 5 module hiện có.

**Phần duy nhất nên reuse từ lib** (đã có/gần có), để app side dựng widget khi cần:
| Việc | Trạng thái trong lib | Đề xuất |
|---|---|---|
| Bật/tắt DP | `TuyaDevice.publishDps` - **đã có** | Giữ nguyên; widget native gọi trực tiếp SDK trong extension, không qua JS |
| Biết DP bật/tắt nhanh | **chưa có** | Thêm getter trả switch DP để app biết DP power |

**Nếu (và chỉ nếu) muốn hỗ trợ tối thiểu cho app side**, thêm vào module `TuyaDevice` hiện có (KHÔNG tạo module widget):

```ts
// Mở rộng TuyaDevice - chỉ là metadata, KHÔNG render widget
export interface TuyaDeviceSchemaDp {
  dpId: string;
  code: string;
  type: 'bool' | 'value' | 'enum' | 'string' | 'raw' | 'bitmap';
  mode: 'rw' | 'ro' | 'wr';
}

// Lấy DP "quick switch" (power) - map iOS deviceModel.switchDps / Android schema
getSwitchDps(devId: string): Promise<string[]>;

// (đã có) điều khiển - dùng chung cho cả widget native lẫn app
publishDps(devId: string, dpsJson: string): Promise<void>;
```

**Không đề xuất** tạo `TuyaWidget` module. Ghi rõ trong INDEX/docs: **Widget = out-of-scope của lib**, thuộc tầng app native + dịch vụ Widget Access của Tuya.

## Nguồn (URL đã đọc)
- Configure Widget Project (ThingSmartSDK) - https://developer.tuya.com/en/docs/app-development/widget?id=Ka5vcs3e885yv
- Configure Widget Project (TuyaSmartSDK + Podfile) - https://developer.tuya.com/en/docs/app-development/widget?id=Kceuglgiah0qx
- Widget Access (dịch vụ value-added) - https://developer.tuya.com/en/docs/iot/widget?id=K9j6yqpfsf22c
- Widget (miniapp widget - để phân biệt) - https://developer.tuya.com/en/docs/app-development/mini-app-sdk-widget?id=Kcwzmcikx1xee
- Device Control UI BizBundle (panel - để phân biệt) - https://developer.tuya.com/en/docs/app-development/devicecontrol?id=Ka8qhzk2htjby
- Device Details UI BizBundle (panel - để phân biệt) - https://developer.tuya.com/en/docs/app-development/devicedetails?id=Ka8tzzkq5fqbo
- Device Control UI BizBundle iOS (ThingPanelProtocol) - https://developer.tuya.com/en/docs/app-development/ios-bizbundle-sdk/devicecontrol?id=Ka8qf8lnahsf8
- Error Codes - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
