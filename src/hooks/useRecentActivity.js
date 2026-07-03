import { useEffect, useState } from "react";
import { ActivityService } from "../services/ActivityService";
import { logError } from "../utils/errors";

/**
 * @param {string|null} userId
 * @param {number} [limit]
 * @param {number} [refreshKey]  bump to force a refetch after a mutation
 */
export function useRecentActivity(userId, limit = 20, refreshKey = 0) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    ActivityService.getRecent(userId, limit)
      .then((data) => active && setItems(data))
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        logError(e, "useRecentActivity");
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [userId, limit, refreshKey]);

  return { items, loading, error };
}
