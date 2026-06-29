# Progress: Web Admin (Next.js) — login + list/detail/xoá user

- **Slug:** `m1-admin-web`
- **Phase hiện tại:** `DEV` (B1–B4 code xong; chờ env+backend để verify live)
- **Trạng thái:** `in_progress`
- **Cập nhật lần cuối:** 2026-06-29

## ▶ Hành động kế tiếp (đọc cái này trước tiên)
✅ **Code B1–B4 XONG + verify offline** (tsc/next build/eslint pass).
Live verify: chạy `apps/backend` + seed admin (C3) + set `API_BASE_URL` → đăng nhập → list/xoá.
**M1 phần D xong code.** Còn lại M1: track **mobile (A lib B3+ + B*)** — chặn vì cần file bảo mật Tuya.

## Checklist các bước (đồng bộ plan mục 4)
- [x] B1 — Scaffold Next.js + API helper + env · **done** (Next 16 App Router, lib/api.ts, API_BASE_URL)
- [x] B2 — Auth (login/cookie/logout) · **done** (login proxy NestJS + httpOnly cookie + proxy.ts guard)
- [x] B3 — Users list + detail + delete + styling · **done** (list+phân trang, detail, DeleteButton→server action)
- [x] B4 — tsc/build/lint + README + secret sweep + state · **done**

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — next build + tsc + eslint pass
- [x] AC2 — login proxy + httpOnly cookie + redirect /users; logout xoá cookie
- [x] AC3 — /users list (Bearer từ cookie server-side) + phân trang; 401/403 → /login
- [x] AC4 — /users/[uid] detail + Xoá (server action DELETE) → quay lại list
- [x] AC5 — secret sweep sạch + .env.example (API_BASE_URL) + token KHÔNG lộ client UI

## Nhật ký chạy (Run log) — mới nhất ở trên
| Thời gian | Phase/Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-06-29 | DEV (polish) | ✅ | "Hiện rõ" quản lý user Tuya: thêm dashboard shell `app/users/layout.tsx` (brand + nav "Người dùng Tuya" + logout), đổi tiêu đề "Người dùng Tuya" + ghi chú nguồn Tuya Cloud, empty-state nhắc env, cột "Thiết bị (DB)", detail "UID (Tuya)". tsc/build/lint pass. |
| 2026-06-29 | TEST B1–B4 | ✅ | `tsc --noEmit` OK; `next build` OK (/users + /users/[uid] dynamic, build không gọi API); eslint 0; secret sweep sạch; token chỉ ở server. |
| 2026-06-29 | DEV B1–B4 | ✅ | Next 16 scaffold (gỡ nested git + Geist font + template CLAUDE/AGENTS); login/users/detail/delete; httpOnly cookie; proxy.ts (thay middleware); next.config turbopack.root. |
| 2026-06-29 | PLAN | ✅ | plan/context/progress + INDEX (D). |

## Vấn đề đang chặn (Blockers)
- Không chặn code. Live verify cần: `apps/backend` chạy + admin seed (C3) + `API_BASE_URL`.
