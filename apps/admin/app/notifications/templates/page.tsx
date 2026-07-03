import Link from 'next/link';
import CreateTemplateForm from '@/components/CreateTemplateForm';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Template = {
  template_id: string;
  name?: string;
  title?: string;
  type?: number;
  status?: string | number;
};
type TemplateList = { list?: Template[]; total?: number } | Template[];

const TYPE_LABEL: Record<number, string> = {
  0: 'operations',
  1: 'system',
};

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
                  <td>{t.status ?? '—'}</td>
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
