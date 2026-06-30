# Tuya Research: Cloud App Push Notification Service (server/admin → app user)

- **Ngày:** 2026-06-30 · **Loại:** Tuya **Cloud OpenAPI** (IoT Core), KHÔNG phải App SDK.
- **Mục tiêu:** web admin gửi thông báo tới end-user (theo Tuya `uid`) qua backend NestJS,
  tận dụng [`TuyaCloudService`](../../apps/backend/src/tuya/tuya-cloud.service.ts) đã có.
- **Nguồn chính:**
  - Mobile Push Notification Service (mục lục 4 endpoint) — https://developer.tuya.com/en/docs/cloud/app-push?id=Kaiuye3tb3yho
  - Send Push Notifications to App (gửi push) — https://developer.tuya.com/en/docs/cloud/571df1f27e?id=Kagp27bb0hkxe
  - Add a template of messages in notification center (tạo template) — https://developer.tuya.com/en/docs/cloud/db8cac79e4?id=Kagp29fdj4yse
  - App Push Notification Subscription and Template (điều kiện + duyệt) — https://developer.tuya.com/en/docs/iot/app-push-notification?id=Kaiuyyn5po2kw
  - Configure Placeholders (cú pháp biến `${...}`) — https://developer.tuya.com/en/docs/iot/message-push-Placeholder?id=Kby77w6kmpfdt
- **Bổ trợ (phía SDK nhận push, đã research riêng):** [tuya-home-sdk-push-notifications.md](tuya-home-sdk-push-notifications.md)
- **Độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. **Đã confirm trực tiếp:** 4 endpoint + path,
  request/response của `push` và `add template`, field template (`name/title/content/type/remark`),
  `type` 0/1, quy trình duyệt ≤2 ngày làm việc, `biz_type` = thuộc tính định danh app. **Chưa confirm
  chắc** (đánh dấu ❓ ở "Câu hỏi mở"): cú pháp biến cho free-template app-notification, có bắt buộc
  đăng ký device token để giao như system push không, rate limit, i18n title/content, giá gói.

---

## TL;DR (cho người sắp code)
- Tuya **có sẵn** Cloud API gửi push tới app user → **không cần dựng Firebase riêng**. Backend chỉ
  thêm 1 service + DTO gọi qua [`TuyaCloudService`](../../apps/backend/src/tuya/tuya-cloud.service.ts) (đã ký HMAC + access_token).
- Cơ chế **template-based**, KHÔNG free-text lúc gửi: (1) **tạo template** (title/content có biến
  `${var}`) → (2) Tuya **duyệt nội dung ≤2 ngày làm việc** → (3) **gửi** bằng `template_id` +
  `template_param` (JSON điền biến), target theo **`uid`**.
- `biz_type` **không phải** loại tin — là **mã định danh app** (OEM/App SDK) trong hệ Tuya; lấy từ
  Cloud Platform sau khi subscribe. `type` của template mới là phân loại: **0 = operations**, **1 = system**.
- **Điều kiện cứng:** subscribe gói **"App Push Notification Service"** + **authorize API cho đúng
  Cloud Project** (project mà backend đang dùng access_id/secret).
- **Để user nhận được dưới dạng system push:** app vẫn phải đăng ký **FCM token (Android)/APNs
  deviceToken (iOS)** với Tuya SDK (việc của M3, chưa làm) — xem [note SDK](tuya-home-sdk-push-notifications.md).
  Dù chưa đăng ký token, tin **vẫn lưu** ở Message Center (đọc qua `IThingMessage`/`ThingSmartMessage`). ❓cần verify.

---

## Khái niệm & luồng

```
[Admin web] soạn/chọn template + nhập biến + chọn user(uid)
   → [Backend NestJS] POST /v1.0/iot-03/messages/app-notifications/actions/push
        (ký qua TuyaCloudService: client_id/access_token/sign)
   → [Tuya Cloud] resolve template_id + template_param → render title/content
   → đẩy qua kênh push của app:  Android = FCM,  iOS = APNs
        (dùng credential FCM/APNs đã up lên Tuya console)
   → [App] nhận RemoteMessage/APNs (nếu đã registerDevice token) + lưu Message Center
```

