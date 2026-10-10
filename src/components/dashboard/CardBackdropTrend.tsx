"use client";

import { useId } from "react";

const VIEW_W = 300;
const VIEW_H = 100;
const PAD_TOP = 14;

/** Decorative trend line + fading area pinned to the bottom of a stat card,
 * behind its text. Purely visual (the card's own number is the reading), so
 * it's aria-hidden and has no hover layer - the detailed, interactive charts
 * live elsewhere (설정 / 최근 14일 견적 추이). Renders nothing for < 2 points. */
export function CardBackdropTrend({ values }: { values: number[] }) {
  const gradientId = useId();
  const min = Math.min(...values);
  const max = Math.max(...values);
  // All-zero (e.g. no quotes this week) would just draw a stray baseline.
  if (values.length < 2 || max === 0) return null;

  const flat = max === min;
  const points = values.map((v, i) => ({
    x: (i / (values.length - 1)) * VIEW_W,
    y: flat ? VIEW_H * 0.7 : VIEW_H - ((v - min) / (max - min)) * (VIEW_H - PAD_TOP) - 4,
  }));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x},${p.y}`).join(" ");
  const area = `${line} L ${VIEW_W},${VIEW_H} L 0,${VIEW_H} Z`;

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] w-full animate-trend-reveal"
      // Fainter under the card's text (bottom-left), full strength on the right.
      style={{
        maskImage: "linear-gradient(to right, rgba(0,0,0,0.2), #000 60%)",
        WebkitMaskImage: "linear-gradient(to right, rgba(0,0,0,0.2), #000 60%)",
      }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.16} />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path
        d={line}
        fill="none"
        stroke="var(--accent)"
        strokeOpacity={0.45}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
