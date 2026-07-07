# Tuya Research: Cloud OpenAPI - request signing (HMAC-SHA256) + token + endpoints

- **Ngày:** 2026-06-28 · Dùng cho: `m1-backend-scaffold` (TuyaModule, B4)
- **Nguồn chính:**
  - Sign Requests for Cloud Authorization - https://developer.tuya.com/en/docs/iot/new-singnature?id=Kbw0q34cs2e5g
  - Request Structure / endpoints - https://developer.tuya.com/en/docs/iot/api-request?id=Ka4a8uuo1j4t4
  - Get Token - https://developer.tuya.com/en/docs/cloud/6c1636a9bd?id=Ka7kjumkoa53v

## TL;DR (cho người sắp code B4)
1. **Cloud OpenAPI dùng Access ID (`client_id`) + Access Secret (`secret`)** của **Cloud Project** - KHÁC AppKey/AppSecret của App SDK mobile.
2. **2 kiểu ký:**
   - **Token request:** `str = client_id + t + nonce + stringToSign`
   - **Business request:** `str = client_id + access_token + t + nonce + stringToSign`
   - `sign = UPPERCASE(HMAC_SHA256(str, secret))` (hex hoa).
3. **`stringToSign = METHOD + "\n" + Content-SHA256 + "\n" + Signature-Headers + "\n" + URL`**.
   - `Content-SHA256` = `SHA256(body)` hex; **body rỗng** = `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.
   - `Signature-Headers` = các header tự chọn liệt kê ở field `Signature-Headers` (định dạng `key:value\n`); **thường để rỗng** (ta không dùng) → phần này là chuỗi rỗng.
   - `URL` = path + query **sort theo alphabet** (vd `/v1.0/token?grant_type=1`).
4. **Headers bắt buộc:** `client_id`, `sign`, `sign_method: HMAC-SHA256`, `t` (timestamp **13 chữ số**, ms), `access_token` (chỉ business), `nonce` (UUID, optional nhưng nếu gửi thì PHẢI cho vào `str`).
5. **Endpoint theo Data Center** (phải khớp DC của Cloud Project):
   | DC | Endpoint |
   |---|---|
   | China | `https://openapi.tuyacn.com` |
   | Western America | `https://openapi.tuyaus.com` |
   | Eastern America | `https://openapi-ueaz.tuyaus.com` |
   | **Central Europe** | `https://openapi.tuyaeu.com` |
   | **Western Europe** | `https://openapi-weaz.tuyaeu.com` |
   | India | `https://openapi.tuyain.com` |
   | Singapore | `https://openapi-sg.iotbing.com` |
   > ⚠️ **EU "Western Europe" = `openapi-weaz.tuyaeu.com`**, KHÁC Central Europe `openapi.tuyaeu.com`.
   > Phải khớp DC thực tế của Cloud Project (xem [tuya-m1-sdk-foundation.md](tuya-m1-sdk-foundation.md): Western Europe ra mắt 2025-11-25). → để endpoint ở **env**, không hardcode.

## Lấy token
- **`GET /v1.0/token?grant_type=1`** (ký theo kiểu **token request**, KHÔNG có access_token).
- Response (chuẩn Tuya): `result.access_token`, `result.expire_time` (giây), `result.refresh_token`, `result.uid`; top-level `success`, `t`. → cache token, refresh trước khi hết hạn (vd refresh khi còn < 60s).
- Refresh: `GET /v1.0/token/{refresh_token}` (ký token-style). (Đơn giản nhất: lấy token mới khi gần hết hạn.)

## Pseudo-code ký (Node)
```
t = Date.now().toString()              // 13 digits
nonce = uuidv4()                       // optional; nếu dùng thì cho vào str + header
contentSha256 = sha256hex(body || "")  // body rỗng → hằng số e3b0...855
stringToSign = method.toUpperCase() + "\n" + contentSha256 + "\n" + "" + "\n" + urlWithSortedQuery
// token:    str = client_id + t + nonce + stringToSign
// business: str = client_id + access_token + t + nonce + stringToSign
sign = HMAC_SHA256(str, secret).toString("hex").toUpperCase()
headers = { client_id, sign, t, sign_method: "HMAC-SHA256", nonce, [access_token] }
```

## Cạm bẫy / lưu ý cho dự án
- **Sai DC endpoint** ⇒ token/biz fail (giống cạm bẫy App SDK). Để `TUYA_OPENAPI_ENDPOINT` ở env.
- **Sort query params alphabet** trong URL khi ký (nếu có nhiều param).
- **`t` 13 chữ số (ms)**; lệch giờ server nhiều có thể bị từ chối.
- **nonce**: nếu gửi header thì BẮT BUỘC nằm trong `str` (token lẫn business). Nếu không dùng nonce thì bỏ cả 2 chỗ cho nhất quán - nhưng doc khuyến nghị có nonce.
- **`access_token` chỉ cho business**, không đưa vào token-request sign.
- **Unit test ký**: tự test tính ổn định + 1 vector dựng tay; xác nhận cuối cùng bằng **gọi `/v1.0/token` thật** khi có Access ID/Secret.

## Câu hỏi mở / cần xác minh
- **DC thực tế của Cloud Project** (Central vs Western Europe) → quyết endpoint.
- Có bật **nonce** không (chốt: có, dùng UUID v4).
- Refresh-token flow chính xác (endpoint `/v1.0/token/{refresh_token}`) - verify khi có creds.

## Nguồn (URL đã đọc)
- https://developer.tuya.com/en/docs/iot/new-singnature?id=Kbw0q34cs2e5g
- https://developer.tuya.com/en/docs/iot/api-request?id=Ka4a8uuo1j4t4
- https://developer.tuya.com/en/docs/iot/singnature?id=Ka43a5mtx1gsc
- Get Token (cloud) - https://developer.tuya.com/en/docs/cloud/6c1636a9bd?id=Ka7kjumkoa53v
