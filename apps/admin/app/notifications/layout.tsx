import { type ReactNode } from 'react';
import AdminShell from '@/components/AdminShell';

// Shell admin cho khu /notifications/* (dùng chung AdminShell với /users).
export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminShell>{children}</AdminShell>;
}
