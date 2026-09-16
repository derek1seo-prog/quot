import { useEffect, useState } from "react";

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
