# Progress: Mở rộng thư viện Tuya SDK theo từng module

> State machine của feature. `/dev` `/test` `/fix-plan` đọc đầu vào + cập nhật cuối mỗi lượt.
> Luôn giữ "Hành động kế tiếp" chính xác.

- **Slug:** `m1-tuya-sdk-expansion`
- **Phase hiện tại:** `TEST` (B2 code xong — chờ verify)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **B1 (code, type-review) + B2 (code) xong.** B2: base `ios/Common/TuyaEventEmitter` (RCTEventEmitter) +
`TuyaDevice`/`TuyaPairing` subclass + supportedEvents (bỏ no-op listeners). Android/JS không đổi.
**Chạy `/test`** — B1: `yarn typecheck`+`yarn test` (⏳ deferred no-network). B2: **iOS-only, build cần Mac+Xcode+pod**
→ sinh **checklist verify Mac** (event onDeviceStatus tới JS; RCTEventEmitter+TurboModule coexist) — deferred ở máy này.
**Sau đó `/dev` B3** (mở rộng TuyaAuth — profile/tempUnit/onSessionExpired/reset/cancel; onSessionExpired subclass TuyaEventEmitter).
⚠️ Trước B4/B7/B8 nên xin **product schema (dpId) bồn tắm đá** từ client.

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 — C0: TuyaErrors + error shape `{code,message,domain}` · **done (code; chờ /test)**
- [x] B2 — C1: iOS RCTEventEmitter (hạ tầng event) · **done (code; verify Xcode)**
- [ ] B3 — TuyaAuth (profile/tempUnit/onSessionExpired/reset/cancel/bind)
- [ ] B4 — TuyaDevice (rename/remove/reset/detail/snapshot+schema/queryDp/online/publishDpsAwaitAck/bleConnect)
- [ ] B5 — TuyaOta (check/start/cancel/confirm/autoSwitch + events)
- [ ] B6 — TuyaHome.updateHome/dismissHome
- [ ] B7 — TuyaScene (CRUD/execute/automation + build condition/action + onSceneChange)
- [ ] B8 — TuyaTimer (cloud schedule)
- [ ] B9 — TuyaMessage (push + message-center + DND)
- [ ] B10 — TuyaHome weather + listeners (onHomeChange)
- [ ] B11 — TuyaPairing combo BLE+Wi-Fi + auto-token
- [ ] B12 — (P3) TuyaMember
- [ ] B13 — (P3) TuyaPairing nâng cao (sub-device/gateway/QR/wired)
- [ ] B14 — (P3) TuyaMatter
- [ ] B15 — (P3) TuyaMesh/beacon

## Checklist AC (đồng bộ plan mục 3)
- [ ] AC1 Prereq (TuyaErrors + iOS event)
- [ ] AC2 Đợt 1 (Auth/Device/Ota/updateHome)
- [ ] AC3 Đợt 2 (Scene/Timer/Message/weather+listener/combo)
- [ ] AC4 Đợt 3 (tùy chọn)
- [ ] AC5 facade + README + tsc/lint
- [ ] AC6 test thiết bị thật (OTA/scene/timer/await-ack)

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-29 | DEV B2 | ✅ code | C1 iOS event infra: tạo `ios/Common/TuyaEventEmitter.{h,mm}` (`: RCTEventEmitter`; emit/supportedEvents/startObserving). `TuyaDevice`/`TuyaPairing` đổi superclass→TuyaEventEmitter, bỏ no-op addListener/removeListeners (kế thừa), thêm supportedEvents. Android/JS không đổi. **Verify Xcode** (RCTEventEmitter+TurboModule new-arch; fallback codegen EventEmitter nếu lỗi). |
| 2026-06-29 | TEST B1 | ⏳ deferred | `yarn typecheck`/`yarn test` KHÔNG chạy được: không có `node_modules`, `yarn install` timeout mạng (ETIMEDOUT) — môi trường không ra registry. **Đã type-review thủ công** (tsconfig `noUncheckedIndexedAccess`) → bắt & sửa 1 lỗi: `if(MAP[code]) return MAP[code]` không narrow → đổi sang biến cục bộ `cloud`/`sdk` trong `categoryOf`. Logic 8 test case khớp impl. Chạy thật khi có mạng. |
| 2026-06-29 | DEV B1 | ✅ code | C0: `src/errors.ts` (TuyaErrors: classify/isRetryable/describe; types TuyaError/TuyaErrorInfo/Category/Domain; bảng mã từ note error-codes; 1004 phân biệt theo domain; range 50500–50516) + export index.tsx + native reject helper Kotlin/ObjC + unit test errors.test.ts. **Chưa verify** (no node_modules/network). → `/test`. |
| 2026-06-29 | PLAN | ✅ | Tạo plan/context/progress (15 bước: C0/C1 prereq + module theo 3 đợt P1–P3) + đăng ký INDEX. Dựa trên research full-surface (11 note). Chưa code. |

## Vấn đề đang chặn (Blockers)
- **Build/test native:** cần JDK17 + Android SDK (Android) / Mac + Xcode (iOS) — máy hiện tại chưa có (như m1-tuya-sdk-library).
- **dpId/schema bồn tắm đá:** cần thiết bị thật + productId từ client → chặn AC device của B4/B7/B8.
- **Verify chữ ký:** nhiều API có 2 thế hệ + iOS chưa verbatim → verify trên reference khi code từng bước.
