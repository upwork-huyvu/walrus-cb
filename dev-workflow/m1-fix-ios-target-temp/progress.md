# Progress: Sửa lỗi không đổi được nhiệt độ mục tiêu trên iOS

> File quản lý tiến trình (state machine của feature). `/dev`, `/test`, `/fix-plan`
> đọc đầu vào và cập nhật cuối mỗi lượt. Luôn giữ phần "Hành động kế tiếp" chính xác.

- **Slug:** `m1-fix-ios-target-temp`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-22 23:05

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**B4 - cần người:** build iOS mới (có đụng native `TuyaDevice.mm` ⇒ JS-only reload KHÔNG đủ) ở đường dẫn
**ngoài iCloud**, đẩy TestFlight, gửi khách checklist dưới đây. Kết quả echo DP 115 → ghi vào `context.md` (AC7).

**Checklist cho khách (iPhone, bồn thật, bật máy):**
1. Mở Device Detail → đợi pill ONLINE, target hiện 4.0 (hoặc số đang đặt).
2. Bấm `+` một lần → số lên 4.5 và **đứng yên**, không có dòng lỗi đỏ (AC1).
3. Nhìn mặt máy / mở Smart Life → nhiệt độ cài đặt phải là 4.5 (AC1).
4. Bấm `−` về lại số cũ → như bước 2–3.
5. (Dev làm, không phải khách) ngay sau bước 2 đọc `setting_temp` qua Tuya Cloud (admin web / console Tuya →
   status) rồi decode: word0 phải = 45, ghi lại **word1 là 40 hay 45** (AC7). Log `[DP]` (`logDpUpdate`) chỉ
   chạy ở bản dev ⇒ bản TestFlight của khách KHÔNG in ra, đừng trông vào nó.
6. Bấm `+` liên tục tới 15.0 rồi thêm 1 lần → không được hiện lỗi đỏ (rủi ro biên, xem plan §5).

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - iOS native `publishDpsAwaitAck`  · done (compile ✓ simulator; runtime chờ B4)
- [x] B2 - JS fallback khi native chưa wire  · done
- [x] B3 - Sửa layout DP 114/115 theo spec  · done
- [ ] B4 - Verify trên iPhone của khách (TestFlight)  · blocked (cần build iOS + khách test)

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [ ] AC1 - iPhone: +/- giữ số mới, không banner lỗi, máy/Smart Life thấy target mới  · ⏳ chờ test thiết bị
- [ ] AC2 - iOS `publishDpsAwaitAck`: ack theo dpId / `ack_timeout` / `publish_dps_error`  · code + compile ✓, ⏳ runtime
- [x] AC3 - JS fallback `ios_todo`/`not_implemented` → `publishDps`; lỗi khác giữ hành vi cũ (unit test)
- [x] AC4 - Payload DP 115 chỉ đổi word0 (`{"115":"002d0028ffff…"}` trong test adapter + test codec cũ)
- [x] AC5 - Layout 114/115 đúng spec trong code/doc; không lấy cặp °F làm biên °C (unit test mobile + backend)
- [x] AC6 - mobile tsc/eslint/jest xanh; backend jest (device-dp) xanh
- [ ] AC7 - iPhone: ghi nhận echo DP 115 (word1 S1 °F) sau lần ghi đầu  · ⏳ chờ test thiết bị

## Nhật ký chạy (Run log) - mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-22 23:05 | TEST B1–B3 | ✅ | **mobile:** `npx tsc --noEmit` exit 0 · `npx eslint` 5 file của feature: 0 lỗi (còn warning `no-bitwise` + directive thừa có từ trước ở `dp.ts`/`tuya.ts`, không phải dòng mới) · `npx jest` **29/29 suite, 387/387 test** (gồm cả test của `m1-fix-device-connect-error` đang làm song song). **backend:** `npx jest src/devices` **26/26** · `npx eslint` device-dp 2 file sạch (đã `prettier --write` spec). **native:** `xcodebuild -scheme TurboTuya -sdk iphonesimulator CODE_SIGNING_ALLOWED=NO` → **BUILD SUCCEEDED**, `TuyaDevice.mm` compile x86_64 + arm64, **0 warning/0 error** trong file. |
| 2026-09-22 22:55 | DEV B3 | ✅ | `dp.ts#readRawTempRange` + `device-dp.ts#readTempRange` đi theo 4 word/sensor, chỉ đọc cặp °C; comment layout + research doc đính chính; test mobile/backend cập nhật (bồn thật vẫn ra 2.0–15.0 °C). |
| 2026-09-22 22:40 | DEV B2 | ✅ | `tuya.ts`: `publishAwaitingAck` + `NOT_WIRED_CODES` (`ios_todo`/`not_implemented`) dùng `extractCode`; test mới `tuya.targetTemp.test.ts` 7 case. Lần chạy full suite đầu fail 2 case vì phiên song song đổi `tuyaError.ts` (thêm bảng `LITERAL` → message tiếng Anh) ⇒ sửa test tính message kỳ vọng qua `describeTuyaError`, không hardcode. |
| 2026-09-22 22:30 | DEV B1 | ✅ | `TuyaDevice.mm`: bỏ stub, thêm `TuyaDpsAckWaiter` + `publishDpsAwaitAck` thật. Build lần 1 fail ở `ReactCodegen` (file `*-generated.mm` chưa có khi compile - script codegen chạy song song, không liên quan code mới); build lần 2 ✓. |
| 2026-09-22 22:20 | PLAN | ✅ | Tạo plan 4 bước từ chẩn đoán feedback khách (iOS). Gate ① duyệt trong chat ("sửa theo ý mày đi"). |

## Vấn đề đang chặn (Blockers)
- **B4:** cần build iOS mới ở đường dẫn ngoài iCloud (repo đang ở `~/Documents` ⇒ codesign hỏng, xem memory
  iCloud) + khách chạy checklist trên bồn thật. Không làm được từ máy dev.
