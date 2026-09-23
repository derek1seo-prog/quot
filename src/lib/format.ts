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

/**
 * Converts a 2-letter ISO-ish country code (Country.id, e.g. "CN") into its
 * flag emoji via the regional indicator symbol trick, so a new country's
 * flag shows up automatically the moment its region data is added - no
 * icon file or per-country lookup table to maintain as more regions come
 * online.
 */
export function countryFlag(countryId: string): string {
  return countryId
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
