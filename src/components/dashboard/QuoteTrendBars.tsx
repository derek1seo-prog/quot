"use client";

import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import { useState } from "react";
import type { TrendPoint } from "./QuoteTrendSparkline";

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** Daily quote counts as a bar chart (dashboard, 최근 14일). One series, so
 * no legend - the card title names it. Only today's bar is full accent;
 * the rest are a lighter step of the same hue so the shape reads first.
 * Values aren't printed on every bar: the total sits in the header and
 * hover/focus on a day's full-height slot shows that day's exact count. */
export function QuoteTrendBars({
  data,
  previousTotal,
}: {
  data: TrendPoint[];
  /** Total for the equally long period right before `data`, for the chip. */
  previousTotal: number;
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const total = data.reduce((sum, d) => sum + d.count, 0);
  const delta = total - previousTotal;
  const max = Math.max(...data.map((d) => d.count), 0);
  const lastIndex = data.length - 1;
  const midIndex = Math.floor(lastIndex / 2);

  // Fills its card's height (beside the taller 구간 card), 96px minimum.
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-end justify-between gap-3 mb-5">
        <p className="text-[26px] font-semibold tracking-tight text-[var(--foreground)] leading-none">
          {total}
          <span className="text-[15px] font-medium text-[var(--muted)] ml-0.5">건</span>
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11.5px] font-medium whitespace-nowrap",
            delta > 0 ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--sidebar-bg)] text-[var(--muted)]",
          )}
          title={`이전 14일 ${previousTotal}건 → 최근 14일 ${total}건`}
        >
          {delta === 0
            ? "이전 14일과 동일"
            : `이전 14일 대비 ${delta > 0 ? "▲" : "▼"}${Math.abs(delta)}건`}
        </span>
      </div>

      <div className="relative flex-1 min-h-24 flex items-stretch gap-[2px] border-b border-[var(--border-subtle)]">
        {data.map((d, i) => {
          const isLast = i === lastIndex;
          const active = i === activeIndex;
          const pct = max > 0 ? (d.count / max) * 100 : 0;
          return (
            <div
              key={d.date}
              tabIndex={0}
              role="img"
              aria-label={`${formatShortDate(d.date)}, ${d.count}건`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
              onFocus={() => setActiveIndex(i)}
              onBlur={() => setActiveIndex(null)}
              className="relative flex-1 flex items-end justify-center outline-none cursor-default"
            >
              {active && <span className="absolute inset-0 rounded-[4px] bg-[var(--sidebar-bg)]" />}
              <span
                className={cn(
                  "relative w-full max-w-[18px] rounded-t-[4px] transition-colors animate-bar-grow-y",
                  isLast || active ? "bg-[var(--accent)]" : "bg-[var(--accent)]/35",
                )}
                style={{
                  height: d.count > 0 ? `${pct}%` : "2px",
                  animationDelay: `${360 + i * 25}ms`,
                }}
              />
              {active && (
                <span
                  className={cn(TOOLTIP_BUBBLE_CLASS, "pointer-events-none absolute z-10 left-1/2 -translate-x-1/2")}
                  style={{ bottom: `calc(${d.count > 0 ? pct : 0}% + 8px)` }}
                >
                  {formatShortDate(d.date)} · {d.count}건
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-[2px] mt-1.5 text-[11px] text-[var(--muted)]">
        {data.map((d, i) => (
          <span key={d.date} className="flex-1 min-w-0 text-center whitespace-nowrap">
            {i === lastIndex ? "오늘" : i === 0 || i === midIndex ? formatShortDate(d.date) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
