import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
