import type { Quote } from "./types";

export function formatCurrency(amount: number, currency: "KRW" | "USD" | "CNY" = "KRW"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KRW" ? 0 : 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-US").format(amount);
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}

/** Today's calendar date as YYYY-MM-DD - the single shared source for
 * every "default to today" field (quoteDate, asOf, rate effective dates,
 * etc.) instead of each call site reimplementing
 * `new Date().toISOString().slice(0, 10)` on its own. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Last day of the calendar month containing `dateIso`, as YYYY-MM-DD -
 * used for "유효기간" fields that default to end-of-month. Parses the
 * year/month as plain numbers and constructs the date via the local-time
 * Date constructor (not `new Date(dateIso)`, which parses as UTC
 * midnight and can read back a day off depending on the server's
 * timezone - the same class of bug this app's cron date fix already
 * worked around once). */
export function endOfMonthIso(dateIso: string): string {
  const [year, month] = dateIso.split("-").map(Number);
  const lastDay = new Date(year, month, 0);
  const mm = String(lastDay.getMonth() + 1).padStart(2, "0");
  const dd = String(lastDay.getDate()).padStart(2, "0");
  return `${lastDay.getFullYear()}-${mm}-${dd}`;
}

/** Date + KST time (explicit timezone, not the server/browser's own) -
 * consistent with why the exchange-rate cron route itself computes KST
 * dates rather than trusting toISOString(). */
export function formatDateTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(d);
  const time = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date} ${time}`;
}

/** A 20FT+40HQ quick quote has two different totals, so lists show this
 * label (e.g. "20FT+40HQ") instead of one amount. null for normal quotes. */
export function pairLabel(quote: Pick<Quote, "result" | "pairedResult">): string | null {
  return quote.pairedResult
    ? `${quote.result.column.containerLabel}+${quote.pairedResult.column.containerLabel}`
    : null;
}

/** 견적 목록: the containers a quote was made for - "20FT 2대", or
 * "20FT 1대 + 40HQ 1대" for a 20FT+40HQ quote. */
export function containerSummary(quote: Pick<Quote, "input" | "result" | "pairedResult">): string {
  const main = `${quote.result.column.containerLabel} ${quote.input.container.quantity}대`;
  return quote.pairedResult
    ? `${main} + ${quote.pairedResult.column.containerLabel} ${quote.input.pairedContainer?.quantity ?? 1}대`
    : main;
}

/** Hover text with the quote's total(s). */
export function quoteTotalsTitle(quote: Pick<Quote, "result" | "pairedResult">): string {
  return pairTotalsTitle(quote) ?? `합계 ${formatCurrency(quote.result.column.grandTotalKrw, "KRW")}`;
}

/** Hover text with both totals of a 20FT+40HQ quote. */
export function pairTotalsTitle(quote: Pick<Quote, "result" | "pairedResult">): string | undefined {
  if (!quote.pairedResult) return undefined;
  return [quote.result, quote.pairedResult]
    .map((r) => `${r.column.containerLabel} ${formatCurrency(r.column.grandTotalKrw, "KRW")}`)
    .join(" / ");
}
