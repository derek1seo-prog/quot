import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared base styling for this app's small hover/focus speech-bubble
 * tooltips (BrandMark, RoleSwitchButton's AdminLoginButton, QuoteActions'
 * PDF hint, QuoteTrendSparkline) - previously the same literal string
 * copy-pasted at each call site. Each site composes it with its own
 * positioning classes (anchor side, translate, opacity transition) via
 * `cn(TOOLTIP_BUBBLE_CLASS, "...")`. */
export const TOOLTIP_BUBBLE_CLASS =
  "whitespace-nowrap rounded-full bg-[var(--foreground)] px-2.5 py-1 text-[11px] font-medium text-white shadow-lg";
