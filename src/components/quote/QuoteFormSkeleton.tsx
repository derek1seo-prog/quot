import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

/** Loading shell for the quote-form pages (빠른 견적, 견적 조회, 새 견적):
 * header, the conditions card and the start of the quote document. */
export function QuoteFormSkeleton() {
  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-20 py-5 sm:py-10 lg:py-16">
      <div className="mb-5 sm:mb-8">
        <SkeletonPageHeader titleWidth="w-36" />
        <Skeleton className="h-3 w-80 max-w-full mt-3" />
      </div>
      <Card className="p-4 sm:p-8 mb-6">
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-10 w-full rounded-[var(--radius-md)]" />
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-6 sm:p-8 space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-3 w-72 max-w-full" />
        <Skeleton className="h-32 w-full rounded-[var(--radius-md)]" />
        <Skeleton className="h-48 w-full rounded-[var(--radius-md)]" />
      </Card>
    </div>
  );
}
