"use client";

import { cn } from "@/lib/cn";
import { useDismissable } from "@/lib/hooks";
import { matchesSearch, startsWithSearch } from "@/lib/hangul";
import { Check, X } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

/** Type-to-search filter picker (like the 항구 picker): typing narrows the
 * options, Enter / click picks one, ✕ clears back to "all". `value` is ""
 * when nothing is selected. */
export function FilterCombobox({
  value,
  onChange,
  options,
  placeholder,
  icon,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  icon?: ReactNode;
  className?: string;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useDismissable(wrapperRef, open, () => setOpen(false));

  const q = query.trim().toLowerCase();
  const filtered = (q ? options.filter((o) => matchesSearch(o, q)) : options)
    .slice()
    .sort((a, b) => (q ? Number(!startsWithSearch(a, q)) - Number(!startsWithSearch(b, q)) : 0));
  const hi = Math.min(highlighted, Math.max(filtered.length - 1, 0));

  function pick(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted(Math.min(hi + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted(Math.max(hi - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[hi]) pick(filtered[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className={cn("relative", className)} ref={wrapperRef}>
      {icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">{icon}</span>
      )}
      <input
        ref={inputRef}
        type="text"
        value={open ? query : value}
        placeholder={open && value ? value : placeholder}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlighted(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        autoComplete="off"
        className={cn(
          "w-full h-10 pr-9 rounded-[var(--radius-sm)] border bg-white text-[14px] outline-none transition-shadow placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]",
          icon ? "pl-9" : "pl-3",
          value && !open ? "font-medium text-[var(--foreground)] border-[var(--border)]" : "border-[var(--border)]",
        )}
      />
      {value && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`${ariaLabel} 선택 해제`}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
        >
          <X size={14} />
        </button>
      )}
      {open && (
        <div
          id={listId}
          role="listbox"
          className="absolute z-20 top-full mt-1 w-full max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg py-1 animate-dropdown-panel"
          style={{ transformOrigin: "top" }}
        >
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-[var(--muted)]">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((o, i) => (
              <button
                key={o}
                type="button"
                role="option"
                aria-selected={o === value}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => pick(o)}
                className={cn(
                  "w-full flex items-center gap-2 text-left px-3 py-2 text-[13.5px]",
                  o === value ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium" : "text-[var(--foreground)]",
                  o !== value && i === hi && "bg-[var(--sidebar-bg)]",
                )}
              >
                <span className="flex-1 min-w-0 truncate">{highlight(o, q)}</span>
                {o === value && <Check size={14} className="shrink-0" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Bolds the matched part of an option while typing. */
function highlight(text: string, q: string) {
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="font-semibold text-[var(--accent)]">{text.slice(i, i + q.length)}</span>
      {text.slice(i + q.length)}
    </>
  );
}
