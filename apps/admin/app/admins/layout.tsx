import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

// Shell admin cho khu /admins/* (dùng chung AdminShell).
export default function AdminsLayout({ children }: { children: ReactNode }) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
