# Tuya Research: Message Management (Trung tâm thông báo / Message Center)

- **Ngày:** 2026-06-29 · **SDK version tham chiếu:** Android `thingsmart` **7.5.x** · iOS `ThingSmartHomeKit` **~7.5**
- **Nguồn chính:**
  - Message Management (overview) - https://developer.tuya.com/en/docs/app-development/messagecenter?id=Ka6ki8lc1u0qg
  - Message Capabilities (Android) - https://developer.tuya.com/en/docs/app-development/android-message-about?id=Kaj16vvx1n8jw
  - Set Push Messages (Android) - https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kaj16d3iwgq4r
  - Message Capabilities (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-message-function?id=Kaj0t5zaofjfd
  - Set Push Messages (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-message-push?id=Kaj0skc91ywxr
  - iOS API Reference `ThingSmartMessage` - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/interface_thing_smart_message.html
- **Lưu ý độ tin cậy:** API **Android** lấy verbatim khá đầy đủ từ trang "Message Capabilities" + "Set Push Messages". API **iOS** mới (model-based `fetch...RequestModel`) đã đối chiếu **verbatim** với trang API Reference chính thức. **Lưu ý**: nhiều tài liệu Tuya search ra là **IPC/camera message** (`ThingSmartCameraMessage`, `ipc_motion`...) - **KHÔNG dùng cho ice-bath**; note này chỉ lấy **general message center** (alarm/family/notification). Mục "Câu hỏi mở" liệt kê chỗ chưa chốt tận chữ ký.

---

## Phạm vi
Trung tâm thông báo người dùng (không phải IPC): lấy danh sách message theo **3 loại** (Alarm/báo động, Family/Home, Notification/Notice), **phân trang** (offset/limit), lấy **chi tiết** message theo nguồn (msgSrcId = devId), **xoá** message, **kiểm tra có message mới chưa đọc** (has-new), **đánh dấu đã đọc** (iOS có API riêng; Android dựa vào cờ `hasNotRead` + push status), và **cấu hình nhận push** theo loại + **Do-Not-Disturb (DND)** (khoảng giờ im lặng, theo thiết bị / lặp tuần / một lần).

> Với app **ice-bath**: dùng để hiển thị lịch sử cảnh báo của bồn (alarm: quá nhiệt, lỗi cảm biến, lỗi máy nén...), thông báo gia đình (mời/chia sẻ home), và bản tin hệ thống; cho phép bật/tắt push từng loại và đặt DND ban đêm.

## Khái niệm & luồng
- **2 năng lực tách biệt** (theo trang overview):
  - **`IThingMessage`** (Android) / **`ThingSmartMessage`** (iOS): lấy **list message**, **xoá**, **kiểm tra message mới**, (iOS) **đánh dấu đã đọc**.
  - **`IThingPush`** (Android) / push API trên **`ThingSmartSDK sharedInstance`** + **`ThingSmartMessageSetting`** (iOS): **bật/tắt push tổng & theo loại**, **DND**.
- **3 loại message** (msgType): **1 = Alarm/Alert**, **2 = Family/Home**, **3 = Notification/Notice** (Android dùng số; iOS dùng enum `ThingMessageType`). Push còn có thêm **Marketing** (loại 4) trong cấu hình push.
- **Luồng đọc:** đã login → `getMessageList(offset, limit, ...)` hoặc theo loại `getMessageListByMsgType(...)` → render → xoá bằng `deleteMessages(ids)` → kiểm tra badge bằng `requestMessageNew(...)` (Android) / `getLatestMessage...` (iOS).
- **Luồng cấu hình:** `getPushStatus` (tổng) + `getPushStatusByType(type)` (theo loại) → toggle bằng `setPushStatus` / `setPushStatusByType`; DND: `getDNDList`/`getOnceDNDList` → `addDNDWithStartTime`/`addOnceDNDWithStartTime` → `modify...`/`removeDNDWithTimerId`.
- **Pagination kiểu Tuya:** `offset` (bắt đầu từ 0) + `limit` (vd 15/20). Trả `MessageListBean` (Android) chứa list + cờ "còn nữa"; cuộn vô hạn bằng cách tăng offset.

---

## API Android (verbatim)

### 1) Message list / delete / has-new - `ThingHomeSdk.getMessageInstance()` → `IThingMessage`
```java
// Lấy toàn bộ message (không phân trang)
void getMessageList(IThingDataCallback<List<MessageBean>> callback);

// Lấy message phân trang
void getMessageList(int offset, int limit,
    IThingDataCallback<MessageListBean> callback);

// Lọc theo loại message (Alarm/Family/Notification)
void getMessageListByMsgType(int offset, int limit,
    MessageType msgType, IThingDataCallback<MessageListBean> callback);

// Lọc theo nguồn (msgSrcId = devId) - lấy chi tiết theo 1 thiết bị
void getMessageListByMsgSrcId(int offset, int limit,
    MessageType msgType, String msgSrcId,
    IThingDataCallback<MessageListBean> callback);

// Xoá nhiều message theo id
void deleteMessages(List<String> mIds, IBooleanCallback callback);

// Xoá theo loại (kèm msgSrcIds)
void deleteMessageWithType(int msgType, List<String> mIds,
    List<String> mSrcIds, IBooleanCallback callback);

// Kiểm tra có message mới chưa đọc (badge) cho từng loại
void requestMessageNew(IThingDataCallback<MessageHasNew> callback);
```
- `MessageType` (msgType): **1 = alert**, **2 = home message**, **3 = notification**.
- **Đánh dấu đã đọc (Android):** trang "Message Capabilities" KHÔNG có method `markRead` riêng cho general message - trạng thái đã/chưa đọc đọc qua cờ `MessageBean.hasNotRead`; "đọc" thường được server set khi mở chi tiết / qua push status. (Xem "Câu hỏi mở".)

### 2) Push status + DND - `ThingHomeSdk.getPushInstance()` → `IThingPush`
```java
// Push tổng
void getPushStatus(IThingResultCallback<PushStatusBean> callback);
void setPushStatus(boolean isOpen, IThingDataCallback<Boolean> callback);

// Push theo loại (PushType: 0 Alert, 1 Home, 2 Notice, 4 Marketing)
void getPushStatusByType(PushType type, IThingDataCallback<Boolean> callback);
void setPushStatusByType(PushType type, boolean isOpen,
    IThingDataCallback<Boolean> callback);

// DND - danh sách khoảng giờ im lặng (lặp tuần / một lần)
void getDNDList(IThingDataCallback<ArrayList<DeviceAlarmNotDisturbVO>> listener);     // loop "1000000" = mỗi CN
void getOnceDNDList(IThingDataCallback<ArrayList<DeviceAlarmNotDisturbVO>> listener); // loop "0000000" = một lần
void getDNDDeviceList(IThingDataCallback<ArrayList<NodisturbDevicesBean>> listener);

// DND toggle tổng
void getDeviceDNDSetting(IThingDataCallback<Boolean> listener);
void setDeviceDNDSetting(boolean open, IThingDataCallback<Boolean> listener);

// Thêm DND
void addDNDWithStartTime(String startTime, String endTime, String devIds,
    String loops, IThingDataCallback<Long> listener);        // startTime/endTime "HH:mm", loops "0011111"
void addOnceDNDWithStartTime(String startTime, String endTime, String devIds,
    IThingDataCallback<Long> listener);                      // "YYYY-MM-DD HH:mm"

// Sửa / xoá DND
void removeDNDWithTimerId(long id, IThingDataCallback<Boolean> listener);
void modifyDNDWithTimerId(long nodisturbAlarmId, String mStartTime,
    String mEndTime, String devIds, String loops, IThingDataCallback<Boolean> listener);
void modifyOnceDNDWithTimerId(long nodisturbAlarmId, String mStartTime,
    String mEndTime, String devIds, IThingDataCallback<Boolean> listener);
```
- `devIds` format: `"{allDevIds:false,devIds:[\"deviceId\"]}"` (hoặc `allDevIds:true` cho mọi thiết bị).
- `loops` format `"xxxxxxx"` 7 ký tự (mỗi ngày 1 bit, 1 = bật). One-time DND dùng `"0000000"`.

---

## API iOS (verbatim / đối chiếu)

### 1) Message list / detail / delete / read - `ThingSmartMessage`
> API mới dùng **request model** (các API cũ `getMessageListWithType:limit:offset:...`, `getMessageDetailListWithType:...`, `deleteMessageWithType:ids:msgSrcIds:...` đã **DEPRECATED** → thay bằng `fetch.../delete...WithRequestModel`). Signature verbatim từ API Reference:
```objc
// Danh sách message theo loại + phân trang
- (void)fetchMessageListWithListRequestModel:(ThingSmartMessageListRequestModel *)listRequestModel
                                     success:(void(^)(NSArray<ThingSmartMessageListModel *> *messageList))success
                                     failure:(ThingFailureError)failure;

// Chi tiết message theo loại + msgSrcId + phân trang
- (void)fetchMessageDetailListWithListRequestModel:(ThingSmartMessageDetailListRequestModel *)detailListRequestModel
                                           success:(void(^)(NSArray<ThingSmartMessageListModel *> *messageList))success
                                           failure:(ThingFailureError)failure;

// Chi tiết message có mã hoá (IPC/ảnh - thường KHÔNG dùng cho ice-bath)
- (void)fetchEncryptMessageDetailListWithListRequestModel:(ThingSmartMessageDetailListRequestModel *)detailListRequestModel
                                                  success:(void(^)(NSArray<ThingSmartMessageListModel *> *messageList))success
                                                  failure:(ThingFailureError)failure;

// Đánh dấu đã đọc (iOS CÓ API riêng)
- (void)readMessageWithReadRequestModel:(ThingSmartMessageListReadRequestModel *)readRequestModel
                                success:(ThingSuccessBOOL)success
                                failure:(ThingFailureError)failure;

// Xoá message
- (void)deleteMessageWithDeleteRequestModel:(ThingSmartMessageListDeleteRequestModel *)deleteRequestModel
                                    success:(ThingSuccessBOOL)success
                                    failure:(ThingFailureError)failure;

// Lấy message mới nhất (kiểm tra has-new / badge)
- (void)getLatestMessageWithSuccess:(ThingSuccessDict)success
                            failure:(ThingFailureError)failure;

- (void)cancelRequest;
```
- **Entry/instance:** tài liệu API Reference KHÔNG ghi rõ `sharedInstance`; pattern Tuya iOS thường là **`[[ThingSmartMessage alloc] init]`** rồi giữ tham chiếu (gọi `cancelRequest` khi rời màn hình). Cần verify trên header thực tế (xem "Câu hỏi mở").
- **Message type enum** `ThingMessageType`: `ThingMessageTypeAlarm` (Alert) · `ThingMessageTypeFamily` (Home) · `ThingMessageTypeNotice` (Notice).

### 2) Push status - `[ThingSmartSDK sharedInstance]`
```objc
// Push tổng
- (void)getPushStatusWithSuccess:(ThingSuccessBOOL)success failure:(ThingFailureError)failure;
- (void)setPushStatusWithStatus:(BOOL)enable success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;

// Push theo loại (get/set)
- (void)getDevicePushStatusWithSuccess:...;   - (void)setDevicePushStatusWithStauts:(BOOL)... ;   // Alarm/Alert
- (void)getFamilyPushStatusWithSuccess:...;   - (void)setFamilyPushStatusWithStauts:(BOOL)... ;   // Home
- (void)getNoticePushStatusWithSuccess:...;   - (void)setNoticePushStatusWithStauts:(BOOL)... ;   // Notice
- (void)getMarketingPushStatusWithSuccess:...; - (void)setMarketingPushStatusWithStauts:(BOOL)... ; // Marketing
```
> Lưu ý chính tả của Tuya: setter dùng **`Stauts`** (typo cố hữu trong API) - phải gõ đúng `setDevicePushStatusWithStauts:` v.v.

### 3) DND - `ThingSmartMessageSetting`
```objc
- (void)setDeviceDNDSettingStatus:(BOOL)open success:... failure:...;
- (void)getDeviceDNDSettingstatusSuccess:... failure:...;
- (void)getDNDDeviceListSuccess:... failure:...;
- (void)getAllDNDListWithSuccess:(void(^)(ThingSmartMessageDNDListEntity *entity))success failure:...; // recurring + once
- (void)getDNDListSuccess:... failure:...;                                                              // recurring only

- (void)addDNDWithDNDRequestModel:(ThingSmartMessageSettingDNDRequestModel *)model success:... failure:...;
- (void)addOnceDNDWithRequestModel:(ThingSmartMessageOnceDNDRequestModel *)model success:... failure:...;
- (void)modifyDNDWithTimerID:(long)id DNDRequestModel:(ThingSmartMessageSettingDNDRequestModel *)model success:... failure:...;
- (void)modifyOnceDNDWithTimerID:(long)id requestModel:(ThingSmartMessageOnceDNDRequestModel *)model success:... failure:...;
- (void)removeDNDWithTimerID:(long)timerID success:(ThingSuccessHandler)success failure:(ThingFailureError)failure;
```

---

## Bean / Callback / Listener

### Android
| Tên | Loại | Field / chữ ký |
|---|---|---|
| `MessageBean` | model 1 message | `id`(String), `msgType`(Integer), `msgSrcId`(String=devId), `msgContent`(String), `msgTypeContent`(String), `dateTime`(String), `Icon`(String), `hasNotRead`(Boolean) |
| `MessageListBean` | trang kết quả | list `MessageBean` + thông tin phân trang (total/hasNext) |
| `MessageHasNew` | badge has-new | `alarm`(Boolean), `family`(Boolean), `notification`(Boolean) |
| `MessageType` | enum loại | 1 alert · 2 home · 3 notification |
| `PushType` | enum push | 0 Alert · 1 Home · 2 Notice · 4 Marketing |
| `PushStatusBean` | trạng thái push tổng | bật/tắt + chi tiết theo loại |
| `DeviceAlarmNotDisturbVO` | 1 khoảng DND | startTime/endTime/loops/devIds/id |
| `NodisturbDevicesBean` | device áp DND | devId + cờ |
| `IThingDataCallback<T>` | callback | `onSuccess(T result)` / `onError(String code, String message)` |
| `IThingResultCallback<T>` | callback | success/failure generic |
| `IBooleanCallback` | callback | kết quả boolean (xoá) |

### iOS
| Tên | Loại | Field / chữ ký |
|---|---|---|
| `ThingSmartMessageListModel` | model 1 message (kết quả list/detail) | nội dung message (type/srcId/content/time/title/icon...) |
| `ThingSmartMessageListRequestModel` | request list | `msgType`(enum), `limit`, `offset` |
| `ThingSmartMessageDetailListRequestModel` | request detail | `msgType`, `msgSrcId`, `limit`, `offset` |
| `ThingSmartMessageListReadRequestModel` | request đánh dấu đọc | `msgType`, `msgIds` |
| `ThingSmartMessageListDeleteRequestModel` | request xoá | `msgType`, `msgIds`, `msgSrcIds` |
| `ThingMessageType` | enum loại | `ThingMessageTypeAlarm` / `ThingMessageTypeFamily` / `ThingMessageTypeNotice` |
| `ThingSmartMessageSettingDNDRequestModel` | DND lặp tuần | `startTime`/`endTime`("HH:mm"), `devIDs`(NSArray), `loops`("0000111"), `isAllDevIDs`(BOOL) |
| `ThingSmartMessageOnceDNDRequestModel` | DND một lần | `startTime`/`endTime`("yyyy-MM-dd HH:mm"), `devIDs`, `isAllDevIDs` |
| `ThingSmartMessageDNDListEntity` | tổng DND | `periodDNDList`(NSArray), `onceDNDList`(NSArray) |
| `ThingSuccessBOOL` | block | `^(BOOL result)` |
| `ThingSuccessHandler` | block | `^(void)` |
| `ThingSuccessDict` | block | `^(NSDictionary *dict)` |
| `ThingFailureError` | block | `^(NSError *error)` |

---

## Mã lỗi liên quan
- Tài liệu message **không có bảng mã lỗi riêng**; dùng chung bảng Error Codes của SDK - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6o3bubtl735
- Liên quan thực tế: `-1` (SDK chưa init - phải `initSdk()` trước), `-3` (timeout - thử lại), `-5` (param invalid - sai `offset/limit/msgType/devIds JSON`), lỗi network/MQTT khi gọi API list/push.
- `onError(String code, String message)` (Android) / `NSError` (iOS) trả về code + message - log nguyên văn để debug.

## Cạm bẫy
1. **Đừng nhầm với IPC message.** Search Tuya ra rất nhiều `ThingSmartCameraMessage` / `messagesWithMessageCodes:` / `ipc_motion`... - đó là **camera**, KHÔNG áp dụng cho ice-bath. General message center = `IThingMessage` / `ThingSmartMessage`.
2. **iOS API cũ đã deprecated.** Phải dùng bộ **`fetch...WithListRequestModel` / `delete...WithDeleteRequestModel` / `read...WithReadRequestModel`** (model-based), không dùng `getMessageListWithType:limit:offset:...` cũ.
3. **Đánh dấu đã đọc bất đối xứng giữa 2 nền tảng:** iOS có `readMessageWithReadRequestModel:`; Android (general) **không có method markRead công khai** - chỉ có cờ `hasNotRead` + `requestMessageNew`. ⇒ Bề mặt TS phải thiết kế "best-effort": iOS gọi read API, Android có thể no-op hoặc dựa vào server set khi fetch detail. (Cần verify Android có endpoint read ẩn không.)
4. **Typo `Stauts` của Tuya iOS** (`setDevicePushStatusWithStauts:`...) - gõ đúng nguyên văn nếu không sẽ không resolve selector.
5. **Phân trang:** offset bắt đầu **0**; phải tự cộng dồn offset khi cuộn; dựa vào số phần tử trả về < limit để biết đã hết (Android có `MessageListBean` chứa cờ).
6. **`devIds`/`devIDs` khác format giữa 2 nền tảng:** Android truyền **chuỗi JSON** `"{allDevIds:false,devIds:[\"id\"]}"`; iOS truyền **NSArray + cờ `isAllDevIDs`**. Bridge phải chuẩn hoá.
7. **`loops` 7 ký tự** - thứ tự ngày (CN→T7 hay T2→CN) khác nhau giữa doc Android (`"1000000"`=CN đầu) và iOS (`"0000111"` mô tả Mon–Sun). **Phải xác minh thứ tự bit thực tế** trước khi map UI.
8. **Push status ≠ message list.** Tắt push (`setPushStatusByType`) chỉ chặn notification đẩy về máy, message vẫn lưu server và vẫn `getMessageList` được. UI cần phân biệt "tắt thông báo" vs "xoá lịch sử".
9. **Message gắn với account/home đang login** - phải đã login + đúng Data Center (EU) như note nền tảng; sai DC → list rỗng.

---

## Đề xuất API TurboModule

Tạo **module mới `TuyaMessage`** (tách khỏi TuyaDevice/TuyaHome vì là domain riêng). Push status + DND có thể gộp vào cùng module này (tránh tạo thêm module nhỏ). Map sang lib `@jimmy-vu/react-native-turbo-tuya`.

```ts
// ===== Types =====
export type TuyaMessageType = 'alarm' | 'family' | 'notification';
export type TuyaPushType = 'alarm' | 'family' | 'notification' | 'marketing';

export interface TuyaMessage {
  id: string;
  msgType: TuyaMessageType;
  msgSrcId?: string;        // devId nguồn
  title?: string;
  content: string;          // msgContent
  typeContent?: string;     // msgTypeContent
  icon?: string;
  dateTime: string;
  time?: number;            // unix ts nếu có
  hasNotRead: boolean;
}

export interface TuyaMessagePage {
  list: TuyaMessage[];
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface TuyaMessageHasNew {
  alarm: boolean;
  family: boolean;
  notification: boolean;
}

export interface TuyaDndPeriod {
  id: number;               // timerId
  startTime: string;        // "HH:mm" (recurring) | "YYYY-MM-DD HH:mm" (once)
  endTime: string;
  loops?: string;           // "0011111" - bỏ trống = once
  allDevices: boolean;
  devIds: string[];
}

// ===== Module: TuyaMessage =====
export interface Spec {
  // --- Message list ---
  getMessageList(offset: number, limit: number): Promise<TuyaMessagePage>;
  getMessageListByType(type: TuyaMessageType, offset: number, limit: number): Promise<TuyaMessagePage>;
  getMessageDetailList(type: TuyaMessageType, msgSrcId: string, offset: number, limit: number): Promise<TuyaMessagePage>;

  // --- Has-new / read / delete ---
  getMessageHasNew(): Promise<TuyaMessageHasNew>;
  // best-effort: iOS gọi readMessage..., Android no-op nếu không có API
  markMessagesRead(type: TuyaMessageType, ids: string[]): Promise<boolean>;
  deleteMessages(ids: string[]): Promise<boolean>;
  deleteMessagesByType(type: TuyaMessageType, ids: string[], srcIds: string[]): Promise<boolean>;

  // --- Push status ---
  getPushStatus(): Promise<boolean>;
  setPushStatus(open: boolean): Promise<boolean>;
  getPushStatusByType(type: TuyaPushType): Promise<boolean>;
  setPushStatusByType(type: TuyaPushType, open: boolean): Promise<boolean>;

  // --- Do-Not-Disturb ---
  getDndStatus(): Promise<boolean>;
  setDndStatus(open: boolean): Promise<boolean>;
  getDndList(): Promise<TuyaDndPeriod[]>;        // recurring
  getOnceDndList(): Promise<TuyaDndPeriod[]>;     // one-time
  addDnd(startTime: string, endTime: string, loops: string, allDevices: boolean, devIds: string[]): Promise<number>;     // -> timerId
  addOnceDnd(startTime: string, endTime: string, allDevices: boolean, devIds: string[]): Promise<number>;
  modifyDnd(id: number, startTime: string, endTime: string, loops: string, allDevices: boolean, devIds: string[]): Promise<boolean>;
  removeDnd(id: number): Promise<boolean>;
}
```

**Ghi chú map native:**
- `getMessageList*` → Android `IThingMessage.getMessageList*`; iOS `ThingSmartMessage.fetchMessageListWithListRequestModel:` (đổ `msgType/limit/offset` vào request model). Map cờ `hasMore` từ số phần tử trả về (< limit ⇒ hết).
- `markMessagesRead` → iOS `readMessageWithReadRequestModel:`; **Android**: nếu không có API public, trả `true` no-op và để badge cập nhật qua `getMessageHasNew` (ghi rõ trong doc lib).
- `deleteMessages` → Android `deleteMessages(ids)`; iOS `deleteMessageWithDeleteRequestModel:` (cần `msgType` ⇒ ưu tiên `deleteMessagesByType`, hoặc native suy ra type từ id trước khi xoá).
- Push type map: `alarm→Device(Alert)`, `family→Family`, `notification→Notice`, `marketing→Marketing`. Nhớ typo iOS `Stauts`.
- DND `devIds`: Android serialize sang JSON `{allDevIds, devIds:[...]}`; iOS đổ vào `devIDs`+`isAllDevIDs`. **Chuẩn hoá thứ tự bit `loops` ở native** sau khi verify (xem cạm bẫy #7).
- Cân nhắc bổ sung **event emitter** `onNewMessage` nếu kết hợp FCM/push để refresh badge realtime (ngoài scope SDK message, thuộc lớp push của app).

## Câu hỏi mở / cần xác minh
- **iOS `ThingSmartMessage` lấy instance thế nào?** (`[[ThingSmartMessage alloc] init]` vs `sharedInstance`) - API Reference không ghi rõ; mở header khi code.
- **Android có API markRead công khai cho general message không?** Nếu không, chốt hành vi no-op + dựa `requestMessageNew`.
- **Thứ tự bit `loops`** (CN-first hay Mon-first) - verify giữa Android (`"1000000"`=CN) và iOS (`"0000111"`=Mon–Sun) trên thiết bị thật.
- **`MessageListBean` field phân trang chính xác** (tên field `hasNext`/`total`) - đọc bean thật khi tích hợp.
- **Field đầy đủ của `ThingSmartMessageListModel`** (title/icon/time) - API Reference chỉ liệt kê tên model; mở interface model khi code iOS.
- **Loại message thực tế ice-bath sinh ra** (alarm code nào: quá nhiệt/lỗi máy nén) - cần thiết bị thật + product DP schema để map sang nội dung message.

## Nguồn (URL đã đọc)
- Message Management (overview) - https://developer.tuya.com/en/docs/app-development/messagecenter?id=Ka6ki8lc1u0qg
- Message Capabilities (Android) - https://developer.tuya.com/en/docs/app-development/android-message-about?id=Kaj16vvx1n8jw
- Set Push Messages (Android) - https://developer.tuya.com/en/docs/app-development/android-message-push?id=Kaj16d3iwgq4r
- Message Capabilities (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-message-function?id=Kaj0t5zaofjfd
- Set Push Messages (iOS) - https://developer.tuya.com/en/docs/app-development/iOS-message-push?id=Kaj0skc91ywxr
- iOS API Reference - `ThingSmartMessage` - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/interface_thing_smart_message.html
- iOS API Reference - Class Members (functions) - https://tuya.github.io/tuyasmart_home_ios_sdk_api_reference/functions_func_c.html
- iOS API Reference - Deprecated List - https://tuyainc.github.io/tuyasmart_home_ios_sdk_api_reference/deprecated.html
- Alert List (IPC - đối chiếu để loại trừ) - https://developer.tuya.com/en/docs/app-development/messagelist?id=Kdmgaswbhh83p
- Error Codes - https://developer.tuya.com/en/docs/app-development/errorcode?id=Ka6o3bubtl735
