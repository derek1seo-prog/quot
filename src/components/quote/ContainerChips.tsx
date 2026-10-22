import containerTypes from "@/data/container-types.json";
import { formatCurrency } from "@/lib/format";
import type { Quote } from "@/lib/types";

// Rate-sheet codes ("20GP", "40HQ") - what the trade writes, rather than
// the app's display labels ("20FT").
const CODE_BY_ID: Record<string, string> = Object.fromEntries(containerTypes.map((c) => [c.id, c.excelCode]));

/** 견적 목록: the containers a quote was made for, one chip each -
 * "40HQ ×2", or "20GP ×1" "40HQ ×1" for a 20FT+40HQ quote. The total(s)
 * show on hover. */
export function ContainerChips({ quote }: { quote: Pick<Quote, "input" | "result" | "pairedResult"> }) {
  const sheets = [
    { result: quote.result, selection: quote.input.container },
    ...(quote.pairedResult && quote.input.pairedContainer
      ? [{ result: quote.pairedResult, selection: quote.input.pairedContainer }]
      : []),
  ];
  const title = sheets
    .map((s) => `${s.result.column.containerLabel} ${formatCurrency(s.result.column.grandTotalKrw, "KRW")}`)
    .join(" / ");
  return (
    <span className="inline-flex items-center gap-1.5" title={title}>
      {sheets.map(({ result, selection }) => (
        <span
          key={selection.containerTypeId}
          className="inline-flex items-center gap-1 h-6 px-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--sidebar-bg)] text-[12px] leading-none whitespace-nowrap"
        >
          <span className="font-semibold tracking-wide text-[var(--foreground)]">
            {CODE_BY_ID[selection.containerTypeId] ?? result.column.containerLabel}
          </span>
          <span className="tabular-nums text-[var(--muted)]">×{result.column.quantity}</span>
        </span>
      ))}
    </span>
  );
}
