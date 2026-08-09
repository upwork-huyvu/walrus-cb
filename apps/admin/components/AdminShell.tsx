'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode } from 'react';
import { logout } from '@/lib/auth';
import {
  IconDevice,
  IconGear,
  IconHome,
  IconLogout,
  IconSend,
  IconShield,
  IconTemplate,
  IconUsers,
} from './Icons';

// Shell dashboard dùng chung. Sidebar GIM CỨNG: `position: sticky; top: 0; height: 100vh` trong
// globals.css (.sidebar) + `overflow-y: auto` riêng cho vùng nav → trang dài bao nhiêu thì menu vẫn
// đứng yên, và nếu menu dài hơn màn hình thì chỉ NỘI BỘ nav cuộn, còn logo và nút Sign out không
// bao giờ trôi khỏi tầm mắt.

type NavItem = {
  href: string;
  label: string;
  Icon: (p: { size?: number }) => ReactNode;
};

const GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: '/dashboard', label: 'Dashboard', Icon: IconHome }] },
  {
    title: 'Tuya Cloud',
    items: [
      { href: '/users', label: 'Tuya users', Icon: IconUsers },
      { href: '/devices', label: 'Devices', Icon: IconDevice },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admins', label: 'Admins', Icon: IconShield },
      { href: '/settings', label: 'Settings', Icon: IconGear },
    ],
  },
  {
    title: 'Notifications',
    items: [{ href: '/notifications', label: 'Send notifications', Icon: IconSend }],
  },
];

const TEMPLATES: NavItem = {
  href: '/notifications/templates',
  label: 'Templates',
  Icon: IconTemplate,
};

/** Mục nào đang active. Prefix con (templates) phải xét TRƯỚC prefix cha (/notifications). */
function activeHref(path: string): string {
  if (path.startsWith('/notifications/templates')) return '/notifications/templates';
  for (const g of GROUPS) {
    for (const it of g.items) {
      if (path === it.href || path.startsWith(`${it.href}/`)) return it.href;
    }
  }
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
  // provider=fcm → ẩn hẳn Templates (Tuya-only) khỏi UI.
  const groups = GROUPS.map((g) =>
    g.title === 'Notifications' && !hideTemplates
      ? { ...g, items: [...g.items, TEMPLATES] }
      : g,
  );

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
          {groups.map((g, gi) => (
            <div key={g.title ?? `g${gi}`} className="nav-section">
              {g.title ? <div className="nav-group">{g.title}</div> : null}
              {g.items.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-item${active === href ? ' active' : ''}`}
                  aria-current={active === href ? 'page' : undefined}
                >
                  <span className="ico">
                    <Icon size={18} />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-foot">
          <form action={logout}>
            <button type="submit" className="signout">
              <IconLogout size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="content">{children}</div>
    </div>
  );
}
