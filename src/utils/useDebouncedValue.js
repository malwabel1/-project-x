import { useEffect, useState } from "react";

/**
 * Returns `value`, delayed by `delayMs` after it stops changing.
 * Used to turn keystrokes into a server-side search query without
 * firing a request per character.
 * @template T
 * @param {T} value
 * @param {number} [delayMs]
 * @returns {T}
 */
export function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
