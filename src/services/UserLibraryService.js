import { UserLibraryRepository } from "../repositories/UserLibraryRepository";
import { TitlesService } from "./TitlesService";
import { ActivityService } from "./ActivityService";
import { TMDBService } from "./TMDBService";
import { AppError, toAppError, logError } from "../utils/errors";
import { cache, libraryCacheKey } from "../utils/cache";

/**
 * Service layer for `user_titles`. Hooks call this -- never the
 * repository or supabase directly. This is also where cross-cutting
 * concerns live: mapping DB rows to `LibraryEntry` objects, the
 * read-through cache fallback, turning repository errors into
 * AppError, and (Milestone 2) logging Recent Activity alongside each
 * mutation via ActivityService -- a service composing another
 * service, the same pattern already used for TitlesService.
 */

/**
 * @param {any} row  raw row from UserLibraryRepository
 * @returns {import('../types').LibraryEntry}
 */
function toLibraryEntry(row) {
  return {
    id: row.id,
    titleId: row.titles.id,
    title: row.titles.title,
    type: row.titles.type,
    genre: row.titles.genre,
    totalEpisodes: row.titles.total_episodes,
    status: row.status,
    rating: row.rating ?? 0,
    notes: row.notes ?? "",
    currentSeason: row.current_season ?? 1,
    currentEpisode: row.current_episode ?? 0,
    addedAt: row.added_at,
    posterUrl: row.titles.poster_url ?? null,
    backdropUrl: row.titles.backdrop_url ?? null,
    overview: row.titles.overview ?? null,
    releaseYear: row.titles.release_year ?? null,
    titleStatus: row.titles.status ?? null,
    voteAverage: row.titles.vote_average ?? null,
    runtimeMinutes: row.titles.runtime ?? null,
  };
}

