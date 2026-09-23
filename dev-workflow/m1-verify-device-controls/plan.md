# Kế hoạch: Verify 4 tính năng điều khiển khách yêu cầu

> File này do `/plan` tạo, do `/fix-plan` chỉnh sửa. Là nguồn sự thật về "định làm gì".

- **Slug:** `m1-verify-device-controls`
- **Milestone:** M1·B (mobile - rà soát trước khi bàn giao cho khách)
- **Phần liên quan:** mobile (JS) + **1 điểm cần build native mới**
- **Ngày tạo:** 2026-09-23
- **Cập nhật lần cuối:** 2026-09-23

## 1. Mục tiêu & phạm vi

Khách chốt 4 thứ **phải chạy được**:

1. Điều chỉnh **nhiệt độ** bồn.
2. Điều khiển **chu trình vệ sinh** ở mục "plan clean cycle".
3. **Đổi tên máy ngay ở bước kết nối** (pairing).
4. Điều khiển **đèn**.

Việc của feature này: **rà soát toàn bộ đường code** của 4 tính năng (DP map → adapter → native →
UI), vá chỗ gãy, và khoá lại bằng test chạy trên **payload THẬT của bồn g0cv1c**.

**Ngoài phạm vi:** không đổi thiết kế UI; không sửa native trong lượt này (native đã được wire ở
`ebe5b13`/`ca5bbea`/`101b17c`, chỉ cần **build lại IPA**).

## 2. Bối cảnh & ràng buộc

- Bồn thật `g0cv1c` chỉ có 12 DP (docs/research/tuya-icebath-dp-mapping.md):
  `101 sensor_1` (nhiệt °C) · `105 sensor_f_1` (°F) · `114 setting_temp_range` (raw, biên 2.0–15.0) ·
  `115 setting_temp` (raw, word0 = target °C) · `121 setting_pwr` · `122 setting_clr` (khử trùng) ·
  `124 setting_4` (đèn). **KHÔNG có DP "chu trình vệ sinh"** ⇒ 1 chu trình = bật DP 122 + hẹn TẮT
  bằng **timer cloud** của Tuya (`services/cleanCycle.ts`).
- Khách test trên **iPhone** ⇒ ưu tiên đường iOS.
- Bản khách đang cầm là **1.0.4**; từ đó tới nay đã có **15 commit**, trong đó có **thay đổi native**
  (ack publish + timer) ⇒ 4 tính năng này **không thể chạy trên bản 1.0.4**.

## 3. Tiêu chí hoàn thành (Acceptance Criteria)

- [x] **AC1** - Nhiệt độ: `setTargetTemp` ghi **đúng word0 của DP 115**, giữ nguyên các word khác;
  biên đọc từ DP 114 (2.0–15.0 °C, scale 1); native chưa wire ack → tự lùi về `publishDps` chứ
  không chặn im lặng.
- [x] **AC2** - Chu trình vệ sinh: bật/tắt đi đúng **DP 122**; chạy tay = **hẹn tắt TRƯỚC, bật SAU**;
  đặt lịch = 2 timer lặp (bật + tắt) đúng `loops`, qua nửa đêm thì dịch ngày.
- [x] **AC3** - Đổi tên lúc pair: đi qua **`services/tuya.ts#renameDevice`** (validate + timeout +
  throw khi native chưa hỗ trợ); lưu hỏng thì **báo cho người dùng** và **không** hiện tên giả.
- [x] **AC4** - Đèn: gửi **boolean thật vào DP 124**; lệnh trượt → công tắc revert **kèm lý do**
  hiện trên màn hình.
- [x] **AC5** - An toàn: thiếu DP (vd freeze) hoặc chưa đọc snapshot ⇒ **từ chối publish**, không
  chạm native, không ghi bừa DP lạ.
- [x] **AC6** - `tsc` 0 · `eslint` 0 error · `jest` xanh, có test chạy trên payload thật của bồn.
- [ ] **AC7** - **Verify máy thật trên iPhone với build 1.0.6** theo checklist ở progress.md.

## 4. Các bước thực hiện

1. **B1 - Rà đường code 4 tính năng** (DP map, adapter, native iOS/Android, UI) · done
2. **B2 - Vá "đổi tên lúc pair"**: PairingScreen dùng `tuya.ts#renameDevice`; lỗi → Alert + dùng tên
   Tuya đã lưu; **xoá** bản `renameDevice` rút gọn trong `services/pairing.ts` (nguồn của bug) · done
3. **B3 - Vá "lỗi câm" của công tắc**: reducer thêm `controlError`; `toggleBool` gộp 4 công tắc,
   revert **kèm message** · done
4. **B4 - Test khoá hợp đồng**: `services/tuya.control.test.ts` trên snapshot thật + 2 case reducer · done
5. **B5 - tsc + eslint + jest** · done
6. **B6 - Build 1.0.6 + verify máy thật** · pending (cần mày build & khách test)

## 5. Rủi ro & câu hỏi mở

- ⚠️ **Bắt buộc build lại IPA 1.0.6.** Bản 1.0.4 khách đang dùng: `publishDpsAwaitAck` trên iOS còn
  là stub (`ios_todo`) ⇒ **đổi nhiệt độ không bao giờ tới máy**, và module timer chưa wire đủ ⇒
  clean cycle không đặt được hẹn tắt.
- ⚠️ **Android: format `actions` của timer là best-guess** (comment trong `TuyaTimerModule.kt`) -
  chưa ai chạy thật. Lịch vệ sinh trên Android phải verify riêng.
- ⚠️ `getTimerList` **Android chưa wire** ⇒ đọc lại lịch/hẹn từ cloud chỉ chạy trên iOS; Android rơi
  về lịch lưu local.
- ❓ Múi giờ timer: timer Tuya chạy theo **timezone của thiết bị** (`Europe/Madrid` trên bồn dump),
  app tính `HH:mm` theo **giờ máy điện thoại**. Khách ở khác múi giờ với bồn thì giờ chạy sẽ lệch -
  cần xác nhận ở B6.
