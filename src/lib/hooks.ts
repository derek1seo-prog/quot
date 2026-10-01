import { useEffect, useState } from "react";
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
