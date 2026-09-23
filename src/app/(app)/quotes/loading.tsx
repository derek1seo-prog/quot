import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function QuotesListLoading() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <SkeletonPageHeader titleWidth="w-40" />
        <Skeleton className="h-10 w-36 rounded-[var(--radius-md)]" />
      </div>

      <Card className="overflow-hidden">
        <SkeletonTable rows={8} columns={7} />
      </Card>
    </div>
  );
}
