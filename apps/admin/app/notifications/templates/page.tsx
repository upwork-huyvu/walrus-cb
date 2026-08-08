import { unstable_rethrow } from 'next/navigation';
import Link from 'next/link';
import CreateTemplateForm from '@/components/CreateTemplateForm';
import { apiGet, getActiveProvider } from '@/lib/api';

export const dynamic = 'force-dynamic';

type TemplateStatus = 0 | 1 | 2;
type Template = {
  template_id: string;
  name?: string;
  title?: string;
  content?: string;
  type?: number;
  status?: TemplateStatus;
  verify_reason?: string;
};
type TemplateList = { list?: Template[]; total?: number };

// Tuya review status: 0 = đang duyệt · 1 = đã duyệt · 2 = bị từ chối.
const STATUS: Record<TemplateStatus, { label: string; cls: string }> = {
  0: { label: 'Pending review', cls: 'gold' },
  1: { label: 'Approved', cls: 'success' },
  2: { label: 'Rejected', cls: 'danger' },
};

function StatusBadge({ status }: { status?: TemplateStatus }) {
  const s = status != null ? STATUS[status] : undefined;
  if (!s) return <span className="badge">Unknown</span>;
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

export default async function TemplatesPage() {
  // Provider đang bật - template CHỈ áp dụng cho Tuya App Push; provider=fcm → vô hiệu hoá.
  // Fallback 'fcm'; auth-fail → /login (không nuốt redirect).
  const provider = await getActiveProvider();
  const isFcm = provider === 'fcm';

  let data: TemplateList = {};
  let error = '';
  if (!isFcm) {
    try {
      data = await apiGet<TemplateList>('/notifications/templates?page_no=1&page_size=50');
    } catch (e) {
      unstable_rethrow(e); // auth-fail → /login; lỗi khác → hiện error message
      error = e instanceof Error ? e.message : 'Failed to load templates';
    }
  }
  const list = data.list ?? [];

  return (
    <main>
      <div className="bar">
        <div>
          <h1 className="page-title">Notification templates</h1>
          <p className="page-sub">
            Templates apply only to <strong>Tuya App Push</strong>. New templates need Tuya review (≤2 business days).
          </p>
        </div>
        <Link href="/notifications">← Send notifications</Link>
      </div>

      {isFcm ? (
        <div className="panel" style={{ padding: 20 }}>
          <p style={{ margin: 0 }}>
            🚫 Currently sending via <strong>Firebase (FCM)</strong> - Tuya templates don’t apply and are disabled.
          </p>
          <p className="muted" style={{ fontSize: 13, marginTop: 10, marginBottom: 0 }}>
            Compose free-form on the{' '}
            <Link href="/notifications">Send notifications</Link> page (Title / Body / Image / Deeplink).
            Templates are only needed for Tuya App Push (backend <code>NOTIFICATION_PROVIDER=tuya</code>).
          </p>
        </div>
      ) : (
        <>
          {error ? <p className="error">{error}</p> : null}

          <section style={{ marginBottom: 28 }}>
            <table>
              <thead>
                {/* Tuya list API chỉ trả name/content/status/template_id - KHÔNG có title/type/ngày tạo. */}
                <tr>
                  <th>Name</th>
                  <th>Content</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 && !error ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No templates yet - create one below.
                    </td>
                  </tr>
                ) : (
                  list.map((t) => (
                    <tr key={t.template_id}>
                      <td>
                        <div className="cell-main">{t.name ?? '-'}</div>
                        <div className="cell-sub">{t.template_id}</div>
                      </td>
                      <td style={{ maxWidth: 320 }}>{t.content ?? '-'}</td>
                      <td>
                        <StatusBadge status={t.status} />
                        {t.status === 2 && t.verify_reason ? (
                          <div className="cell-sub" style={{ color: 'var(--danger)' }}>
                            {t.verify_reason}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <h2 style={{ fontSize: 16, marginBottom: 4 }}>Create template</h2>
          <p className="page-sub" style={{ marginBottom: 16 }}>
            For free-form sends, use variables like {'${title}'} / {'${content}'}. Submitted for Tuya review.
          </p>
          <CreateTemplateForm />
        </>
      )}
    </main>
  );
}
