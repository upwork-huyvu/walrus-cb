'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { logout } from '@/lib/auth';

// Shell dashboard dùng chung (sidebar royal). Active item qua usePathname.
const NAV = [
  { href: '/users', label: 'Tuya users', ico: '❄' },
  { href: '/admins', label: 'Admins', ico: '⚜' },
  { href: '/notifications', label: 'Send notifications', ico: '✉' },
  { href: '/notifications/templates', label: 'Templates', ico: '▤' },
];

function activeHref(path: string): string {
  if (path.startsWith('/users')) return '/users';
  if (path.startsWith('/admins')) return '/admins';
  // Templates trước /notifications (prefix con) để highlight đúng mục.
  if (path.startsWith('/notifications/templates')) return '/notifications/templates';
  if (path.startsWith('/notifications')) return '/notifications';
  return '';
}

export default function AdminShell({
  children,
  hideTemplates = false,
}: {
  children: ReactNode;
  hideTemplates?: boolean;
}) {
  const active = activeHref(usePathname());
  // provider=fcm → ẩn hẳn mục Templates (Tuya-only) khỏi UI.
  const nav = hideTemplates
    ? NAV.filter((n) => n.href !== '/notifications/templates')
    : NAV;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="mark">❄</span>
          <div className="wordmark">
            Walrus
            <small>Admin</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">Manage</div>
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`nav-item${active === n.href ? ' active' : ''}`}
            >
              <span className="ico">{n.ico}</span>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <form action={logout}>
            <button type="submit" style={{ width: '100%' }}>
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
