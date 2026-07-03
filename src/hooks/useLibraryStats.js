import { useEffect, useState } from "react";
import { UserLibraryService } from "../services/UserLibraryService";
import { logError } from "../utils/errors";

/**
 * Feeds the Stats tab, which needs every title (not a page of them)
 * to compute totals, hours, and top genre. Only fetched when the
 * Stats tab is actually open (see App.jsx) — no point paying for it
 * on every tab switch.
 * @param {string|null} userId
 * @param {boolean} enabled
 * @param {number} refreshKey
 */
export function useLibraryStats(userId, enabled, refreshKey = 0) {
  const [titles, setTitles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !enabled) return;
    let active = true;
    setLoading(true);
    UserLibraryService.getAllForStats(userId)
      .then((data) => active && setTitles(data))
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        logError(e, "useLibraryStats");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId, enabled, refreshKey]);

  return { titles, loading, error };
}
