"use client";

import { cn } from "@/lib/cn";
import { useDismissable } from "@/lib/hooks";
import type { CarrierEntry, PortCarrierNote } from "@/lib/types";
import { Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface DestinationOption {
  portId: string;
  label: string;
}

/** Carriers suggested even before any have been typed in this app. */
const COMMON_CARRIERS = [
  "SITC",
  "KMTC",
  "SINOKOR",
  "PANOCEAN",
  "HMM",
  "CK LINE",
  "NAMSUNG",
  "DONGJIN",
  "HEUNG-A",
  "COSCO",
  "EAS",
];
const COMMON_REMARKS = ["ALL IN", "별도", "운임 미정"];

interface Row {
  carrier: string;
  date?: string;
  remark?: string;
}

/** Rates are tracked as NET, so a "NET" written into the carrier is noise. */
function cleanCarrier(raw: string): string {
  return raw.replace(/\bNET\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

/** Best-effort parse of legacy free-text notes written like
 * "인천/부산 : KMTC NET (26.10.01) - 별도" or "... (26.10.01) [별도]", one
 * line each. Lines that don't fit stay as free text. */
export function parseLegacyNotes(
  text: string,
  destinations: DestinationOption[],
): { entries: CarrierEntry[]; rest: string } {
  const entries: CarrierEntry[] = [];
  const rest: string[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const m = line.match(/^\s*([^:]+?)\s*:\s*(.+?)\s*$/);
    const parsed = m && parseLine(m[1], m[2], destinations);
    if (parsed) entries.push(parsed);
    else rest.push(line);
  }
  return { entries, rest: rest.join("\n") };
}

function parseLine(destPart: string, body: string, destinations: DestinationOption[]): CarrierEntry | null {
  const destIds: string[] = [];
  for (const raw of destPart.split(/[/,·]/)) {
    const name = raw.trim();
    const dest = destinations.find((d) => name && (d.label.startsWith(name) || name.startsWith(d.label)));
    if (!dest) return null;
    destIds.push(dest.portId);
  }
  // carrier, then optional (yy.mm.dd), then anything left is the remark.
  const dateMatch = body.match(/\((\d{2})\.(\d{1,2})\.(\d{1,2})\)/);
  const before = dateMatch ? body.slice(0, dateMatch.index) : body;
  const after = dateMatch ? body.slice((dateMatch.index ?? 0) + dateMatch[0].length) : "";
  let carrier = before;
  let remark = after;
  if (!dateMatch) {
    const dash = before.indexOf(" - ");
    if (dash >= 0) {
      carrier = before.slice(0, dash);
      remark = before.slice(dash + 3);
    }
  }
  carrier = cleanCarrier(carrier);
  remark = remark.replace(/^[\s\-–:[\]()]+|[\s\]\)]+$/g, "").trim();
  if (!carrier && !remark) return null;
  return {
    id: destIds.join("-"),
    destinationPortIds: destIds,
    carrier,
    date: dateMatch
      ? `20${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : undefined,
    remark: remark || undefined,
  };
}

/** One row per destination, taken from saved entries (or legacy text).
 * An older entry covering several destinations fills each of them. */
function rowsFromNote(note: PortCarrierNote | undefined, destinations: DestinationOption[]) {
  const parsed = note?.entries ? null : parseLegacyNotes(note?.notes ?? "", destinations);
  const source = note?.entries ?? parsed?.entries ?? [];
  const rows: Record<string, Row> = {};
  for (const d of destinations) {
    const e = source.find((x) => x.destinationPortIds.includes(d.portId));
    rows[d.portId] = e
      ? { carrier: cleanCarrier(e.carrier), date: e.date, remark: e.remark }
      : { carrier: "" };
  }
  return { rows, memo: note?.entries ? (note.notes ?? "") : (parsed?.rest ?? "") };
}

/** Editor for a port's 주요 선사: a fixed row per destination (인천 / 부산 /
 * 평택), each with its own carrier (autocompleted), 기준일, and 비고, plus a
 * free-text memo. Autosaves shortly after each change. */
export function CarrierNotesEditor({
  note,
  destinations,
  knownCarriers,
  knownRemarks,
  onSave,
}: {
  note?: PortCarrierNote;
  destinations: DestinationOption[];
  knownCarriers: string[];
  knownRemarks: string[];
  onSave: (notes: string, entries: CarrierEntry[]) => Promise<void>;
}) {
  const initial = useMemo(
    () => rowsFromNote(note, destinations),
    // Only on mount - afterwards local state is the source of truth.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [rows, setRows] = useState<Record<string, Row>>(initial.rows);
  const [memo, setMemo] = useState(initial.memo);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const onSaveRef = useRef(onSave);
  // The parent rebuilds `destinations` on every render (including the one a
  // save itself triggers), so it must not be an effect dependency - doing so
  // re-ran the save in an endless "저장 중 / 저장됨" loop.
  const destinationsRef = useRef(destinations);
  const lastSaved = useRef<string | null>(null);
  useEffect(() => {
    onSaveRef.current = onSave;
    destinationsRef.current = destinations;
  });

  useEffect(() => {
    if (!dirty.current) return;
    const entries: CarrierEntry[] = destinationsRef.current
      .map((d) => ({ d, r: rows[d.portId] }))
      .filter(({ r }) => r && (r.carrier.trim() || r.remark?.trim()))
      .map(({ d, r }) => ({
        id: d.portId,
        destinationPortIds: [d.portId],
        carrier: r.carrier.trim(),
        date: r.date,
        remark: r.remark?.trim() || undefined,
      }));
    const payload = JSON.stringify({ memo, entries });
    // Nothing actually changed since the last save (e.g. typed and erased).
    if (payload === lastSaved.current) return;
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        await onSaveRef.current(memo, entries);
        lastSaved.current = payload;
        setState("saved");
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1200);
      } catch {
        setState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [rows, memo]);

  function update(portId: string, patch: Partial<Row>) {
    dirty.current = true;
    setRows((prev) => {
      const cur = prev[portId] ?? { carrier: "" };
      const next = { ...cur, ...patch };
      // Typing a carrier into an empty row stamps today's date as 기준일.
      if (patch.carrier && !cur.carrier && !cur.date) next.date = kstToday();
      return { ...prev, [portId]: next };
    });
  }

  function clearRow(portId: string) {
    dirty.current = true;
    setRows((prev) => ({ ...prev, [portId]: { carrier: "" } }));
  }

  const carrierSuggestions = useMemo(
    () => [...new Set([...knownCarriers.map(cleanCarrier).filter(Boolean), ...COMMON_CARRIERS])],
    [knownCarriers],
  );
  const remarkSuggestions = useMemo(() => [...new Set([...COMMON_REMARKS, ...knownRemarks])], [knownRemarks]);

  return (
    <div className="space-y-2">
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white divide-y divide-[var(--border-subtle)]">
        {destinations.map((d) => {
          const r = rows[d.portId] ?? { carrier: "" };
          const filled = Boolean(r.carrier || r.date || r.remark);
          return (
            <div key={d.portId} className="group flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <span
                className={cn(
                  "shrink-0 w-12 text-[12.5px] font-semibold",
                  r.carrier ? "text-[var(--accent)]" : "text-[var(--muted)]",
                )}
              >
                {d.label}
              </span>
              <SuggestInput
                value={r.carrier}
                onChange={(v) => update(d.portId, { carrier: v.toUpperCase() })}
                suggestions={carrierSuggestions}
                placeholder="선사"
                ariaLabel={`${d.label} 선사`}
                className="w-[150px] font-semibold tracking-wide"
              />
              <input
                type="date"
                value={r.date ?? ""}
                onChange={(e) => update(d.portId, { date: e.target.value || undefined })}
                aria-label={`${d.label} 기준일`}
                className={cn(
                  "h-8 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[13px] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]",
                  r.date ? "text-[var(--foreground)]" : "text-[var(--muted)]",
                )}
              />
              <SuggestInput
                value={r.remark ?? ""}
                onChange={(v) => update(d.portId, { remark: v || undefined })}
                suggestions={remarkSuggestions}
                placeholder="비고 (예: ALL IN)"
                ariaLabel={`${d.label} 비고`}
                className="flex-1 min-w-[120px]"
              />
              <button
                type="button"
                onClick={() => clearRow(d.portId)}
                aria-label={`${d.label} 선사 지우기`}
                className={cn(
                  "shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 transition-opacity",
                  filled ? "sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" : "invisible",
                )}
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-start gap-3">
        <textarea
          value={memo}
          onChange={(e) => {
            dirty.current = true;
            setMemo(e.target.value);
          }}
          placeholder="기타 메모 (선택)"
          rows={memo ? 2 : 1}
          className="flex-1 px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white text-[13px] text-[var(--foreground)] outline-none resize-y placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
        />
        <span className="shrink-0 w-16 pt-2 text-[11.5px] text-[var(--muted)] flex items-center justify-end gap-1">
          {state === "saving" && (
            <>
              <Loader2 size={12} className="animate-spin" /> 저장 중
            </>
          )}
          {state === "saved" && (
            <>
              <Check size={12} className="text-[var(--success)]" /> 저장됨
            </>
          )}
          {state === "error" && <span className="text-[var(--danger)]">저장 실패</span>}
        </span>
      </div>
    </div>
  );
}

/** Text input with a small suggestion popover (prefix/contains match). */
function SuggestInput({
  value,
  onChange,
  suggestions,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  useDismissable(wrapperRef, open, () => setOpen(false));

  const q = value.trim().toLowerCase();
  const filtered = suggestions
    .filter((s) => s.toLowerCase() !== q && (!q || s.toLowerCase().includes(q)))
    .sort((a, b) => Number(!a.toLowerCase().startsWith(q)) - Number(!b.toLowerCase().startsWith(q)))
    .slice(0, 8);
  const show = open && filtered.length > 0;
  const hi = Math.min(highlighted, filtered.length - 1);

  function pick(s: string) {
    onChange(s);
    setOpen(false);
  }

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlighted(0);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlighted(Math.min(hi + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlighted(Math.max(hi - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(filtered[hi]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        className="w-full h-8 px-2.5 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[13px] text-[var(--foreground)] outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
      />
      {show && (
        <div
          className="absolute z-20 top-full mt-1 left-0 min-w-full w-max max-w-[240px] max-h-56 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white shadow-lg py-1 animate-dropdown-panel"
          style={{ transformOrigin: "top" }}
        >
          {filtered.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => pick(s)}
              className={cn(
                "w-full text-left px-3 py-1.5 text-[13px] font-normal tracking-normal text-[var(--foreground)]",
                i === hi && "bg-[var(--sidebar-bg)]",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
