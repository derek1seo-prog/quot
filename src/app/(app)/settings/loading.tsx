import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { Skeleton, SkeletonPageHeader } from "@/components/ui/Skeleton";

function SkeletonSettingsCard({ fields }: { fields: number }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-20 mb-2" />
        <Skeleton className="h-3 w-3/4" />
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 gap-4">
          {Array.from({ length: fields }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-16 mb-2" />
              <Skeleton className="h-3.5 w-24" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function SettingsLoading() {
  return (
    <div className="max-w-[900px] mx-auto px-6 lg:px-12 xl:px-20 py-10 lg:py-16 space-y-8">
      <SkeletonPageHeader titleWidth="w-20" />
      <SkeletonSettingsCard fields={2} />
      <SkeletonSettingsCard fields={5} />
    </div>
  );
}
