import { apiGet } from '@/lib/api';
import DeleteAdminButton from '@/components/DeleteAdminButton';

export const dynamic = 'force-dynamic';

type AdminRow = { id: string; email: string; createdAt: string };

export default async function AdminsPage() {
  const admins = await apiGet<AdminRow[]>('/admin/users');

  return (
    <main>
      <div style={{ marginBottom: 16 }}>
        <h1 className="page-title">Admins</h1>
        <p className="page-sub">
          Allowlist of accounts with admin access. Revoking removes the account from the
          allowlist (the Supabase account is kept). To add a new admin, seed via Supabase/DB (outside this UI).
        </p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Added on</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {admins.length === 0 ? (
            <tr>
              <td colSpan={3} className="muted">
                No admins in the allowlist yet.
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
