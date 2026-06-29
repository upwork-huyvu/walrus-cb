# Tuya Research: Integrate with Push Notifications (Home SDK / Smart Life App SDK)

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `com.thingclips.smart:thingsmart` **7.5.x** · iOS `ThingSmartHomeKit` **~7.5**
- **Nguồn chính:**
  - Integrate with Push Notifications (tổng quan, iOS deviceToken/APNs) — https://developer.tuya.com/en/docs/app-development/push?id=Ka5srtq240glp
  - Integrate with FCM Push (Android) — https://developer.tuya.com/en/docs/app-development/pushfcm?id=Ka6ki8lbkcqbv
  - Set Push Messages (Android) — https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kaj16d3iwgq4r
  - Configure Push Notifications (Android) — https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kceuhog1w1qfb
  - Set Push Messages (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-message-push?id=Kaj0skc91ywxr
  - Push Notifications Management (Business Extension Kit, mới) — https://developer.tuya.com/en/docs/app-development/extension-message-push-setting?id=Kdqso74u6l2yd
  - Message Management — https://developer.tuya.com/en/docs/app-development/messagecenter?id=Ka6ki8lc1u0qg
  - Configure Google FCM (console) — https://developer.tuya.com/en/docs/iot/fcm-push?id=K989rrxsofo5i
- **Lưu ý độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. Chữ ký **Android** (`getPushStatus`/`setPushStatus`/`getPushStatusByType`/`setPushStatusByType`, `PushType`, `registerDevice`) và **iOS** (`getPushStatusWithSuccess:failure:`, `setPushStatusWithStatus:...`, các method per-type) lấy được khá đầy đủ. Một số tên callback/bean (`PushStatusBean`, `IThingResultCallback`/`IThingDataCallback`) confirm được tên nhưng field chi tiết nên mở trang trực tiếp/API reference khi code. Tài liệu trộn 2 namespace cũ/mới (`ITuya*`/`TuyaSmart*` ↔ `IThing*`/`ThingSmart*`) — với 7.5.x **dùng `Thing*`**.

---

## Phạm vi
- **Đăng ký device token với Tuya:** Android đẩy **FCM token** lên Tuya cloud qua `getPushInstance().registerDevice(token, "fcm", cb)`; iOS gán **APNs deviceToken** vào `ThingSmartSDK.sharedInstance.deviceToken`.
- **Bật/tắt push:** công tắc tổng + theo loại: **alarm/alert** (cảnh báo thiết bị), **family/home** (gia đình), **notice/notification** (thông báo/bản tin), **marketing** (quảng cáo).
- **Lấy/đặt cấu hình push:** query trạng thái công tắc, đặt trạng thái; nâng cao: **Do-Not-Disturb (DND)** theo khung giờ/thiết bị; (Business Extension Kit) chọn **kênh giao** (system push / phone call / SMS) và **throttle** tần suất.
- **Liên hệ FCM:** dự án dùng **Firebase Cloud Messaging** cho Android — Tuya cloud chính là **sender** đẩy qua FCM bằng credential mình up lên console; app chỉ cần forward FCM token cho Tuya + render `RemoteMessage`.
- **Quan hệ với Message Management:** `IThingPush` (get/set trạng thái push) và `IThingMessage` (đọc/xoá/đếm message trong **Message Center**) là 2 mặt bổ trợ: push = realtime delivery, Message Center = lịch sử đã lưu (Alarm / Home / Bulletin).

---

## Khái niệm & luồng

**Phân tầng (giống nhau ở 2 nền tảng):**
1. **Transport token** (nền tảng OS): Android = **FCM registration token**; iOS = **APNs deviceToken**.
2. **Đăng ký token với Tuya cloud** để cloud biết gửi push đến thiết bị nào.
3. **Push switches** (server-side, gắn theo tài khoản): công tắc tổng + 4 loại. Khi **tắt công tắc tổng** → app **không nhận bất kỳ** alert/home/notice nào.
4. **Message Center** (đã lưu): đọc lại lịch sử qua `IThingMessage` / `ThingSmartMessage`.

**Luồng Android (FCM):**
```
init SDK → login → Firebase init → lấy FCM token (onNewToken)
→ ThingHomeSdk.getPushInstance().registerDevice(token, "fcm", cb)
→ bật công tắc: setPushStatus(true) + setPushStatusByType(...)
→ FirebaseMessagingService.onMessageReceived(RemoteMessage) hiển thị notification
→ logout: xoá FCM token (deleteToken) + (tuỳ) tắt registerDevice/đăng ký lại khi login user khác
```
> **Bắt buộc đăng ký notification channel** (Android 8+): `tuya_common`, `tuya_shortbell`, `tuya_longbell`, `tuya_doorbell`, `tuya_warnbell` — thiếu channel → notification có thể bị nuốt.

**Luồng iOS (APNs):**
```
init SDK → login → UNUserNotificationCenter.requestAuthorization([.alert,.badge,.sound])
→ registerForRemoteNotifications()
→ didRegisterForRemoteNotificationsWithDeviceToken: gán [ThingSmartSDK sharedInstance].deviceToken = deviceToken
→ setPushStatusWithStatus:YES ... + per-type
→ didReceiveRemoteNotification:fetchCompletionHandler: xử lý payload
```

**Liên hệ Message Management:** message hiển thị trong Message Center gồm 3 nhóm — **Alarm** (cảnh báo thiết bị + automation), **Home** (gia đình), **Bulletin** (feedback/official push). `IThingPush` get/modify **trạng thái** push; `IThingMessage` get list/delete/check-unread **nội dung**.

---

## API Android (verbatim)

### 1) Đăng ký device token (FCM)
```java
ThingHomeSdk.getPushInstance().registerDevice(String token, String pushProvider, new IResultCallback() {
    @Override public void onError(String code, String error) { }
    @Override public void onSuccess() { }
});
```
- `pushProvider` cho FCM = **`"fcm"`** (Huawei/Xiaomi có provider riêng — ngoài scope).
- Lấy/refresh token + nhận message qua `FirebaseMessagingService`:
```java
public class MyFcmListenerService extends FirebaseMessagingService {
    @Override public void onNewToken(String token) {
        ThingHomeSdk.getPushInstance().registerDevice(token, "fcm", /* IResultCallback */);
    }
    @Override public void onMessageReceived(RemoteMessage message) {
        Log.d(TAG, "FCM message received" + message.getData().toString());
        // tự build & show Notification trên các channel tuya_*
    }
}
```
- **Token removal (logout)** — bản cũ (deprecated, dùng theo Firebase mới):
```java
FirebaseInstanceId.getInstance().deleteInstanceId(); // v20.1.6, deprecated
// Firebase mới: FirebaseMessaging.getInstance().deleteToken()
```

### 2) Công tắc push tổng (entry: `ThingHomeSdk.getPushInstance()` → `IThingPush`)
```java
// Query trạng thái push tổng
void getPushStatus(IThingResultCallback<PushStatusBean> callback);
// Bật/tắt push tổng
void setPushStatus(boolean isOpen, IThingDataCallback<Boolean> callback);
```

### 3) Công tắc theo loại message
```java
void getPushStatusByType(PushType type, IThingDataCallback<Boolean> callback);
void setPushStatusByType(PushType type, boolean isOpen, IThingDataCallback<Boolean> callback);
```
**`PushType` (giá trị):**
| value | Loại | Ý nghĩa |
|---|---|---|
| `0` | Alert / Alarm | cảnh báo thiết bị |
| `1` | Home message | thông báo gia đình |
| `2` | Notice / Notification | thông báo / bản tin |
| `4` | Marketing | quảng cáo |

### 4) Do-Not-Disturb (DND) — qua `getPushInstance()` / `getMessageInstance()`
```java
void getDNDList(IThingDataCallback<ArrayList<DeviceAlarmNotDisturbVO>> listener);
void getOnceDNDList(IThingDataCallback<ArrayList<DeviceAlarmNotDisturbVO>> listener);
void getDNDDeviceList(IThingDataCallback<ArrayList<NodisturbDevicesBean>> listener);
void getDeviceDNDSetting(IThingDataCallback<Boolean> listener);
void setDeviceDNDSetting(boolean open, IThingDataCallback<Boolean> listener);
void addDNDWithStartTime(String startTime, String endTime, String devIds, String loops, IThingDataCallback<Long> listener);
void addOnceDNDWithStartTime(String startTime, String endTime, String devIds, IThingDataCallback<Long> listener);
void removeDNDWithTimerId(long id, IThingDataCallback<Boolean> listener);
void modifyDNDWithTimerId(long nodisturbAlarmId, String mStartTime, String mEndTime, String devIds, String loops, IThingDataCallback<Boolean> listener);
void modifyOnceDNDWithTimerId(long nodisturbAlarmId, String mStartTime, String mEndTime, String devIds, IThingDataCallback<Boolean> listener);
```

### 5) Message Center (đối chiếu, qua `ThingHomeSdk.getMessageInstance()` → `IThingMessage`)
- `getMessageList(...)` (đơn giản + phân trang offset/limit) → `MessageListBean` qua `IThingDataCallback<MessageListBean>`.
- `getMessageListByMsgType(offset, limit, MessageType, callback)` — lọc theo loại.
- `deleteMessage(...)`, check unread qua field `MessageBean.hasNotRead`.

---

## API iOS (verbatim / đối chiếu)

### 1) Đăng ký device token (APNs) + xin quyền
```objc
- (void)application:(UIApplication *)application
didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
    [ThingSmartSDK sharedInstance].deviceToken = deviceToken;
}

- (void)application:(UIApplication *)application
didReceiveRemoteNotification:(NSDictionary *)userInfo
fetchCompletionHandler:(void(^)(UIBackgroundFetchResult))completionHandler { /* ... */ }
```
```swift
let center = UNUserNotificationCenter.current()
center.delegate = self as? UNUserNotificationCenterDelegate
let options: UNAuthorizationOptions = [.alert, .badge, .sound]
center.requestAuthorization(options: options) { (granted, error) in
    if granted { /* registerForRemoteNotifications() */ }
}
```
- Yêu cầu bật **Push Notifications capability** trong Xcode + up **push certificate / APNs key** lên Tuya console.

### 2) Công tắc push tổng (class: `ThingSmartSDK` singleton)
```objc
- (void)getPushStatusWithSuccess:(__nullable ThingSuccessBOOL)success
                         failure:(__nullable ThingFailureError)failure;

- (void)setPushStatusWithStatus:(BOOL)enable
                        success:(__nullable ThingSuccessHandler)success
                        failure:(__nullable ThingFailureError)failure;
```

### 3) Công tắc theo loại (method per-type)
```objc
// Device alerts (alarm)
- (void)getDevicePushStatusWithSuccess:...; - (void)setDevicePushStatusWithStauts:(BOOL)enable success:... failure:...;
// Home messages (family)
- (void)getFamilyPushStatusWithSuccess:...; - (void)setFamilyPushStatusWithStauts:(BOOL)enable success:... failure:...;
// Notifications (notice)
- (void)getNoticePushStatusWithSuccess:...; - (void)setNoticePushStatusWithStauts:(BOOL)enable success:... failure:...;
// Marketing
- (void)getMarketingPushStatusWithSuccess:...; - (void)setMarketingPushStatusWithStauts:(BOOL)enable success:... failure:...;
```
> Lưu ý chính tả gốc của Tuya: setter là **`...WithStauts:`** (typo "Stauts" tồn tại trong header — copy đúng khi bind).

### 4) DND (class: `ThingSmartMessageSetting`)
```objc
- (void)setDeviceDNDSettingStatus:(BOOL)flags success:... failure:...;
- (void)getDeviceDNDSettingstatusSuccess:... failure:...;
- (void)getDNDListSuccess:... failure:...;
- (void)addDNDWithDNDRequestModel:... success:... failure:...;
- (void)modifyDNDWithTimerID:... DNDRequestModel:... success:... failure:...;
- (void)removeDNDWithTimerID:... success:... failure:...;
```

### 5) Push Notifications Management — Business Extension Kit (KHUYẾN NGHỊ mới, class `ThingSmartMessagePushSetting`)
```objc
// Công tắc theo loại bằng enum ThingSmartMessagePushSwitchType
- (void)getMessagePushSwitchStatusWithType:(ThingSmartMessagePushSwitchType)type
                                   success:(ThingSuccessBOOL)success
                                   failure:(ThingFailureError)failure;
- (void)setMessagePushSwitchStatusWithRequestModel:(ThingSmartMessagePushSwitchRequestModel*)requestModel
                                           success:(ThingSuccessHandler)success
                                           failure:(ThingFailureError)failure;

// Kênh giao của Device Alarm: system push / phone call / SMS
- (void)getDeviceAlarmSwitchStatusWithPushChannel:(ThingSmartDeviceAlarmPushChannel)pushChannel
                                          success:(ThingSuccessBOOL)success failure:(ThingFailureError)failure;
- (void)setDeviceAlarmSwitchStatusWithRequestModel:(ThingSmartDeviceAlarmSwitchRequestModel*)requestModel
                                          success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;

// Throttle (giới hạn tần suất, đơn vị phút)
- (void)getDeviceAlarmThrottleTimeWithPushChannel:(ThingSmartDeviceAlarmPushChannel)pushChannel
                                          success:(ThingSuccessInt)success failure:(ThingFailureError)failure;
- (void)setDeviceAlarmThrottleTimeWithRequestModel:(ThingSmartDeviceAlarmThrottleTimeRequestModel*)requestModel
                                          success:(ThingSuccessBOOL)success failure:(ThingFailureError)failure;
```
**`ThingSmartMessagePushSwitchType`:** `...DeviceAlarm` (alerts), `...Family` (home), `...Notice` (notification), `...Marketing` (marketing).

### 6) Message Center iOS (đối chiếu)
- Class `ThingSmartMessage`: `getMessageList()` (limit/offset) → `NSArray<ThingSmartMessageListModel*>` qua success/failure; hỗ trợ lọc theo loại + xoá.

---

## Bean / Callback / Listener
| Tên | Nền tảng | Vai trò |
|---|---|---|
| `IThingPush` (entry `getPushInstance()`) | Android | get/modify trạng thái push |
| `IThingMessage` (entry `getMessageInstance()`) | Android | list/delete/check-unread message |
| `PushStatusBean` | Android | model trạng thái push tổng (field chi tiết: mở API reference) |
| `PushType` | Android | enum `0` alert / `1` home / `2` notice / `4` marketing |
| `IResultCallback` | Android | `onSuccess()` / `onError(code, error)` — dùng cho `registerDevice` |
| `IThingResultCallback<T>` | Android | `onSuccess(T)` / `onError(code, error)` — get có data |
| `IThingDataCallback<Boolean>` | Android | callback boolean cho set/get theo loại, DND |
| `DeviceAlarmNotDisturbVO`, `NodisturbDevicesBean` | Android | model DND |
| `MessageListBean` / `MessageBean` (`hasNotRead`) | Android | model Message Center |
| `ThingSmartSDK` (singleton) | iOS | gán `deviceToken`, get/set push tổng + per-type |
| `ThingSmartMessageSetting` | iOS | DND |
| `ThingSmartMessagePushSetting` | iOS (Biz Ext Kit) | push switch theo loại + kênh + throttle (mới) |
| `ThingSmartMessagePushSwitchType` | iOS | enum DeviceAlarm/Family/Notice/Marketing |
| `ThingSmartMessage` / `ThingSmartMessageListModel` | iOS | Message Center |
| `ThingSuccessBOOL` / `ThingSuccessHandler` / `ThingSuccessInt` / `ThingFailureError` | iOS | block callback |

---

## Mã lỗi liên quan
Tài liệu push **không có bảng mã lỗi riêng**; trả về qua `onError(code, error)` (Android) / `ThingFailureError` (iOS), dùng chung bảng mã lỗi SDK:
- `-1` SDK chưa init → đảm bảo `initSdk()` trước khi `getPushInstance()`.
- Lỗi mạng/timeout (vd `-3`) khi `registerDevice` / set switch → retry.
- **FCM không tới** thường KHÔNG phải lỗi SDK mà do cấu hình: sai `google-services.json` / package name lệch console / thiếu notification channel / chưa up Service account JSON (FCM v1). → kiểm tra console + Firebase.
- Nguồn mã lỗi: https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a

---

## Cạm bẫy
1. **Phải đăng ký token SAU khi login** (push gắn theo account). Đổi user (logout→login khác) phải **đăng ký lại token**; logout nên **xoá/huỷ token** để user cũ không nhận push của thiết bị.
2. **Công tắc tổng tắt = chặn tất cả**: dù bật per-type, nếu `setPushStatus(false)` thì không có alert/home/notice nào. UI nên phản ánh quan hệ tổng → con.
3. **Android phải tạo notification channel** `tuya_common`/`tuya_shortbell`/`tuya_longbell`/`tuya_doorbell`/`tuya_warnbell` (Android 8+) — thiếu → notification im lặng/bị bỏ.
4. **FCM v1 + Service account**: console cần **2 file** — `google-services.json` (General) và **Service account private key JSON** (FCM HTTP v1). Thiếu key service-account → Tuya cloud không gửi được. Server Key legacy đang bị Google khai tử → ưu tiên Service account.
5. **Package name (Android) / Bundle ID (iOS) phải khớp console**, nếu không push không tới (validation tĩnh, không có error rõ).
6. **iOS phải xin quyền + capability**: thiếu `requestAuthorization` hoặc Push capability/APNs cert → `deviceToken` không có, push câm.
7. **2 namespace cũ/mới**: tài liệu lẫn `ITuya*`/`TuyaSmart*` (cũ) và `IThing*`/`ThingSmart*` (mới). Với 7.5.x **bind theo `Thing*`** (Android `ThingHomeSdk.getPushInstance()`; iOS `ThingSmartSDK`).
8. **Typo "Stauts"** trong setter iOS per-type (`setDevicePushStatusWithStauts:`...) là tên thật trong header — phải copy đúng khi viết bridge.
9. **Business Extension Kit vs `ThingSmartMessage` cũ**: Tuya khuyến nghị dùng `ThingSmartMessagePushSetting` (Biz Ext Kit) cho per-type/kênh/throttle. Cân nhắc khi chọn API iOS để wrap.
10. **DND chỉ ảnh hưởng Device Alarm**, không tắt marketing/notice — đừng nhầm DND với công tắc loại.
11. **Mối quan hệ với Message Management**: bật push nhưng không gọi Message Center thì lịch sử vẫn nằm server; muốn hiển thị danh sách cảnh báo trong app vẫn phải dùng `IThingMessage`/`ThingSmartMessage`.

---

## Đề xuất API TurboModule

**Tạo module mới `TuyaPush`** (push token + switches + DND) và (tuỳ chọn) **`TuyaMessage`** (Message Center). Native đẩy event message tới JS qua emitter của `TuyaCore`/`TuyaDevice` đã có.

```ts
// ===== Module mới: TuyaPush =====
export type PushType = 'alarm' | 'home' | 'notification' | 'marketing'; // map 0/1/2/4

export interface PushStatus {
  total: boolean;        // công tắc tổng
  alarm: boolean;
  home: boolean;
  notification: boolean;
  marketing: boolean;
}

export interface TuyaPush {
  // Đăng ký device token với Tuya cloud.
  // Android: provider 'fcm' (token lấy từ @react-native-firebase/messaging getToken/onTokenRefresh).
  // iOS: deviceToken APNs (hex string từ didRegisterForRemoteNotificationsWithDeviceToken hoặc rnfirebase).
  registerDevice(token: string, provider: 'fcm' | 'apns'): Promise<void>;
  unregisterDevice(): Promise<void>; // dùng khi logout

  // Công tắc tổng
  getPushStatusTotal(): Promise<boolean>;
  setPushStatusTotal(open: boolean): Promise<void>;

  // Công tắc theo loại
  getPushStatusByType(type: PushType): Promise<boolean>;
  setPushStatusByType(type: PushType, open: boolean): Promise<void>;

  // Gộp tất cả (tiện cho màn Settings)
  getAllPushStatus(): Promise<PushStatus>;

  // DND (chỉ áp Device Alarm)
  getDeviceDNDSetting(): Promise<boolean>;
  setDeviceDNDSetting(open: boolean): Promise<void>;
  addDND(startTime: string, endTime: string, devIds: string, loops: string): Promise<number>; // -> timerId
  removeDND(timerId: number): Promise<void>;
  modifyDND(timerId: number, startTime: string, endTime: string, devIds: string, loops: string): Promise<void>;
  getDNDList(): Promise<DndRule[]>;
}

export interface DndRule {
  id: number; startTime: string; endTime: string; devIds: string; loops: string;
}

// ===== Module tuỳ chọn: TuyaMessage (Message Center, quan hệ với push) =====
export interface TuyaMessageItem {
  id: string; title: string; content: string; type: PushType; time: number; hasNotRead: boolean;
}
export interface TuyaMessage {
  getMessageList(offset: number, limit: number): Promise<TuyaMessageItem[]>;
  getMessageListByType(type: PushType, offset: number, limit: number): Promise<TuyaMessageItem[]>;
  deleteMessage(ids: string[]): Promise<void>;
}
```

**Ghi chú nền tảng cho bridge:**
- `registerDevice`: Android gọi `ThingHomeSdk.getPushInstance().registerDevice(token, "fcm", cb)`; iOS gán `[ThingSmartSDK sharedInstance].deviceToken = data` (cần convert hex-string JS → `NSData`), không có method "registerDevice" tách riêng như Android.
- `setPushStatusByType`: Android `setPushStatusByType(PushType, open, cb)` (`alarm→0, home→1, notification→2, marketing→4`); iOS map sang `setDevicePushStatusWithStauts:` / `setFamilyPushStatusWithStauts:` / `setNoticePushStatusWithStauts:` / `setMarketingPushStatusWithStauts:` (hoặc `ThingSmartMessagePushSetting.setMessagePushSwitchStatusWithRequestModel:` nếu dùng Biz Ext Kit).
- `getAllPushStatus`: native gọi tuần tự getter tổng + 4 type rồi gộp (Android `getPushStatus`→`PushStatusBean` có thể đã chứa nhiều field, ưu tiên nếu API reference confirm).
- Token nên lấy ở JS qua `@react-native-firebase/messaging` (Android) và `messaging().getAPNSToken()` / native delegate (iOS), rồi gọi `registerDevice`. Lib **không tự ôm Firebase** để tránh trùng cấu hình FCM của app.
- DND `devIds` là chuỗi id thiết bị ngăn cách (theo bean Android); `loops` là pattern lặp (vd "1111111").

**Câu hỏi mở / cần xác minh khi code:**
- Field chính xác của `PushStatusBean` (có gộp sẵn 4 type không) — mở API reference Android.
- Tên callback Android chuẩn cho từng method (`IThingResultCallback` vs `IThingDataCallback`) ở 7.5.x — verify header.
- iOS 7.5: nên dùng `ThingSmartSDK` per-type (cũ) hay `ThingSmartMessagePushSetting` (Biz Ext Kit) — chọn 1 để wrap nhất quán; Biz Ext Kit cần pod `ThingSmartBusinessExtensionKit` (đã có trong Podfile nền tảng).
- Định dạng `deviceToken` iOS khi nhận từ JS (NSData từ rnfirebase APNs token) — cần test trên máy thật.
- FCM v1 vs legacy Server Key trên console của AppKey client (Google đang tắt legacy).

---

## Nguồn (URL đã đọc)
- Integrate with Push Notifications — https://developer.tuya.com/en/docs/app-development/push?id=Ka5srtq240glp
- Integrate with FCM Push (Android) — https://developer.tuya.com/en/docs/app-development/pushfcm?id=Ka6ki8lbkcqbv
- Set Push Messages (Android) — https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kaj16d3iwgq4r
- Configure Push Notifications (Android) — https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kceuhog1w1qfb
- Set Push Messages (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-message-push?id=Kaj0skc91ywxr
- Configure Push Notifications (iOS) — https://developer.tuya.com/en/docs/app-development/iOS-message-push?id=Kceugkjvfq0k4
- Push Notifications Management (Business Extension Kit) — https://developer.tuya.com/en/docs/app-development/extension-message-push-setting?id=Kdqso74u6l2yd
- Message Management — https://developer.tuya.com/en/docs/app-development/messagecenter?id=Ka6ki8lc1u0qg
- Push Notification on Android (overview) — https://developer.tuya.com/en/docs/iot/message-push?id=Kaiuyrqqw6szg
- Configure Google FCM (console) — https://developer.tuya.com/en/docs/iot/fcm-push?id=K989rrxsofo5i
- Message Center (iOS GitBook, đối chiếu) — https://tuyainc.github.io/tuyasmart_home_ios_sdk_doc/en/resource/Message.html
- Error Codes — https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6nxw2k97l8a
