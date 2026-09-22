"use client";

import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type SaveState = "idle" | "saving" | "saved" | "error";

export function RateCell({
  value,
  onSave,
  placeholder = "미등록",
  debounceMs,
}: {
  value: number | null;
  onSave: (value: number) => Promise<void>;
  placeholder?: string;
  /** When set, also commits `debounceMs` after the last keystroke - not
   * just on blur/Enter - so a value can settle without clicking away.
   * Omitted (the admin rates table's default) keeps the original
   * blur-only commit. */
  debounceMs?: number;
}) {
  const [draft, setDraft] = useState<string>(value != null ? String(value) : "");
  const [focused, setFocused] = useState(false);
  const [state, setState] = useState<SaveState>("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  async function commitValue(num: number) {
    if (Number.isNaN(num) || value === num) return;
    setState("saving");
    try {
      await onSave(num);
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("error");
    }
  }

  function commit() {
    if (draft === "") return;
    commitValue(Number(draft));
  }

  function clearDebounce() {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
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
        onChange={(e) => {
          const next = e.target.value.replace(/[^0-9]/g, "");
          setDraft(next);
          if (debounceMs != null) {
            clearDebounce();
            if (next !== "") {
              debounceTimer.current = setTimeout(() => commitValue(Number(next)), debounceMs);
            }
          }
        }}
        onBlur={() => {
          setFocused(false);
          clearDebounce();
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cn(
          "w-full h-9 px-2.5 rounded-[var(--radius-sm)] border text-[16px] sm:text-[13px] text-right bg-white outline-none transition-colors",
          // Extra right padding only while the save-state icon is actually
          // showing - reserving it at rest ate into the already-narrow
          // rate columns, clipping longer KRW amounts (e.g. "1,175,000").
          state !== "idle" && "pr-7",
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
