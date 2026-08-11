import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

// Bọc /devices/* trong shell dashboard. Thiếu file này thì cả /devices lẫn /devices/[id] render
// trần, không có sidebar - mỗi nhánh route trong app/ phải tự khai layout hoặc kế thừa từ cha,
// và app/layout.tsx (root) cố ý KHÔNG bọc shell vì /login không được có sidebar.
export default function DevicesLayout({ children }: { children: ReactNode }) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
