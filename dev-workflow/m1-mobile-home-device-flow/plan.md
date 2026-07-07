# Kế hoạch: Luồng điều hướng Home → Device List → Pair → Detail (chuẩn Tuya SmartLife)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-home-device-flow`
- **Milestone:** M1 · B3 (home setup) + B4 (pairing) + B5 (dashboard) - gộp lại thành 1 luồng điều hướng đúng
- **Phần liên quan:** mobile (RN CLI) + lib (`packages/tuya-react-native` - bổ sung `getHomeDeviceList`)
- **Ngày tạo:** 2026-07-02
- **Cập nhật lần cuối:** 2026-07-02 (thêm B8 sau audit)

## 1. Mục tiêu & phạm vi
Sửa logic điều hướng UI mobile để bám đúng luồng app Tuya SmartLife thật:
**login Tuya → (chưa có nhà) tạo Home → danh sách thiết bị → thêm bằng pair →
các màn confirm → quay về list → tap thiết bị mới mở detail.** Hiện app route
thẳng `authed → 'home'` (màn ritual/wellness), `ensureHome()` tự tạo "Walrus Home"
ngầm, không có màn danh sách thiết bị và không có màn confirm pairing đầy đủ. Bổ
sung thêm các tính năng còn thiếu so với bản `replit_generate/` đang gen.

**Quyết định chốt với user (2026-07-02):**
- Device list lấy từ **native `getHomeDeviceList(homeId)` thật** (thêm vào lib) -
  không dùng danh sách local tạm.
- **Device list là màn landing** sau login; màn ritual/wellness (`HomeScreen`
  hiện tại) chuyển vào **trong device detail** (tap thiết bị → detail = điều
  khiển bồn + truy cập breathwork/session/progress từ đó).

**Ngoài phạm vi (không làm trong feature này):**
- Multi-home, gán phòng (room), phân quyền chia sẻ thiết bị → `m2-home-rooms-roles`.
- Đổi router sang `react-navigation` (giữ router string-switch hiện có).
- DP schema thật của bồn tắm / round-trip điều khiển phần cứng → vẫn thuộc
  `m1-mobile-dashboard` (chỉ wire điều hướng, không đổi logic DP).
- Backend/admin.

## 2. Bối cảnh & ràng buộc
- **Router hiện tại** là string-switch tối giản trong [App.tsx](../../apps/mobile/App.tsx)
  + type `ScreenName` trong [navigation.ts](../../apps/mobile/src/navigation.ts) -
  KHÔNG dùng react-navigation. Giữ nguyên pattern này, chỉ thêm screen mới + param `devId`/`homeId`.
- **Lib Tuya thiếu `getHomeDeviceList`:** spec [NativeTuyaHome.ts](../../packages/tuya-react-native/src/specs/NativeTuyaHome.ts)
  chỉ có `getHomeList` / `getHomeDetail` (HomeResult không kèm devices). Phải bổ sung
  native (Android `IThingHome.getHomeBean().getDeviceList` / iOS `ThingSmartHome.deviceList`)
  → **cần build lại native** để chạy thật; JS mock cho phép dev UI trước.
- Tuya **Data Center = Cloud Project region (EU)**; tài khoản SDK phải là **Owner**
  của Home; RN **CLI** (không Expo); AppSecret/service_role/FCM **chỉ server/native**.
- `ensureHome()` trong [pairing.ts](../../apps/mobile/src/services/pairing.ts) hiện
  tự tạo home ngầm - sẽ tách thành flow tạo home tường minh.
- **Link nghiên cứu liên quan:** cần `/tuya-research home management + device list`
  nếu chưa có note về `IThingHome`/`getHomeDeviceList` trước khi code B1 native.
  (Đã có research pairing: xem `docs/research/`.)

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] **AC1** - Sau login Tuya, nếu `getHomeList()` rỗng → hiện màn **Create Home**
  (nhập tên) TRƯỚC; tạo xong mới vào app. Nếu đã có home → vào thẳng device list.
  (verify: mock getHomeList rỗng vs có phần tử → route khác nhau; unit test router-guard.)
- [ ] **AC2** - Màn **Device List** hiển thị đúng các thiết bị của home hiện tại
  (tên, online/offline, icon), có nút **+ Add device** dẫn sang Pairing. List rỗng
  → hiện empty-state + CTA thêm thiết bị. (verify: mock `getHomeDeviceList` → render.)
- [ ] **AC3** - Pairing xong đi qua các **màn confirm** tuần tự kiểu SmartLife
  (searching → found → connecting/registering → **đặt tên thiết bị** → done),
  không chỉ 1 dòng "devId". (verify: chạy mock pairing → thấy đủ các bước.)
