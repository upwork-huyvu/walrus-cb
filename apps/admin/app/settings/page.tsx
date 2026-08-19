import Link from 'next/link';
import { apiGet, getActiveProvider } from '@/lib/api';
import { IconArrowRight, IconTrash } from '@/components/Icons';

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

      {/* Thùng rác đặt ở ĐÂY chứ không phải màn Users: ở đó nó nằm cạnh danh sách thật, rất dễ
          bấm nhầm khi đang thao tác hằng ngày. Đây là khu vực quản trị, vào có chủ đích. */}
      <section className="panel-card admin-tool">
        <h2 className="card-title">
          <IconTrash size={16} /> Deleted users
        </h2>
        <p className="page-sub" style={{ margin: '0 0 14px' }}>
          Deleting a customer does not remove them straight away. Tuya keeps the account for a{' '}
          <strong>seven-day grace period</strong> before erasing it for good. During that window the
          account is hidden from the customer list and waits here, where you can either{' '}
          <strong>restore</strong> it or <strong>delete it permanently</strong> without waiting.
        </p>
        <p className="page-sub" style={{ margin: '0 0 16px' }}>
          After seven days Tuya removes the account on its own and it can no longer be restored.
        </p>
        <Link href="/users/deleted" className="btn btn-sm view-btn">
          Open deleted users <IconArrowRight />
        </Link>
      </section>
    </main>
  );
}
