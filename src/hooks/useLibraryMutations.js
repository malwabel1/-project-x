import { useState } from "react";
import { UserLibraryService } from "../services/UserLibraryService";
import { logError } from "../utils/errors";

/**
 * Write-only counterpart to useUserLibrary. Screens that already own
 * a full useUserLibrary instance (LibraryScreen) should keep using
 * its built-in addTitle/updateEntry/removeEntry — those apply
 * optimistic updates to that screen's own list, which this hook
 * intentionally doesn't do (it has no list to patch). This is for
 * screens that need to add/edit/remove without also paginating a
 * list of their own — Search, and Home's cross-cutting "Add title"
 * button / Details-modal save, where the entry being edited could
 * belong to any of several display hooks (Continue Watching,
 * Recently Added, Watchlist Preview) rather than one obvious owner.
 * Same UserLibraryService calls underneath either way.
 * @param {string} userId
 */
export function useLibraryMutations(userId) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function run(fn, context) {
    setSaving(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e.message);
      logError(e, context);
      return false;
    } finally {
      setSaving(false);
    }
  }

  return {
    saving,
    error,
    /** @param {import('../types').LibraryEntryInput} entry */
    addTitle: (entry) => run(() => UserLibraryService.addTitle(userId, entry), "useLibraryMutations.addTitle"),
    /**
     * @param {import('../types').Title} title
     * @param {Partial<import('../types').LibraryEntryInput>} [extra]
     */
    addTitleFromTmdb: (title, extra) =>
      run(() => UserLibraryService.addTitleFromTmdb(userId, title, extra), "useLibraryMutations.addTitleFromTmdb"),
    /** @param {string} id @param {Partial<import('../types').LibraryEntryInput>} patch */
    updateEntry: (id, patch) => run(() => UserLibraryService.updateEntry(userId, id, patch), "useLibraryMutations.updateEntry"),
    /** @param {string} id */
    removeEntry: (id) => run(() => UserLibraryService.removeEntry(userId, id), "useLibraryMutations.removeEntry"),
  };
}
