"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { ContainerChips } from "./ContainerChips";

// Density follows the table's own width (its wrapper is an @container), so
// the one-line table fits next to the sidebar or on a tablet without
// sideways scroll; at full desktop width it's the original px-6 / 13.5px.
export const QUOTE_CELL_X = "px-2.5 @min-[880px]:px-4 @min-[1000px]:px-6";
const TEXT = "text-[12.5px] @min-[880px]:text-[13.5px]";

export function QuoteListRow({
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

  return (
    <tr
      className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors group${animationDelayMs != null ? " animate-dashboard-fade-up" : ""}`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <td className={`${QUOTE_CELL_X} py-4 whitespace-nowrap`}>
        <Link
          href={`/quotes/${quote.id}`}
          className={`${TEXT} font-medium text-[var(--accent)] hover:underline`}
        >
          {quote.quoteNumber}
        </Link>
      </td>
      {/* Below full desktop width, 고객명 / 구간 take a fixed share (set on their
          <th>) and end in "…" if longer - full text on hover. Wider, they're
          plain one-line cells as before. */}
      <td className={`${QUOTE_CELL_X} py-4 ${TEXT} text-[var(--foreground)] max-w-0 @min-[1000px]:max-w-none`}>
        <span className="block truncate" title={quote.input.customerName}>
          {quote.input.customerName}
        </span>
      </td>
      <td className={`${QUOTE_CELL_X} py-4 ${TEXT} text-[var(--muted)] max-w-0 @min-[1000px]:max-w-none`}>
        <span className="block truncate" title={route}>
          {route}
        </span>
      </td>
      <td className={`${QUOTE_CELL_X} py-4 ${TEXT} text-[var(--muted)] whitespace-nowrap`}>{quote.input.incoterms}</td>
      <td className={`${QUOTE_CELL_X} py-4 ${TEXT} text-[var(--muted)] whitespace-nowrap`}>
        {quote.input.preparedBy?.trim() || "-"}
      </td>
      <td className={`${QUOTE_CELL_X} py-4 ${TEXT} text-[var(--muted)] whitespace-nowrap`}>{formatDate(quote.input.quoteDate)}</td>
      <td className={`${QUOTE_CELL_X} py-3.5 whitespace-nowrap`}>
        <ContainerChips quote={quote} />
      </td>
      <td className="px-1.5 @min-[880px]:px-3 @min-[1000px]:px-4 py-4 text-right">
        <button
          onClick={requestDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
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
      </td>
    </tr>
  );
}
