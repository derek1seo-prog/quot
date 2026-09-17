import { Badge } from "@/components/ui/Badge";
import { formatDate } from "@/lib/format";
import type { Quote } from "@/lib/types";

function krw(n: number) {
  return `₩${Math.round(n).toLocaleString("en-US")}`;
}

export function QuoteCompareTable({ quotes }: { quotes: Quote[] }) {
  // Union of every selected quote's chargeCatalog, in first-seen order, so
  // a charge present in only some quotes still gets a row (with "-" for
  // the quotes that lack it), matching QuoteDocument's "미등록" convention.
  const chargeRows = quotes.reduce<{ chargeTypeId: string; nameKo: string; name: string }[]>((rows, q) => {
    for (const entry of q.result.chargeCatalog) {
      if (!rows.some((r) => r.chargeTypeId === entry.chargeTypeId)) {
        rows.push({ chargeTypeId: entry.chargeTypeId, nameKo: entry.nameKo, name: entry.name });
      }
    }
    return rows;
  }, []);

  const totals = quotes.map((q) => q.result.column.grandTotalKrw);
  const lowestTotal = Math.min(...totals);

  return (
    <div className="animate-step-in-forward">
      {/* Desktop / tablet: side-by-side table */}
      <div className="hidden sm:block overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white">
        <table className="w-full border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)]">
              <th className="text-left px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-[var(--muted)] w-[180px]">
                항목
              </th>
              {quotes.map((q) => (
                <th key={q.id} className="text-left px-4 py-3 align-top">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">{q.quoteNumber}</p>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">{formatDate(q.input.quoteDate)}</p>
                  <Badge tone="accent" className="mt-1.5">
                    {q.result.column.containerLabel} × {q.result.column.quantity}
                  </Badge>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chargeRows.map((row) => (
              <tr key={row.chargeTypeId} className="border-b border-[var(--border-subtle)] last:border-0">
                <td className="px-4 py-3">
                  <p className="text-[13px] font-medium text-[var(--foreground)]">{row.nameKo}</p>
                  <p className="text-[11px] text-[var(--muted)]">{row.name}</p>
                </td>
                {quotes.map((q) => {
                  const item = q.result.column.lineItems.find((li) => li.chargeTypeId === row.chargeTypeId);
                  return (
                    <td key={q.id} className="px-4 py-3 text-[13px] text-[var(--foreground)]">
                      {item ? krw(item.amountKrw) : <span className="text-[var(--muted)]">미등록</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="bg-[var(--accent)]" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
              <td className="px-4 py-3 text-[13.5px] font-bold text-white">최종가격(VAT 별도)</td>
              {quotes.map((q, i) => (
                <td key={q.id} className="px-4 py-3">
                  <span className="text-[14px] font-bold text-white whitespace-nowrap">{krw(totals[i])}</span>
                  {totals[i] === lowestTotal && quotes.length > 1 && (
                    <Badge tone="success" className="ml-2">
                      최저가
                    </Badge>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Mobile: stacked cards, one per quote */}
      <div className="sm:hidden space-y-4">
        {quotes.map((q, i) => (
          <div key={q.id} className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-4">
            <div className="flex items-center justify-between">
              <p className="text-[13.5px] font-semibold">{q.quoteNumber}</p>
              {totals[i] === lowestTotal && quotes.length > 1 && <Badge tone="success">최저가</Badge>}
            </div>
            <p className="text-[11px] text-[var(--muted)] mt-0.5">{formatDate(q.input.quoteDate)}</p>
            <Badge tone="accent" className="mt-1.5">
              {q.result.column.containerLabel} × {q.result.column.quantity}
            </Badge>
            <div className="mt-3 space-y-1.5">
              {chargeRows.map((row) => {
                const item = q.result.column.lineItems.find((li) => li.chargeTypeId === row.chargeTypeId);
                return (
                  <div key={row.chargeTypeId} className="flex items-center justify-between text-[12.5px]">
                    <span className="text-[var(--muted)]">{row.nameKo}</span>
                    <span className="text-[var(--foreground)]">
                      {item ? krw(item.amountKrw) : <span className="text-[var(--muted)]">미등록</span>}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
              <span className="text-[13px] font-semibold">최종가격(VAT 별도)</span>
              <span className="text-[15px] font-bold text-[var(--accent)]">{krw(totals[i])}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
