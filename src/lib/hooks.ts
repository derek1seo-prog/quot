import { DEFAULT_SALES_REP_ID } from "@/lib/customer-portal";
import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

/** Delays reflecting `value` until it's stayed unchanged for `delayMs` -
 * lets fast-typed search input settle before it's used to filter. */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

/** Closes a dropdown/panel on an outside mousedown or Escape - the exact
 * pattern hand-rolled independently in every combobox/select in this app
 * (PortCombobox, CustomerCombobox, SalesRepCombobox, IncotermsSelect).
 * Only wired up while `active` is true, matching each component's own
 * `if (!open) return;` guard. */
export function useDismissable(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!active) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onDismiss();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onDismiss();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [active, ref, onDismiss]);
}

const LAST_SALES_REP_KEY = "quot:lastSalesRepId";

/** 견적 담당자 (발신) picker state that remembers the last pick in this
 * browser's localStorage and starts from it next time, instead of always
 * resetting to DEFAULT_SALES_REP_ID. Per-browser only (nothing server-side).
 * `reps` is the picker's option list - a remembered id is only applied once
 * it's loaded and still contains that rep (a deleted rep falls back to the
 * default). */
export function useRememberedSalesRepId(reps: { id: string }[] | undefined) {
  const [salesRepId, setSalesRepIdState] = useState(DEFAULT_SALES_REP_ID);

  useEffect(() => {
    if (!reps) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(LAST_SALES_REP_KEY);
    } catch {
      // storage blocked (private mode etc.) - keep the default
    }
    if (stored && reps.some((r) => r.id === stored)) {
      requestAnimationFrame(() => setSalesRepIdState(stored));
    }
  }, [reps]);

  const setSalesRepId = useCallback((id: string) => {
    setSalesRepIdState(id);
    try {
      localStorage.setItem(LAST_SALES_REP_KEY, id);
    } catch {
      // ignore - remembering is best-effort
    }
  }, []);

  // For automatic fills (e.g. a 화주's assigned rep) - changes the picker
  // without overwriting the remembered "last picked by hand" default.
  return [salesRepId, setSalesRepId, setSalesRepIdState] as const;
}
