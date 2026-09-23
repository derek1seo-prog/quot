import { cn } from "@/lib/cn";

/** Loading-state placeholder bar/block. Used by each route's loading.tsx
 * (see src/app/(app)/*\/loading.tsx) to give instant visual feedback the
 * moment a nav link is clicked, instead of a frozen page until the server
 * response for that (dynamic, uncached) route arrives. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[var(--radius-sm)] bg-[var(--border-subtle)] motion-reduce:animate-none", className)}
    />
  );
}

/** Header skeleton matching every list/detail page's
 * "라벨 → 제목" pattern (Dashboard, 견적 목록, 화주 관리, 요율 관리, 설정). */
export function SkeletonPageHeader({ titleWidth = "w-48" }: { titleWidth?: string }) {
  return (
    <div>
      <Skeleton className="h-3 w-16 mb-3" />
      <Skeleton className={cn("h-8", titleWidth)} />
    </div>
  );
}

/** Table-card skeleton matching the header-row + N data-row shape shared by
 * the dashboard's 최근 견적, 견적 목록, and 화주 관리 tables. */
export function SkeletonTable({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-[var(--border-subtle)]">
      <div className="flex gap-6 px-6 py-3.5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-12" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-6 px-6 py-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className="h-3.5 flex-1 max-w-[110px]" />
          ))}
        </div>
      ))}
    </div>
  );
}
