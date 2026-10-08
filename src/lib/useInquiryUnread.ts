"use client";

import { useEffect, useState } from "react";

const POLL_MS = 20000;

/** Admin-only: total unread 문의 messages, polled for the nav badge. The
 * 문의함 page dispatches "inquiries:changed" after reading/replying so the
 * badge updates right away instead of on the next poll. */
export function useInquiryUnread(enabled: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/inquiries", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { totalUnread: number };
        if (!cancelled) setCount(json.totalUnread);
      } catch {
        // ignore - next poll
      }
    }
    const first = setTimeout(load, 0);
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    window.addEventListener("inquiries:changed", load);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(timer);
      window.removeEventListener("inquiries:changed", load);
    };
  }, [enabled]);
  return count;
}
