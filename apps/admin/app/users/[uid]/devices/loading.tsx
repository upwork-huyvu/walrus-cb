import { SkeletonHeader, SkeletonTable } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="page-wide">
      <SkeletonHeader />
      <SkeletonTable rows={4} withAvatar={false} />
    </main>
  );
}
