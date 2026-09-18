"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

/** Centered, on-brand confirmation modal - replaces the browser's native
 * confirm() for destructive actions (delete 화주, delete 견적, ...) so it
 * matches the rest of the UI instead of looking like a bare OS dialog. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
        onClick={onCancel}
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-[380px] rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white p-6 shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
      >
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={18} className="text-[var(--danger)]" />
        </div>
        <h2 id="confirm-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)] mt-4">
          {title}
        </h2>
        {description && (
          <p className="text-[13.5px] text-[var(--muted)] mt-1.5 leading-relaxed">{description}</p>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onCancel} autoFocus disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant="danger-solid" onClick={onConfirm} disabled={loading}>
            {loading ? "삭제 중..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
