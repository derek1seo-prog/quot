import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

/** Instant 컨테이너 현황 shell - overview, to-dos, toolbar, two ship cards. */
export default function ContainersLoading() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-5 sm:py-10 lg:py-14">
      <div className="mb-4 sm:mb-6">
        <SkeletonPageHeader titleWidth="w-40" />
        <Skeleton className="h-3 w-80 max-w-full mt-3" />
      </div>
      <div className="space-y-4 sm:space-y-5">
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden grid lg:grid-cols-[260px_1fr]">
          <Skeleton className="h-[150px] rounded-none" />
          <div className="p-2 sm:p-4 grid grid-cols-5 gap-1.5 sm:gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] sm:h-[96px] rounded-[var(--radius-md)]" />
            ))}
          </div>
        </div>
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-4 sm:p-5 space-y-3">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="h-3.5 flex-1 max-w-[360px]" />
              <Skeleton className="h-8 w-24 ml-auto rounded-[var(--radius-sm)]" />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-56 rounded-full" />
          <Skeleton className="h-10 w-64 ml-auto rounded-[var(--radius-md)] max-sm:hidden" />
          <Skeleton className="h-10 w-32 rounded-[var(--radius-md)]" />
        </div>
        {Array.from({ length: 2 }).map((_, g) => (
          <div key={g} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-4 sm:p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-full" />
              <Skeleton className="h-4 w-52" />
            </div>
            <Skeleton className="h-6 w-full rounded-full" />
            {Array.from({ length: 2 }).map((_, r) => (
              <div key={r} className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-24 max-sm:hidden" />
                <Skeleton className="h-4 w-24 max-sm:hidden" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
