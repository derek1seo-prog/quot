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
