import type { ContainerShipment, VesselPortCall, VesselWatch } from "./types";
import { delayDays } from "./vessels";

/** Where a container is in its journey - one stage at a time, in order. */
export type ContainerStage =
  | "planned"
  | "departing"
  | "confirmDeparture"
  | "sailing"
  | "needsTrucking"
  | "truckingBooked"
  | "delivered"
  | "closed";

export const STAGE_META: Record<
  ContainerStage,
  { label: string; tone: "neutral" | "accent" | "warning" | "danger" | "success"; order: number }
> = {
  planned: { label: "출항 예정", tone: "neutral", order: 0 },
  departing: { label: "출항 임박", tone: "warning", order: 1 },
  confirmDeparture: { label: "출항 확인 필요", tone: "danger", order: 2 },
  sailing: { label: "운항 중", tone: "accent", order: 3 },
  needsTrucking: { label: "배차 필요", tone: "danger", order: 4 },
  truckingBooked: { label: "배차 완료", tone: "success", order: 5 },
  delivered: { label: "운송 완료", tone: "neutral", order: 6 },
  closed: { label: "종료", tone: "neutral", order: 7 },
};

/** Days before ETD that count as 출항 임박. */
const DEPARTING_WITHIN_DAYS = 2;
/** Free time this close (or past) is flagged. */
const FREE_TIME_WARN_DAYS = 3;