- [ ] **AC4** - Pair xong (bấm Done) **quay về Device List** và thiết bị mới xuất
  hiện trong list (refresh). (verify: mock → sau success, list chứa device mới.)
- [ ] **AC5** - Tap 1 thiết bị trong list → mở **Device Detail** (DashboardScreen)
  với `devId` đúng; từ detail truy cập được ritual/breathwork/session/progress.
  (verify: navigate('device-detail',{devId}) → connectDevice(devId) gọi đúng id.)
- [ ] **AC6** - `getHomeDeviceList` được thêm vào lib (spec + facade + native
  Android/iOS) và JS adapter `services/*` gọi được, có mock fallback khi native vắng.
  (verify: `tsc` sạch; jest cho adapter; build native XANH khi có Mac/Android SDK.)
- [ ] **AC7** - Các tính năng có trong `replit_generate/App.js` mà app RN còn thiếu
  đã được liệt kê và port (hoặc ghi rõ lý do hoãn). (verify: bảng đối chiếu trong context.md.)
- [ ] **AC8** - `tsc` + `eslint` + `jest` của `apps/mobile` chạy XANH (mạng đã thông).

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test. Đánh số để `progress.md` tham chiếu.

1. **B0 - Đối chiếu replit vs app + chốt bản đồ điều hướng**
   - Việc cần làm: đọc `replit_generate/App.js`, lập bảng "feature có ở replit ↔ có/thiếu
     ở `apps/mobile`"; vẽ luồng screen mới (splash → auth → [home-gate] → create-home |
     device-list → pairing → confirm/name → device-list → device-detail). Ghi vào context.md.
   - File đụng tới: `dev-workflow/m1-mobile-home-device-flow/context.md` (chỉ tài liệu).
   - Kiểm thử: review bảng đối chiếu đầy đủ (map AC7).

2. **B1 - Thêm `getHomeDeviceList` vào lib Tuya (spec + facade + native + mock)**
   - Việc cần làm: thêm type `HomeDeviceItem` + method `getHomeDeviceList(homeId)` vào
     [NativeTuyaHome.ts](../../packages/tuya-react-native/src/specs/NativeTuyaHome.ts);
     export trong `src/index.tsx` facade; impl Android trong
     [TuyaHomeModule.kt](../../packages/tuya-react-native/android/src/main/java/com/jimmyvu/turbotuya/home/TuyaHomeModule.kt)
     (`IThingHome.getHomeBean().getDeviceList()` → map devId/name/isOnline/productId/iconUrl)
     và iOS [TuyaHome.mm](../../packages/tuya-react-native/ios/Home/TuyaHome.mm)
     (`ThingSmartHome homeWithHomeId:.deviceList`).
   - File đụng tới: 3 file lib trên + facade.
   - Kiểm thử: `tsc` trong lib; build native XANH (nếu có toolchain) - nếu blocked, đánh dấu deferred như các feature lib khác.

3. **B2 - Tách services/home + adapter deviceList (mock fallback)**
   - Việc cần làm: tạo `apps/mobile/src/services/home.ts` bọc `getHomeList`/`createHome`/
     `getHomeDeviceList` (pattern require try/catch + mock như [tuya.ts](../../apps/mobile/src/services/tuya.ts)).
     Chuyển `ensureHome` (đang ở [pairing.ts](../../apps/mobile/src/services/pairing.ts))
     sang dùng home.ts, KHÔNG auto-create ngầm nữa (create do màn UI gọi tường minh).
   - File đụng tới: `services/home.ts` (mới), `services/pairing.ts`, có thể `state/useAppState.ts`.
   - Kiểm thử: jest cho `home.ts` (mock rỗng vs có home vs có device); `tsc`.

4. **B3 - Home-gate lúc login + màn Create Home**
   - Việc cần làm: sửa route trong [App.tsx](../../apps/mobile/App.tsx): `authed` →
     kiểm tra `getHomeList()` → rỗng thì `create-home`, có thì `device-list` (thay vì
     `'home'`). Thêm `CreateHomeScreen` (nhập tên nhà, optional location) → gọi `createHome`
     → vào `device-list`. Thêm `'create-home'`,`'device-list'`,`'device-detail'` vào `ScreenName`.
   - File đụng tới: `App.tsx`, `navigation.ts`, `screens/CreateHomeScreen.tsx` (mới), `state/useAuth.ts` (nếu cần lưu homeId).
   - Kiểm thử: unit cho hàm quyết định route (rỗng→create, có→list); `tsc`.

