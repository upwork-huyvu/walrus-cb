# Tuya Research: Xác thực user App SDK tới backend bên thứ ba (auth mobile→backend)

- **Ngày:** 2026-07-06 · **Loại:** kiến trúc auth (App SDK ↔ custom backend) - KHÔNG phải 1 API đơn lẻ.
- **Câu hỏi:** app đăng nhập bằng **tài khoản Tuya** (email/Google/Apple → `loginWithEmail`/`thirdLogin`). Làm sao
  backend (NestJS, KHÁC Tuya Cloud) biết chắc "request này của uid X" để bảo vệ `/me/*`, `/reminders/*` per-user?
- **Nguồn chính:**
  - OAuth 2.0 Authorization Flow - https://developer.tuya.com/en/docs/iot/authorization-code-page-usage?id=Kdkyz44dz6a7r
  - Login with UID (App SDK) - https://developer.tuya.com/en/docs/app-development/useruid?id=Ka6a99lybyr0k
  - Authentication Method (OAuth token exchange) - https://developer.tuya.com/en/docs/iot/authentication-method?id=Ka49gbaxjygox
  - Login with Third-Party Account - https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd
- **Độ tin cậy:** WebFetch tóm tắt bằng model nhỏ. **Kết luận chính (negative) confirm chắc**: không có API introspect
  session App SDK cho backend; OAuth code là web-consent; UID-login đòi backend làm IdP. Chi tiết param OAuth token
  (grant_type=2) chưa fetch verbatim từng field - đánh dấu ❓.

---

## TL;DR (cho người sắp code)
1. **Tuya KHÔNG có cách cho custom backend "verify session token của app đã login sẵn".** Không có endpoint
   introspect/validate session per-user cho bên thứ ba. → phải tự dựng lớp auth riêng cho kênh mobile→backend.
2. Tuya CÓ 2 cơ chế liên quan nhưng **đều không hợp** với hiện trạng (app dùng tài khoản Tuya):
   - **OAuth 2.0 authorization code**: user bấm đồng ý trên **trang H5 consent** → Tuya gửi `code` về callback →
     backend đổi `code` lấy token (grant_type=2). **Là web-consent, KHÔNG lấy code lập trình từ SDK** → không dùng
     để auth im lặng từng request được; hợp cho "link account 1 lần".
   - **Login with UID** (`loginOrRegisterWithUid(countryCode, uid, passwd, cb)`): pattern SaaS/Smart-Residence, ở đó
     **BACKEND CỦA BẠN là nguồn định danh** (backend sinh uid+passwd), app login Tuya QUA đó. → phải **đập đi làm lại
     toàn bộ auth** (hiện đang dùng tài khoản Tuya email/Google/Apple ở M1·B2). Không khả thi cho scope này.
3. **Best practice = thêm lớp auth riêng cho mobile→backend**, độc lập Tuya (Tuya vẫn lo IoT/thiết bị). Backend đã
   có **Supabase Auth** (dùng cho admin) → tái dùng: app lấy **Supabase JWT**, backend verify JWT, map
   **supabase_user ↔ tuya_uid**.
4. **Điểm khó cốt lõi (bootstrap trust):** để bind `tuya_uid` vào danh tính backend một cách ĐÁNG TIN, cần **1 lần
   khẳng định danh tính Tuya có kiểm chứng**. Nếu bỏ qua (chỉ để app "khai" uid) → lỗ hổng: user A (có phiên
   Supabase hợp lệ) khai uid của B → đọc trộm reminder/notification của B. → đây là **quyết định bảo mật/UX/công sức**
   phải chốt (mục "Phương án").

## Khái niệm & luồng
```
App (đăng nhập Tuya: uid + phiên Tuya)  ──?──►  Backend NestJS (cần biết uid nào gọi)
        │                                             │
   Tuya lo IoT/thiết bị                        Supabase Auth (đã có, cho admin)
```
Vấn đề: phiên Tuya KHÔNG chứng minh được với backend. Phải có kênh danh tính thứ 2 mà backend verify được.

## Phương án (chốt 1 trong 2)

