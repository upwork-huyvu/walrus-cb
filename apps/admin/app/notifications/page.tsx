import SendPushForm, { type Recipient } from '@/components/SendPushForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type UserRow = { uid: string; username?: string; email?: string };
type UserList = { list?: UserRow[] };

export default async function NotificationsPage() {
  // Users list as the multi-select source (ignore errors — manual UID entry still works).
  let recipients: Recipient[] = [];
  try {
    const u = await apiGet<UserList>('/users?page_no=1&page_size=100');
    recipients = (u.list ?? []).map((x) => ({
      uid: x.uid,
      label: `${x.username ?? x.email ?? x.uid} · ${x.uid}`,
    }));
  } catch {
    // ignore
  }

  return (
    <main>
      <div className="bar">
        <div>
          <h1 className="page-title">Send notifications</h1>
          <p className="page-sub">
            Enter a title + description → choose recipients (multiple users / all) → send via FCM (no template needed)
          </p>
        </div>
      </div>

      <SendPushForm recipients={recipients} />
    </main>
  );
}
