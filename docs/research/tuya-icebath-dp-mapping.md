# Tuya Research: Giải mã DP thiết bị thật & map vào model app

- Ngày: 2026-07-24
- Thiết bị: `9beceda61448a0fdd54w73` · tên template **"Audible alarm"** · productId `eht82h7rvizavwpf`
  · pv 2.2 · verSw 2.7.7 · bv 40 · mac d8c80c31d5ef · tz Europe/Madrid · 12 DP
- Nguồn dữ liệu: log `[DEVICE]` từ `getDeviceSnapshot` trên máy thật (2026-07-24)
  **+ bảng thuộc tính (property table) của model `g0cv1c` lấy từ console Tuya** - nguồn này
  chốt dứt điểm mọi câu hỏi mở bên dưới.
- Nguồn chính:
  - https://developer.tuya.com/en/docs/app-development/iOS-device-control?id=Kaiyeu0xukcuc
  - https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y
  - https://developer.tuya.com/en/docs/iot/product-function-definition?id=K9tp155s4th6b
  - https://developer.tuya.com/en/docs/iot/11?id=K9tp116dmo6br

## TL;DR (cho người sắp code)

- **App đang map SAI 2 DP quan trọng.** `currentTemp → 105` thực ra là DP **độ F**, và
  `light → 101` thực ra là **nhiệt độ °C**. Hai dấu "✓ present in dps" trong log là
  **trùng ngẫu nhiên với placeholder**, không phải map đúng.
- **Nhiệt độ hiện tại = DP 101** (`sensor_1`, value, scale 1) ⇒ `64 → 6.4 °C`. DP 105
  (`sensor_f_1`) là **cùng cảm biến ở °F** ⇒ `430 → 43.0 °F`.
- **DP 101–126 đều là DP CUSTOM của hãng** (Tuya giữ id 1–100 cho chuẩn) ⇒ tra "standard
  instruction set" vô ích. Nghĩa của chúng lấy từ **bảng thuộc tính của model trên console Tuya**
  (nguồn chuẩn duy nhất), không phải đoán.
- **Nhiệt độ mục tiêu nằm trong DP raw 115** (`setting_temp`), **giới hạn trong DP raw 114**
  (`setting_temp_range` ⇒ **2.0–15.0 °C**). Raw DP = **chuỗi hex chẵn chữ số** (xác nhận cả
  iOS lẫn Android) ⇒ ghi được; **word 0 = setpoint °C của sensor 1**.
- Thiết bị **CÓ đèn và CÓ lọc**, chỉ là tên code vô nghĩa: `setting_4` = **"Lighting"**,
  `setting_clr` = **"Disinfection"**. **Không có** DP xả đá (freeze).

## Khái niệm & luồng

### Kiểu DP và cách mã hoá (xác nhận từ docs)

| Kiểu | iOS | Android |
|---|---|---|
| bool | `@{@"1": @(YES)}` | `dps = {"101": true}` |
| value | `@{@"6": @(20)}` (số, **không** phải `@"20"`) | `dps = {"104": 20}` |
| enum | `@{@"5": @"2"}` (chuỗi) | `dps = {"103": "2"}` |
| string | `@{@"4": @"ff5500"}` | `dps = {"102": "ff5500"}` |
| **raw** | `@{@"15": @"1122"}` | `dps = {"105": "1122"}` |

> Docs cả hai nền tảng nói cùng một câu: *"A byte array of raw type is a hexadecimal string
> with an even number of digits."* — ví dụ phải viết `"011f"`, **không** `"11f"`.
> ⇒ **Raw DP ghi bằng hex string, KHÔNG phải base64.** (Base64 chỉ xuất hiện ở tầng
> cloud↔device passthrough, không phải payload `publishDps` của App SDK.)

### scale

Function Definition: *"The scale value can be set to 0, 1, 2, 3 and transmitted in the
exponential conversion of 10"* ⇒ **giá trị hiển thị = raw / 10^scale**. DP 101/105 có
`scale=1` ⇒ chia 10.

### DP chuẩn vs DP custom

Docs: *"The first 100 DP IDs are reserved for Tuya use, and the custom DP ID starts with 101."*
⇒ trên thiết bị này **chỉ DP 11 (`fault`) là chuẩn**; 101→126 là custom của hãng.
Hệ quả: tra "standard instruction set" của Tuya sẽ **không bao giờ** ra nghĩa của
`setting_clr` / `setting_4` / `par_2` / `par_3`.

