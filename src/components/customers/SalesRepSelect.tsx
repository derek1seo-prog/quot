"use client";

import { Select } from "@/components/ui/Field";
import { cn } from "@/lib/cn";
import type { SalesRep } from "@/lib/types";
import { ChevronDown } from "lucide-react";

/** Plain select for a 화주's assigned 견적 담당자 - "" means none assigned. */
export function SalesRepSelect({
  value,
  onChange,
  salesReps,
  disabled,
  className,
  compact = false,
}: {
  value: string;
  onChange: (id: string) => void;
  salesReps: SalesRep[];
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-label="견적 담당자"
        className={cn(compact && "h-8 px-2 pr-7 text-[13px]", disabled && "opacity-60")}
      >
        <option value="">-</option>
        {salesReps.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </Select>
      <ChevronDown
        size={compact ? 13 : 15}
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--muted)]",
          compact ? "right-2" : "right-3",
        )}
      />
    </div>
  );
}
