# Context: Fix "Unknown error" + mất kết nối khi vừa pair xong

> File "trí nhớ" - giữ context xuyên suốt các phiên làm việc. Mọi quyết định,
> phát hiện, cạm bẫy đều ghi vào đây để phiên sau đọc lại là hiểu ngay.

- **Slug:** `m1-fix-device-connect-error`

## Quyết định kỹ thuật (Decision log)

- **2026-09-22** - **Không bê message native ra UI** cho code đã biết; map sang câu **tiếng Anh**
  trong `tuyaError.ts`. Lý do: message của bridge đang là **tiếng Việt** ("Không tìm thấy thiết bị")
  còn UI app đã chuyển hết sang tiếng Anh (commit `fc0f8df`). Message native vẫn giữ nguyên cho
  code **lạ** (không có trong bảng) - thà hiện tiếng Việt còn hơn nuốt mất lỗi.
  Đã cân nhắc & loại: (a) i18n đầy đủ - quá tầm bug fix này; (b) hiện thẳng message native - lộn
  ngôn ngữ giữa màn hình tiếng Anh.

- **2026-09-22** - **Thu hẹp `extractCode` chứ không bỏ hẳn** việc cào mã từ message: chỉ nhận mã
  **âm** (`-?\d{2,6}` có dấu trừ). Lý do: mã lỗi SDK Tuya luôn âm (-60, -1400, -10001) và test cũ
  `extractCode(new Error('publish failed: -1400'))` là hành vi đúng cần giữ; còn số **dương** trong
  câu chữ (`"...after 8000ms"`, `"...timeout 30s"`) chính là nguồn của mã lỗi bịa.
  Đã cân nhắc & loại: bỏ hoàn toàn việc cào mã → mất mã thật trong các đường native cũ chỉ reject
  bằng `Error(string)`.

- **2026-09-22** - **Logic retry đặt ở `services/deviceConnect.ts` (hàm thuần + inject deps)**,
  không nhét vào `useAppState`. Lý do: repo không có test harness cho hook; mọi thứ ở `services/`
  đều test được bằng jest. Đã cân nhắc & loại: viết trong `connectDevice` (nhanh hơn nhưng
  **không test được** đúng cái phần dễ sai nhất: thứ tự warm→sleep→read, đếm lượt).

- **2026-09-22** - **`dpPatch` KHÔNG được lật `error` → `online` nữa.** Lý do: đó chính là thứ tạo ra
  ảo giác "tự khỏi" mà khách mô tả - pill xanh nhưng `readDevice` chưa từng thành công ⇒ DP map rỗng
  ⇒ `publishBool`/`buildTempDps` từ chối mọi lệnh (xem `tuya.ts:345`). Thay bằng **đọc lại snapshot
  thật** khi realtime báo online. Đánh đổi: nếu lỗi là cố định thì màn ở lại ERROR - chấp nhận, vì
  đó là **sự thật**.

- **2026-09-22** - **Đăng ký LẠI listener realtime sau mỗi `connectOk`** bằng `connectSeq` trong
  `DeviceState` (reducer tăng, effect lấy làm deps). Lý do: iOS `registerDeviceListener` cũng gọi
  `deviceWithDeviceId` và **return im lặng nếu nil** ⇒ đăng ký lúc cache lạnh = listener chết, không có
  cách nào biết. Đã cân nhắc & loại: cho `device.status` vào deps (mỗi lần online↔offline lại
  unregister/register, mất event lúc chuyển).

