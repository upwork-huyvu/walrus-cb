import Link from 'next/link';
import { apiGet } from '@/lib/api';
import { IconDevice, IconEye, IconShield, IconUsers } from '@/components/Icons';

export const dynamic = 'force-dynamic';

type UsersResponse = { total: number };
type DeviceRow = { id?: string; online?: boolean };
type AdminRow = { email: string };

/**
 * Tổng quan. Ba con số đều lấy từ backend thật (không hardcode); mỗi nguồn bọc try/catch riêng để
 * một API hỏng không kéo sập cả trang - đúng bài học từ sự cố `1106 permission deny` làm trắng
 * cả Users lẫn Devices.
 */
async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export default async function DashboardPage() {
  const [users, devices, admins] = await Promise.all([
    safe(() => apiGet<UsersResponse>('/users?page_no=1&page_size=1'), { total: -1 }),
    safe(() => apiGet<DeviceRow[]>('/admin/devices'), null as DeviceRow[] | null),
    safe(() => apiGet<AdminRow[]>('/admin/users'), null as AdminRow[] | null),
  ]);

  const cards = [
    {
      href: '/users',
      label: 'Tuya users',
      value: users.total >= 0 ? users.total : '—',
      hint: users.total >= 0 ? 'Registered through the app' : 'Could not reach Tuya Cloud',
      Icon: IconUsers,
      tone: 'gold',
    },
    {
      href: '/devices',
      label: 'Devices',
      value: devices?.length ?? '—',
      hint: devices ? `${devices.filter((d) => d.online).length} online right now` : 'Could not reach Tuya Cloud',
      Icon: IconDevice,
      tone: 'green',
    },
    {
      href: '/admins',
      label: 'Admins',
      value: admins?.length ?? '—',
      hint: admins ? 'With dashboard access' : 'Could not reach the backend',
      Icon: IconShield,
      tone: 'violet',
    },
  ] as const;

  return (
    <main className="page-wide">
      <div className="page-head">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-sub">Overview of the Walrus fleet and who can administer it</p>
        </div>
      </div>

      <section className="stat-grid">
        {cards.map(({ href, label, value, hint, Icon, tone }) => (
          <div key={href} className="stat-card">
            <span className={`stat-ico ${tone}`}>
              <Icon size={19} />
            </span>
            <div className="stat-body">
              <div className="stat-label">{label}</div>
              <div className="stat-value">{value}</div>
              <div className="stat-hint">{hint}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Section</th>
              <th>What you can do there</th>
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {[
              { href: '/users', name: 'Tuya users', what: 'Browse app accounts, inspect a user and their devices, delete an account.' },
              { href: '/devices', name: 'Devices', what: 'See every ice bath across all users, with live status and remote control.' },
              { href: '/admins', name: 'Admins', what: 'Manage who is allowed into this dashboard.' },
              { href: '/notifications', name: 'Send notifications', what: 'Push a message to app users.' },
            ].map((r) => (
              <tr key={r.href}>
                <td className="cell-main">{r.name}</td>
                <td className="muted break">{r.what}</td>
                <td className="right">
                  <Link href={r.href} className="btn btn-sm view-btn">
                    <IconEye />
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
