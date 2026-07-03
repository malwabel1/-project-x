import { useCallback, useEffect, useState } from "react";
import { UserLibraryService } from "../services/UserLibraryService";
import { useDebouncedValue } from "../utils/useDebouncedValue";
import { logError } from "../utils/errors";

const PAGE_SIZE = 20;

/**
 * Drives one tab's list: paginated fetch, debounced server-side
 * search, and optimistic mutations (status/rating/notes changes
 * apply to local state immediately and roll back on failure).
 *
 * @param {{ userId: string|null, status: import('../types').LibraryStatus|null, search: string }} params
 *   `status: null` fetches across every status — used by the Recently
 *   Added row on Home, which isn't scoped to one tab.
 */
export function useUserLibrary({ userId, status, search }) {
  const [items, setItems] = useState(/** @type {import('../types').LibraryEntry[]} */ ([]));
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  const debouncedSearch = useDebouncedValue(search, 300);

  // First page: refetches whenever the tab, search term, or user
  // changes, or refresh() is called (version bump).
  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError(null);

    UserLibraryService.getPage({ userId, status, search: debouncedSearch, page: 0, pageSize: PAGE_SIZE })
      .then(({ items, hasMore }) => {
        if (!active) return;
        setItems(items);
        setHasMore(hasMore);
        setPage(0);
      })
      .catch((e) => {
        if (!active) return;
        setError(e.message);
        logError(e, "useUserLibrary.fetch");
      })
      .finally(() => active && setLoading(false));

    return () => {
      active = false;
    };
  }, [userId, status, debouncedSearch, version]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const { items: more, hasMore: stillMore } = await UserLibraryService.getPage({
        userId,
        status,
        search: debouncedSearch,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });
      setItems((prev) => [...prev, ...more]);
      setHasMore(stillMore);
      setPage(nextPage);
    } catch (e) {
      setError(e.message);
      logError(e, "useUserLibrary.loadMore");
    } finally {
      setLoadingMore(false);
    }
  }, [userId, status, debouncedSearch, page, hasMore, loadingMore]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  async function addTitle(entry) {
    setError(null);
    try {
      await UserLibraryService.addTitle(userId, entry);
      refresh();
      return true;
    } catch (e) {
      setError(e.message);
      logError(e, "addTitle");
      return false;
    }
  }

  /**
   * @param {import('../types').Title} tmdbTitle
   * @param {Partial<import('../types').LibraryEntryInput>} [extra]
   */
  async function addTitleFromTmdb(tmdbTitle, extra) {
    setError(null);
    try {
      await UserLibraryService.addTitleFromTmdb(userId, tmdbTitle, extra);
      refresh();
      return true;
    } catch (e) {
      setError(e.message);
      logError(e, "addTitleFromTmdb");
      return false;
    }
  }

  /**
   * Optimistic patch: applies locally first, calls the service, and
   * rolls back on failure. If the patch moves an item's status away
   * from the currently-viewed tab, it's dropped from the local list
   * once the write succeeds (not before — an optimistic remove would
   * flash the item away even if the write then fails).
   */
  async function updateEntry(id, patch) {
    setError(null);
    const snapshot = items;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

    try {
      await UserLibraryService.updateEntry(userId, id, patch);
      if (patch.status && patch.status !== status) {
        setItems((prev) => prev.filter((it) => it.id !== id));
      }
      return true;
    } catch (e) {
      setItems(snapshot); // rollback
      setError(e.message);
      logError(e, "updateEntry");
      return false;
    }
  }

  const updateStatus = (id, newStatus) => updateEntry(id, { status: newStatus });
  const updateRating = (id, rating) => updateEntry(id, { rating });

  async function removeEntry(id) {
    setError(null);
    const snapshot = items;
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await UserLibraryService.removeEntry(userId, id);
      return true;
    } catch (e) {
      setItems(snapshot); // rollback
      setError(e.message);
      logError(e, "removeEntry");
      return false;
    }
  }

  return {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
    addTitle,
    addTitleFromTmdb,
    updateEntry,
    updateStatus,
    updateRating,
    removeEntry,
  };
}
