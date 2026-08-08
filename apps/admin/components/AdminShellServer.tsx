import { type ReactNode } from 'react';
import AdminShell from './AdminShell';
import { getActiveProvider } from '@/lib/api';

// Server wrapper: fetch NOTIFICATION_PROVIDER 1 lần → ẩn mục Templates khỏi sidebar khi dùng FCM
// (template là Tuya-only). Dùng chung cho mọi layout admin để nav nhất quán.
// getActiveProvider: auth-fail → redirect /login (KHÔNG nuốt); lỗi khác → fallback 'fcm'.
export default async function AdminShellServer({ children }: { children: ReactNode }) {
  const provider = await getActiveProvider();
  return <AdminShell hideTemplates={provider === 'fcm'}>{children}</AdminShell>;
}
