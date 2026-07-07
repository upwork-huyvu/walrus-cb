# Context: Admin redesign "Gilded Noir" + tính năng

- **Slug:** `m1-admin-royal-redesign`
- **Research nguồn:** workflow `admin-royal-redesign-research` (2026-07-02) - design tokens + map admin/backend.

## Quyết định (Decision log)
- **2026-07-02** - Palette **Gilded Noir** (brand-consistent với mobile dark+ochre). Vàng như trang sức
  (5-15%), nút chính nền vàng **chữ đen** (không chữ trắng trên vàng). Serif chỉ tiêu đề, sans cho data.
- **2026-07-02** - User chốt: ① bỏ filter iOS/Android (Tuya không có platform); ② admin-mgmt chỉ list+xoá
  (không tạo từ UI → không cần service_role); ③ theme trước rồi feature.

## Bảng màu / token (dùng ở globals.css)
| token | hex | dùng |
|---|---|---|
| --bg | #0B0B0C | nền canvas |
| --surface-1/2/3 | #141518 / #1A1B1F / #232427 | sidebar/topbar · card · raised/hover/header |
| --border | #2E3033 | viền hairline |
| --gold | #D4AF37 | accent (AAA 9.36:1) |
| --ochre | #C4873A | brand accent phụ |
| --fg | #F5ECD7 | chữ champagne |
| --muted | #A9A28E | chữ phụ |
| --success/danger/warning | #5FB891 / #E5695B / #E0A94A | semantic |

Font: serif Cormorant Garamond (heading), sans Inter (body, tabular-nums). next/font trong app/layout.tsx.

## Bản đồ file (hiện trạng - từ research)
| File | Vai trò |
|---|---|
| `apps/admin/app/globals.css` | theme (6 var, light sky-blue) - **B1 viết lại** |
| `apps/admin/app/layout.tsx` | root, import globals - **B1 thêm fonts** |
| `apps/admin/app/users/layout.tsx` · `notifications/layout.tsx` | 2 shell trùng - **B2 gộp AdminShell** |
| `apps/admin/app/login/page.tsx` | login form (.card) - **B3 reskin** |
| `apps/admin/app/users/page.tsx` · `[uid]/page.tsx` | list + detail user Tuya (đã có) |
| `apps/admin/app/notifications/page.tsx` + `components/SendPushForm.tsx` | gửi push 1 UID - **B5 multi/all** |
| `apps/admin/components/CreateTemplateForm.tsx` | tạo template (có `#16a34a` hardcode → B1 thay) |
| `apps/backend/src/admin-auth/*` | login + guard; **B4 thêm CRUD /admin/users** |
| `apps/backend/prisma/schema.prisma` | `AdminUser{email}` allowlist (chỉ read) |
| `apps/backend/src/notifications/*` | send 1 uid - **B5 uids[]/all + loop** |
| `apps/backend/src/users/users.service.ts` | listUsers (nguồn picker + enumerate 'all') |

## Cạm bẫy (từ research)
- Tuya Cloud user **không có platform** iOS/Android; push API **không lọc platform**, **không batch** (loop N).
- Tạo admin cần Supabase Auth (GoTrue admin + service_role) - **ngoài scope** (chỉ list+xoá).
- 2 literal `#16a34a` hardcode ở SendPushForm.tsx:78 + CreateTemplateForm.tsx:57 → thay bằng token.

## Liên kết
- Plan: [plan.md](plan.md) · Progress: [progress.md](progress.md)
- Feature liên quan: [[m1-admin-web]] · [[m1-admin-push]] · [[m1-backend-admin-auth]]
