# Context: Luồng Home → Device List → Pair → Detail (chuẩn Tuya SmartLife)

> File "trí nhớ" — giữ context xuyên suốt các phiên. Append theo thời gian.

- **Slug:** `m1-mobile-home-device-flow`

## Quyết định kỹ thuật (Decision log)

- **2026-07-02** — Device list lấy từ **native `getHomeDeviceList(homeId)` thật**
  (thêm vào lib), không dùng danh sách local tạm. Lý do: đúng chuẩn, đa thiết bị,
  đồng bộ trạng thái online thật. Đã cân nhắc & loại: mở rộng `deviceStore` lưu mảng
  local (nhanh nhưng lệch trạng thái thật, phải viết lại khi có native).
- **2026-07-02** — **Device list là màn landing** sau login; màn ritual/wellness
  (`HomeScreen`) chuyển **vào trong device detail**. Lý do: user yêu cầu bám luồng
  Tuya SmartLife (landing = danh sách thiết bị). Đã cân nhắc & loại: giữ 2 màn tách
  biệt với nút chuyển (ít đổi IA hơn nhưng không giống SmartLife).
- **2026-07-02** — Giữ **router string-switch** hiện có (App.tsx + navigation.ts),
  chỉ thêm screen + param `devId`/`homeId`. Lý do: nhất quán code hiện tại, không
  kéo thêm phụ thuộc react-navigation trong phạm vi feature này.
- **2026-07-02** — Bỏ auto-create home ngầm trong `ensureHome()`; tạo home do màn
  **Create Home** gọi tường minh. Lý do: user phải thấy màn tạo nhà khi chưa có home (AC1).

## Bản đồ file/module

| File / Module | Vai trò |
|---|---|
| `apps/mobile/App.tsx` | Router string-switch + home-gate lúc login (sửa route authed) |
| `apps/mobile/src/navigation.ts` | Thêm `create-home`,`device-list`,`device-detail` vào `ScreenName` |
| `apps/mobile/src/screens/CreateHomeScreen.tsx` | **(mới)** Nhập tên nhà → `createHome` |
| `apps/mobile/src/screens/DeviceListScreen.tsx` | **(mới)** Landing: list thiết bị + Add device |
| `apps/mobile/src/screens/PairingScreen.tsx` | Nâng cấp confirm multi-step + đặt tên; Done → device-list |
| `apps/mobile/src/screens/DashboardScreen.tsx` | Device detail (điều khiển bồn) + lối vào ritual |
| `apps/mobile/src/screens/HomeScreen.tsx` | Nguồn UI ritual/wellness — tái sử dụng trong detail |
| `apps/mobile/src/services/home.ts` | **(mới)** Adapter home: getHomeList/createHome/getHomeDeviceList + mock |
| `apps/mobile/src/services/pairing.ts` | Bỏ auto-create; dùng home.ts; map pairing step |
| `apps/mobile/src/components/DeviceCard.tsx` | Item trong device list |
| `packages/tuya-react-native/src/specs/NativeTuyaHome.ts` | Thêm `getHomeDeviceList` + type item |
| `packages/tuya-react-native/src/index.tsx` | Export facade `getHomeDeviceList` |
| `packages/tuya-react-native/android/.../home/TuyaHomeModule.kt` | Impl Android `getDeviceList` |
| `packages/tuya-react-native/ios/Home/TuyaHome.mm` | Impl iOS `deviceList` |

## B0 — Đối chiếu replit vs app (2026-07-02)

**Kết luận:** replit_generate/App.js (2311 dòng, 1 file) là prototype **wellness thuần**,
KHÔNG có auth/home/pairing. Toàn bộ màn & tính năng của replit ĐÃ được port sang
`apps/mobile`, thậm chí app đã **tách tốt hơn** (replit gộp tất cả vào 1 HomeScreen khổng lồ;
app tách ritual ↔ điều khiển thiết bị). → **Không có tính năng replit nào bị thiếu về mặt chức năng.**
Gap thật 100% là **luồng điều hướng Tuya** (home-gate, create-home, device-list, confirm pairing
đa bước, routing detail) — đúng phạm vi B1–B7.

| Tính năng (replit App.js) | Ở replit | Ở apps/mobile | Trạng thái |
|---|---|---|---|
| Splash + Onboard ×6 (welcome/email/name/why/experience/device) | ✓ | `screens/` + `screens/onboarding/` | ✅ Đã port |
| Ritual record (sessions/streak/minutes/level/points) | trong HomeScreen | `HomeScreen.tsx` | ✅ Đã port |
| Into the cold → session | ✓ | `SessionScreen.tsx` | ✅ Đã port |
| Breathwork | ✓ | `BreathworkScreen.tsx` | ✅ Đã port |
| Completion + Progress | ✓ | `CompletionScreen`/`ProgressScreen` | ✅ Đã port |
| Device card: CURRENT/TARGET/LIGHT + stepper temp | trong HomeScreen | `components/DeviceCard.tsx` (trong `DashboardScreen`) | ✅ Đã port (tách ra) |
| **Cleaning schedule** (freq daily/weekly/custom, day/time picker, confirm) | trong HomeScreen | `components/CleaningPanel.tsx` (trong `DashboardScreen`) | ✅ Đã port (tách ra) |
| **Clean-now double-confirm + countdown** (idle→confirm1→confirm2→running→done) | trong HomeScreen | cần xác nhận có trong `CleaningPanel` | ⚠️ Kiểm ở B7 |
| Theme dark/light toggle | ✓ | `theme/` + toggle | ✅ Đã port |
| Auth / Pairing / Device detail | ✗ (không có) | `AuthScreen`/`PairingScreen`/`DashboardScreen` | ➕ App có THÊM |

