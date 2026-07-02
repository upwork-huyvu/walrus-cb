import { apiGet } from '@/lib/api';
import DeleteAdminButton from '@/components/DeleteAdminButton';

export const dynamic = 'force-dynamic';

type AdminRow = { id: string; email: string; createdAt: string };

export default async function AdminsPage() {
  const admins = await apiGet<AdminRow[]>('/admin/users');

  return (
    <main>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Quản trị viên</h1>
        <p className="page-sub">
          Allowlist tài khoản được phép truy cập admin. Gỡ quyền = xoá khỏi allowlist
          (không xoá tài khoản Supabase). Tạo mới: seed qua Supabase/DB (ngoài UI).
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Ngày thêm</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                Chưa có admin nào trong allowlist.
              </td>
            </tr>
          ) : (
            admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}</td>
                <td className="muted">
                  {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <DeleteAdminButton id={a.id} email={a.email} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </main>
  );
}
