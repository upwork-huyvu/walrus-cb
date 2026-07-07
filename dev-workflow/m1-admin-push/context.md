# Context: Admin gửi thông báo tới user qua Tuya Cloud App Push (Option A)

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.
> Append theo thời gian, đừng xoá lịch sử (trừ khi sai thì gạch đi + ghi lý do).

- **Slug:** `m1-admin-push`

## Quyết định kỹ thuật (Decision log)
> Mỗi quyết định: chọn gì + vì sao + phương án đã loại.

- **2026-06-30** - Chọn **Option A: Tuya Cloud App Push API** thay vì tự dựng Firebase/FCM riêng (Option B).
  Lý do: tận dụng được `TuyaCloudService` (đã ký HMAC + access_token), `AdminAuthGuard`, admin web auth +
  danh sách user theo `uid` → backend/admin gần như reuse trọn vẹn; dùng chung kênh push với cảnh báo thiết bị;
  tin vào luôn Message Center. Đã cân nhắc & loại Option B (own Firebase project + `firebase-admin` + bảng
  device_tokens + compose UI free-text): nhiều việc mới, 2 stack push song song, phải tự quản vòng đời token.
- **2026-06-30** - Tách track: **làm backend/admin trước** (không cần máy build/thiết bị); mobile token-registration
  + cấu hình console gộp vào **M3 (`m3-push-fcm`)**. Lý do: backend/admin chạy độc lập được; mobile đang bị chặn
  bởi JDK17/Android SDK/thiết bị (xem INDEX).
- **2026-06-30** - `biz_type` đưa vào **config (`TUYA_APP_BIZ_TYPE`)**, không hardcode. Lý do: là định danh app,
  khác giữa môi trường; lấy từ Cloud Platform sau khi subscribe.
- **2026-06-30** - **Tự tạo `apps/admin/lib/api.ts`** trong feature này (divergence so với plan: plan giả định REUSE
  nhưng file KHÔNG tồn tại - sibling `m1-admin-web` tham chiếu `@/lib/api` mà chưa tạo). Lý do: feature cần + vá luôn
  cho `users/page.tsx`+`actions.ts` đang import.
- **2026-06-30** - **User chốt: vá luôn `lib/auth.ts` + làm B6.** → Tạo `apps/admin/lib/auth.ts` (login gọi backend
  `POST /admin/auth/login` → set cookie `admin_token`=access_token httpOnly; logout xoá cookie). Tối thiểu để gỡ
  blocker build (vốn thuộc `m1-admin-web` - nếu họ làm khác thì hợp nhất sau). B6: trang `notifications/templates`
  (list trạng thái duyệt + form tạo template). Sau đó **mọi import `@/...` của admin đều resolve** (grep xác nhận).

- **2026-07-03 - Rev 2, OPTION A (user chốt):** bỏ kênh **FCM trực tiếp** (backend firebase-admin +
  PushToken + /push-tokens) → thuần **Tuya App Push**: Tuya = sender đẩy banner qua cert FCM/APNs đã up
  console; app đăng ký token với Tuya (`registerDevice(token,'fcm')`). Lý do: 1 đường gửi, bớt secret/DB;
  đổi lại mất deep-link data khi tap + mọi tin qua template duyệt. **biz_type bỏ env** - lookup runtime
  `GET /v1.0/apps/{schema}` → `app_biz_type ?? appBizType` (doc field/example lệch casing) + cache;
  env `TUYA_APP_BIZ_TYPE` giữ làm override. Template status enum chốt: 0 đang duyệt/1 pass/2 fail (+verify_reason).

## Bản đồ file/module
> Những file/module quan trọng của feature này nằm đâu, làm gì.

| File / Module | Vai trò |
|---|---|
| `apps/backend/src/tuya/tuya-cloud.service.ts` | **REUSE** - client Tuya Cloud OpenAPI đã ký (gọi cả 4 endpoint push/template) |
| `apps/backend/src/admin-auth/admin-auth.guard.ts` | **REUSE** - bọc controller notifications |
| `apps/backend/src/config/env.validation.ts` | Thêm `TUYA_APP_BIZ_TYPE` |
| `apps/backend/src/notifications/` | **MỚI** - controller + service + dto + types (gửi push + quản lý template) |
| `apps/backend/src/app.module.ts` | Thêm `NotificationsModule` |
| `apps/admin/lib/api.ts` | **TỰ TẠO** - `apiGet`/`apiFetch` (server-only, base `API_BASE_URL` + Bearer `admin_token`) |
| `apps/admin/app/notifications/page.tsx` | **MỚI** - server: load template → render `SendPushForm` |
| `apps/admin/app/notifications/actions.ts` | **MỚI** - server action `sendPushAction` (FormData → POST `/notifications/push`) |
| `apps/admin/app/notifications/layout.tsx` | **MỚI** - shell + nav (mirror users layout; import `@/lib/auth` logout) |
| `apps/admin/components/SendPushForm.tsx` | **MỚI** - client: chọn template + parse `${var}` → input động + gửi |
| `apps/admin/proxy.ts` | **SỬA** - matcher + redirect bảo vệ `/notifications/:path*` |
| `apps/admin/app/users/layout.tsx` | **SỬA** - thêm nav link sang `/notifications` |
| `apps/admin/app/users/page.tsx` | Tham chiếu - nguồn `uid` để chọn người nhận |

