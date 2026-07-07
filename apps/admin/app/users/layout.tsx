import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

// Dashboard shell cho khu vực /users/* (đã đăng nhập).
export default function UsersLayout({ children }: { children: ReactNode }) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
