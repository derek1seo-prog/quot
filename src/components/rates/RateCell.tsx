"use client";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Check, Loader2 } from "lucide-react";
import { useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

export function RateCell({
  value,
  onSave,
  placeholder = "미등록",
}: {
  value: number | null;
  onSave: (value: number) => Promise<void>;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<SaveState>("idle");

  async function commit() {
    const num = Number(draft);
    if (draft === "" || Number.isNaN(num)) return;
    if (value === num) return;
    setState("saving");
    try {
      await onSave(num);
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("error");
    }
  }

  const displayValue = focused ? draft : draft !== "" ? formatNumber(Number(draft)) : "";

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        value={displayValue}
        placeholder={placeholder}
        onFocus={(e) => {
          const el = e.target;
          setFocused(true);
          // Wait for the re-render that swaps the comma-formatted display
          // value for the raw digits - selecting immediately selects the
          // old formatted text, and the value swap right after collapses
          // that selection instead of keeping it.
          requestAnimationFrame(() => el.select());
        }}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          "w-full h-9 px-2.5 pr-7 rounded-[var(--radius-sm)] border text-[13px] text-right bg-white outline-none transition-colors",
          "border-[var(--border)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]",
          draft === "" && "text-[var(--muted)]",
        )}
      />
      {state === "saving" && (
        <Loader2 size={13} className="animate-spin absolute right-2 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
      )}
      {state === "saved" && (
        <Check size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--success)]" />
      )}
    </div>
  );
}
