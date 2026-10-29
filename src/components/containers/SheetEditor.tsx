"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  containerStage,
  dDay,
  freeTimeStatus,
  STAGE_META,
  vesselLabel,
  voyageSummary,
  type ContainerStage,
  type VoyageSummary,
} from "@/lib/containers";
import { matchesSearch } from "@/lib/hangul";
import {
  emptyValues,
  formatCell,
  formatSheetDate,
  parseCell,
  parseTsv,
  SHEET_COLS,
  toTsv,
  type SheetCol,
  type SheetKey,
  type SheetValues,
} from "@/lib/sheet-format";
import type { ContainerShipment, VesselWatch } from "@/lib/types";
import { CalendarDays, Check, CircleHelp, Keyboard, Loader2, Search, Table2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { splitVsl } from "./ContainerSheet";

/** What the editor needs from the board to persist changes. */
export interface SheetOps {
  updateContainers: (updates: { id: string; patch: Record<string, unknown> }[]) => Promise<void>;
  updateVessel: (v: VesselWatch, patch: { pol?: string; pod?: string; etd?: string; eta?: string }) => Promise<VesselWatch | null>;
  createVessel: (spec: { vesselName: string; voyage: string; pol: string; pod: string; etd?: string; eta?: string }) => Promise<VesselWatch | null>;
  createContainers: (vesselWatchId: string, rows: Record<string, unknown>[]) => Promise<ContainerShipment[]>;
  deleteContainers: (ids: string[]) => Promise<void>;
}

type SavedRow = { kind: "saved"; key: string; c: ContainerShipment; values: SheetValues; stage: ContainerStage; voyage: VoyageSummary };
type DraftRow = { kind: "draft"; key: string; values: SheetValues; saving?: boolean };
type BlankRow = { kind: "blank"; key: string };
type GridRow = SavedRow | DraftRow | BlankRow;

interface Draft {
  key: string;
  values: SheetValues;
  saving?: boolean;
}
interface CellChange {
  row: number;
  key: SheetKey;
  value: SheetValues[SheetKey];
}
interface UndoEntry {
  /** Saved-row cells to put back, by container id. */
  cells: { id: string; key: SheetKey; value: SheetValues[SheetKey] }[];
  /** Containers this change created (undo deletes them). */
  createdIds: string[];
  /** Draft rows as they were before (drafts are local). */
  drafts?: Draft[];
}

const BLANK_ROWS = 20;
const ROW_H = 34;
const VESSEL_KEYS: SheetKey[] = ["pol", "pod", "vsl", "etd", "eta"];

function valuesOf(c: ContainerShipment, v: VesselWatch | undefined, s: VoyageSummary): SheetValues {
  return {
    importer: c.importer,
    exporter: c.exporter,
    pol: s.pol ?? "",
    pod: s.pod ?? "",
    size: c.size,
    vsl: v ? vesselLabel(v) : "",
    containerNo: c.containerNo,
    hbl: c.hbl,
    etd: s.etd?.slice(0, 10) ?? "",
    eta: s.eta?.slice(0, 10) ?? "",
    freeTimeUntil: c.freeTimeUntil ?? "",
    deliveryDate: c.deliveryDate ?? "",
    deliveryTime: c.deliveryTime ?? "",
    surrendered: c.surrendered,
    settled: c.settled,
    memo: c.memo ?? "",
  };
}

const sameLabel = (a: string, b: string) => a.trim().replace(/\s+/g, " ").toUpperCase() === b.trim().replace(/\s+/g, " ").toUpperCase();

/** 컨테이너 시트 - a full-screen spreadsheet over 컨테이너 현황: select with
 * the mouse or keyboard, type to edit (IME-safe: the focused element is
 * always a real input over the active cell, like Google Sheets), copy /
 * paste ranges with Excel or Google Sheets, Delete to clear, ⌘Z to undo.
 * Rows typed or pasted into the blank rows at the bottom register new
 * containers once they have a VSL and a 수입자 or CTNS NO. */
export function SheetEditor({
  open,
  onClose,
  containers,
  vessels,
  today,
  ops,
  focusContainerId,
}: {
  open: boolean;
  onClose: () => void;
  containers: ContainerShipment[];
  vessels: VesselWatch[];
  today: string;
  ops: SheetOps;
  focusContainerId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [overrides, setOverrides] = useState<Map<string, SheetValues[SheetKey]>>(new Map());
  const [sel, setSel] = useState({ ar: 0, ac: 1, fr: 0, fc: 1 });
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(0);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [box, setBox] = useState<{ active: DOMRect; range: DOMRect } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const toastSeq = useRef(0);
  const draftSeq = useRef(0);
  const notify = useCallback((text: string, action?: ToastMessage["action"]) => setToast({ id: ++toastSeq.current, text, action }), []);

  // ---- rows ---------------------------------------------------------------

  const vesselById = useMemo(() => new Map(vessels.map((v) => [v.id, v])), [vessels]);
  const savedRows: SavedRow[] = useMemo(() => {
    const q = query.trim();
    return containers
      .map((c): SavedRow => {
        const v = vesselById.get(c.vesselWatchId);
        const s = voyageSummary(v);
        return { kind: "saved", key: c.id, c, values: valuesOf(c, v, s), stage: containerStage(c, s, today), voyage: s };
      })
      .filter(
        (r) =>
          !q ||
          matchesSearch(
            [r.values.importer, r.values.exporter, r.values.vsl, r.values.containerNo, r.values.hbl, r.values.memo, r.values.pol, r.values.pod].join(" "),
            q,
          ),
      );
  }, [containers, vesselById, today, query]);

  const rows: GridRow[] = useMemo(
    () => [
      ...savedRows,
      ...drafts.map((d): DraftRow => ({ kind: "draft", key: d.key, values: d.values, saving: d.saving })),
      ...Array.from({ length: BLANK_ROWS }, (_, i): BlankRow => ({ kind: "blank", key: `blank-${i}` })),
    ],
    [savedRows, drafts],
  );
  const lastCol = SHEET_COLS.length - 1;
  const lastRow = rows.length - 1;

  const cellValue = useCallback(
    (row: GridRow, key: SheetKey): SheetValues[SheetKey] | undefined => {
      if (row.kind === "blank") return undefined;
      const o = overrides.get(`${row.key}:${key}`);
      return o !== undefined ? o : row.values[key];
    },
    [overrides],
  );
  const rowValues = useCallback(
    (row: GridRow): SheetValues | null => {
      if (row.kind === "blank") return null;
      const v = { ...row.values };
      for (const k of Object.keys(v) as SheetKey[]) {
        const o = overrides.get(`${row.key}:${k}`);
        if (o !== undefined) (v as Record<string, unknown>)[k] = o;
      }
      return v;
    },
    [overrides],
  );

  // ---- open / close ---------------------------------------------------------

  const [openedFor, setOpenedFor] = useState<string | null>(null);
  const openKey = open ? `open:${focusContainerId ?? ""}` : null;
  if (openKey !== openedFor) {
    setOpenedFor(openKey);
    if (open) {
      const r = Math.max(0, containers.findIndex((c) => c.id === focusContainerId));
      setSel({ ar: r, ac: 1, fr: r, fc: 1 });
      setEditing(false);
      setQuery("");
      setShowHelp(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
    return () => {
      document.body.style.overflow = prev;
      cancelAnimationFrame(id);
    };
  }, [open]);

  useEffect(() => {
    const up = () => (dragging.current = false);
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  // ---- selection geometry (overlay input + range outline) -------------------

  const measure = useCallback(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const cell = (r: number, c: number) => scroller.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`);
    const a = cell(sel.fr, sel.fc);
    const r0 = cell(Math.min(sel.ar, sel.fr), Math.min(sel.ac, sel.fc));
    const r1 = cell(Math.max(sel.ar, sel.fr), Math.max(sel.ac, sel.fc));
    if (!a || !r0 || !r1) return setBox(null);
    const base = scroller.getBoundingClientRect();
    const rel = (rect: DOMRect) => new DOMRect(rect.left - base.left + scroller.scrollLeft, rect.top - base.top + scroller.scrollTop, rect.width, rect.height);
    const ra = rel(a.getBoundingClientRect());
    const b0 = rel(r0.getBoundingClientRect());
    const b1 = rel(r1.getBoundingClientRect());
    setBox({ active: ra, range: new DOMRect(b0.left, b0.top, b1.right - b0.left, b1.bottom - b0.top) });
  }, [sel]);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
  }, [open, measure, rows]);

  useEffect(() => {
    if (!open) return;
    const scroller = scrollRef.current;
    window.addEventListener("resize", measure);
    scroller?.addEventListener("scroll", measure);
    return () => {
      window.removeEventListener("resize", measure);
      scroller?.removeEventListener("scroll", measure);
    };
  }, [open, measure]);

  // Keep the active cell in view (clear of the sticky header / columns).
  useEffect(() => {
    if (!open) return;
    const scroller = scrollRef.current;
    const el = scroller?.querySelector<HTMLElement>(`[data-cell="${sel.fr}:${sel.fc}"]`);
    if (!scroller || !el) return;
    const stickyLeft = SHEET_COLS[0].width + SHEET_COLS[1].width;
    const top = el.offsetTop - ROW_H;
    const bottom = el.offsetTop + el.offsetHeight;
    if (top < scroller.scrollTop) scroller.scrollTop = top;
    else if (bottom > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = bottom - scroller.clientHeight;
    if (sel.fc > 1) {
      const left = el.offsetLeft - stickyLeft;
      const right = el.offsetLeft + el.offsetWidth;
      if (left < scroller.scrollLeft) scroller.scrollLeft = left;
      else if (right > scroller.scrollLeft + scroller.clientWidth) scroller.scrollLeft = right - scroller.clientWidth;
    }
  }, [open, sel.fr, sel.fc]);

  // ---- persistence ------------------------------------------------------------

  function enqueue(task: () => Promise<void>) {
    setPending((n) => n + 1);
    setSaveError(null);
    queue.current = queue.current
      .then(task)
      .catch((err: unknown) => {
        setSaveError(err instanceof Error ? err.message : "저장하지 못했어요");
      })
      .finally(() => setPending((n) => n - 1));
  }

  /** Finds the voyage for a VSL label, creating its 선박 스케줄 entry from
   * the row's route / dates when it isn't tracked yet. */
  async function resolveVessel(values: SheetValues, cache: Map<string, VesselWatch>): Promise<VesselWatch | null> {
    const label = values.vsl.trim();
    if (!label) return null;
    const hit = [...cache.values()].find((v) => sameLabel(vesselLabel(v), label)) ?? vessels.find((v) => v.status === "active" && sameLabel(vesselLabel(v), label));
    if (hit) return hit;
    const created = await ops.createVessel({ ...splitVsl(label), pol: values.pol, pod: values.pod, etd: values.etd || undefined, eta: values.eta || undefined });
    if (created) cache.set(created.id, created);
    return created;
  }

  const draftReady = (v: SheetValues) => Boolean(v.vsl.trim() && (v.importer.trim() || v.containerNo.trim()));

  /** Saves complete drafts (grouped by voyage), returning the created ids. */
  async function saveDrafts(list: Draft[]): Promise<string[]> {
    const cache = new Map<string, VesselWatch>();
    const created: string[] = [];
    const groups = new Map<string, Draft[]>();
    for (const d of list) {
      const k = d.values.vsl.trim().toUpperCase();
      groups.set(k, [...(groups.get(k) ?? []), d]);
    }
    for (const group of groups.values()) {
      const vessel = await resolveVessel(group[0].values, cache);
      if (!vessel) throw new Error("선박을 만들지 못했어요");
      const saved = await ops.createContainers(
        vessel.id,
        group.map(({ values: v }) => ({
          importer: v.importer,
          exporter: v.exporter,
          size: v.size,
          containerNo: v.containerNo,
          hbl: v.hbl,
          freeTimeUntil: v.freeTimeUntil,
          deliveryDate: v.deliveryDate,
          deliveryTime: v.deliveryDate ? v.deliveryTime : "",
          surrendered: v.surrendered,
          settled: v.settled,
          memo: v.memo,
        })),
      );
      created.push(...saved.map((c) => c.id));
      const keys = new Set(group.map((d) => d.key));
      setDrafts((ds) => ds.filter((d) => !keys.has(d.key)));
    }
    return created;
  }

  /** The one write path: typed edits, pastes, clears, toggles and undo. */
  function applyChanges(changes: CellChange[], opts: { undo?: boolean; label?: string } = {}) {
    const recordUndo = opts.undo !== false;
    const entry: UndoEntry = { cells: [], createdIds: [] };
    const draftsBefore = drafts;
    const nextDrafts = drafts.map((d) => ({ ...d, values: { ...d.values } }));
    const draftIndexByRow = new Map<number, number>();
    const savedChanges: { row: SavedRow; key: SheetKey; value: SheetValues[SheetKey] }[] = [];
    let touchedDrafts = false;

    for (const ch of changes) {
      const row = rows[ch.row];
      if (!row || row.kind === "saved") {
        if (row?.kind === "saved") savedChanges.push({ row, key: ch.key, value: ch.value });
        else if (ch.row > lastRow) {
          // Past the blank rows (a long paste) - treat as more blank rows.
          if (!draftIndexByRow.has(ch.row)) {
            nextDrafts.push({ key: `draft-${++draftSeq.current}`, values: emptyValues() });
            draftIndexByRow.set(ch.row, nextDrafts.length - 1);
          }
          (nextDrafts[draftIndexByRow.get(ch.row)!].values as unknown as Record<string, unknown>)[ch.key] = ch.value;
          touchedDrafts = true;
        }
        continue;
      }
      let index: number;
      if (row.kind === "draft") index = nextDrafts.findIndex((d) => d.key === row.key);
      else {
        if (!draftIndexByRow.has(ch.row)) {
          nextDrafts.push({ key: `draft-${++draftSeq.current}`, values: emptyValues() });
          draftIndexByRow.set(ch.row, nextDrafts.length - 1);
        }
        index = draftIndexByRow.get(ch.row)!;
      }
      if (index < 0) continue;
      (nextDrafts[index].values as unknown as Record<string, unknown>)[ch.key] = ch.value;
      touchedDrafts = true;
    }

    // Saved rows: one patch per container (HB/L flags fan out to the B/L),
    // voyage edits per vessel, VSL edits move the box to that voyage.
    const patches = new Map<string, Record<string, unknown>>();
    const vesselPatches = new Map<string, { pol?: string; pod?: string; etd?: string; eta?: string }>();
    const moves = new Map<string, SheetValues>();
    const newOverrides = new Map(overrides);
    let fannedOut = 0;
    for (const { row, key, value } of savedChanges) {
      const prev = cellValue(row, key);
      if (prev === value) continue;
      if (key === "vsl" && !String(value).trim()) {
        notify("VSL(선박)은 비워둘 수 없어요 · 행을 지우려면 NO 칸을 누르고 Delete");
        continue;
      }
      entry.cells.push({ id: row.c.id, key, value: prev as SheetValues[SheetKey] });
      newOverrides.set(`${row.key}:${key}`, value);
      if (key === "vsl") {
        moves.set(row.c.id, { ...(rowValues(row) as SheetValues), vsl: String(value) });
      } else if (VESSEL_KEYS.includes(key)) {
        const vp = vesselPatches.get(row.c.vesselWatchId) ?? {};
        (vp as Record<string, unknown>)[key] = value;
        vesselPatches.set(row.c.vesselWatchId, vp);
        fannedOut += containers.filter((c) => c.vesselWatchId === row.c.vesselWatchId).length - 1;
      } else if (key === "surrendered" || key === "settled") {
        const siblings = row.c.hbl ? containers.filter((c) => c.hbl === row.c.hbl) : [row.c];
        for (const sib of siblings) patches.set(sib.id, { ...patches.get(sib.id), [key]: value });
        fannedOut += siblings.length - 1;
      } else {
        patches.set(row.c.id, { ...patches.get(row.c.id), [key]: value ?? "" });
      }
    }
    // Vessel rows moved in this batch: route / dates typed with the move go
    // to the new voyage when it's created, not the old one.
    for (const [id, values] of moves) {
      for (const k of VESSEL_KEYS) {
        const ch = savedChanges.find((x) => x.row.c.id === id && x.key === k);
        if (ch) (values as unknown as Record<string, unknown>)[k] = ch.value;
      }
    }

    // A draft typed and then wiped out again is just a blank row.
    if (touchedDrafts) {
      const blank = emptyValues();
      const isBlank = (v: SheetValues) => (Object.keys(blank) as SheetKey[]).every((k) => k === "size" || v[k] === blank[k]);
      for (let i = nextDrafts.length - 1; i >= 0; i--) if (isBlank(nextDrafts[i].values)) nextDrafts.splice(i, 1);
      setDrafts(nextDrafts);
    }
    if (newOverrides.size !== overrides.size || savedChanges.length) setOverrides(newOverrides);

    const ready = nextDrafts.filter((d) => !d.saving && draftReady(d.values));
    if (ready.length) {
      const keys = new Set(ready.map((d) => d.key));
      setDrafts(nextDrafts.map((d) => (keys.has(d.key) ? { ...d, saving: true } : d)));
    }
    if (touchedDrafts && recordUndo) entry.drafts = draftsBefore;

    const hasSaved = patches.size > 0 || vesselPatches.size > 0 || moves.size > 0;
    if (!hasSaved && !ready.length) {
      if (recordUndo && (entry.cells.length || entry.drafts)) setUndoStack((s) => [...s.slice(-49), entry]);
      return;
    }
    if (fannedOut > 0 && opts.label !== "undo") {
      notify(`연결된 컨테이너 ${fannedOut}대에도 함께 반영했어요`);
    }

    enqueue(async () => {
      const cache = new Map<string, VesselWatch>();
      try {
        for (const [id, values] of moves) {
          const vessel = await resolveVessel(values, cache);
          if (vessel) patches.set(id, { ...patches.get(id), vesselWatchId: vessel.id });
        }
        for (const [vid, patch] of vesselPatches) {
          const v = vesselById.get(vid);
          if (v) await ops.updateVessel(v, patch);
        }
        if (patches.size) await ops.updateContainers([...patches].map(([id, patch]) => ({ id, patch })));
        if (ready.length) entry.createdIds = await saveDrafts(ready);
        if (recordUndo && (entry.cells.length || entry.createdIds.length || entry.drafts)) {
          setUndoStack((s) => [...s.slice(-49), entry]);
        }
      } catch (err) {
        if (ready.length) {
          const keys = new Set(ready.map((d) => d.key));
          setDrafts((ds) => ds.map((d) => (keys.has(d.key) ? { ...d, saving: false } : d)));
        }
        throw err;
      } finally {
        setOverrides((o) => {
          const next = new Map(o);
          for (const { row, key } of savedChanges) next.delete(`${row.key}:${key}`);
          return next;
        });
      }
    });
  }

  function undo() {
    const entry = undoStack[undoStack.length - 1];
    if (!entry) return notify("되돌릴 작업이 없어요");
    setUndoStack((s) => s.slice(0, -1));
    if (entry.drafts) setDrafts(entry.drafts);
    if (entry.createdIds.length) enqueue(() => ops.deleteContainers(entry.createdIds));
    if (entry.cells.length) {
      const changes: CellChange[] = [];
      for (const cell of entry.cells) {
        const r = rows.findIndex((x) => x.kind === "saved" && x.c.id === cell.id);
        if (r >= 0) changes.push({ row: r, key: cell.key, value: cell.value });
      }
      applyChanges(changes, { undo: false, label: "undo" });
    }
    notify("되돌렸어요");
  }

  // ---- selection helpers ------------------------------------------------------

  const rangeOf = () => ({
    r0: Math.min(sel.ar, sel.fr),
    r1: Math.max(sel.ar, sel.fr),
    c0: Math.min(sel.ac, sel.fc),
    c1: Math.max(sel.ac, sel.fc),
  });
  const inRange = (r: number, c: number) => {
    const { r0, r1, c0, c1 } = rangeOf();
    return r >= r0 && r <= r1 && c >= c0 && c <= c1;
  };
  const clampR = (r: number) => Math.max(0, Math.min(lastRow, r));
  const clampC = (c: number) => Math.max(0, Math.min(lastCol, c));

  function moveTo(r: number, c: number, extend = false) {
    const nr = clampR(r);
    const nc = clampC(c);
    setSel((s) => (extend ? { ...s, fr: nr, fc: nc } : { ar: nr, ac: nc, fr: nr, fc: nc }));
  }

  // ---- editing ----------------------------------------------------------------

  const activeCol: SheetCol = SHEET_COLS[sel.fc];
  const activeRow = rows[sel.fr];

  /** Free time as shown: the typed date, else 입항일 + 10 days (auto). */
  function freeTimeOf(row: SavedRow, v: SheetValues | null) {
    return freeTimeStatus(
      { ...row.c, freeTimeUntil: v?.freeTimeUntil || undefined, deliveryDate: v?.deliveryDate || undefined },
      today,
      { ...row.voyage, eta: v?.eta || row.voyage.eta },
    );
  }

  function displayOf(row: GridRow, col: SheetCol, rowNo: number | null): string {
    const v = rowValues(row);
    if (!v) return "";
    if (col.key === "freeTimeUntil" && row.kind === "saved" && !v.freeTimeUntil) {
      const ft = freeTimeOf(row, v);
      return ft.date ? formatSheetDate(ft.date) : "";
    }
    return formatCell(col, v, rowNo);
  }

  function startEdit(initial?: string) {
    if (activeCol.kind === "readonly") return;
    if (activeCol.kind === "flag") return toggleFlags();
    const input = inputRef.current;
    if (!input) return;
    input.value = initial ?? (activeRow ? displayOf(activeRow, activeCol, null) : "");
    setEditing(true);
    requestAnimationFrame(() => {
      input.focus();
      const end = input.value.length;
      input.setSelectionRange(end, end);
    });
  }

  function commitEdit(move: [number, number] | null) {
    const input = inputRef.current;
    if (!input || !editing) return;
    const text = input.value;
    setEditing(false);
    input.value = "";
    // Text left as it was shown (e.g. an auto 프리타임) isn't an edit.
    const unchanged = activeRow && activeRow.kind !== "blank" && text.trim() === displayOf(activeRow, activeCol, null).trim();
    if (activeCol.kind !== "readonly" && activeCol.key !== "no" && !unchanged) {
      const parsed = parseCell(activeCol, text, today);
      const current = activeRow ? cellValue(activeRow, activeCol.key) : undefined;
      if (!parsed.ok) notify(parsed.message);
      else if (parsed.value !== current && !(activeRow?.kind === "blank" && (parsed.value === "" || parsed.value === false))) {
        applyChanges([{ row: sel.fr, key: activeCol.key, value: parsed.value }]);
      }
    }
    if (move) moveTo(sel.fr + move[0], sel.fc + move[1]);
  }

  function cancelEdit() {
    setEditing(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function toggleFlags() {
    const { r0, r1, c0, c1 } = rangeOf();
    const changes: CellChange[] = [];
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const col = SHEET_COLS[c];
        if (col.kind !== "flag" || col.key === "no") continue;
        const row = rows[r];
        if (row.kind === "blank") continue;
        changes.push({ row: r, key: col.key, value: !cellValue(row, col.key) });
      }
    if (changes.length) applyChanges(changes);
  }

  function clearRange() {
    const { r0, r1, c0, c1 } = rangeOf();
    // Whole rows selected (NO column, or every column): Delete removes the
    // rows themselves - a saved container can't be an empty row.
    if (c0 <= 1 && c1 === lastCol) {
      const picked = rows.slice(r0, r1 + 1);
      const draftKeys = new Set(picked.flatMap((r) => (r.kind === "draft" ? [r.key] : [])));
      if (draftKeys.size) setDrafts((ds) => ds.filter((d) => !draftKeys.has(d.key)));
      const ids = picked.flatMap((r) => (r.kind === "saved" ? [r.c.id] : []));
      if (ids.length) setConfirmDelete(ids);
      return;
    }
    const changes: CellChange[] = [];
    let skipped = false;
    for (let r = r0; r <= r1; r++) {
      const row = rows[r];
      if (row.kind === "blank") continue;
      for (let c = c0; c <= c1; c++) {
        const col = SHEET_COLS[c];
        if (col.key === "no" || col.kind === "size") continue;
        if (col.key === "vsl" && row.kind === "saved") {
          skipped = true;
          continue;
        }
        changes.push({ row: r, key: col.key, value: col.kind === "flag" ? false : "" });
      }
    }
    if (changes.length) applyChanges(changes);
    // After applyChanges, so this note isn't replaced by its own toast.
    if (skipped) notify("VSL(선박)은 비워둘 수 없어서 그대로 두었어요 · 행을 지우려면 NO 칸을 누르고 Delete");
  }

  // ---- clipboard ---------------------------------------------------------------

  function copyText(): string {
    const { r0, r1, c0, c1 } = rangeOf();
    const out: string[][] = [];
    for (let r = r0; r <= r1; r++) {
      const row = rows[r];
      const line: string[] = [];
      for (let c = c0; c <= c1; c++) line.push(row.kind === "blank" ? "" : displayOf(row, SHEET_COLS[c], row.kind === "saved" ? r + 1 : null));
      out.push(line);
    }
    return toTsv(out);
  }

  function paste(text: string) {
    const matrix = parseTsv(text).filter((line, i, all) => !(i === all.length - 1 && line.length === 1 && line[0] === ""));
    if (!matrix.length) return;
    const { r0, r1, c0, c1 } = rangeOf();
    const single = matrix.length === 1 && matrix[0].length === 1;
    // One value over a selected range fills it (like Excel).
    const height = single ? r1 - r0 + 1 : matrix.length;
    const width = single ? c1 - c0 + 1 : Math.max(...matrix.map((l) => l.length));
    const changes: CellChange[] = [];
    const errors: string[] = [];
    let prevRow: Partial<SheetValues> = {};
    for (let i = 0; i < height; i++) {
      const line = single ? matrix[0] : matrix[i];
      const thisRow: Partial<SheetValues> = {};
      const target = rows[r0 + i];
      for (let j = 0; j < width; j++) {
        const col = SHEET_COLS[c0 + j];
        if (!col || col.key === "no") continue;
        const raw = single ? line[0] : (line[j] ?? "");
        const parsed = parseCell(col, raw, today);
        if (!parsed.ok) {
          if (parsed.message) errors.push(parsed.message);
          continue;
        }
        let value = parsed.value;
        // Blanks under the sheet's merged 서렌더 / 정산 cells: same HB/L
        // as the row above -> same value.
        if (col.kind === "flag" && raw.trim() === "" && i > 0) {
          const hbl = (thisRow.hbl ?? (target && target.kind !== "blank" ? target.values.hbl : "")) || "";
          if (hbl && hbl === prevRow.hbl && prevRow[col.key] !== undefined) value = prevRow[col.key] as boolean;
        }
        if (col.kind === "size" && raw.trim() === "") continue;
        (thisRow as Record<string, unknown>)[col.key] = value;
        changes.push({ row: r0 + i, key: col.key, value });
      }
      // Fill in from the row itself for the merged-cell check below.
      if (target && target.kind !== "blank") prevRow = { ...rowValues(target), ...thisRow };
      else prevRow = thisRow;
    }
    if (errors.length) notify(`${errors.length}칸은 형식이 맞지 않아 건너뛰었어요 · ${errors[0]}`);
    if (!changes.length) return;
    applyChanges(changes, { label: "paste" });
    setSel({ ar: r0, ac: c0, fr: r0 + height - 1, fc: clampC(c0 + width - 1) });
  }

  // ---- keyboard ------------------------------------------------------------------

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const mod = e.metaKey || e.ctrlKey;
    if (editing) {
      if (e.nativeEvent.isComposing) return;
      if (e.key === "Enter") {
        e.preventDefault();
        commitEdit([e.shiftKey ? -1 : 1, 0]);
      } else if (e.key === "Tab") {
        e.preventDefault();
        commitEdit([0, e.shiftKey ? -1 : 1]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEdit();
      }
      return;
    }
    const step = (dr: number, dc: number) => {
      e.preventDefault();
      if (mod) {
        const r = dr ? (dr > 0 ? Math.max(savedRows.length + drafts.length - 1, 0) : 0) : sel.fr;
        const c = dc ? (dc > 0 ? lastCol : 0) : sel.fc;
        moveTo(r, c, e.shiftKey);
      } else moveTo(sel.fr + dr, sel.fc + dc, e.shiftKey);
    };
    switch (e.key) {
      case "ArrowUp":
        return step(-1, 0);
      case "ArrowDown":
        return step(1, 0);
      case "ArrowLeft":
        return step(0, -1);
      case "ArrowRight":
        return step(0, 1);
      case "Tab":
        e.preventDefault();
        return moveTo(sel.fr, sel.fc + (e.shiftKey ? -1 : 1));
      case "Home":
        e.preventDefault();
        return moveTo(mod ? 0 : sel.fr, 0, e.shiftKey);
      case "End":
        e.preventDefault();
        return moveTo(mod ? savedRows.length + drafts.length - 1 : sel.fr, lastCol, e.shiftKey);
      case "Enter":
        e.preventDefault();
        if (e.shiftKey) return moveTo(sel.fr - 1, sel.fc);
        return startEdit();
      case "F2":
        e.preventDefault();
        return startEdit();
      case "Delete":
      case "Backspace":
        e.preventDefault();
        return clearRange();
      case "Escape":
        e.preventDefault();
        if (sel.ar !== sel.fr || sel.ac !== sel.fc) return setSel((s) => ({ ...s, ar: s.fr, ac: s.fc }));
        return onClose();
      case " ":
        if (activeCol.kind === "flag") {
          e.preventDefault();
          return toggleFlags();
        }
        break;
    }
    if (mod && e.key.toLowerCase() === "z") {
      e.preventDefault();
      return undo();
    }
    if (mod && e.key.toLowerCase() === "a") {
      e.preventDefault();
      return setSel({ ar: 0, ac: 0, fr: Math.max(0, savedRows.length + drafts.length - 1), fc: lastCol });
    }
    if (!mod && e.key.length === 1 && (activeCol.kind === "readonly" || activeCol.kind === "flag")) {
      e.preventDefault();
      if (activeCol.kind === "flag") notify("서렌더·정산은 클릭하거나 스페이스로 바꿔요");
    }
  }

  // Typing (incl. Korean IME composition) into the idle overlay starts editing
  // with what was typed - the input already holds it.
  function beginTypedEdit() {
    if (editing) return;
    if (activeCol.kind === "readonly" || activeCol.kind === "flag") {
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    setEditing(true);
  }

  // ---- mouse ------------------------------------------------------------------------

  function onCellMouseDown(e: React.MouseEvent, r: number, c: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    if (editing) commitEdit(null);
    if (c === 0) {
      // NO column: whole row(s)
      setSel((s) => (e.shiftKey ? { ...s, ac: 0, fr: r, fc: lastCol } : { ar: r, ac: 0, fr: r, fc: lastCol }));
    } else moveTo(r, c, e.shiftKey);
    dragging.current = true;
    inputRef.current?.focus({ preventScroll: true });
  }

  function onCellEnter(r: number, c: number) {
    if (!dragging.current) return;
    setSel((s) => (s.ac === 0 && s.fc === lastCol ? { ...s, fr: r } : { ...s, fr: r, fc: c }));
  }

  // ---- delete rows ---------------------------------------------------------------------

  const { r0: selR0, r1: selR1 } = rangeOf();
  const selectedSavedIds = rows.slice(selR0, selR1 + 1).flatMap((r) => (r.kind === "saved" ? [r.c.id] : []));
  const selectedDraftKeys = rows.slice(selR0, selR1 + 1).flatMap((r) => (r.kind === "draft" ? [r.key] : []));
  const wholeRows = sel.ac === 0 || Math.min(sel.ac, sel.fc) === 0;

  async function doDelete() {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await ops.deleteContainers(confirmDelete);
      notify(`${confirmDelete.length}행을 삭제했어요`);
    } catch {
      notify("삭제하지 못했어요");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
      inputRef.current?.focus({ preventScroll: true });
    }
  }

  if (!open || typeof document === "undefined") return null;

  // ---- render ------------------------------------------------------------------------

  const status = pending > 0 ? "saving" : saveError ? "error" : "idle";
  const scopeNote =
    activeRow && activeRow.kind === "saved"
      ? activeCol.scope === "vessel"
        ? `선박 일정 · 같은 배의 컨테이너 ${containers.filter((c) => c.vesselWatchId === activeRow.c.vesselWatchId).length}대에 함께 반영`
        : activeCol.scope === "hbl" && activeRow.c.hbl
          ? `HB/L ${activeRow.c.hbl} · ${containers.filter((c) => c.hbl === activeRow.c.hbl).length}대에 함께 반영`
          : null
      : "새 행 · VSL과 수입자(또는 CTNS NO)를 넣으면 자동 저장돼요";
  const totalWidth = SHEET_COLS.reduce((s, c) => s + c.width, 0);
  const isDateCol = activeCol.kind === "date" || activeCol.kind === "time";

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-modal-backdrop" role="dialog" aria-modal="true" aria-label="컨테이너 시트">
      {/* Top bar */}
      <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-5 h-14 border-b border-[var(--border-subtle)] shrink-0">
        <span className="w-8 h-8 rounded-[10px] bg-[#107c41] text-white flex items-center justify-center shrink-0">
          <Table2 size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold text-[var(--foreground)] leading-tight">컨테이너 시트</p>
          <p className="text-[11.5px] text-[var(--muted)] leading-tight">
            {savedRows.length}행{query && ` (전체 ${containers.length})`}
            {drafts.length > 0 && <span className="text-[var(--warning)]"> · 미저장 {drafts.length}행</span>}
          </p>
        </div>
        <span
          className={cn(
            "ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap",
            status === "saving" && "bg-[var(--sidebar-bg)] text-[var(--muted)]",
            status === "idle" && "bg-green-50 text-[var(--success)]",
            status === "error" && "bg-red-50 text-[var(--danger)]",
          )}
          title={saveError ?? undefined}
        >
          {status === "saving" ? (
            <>
              <Loader2 size={12} className="animate-spin" /> 저장 중…
            </>
          ) : status === "error" ? (
            "저장 실패"
          ) : (
            <>
              <Check size={12} strokeWidth={3} /> 자동 저장됨
            </>
          )}
        </span>
        <div className="relative ml-auto hidden md:block w-[240px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.focus()}
            placeholder="수입자·VSL·CTNS·HB/L 찾기"
            aria-label="시트 검색"
            className="w-full h-9 pl-8 pr-3 rounded-full bg-[var(--sidebar-bg)] text-[13px] outline-none focus:bg-white focus:ring-2 focus:ring-[var(--accent-soft)] focus:border-[var(--accent)] border border-transparent"
          />
        </div>
        {(selectedSavedIds.length > 0 && wholeRows) || selectedDraftKeys.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (selectedDraftKeys.length) setDrafts((ds) => ds.filter((d) => !selectedDraftKeys.includes(d.key)));
              if (selectedSavedIds.length && wholeRows) setConfirmDelete(selectedSavedIds);
            }}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium text-[var(--danger)] hover:bg-red-50 max-md:ml-auto"
          >
            <Trash2 size={14} /> {selectedSavedIds.length && wholeRows ? `${selectedSavedIds.length}행 삭제` : "미저장 행 지우기"}
          </button>
        ) : null}
        <div className={cn("relative", !(selectedSavedIds.length && wholeRows) && !selectedDraftKeys.length && "max-md:ml-auto")}>
          <button
            type="button"
            onClick={() => setShowHelp((s) => !s)}
            aria-expanded={showHelp}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[13px] font-medium text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
          >
            <Keyboard size={15} /> <span className="max-sm:hidden">단축키</span>
          </button>
          {showHelp && <ShortcutHelp onClose={() => setShowHelp(false)} />}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="시트 닫기"
          className="w-9 h-9 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--sidebar-bg)]"
        >
          <X size={18} />
        </button>
      </div>

      {/* Formula bar: where you are + what the cell is linked to */}
      <div className="flex items-center gap-3 px-3 sm:px-5 h-10 border-b border-[var(--border-subtle)] bg-[#fafafa] shrink-0 text-[12.5px]">
        <span className="shrink-0 inline-flex items-center h-6 px-2 rounded-md bg-white border border-[var(--border-subtle)] font-medium text-[var(--foreground)] tabular-nums">
          {activeCol.label || "NO"} · {sel.fr + 1}행
        </span>
        <span className="min-w-0 flex-1 truncate text-[var(--foreground)]">
          {activeRow && activeRow.kind !== "blank" ? displayOf(activeRow, activeCol, activeRow.kind === "saved" ? sel.fr + 1 : null) || <span className="text-[#c7c7cc]">비어 있음</span> : <span className="text-[#c7c7cc]">빈 행 - 입력하거나 붙여넣으면 새 컨테이너가 돼요</span>}
        </span>
        {scopeNote && <span className="hidden sm:inline shrink-0 text-[11.5px] text-[#3b6fd8]">{scopeNote}</span>}
        <button
          type="button"
          onClick={() => startEdit()}
          disabled={activeCol.kind === "readonly"}
          className="md:hidden shrink-0 h-7 px-2.5 rounded-full bg-[var(--accent)] text-white text-[12px] font-medium disabled:opacity-40"
        >
          {activeCol.kind === "flag" ? "바꾸기" : "편집"}
        </button>
      </div>

      {/* Grid */}
      <div ref={scrollRef} className="relative flex-1 overflow-auto overscroll-contain bg-white" onMouseDown={(e) => e.target === e.currentTarget && inputRef.current?.focus()}>
        <table className="table-fixed border-separate border-spacing-0 text-[13px] select-none" style={{ width: totalWidth }}>
          <colgroup>
            {SHEET_COLS.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              {SHEET_COLS.map((c, ci) => (
                <th
                  key={c.key}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (editing) commitEdit(null);
                    const last = Math.max(0, savedRows.length + drafts.length - 1);
                    setSel((s) => (e.shiftKey ? { ...s, ar: 0, fr: last, fc: ci } : { ar: 0, ac: ci, fr: last, fc: ci }));
                    inputRef.current?.focus({ preventScroll: true });
                  }}
                  className={cn(
                    "sticky top-0 z-20 h-[34px] border-r border-b border-[#d9dde3] px-2 text-[12px] font-semibold text-[#3a3a3c] whitespace-nowrap cursor-pointer",
                    c.scope === "vessel" ? "bg-[#e8f0fe]" : c.scope === "hbl" ? "bg-[#e6f4ea]" : "bg-[#f3e8fd]",
                    c.align === "center" || ci === 0 ? "text-center" : "text-left",
                    ci === 0 && "left-0 z-30",
                    ci === 1 && "left-[52px] z-30",
                    sel.fc === ci && "text-[var(--accent)]",
                  )}
                  title={c.scope === "vessel" ? "선박 일정 - 같은 배의 컨테이너에 함께 반영돼요" : c.scope === "hbl" ? "같은 HB/L에 함께 반영돼요" : undefined}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const v = rowValues(row);
              const saved = row.kind === "saved" ? row : null;
              const ft = saved ? freeTimeOf(saved, v) : null;
              return (
                <tr key={row.key} style={{ height: ROW_H }}>
                  {SHEET_COLS.map((col, c) => {
                    const selected = inRange(r, c);
                    const autoFreeTime = col.key === "freeTimeUntil" && ft?.auto && ft.date;
                    const text = row.kind === "blank" ? "" : autoFreeTime ? formatSheetDate(ft.date!) : formatCell(col, v!, row.kind === "saved" ? r + 1 : null);
                    let badge: React.ReactNode = null;
                    if (saved && col.key === "etd") badge = <DateBadges delay={saved.voyage.etdDelay} confirmed={Boolean(saved.voyage.departed)} />;
                    if (saved && col.key === "eta") badge = <DateBadges delay={saved.voyage.etaDelay} confirmed={Boolean(saved.voyage.arrived)} />;
                    if (saved && col.key === "freeTimeUntil" && ft && ft.days !== null && ft.date) {
                      badge =
                        ft.state === "safe" ? (
                          <span className="text-[var(--success)] text-[10.5px] font-bold">✓</span>
                        ) : (
                          <span
                            className={cn(
                              "rounded px-1 text-[10.5px] font-bold",
                              ft.state === "soon" ? "bg-amber-50 text-[var(--warning)]" : ft.state === "ok" ? "text-[var(--muted)] font-medium" : "bg-red-50 text-[var(--danger)]",
                            )}
                          >
                            {dDay(ft.days)}
                          </span>
                        );
                    }
                    return (
                      <td
                        key={col.key}
                        data-cell={`${r}:${c}`}
                        onMouseDown={(e) => onCellMouseDown(e, r, c)}
                        onMouseEnter={() => onCellEnter(r, c)}
                        onDoubleClick={() => (c === 0 ? undefined : startEdit())}
                        className={cn(
                          "border-r border-b border-[#e5e7eb] px-2 whitespace-nowrap overflow-hidden text-ellipsis cursor-cell",
                          c === 0 && "sticky left-0 z-10 text-center text-[12px] text-[var(--muted)] bg-[#f8f9fa] cursor-pointer",
                          c === 1 && "sticky left-[52px] z-10",
                          col.align === "center" && c !== 0 && "text-center",
                          (col.kind === "upper" && (col.key === "containerNo" || col.key === "hbl")) && "font-mono text-[12.5px] tracking-tight",
                          col.kind === "size" && "font-semibold",
                          row.kind === "draft" ? "bg-[#fffbea]" : c === 1 ? "bg-white" : "",
                          saved && col.key === "deliveryDate" && saved.stage === "needsTrucking" && "bg-red-50/70",
                          selected && c !== 0 && "!bg-[#e8f0fe]",
                          selected && c === 0 && "!bg-[#d2e3fc] text-[var(--accent)] font-semibold",
                        )}
                      >
                        {c === 0 ? (
                          row.kind === "saved" ? (
                            <span className="inline-flex items-center gap-1.5 tabular-nums" title={STAGE_META[row.stage].label}>
                              <span className={cn("w-1.5 h-1.5 rounded-full", stageDot(row.stage))} />
                              {r + 1}
                            </span>
                          ) : row.kind === "draft" ? (
                            row.saving ? (
                              <Loader2 size={12} className="inline animate-spin text-[var(--muted)]" />
                            ) : (
                              <span className="text-[10.5px] font-semibold text-[var(--warning)]" title="VSL과 수입자(또는 CTNS NO)를 넣으면 저장돼요">
                                미저장
                              </span>
                            )
                          ) : null
                        ) : col.kind === "flag" ? (
                          row.kind !== "blank" && (
                            <button
                              type="button"
                              tabIndex={-1}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                moveTo(r, c);
                                applyChanges([{ row: r, key: col.key as SheetKey, value: !cellValue(row, col.key as SheetKey) }]);
                                inputRef.current?.focus({ preventScroll: true });
                              }}
                              className={cn(
                                "inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full text-[11.5px] font-semibold",
                                v![col.key as "surrendered"] ? "bg-green-50 text-[var(--success)]" : "text-[#c7c7cc] hover:text-[var(--muted)]",
                              )}
                            >
                              {v![col.key as "surrendered"] ? (
                                <>
                                  <Check size={11} strokeWidth={3} /> 완료
                                </>
                              ) : (
                                "미완료"
                              )}
                            </button>
                          )
                        ) : badge ? (
                          <span className="flex items-center justify-between gap-1" title={autoFreeTime ? "입항일 + 10일 자동 계산 (입력하면 그 날짜로 바뀌어요)" : undefined}>
                            <span className={cn("truncate tabular-nums", autoFreeTime && "text-[var(--muted)]")}>{text}</span>
                            {badge}
                          </span>
                        ) : (
                          <span className={cn(col.kind === "date" || col.kind === "time" ? "tabular-nums" : undefined)}>{text}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Range outline + the always-focused input over the active cell. */}
        {box && (
          <>
            {(sel.ar !== sel.fr || sel.ac !== sel.fc) && (
              <div
                className="pointer-events-none absolute z-[15] border border-[var(--accent)]"
                style={{ left: box.range.left, top: box.range.top, width: box.range.width, height: box.range.height }}
              />
            )}
            <div
              className={cn("absolute z-[25]", editing ? "" : "pointer-events-none")}
              style={{ left: box.active.left - 1, top: box.active.top - 1, width: Math.max(box.active.width + 2, editing && !isDateCol ? 220 : 0), height: box.active.height + 2 }}
            >
              <input
                ref={inputRef}
                onKeyDown={onKeyDown}
                onCompositionStart={beginTypedEdit}
                onInput={beginTypedEdit}
                onBlur={() => {
                  // Clicking a toolbar button / outside commits like Excel.
                  if (editing) commitEdit(null);
                }}
                onCopy={(e) => {
                  if (editing) return;
                  e.preventDefault();
                  e.clipboardData.setData("text/plain", copyText());
                  const { r0, r1, c0, c1 } = rangeOf();
                  notify(`${(r1 - r0 + 1) * (c1 - c0 + 1)}칸을 복사했어요`);
                }}
                onCut={(e) => {
                  if (editing) return;
                  e.preventDefault();
                  e.clipboardData.setData("text/plain", copyText());
                  clearRange();
                }}
                onPaste={(e) => {
                  if (editing) return;
                  e.preventDefault();
                  paste(e.clipboardData.getData("text/plain"));
                }}
                inputMode={editing ? "text" : "none"}
                aria-label={`${activeCol.label} ${sel.fr + 1}행`}
                autoComplete="off"
                spellCheck={false}
                className={cn(
                  "w-full h-full px-2 text-[13px] outline-none border-2 border-[var(--accent)]",
                  editing ? "bg-white shadow-[0_4px_16px_rgba(15,23,42,0.18)] caret-[var(--accent)]" : "bg-transparent text-transparent caret-transparent",
                )}
              />
              {editing && isDateCol && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      try {
                        pickerRef.current?.showPicker();
                      } catch {
                        pickerRef.current?.focus();
                      }
                    }}
                    aria-label="달력 열기"
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 inline-flex items-center justify-center rounded text-[var(--accent)] hover:bg-[var(--accent-soft)]"
                  >
                    <CalendarDays size={14} />
                  </button>
                  <input
                    ref={pickerRef}
                    type={activeCol.kind === "time" ? "time" : "date"}
                    tabIndex={-1}
                    aria-hidden
                    className="absolute right-0 bottom-0 w-0 h-0 opacity-0"
                    onChange={(e) => {
                      if (!inputRef.current || !e.target.value) return;
                      inputRef.current.value = e.target.value;
                      commitEdit([1, 0]);
                    }}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Footer legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 sm:px-5 py-2 border-t border-[var(--border-subtle)] bg-[#fafafa] text-[11.5px] text-[var(--muted)] shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#e8f0fe] border border-[#c6d7f5]" /> 선박 일정 (같은 배 함께)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#e6f4ea] border border-[#c3e2cc]" /> HB/L 단위 (같은 B/L 함께)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[#fffbea] border border-[#f3e3a1]" /> 미저장 새 행
        </span>
        <span className="hidden md:inline ml-auto">엑셀·구글 시트에서 복사해 NO 칸이나 첫 칸에 붙여넣으면 여러 행이 한 번에 들어가요 · ⌘/Ctrl+Z 되돌리기</span>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`${confirmDelete?.length ?? 0}행을 삭제할까요?`}
        description="선택한 컨테이너 기록이 삭제됩니다. 이 작업은 되돌릴 수 없습니다."
        loading={deleting}
        onConfirm={doDelete}
        onCancel={() => {
          setConfirmDelete(null);
          inputRef.current?.focus({ preventScroll: true });
        }}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} durationMs={3500} />
    </div>,
    document.body,
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

function DateBadges({ delay, confirmed }: { delay: number | null; confirmed: boolean }) {
  if (!confirmed && !delay) return null;
  return (
    <span className="flex items-center gap-0.5 shrink-0">
      {confirmed && <Check size={11} strokeWidth={3} className="text-[var(--success)]" />}
      {delay ? (
        <span className={cn("rounded px-1 text-[10.5px] font-bold", delay > 0 ? "bg-red-50 text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>
          {delay > 0 ? `+${delay}` : delay}
        </span>
      ) : null}
    </span>
  );
}

function ShortcutHelp({ onClose }: { onClose: () => void }) {
  const items: [string, string][] = [
    ["방향키 · Tab", "칸 이동"],
    ["Shift + 방향키 / 드래그", "범위 선택"],
    ["Enter · F2 · 더블클릭", "칸 편집"],
    ["그냥 입력", "덮어쓰기 (한글도 바로)"],
    ["Enter / Tab (편집 중)", "저장하고 아래 / 오른쪽으로"],
    ["Esc", "편집 취소 · 시트 닫기"],
    ["Ctrl/⌘ + C · V · X", "복사 · 붙여넣기 · 잘라내기"],
    ["Delete", "선택한 칸 지우기"],
    ["Ctrl/⌘ + Z", "되돌리기"],
    ["Space (서렌더·정산)", "완료 ↔ 미완료"],
    ["NO 칸 클릭 → Delete", "행 삭제"],
  ];
  return (
    <div className="absolute right-0 top-full mt-2 z-40 w-[300px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.28)] animate-dropdown-panel">
      <div className="flex items-center justify-between mb-2">
        <p className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--foreground)]">
          <CircleHelp size={14} /> 엑셀처럼 쓰는 법
        </p>
        <button type="button" onClick={onClose} aria-label="닫기" className="w-6 h-6 inline-flex items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--sidebar-bg)]">
          <X size={13} />
        </button>
      </div>
      <dl className="space-y-1">
        {items.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-3 text-[12px]">
            <dt className="text-[var(--foreground)] font-medium">{k}</dt>
            <dd className="text-[var(--muted)] text-right">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
