"use client";

import { cn } from "@/lib/cn";
import { dDay, freeTimeStatus, STAGE_META, vesselLabel, voyageSummary, type ContainerStage, type SheetSort } from "@/lib/containers";
import { formatSheetDate, formatSheetTime } from "@/lib/sheet-format";
import type { ContainerShipment, VesselWatch } from "@/lib/types";
import { Check, Maximize2, Table2 } from "lucide-react";

export interface SheetRow {
  c: ContainerShipment;
  stage: ContainerStage;
  /** NO - the row's place in entry order (same as in the editor). */
  no: number;
}

/** "SAWASDEE SIRIUS 2621E" -> name + 항차 (last token with a digit). */
export function splitVsl(full: string): { vesselName: string; voyage: string } {
  const parts = full.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /\d/.test(parts[parts.length - 1])) {
    return { vesselName: parts.slice(0, -1).join(" "), voyage: parts[parts.length - 1] };
  }
  return { vesselName: parts.join(" "), voyage: "" };
}

const COLS: { label: string; w: number; vessel?: boolean; hbl?: boolean; center?: boolean }[] = [
  { label: "NO", w: 48, center: true },
  { label: "수입자", w: 140 },
  { label: "수출자", w: 180 },
  { label: "선적지", w: 70, vessel: true, center: true },
  { label: "양하지", w: 70, vessel: true, center: true },
  { label: "CNTR", w: 56, center: true },
  { label: "VSL", w: 200, vessel: true },
  { label: "CTNS NO", w: 120 },
  { label: "HB/L", w: 128, center: true },
  { label: "출항일", w: 104, vessel: true },
  { label: "입항일", w: 104, vessel: true },
  { label: "프리타임", w: 120 },
  { label: "운송일", w: 96 },
  { label: "운송시간", w: 76, center: true },
  { label: "서렌더", w: 76, hbl: true, center: true },
  { label: "정산", w: 76, hbl: true, center: true },
  { label: "비고", w: 160 },
];

const CELL = "border-r border-b border-[#e5e7eb] px-2 h-9 align-middle whitespace-nowrap overflow-hidden text-ellipsis";

/** 시트 tab: a read-only preview in the team's sheet layout (ship and HB/L
 * cells merged like the original). Clicking anywhere opens the full-screen
 * editor (SheetEditor) on that row. */
