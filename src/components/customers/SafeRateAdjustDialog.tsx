"use client";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/format";
import {
  FIELD_LABEL,
  isValidPercent,
  MAX_ADJUST_PERCENT,
  previewAdjustment,
  ROUND_UNITS,
  type RoundUnit,
} from "@/lib/trucking-adjust";
import type { Customer } from "@/lib/types";
import { ArrowRight, Loader2, Percent, RotateCcw, TrendingDown, TrendingUp, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

interface LastAdjustment {
  percent: number;
  unit: RoundUnit;
  at: string;
}

const PREVIEW_ROWS = 5;

/** 화주 관리 > 안전운임 % 조정: move every 화주's 내륙운송료 and 안전운임 by
 * one percent (안전운임제 인상 / 인하), previewed before it's applied, with
 * an exact undo of the last adjustment. */
export function SafeRateAdjustDialog({
  open,
  customers,
  onClose,
  onChanged,
}: {
  open: boolean;
  customers: Customer[];
  onClose: () => void;
  /** New 화주 list after an apply / undo, plus a line for the toast. */
  onChanged: (customers: Customer[], message: string, undoable: boolean) => void;
}) {
  const [raw, setRaw] = useState("");
  const [unit, setUnit] = useState<RoundUnit>(100);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<LastAdjustment | null>(null);

  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setRaw("");
      setUnit(100);
      setShowAll(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch("/api/customers/adjust", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: LastAdjustment | null) => !cancelled && setLast(data))
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && !confirming && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, busy, confirming, onClose]);

  const percent = Number(raw.replace(/[^\d.-]/g, ""));
  const valid = raw.trim() !== "" && isValidPercent(percent);
  const preview = useMemo(() => (valid ? previewAdjustment(customers, percent, unit) : []), [valid, customers, percent, unit]);
  const changeCount = preview.reduce((n, r) => n + r.changes.length, 0);
  const label = valid ? `${percent > 0 ? "+" : ""}${percent}%` : "";

  if (!open || typeof document === "undefined") return null;

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ percent, unit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "적용하지 못했어요");
      onChanged(data.customers, `운송료·안전운임을 ${label} 조정했어요`, true);
      setConfirming(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "적용하지 못했어요");
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  async function undo() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/customers/adjust", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "되돌리지 못했어요");
      onChanged(data.customers, "마지막 조정을 되돌렸어요", false);
      setLast(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "되돌리지 못했어요");
    } finally {
      setBusy(false);
    }
  }

  const shown = showAll ? preview : preview.slice(0, PREVIEW_ROWS);
  const up = valid && percent > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" onClick={() => !busy && onClose()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="safe-rate-adjust-title"
        className="relative w-full sm:max-w-[560px] max-h-[92vh] flex flex-col rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Percent size={18} />
            </span>
            <div>
              <h2 id="safe-rate-adjust-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                안전운임 % 조정
              </h2>
              <p className="text-[12.5px] text-[var(--muted)] mt-0.5">모든 화주의 내륙운송료와 안전운임을 같은 비율로 바꿔요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="닫기"
            className="w-8 h-8 -mr-2 -mt-1 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
          {last && (
            <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-[var(--sidebar-bg)] px-4 py-3">
              <div className="min-w-0 flex-1 text-[12.5px]">
                <p className="font-medium text-[var(--foreground)]">
                  마지막 조정 {last.percent > 0 ? "+" : ""}
                  {last.percent}% <span className="font-normal text-[var(--muted)]">· {formatNumber(last.unit)}원 단위</span>
                </p>
                <p className="text-[var(--muted)]">{new Date(last.at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
              </div>
              <Button size="sm" variant="secondary" onClick={undo} disabled={busy} icon={<RotateCcw size={13} />}>
                되돌리기
              </Button>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="text-[13px] font-medium text-[var(--foreground)]">인상·인하율</span>
              <div className="relative mt-1.5">
                <input
                  value={raw}
                  onChange={(e) => setRaw(e.target.value.replace(/[^\d.-]/g, ""))}
                  inputMode="decimal"
                  placeholder="예: 3.5  (인하는 -2)"
                  autoFocus
                  aria-label="인상·인하율 (%)"
                  className={cn(
                    "w-full h-12 rounded-[var(--radius-md)] border bg-white pl-4 pr-20 text-[20px] font-semibold tabular-nums outline-none transition-colors focus:ring-4 focus:ring-[var(--accent-soft)]",
                    raw && !valid ? "border-[var(--danger)]" : "border-[var(--border)] focus:border-[var(--accent)]",
                  )}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                  {valid && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                        up ? "bg-red-50 text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]",
                      )}
                    >
                      {up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {up ? "인상" : "인하"}
                    </span>
                  )}
                  <span className="text-[16px] font-semibold text-[var(--muted)]">%</span>
                </span>
              </div>
            </label>
            <div>
              <span className="text-[13px] font-medium text-[var(--foreground)]">반올림</span>
              <div role="radiogroup" aria-label="반올림 단위" className="mt-1.5 inline-flex p-1 rounded-full bg-[var(--sidebar-bg)] text-[12.5px] font-medium">
                {ROUND_UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    role="radio"
                    aria-checked={unit === u}
                    onClick={() => setUnit(u)}
                    className={cn(
                      "px-3 h-9 rounded-full whitespace-nowrap transition-colors",
                      unit === u ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                    )}
                  >
                    {formatNumber(u)}원
                  </button>
                ))}
              </div>
            </div>
          </div>
          {raw && !valid && <p className="-mt-3 text-[12.5px] text-[var(--danger)]">-{MAX_ADJUST_PERCENT}% ~ +{MAX_ADJUST_PERCENT}% 사이, 소수점 둘째 자리까지 입력해 주세요.</p>}

          {valid && (
            <section className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
              <p className="px-4 py-2.5 text-[13px] font-medium text-[var(--foreground)] bg-[#fafafa] border-b border-[var(--border-subtle)]">
                {preview.length > 0 ? (
                  <>
                    화주 <span className="text-[var(--accent)]">{preview.length}곳</span> · 금액{" "}
                    <span className="text-[var(--accent)]">{changeCount}개</span>가 바뀌어요
                  </>
                ) : (
                  "바뀌는 금액이 없어요 (운송료·안전운임이 입력된 화주가 없어요)"
                )}
              </p>
              <ul className="divide-y divide-[var(--border-subtle)]">
                {shown.map((row) => (
                  <li key={row.id} className="px-4 py-3">
                    <p className="text-[13px] font-semibold text-[var(--foreground)]">{row.name}</p>
                    <ul className="mt-1.5 space-y-1">
                      {row.changes.map((ch) => (
                        <li key={ch.field} className="grid grid-cols-[1fr_auto] gap-3 text-[12.5px] tabular-nums">
                          <span className="text-[var(--muted)]">{FIELD_LABEL[ch.field]}</span>
                          <span className="inline-flex items-center gap-1.5 justify-end">
                            <span className="text-[var(--muted)] line-through decoration-[#c7c7cc]">{formatNumber(ch.from)}</span>
                            <ArrowRight size={11} className="text-[#c7c7cc]" />
                            <span className="font-semibold text-[var(--foreground)]">{formatNumber(ch.to)}</span>
                            <span className={cn("w-[64px] text-right text-[11.5px]", ch.to > ch.from ? "text-[var(--danger)]" : "text-[var(--accent)]")}>
                              {ch.to > ch.from ? "+" : ""}
                              {formatNumber(ch.to - ch.from)}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {preview.length > PREVIEW_ROWS && (
                <button
                  type="button"
                  onClick={() => setShowAll((s) => !s)}
                  className="w-full py-2.5 text-[12.5px] font-medium text-[var(--accent)] border-t border-[var(--border-subtle)] hover:bg-[var(--sidebar-bg)]/60"
                >
                  {showAll ? "접기" : `${preview.length - PREVIEW_ROWS}곳 더 보기`}
                </button>
              )}
            </section>
          )}

          <p className="text-[12px] text-[var(--muted)]">
            이미 저장된 견적서는 그대로이고, 앞으로 만드는 견적부터 바뀐 운송료가 들어가요. 적용 후에도 마지막 조정은 정확히 되돌릴 수 있어요.
          </p>
          {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            취소
          </Button>
          <Button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={!valid || changeCount === 0 || busy}
            icon={busy ? <Loader2 size={15} className="animate-spin" /> : undefined}
          >
            {changeCount > 0 ? `${changeCount}개 금액 ${label} 적용` : "적용"}
          </Button>
        </div>
      </div>
      <ConfirmDialog
        open={confirming}
        title={`운송료·안전운임을 ${label} 조정할까요?`}
        description={`화주 ${preview.length}곳의 금액 ${changeCount}개가 ${formatNumber(unit)}원 단위로 바뀌어요. 필요하면 바로 되돌릴 수 있어요.`}
        confirmLabel="적용"
        loadingLabel="적용 중..."
        tone="accent"
        loading={busy}
        onConfirm={apply}
        onCancel={() => setConfirming(false)}
      />
    </div>,
    document.body,
  );
}