**Hai pha tách biệt:**
1. **Quản trị template** (làm 1 lần, ít thay đổi): tạo → chờ duyệt → có `template_id`. Hợp với các
   loại tin cố định của ice-bath: nhắc dọn nước, nhắc thay filter, cảnh báo nhiệt, thông báo bảo trì.
2. **Gửi runtime** (mỗi lần admin bấm gửi): chọn `template_id` + điền `template_param` + `uid`.

**Quan hệ với Message Center:** tin gửi qua API này nằm trong nhóm notice/notification của Message
Center; app đọc lịch sử qua `IThingMessage`(Android)/`ThingSmartMessage`(iOS). Push = giao realtime,
Message Center = lịch sử lưu. (Xem [note SDK](tuya-home-sdk-push-notifications.md).)

---

## API chính (Cloud OpenAPI, prefix `/v1.0/iot-03/...`)

| Method | Path | Mục đích |
|---|---|---|
| `POST` | `/messages/app-notifications/actions/push` | **Gửi** push tới 1 user (theo `uid`) |
| `POST` | `/msg-templates/app-notifications` | **Tạo** template (submit để duyệt) |
| `GET`  | `/msg-templates/app-notifications` | **Liệt kê** template |
| `GET`  | `/msg-templates/app-notifications/{template_id}` | **Chi tiết** 1 template (xem trạng thái duyệt) |

### 1) Gửi push — `POST /messages/app-notifications/actions/push`
**Request body:**
| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `uid` | String | ✅ | Tuya user id người nhận (vd `ay1528287200853*****`) |
| `biz_type` | Integer | ✅ | **Mã định danh app** trong hệ Tuya (vd `10`) — lấy từ Cloud Platform, KHÔNG phải loại tin |
| `template_id` | String | ✅ | ID template đã được duyệt (vd `PUSH_1616396456`) |
| `template_param` | String (JSON) | ✅ | JSON điền biến cho template, vd `"{\"code\":\"1234\"}"` |

```jsonc
// Request
{
  "uid": "ay1528287200853*****",
  "biz_type": 10,
  "template_id": "PUSH_1616396456",
  "template_param": "{\"code\":\"1234\"}"
}
// Response
{ "result": { "send_status": true }, "t": 1586153261345, "success": true }
```
- `send_status` (boolean): trạng thái đẩy tin. (Lưu ý: chỉ phản ánh **đẩy thành công**, không đảm bảo
  thiết bị đã hiển thị — phụ thuộc token/quyền/công tắc push phía app.)
- `template_param` phải là **chuỗi JSON đã escape**, không phải object lồng.

### 2) Tạo template — `POST /msg-templates/app-notifications`
**Request body:**
| Field | Type | Bắt buộc | Mô tả |
|---|---|---|---|
| `name` | String | ✅ | Tên template, 1–30 ký tự (nội bộ, không hiển thị cho user) |
| `title` | String | ✅ | **Tiêu đề** push, 1–40 ký tự (có thể chứa biến `${...}`) |
| `content` | String | ✅ | **Nội dung** push, 1–100 ký tự (có thể chứa biến `${...}`) |
| `type` | Integer | ✅ | Phân loại: **`0` = operations message** (vận hành/marketing) · **`1` = system message** (hệ thống) |
| `remark` | String | ✅ | Ghi chú mục đích dùng (cho khâu duyệt), 1–100 ký tự |

```jsonc
// Request
{
  "name": "Nhắc thay filter",
  "title": "Đã đến lúc thay bộ lọc",
  "content": "Bộ lọc của ${device} đã dùng ${days} ngày. Hãy kiểm tra & thay khi cần.",
  "type": 0,
  "remark": "Nhắc bảo trì định kỳ bộ lọc bồn đá"
}
// Response
{ "template_id": "PUSH_161639****" }
```
- Trả `template_id` = **đã submit để duyệt**, CHƯA dùng gửi ngay được.
- **Duyệt nội dung ≤ 2 ngày làm việc**; theo dõi trạng thái qua endpoint GET chi tiết (3).

### 3) Liệt kê / chi tiết template
- `GET /msg-templates/app-notifications` → danh sách template (id, trạng thái duyệt...).
- `GET /msg-templates/app-notifications/{template_id}` → chi tiết + **trạng thái duyệt** của 1 template.
  (Field chi tiết chưa fetch verbatim — ❓verify khi code; dùng để hiển thị "đã duyệt/đang chờ" ở admin.)