## Bảng DP thiết bị + diễn giải

| DP | code | kiểu | mode | giá trị thật | Diễn giải | Độ tin |
|---|---|---|---|---|---|---|
| 11 | `fault` | bitmap | ro | `0` | Không lỗi. Nhãn bit: `fault1..fault4` (maxlen 4) | **Chắc** |
| 101 | `sensor_1` | value scale1 ℃ (-450..999) | ro | `64` | **Nhiệt độ nước = 6.4 °C** | **Chắc** |
| 105 | `sensor_f_1` | value scale1 °F (-490..2100) | ro | `430` | **Cùng cảm biến, 43.0 °F** | **Chắc** |
| 114 | `setting_temp_range` | raw | rw | xem dưới | **Giới hạn cho phép: 2.0–15.0 °C** | Cao |
| 115 | `setting_temp` | raw | rw | xem dưới | **Nhiệt độ mục tiêu = 4.0 °C** | Cao |
| 119 | `setting_unit` | bool | **ro** | `false` | Đơn vị hiển thị (false=°C) — **chỉ đọc** | Cao |
| 120 | `display` | raw | ro | `00000000` | 4 byte, mỗi sensor 1 byte: hiện giá trị thật hay `--` | **Chắc** |
| 121 | `setting_pwr` | bool | rw | `true` | **Nguồn / chạy máy** | Cao |
| 122 | `setting_clr` | bool | rw | `false` | **Disinfection** (lọc/khử trùng) → `purify` | **Chắc** |
| 124 | `setting_4` | bool | rw | `true` | **Lighting** (đèn) → `light` | **Chắc** |
| 125 | `par_2` | string | ro | `""` | Tham số hãng, rỗng | — |
| 126 | `par_3` | raw | ro | `""` | Tham số hãng, rỗng | — |

### Vì sao chắc chắn 101 là °C và 105 là °F

`dpsTime` cho thấy DP 105 được báo **sớm hơn DP 101 khoảng 250 giây**
(`1784906096784` vs `1784906346849`). 43.0 °F = **6.11 °C**; 250 giây sau cảm biến báo
**6.4 °C**. Nước ấm lên 0.3 °C trong ~4 phút ⇒ hai DP **nhất quán tuyệt đối** với nhau và
xác nhận scale ÷10 cho cả hai. (Nếu quy đổi trực tiếp 6.4 °C → 43.5 °F, lệch 0.5 °F chính là
do chênh thời điểm lấy mẫu, không phải sai scale.)

### Giải mã DP raw 114 (`setting_temp_range`)

> **ĐÍNH CHÍNH 2026-09-22.** Bản đầu của mục này (và của mục 115 bên dưới) đọc layout là
> "khối °C rồi khối °F" vì chỉ có mô tả rút gọn. Bảng thuộc tính đầy đủ (property JSON khách gửi
> 2026-09-22) liệt kê từng trường theo thứ tự ⇒ layout **xen kẽ theo sensor**. word0 (và cặp
> word0/word1 của 114) đúng ở cả hai cách đọc nên app không đọc/ghi sai; chỉ nhánh dự phòng "sensor 1
> chưa đặt" và phần giải thích bị sai - đã sửa code theo (`dp.ts#readRawTempRange`,
> `device-dp.ts#readTempRange`).

```
00960014 00960014 | 00960014 00960014 | ffffffff ffffffff | ffffffff ffffffff
```
Mô tả chính thức: *"A total of **32 bytes** in **big-endian** format, containing **eight groups of
upper and lower limit settings**."* rồi liệt kê theo thứ tự: *[Sensor 1 Celsius upper-limit]
[Sensor 1 Celsius lower-limit] [Sensor 1 Fahrenheit upper-limit] [Sensor 1 Fahrenheit lower-limit]
[Sensor 2 Celsius upper-limit] …*, mỗi trường 2 byte, *"Reporting FFFF means this option is hidden
on the panel"*.

- 64 hex = **32 byte** = **16 word 16-bit big-endian**, có dấu (two's complement — cảm biến
  xuống tới −45.0 °C, vd −2.0 °C = `ffec`).
- **Mỗi sensor 4 word liền nhau: `[°C trên, °C dưới, °F trên, °F dưới]`** → sensor 1 = word 0..3,
  sensor 2 = word 4..7, …
