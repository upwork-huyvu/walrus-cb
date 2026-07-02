import { type ReactNode } from 'react';
import AdminShell from '@/components/AdminShell';

// Dashboard shell cho khu vực /users/* (đã đăng nhập).
export default function UsersLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
