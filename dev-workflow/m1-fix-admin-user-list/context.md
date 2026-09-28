# Context - m1-fix-admin-user-list

## Quyết định thiết kế

### Vì sao roster = Tuya ∪ DB, chứ không sửa cách gọi Tuya

Đã loại trừ hết mọi khả năng sửa được từ phía cấu hình (schema, data center, phân trang,
kiểu đăng nhập - xem `plan.md` mục 2). Còn lại đúng một kết luận: `GET /v2.0/apps/{schema}/users`
**tự nó bỏ sót user**. Không có tham số nào ép nó trả đủ.

Nhưng backend **đã có sẵn** uid của những người đó: ai dùng app thật thì đều đăng ký
push token (`push_tokens`) hoặc đặt nhắc bảo trì (`device_reminders`). Lấy hợp hai nguồn
rồi enrich bằng `/v1.0/users/{uid}/infos` (endpoint này đọc được cả những uid bị bỏ sót)
là cách duy nhất nằm trong tầm kiểm soát của mình.

**Giới hạn đã biết:** khách nào đăng nhập nhưng **chưa bao giờ** cấp quyền push và cũng
chưa đặt reminder thì vẫn có thể vắng mặt nếu Tuya bỏ sót họ. Chấp nhận được - vẫn tốt
hơn hẳn hiện trạng, và không có nguồn uid nào khác để dựa vào.

### Vì sao `deviceCount` là `number | null` chứ không phải `number`

Nếu gọi `/users/{uid}/devices` lỗi mà trả `0`, admin sẽ gắn nhãn **"Inactive"** cho một
khách đang có bồn chạy - sai nguy hiểm hơn hẳn việc thú nhận "không đếm được". `null` đi
thẳng ra UI thành `—` + badge **"Unknown"**.

Cùng lý do đó, `UserRosterEntry.devices` là `TuyaUserDevice[] | null`: `[]` (thật sự chưa
pair máy nào) và `null` (đọc hỏng) là hai chuyện khác nhau, gộp lại là mất thông tin.

### Vì sao phân trang tại chỗ

Roster phải gom xong từ hai nguồn mới sắp xếp được, nên `total`/`has_more` chỉ đúng khi đã
có đủ danh sách. Trước đây `total` lấy từ Tuya nên vừa sai (Tuya đếm thiếu) vừa lệch với
số dòng hiển thị. Quy mô app tính bằng chục user ⇒ chi phí không đáng kể; có trần
`MAX_ROSTER = 500` + `ROSTER_CONCURRENCY = 8` chặn trường hợp app đông lên.

### Vì sao KHÔNG xoá bảng `device_mappings`

Bảng rỗng vĩnh viễn nhưng vẫn được dọn trong `deleteUser`/`purgeUser`. Những lệnh
`deleteMany` đó là no-op vô hại, và nếu sau này có ai hiện thực việc ghi mapping thì chúng
đã đúng sẵn. Chỉ **ngừng đọc** nó để hiển thị - đó mới là chỗ gây ra số liệu sai.

## Bản đồ file

| File | Vai trò sau khi sửa |
|---|---|
| `apps/backend/src/users/users.service.ts` | `loadRoster()` (mới, public - Devices dùng chung) · `rosterUids()` · `appUserUids()` · `knownUids()` · `mapLimit()`. Bỏ `enrichInfos()`, `deviceCounts()`. `getUser()` không còn trả `business`. |
| `apps/backend/src/devices/devices.service.ts` | `listAllDevices()` đọc roster, hết gọi lại `/users/{uid}/devices` lần hai. |
| `apps/admin/components/UsersBrowser.tsx` | `deviceCount?: number \| null`; `—` + badge "Unknown" khi null. |
| `apps/admin/app/users/[uid]/page.tsx` | Bỏ dòng "Device mappings" (luôn bằng 0). |

## Số liệu thật trước / sau (2026-09-28)

| | Trước | Sau |
|---|---|---|
| `GET /users` → total | 2 | **6** |
| `GET /admin/devices` | 1 thiết bị | **2 thiết bị** |
| Devices/Status của Christopher | `0` / Inactive | `1` / Active |
| Huy Quốc (đang có bồn ONLINE) | **không hiện** | hiện, `1` / Active |

## Việc còn nợ / cần khách

- 4 uid tháng 7 (`we1784616116281A0VxT`, `we17831755711425l85B`, `we178297522620935amb`,
  `we1782962675373ARo2g`) thuộc app SDK **cũ** (trước 28/07) → Tuya trả `1106 permission deny`.
  Code không cứu được. Nếu đó là tài khoản test thì bỏ qua; nếu là khách thật thì phải mở
  ticket với Tuya.
- Nên mở ticket Tuya về việc `/v2.0/apps/{schema}/users` trả thiếu user - fix hiện tại là
  đường vòng, không phải chữa gốc.
- `apps/backend/.env` có `TUYA_APP_SCHEMA=walrusandroidwellness   # comment cùng dòng`.
  dotenv cắt đúng comment nên **không sao**, nhưng script tự parse `.env` thì dễ dính bẫy.
