"use client";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Dropdown } from "@/components/ui/Dropdown";
import { Input } from "@/components/ui/Field";
import { IconAction } from "@/components/ui/IconAction";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { matchesSearch } from "@/lib/hangul";
import { useRememberedSalesRepId } from "@/lib/hooks";
import type { Customer, SalesRep, VesselPortCall, VesselWatch } from "@/lib/types";
import { delayDays, isDelayed, nextScheduleDate, originalDate, shortScheduleDate } from "@/lib/vessels";
import {
  ArrowRight,
  CheckCircle2,
  Contact,
  ExternalLink,
  History,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Ship,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { VesselDialog, type VesselDraft } from "./VesselDialog";

const TRADLINX_URL = "https://www.tradlinx.com/ko/container-terminal-schedule";

/** Which dates a call shows: 출발항 only departs, 도착항 only arrives. */
function fieldsOf(call: VesselPortCall): ("eta" | "etd")[] {
  return call.kind === "POL" ? ["etd"] : call.kind === "POD" ? ["eta"] : ["eta", "etd"];
}

const FIELD_LABEL = { eta: "입항", etd: "출항" } as const;
const KIND_LABEL = { POL: "출발", VIA: "경유", POD: "도착" } as const;

/** 선박 스케줄 board: tracked voyages with each port's ETA/ETD, every date
 * change kept as history and shown as a delay vs. the first announced date. */
export function VesselBoard({
  initialWatches,
  customers,
  salesReps,
  portNames,
  today,
  containerCounts = {},
}: {
  /** Korea-time calendar date, from the server (keeps render pure). */
  today: string;
  initialWatches: VesselWatch[];
  /** 컨테이너 현황 boxes on each voyage, by vessel id. */
  containerCounts?: Record<string, number>;
  customers: Customer[];
  salesReps: SalesRep[];
  portNames: string[];
}) {
  const [watches, setWatches] = useState(initialWatches);
  const [tab, setTab] = useState<"active" | "done">("active");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ watch: VesselWatch | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<VesselWatch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [repId, setRepId] = useRememberedSalesRepId(salesReps);
  const repName = salesReps.find((r) => r.id === repId)?.name;
  const toastSeq = useRef(0);
  const notify = (text: string) => setToast({ id: ++toastSeq.current, text });

  const visible = useMemo(() => {
    const q = query.trim();
    return watches
      .filter((w) => w.status === tab)
      .filter(
        (w) =>
          !q ||
          matchesSearch(
            [w.vesselName, w.voyage, w.carrier, w.customerName, ...w.calls.map((c) => c.portName)].filter(Boolean).join(" "),
            q,
          ),
      )
      .sort((a, b) =>
        tab === "active"
          ? nextScheduleDate(a, today).localeCompare(nextScheduleDate(b, today))
          : b.updatedAt.localeCompare(a.updatedAt),
      );
  }, [watches, tab, query, today]);

  const activeCount = watches.filter((w) => w.status === "active").length;
  const delayedCount = watches.filter((w) => w.status === "active" && isDelayed(w)).length;

  async function put(body: Record<string, unknown>): Promise<VesselWatch | null> {
    const res = await fetch("/api/vessels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, by: repName }),
    });
    if (!res.ok) return null;
    const saved = (await res.json()) as VesselWatch;
    setWatches((ws) => ws.map((w) => (w.id === saved.id ? saved : w)));
    return saved;
  }

  async function handleDialogSubmit(draft: VesselDraft) {
    const editing = dialog?.watch;
    if (editing) {
      const saved = await put({ id: editing.id, ...draft });
      if (!saved) throw new Error("save failed");
      notify("선박 정보를 저장했어요");
    } else {
      const res = await fetch("/api/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as VesselWatch;
      setWatches((ws) => [saved, ...ws]);
      setTab("active");
      notify(`${saved.vesselName} 추적을 시작했어요`);
    }
    setDialog(null);
  }

  async function changeDate(w: VesselWatch, callId: string, field: "eta" | "etd", value: string | undefined) {
    const call = w.calls.find((c) => c.id === callId);
    if (!call || call[field] === value) return;
    const before = call[field];
    const saved = await put({
      id: w.id,
      calls: w.calls.map((c) => (c.id === callId ? { ...c, [field]: value } : c)),
    });
    if (!saved) return notify("저장하지 못했어요. 다시 시도해 주세요.");
    const savedCall = saved.calls.find((c) => c.id === callId);
    const delay = savedCall ? delayDays(savedCall, field) : null;
    notify(
      `${call.portName} ${FIELD_LABEL[field]} ${shortScheduleDate(before)} → ${shortScheduleDate(value)}` +
        (delay ? ` (처음 대비 ${delay > 0 ? `+${delay}일 지연` : `${-delay}일 앞당김`})` : ""),
    );
  }

  /** 출항 / 입항 확인 (or undo) on the voyage's POL / POD call. */
  async function setActual(w: VesselWatch, callId: string, key: "departed" | "arrived", on: boolean) {
    const call = w.calls.find((c) => c.id === callId);
    if (!call) return;
    const planned = key === "departed" ? call.etd : call.eta;
    const date = planned && planned.slice(0, 10) <= today ? planned : today;
    const saved = await put({
      id: w.id,
      calls: w.calls.map((c) => (c.id === callId ? { ...c, actual: { ...c.actual, [key]: on ? date : undefined } } : c)),
    });
    if (!saved) return notify("저장하지 못했어요. 다시 시도해 주세요.");
    notify(on ? `${call.portName} ${key === "departed" ? "출항" : "입항"} 확인했어요` : "확인을 취소했어요");
  }

  async function toggleDone(w: VesselWatch) {
    const saved = await put({ id: w.id, status: w.status === "done" ? "active" : "done" });
    if (saved) notify(saved.status === "done" ? `${w.vesselName} 완료 처리했어요` : `${w.vesselName} 다시 추적해요`);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/vessels?id=${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      setWatches((ws) => ws.filter((w) => w.id !== pendingDelete.id));
      notify(`${pendingDelete.vesselName} 삭제했어요`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <div className="inline-flex p-1 rounded-full bg-[var(--sidebar-bg)] text-[13px] font-medium self-start">
          {(["active", "done"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "px-3.5 h-8 rounded-full transition-colors",
                tab === t ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
              )}
            >
              {t === "active" ? `진행 중 ${activeCount}` : "완료"}
              {t === "active" && delayedCount > 0 && (
                <span className="ml-1.5 text-[var(--danger)]">· 지연 {delayedCount}</span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-[280px]">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="선박명·항차·화주·항구 검색"
            aria-label="선박 검색"
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          {salesReps.length > 0 && (
            <Dropdown
              value={repId}
              onChange={setRepId}
              options={salesReps.map((r) => ({ value: r.id, label: r.name }))}
              icon={<Contact size={14} />}
              aria-label="변경 기록자"
              className="w-[150px]"
              buttonClassName="h-10 text-[13px]"
            />
          )}
          <Button onClick={() => setDialog({ watch: null })} icon={<Plus size={16} />}>
            선박 추가
          </Button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-white py-16 text-center">
          <Ship size={28} className="mx-auto text-[var(--muted)]" />
          <p className="mt-3 text-[14.5px] font-medium text-[var(--foreground)]">
            {query ? "검색 결과가 없습니다." : tab === "active" ? "추적 중인 선박이 없습니다." : "완료된 선박이 없습니다."}
          </p>
          {tab === "active" && !query && (
            <p className="mt-1 text-[13px] text-[var(--muted)]">
              선박을 추가하고 입·출항일을 적어두면, 날짜가 바뀔 때마다 변경 이력과 지연 일수가 남아요.
            </p>
          )}
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((w) => (
            <VesselCard
              key={w.id}
              watch={w}
              today={today}
              containerCount={containerCounts[w.id] ?? 0}
              onActual={(callId, key, on) => setActual(w, callId, key, on)}
              onEdit={() => setDialog({ watch: w })}
              onToggleDone={() => toggleDone(w)}
              onDelete={() => setPendingDelete(w)}
              onChangeDate={(callId, field, value) => changeDate(w, callId, field, value)}
            />
          ))}
        </ul>
      )}

      <p className="mt-4 text-[12px] text-[var(--muted)]">
        날짜는 선사·터미널에서 확인한 값을 직접 입력해요.{" "}
        <a href={TRADLINX_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[var(--accent)] hover:underline">
          트레드링스 터미널 스케줄 <ExternalLink size={11} />
        </a>
      </p>

      <VesselDialog
        open={dialog !== null}
        watch={dialog?.watch ?? null}
        customers={customers}
        portNames={portNames}
        onClose={() => setDialog(null)}
        onSubmit={handleDialogSubmit}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="이 선박 추적을 삭제할까요?"
        description={pendingDelete ? `${pendingDelete.vesselName} ${pendingDelete.voyage}의 일정과 변경 이력이 모두 삭제됩니다.` : undefined}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} durationMs={3500} />
    </div>
  );
}

function VesselCard({
  watch: w,
  today,
  containerCount,
  onActual,
  onEdit,
  onToggleDone,
  onDelete,
  onChangeDate,
}: {
  watch: VesselWatch;
  today: string;
  containerCount: number;
  onActual: (callId: string, key: "departed" | "arrived", on: boolean) => void;
  onEdit: () => void;
  onToggleDone: () => void;
  onDelete: () => void;
  onChangeDate: (callId: string, field: "eta" | "etd", value: string | undefined) => Promise<void>;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const changes = w.calls
    .flatMap((c) => c.history.filter((h) => h.from !== undefined).map((h) => ({ ...h, port: c.portName })))
    .sort((a, b) => b.at.localeCompare(a.at));
  const delayed = isDelayed(w);

  return (
    <li
      className={cn(
        "rounded-[var(--radius-lg)] border bg-white px-4 sm:px-5 py-4",
        delayed && w.status === "active" ? "border-[var(--danger)]/30" : "border-[var(--border-subtle)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Ship size={16} className="text-[var(--accent)] shrink-0" />
            <p className="text-[15px] font-semibold tracking-tight text-[var(--foreground)]">{w.vesselName}</p>
            {w.voyage && <span className="text-[14px] font-medium text-[var(--muted)] tabular-nums">{w.voyage}</span>}
            {delayed && w.status === "active" && (
              <span className="rounded-full bg-[var(--danger)]/[0.08] px-2 py-0.5 text-[11.5px] font-medium text-[var(--danger)]">
                일정 지연
              </span>
            )}
          </div>
          <p className="mt-1 text-[12.5px] text-[var(--muted)] truncate">
            {[w.carrier, w.customerName && `화주 ${w.customerName}`, w.memo].filter(Boolean).join(" · ") ||
              (containerCount > 0 ? "" : " ")}
            {containerCount > 0 && (
              <a
                href="/containers"
                className={`${w.carrier || w.customerName || w.memo ? "ml-2 " : ""}inline-flex items-center gap-0.5 font-medium text-[var(--accent)] hover:underline`}
              >
                컨테이너 {containerCount}대 <ArrowRight size={11} />
              </a>
            )}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <IconAction label={`${w.vesselName} 수정`} tooltip="수정" onClick={onEdit}>
            <Pencil size={15} />
          </IconAction>
          <IconAction
            label={w.status === "done" ? "다시 추적" : "완료 처리"}
            tooltip={w.status === "done" ? "다시 추적" : "완료"}
            onClick={onToggleDone}
            hoverClass="hover:text-[var(--success)] hover:bg-[var(--success)]/10"
          >
            {w.status === "done" ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
          </IconAction>
          <IconAction
            label={`${w.vesselName} 삭제`}
            tooltip="삭제"
            onClick={onDelete}
            hoverClass="hover:text-[var(--danger)] hover:bg-red-50"
          >
            <Trash2 size={15} />
          </IconAction>
        </div>
      </div>

      {/* Route timeline - wraps on narrow screens rather than scrolling */}
      <div className="mt-3 flex flex-wrap items-stretch gap-x-1.5 gap-y-2">
        {w.calls.map((c, i) => (
          <div key={c.id} className="flex items-stretch gap-1.5">
            {i > 0 && <ArrowRight size={14} className="self-center text-[#cbd5e1] shrink-0" />}
            <div className="rounded-[var(--radius-md)] bg-[var(--sidebar-bg)] px-3 py-2 min-w-[118px]">
              <p className="text-[11px] font-medium text-[var(--muted)]">{KIND_LABEL[c.kind]}</p>
              <p className="text-[14px] font-semibold text-[var(--foreground)]">{c.portName}</p>
              <div className="mt-1 space-y-0.5">
                {fieldsOf(c).map((f) => (
                  <DateChip key={f} call={c} field={f} today={today} onSave={(v) => onChangeDate(c.id, f, v)} />
                ))}
                {c.kind !== "VIA" && (
                  <ActualChip
                    call={c}
                    today={today}
                    onToggle={(on) => onActual(c.id, c.kind === "POL" ? "departed" : "arrived", on)}
                  />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {changes.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((s) => !s)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[var(--muted)] hover:text-[var(--accent)]"
          >
            <History size={13} /> 변경 이력 {changes.length}건 {showHistory ? "접기" : "보기"}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1 border-l-2 border-[var(--border-subtle)] pl-3 animate-dropdown-panel">
              {changes.map((h, i) => (
                <li key={i} className="text-[12.5px] text-[var(--foreground)] tabular-nums">
                  <span className="text-[var(--muted)]">{shortScheduleDate(h.at.slice(0, 10))}</span>{" "}
                  {h.field === "atd" || h.field === "ata" ? (
                    <>
                      {h.port} {h.field === "atd" ? "출항" : "입항"} {h.to ? `확인 ${shortScheduleDate(h.to)}` : "확인 취소"}
                    </>
                  ) : (
                    <>
                      {h.port} {FIELD_LABEL[h.field]} {shortScheduleDate(h.from)} → {shortScheduleDate(h.to)}
                    </>
                  )}
                  {h.by && <span className="text-[var(--muted)]"> · {h.by}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** One ETA/ETD on the timeline: the date, its delay vs. the first announced
 * date, and a click-to-edit popover (date + optional time). */
function DateChip({
  call,
  field,
  today,
  onSave,
}: {
  call: VesselPortCall;
  field: "eta" | "etd";
  today: string;
  onSave: (value: string | undefined) => Promise<void>;
}) {
  const value = call[field];
  const delay = delayDays(call, field);
  const orig = originalDate(call, field);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const past = value ? value.slice(0, 10) < today : false;

  function open() {
    setDate(value?.slice(0, 10) ?? "");
    setTime(value?.slice(11, 16) ?? "");
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(date ? (time ? `${date}T${time}` : date) : undefined);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open}
        title={
          delay
            ? `처음 공지 ${shortScheduleDate(orig)} → 현재 ${shortScheduleDate(value)} (클릭해서 변경)`
            : "클릭해서 날짜 변경"
        }
        className="group/date flex items-center gap-1.5 text-left text-[12.5px] tabular-nums rounded px-1 -mx-1 hover:bg-white"
      >
        <span className="text-[var(--muted)]">{FIELD_LABEL[field]}</span>
        <span className={cn("font-medium", past ? "text-[var(--muted)]" : "text-[var(--foreground)]")}>
          {shortScheduleDate(value)}
        </span>
        {delay !== null && delay !== 0 && (
          <span
            className={cn(
              "rounded-full px-1.5 text-[10.5px] font-semibold",
              delay > 0 ? "bg-[var(--danger)]/[0.08] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]",
            )}
          >
            {delay > 0 ? `+${delay}일` : `${delay}일`}
          </span>
        )}
        <Pencil size={11} className="text-[var(--muted)] opacity-0 group-hover/date:opacity-100" />
      </button>
      {editing && (
        <div className="absolute left-0 top-full z-20 mt-1 w-[230px] rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-white p-3 shadow-lg animate-dropdown-panel">
          <p className="text-[12px] font-medium text-[var(--foreground)] mb-2">
            {call.portName} {FIELD_LABEL[field]}일
          </p>
          <div className="flex gap-1.5">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label={`${call.portName} ${FIELD_LABEL[field]}일`}
              className="h-8 flex-1 min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 text-[12.5px]"
            />
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="시간 (선택)"
              className="h-8 w-[82px] rounded-[var(--radius-sm)] border border-[var(--border)] px-1.5 text-[12.5px]"
            />
          </div>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={saving}>
              취소
            </Button>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? "저장 중..." : "저장"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** 출항함 / 입항함 once confirmed (click to undo), or a 확인 button once the
 * scheduled date is near - the same confirmation 컨테이너 현황 uses. */
function ActualChip({ call, today, onToggle }: { call: VesselPortCall; today: string; onToggle: (on: boolean) => void }) {
  const key = call.kind === "POL" ? "departed" : "arrived";
  const label = call.kind === "POL" ? "출항" : "입항";
  const confirmed = call.actual?.[key];
  const planned = call.kind === "POL" ? call.etd : call.eta;
  if (confirmed) {
    return (
      <button
        type="button"
        onClick={() => onToggle(false)}
        title={`${label} 확인됨 (${shortScheduleDate(confirmed)}) · 클릭하면 취소`}
        className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--success)]"
      >
        <CheckCircle2 size={11} /> {label}함
      </button>
    );
  }
  const near = planned && Date.parse(planned.slice(0, 10)) - Date.parse(today) <= 2 * 86_400_000;
  if (!near) return null;
  return (
    <button
      type="button"
      onClick={() => onToggle(true)}
      className="inline-flex items-center rounded-full border border-[var(--accent)]/40 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
    >
      {label} 확인
    </button>
  );
}