- Số liệu thật: sensor 1 = `[150, 20, 150, 20]`, sensor 2 = `[150, 20, 150, 20]`, sensor 3–4 = `ffff`
  ⇒ sensor 1–2 giới hạn **15.0 / 2.0 °C**; ô °F **lặp lại đúng số của °C** (MCU không quy đổi);
  sensor 3–4 **ẩn**.
- ⇒ **Biên cho sensor 1: min 2.0 °C, max 15.0 °C (word0/word1). Giá trị "trên" đứng TRƯỚC.**

### Giải mã DP raw 115 (`setting_temp`)

```
0028 0028 | ffff ffff | ffff ffff | ffff ffff
```
Mô tả chính thức: *"A total of 8 bytes in big-endian format"* rồi liệt kê: *[Sensor 1 Celsius
temperature setting] [Sensor 1 Fahrenheit temperature setting] [Sensor 2 Celsius temperature
setting] [Sensor 2 Fahrenheit temperature setting] …*, mỗi trường 2 byte.

- 32 hex = **16 byte** = **8 word 16-bit**: `[40, 40, ffff × 6]`.
- **Mỗi sensor 2 word: `[°C, °F]`** → word0 = sensor 1 °C, **word1 = sensor 1 °F**, word 2/3 =
  sensor 2, …
- ⇒ **word 0 = nhiệt độ mục tiêu °C của sensor 1 = 4.0 °C**; word1 (°F của sensor 1) cũng = 40 -
  lặp số °C giống DP 114; sensor 2–4 **ẩn**.
- 4.0 °C nằm gọn trong biên 2.0–15.0 °C của DP 114 ⇒ nhất quán.

> Mô tả của hãng ghi "8 bytes" cho DP 115 nhưng liệt kê **8 trường × 2 byte = 16 byte**, khớp
> payload thật ⇒ con số 8 là số trường, đọc theo **16 byte / 8 word** là đúng.

### Ghi setpoint an toàn

Chỉ ghi đè **word 0**, giữ nguyên mọi word còn lại (kể cả `ffff` và word1 = °F của sensor 1):

```
4.0 → 7.5 °C:  00280028ffffffffffffffffffffffff
               004b0028ffffffffffffffffffffffff
                ^^^^ chỉ word 0 đổi (0x004b = 75)
```

## Khác biệt iOS vs Android

Không có khác biệt nào ảnh hưởng việc này: cả hai SDK đều nhận raw DP dạng **hex string chẵn
chữ số**, value là **số**, bool là **boolean thật**. Bridge hiện tại (`publishDps(devId, dpsJson)`)
truyền chuỗi JSON nên giữ nguyên được kiểu — chỉ cần bảo đảm value raw là chuỗi hex.

Docs Android nhắc thêm: *"Device control is not finished after a command is sent. The device
has been controlled as expected only after `IDevListener onDpUpdate` returns the response."*
⇒ tiếp tục dùng `publishDpsAwaitAck` cho setpoint (app đã có).

## Đối chiếu với code hiện tại — vì sao đang sai

`services/dp.ts` có `CODE_CANDIDATES` toàn code chuẩn Tuya
(`temp_current`, `temp_set`, `switch_led`, …). Thiết bị này dùng code **custom**
(`sensor_1`, `setting_temp`, …) nên **không match code nào**, `resolveDpMap()` rơi hết về
placeholder `DP`:

| Chức năng | Placeholder | DP trùng trên máy | Thực chất là gì | Hậu quả |
|---|---|---|---|---|
| currentTemp | `105` | có | `sensor_f_1` (**°F**) | Hiện **43.0** khi nước đang **6.4 °C** |
| light | `101` | có | `sensor_1` (**°C**) | `64` truthy ⇒ đèn **luôn bật** |
| targetTemp | `104` | không | — | Không đọc/ghi được |
| purify | `102` | không | — | Vô tác dụng |
| freeze | `106` | không | — | Vô tác dụng |

Hai dấu "✓ present in dps" trong log **không phải map đúng** — chỉ là placeholder tình cờ
trùng id với một DP hoàn toàn khác nghĩa. Đây là kiểu lỗi im lặng nguy hiểm nhất.

