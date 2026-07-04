import { TMDBRepository } from "../repositories/TMDBRepository";
import { toAppError } from "../utils/errors";

/**
 * Service layer for TMDB. Hooks/components never call TMDBRepository
 * directly -- only this.
 *
 * The `tmdb-search` Edge Function does the heavy lifting: it calls
 * TMDB, filters to movies and TV shows, and maps each result into a
 * row shaped to match Memora's `titles` table columns (tmdb_id,
 * title, type, poster_url, backdrop_url, overview, release_year,
 * popularity, original_title, language, vote_average) -- see
 * supabase/functions/tmdb-search/index.ts. This file's only job is
 * converting that snake_case, schema-shaped row into the app's
 * camelCase `Title` type. No filtering happens here, and no field
 * from TMDB's own raw API response is read here -- everything below
 * reads only the columns the Edge Function already produced.
 */
export const TMDBService = {
  /**
   * @param {string} query
   * @param {{ limit?: number }} [options]
   * @returns {Promise<import('../types').Title[]>}
   */
  async search(query, { limit = 20 } = {}) {
    const trimmed = (query || "").trim();
    if (!trimmed) return [];

    const { data, error } = await TMDBRepository.searchMulti(trimmed);
    if (error) throw toAppError(error, "Couldn't search TMDB right now.");
    if (data?.error) throw toAppError(new Error(data.error), "Couldn't search TMDB right now.");

    const rows = Array.isArray(data?.results) ? data.results : [];
    return rows.slice(0, limit).map(toTitle);
  },
};

/**
 * @param {any} row  a schema-shaped row from the tmdb-search Edge Function
 * @returns {import('../types').Title}
 */
function toTitle(row) {
  return {
    // No `id` yet -- this title may not exist in our `titles` table.
    // TitlesService.findOrCreateFromTmdb resolves a real id from
    // tmdbId before anything is written.
    id: null,
    tmdbId: row.tmdb_id,
    title: row.title,
    originalTitle: row.original_title || null,
    type: row.type,
    // The search endpoint doesn't return genre names or episode
    // counts -- only a details-endpoint call would. Left null until
    // that's added; not required for search/add to work.
    genre: null,
    totalEpisodes: null,
    posterUrl: row.poster_url || null,
    backdropUrl: row.backdrop_url || null,
    overview: row.overview || null,
    releaseYear: typeof row.release_year === "number" ? row.release_year : null,
    runtime: null,
    popularity: typeof row.popularity === "number" ? row.popularity : null,
    voteAverage: typeof row.vote_average === "number" ? row.vote_average : null,
    language: row.language || null,
    status: null,
    imdbId: null,
  };
}
