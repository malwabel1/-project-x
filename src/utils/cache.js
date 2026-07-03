/**
 * Minimal cache abstraction. Today it's a thin wrapper over
 * localStorage used as a "last known good" fallback when a fetch
 * fails (e.g. offline). The point of the abstraction is that nothing
 * outside this file knows that: UserLibraryService calls cache.get/
 * cache.set, not localStorage directly. Swapping this for IndexedDB
 * (web, larger quota) or AsyncStorage (React Native) later is a
 * one-file change.
 */

const PREFIX = "memora:cache:";

function storageAvailable() {
  try {
    return typeof window !== "undefined" && !!window.localStorage;
  } catch {
    return false;
  }
}

export const cache = {
  /**
   * @param {string} key
   * @returns {any|null}
   */
  get(key) {
    if (!storageAvailable()) return null;
    try {
      const raw = window.localStorage.getItem(PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    if (!storageAvailable()) return;
    try {
      window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      // quota exceeded or unavailable — caching is best-effort, never throw
    }
  },

  /** @param {string} key */
  remove(key) {
    if (!storageAvailable()) return;
    try {
      window.localStorage.removeItem(PREFIX + key);
    } catch {
      /* noop */
    }
  },
};

/**
 * Builds a stable cache key for a user's library slice, so the
 * read-through cache in UserLibraryService doesn't collide across
 * users, tabs, or search terms.
 */
export function libraryCacheKey(userId, status) {
  return `library:${userId}:${status}`;
}
