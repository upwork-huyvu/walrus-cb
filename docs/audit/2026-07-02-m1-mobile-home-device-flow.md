# Báo cáo Audit - m1-mobile-home-device-flow - 2026-07-02

- **Phạm vi:** feature `m1-mobile-home-device-flow` (commit `17bb416`). File: `apps/mobile/App.tsx`,
  `src/navigation.ts`, `src/state/homeGate.ts`, `src/services/home.ts`, `src/services/pairing.ts`,
  `src/screens/{CreateHomeScreen,DeviceListScreen,PairingScreen,DashboardScreen}.tsx`,
  `src/components/PrimaryButton.tsx`, và native lib `packages/tuya-react-native`
  (`specs/NativeTuyaHome.ts`, `index.tsx`, `android/.../home/TuyaHomeModule.kt`, `ios/Home/TuyaHome.mm`).
- **Stack phát hiện:** RN CLI + Tuya Smart Life App SDK (TurboModule native bridge).
- **Checklist áp dụng:** react-native, tuya-sdk, security-secrets.
- **Người/agent audit:** Claude (skill /audit) · **Ngày:** 2026-07-02

## Tóm tắt
| Mức | Số lượng |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 0 |
| 🟡 Medium | 3 |
| 🔵 Low/Nit | 4 |

**3 vấn đề ưu tiên xử lý:**
1. **M-1** - gọi `connectDevice` 2 lần (Device List + Device Detail) → race + đọc thiết bị dư thừa.
2. **M-2** - `getHomeList()` lỗi tạm thời → đẩy user sang Create Home → **nguy cơ tạo nhà TRÙNG**.
3. **M-3** - home-gate luôn chọn `homes[0]` bất kể role → nếu không phải Owner, pairing (owner-only) sẽ fail.

Không có lỗi 🔴/🟠. Không phát hiện rò rỉ secret hay import `expo-*` trong file mới (mọi hit grep là chữ "export").

## Phát hiện chi tiết

### [🟡 M-1] Gọi `connectDevice` hai lần khi mở thiết bị
- **Vị trí:** `apps/mobile/src/screens/DeviceListScreen.tsx:49-52` + `apps/mobile/src/screens/DashboardScreen.tsx:17-22`
- **Checklist:** react-native (state trùng lặp / re-render), tuya-sdk (đọc DP dư thừa)
- **Bằng chứng:**
  ```tsx
  // DeviceListScreen.openDevice
  const openDevice = (d: HomeDevice) => {
    void state.connectDevice(d.devId);           // (1) kết nối
    navigate('device-detail', { devId: d.devId });
  };
  // DashboardScreen (mount)
  useEffect(() => {
    if (devId && devId !== state.devId) void state.connectDevice(devId); // (2) kết nối lại
  }, [devId]);
  ```
- **Vì sao sai / rủi ro:** khi tap thiết bị, `openDevice` gọi `connectDevice` rồi điều hướng; DashboardScreen
  mount lại đọc `state.devId` (chưa kịp cập nhật vì React chưa re-render) → điều kiện `devId !== state.devId`
  đúng → gọi `connectDevice` LẦN 2. Kết quả: 2 lần `readDevice`/dispatch `connectStart` cho cùng thiết bị (race,
  đọc DP thừa, có thể nhấp nháy loading).
- **Cách sửa đề xuất:** cho **1 nơi** sở hữu việc kết nối. Bỏ `void state.connectDevice` trong `openDevice`
  (chỉ `navigate`), để DashboardScreen (device-detail) tự kết nối theo `devId` - đó đã là nguồn chân lý.

### [🟡 M-2] `getHomeList()` lỗi → route thẳng Create Home (nguy cơ tạo nhà trùng)
- **Vị trí:** `apps/mobile/App.tsx` (home-gate effect, nhánh `catch`)
- **Checklist:** tuya-sdk (home list là nguồn chân lý), react-native (error state)
- **Bằng chứng:**
  ```tsx
  } catch {
    // Lỗi đọc home list (native/mạng) → cho tạo nhà (an toàn hơn là kẹt màn trắng).
    if (!cancelled) setScreen('create-home');
  }
  ```
- **Vì sao sai / rủi ro:** nếu user **đã có nhà** nhưng `getHomeList()` fail tạm thời (mạng/native chưa sẵn),
  họ bị đẩy sang Create Home → tạo **nhà thứ 2 thừa**, sai với ràng buộc "1 nhà/user" và gây lệch dữ liệu.
- **Cách sửa đề xuất:** khi lỗi → hiện **state lỗi + nút Thử lại** (ở lại `home-gate`), không tự nhảy sang tạo nhà.
  Chỉ vào Create Home khi `getHomeList()` thành công và trả về mảng rỗng.

### [🟡 M-3] home-gate chọn `homes[0]` bất kể quyền (Owner)
- **Vị trí:** `apps/mobile/src/state/homeGate.ts:8-11`
- **Checklist:** tuya-sdk (tài khoản phải là Owner của Home để pair)
- **Bằng chứng:**
  ```ts
  export function decideAfterAuth(homes: HomeInfo[]): HomeGateResult {
    if (!homes || homes.length === 0) return { screen: 'create-home' };
    return { screen: 'device-list', homeId: homes[0].homeId };
  }
  ```
- **Vì sao sai / rủi ro:** `HomeInfo` có `role`/`admin` nhưng bị bỏ qua. Nếu `homes[0]` là nhà được **chia sẻ**
  (member, role≠2), thao tác pairing (owner-only theo tài liệu Tuya) sẽ lỗi mà UI không giải thích được.
