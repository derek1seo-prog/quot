"use client";

import { Input } from "@/components/ui/Field";
import { useDebouncedValue } from "@/lib/hooks";
import type { Port } from "@/lib/types";
import { Ship } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface PortOption {
  port: Port;
  /** Section header shown above this option (e.g. a region name). Options
   * sharing the same label in sequence render under one header. */
  groupLabel?: string;
}

function portLabel(port: Port) {
  return `${port.nameKo}항 | ${port.name} port (${port.code})`;
}

export function PortCombobox({
  value,
  onChange,
  options,
  placeholder = "항구를 검색하세요",
}: {
  value: string;
  onChange: (portId: string) => void;
  options: PortOption[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedQuery = useDebouncedValue(query, 200);

  const selectedPort = options.find((o) => o.port.id === value)?.port;

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      ({ port }) =>
        port.nameKo.toLowerCase().includes(q) ||
        port.name.toLowerCase().includes(q) ||
        port.code.toLowerCase().includes(q),
    );
  }, [options, debouncedQuery]);

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

  function selectOption(port: Port) {
    onChange(port.id);
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
      if (target) selectOption(target.port);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showSelectedIcon = !open && Boolean(selectedPort);

  return (
    <div className="relative" ref={wrapperRef}>
      {showSelectedIcon && (
        <Ship
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"
        />
      )}
      <Input
        ref={inputRef}
        type="text"
        value={open ? query : selectedPort ? portLabel(selectedPort) : ""}
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
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-3 text-[13px] text-[var(--muted)]">검색 결과가 없습니다.</p>
          ) : (
            filtered.map((option, index) => {
              const showGroupLabel =
                option.groupLabel && filtered[index - 1]?.groupLabel !== option.groupLabel;
              return (
                <div key={option.port.id}>
                  {showGroupLabel && (
                    <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {option.groupLabel}
                    </p>
                  )}
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectOption(option.port)}
                    className={`w-full flex items-center gap-2 text-left px-3 py-2 text-[13.5px] text-[var(--foreground)] ${
                      index === clampedHighlightedIndex ? "bg-[var(--sidebar-bg)]" : "hover:bg-[var(--sidebar-bg)]"
                    }`}
                  >
                    <Ship size={14} className="shrink-0 text-[var(--muted)]" />
                    {portLabel(option.port)}
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
