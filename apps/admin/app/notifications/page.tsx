import Link from 'next/link';
import SendPushForm, { type Template } from '@/components/SendPushForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type TemplateList = { list?: Template[]; total?: number } | Template[];

export default async function NotificationsPage() {
  let templates: Template[] = [];
  let loadError: string | null = null;
  try {
    const data = await apiGet<TemplateList>('/notifications/templates');
    templates = Array.isArray(data) ? data : data.list ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Không tải được template';
  }

  return (
    <main>
      <div className="bar">
        <div>
          <h1 className="page-title">Gửi thông báo</h1>
          <p className="page-sub">
            Tuya Cloud App Push · chọn template đã duyệt → điền biến → gửi tới user theo UID
          </p>
        </div>
        <Link href="/notifications/templates">Quản lý template →</Link>
      </div>

      {loadError ? (
        <p className="error">
          Lỗi tải template: {loadError}. Kiểm tra backend đang chạy + đã subscribe &amp; tạo template.
        </p>
      ) : null}

      <SendPushForm templates={templates} />
    </main>
  );
}
