"use client";

import { cn } from "@/lib/cn";
import { dDay, freeTimeStatus, STAGE_META, vesselLabel, voyageSummary, type ContainerStage } from "@/lib/containers";
import type { ContainerShipment, VesselWatch } from "@/lib/types";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { useState, type ReactNode } from "react";

export interface SheetRow {
  c: ContainerShipment;
  stage: ContainerStage;
}

/** A new row typed at the bottom of the sheet. */
export interface SheetDraft {
  importer: string;
  exporter: string;
  pol: string;
  pod: string;
  size: "20" | "40";
  vsl: string;
  containerNo: string;
  hbl: string;
  etd: string;
  eta: string;
  freeTimeUntil: string;
  deliveryDate: string;
  deliveryTime: string;
  surrendered: boolean;
  settled: boolean;
  memo: string;
}

export interface SheetHandlers {
  /** One container's own fields. */
  onContainer: (c: ContainerShipment, patch: Partial<ContainerShipment>) => Promise<void>;
  /** 서렌더 / 정산 for the whole HB/L. */
  onFlag: (c: ContainerShipment, flag: "surrendered" | "settled") => void;
  /** Vessel-level cells (선적지·양하지·VSL·출항일·입항일) edit the voyage
   * itself, so every container on it follows. */
  onVessel: (v: VesselWatch, patch: { pol?: string; pod?: string; etd?: string; eta?: string; vsl?: string }) => Promise<void>;
  onCreate: (draft: SheetDraft) => Promise<void>;
  onDelete: (c: ContainerShipment) => void;
}

const COLS: { label: string; w: number; vessel?: boolean; center?: boolean }[] = [
  { label: "NO", w: 44, center: true },
  { label: "수입자", w: 150 },
  { label: "수출자", w: 190 },
  { label: "선적지", w: 76, vessel: true, center: true },
  { label: "양하지", w: 76, vessel: true, center: true },
  { label: "CNTR", w: 64, center: true },
  { label: "VSL", w: 210, vessel: true },
  { label: "CTNS NO", w: 128 },
  { label: "HB/L", w: 132 },
  { label: "출항일", w: 128, vessel: true },
  { label: "입항일", w: 128, vessel: true },
  { label: "프리타임", w: 142 },
  { label: "운송일", w: 128 },
  { label: "운송시간", w: 104 },
  { label: "서렌더", w: 84, center: true },
  { label: "정산", w: 84, center: true },
  { label: "비고", w: 180 },
  { label: "", w: 64 },
];

const CELL = "border-r border-b border-[#e5e7eb] p-0 align-middle";
const INPUT =
  "w-full h-9 bg-transparent px-2 text-[13px] text-[var(--foreground)] outline-none placeholder:text-[#c7c7cc] focus:bg-white focus:ring-2 focus:ring-inset focus:ring-[var(--accent)]";

export function splitVsl(full: string): { vesselName: string; voyage: string } {
  const parts = full.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /\d/.test(parts[parts.length - 1])) {
    return { vesselName: parts.slice(0, -1).join(" "), voyage: parts[parts.length - 1] };
  }
  return { vesselName: parts.join(" "), voyage: "" };
}

/** 시트 보기: the same columns as the team's "선복 진행 예정 일정" sheet,
 * edited in place. Vessel columns and the HB/L's 서렌더 / 정산 are merged
 * across the rows they cover, like the sheet's merged cells. */
