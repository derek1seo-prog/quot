"use client";

import { CustomerCombobox } from "@/components/quote/CustomerCombobox";
import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import { FieldGroup, FieldLabel, Input } from "@/components/ui/Field";
import { vesselLabel, voyageSummary } from "@/lib/containers";
import type { ContainerShipment, Customer, VesselWatch } from "@/lib/types";
import { Boxes, Loader2, Plus, Ship, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface ContainerDraft {
  vesselWatchId?: string;
  vessel?: { vesselName: string; voyage: string; pol: string; pod: string; etd?: string; eta?: string };
  shared: Pick<ContainerShipment, "importer" | "exporter" | "hbl"> & {
    freeTimeUntil?: string;
    deliveryDate?: string;
    deliveryTime?: string;
    memo?: string;
    surrendered?: boolean;
    settled?: boolean;
  };
  boxes: { size: "20" | "40"; containerNo: string }[];
}

const dateInput =
  "h-10 w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white px-2.5 text-[16px] sm:text-[13.5px] tabular-nums outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]";

/** "SAWASDEE SIRIUS 2621E" -> name + 항차 (last token with a digit). */
function splitVsl(full: string): { name: string; voyage: string } | null {
  const parts = full.trim().split(/\s+/);
  if (parts.length < 2 || !/\d/.test(parts[parts.length - 1])) return null;
  return { name: parts.slice(0, -1).join(" "), voyage: parts[parts.length - 1] };
}

/** Add one HB/L's containers (or edit one container): which vessel it's on,
 * the B/L-level fields the sheet merges, and each box's size + number. */
export function ContainerDialog({
  open,
  editing,
  vessels,
  customers,
  portNames,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** Set = edit this container (one box); null = add. */
  editing: ContainerShipment | null;
  vessels: VesselWatch[];
  customers: Customer[];
  portNames: string[];
  onClose: () => void;
  onSubmit: (draft: ContainerDraft) => Promise<void>;
}) {
  const activeVessels = vessels.filter((v) => v.status === "active" || v.id === editing?.vesselWatchId);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [vesselWatchId, setVesselWatchId] = useState("");
  const [vesselName, setVesselName] = useState("");
  const [voyage, setVoyage] = useState("");
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");
  const [etd, setEtd] = useState("");
  const [eta, setEta] = useState("");
  const [importer, setImporter] = useState("");
  const [exporter, setExporter] = useState("");
  const [hbl, setHbl] = useState("");
  const [freeTimeUntil, setFreeTimeUntil] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [memo, setMemo] = useState("");
  const [boxes, setBoxes] = useState<ContainerDraft["boxes"]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = open ? (editing?.id ?? "new") : null;
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  if (key !== openedFor) {
    setOpenedFor(key);
    if (open) {
      const first = activeVessels[0]?.id ?? "";
      setMode(editing || activeVessels.length > 0 ? "existing" : "new");
      setVesselWatchId(editing?.vesselWatchId ?? first);
      setVesselName("");
      setVoyage("");
      setPol("");
      setPod("");
      setEtd("");
      setEta("");
      setImporter(editing?.importer ?? "");
      setExporter(editing?.exporter ?? "");
      setHbl(editing?.hbl ?? "");
      setFreeTimeUntil(editing?.freeTimeUntil ?? "");
      setDeliveryDate(editing?.deliveryDate ?? "");
      setDeliveryTime(editing?.deliveryTime ?? "");
      setMemo(editing?.memo ?? "");
      setBoxes(editing ? [{ size: editing.size, containerNo: editing.containerNo }] : [{ size: "40", containerNo: "" }]);
      setSaving(false);
      setError(null);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  if (!open || typeof document === "undefined") return null;

  const selected = vessels.find((v) => v.id === vesselWatchId);
  const summary = voyageSummary(selected);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === "existing" && !vesselWatchId) return setError("선박을 골라 주세요.");
    if (mode === "new" && !vesselName.trim()) return setError("선박명을 입력해 주세요.");
    if (!importer.trim()) return setError("수입자를 입력해 주세요.");
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        ...(mode === "existing"
          ? { vesselWatchId }
          : { vessel: { vesselName, voyage, pol, pod, etd: etd || undefined, eta: eta || undefined } }),
        shared: {
          importer,
          exporter,
          hbl,
          freeTimeUntil: freeTimeUntil || undefined,
          ...(editing && { deliveryDate: deliveryDate || undefined, deliveryTime: deliveryDate ? deliveryTime || undefined : undefined, memo }),
        },
        boxes,
      });
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      setSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" onClick={() => !saving && onClose()} />
      <form
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="container-dialog-title"
        noValidate
        className="relative w-full sm:max-w-[640px] max-h-[92vh] flex flex-col rounded-t-[var(--radius-lg)] sm:rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.15)] animate-modal-panel"
      >
        <div className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
              <Boxes size={18} />
            </span>
            <div>
              <h2 id="container-dialog-title" className="text-[16px] font-semibold text-[var(--foreground)]">
                {editing ? "컨테이너 수정" : "컨테이너 등록"}
              </h2>
              <p className="text-[12.5px] text-[var(--muted)] mt-0.5">
                {editing ? "출항·입항일은 선박 일정에서 함께 관리돼요." : "같은 HB/L의 컨테이너를 한 번에 등록할 수 있어요."}
              </p>
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

        <div className="overflow-y-auto px-5 sm:px-6 py-5 space-y-6">
          {/* 1. 선박 */}
          <section>
            <SectionTitle n={1} title="선박 (VSL)" />
            {activeVessels.length > 0 && !editing && (
              <div className="inline-flex p-0.5 rounded-full bg-[var(--sidebar-bg)] text-[12.5px] font-medium mb-3">
                {(["existing", "new"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 h-8 rounded-full transition-colors ${
                      mode === m ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {m === "existing" ? "등록된 선박" : "새 선박"}
                  </button>
                ))}
              </div>
            )}
            {mode === "existing" ? (
              <div className="space-y-2">
                <Dropdown
                  value={vesselWatchId}
                  onChange={setVesselWatchId}
                  aria-label="선박"
                  icon={<Ship size={15} />}
                  options={activeVessels.map((v) => ({ value: v.id, label: vesselLabel(v) }))}
                />
                {selected && (
                  <p className="text-[12.5px] text-[var(--muted)] pl-1">
                    {summary.pol ?? "선적지"} → {summary.pod ?? "양하지"} · 출항 {summary.etd?.slice(5, 10).replace("-", "/") ?? "미정"} · 입항{" "}
                    {summary.eta?.slice(5, 10).replace("-", "/") ?? "미정"}
                  </p>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup className="col-span-2 sm:col-span-1">
                  <FieldLabel>선박명</FieldLabel>
                  <Input
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    onBlur={() => {
                      const split = !voyage && splitVsl(vesselName);
                      if (split) {
                        setVesselName(split.name);
                        setVoyage(split.voyage);
                      }
                    }}
                    placeholder="예: SAWASDEE SIRIUS"
                    autoFocus
                  />
                </FieldGroup>
                <FieldGroup className="col-span-2 sm:col-span-1">
                  <FieldLabel>항차</FieldLabel>
                  <Input value={voyage} onChange={(e) => setVoyage(e.target.value)} placeholder="예: 2621E" />
                </FieldGroup>
                <datalist id="container-port-names">
                  {portNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <FieldGroup>
                  <FieldLabel>선적지</FieldLabel>
                  <Input value={pol} onChange={(e) => setPol(e.target.value)} list="container-port-names" placeholder="예: 신강" />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>양하지</FieldLabel>
                  <Input value={pod} onChange={(e) => setPod(e.target.value)} list="container-port-names" placeholder="예: 부산" />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>출항일</FieldLabel>
                  <input type="date" value={etd} onChange={(e) => setEtd(e.target.value)} aria-label="출항일" className={dateInput} />
                </FieldGroup>
                <FieldGroup>
                  <FieldLabel>입항일</FieldLabel>
                  <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} aria-label="입항일" className={dateInput} />
                </FieldGroup>
              </div>
            )}
          </section>

          {/* 2. B/L */}
          <section>
            <SectionTitle n={2} title="B/L 정보" />
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup>
                <FieldLabel>수입자</FieldLabel>
                <CustomerCombobox value={importer} onChange={setImporter} customers={customers} placeholder="예: 노마드족" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel hint="선택">수출자</FieldLabel>
                <Input value={exporter} onChange={(e) => setExporter(e.target.value)} placeholder="예: LANGFANG PASSION" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel hint="선택">HB/L</FieldLabel>
                <Input value={hbl} onChange={(e) => setHbl(e.target.value)} placeholder="예: SQ202608036" className="uppercase" />
              </FieldGroup>
              <FieldGroup>
                <FieldLabel hint="선택">프리타임 (마지막 무료일)</FieldLabel>
                <input type="date" value={freeTimeUntil} onChange={(e) => setFreeTimeUntil(e.target.value)} aria-label="프리타임" className={dateInput} />
              </FieldGroup>
              {editing && (
                <>
                  <FieldGroup>
                    <FieldLabel hint="선택">운송일</FieldLabel>
                    <input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} aria-label="운송일" className={dateInput} />
                  </FieldGroup>
                  <FieldGroup>
                    <FieldLabel hint="선택">운송시간</FieldLabel>
                    <input type="time" value={deliveryTime} onChange={(e) => setDeliveryTime(e.target.value)} aria-label="운송시간" className={dateInput} />
                  </FieldGroup>
                  <FieldGroup className="col-span-2">
                    <FieldLabel hint="선택">비고</FieldLabel>
                    <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="예: 창고 도착 전 연락" />
                  </FieldGroup>
                </>
              )}
            </div>
          </section>

          {/* 3. 컨테이너 */}
          <section>
            <SectionTitle n={3} title={editing ? "컨테이너" : `컨테이너 ${boxes.length}대`} />
            <div className="space-y-2">
              {boxes.map((b, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="inline-flex p-0.5 rounded-[10px] bg-[var(--sidebar-bg)] shrink-0" role="radiogroup" aria-label="컨테이너 크기">
                    {(["20", "40"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        role="radio"
                        aria-checked={b.size === s}
                        onClick={() => setBoxes((bs) => bs.map((x, j) => (j === i ? { ...x, size: s } : x)))}
                        className={`h-9 w-12 rounded-[8px] text-[13px] font-semibold transition-colors ${
                          b.size === s ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)]"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  <Input
                    value={b.containerNo}
                    onChange={(e) => setBoxes((bs) => bs.map((x, j) => (j === i ? { ...x, containerNo: e.target.value.toUpperCase() } : x)))}
                    placeholder="CTNS NO (예: FDCU5640124)"
                    aria-label={`${i + 1}번 컨테이너 번호`}
                    className="flex-1 font-mono tracking-wide uppercase"
                  />
                  {!editing && boxes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setBoxes((bs) => bs.filter((_, j) => j !== i))}
                      aria-label={`${i + 1}번 컨테이너 삭제`}
                      className="w-9 h-9 shrink-0 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!editing && boxes.length < 20 && (
              <button
                type="button"
                onClick={() => setBoxes((bs) => [...bs, { size: bs[bs.length - 1]?.size ?? "40", containerNo: "" }])}
                className="mt-2 inline-flex items-center gap-1 rounded-full px-2.5 h-8 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]"
              >
                <Plus size={14} /> 컨테이너 추가
              </button>
            )}
          </section>

          {error && <p className="text-[12.5px] text-[var(--danger)]">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 sm:px-6 py-4 border-t border-[var(--border-subtle)]">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button type="submit" disabled={saving} icon={saving ? <Loader2 size={15} className="animate-spin" /> : undefined}>
            {saving ? "저장 중..." : editing ? "변경사항 저장" : `${boxes.length}대 등록`}
          </Button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold text-[var(--foreground)] mb-2.5">
      <span className="w-5 h-5 rounded-full bg-[var(--foreground)] text-white text-[11px] font-semibold inline-flex items-center justify-center">
        {n}
      </span>
      {title}
    </p>
  );
}
