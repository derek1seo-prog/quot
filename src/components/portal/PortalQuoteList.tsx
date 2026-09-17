"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatCurrency, formatDate, regionLabel } from "@/lib/format";
import type { Quote } from "@/lib/types";
import { GitCompareArrows } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function PortalQuoteList({
  quotes,
  portNameById,
}: {
  quotes: Quote[];
  portNameById: Record<string, string>;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function handleCompare() {
    router.push(`/portal/compare?ids=${selected.join(",")}`);
  }

  return (
    <div className="space-y-4">
      {selected.length >= 2 && (
        <div className="flex justify-end animate-menu-item">
          <Button onClick={handleCompare} icon={<GitCompareArrows size={16} />}>
            선택한 {selected.length}개 견적 비교하기
          </Button>
        </div>
      )}

      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left min-w-[760px]">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] text-[12px] text-[var(--muted)] uppercase tracking-wide">
              <th className="px-4 py-3" />
              <th className="px-4 py-3 font-medium whitespace-nowrap">견적번호</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">구간</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">권역</th>
              <th className="px-4 py-3 font-medium whitespace-nowrap">견적일</th>
              <th className="px-4 py-3 font-medium text-right whitespace-nowrap">합계</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-[var(--border-subtle)] last:border-0 hover:bg-[var(--sidebar-bg)]/50 transition-colors">
                <td className="px-4 py-4">
                  <input
                    type="checkbox"
                    checked={selected.includes(q.id)}
                    onChange={() => toggle(q.id)}
                    className="w-4 h-4 accent-[var(--accent)]"
                    aria-label="비교에 추가"
                  />
                </td>
                <td className="px-4 py-4">
                  <Link href={`/portal/quotes/${q.id}`} className="text-[13.5px] font-medium text-[var(--accent)] hover:underline">
                    {q.quoteNumber}
                  </Link>
                </td>
                <td className="px-4 py-4 text-[13.5px] text-[var(--muted)]">
                  {portNameById[q.input.originPortId] ?? q.input.originPortId} →{" "}
                  {portNameById[q.input.destinationPortId] ?? q.input.destinationPortId}
                </td>
                <td className="px-4 py-4">
                  <Badge tone="accent">{regionLabel(q.result.regionNameKo)}</Badge>
                </td>
                <td className="px-4 py-4 text-[13.5px] text-[var(--muted)]">{formatDate(q.input.quoteDate)}</td>
                <td className="px-4 py-4 text-[13.5px] font-medium text-right text-[var(--foreground)]">
                  {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden divide-y divide-[var(--border-subtle)]">
        {quotes.map((q) => (
          <div key={q.id} className="px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.includes(q.id)}
                  onChange={() => toggle(q.id)}
                  className="w-4 h-4 accent-[var(--accent)]"
                />
                <Link href={`/portal/quotes/${q.id}`} className="text-[13.5px] font-medium text-[var(--accent)] hover:underline">
                  {q.quoteNumber}
                </Link>
              </label>
            </div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge tone="accent">{regionLabel(q.result.regionNameKo)}</Badge>
              <span className="text-[12px] text-[var(--muted)]">
                {portNameById[q.input.originPortId] ?? q.input.originPortId} →{" "}
                {portNameById[q.input.destinationPortId] ?? q.input.destinationPortId}
              </span>
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[12px] text-[var(--muted)]">{formatDate(q.input.quoteDate)}</span>
              <span className="text-[13.5px] font-semibold text-[var(--foreground)]">
                {formatCurrency(q.result.column.grandTotalKrw, "KRW")}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
