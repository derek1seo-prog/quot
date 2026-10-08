"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";

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

  return (
    <tr
      className={`border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors group${animationDelayMs != null ? " animate-dashboard-fade-up" : ""}`}
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      {/* Below ~1340px wide the table drops to 5 columns so it fits a tablet without
          sideways scrolling: 견적일 / 담당자 / 인코텀즈 ride along as a
          second line under 견적번호 / 고객명 / 구간. */}
      <td className="px-4 min-[1340px]:px-5 py-3.5 min-[1340px]:py-4 whitespace-nowrap">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-[13.5px] font-medium text-[var(--accent)] hover:underline"
        >
          {quote.quoteNumber}
        </Link>
        <p className="min-[1340px]:hidden mt-0.5 text-[12px] text-[var(--muted)]">{formatDate(quote.input.quoteDate)}</p>
      </td>
      <td className="px-4 min-[1340px]:px-5 py-3.5 min-[1340px]:py-4 text-[13.5px] text-[var(--foreground)] max-w-[180px] min-[1340px]:max-w-none">
        <p className="truncate min-[1340px]:whitespace-nowrap">{quote.input.customerName}</p>
        <p className="min-[1340px]:hidden mt-0.5 text-[12px] text-[var(--muted)] truncate">{quote.input.preparedBy?.trim() || "-"}</p>
      </td>
      <td className="px-4 min-[1340px]:px-5 py-3.5 min-[1340px]:py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
        {portNameById[quote.input.originPortId] ?? quote.input.originPortId} →{" "}
        {portNameById[quote.input.destinationPortId] ?? quote.input.destinationPortId}
        <p className="min-[1340px]:hidden mt-0.5 text-[12px]">{quote.input.incoterms}</p>
      </td>
      <td className="hidden min-[1340px]:table-cell px-5 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">{quote.input.incoterms}</td>
      <td className="hidden min-[1340px]:table-cell px-5 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
        {quote.input.preparedBy?.trim() || "-"}
      </td>
      <td className="hidden min-[1340px]:table-cell px-5 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">{formatDate(quote.input.quoteDate)}</td>
      <td className="px-4 min-[1340px]:px-5 py-3.5 min-[1340px]:py-4 text-[13.5px] font-medium text-right text-[var(--foreground)] whitespace-nowrap">
        {formatCurrency(quote.result.column.grandTotalKrw, "KRW")}
      </td>
      <td className="pl-1 pr-3 min-[1340px]:px-4 py-3.5 min-[1340px]:py-4 text-right">
        {/* Always visible on touch screens (no hover there); hover-revealed with a mouse. */}
        <button
          onClick={requestDelete}
          disabled={deleting}
          className="[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
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
