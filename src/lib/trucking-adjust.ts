import type { Customer } from "./types";

/** The per-화주 amounts a 안전운임 % change moves together: the quoted
 * 내륙운송료 and the reference 안전운임, for every port × size. */
export const TRUCKING_FIELDS = [
  "incheonTruckingRate20ft",
  "incheonTruckingRate40hq",
  "busanTruckingRate20ft",
  "busanTruckingRate40hq",
  "pyeongtaekTruckingRate20ft",
  "pyeongtaekTruckingRate40hq",
  "incheonSafeRate20ft",
  "incheonSafeRate40hq",
  "busanSafeRate20ft",
  "busanSafeRate40hq",
  "pyeongtaekSafeRate20ft",
  "pyeongtaekSafeRate40hq",
] as const satisfies readonly (keyof Customer)[];

export type TruckingAmountField = (typeof TRUCKING_FIELDS)[number];

export const FIELD_LABEL: Record<TruckingAmountField, string> = {
  incheonTruckingRate20ft: "인천 20FT 운송료",
  incheonTruckingRate40hq: "인천 40HQ 운송료",
  busanTruckingRate20ft: "부산 20FT 운송료",
  busanTruckingRate40hq: "부산 40HQ 운송료",
  pyeongtaekTruckingRate20ft: "평택 20FT 운송료",
  pyeongtaekTruckingRate40hq: "평택 40HQ 운송료",
  incheonSafeRate20ft: "인천 20FT 안전운임",
  incheonSafeRate40hq: "인천 40HQ 안전운임",
  busanSafeRate20ft: "부산 20FT 안전운임",
  busanSafeRate40hq: "부산 40HQ 안전운임",
  pyeongtaekSafeRate20ft: "평택 20FT 안전운임",
  pyeongtaekSafeRate40hq: "평택 40HQ 안전운임",
};

export const ROUND_UNITS = [100, 1000, 10] as const;
export type RoundUnit = (typeof ROUND_UNITS)[number];

export const MAX_ADJUST_PERCENT = 50;

export function isValidPercent(p: number): boolean {
  // Up to 2 decimals (with float slack: 0.07 * 100 isn't exactly 7).
  return Number.isFinite(p) && p !== 0 && Math.abs(p) <= MAX_ADJUST_PERCENT && Math.abs(Math.round(p * 100) - p * 100) < 1e-6;
}

/** value × (1 + pct/100), rounded to the unit (100원 by default). */
export function adjustAmount(value: number, pct: number, unit: RoundUnit = 100): number {
  return Math.round((value * (1 + pct / 100)) / unit) * unit;
}

export interface AdjustPreviewRow {
  id: string;
  name: string;
  changes: { field: TruckingAmountField; from: number; to: number }[];
}

/** What a % change would do to every 화주 (empty amounts stay empty). */
export function previewAdjustment(customers: Customer[], pct: number, unit: RoundUnit): AdjustPreviewRow[] {
  return customers
    .map((c) => ({
      id: c.id,
      name: c.name,
      changes: TRUCKING_FIELDS.flatMap((field) => {
        const from = c[field];
        if (typeof from !== "number" || !Number.isFinite(from)) return [];
        const to = adjustAmount(from, pct, unit);
        return to === from ? [] : [{ field, from, to }];
      }),
    }))
    .filter((r) => r.changes.length > 0);
}

/** The last 일괄 조정, kept so it can be undone exactly. */
export interface CustomerRateAdjustment {
  percent?: number;
  unit?: RoundUnit;
  at?: string;
  /** customerId -> field -> the value before the adjustment */
  previous?: Record<string, Partial<Record<TruckingAmountField, number>>>;
}
