"use client";

import { Input } from "@/components/ui/Field";
import type { Customer } from "@/lib/types";
import { Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Autocomplete for 화주 (customer name) - unlike PortCombobox this is not
 * a strict select: customerName is a free-text string on QuoteInput, and
 * typing a brand-new, not-yet-registered name is valid. So the input's
 * live text IS `value` directly (no separate query/committed-value split),
 * and the dropdown is just a styled suggestion list layered on top -
 * replaces a native <datalist>, which renders as an unstyled OS dropdown
 * that can't match the app's design system. */
export function CustomerCombobox({
  value,
  onChange,
  customers,
  placeholder,
}: {
  value: string;
  onChange: (name: string) => void;
  customers: Customer[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = value.trim().toLowerCase();
  const filtered = q ? customers.filter((c) => c.name.toLowerCase().includes(q)) : customers;
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

  function selectOption(customer: Customer) {
    onChange(customer.name);
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
      if (open && filtered.length > 0) {
        e.preventDefault();
        selectOption(filtered[clampedHighlightedIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <Input
        ref={inputRef}
        type="text"
        value={value}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setHighlightedIndex(0);
        }}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlightedIndex(0);
        }}
        onKeyDown={handleKeyDown}
        onBlur={() => setOpen(false)}
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-[var(--muted)]">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((customer, index) => (
              <button
                key={customer.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(customer)}
                className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[13.5px] text-[var(--foreground)] ${
                  index === clampedHighlightedIndex ? "bg-[var(--sidebar-bg)]" : "hover:bg-[var(--sidebar-bg)]"
                }`}
              >
                <Users size={14} className="shrink-0 text-[var(--muted)]" />
                {customer.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
