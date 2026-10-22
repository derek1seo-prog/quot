"use client";

import { Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { ContainerChips } from "./ContainerChips";

/** Mobile (< sm) equivalent of QuoteListRow's <tr> - same fields and the
 * same delete action, laid out as a card instead of a table row. The
 * delete button is always visible here since there's no hover state on
 * touch (QuoteListRow reveals it on group-hover instead). */
export function QuoteListCard({
  quote,
  portNameById,
  animationDelayMs,
}: {
  quote: Quote;
  portNameById: Record<string, string>;
  animationDelayMs?: number;
}) {
  const { deleting, confirmOpen, quoteNumber, requestDelete, cancelDelete, confirmDelete } =
    useDeleteQuote(quote.id, quote.quoteNumber);

  const route = `${portNameById[quote.input.originPortId] ?? quote.input.originPortId} → ${
    portNameById[quote.input.destinationPortId] ?? quote.input.destinationPortId
  }`;
  const rep = quote.input.preparedBy?.trim();

  // The whole card opens the quote (a stretched link); delete sits above it.
  return (
    <div
      className={`relative px-4 py-3 active:bg-[var(--sidebar-bg)]/60 transition-colors${animationDelayMs != null ? " animate-dashboard-fade-up" : ""}`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-[13.5px] font-semibold text-[var(--accent)] after:absolute after:inset-0"
        >
          {quote.quoteNumber}
        </Link>
        <ContainerChips quote={quote} />
      </div>
      <div className="flex items-center gap-1.5 mt-1 min-w-0">
        <p className="text-[14px] font-medium text-[var(--foreground)] truncate">{quote.input.customerName || "-"}</p>
        <Badge tone="neutral" className="shrink-0">
          {quote.input.incoterms}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 mt-0.5">
        <p className="min-w-0 truncate text-[12px] text-[var(--muted)]">
          {route} · {formatDate(quote.input.quoteDate)}
          {rep ? ` · ${rep}` : ""}
        </p>
        <button
          onClick={requestDelete}
          disabled={deleting}
          className="relative z-10 w-8 h-8 -mr-1.5 -my-1.5 shrink-0 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] active:bg-red-50 active:text-[var(--danger)]"
          aria-label="삭제"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        title="견적을 삭제할까요?"
        description={`${quoteNumber} 견적서가 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}
