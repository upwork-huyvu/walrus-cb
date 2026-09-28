# Plan - m1-fix-admin-user-list

## 1. Vấn đề khách báo

> "Tao thấy rõ ràng user có kết nối device nhưng có vẻ khi lấy thì nó không lấy
> được thông tin khách hàng và thông tin device của khách đó."

## 2. Chẩn đoán (đo trên hệ thống THẬT, 2026-09-28)

Probe thẳng Tuya Cloud OpenAPI + Supabase bằng credential trong `apps/backend/.env`.

### Lỗi 1 - admin chỉ thấy 2/6 khách còn sống

`UsersService.listUsers()` lấy danh sách **chỉ** từ `GET /v2.0/apps/{schema}/users`.
Endpoint đó trả `total=2`, trong khi `push_tokens` có **11 uid** đã đăng nhập app thật.

| uid | Tên | Tuya list trả? | `/infos` đọc được? | Thiết bị |
|---|---|---|---|---|
| we1788801180792hAbYU | Sam Trickett | ✅ | ✅ | 0 |
| we1788178225752MHG09 | Christopher | ✅ | ✅ | **1 (ONLINE)** |
| we1786952725280IzC5Z | Tobias | ❌ | ✅ | 0 |
| we1786948389880n5qzg | Azmat | ❌ | ✅ | 0 |
| we1785858363948hOyJz | Huy Quốc | ❌ | ✅ | **1 (ONLINE)** |
| we1785751905594AaFl2 | Huy | ❌ | ✅ | 0 |
| 4 uid tháng 7 | - | ❌ | ❌ `1106` | - |

**Huy Quốc có bồn đang ONLINE mà admin không hề thấy user đó** → đúng triệu chứng khách báo.
Trang `/devices` cũng hỏng theo vì `listAllDevices()` duyệt qua `listUsers()`.

**Nguyên nhân, đã loại trừ từng khả năng:**
- ❌ Không phải nhiều schema: khách xác nhận Tuya console chỉ có **một** app
  (iOS `com.walrus.ios.wellness` + Android `com.walrus.android.wellness`,
  scheme `walrusandroidwellness`, tạo 2026-07-28) - đúng cái backend đang cấu hình.
- ❌ Không phải data center: tất cả `country_code=49`, endpoint CE (`openapi.tuyaeu.com`)
  trả `28841107 data center is suspended` → WE (`openapi-weaz`) là đúng.
- ❌ Không phải phân trang / kiểu đăng nhập: `page_size=200` vẫn `total=2`; cả nhóm
  hiện lẫn nhóm mất đều là đăng nhập Apple/Google.
- ✅ **Khác biệt duy nhất là ngày tạo**: mốc cắt nằm giữa 17/08 và 31/08. Tức endpoint
  list của Tuya **bỏ sót user** - lỗi phía Tuya, không sửa được từ code.
- 4 uid tháng 7 (trước 28/07 = ngày tạo app hiện tại) thuộc **app SDK cũ** → `1106`, mất hẳn.

### Lỗi 2 - cột "Devices" và badge Status luôn sai

`business.deviceCount` đọc từ bảng Prisma `device_mappings`, mà bảng đó **rỗng vĩnh viễn**:
grep cả repo thì `prisma.deviceMapping` chỉ có `findMany`/`groupBy`/`deleteMany` -
**không một dòng `create`/`upsert` nào**, mobile cũng không gọi API nào để ghi mapping.

```
device_mappings: count=0      ← chỉ đọc + xoá, không ai ghi
push_tokens:     count=17
```

⇒ mọi khách hiện **Devices = 0** + **"Inactive"**, kể cả người đang có bồn chạy.

## 3. Tiêu chí hoàn thành (AC)

- [x] **AC1** - `/users` trả đủ user còn sống, không phụ thuộc endpoint list của Tuya.
- [x] **AC2** - `deviceCount` lấy thẳng từ Tuya, không từ `device_mappings`.
- [x] **AC3** - đếm hụt phải phân biệt được với đếm ra 0 (không gắn nhãn "Inactive" bừa).
- [x] **AC4** - uid Tuya từ chối (`1106`) bị loại, không đẩy ra dòng trống.
- [x] **AC5** - `total`/`has_more` khớp số dòng thật sự hiển thị.
- [x] **AC6** - `/admin/devices` thấy đủ thiết bị của mọi user, không N+1.
- [x] **AC7** - danh sách app của Tuya lỗi không được làm trắng cả trang admin.
- [x] **AC8** - CI xanh (backend tsc/jest/eslint · admin tsc/eslint/next build).
- [x] **AC9** - verify trên dữ liệu THẬT (Tuya + Supabase production).

## 4. Các bước

- [x] **B1** - Probe Tuya + DB, khoanh vùng nguyên nhân.
- [x] **B2** - Backend: `loadRoster()` = danh sách Tuya ∪ uid backend đã lưu; `listUsers`
  phân trang tại chỗ; `deviceCount` từ Tuya (`null` khi lỗi).
- [x] **B3** - Backend: `listAllDevices()` dùng chung roster (bỏ N+1).
- [x] **B4** - Admin FE: cột Devices + badge chịu được `null`; bỏ dòng "Device mappings".
- [x] **B5** - Test + verify thật.
