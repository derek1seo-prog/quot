"use client";

import { cn } from "@/lib/cn";
import { useDismissable } from "@/lib/hooks";
import type { CarrierEntry, PortCarrierNote } from "@/lib/types";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
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

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** "2026-10-01" -> "26.10.01", the shorthand used in carrier notes. */
export function formatCarrierDate(iso?: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${y.slice(2)}.${m}.${d}`;
}

/** Best-effort parse of legacy free-text notes written as
 * "인천/부산 : KMTC NET (26.10.01) - 별도", one carrier per line. Lines
 * that don't fit stay as free text. */
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
  const m = body.match(/^(.*?)(?:\s+(NET))?\s*(?:\((\d{2})\.(\d{1,2})\.(\d{1,2})\))?\s*(?:-\s*(.*))?$/i);
  if (!m || !m[1].trim()) return null;
  const date = m[3] ? `20${m[3]}-${m[4].padStart(2, "0")}-${m[5].padStart(2, "0")}` : undefined;
  return {
    id: newId(),
    destinationPortIds: destIds,
    carrier: m[1].trim(),
    net: Boolean(m[2]),
    date,
    remark: m[6]?.trim() || undefined,
  };
}

/** Structured editor for a port's 주요 선사: one row per carrier with
 * destination chips, carrier (autocompleted), NET, 기준일, and 비고, plus a
 * free-text memo for anything else. Autosaves shortly after each change. */
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
  // Notes saved before `entries` existed are parsed once into rows here.
  const initial = useMemo(() => {
    if (note?.entries) return { entries: note.entries, rest: note.notes ?? "" };
    return parseLegacyNotes(note?.notes ?? "", destinations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [entries, setEntries] = useState<CarrierEntry[]>(initial.entries);
  const [memo, setMemo] = useState(initial.rest);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const dirty = useRef(false);
  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  });

  useEffect(() => {
    if (!dirty.current) return;
    const timer = setTimeout(async () => {
      setState("saving");
      try {
        // Rows left without a carrier are drafts - don't persist them yet.
        await onSaveRef.current(memo, entries.filter((e) => e.carrier.trim()));
        setState("saved");
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1200);
      } catch {
        setState("error");
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [entries, memo]);

  function update(id: string, patch: Partial<CarrierEntry>) {
    dirty.current = true;
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  function addEntry() {
    dirty.current = true;
    // Default to destinations no row covers yet, so the next line is usually ready to type.
    const used = new Set(entries.flatMap((e) => e.destinationPortIds));
    const free = destinations.filter((d) => !used.has(d.portId)).map((d) => d.portId);
    setEntries((prev) => [
      ...prev,
      {
        id: newId(),
        destinationPortIds: free.length ? [free[0]] : [],
        carrier: "",
        net: true,
        date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date()),
      },
    ]);
  }

  function remove(id: string) {
    dirty.current = true;
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  const carrierSuggestions = useMemo(
    () => [...new Set([...knownCarriers, ...COMMON_CARRIERS])],
    [knownCarriers],
  );
  const remarkSuggestions = useMemo(() => [...new Set([...COMMON_REMARKS, ...knownRemarks])], [knownRemarks]);

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white px-3 py-2.5"
            >
              <div className="flex items-center gap-1" role="group" aria-label="도착항">
                {destinations.map((d) => {
                  const on = entry.destinationPortIds.includes(d.portId);
                  return (
                    <button
                      key={d.portId}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        update(entry.id, {
                          destinationPortIds: on
                            ? entry.destinationPortIds.filter((x) => x !== d.portId)
                            : destinations.map((x) => x.portId).filter((x) => x === d.portId || entry.destinationPortIds.includes(x)),
                        })
                      }
                      className={cn(
                        "h-7 px-2.5 rounded-full text-[12px] font-medium border transition-colors",
                        on
                          ? "bg-[var(--accent)] border-[var(--accent)] text-white"
                          : "bg-white border-[var(--border)] text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]",
                      )}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>

              <SuggestInput
                value={entry.carrier}
                onChange={(v) => update(entry.id, { carrier: v.toUpperCase() })}
                suggestions={carrierSuggestions}
                placeholder="선사"
                ariaLabel="선사"
                className="w-[150px] font-semibold tracking-wide"
                autoFocus={!entry.carrier}
              />

              <button
                type="button"
                aria-pressed={entry.net}
                onClick={() => update(entry.id, { net: !entry.net })}
                className={cn(
                  "h-7 px-2 rounded-[var(--radius-sm)] text-[11px] font-bold tracking-wide border transition-colors",
                  entry.net
                    ? "bg-[var(--accent-soft)] border-[var(--accent)]/30 text-[var(--accent)]"
                    : "bg-white border-[var(--border)] text-[var(--muted)] line-through decoration-1",
                )}
                title="NET 운임 여부"
              >
                NET
              </button>

              <input
                type="date"
                value={entry.date ?? ""}
                onChange={(e) => update(entry.id, { date: e.target.value || undefined })}
                aria-label="기준일"
                className="h-8 px-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-white text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />

              <SuggestInput
                value={entry.remark ?? ""}
                onChange={(v) => update(entry.id, { remark: v || undefined })}
                suggestions={remarkSuggestions}
                placeholder="비고 (예: ALL IN)"
                ariaLabel="비고"
                className="flex-1 min-w-[140px]"
              />

              <button
                type="button"
                onClick={() => remove(entry.id)}
                aria-label="선사 삭제"
                className="ml-auto w-7 h-7 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--muted)] hover:text-[var(--danger)] hover:bg-red-50 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={addEntry}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] text-[12.5px] font-medium text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent-soft)] transition-colors"
        >
          <Plus size={14} />
          선사 추가
        </button>
        <span className="text-[11.5px] text-[var(--muted)] h-4 flex items-center gap-1">
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
          {state === "error" && <span className="text-[var(--danger)]">저장 실패 - 다시 수정해 주세요</span>}
        </span>
      </div>

      <textarea
        value={memo}
        onChange={(e) => {
          dirty.current = true;
          setMemo(e.target.value);
        }}
        placeholder="기타 메모 (선택)"
        rows={memo ? 2 : 1}
        className="w-full px-3 py-2 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-white text-[13px] text-[var(--foreground)] outline-none resize-y placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
      />
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
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  placeholder: string;
  ariaLabel: string;
  className?: string;
  autoFocus?: boolean;
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
        autoFocus={autoFocus}
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
