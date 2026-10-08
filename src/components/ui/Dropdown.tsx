"use client";

import { cn } from "@/lib/cn";
import { useDismissable } from "@/lib/hooks";
import { Check, ChevronDown } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

export interface DropdownOption {
  value: string;
  label: string;
}

/** Styled single-select, matching the 견적 만들기 pickers (IncotermsSelect /
 * SalesRepCombobox) instead of a native <select>. The option whose value is
 * "" is treated as the "전체"-style reset choice and shown muted when active. */
export function Dropdown({
  value,
  onChange,
  options,
  icon,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  icon?: ReactNode;
  className?: string;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useDismissable(wrapperRef, open, () => setOpen(false));

  // A value missing from options (e.g. an old ?customer= link) still shows as itself.
  const selected =
    options.find((o) => o.value === value) ?? (value ? { value, label: value } : options[0]);
  const isReset = !selected || selected.value === "";

  function toggle() {
    if (!open) setHighlighted(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen((o) => !o);
  }

  function select(v: string) {
    onChange(v);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        toggle();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = options[highlighted];
      if (target) select(target.value);
    }
  }

  return (
    <div className={cn("relative", className)} ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full h-10 px-3 rounded-[var(--radius-sm)] border bg-white text-[14px] outline-none transition-shadow flex items-center gap-2 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]",
          open ? "border-[var(--accent)] ring-4 ring-[var(--accent-soft)]" : "border-[var(--border)]",
        )}
      >
        {icon && <span className="shrink-0 text-[var(--muted)]">{icon}</span>}
        <span
          className={cn(
            "flex-1 min-w-0 truncate text-left",
            isReset ? "text-[var(--muted)]" : "text-[var(--foreground)] font-medium",
          )}
        >
          {selected?.label}
        </span>
        <ChevronDown
          size={16}
          className={cn("shrink-0 text-[var(--muted)] transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute z-20 top-full mt-1 w-full min-w-[160px] max-h-64 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg py-1 animate-dropdown-panel"
          style={{ transformOrigin: "top" }}
        >
          {options.map((o, i) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={active}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => select(o.value)}
                className={cn(
                  "w-full flex items-center gap-2 text-left px-3 py-2 text-[13.5px]",
                  active ? "bg-[var(--accent-soft)] text-[var(--accent)] font-medium" : "text-[var(--foreground)]",
                  !active && i === highlighted && "bg-[var(--sidebar-bg)]",
                  o.value === "" && !active && "text-[var(--muted)]",
                )}
              >
                <span className="flex-1 min-w-0 truncate">{o.label}</span>
                {active && <Check size={14} className="shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
