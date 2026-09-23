import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";

export default function QuoteDetailLoading() {
  return (
    <div className="max-w-[1000px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex items-center justify-between gap-3 mb-6">
        <Skeleton className="h-8 w-28 rounded-[var(--radius-sm)]" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-20 rounded-[var(--radius-sm)]" />
          <Skeleton className="h-8 w-28 rounded-[var(--radius-sm)]" />
        </div>
      </div>

      <Card className="p-8 lg:p-10">
        <div className="flex items-start justify-between mb-8">
          <Skeleton className="w-14 h-14 rounded-full" />
          <Skeleton className="h-4 w-28" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-14 mb-2" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>

        <div className="divide-y divide-[var(--border-subtle)] border-t border-[var(--border-subtle)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-6 py-4">
              <Skeleton className="h-3.5 flex-1 max-w-[140px]" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-20 ml-auto" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
