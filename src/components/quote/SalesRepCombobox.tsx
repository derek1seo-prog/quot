"use client";

import { Input } from "@/components/ui/Field";
import type { SalesRep } from "@/lib/types";
import { Contact } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

/** Strict, id-based selection among a small in-memory roster of sales
 * reps - modeled on PortCombobox.tsx (same open/filter/arrow-key/Enter/
 * outside-click behavior), just without the debounce/groupLabel machinery
 * PortCombobox needs for a much larger, region-grouped port list. */
export function SalesRepCombobox({
  value,
  onChange,
  options,
  placeholder = "담당자를 선택하세요",
}: {
  value: string;
  onChange: (id: string) => void;
  options: SalesRep[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedRep = options.find((r) => r.id === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((r) => r.name.toLowerCase().includes(q));
  }, [options, query]);

  const clampedHighlightedIndex = Math.min(highlightedIndex, Math.max(filtered.length - 1, 0));

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function selectOption(rep: SalesRep) {
    onChange(rep.id);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlightedIndex(Math.min(clampedHighlightedIndex + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(Math.max(clampedHighlightedIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[clampedHighlightedIndex];
      if (target) selectOption(target);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showSelectedIcon = !open && Boolean(selectedRep);

  return (
    <div className="relative" ref={wrapperRef}>
      {showSelectedIcon && (
        <Contact
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      )}
      <Input
        ref={inputRef}
        type="text"
        value={open ? query : selectedRep ? selectedRep.name : ""}
        placeholder={placeholder}
        className={showSelectedIcon ? "pl-8" : ""}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setHighlightedIndex(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg animate-dropdown-panel">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-[var(--muted)]">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((rep, index) => (
              <button
                key={rep.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(rep)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[13.5px] text-[var(--foreground)] ${
                  index === clampedHighlightedIndex ? "bg-[var(--sidebar-bg)]" : "hover:bg-[var(--sidebar-bg)]"
                }`}
              >
                <Contact size={14} className="shrink-0 text-[var(--muted)]" />
                {rep.name}
                {rep.phone && <span className="text-[var(--muted)]">· {rep.phone}</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
