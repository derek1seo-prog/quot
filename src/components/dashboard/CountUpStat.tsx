"use client";

import { useEffect, useState } from "react";

/** Counts up from 0 to `value` on mount - a small, well-established touch
 * (Stripe/Linear-style dashboards do this) that makes a stat feel like
 * live data landing rather than static text. Skips straight to the final
 * value under prefers-reduced-motion, and the very first paint (server
 * render + pre-hydration) already shows 0 heading toward it, so there's
 * no layout shift once the animation starts.
 *
 * No "already started" guard here on purpose: React Strict Mode's dev-only
 * mount -> cleanup -> mount double-invoke would cancel the first effect's
 * rAF loop and then skip restarting it, leaving the value stuck at 0
 * forever. Letting the effect run again on every (re-)mount is harmless -
 * the cleanup always cancels any in-flight frame first. */
export function CountUpStat({
  value,
  prefix = "",
  suffix = "",
  durationMs = 700,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf: number;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      raf = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(raf);
    }

    const start = performance.now();
    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);

  return (
    <>
      {prefix}
      {display.toLocaleString()}
      {suffix}
    </>
  );
}
