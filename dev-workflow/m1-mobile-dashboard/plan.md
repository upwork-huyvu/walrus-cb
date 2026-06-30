# Kế hoạch: Mobile Dashboard — điều khiển bồn realtime (nhiệt độ + trạng thái)

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-mobile-dashboard`
- **Milestone:** M1 · Phần B5 (mobile)
- **Phần liên quan:** mobile (RN CLI) — tiêu thụ lib `@jimmy-vu/react-native-turbo-tuya`
- **Ngày tạo:** 2026-06-30
- **Cập nhật lần cuối:** 2026-06-30

## 1. Mục tiêu & phạm vi
Tạo **màn `DashboardScreen` riêng** (chuyển/nâng phần device control hiện nằm trong
[HomeScreen.tsx](../../apps/mobile/src/screens/HomeScreen.tsx)) thành **Dashboard điều khiển thật**: hiển thị
**nhiệt độ hiện tại** + **trạng thái online realtime**, **đặt nhiệt độ mục tiêu** (giới hạn theo **schema**
thiết bị), phản ánh cập nhật **DP realtime**, có **loading / error / offline** và **xác nhận**
(optimistic → ack). Dashboard tiêu thụ `devId` thật từ một **nguồn dùng chung** (pairing sẽ điền sau; giữ
**mock** khi chưa có thiết bị). Realtime **chỉ qua SDK (MQTT `onDeviceStatus`)** — không qua backend.

> **Gate ① đã chốt (2026-06-30):** ① realtime **chỉ SDK MQTT** (không backend); ② cleaning scheduler **tách
> feature riêng** (giữ panel local hiện tại); ③ **tách `DashboardScreen` riêng** (thêm route, không gộp HomeScreen).

**Ngoài phạm vi (không làm trong feature này):**
- Luồng **pairing** (`m1-mobile-pairing`) — dashboard chỉ **đọc** `devId`, không tự pair.
- **Lịch vệ sinh** (cleaning scheduler hiện tại) nối Tuya Timer / clean-DP thật — feature riêng (cần
  `TuyaTimer` + DP clean thật). Giữ nguyên panel local đang có.
- **Group / multi-control** — không hợp mô hình 1 ice-bath + DP value (theo research).
- **Chốt DP id / scale thật** — chờ client cấp schema; code viết **schema-driven** để tự thích nghi.
- Ghi **usage** về backend.

## 2. Bối cảnh & ràng buộc
- **Ràng buộc dự án:** Tuya **Data Center** phải trùng **Cloud Project** (EU / Central Europe); tài khoản
  link phải là **Owner** của Home; **RN CLI** (không Expo); **secrets** server/native-only; **EU data residency**.
- **Khả năng lib đã có** (đã verify trong `src/specs/NativeTuyaDevice.ts` + `src/index.tsx`):
  - `getDeviceSnapshot(devId)` → `{ devId, productId, dpsJson, isOnline, isLocalOnline, schemaJson, dpCodesJson }`.
  - `isDeviceOnline(devId)`, `isCloudConnected()`.
  - `publishDpsAwaitAck(devId, dpsJson, timeoutMs)` — publish **chờ `onDpUpdate` khớp** (đúng cho confirm).
  - Event `onDeviceStatus` payload `{ devId, isOnline?, dpsJson? }` — **mang cả online/offline lẫn DP update**.
  - ⚠️ Adapter app hiện tại ([services/tuya.ts](../../apps/mobile/src/services/tuya.ts)) **bỏ qua** `isOnline`/`schemaJson`
    và dùng `publishDps` fire-and-forget → feature này nâng adapter để tiêu thụ đủ.
- **Bị chặn phần cứng:** máy thiếu **JDK17 / Android SDK / Xcode** + **chưa pair thiết bị** → verify chủ yếu
  ở mức **tsc + jest** (pure-logic); các AC cần phần cứng **deferred**.
- **Link nghiên cứu liên quan:**
  - [docs/research/tuya-home-sdk-device-control.md](../../docs/research/tuya-home-sdk-device-control.md)
    (query DP, schema min/max/step/scale/unit, publish có ack, online 2 mức, cạm bẫy `onSuccess ≠ đổi xong`).
  - [docs/research/tuya-m1-sdk-foundation.md](../../docs/research/tuya-m1-sdk-foundation.md) (publishDps + listener cơ bản).

## 3. Tiêu chí hoàn thành (Acceptance Criteria)
> Kiểm chứng được. Đây là cái `/test` sẽ check.
- [ ] **AC1** — `devId` đọc từ **nguồn dùng chung** (deviceStore), **không** hardcode `''`. Không có thiết bị →
  empty state "pair"; có `devId` → load snapshot. *(jest store + logic render)*
- [ ] **AC2** — **Trạng thái kết nối** (`connecting | online | offline | error`) hiển thị trên UI, lấy từ
  `snapshot.isOnline` + field `isOnline` của event `onDeviceStatus`. *(jest reducer)*
- [ ] **AC3** — Đọc snapshot có vòng đời rõ: **loading** → hiển thị current/target/light; **lỗi đọc** → state
  `error` + nút **retry**. *(jest state machine)*
- [ ] **AC4** — Nút đặt **target temp** giới hạn theo **schema** (min/max/step/scale/unit) parse từ `schemaJson`;
  **fallback** range mặc định khi thiếu schema; clamp đúng biên. *(jest parse schema + clamp)*
- [ ] **AC5** — **Realtime:** event `onDeviceStatus` cập nhật current/target/light; set **optimistic** được
  **xác nhận** bằng ack/echo, hoặc **revert** sau timeout. *(jest fake timers)*
- [ ] **AC6 (phần cứng — deferred)** — Trên ice-bath thật đã pair: set target từ app → **bồn đổi** + UI hiện
  giá trị **confirmed** ≤ N giây; **ngắt mạng** thiết bị → UI chuyển **offline**. *(manual device checklist)*
- [ ] **AC7** — `tsc` pass + `jest` pass cho các module pure-logic mới; **không** Expo; **không** secret mới
  trong bundle.

## 4. Các bước thực hiện
> Mỗi bước nhỏ, làm được trong 1 lượt dev + test. Đánh số để `progress.md` tham chiếu.

1. **B1 — Parse schema + mở rộng model snapshot (pure logic)**
   - Việc: tạo `src/services/deviceSchema.ts` parse `schemaJson` → `tempRange { min, max, step, scale, unit }`
     + kiểu DP; mở rộng `DeviceSnapshot` của adapter để mang `isOnline` + `tempRange`. Khai báo type
     `ConnStatus = 'idle' | 'connecting' | 'online' | 'offline' | 'error'`.
   - File: `services/deviceSchema.ts` (+`.test.ts`), `services/dp.ts` (tái dùng), `services/tuya.ts`
     (`readDevice` trả thêm `isOnline` + `tempRange`).
   - Kiểm thử: `jest` (parse nhiều dạng schema + thiếu schema → fallback) + `tsc`.

2. **B2 — Nguồn `devId` dùng chung (deviceStore seam)**
   - Việc: `src/services/deviceStore.ts` (`getDeviceId`/`setDeviceId`/`subscribe`; seam để `m1-mobile-pairing`
     điền + persist sau). `useAppState` đọc `devId` từ store thay cho const `''`. Rỗng → adapter dùng mock.
   - File: `services/deviceStore.ts` (+`.test.ts`), `state/useAppState.ts`.
   - Kiểm thử: `jest` (set → get → subscribe phát thông báo) + `tsc`.

3. **B3 — Máy trạng thái kết nối + loading/error**
   - Việc: tách **reducer thuần** `src/state/deviceMachine.ts` (`connecting → online/offline/error`, cờ
     `loading`, action `retry`). `connectDevice`: `connecting → read → online/offline/error`. Adapter
     `listenDevice` forward **cả** `isOnline`.
   - File: `state/deviceMachine.ts` (+`.test.ts`), `state/useAppState.ts`, `services/tuya.ts`.
   - Kiểm thử: `jest` (các chuyển trạng thái) + `tsc`.

4. **B4 — Target temp theo schema + optimistic reconcile (ack)**
   - Việc: `setTargetTemp` clamp theo `tempRange` (schema) + đánh dấu **pending**; dùng `publishDpsAwaitAck`
     để **confirm**, **revert/timeout** nếu không ack. Tách hàm `reconcile` thuần để test.
   - File: `state/deviceMachine.ts` (+`.test.ts`), `services/tuya.ts` (`setTargetTemp` dùng awaitAck + trả
     kết quả thành/bại), `state/useAppState.ts`.
   - Kiểm thử: `jest` fake timers (ack confirm / timeout revert) + `tsc`.

5. **B5 — Màn `DashboardScreen` riêng + UI (status + loading + error + schema bounds)**
   - Việc: tạo `screens/DashboardScreen.tsx` + thêm `'dashboard'` vào `ScreenName` (`navigation.ts`) + route
     trong `App.tsx`; chuyển phần **device control** từ `HomeScreen` sang Dashboard (Home giữ **summary gọn** +
     nút **"Open dashboard →"** điều hướng sang). Tách `components/DeviceCard.tsx` + `components/StatusPill.tsx`:
     render `connecting/online/offline/error`, loading skeleton, error + retry, nút +/- theo `min/max/step` +
     hiện `unit`, chỉ báo **pending**. **Giữ nguyên** cleaning panel (theo Gate ① — tách feature riêng).
   - File: `screens/DashboardScreen.tsx` (mới), `screens/HomeScreen.tsx`, `navigation.ts`, `App.tsx`,
     `components/DeviceCard.tsx` (mới), `components/StatusPill.tsx` (mới).
   - Kiểm thử: `tsc` + `jest` (render-logic nếu test được) + **manual** (chưa có thiết bị).

6. **B6 — Checklist round-trip phần cứng (AC6)**
   - Việc: soạn checklist device-test (set temp confirmed; offline khi ngắt mạng; realtime echo) vào
     `progress.md` cho lúc có **build native + thiết bị + schema thật**.
   - File: `progress.md`.
   - Kiểm thử: manual / deferred.

## 5. Rủi ro & câu hỏi mở
- ⚠️ **`devId` phụ thuộc pairing** (`m1-mobile-pairing` chưa làm) → giảm thiểu bằng **deviceStore seam** +
  mock; **đề xuất làm pairing trước**, nhưng dashboard **không chặn cứng** (mock chạy được).
- ⚠️ **DP id / scale vẫn placeholder** tới khi client cấp schema thật → code **schema-driven** tự thích nghi;
  **AC6 cần schema thật**. → **Cần client cung cấp DP schema của bồn.**
- ⚠️ **Tuya value-DP thường có `scale`** (vd raw `60` = `6.0°C` khi scale=1) → phải áp `scale` khi hiển thị /
  clamp; chưa biết scale tới khi có schema → B1 xử lý scale tổng quát, mặc định `scale=0`.
- ⚠️ **Build native + thiết bị bị chặn** (JDK17/SDK/Xcode + chưa pair) → AC6 deferred; AC1–AC5/AC7 verify bằng tsc+jest.
- ✅ **(đã chốt)** "Status real-time" **chỉ qua SDK MQTT** (`onDeviceStatus`) — không backend.
- ✅ **(đã chốt)** Cleaning scheduler **tách feature riêng** (Tuya Timer) — giữ panel local hiện tại.
- ✅ **(đã chốt)** **Tách `DashboardScreen` riêng** (thêm route + `ScreenName 'dashboard'`); Home giữ summary +
  nút điều hướng. ⚠️ Hệ quả: B5 đụng `navigation.ts` + `App.tsx` (router tự viết) → test kỹ điều hướng.
