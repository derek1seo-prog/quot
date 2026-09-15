"use client";

import { Badge } from "@/components/ui/Badge";
import { useDeleteQuote } from "@/lib/useDeleteQuote";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { Trash2 } from "lucide-react";
import Link from "next/link";

export function QuoteListRow({ quote }: { quote: Quote }) {
  const { deleting, handleDelete } = useDeleteQuote(quote.id, quote.quoteNumber);

  return (
    <tr className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors group">
      <td className="px-6 py-4">
        <Link
          href={`/quotes/${quote.id}`}
          className="text-[13.5px] font-medium text-[var(--accent)] hover:underline"
        >
          {quote.quoteNumber}
        </Link>
      </td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--foreground)]">{quote.input.customerName}</td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--muted)]">
        {quote.input.originPortId} → {quote.input.destinationPortId}
      </td>
      <td className="px-6 py-4">
        <Badge tone="accent">{quote.result.regionNameKo}</Badge>
      </td>
      <td className="px-6 py-4 text-[13.5px] text-[var(--muted)]">{formatDate(quote.input.quoteDate)}</td>
      <td className="px-6 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)]">
        {formatCurrency(quote.result.combinedGrandTotalKrw, "KRW")}
      </td>
      <td className="px-4 py-4 text-right">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="opacity-0 group-hover:opacity-100 transition-opacity w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
          aria-label="삭제"
        >
          <Trash2 size={15} />
        </button>
      </td>
    </tr>
  );
}
