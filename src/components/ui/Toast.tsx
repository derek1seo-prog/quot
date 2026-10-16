"use client";

import { cn, TOOLTIP_BUBBLE_CLASS } from "@/lib/cn";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export interface ToastMessage {
  /** Changes on every new message, so the same text shown twice restarts. */
  id: number;
  text: string;
  action?: { label: string; onClick: () => void };
}

/** Bottom-center confirmation for a quick action (e.g. a quote line added
 * or removed), with an optional undo-style action. Dismisses itself. */
export function Toast({
  message,
  onDismiss,
  durationMs = 3000,
}: {
  message: ToastMessage | null;
  onDismiss: () => void;
  durationMs?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, durationMs]);

  if (!message || typeof document === "undefined") return null;
  return createPortal(
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
      <div
        key={message.id}
        role="status"
        aria-live="polite"
        className={cn(
          TOOLTIP_BUBBLE_CLASS,
          "pointer-events-auto flex items-center gap-3 px-4 py-2 text-[13px] animate-dropdown-panel",
        )}
      >
        <span>{message.text}</span>
        {message.action && (
          <button
            type="button"
            onClick={() => {
              message.action?.onClick();
              onDismiss();
            }}
            className="font-semibold text-[#8ec5ff] hover:text-white"
          >
            {message.action.label}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