### Cú pháp biến (placeholder)
- Biến trong `title`/`content` dạng **`${tên_biến}`**; lúc gửi truyền `template_param` là JSON
  `{"tên_biến":"giá_trị"}`. Ví dụ chính thức: `content` chứa `${code}` ↔ `template_param`
  `{"code":"1234"}`. (Trang Configure Placeholders mô tả thêm `${dp**}`/`${device}` cho template
  cảnh báo thiết bị — đó là biến hệ thống map theo DP id; với app-notification tự tạo, dùng biến
  tự đặt như `${code}`.) ❓Xác minh ràng buộc tên biến tự đặt khi tạo template thật.

---

## Khác biệt iOS vs Android
- **Phía Cloud API: KHÔNG khác** — cùng 1 endpoint, target theo `uid` (không phân biệt nền tảng).
  Tuya tự chọn kênh giao theo thiết bị đã đăng ký của user.
- **Phía nhận (SDK/native):** Android nhận qua **FCM** (`FirebaseMessagingService.onMessageReceived`,
  phải tạo notification channel `tuya_*`), iOS qua **APNs** (cần Push capability + cert/APNs key).
  Chi tiết & chữ ký API đăng ký token: [tuya-home-sdk-push-notifications.md](tuya-home-sdk-push-notifications.md).

---

## Điều kiện tiên quyết & cấu hình
1. **Subscribe gói "App Push Notification Service"** trên Tuya Cloud Development Platform, và
   **authorize API cho đúng Cloud Project** (project chứa `TUYA_ACCESS_ID`/`SECRET` backend đang dùng —
   Data Center EU, khớp ràng buộc region của dự án).
