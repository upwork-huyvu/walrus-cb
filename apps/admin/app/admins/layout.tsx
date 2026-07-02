import { type ReactNode } from 'react';
import AdminShell from '@/components/AdminShell';

// Shell admin cho khu /admins/* (dùng chung AdminShell).
export default function AdminsLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
