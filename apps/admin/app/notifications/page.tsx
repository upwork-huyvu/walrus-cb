import SendPushForm, { type Recipient } from '@/components/SendPushForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type UserRow = { uid: string; username?: string; email?: string };
type UserList = { list?: UserRow[] };

export default async function NotificationsPage() {
  // Danh sách user làm nguồn multi-select (lỗi thì bỏ qua — vẫn nhập UID thủ công được).
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
          <h1 className="page-title">Gửi thông báo</h1>
          <p className="page-sub">
            Nhập tên + mô tả → chọn người nhận (nhiều user / tất cả) → gửi qua FCM (không cần template)
          </p>
        </div>
      </div>

      <SendPushForm recipients={recipients} />
    </main>
  );
}
