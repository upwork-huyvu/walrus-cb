# Tuya Research: Điều khiển thiết bị qua Cloud OpenAPI (status / specification / commands)

- Ngày: 2026-07-25 · Cho feature `m1-admin-device-mgmt` (admin điều khiển thiết bị qua backend)
- Nguồn chính:
  - Device Control overview — https://developer.tuya.com/en/docs/cloud/device-control?id=K95zu01ksols7
  - Get device status — https://developer.tuya.com/en/docs/cloud/1ef1a3044b?id=Kconf2usgnfwo
  - Get specifications & properties — https://developer.tuya.com/en/docs/cloud/68c2e82f73?id=Kag2ybtxwlb9w
  - Send commands — https://developer.tuya.com/en/docs/cloud/e2512fb901?id=Kag2yag3tiqn5

## TL;DR (cho người sắp code)

- **4 endpoint cần dùng** (đều ký qua `TuyaCloudService.request()` sẵn có):
  - `GET /v1.0/users/{uid}/devices` — list thiết bị theo user (**đã wired** ở backend).
  - `GET /v1.0/devices/{device_id}/status` — DP hiện tại `[{code, value}]`.
  - `GET /v1.0/devices/{device_id}/specifications` — instruction set + status set (kiểu + biên DP).
  - `POST /v1.0/devices/{device_id}/commands` — gửi lệnh `{commands:[{code, value}]}`.
- **Điều khiển = `code` (không phải dpId).** Cloud API dùng **standard instruction code** (`switch_led`,
  `setting_temp`…), khớp đúng `code` mình đã map ở [tuya-icebath-dp-mapping.md](tuya-icebath-dp-mapping.md).
- **🔑 Raw DP qua Cloud = BASE64** (App SDK dùng hex). Ví dụ chính thức: `{code:"phase_a",
  value:"COkAABUAAAU="}`. ⇒ `setting_temp` (DP115) gửi qua cloud phải là **base64 của 16 byte**,
  KHÔNG phải hex như bên mobile.
- **`values` trong specification là chuỗi JSON** (vd `"{}"` cho bool; numeric chứa min/max/scale/step/unit).
- Có bản `iot-03` cho cả 3 endpoint device-centric (`/v1.0/iot-03/devices/{id}/{status|specification|commands}`).
  Chọn **bản `/v1.0/devices/...`** cho đồng bộ với `/v1.0/users/{uid}/devices` đang dùng; nếu 1 endpoint
  báo thiếu quyền thì thử bản iot-03 (khác API product authorize).

## API chính

| Việc | Method + Path | Params | Trả về |
|---|---|---|---|
| List theo user | `GET /v1.0/users/{uid}/devices` | uid | `[{id,name,online,product_id,...}]` |
| Status | `GET /v1.0/devices/{id}/status` | id | `result: [{code, value}]` |
| Specification | `GET /v1.0/devices/{id}/specifications` | id | `result: {category, functions[], status[]}` |
| Send command | `POST /v1.0/devices/{id}/commands` | id + body | `result: true/false` |

### Status — `GET /v1.0/devices/{id}/status`

```json
{ "result": [
    { "code": "switch_led", "value": true },
    { "code": "work_mode", "value": "scene_2" }
  ], "t": 1591872112140, "success": true }
```
`result` = mảng `{code, value}` — chính là DP hiện tại nhưng **theo code**. Map sang model bằng
`code` (currentTemp=`sensor_1`, target=`setting_temp`, power=`setting_pwr`, light=`setting_4`,
purify=`setting_clr`, fault=`fault`).

### Specification — `GET /v1.0/devices/{id}/specifications`

`result.functions[]` (DP ghi được) và `result.status[]` (DP đọc được), mỗi entry:
```json
{ "code": "switch", "type": "Boolean", "name": "Switch", "values": "{}" , "desc": "{}" }
```
- `type` ∈ `Boolean | Integer | Enum | String | Raw | Bitmap | Json`.
- **`values` là CHUỖI JSON** (phải `JSON.parse` lần nữa). Với `Integer` chứa
  `{"min":..,"max":..,"scale":..,"step":..,"unit":".."}`; với `Enum` chứa `{"range":[..]}`.
- Đây là nguồn để **resolve DP code + kiểu** (tương đương `schemaJson` bên mobile) → biết DP nào `Raw`
  để encode base64, DP nào `Integer` để ÷scale.

### Send commands — `POST /v1.0/devices/{id}/commands`

```json
{ "commands": [ { "code": "switch_led", "value": true }, { "code": "bright", "value": 30 } ] }
```
`result` = boolean. **Lưu ý:** `result:true` = "đã nhận lệnh", không đảm bảo thiết bị đã đổi xong
(giống cạm bẫy App SDK). Muốn chắc thì đọc lại `status` sau đó.

## Mã hoá `value` theo kiểu DP (Cloud)

| Kiểu (spec `type`) | `value` gửi trong command | Ghi chú |
|---|---|---|
| Boolean | `true` / `false` (bool thật) | power/light/purify |
| Integer (value) | **số nguyên RAW** (đã nhân 10^scale) | vd 4.0°C scale1 → `40` |
| Enum | chuỗi (1 giá trị trong `range`) | — |
| String | chuỗi | — |
| **Raw** | **chuỗi BASE64** của mảng byte | ⚠️ KHÁC App SDK (hex) |

