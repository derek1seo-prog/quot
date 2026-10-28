"use client";

import { useEffect, useState } from "react";

const POLL_MS = 60000;

/** Admin-only: how many 컨테이너 현황 items need action today, for the nav
 * badge. The page dispatches "containers:changed" after an edit so the
 * badge follows right away instead of on the next poll. */
export function useContainerAttention(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/containers/attention", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { count: number };
        if (!cancelled) setCount(json.count);
      } catch {
        // ignore - next poll
      }
    }
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    window.addEventListener("containers:changed", load);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("containers:changed", load);
    };
  }, [enabled]);
  return count;
}
