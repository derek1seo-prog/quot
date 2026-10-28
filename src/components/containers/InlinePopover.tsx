"use client";

import { Button } from "@/components/ui/Button";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const PANEL_W = 288;

/** A small edit panel anchored to a trigger, rendered in a portal (fixed
 * position) so a scrolling table can't clip it. Closes on outside click,
 * Esc, scroll or resize. */
export function InlinePopover({
  trigger,
  title,
  children,
  onSave,
  onClear,
  saving,
  open,
  onOpenChange,
}: {
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  title: string;
  children: ReactNode;
  onSave: () => void;
  /** Shows a 지우기 button. */
  onClear?: () => void;
  saving?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // null = not measured yet; "sheet" = phone bottom sheet (no anchoring).
  const [pos, setPos] = useState<{ top: number; left: number } | "sheet" | null>(null);

  // Outside = neither the panel nor its trigger (the trigger toggles itself).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !anchorRef.current?.contains(t)) onOpenChange(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onOpenChange(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return;
    const r = anchorRef.current?.getBoundingClientRect();
    if (!r) return;
    // Phone: a bottom sheet - the keyboard resizes / scrolls the page, so
    // an anchored panel would jump or close under the user's thumb.
    if (!window.matchMedia("(min-width: 640px)").matches) {
      const id = requestAnimationFrame(() => setPos("sheet"));
      return () => cancelAnimationFrame(id);
    }
    const below = window.innerHeight - r.bottom > 210;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - PANEL_W - 8));
    // Measured after mount, so position in a frame (not synchronously).
    const id = requestAnimationFrame(() =>
      setPos({ top: below ? r.bottom + 6 : r.top - 6 - (panelRef.current?.offsetHeight ?? 170), left }),
    );
    const close = () => onOpenChange(false);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open, onOpenChange]);

  return (
    <>
      <span ref={anchorRef} className="inline-flex">
        {trigger({ onClick: () => onOpenChange(!open), "aria-expanded": open })}
      </span>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label={title}
            style={pos === "sheet" ? undefined : { top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: PANEL_W }}
            className={`fixed z-[70] ${pos === "sheet" ? "inset-x-3 bottom-3 p-4" : "p-3"} rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] animate-dropdown-panel`}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") onSave();
            }}
          >
            <p className="text-[12px] font-semibold text-[var(--foreground)] mb-2">{title}</p>
            {children}
            <div className="mt-3 flex items-center gap-1.5">
              {onClear && (
                <button
                  type="button"
                  onClick={onClear}
                  disabled={saving}
                  className="mr-auto text-[12px] text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  지우기
                </button>
              )}
              <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving} className="ml-auto">
                취소
              </Button>
              <Button size="sm" onClick={onSave} disabled={saving}>
                {saving ? "저장 중..." : "저장"}
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export const POPOVER_INPUT =
  "h-9 min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 text-[16px] sm:text-[13px] tabular-nums outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]";

/** Date (+ optional time) editor in an InlinePopover. */
export function DateTimePopover({
  title,
  date,
  time,
  withTime = false,
  onSave,
  trigger,
}: {
  title: string;
  date?: string;
  time?: string;
  withTime?: boolean;
  onSave: (date: string | undefined, time: string | undefined) => Promise<void>;
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState("");
  const [t, setT] = useState("");
  const [saving, setSaving] = useState(false);

  function openChange(next: boolean) {
    if (next) {
      setD(date ?? "");
      setT(time ?? "");
    }
    setOpen(next);
  }

  async function save(nextDate: string | undefined, nextTime: string | undefined) {
    setSaving(true);
    try {
      await onSave(nextDate || undefined, nextDate ? nextTime || undefined : undefined);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <InlinePopover
      title={title}
      open={open}
      onOpenChange={openChange}
      saving={saving}
      onSave={() => save(d, t)}
      onClear={date ? () => save(undefined, undefined) : undefined}
      trigger={trigger}
    >
      <div className="flex gap-1.5">
        <input type="date" value={d} onChange={(e) => setD(e.target.value)} aria-label={title} className={`${POPOVER_INPUT} flex-1`} autoFocus />
        {withTime && (
          <input type="time" value={t} onChange={(e) => setT(e.target.value)} aria-label="시간 (선택)" className={`${POPOVER_INPUT} w-[124px]`} />
        )}
      </div>
    </InlinePopover>
  );
}
