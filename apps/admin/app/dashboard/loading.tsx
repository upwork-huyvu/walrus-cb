import { SkeletonCards, SkeletonHeader, SkeletonTable } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main className="page-wide">
      <SkeletonHeader />
      <SkeletonCards count={3} />
      <SkeletonTable rows={4} withAvatar={false} />
    </main>
  );
}
