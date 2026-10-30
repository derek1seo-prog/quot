"use client";

import { useLinkStatus } from "next/link";

/** A small spinner at the end of a nav link while its route is still
 * loading - always rendered (no layout shift), shown via opacity. Must sit
 * inside the <Link>. */
export function NavPending() {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`ml-auto w-3.5 h-3.5 shrink-0 rounded-full border-2 border-[var(--accent)]/25 border-t-[var(--accent)] animate-spin transition-opacity duration-150 ${
        pending ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
