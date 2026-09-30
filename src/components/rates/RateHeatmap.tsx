"use client";

import type { RateOverviewRow } from "@/lib/rate-overview";
import type { ContainerType } from "@/lib/types";
import { useState } from "react";
import { createPortal } from "react-dom";

const DESTINATION_ORDER = ["incheon", "busan", "pyeongtaek"] as const;

// Column widths as percentages of the table (sums to 100) - table-fixed
// makes these exact regardless of content, so all six rate columns stay
// identical width instead of the browser's auto layout redistributing
// space unevenly between them (same fix as RegionRatesEditor.tsx). The
// port column only needs to be a touch narrower than a rate column (its
// two-line "청도 / Qingdao" content is no wider than a rate cell's own
// two-line "₩990,577 / 해상 $250") - not the 2x-wider split that table
// used, which made 항구 read as oversized relative to the rest.
const portColPct = 13;
const rateColPct = 14.5; // x6 destination/size columns = 87

// Sequential blue ramp (dataviz skill's reference palette, steps 150-650) -
// bucket 3 (#2a78d6) sits almost exactly on this app's own --accent, so it
// reads as cohesive rather than a foreign palette dropped in. Ink switches
// dark->white partway up the ramp so text always clears contrast on its
// own cell's fill.
const RAMP_STEPS: { bg: string; ink: "dark" | "light" }[] = [
  { bg: "#b7d3f6", ink: "dark" },
  { bg: "#6da7ec", ink: "dark" },
  { bg: "#2a78d6", ink: "light" },
  { bg: "#1c5cab", ink: "light" },
  { bg: "#104281", ink: "light" },
];

function krw(n: number): string {
  return `₩${Math.round(n).toLocaleString("en-US")}`;
}

function bucketFor(value: number, min: number, max: number) {
  if (max === min) return RAMP_STEPS[2];
  const t = (value - min) / (max - min);
  const idx = Math.min(RAMP_STEPS.length - 1, Math.floor(t * RAMP_STEPS.length));
  return RAMP_STEPS[idx];
}

/** One region's origin-port x destination x container-type grid, colored
 * by 예상 총비용 (a sequential heatmap - see the dataviz skill's
 * choosing-a-form.md: "compare magnitude in a grid" maps to heatmap +
 * sequential color, not a bar chart). Read-only reference sheet, not a
 * live-editing surface - RateCell is intentionally not reused here. */
