import type { CustomCharge } from "./types";

/** chargeTypeId prefix of an admin-typed quote line (see QuoteInput.customCharges). */
export const CUSTOM_CHARGE_PREFIX = "CUSTOM_";

export function isCustomChargeId(chargeTypeId: string): boolean {
  return chargeTypeId.startsWith(CUSTOM_CHARGE_PREFIX);
}

/** A standard charge removed from one quote, remembered so it can be restored. */
export interface ExcludedCharge {
  chargeTypeId: string;
  nameKo: string;
  category: CustomCharge["category"];
}

/** Callbacks the quick-quote form hands QuoteDocument to make its charge
 * table editable (add / edit / remove lines, remove / restore standard ones). */
export interface QuoteChargeEditor {
  customCharges: CustomCharge[];
  excluded: ExcludedCharge[];
  onAdd: (category: CustomCharge["category"]) => void;
  onChange: (id: string, patch: Partial<Omit<CustomCharge, "id">>) => void;
  onRemove: (id: string) => void;
  onExclude: (charge: ExcludedCharge) => void;
  onRestore: (chargeTypeId: string) => void;
  /** Edits made but not yet reflected in the totals (recalculating). */
  pending?: boolean;
}
