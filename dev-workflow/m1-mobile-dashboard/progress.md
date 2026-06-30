# Progress: Mobile Dashboard — điều khiển bồn realtime

> `/dev`, `/test`, `/fix-plan` đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-mobile-dashboard`
- **Phase hiện tại:** `DEV` (B1–B6 code XONG; verify tsc/jest deferred)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-30

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **B1–B6 XONG code** (schema parse → reducer status/loading/error → optimistic ack → DashboardScreen + DeviceCard +
StatusPill + CleaningPanel + route). `tsc`/`jest` **deferred** (apps/mobile chưa `node_modules`, không có jest binary,
registry chặn) → đã **type-review thủ công**.
**Còn lại để feature chạy/đo được:**
1. ⛔ **BLOCKER có sẵn (không thuộc dashboard):** thiếu module `apps/mobile/src/lib/format` (xuất `LOGO_URI`,
   `LOGO_URI_LIGHT`, `formatTime`) → App + 4 screen (Home/Splash/OnboardWelcome/Session) **không compile**. Cần khôi
   phục file này (URL logo Dropbox từ scaffold) trước khi build/chạy. **Tôi không bịa URL.**
2. ⏳ Khi có mạng: `yarn install` ở `apps/mobile` → chạy `jest` (deviceSchema + deviceMachine) + `tsc`.
3. ⏳ **AC6** device round-trip: cần build native (JDK17/SDK/Xcode) + thiết bị pair + **DP schema thật** (xem checklist B6).

## Checklist các bước (đồng bộ plan.md mục 4)
- [x] B1 — Parse schema + mở rộng snapshot (`services/deviceSchema.ts` +test; `tuya.ts` readDevice trả isOnline+tempRange) · **code xong**
- [x] B2 — Nguồn `devId` dùng chung · **DONE-by-pairing** (`services/deviceStore.ts` + `useAppState` đọc store đã có từ `m1-mobile-pairing`; dashboard tái dùng)
- [x] B3 — Máy trạng thái kết nối + loading/error (`state/deviceMachine.ts` +test; wire `useAppState` + `tuya.listenDevice` forward isOnline) · **code xong**
- [x] B4 — Target temp theo schema + optimistic reconcile (`tuya.setTargetTemp`→`publishDpsAwaitAck` trả bool; reducer pending/ack/timeout) · **code xong**
- [x] B5 — `DashboardScreen` + `DeviceCard` + `StatusPill` + `CleaningPanel` + route (`navigation.ts`/`App.tsx`; Home→summary) · **code xong**
- [x] B6 — Checklist round-trip phần cứng (AC6) · **soạn xong** (mục bên dưới)

## Checklist tiêu chí hoàn thành (đồng bộ plan.md mục 3)
- [◑] AC1 — `devId` từ deviceStore (không hardcode); empty state khi chưa pair · **code xong** (verify chờ jest/build)
- [◑] AC2 — Trạng thái connecting/online/offline/error (StatusPill + reducer + event isOnline) · **code xong**
- [◑] AC3 — loading → data; lỗi đọc → error + retry · **code xong** (readDevice rethrow lỗi thật → connectError)
- [◑] AC4 — Target temp theo schema (min/max/step/scale/unit) + fallback + clamp · **code xong** (raw-unit + formatTemp)
- [◑] AC5 — Realtime cập nhật + optimistic confirm/revert · **code xong** (reducer + ack bool)
- [ ] AC6 — (phần cứng, deferred) round-trip set temp + offline trên bồn thật · ⏳ chờ build+thiết bị+schema
- [◑] AC7 — `tsc`+`jest` pass; không Expo; không secret mới · **jest/tsc deferred**; không Expo ✓; không secret ✓

## Checklist kiểm thử phần cứng (B6 — AC6, chạy khi có build native + thiết bị + DP schema thật)
> Tiền đề: đã `yarn install`; build native (Android JDK17+SDK / iOS Xcode); đã pair 1 bồn (devId thật trong deviceStore);
> đã thay **DP id thật** trong `services/dp.ts` + xác nhận **scale** thật của schema.
- [ ] **HW1 — Đọc snapshot:** mở Dashboard → CURRENT/TARGET hiện đúng giá trị thật của bồn (không phải mock 12/6);
  StatusPill = ONLINE.
- [ ] **HW2 — Set target (ack):** bấm +/- đổi target → DP gửi xuống bồn; bồn đổi setpoint; UI hiện "đang gửi…" rồi
  **confirmed** (mất pending) khi `onDpUpdate`/ack về ≤ ~5s.
- [ ] **HW3 — Revert khi không ack:** ép lỗi (bồn offline lúc set) → sau timeout UI **revert** target cũ + báo lỗi.
- [ ] **HW4 — Đèn:** toggle LIGHT → đèn bồn đổi; trạng thái UI khớp echo.
- [ ] **HW5 — Realtime ngoài app:** đổi nhiệt/đèn từ app Tuya/Smart Life khác → Dashboard cập nhật trong vài giây.
- [ ] **HW6 — Offline/online:** ngắt nguồn/Wi-Fi bồn → StatusPill = OFFLINE, control mờ/khoá; cắm lại → ONLINE.
- [ ] **HW7 — Schema bounds:** +/- không vượt min/max của schema thật; bước nhảy = step thật; hiển thị đúng scale+unit.
- [ ] **HW8 — Lỗi đọc:** devId sai/không thuộc Home → state `error` + nút "Thử lại" hoạt động.

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-06-30 | DEV B5+B6 | ✅ code / ⏳ verify | **B5** tạo `components/StatusPill.tsx` (chip conn-status), `components/DeviceCard.tsx` (status+loading+error/retry+offline+stepper theo schema+pending "đang gửi…"), `components/CleaningPanel.tsx` (chuyển nguyên panel cleaning local từ Home — Gate① tách feature riêng), `screens/DashboardScreen.tsx` (header back + DeviceCard + CleaningPanel + empty-state pair). Route: `navigation.ts` +`'dashboard'`, `App.tsx` +case. `HomeScreen` device-card → **summary gọn** (StatusPill + current/target read-only + "Open dashboard →"); bỏ toàn bộ state/handler cleaning. **B6** soạn checklist HW1–HW8. **TEST:** không có jest binary + chưa `node_modules` → type-review. ⚠️ **Phát hiện blocker có sẵn:** thiếu `src/lib/format` (LOGO_URI/…); fix type `snap` trong deviceMachine.test (Partial<Snapshot>). |
| 2026-06-30 | DEV B1–B4 | ✅ code / ⏳ verify | **B1** `services/deviceSchema.ts`(+test): `parseTempRange` (raw min/max/step + scale + unit, tolerant array/object, fallback DEFAULT), `clampToRange`, `formatTemp` (chia 10^scale khi hiển thị). `tuya.ts`: `DeviceSnapshot`/`DevicePatch` +`isOnline`/`tempRange`; `readDevice` parse schema+online + **rethrow lỗi thật**; `listenDevice` forward `isOnline`. **B2** = đã có sẵn từ pairing (deviceStore + useAppState đọc store) → tái dùng. **B3** `state/deviceMachine.ts`(+test): reducer thuần ConnStatus+loading/error+reconcile; wire `useAppState` (useReducer, connectStart/Ok/Error, dpPatch, retry). **B4** `setTargetTemp`→`publishDpsAwaitAck` trả bool → dispatch ackResolved/ackTimeout; optimistic pending + revert. **Quyết định scale:** giữ RAW trong state (clamp/publish), chỉ chia scale khi hiển thị (`formatTemp`). |
| 2026-06-30 | PLAN + Gate① | ✅ | Plan 6 bước; chốt: realtime chỉ SDK MQTT, cleaning tách riêng, **tách DashboardScreen riêng**. |

## Vấn đề đang chặn (Blockers)
- ⛔ **Thiếu module `apps/mobile/src/lib/format`** (xuất `LOGO_URI`, `LOGO_URI_LIGHT`, `formatTime`) — không có trên đĩa,
  `apps/mobile` không được git track nên không restore từ git. App + Home/Splash/OnboardWelcome/Session **không compile**.
  Đây là **gap có sẵn từ scaffold**, không do dashboard. Cần khôi phục (URL logo từ client/scaffool) — **không bịa**.
- **Verify:** chưa `node_modules` + không jest binary + registry chặn → `jest`/`tsc` chạy khi có mạng (`yarn install`).
- **Phần cứng:** AC6 chờ build native (JDK17/SDK/Xcode) + thiết bị pair + **DP schema thật** (id + scale + min/max/step/unit).
