# Tuya Research: Vì sao template App Push phải chờ Tuya duyệt

- **Ngày:** 2026-07-04 · **Loại:** quy trình duyệt của Tuya **Cloud OpenAPI - App Push Notification**
  (bổ sung cho [tuya-cloud-app-push.md](tuya-cloud-app-push.md); không phải App SDK).
- **Câu hỏi gốc:** tạo template push (admin `/notifications/templates`) thì thấy trạng thái chờ duyệt -
  có bắt buộc không, duyệt mất bao lâu, có cách nào gửi free-form không cần chờ duyệt không?
- **Nguồn chính:**
  - App Push Notification Subscription and Template - https://developer.tuya.com/en/docs/iot/app-push-notification?id=Kaiuyyn5po2kw
  - Add a template of messages in notification center - https://developer.tuya.com/en/docs/cloud/db8cac79e4?id=Kagp29fdj4yse
  - Get the list of templates - https://developer.tuya.com/en/docs/cloud/d42a2cefb7?id=Kaio7tuala794
  - Configure Push Notification (alarm thiết bị, console) - https://developer.tuya.com/en/docs/iot/alarm?id=K93ixsmlff32o
- **Độ tin cậy:** các trích dẫn "ensure legality", "two working days", enum `status` 0/1/2, điều kiện
  auto-approve đều fetch trực tiếp từ trang official. Phần **diễn giải lý do** (mô hình trách nhiệm kênh)
  được đánh dấu riêng - doc Tuya không giải thích dài hơn câu "ensure legality".

---

## TL;DR

1. **Có, bắt buộc - không né được trong sản phẩm App Push.** Mọi template app-notification (tạo qua API
   `POST /msg-templates/app-notifications` hay qua console API Explorer) đều vào hàng **duyệt nội dung**:
   nguyên văn *"We will review the message push content to ensure legality"* và *"complete the review
   **within two working days**"*. Không tồn tại endpoint gửi title/content tự do không qua template.
2. **Vì sao (diễn giải):** push đi qua **hạ tầng message của Tuya** và credential FCM/APNs mà mình upload
   lên **console của Tuya** - tức về mặt vận hành/pháp lý, Tuya là nhà cung cấp kênh gửi. Họ duyệt để
   chống spam/lừa đảo/nội dung phạm luật trên kênh của họ - đúng mô hình duyệt template SMS của nhà mạng.
   Bằng chứng gián tiếp: SMS/email template của Tuya cũng có cùng cơ chế (`verify_code`/`verify_reason`
   trong API chi tiết template SMS/email - xem Nguồn).
3. **Theo dõi trạng thái:** field `status` của template - **`0` = Review in progress · `1` = Passed ·
   `2` = Failed**; khi rớt (`status=2`), endpoint **chi tiết** trả thêm `verify_code`/`verify_reason`
   (lý do rớt). Backend + admin page của dự án **đã hiển thị đủ** (badge Pending/Approved/Rejected +
   verify_reason - làm ở REV 2, xem [progress.md](../../dev-workflow/m1-admin-push/progress.md)).
4. **Free-form không cần chờ duyệt từng tin: chính là cách dự án đang làm** - tạo **một** template khung
   có biến (vd title `${title}` / content `${message}`), chịu duyệt **một lần duy nhất**, sau đó
   `sendFreeForm()` đẩy nội dung qua `template_param`. Nội dung biến **không thấy doc nói bị duyệt lại**
   từng lần gửi. ⚠️ Nhưng đây là "khe" chính sách: template khung quá rỗng (toàn biến) có thể bị
   **reject ngay khâu duyệt**, hoặc bị xử lý nếu lạm dụng gửi nội dung sai mục đích khai trong `remark`.
5. **"Auto-approve" có tồn tại nhưng KHÔNG áp cho App Push API:** câu *"If you use a template recommended
   by Tuya and do not change the notification title and content, your notification is approved
   automatically"* thuộc trang **Configure Push Notification của alarm thiết bị** (console: Product
   Development → Device Notification, duyệt ~1 ngày) - sản phẩm khác, đừng nhầm.
6. **Cách duy nhất né duyệt hoàn toàn = tự vận hành FCM/APNs** (backend giữ token, gửi thẳng Firebase).
   Dự án **đã từng có** kênh này và **đã xoá ở REV 2** (03/07) để đổi lấy Message Center per-user +
   khỏi nuôi hạ tầng token. Đừng quay lại trừ khi khâu duyệt thành blocker thật sự.

---

## Khái niệm & luồng (vòng đời template)

```
[Admin/API] POST /v1.0/iot-03/msg-templates/app-notifications
      → template_id (đã submit, CHƯA dùng được)
      → status = 0 (Review in progress)   ← Tuya duyệt nội dung người thật, ≤ 2 ngày làm việc
           ├─→ status = 1 (Passed)  → dùng template_id để gửi push
           └─→ status = 2 (Failed)  → GET chi tiết đọc verify_code/verify_reason
                                       → sửa nội dung → TẠO TEMPLATE MỚI (❓doc không nói có API sửa/resubmit)
```

- Duyệt là **per-template, một lần** - không phải per-lần-gửi. Gửi runtime (`actions/push`) không có
  bước duyệt.
- `remark` (bắt buộc khi tạo) là **lời khai mục đích dùng cho người duyệt** - viết rõ ràng, khớp nội dung
  thật (đặc biệt với template khung free-form) để tăng cửa đậu.

## API liên quan & field trạng thái

