"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// Only these two Incoterms actually drive different charge behavior today
// (EXW adds the 현지 부대비용 category, quote-engine.ts) - the rest are
// listed for completeness but don't change a single calculated rate, so
// they're visually de-emphasized rather than presented as equally "real"
// options.
const SUPPORTED = ["EXW", "FOB"];
const OTHERS = ["CIF", "FCA", "CFR", "DAP", "DDP"];

export function IncotermsSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  function select(v: string) {
    onChange(v);
    setOpen(false);
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full h-10 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[16px] sm:text-[14px] text-[var(--foreground)] outline-none transition-shadow focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)] flex items-center justify-between"
      >
        <span>{value}</span>
        <ChevronDown
          size={16}
          className={`text-[var(--muted)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg overflow-hidden animate-dropdown-panel">
          <p className="px-3 pt-2.5 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            요율 반영됨
          </p>
          {SUPPORTED.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(t)}
              className={`w-full text-left px-3 py-2 text-[13.5px] font-medium text-[var(--foreground)] ${
                t === value ? "bg-[var(--accent-soft)]" : "hover:bg-[var(--sidebar-bg)]"
              }`}
            >
              {t}
            </button>
          ))}
          <p className="px-3 pt-2.5 pb-1.5 mt-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)] border-t border-[var(--border-subtle)]">
            추가 예정
          </p>
          {OTHERS.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(t)}
              className={`w-full text-left px-3 py-2 text-[13.5px] text-[var(--muted)] ${
                t === value ? "bg-[var(--sidebar-bg)]" : "hover:bg-[var(--sidebar-bg)]"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
