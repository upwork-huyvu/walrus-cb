import { SkeletonHeader, SkeletonTable } from '@/components/Skeletons';

// Riêng cho /notifications/templates - nếu thiếu thì rơi vào `notifications/loading.tsx` (khung
// FORM gửi thông báo), trong khi trang này là một bảng template.
export default function Loading() {
  return (
    <main>
      <SkeletonHeader />
      <SkeletonTable rows={4} withAvatar={false} />
    </main>
  );
}
