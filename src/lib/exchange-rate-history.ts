import { getExchangeRateHistory, recordExchangeRateHistory } from "@/lib/data-store";
import type { ExchangeRateHistoryEntry } from "@/lib/types";

export const EXCHANGE_TREND_DAYS = 14;

/** Today's calendar date in Korea - the cron stamps asOf the same way. */
export function kstToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
}

export function shiftIsoDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Change across a drawn chart: its last point minus its first point, so the
 * number shown next to a trend line always matches that line's endpoints. */
export function rateChange(points: ExchangeRateHistoryEntry[]) {
  if (points.length < 2) return null;
  const first = points[0];
  const last = points[points.length - 1];
  return { first, last, change: last.rate - first.rate };
}

/** "10/12" - short month/day for change labels and tooltips. */
export function shortDate(iso: string): string {
  return iso.slice(5).replace("-", "/");
}

/** Free, no-key ECB reference rates (business days only) - used once to
 * fill the trend for days before this app started keeping history. */
async function fetchEcbUsdKrw(start: string, end: string): Promise<Record<string, number>> {
  const res = await fetch(`https://api.frankfurter.app/${start}..${end}?from=USD&to=KRW`, {
    signal: AbortSignal.timeout(3000),
  });
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const data = (await res.json()) as { rates?: Record<string, { KRW?: number }> };
  const out: Record<string, number> = {};
  for (const [date, r] of Object.entries(data.rates ?? {})) {
    if (typeof r.KRW === "number" && Number.isFinite(r.KRW) && r.KRW > 0) out[date] = Math.round(r.KRW);
  }
  return out;
}

/** The last EXCHANGE_TREND_DAYS days of USD->KRW history. If fewer than two
 * days have been recorded yet, backfills the window from ECB rates first
 * (best effort - a failed fetch just leaves the recorded entries as is). */
export async function getUsdKrwTrend(): Promise<ExchangeRateHistoryEntry[]> {
  const end = kstToday();
  const start = shiftIsoDate(end, -(EXCHANGE_TREND_DAYS - 1));
  const inWindow = (h: ExchangeRateHistoryEntry) => h.date >= start && h.date <= end;

  let history = (await getExchangeRateHistory("USD")).filter(inWindow);
  if (history.length < 2) {
    try {
      const ecb = await fetchEcbUsdKrw(start, end);
      const recordedAt = new Date().toISOString();
      await recordExchangeRateHistory(
        Object.entries(ecb).map(([date, rate]) => ({ currency: "USD", date, rate, source: "ecb", recordedAt })),
      );
      history = (await getExchangeRateHistory("USD")).filter(inWindow);
    } catch {
      // offline / upstream down - show whatever has been recorded
    }
  }
  return history;
}
