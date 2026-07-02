# Progress: Luồng Home → Device List → Pair → Detail (chuẩn Tuya SmartLife)

> `/dev`, `/test`, `/fix-plan` đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-mobile-home-device-flow`
- **Phase hiện tại:** `TEST` (code toàn bộ B0–B7 XONG; còn verify native trên thiết bị thật)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
Toàn bộ B0–B7 code XONG + verify JS (tsc clean · eslint 0 err · jest 15/15 test mới pass).
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
