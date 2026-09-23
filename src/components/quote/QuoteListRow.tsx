"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { countryFlag, formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";

export function QuoteListRow({
  quote,
  portNameById,
  regionCountryById,
  animationDelayMs,
}: {
  quote: Quote;
  portNameById: Record<string, string>;
  regionCountryById: Record<string, string>;
  animationDelayMs?: number;
}) {
  const { deleting, confirmOpen, quoteNumber, requestDelete, cancelDelete, confirmDelete } =
    useDeleteQuote(quote.id, quote.quoteNumber);

  return (
    <tr
      className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors group animate-dashboard-fade-up"
      style={animationDelayMs != null ? { animationDelay: `${animationDelayMs}ms` } : undefined}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-[13.5px] font-medium text-[var(--accent)] hover:underline"
        >
          {quote.quoteNumber}
        </Link>
      </td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--foreground)] whitespace-nowrap">{quote.input.customerName}</td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">
        {portNameById[quote.input.originPortId] ?? quote.input.originPortId} →{" "}
        {portNameById[quote.input.destinationPortId] ?? quote.input.destinationPortId}
      </td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">{quote.input.incoterms}</td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-[20px]" role="img" title={quote.result.regionNameKo}>
          {countryFlag(regionCountryById[quote.result.regionId] ?? "")}
        </span>
      </td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--muted)] whitespace-nowrap">{formatDate(quote.input.quoteDate)}</td>
      <td className="px-6 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)] whitespace-nowrap">
        {formatCurrency(quote.result.column.grandTotalKrw, "KRW")}
      </td>
      <td className="px-4 py-4 text-right">
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
