import { type ReactNode } from 'react';
import Link from 'next/link';
import { logout } from '@/lib/auth';

// Shell admin đã đăng nhập cho khu /notifications (mirror /users layout).
export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">❄</span>
          <div>
            <div className="brand-title">Cool Bath · Admin</div>
            <div className="brand-sub">Gửi thông báo</div>
          </div>
        </div>
        <nav className="topnav">
          <Link href="/users">Người dùng Tuya</Link>
          <Link href="/notifications">Gửi thông báo</Link>
          <Link href="/notifications/templates">Template</Link>
          <form action={logout} style={{ display: 'inline' }}>
            <button type="submit">Đăng xuất</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
