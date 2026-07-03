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
  { href: '/notifications/templates', label: 'Template', ico: '▤' },
];

function activeHref(path: string): string {
  if (path.startsWith('/users')) return '/users';
  if (path.startsWith('/admins')) return '/admins';
  if (path.startsWith('/notifications/templates')) return '/notifications/templates';
  if (path.startsWith('/notifications')) return '/notifications';
  return '';
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const active = activeHref(usePathname());
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-head">
          <span className="mark">❄</span>
          <div className="wordmark">
            Cool Bath
            <small>Admin</small>
          </div>
        </div>
        <nav className="sidebar-nav">
          <div className="nav-group">Manage</div>
          {NAV.map((n) => (
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
