# Kế hoạch: Admin redesign "Gilded Noir" (royal vàng-đen) + tính năng

- **Slug:** `m1-admin-royal-redesign`
- **Milestone:** M1·D (admin)
- **Phần:** admin (Next.js) + backend (NestJS — endpoint mới cho admin-mgmt & notification targeting)
- **Ngày tạo:** 2026-07-02 · **Cập nhật:** 2026-07-02

## 1. Mục tiêu & phạm vi
Reskin admin web sang phong cách **royal vàng–đen ("Gilded Noir")** + hoàn thiện 4 nhóm tính năng:
1. Login/logout (đã có → reskin). 2. Quản lý admin: **list + xoá** allowlist (không tạo từ UI).
3. Quản lý user Tuya (đã có → reskin + polish). 4. Gửi thông báo: **chọn nhiều user + gửi tất cả**.

**Quyết định user (2026-07-02):** ① **BỎ lọc iOS/Android** (Tuya không cung cấp platform) — chỉ
multi-select + all. ② Admin-mgmt chỉ **list + xoá** (tạo admin vẫn seed tay; không wire service_role).
③ **Theme trước, tính năng sau.**

**Ngoài phạm vi:** tạo admin từ UI (cần Supabase service_role); lọc push theo platform (cần pipeline
mobile báo OS+token); edit user Tuya.

## 2. Bối cảnh & ràng buộc
- Admin = **plain global CSS** (`app/globals.css`, 6 CSS var), **light sky-blue** hiện tại; không
  Tailwind. Reskin = viết lại `:root` + class + thêm web font. Giữ tên class để page cũ tự đổi.
- 2 layout gần trùng (`users/layout.tsx`, `notifications/layout.tsx`) → gộp thành 1 **AdminShell** (sidebar).
- Admin là SSR mỏng qua NestJS (`lib/api.ts`); token trong cookie httpOnly. Không secret ở client.
- Backend: chưa có CRUD admin-users; push chỉ **1 UID/lần** (Tuya không có batch → loop). Guard = `AdminAuthGuard`.
- **Bảng màu Gilded Noir:** nền `#0B0B0C` · surface `#141518/#1A1B1F/#232427` · viền `#2E3033` ·
  vàng `#D4AF37` + ochre `#C4873A` · chữ `#F5ECD7`/muted `#A9A28E` · jade `#5FB891` · rust `#E5695B`.
  Serif (Cormorant) chỉ tiêu đề/số lớn; sans (Inter, tabular-nums) body/bảng. Nút chính nền vàng **chữ đen**.

## 3. Tiêu chí hoàn thành (AC)
- [ ] AC1: `globals.css` = theme Gilded Noir (dark) + web fonts; login/users/notifications render đúng, không còn màu sky-blue/green hardcode.
- [ ] AC2: **AdminShell** sidebar (nav + active gold indicator + logout) dùng chung 2 layout.
- [ ] AC3: Trang **Quản trị viên** `/admins`: list admin (email, ngày tạo) + xoá (confirm). Backend `GET/DELETE /admin/users` guarded.
- [ ] AC4: Gửi thông báo: chọn **nhiều** user Tuya (picker từ list) hoặc **gửi tất cả**; backend loop push per-uid + trả kết quả tổng hợp.
- [ ] AC5: `tsc`/`lint`/`build` admin sạch; backend `tsc`/test sạch; chạy thật (browser) login→4 khu vực OK.

## 4. Các bước (2 phase)
**Phase 1 — Theme:**
1. **B1** — `globals.css` → tokens Gilded Noir + base (bg/chữ/tabular-nums) + class (sidebar, table, button vàng, input focus vàng, badge, card); thêm fonts (next/font: Cormorant + Inter) trong `app/layout.tsx`. Thay 2 literal `#16a34a`. *Test:* build + browser.
2. **B2** — `components/AdminShell.tsx` (sidebar client, active qua `usePathname`) → dùng ở `users/layout.tsx` + `notifications/layout.tsx`. *Test:* nav active đúng, logout chạy.
3. **B3** — Reskin `login/page.tsx` (card royal) + rà `users`, `users/[uid]`, `notifications`, `templates` cho khớp class mới. *Test:* browser từng trang.

**Phase 2 — Tính năng:**
4. **B4** — Admin-mgmt: backend `GET /admin/users` + `DELETE /admin/users/:id` (guarded, Prisma findMany/delete) + DTO; frontend `/admins` page + delete action + nav item. *Test:* tsc/test + browser list/xoá.
5. **B5** — Notification targeting: backend `SendPushDto` nhận `uids: string[]` **hoặc** `mode: 'list'|'all'`; service loop push (rate-safe) + kết quả per-uid; 'all' = enumerate `listUsers` (paginate). Frontend `SendPushForm`: multi-select từ user Tuya + toggle "gửi tất cả". *Test:* tsc/test + browser gửi (mock/thật).

## 5. Rủi ro & câu hỏi mở
- ⚠️ Đổi topbar→sidebar đụng 2 layout + class cũ → giữ tên class chung, reskin từng trang, verify browser.
- ⚠️ Web font (next/font) cần mạng lúc build/dev — nếu chặn thì fallback self-host/system.
- ⚠️ 'Gửi tất cả' loop N push (Tuya không batch) → cần giới hạn tốc độ/aggregate lỗi; QPS chưa rõ (doc) → làm thận trọng + báo tiến độ.
- ⚠️ Xoá admin = chỉ gỡ allowlist (tài khoản Supabase Auth vẫn còn nhưng mất quyền) — chấp nhận cho "revoke".
- ❓ Danh sách user để multi-select có thể lớn → cần phân trang/tìm trong picker (làm gọn ở B5).