5. **B4 - Màn Device List (landing sau login)**
   - Việc cần làm: `screens/DeviceListScreen.tsx` - load `getHomeDeviceList(homeId)`,
     render danh sách (reuse/di trú `DeviceCard`), online/offline pill, nút **+ Add device**
     → `pairing`, empty-state khi rỗng, pull-to-refresh. Tap item → `navigate('device-detail',{devId})`.
     Route mặc định sau login trỏ vào đây.
   - File đụng tới: `screens/DeviceListScreen.tsx` (mới), `App.tsx`, `components/DeviceCard.tsx`.
   - Kiểm thử: jest render list (mock 0/1/n device); `tsc`; manual (Metro mock).

6. **B5 - Nâng cấp màn confirm pairing kiểu SmartLife + đặt tên**
   - Việc cần làm: mở rộng [PairingScreen.tsx](../../apps/mobile/src/screens/PairingScreen.tsx)
     state-machine: `progress` tách thành các bước hiển thị (searching/found/connecting/
     registering/initializing) map từ `onPairingProgress`; thêm bước **đặt tên thiết bị**
     (gọi `renameDevice`) trước `done`. Done → về `device-list` (không phải `home`) + refresh.
   - File đụng tới: `PairingScreen.tsx`, `services/pairing.ts` (map step), có thể `services/home.ts`.
   - Kiểm thử: jest/manual chạy mock → thấy đủ chuỗi bước + màn đặt tên; `tsc`.

7. **B6 - Device Detail = DashboardScreen + gộp ritual vào detail**
   - Việc cần làm: route `device-detail` render `DashboardScreen` với `devId` param →
     `connectDevice(devId)`. Đưa lối vào breathwork/session/progress/ritual (từ `HomeScreen`)
     vào trong detail (nút/section). Gỡ route mặc định `'home'` cũ hoặc giữ như tab phụ trong detail.
   - File đụng tới: `App.tsx`, `screens/DashboardScreen.tsx`, `screens/HomeScreen.tsx` (tái sử dụng phần ritual).
   - Kiểm thử: navigate với devId → `connectDevice` nhận đúng id (jest/spy); `tsc`; manual.

8. **B7 - Port các tính năng còn thiếu từ replit (theo bảng B0)**
   - Việc cần làm: implement các mục thiếu đã chốt ở B0 (chỉ những gì trong phạm vi luồng này;
     phần lớn UI hoàn thiện đèn/UV/defrost thuộc `m2-ui-completion` → chỉ port cái nào là
     "thiếu so với replit" và thuộc luồng home/device/detail).
   - File đụng tới: theo bảng B0.
   - Kiểm thử: từng mục có tiêu chí riêng; `tsc`+`eslint`+`jest` toàn app (AC8).

8. **B8 - Sửa phát hiện audit (2026-07-02)** *(thêm sau /audit)*
   - Việc cần làm: **M-1** bỏ `connectDevice` trong `DeviceListScreen.openDevice` (để device-detail
     sở hữu kết nối, tránh gọi 2 lần); **M-2** home-gate lỗi `getHomeList` → hiện state lỗi + nút Thử lại
     (KHÔNG tự route create-home → tránh tạo nhà trùng); **M-3** `decideAfterAuth` ưu tiên home owner
     (`admin || role===2`); **L-2** log lỗi `renameDevice` trong catch; **L-3** guard `homeId` undefined
     trước khi gọi `getHomeDeviceList`.
   - File đụng tới: `App.tsx`, `state/homeGate.ts`(+test), `screens/DeviceListScreen.tsx`, `screens/PairingScreen.tsx`.
   - Kiểm thử: cập nhật `homeGate.test` (case owner-priority); `tsc`+`eslint`+`jest`. (L-1 FlatList/L-4 verify-native để backlog.)

## 5. Rủi ro & câu hỏi mở
- ⚠️ **Native rebuild để có `getHomeDeviceList` thật** - có thể blocked nếu chưa có
  Mac/Android SDK sẵn sàng lúc test. → JS mock fallback cho UI chạy trước; đánh dấu
  "device round-trip deferred" giống các feature lib khác, verify thật khi build được.
- ⚠️ **Gộp ritual vào device detail** làm thay đổi IA đáng kể → giữ code ritual
  (`HomeScreen`) tái sử dụng được, tránh xoá; chỉ đổi điểm truy cập.
- ⚠️ **`ensureHome` đang được PairingScreen gọi** - đổi hành vi (bỏ auto-create) có
  thể vỡ luồng pairing hiện tại → làm B2/B3 trước khi đổi PairingScreen (B5).
- ❓ Replit `App.js` đang được gen liên tục (qua MCP) - cần chốt "ảnh chụp" bản replit
  tại B0 để đối chiếu ổn định, tránh mục tiêu di động.
- ❓ Có cần đọc `getHomeDeviceList` realtime (onHomeChange) để list tự cập nhật khi
  thêm/xoá thiết bị không, hay refresh thủ công là đủ cho M1? (đề xuất: refresh thủ công + on-focus.)
