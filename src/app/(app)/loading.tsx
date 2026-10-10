import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="max-w-[1200px] mx-auto px-6 lg:px-8 xl:px-20 py-10 lg:py-16">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-10 lg:mb-14">
        <SkeletonPageHeader titleWidth="w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-12 w-44 rounded-[var(--radius-md)]" />
          <Skeleton className="h-12 w-40 rounded-[var(--radius-md)]" />
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5 mb-10 lg:mb-14">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="p-5">
            <Skeleton className="w-9 h-9 rounded-full mb-6" />
            <Skeleton className="h-5 w-16 mb-2" />
            <Skeleton className="h-3 w-20" />
          </Card>
        ))}
      </div>

      <Card className="p-5 mb-10 lg:mb-14">
        <Skeleton className="h-3 w-28 mb-4" />
        <Skeleton className="h-16 w-full" />
      </Card>

      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-16" />
      </div>

      <Card className="overflow-hidden">
        <SkeletonTable rows={5} columns={6} />
      </Card>
    </div>
  );
}
