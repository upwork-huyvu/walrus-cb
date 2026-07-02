# Progress: Admin redesign "Gilded Noir" + tính năng

- **Slug:** `m1-admin-royal-redesign`
- **Phase hiện tại:** `TEST` (Phase 1+2 code done)
- **Trạng thái:** `in_progress` (code_done — feature chạy; AC4 gửi thật chờ Tuya subscribe)
- **Cập nhật lần cuối:** 2026-07-02

## ▶ Hành động kế tiếp
**Phase 1+2 XONG + verified** (admin tsc 0 · eslint 0 · backend jest 26/26 · browser 4 khu vực render đẹp).
Ảnh: `royal-login.png`, `royal-users.png`, `royal-admins.png`, `royal-notifications.png`. Dev server đang
chạy (:3000 backend, :3001 admin). **Còn:** commit; AC4 "gửi thật" chờ Tuya subscribe API message-push
(việc client — như m1-admin-push blocker) + có user Tuya để test round-trip.
**Bonus fix:** bug redirect-loop token-expiry (proxy.ts).

## Checklist bước (đồng bộ plan mục 4)
- [x] B1 — globals.css Gilded Noir + fonts (Cormorant+Inter) + thay #16a34a · **done**
- [x] B2 — AdminShell sidebar (gộp 2 layout, active qua usePathname) · **done**
- [x] B3 — reskin login (card royal) + hết green hardcode · **done**
- [x] B4 — admin-mgmt list+xoá · **done** (backend GET/DELETE /admin/users, chặn tự-xoá 403/404; trang /admins)
- [x] B5 — notification targeting · **done** (backend uids[]/all loop, jest 8/8; UI multi-select+all+manual UID)

## Checklist AC (đồng bộ plan mục 3)
- [x] AC1 — theme Gilded Noir, render sạch (hết sky-blue/green hardcode) ✅
- [x] AC2 — AdminShell sidebar dùng chung (active gold indicator) ✅
- [x] AC3 — /admins list + xoá + backend endpoint ✅ (list 200; self-delete 403; not-found 404)
- [x] AC4 — gửi nhiều user / gửi tất cả (backend loop) ✅ *(logic jest 8/8; gửi thật chờ Tuya subscribe)*
- [x] AC5 — tsc/lint sạch + browser 4 khu vực OK ✅ (admin tsc 0 · eslint 0 · backend jest 26/26)

## Nhật ký chạy
| Thời gian | Bước | Kết quả | Ghi chú |
|---|---|---|---|
| 2026-07-02 | DEV+TEST B4–B5 (Phase 2) | ✅ | B4 admin-mgmt: backend `GET/DELETE /admin/users` (listAdmins/deleteAdmin, chặn tự-xoá) + trang `/admins` (list+DeleteAdminButton). Verify: list 200 (2 admin), self-delete 403, not-found 404, UI đẹp. B5 targeting: `SendPushDto` uids[]/all + `sendPush` loop per-uid + `allUserUids` enumerate (+export UsersService, import UsersModule); spec **8/8**. Frontend `SendPushForm` (radio chọn/all + checkbox list + manual UID + batch result) + `page.tsx` nạp user list. **backend jest 26/26 · admin tsc 0 · eslint 0.** `royal-admins.png`, `royal-notifications.png`. |
| 2026-07-02 | DEV+TEST B1–B3 (Phase 1) | ✅ | globals.css Gilded Noir (tokens + sidebar/table/button/badge/input) + next/font Cormorant+Inter + AdminShell sidebar (gộp 2 layout) + reskin login + thay 2 literal #16a34a. **Fix bug redirect-loop token-expiry** (proxy.ts bỏ auto-bounce /login + gate /admins). tsc admin 0 (sau khi dọn `.next/types/* 2.ts` rác nhân đôi). Browser: login + /users render đẹp (`royal-login.png`, `royal-users.png`). |
| 2026-07-02 | PLAN | ✅ | Workflow research (design tokens + map). User chốt 3 quyết định. 5 bước / 2 phase. |

## Blockers
- iOS/Android filter + tạo admin từ UI = ngoài scope (đã chốt). Không blocker cho Phase 1-2 đã định.
