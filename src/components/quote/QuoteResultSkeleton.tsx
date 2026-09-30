import { Skeleton, SkeletonTable } from "@/components/ui/Skeleton";

/** Placeholder shown in place of the live quote result while a lookup is
 * calculating (PublicQuoteForm.tsx, quotes/new/page.tsx's step-4 preview) -
 * mirrors QuoteDocument's own on-screen shape (letterhead, info grid,
 * charges table, total bar) at the same outer size
 * (max-w-[900px]/rounded-lg/border/shadow, matching QuoteDocument.tsx's
 * non-dense card exactly) so the real result settles into the same box
 * instead of the page jumping when it swaps in. Reuses the same Skeleton/
 * SkeletonTable primitives every route's loading.tsx already uses, rather
 * than a generic spinner. */
export function QuoteResultSkeleton() {
  return (
    <div className="max-w-[900px] mx-auto bg-white rounded-[var(--radius-lg)] border border-[var(--border-subtle)] shadow-[0_1px_3px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="p-8 sm:p-12">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-3">
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div>
              <Skeleton className="h-4 w-32 mb-2" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
          <div className="text-right shrink-0">
            <Skeleton className="h-3 w-20 mb-2 ml-auto" />
            <Skeleton className="h-3 w-28 ml-auto" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-5 pb-8 border-b border-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-14 mb-2" />
              <Skeleton className="h-3.5 w-20" />
            </div>
          ))}
        </div>
      </div>

      <SkeletonTable rows={5} columns={5} />

      <div className="p-6 flex items-center justify-between bg-[var(--sidebar-bg)]">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>
    </div>
  );
}
