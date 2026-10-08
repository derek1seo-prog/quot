"use client";

import { cn } from "@/lib/cn";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const PANEL_WIDTH = 288;
const PANEL_HEIGHT = 360;

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function toIso(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function todayIso() {
  return toIso(new Date());
}
function addDays(iso: string, days: number) {
  const d = fromIso(iso)!;
  d.setDate(d.getDate() + days);
  return toIso(d);
}

/** "2026-10-08" -> "2026. 10. 08 (수)" (or "26.10.08" when compact). */
export function formatPickerDate(iso: string, compact = false): string {
  const d = fromIso(iso);
  if (!d) return "";
  if (compact) return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
  return `${d.getFullYear()}. ${pad(d.getMonth() + 1)}. ${pad(d.getDate())} (${WEEKDAYS[d.getDay()]})`;
}

/** Styled date field + calendar popover replacing <input type="date">.
 * Value is an ISO date string ("" = empty). The popover is portaled and
 * fixed-positioned so overflow-hidden cards never clip it, and it flips
 * upward when there's no room below. */
export function DatePicker({
  value,
  onChange,
  min,
  max,
  placeholder = "날짜 선택",
  clearable = false,
  compact = false,
  rangeStart,
  rangeEnd,
  className,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  clearable?: boolean;
  /** Smaller field (h-8, "26.10.08") for dense rows. */
  compact?: boolean;
  /** Shades the days between these (e.g. a from/to filter pair). */
  rangeStart?: string;
  rangeEnd?: string;
  className?: string;
  "aria-label": string;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => fromIso(value) ?? new Date());
  const [focused, setFocused] = useState(value || todayIso());
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const disabled = useCallback(
    (iso: string) => Boolean((min && iso < min) || (max && iso > max)),
    [min, max],
  );

  function openPanel() {
    const start = value || (min && todayIso() < min ? min : todayIso());
    setFocused(start);
    setView(fromIso(start)!);
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) buttonRef.current?.focus();
  }

  function select(iso: string) {
    if (disabled(iso)) return;
    onChange(iso);
    close();
  }

  // Position under (or above) the field, in viewport coordinates.
  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const up = window.innerHeight - r.bottom < PANEL_HEIGHT + 8 && r.top > PANEL_HEIGHT + 8;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - PANEL_WIDTH - 8);
    setPos({ top: up ? r.top - 6 : r.bottom + 6, left, up });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Keep keyboard focus on the highlighted day (once the panel is placed).
  const placed = pos != null;
  useEffect(() => {
    if (!open || !placed) return;
    panelRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focused}"]`)?.focus();
  }, [open, placed, focused, view]);

  function moveFocus(days: number) {
    const next = addDays(focused, days);
    setFocused(next);
    const d = fromIso(next)!;
    if (d.getMonth() !== view.getMonth() || d.getFullYear() !== view.getFullYear()) setView(d);
  }

  function handlePanelKey(e: React.KeyboardEvent) {
    const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in keys) {
      e.preventDefault();
      moveFocus(keys[e.key]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Enter" && (e.target as HTMLElement).dataset.iso) {
      e.preventDefault();
      select(focused);
    }
  }

  // 6-week grid starting on the Sunday on/before the 1st.
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  const today = todayIso();
  // With only one end of the range picked, still mark that day.
  const ends = [rangeStart, rangeEnd].filter(Boolean).sort() as string[];
  const lo = ends[0];
  const hi = ends[ends.length - 1];

  function shiftMonth(delta: number) {
    setView((v) => new Date(v.getFullYear(), v.getMonth() + delta, 1));
  }

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            openPanel();
          }
        }}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-2 rounded-[var(--radius-sm)] border bg-white text-left outline-none transition-shadow focus-visible:border-[var(--accent)] focus-visible:ring-4 focus-visible:ring-[var(--accent-soft)]",
          compact ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 text-[14px]",
          open ? "border-[var(--accent)] ring-4 ring-[var(--accent-soft)]" : "border-[var(--border)] hover:border-[var(--accent)]/50",
          clearable && value && "pr-8",
        )}
      >
        <CalendarDays size={14} className="shrink-0 text-[var(--muted)]" />
        <span className={cn("flex-1 min-w-0 truncate", value ? "text-[var(--foreground)]" : "text-[var(--muted)]")}>
          {value ? formatPickerDate(value, compact) : placeholder}
        </span>
      </button>
      {clearable && value && !open && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={`${ariaLabel} 지우기`}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
        >
          <X size={13} />
        </button>
      )}

      {open &&
        pos &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={`${ariaLabel} 달력`}
            onKeyDown={handlePanelKey}
            className="fixed z-[60] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-3 shadow-[0_12px_40px_rgba(15,23,42,0.14)] animate-dropdown-panel"
            style={{
              top: pos.top,
              left: pos.left,
              width: PANEL_WIDTH,
              transform: pos.up ? "translateY(-100%)" : undefined,
              transformOrigin: pos.up ? "bottom" : "top",
            }}
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="이전 달"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]"
              >
                <ChevronLeft size={16} />
              </button>
              <p className="text-[14px] font-semibold text-[var(--foreground)] tabular-nums">
                {view.getFullYear()}년 {view.getMonth() + 1}월
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="다음 달"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="grid grid-cols-7 mb-1">
              {WEEKDAYS.map((w, i) => (
                <span
                  key={w}
                  className={cn(
                    "h-7 flex items-center justify-center text-[11.5px] font-medium",
                    i === 0 ? "text-[#e5484d]" : i === 6 ? "text-[#3e63dd]" : "text-[var(--muted)]",
                  )}
                >
                  {w}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-0.5" role="grid">
              {days.map((d) => {
                const iso = toIso(d);
                const inMonth = d.getMonth() === view.getMonth();
                const selected = iso === value;
                const isToday = iso === today;
                const off = disabled(iso);
                const inRange = lo && hi && iso >= lo && iso <= hi;
                const edge = iso === lo || iso === hi;
                const weekday = d.getDay();
                return (
                  <div
                    key={iso}
                    className={cn(
                      "flex items-center justify-center",
                      inRange && !(lo === hi) && "bg-[var(--accent-soft)]",
                      inRange && iso === lo && "rounded-l-full",
                      inRange && iso === hi && "rounded-r-full",
                    )}
                  >
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={iso === focused ? 0 : -1}
                      disabled={off}
                      onClick={() => select(iso)}
                      onFocus={() => setFocused(iso)}
                      aria-pressed={selected}
                      aria-label={formatPickerDate(iso)}
                      className={cn(
                        "relative w-9 h-9 rounded-full text-[13px] tabular-nums outline-none transition-colors",
                        selected || (edge && inRange)
                          ? "bg-[var(--accent)] text-white font-semibold shadow-sm"
                          : off
                            ? "text-[var(--muted)]/40 cursor-not-allowed"
                            : cn(
                                "hover:bg-[var(--sidebar-bg)]",
                                !inMonth
                                  ? "text-[var(--muted)]/50"
                                  : weekday === 0
                                    ? "text-[#e5484d]"
                                    : weekday === 6
                                      ? "text-[#3e63dd]"
                                      : "text-[var(--foreground)]",
                              ),
                        "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                        isToday && !selected && "font-semibold",
                      )}
                    >
                      {d.getDate()}
                      {isToday && !selected && (
                        <span className="absolute left-1/2 bottom-1 -translate-x-1/2 w-1 h-1 rounded-full bg-[var(--accent)]" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => select(today)}
                disabled={disabled(today)}
                className="h-8 px-3 rounded-full text-[12.5px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)] disabled:opacity-40"
              >
                오늘
              </button>
              {clearable && value && (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    close();
                  }}
                  className="h-8 px-3 rounded-full text-[12.5px] font-medium text-[var(--muted)] hover:bg-[var(--sidebar-bg)] hover:text-[var(--foreground)]"
                >
                  지우기
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
