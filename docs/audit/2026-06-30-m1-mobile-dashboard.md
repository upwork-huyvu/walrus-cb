# Báo cáo Audit — feature `m1-mobile-dashboard` — 2026-06-30

- **Phạm vi:** các file feature dashboard vừa code (theo `dev-workflow/m1-mobile-dashboard/context.md`):
  `apps/mobile/src/services/deviceSchema.ts`, `services/tuya.ts` (sửa), `state/deviceMachine.ts`,
  `state/useAppState.ts` (sửa), `components/{StatusPill,DeviceCard,CleaningPanel}.tsx`,
  `screens/DashboardScreen.tsx`, `screens/HomeScreen.tsx` (sửa), `navigation.ts`, `App.tsx`, `lib/format.ts` (khôi phục).
  Tham chiếu (đọc, không thuộc scope sửa): `services/dp.ts`, `services/deviceStore.ts`.
- **Stack phát hiện:** React Native CLI (RN 0.85, no Expo) + Tuya Smart Life SDK qua lib `@jimmy-vu/react-native-turbo-tuya` (adapter mock).
- **Checklist áp dụng:** `react-native.md`, `tuya-sdk.md`, `security-secrets.md`.
- **Người/agent audit:** Claude (inline) · **Ngày:** 2026-06-30
- **Lưu ý:** read-only — không sửa code; các finding feed vào `/fix-plan` hoặc `/dev`.

## Tóm tắt
| Mức | Số lượng |
|---|---|
| 🔴 Critical | 0 |
| 🟠 High | 2 |
| 🟡 Medium | 4 |
| 🔵 Low/Nit | 3 |

**3 vấn đề ưu tiên xử lý:**
1. **H-1** — SDK error code bị nuốt, không log + thông báo lỗi không phân biệt (wrong region / not owner / offline / token).
2. **H-2** — DP id/type vẫn là **placeholder**, chưa khớp schema bồn thật → điều khiển sẽ không chạy trên thiết bị thật.
3. **M-1** — Nút +/- target **không debounce** → mỗi lần bấm bắn 1 `publishDpsAwaitAck`, bấm nhanh = nhiều lệnh/đua ack.

## Phát hiện chi tiết

### [🟠 H-1] SDK error code bị nuốt, thiếu log + thông báo lỗi không phân biệt
- **Vị trí:** `apps/mobile/src/services/tuya.ts:44-51, 77-89, 91-98, 100-134`; `apps/mobile/src/state/useAppState.ts:62-69`
- **Checklist:** tuya-sdk ("SDK error codes surfaced (logged + user-facing), never swallowed with empty catch"; "Distinct, actionable messages for wrong region / not owner / token expired / device offline"); react-native (loading+error+**SDK error code logged**)
- **Bằng chứng:** `tuya.ts` có **0** lệnh `console.*`; mọi catch nuốt lỗi không log:
  ```ts
  export async function setTargetTemp(...): Promise<boolean> {
    try { ...await lib.Tuya.publishDpsAwaitAck(...) ; return true; }
    catch { return false; }            // nuốt — mất error code
  }
  export async function setLight(...) { try {...} catch { /* nuốt — UI đã optimistic */ } }
  export async function initSdk()     { try {...} catch { return false; } }
  ```
  và thông báo lỗi connect gom chung:
  ```ts
  // useAppState.ts
  error: e instanceof Error ? e.message : 'Không đọc được thiết bị',
  ```
- **Vì sao sai / rủi ro:** mất hoàn toàn mã lỗi Tuya (vd `-1` SDK chưa init, `-60` MQTT chưa kết nối, `-1400` DP sai,
  `-10001` device offline, "not Home owner", region mismatch). Người dùng chỉ thấy "đang gửi… → revert" hoặc message
  thô của native, không biết vì sao; dev không debug được. Lib **đã có** `src/errors.ts` map code → thông điệp nhưng app không dùng.
