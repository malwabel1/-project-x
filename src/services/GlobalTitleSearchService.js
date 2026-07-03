import { GlobalTitleSearchRepository } from "../repositories/GlobalTitleSearchRepository";
import { TMDBService } from "./TMDBService";
import { toAppError, logError } from "../utils/errors";

/**
 * Service for "search mode 2": searching the global title catalogue,
 * as opposed to UserLibraryService.getPage's "search mode 1", which
 * searches only what the current user is already tracking.
 *
 * Composes two providers:
 *   1. TMDBService — the primary provider. Real, current metadata
 *      for essentially anything a user would search for.
 *   2. GlobalTitleSearchRepository's local catalogue — titles already
 *      in Memora's own `titles` table (previously imported from TMDB,
 *      or added manually). Used only if TMDB is unreachable (edge
 *      function down, TMDB_API_KEY not configured, network error),
 *      so search still returns *something* instead of failing.
 *
 * No hook or component calling GlobalTitleSearchService.search()
 * needs to know which provider served the results.
 */
export const GlobalTitleSearchService = {
  /**
   * @param {string} query
   * @param {{ limit?: number }} [options]
   * @returns {Promise<import('../types').Title[]>}
   */
  async search(query, { limit = 20 } = {}) {
    const trimmed = (query || "").trim();
    if (!trimmed) return [];

    try {
      return await TMDBService.search(trimmed, { limit });
    } catch (remoteError) {
      logError(remoteError, "GlobalTitleSearchService.search (TMDB unavailable, falling back to local catalogue)");
      const { data, error } = await GlobalTitleSearchRepository.searchLocalCatalogue(trimmed, { limit });
      if (error) throw toAppError(error, "Couldn't search the catalogue.");
      return data.map(toTitle);
    }
  },
};

/**
 * @param {any} row
 * @returns {import('../types').Title}
 */
function toTitle(row) {
  return {
    id: row.id,
    tmdbId: row.tmdb_id,
    title: row.title,
    type: row.type,
    genre: row.genre,
    totalEpisodes: row.total_episodes,
    posterUrl: row.poster_url,
    backdropUrl: row.backdrop_url,
    overview: row.overview,
    releaseYear: row.release_year,
    runtime: row.runtime,
    popularity: row.popularity,
    originalTitle: row.original_title,
    language: row.language,
    status: row.status,
    voteAverage: row.vote_average,
  };
}