## API Tuya dùng (từ research)
| Method | Path | Dùng cho |
|---|---|---|
| `POST` | `/v1.0/iot-03/messages/app-notifications/actions/push` | gửi (`uid`, `biz_type`, `template_id`, `template_param`) |
| `POST` | `/v1.0/iot-03/msg-templates/app-notifications` | tạo template (`name/title/content/type/remark`) |
| `GET`  | `/v1.0/iot-03/msg-templates/app-notifications` | list template |
| `GET`  | `/v1.0/iot-03/msg-templates/app-notifications/{template_id}` | chi tiết + trạng thái duyệt |

## Phát hiện & cạm bẫy (Findings / Gotchas)
- `template_param` là **chuỗi JSON đã escape** (vd `"{\"code\":\"1234\"}"`), KHÔNG phải object → backend phải
  `JSON.stringify(params)` trước khi đặt vào body.
- `biz_type` ≠ loại tin. Loại tin là `type` của template (`0` operations / `1` system).
- Biến trong title/content dạng **`${var}`**; `template_param` map `{"var":"giá trị"}`.
- `TuyaCloudService.request()` **đã throw** khi `success=false` (kèm `code`/`msg`) → controller chỉ cần để lỗi
  nổi lên (hoặc map sang HTTP phù hợp).
- Tin chỉ thật-sự "nổ push" khi app đã **đăng ký token** (M3); nếu chưa, chỉ vào Message Center → AC6 phụ thuộc M3.
- ⚠️ **Admin app thiếu cả thư mục `apps/admin/lib/`**: `@/lib/api` (đã tự tạo trong feature này) **và** `@/lib/auth`
  (login/logout - login page + users/notifications layout đang import) **đều thiếu**. → Admin **chưa build được**
  cho tới khi `m1-admin-web` bổ sung `lib/auth.ts`. Đây là **blocker ngoài scope** feature này (chỉ flag, không tự sửa).
- `npm install` (backend & admin) **chặn bởi E503** từ registry nội bộ `nexus.digital.vn` → `tsc`/`jest`/`next build`
  không chạy được tại chỗ → review tay (như các feature khác trong INDEX).

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [docs/research/tuya-cloud-app-push.md](../../docs/research/tuya-cloud-app-push.md) ·
  [docs/research/tuya-home-sdk-push-notifications.md](../../docs/research/tuya-home-sdk-push-notifications.md) ·
  [docs/research/tuya-push-template-approval.md](../../docs/research/tuya-push-template-approval.md) (04/07 - vì sao template phải chờ duyệt, status 0/1/2, chiến thuật nộp sớm)
- Báo cáo audit liên quan: [docs/audit/2026-06-30-m1-admin-push.md](../../docs/audit/2026-06-30-m1-admin-push.md)
  (0🔴 0🟠 3🟡 6🔵) · [docs/audit/2026-06-29-admin.md](../../docs/audit/2026-06-29-admin.md)
  - **Follow-up từ audit (feed /fix-plan khi xử lý):** M-1 timeout `TuyaCloudService` · M-3 `apiGet` 401→`/login` ·
    M-2 exception filter map lỗi Tuya · L-1 `forbidNonWhitelisted` · L-2 validate `params` string · L-3 hạ log uid ·
    L-4/L-6 phân trang+map output template · L-5 `TUYA_APP_BIZ_TYPE` prod-required. Nhiều mục **cross-cutting**
    (M-1/M-2/M-3/L-1 lợi toàn backend/admin) → cân nhắc gom vào feature dọn dẹp chung thay vì chỉ feature này.

## Tóm tắt khi hoàn thành (điền lúc FINISH)
<2-4 câu: feature làm được gì, còn nợ gì, cần theo dõi gì về sau.>
</content>
