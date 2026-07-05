import { useEffect, useState } from "react";
import { GlobalTitleSearchService } from "../services/GlobalTitleSearchService";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import { logError } from "../utils/errors";
import { searchDebug } from "../utils/searchDebug"; // TEMPORARY debug -- remove with searchDebug.js

/**
 * Drives the "search TMDB" tab of the Add-title form. Debounces
 * keystrokes into a search-mode-2 query (see GlobalTitleSearchService)
 * and exposes exactly the state the UI needs to render loading, empty,
 * and error states without any component touching a service directly.
 * @param {string} query
 */
export function useGlobalTitleSearch(query) {
  const [results, setResults] = useState(/** @type {import('../types').Title[]} */ ([]));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debounced = useDebouncedValue(query, 350);
  const trimmed = debounced.trim();

  useEffect(() => {
    // TEMPORARY debug -- proves the effect ran, and with which value.
    searchDebug.set("debounced", trimmed);
    searchDebug.set("effectRan", `yes -- trimmed: "${trimmed}" @ ${new Date().toISOString().slice(11, 23)}`);

    if (!trimmed) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    GlobalTitleSearchService.search(trimmed)
      .then((items) => active && setResults(items))
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        logError(e, "useGlobalTitleSearch");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [trimmed]);

  return { results, loading, error, hasQuery: !!trimmed };
}
