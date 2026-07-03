import { useEffect, useState } from "react";
import { UserLibraryService } from "../services/UserLibraryService";
import { logError } from "../utils/errors";

/**
 * Powers the small counts shown on the Watchlist/Watching/Watched
 * tab badges. Deliberately separate from useUserLibrary — the badges
 * need totals across all statuses, not just the paginated slice of
 * whichever tab is open.
 * @param {string|null} userId
 * @param {number} refreshKey  bump to force a refetch (e.g. after a mutation)
 */
export function useLibraryCounts(userId, refreshKey = 0) {
  const [counts, setCounts] = useState({ watchlist: 0, watching: 0, watched: 0 });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    UserLibraryService.getCounts(userId)
      .then((c) => active && setCounts(c))
      .catch((e) => logError(e, "useLibraryCounts"));
    return () => {
      active = false;
    };
  }, [userId, refreshKey]);

  return counts;
}
