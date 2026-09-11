"use client";

import { cn } from "@/lib/cn";
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

  return (
    <div className="relative">
      <input
        type="number"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
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
