import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

// Shell admin cho khu /notifications/* (dùng chung AdminShell với /users).
export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
