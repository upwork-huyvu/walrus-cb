# Progress: Verify 4 tính năng điều khiển khách yêu cầu

- **Slug:** `m1-verify-device-controls`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-09-23 (B1-B5 xong & CI xanh; chờ build 1.0.6 + khách test)

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
**Build IPA 1.0.6 rồi đưa khách test theo checklist B6 bên dưới.** Đây là việc CHẶN: bản 1.0.4 khách
đang cầm có native còn stub ⇒ đổi nhiệt độ và clean cycle **không thể** chạy, dù JS đã đúng.

## Checklist các bước (đồng bộ với plan.md mục 4)
- [x] B1 - Rà đường code 4 tính năng · done
- [x] B2 - Vá "đổi tên lúc pair" (bỏ adapter yếu ở `pairing.ts`) · done
- [x] B3 - Vá "lỗi câm" của công tắc (`controlError` + `toggleBool`) · done
- [x] B4 - `tuya.control.test.ts` + 2 case reducer · done
- [x] B5 - tsc + eslint + jest · done
- [ ] B6 - Build 1.0.6 + verify máy thật · pending

## Checklist tiêu chí hoàn thành (đồng bộ với plan.md mục 3)
- [x] AC1 nhiệt độ · [x] AC2 clean cycle · [x] AC3 rename lúc pair · [x] AC4 đèn
- [x] AC5 an toàn DP · [x] AC6 CI xanh · [ ] AC7 verify iPhone 1.0.6

## B6 - Checklist verify trên máy thật (iPhone, build 1.0.6)

**① Nhiệt độ**
- [ ] Mở Device Detail → gauge hiện nhiệt độ THẬT (một chữ số thập phân, vd `6.4`), Target `4.0°C`.
- [ ] Bấm `+` vài lần → số target tăng theo bước 0.5; chỉ gửi **một** lệnh sau khi ngừng bấm (debounce 400ms).
- [ ] Sau ~vài giây máy phản hồi → target hết mờ (đã ack). Mở **Smart Life** đối chiếu cùng giá trị.
- [ ] Thử vượt biên: giữ `+` → dừng ở **15.0**; giữ `−` → dừng ở **2.0**.
- [ ] Tắt Wi-Fi bồn → đổi target → phải hiện **lý do lỗi** và target quay về giá trị cũ.

**② Chu trình vệ sinh (mục CLEANING)**
- [ ] "Run clean cycle now" → xác nhận 2 lần → nút lá bật, card hiện `Cleaning… until HH:mm`.
- [ ] Mở Smart Life → thấy **timer hẹn tắt** đúng giờ đó.
- [ ] Đợi hết giờ (hoặc đặt 15 phút) → máy **tự tắt** khử trùng.
- [ ] EDIT → chọn ngày + giờ + độ dài → Save → Smart Life thấy **2 timer lặp** (bật, tắt) đúng ngày.
- [ ] Tắt app hoàn toàn rồi mở lại → card vẫn hiện đúng lịch (đọc lại từ cloud).
- [ ] ⚠️ Đối chiếu **múi giờ**: giờ hẹn trên Smart Life có khớp giờ mình chọn trong app không.

**③ Đổi tên lúc kết nối**
- [ ] Pair bồn mới → bước cuối gõ tên → "Go to home" → Device List hiện **đúng tên vừa đặt**.
- [ ] Mở **Smart Life** → tên mới phải có ở đó (chứng minh đổi trên Tuya, không phải nhãn local).
- [ ] Kéo refresh Device List → tên **không** quay về tên cũ.
- [ ] Ca lỗi: bật chế độ máy bay ngay trước khi bấm "Go to home" → phải hiện Alert *"Device added,
      but the name was not saved"* kèm lý do, và list hiện tên gốc (không phải tên giả).

**④ Đèn**
- [ ] Bấm nút bóng đèn → đèn bồn đổi trạng thái trong vài giây; icon giữ nguyên trạng thái mới.
- [ ] Bật/tắt từ **Smart Life** → app tự cập nhật theo (realtime).
- [ ] Tắt Wi-Fi bồn → bấm đèn → icon revert **và có dòng lỗi giải thích** (không im lặng như trước).

## Nhật ký chạy (Run log) - mới nhất ở trên

| Thời gian | Phase/Bước | Kết quả | Ghi chú / output |
|---|---|---|---|
| 2026-09-23 | DEV B1-B5 | ✅ | tsc 0 · eslint **0 error** · jest **437/437** (+10: 8 `tuya.control`, 2 reducer). Rà 4 tính năng: ①② đã đúng sẵn ở HEAD, ③④ phải vá. |
| 2026-09-23 | B1 phát hiện | 🔴 | Bản **1.0.4** khách đang cầm: iOS `publishDpsAwaitAck` còn stub ⇒ **nhiệt độ không đổi được**; timer chưa wire đủ ⇒ clean cycle không hẹn tắt. ⇒ phải build **1.0.6**. |

## Vấn đề đang chặn (Blockers)
- **Chặn AC7:** cần build IPA 1.0.6 và đưa khách cài. Không có bản mới thì không verify được gì.
