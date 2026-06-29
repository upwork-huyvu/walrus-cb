import { type ReactNode } from 'react';
import Link from 'next/link';
import { logout } from '@/lib/auth';

// Dashboard shell cho khu vực admin đã đăng nhập (/users/*).
export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">❄</span>
          <div>
            <div className="brand-title">Cool Bath · Admin</div>
            <div className="brand-sub">Quản lý người dùng Tuya</div>
          </div>
        </div>
        <nav className="topnav">
          <Link href="/users">Người dùng Tuya</Link>
          <form action={logout} style={{ display: 'inline' }}>
            <button type="submit">Đăng xuất</button>
          </form>
        </nav>
      </header>
      {children}
    </div>
  );
}