function dayNumber(d: string): number {
  return Math.round(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** Whole days from `today` to `date` (+ = ahead, - = past). */
export function daysUntil(date: string, today: string): number {
  return dayNumber(date) - dayNumber(today);
}

/** The vessel's loading / discharge calls (출발항 / 도착항). */
export function voyageEnds(vessel: VesselWatch | undefined): { pol?: VesselPortCall; pod?: VesselPortCall } {
  if (!vessel) return {};
  const pol = vessel.calls.find((c) => c.kind === "POL") ?? vessel.calls[0];
  const pod = vessel.calls.find((c) => c.kind === "POD") ?? vessel.calls[vessel.calls.length - 1];
  return { pol, pod: pod === pol ? undefined : pod };
}

/** A vessel's schedule as the container page reads it. */
export interface VoyageSummary {
  pol?: string;
  pod?: string;
  etd?: string;
  eta?: string;
  departed?: string;
  arrived?: string;
  /** + days late vs. the first announced date (null = unchanged / unknown) */
  etdDelay: number | null;
  etaDelay: number | null;
}

export function voyageSummary(vessel: VesselWatch | undefined): VoyageSummary {
  const { pol, pod } = voyageEnds(vessel);
  return {
    pol: pol?.portName,
    pod: pod?.portName,
    etd: pol?.etd,
    eta: pod?.eta,
    departed: pol?.actual?.departed,
    arrived: pod?.actual?.arrived,
    etdDelay: pol ? delayDays(pol, "etd") : null,
    etaDelay: pod ? delayDays(pod, "eta") : null,
  };
}

/** Has the ship reached the discharge port - confirmed, or its ETA is here. */
export function hasArrived(v: VoyageSummary, today: string): boolean {
  return Boolean(v.arrived) || Boolean(v.eta && daysUntil(v.eta, today) <= 0);
}

export function containerStage(c: ContainerShipment, v: VoyageSummary, today: string): ContainerStage {
  if (c.deliveryDate) {
    if (daysUntil(c.deliveryDate, today) >= 0) return "truckingBooked";
    return c.settled ? "closed" : "delivered";
  }
  if (hasArrived(v, today)) return "needsTrucking";
  if (v.departed) return "sailing";
  if (v.etd) {
    const d = daysUntil(v.etd, today);
    if (d < 0) return "confirmDeparture";
    if (d <= DEPARTING_WITHIN_DAYS) return "departing";
  }
  return "planned";
}

export type FreeTimeState = "none" | "safe" | "ok" | "soon" | "over" | "willExceed";

/** Free time runs this many days from the 입항일 unless a date is typed. */
export const FREE_TIME_DAYS = 10;

export function addDays(iso: string, n: number): string {
  return new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** The container's last free day: the date typed for it, else 입항일 +
 * FREE_TIME_DAYS (auto - it follows the vessel's ETA when that moves). */
export function effectiveFreeTime(c: ContainerShipment, v: VoyageSummary): { date?: string; auto: boolean } {
  if (c.freeTimeUntil) return { date: c.freeTimeUntil, auto: false };
  if (v.eta) return { date: addDays(v.eta, FREE_TIME_DAYS), auto: true };
  return { auto: true };
}

/** Free time against today: only a concern until the container is trucked
 * out on or before its last free day. */
export function freeTimeStatus(
  c: ContainerShipment,
  today: string,
  v: VoyageSummary,
): { state: FreeTimeState; days: number | null; date?: string; auto: boolean } {
  const { date, auto } = effectiveFreeTime(c, v);
  if (!date) return { state: "none", days: null, auto };
  const days = daysUntil(date, today);
  if (c.deliveryDate) {
    // Already planned / done: fine if it leaves in time, a warning if not.
    return { state: c.deliveryDate <= date ? "safe" : "willExceed", days, date, auto };
  }
  if (days < 0) return { state: "over", days, date, auto };
  if (days <= FREE_TIME_WARN_DAYS) return { state: "soon", days, date, auto };
  return { state: "ok", days, date, auto };
}

/** "D-3", "D-day", "D+2" */
export function dDay(days: number): string {
  return days === 0 ? "D-day" : days > 0 ? `D-${days}` : `D+${-days}`;
}

export type AttentionKind = "confirmDeparture" | "departing" | "needsTrucking" | "freeTime" | "surrender";

export interface AttentionItem {
  key: string;
  kind: AttentionKind;
  severity: "danger" | "warning";
  title: string;
  detail: string;
  vesselWatchId: string;
  /** Containers this item is about (a whole vessel, an HB/L or one box). */
  containerIds: string[];
  hbl?: string;
}

/** Everything that needs a person to act today - shared by the page's
 * 확인 필요 list, the nav badge, the dashboard and the daily alert. */
export function attentionItems(
  containers: ContainerShipment[],
  vessels: VesselWatch[],
  today: string,
): AttentionItem[] {
  const byId = new Map(vessels.map((v) => [v.id, v]));
  const items: AttentionItem[] = [];
  const open = containers.filter((c) => !(c.settled && c.deliveryDate && daysUntil(c.deliveryDate, today) < 0));

  // Departure checks are per vessel - one confirmation covers every box on it.
  const perVessel = new Map<string, ContainerShipment[]>();
  for (const c of open) perVessel.set(c.vesselWatchId, [...(perVessel.get(c.vesselWatchId) ?? []), c]);
  for (const [vid, list] of perVessel) {
    const vessel = byId.get(vid);
    const v = voyageSummary(vessel);
    const stages = list.map((c) => containerStage(c, v, today));
    const name = vesselLabel(vessel);
    if (stages.includes("confirmDeparture") || stages.includes("departing")) {
      const overdue = stages.includes("confirmDeparture");
      const d = v.etd ? daysUntil(v.etd, today) : 0;
      items.push({
        key: `dep:${vid}`,
        kind: overdue ? "confirmDeparture" : "departing",
        severity: overdue ? "danger" : "warning",
        title: overdue ? `${name} 출항 확인 필요` : `${name} 출항 임박`,
        detail: `${v.pol ?? "출발항"} 출항 ${v.etd ? `${shortDate(v.etd)} (${dDay(d)})` : "미정"} · 컨테이너 ${list.length}대`,
        vesselWatchId: vid,
        containerIds: list.map((c) => c.id),
      });
    }
  }

  for (const c of open) {
    const vessel = byId.get(c.vesselWatchId);
    const v = voyageSummary(vessel);
    const stage = containerStage(c, v, today);
    if (stage === "needsTrucking") {
      items.push({
        key: `truck:${c.id}`,
        kind: "needsTrucking",
        severity: "danger",
        title: `${c.importer || "수입자 미정"} · ${c.size}FT ${c.containerNo || ""}`.trim(),
        detail: `${v.pod ?? "도착항"} ${v.arrived ? "입항 완료" : `입항 ${v.eta ? shortDate(v.eta) : ""}`} · 배차가 필요해요`,
        vesselWatchId: c.vesselWatchId,
        containerIds: [c.id],
        hbl: c.hbl,
      });
    }
    const ft = freeTimeStatus(c, today, v);
    if ((ft.state === "soon" || ft.state === "over" || ft.state === "willExceed") && hasArrivedOrSoon(v, today)) {
      items.push({
        key: `ft:${c.id}`,
        kind: "freeTime",
        severity: ft.state === "soon" ? "warning" : "danger",
        title: `${c.containerNo || `${c.size}FT`} 프리타임 ${ft.days !== null ? dDay(ft.days) : ""}`,
        detail:
          ft.state === "willExceed"
            ? `운송일 ${shortDate(c.deliveryDate!)}이 프리타임 ${shortDate(ft.date!)}보다 늦어요`
            : ft.state === "over"
              ? `프리타임 ${shortDate(ft.date!)} 지남 · ${c.importer}`
              : `프리타임 ${shortDate(ft.date!)}까지 · ${c.importer}`,
        vesselWatchId: c.vesselWatchId,
        containerIds: [c.id],
        hbl: c.hbl,
      });
    }
  }

  // 서렌더 is per HB/L, needed once the ship is about to arrive.
  const perHbl = new Map<string, ContainerShipment[]>();
  for (const c of open) {
    if (c.surrendered || !c.hbl) continue;
    perHbl.set(c.hbl, [...(perHbl.get(c.hbl) ?? []), c]);
  }
  for (const [hbl, list] of perHbl) {
    const v = voyageSummary(byId.get(list[0].vesselWatchId));
    if (!hasArrivedOrSoon(v, today)) continue;
    items.push({
      key: `sur:${hbl}`,
      kind: "surrender",
      severity: hasArrived(v, today) ? "danger" : "warning",
      title: `HB/L ${hbl} 서렌더 미완료`,
      detail: `${list[0].importer} · 컨테이너 ${list.length}대 · ${hasArrived(v, today) ? "입항 완료" : `입항 ${v.eta ? shortDate(v.eta) : ""}`}`,
      vesselWatchId: list[0].vesselWatchId,
      containerIds: list.map((c) => c.id),
      hbl,
    });
  }

  const rank = (i: AttentionItem) => (i.severity === "danger" ? 0 : 1);
  return items.sort((a, b) => rank(a) - rank(b));
}

/** Arrived, or arriving within 2 days. */
function hasArrivedOrSoon(v: VoyageSummary, today: string): boolean {
  return hasArrived(v, today) || Boolean(v.eta && daysUntil(v.eta, today) <= 2);
}

export function vesselLabel(vessel: VesselWatch | undefined): string {
  if (!vessel) return "선박 미지정";
  return [vessel.vesselName, vessel.voyage].filter(Boolean).join(" ");
}

/** "10/23" */
export function shortDate(d: string): string {
  const [, m, day] = d.slice(0, 10).split("-");
  return `${Number(m)}/${Number(day)}`;
}

/** Monday-based week containing `today` - for "이번 주 입항". */
export function inThisWeek(date: string, today: string): boolean {
  const t = new Date(`${today}T00:00:00Z`);
  const monday = dayNumber(today) - ((t.getUTCDay() + 6) % 7);
  const n = dayNumber(date);
  return n >= monday && n < monday + 7;
}

/** Plain-text daily digest for the messenger alert (null = nothing to say). */
export function attentionDigest(items: AttentionItem[], siteUrl: string): string | null {
  if (items.length === 0) return null;
  const count = (k: AttentionKind) => items.filter((i) => i.kind === k).length;
  const head = [
    count("confirmDeparture") && `출항 확인 필요 ${count("confirmDeparture")}건`,
    count("departing") && `출항 임박 ${count("departing")}건`,
    count("needsTrucking") && `배차 필요 ${count("needsTrucking")}대`,
    count("freeTime") && `프리타임 주의 ${count("freeTime")}대`,
    count("surrender") && `서렌더 미완료 ${count("surrender")}건`,
  ]
    .filter(Boolean)
    .join(" · ");
  const lines = items.slice(0, 20).map((i) => `${i.severity === "danger" ? "🔴" : "🟡"} ${i.title} - ${i.detail}`);
  return [`📦 컨테이너 현황 확인 필요: ${head}`, ...lines, items.length > 20 ? `외 ${items.length - 20}건` : "", `${siteUrl}/containers`]
    .filter(Boolean)
    .join("\n");
}
