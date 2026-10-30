import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function SalesRepsLoading() {
  return (
    <div className="max-w-[900px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 py-5 sm:py-10 lg:py-16">
      <div className="mb-4 sm:mb-6">
        <SkeletonPageHeader titleWidth="w-32" />
      </div>
      <div className="flex items-end justify-between mb-4">
        <Skeleton className="h-9 w-16" />
        <Skeleton className="h-10 w-28 rounded-[var(--radius-md)]" />
      </div>
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white divide-y divide-[var(--border-subtle)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