- **Cách sửa đề xuất:** trong adapter, log error (ít nhất ở `__DEV__`) kèm code; trả về error có cấu trúc `{ ok:false, code, message }`
  thay vì `boolean`/nuốt; dùng bảng map của lib (`errors.ts`) để hiện thông báo phân biệt (sai region / không phải Owner /
  token hết hạn / thiết bị offline / sai băng tần Wi-Fi). `ackTimeout` nên kèm lý do thật thay vì message cố định.

### [🟠 H-2] DP id/type là placeholder — chưa khớp schema bồn thật
- **Vị trí:** `apps/mobile/src/services/dp.ts:3-7` (+ tiêu thụ ở `deviceSchema.parseTempRange` qua `DP.targetTemp`)
- **Checklist:** tuya-sdk ("map vào DP IDs/types thật của sản phẩm — verified, not guessed"; "value ranges/steps respected")
- **Bằng chứng:**
  ```ts
  export const DP = {
    currentTemp: '105', // ⚠️ placeholder
    targetTemp: '104',  // ⚠️ placeholder
    light: '101',       // ⚠️ placeholder
  } as const;
  ```
  `parseDeviceDps` đọc `lightOn` chỉ khi `typeof === 'boolean'` — nhiều đèn Tuya là enum/string.
- **Vì sao sai / rủi ro:** nếu id/kiểu sai, `publishDps`/đọc snapshot **không tác động đúng DP** → bồn không đổi, hoặc lỗi `-1400`.
  Đây là rủi ro chức năng lõi của dashboard. (Đã được tracked: AC6 + blocker "cần DP schema thật"; chưa phải lỗi đã ship.)
- **Cách sửa đề xuất:** lấy **DP schema thật** từ client/Tuya console (id + type + scale + min/max/step/unit), thay 1 chỗ ở `dp.ts`;
  với đèn xác nhận bool vs enum. Cho tới khi có schema, đánh dấu rõ controls là "chưa kiểm chứng trên thiết bị".

### [🟡 M-1] Nút +/- target không debounce trước khi publish
- **Vị trí:** `apps/mobile/src/components/DeviceCard.tsx:30-33` (`bump`) → `state.setTargetTemp` → `useAppState.ts:85-91` → `tuya.publishDpsAwaitAck`
- **Checklist:** tuya-sdk ("Rapid control input (temp slider) debounced before publishing")
- **Bằng chứng:**
  ```ts
  const bump = (delta) => { if (target == null) return; state.setTargetTemp(target + delta); };
  // setTargetTemp: dispatch optimistic + void tuyaSetTargetTemp(...).then(ack→...)
  ```
- **Vì sao sai / rủi ro:** mỗi tap gửi 1 lệnh `publishDpsAwaitAck` (chờ ack riêng). Bấm nhanh từ 6→10°C = 4 lệnh + 4 ack đua nhau;
  tốn băng thông MQTT/BLE, thiết bị xử lý liên tiếp, và pending/timeout chồng (dù reducer chỉ giữ pending mới nhất). Tuya khuyến nghị debounce.
- **Cách sửa đề xuất:** giữ optimistic-UI tức thời (cập nhật target ngay), nhưng **debounce trailing ~400ms** việc publish — chỉ
  publish giá trị cuối cùng. Pending/ack tính theo giá trị publish thật.

### [🟡 M-2] Không có timeout cho `getDeviceSnapshot`/`readDevice` → có thể kẹt `connecting`/loading
- **Vị trí:** `apps/mobile/src/services/tuya.ts:58-69` (`readDevice` await `lib.Tuya.getDeviceSnapshot` không timeout); `useAppState.ts:57-69`
- **Checklist:** react-native ("timeouts on network/pairing operations"; "offline... rather than hanging")
- **Bằng chứng:**
  ```ts
  const snap = await lib.Tuya.getDeviceSnapshot(devId); // không có race-timeout
  ```
  reducer set `status:'connecting', loading:true` ở `connectStart`; nếu promise native không bao giờ resolve → kẹt mãi.