export function RateHeatmap({
  regionNameKo,
  rows,
  destinationPortNames,
  containerTypes,
}: {
  regionNameKo: string;
  rows: RateOverviewRow[];
  destinationPortNames: Record<string, string>;
  containerTypes: ContainerType[];
}) {
  // Flipping the tooltip's open direction per-row based on the region
  // table's own container (tried previously) reads as jumpy, and a short
  // 2-row table still had no direction that fully avoided the container's
  // own overflow-x-auto clipping either way. Render the tooltip through a
  // portal straight onto document.body, positioned with fixed coordinates
  // computed from the cell's own real position - this takes it completely
  // outside the table's clipping container, so it can never be cut off by
  // it regardless of which row is hovered. It always opens ABOVE the cell
  // (reads better than below) except in the one case that would otherwise
  // push it off the very top of the visible browser window - unlike being
  // clipped by the table's own container, that's not something scrolling
  // could ever reveal, so it's the one case still worth checking for.
  interface TooltipState {
    cellKey: string;
    x: number;
    verticalAnchor: "top" | "bottom";
    verticalValue: number;
    portNameKo: string;
    destLabel: string;
    ctLabel: string;
    oceanFreightSubtotalKrw: number;
    localSubtotalKrw: number;
    grandTotalKrw: number;
  }
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const TOOLTIP_HALF_WIDTH = 104; // half of w-52 (208px)
  const TOOLTIP_HEIGHT_ESTIMATE = 130;
  const VIEWPORT_MARGIN = 8;
  function activateCell(
    target: HTMLElement,
    data: Omit<TooltipState, "x" | "verticalAnchor" | "verticalValue">,
  ) {
    const rect = target.getBoundingClientRect();
    // Center under the cell by default, but slide inward on a narrow
    // viewport so it never runs off the left/right edge of the screen -
    // it's fine to spill outside the table's own box, not off-screen.
    const idealX = rect.left + rect.width / 2;
    const x = Math.min(
      Math.max(idealX, TOOLTIP_HALF_WIDTH + VIEWPORT_MARGIN),
      window.innerWidth - TOOLTIP_HALF_WIDTH - VIEWPORT_MARGIN,
    );
    const hasRoomAbove = rect.top >= TOOLTIP_HEIGHT_ESTIMATE + VIEWPORT_MARGIN;
    const vertical = hasRoomAbove
      ? { verticalAnchor: "bottom" as const, verticalValue: window.innerHeight - rect.top + 8 }
      : { verticalAnchor: "top" as const, verticalValue: rect.bottom + 8 };
    setTooltip({ ...data, x, ...vertical });
  }
  function deactivate() {
    setTooltip(null);
  }

  const totals = rows
    .flatMap((r) => r.cells)
    .map((c) => c.grandTotalKrw)
    .filter((v): v is number => v != null);
  const min = totals.length ? Math.min(...totals) : 0;
  const max = totals.length ? Math.max(...totals) : 0;

  return (
    <div className="mb-10">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h2 className="text-[15px] font-semibold text-[var(--foreground)]">{regionNameKo}</h2>
        {totals.length > 0 && (
          <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
            <span>낮음</span>
            <div className="flex h-2.5 w-24 rounded-full overflow-hidden">
              {RAMP_STEPS.map((s) => (
                <span key={s.bg} className="flex-1" style={{ backgroundColor: s.bg }} />
              ))}
            </div>
            <span>높음</span>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--border-subtle)]">
        <table className="w-full table-fixed min-w-[720px] border-collapse text-[13px]">
          <colgroup>
            <col style={{ width: `${portColPct}%` }} />
            {DESTINATION_ORDER.flatMap((destId) =>
              containerTypes.map((ct) => <col key={`${destId}-${ct.id}`} style={{ width: `${rateColPct}%` }} />),
            )}
          </colgroup>
          <thead>
            <tr className="text-[12px] text-[var(--muted)] uppercase tracking-wide bg-[var(--sidebar-bg)]">
              <th className="text-left py-2.5 px-3 font-medium whitespace-nowrap">항구</th>
              {DESTINATION_ORDER.flatMap((destId) =>
                containerTypes.map((ct, i) => (
                  <th
                    key={`${destId}-${ct.id}`}
                    className={`py-2.5 px-3 font-medium text-center whitespace-nowrap ${
                      i === 0 ? "border-l border-[var(--border-subtle)]" : ""
                    }`}
                  >
                    {destinationPortNames[destId]} {ct.label}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.port.id} className="border-t border-[var(--border-subtle)]">
                <td className="py-2.5 px-3 align-top whitespace-nowrap">
                  <p className="font-medium text-[var(--foreground)]">{row.port.nameKo}</p>
                  <p className="text-[11px] text-[var(--muted)]">{row.port.name}</p>
                </td>
                {row.cells.map((cell, i) => {
                  const cellKey = `${row.port.id}-${cell.destinationPortId}-${cell.containerTypeId}`;
                  const isFirstOfGroup = i % containerTypes.length === 0;
                  const ctLabel = containerTypes.find((c) => c.id === cell.containerTypeId)?.label ?? "";
                  const destLabel = destinationPortNames[cell.destinationPortId] ?? cell.destinationPortId;

                  if (cell.grandTotalKrw == null) {
                    return (
                      <td
                        key={cellKey}
                        className={`py-2.5 px-3 text-center text-[12px] text-[var(--warning)] bg-[var(--sidebar-bg)]/40 whitespace-nowrap ${
                          isFirstOfGroup ? "border-l border-[var(--border-subtle)]" : ""
                        }`}
                      >
                        미등록
                      </td>
                    );
                  }

                  const bucket = bucketFor(cell.grandTotalKrw, min, max);
                  const isLight = bucket.ink === "light";
                  const active = tooltip?.cellKey === cellKey;
                  const tooltipLabel = `${row.port.nameKo} → ${destLabel} · ${ctLabel}. 해상운임 ${krw(
                    cell.oceanFreightSubtotalKrw ?? 0,
                  )}, 부대비용 계 ${krw(cell.localSubtotalKrw ?? 0)}, 예상 총비용 ${krw(cell.grandTotalKrw)}. 실제 견적은 상이할 수 있습니다.`;
                  const tooltipData = {
                    cellKey,
                    portNameKo: row.port.nameKo,
                    destLabel,
                    ctLabel,
                    oceanFreightSubtotalKrw: cell.oceanFreightSubtotalKrw ?? 0,
                    localSubtotalKrw: cell.localSubtotalKrw ?? 0,
                    grandTotalKrw: cell.grandTotalKrw,
                  };

                  return (
                    <td
                      key={cellKey}
                      tabIndex={0}
                      aria-label={tooltipLabel}
                      onMouseEnter={(e) => activateCell(e.currentTarget, tooltipData)}
                      onMouseLeave={deactivate}
                      onFocus={(e) => activateCell(e.currentTarget, tooltipData)}
                      onBlur={deactivate}
                      className={`relative py-2.5 px-3 text-center cursor-default outline-none whitespace-nowrap transition-shadow duration-150 ${
                        isFirstOfGroup ? "border-l border-[var(--border-subtle)]" : ""
                      } ${active ? "z-10 shadow-lg ring-2 ring-inset ring-white/60" : ""}`}
                      style={{ backgroundColor: bucket.bg, color: isLight ? "#ffffff" : "var(--foreground)" }}
                    >
                      <p className="font-semibold">{krw(cell.grandTotalKrw)}</p>
                      {cell.oceanFreightUsd != null && (
                        <p
                          className="text-[10.5px] mt-0.5"
                          style={{ color: isLight ? "rgba(255,255,255,0.8)" : "var(--muted)" }}
                        >
                          해상 ${cell.oceanFreightUsd.toLocaleString("en-US")}
                        </p>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tooltip &&
        createPortal(
          <div
            aria-hidden
            className="pointer-events-none fixed z-50 w-52 -translate-x-1/2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3 text-left shadow-lg animate-dropdown-panel"
            style={{
              left: tooltip.x,
              [tooltip.verticalAnchor]: tooltip.verticalValue,
            }}
          >
            <p className="text-[11.5px] font-semibold text-[var(--foreground)] mb-1.5 whitespace-normal">
              {tooltip.portNameKo} → {tooltip.destLabel} · {tooltip.ctLabel}
            </p>
            <div className="space-y-1 text-[11px] text-[var(--muted)]">
              <div className="flex justify-between gap-3">
                <span>해상운임</span>
                <span>{krw(tooltip.oceanFreightSubtotalKrw)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span>부대비용 계</span>
                <span>{krw(tooltip.localSubtotalKrw)}</span>
              </div>
              <div className="flex justify-between gap-3 font-semibold text-[var(--foreground)] pt-1 mt-1 border-t border-[var(--border-subtle)]">
                <span>예상 총비용</span>
                <span>{krw(tooltip.grandTotalKrw)}</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