Ngoài ra `services/deviceSchema.ts::parseTempRange` tìm entry schema theo `DP.targetTemp`
(`'104'`) — không tồn tại ⇒ luôn trả `DEFAULT_TEMP_RANGE` (−3..12, scale 0). Và kể cả khi
tìm đúng DP 115 thì cũng vô dụng vì **115 là kiểu `raw`, không có min/max/step/scale trong
schema** — biên thật phải **decode từ DP 114**.

Và `parseDeviceDps`/`build*Dps` hiện chỉ xử lý số + bool; **chưa có codec cho DP raw**.

## Mapping CHỐT (đã triển khai 2026-07-24)

| App | DP | code | Cách đọc | Cách ghi |
|---|---|---|---|---|
| `currentTemp` | **101** | `sensor_1` | số ÷ 10^scale (scale 1) | — (ro) |
| — | 105 | `sensor_f_1` | bản °F, **không dùng làm currentTemp** | — (ro) |
| `targetTemp` | **115** | `setting_temp` | raw → **word 0** | ghi đè word 0, **giữ nguyên word khác** |
| `tempRange` | **114** | `setting_temp_range` | raw → word 0/1 (trên, dưới) = 15.0 / 2.0 | — |
| `light` | **124** | `setting_4` (Lighting) | bool | bool |
| `purify` | **122** | `setting_clr` (Disinfection) | bool | bool |
| `power` | **121** | `setting_pwr` | bool | bool |
| `fault` | **11** | `fault` | bitmap, 0 = bình thường | — (ro) |
| `freeze` | — | **không có DP** | — | app **từ chối publish** |

Thay đổi kèm theo trong code:

1. **Bỏ hẳn bảng placeholder `DP`** trong `services/dp.ts`. Resolve được thì dùng, không thì
   để trống — không còn "đoán id" nào trong hệ thống.
2. **Từ chối publish khi thiếu DP.** `buildTempDps`/`buildBoolDps` trả `null`, `tuya.ts` trả
   `{ok:false, error}` thay vì ghi bừa sang DP lạ.
3. **Kiểu DP lấy từ schema**, không đoán theo hình dạng chuỗi: payload raw có thể toàn chữ số
   (`"00280028"` khớp `/^\d+$/`) nên nếu đoán sẽ đọc thành `280028`.
4. **Cache payload raw theo thiết bị** (`cacheRawDps`) để ghi 1 word mà không mất word khác;
   cập nhật cả lúc `readDevice` lẫn lúc nhận realtime.
5. **Log realtime từng DP đổi** kèm code + tách word (`logDpUpdate`) — công cụ để soi tiếp Q1–Q5.

## Thiết bị này là category gì?

