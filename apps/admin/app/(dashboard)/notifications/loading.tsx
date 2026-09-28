import { SkeletonHeader } from '@/components/Skeletons';

export default function Loading() {
  return (
    <main>
      <SkeletonHeader />
      <div className="sk sk-card" style={{ height: 420 }} />
    </main>
  );
}