2. **Lấy `biz_type` của app** (nhập khi subscribe official version) — cần để gọi `push`.
3. **Tạo + chờ duyệt template** (≤2 ngày làm việc) trước khi gửi.
4. **App đã đăng ký push token với Tuya** (FCM/APNs) để nhận dạng system push — phần M3, **chưa làm**.
   - Cần lib có **module push** (hiện mới là *đề xuất* `TuyaPush` trong [note SDK](tuya-home-sdk-push-notifications.md#L257), chưa code).
   - Cần cấu hình **FCM (Service account JSON, FCM HTTP v1)** + **APNs key/cert** trên Tuya console.
5. **Backend:** tái dùng [`TuyaCloudService.request()`](../../apps/backend/src/tuya/tuya-cloud.service.ts) —
   các endpoint này là business API IoT Core chuẩn, đã được ký sẵn (client_id/access_token/sign/nonce).

---

## Mã lỗi thường gặp & cách xử lý
- Trả về theo wrapper chuẩn `{success, code, msg, result}`; `TuyaCloudService` **đã throw** khi
  `success=false` (kèm `code`/`msg`). Không có bảng mã lỗi riêng cho push — dùng bảng chung:
  https://developer.tuya.com/en/docs/iot/error-code?id=K989ruxx88swc
- Tình huống nghi do cấu hình (không phải lỗi gọi API): **chưa subscribe/authorize** product →
  permission denied; **template chưa duyệt** → gửi fail; **sai `biz_type`/`uid`** → fail; **user
  chưa đăng ký token** → `send_status` có thể true nhưng thiết bị **không hiện** (chỉ vào Message Center).
- **FCM không tới** thường do console: thiếu Service account JSON / sai package name / thiếu
  notification channel — xem [note SDK](tuya-home-sdk-push-notifications.md) mục Cạm bẫy.

---

## Cạm bẫy / lưu ý cho dự án ice-bath
1. **Template phải duyệt trước (≤2 ngày)** → không thể để admin gõ tin tự do gửi-ngay. Thiết kế admin
   theo hướng **chọn template đã duyệt + điền biến**, không phải ô soạn free-text. Nếu cần free-text
   thì phải tạo trước template "thông báo chung" có 1 biến `${message}` và đẩy nội dung qua biến đó —
   ❓nhưng nội dung biến có bị review từng lần không thì cần xác minh (rủi ro lạm dụng → Tuya có thể chặn).
2. **`biz_type` ≠ loại tin.** Đừng nhầm với `type` (0 operations / 1 system) của template. Sai `biz_type`
   = không gửi được.
3. **Giới hạn độ dài:** title ≤40, content ≤100 ký tự — đếm theo ký tự, lưu ý tiếng Việt có dấu.
4. **`template_param` là chuỗi JSON đã escape**, không phải object — dễ sai khi build payload ở NestJS.
5. **Phụ thuộc token-registration của M3:** không có việc đăng ký FCM/APNs token thì coi như chỉ có
   "hộp thư" (Message Center), người dùng không nhận push thật. → Option A **không độc lập hoàn toàn**
   với M3; nên gộp chung lộ trình.
6. **Region/Project:** product push phải authorize đúng Cloud Project EU đang dùng; sai DC = không gọi được.
7. **Chi phí:** "App Push Notification Service" là **cloud product có thể tính phí** — cần kiểm tra gói/giá
   trước khi commit (ngân sách M1 đang phải ET lại).
8. **Quyền riêng tư & lạm dụng:** marketing (`type=0`) thường bị công tắc push "marketing" của user chặn;
   tin vận hành/cảnh báo nên cân nhắc `type` phù hợp để không bị user tắt nhầm.

---

## Câu hỏi mở / cần xác minh
- ❓**Token registration có bắt buộc để giao system push không**, hay Tuya tự fallback? Và hành vi khi
  user chưa đăng ký token (chỉ vào Message Center?). → verify trên thiết bị thật.
- ❓**Cú pháp & ràng buộc biến tự đặt** (`${...}`) cho app-notification template (vs biến hệ thống
  `${dp**}`); có phải khai báo danh sách biến khi tạo template không.
- ❓**Free-text qua biến `${message}`** có bị review từng lần gửi / có bị giới hạn không.
- ❓**Rate limit / QPS** của endpoint `push` (gửi hàng loạt nhiều user) — doc không nêu; cần test +
  thiết kế hàng đợi nếu broadcast.
- ❓**Gửi hàng loạt:** API nhận **1 `uid`/lần** → broadcast = loop N lần. Có endpoint batch không? (chưa thấy.)
- ❓**i18n:** title/content 1 ngôn ngữ hay đa ngôn ngữ theo locale user? (doc không nêu.)
- ❓**Field chi tiết** của GET template (trạng thái duyệt = enum gì) — fetch verbatim khi code admin.
- ❓**Giá** gói App Push Notification Service.

---

## Tận dụng được gì trong repo (cho bước /plan)
- ✅ [`TuyaCloudService`](../../apps/backend/src/tuya/tuya-cloud.service.ts) — gọi cả 4 endpoint, đã ký sẵn.
- ✅ [`AdminAuthGuard`](../../apps/backend/src/admin-auth/admin-auth.guard.ts) — bọc endpoint gửi push.
- ✅ Admin web đã có auth + danh sách user theo `uid` ([users/page.tsx](../../apps/admin/app/users/page.tsx)) → chọn người nhận.
- ✅ Pattern module NestJS (xem `users/`) để thêm `notifications/` (controller + service + DTO).
- ⛔ **Chưa có:** token-registration phía mobile (M3) + module `TuyaPush` trong lib + cấu hình FCM/APNs console + subscribe product + tạo template.

---

## Nguồn (URL đã đọc)
- Mobile Push Notification Service (mục lục) — https://developer.tuya.com/en/docs/cloud/app-push?id=Kaiuye3tb3yho
- Send Push Notifications to App — https://developer.tuya.com/en/docs/cloud/571df1f27e?id=Kagp27bb0hkxe
- Add a template of messages in notification center — https://developer.tuya.com/en/docs/cloud/db8cac79e4?id=Kagp29fdj4yse
- Get the list of templates — https://developer.tuya.com/en/docs/cloud/d42a2cefb7?id=Kaio7tuala794
- App Push Notification Subscription and Template — https://developer.tuya.com/en/docs/iot/app-push-notification?id=Kaiuyyn5po2kw
- Configure Placeholders — https://developer.tuya.com/en/docs/iot/message-push-Placeholder?id=Kby77w6kmpfdt
- (bổ trợ) Push Notification on Android — https://developer.tuya.com/en/docs/iot/message-push?id=Kaiuyrqqw6szg
- (bổ trợ, phía SDK nhận) [tuya-home-sdk-push-notifications.md](tuya-home-sdk-push-notifications.md)
</content>
</invoke>