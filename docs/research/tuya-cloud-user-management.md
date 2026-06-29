# Tuya Research: Cloud OpenAPI — User Management (list / info / pre-delete / delete)

- **Ngày:** 2026-06-28 · Dùng cho: `m1-backend-user-mgmt` (C2)
- **Nguồn chính:**
  - Get User List — https://developer.tuya.com/en/docs/cloud/76f3e0885f?id=Kawfji9n0sdmq
  - Get User Information — https://developer.tuya.com/en/docs/cloud/cfebf22ad3?id=Kawfjdgic5c0w
  - Pre-delete the user account — https://developer.tuya.com/en/docs/cloud/bbd768f1a4?id=Kawfjirpecmr9
  - Delete User — https://developer.tuya.com/en/docs/cloud/bfdec5ab86?id=Kag2ylnemst3v
- **Tiền đề:** ký request theo [tuya-cloud-openapi-signing.md](tuya-cloud-openapi-signing.md) (business-sign, có access_token).

## TL;DR
1. **List user của app:** `GET /v2.0/apps/{schema}/users` — cần **`schema`** (channel id của App SDK) + `page_no`, `page_size` (**0–100**); optional `start_time`/`end_time` (10 chữ số), `username`.
2. **Chi tiết user:** `GET /v1.0/users/{uid}/infos`.
3. **Pre-delete (khớp brief "Tuya pre-delete"):** `POST /v1.0/users/{uid}/actions/pre-delete` → boolean. **Huỷ tài khoản có ân hạn 7 ngày** (huỷ-pre-delete được trong 7 ngày; quá hạn → xoá thật).
4. **Hard delete (tuỳ chọn):** `DELETE /v1.0/iot-02/users/{user_id}` → `{result: bool}`.

## API chi tiết
| Mục đích | Method + Path | Params | Trả về |
|---|---|---|---|
| List users | `GET /v2.0/apps/{schema}/users` | path `schema`; query `page_no`, `page_size`(0–100), `start_time?`, `end_time?`, `username?` | `result`: list `{uid, username, email, mobile, country_code, create_time, update_time}` + `total`, `has_more` |
| User info | `GET /v1.0/users/{uid}/infos` | path `uid` | `{uid, username, country_code, mobile, email, nick_name, avatar, create_time, update_time, user_properties[], time_zone_id, temp_unit}` |
| Pre-delete | `POST /v1.0/users/{uid}/actions/pre-delete` | path `uid` | boolean (true=ok) |
| Delete (hard) | `DELETE /v1.0/iot-02/users/{user_id}` | path `user_id` | `{result: bool}` |

> Tất cả ký **business-style** (client_id + access_token + t + nonce + stringToSign). `schema` = channel của App SDK (đặt ở env `TUYA_APP_SCHEMA`).

## Luồng xoá user (theo brief: pre-delete + xoá business data)
1. `POST .../actions/pre-delete` (Tuya) — đặt lịch xoá (ân hạn 7 ngày).
2. Xoá **business data** ở Supabase liên quan uid (vd `device_mappings`).
3. Ghi `delete_jobs` (pending→done). Nếu (1) hoặc (2) lỗi → giữ job **pending** + tăng `attempts` + `lastError` → **cron retry** (Vercel Cron, vì `@nestjs/schedule` không chạy serverless).
- *Hard delete* (`DELETE /v1.0/iot-02/users/{uid}`) để xoá ngay — tuỳ chọn, dùng khi cần (không phải mặc định theo brief).

## Cạm bẫy / lưu ý
- **`schema`** bắt buộc cho list — sai schema = không ra user. Để env.
- **`page_size` tối đa 100** → phân trang bằng `has_more` + `page_no`.
- **Pre-delete có ân hạn 7 ngày** → user "đã xoá" ở app ta nhưng Tuya vẫn giữ tới 7 ngày (huỷ được). UI admin nên hiểu điều này.
- Endpoint theo **DC** (giống signing note) — Western Europe `openapi-weaz.tuyaeu.com`.
- **Lệch pha 2 hệ thống**: nếu Tuya pre-delete OK mà Supabase lỗi (hoặc ngược lại) → `delete_jobs` retry để hội tụ.

## Câu hỏi mở / cần xác minh (khi có creds)
- **`schema`** thực tế của App SDK (lấy ở Tuya console).
- Mặc định dùng **pre-delete** (ân hạn 7 ngày) hay **hard delete** ngay? (chốt tạm: pre-delete theo brief).
- Response wrapper chuẩn `{success, result, code, msg, t}` — verify field khi gọi thật.

## Nguồn
- https://developer.tuya.com/en/docs/cloud/76f3e0885f?id=Kawfji9n0sdmq
- https://developer.tuya.com/en/docs/cloud/cfebf22ad3?id=Kawfjdgic5c0w
- https://developer.tuya.com/en/docs/cloud/bbd768f1a4?id=Kawfjirpecmr9
- https://developer.tuya.com/en/docs/cloud/bfdec5ab86?id=Kag2ylnemst3v
- User Management (tổng) — https://developer.tuya.com/en/docs/cloud/user-management?id=K95ztzvgwnshy
