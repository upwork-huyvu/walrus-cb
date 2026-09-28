import { SkeletonHeader } from '@/components/Skeletons';

// Trang chi tiết thiết bị: link quay lại + tiêu đề + bảng điều khiển. Không có file này thì
// `devices/loading.tsx` (khung BẢNG danh sách) bị dùng tạm cho trang chi tiết → nhìn lệch hẳn.
export default function Loading() {
  return (
    <main>
      <div className="sk sk-line" style={{ width: 130, marginBottom: 14 }} />
      <SkeletonHeader />
      <div className="sk sk-card" style={{ height: 320 }} />
    </main>
  );
}
