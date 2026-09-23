import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonPageHeader, SkeletonTable } from "@/components/ui/Skeleton";

/** Shared by both /rates/north-china and /rates/south-china loading.tsx -
 * both pages render the identical shape: header, 기본 운임 table card,
 * 부대비용 table card. */
export function RatesPageSkeleton() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16">
      <SkeletonPageHeader titleWidth="w-24" />
      <Skeleton className="h-3 w-56 mt-3 mb-8" />

      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent className="!p-0">
          <SkeletonTable rows={4} columns={7} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-56" />
        </CardHeader>
        <CardContent className="!p-0">
          <SkeletonTable rows={3} columns={5} />
        </CardContent>
      </Card>
    </div>
  );
}