| Method | Path | Vai trò trong khâu duyệt |
|---|---|---|
| `POST` | `/v1.0/iot-03/msg-templates/app-notifications` | Tạo = **submit để duyệt**; trả `template_id` ngay nhưng chưa gửi được |
| `GET` | `/v1.0/iot-03/msg-templates/app-notifications` | List: mỗi item có `status` **0/1/2** |
| `GET` | `/v1.0/iot-03/msg-templates/app-notifications/{template_id}` | Chi tiết: thêm `verify_code`/`verify_reason` khi `status=2` |
| `POST` | `/v1.0/iot-03/messages/app-notifications/actions/push` | Chỉ nhận `template_id` **đã duyệt** - không có biến thể free-text |

(Types backend đã khớp: [notifications.types.ts](../../apps/backend/src/notifications/notifications.types.ts)
`TuyaTemplateStatus = 0 | 1 | 2` + `verify_code`/`verify_reason`.)

## Khác biệt iOS vs Android
Không có - duyệt template nằm hoàn toàn phía Tuya Cloud, trước khi tin rẽ kênh FCM (Android) / APNs (iOS).

## Điều kiện tiên quyết & thời gian
- Phải **subscribe "App Push Notification Service"** + authorize đúng Cloud Project (đã làm 03/07 -
  console configured, xem progress.md).
- **SLA duyệt: ≤ 2 ngày làm việc** (nguyên văn "within two working days"). Ngày làm việc - cuối tuần /
  lễ (khả năng theo lịch TQ) không tính (diễn giải; doc không ghi múi giờ/lịch).
- Không có kênh "duyệt gấp" nào trong doc. Nếu kẹt quá SLA → ticket qua Tuya Service (console) hoặc
  sales support (doc bảo liên hệ sales cho việc tra `bizType` - cùng kênh đó hỏi được tiến độ duyệt).

## Mã lỗi / trạng thái thường gặp
- `status=2` (Failed) → đọc `verify_reason` ở endpoint chi tiết; sửa nội dung rồi tạo template mới.
- Gửi bằng template chưa duyệt / không tồn tại → request `actions/push` fail (wrapper `success=false`,
  `TuyaCloudService` throw kèm `code`/`msg` - không có bảng mã riêng cho push).
- Đậu duyệt nhưng user không nhận notification hệ thống → khả năng cao là chuyện **token registration**
  phía app (M3), không phải chuyện template - xem [tuya-home-sdk-push-notifications.md](tuya-home-sdk-push-notifications.md).

## Cạm bẫy / lưu ý cho dự án ice-bath
1. **Khâu duyệt đang nằm trên critical path của E2E test** (progress.md 04/07: "chờ template duyệt →
   gửi E2E"). → Tạo template khung free-form (`${title}`/`${message}`) **ngay hôm nay**, để 2 ngày chờ
   chạy song song với việc cài APK/verify token, khỏi chết chờ nối tiếp.
2. Nộp **một lượt** các template cố định đã hình dung (nhắc thay filter, cảnh báo nhiệt, bảo trì...)
   cùng template khung - duyệt chạy song song, khỏi trả phí thời gian nhiều đợt.
3. `remark` viết thật + khớp mục đích; template khung đừng để title/content 100% biến - thêm ngữ cảnh
   tĩnh (vd content `"[Walrus] ${message}"`) giảm rủi ro reject vì "nội dung rỗng".
4. Title ≤40 / content ≤100 ký tự - **tính cả phần biến sau khi thay giá trị?** ❓doc chỉ ràng độ dài
   template; độ dài sau render chưa thấy ràng buộc - admin nên tự giới hạn message để không bị cắt trên
   notification tray.
5. Đừng lẫn 3 sản phẩm push của Tuya: (a) **App Push API** (cái mình dùng - duyệt ≤2 ngày, không auto),
   (b) **alarm thiết bị** console (auto-approve nếu dùng template gợi ý - chỉ cho device notification),
   (c) **Operation push** console (marketing hàng loạt). Đọc nhầm doc của (b)/(c) sẽ tưởng có auto-approve.

## Câu hỏi mở / cần xác minh
- ❓Nội dung biến `template_param` có bị hậu kiểm/scan tự động không (doc im lặng) - theo dõi sau vài
  tuần gửi thật.
- ❓Có API **sửa/resubmit** template bị rớt không, hay bắt buộc tạo mới (doc chỉ có add/list/detail).
- ❓Thời gian duyệt **thực tế** với nội dung tiếng Việt (reviewer đọc được không / có chậm hơn SLA không)
  - ghi lại khi template đầu tiên được duyệt để lịch hoá các đợt sau.
- ❓`verify_code` có bảng mã ý nghĩa không (doc không liệt kê).

## Nguồn (URL đã đọc phiên này)
- App Push Notification Subscription and Template - https://developer.tuya.com/en/docs/iot/app-push-notification?id=Kaiuyyn5po2kw
- Add a template of messages in notification center - https://developer.tuya.com/en/docs/cloud/db8cac79e4?id=Kagp29fdj4yse
- Get the list of templates (enum `status` 0/1/2) - https://developer.tuya.com/en/docs/cloud/d42a2cefb7?id=Kaio7tuala794
- Configure Push Notification (alarm console - auto-approve, ~1 working day) - https://developer.tuya.com/en/docs/iot/alarm?id=K93ixsmlff32o
- Push Notification landing (không có nội dung duyệt) - https://developer.tuya.com/en/docs/iot/message-push?id=Kaiuyrqqw6szg
- (đối chiếu cơ chế verify chung) Query the details of the SMS template - https://developer.tuya.com/en/docs/cloud/5833d14935?id=Kaio7prffnwpi ·
  Query the details of the email template - https://developer.tuya.com/en/docs/cloud/1f3d7d6e0e?id=Kaio7oh7waakr