export function ContainerSheet({
  rows,
  vessels,
  today,
  handlers,
}: {
  rows: SheetRow[];
  vessels: VesselWatch[];
  today: string;
  handlers: SheetHandlers;
}) {
  const byId = new Map(vessels.map((v) => [v.id, v]));
  const [saved, setSaved] = useState<string | null>(null);

  // Flash a cell green for a moment after it saves.
  async function track(key: string, run: () => Promise<void>) {
    await run();
    setSaved(key);
    setTimeout(() => setSaved((k) => (k === key ? null : k)), 1200);
  }

  const span = (i: number, same: (a: SheetRow, b: SheetRow) => boolean) => {
    if (i > 0 && same(rows[i - 1], rows[i])) return 0;
    let n = 1;
    while (i + n < rows.length && same(rows[i], rows[i + n])) n++;
    return n;
  };
  const sameVessel = (a: SheetRow, b: SheetRow) => a.c.vesselWatchId === b.c.vesselWatchId;
  const sameHbl = (a: SheetRow, b: SheetRow) => sameVessel(a, b) && Boolean(a.c.hbl) && a.c.hbl === b.c.hbl;

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="overflow-x-auto">
        <table className="table-fixed border-separate border-spacing-0 text-[13px]" style={{ width: COLS.reduce((s, c) => s + c.w, 0) }}>
          <colgroup>
            {COLS.map((c, i) => (
              <col key={i} style={{ width: c.w }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {COLS.map((c, i) => (
                <th
                  key={i}
                  className={cn(
                    "sticky top-0 z-10 h-9 border-r border-b border-[#e5e7eb] px-2 text-[12px] font-semibold text-[#3a3a3c] whitespace-nowrap",
                    c.vessel ? "bg-[#eef4ff]" : "bg-[#f5f0fb]",
                    c.center ? "text-center" : "text-left",
                    i === 0 && "sticky left-0 z-20",
                  )}
                  title={c.vessel ? "선박 일정 - 바꾸면 이 배의 컨테이너 모두에 반영돼요" : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const v = byId.get(r.c.vesselWatchId);
              const s = voyageSummary(v);
              const vSpan = span(i, sameVessel);
              const hSpan = r.c.hbl ? span(i, sameHbl) : 1;
              const ft = freeTimeStatus(r.c, today);
              const k = (f: string) => `${r.c.id}:${f}`;
              const vk = (f: string) => `${r.c.vesselWatchId}:${f}`;
              const vesselCell = (field: "pol" | "pod" | "vsl" | "etd" | "eta", node: ReactNode, extra?: string) =>
                vSpan > 0 && (
                  <td rowSpan={vSpan} className={cn(CELL, "bg-[#fbfcff]", saved === vk(field) && "bg-green-50", extra)}>
                    {node}
                  </td>
                );
              return (
                <tr key={r.c.id} className="group">
                  <td className={cn(CELL, "sticky left-0 z-[5] bg-white text-center text-[12px] text-[var(--muted)] tabular-nums")} title={STAGE_META[r.stage].label}>
                    <span className="inline-flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", stageDot(r.stage))} />
                      {i + 1}
                    </span>
                  </td>
                  <td className={cn(CELL, saved === k("importer") && "bg-green-50")}>
                    <TextCell value={r.c.importer} onCommit={(x) => track(k("importer"), () => handlers.onContainer(r.c, { importer: x }))} />
                  </td>
                  <td className={cn(CELL, saved === k("exporter") && "bg-green-50")}>
                    <TextCell value={r.c.exporter} onCommit={(x) => track(k("exporter"), () => handlers.onContainer(r.c, { exporter: x }))} />
                  </td>
                  {vesselCell("pol", v && <TextCell center value={s.pol ?? ""} onCommit={(x) => track(vk("pol"), () => handlers.onVessel(v, { pol: x }))} />)}
                  {vesselCell("pod", v && <TextCell center value={s.pod ?? ""} onCommit={(x) => track(vk("pod"), () => handlers.onVessel(v, { pod: x }))} />)}
                  <td className={cn(CELL, saved === k("size") && "bg-green-50")}>
                    <select
                      value={r.c.size}
                      onChange={(e) => track(k("size"), () => handlers.onContainer(r.c, { size: e.target.value as "20" | "40" }))}
                      aria-label="CNTR"
                      className={cn(INPUT, "text-center font-semibold appearance-none cursor-pointer")}
                    >
                      <option value="20">20</option>
                      <option value="40">40</option>
                    </select>
                  </td>
                  {vesselCell(
                    "vsl",
                    v && <TextCell upper value={vesselLabel(v)} onCommit={(x) => track(vk("vsl"), () => handlers.onVessel(v, { vsl: x }))} />,
                  )}
                  <td className={cn(CELL, saved === k("containerNo") && "bg-green-50")}>
                    <TextCell mono upper value={r.c.containerNo} onCommit={(x) => track(k("containerNo"), () => handlers.onContainer(r.c, { containerNo: x }))} />
                  </td>
                  {(hSpan > 0 || !r.c.hbl) && (
                    <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, saved === k("hbl") && "bg-green-50")}>
                      <TextCell mono upper center value={r.c.hbl} onCommit={(x) => track(k("hbl"), () => handlers.onContainer(r.c, { hbl: x }))} />
                    </td>
                  )}
                  {vesselCell(
                    "etd",
                    v && <DateCell value={s.etd?.slice(0, 10)} delay={s.etdDelay} confirmed={Boolean(s.departed)} onCommit={(x) => track(vk("etd"), () => handlers.onVessel(v, { etd: x }))} />,
                  )}
                  {vesselCell(
                    "eta",
                    v && <DateCell value={s.eta?.slice(0, 10)} delay={s.etaDelay} confirmed={Boolean(s.arrived)} onCommit={(x) => track(vk("eta"), () => handlers.onVessel(v, { eta: x }))} />,
                  )}
                  <td className={cn(CELL, saved === k("ft") && "bg-green-50")}>
                    <DateCell
                      value={r.c.freeTimeUntil}
                      badge={
                        ft.days !== null && (ft.state === "soon" || ft.state === "over" || ft.state === "willExceed" || ft.state === "ok")
                          ? { text: dDay(ft.days), tone: ft.state === "ok" ? "muted" : ft.state === "soon" ? "warning" : "danger" }
                          : ft.state === "safe"
                            ? { text: "✓", tone: "success" }
                            : undefined
                      }
                      onCommit={(x) => track(k("ft"), () => handlers.onContainer(r.c, { freeTimeUntil: x }))}
                    />
                  </td>
                  <td className={cn(CELL, saved === k("dd") && "bg-green-50", r.stage === "needsTrucking" && "bg-red-50/60")}>
                    <DateCell value={r.c.deliveryDate} onCommit={(x) => track(k("dd"), () => handlers.onContainer(r.c, { deliveryDate: x, ...(x ? {} : { deliveryTime: undefined }) }))} />
                  </td>
                  <td className={cn(CELL, saved === k("dt") && "bg-green-50")}>
                    <TimeCell value={r.c.deliveryTime} onCommit={(x) => track(k("dt"), () => handlers.onContainer(r.c, { deliveryTime: x }))} />
                  </td>
                  {(hSpan > 0 || !r.c.hbl) && (
                    <>
                      <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, "text-center")}>
                        <FlagCell on={r.c.surrendered} label="서렌더" onClick={() => handlers.onFlag(r.c, "surrendered")} />
                      </td>
                      <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, "text-center")}>
                        <FlagCell on={r.c.settled} label="정산" onClick={() => handlers.onFlag(r.c, "settled")} />
                      </td>
                    </>
                  )}
                  <td className={cn(CELL, saved === k("memo") && "bg-green-50")}>
                    <TextCell value={r.c.memo ?? ""} onCommit={(x) => track(k("memo"), () => handlers.onContainer(r.c, { memo: x }))} />
                  </td>
                  <td className={cn(CELL, "text-center")}>
                    <button
                      type="button"
                      onClick={() => handlers.onDelete(r.c)}
                      aria-label={`${i + 1}행 삭제`}
                      className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[#c7c7cc] opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-[var(--danger)] hover:bg-red-50 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
            <NewRows
              number={rows.length + 1}
              last={rows[rows.length - 1]}
              vessels={vessels}
              onCreate={handlers.onCreate}
            />
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[12px] text-[var(--muted)] border-t border-[var(--border-subtle)] bg-[#fafafa]">
        칸을 눌러 바로 고치고 Enter 또는 다른 칸을 누르면 저장돼요. <span className="text-[#3b6fd8]">파란 열</span>은 선박 일정이라 같은 배의
        컨테이너에 함께 반영되고, 서렌더·정산은 같은 HB/L에 함께 반영돼요.
      </p>
    </div>
  );
}

function stageDot(stage: ContainerStage): string {
  const tone = STAGE_META[stage].tone;
  return tone === "danger"
    ? "bg-[var(--danger)]"
    : tone === "warning"
      ? "bg-[#f5a623]"
      : tone === "accent"
        ? "bg-[var(--accent)]"
        : tone === "success"
          ? "bg-[var(--success)]"
          : "bg-[#c7c7cc]";
}

/** A sheet cell: plain until focused; saves on blur / Enter, Esc reverts. */
function TextCell({
  value,
  onCommit,
  mono,
  upper,
  center,
}: {
  value: string;
  onCommit: (value: string) => Promise<void> | void;
  mono?: boolean;
  upper?: boolean;
  center?: boolean;
}) {
  return (
    <input
      key={value}
      defaultValue={value}
      onBlur={(e) => {
        const next = upper ? e.target.value.trim().toUpperCase() : e.target.value.trim();
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          e.currentTarget.value = value;
          e.currentTarget.blur();
        }
      }}
      className={cn(INPUT, mono && "font-mono text-[12.5px] tracking-tight", upper && "uppercase", center && "text-center")}
    />
  );
}

/** "08월 17일" - the sheet's own date style. */
function sheetDate(d: string): string {
  const [, m, day] = d.split("-");
  return `${m}월 ${day}일`;
}

/** A transparent native picker over a formatted value: the cell reads like
 * the sheet ("08월 17일 +2"), clicking opens the browser's date / time
 * picker, and a pick saves at once. */
function PickerCell({
  type,
  value,
  display,
  placeholder,
  onCommit,
  children,
}: {
  type: "date" | "time";
  value?: string;
  display?: string;
  placeholder: string;
  onCommit: (value: string | undefined) => Promise<void> | void;
  children?: ReactNode;
}) {
  return (
    <div className="relative flex items-center h-9 px-2 gap-1 focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--accent)] focus-within:bg-white">
      <span className={cn("text-[13px] tabular-nums whitespace-nowrap", value ? "text-[var(--foreground)]" : "text-[#c7c7cc]")}>
        {value ? (display ?? value) : placeholder}
      </span>
      <span className="ml-auto flex items-center gap-0.5">{children}</span>
      <input
        key={value ?? ""}
        type={type}
        defaultValue={value ?? ""}
        aria-label={placeholder}
        onClick={(e) => {
          try {
            e.currentTarget.showPicker();
          } catch {
            // older browsers: the focused input still takes typing
          }
        }}
        onChange={(e) => {
          const next = e.target.value || undefined;
          // Typed dates fire partial changes - only commit complete values.
          if (next && (type === "date" ? !/^\d{4}-\d{2}-\d{2}$/.test(next) : !/^\d{2}:\d{2}$/.test(next))) return;
          if (next !== value) onCommit(next);
        }}
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
      />
    </div>
  );
}

function DateCell({
  value,
  onCommit,
  delay,
  confirmed,
  badge,
}: {
  value?: string;
  onCommit: (value: string | undefined) => Promise<void> | void;
  delay?: number | null;
  confirmed?: boolean;
  badge?: { text: string; tone: "muted" | "warning" | "danger" | "success" };
}) {
  return (
    <PickerCell type="date" value={value} display={value && sheetDate(value)} placeholder="날짜" onCommit={onCommit}>
      {value && confirmed && <Check size={12} strokeWidth={3} className="text-[var(--success)]" aria-label="확인됨" />}
      {value && delay !== null && delay !== undefined && delay !== 0 && (
        <span className={cn("rounded px-1 text-[10.5px] font-bold", delay > 0 ? "bg-red-50 text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>
          {delay > 0 ? `+${delay}` : delay}
        </span>
      )}
      {value && badge && (
        <span
          className={cn(
            "rounded px-1 text-[10.5px] font-bold",
            badge.tone === "danger" && "bg-red-50 text-[var(--danger)]",
            badge.tone === "warning" && "bg-amber-50 text-[var(--warning)]",
            badge.tone === "success" && "bg-green-50 text-[var(--success)]",
            badge.tone === "muted" && "text-[var(--muted)] font-medium",
          )}
        >
          {badge.text}
        </span>
      )}
    </PickerCell>
  );
}

function TimeCell({ value, onCommit }: { value?: string; onCommit: (value: string | undefined) => Promise<void> | void }) {
  return <PickerCell type="time" value={value} display={value && `${value.slice(0, 2)}시${value.slice(3) !== "00" ? ` ${value.slice(3)}분` : ""}`} placeholder="시간" onCommit={onCommit} />;
}

function FlagCell({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center justify-center gap-1 h-6 px-2 rounded-full text-[12px] font-semibold transition-colors",
        on ? "bg-green-50 text-[var(--success)] hover:bg-green-100" : "text-[#aeaeb2] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]",
      )}
    >
      {on ? (
        <>
          <Check size={12} strokeWidth={3} /> 완료
        </>
      ) : (
        "미완료"
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------

function emptyDraft(from?: SheetRow, vessel?: VesselWatch): SheetDraft {
  // A new row starts as a copy of the last one (same ship / HB/L is the
  // common case - the next box of the same B/L), minus its own number.
  const s = voyageSummary(vessel);
  return {
    importer: from?.c.importer ?? "",
    exporter: from?.c.exporter ?? "",
    pol: s.pol ?? "",
    pod: s.pod ?? "",
    size: from?.c.size ?? "40",
    vsl: vessel ? vesselLabel(vessel) : "",
    containerNo: "",
    hbl: from?.c.hbl ?? "",
    etd: s.etd?.slice(0, 10) ?? "",
    eta: s.eta?.slice(0, 10) ?? "",
    freeTimeUntil: from?.c.freeTimeUntil ?? "",
    deliveryDate: "",
    deliveryTime: "",
    surrendered: from?.c.surrendered ?? false,
    settled: false,
    memo: "",
  };
}

/** Draft rows typed at the bottom, saved one by one with ✓ (or Enter). */
function NewRows({
  number,
  last,
  vessels,
  onCreate,
}: {
  number: number;
  last?: SheetRow;
  vessels: VesselWatch[];
  onCreate: (draft: SheetDraft) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<{ id: number; d: SheetDraft; saving?: boolean; error?: string }[]>([]);
  const [seq, setSeq] = useState(0);
  const active = vessels.filter((v) => v.status === "active");

  function add() {
    const prev = drafts[drafts.length - 1]?.d;
    const base = prev ? { ...prev, containerNo: "", deliveryDate: "", deliveryTime: "", memo: "" } : emptyDraft(last, vessels.find((v) => v.id === last?.c.vesselWatchId));
    setDrafts((ds) => [...ds, { id: seq, d: base }]);
    setSeq((n) => n + 1);
  }

  function patch(id: number, p: Partial<SheetDraft>) {
    setDrafts((ds) =>
      ds.map((x) => {
        if (x.id !== id) return x;
        const d = { ...x.d, ...p };
        // Picking a known voyage fills its route and dates.
        if (p.vsl !== undefined) {
          const match = active.find((v) => vesselLabel(v).toUpperCase() === p.vsl!.trim().toUpperCase());
          if (match) {
            const s = voyageSummary(match);
            Object.assign(d, { pol: s.pol ?? d.pol, pod: s.pod ?? d.pod, etd: s.etd?.slice(0, 10) ?? d.etd, eta: s.eta?.slice(0, 10) ?? d.eta });
          }
        }
        return { ...x, d, error: undefined };
      }),
    );
  }

  async function save(id: number) {
    const row = drafts.find((x) => x.id === id);
    if (!row) return;
    if (!row.d.vsl.trim()) return setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, error: "VSL을 입력해 주세요" } : x)));
    if (!row.d.importer.trim()) return setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, error: "수입자를 입력해 주세요" } : x)));
    setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, saving: true } : x)));
    try {
      await onCreate(row.d);
      setDrafts((ds) => ds.filter((x) => x.id !== id));
    } catch {
      setDrafts((ds) => ds.map((x) => (x.id === id ? { ...x, saving: false, error: "저장하지 못했어요" } : x)));
    }
  }

  const input = (id: number, d: SheetDraft, f: keyof SheetDraft, opts: { type?: string; upper?: boolean; mono?: boolean; center?: boolean; list?: string; placeholder?: string } = {}) => (
    <input
      type={opts.type ?? "text"}
      value={d[f] as string}
      list={opts.list}
      placeholder={opts.placeholder}
      onChange={(e) => patch(id, { [f]: opts.upper ? e.target.value.toUpperCase() : e.target.value } as Partial<SheetDraft>)}
      onKeyDown={(e) => e.key === "Enter" && save(id)}
      className={cn(INPUT, "bg-white", opts.mono && "font-mono text-[12.5px]", opts.center && "text-center", opts.type && "tabular-nums")}
    />
  );

  return (
    <>
      {drafts.map(({ id, d, saving, error }, i) => (
        <tr key={id} className="bg-[#fffdf5]">
          <td className={cn(CELL, "sticky left-0 z-[5] bg-[#fffdf5] text-center text-[12px] font-semibold text-[var(--accent)]")}>{number + i}</td>
          <td className={CELL}>{input(id, d, "importer", { placeholder: "수입자" })}</td>
          <td className={CELL}>{input(id, d, "exporter", { placeholder: "수출자" })}</td>
          <td className={CELL}>{input(id, d, "pol", { center: true, placeholder: "선적지" })}</td>
          <td className={CELL}>{input(id, d, "pod", { center: true, placeholder: "양하지" })}</td>
          <td className={CELL}>
            <select value={d.size} onChange={(e) => patch(id, { size: e.target.value as "20" | "40" })} aria-label="CNTR" className={cn(INPUT, "bg-white text-center font-semibold")}>
              <option value="20">20</option>
              <option value="40">40</option>
            </select>
          </td>
          <td className={CELL}>{input(id, d, "vsl", { upper: true, list: "sheet-vsl", placeholder: "예: SAWASDEE SIRIUS 2621E" })}</td>
          <td className={CELL}>{input(id, d, "containerNo", { upper: true, mono: true, placeholder: "CTNS NO" })}</td>
          <td className={CELL}>{input(id, d, "hbl", { upper: true, mono: true, center: true, placeholder: "HB/L" })}</td>
          <td className={CELL}>{input(id, d, "etd", { type: "date" })}</td>
          <td className={CELL}>{input(id, d, "eta", { type: "date" })}</td>
          <td className={CELL}>{input(id, d, "freeTimeUntil", { type: "date" })}</td>
          <td className={CELL}>{input(id, d, "deliveryDate", { type: "date" })}</td>
          <td className={CELL}>{input(id, d, "deliveryTime", { type: "time" })}</td>
          <td className={cn(CELL, "text-center")}>
            <FlagCell on={d.surrendered} label="서렌더" onClick={() => patch(id, { surrendered: !d.surrendered })} />
          </td>
          <td className={cn(CELL, "text-center")}>
            <FlagCell on={d.settled} label="정산" onClick={() => patch(id, { settled: !d.settled })} />
          </td>
          <td className={CELL}>
            {error ? <p className="px-2 text-[12px] font-medium text-[var(--danger)] truncate">{error}</p> : input(id, d, "memo", { placeholder: "비고" })}
          </td>
          <td className={cn(CELL, "text-center")}>
            <span className="inline-flex gap-0.5">
              <button
                type="button"
                onClick={() => save(id)}
                disabled={saving}
                aria-label={`${number + i}행 저장`}
                title="저장 (Enter)"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} strokeWidth={3} />}
              </button>
              <button
                type="button"
                onClick={() => setDrafts((ds) => ds.filter((x) => x.id !== id))}
                aria-label={`${number + i}행 취소`}
                title="취소"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--sidebar-bg)]"
              >
                <X size={13} />
              </button>
            </span>
          </td>
        </tr>
      ))}
      <tr>
        <td colSpan={COLS.length} className="p-0">
          <datalist id="sheet-vsl">
            {active.map((v) => (
              <option key={v.id} value={vesselLabel(v)} />
            ))}
          </datalist>
          <button
            type="button"
            onClick={add}
            className="sticky left-0 inline-flex items-center gap-1.5 h-10 px-4 text-[13px] font-medium text-[var(--accent)] hover:bg-[var(--accent-soft)]/50"
          >
            <Plus size={14} /> 행 추가
            <span className="font-normal text-[var(--muted)]">· 바로 위 행의 선박·HB/L·수입자를 이어받아요</span>
          </button>
        </td>
      </tr>
    </>
  );
}