- **Vì sao sai / rủi ro:** thiết bị/mạng treo → UI ở trạng thái loading vô hạn, không có đường thoát (không tự rơi về error).
- **Cách sửa đề xuất:** bọc `Promise.race([getDeviceSnapshot, timeout(ms)])`; hết giờ → `connectError('timeout')` để hiện retry.

### [🟡 M-3] Realtime DP update không throttle; `DeviceCard` không memo → re-render toàn card mỗi event
- **Vị trí:** `apps/mobile/src/state/useAppState.ts:93-99` (`listenDevice → dispatch dpPatch` mỗi event); `components/DeviceCard.tsx` (inline style/closure, không `React.memo`)
- **Checklist:** react-native ("Device-status updates throttled/debounced before hitting state"; "no new inline objects/functions on high-frequency updates e.g. live temperature"; "expensive children memoized")
- **Bằng chứng:**
  ```ts
  const sub = listenDevice(devId, (p) => dispatch({ type: 'dpPatch', patch: p }));
  ```
  `DeviceCard` tạo mới object style + arrow fn (`bump`, onPress) mỗi render; không memo.
- **Vì sao sai / rủi ro:** với ice-bath tần suất DP thấp nên tác động nhỏ, nhưng đúng cảnh báo checklist: echo dày (vd khi đang đổi nhiệt) gây re-render full card liên tục.
- **Cách sửa đề xuất:** throttle patch (vd gộp 250–500ms) hoặc chỉ dispatch khi giá trị đổi; cân nhắc `React.memo` cho `DeviceCard` + `useCallback` cho handler nếu sau này nhúng vào list/parent re-render nhiều.

### [🟡 M-4] `CleaningPanel`: `setInterval` không được clear khi unmount (timer leak + setState sau unmount)
- **Vị trí:** `apps/mobile/src/components/CleaningPanel.tsx:38-50` (`startCleaning`)
- **Checklist:** react-native ("no unhandled... ", reliability/cleanup); chung về lifecycle
- **Bằng chứng:**
  ```ts
  cleanTimerRef.current = setInterval(() => { ...setCleanCountdown(secs); ... }, 1000);
  // chỉ clearInterval khi secs<=0; KHÔNG có useEffect cleanup clear khi unmount
  ```
- **Vì sao sai / rủi ro:** nếu rời Dashboard lúc đang "Cleaning…", interval tiếp tục chạy → `setState` trên component đã unmount
  (cảnh báo React + leak tới khi đếm về 0). (Lỗi này mang sang từ HomeScreen gốc, nay nằm ở CleaningPanel.)
- **Cách sửa đề xuất:** thêm `useEffect(() => () => { if (cleanTimerRef.current) clearInterval(cleanTimerRef.current); }, [])` để clear khi unmount.

### [🔵 L-1] Inline style/closure khắp các component (đồng bộ pattern dự án)
- **Vị trí:** `DeviceCard.tsx`, `DashboardScreen.tsx`, `StatusPill.tsx`, `HomeScreen.tsx`
- **Checklist:** react-native (performance)
- **Bằng chứng:** style object viết inline mọi nơi (đúng phong cách clone từ replit).
- **Vì sao / rủi ro:** tác động nhỏ ở quy mô hiện tại; chỉ đáng tối ưu nếu vào list lớn / update tần suất cao (xem M-3).
- **Cách sửa đề xuất:** để sau; nếu tối ưu thì gom `StyleSheet.create` cho các style tĩnh.

