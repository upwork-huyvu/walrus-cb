import Link from 'next/link';
import CreateTemplateForm from '@/components/CreateTemplateForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Template = {
  template_id: string;
  name?: string;
  title?: string;
  type?: number;
  status?: number; // 0 pending review · 1 approved · 2 rejected (doc 9dc9d8c906)
  verify_reason?: string;
};
type TemplateList = { list?: Template[]; total?: number } | Template[];

const TYPE_LABEL: Record<number, string> = {
  0: 'operations',
  1: 'system',
};

// Trạng thái duyệt của Tuya: chỉ template approved (1) gửi được.
const STATUS_BADGE: Record<number, { label: string; color: string }> = {
  0: { label: 'Pending review', color: '#b8860b' },
  1: { label: 'Approved', color: '#2e7d32' },
  2: { label: 'Rejected', color: '#c62828' },
};

function StatusBadge({ status, reason }: { status?: number; reason?: string }) {
  if (status === undefined) return <>—</>;
  const badge = STATUS_BADGE[status];
  if (!badge) return <>{status}</>;
  return (
    <span title={status === 2 && reason ? reason : undefined} style={{ color: badge.color }}>
      {badge.label}
      {status === 2 && reason ? ` · ${reason}` : ''}
    </span>
  );
}

export default async function TemplatesPage() {
  let templates: Template[] = [];
  let loadError: string | null = null;
  try {
    const data = await apiGet<TemplateList>('/notifications/templates');
    templates = Array.isArray(data) ? data : data.list ?? [];
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'Failed to load templates';
  }

  return (
    <main>
      <div className="bar">
        <h1 className="page-title">Notification templates</h1>
        <Link href="/notifications">← Send notifications</Link>
      </div>
      <p className="page-sub" style={{ marginBottom: 16 }}>
        Tuya reviews content within ≤2 business days. Only approved templates can be sent.
      </p>

      {loadError ? (
        <p className="error">Failed to load templates: {loadError}</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Template ID</th>
              <th>Name</th>
              <th>Title</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="muted">
                  No templates yet — create one below.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.template_id}>
                  <td>{t.template_id}</td>
                  <td>{t.name ?? '—'}</td>
                  <td>{t.title ?? '—'}</td>
                  <td>
                    {t.type === undefined
                      ? '—'
                      : `${t.type} · ${TYPE_LABEL[t.type] ?? '?'}`}
                  </td>
                  <td>
                    <StatusBadge status={t.status} reason={t.verify_reason} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}

      <h2 style={{ fontSize: 16, marginTop: 24 }}>Create a new template</h2>
      <CreateTemplateForm />
    </main>
  );
}
