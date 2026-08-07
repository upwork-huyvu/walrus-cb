# iOS · Multicast entitlement cho Wi-Fi EZ pairing

> ✅ **ĐÃ XONG (2026-08-07).** Apple đã duyệt Multicast Networking cho app này. Entitlement
> `com.apple.developer.networking.multicast` đã nằm trong `CoolBathMobile.entitlements`, và **EZ giờ là
> mode pairing mặc định trên iOS**, giống hệt Android (`src/services/pairingModes.ts`).
>
> Tài liệu này giữ lại làm hồ sơ: vì sao cần quyền đó, và phải làm gì nếu sau này đổi Bundle ID hay
> tạo App Identifier mới — quyền gắn với **App ID cụ thể**, không tự theo sang ID mới.

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

## Trạng thái hiện tại trong code

| | |
|---|---|
| Entitlement | `com.apple.developer.networking.multicast` = `true` trong `CoolBathMobile.entitlements` |
| Mode mặc định iOS | **EZ** (`pairingModesFor('ios')` → `['ez','ap','ble']`, phần tử đầu là mặc định) |
| Ô nhập Wi-Fi ở EZ/iOS | **gõ tay** — iOS không có API liệt kê Wi-Fi |
| Tự điền SSID ở EZ/iOS | **có** — `com.apple.developer.networking.wifi-info` đọc được mạng đang nối, mà ở EZ mạng đang nối chính là mạng cần truyền |
| Kiểm tra băng tần ở iOS | **không làm được** — chỉ cảnh báo `band_unknown` |

AP vẫn còn nguyên làm phương án dự phòng (mode thứ hai trong dropdown): nó không dùng broadcast/multicast,
và theo doc Tuya còn *"supports routers that can process data using both 2.4 GHz and 5 GHz frequencies"*.

## Các bước xin entitlement — ĐÃ HOÀN TẤT, giữ lại cho App ID mới

> Áp dụng lại nguyên quy trình này nếu đổi Bundle ID hoặc tạo App Identifier mới. Bundle ID hiện tại
> đã được duyệt là **`com.walrus.ios.wellness`**.

1. **Nộp đơn:** https://developer.apple.com/contact/request/networking-multicast
   - App Name · App Store URL (`https://apps.apple.com/app/id<AppleID>`) · Apple ID of App (optional) · App Category
   - Mô tả mục đích + nhu cầu multicast/broadcast.
   - ❗ Phần giải thích **bắt buộc nhắc tới**: *"UDP ports **6666** and **6667** and TCP port **6668**"*
     (yêu cầu nguyên văn của Tuya).
   - ✅ **Đã giải toả:** lo ngại trước đây là form đòi App Store URL trong khi app chưa phát hành.
     Thực tế Apple **vẫn duyệt** cho app chưa lên store.

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
