import { apiGet, getActiveProvider } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Me = { id: string; email: string };

/**
 * Settings - hiện CHỈ ĐỌC. Cố tình không có nút sửa: mọi giá trị dưới đây là biến môi trường của
 * backend (Vercel / .env), đổi từ trình duyệt nghĩa là phải cho dashboard quyền ghi env - không
 * đáng đánh đổi. Trang này để trả lời nhanh "instance đang trỏ đi đâu, ai đang đăng nhập".
 */
export default async function SettingsPage() {
  const me = await apiGet<Me>('/admin/me');
  let provider = 'unknown';
  try {
    provider = await getActiveProvider();
  } catch {
    /* giữ 'unknown' - không đáng làm sập trang */
  }

  const rows: { k: string; v: string; note?: string }[] = [
    { k: 'Signed in as', v: me.email, note: `Supabase user ${me.id}` },
    {
      k: 'Push provider',
      v: provider.toUpperCase(),
      note: provider === 'fcm' ? 'Firebase Cloud Messaging — Tuya templates are hidden' : 'Tuya app push',
    },
    {
      k: 'Admin access',
      v: 'Supabase Auth + admin_users allowlist',
      note: 'An account needs BOTH to get in',
    },
  ];

  return (
    <main className="page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-sub">
            Read-only view of how this dashboard is wired. Values come from backend environment
            variables.
          </p>
        </div>
      </div>

      <section className="table-card">
        <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Setting</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="muted">{r.k}</td>
                <td>
                  <div className="cell-main">{r.v}</div>
                  {r.note ? <div className="cell-sub">{r.note}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </section>
    </main>
  );
}