Không phải category ice-bath chuẩn của Tuya. Cold plunge "chuẩn" (`ktkzq`) dùng DP **chuẩn**
`temp_set` / `temp_current` / `child_lock`
([tuya-home-assistant#1001](https://github.com/tuya/tuya-home-assistant/issues/1001)) —
thiết bị của mình **không** dùng bộ đó.

Bộ DP ở đây (`sensor_1` + `sensor_f_1` + `setting_temp` + `setting_temp_range` + `setting_pwr`
+ `display` + `par_*`, nhiều slot) là **template điều khiển/cảnh báo nhiệt độ đa kênh** của
một ODM, gắn trong máy làm lạnh. Tên "Audible alarm" là tên product template, không phản ánh
chức năng thật. Một điểm khớp đáng chú ý từ cộng đồng: một cold plunge chiller khác cũng
dùng **DP 121 = Power**
([HA community](https://community.home-assistant.io/t/cold-plunge-chiller-units-with-local-control/1016039)),
trùng với `setting_pwr` = 121 ở đây.

**Kết luận:** thiết bị **có** đèn (`setting_4` = Lighting) và **có** lọc/khử trùng
(`setting_clr` = Disinfection), nhưng **không có** DP xả đá (freeze) - nút freeze trên
Dashboard không có phần cứng tương ứng.

## Cạm bẫy / lưu ý cho dự án ice-bath

1. **Đừng bao giờ để placeholder DP id chạy vào production.** Trùng id ngẫu nhiên tạo ra
   giá trị "hợp lý mà sai" (43.0 độ, đèn luôn bật) — khó phát hiện hơn crash.
2. **`setting_unit` (119) là `ro`** ⇒ app **không đổi được** đơn vị trên thiết bị; muốn hiện
   °F thì tự quy đổi ở UI, hoặc đọc DP 105.
3. **Ghi raw phải giữ nguyên các slot khác.** Publish `setting_temp` thì phải encode lại
   **đủ 16 byte**, chỉ thay slot cần đổi, giữ nguyên `ffff` — ghi thiếu byte có thể làm
   thiết bị hiểu sai toàn bộ mảng.
4. **Clamp theo DP 114, không theo `DEFAULT_TEMP_RANGE`.** Biên thật là 2.0–15.0 °C.
5. **Giữ tất cả ở đơn vị raw trong state** (như `deviceSchema.ts` đang làm) và chỉ chia 10
   lúc hiển thị — nhất quán với DP 101/105 (scale 1) và với slot 16-bit của 114/115.
6. **DP `fault` (11) là bitmap** ⇒ 0 = bình thường; khác 0 nên hiện cảnh báo thay vì im lặng.

## Câu hỏi mở / cần xác minh trên thiết bị

Bảng thuộc tính model `g0cv1c` đã đóng gần hết câu hỏi. Còn lại:

| # | Câu hỏi | Cách xác minh | Chặn việc gì |
|---|---|---|---|
| Q1 | **Bước nhảy (step)** của setpoint là bao nhiêu? DP raw không khai báo `step`. App đang tạm dùng **0.5 °C** | Đổi nhiệt độ trong Smart Life, xem word 0 nhảy theo bội số nào | Độ mịn nút +/- |
| Q2 | Ghi word 0 mà giữ nguyên word khác (kể cả word1 = °F của sensor 1) có được firmware chấp nhận không? MCU có tự sửa word1 theo không? | Publish rồi xem echo DP 115 trong log `[DP]` | Ghi target temp |
| Q3 | Khi máy ở chế độ °F thì có phải ghi word 1 (°F của sensor 1) thay/cùng word 0 không? | Đổi `setting_unit` rồi xem DP 115 | Hỗ trợ °F |
| Q4 | 4 sensor là những gì (nước vào/ra/máy nén…)? Sensor 1 có đúng là nhiệt độ nước? | Đối chiếu số trên mặt máy với DP 101 | Nhãn hiển thị |
| Q5 | `fault1..fault4` ứng với lỗi gì? | Chờ có lỗi thật, hoặc hỏi hãng | Thông điệp lỗi |

**Đã đóng** (nhờ bảng thuộc tính): vị trí slot setpoint (word 0), thứ tự trên/dưới của DP 114,
nghĩa của `setting_clr` (Disinfection) và `setting_4` (Lighting), nghĩa của `display`,
nhãn bitmap của `fault`.

## Nguồn (đầy đủ URL đã đọc)

- [Device Control — Smart App SDK (iOS)](https://developer.tuya.com/en/docs/app-development/iOS-device-control?id=Kaiyeu0xukcuc) — mã hoá DP theo kiểu; raw = hex chẵn chữ số; `publishDps` signature
- [Device Control — Smart App SDK (Android)](https://developer.tuya.com/en/docs/app-development/andoird_device_control?id=Kaixh4pfm8f0y) — như trên cho Android; `onDpUpdate` mới là xác nhận thật
- [Function Definition — Tuya Developer Platform](https://developer.tuya.com/en/docs/iot/product-function-definition?id=K9tp155s4th6b) — DP 1–100 của Tuya, custom bắt đầu từ 101
- [Function Definition (kiểu dữ liệu & scale)](https://developer.tuya.com/en/docs/iot/11?id=K9tp116dmo6br) — scale 0..3, quy đổi luỹ thừa 10; raw = nhị phân thô
- [Standard Instruction Set](https://developer.tuya.com/en/docs/iot/f?id=K9gf45ld5l0t9) — đối chiếu: không có `sensor_1`/`setting_temp`
- [tuya-home-assistant #1001 — ICE BATH COOLER (Cold Plunge)](https://github.com/tuya/tuya-home-assistant/issues/1001) — category chuẩn `ktkzq` dùng `temp_set`/`temp_current`/`child_lock`
- [HA Community — Cold Plunge Chiller Units with Local Control](https://community.home-assistant.io/t/cold-plunge-chiller-units-with-local-control/1016039) — chiller khác cũng dùng DP 121 = Power
- Nội bộ: [docs/research/tuya-home-sdk-device-control.md](tuya-home-sdk-device-control.md) — đã ghi sẵn `raw @{@"15": @"1122"}`
