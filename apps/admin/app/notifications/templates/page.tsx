import Link from 'next/link';

export default function TemplatesPage() {
  return (
    <main>
      <div className="bar">
        <div>
          <h1 className="page-title">Notification templates</h1>
          <p className="page-sub">
            Template management is temporarily disabled.
          </p>
        </div>
        <Link href="/notifications">← Send notifications</Link>
      </div>

      <section className="panel">
        <h2 style={{ fontSize: 16, marginTop: 0 }}>Temporarily unavailable</h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          The admin can still send notifications from the main notifications page.
          Template listing and creation are hidden for now.
        </p>
      </section>
    </main>
  );
}
