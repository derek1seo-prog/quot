import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

type Tone = "neutral" | "success" | "warning" | "danger" | "accent";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-[var(--sidebar-bg)] text-[var(--muted)]",
  success: "bg-green-50 text-[var(--success)]",
  warning: "bg-amber-50 text-[var(--warning)]",
  danger: "bg-red-50 text-[var(--danger)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
};

export function Badge({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
