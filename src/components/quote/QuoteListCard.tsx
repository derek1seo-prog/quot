"use client";

import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { countryFlag, formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";

/** Mobile (< sm) equivalent of QuoteListRow's <tr> - same fields and the
 * same delete action, laid out as a card instead of a table row. The
 * delete button is always visible here since there's no hover state on
 * touch (QuoteListRow reveals it on group-hover instead). */
export function QuoteListCard({
  quote,
  portNameById,
  regionCountryById,
}: {
  quote: Quote;
  portNameById: Record<string, string>;
  regionCountryById: Record<string, string>;
}) {
  const { deleting, confirmOpen, quoteNumber, requestDelete, cancelDelete, confirmDelete } =
    useDeleteQuote(quote.id, quote.quoteNumber);

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-[13.5px] font-medium text-[var(--accent)] hover:underline"
        >
          {quote.quoteNumber}
        </Link>
        <button
          onClick={requestDelete}
          disabled={deleting}
          className="w-8 h-8 -mr-2 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] active:bg-red-50 active:text-[var(--danger)]"
          aria-label="삭제"
        >
          <Trash2 size={15} />
        </button>
        <ConfirmDialog
          open={confirmOpen}
          title="견적을 삭제할까요?"
          description={`${quoteNumber} 견적서가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      </div>
      <div className="flex items-center gap-2 mt-1">
        <p className="text-[13.5px] text-[var(--foreground)]">{quote.input.customerName}</p>
        <Badge tone="neutral">{quote.input.incoterms}</Badge>
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-[16px]" role="img" title={quote.result.regionNameKo}>
          {countryFlag(regionCountryById[quote.result.regionId] ?? "")}
        </span>
        <span className="text-[12px] text-[var(--muted)]">
          {portNameById[quote.input.originPortId] ?? quote.input.originPortId} →{" "}
          {portNameById[quote.input.destinationPortId] ?? quote.input.destinationPortId}
        </span>
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[12px] text-[var(--muted)]">{formatDate(quote.input.quoteDate)}</span>
        <span className="text-[13.5px] font-semibold text-[var(--foreground)]">
          {formatCurrency(quote.result.column.grandTotalKrw, "KRW")}
        </span>
      </div>
    </div>
  );
}