export function ContainerSheet({
  rows,
  vessels,
  today,
  sort,
  onSortChange,
  onOpen,
}: {
  rows: SheetRow[];
  vessels: VesselWatch[];
  today: string;
  sort: SheetSort;
  onSortChange: (sort: SheetSort) => void;
  onOpen: (containerId?: string) => void;
}) {
  const byId = new Map(vessels.map((v) => [v.id, v]));
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
      <div className="flex items-center gap-3 px-4 sm:px-5 py-3 border-b border-[var(--border-subtle)]">
        <span className="w-8 h-8 rounded-[10px] bg-[#107c41] text-white flex items-center justify-center shrink-0">
          <Table2 size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-[var(--foreground)]">선복 진행 예정 일정</p>
          <p className="text-[12px] text-[var(--muted)] truncate">엑셀처럼 복사·붙여넣기, 방향키 이동, 바로 입력이 돼요</p>
        </div>
        <SortToggle value={sort} onChange={onSortChange} className="ml-auto" />
        <button
          type="button"
          onClick={() => onOpen()}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full bg-[var(--foreground)] text-white text-[13px] font-medium hover:bg-black shrink-0"
        >
          <Maximize2 size={14} /> <span className="max-sm:hidden">전체 화면으로 </span>편집
        </button>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-label="시트를 전체 화면으로 열기"
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
        className="group relative overflow-x-auto cursor-zoom-in focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-[var(--accent-soft)]"
      >
        <table className="table-fixed border-separate border-spacing-0 text-[12.5px]" style={{ width: COLS.reduce((s, c) => s + c.w, 0) }}>
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
                    "h-8 border-r border-b border-[#d9dde3] px-2 text-[11.5px] font-semibold text-[#3a3a3c] whitespace-nowrap",
                    c.vessel ? "bg-[#e8f0fe]" : c.hbl ? "bg-[#e6f4ea]" : "bg-[#f3e8fd]",
                    c.center ? "text-center" : "text-left",
                    i === 0 && "sticky left-0 z-10",
                  )}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={COLS.length} className="h-24 text-center text-[13px] text-[var(--muted)]">
                  아직 행이 없어요. <span className="text-[var(--accent)] font-medium">전체 화면으로 편집</span>을 눌러 엑셀에서 복사한 행을 붙여넣어 보세요.
                </td>
              </tr>
            )}
            {rows.map((r, i) => {
              const v = byId.get(r.c.vesselWatchId);
              const s = voyageSummary(v);
              const vSpan = span(i, sameVessel);
              const hSpan = r.c.hbl ? span(i, sameHbl) : 1;
              const ft = freeTimeStatus(r.c, today, s);
              return (
                <tr key={r.c.id} onClick={() => onOpen(r.c.id)} className="hover:[&>td]:bg-[#f8fafc]">
                  <td className={cn(CELL, "sticky left-0 z-[5] bg-white text-center text-[var(--muted)] tabular-nums")} title={STAGE_META[r.stage].label}>
                    <span className="inline-flex items-center gap-1">
                      <span className={cn("w-1.5 h-1.5 rounded-full", stageDot(r.stage))} />
                      {r.no}
                    </span>
                  </td>
                  <td className={CELL}>{r.c.importer}</td>
                  <td className={CELL}>{r.c.exporter}</td>
                  {vSpan > 0 && (
                    <>
                      <td rowSpan={vSpan} className={cn(CELL, "text-center bg-[#fbfcff]")}>{s.pol}</td>
                      <td rowSpan={vSpan} className={cn(CELL, "text-center bg-[#fbfcff]")}>{s.pod}</td>
                    </>
                  )}
                  <td className={cn(CELL, "text-center font-semibold")}>{r.c.size}</td>
                  {vSpan > 0 && <td rowSpan={vSpan} className={cn(CELL, "bg-[#fbfcff]")}>{v ? vesselLabel(v) : ""}</td>}
                  <td className={cn(CELL, "font-mono text-[12px]")}>{r.c.containerNo}</td>
                  {(hSpan > 0 || !r.c.hbl) && (
                    <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, "text-center font-mono text-[12px]")}>
                      {r.c.hbl}
                    </td>
                  )}
                  {vSpan > 0 && (
                    <>
                      <td rowSpan={vSpan} className={cn(CELL, "bg-[#fbfcff] tabular-nums")}>
                        <DateText date={s.etd} delay={s.etdDelay} confirmed={Boolean(s.departed)} />
                      </td>
                      <td rowSpan={vSpan} className={cn(CELL, "bg-[#fbfcff] tabular-nums")}>
                        <DateText date={s.eta} delay={s.etaDelay} confirmed={Boolean(s.arrived)} />
                      </td>
                    </>
                  )}
                  <td className={cn(CELL, "tabular-nums")}>
                    {ft.date && (
                      <span className="flex items-center justify-between gap-1" title={ft.auto ? "입항일 + 10일 자동 계산" : undefined}>
                        <span className={ft.auto ? "text-[var(--muted)]" : undefined}>{formatSheetDate(ft.date)}</span>
                        {ft.state === "safe" ? (
                          <Check size={11} strokeWidth={3} className="text-[var(--success)]" />
                        ) : (
                          ft.days !== null && (
                            <span
                              className={cn(
                                "rounded px-1 text-[10px] font-bold",
                                ft.state === "ok" ? "text-[var(--muted)] font-medium" : ft.state === "soon" ? "bg-amber-50 text-[var(--warning)]" : "bg-red-50 text-[var(--danger)]",
                              )}
                            >
                              {dDay(ft.days)}
                            </span>
                          )
                        )}
                      </span>
                    )}
                  </td>
                  <td className={cn(CELL, "tabular-nums", r.stage === "needsTrucking" && "bg-red-50/70 text-[var(--danger)] font-medium")}>
                    {r.c.deliveryDate ? formatSheetDate(r.c.deliveryDate) : r.stage === "needsTrucking" ? "배차 필요" : ""}
                  </td>
                  <td className={cn(CELL, "text-center tabular-nums")}>{r.c.deliveryTime ? formatSheetTime(r.c.deliveryTime) : ""}</td>
                  {(hSpan > 0 || !r.c.hbl) && (
                    <>
                      <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, "text-center")}>
                        <Flag on={r.c.surrendered} />
                      </td>
                      <td rowSpan={r.c.hbl ? hSpan : 1} className={cn(CELL, "text-center")}>
                        <Flag on={r.c.settled} />
                      </td>
                    </>
                  )}
                  <td className={cn(CELL, "text-[var(--muted)]")}>{r.c.memo}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <span className="pointer-events-none absolute right-3 top-11 inline-flex items-center gap-1.5 rounded-full bg-[var(--foreground)]/85 px-2.5 py-1 text-[11.5px] font-medium text-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 size={12} /> 클릭하면 크게 열려요
        </span>
      </div>
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

function DateText({ date, delay, confirmed }: { date?: string; delay: number | null; confirmed: boolean }) {
  if (!date) return null;
  return (
    <span className="flex items-center justify-between gap-1">
      {formatSheetDate(date.slice(0, 10))}
      <span className="flex items-center gap-0.5">
        {confirmed && <Check size={11} strokeWidth={3} className="text-[var(--success)]" />}
        {delay ? (
          <span className={cn("rounded px-1 text-[10px] font-bold", delay > 0 ? "bg-red-50 text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>
            {delay > 0 ? `+${delay}` : delay}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function Flag({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[11px] font-semibold text-[var(--success)]">
      <Check size={10} strokeWidth={3} /> 완료
    </span>
  ) : (
    <span className="text-[11px] text-[#c7c7cc]">미완료</span>
  );
}

/** 입항일순 / 입력순 - shared by the preview and the full-screen editor. */
export function SortToggle({ value, onChange, className }: { value: SheetSort; onChange: (sort: SheetSort) => void; className?: string }) {
  return (
    <div role="radiogroup" aria-label="시트 정렬" className={cn("inline-flex shrink-0 p-0.5 rounded-full bg-[var(--sidebar-bg)] text-[12.5px] font-medium", className)}>
      {(
        [
          ["eta", "입항일순"],
          ["entry", "입력순"],
        ] as const
      ).map(([v, label]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "px-2.5 sm:px-3 h-8 rounded-full whitespace-nowrap transition-colors",
            value === v ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
