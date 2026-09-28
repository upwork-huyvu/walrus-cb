# Context: m1-admin-roles

## Quyết định & lý do
1. **"Chỉ một superadmin" ép ở tầng DB, không chỉ ở code.**
   `CREATE UNIQUE INDEX ... ON admin_users (role) WHERE role = 'SUPERADMIN'` - index một phần nên
   mọi dòng lọt vào đều cùng một giá trị khoá ⇒ dòng thứ hai bị Postgres chặn. Code có bug hay ai
   đó sửa tay trong Supabase Studio thì vẫn không tạo được superadmin thứ hai.
2. **Superadmin KHÔNG gỡ được, kể cả tự gỡ.** Luật cũ chỉ chặn "tự gỡ chính mình"; giờ chặn theo
   vai trò. Nếu không, chỉ cần một lần bấm nhầm là dashboard mất sạch người quản lý được admin.
3. **Sai mật khẩu hiện tại → HTTP 400, KHÔNG phải 401.** Admin web quy ước mọi 401 = hết phiên →
   đá về `/login`. Dùng 401 cho "gõ sai mật khẩu" thì gõ nhầm một cái là bị đăng xuất.
4. **Đổi mật khẩu bắt nhập lại mật khẩu hiện tại** (verify bằng password grant rồi mới gọi Admin
   API). Token nằm trong cookie 8 tiếng - không bắt thì ai mượn được máy lúc còn đăng nhập là
   chiếm luôn tài khoản.
5. **Email đã có tài khoản Supabase → vẫn cấp quyền admin nhưng KHÔNG đụng mật khẩu của người ta**,
   và trả `created: false` để UI nói thẳng "mật khẩu vừa gõ không được dùng". Im lặng ghi đè mật
   khẩu người khác là chuyện không được phép làm.
6. **Email chuẩn hoá `trim().toLowerCase()` trước khi ghi allowlist.** Supabase trả email chữ
   thường, mà `assertAdmin` tra allowlist bằng đúng chuỗi đó - lệch hoa/thường là admin mới
   đăng nhập được nhưng bị 403.
7. **Thêm/gỡ admin = superadmin only; đổi mật khẩu = ai cũng được (của chính mình).**
   Người dùng chỉ nói rõ "superadmin để xoá admin"; thêm admin cũng xếp vào superadmin cho nhất
   quán - cả cụm quản lý admin nằm trong tay một người.

## Bản đồ file
| File | Vai trò |
|---|---|
| `apps/backend/prisma/schema.prisma` | enum `AdminRole` + cột `role` trên `AdminUser` |
| `apps/backend/prisma/migrations/20260928120000_add_admin_roles/migration.sql` | **ĐÃ CHẠY 2026-09-28** - thêm cột + unique index + set `admin@admin.com` |
| `apps/backend/src/admin-auth/admin-auth.service.ts` | `role` trong principal · `assertSuperadmin` · `createAdmin` · `changeOwnPassword` · `deleteAdmin` |
| `apps/backend/src/admin-auth/admin-auth.controller.ts` | `POST /admin/users` · `PATCH /admin/me/password` |
| `apps/backend/src/admin-auth/dto/{create-admin,change-password}.dto.ts` | validate (mật khẩu ≥8) |
| `apps/admin/app/(dashboard)/admins/page.tsx` | cột Role + ẩn/hiện theo vai trò + 2 form |
| `apps/admin/app/(dashboard)/admins/actions.ts` | `createAdminAction` · `changePasswordAction` · `deleteAdmin` |
| `apps/admin/components/{AddAdminForm,ChangePasswordForm}.tsx` | 2 form mới |

## Phát hiện cần nhớ
- `SUPABASE_SERVICE_ROLE_KEY` **đã có trong `.env`** nhưng trước feature này **chưa chỗ nào dùng**.
  Giờ cần cho GoTrue Admin API (`POST /auth/v1/admin/users`, `PUT /auth/v1/admin/users/{id}`).
  Deploy production mà quên biến này thì thêm admin / đổi mật khẩu sẽ ngã.
- `admin_users.id` (uuid của dòng allowlist) **KHÁC** `AdminPrincipal.id` (id tài khoản Supabase
  Auth). Xoá admin dùng cái đầu, đổi mật khẩu dùng cái sau - lẫn là sai người.
- Allowlist chỉ cấp QUYỀN. Migration có `INSERT ... ON CONFLICT` cho `admin@admin.com`, nhưng nếu
  email đó **chưa có tài khoản Supabase Auth** thì vẫn chưa đăng nhập được - phải tạo tài khoản
  (Supabase Studio, hoặc để một superadmin khác dùng form Add admin).
  **Thực tế 2026-09-28:** cả `admin@admin.com` lẫn `admin@walrus.app` đều đã có tài khoản Auth và
  đã confirm ⇒ không phải tạo gì thêm.
- **Supabase MCP đang nối vào tài khoản KHÁC** (chỉ thấy project `gfwcaivapotitmtsiwax` /
  "Honoured" ở ap-northeast-2), không thấy project walrus `vnttknzfogckgicmwqre` ⇒ **không dùng
  MCP để chạy migration được**. Đường đúng là Prisma CLI (`npm run db:deploy`), vốn kết nối tốt -
  và nó còn ghi `_prisma_migrations` cho khớp, thứ mà chạy SQL tay qua MCP sẽ bỏ sót.
- `npm run lint` của backend chạy kèm `--fix` ⇒ tự sửa format cả file không liên quan. Đã revert
  4 file bị đụng ngoài phạm vi (`env.validation.ts`, `notification-router.service{,.spec}.ts`,
  `app-info.service.ts`).

## Chưa kiểm chứng
- **Chưa chạy thử trên UI**: backend `localhost:3006` không bật, không có mật khẩu admin để đăng
  nhập. Mới xanh ở mức `tsc` · `eslint` · `jest 128/128` · `next build`, cộng với migration +
  ràng buộc một-superadmin đã kiểm chứng thật trên Supabase.
