"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Field";
import { IconAction } from "@/components/ui/IconAction";
import { Toast, type ToastMessage } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import {
  attentionItems,
  containerStage,
  dDay,
  daysUntil,
  freeTimeStatus,
  hasArrived,
  inThisWeek,
  shortDate,
  STAGE_META,
  vesselLabel,
  voyageEnds,
  voyageSummary,
  type AttentionItem,
  type ContainerStage,
  type VoyageSummary,
} from "@/lib/containers";
import { matchesSearch } from "@/lib/hangul";
import { useRememberedSalesRepId } from "@/lib/hooks";
import type { ContainerShipment, Customer, SalesRep, VesselWatch } from "@/lib/types";
import {
  AlertTriangle,
  Anchor,
  Boxes,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  LayoutList,
  Ship,
  Table2,
  Trash2,
  Truck,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { ContainerDialog, type ContainerDraft } from "./ContainerDialog";
import { ContainerSheet } from "./ContainerSheet";
import { SheetEditor, type SheetOps } from "./SheetEditor";
import { DateTimePopover } from "./InlinePopover";

/** Pipeline columns - the stages folded into what the user tracks daily. */
const PIPELINE: { id: string; label: string; stages: ContainerStage[]; icon: React.ReactNode }[] = [
  { id: "before", label: "출항 전", stages: ["planned", "departing", "confirmDeparture"], icon: <Anchor size={15} /> },
  { id: "sailing", label: "운항 중", stages: ["sailing"], icon: <Ship size={15} /> },
  { id: "trucking", label: "배차 필요", stages: ["needsTrucking"], icon: <AlertTriangle size={15} /> },
  { id: "booked", label: "배차 완료", stages: ["truckingBooked"], icon: <Truck size={15} /> },
  { id: "delivered", label: "운송 완료", stages: ["delivered"], icon: <CheckCircle2 size={15} /> },
];

type Tab = "active" | "closed" | "all";

interface Row {
  c: ContainerShipment;
  stage: ContainerStage;
}

function sizeSummary(list: ContainerShipment[]): string {
  const n20 = list.filter((c) => c.size === "20").length;
  const n40 = list.length - n20;
  return [n40 && `40FT ×${n40}`, n20 && `20FT ×${n20}`].filter(Boolean).join(" · ");
}

/** 컨테이너 현황: what's at sea, what needs a truck, what's about to cost
 * demurrage - grouped by vessel, with today's to-dos on top. */
export function ContainerBoard({
  today,
  initialContainers,
  initialVessels,
  customers,
  salesReps,
  portNames,
}: {
  /** Korea-time calendar date, from the server (keeps render pure). */
  today: string;
  initialContainers: ContainerShipment[];
  initialVessels: VesselWatch[];
  customers: Customer[];
  salesReps: SalesRep[];
  portNames: string[];
}) {
  const [containers, setContainers] = useState(initialContainers);
  const [vessels, setVessels] = useState(initialVessels);
  const [tab, setTab] = useState<Tab>("active");
  // 현황 (grouped by vessel) or 시트 (the team's spreadsheet, editable).
  const [view, setView] = useState<"board" | "sheet">("board");
  const [pipe, setPipe] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<{ editing: ContainerShipment | null } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ContainerShipment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [repId] = useRememberedSalesRepId(salesReps);
  const repName = salesReps.find((r) => r.id === repId)?.name;
  const toastSeq = useRef(0);
  const notify = (text: string, action?: ToastMessage["action"]) => setToast({ id: ++toastSeq.current, text, action });

  const vesselById = useMemo(() => new Map(vessels.map((v) => [v.id, v])), [vessels]);
  const summaries = useMemo(() => new Map(vessels.map((v) => [v.id, voyageSummary(v)])), [vessels]);
  const summaryOf = (id: string): VoyageSummary => summaries.get(id) ?? voyageSummary(undefined);

  const rows: Row[] = useMemo(
    () => containers.map((c) => ({ c, stage: containerStage(c, summaries.get(c.vesselWatchId) ?? voyageSummary(undefined), today) })),
    [containers, summaries, today],
  );
  const attention = useMemo(() => attentionItems(containers, vessels, today), [containers, vessels, today]);

  const openRows = rows.filter((r) => r.stage !== "closed");
  const sailing = openRows.filter((r) => r.stage === "sailing");
  const arrivingThisWeek = sailing.filter((r) => {
    const eta = summaryOf(r.c.vesselWatchId).eta;
    return eta && inThisWeek(eta, today);
  });

  const visible = useMemo(() => {
    const q = query.trim();
    const stages = PIPELINE.find((p) => p.id === pipe)?.stages;
    return rows.filter(
      (r) =>
        (tab === "all" || (tab === "closed" ? r.stage === "closed" : r.stage !== "closed")) &&
        (!stages || stages.includes(r.stage)) &&
        (!q ||
          matchesSearch(
            [r.c.importer, r.c.exporter, r.c.containerNo, r.c.hbl, vesselLabel(vesselById.get(r.c.vesselWatchId)), r.c.memo]
              .filter(Boolean)
              .join(" "),
            q,
          )),
    );
  }, [rows, tab, pipe, query, vesselById]);

  // Vessel groups, most urgent first (lowest stage), then by arrival.
  const groups = useMemo(() => {
    const map = new Map<string, Row[]>();
    for (const r of visible) map.set(r.c.vesselWatchId, [...(map.get(r.c.vesselWatchId) ?? []), r]);
    return [...map.entries()]
      .map(([vid, list]) => ({
        vid,
        vessel: vesselById.get(vid),
        rows: list.sort((a, b) => a.c.hbl.localeCompare(b.c.hbl) || a.c.containerNo.localeCompare(b.c.containerNo)),
        urgency: Math.min(...list.map((r) => urgencyRank(r.stage))),
      }))
      .sort(
        (a, b) =>
          a.urgency - b.urgency ||
          (summaryOf(a.vid).eta ?? "9999").localeCompare(summaryOf(b.vid).eta ?? "9999"),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, vesselById, summaries]);

  // ---- writes -------------------------------------------------------------

  async function putContainers(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch("/api/containers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      notify("저장하지 못했어요. 다시 시도해 주세요.");
      return false;
    }
    const { containers: saved } = (await res.json()) as { containers: ContainerShipment[] };
    setContainers((cs) => cs.map((c) => saved.find((s) => s.id === c.id) ?? c));
    window.dispatchEvent(new Event("containers:changed"));
    return true;
  }

  async function putVessel(
    v: VesselWatch,
    calls: VesselWatch["calls"],
    extra?: { vesselName?: string; voyage?: string },
  ): Promise<VesselWatch | null> {
    const res = await fetch("/api/vessels", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: v.id, calls, ...extra, by: repName }),
    });
    if (!res.ok) {
      notify("저장하지 못했어요. 다시 시도해 주세요.");
      return null;
    }
    const saved = (await res.json()) as VesselWatch;
    setVessels((vs) => vs.map((x) => (x.id === saved.id ? saved : x)));
    window.dispatchEvent(new Event("containers:changed"));
    return saved;
  }

  /** 출항 / 입항 확인 (or undo): the confirmed date is the scheduled one if
   * it's already here, else today. */
  async function setActual(v: VesselWatch, which: "departed" | "arrived", on: boolean) {
    const { pol, pod } = voyageEnds(v);
    const call = which === "departed" ? pol : pod;
    if (!call) return;
    const planned = which === "departed" ? call.etd : call.eta;
    const date = planned && planned.slice(0, 10) <= today ? planned : today;
    const saved = await putVessel(
      v,
      v.calls.map((c) => (c.id === call.id ? { ...c, actual: { ...c.actual, [which]: on ? date : undefined } } : c)),
    );
    if (!saved) return;
    const label = which === "departed" ? "출항" : "입항";
    notify(on ? `${vesselLabel(v)} ${label} 확인했어요` : `${label} 확인을 취소했어요`, on ? { label: "되돌리기", onClick: () => setActual(saved, which, false) } : undefined);
  }

  async function changeVesselDate(v: VesselWatch, which: "etd" | "eta", value: string | undefined) {
    const { pol, pod } = voyageEnds(v);
    const call = which === "etd" ? pol : pod;
    if (!call || call[which] === value) return;
    const saved = await putVessel(v, v.calls.map((c) => (c.id === call.id ? { ...c, [which]: value } : c)));
    if (saved) notify(`${which === "etd" ? "출항" : "입항"}일을 ${value ? shortDate(value) : "미정"}(으)로 바꿨어요 · 이 배의 컨테이너 모두 반영`);
  }

  async function setDelivery(c: ContainerShipment, date: string | undefined, time: string | undefined) {
    if (await putContainers({ id: c.id, deliveryDate: date ?? "", deliveryTime: time ?? "" })) {
      notify(date ? `${c.containerNo || "컨테이너"} 운송일 ${shortDate(date)}${time ? ` ${time}` : ""}` : "운송일을 지웠어요");
    }
  }

  async function setFreeTime(c: ContainerShipment, date: string | undefined) {
    if (await putContainers({ id: c.id, freeTimeUntil: date ?? "" })) notify(date ? `프리타임 ${shortDate(date)}까지` : "프리타임을 지웠어요");
  }

  /** 서렌더 / 정산 - shared by the whole HB/L, like the sheet's merged cell. */
  async function toggleFlag(c: ContainerShipment, flag: "surrendered" | "settled") {
    const next = !c[flag];
    const ok = await putContainers(c.hbl ? { hbl: c.hbl, [flag]: next } : { id: c.id, [flag]: next });
    if (ok) {
      const label = flag === "surrendered" ? "서렌더" : "정산";
      notify(`${c.hbl ? `HB/L ${c.hbl} ` : ""}${label} ${next ? "완료" : "미완료"}로 바꿨어요`, {
        label: "되돌리기",
        onClick: () => toggleFlag({ ...c, [flag]: next }, flag),
      });
    }
  }

  async function handleDialogSubmit(draft: ContainerDraft) {
    const editing = dialog?.editing;
    if (editing) {
      const ok = await putContainers({
        id: editing.id,
        vesselWatchId: draft.vesselWatchId,
        ...draft.shared,
        deliveryDate: draft.shared.deliveryDate ?? "",
        deliveryTime: draft.shared.deliveryTime ?? "",
        freeTimeUntil: draft.shared.freeTimeUntil ?? "",
        size: draft.boxes[0].size,
        containerNo: draft.boxes[0].containerNo,
      });
      if (!ok) throw new Error("save failed");
      notify("컨테이너 정보를 저장했어요");
    } else {
      const res = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselWatchId: draft.vesselWatchId,
          vessel: draft.vessel,
          containers: draft.boxes.map((b) => ({ ...draft.shared, ...b })),
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const { containers: created, vessel } = (await res.json()) as { containers: ContainerShipment[]; vessel: VesselWatch | null };
      if (vessel) setVessels((vs) => [vessel, ...vs]);
      setContainers((cs) => [...cs, ...created]);
      setTab("active");
      setPipe(null);
      window.dispatchEvent(new Event("containers:changed"));
      notify(`컨테이너 ${created.length}대를 등록했어요${vessel ? ` · ${vesselLabel(vessel)} 선박 스케줄도 만들었어요` : ""}`);
    }
    setDialog(null);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await fetch(`/api/containers?id=${encodeURIComponent(pendingDelete.id)}`, { method: "DELETE" });
      setContainers((cs) => cs.filter((c) => c.id !== pendingDelete.id));
      window.dispatchEvent(new Event("containers:changed"));
      notify(`${pendingDelete.containerNo || "컨테이너"} 삭제했어요`);
    } finally {
      setDeleting(false);
      setPendingDelete(null);
    }
  }

  // ---- 시트 보기 ------------------------------------------------------------

  const [editor, setEditor] = useState<{ focus?: string } | null>(null);

  /** What the full-screen sheet editor saves through. */
  const sheetOps: SheetOps = {
    async updateContainers(updates) {
      const res = await fetch("/api/containers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: updates.map((u) => ({ id: u.id, ...u.patch })) }),
      });
      if (!res.ok) throw new Error("저장하지 못했어요");
      const { containers: saved } = (await res.json()) as { containers: ContainerShipment[] };
      const byId = new Map(saved.map((c) => [c.id, c]));
      setContainers((cs) => cs.map((c) => byId.get(c.id) ?? c));
      window.dispatchEvent(new Event("containers:changed"));
    },
    async updateVessel(v, patch) {
      const { pol, pod } = voyageEnds(v);
      const calls = v.calls.map((c) => {
        if (c.id === pol?.id)
          return { ...c, ...(patch.pol !== undefined && { portName: patch.pol || c.portName }), ...("etd" in patch && { etd: patch.etd || undefined }) };
        if (c.id === pod?.id)
          return { ...c, ...(patch.pod !== undefined && { portName: patch.pod || c.portName }), ...("eta" in patch && { eta: patch.eta || undefined }) };
        return c;
      });
      const saved = await putVessel(v, calls);
      if (!saved) throw new Error("선박 일정을 저장하지 못했어요");
      return saved;
    },
    async createVessel(spec) {
      const res = await fetch("/api/vessels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vesselName: spec.vesselName,
          voyage: spec.voyage,
          calls: [
            { portName: spec.pol || "선적지", kind: "POL", etd: spec.etd },
            { portName: spec.pod || "양하지", kind: "POD", eta: spec.eta },
          ],
        }),
      });
      if (!res.ok) throw new Error("선박을 만들지 못했어요");
      const created = (await res.json()) as VesselWatch;
      setVessels((vs) => [created, ...vs]);
      return created;
    },
    async createContainers(vesselWatchId, rows) {
      const res = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vesselWatchId, containers: rows }),
      });
      if (!res.ok) throw new Error("행을 저장하지 못했어요");
      const { containers: created } = (await res.json()) as { containers: ContainerShipment[] };
      setContainers((cs) => [...cs, ...created]);
      window.dispatchEvent(new Event("containers:changed"));
      return created;
    },
    async deleteContainers(ids) {
      const res = await fetch(`/api/containers?ids=${ids.map(encodeURIComponent).join(",")}`, { method: "DELETE" });
      if (!res.ok) throw new Error("삭제하지 못했어요");
      const gone = new Set(ids);
      setContainers((cs) => cs.filter((c) => !gone.has(c.id)));
      window.dispatchEvent(new Event("containers:changed"));
    },
  };

  // Sheet preview: entry order (the sheet's NO), numbered as in the editor.
  const order = new Map(containers.map((c, i) => [c.id, i]));
  const sheetRows = [...visible].sort((a, b) => (order.get(a.c.id) ?? 0) - (order.get(b.c.id) ?? 0));

  // ---- render -------------------------------------------------------------

  const closedCount = rows.length - openRows.length;
  const actions: RowActions = {
    today,
    onDelivery: setDelivery,
    onFreeTime: setFreeTime,
    onToggle: toggleFlag,
    onEdit: (c) => setDialog({ editing: c }),
    onDelete: setPendingDelete,
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Overview: at sea now + the pipeline */}
      <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="grid lg:grid-cols-[260px_1fr]">
          <div className="relative p-4 sm:p-6 bg-gradient-to-br from-[#0b63c9] to-[#0071e3] text-white overflow-hidden">
            <Ship size={120} strokeWidth={1} className="absolute -right-6 -bottom-8 text-white/10" aria-hidden />
            <p className="text-[12.5px] font-medium text-white/80">지금 바다 위</p>
            <p className="mt-1 text-[34px] sm:text-[40px] leading-none font-semibold tracking-tight tabular-nums">
              {sailing.length}
              <span className="ml-1 text-[17px] font-medium text-white/80">대</span>
            </p>
            <p className="mt-2 text-[12.5px] text-white/85">{sailing.length ? sizeSummary(sailing.map((r) => r.c)) : "운항 중인 컨테이너가 없어요"}</p>
            <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium">
              <CalendarClock size={13} /> 이번 주 입항 예정 {arrivingThisWeek.length}대
            </div>
          </div>
          <div className="p-2 sm:p-4 grid grid-cols-5 gap-1.5 sm:gap-2">
            {PIPELINE.map((p, i) => {
              const list = openRows.filter((r) => p.stages.includes(r.stage));
              const urgent = p.id === "trucking" ? list.length : p.id === "before" ? list.filter((r) => r.stage === "confirmDeparture").length : 0;
              const active = pipe === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPipe(active ? null : p.id);
                    setTab("active");
                  }}
                  aria-pressed={active}
                  className={cn(
                    "group relative text-left rounded-[10px] sm:rounded-[var(--radius-md)] border px-2 sm:px-3.5 py-2.5 sm:py-3 transition-all",
                    active
                      ? "border-[var(--accent)] bg-[var(--accent-soft)]/60 ring-2 ring-[var(--accent-soft)]"
                      : "border-transparent bg-[var(--sidebar-bg)]/70 hover:bg-[var(--sidebar-bg)] hover:border-[var(--border-subtle)]",
                  )}
                >
                  <span className={cn("flex items-center gap-1.5 text-[11px] sm:text-[12.5px] font-medium whitespace-nowrap", urgent ? "text-[var(--danger)]" : "text-[var(--muted)]")}>
                    <span className="max-sm:hidden">{p.icon}</span>
                    {p.label}
                  </span>
                  <span className="mt-1.5 flex items-baseline gap-1">
                    <span className={cn("text-[20px] sm:text-[24px] font-semibold tracking-tight tabular-nums", list.length ? "text-[var(--foreground)]" : "text-[#c7c7cc]")}>
                      {list.length}
                    </span>
                    <span className="text-[12px] text-[var(--muted)]">대</span>
                  </span>
                  <span className="mt-0.5 block text-[10.5px] sm:text-[11.5px] text-[var(--muted)] truncate max-sm:hidden">
                    {p.id === "before" && urgent ? <span className="text-[var(--danger)] font-medium">확인 필요 {urgent}대</span> : sizeSummary(list.map((r) => r.c)) || " "}
                  </span>
                  {i < PIPELINE.length - 1 && (
                    <ChevronRight size={14} className="hidden sm:block absolute -right-[11px] top-1/2 -translate-y-1/2 z-10 text-[#c7c7cc]" aria-hidden />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Today's to-dos */}
      <AttentionPanel
        items={attention}
        vesselById={vesselById}
        containers={containers}
        onConfirmDeparture={(v) => setActual(v, "departed", true)}
        onChangeEtd={(v, d) => changeVesselDate(v, "etd", d)}
        onDelivery={setDelivery}
        onToggle={toggleFlag}
      />

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 pt-1">
        <div className="flex items-center gap-2 self-start">
          <div className="inline-flex p-1 rounded-full bg-[var(--foreground)]/[0.06] text-[13px] font-medium" role="tablist" aria-label="보기">
            {(
              [
                ["board", "현황", <LayoutList key="b" size={14} />],
                ["sheet", "시트", <Table2 key="s" size={14} />],
              ] as const
            ).map(([v, label, icon]) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 h-8 rounded-full transition-colors",
                  view === v ? "bg-[var(--foreground)] text-white shadow-sm" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
          <div className="inline-flex p-1 rounded-full bg-[var(--sidebar-bg)] text-[13px] font-medium">
            {(
              [
                ["active", `진행 중 ${openRows.length}`],
                ["closed", `종료 ${closedCount}`],
                ["all", "전체"],
              ] as const
            ).map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "px-3.5 h-8 rounded-full transition-colors",
                  tab === t ? "bg-white shadow-sm text-[var(--foreground)]" : "text-[var(--muted)] hover:text-[var(--foreground)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {pipe && (
          <button
            type="button"
            onClick={() => setPipe(null)}
            className="self-start sm:self-auto inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-3 h-8 text-[12.5px] font-medium text-[var(--accent)]"
          >
            {PIPELINE.find((p) => p.id === pipe)?.label}만 보기 ✕
          </button>
        )}
        <div className="flex gap-2 sm:ml-auto">
          <div className="relative flex-1 sm:w-[260px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="수입자·CTNS·HB/L·선박 검색"
              aria-label="컨테이너 검색"
              className="pl-9"
            />
          </div>
          <Button onClick={() => setDialog({ editing: null })} icon={<Plus size={16} />} className="shrink-0">
            <span className="max-sm:hidden">컨테이너 </span>등록
          </Button>
        </div>
      </div>

      {view === "sheet" ? (
        <ContainerSheet
          rows={sheetRows.map((r) => ({ ...r, no: (order.get(r.c.id) ?? 0) + 1 }))}
          vessels={vessels}
          today={today}
          onOpen={(id) => setEditor({ focus: id })}
        />
      ) : groups.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border)] bg-white py-16 px-6 text-center">
          <span className="mx-auto w-12 h-12 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center">
            <Boxes size={22} />
          </span>
          <p className="mt-3 text-[15px] font-medium text-[var(--foreground)]">
            {containers.length === 0 ? "등록된 컨테이너가 없어요" : "조건에 맞는 컨테이너가 없어요"}
          </p>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            {containers.length === 0
              ? "선박과 HB/L, 컨테이너 번호를 등록하면 출항부터 배차·프리타임까지 한눈에 챙겨 드려요."
              : "검색어나 필터를 바꿔 보세요."}
          </p>
          {containers.length === 0 && (
            <Button onClick={() => setDialog({ editing: null })} icon={<Plus size={16} />} className="mx-auto mt-5">
              첫 컨테이너 등록
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-3 sm:space-y-4">
          {groups.map((g) => (
            <VesselGroup
              key={g.vid}
              vessel={g.vessel}
              summary={summaryOf(g.vid)}
              rows={g.rows}
              today={today}
              actions={actions}
              onActual={(which, on) => g.vessel && setActual(g.vessel, which, on)}
              onChangeDate={async (which, d) => {
                if (g.vessel) await changeVesselDate(g.vessel, which, d);
              }}
            />
          ))}
        </ul>
      )}

      <ContainerDialog
        open={dialog !== null}
        editing={dialog?.editing ?? null}
        vessels={vessels}
        customers={customers}
        portNames={portNames}
        onClose={() => setDialog(null)}
        onSubmit={handleDialogSubmit}
      />
      <SheetEditor
        open={editor !== null}
        onClose={() => setEditor(null)}
        containers={containers}
        vessels={vessels}
        today={today}
        ops={sheetOps}
        focusContainerId={editor?.focus}
      />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="이 컨테이너를 삭제할까요?"
        description={pendingDelete ? `${pendingDelete.containerNo || "컨테이너"} (${pendingDelete.importer})의 기록이 삭제됩니다.` : undefined}
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
      <Toast message={toast} onDismiss={() => setToast(null)} durationMs={4000} />
    </div>
  );
}

function urgencyRank(s: ContainerStage): number {
  const order: ContainerStage[] = ["confirmDeparture", "needsTrucking", "departing", "sailing", "truckingBooked", "planned", "delivered", "closed"];
  return order.indexOf(s);
}

// ---------------------------------------------------------------------------

function AttentionPanel({
  items,
  vesselById,
  containers,
  onConfirmDeparture,
  onChangeEtd,
  onDelivery,
  onToggle,
}: {
  items: AttentionItem[];
  vesselById: Map<string, VesselWatch>;
  containers: ContainerShipment[];
  onConfirmDeparture: (v: VesselWatch) => void;
  onChangeEtd: (v: VesselWatch, date: string | undefined) => Promise<void>;
  onDelivery: (c: ContainerShipment, date: string | undefined, time: string | undefined) => Promise<void>;
  onToggle: (c: ContainerShipment, flag: "surrendered" | "settled") => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? items : items.slice(0, 5);
  if (items.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white px-4 sm:px-5 py-3.5">
        <span className="w-8 h-8 rounded-full bg-green-50 text-[var(--success)] flex items-center justify-center shrink-0">
          <Check size={16} />
        </span>
        <p className="text-[13.5px] text-[var(--foreground)]">
          오늘 확인할 일이 없어요. <span className="text-[var(--muted)]">출항 임박·배차·프리타임은 여기에 모여요.</span>
        </p>
      </div>
    );
  }
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b border-[var(--border-subtle)]">
        <p className="text-[14px] font-semibold text-[var(--foreground)]">
          오늘 확인할 일 <span className="ml-1 text-[var(--danger)] tabular-nums">{items.length}</span>
        </p>
        <p className="hidden sm:block text-[12px] text-[var(--muted)]">매일 아침 메신저로도 알려드려요</p>
      </div>
      <ul className="divide-y divide-[var(--border-subtle)]">
        {shown.map((item) => {
          const vessel = vesselById.get(item.vesselWatchId);
          const first = containers.find((c) => c.id === item.containerIds[0]);
          const etd = voyageSummary(vessel).etd;
          return (
            <li key={item.key} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 sm:px-5 py-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span
                  className={cn(
                    "mt-1.5 w-2 h-2 rounded-full shrink-0",
                    item.severity === "danger" ? "bg-[var(--danger)] shadow-[0_0_0_4px_rgba(215,0,21,0.1)]" : "bg-[#f5a623] shadow-[0_0_0_4px_rgba(245,166,35,0.15)]",
                  )}
                />
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium text-[var(--foreground)] truncate">{item.title}</p>
                  <p className="text-[12.5px] text-[var(--muted)] truncate">{item.detail}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 pl-5 sm:pl-0 shrink-0">
                {(item.kind === "confirmDeparture" || item.kind === "departing") && vessel && (
                  <>
                    <DateTimePopover
                      title="출항일 변경 (지연·앞당김)"
                      date={etd?.slice(0, 10)}
                      onSave={(d) => onChangeEtd(vessel, d)}
                      trigger={(p) => (
                        <Button size="sm" variant="secondary" {...p}>
                          일정 변경
                        </Button>
                      )}
                    />
                    <Button size="sm" onClick={() => onConfirmDeparture(vessel)} icon={<Check size={14} />}>
                      출항 확인
                    </Button>
                  </>
                )}
                {(item.kind === "needsTrucking" || item.kind === "freeTime") && first && (
                  <DateTimePopover
                    title="운송일 · 시간"
                    withTime
                    date={first.deliveryDate}
                    time={first.deliveryTime}
                    onSave={(d, t) => onDelivery(first, d, t)}
                    trigger={(p) => (
                      <Button size="sm" variant={item.kind === "needsTrucking" ? "primary" : "secondary"} icon={<Truck size={14} />} {...p}>
                        {first.deliveryDate ? "운송일 변경" : "운송일 입력"}
                      </Button>
                    )}
                  />
                )}
                {item.kind === "surrender" && first && (
                  <Button size="sm" onClick={() => onToggle(first, "surrendered")} icon={<Check size={14} />}>
                    서렌더 완료
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="w-full py-2.5 text-[12.5px] font-medium text-[var(--accent)] border-t border-[var(--border-subtle)] hover:bg-[var(--sidebar-bg)]/60"
        >
          {expanded ? "접기" : `${items.length - 5}건 더 보기`}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

interface RowActions {
  today: string;
  onDelivery: (c: ContainerShipment, date: string | undefined, time: string | undefined) => Promise<void>;
  onFreeTime: (c: ContainerShipment, date: string | undefined) => Promise<void>;
  onToggle: (c: ContainerShipment, flag: "surrendered" | "settled") => void;
  onEdit: (c: ContainerShipment) => void;
  onDelete: (c: ContainerShipment) => void;
}

function VesselGroup({
  vessel,
  summary: v,
  rows,
  today,
  actions,
  onActual,
  onChangeDate,
}: {
  vessel: VesselWatch | undefined;
  summary: VoyageSummary;
  rows: Row[];
  today: string;
  actions: RowActions;
  onActual: (which: "departed" | "arrived", on: boolean) => void;
  onChangeDate: (which: "etd" | "eta", date: string | undefined) => Promise<void>;
}) {
  const arrived = hasArrived(v, today);
  // Voyage progress for the route line: 0 before departure, 100 on arrival.
  let progress = 0;
  if (arrived) progress = 100;
  else if (v.departed && v.etd && v.eta) {
    const total = daysUntil(v.eta, v.etd);
    const done = daysUntil(today, v.etd);
    progress = total > 0 ? Math.min(92, Math.max(8, (done / total) * 100)) : 50;
  } else if (v.departed) progress = 50;
  const delayed = (v.etdDelay ?? 0) > 0 || (v.etaDelay ?? 0) > 0;
  const hblCount = new Set(rows.map((r) => r.c.hbl).filter(Boolean)).size;

  return (
    <li className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-white overflow-hidden shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
      {/* Vessel header */}
      <div className="px-4 sm:px-5 pt-4 pb-3.5 bg-gradient-to-b from-[#f8fafc] to-white border-b border-[var(--border-subtle)]">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-7 h-7 rounded-full bg-[var(--accent-soft)] text-[var(--accent)] flex items-center justify-center shrink-0">
              <Ship size={14} />
            </span>
            <p className="text-[15px] font-semibold tracking-tight text-[var(--foreground)] truncate">{vessel?.vesselName ?? "선박 미지정"}</p>
            {vessel?.voyage && <span className="text-[13.5px] font-medium text-[var(--muted)] tabular-nums">{vessel.voyage}</span>}
            {delayed && <Badge tone="danger" className="px-2 py-0.5 text-[11px]">일정 지연</Badge>}
          </div>
          <p className="text-[12.5px] text-[var(--muted)]">
            {sizeSummary(rows.map((r) => r.c))}
            {hblCount > 0 && ` · HB/L ${hblCount}건`}
          </p>
        </div>

        {/* Route: POL ——ship—— POD */}
        <div className="mt-3.5 flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2">
          <RouteEnd
            port={v.pol ?? "선적지"}
            label="출항"
            date={v.etd}
            delay={v.etdDelay}
            confirmed={v.departed}
            canConfirm={Boolean(vessel && !v.departed && v.etd && daysUntil(v.etd, today) <= 2)}
            onConfirm={(on) => onActual("departed", on)}
            onChangeDate={(d) => onChangeDate("etd", d)}
          />
          <div className="relative order-last sm:order-none basis-full sm:basis-auto sm:flex-1 h-6 min-w-[40px] mx-3" aria-hidden>
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--border-subtle)]" />
            <div className="absolute left-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${progress}%` }} />
            <span
              className={cn(
                "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center shadow-sm ring-2 ring-white transition-[left] duration-500",
                v.departed || arrived ? "bg-[var(--accent)] text-white" : "bg-white text-[var(--muted)] border border-[var(--border)]",
              )}
              style={{ left: `${progress}%` }}
            >
              <Ship size={12} />
            </span>
          </div>
          <RouteEnd
            align="right"
            port={v.pod ?? "양하지"}
            label="입항"
            date={v.eta}
            delay={v.etaDelay}
            confirmed={v.arrived}
            canConfirm={Boolean(vessel && v.departed && !v.arrived && v.eta && daysUntil(v.eta, today) <= 1)}
            onConfirm={(on) => onActual("arrived", on)}
            onChangeDate={(d) => onChangeDate("eta", d)}
          />
        </div>
      </div>

      {/* Wide screens: the sheet, cleaned up - fixed columns so every vessel's
          table lines up with the next. */}
      <div className="hidden xl:block">
        <table className="w-full table-fixed text-left text-[13px]">
          <colgroup>
            <col className="w-[124px]" />
            <col />
            <col className="w-[168px]" />
            <col className="w-[128px]" />
            <col className="w-[116px]" />
            <col className="w-[132px]" />
            <col className="w-[92px]" />
            <col className="w-[92px]" />
            <col className="w-[72px]" />
          </colgroup>
          <thead>
            <tr className="text-[11.5px] text-[var(--muted)] border-b border-[var(--border-subtle)]">
              <th className="pl-5 pr-2 py-2 font-medium whitespace-nowrap">단계</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">수입자 / 수출자</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">컨테이너</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">HB/L</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">프리타임</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap">운송</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap text-center">서렌더</th>
              <th className="px-2 py-2 font-medium whitespace-nowrap text-center">정산</th>
              <th className="pr-3 py-2 w-[72px]" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const firstOfHbl = i === 0 || rows[i - 1].c.hbl !== r.c.hbl || !r.c.hbl;
              const span = r.c.hbl ? rows.slice(i).findIndex((x) => x.c.hbl !== r.c.hbl) : 1;
              const rowSpan = span === -1 ? rows.length - i : Math.max(1, span);
              // One HB/L reads as one block (like the sheet's merged rows).
              const lastOfHbl = i === rows.length - 1 || rows[i + 1].c.hbl !== r.c.hbl || !r.c.hbl;
              return (
                <tr
                  key={r.c.id}
                  className={cn("group hover:bg-[#fafbfc] transition-colors", lastOfHbl && i < rows.length - 1 && "border-b border-[var(--border-subtle)]")}
                >
                  <td className="pl-5 pr-2 py-2.5 whitespace-nowrap">
                    <StageBadge stage={r.stage} />
                  </td>
                  <td className="px-2 py-2.5">
                    <p className="font-medium text-[var(--foreground)] truncate" title={r.c.importer}>
                      {r.c.importer || "-"}
                    </p>
                    <p className="text-[11.5px] text-[var(--muted)] truncate" title={[r.c.exporter, r.c.memo].filter(Boolean).join(" · ")}>
                      {r.c.exporter || "-"}
                      {r.c.memo && <span className="text-[var(--accent)]"> · {r.c.memo}</span>}
                    </p>
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <ContainerNo c={r.c} />
                  </td>
                  {firstOfHbl && (
                    <td rowSpan={rowSpan} className="px-2 py-2.5 whitespace-nowrap align-middle border-l border-dashed border-[var(--border-subtle)]">
                      <span className="font-mono text-[12.5px] tracking-tight text-[var(--foreground)]">{r.c.hbl || "-"}</span>
                    </td>
                  )}
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <FreeTimeCell c={r.c} actions={actions} />
                  </td>
                  <td className="px-2 py-2.5 whitespace-nowrap">
                    <DeliveryCell c={r.c} stage={r.stage} actions={actions} />
                  </td>
                  {firstOfHbl && (
                    <>
                      <td rowSpan={rowSpan} className="px-2 py-2.5 text-center align-middle border-l border-dashed border-[var(--border-subtle)]">
                        <FlagToggle on={r.c.surrendered} label="서렌더" onClick={() => actions.onToggle(r.c, "surrendered")} />
                      </td>
                      <td rowSpan={rowSpan} className="px-2 py-2.5 text-center align-middle">
                        <FlagToggle on={r.c.settled} label="정산" onClick={() => actions.onToggle(r.c, "settled")} />
                      </td>
                    </>
                  )}
                  <td className="pr-3 py-2.5 whitespace-nowrap text-right">
                    <span className="inline-flex">
                      <IconAction label="수정" tooltip="수정" reveal onClick={() => actions.onEdit(r.c)}>
                        <Pencil size={14} />
                      </IconAction>
                      <IconAction label="삭제" tooltip="삭제" reveal onClick={() => actions.onDelete(r.c)} hoverClass="hover:text-[var(--danger)] hover:bg-red-50">
                        <Trash2 size={14} />
                      </IconAction>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Phone / tablet / narrow desktop: one compact card per container */}
      <ul className="xl:hidden grid sm:grid-cols-2 gap-px bg-[var(--border-subtle)]">
        {rows.map((r) => (
          <li key={r.c.id} className="bg-white px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <ContainerNo c={r.c} />
              <StageBadge stage={r.stage} />
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[13.5px] font-medium text-[var(--foreground)]">
                {r.c.importer || "-"}
                {r.c.hbl && <span className="ml-1.5 font-mono text-[12px] font-normal text-[var(--muted)]">{r.c.hbl}</span>}
              </p>
              <button type="button" onClick={() => actions.onEdit(r.c)} aria-label="수정" className="w-8 h-8 -mr-1.5 shrink-0 inline-flex items-center justify-center rounded-full text-[var(--muted)] active:bg-[var(--sidebar-bg)]">
                <Pencil size={14} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <FreeTimeCell c={r.c} actions={actions} />
              <DeliveryCell c={r.c} stage={r.stage} actions={actions} />
              <FlagToggle on={r.c.surrendered} label="서렌더" compact onClick={() => actions.onToggle(r.c, "surrendered")} />
              <FlagToggle on={r.c.settled} label="정산" compact onClick={() => actions.onToggle(r.c, "settled")} />
            </div>
          </li>
        ))}
      </ul>
    </li>
  );
}

function RouteEnd({
  port,
  label,
  date,
  delay,
  confirmed,
  canConfirm,
  onConfirm,
  onChangeDate,
  align = "left",
}: {
  port: string;
  label: "출항" | "입항";
  date?: string;
  delay: number | null;
  confirmed?: string;
  canConfirm: boolean;
  onConfirm: (on: boolean) => void;
  onChangeDate: (date: string | undefined) => Promise<void>;
  align?: "left" | "right";
}) {
  return (
    <div className={cn("shrink-0 min-w-0", align === "right" && "text-right ml-auto sm:ml-0")}>
      <p className="text-[13.5px] font-semibold text-[var(--foreground)]">{port}</p>
      <div className={cn("mt-0.5 flex items-center gap-1.5", align === "right" && "justify-end")}>
        <DateTimePopover
          title={`${port} ${label}일`}
          date={date?.slice(0, 10)}
          onSave={(d) => onChangeDate(d)}
          trigger={(p) => (
            <button type="button" {...p} className="group/d inline-flex items-center gap-1 rounded-md px-1 -mx-1 text-[12.5px] tabular-nums hover:bg-[var(--sidebar-bg)]">
              <span className="text-[var(--muted)]">{label}</span>
              <span className="font-medium text-[var(--foreground)]">{date ? shortDate(date) : "미정"}</span>
              {delay !== null && delay !== 0 && (
                <span className={cn("rounded-full px-1.5 text-[10.5px] font-semibold", delay > 0 ? "bg-[var(--danger)]/[0.08] text-[var(--danger)]" : "bg-[var(--accent-soft)] text-[var(--accent)]")}>
                  {delay > 0 ? `+${delay}일` : `${delay}일`}
                </span>
              )}
              <Pencil size={10} className="text-[var(--muted)] opacity-0 group-hover/d:opacity-100" />
            </button>
          )}
        />
        {confirmed ? (
          <button
            type="button"
            onClick={() => onConfirm(false)}
            title={`${label} 확인됨 (${shortDate(confirmed)}) · 클릭하면 취소`}
            className="inline-flex items-center gap-0.5 rounded-full bg-green-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--success)]"
          >
            <Check size={10} strokeWidth={3} /> {label === "출항" ? "출항함" : "입항함"}
          </button>
        ) : (
          canConfirm && (
            <button
              type="button"
              onClick={() => onConfirm(true)}
              className="inline-flex items-center gap-0.5 rounded-full border border-[var(--accent)]/40 bg-white px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent)] hover:bg-[var(--accent-soft)]"
            >
              {label} 확인
            </button>
          )
        )}
      </div>
    </div>
  );
}

const STAGE_TONE: Record<string, string> = {
  neutral: "bg-[var(--sidebar-bg)] text-[var(--muted)]",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)]",
  warning: "bg-amber-50 text-[var(--warning)]",
  danger: "bg-red-50 text-[var(--danger)]",
  success: "bg-green-50 text-[var(--success)]",
};

function StageBadge({ stage }: { stage: ContainerStage }) {
  const meta = STAGE_META[stage];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", STAGE_TONE[meta.tone])}>
      <span className={cn("w-1.5 h-1.5 rounded-full bg-current", (stage === "sailing" || stage === "needsTrucking" || stage === "confirmDeparture") && "animate-pulse")} />
      {meta.label}
    </span>
  );
}

function ContainerNo({ c }: { c: ContainerShipment }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-5 items-center rounded-[5px] bg-[var(--foreground)] px-1.5 text-[10.5px] font-bold tracking-wide text-white">{c.size}FT</span>
      <span className="font-mono text-[13px] tracking-tight text-[var(--foreground)]">{c.containerNo || "번호 미입력"}</span>
    </span>
  );
}

function FreeTimeCell({ c, actions }: { c: ContainerShipment; actions: RowActions }) {
  const ft = freeTimeStatus(c, actions.today);
  const tone =
    ft.state === "over" || ft.state === "willExceed"
      ? "bg-red-50 text-[var(--danger)] border-red-100"
      : ft.state === "soon"
        ? "bg-amber-50 text-[var(--warning)] border-amber-100"
        : ft.state === "safe"
          ? "bg-green-50 text-[var(--success)] border-green-100"
          : "bg-white text-[var(--foreground)] border-[var(--border-subtle)]";
  return (
    <DateTimePopover
      title="프리타임 (마지막 무료일)"
      date={c.freeTimeUntil}
      onSave={(d) => actions.onFreeTime(c, d)}
      trigger={(p) => (
        <button
          type="button"
          {...p}
          title={ft.state === "willExceed" ? "운송일이 프리타임보다 늦어요" : ft.state === "safe" ? "프리타임 안에 운송 예정" : undefined}
          className={cn("inline-flex items-center gap-1.5 h-7 rounded-full border px-2.5 text-[12px] tabular-nums transition-colors hover:brightness-[0.97]", c.freeTimeUntil ? tone : "border-dashed border-[var(--border)] text-[var(--muted)]")}
        >
          {c.freeTimeUntil ? (
            <>
              <span className="font-medium">{shortDate(c.freeTimeUntil)}</span>
              {ft.days !== null && ft.state !== "safe" && <span className="font-semibold">{dDay(ft.days)}</span>}
              {ft.state === "safe" && <Check size={12} strokeWidth={3} />}
            </>
          ) : (
            "프리타임"
          )}
        </button>
      )}
    />
  );
}

function DeliveryCell({ c, stage, actions }: { c: ContainerShipment; stage: ContainerStage; actions: RowActions }) {
  return (
    <DateTimePopover
      title="운송일 · 시간"
      withTime
      date={c.deliveryDate}
      time={c.deliveryTime}
      onSave={(d, t) => actions.onDelivery(c, d, t)}
      trigger={(p) =>
        c.deliveryDate ? (
          <button type="button" {...p} className="inline-flex items-center gap-1.5 h-7 rounded-full border border-[var(--border-subtle)] bg-white px-2.5 text-[12px] tabular-nums hover:bg-[var(--sidebar-bg)]">
            <Truck size={12} className="text-[var(--muted)]" />
            <span className="font-medium text-[var(--foreground)]">{shortDate(c.deliveryDate)}</span>
            {c.deliveryTime && <span className="text-[var(--muted)]">{c.deliveryTime}</span>}
          </button>
        ) : (
          <button
            type="button"
            {...p}
            className={cn(
              "inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[12px] font-medium transition-colors",
              stage === "needsTrucking"
                ? "bg-[var(--danger)] text-white hover:bg-[var(--danger-hover)]"
                : "border border-dashed border-[var(--border)] text-[var(--muted)] hover:text-[var(--foreground)]",
            )}
          >
            <Truck size={12} /> {stage === "needsTrucking" ? "배차 입력" : "운송일"}
          </button>
        )
      }
    />
  );
}

function FlagToggle({ on, label, onClick, compact }: { on: boolean; label: string; onClick: () => void; compact?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 h-7 rounded-full px-2.5 text-[12px] font-medium transition-all",
        on ? "bg-green-50 text-[var(--success)] hover:bg-green-100" : "border border-[var(--border)] text-[var(--muted)] hover:border-[var(--foreground)]/30 hover:text-[var(--foreground)]",
      )}
    >
      {on ? <Check size={12} strokeWidth={3} /> : <span className="w-1.5 h-1.5 rounded-full border border-current" />}
      {compact ? label : on ? "완료" : "미완료"}
    </button>
  );
}
