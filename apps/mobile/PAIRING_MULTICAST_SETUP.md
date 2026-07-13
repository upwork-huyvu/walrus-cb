# iOS · Multicast entitlement cho Wi-Fi EZ pairing

> ⚠️ **CHƯA thêm entitlement vào repo — có chủ đích.** Nếu thêm
> `com.apple.developer.networking.multicast` vào `CoolBathMobile.entitlements` **trước khi** Apple duyệt,
> provisioning profile sẽ không chứa quyền đó và **Xcode fail lúc ký** → hỏng cả build đang chạy được.
> Chỉ thêm **sau bước 3** bên dưới.

## Vấn đề

Từ **iOS 14.5**, app không được gửi gói UDP broadcast/multicast tuỳ biến nếu thiếu entitlement
`com.apple.developer.networking.multicast`. Wi-Fi **EZ mode (SmartConfig)** của Tuya hoạt động **bằng chính
cơ chế đó** → EZ **không thể** chạy trên iOS nếu thiếu quyền này, dù code đúng 100%.

> *"the app built with Xcode 12.5 cannot send the EZ pairing data packets from iPhone that runs iOS 14.5 or
> later, and in this case, the permission `com.apple.developer.networking.multicast` must be enabled."*
> — [Tuya: Wi-Fi EZ Mode (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-network-ez?id=Kceufaqgzx63j)

App **Smart Life** pair được bằng EZ vì Tuya **đã có** entitlement này. Đây chính là khác biệt duy nhất.

`NSLocalNetworkUsageDescription` (đã có trong `Info.plist`) **không cứu được** — nó chỉ phủ unicast LAN +
Bonjour, không phủ multicast/broadcast.

## Đường thoát hiện tại (đã áp dụng trong code)

App **mặc định dùng AP mode trên iOS** (`PairingScreen.tsx`). AP nối điện thoại vào **hotspot của chính bồn**
→ không dùng broadcast/multicast → **không cần entitlement**, và theo doc Tuya còn *"supports routers that can
process data using both 2.4 GHz and 5 GHz frequencies"*. Tuya tự khuyến nghị AP cho iOS 14.5+.

Vì vậy **không có gì bị chặn**: pairing chạy được ngay hôm nay bằng AP. Entitlement chỉ để **mở lại EZ**.

## Các bước xin entitlement (cần tài khoản Apple Developer)

1. **Nộp đơn:** https://developer.apple.com/contact/request/networking-multicast
   - App Name · App Store URL (`https://apps.apple.com/app/id<AppleID>`) · Apple ID of App (optional) · App Category
   - Mô tả mục đích + nhu cầu multicast/broadcast.
   - ❗ Phần giải thích **bắt buộc nhắc tới**: *"UDP ports **6666** and **6667** and TCP port **6668**"*
     (yêu cầu nguyên văn của Tuya).
   - ⚠️ **Rủi ro đã biết:** form đòi App Store URL mà app **chưa phát hành**. Chưa xác minh được Apple có
     chấp nhận app chưa lên store hay không. Nếu bị từ chối → cứ dùng AP mode cho tới khi app lên store.

2. **Chờ duyệt:** *"It usually takes 3 to 5 workdays."*

3. **Sau khi được duyệt:**
   - Apple Developer → Certificates, IDs & Profiles → App Identifier của app →
     **Additional Capabilities** → bật **Multicast Networking**.
   - **Tạo lại provisioning profile** rồi tải về (profile cũ KHÔNG có quyền này).
   - Thêm vào `apps/mobile/ios/CoolBathMobile/CoolBathMobile.entitlements`:
     ```xml
     <key>com.apple.developer.networking.multicast</key>
     <true/>
     ```
   - Clean build (`rm -rf ios/build`) rồi rebuild.

4. **Verify:** trên iPhone thật, chọn **EZ mode** ở màn pairing → pair thành công.
   Nếu vẫn fail: bấm **Copy diagnostics** ở màn lỗi và đọc `sdk.step` / `wifi.error`.

## Liên quan

- Nghiên cứu đầy đủ (có trích dẫn): [`docs/research/tuya-wifi-ez-pairing-failure.md`](../../docs/research/tuya-wifi-ez-pairing-failure.md)
- Feature: [`dev-workflow/m1-fix-wifi-pairing/`](../../dev-workflow/m1-fix-wifi-pairing/)
- Quyền đã có sẵn trong `Info.plist`: `NSLocalNetworkUsageDescription`, `NSLocationWhenInUseUsageDescription`.
  ⚠️ Local Network nếu user từng bấm **Deny** thì iOS **không hỏi lại** → phải vào Settings bật thủ công.