export const UserLibraryService = {
  /**
   * Fetches one page of a user's library, optionally filtered by
   * status and/or a server-side title search. Passing `status` as
   * null/undefined returns titles across every status -- used by the
   * Recently Added row on Home, which isn't scoped to one tab.
   * Falls back to the last cached page-0 result if the network
   * request fails (offline scaffold -- see utils/cache.js).
   * @param {{ userId: string, status?: import('../types').LibraryStatus|null, search?: string, page: number, pageSize: number }} params
   * @returns {Promise<import('../types').Page>}
   */
  async getPage({ userId, status, search, page, pageSize }) {
    const offset = page * pageSize;
    const cacheKey = status ? libraryCacheKey(userId, status) : null;

    try {
      const { data, error, count } = await UserLibraryRepository.fetchPage({
        userId,
        status,
        search,
        limit: pageSize,
        offset,
      });
      if (error) throw error;

      const items = data.map(toLibraryEntry);

      // Cache only the first, unfiltered page per status -- enough
      // to show *something* offline without caching every search
      // permutation.
      if (page === 0 && !search && cacheKey) cache.set(cacheKey, items);

      const total = count ?? items.length;
      return { items, hasMore: offset + items.length < total, total };
    } catch (rawError) {
      if (page === 0 && !search && cacheKey) {
        const cached = cache.get(cacheKey);
        if (cached) return { items: cached, hasMore: false, total: cached.length };
      }
      throw toAppError(rawError, "Couldn't load your titles. Check your connection and try again.");
    }
  },

  /**
   * Unpaginated fetch for the Stats/Profile screen.
   * @param {string} userId
   * @returns {Promise<import('../types').LibraryEntry[]>}
   */
  async getAllForStats(userId) {
    const { data, error } = await UserLibraryRepository.fetchAll(userId);
    if (error) throw toAppError(error, "Couldn't load your stats.");
    return data.map(toLibraryEntry);
  },

  /**
   * @param {string} userId
   * @returns {Promise<import('../types').LibraryCounts>}
   */
  async getCounts(userId) {
    const statuses = /** @type {import('../types').LibraryStatus[]} */ (["watchlist", "watching", "watched"]);
    const results = await Promise.all(statuses.map((s) => UserLibraryRepository.countByStatus(userId, s)));

    results.forEach((r, i) => {
      if (r.error) throw toAppError(r.error, `Couldn't load your ${statuses[i]} count.`);
    });

    return {
      watchlist: results[0].count ?? 0,
      watching: results[1].count ?? 0,
      watched: results[2].count ?? 0,
    };
  },

  /**
   * Adds a manually-entered title to a user's library.
   * @param {string} userId
   * @param {import('../types').LibraryEntryInput} entry
   */
  async addTitle(userId, entry) {
    const titleId = await TitlesService.findOrCreateTitleId({
      title: entry.title,
      type: entry.type,
      genre: entry.genre,
      totalEpisodes: entry.totalEpisodes,
      userId,
    });

    await insertTrackingRow(userId, titleId, entry);
    ActivityService.log(userId, { titleId, titleName: entry.title, action: "added" });
  },

  /**
   * Adds a title sourced from TMDB search to a user's library. Same
   * duplicate-safety guarantees as addTitle, but resolves/creates the
   * catalogue row via tmdb_id (TitlesService.findOrCreateFromTmdb)
   * instead of (title, type).
   * @param {string} userId
   * @param {import('../types').Title} tmdbTitle  a result from TMDBService.search / GlobalTitleSearchService.search
   * @param {Partial<import('../types').LibraryEntryInput>} [extra]  status/rating/notes/season/episode for the new entry
   */
  async addTitleFromTmdb(userId, tmdbTitle, extra = {}) {
    const titleId = await TitlesService.findOrCreateFromTmdb({ ...tmdbTitle, userId });
    await insertTrackingRow(userId, titleId, { status: "watchlist", ...extra });
    ActivityService.log(userId, { titleId, titleName: tmdbTitle.title, action: "added" });

    // Fire-and-forget enrichment (same philosophy as ActivityService.log
    // above): the tmdb-details Edge Function fetches runtime /
    // total_episodes / status from TMDB and persists them into the
    // `titles` row server-side. Deliberately NOT awaited -- the add is
    // already complete and must never be blocked or failed by
    // enrichment; on error we only log. Enriched fields appear the
    // next time the entry is fetched (screens refetch on remount).
    if (typeof tmdbTitle.tmdbId === "number" && (tmdbTitle.type === "movie" || tmdbTitle.type === "tv")) {
      TMDBService.fetchAndPersistDetails(tmdbTitle.tmdbId, tmdbTitle.type).catch((e) =>
        logError(e, "UserLibraryService.addTitleFromTmdb (details enrichment, non-blocking)")
      );
    }
  },

  /**
   * @param {string} userId  needed to attribute the Recent Activity entry, not for the write itself (RLS already scopes that)
   * @param {string} userTitleId
   * @param {Partial<import('../types').LibraryEntryInput>} patch
   */
  async updateEntry(userId, userTitleId, patch) {
    // Only fetched when needed for activity logging (status/rating
    // changes) -- notes-only or season/episode-only edits skip this
    // extra read entirely.
    let previous = null;
    if (patch.status !== undefined || patch.rating !== undefined) {
      const { data } = await UserLibraryRepository.findById(userTitleId);
      previous = data;
    }

    const dbPatch = {};
    if (patch.status !== undefined) dbPatch.status = patch.status;
    if (patch.rating !== undefined) dbPatch.rating = patch.rating;
    if (patch.notes !== undefined) dbPatch.notes = patch.notes || null;
    if (patch.currentSeason !== undefined) dbPatch.current_season = patch.currentSeason;
    if (patch.currentEpisode !== undefined) dbPatch.current_episode = patch.currentEpisode;

    const { error } = await UserLibraryRepository.update(userTitleId, dbPatch);
    if (error) throw toAppError(error, "Couldn't save that change.");

    if (previous) {
      const titleName = previous.titles?.title || "a title";
      if (patch.status !== undefined && patch.status !== previous.status) {
        ActivityService.log(userId, {
          titleId: previous.title_id,
          titleName,
          action: "status_changed",
          detail: { from: previous.status, to: patch.status },
        });
      }
      if (patch.rating !== undefined && patch.rating > 0 && patch.rating !== previous.rating) {
        ActivityService.log(userId, {
          titleId: previous.title_id,
          titleName,
          action: "rated",
          detail: { rating: patch.rating },
        });
      }
    }
  },

  /**
   * @param {string} userId
   * @param {string} userTitleId
   * @param {import('../types').LibraryStatus} status
   */
  async updateStatus(userId, userTitleId, status) {
    return UserLibraryService.updateEntry(userId, userTitleId, { status });
  },

  /**
   * @param {string} userId
   * @param {string} userTitleId
   * @param {number} rating
   */
  async updateRating(userId, userTitleId, rating) {
    return UserLibraryService.updateEntry(userId, userTitleId, { rating });
  },

  /**
   * @param {string} userId
   * @param {string} userTitleId
   */
  async removeEntry(userId, userTitleId) {
    const { data: previous } = await UserLibraryRepository.findById(userTitleId);
    const { error } = await UserLibraryRepository.remove(userTitleId);
    if (error) throw toAppError(error, "Couldn't remove that title.");
    if (previous) {
      ActivityService.log(userId, {
        titleId: previous.title_id,
        titleName: previous.titles?.title || "a title",
        action: "removed",
      });
    }
  },
};

/**
 * Shared by addTitle and addTitleFromTmdb: checks for an existing
 * (user, title) tracking row first so the common case -- a user
 * re-adding something already tracked -- gets the friendly message
 * below instead of a raw database error, then inserts via the
 * duplicate-safe upsert as a fallback for the rare race between the
 * check and the write.
 * @param {string} userId
 * @param {string} titleId
 * @param {Partial<import('../types').LibraryEntryInput>} entry
 */
async function insertTrackingRow(userId, titleId, entry) {
  const { data: existing, error: existsError } = await UserLibraryRepository.findByUserAndTitle(userId, titleId);
  if (existsError) throw toAppError(existsError, "Couldn't check your library.");
  if (existing) {
    throw new AppError("This title is already in your library.", { code: "DUPLICATE_LIBRARY_ENTRY" });
  }

  const { data, error } = await UserLibraryRepository.insert({
    user_id: userId,
    title_id: titleId,
    status: entry.status,
    rating: entry.rating || 0,
    notes: entry.notes || null,
    current_season: entry.currentSeason || 1,
    current_episode: entry.currentEpisode || 0,
  });
  if (error) throw toAppError(error, "Couldn't add that title.");

  // Belt-and-suspenders: ignoreDuplicates means a genuine race (two
  // inserts for the same user+title landing at once) resolves with
  // no row and no error rather than a 23505 -- surface the same
  // friendly message instead of silently doing nothing.
  if (!data || data.length === 0) {
    throw new AppError("This title is already in your library.", { code: "DUPLICATE_LIBRARY_ENTRY" });
  }
}
