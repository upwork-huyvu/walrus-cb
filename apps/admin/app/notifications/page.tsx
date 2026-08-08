import { unstable_rethrow } from 'next/navigation';
import SendPushForm, { type Recipient } from '@/components/SendPushForm';
import { apiGet, getActiveProvider } from '@/lib/api';

export const dynamic = 'force-dynamic';

type UserRow = {
  uid: string;
  username?: string;
  email?: string;
  nick_name?: string; // backend enrich từ Tuya detail
  avatar?: string;
};
type UserList = { list?: UserRow[] };

const PROVIDER_LABEL: Record<string, string> = {
  tuya: 'Tuya App Push',
  fcm: 'Firebase (FCM)',
};

export default async function NotificationsPage() {
  // Users list as the multi-select source (ignore errors - manual UID entry still works).
  let recipients: Recipient[] = [];
  try {
    const u = await apiGet<UserList>('/users?page_no=1&page_size=100');
    recipients = (u.list ?? []).map((x) => ({
      uid: x.uid,
      email: x.email,
      username: x.username ?? x.nick_name,
      avatar: x.avatar,
    }));
  } catch (e) {
    unstable_rethrow(e); // auth-fail → /login; lỗi khác → recipients rỗng (vẫn nhập uid tay được)
  }

  // Provider gửi đang bật (backend NOTIFICATION_PROVIDER). Fallback 'fcm'; auth-fail → /login.
  const provider = await getActiveProvider();

  return (
    <main>
      <div className="bar">
        <div>
          <h1 className="page-title">Send notifications</h1>
          <p className="page-sub">
            Enter a title + description → choose recipients (multiple users / all) → send.
          </p>
        </div>
        <span className={`badge ${provider === 'fcm' ? 'success' : 'gold'}`} title="Configured via NOTIFICATION_PROVIDER (backend ENV)">
          Sending via: {PROVIDER_LABEL[provider] ?? provider}
        </span>
      </div>

      <SendPushForm recipients={recipients} provider={provider} />
    </main>
  );
}
