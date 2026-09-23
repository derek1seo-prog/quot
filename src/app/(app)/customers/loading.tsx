import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

export default function CustomersLoading() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <div className="mb-6">
        <SkeletonPageHeader titleWidth="w-32" />
      </div>
      <div className="mb-8">
        <Skeleton className="h-10 w-28 rounded-[var(--radius-md)]" />
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border-subtle)] rounded-[var(--radius-lg)] overflow-hidden">
        <SkeletonTable rows={6} columns={6} />
      </div>
    </div>
  );
}
