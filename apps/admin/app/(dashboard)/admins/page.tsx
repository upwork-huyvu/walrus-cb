import { apiGet } from '@/lib/api';
import AddAdminForm from '@/components/AddAdminForm';
import ChangePasswordForm from '@/components/ChangePasswordForm';
import DeleteAdminButton from '@/components/DeleteAdminButton';

export const dynamic = 'force-dynamic';

type AdminRole = 'SUPERADMIN' | 'ADMIN';
type AdminRow = {
  id: string;
  email: string;
  role: AdminRole;
  createdAt: string;
};
/** `id` ở đây là id tài khoản Supabase Auth, KHÁC `AdminRow.id` (id dòng allowlist). */
type Me = { id: string; email: string; role: AdminRole };

export default async function AdminsPage() {
  const [me, admins] = await Promise.all([
    apiGet<Me>('/admin/me'),
    apiGet<AdminRow[]>('/admin/users'),
  ]);
  const isSuperadmin = me.role === 'SUPERADMIN';

  return (
    <main className="page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Admins</h1>
          <p className="page-sub">
            Allowlist of accounts with admin access. Only the <strong>superadmin</strong> can
            add or revoke admins; every admin can change their own password. Revoking removes
            the account from the allowlist - the Supabase account itself is kept.
          </p>
        </div>
      </div>

      <section className="table-card">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Added on</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.length === 0 ? (
              <tr>
                <td colSpan={4} className="empty-cell">
                  No admins in the allowlist yet.
                </td>
              </tr>
            ) : (
              admins.map((a) => (
                <tr key={a.id}>
                  <td className="cell-main">
                    {a.email}
                    {a.email === me.email ? (
                      <span className="muted"> (you)</span>
                    ) : null}
                  </td>
                  <td>
                    <span
                      className={a.role === 'SUPERADMIN' ? 'badge gold' : 'badge'}
                    >
                      {a.role === 'SUPERADMIN' ? 'Superadmin' : 'Admin'}
                    </span>
                  </td>
                  <td className="muted">
                    {new Date(a.createdAt).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="right">
                    {/* Superadmin không gỡ được (kể cả tự gỡ) - nếu không thì dashboard có thể
                        rơi vào cảnh không còn ai quản lý được admin. Backend chặn lần nữa. */}
                    {isSuperadmin && a.role !== 'SUPERADMIN' ? (
                      <div className="row-actions">
                        <DeleteAdminButton id={a.id} email={a.email} />
                      </div>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </section>

      <section
        className="admin-tool"
        style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'flex-start' }}
      >
        <ChangePasswordForm email={me.email} />
        {isSuperadmin ? <AddAdminForm /> : null}
      </section>
    </main>
  );
}
