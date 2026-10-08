"use client";

import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import type { ReactNode } from "react";

/** Quiet icon-only row action with a hover bubble. `reveal` hides it until
 * the enclosing `group` row is hovered on desktop (always shown on touch).
 * The bubble shows `tooltip` if given, else `label`. */
export function IconAction({
  label,
  tooltip,
  onClick,
  disabled,
  hoverClass = "hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]",
  reveal,
  side = "top",
  className,
  children,
}: {
  label: string;
  tooltip?: string;
  onClick: () => void;
  disabled?: boolean;
  hoverClass?: string;
  reveal?: boolean;
  /** Where the bubble opens - "bottom" for buttons near the top edge of an
   * overflow-hidden container, which would otherwise clip it. */
  side?: "top" | "bottom";
  className?: string;
  children: ReactNode;
}) {
  return (
    <span className="relative inline-flex group/act">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={cn(
          "w-8 h-8 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[#94a3b8] transition-all disabled:opacity-40",
          hoverClass,
          reveal && "sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100",
          className,
        )}
      >
        {children}
      </button>
      <span
        className={cn(
          TOOLTIP_BUBBLE_CLASS,
          "pointer-events-none absolute left-1/2 -translate-x-1/2 z-30 opacity-0 transition-all duration-150 group-hover/act:opacity-100 group-hover/act:translate-y-0",
          side === "top" ? "bottom-full mb-1.5 translate-y-1" : "top-full mt-1.5 -translate-y-1",
        )}
      >
        {tooltip ?? label}
      </span>
    </span>
  );
}