### 🅰 Pragmatic - Supabase Auth layer (KHUYẾN NGHỊ cho dữ liệu độ nhạy vừa)
- App đăng nhập Supabase **song song** Tuya, tái dùng cùng danh tính:
  - **Google/Apple:** app đã có idToken (cho Tuya `thirdLogin`) → dùng CHÍNH idToken đó `signInWithIdToken` vào
    Supabase (Supabase hỗ trợ Google/Apple) → **không thêm UX**.
  - **Email/password:** đăng ký/đăng nhập Supabase bằng đúng email/password dùng cho Tuya (app tạo tài khoản
    Supabase song song lúc register).
- Backend verify **Supabase JWT** (đã có hạ tầng). Bind `tuya_uid` khi app cầm CẢ 2 phiên hợp lệ (endpoint bind bọc
  Supabase JWT; app khai uid). **Rủi ro còn lại:** khai uid không kiểm chứng tuyệt đối → user Supabase hợp lệ vẫn có
  thể khai uid người khác. Giảm thiểu: chỉ cho bind 1 uid/ supabase-user, rate limit, coi là chấp nhận được vì dữ
  liệu là filter-reminder + lịch sử noti (nhạy cảm VỪA, không phải thanh toán/y tế).
- Công sức: TB (thêm supabase-js vào mobile + dual sign-in + bảng map + guard verify JWT). **Dùng chung 2 feature.**

### 🅱 Hardened - OAuth consent 1 lần (mạnh hơn, UX nặng hơn)
- Lúc setup, user bấm đồng ý trên **trang H5 OAuth** của Tuya → Tuya gửi `code` về backend → backend đổi lấy token
  gắn ĐÚNG uid (grant_type=2) → **kiểm chứng thật uid** → backend cấp JWT dài hạn của mình cho các call sau.
- Ưu: bind uid ĐÁNG TIN (không lỗ hổng khai uid). Nhược: thêm 1 màn consent web + cấu hình callback URL + code
  backend nhiều hơn. ❓Cần verify: SDK có mở được H5 consent cho chính user đang login không (doc mô tả luồng web).

## Khác biệt iOS vs Android
- `loginOrRegisterWithUid` có ở cả 2 (doc nêu Android verbatim; iOS tương đương `ThingSmartUser` - ❓chưa fetch chữ ký iOS).
- Supabase Auth: dùng `@supabase/supabase-js` chung cả 2 nền tảng (RN). Không khác biệt native.

## Điều kiện tiên quyết & cấu hình
- Supabase project đã có (backend dùng). Cần: bật provider Google/Apple trên Supabase, `SUPABASE_ANON_KEY` cho mobile
  (public), bảng map `tuya_uid ↔ supabase_user_id`, backend verify JWT bằng Supabase JWKS/secret.
- Ràng buộc dự án: EU data residency (Supabase EU), secret server-only.

## Cạm bẫy / lưu ý cho dự án ice-bath
- **Đừng** đi hướng UID-login (`loginOrRegisterWithUid`) - nó lật ngược cả kiến trúc auth đã build (Tuya-account-first).
- OAuth code KHÔNG lấy được im lặng từ SDK → không dùng cho auth per-request; chỉ hợp bootstrap 1 lần (🅱).
- Bind uid là điểm tin cậy: 🅰 chấp nhận rủi ro khai-uid (mitigate rate-limit), 🅱 kiểm chứng thật.
- Nền auth này **DÙNG CHUNG** `m1-device-reminders` (guard B4) + `m1-notification-history` (`/me/*`).

## Câu hỏi mở / cần xác minh
- ❓Param chính xác OAuth token exchange (grant_type=2: client_id/secret/code) + token có trả uid không - fetch
  Authentication Method khi làm 🅱.
- ❓Supabase `signInWithIdToken` với Apple idToken (nonce) trên RN - verify khi code 🅰.
- ❓Chữ ký iOS `loginOrRegisterWithUid` (nếu sau này cân nhắc UID-login - hiện KHÔNG chọn).

## Nguồn (URL đã đọc)
- OAuth 2.0 Authorization Flow - https://developer.tuya.com/en/docs/iot/authorization-code-page-usage?id=Kdkyz44dz6a7r
- Login with UID - https://developer.tuya.com/en/docs/app-development/useruid?id=Ka6a99lybyr0k
- Login with Third-Party Account - https://developer.tuya.com/en/docs/app-development/userthirdlogin?id=Ka6a9oalounvd
- (tham chiếu, chưa fetch verbatim) Authentication Method - https://developer.tuya.com/en/docs/iot/authentication-method?id=Ka49gbaxjygox
