import Link from 'next/link';
import SendPushForm, {
  type Recipient,
  type Template,
} from '@/components/SendPushForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type TemplateList = { list?: Template[]; total?: number } | Template[];
type UserRow = { uid: string; username?: string; email?: string };
type UserList = { list?: UserRow[] };

export default async function NotificationsPage() {
  let templates: Template[] = [];
  let loadError: string | null = null;
  try {
    const data = await apiGet<TemplateList>('/notifications/templates');
    templates = Array.isArray(data) ? data : data.list ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load templates';
  }

  // Danh sách user Tuya làm nguồn multi-select (lỗi thì bỏ qua — vẫn nhập UID thủ công được).
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
            Tuya Cloud App Push · pick an approved template → choose recipients (multiple users / all) → send
          </p>
        </div>
        <Link href="/notifications/templates">Manage templates →</Link>
      </div>

      {loadError ? (
        <p className="error">
          Failed to load templates: {loadError}. Check that the backend is running and you have subscribed &amp; created templates.
        </p>
      ) : null}

      <SendPushForm templates={templates} recipients={recipients} />
    </main>
  );
}
