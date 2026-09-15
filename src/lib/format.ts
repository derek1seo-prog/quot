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
 * Normalizes a stored quote's regionNameKo for display. Older quotes may
 * have the region's pre-rename name baked in permanently (a snapshot taken
 * at calculation time), so this keeps them display-consistent with the
 * current short name without needing a data migration.
 */
export function regionLabel(nameKo: string): string {
  return nameKo.replace(/\s*\/\s*동중국/, "");
}

export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 10);
}
