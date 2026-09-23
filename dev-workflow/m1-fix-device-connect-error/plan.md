# Kế hoạch: Fix "Unknown error" + mất kết nối khi vừa pair xong

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-fix-device-connect-error`
- **Milestone:** M1·B (mobile - fix lỗi khách báo trên luồng `m1-mobile-dashboard` + `m1-pairing-radar-discovery`)
- **Phần liên quan:** mobile (**chỉ JS** - không đụng native, không rebuild IPA/APK)
- **Ngày tạo:** 2026-09-22
- **Cập nhật lần cuối:** 2026-09-22

## 1. Mục tiêu & phạm vi

Khách báo (ảnh chụp màn Device Detail): **pair xong vào màn thiết bị là hiện pill `ERROR` +
"Unknown error." + RETRY**, nhưng "điều khiển hoặc đợi 1 tý" thì lại chạy bình thường.

Điều tra cho thấy **2 lỗi chồng nhau**:

1. **Lỗi thật - đọc snapshot quá sớm.** `readDevice()` → native `getDeviceSnapshot` →
   iOS `[ThingSmartDevice deviceWithDeviceId:]` / Android `newDeviceInstance` **chỉ đọc cache local
   của SDK**. Cache đó chỉ đầy sau khi home data được nạp. Vừa pair xong, Device List hiện
   `pairedDevice` từ state local **ngay lập tức** trong lúc `getHomeDeviceList()` (thứ warm cache)
   còn đang bay → bấm vào bồn → cache chưa có → native reject `no_device`. `connectDevice` **chạy
   đúng 1 lần, không retry** ⇒ kẹt ở `error`.
2. **Lỗi hiển thị - nuốt message thật.** `describeTuyaError()` đẩy **mọi** code vào bảng tra của lib;
   code phi-số (`no_device`) rơi vào category `unknown` → **"Unknown error."**, message thật của
   native bị vứt. Đây **đúng con bug đã fix ở `services/pairing.ts`** (guard `NUMERIC_CODE`) nhưng
   `services/tuyaError.ts` chưa được vá. Nặng hơn: `extractCode()` còn **cào số từ message bất kỳ**
   (`/-?\d{1,6}/`) nên lỗi timeout `"Device read timed out after 8000ms"` → code `"8000"` → cũng ra
   "Unknown error.".

Và **2 hệ quả kéo theo** (che mất lỗi, làm khách tưởng đã ổn):

3. **"Tự khỏi" là giả.** Listener realtime vẫn subscribe (vì `status: 'error'` ≠ `'idle'`), event tới
   thì `dpPatch` lật pill về `online` **mà không đọc lại snapshot**; một thao tác điều khiển thì
   `setTargetOptimistic` xoá luôn `error`. Trong khi đó `readDevice` chưa thành công lần nào ⇒
   **DP map rỗng** ⇒ mọi publish bị từ chối ⇒ UI "online" nhưng bấm gì cũng không ăn.
4. **Số nhiệt độ giả.** Lúc `error`, gauge vẫn hiện **12°/6°** - đó là giá trị mock của
   `initialDeviceState`, không phải nhiệt độ thật của bồn.

Mục tiêu: vào Device Detail ngay sau khi pair **không còn báo lỗi**; nếu có lỗi thật thì hiện
**đúng lỗi**, không bao giờ hiện chữ "Unknown error." trống rỗng, và không hiện số giả.

**Ngoài phạm vi (không làm trong feature này):**
- Không sửa native (cả 4 fix đều ở tầng JS) ⇒ không rebuild IPA/APK.
- Không đổi `initialDeviceState` sang `idle` - `deviceConnected` mặc định `true` đang được nhiều
  màn dựa vào (xem comment ở `DashboardScreen`); đổi ở đây là refactor lớn, tách backlog.
- Không đụng luồng pairing (`PairingScreen`) ngoài việc truyền thêm `homeId` vào `connectDevice`.
- Không làm màn Device List tự chặn mở bồn khi home data chưa nạp xong (đã giải quyết bằng warm cache
  + retry, chặn UI sẽ làm UX tệ hơn).

## 2. Bối cảnh & ràng buộc

- **Tiên quyết của Tuya (verbatim):** *"trước khi điều khiển device/group phải init home
  (`getHomeDetail()` hoặc `getHomeLocalCache()`) để SDK có cache thiết bị + MQTT connect"* -
  [tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md) §Tiên quyết.
  App hiện **không hề gọi `getHomeDetail`** ở đâu; cache chỉ được warm gián tiếp bởi
  `getHomeDeviceList()` (nó gọi `getHomeDataWithSuccess` bên trong) khi Device List mount.
- **Native đã có sẵn `getHomeDetail`** trong bridge (`specs/NativeTuyaHome.ts` + facade `index.tsx`)
  ⇒ chỉ cần thêm adapter JS, **không rebuild native**.
- **Code lỗi phi-số là của chính bridge**, không phải của Tuya: `no_device`, `no_home`,
  `publish_dps_error`, `get_dps_error`, `snapshot_error`, `ack_timeout`, `ios_todo`,
  `not_implemented`, `init_error`... Message native đi kèm đang là **tiếng Việt**
  ("Không tìm thấy thiết bị") trong khi UI app là **tiếng Anh** ⇒ không được bê thẳng ra UI, phải
  map sang câu tiếng Anh; message native giữ cho log/chẩn đoán.
- Giữ quy ước repo: artifact tiếng Việt · code/UI tiếng Anh · `withTimeout` cho mọi call native ·
  **KHÔNG nuốt message lỗi của SDK** · logic đặt ở `services/` để test được bằng jest (hook
  `useAppState` không có test harness).
- Ràng buộc dự án không đổi: Data Center SDK == Cloud Project (EU) · tài khoản phải là Owner của
  Home · RN CLI (không Expo) · secrets chỉ ở server/native.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)

- [x] **AC1** - `describeTuyaError()` **không bao giờ** trả "Unknown error." cho code phi-số:
  `no_device` → câu tiếng Anh rõ nghĩa, kèm `code` để chẩn đoán; code lạ không có trong bảng →
  trả **message thật của native** (không nuốt).
- [x] **AC2** - Lỗi timeout của `withTimeout` mang `code: 'timeout'` và **không** bị cào nhầm số
  `8000` thành mã lỗi Tuya; `extractCode` chỉ còn cào mã **âm** (`-1400`) từ message.
- [x] **AC3** - `readDeviceWithWarmup()` gặp lỗi **transient** (`no_device`/`no_home`/`timeout`/
  numeric retryable) thì **warm home cache** (`getHomeDetail`) rồi **thử lại** theo backoff
  (600ms → 1500ms, tối đa 3 lần đọc); lỗi **không** transient thì throw ngay, không retry vô ích.
- [ ] **AC4** - Mở Device Detail ngay sau khi pair **không còn hiện ERROR** (máy thật).
- [x] **AC5** - Khi đang `error` mà realtime báo online, pill **không tự lật sang ONLINE** nữa;
  thay vào đó app **đọc lại snapshot thật** (có throttle, không lặp vô hạn). Đọc lại OK → ONLINE +
  banner lỗi biến mất + điều khiển ăn ngay (DP map đã có).
- [x] **AC6** - Lúc `error` (chưa đọc được snapshot lần nào) gauge hiện `-` / `Target -`, **không**
  hiện 12°/6° giả.
- [x] **AC7** - `tsc` 0 lỗi · `eslint` 0 error · `jest` xanh, có test mới cho: bảng code phi-số,
  timeout code, backoff/warm-cache, reducer (`connectError` xoá nhiệt độ, `dpPatch` không lật
  `error`→`online`).
- [ ] **AC8** - Verify **máy thật (iPhone - khách test trên iOS)**: pair xong → vào ngay Device Detail
  → không ERROR; rút mạng/tắt bồn → hiện lỗi **có nội dung** (không phải "Unknown error.").
- [x] **AC9** *(phát sinh khi làm B5 - xem context.md)* - Listener realtime được **đăng ký lại sau mỗi
  lần connect thành công**: iOS `registerDeviceListener` **return im lặng** khi cache SDK chưa có thiết
  bị ⇒ listener đăng ký lúc đang lỗi là listener CHẾT, đọc lại thành công rồi vẫn không nhận DP nào.

## 4. Các bước thực hiện

1. **B1 - Sửa `services/tuyaError.ts` (fix #1: hết "Unknown error.")**
   - Việc cần làm: thêm bảng `LITERAL` cho code phi-số của bridge (message tiếng Anh + cờ
     `retryable`); **chỉ** tra bảng `TuyaErrors` của lib với **mã số** (guard `NUMERIC_CODE`, y như
     `pairing.ts`); code lạ → dùng message native; thu hẹp `extractCode` chỉ cào mã **âm** từ
     message; export `isRetryableTuyaError()` cho B2 dùng.
   - File đụng: `apps/mobile/src/services/tuyaError.ts`, `tuyaError.test.ts`.
   - Kiểm thử: jest (case `no_device`, `timeout`, code lạ, mã số vẫn tra bảng như cũ, message
     `"... after 8000ms"` không còn ra code `8000`).

2. **B2 - `withTimeout` gắn `code: 'timeout'` + `warmHomeCache()` (nền cho fix #2)**
   - Việc cần làm: `withTimeout` trong `services/tuya.ts` throw error có `code`/`domain`;
     thêm `warmHomeCache(homeId)` vào `services/home.ts` → `lib.Tuya.getHomeDetail(homeId)`,
     best-effort (native vắng/lỗi → no-op, không throw).
   - File đụng: `apps/mobile/src/services/tuya.ts`, `apps/mobile/src/services/home.ts`, `home.test.ts`.
   - Kiểm thử: jest (timeout error có code; `warmHomeCache` nuốt lỗi, no-op khi native vắng).

3. **B3 - `services/deviceConnect.ts`: đọc snapshot có warm-cache + backoff (fix #2)**
   - Việc cần làm: hàm **thuần, inject dependency** `readDeviceWithWarmup(devId, homeId, deps)` -
     đọc → lỗi transient (`isRetryableTuyaError`) & còn lượt → `warmHome(homeId)` (1 lần) → `sleep`
     theo `CONNECT_RETRY_DELAYS_MS` → đọc lại; hết lượt/không transient → throw lỗi **gốc**.
   - File đụng: `apps/mobile/src/services/deviceConnect.ts` (mới), `deviceConnect.test.ts` (mới).
   - Kiểm thử: jest (thành công ngay; `no_device` lần 1 → warm + retry → ok; lỗi không transient
     → throw ngay, không gọi warm; hết lượt → throw lỗi gốc; không warm khi thiếu `homeId`).

4. **B4 - Wire `useAppState.connectDevice` + `retry` + callers (fix #2 + fix #3)**
   - Việc cần làm: `connectDevice(id?, homeId?)` gọi `readDeviceWithWarmup`, nhớ `homeId` vào ref để
     `retry()` dùng lại; thêm self-heal: realtime báo `isOnline: true` trong lúc `status === 'error'`
     → **đọc lại snapshot** (throttle `RECONNECT_THROTTLE_MS`), thay vì lật pill suông.
     Cập nhật caller: `DashboardScreen` (`connectDevice(devId, homeId)`), `PairingScreen`
     (`connectDevice(result.devId, hid)`).
   - File đụng: `apps/mobile/src/state/useAppState.ts`, `screens/DashboardScreen.tsx`,
     `screens/PairingScreen.tsx`.
   - Kiểm thử: `tsc` + jest hiện có (không vỡ) + đọc lại code; hành vi thật chốt ở B7.

5. **B5 - `deviceMachine`: không lật `error`→`online`, không giữ nhiệt độ giả (fix #3 + #4)**
   - Việc cần làm: `dpPatch` + `statusChanged` **không** đổi `status` khi đang `error` (chỉ `connectOk`
     mới được đưa về online) - giữ RETRY hiện diện cho người dùng; `connectError` xoá
     `currentTemp/targetTemp/pendingTarget/prevTarget` → gauge hiện `-`.
   - **B5b (phát sinh, AC9):** thêm `connectSeq` vào `DeviceState` (tăng ở mỗi `connectOk`) và đưa vào
     deps của effect listener ⇒ **đăng ký lại listener realtime sau mỗi lần đọc thành công**.
   - File đụng: `apps/mobile/src/state/deviceMachine.ts`, `deviceMachine.test.ts`,
     `apps/mobile/src/state/useAppState.ts`.
   - Kiểm thử: jest (3 case mới + các case cũ vẫn xanh).

6. **B6 - Chạy CI cục bộ**: `tsc --noEmit` · `eslint` · `jest` toàn bộ `apps/mobile`.

7. **B7 - Verify máy thật (AC4, AC5, AC8)** - checklist cho khách/iPhone:
   - Pair 1 bồn mới → bấm "Go to home" → chạm ngay vào bồn vừa pair ⇒ **không ERROR**, thấy nhiệt
     độ thật, bấm nguồn ăn liền.
   - Tắt Wi-Fi bồn → RETRY ⇒ hiện lỗi **có nội dung** (ví dụ "Device is offline...") chứ không phải
     "Unknown error.".
   - Đang ERROR mà bật bồn lên lại ⇒ app tự đọc lại và về ONLINE, điều khiển ăn ngay.

## 5. Rủi ro & câu hỏi mở

- ⚠️ **Backoff làm chậm lần mở đầu tiên khi bồn thật sự offline**: tổng thêm ~2.1s trước khi hiện
  lỗi → chấp nhận được (pill `CONNECTING…` vẫn hiển thị suốt thời gian đó, không đứng hình).
- ⚠️ **Self-heal có thể lặp** nếu bồn liên tục đẩy event online trong lúc đọc vẫn lỗi → chặn bằng
  throttle 5s + `connectReqRef` sẵn có.
- ⚠️ **Không lật `error`→`online` nữa** ⇒ nếu `readDevice` hỏng theo kiểu **cố định** (không phải
  transient) thì màn sẽ **ở lại ERROR** thay vì tự "khỏi" giả như trước. Đây là **cố ý**: trước đây
  nó chỉ che lỗi, DP map vẫn rỗng và điều khiển vẫn không ăn.
- ❓ Chưa chứng minh được 100% là `no_device` (chưa có log máy thật, vì UI nuốt mất code). Sau B1
  thì mã lỗi thật sẽ hiện ngay trên banner ⇒ B7 xác nhận lại. Nếu hoá ra là mã khác, `/fix-plan`.
