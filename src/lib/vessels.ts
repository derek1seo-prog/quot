import type { VesselPortCall, VesselWatch } from "./types";

export const MAX_PORT_CALLS = 6;
const DATE_RE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/;

export function isScheduleDate(v: unknown): v is string {
  return typeof v === "string" && DATE_RE.test(v);
}

/** Whole days between two schedule dates (time of day ignored). */
function dayNumber(d: string): number {
  return Math.round(Date.parse(`${d.slice(0, 10)}T00:00:00Z`) / 86_400_000);
}

/** The first date ever announced for this call's eta/etd - the baseline a
 * delay is measured from. */
export function originalDate(call: VesselPortCall, field: "eta" | "etd"): string | undefined {
  for (const h of call.history) {
    if (h.field !== field) continue;
    if (h.from) return h.from;
    if (h.to) return h.to;
  }
  return call[field];
}

/** Days the current date has moved from the originally announced one
 * (+ = delayed, - = earlier), or null when there's nothing to compare. */
export function delayDays(call: VesselPortCall, field: "eta" | "etd"): number | null {
  const now = call[field];
  const orig = originalDate(call, field);
  if (!now || !orig) return null;
  return dayNumber(now) - dayNumber(orig);
}

export function isDelayed(w: VesselWatch): boolean {
  return w.calls.some((c) => (delayDays(c, "eta") ?? 0) > 0 || (delayDays(c, "etd") ?? 0) > 0);
}

/** "10/23" or "10/23 14:00". */
export function shortScheduleDate(d: string | undefined): string {
  if (!d) return "—";
  const [date, time] = d.split("T");
  const [, m, day] = date.split("-");
  return `${Number(m)}/${Number(day)}${time ? ` ${time}` : ""}`;
}

/** The soonest date still ahead in the voyage (for sorting); falls back to
 * the last known date once everything is in the past. */
export function nextScheduleDate(w: VesselWatch, todayIso: string): string {
  const dates = w.calls.flatMap((c) => [c.etd, c.eta]).filter((d): d is string => Boolean(d)).sort();
  return dates.find((d) => d.slice(0, 10) >= todayIso) ?? dates[dates.length - 1] ?? "9999";
}
