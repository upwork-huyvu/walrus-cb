import { type ReactNode } from 'react';
import AdminShellServer from '@/components/AdminShellServer';

/**
 * Layout DÙNG CHUNG cho cả khu admin đã đăng nhập (`/dashboard`, `/users`, `/devices`, `/admins`,
 * `/settings`, `/notifications`). `(dashboard)` là route group → KHÔNG xuất hiện trong URL.
 *
 * Vì sao gom về một layout thay vì mỗi mục một `layout.tsx` như trước: `loading.tsx` của một
 * segment nằm BÊN TRONG `layout.tsx` của chính segment đó. Mỗi mục có layout riêng, mà layout đó
 * lại `await getActiveProvider()` (một lượt gọi backend), nên khi bấm đổi mục Next phải chờ xong
 * lượt gọi ấy rồi MỚI được phép hiện skeleton - màn hình đứng im trắng trơn qua 2 vòng mạng nối
 * tiếp nhau, người dùng tưởng bấm hụt.
 *
 * Gom lại: đổi mục = layout này KHÔNG render lại (Next giữ nguyên layout chung), sidebar không
 * dựng lại, provider không gọi lại → skeleton của `loading.tsx` hiện ngay lập tức.
 *
 * Hệ quả: `/login` phải nằm NGOÀI group này (không có sidebar) - đúng như đang xếp.
 */
export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return <AdminShellServer>{children}</AdminShellServer>;
}
