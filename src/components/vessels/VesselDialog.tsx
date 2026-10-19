"use client";

import { CustomerCombobox } from "@/components/quote/CustomerCombobox";
import { Button } from "@/components/ui/Button";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import type { Customer, VesselPortCall, VesselWatch } from "@/lib/types";
import { MAX_PORT_CALLS } from "@/lib/vessels";
import { Loader2, Plus, Ship, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface CallDraft {
  id?: string;
  portName: string;
  kind: VesselPortCall["kind"];
  etaDate: string;
  etaTime: string;
  etdDate: string;
  etdTime: string;
}

export interface VesselDraft {
  vesselName: string;
  voyage: string;
  carrier: string;
  customerName: string;
  memo: string;
  calls: { id?: string; portName: string; kind: VesselPortCall["kind"]; eta?: string; etd?: string }[];
}

const split = (v?: string) => [v?.slice(0, 10) ?? "", v?.slice(11, 16) ?? ""];
const join = (date: string, time: string) => (date ? (time ? `${date}T${time}` : date) : undefined);

function callDraft(c?: VesselPortCall, kind: VesselPortCall["kind"] = "VIA"): CallDraft {
  const [etaDate, etaTime] = split(c?.eta);
  const [etdDate, etdTime] = split(c?.etd);
  return { id: c?.id, portName: c?.portName ?? "", kind: c?.kind ?? kind, etaDate, etaTime, etdDate, etdTime };
}

/** Add / edit a tracked voyage: vessel, voyage, carrier, 화주, and its port
 * calls (출발항 → 경유 → 도착항) with ETA/ETD. Esc / backdrop closes. */
export function VesselDialog({
  open,
  watch,
  customers,
  portNames,
  onClose,
  onSubmit,
}: {
  open: boolean;
  watch: VesselWatch | null;
  customers: Customer[];
  portNames: string[];
  onClose: () => void;
  onSubmit: (draft: VesselDraft) => Promise<void>;
}) {
  const [vesselName, setVesselName] = useState("");
  const [voyage, setVoyage] = useState("");
  const [carrier, setCarrier] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [memo, setMemo] = useState("");
  const [calls, setCalls] = useState<CallDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = open ? (watch?.id ?? "new") : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      setVesselName(watch?.vesselName ?? "");
      setVoyage(watch?.voyage ?? "");
      setCarrier(watch?.carrier ?? "");
      setCustomerName(watch?.customerName ?? "");
      setMemo(watch?.memo ?? "");
      setCalls(watch ? watch.calls.map((c) => callDraft(c)) : [callDraft(undefined, "POL"), callDraft(undefined, "POD")]);
      setSaving(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open || typeof document === "undefined") return null;

  const patch = (i: number, p: Partial<CallDraft>) => setCalls((cs) => cs.map((c, j) => (j === i ? { ...c, ...p } : c)));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!vesselName.trim()) return setError("선박명을 입력해 주세요.");
    if (!calls.some((c) => c.portName.trim())) return setError("항구를 하나 이상 입력해 주세요.");
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        vesselName,
        voyage,
        carrier,
        customerName,
        memo,
        calls: calls.map((c) => ({
          id: c.id,
          portName: c.portName,
          kind: c.kind,
          eta: c.kind === "POL" ? undefined : join(c.etaDate, c.etaTime),
          etd: c.kind === "POD" ? undefined : join(c.etdDate, c.etdTime),
        })),
      });
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  const dateInput = "h-9 min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 text-[13px] tabular-nums";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" onClick={() => !saving && onClose()} />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vessel-dialog-title"
        noValidate
        className="relative w-full sm:max-w-[620px] max-h-[92vh] flex flex-col rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
      >
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Ship size={18} />
            </span>
            <div>
              <h2 id="vessel-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                {watch ? "선박 일정 수정" : "선박 추가"}
              </h2>
              <p className="text-[12.5px] text-[var(--muted)] mt-0.5">날짜를 바꾸면 이전 날짜와 함께 변경 이력에 남아요.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="닫기"
            className="w-8 h-8 -mr-2 -mt-1 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-5">
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldGroup>
              <FieldLabel>선박명</FieldLabel>
              <Input value={vesselName} onChange={(e) => setVesselName(e.target.value)} placeholder="예: PACIFIC BEIJING" autoFocus />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="선택">항차</FieldLabel>
              <Input value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="예: 2623E" />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="선택">선사</FieldLabel>
              <Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="예: Pan Ocean" />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel hint="선택">화주</FieldLabel>
              <CustomerCombobox value={customerName} onChange={setCustomerName} customers={customers} placeholder="화주명" />
            </FieldGroup>
            <FieldGroup className="sm:col-span-2">
              <FieldLabel hint="선택">메모</FieldLabel>
              <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: B/L 번호, 컨테이너 번호" />
            </FieldGroup>
          </section>

          <section>
            <p className="text-[13px] font-medium text-[var(--foreground)] mb-2">기항지 (순서대로)</p>
            <datalist id="vessel-port-names">
              {portNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <div className="space-y-2">
              {calls.map((c, i) => (
                <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] p-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={c.kind}
                      onChange={(e) => patch(i, { kind: e.target.value as CallDraft["kind"] })}
                      aria-label="구분"
                      className="h-9 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2 text-[13px]"
                    >
                      <option value="POL">출발항</option>
                      <option value="VIA">경유</option>
                      <option value="POD">도착항</option>
                    </select>
                    <Input
                      value={c.portName}
                      onChange={(e) => patch(i, { portName: e.target.value })}
                      list="vessel-port-names"
                      placeholder="항구명 (예: 신강)"
                      aria-label="항구명"
                      className="h-9 flex-1"
                    />
                    {calls.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCalls((cs) => cs.filter((_, j) => j !== i))}
                        aria-label="기항지 삭제"
                        className="w-8 h-8 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {c.kind !== "POL" && (
                      <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                        <span className="w-8 shrink-0">입항</span>
                        <input type="date" value={c.etaDate} onChange={(e) => patch(i, { etaDate: e.target.value })} className={`${dateInput} flex-1`} />
                        <input type="time" value={c.etaTime} onChange={(e) => patch(i, { etaTime: e.target.value })} aria-label="입항 시간" className={`${dateInput} w-[88px]`} />
                      </label>
                    )}
                    {c.kind !== "POD" && (
                      <label className="flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
                        <span className="w-8 shrink-0">출항</span>
                        <input type="date" value={c.etdDate} onChange={(e) => patch(i, { etdDate: e.target.value })} className={`${dateInput} flex-1`} />
                        <input type="time" value={c.etdTime} onChange={(e) => patch(i, { etdTime: e.target.value })} aria-label="출항 시간" className={`${dateInput} w-[88px]`} />
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {calls.length < MAX_PORT_CALLS && (
              <button
                type="button"
                onClick={() =>
                  setCalls((cs) => {
                    // New stops go before the 도착항 so the route stays in order.
                    const podIndex = cs.findIndex((c) => c.kind === "POD");
                    const at = podIndex >= 0 ? podIndex : cs.length;
                    return [...cs.slice(0, at), callDraft(), ...cs.slice(at)];
                  })
                }
                className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 h-7 text-[12.5px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <Plus size={14} /> 경유항 추가
              </button>
            )}
          </section>

          {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" disabled={saving} icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}>
            {saving ? "저장 중..." : watch ? "변경사항 저장" : "추가하기"}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