### Ghi `setting_temp` (DP115, Raw) qua Cloud — quy trình an toàn

DP115 là mảng 16 byte (8 word 16-bit big-endian, word0 = setpoint °C sensor1 — xem
[tuya-icebath-dp-mapping.md](tuya-icebath-dp-mapping.md)). Để đổi target mà không phá các word khác:

1. `GET /status` → lấy `setting_temp` hiện tại (**giả định base64** — xem Câu hỏi mở).
2. base64 → 16 byte → ghi đè **word0** = `Math.round(targetC * 10)` big-endian, giữ nguyên byte còn lại.
3. 16 byte → base64.
4. `POST /commands` với `{code:"setting_temp", value:"<base64>"}`.

Không đọc được raw hiện tại ⇒ **KHÔNG ghi** (gửi thiếu byte có thể phá mảng firmware) → chặn đổi target,
chỉ cho công tắc.

## Điều kiện tiên quyết & cấu hình

- **API product phải authorize vào Cloud Project.** Endpoint user-centric (`/users/.../devices`) đang chạy
  ⇒ project đã có "Device Management"/"IoT Core". Endpoint **device-centric** (`/devices/{id}/*`) có thể
  cần thêm sản phẩm được cấp quyền — nếu `GET /status` trả `code=1106 permission deny` thì vào console →
  Cloud → project → **Service API** → authorize "IoT Core" / "Device Status Notification".
- **DC endpoint** vẫn là `TUYA_OPENAPI_ENDPOINT` (Western Europe) — không đổi.
- **Secret** (`TUYA_ACCESS_SECRET`) chỉ ở backend; admin web gọi backend admin-guarded.

## Mã lỗi thường gặp & xử lý

| Tình huống | Biểu hiện | Xử lý |
|---|---|---|
| Thiết bị offline | `commands` trả false / `status` cũ | UI chặn gửi khi `online=false`, báo rõ |
| Thiếu quyền API | code `1106`/`permission deny` | authorize API product vào project |
| Token hết hạn | code `1010`/`token invalid` | `TuyaTokenService` tự refresh (đã có) |
| Sai code DP | `result:false` / lỗi param | resolve code từ specification, đừng hardcode |

## Cạm bẫy / lưu ý cho dự án

1. **Raw = base64 ở Cloud, hex ở App SDK.** Codec backend viết MỚI, tuyệt đối không bê `mobile/dp.ts`.
2. **`values` là chuỗi JSON lồng** — parse 2 lần.
3. **`result:true` ≠ thiết bị đã đổi** — đọc lại status để xác nhận (như `publishDpsAwaitAck` bên mobile).
4. **`online` lấy từ đâu:** list `/users/{uid}/devices` có `online`; hoặc `GET /v1.0/devices/{id}` (detail).
   Trạng thái online cloud có thể trễ như bên mobile.

## Câu hỏi mở / cần xác minh trên thiết bị (device đang OFFLINE)

| # | Câu hỏi | Cách xác minh |
|---|---|---|
| Q1 | `status` trả `setting_temp` (Raw) ở dạng **base64** hay hex? | Bật máy online → `GET /status`, xem value |
| Q2 | `setting_temp` trong `functions` có khai `values` (biên) không, hay rỗng `{}`? | đọc `GET /specifications` |
| Q3 | Gửi command raw base64 → firmware nhận đúng word0? | `POST /commands` rồi đọc lại status |
| Q4 | Endpoint device-centric có cần authorize thêm API product? | gọi thử `GET /status`, xem code lỗi |

> Decoder ở B2 phải **chịu cả base64 lẫn hex** cho Raw-trong-status (thử base64 trước, fallback hex) tới
> khi Q1 chốt trên máy thật.

## Nguồn (đầy đủ URL đã đọc)

- [Device Control overview](https://developer.tuya.com/en/docs/cloud/device-control?id=K95zu01ksols7) — danh sách endpoint (functions/specifications/status/commands)
- [Get the status of a single device](https://developer.tuya.com/en/docs/cloud/1ef1a3044b?id=Kconf2usgnfwo) — `GET .../status`, `result:[{code,value}]`
- [Get the specifications and properties of the device](https://developer.tuya.com/en/docs/cloud/68c2e82f73?id=Kag2ybtxwlb9w) — `functions[]`/`status[]`, `type`, `values` (chuỗi JSON)
- [Send commands](https://developer.tuya.com/en/docs/cloud/e2512fb901?id=Kag2yag3tiqn5) — `POST .../commands`, `{commands:[{code,value}]}`
- [Get the instruction set of the device](https://developer.tuya.com/en/docs/cloud/3ac29198c9?id=Kag2ybepz3arq) — instruction set = `code` để gửi
- Raw=base64: xác nhận qua ví dụ chính thức `{code:"phase_a", value:"COkAABUAAAU="}` (Device Control /
  data-transmission docs) + [tuya-home-sdk-device-control.md](tuya-home-sdk-device-control.md) (App SDK dùng hex — đối chiếu)
- Nội bộ: [tuya-cloud-openapi-signing.md](tuya-cloud-openapi-signing.md) (ký request), [tuya-icebath-dp-mapping.md](tuya-icebath-dp-mapping.md) (DP mapping bồn)
