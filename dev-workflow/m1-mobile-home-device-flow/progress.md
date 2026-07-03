# Progress: Luồng Home → Device List → Pair → Detail (chuẩn Tuya SmartLife)

> `/dev`, `/test`, `/fix-plan` đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-mobile-home-device-flow`
- **Phase hiện tại:** `TEST` (code toàn bộ B0–B7 XONG; còn verify native trên thiết bị thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
B0–B8 code XONG + verify JS (tsc clean · eslint 0 err · jest 17/17 test mới pass). B8 đã sửa 3🟡+2🔵 từ audit.
Còn backlog nit: L-1 (FlatList khi list to) · L-4 (verify nguồn device list native trên thiết bị).
**Còn lại (BLOCKED trên toolchain/thiết bị):** build native để xác thực `getHomeDeviceList`
(Kotlin/ObjC) + round-trip thật: login Tuya → home-gate → tạo/chọn nhà → device-list hiện thiết bị
thật → pair thiết bị thật → confirm+đặt tên → về list → detail. Cần Mac/Android SDK + thiết bị + tài
khoản Tuya Owner (DC=EU). Khi build được: chạy checklist thiết bị. Cân nhắc `/audit` mobile sau đó.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B0 — Đối chiếu replit vs app + chốt bản đồ điều hướng · done (không thiếu tính năng chức năng; gap = nav flow. Bảng trong context.md)
- [x] B1 — Thêm `getHomeDeviceList` vào lib (spec+facade+native) · done (tsc lib src clean; native Android/iOS wired; compile native deferred)
- [x] B2 — Tách `services/home.ts` + adapter deviceList (mock fallback) · done (home.ts + home.test 6/6; ensureHome delegate sang home.ts)
- [x] B3 — Home-gate lúc login + màn Create Home · done (homeGate.ts+test 2/2 · CreateHomeScreen · App home-gate effect · AuthScreen→home-gate)
- [x] B4 — Màn Device List (landing) · done (DeviceListScreen: list/empty-state/pull-refresh/+Add · App route · tap→device-detail)
- [ ] B5 — Nâng cấp confirm pairing kiểu SmartLife + đặt tên · doing
- [x] B3 — Home-gate lúc login + màn Create Home · done (homeGate.ts+test · CreateHomeScreen · App effect · AuthScreen→home-gate)
- [x] B4 — Màn Device List (landing) · done (DeviceListScreen: list/empty/pull-refresh/+Add · App routes+params)
- [x] B5 — Nâng cấp confirm pairing kiểu SmartLife + đặt tên · done (pairingStepLabel + step 'naming' + renameDevice; pairing.test)
- [x] B6 — Device Detail = DashboardScreen + gộp ritual · done (devId→connect effect; section NGHI THỨC; back→device-list)
- [x] B7 — Kiểm/port tính năng còn thiếu từ replit · done (CleaningPanel đã đủ double-confirm+countdown+freq/day/time; không thiếu)
- [x] B8 — Sửa audit findings · done (M-1 bỏ double-connect · M-2 home-gate lỗi→Thử lại · M-3 owner-priority+test · L-2 log rename · L-3 guard homeId). L-1/L-4 backlog.

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 — Login → chưa home → Create Home; có → device-list · JS ✅ (homeGate.test + App effect). Device: chờ build.
- [x] AC2 — Device List + Add device + empty-state · JS ✅ (mock). Thiết bị thật: chờ getHomeDeviceList native.
- [x] AC3 — Confirm tuần tự + đặt tên · JS ✅ (pairingStepLabel + step naming). Device: chờ pair thật.
- [x] AC4 — Pair xong → về Device List, thiết bị mới xuất hiện · JS ✅ (Done→device-list remount refetch). Device: chờ pair thật.
- [x] AC5 — Tap → Device Detail devId đúng + ritual từ detail · JS ✅ (connectDevice(devId) + NGHI THỨC).
- [x] AC6 — `getHomeDeviceList` lib (spec+facade+native)+adapter+mock · ✅ code; **native compile deferred**.
- [x] AC7 — Đối chiếu replit + parity · ✅ (bảng B0 + CleaningPanel parity).
- [x] AC8 — `tsc`+`eslint`+`jest` XANH · ✅ tsc clean · eslint 0 err · jest test mới 15/15 (⚠️ appleAuth.test fail PRE-EXISTING: thiếu dep).

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-07-03 | **B13 — BOTTOM TAB 5 mục (Device/Reminder/Shop/Help/Account) + 3 màn mới** | ✅ code | User đưa design menu Maintenance + FAQ. (1) **[TabIcons.tsx](../../apps/mobile/src/components/TabIcons.tsx)**: 5 icon SVG stroke tint được (snowflake/clock/bag/help/person — không dùng emoji). (2) **BottomTabBar** 5 tab: Device→device-list · Reminder→reminder · Shop→shop · Help→help · Account→me. (3) **[ReminderScreen](../../apps/mobile/src/screens/ReminderScreen.tsx)**: filter reminder 90 ngày (FAQ), days-left + progress + quá hạn/cảnh báo ≤7 ngày + "Mark filter as changed" + link Shop; ngày thay lưu local [filterStore.ts](../../apps/mobile/src/services/filterStore.ts). (4) **[ShopScreen](../../apps/mobile/src/screens/ShopScreen.tsx)**: 3 mục (filters/tablets/accessories) → mở walruswellness.com/shop + note filter chính hãng. (5) **[HelpScreen](../../apps/mobile/src/screens/HelpScreen.tsx)**: FAQ ĐẦY ĐỦ copy client (4 section × 15 QA, accordion mở=ochre ⌄/đóng=trắng ›, câu đầu mở sẵn như design) + card "Still need help?" → mailto support@walruswellness.com. Account tab = MeScreen cũ (nhà/thông báo/cấu hình). tsc 0 · eslint 0. Còn: chụp UI device (máy khoá). |
| 2026-07-03 | **B12 — PAIRING redesign 5 màn theo design + nhớ Wi-Fi local** | ✅ code | User đưa 5 ảnh design pairing. Viết lại [PairingScreen.tsx](../../apps/mobile/src/screens/PairingScreen.tsx): (1) intro "Pair your Walrus." + card "Same Wi-Fi required" 📶 + WI-FI NAME/PASSWORD (Tuya bắt buộc, style CAPS) + "Search for device" + fallback EZ⇄AP thu gọn + Skip; (2) "Searching…" radar 📡 (BLE scan, thấy device đầu → sang found; 60s timeout → error); (3) "Ready to pair." card viền ochre (name+▂▄▆+Device ID/Signal Strong/Network/Status Ready) + "Connect to this device" + Search again; (4) "Connecting…" checklist Authenticating→Syncing settings→Finalizing (nhích theo `onPairingProgress` thật, sub-label `pairingStepLabel`); (5) "Paired." ✓ + DEVICE NAME (giữ đặt tên) + "Go to home" (rename+connect+về device-list). Error riêng. Giữ guard: timeout 130s, back chỉ ở màn tĩnh. **+ Nhớ Wi-Fi LOCAL** ([wifiStore.ts](../../apps/mobile/src/services/wifiStore.ts) AsyncStorage): prefill lúc mở, save lúc Search/Pair. tsc 0 · eslint 0 · pairing.test 7/7. Còn: chụp UI device (máy khoá). |
| 2026-07-03 | **B11 — Intro chuyển sang SAU LOGIN ĐẦU + DEVICE VERIFY TOÀN LUỒNG** | ✅ 📱 | User đổi yêu cầu: intro show **sau lần đăng nhập đầu tiên** (không phải lúc mở app). Sửa: boot guest→welcome thẳng; `AuthScreen.succeed`→check cờ→`intro`\|`home-gate`; `IntroScreen.finish`→`home-gate`. **VERIFY TRÊN SM-A325F (fresh install pm clear):** welcome "The ritual starts here." (logo G 4 màu + táo Apple SVG ✅) → Sign in "Welcome back." ✅ → Create account form (labels CAPS+SHOW+confirm+SEND CODE) ✅ → country dropdown "Chọn quốc gia" + search + bảng WE ✅ → login Google (picker) → **INTRO slide 1 hiện sau login** ✅ → Next×3+Get started → **"My Home" TỰ TẠO trên Tuya thật** → Device tab "⌂ My Home ▾ +" + empty-state "Thêm thiết bị đầu tiên/Thêm ngay" ✅ → Me tab (avatar+menu 3 dòng) ✅. Nit fix: tab glyph `❄`→`❄︎` (variation selector — Android render emoji xanh thay vì tint). tsc 0 · eslint 0. |
| 2026-07-03 | **B10 — REDESIGN AUTH theo design (3 ảnh) + INTRO first-launch (4 ảnh)** | ✅ code | (1) **AuthScreen viết lại**: variant `welcome` ("The ritual starts here." — route `onboard-welcome`, thay onboarding cũ) + `signin` ("Welcome back.") — landing social: nút Google **trắng + logo G 4 màu SVG**, Apple **đen + táo trắng SVG** ([BrandLogos.tsx](../../apps/mobile/src/components/BrandLogos.tsx), `react-native-svg` đã có trong APK; bỏ glyph  vì Android không render), OR, email viền, footer Sign up/Sign in. View `register` (ảnh Create account: EMAIL/PASSWORD Min-8+SHOW/CONFIRM PASSWORD + **VERIFICATION CODE** giữ vì Tuya bắt buộc, style theo design) + `email-signin`. (2) **Country dropdown** [CountryPicker.tsx](../../apps/mobile/src/components/CountryPicker.tsx): bottom-sheet + search; data [config/countries.ts](../../apps/mobile/src/config/countries.ts) = **nguyên bảng Western Europe DC Tuya** (~160 nước, default Germany 49); áp cho cả social. (3) **IntroScreen** 4 slide first-launch (Welcome to Walrus/Your First Plunge/Cold Science/Getting Connected — badge+video card placeholder TAP TO PLAY+dots+Skip all, video/ảnh client đưa sau); cờ `introFlag.ts` (AsyncStorage) → chỉ hiện lần đầu; boot: guest→intro|welcome. Verify: **tsc 0 · eslint 0 err**. Còn: chụp UI device (máy đang khoá). |
| 2026-07-03 | **B9 — REDESIGN bám Tuya SmartLife (user yêu cầu, kèm 2 ảnh)** | ✅ code | Giữ brand WALRUS tối. (1) **Bottom tab 2 tab** `BottomTabBar.tsx` (Thiết bị ❄ / Tôi ◉) — bọc ở App cho `device-list`+`me`+3 màn con Me; màn immersive (detail/pairing/ritual) không tab. (2) **DeviceListScreen** redesign: header = **chọn nhà** (⌂ tên nhà ▾ → home-management) + ＋ pairing; empty-state "Thêm thiết bị đầu tiên"+"Thêm ngay" (bám ảnh 1, bỏ AI bar/room tabs — user chốt "gọn"). (3) **MeScreen** (ảnh 2): avatar+tên → profile; menu Quản lý nhà/Thông báo/Cấu hình thông tin. (4) Màn con: `HomeManagementScreen` (list nhà+HIỆN TẠI+chuyển nhà+tạo mới), `NotificationsScreen` (empty-state), `ProfileScreen` (account+theme switch+Đăng xuất). (5) **Auto "My Home"**: `home.ts` +`ensureDefaultHome()`/`pickCurrentHome()` — gate không bắt qua Create Home nữa, chưa có nhà → tự tạo "My Home" → thẳng device-list (CreateHomeScreen giữ cho "Tạo nhà mới" từ Quản lý nhà; truyền thêm homeName). (6) App.tsx: state `homeName`, params `homeName`, `handleSignOut` chung, routes `me/home-management/notifications/profile`. Verify: **tsc 0 · eslint 0 err · jest home+homeGate 10/10**. Còn: reload device xem UI (device đang rớt kết nối). |
| 2026-07-02 | FIX-PLAN+DEV B8 | ✅ | Sửa 3🟡+2🔵 từ audit: M-1 (DeviceList bỏ connectDevice) · M-2 (home-gate lỗi→gateError+Thử lại, không tạo nhà trùng) · M-3 (decideAfterAuth owner-priority + 2 test) · L-2 (log renameDevice) · L-3 (guard homeId null). `tsc` clean · `eslint` 0 err · `jest` 17/17. |
| 2026-07-02 | TEST B5–B7 | ✅ | `tsc` clean · `eslint` 0 error · `jest` test mới 15/15 (home 6 + homeGate 2 + pairing 8... thực 15 tổng). B7: xác nhận CleaningPanel đã đủ parity với replit → không thiếu tính năng. |
| 2026-07-02 | DEV B5–B7 | ✅ | B5 PairingScreen: `pairingStepLabel`+step 'naming'+`renameDevice`(adapter+test); B6 DashboardScreen: effect connect theo devId + section NGHI THỨC (session/breathwork/progress) + back→device-list; B7 kiểm CleaningPanel parity (đủ). |
| 2026-07-02 | TEST B2–B4 | ✅ | `tsc` clean · `eslint` 0 error (77 warning inline-style theo convention repo) · `jest`: homeGate 2/2 + home 6/6 pass. ⚠️ pre-existing fail `appleAuth.test.ts` (thiếu dep `@invertase/react-native-apple-authentication`, không liên quan). |
| 2026-07-02 | DEV B2–B4 | ✅ | B2 `services/home.ts`+test; B3 `homeGate.ts`+test+`CreateHomeScreen`+App home-gate effect+AuthScreen→home-gate; B4 `DeviceListScreen`+App routes+params devId/homeId; PairingScreen/DashboardScreen nhận homeId/devId, exit→device-list; PrimaryButton +disabled. |
| 2026-07-02 | DEV B1 | ✅ | Thêm `getHomeDeviceList`: spec `NativeTuyaHome.ts`(+type `HomeDeviceItem`), facade `index.tsx`, Android `TuyaHomeModule.kt`(getHomeDetail→deviceList+`deviceToMap`), iOS `TuyaHome.mm`(getHomeData→home.deviceList). `tsc` lib src clean (1 lỗi pre-existing ở example/AdvancedSection, không liên quan). Native compile deferred. |
| 2026-07-02 | DEV B0 | ✅ | Đối chiếu replit↔app: mọi màn/tính năng replit ĐÃ port (app tách tốt hơn). Không thiếu chức năng; gap = nav flow. Bảng + nav map đích ghi context.md. |
| 2026-07-02 | PLAN | ✅ | Tạo plan/context/progress; user duyệt plan. 2 quyết định chốt: native getHomeDeviceList + device-list là landing (ritual vào detail). |

## Vấn đề đang chặn (Blockers)
- (tiềm ẩn) B1 native rebuild có thể cần Mac/Android SDK — nếu chưa sẵn sàng lúc test,
  dùng JS mock cho UI trước, đánh dấu "device round-trip deferred", verify khi build được.
