# Progress: Admin web - loading khi chuyển trang

- **Slug:** `m1-admin-nav-loading`
- **Phase hiện tại:** `TEST`
- **Trạng thái:** `code_done` - CI xanh, **còn chờ mắt người xem trên trình duyệt**
- **Cập nhật lần cuối:** 2026-09-28

## ▶ Hành động kế tiếp
Chạy `npm run dev` trong `apps/admin` (cần backend `localhost:3006` bật + đăng nhập admin) rồi
bấm qua lại các mục sidebar và phân trang `/users`, đối chiếu AC1–AC3 trong `plan.md`.
Nếu đúng ý → commit.

## Checklist bước (đồng bộ plan mục 3)
- [x] B1 - gom 6 layout về route group `app/(dashboard)/layout.tsx` · **done**
- [x] B2 - thanh tiến trình toàn cục (`NavProgress` + `AppLink` + store trong `Pending.tsx`) · **done**
- [x] B3 - vòng xoay trên mục sidebar vừa bấm (`LinkSpinner`) · **done**
- [x] B4 - thanh + làm mờ bảng khi đổi trang `/users` (`useTransition`) · **done**
- [x] B5 - bù `loading.tsx` cho `devices/[id]` và `notifications/templates` · **done**

## Checklist AC (đồng bộ plan mục 4)
- [ ] AC1 - phản hồi tức thì khi bấm mục sidebar · *chờ xem bằng mắt*
- [ ] AC2 - skeleton hiện ngay khi đổi mục · *chờ xem bằng mắt*
- [ ] AC3 - `/users` đổi trang có thanh + bảng mờ + khoá nút · *chờ xem bằng mắt*
- [x] AC4 - URL không đổi: `next build` liệt kê đúng 14 route như cũ ✅
- [x] AC5 - `tsc` 0 · `eslint` 0 · `next build` ✓ ✅
- [x] AC6 - `prefers-reduced-motion` → chỉ báo tĩnh, không biến mất ✅ *(có rule trong globals.css)*

## Nhật ký chạy
| Thời gian | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-09-28 | DEV B1–B5 + TEST tĩnh | ✅ | Tìm ra gốc bệnh: `loading.tsx` nằm **trong** `layout.tsx` cùng segment, mà 6 layout cũ đều `await getActiveProvider()` ⇒ skeleton bị chặn sau ~2 vòng mạng nối tiếp, và layout đọc `cookies()` nên `<Link>` không prefetch được. Gom về `app/(dashboard)/layout.tsx` + thêm thanh tiến trình toàn cục + vòng xoay sidebar + 2 `loading.tsx` còn thiếu. `tsc` 0 · `eslint` 0 · `next build` ✓ (14 route y như cũ). **Chưa xem bằng mắt** - backend không bật, không có tài khoản admin. |

## Blockers
- Không tự chạy E2E được: backend `localhost:3006` chưa bật và không có tài khoản admin để đăng nhập.