**Cấu trúc điều hướng hiện tại (App.tsx):** `splash → onboard-* | auth → 'home'(ritual+teaser thiết bị) → dashboard(điều khiển) / pairing`.
`HomeScreen` là landing gộp ritual + card teaser thiết bị (connected→'Open dashboard'; chưa→'pairing').

**Bản đồ điều hướng ĐÍCH (SmartLife):**
```
splash → auth (login Tuya)
  → getHomeList() rỗng?  → 'create-home' → 'device-list'
  → có home             →                → 'device-list'   (LANDING)
'device-list'  →(+ Add) 'pairing' → confirm đa bước → đặt tên → 'device-list'(refresh)
'device-list'  →(tap)   'device-detail'(devId) = DashboardScreen(điều khiển bồn + CleaningPanel)
                                         + lối vào ritual/breathwork/session/progress từ detail
```
→ `HomeScreen` (ritual) không còn là landing; nội dung ritual chuyển vào trong device-detail.
Chỉ B7 cần kiểm `CleaningPanel` có đủ máy trạng thái clean-now double-confirm như replit.

## Phát hiện & cạm bẫy (Findings / Gotchas)
- **B0:** không thiếu tính năng chức năng nào so với replit; gap = luồng điều hướng Tuya (đã lên B1–B7).
- Lib **CHƯA có** method list thiết bị theo home — `HomeResult` (getHomeList/getHomeDetail)
  không kèm devices. Đây là blocker chính cho device-list thật → B1 phải thêm native.
- `ensureHome()` hiện auto-create "Walrus Home" ngầm → mâu thuẫn AC1 (phải hiện màn tạo nhà).
- App hiện route thẳng `authed → 'home'` (ritual dashboard), bỏ qua khái niệm home Tuya
  và device list hoàn toàn. `HomeScreen` ≠ Tuya home — là màn wellness/ritual.
- `services/tuya.ts` & `services/pairing.ts` đã có pattern require try/catch + mock
  fallback → theo đúng pattern này cho `services/home.ts`.
- Replit prototype chỉ là 1 file `replit_generate/App.js` (+ components) — cần "chụp"
  bản tại B0 vì đang được gen liên tục qua MCP.

## Liên kết
- Plan: [plan.md](plan.md)
- Progress: [progress.md](progress.md)
- Research liên quan: `docs/research/` (pairing đã có; cần bổ sung home/device-list nếu chưa)
- Báo cáo audit liên quan: —
- Feature liên quan: `m1-mobile-pairing`, `m1-mobile-dashboard`, `m1-mobile-scaffold`, `m1-tuya-sdk-library`

## Bổ sung file/module thực tế (sau khi code B0–B7)
| File / Module | Vai trò |
|---|---|
| `apps/mobile/src/state/homeGate.ts` (+test) | `decideAfterAuth(homes)` thuần: rỗng→create-home, có→device-list+homeId |
| `apps/mobile/src/services/home.ts` (+test) | Adapter getHomeList/createHome/getHomeDeviceList + mock in-memory |
| `apps/mobile/src/screens/CreateHomeScreen.tsx` | Nhập tên → createHome → device-list |
| `apps/mobile/src/screens/DeviceListScreen.tsx` | Landing: list/empty/pull-refresh/+Add; tap→device-detail |
| `apps/mobile/src/services/pairing.ts` (+test) | +renameDevice, +pairingStepLabel; ensureHome delegate home.ts |
| `packages/tuya-react-native` | +getHomeDeviceList (spec `HomeDeviceItem`, facade, Kotlin, ObjC) |

## Cạm bẫy phát sinh
- `App.tsx` router remount screen khi đổi `screen` (element type khác nhau giữa các case) → quay lại
  `device-list` sau pairing sẽ **remount** → useEffect refetch tự chạy (đó là cơ chế thoả AC4, không cần focus-event).
- Mock `services/home.ts`: `mockHomes` bắt đầu RỖNG (để demo được màn Create Home); `getHomeDeviceList`
  mock trả 1 thiết bị demo (để device-list/detail dùng được ngay trong Metro chưa build native).
- **appleAuth.test.ts fail là PRE-EXISTING** (thiếu dep `@invertase/react-native-apple-authentication`
  trong node_modules) — KHÔNG do feature này. Cần cài dep đó khi làm lại apple-login.

## Tóm tắt khi hoàn thành (điền lúc FINISH)
Điều hướng mobile đã bám đúng luồng Tuya SmartLife: login → home-gate (chưa nhà→Create Home; có→Device List
landing) → +Add→Pairing (confirm đa bước + đặt tên) → về Device List (refetch) → tap→Device Detail (điều khiển
bồn + CleaningPanel + section Nghi thức). Lib có thêm `getHomeDeviceList`. **Đã verify JS** (tsc clean, eslint 0 err,
jest test mới 15/15). **Còn nợ:** build native (compile Kotlin/ObjC `getHomeDeviceList`) + round-trip thật trên
thiết bị/tài khoản Tuya Owner (DC=EU) — BLOCKED trên toolchain/thiết bị. Ritual back-buttons (session/breathwork)
vẫn trỏ 'home' (màn ritual đầy đủ) — hoạt động, có thể tinh chỉnh ở M2. appleAuth.test fail là nợ dep sẵn có.