- **Cách sửa đề xuất:** ưu tiên chọn home mà user là owner: `homes.find(h => h.admin || h.role === 2) ?? homes[0]`;
  và ở luồng pairing bắt lỗi permission → thông điệp "bạn không phải chủ nhà". (M1 dùng 1 nhà/user nên rủi ro thấp
  nhưng nên phòng.)

### [🔵 L-1] Device list render bằng `.map`, chưa dùng `FlatList`/`keyExtractor`
- **Vị trí:** `apps/mobile/src/screens/DeviceListScreen.tsx:123`
- **Checklist:** react-native (Performance)
- **Bằng chứng:** `devices.map((d) => ( <Pressable key={d.devId} ... /> ))` bên trong `ScrollView`.
- **Vì sao sai / rủi ro:** hiện danh sách nhỏ (1 bồn) nên không ảnh hưởng; nhưng nếu số thiết bị tăng thì
  `ScrollView + map` không ảo hoá → lãng phí. Key theo `devId` là ổn (không dùng index).
- **Cách sửa đề xuất:** khi thiết bị có thể nhiều → đổi sang `FlatList` (`keyExtractor={d => d.devId}`,
  `refreshControl` giữ nguyên). Ưu tiên thấp.

### [🔵 L-2] Nuốt lỗi `renameDevice` không log
- **Vị trí:** `apps/mobile/src/screens/PairingScreen.tsx` (`done()` - `catch {}`)
- **Checklist:** tuya-sdk (không nuốt lỗi im lặng)
- **Bằng chứng:**
  ```tsx
  try { if (name && name !== result.name) await renameDevice(result.devId, name); }
  catch { /* Đặt tên lỗi không nên chặn hoàn tất ... */ }
  ```
- **Vì sao sai / rủi ro:** không chặn hoàn tất là hợp lý, nhưng nuốt hoàn toàn → khó chẩn đoán khi rename fail.
- **Cách sửa đề xuất:** thêm `devLogError('renameDevice', e)` (như pattern ở `services/tuya.ts`) trong `catch`.

### [🔵 L-3] `getHomeDeviceList(homeId ?? 0)` - fallback 0 có thể gọi native sai
- **Vị trí:** `apps/mobile/src/screens/DeviceListScreen.tsx:36`
- **Checklist:** react-native (reliability)
- **Bằng chứng:** `setDevices(await getHomeDeviceList(homeId ?? 0));`
- **Vì sao sai / rủi ro:** nếu `homeId` undefined (điều hướng bất thường) → gọi `newHomeInstance(0)` phía native →
  lỗi khó hiểu / list rỗng. Luồng chuẩn luôn set homeId nên rủi ro thấp.
- **Cách sửa đề xuất:** guard: nếu `homeId == null` → hiện empty-state "chưa chọn nhà" hoặc quay lại home-gate,
  không gọi native với 0.

### [🔵 L-4 · cần xác minh] Nguồn device list phía native
- **Vị trí:** `packages/tuya-react-native/android/.../TuyaHomeModule.kt` (`getHomeDetail → bean.deviceList`),
  `packages/tuya-react-native/ios/Home/TuyaHome.mm` (`getHomeDataWithSuccess → home.deviceList`)
- **Checklist:** tuya-sdk (home/device list là nguồn chân lý)
- **Vì sao cần xác minh:** cần chạy thiết bị thật để xác nhận `HomeBean.getDeviceList()` (Android) và
  `ThingSmartHome.deviceList` (iOS) đã được nạp đầy đủ ngay trong callback `getHomeDetail`/`getHomeData`
  (một số SDK cần chờ device cache sync). Đối chiếu với `docs/research/tuya-home-sdk-home-management.md`.

## Mục đã kiểm nhưng cần xác minh thủ công
- **Build native + round-trip thật:** `getHomeDeviceList` (Kotlin/ObjC) chưa compile/chạy trên thiết bị - cần
  Mac/Android SDK + tài khoản Tuya Owner (Data Center = EU) để đóng AC ở mức thiết bị.
- **Data Center = EU:** không nằm trong diff feature này (init SDK ở `services/tuya`/lib) - đã theo dõi ở
  `m1-tuya-sdk-library`; cần xác nhận console khi build.
- **Realtime home change:** device list refetch khi remount + pull-to-refresh; chưa lắng nghe `onHomeChange` để
  tự cập nhật khi thêm/xoá thiết bị lúc đang ở màn - chấp nhận cho M1 (đã ghi ở plan là câu hỏi mở).

## Việc cần làm tiếp (feed vào /fix-plan hoặc /dev)
- [ ] M-1 - bỏ `connectDevice` trong `DeviceListScreen.openDevice`, để device-detail sở hữu kết nối.
- [ ] M-2 - home-gate: lỗi `getHomeList` → state lỗi + Thử lại, không tự route sang create-home.
- [ ] M-3 - `decideAfterAuth` ưu tiên home owner; luồng pairing xử lý lỗi permission.
- [ ] L-2 - log lỗi `renameDevice` trong catch.
- [ ] L-3 - guard `homeId` undefined trước khi gọi `getHomeDeviceList`.
- [ ] L-1 - (khi cần) đổi device list sang `FlatList`.
- [ ] L-4 - xác minh nguồn device list native trên thiết bị thật.