### [🔵 L-2] Không refresh trạng thái khi app trở lại foreground
- **Vị trí:** `apps/mobile/src/state/useAppState.ts` (chỉ subscribe listener; không nghe RN `AppState`)
- **Checklist:** tuya-sdk ("background/foreground transitions re-establish device connections / refresh status")
- **Vì sao / rủi ro:** rời app lâu → MQTT có thể rớt / trạng thái cũ; quay lại không tự `getDeviceSnapshot`/kiểm online.
- **Cách sửa đề xuất:** thêm listener `AppState 'active'` → gọi lại `connectDevice()`/`isDeviceOnline` để refresh.

### [🔵 L-3] `devId` lưu AsyncStorage plaintext (chấp nhận được, nhưng lưu ý token tương lai)
- **Vị trí:** `apps/mobile/src/services/deviceStore.ts` (pre-existing từ pairing)
- **Checklist:** security-secrets ("tokens at rest in Keychain/Keystore, not AsyncStorage plaintext")
- **Vì sao / rủi ro:** `devId` chỉ là **định danh thiết bị**, không phải secret → rủi ro thấp, OK. Nhưng **session token Tuya/Supabase**
  (feature auth sắp tới) **không được** để AsyncStorage plaintext.
- **Cách sửa đề xuất:** giữ devId ở AsyncStorage; khi làm auth, dùng Keychain/Keystore (vd `react-native-keychain`) cho token.

## Mục đã kiểm — ĐẠT
- **Optimistic UI reconcile** (tuya-sdk): `deviceMachine` xử lý pending → confirm bằng echo/ack, revert khi timeout — **đúng chuẩn**, có test.
- **Listener đăng ký/huỷ đúng**: `useAppState` effect trả `sub.remove()`; deps `[deviceConnected, devId]` không gây đăng ký trùng.
- **isOnline phản ánh UI**: `StatusPill` + reducer dùng `snapshot.isOnline` + `onDeviceStatus.isOnline`; offline khoá control.
- **Tách tầng UI / service / state** rõ; native call không gọi thẳng từ view (`DeviceCard → state → tuya`).
- **Error boundary**: `App.tsx:111` bọc `<ErrorBoundary>` quanh screen.
- **Không Expo** trong scope; **không secret** rò rỉ (grep `service_role`/`AppSecret`/JWT/private key trong `apps/mobile/src` = 0 hit); `lib/format` chỉ chứa URL logo công khai (https).
- **Navigation typed**: `ScreenName` union + route `dashboard` thêm đúng.

## Mục cần xác minh thủ công (không kết luận được khi đọc code)
- DP schema thật (id/type/scale/min/max/step/unit) — cần thiết bị + Tuya console (gắn H-2).
- Data Center SDK ↔ Cloud Project (EU/Central Europe) — thuộc init SDK ở lib, không nằm trong scope dashboard; verify khi build.
- Hành vi realtime/online thật, round-trip set temp + ack timing — cần build native + bồn thật (checklist HW1–HW8 trong progress.md).
- `Info.plist`/Android manifest permissions (Location/BLE/Local Network) — thuộc feature pairing/permissions, không phải dashboard.

## Việc cần làm tiếp (feed vào /fix-plan hoặc /dev)
- [ ] **H-1** — Adapter trả error có code + log (`__DEV__`) + map qua lib `errors.ts`; thông báo phân biệt region/owner/offline/token.
- [ ] **H-2** — Lấy & cắm DP schema thật vào `dp.ts`; xác nhận kiểu đèn (bool/enum). (Chờ client — đang tracked.)
- [ ] **M-1** — Debounce (~400ms trailing) việc publish target khi bấm +/-; giữ optimistic tức thời.
- [ ] **M-2** — Thêm timeout cho `readDevice`/`getDeviceSnapshot` → rơi về `error` thay vì kẹt loading.
- [ ] **M-3** — Throttle/diff DP patch trước khi vào state; cân nhắc memo `DeviceCard`.
- [ ] **M-4** — `useEffect` cleanup clear `setInterval` trong `CleaningPanel` khi unmount.
- [ ] **L-2/L-3** — (sau) refresh khi foreground; token tương lai dùng Keychain.