- **2026-09-22** - **Warm cache bằng `getHomeDetail(homeId)`**, không dùng `getHomeDeviceList`.
  Lý do: đúng thứ doc Tuya yêu cầu (init home → SDK có device cache + MQTT), rẻ hơn, và không kéo
  theo `logHomeDevices` spam log mỗi lần retry.

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/services/tuyaError.ts` | Map lỗi Tuya/bridge → `{code, message, retryable}` cho UI. **Nguồn của chữ "Unknown error."** |
| `apps/mobile/src/services/deviceConnect.ts` | **(mới)** đọc snapshot có warm-cache + backoff; hàm thuần, inject deps |
| `apps/mobile/src/services/tuya.ts` | Adapter thiết bị: `readDevice` (snapshot+DP map), `withTimeout`, publish DP |
| `apps/mobile/src/services/home.ts` | Adapter home: `getHomeDeviceList`, **(mới)** `warmHomeCache` |
| `apps/mobile/src/state/useAppState.ts` | `connectDevice` / `retry` / listener realtime → dispatch reducer |
| `apps/mobile/src/state/deviceMachine.ts` | Reducer thuần: `connectOk/connectError/dpPatch/statusChanged` |
| `apps/mobile/src/screens/DashboardScreen.tsx` | Device Detail: pill + banner lỗi + RETRY + gauge |
| `apps/mobile/src/screens/DeviceListScreen.tsx` | Hiện `pairedDevice` ngay lập tức trong lúc `getHomeDeviceList` còn đang bay - **cửa vào của bug** |
| `packages/tuya-react-native/ios/Device/TuyaDevice.mm` | `getDeviceSnapshot` → reject `no_device` khi cache SDK chưa có thiết bị; `registerDeviceListener` **return im lặng** trong cùng tình huống |
| `packages/tuya-react-native/src/errors.ts` | Bảng tra mã Tuya (`classify`/`describe`) - **chỉ đúng với mã SỐ** |

## Phát hiện & cạm bẫy (Findings / Gotchas)

- **`[ThingSmartDevice deviceWithDeviceId:]` chỉ đọc cache local, không gọi mạng.** Chưa nạp home
  data ⇒ trả `nil` ⇒ bridge reject `no_device`. Đây là lý do "vừa pair xong thì lỗi, đợi tý thì hết".
- **Bảng `TuyaErrors.describe()` chỉ dành cho mã SỐ.** Mọi code phi-số (`no_device`, `pairing_error`,
  `ios_todo`...) đều rơi vào category `unknown` → `"Unknown error."`. `pairing.ts` đã có guard
  `NUMERIC_CODE` từ `m1-fix-wifi-pairing`; `tuyaError.ts` thì **chưa** ⇒ cùng một con bug, 2 nơi.
- **`extractCode` cào số từ message bất kỳ** ⇒ `"Device read timed out after 8000ms"` biến thành mã
  lỗi `8000`. Bất kỳ message nào có số đều có nguy cơ thành mã lỗi bịa.
- **`initialDeviceState` là mock `online / 12° / 6°`**: khi `readDevice` chưa thành công lần nào,
  màn detail hiện **số giả** chứ không phải số của bồn. Dễ tưởng app đang đọc được dữ liệu.
- **DP map là điều kiện cần để điều khiển**: `readDevice` set map; map rỗng ⇒ `publishBool` /
  `buildTempDps` từ chối (`"This device has no ... control."`). Nên "pill online" mà chưa từng đọc
  được snapshot là trạng thái **dối**.
- **App không gọi `getHomeDetail` ở bất cứ đâu** - cache chỉ được warm gián tiếp khi Device List
  mount (`getHomeDeviceList` → `getHomeDataWithSuccess`).
- `logDeviceDetails` ở Device List (thứ cũng warm được DP map) bị gate `__DEV__` ⇒ **bản release
  không có** lợi ích đó.
- **iOS `registerDeviceListener` nuốt lỗi hoàn toàn**: `if (!dev) { return; }` - không reject, không
  log. Đăng ký lúc cache SDK còn lạnh ⇒ listener chết vĩnh viễn (realtime không bao giờ tới) mà JS
  không hề hay biết. Đây là lý do phải có `connectSeq` để đăng ký lại sau khi đọc thành công.
- **Đường self-heal qua realtime KHÔNG cứu được ca cache lạnh** (vì đúng ca đó listener cũng chết) -
  thứ thật sự cứu ca đó là backoff + `getHomeDetail` ở `deviceConnect.ts`. Self-heal chỉ dành cho ca
  bồn mất điện/mất mạng lúc đọc rồi sống lại sau.
- **Chi phí backoff**: lỗi reject ngay (như `no_device`) → chỉ thêm ~2.1s cho ca xấu nhất. Nhưng nếu
  native TREO thì mỗi lượt tốn trọn `READ_TIMEOUT_MS` (8s) ⇒ xấu nhất ~26s trước khi hiện lỗi. Chấp
  nhận vì native treo là ca bệnh nặng và pill `CONNECTING…` vẫn chạy; nếu thấy khó chịu thì hạ timeout
  cho các lượt retry.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)
  (§Tiên quyết: init home trước khi điều khiển) · [tuya-home-sdk-device-management.md](../../docs/research/tuya-home-sdk-device-management.md)
  (§Entry instance `deviceWithDeviceId`) · [tuya-home-sdk-error-codes.md](../../docs/research/tuya-home-sdk-error-codes.md)
- Feature liên quan: `m1-mobile-dashboard` (nơi sinh `deviceMachine`/`connectDevice`) ·
  `m1-fix-wifi-pairing` (nơi đã fix cùng con bug "Unknown error." cho pairing)

## Tóm tắt khi hoàn thành (điền lúc FINISH)
B1-B6 xong, CI xanh (tsc 0 · eslint 0 error · jest 395/395). 4 fix đã vào + 1 fix phát sinh (AC9):
(1) `tuyaError.ts` không còn đẻ ra "Unknown error."; (2) `deviceConnect.ts` warm `getHomeDetail` +
backoff 600/1500ms cho lỗi transient; (3) `error` không còn tự lật sang online - thay bằng đọc lại
snapshot thật (throttle 5s); (4) `connectError` xoá nhiệt độ ⇒ gauge hiện `-` thay vì mock 12°/6°;
(5) đăng ký lại listener realtime sau mỗi `connectOk`. **Chỉ JS, không rebuild native.**
Còn nợ: **B7 verify trên iPhone thật** (AC4, AC8). Cần theo dõi: nếu máy thật vẫn lỗi thì banner giờ
đã hiện **mã lỗi thật** - đọc mã đó rồi `/fix-plan`, đừng đoán tiếp.
