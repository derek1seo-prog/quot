"use client";

import { useState } from "react";

const VIEW_W = 300;
const VIEW_H = 100;
const PAD_Y = 12;

export interface TrendPoint {
  /** ISO date, e.g. "2026-09-28" */
  date: string;
  count: number;
}

function formatShortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

/** Recent-activity sparkline for the dashboard (see QuoteTrendSparkline's
 * caller in page.tsx). Follows the dataviz skill's stat-tile "trend"
 * contract: the line itself reads as de-emphasis (var(--muted)), only
 * today's point is picked out in the accent color - the shape of the
 * trend is the point, not "look how blue this is". Single series, so no
 * legend; hover/focus on any day's slot shows that day's exact count,
 * since a plotted line ships hover feedback by default. */
export function QuoteTrendSparkline({ data }: { data: TrendPoint[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const counts = data.map((d) => d.count);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const flat = max === min;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? (i / (data.length - 1)) * VIEW_W : VIEW_W / 2;
    const y = flat
      ? VIEW_H - PAD_Y * 1.5
      : VIEW_H - PAD_Y - ((d.count - min) / (max - min)) * (VIEW_H - PAD_Y * 2);
    return { ...d, x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L ${points[points.length - 1].x},${VIEW_H} L ${points[0].x},${VIEW_H} Z`;

  const slotWidth = VIEW_W / data.length;
  const last = points[points.length - 1];
  const active = activeIndex !== null ? points[activeIndex] : null;

  return (
    <div className="relative h-16 w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        aria-hidden
      >
        <path d={areaPath} fill="var(--accent)" fillOpacity={0.1} stroke="none" />
        <path
          d={linePath}
          fill="none"
          stroke="var(--muted)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {active && (
          <line
            x1={active.x}
            x2={active.x}
            y1={0}
            y2={VIEW_H}
            stroke="var(--border)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={i * slotWidth}
            y={0}
            width={slotWidth}
            height={VIEW_H}
            fill="transparent"
            tabIndex={0}
            role="img"
            aria-label={`${formatShortDate(p.date)}, ${p.count}건`}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseLeave={() => setActiveIndex(null)}
            onFocus={() => setActiveIndex(i)}
            onBlur={() => setActiveIndex(null)}
            className="outline-none"
          />
        ))}
      </svg>

      {/* Dots are plain HTML circles, not SVG <circle> elements - the SVG
          above uses preserveAspectRatio="none" to fill the card's actual
          (non-square) box, which non-uniformly stretches SVG shape
          geometry; vector-effect="non-scaling-stroke" only protects
          stroke width, not a circle's own cx/cy/r, so an SVG dot here
          would render as a squashed ellipse. An HTML span has no such
          issue. */}
      {points.map(
        (p, i) =>
          (i === points.length - 1 || i === activeIndex) && (
            <span
              key={p.date}
              className="pointer-events-none absolute h-[9px] w-[9px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[var(--surface)] bg-[var(--accent)]"
              style={{ left: `${(p.x / VIEW_W) * 100}%`, top: `${(p.y / VIEW_H) * 100}%` }}
            />
          ),
      )}

      {/* Today's count, direct-labeled at the line's end - no axis or
          gridlines otherwise, true sparkline minimalism. */}
      <span
        className="pointer-events-none absolute whitespace-nowrap text-[11px] font-medium text-[var(--accent)]"
        style={{
          left: `${(last.x / VIEW_W) * 100}%`,
          top: `${(last.y / VIEW_H) * 100}%`,
          transform: "translate(calc(-100% - 8px), -50%)",
        }}
      >
        {last.count}건
      </span>

      {active && (
        <span
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-[var(--foreground)] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg"
          style={{
            left: `${(active.x / VIEW_W) * 100}%`,
            top: `${Math.max((active.y / VIEW_H) * 100, 12)}%`,
            marginTop: "-8px",
          }}
        >
          {formatShortDate(active.date)} · {active.count}건
        </span>
      )}
    </div>
  );
}
