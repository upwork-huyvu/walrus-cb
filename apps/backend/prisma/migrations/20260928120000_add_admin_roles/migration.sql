-- Vai trò admin: SUPERADMIN thêm/gỡ được admin, ADMIN thì không.
CREATE TYPE "admin_role" AS ENUM ('SUPERADMIN', 'ADMIN');

ALTER TABLE "admin_users" ADD COLUMN "role" "admin_role" NOT NULL DEFAULT 'ADMIN';

-- "Chỉ có MỘT superadmin" ép ở tầng DB chứ không chỉ tin vào tầng code: unique index một phần
-- trên cột role, nhưng CHỈ tính các dòng SUPERADMIN - mọi dòng lọt vào index đều cùng một giá
-- trị khoá, nên dòng SUPERADMIN thứ hai bị chặn ngay ở Postgres.
CREATE UNIQUE INDEX "admin_users_one_superadmin"
  ON "admin_users" ("role")
  WHERE "role" = 'SUPERADMIN';

-- admin@admin.com là superadmin. Chưa có trong allowlist thì thêm - lưu ý allowlist chỉ cấp
-- QUYỀN; muốn đăng nhập được thì tài khoản Supabase Auth cùng email vẫn phải tồn tại.
INSERT INTO "admin_users" ("id", "email", "role", "createdAt")
VALUES (gen_random_uuid()::text, 'admin@admin.com', 'SUPERADMIN', CURRENT_TIMESTAMP)
ON CONFLICT ("email") DO UPDATE SET "role" = 'SUPERADMIN';
