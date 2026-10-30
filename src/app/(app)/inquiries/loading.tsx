import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function InquiriesLoading() {
  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 py-5 sm:py-10 lg:py-14">
      <div className="mb-4 sm:mb-6">
        <SkeletonPageHeader titleWidth="w-24" />
        <Skeleton className="h-3 w-96 max-w-full mt-3" />
      </div>
      <div className="grid md:grid-cols-[320px_1fr] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden min-h-[480px]">
        <div className="border-r border-[var(--border-subtle)] p-3 space-y-3">
          <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-3 items-center">
              <Skeleton className="w-9 h-9 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
        <div className="hidden md:block p-6 space-y-4">
          <Skeleton className="h-10 w-2/3 rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-1/2 ml-auto rounded-[var(--radius-md)]" />
          <Skeleton className="h-10 w-3/5 rounded-[var(--radius-md)]" />
        </div>
      </div>
    </div>
  );
}
