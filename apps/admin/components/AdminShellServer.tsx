import { type ReactNode } from 'react';
import AdminShell from './AdminShell';
import { apiGet } from '@/lib/api';

// Server wrapper: fetch NOTIFICATION_PROVIDER 1 lần → ẩn mục Templates khỏi sidebar khi dùng FCM
// (template là Tuya-only). Dùng chung cho mọi layout admin để nav nhất quán.
export default async function AdminShellServer({ children }: { children: ReactNode }) {
  let provider = 'tuya';
  try {
    const p = await apiGet<{ provider?: string }>('/notifications/provider');
    if (p.provider) provider = p.provider;
  } catch {
    // ignore - mặc định hiện Templates
  }
  return <AdminShell hideTemplates={provider === 'fcm'}>{children}</AdminShell>;
}
